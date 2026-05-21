//! velox-core — application lifecycle coordinator.
//!
//! Wires together every framework subsystem and runs the main event loop.
//!
//! ## Frame budget
//!
//! We use `ControlFlow::Wait` so the event loop sleeps when nothing changes.
//! A redraw is requested explicitly when:
//!   - the window first appears,
//!   - the window is resized,
//!   - a JS async completion arrives (driven by the runtime tick), or
//!   - any other state mutation occurs (mouse, keyboard, scroll).
//!
//! This keeps idle CPU usage near zero — important for battery life and for
//! not saturating the GPU on a static UI.
//!
//! ## Incremental layout (Week 14)
//!
//! `apply_scene_commands` tracks whether any *layout-affecting* prop changed
//! in an UpdateNode command.  Layout props are: width, height, flex,
//! flex_direction, justify_content, align_items, padding, gap, text, font_size.
//! Visual-only props (color, background, border, clip, scroll_offset_y) skip
//! the Taffy rebuild entirely, saving ~1 ms per hover/scroll frame.
//!
//! ## Recursive renderer (Week 14)
//!
//! The flat `build_render_order` loop has been replaced by `render_subtree`,
//! a depth-first recursive function that carries a cumulative `scroll_y`
//! offset.  ScrollView nodes push a Vello clip layer, apply their
//! `scroll_offset_y` to all descendants, then pop the layer.
//!
//! ## Multi-line text / measure function (Week 15A)
//!
//! Text leaf nodes carry a `TextMeasureCtx` so Taffy can call a measure
//! closure during layout.  The closure shapes the text with Parley and
//! returns its natural (width, height).  If no explicit `height` prop is set,
//! Taffy uses the measured height — enabling dynamic multi-line text without
//! fixed height props in JS.
//!
//! ## ScrollView nested hit-test fix (Week 15A)
//!
//! After every layout pass, `update_scroll_positions` walks the JS tree and
//! writes *scroll-adjusted* Y values into the runtime layout cache.
//! JS hit-testing via `__velox_getLayout` then returns the visually correct
//! position for Pressables inside scrolled containers.
//!
//! ## Text shaping
//!
//! `CachedLabel` holds a shaped result keyed by (text, font_size, max_width,
//! color).  Cache misses call Parley once; cache hits return instantly.

#[cfg(feature = "dev")]
use notify::{RecursiveMode, Watcher};
use std::path::PathBuf;
#[cfg(feature = "dev")]
use std::process::Command;
#[cfg(feature = "dev")]
use std::sync::mpsc::{self, Receiver, TryRecvError};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};
use smallvec::SmallVec;
use velox_gpu::GpuContext;
use velox_layout::{flex_column, LayoutTree, ResolvedLayout, TextMeasureCtx};
use velox_renderer::{colors, peniko, VeloxRenderer, FrameBuilder};
use velox_runtime::{
    init_v8, new_ipc_bus,
    CanvasCmd, InputEvent, NodeProps, NodeType, SceneCommand,
    VeloxRuntime, WindowController,
};

pub use velox_runtime::VeloxExtension;
use velox_security::Capabilities;
use velox_media;
use velox_shell::{ShellEvent, VeloxUserEvent};
use velox_text::{TextLayout, TextSystem};
use velox_layout::NodeId;

include!(concat!(env!("OUT_DIR"), "/embedded_snapshot.rs"));

// ── Config file parsing ───────────────────────────────────────────────────────

/// Splash screen configuration from `velox.config.json`.
#[derive(serde::Deserialize, Default)]
struct SplashCfgJson {
    /// Path to a PNG image displayed centered on the splash background. Optional.
    image:       Option<String>,
    /// Background color as `"#rrggbb"` or `"#rrggbbaa"`. Default: opaque black.
    background:  Option<String>,
    /// Minimum display time in milliseconds. The splash is not hidden before this
    /// elapses even if JS calls `veloxWindow.hideSplash()`. Default: 0 (immediate).
    #[serde(rename = "minimumMs", default)]
    minimum_ms:  u64,
}

#[derive(serde::Deserialize, Default)]
struct VeloxConfigFile {
    window:       Option<WindowCfgJson>,
    capabilities: Option<Capabilities>,
    /// Path to the app icon (PNG, 512×512 or 1024×1024 recommended).
    /// Used for the window icon (all platforms), taskbar (Windows/Linux),
    /// Dock (macOS), and installer icon (velox package --installer).
    icon:         Option<String>,
    /// Splash screen configuration. Optional — omit for no splash.
    splash:       Option<SplashCfgJson>,
}

/// Window settings from `velox.config.json`.
/// All fields are optional — absent fields leave `AppConfig::window` unchanged.
#[derive(serde::Deserialize)]
struct WindowCfgJson {
    title:        Option<String>,
    /// Width in physical pixels. Only used when `startupMode` is `"windowed"`.
    width:        Option<u32>,
    /// Height in physical pixels. Only used when `startupMode` is `"windowed"`.
    height:       Option<u32>,
    /// `"windowed"` (default) | `"maximized"` | `"fullscreen"`.
    /// Omitting `width`/`height` with no `startupMode` also implies `"maximized"`.
    #[serde(rename = "startupMode")]
    startup_mode: Option<String>,
    /// `true` (default) = OS title bar. `false` = frameless custom title bar.
    decorations:  Option<bool>,
}

/// Read the project config as a JSON string.
/// Priority: embedded (snapshot) → velox.config.ts (via bun) → velox.config.json.
fn read_config_json() -> Option<String> {
    if let Some(embedded) = EMBEDDED_CONFIG {
        return Some(embedded.to_string());
    }
    // Try velox.config.ts (dev mode with TypeScript config).
    if std::path::Path::new("velox.config.ts").exists() {
        let result = if cfg!(target_os = "windows") {
            std::process::Command::new("cmd")
                .args(["/C", "bun", "run", "velox.config.ts"])
                .output()
        } else {
            std::process::Command::new("bun")
                .args(["run", "velox.config.ts"])
                .output()
        };
        if let Ok(out) = result {
            if out.status.success() {
                if let Ok(json) = String::from_utf8(out.stdout) {
                    let trimmed = json.trim().to_string();
                    if !trimmed.is_empty() {
                        return Some(trimmed);
                    }
                }
            }
        }
    }
    // Fall back to velox.config.json.
    std::fs::read_to_string("velox.config.json").ok()
}

/// Parse a velox config JSON string, apply window overrides, and return capabilities.
fn apply_config_json(json: &str, cfg: &mut WindowConfig) -> Capabilities {
    let file: Option<VeloxConfigFile> = serde_json::from_str::<VeloxConfigFile>(json)
        .map_err(|e| { log::error!("velox config parse error: {e}"); e })
        .ok();

    if let Some(w) = file.as_ref().and_then(|f| f.window.as_ref()) {
        if let Some(t) = &w.title { cfg.title = t.clone(); }
        if let Some(d) = w.decorations { cfg.decorations = d; }

        cfg.startup_mode = match w.startup_mode.as_deref() {
            Some("fullscreen") => StartupMode::Fullscreen,
            Some("maximized")  => StartupMode::Maximized,
            None if w.width.is_none() && w.height.is_none() => StartupMode::Maximized,
            _ => {
                if let Some(wd) = w.width  { cfg.width  = wd; }
                if let Some(ht) = w.height { cfg.height = ht; }
                StartupMode::Windowed
            }
        };
    }

    // Load icon PNG → RGBA bytes for winit window icon.
    if let Some(icon_path) = file.as_ref().and_then(|f| f.icon.as_ref()) {
        cfg.icon_rgba = load_icon_png(icon_path);
    }

    file.and_then(|f| f.capabilities).unwrap_or_default()
}

/// Decode a PNG at `path` to raw RGBA bytes for use as a winit window icon.
/// Returns `None` and logs a warning on failure.
fn load_icon_png(path: &str) -> Option<(Vec<u8>, u32, u32)> {
    match image::open(path) {
        Ok(img) => {
            let rgba = img.into_rgba8();
            let (w, h) = rgba.dimensions();
            log::info!("[icon] loaded {path} ({w}×{h})");
            Some((rgba.into_raw(), w, h))
        }
        Err(e) => {
            log::warn!("[icon] failed to load '{path}': {e}");
            None
        }
    }
}

/// Return the platform-specific directory for Velox crash dumps.
/// Mirrors `velox_runtime::bindings::crash_reports_dir()`.
fn crash_reports_dir() -> std::path::PathBuf {
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .map(std::path::PathBuf::from)
        .unwrap_or_else(|_| std::env::temp_dir());
    home.join(".velox").join("crashes")
}

/// Install a Rust panic hook that writes a JSON crash dump to `~/.velox/crashes/`.
///
/// This always runs (no capability check needed) since panics are exceptional.
/// In release builds with `panic = "abort"`, the hook may not execute; JS-side
/// crash reporting via `__velox_crash_report_js` covers those scenarios.
fn install_panic_hook() {
    std::panic::set_hook(Box::new(|info| {
        let dir = crash_reports_dir();
        let _ = std::fs::create_dir_all(&dir);
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let message: &str = info.payload()
            .downcast_ref::<&str>()
            .copied()
            .or_else(|| info.payload().downcast_ref::<String>().map(|s| s.as_str()))
            .unwrap_or("unknown panic");
        let file = info.location().map(|l| l.file()).unwrap_or("unknown");
        let line = info.location().map(|l| l.line()).unwrap_or(0);
        let json = format!(
            "{{\"type\":\"rust_panic\",\"timestamp\":{},\"message\":{},\"file\":{},\"line\":{}}}",
            ts,
            serde_json::to_string(message).unwrap_or_else(|_| "\"\"".to_string()),
            serde_json::to_string(file).unwrap_or_else(|_| "\"\"".to_string()),
            line,
        );
        let path = dir.join(format!("rust_{}.json", ts));
        let _ = std::fs::write(&path, json.as_bytes());
        log::error!("[crash] Rust panic: {message} at {file}:{line}");
    }));
}

/// Parse a `"#rrggbb"` or `"#rrggbbaa"` hex color string to RGBA bytes.
/// Returns `None` if the format is invalid.
fn parse_hex_color(s: &str) -> Option<[u8; 4]> {
    let s = s.trim_start_matches('#');
    let parse = |h: &str| u8::from_str_radix(h, 16).ok();
    match s.len() {
        6 => Some([parse(&s[0..2])?, parse(&s[2..4])?, parse(&s[4..6])?, 255]),
        8 => Some([parse(&s[0..2])?, parse(&s[2..4])?, parse(&s[4..6])?, parse(&s[6..8])?]),
        _ => None,
    }
}

/// Build a `SplashState` from the `"splash"` section of `velox.config.json`.
/// Returns `None` if no splash section is present.
fn load_splash_state() -> Option<SplashState> {
    let json = read_config_json()?;
    let file: VeloxConfigFile = serde_json::from_str(&json).ok()?;
    let cfg = file.splash?;
    let now = Instant::now();
    let min_ms = cfg.minimum_ms;
    let min_until    = now + Duration::from_millis(min_ms);
    // Safety auto-hide: at least minimumMs, at most 30 seconds.
    let auto_hide_at = now + Duration::from_millis(min_ms.max(30_000));

    let background = cfg.background.as_deref()
        .and_then(parse_hex_color)
        .unwrap_or([0, 0, 0, 255]);

    let img = cfg.image.as_ref().and_then(|path| {
        match image::open(path) {
            Ok(img) => {
                let rgba = img.into_rgba8();
                let (w, h) = rgba.dimensions();
                Some(peniko::Image::new(rgba.into_raw().into(), peniko::Format::Rgba8, w, h))
            }
            Err(e) => { log::warn!("[splash] failed to load '{path}': {e}"); None }
        }
    });

    Some(SplashState { image: img, background, min_until, auto_hide_at, hidden: false })
}

/// Load the Velox config from the current working directory.
///
/// Applies any `window` overrides to `cfg` and returns the parsed capabilities.
/// Missing file → warning + all capabilities OFF (fail-closed).
fn load_velox_config(cfg: &mut WindowConfig) -> Capabilities {
    let json = match read_config_json() {
        Some(j) => j,
        None => {
            log::warn!(
                "velox-security: no velox.config.ts / velox.config.json found or no capabilities declared \
                 — all capabilities default to OFF"
            );
            return Capabilities::default();
        }
    };

    let caps = apply_config_json(&json, cfg);

    if caps.can_read_fs() || caps.db || caps.network.is_some() {
        log::info!(
            "velox-security: capabilities loaded (fs_read={}, db={}, network_hosts={})",
            caps.can_read_fs(),
            caps.db,
            caps.network.as_ref().map(|n| n.allow.len()).unwrap_or(0),
        );
    } else {
        log::warn!(
            "velox-security: no velox.config.ts / velox.config.json found or no capabilities declared \
             — all capabilities default to OFF"
        );
    }

    caps
}

pub use velox_shell::ShellConfig as WindowConfig;
pub use velox_shell::StartupMode;

/// Read `dev.output` from velox.config.json and return its file contents.
fn read_output_js() -> Option<String> {
    #[derive(serde::Deserialize)]
    struct Cfg { dev: Option<DevSection> }
    #[derive(serde::Deserialize)]
    struct DevSection { output: Option<String> }

    let cfg: Cfg = serde_json::from_str(&read_config_json()?).ok()?;
    let output = cfg.dev?.output?;
    match std::fs::read_to_string(&output) {
        Ok(js) => { log::info!("Loaded JS from {}", output); Some(js) }
        Err(e) => { log::warn!("Could not read JS from {}: {}", output, e); None }
    }
}

/// Build a DevModeConfig from velox.config.json's `dev` section.
fn build_dev_mode_config() -> Option<DevModeConfig> {
    #[derive(serde::Deserialize)]
    struct Cfg { dev: Option<DevSection> }
    #[derive(serde::Deserialize)]
    struct DevSection {
        entry:  Option<String>,
        output: Option<String>,
        watch:  Option<Vec<String>>,
    }

    let src = read_config_json()?;
    let cfg: Cfg = serde_json::from_str(&src).ok()?;
    let dev = cfg.dev?;
    let entry  = dev.entry?;
    let output = dev.output?;
    let watch  = dev.watch.unwrap_or_else(|| vec!["js".into()]);

    Some(DevModeConfig {
        project_root: PathBuf::from("."),
        entry_jsx:    PathBuf::from(&entry),
        output_js:    PathBuf::from(&output),
        watch_paths:  watch.iter().map(PathBuf::from).collect(),
    })
}

fn embedded_snapshot_blob() -> Option<Vec<u8>> {
    EMBEDDED_SNAPSHOT.map(|blob| blob.to_vec())
}

/// Return the app JS embedded at build time via `VELOX_APP_JS` env var, if present.
fn embedded_app_js() -> Option<String> {
    EMBEDDED_APP_JS.map(|s| s.to_string())
}
mod scene;
mod layout;
mod render;

use scene::apply_scene_commands;
use layout::{recompute_layout, update_scroll_positions};
use render::{render_subtree, RenderCtx};

/// Zero-allocation cache key for shaped text.
///
/// The text content is represented by a 64-bit hash rather than a heap-allocated
/// `String`, eliminating one (or two with `.clone()`) String allocations per
/// cache lookup — i.e. per text node per frame.
///
/// Hash collisions are astronomically unlikely for typical UI text and merely
/// produce a cache miss (re-shape), never a correctness bug.
#[derive(Hash, Eq, PartialEq)]
struct LabelKey {
    text_hash:      u64,
    font_size_bits: u32,
    max_width_bits: u32,
    color:          [u8; 4],
}

impl LabelKey {
    fn new(text: &str, font_size: f32, max_width: f32, color: [u8; 4]) -> Self {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        text.hash(&mut h);
        Self {
            text_hash:      h.finish(),
            font_size_bits: font_size.to_bits(),
            max_width_bits: max_width.to_bits(),
            color,
        }
    }
}

// ── Public API ────────────────────────────────────────────────────────────────

/// Top-level configuration passed to [`run`].
pub struct AppConfig {
    /// Window / display settings.
    pub window: WindowConfig,
    /// JavaScript source evaluated at startup.
    ///
    /// Use `include_str!` in your example or application crate to embed a
    /// `.js` file at compile time:
    ///
    /// ```no_run
    /// velox_core::run(velox_core::AppConfig {
    ///     window: velox_core::WindowConfig::default(),
    ///     js_src: Some(include_str!("../js/app.js").to_string()),
    ///     snapshot_blob: None,
    ///     dev_mode: None,
    /// });
    /// ```
    pub js_src: Option<String>,
    /// Pre-executed V8 snapshot blob (from velox-snapshot tool).
    ///
    /// When provided, the isolate is restored from the snapshot (fast startup ~50ms).
    /// Falls back to eval() if not provided or if in dev mode.
    pub snapshot_blob: Option<Vec<u8>>,
    pub dev_mode: Option<DevModeConfig>,
    /// Optional native Rust extensions that register custom __velox_* bindings.
    pub extensions: Vec<Box<dyn VeloxExtension>>,
}

impl AppConfig {
    /// Load configuration from `velox.config.json` in the current directory.
    ///
    /// JS source is read from the path specified in `velox.config.json`'s `dev.output`
    /// field (typically `js/app.js`). This is the zero-boilerplate entry point:
    /// ```no_run
    /// fn main() {
    ///     velox_core::run(velox_core::AppConfig::from_config());
    /// }
    /// ```
    pub fn from_config() -> Self {
        let mut window = WindowConfig::default();
        let caps = load_velox_config(&mut window);
        velox_security::init(caps);
        let snapshot_blob = embedded_snapshot_blob();
        // Prefer build-time embedded app JS (snapshot mode), fall back to reading from disk.
        // The snapshot contains only stubs+polyfills; the app code is always eval'd at runtime.
        let js_src = embedded_app_js().or_else(read_output_js);
        AppConfig {
            window,
            js_src,
            snapshot_blob,
            dev_mode:      build_dev_mode_config(),
            extensions:    vec![],
        }
    }

    /// Create an AppConfig from a binary trailer payload appended to the runner executable.
    ///
    /// Called by velox-runner when it detects embedded payload in its own bytes.
    /// The trailer is written by `velox build --mode snapshot` for JS-only projects
    /// without invoking cargo.
    pub fn from_trailer(snapshot_blob: Vec<u8>, js_src: String, config_json: &str) -> Self {
        let mut window = WindowConfig::default();
        let caps = apply_config_json(config_json, &mut window);
        velox_security::init(caps);
        AppConfig {
            window,
            js_src: Some(js_src),
            snapshot_blob: Some(snapshot_blob),
            dev_mode: None,
            extensions: vec![],
        }
    }
}

#[derive(Clone)]
pub struct DevModeConfig {
    pub project_root: PathBuf,
    pub entry_jsx: PathBuf,
    pub output_js: PathBuf,
    pub watch_paths: Vec<PathBuf>,
}

impl DevModeConfig {
    pub fn new(project_root: PathBuf, entry_jsx: PathBuf, output_js: PathBuf, watch_paths: Vec<PathBuf>) -> Self {
        Self { project_root, entry_jsx, output_js, watch_paths }
    }

    pub fn from_entry(project_root: PathBuf, entry_jsx: PathBuf, output_js: PathBuf) -> Self {
        let mut watch_paths = Vec::new();
        if let Some(parent) = entry_jsx.parent() {
            watch_paths.push(parent.to_path_buf());
        }
        Self { project_root, entry_jsx, output_js, watch_paths }
    }
}

// ── Cached label ──────────────────────────────────────────────────────────────

/// A shaped text label — holds the Parley layout plus pre-computed metrics
/// for centering inside a box without re-querying the layout object.
struct CachedLabel {
    layout: TextLayout,
    /// Pre-computed advance width for horizontal centering.
    width:       f64,
    /// Pre-computed ascent for *visual* vertical centering (single-line).
    ascent:      f64,
    /// Parley's full line-box height including all wrapped lines.
    /// Used to detect whether the layout box was auto-sized to the text —
    /// in which case we top-align rather than center-align vertically.
    text_height: f64,
    /// Offset from the layout-box top (`ty`) to where the cursor rect starts.
    /// Skips the leading above the ascenders so the cursor isn't drawn above
    /// the visible glyphs.
    cursor_top:    f64,
    /// Height of the cursor rect — spans from ascenders to descenders only,
    /// excluding any line leading.
    cursor_height: f64,
}

impl CachedLabel {
    fn new(ts: &mut TextSystem, text: &str, font_size: f32, max_width: f32, color: [u8; 4]) -> Self {
        let vello_color = peniko::Color::rgba8(color[0], color[1], color[2], color[3]);
        let layout      = ts.label_centered(text, font_size, max_width, vello_color);
        let width       = layout.width() as f64;
        let text_height = layout.height() as f64;
        // For an empty string Parley produces no glyph runs, so ascent() = 0.
        // Shape a reference "M" at the same size to get the real font ascent.
        let ref_layout = if layout.ascent() > 0.1 {
            None
        } else {
            Some(ts.label_centered("M", font_size, max_width, vello_color))
        };
        let src    = ref_layout.as_ref().unwrap_or(&layout);
        let ascent = src.ascent() as f64;
        let (cursor_top_raw, cursor_height_raw) = src.cursor_metrics();
        Self {
            layout,
            width,
            ascent,
            text_height,
            cursor_top:    cursor_top_raw    as f64,
            cursor_height: cursor_height_raw as f64,
        }
    }
}

// ── Application state ─────────────────────────────────────────────────────────

/// Splash screen overlay state. Active from window open until dismissed.
struct SplashState {
    /// Optional decoded splash image (centered on background).
    image:      Option<peniko::Image>,
    /// RGBA background fill color shown behind the image and during image load.
    background: [u8; 4],
    /// Splash is shown until this instant regardless of `hidden` (minimum display time).
    min_until:  Instant,
    /// Safety auto-hide: splash is removed no later than this instant.
    auto_hide_at: Instant,
    /// `true` after JS calls `veloxWindow.hideSplash()`.
    hidden:     bool,
}

impl SplashState {
    fn is_visible(&self) -> bool {
        let now = Instant::now();
        // Still within minimum display time → always show.
        if now < self.min_until { return true; }
        // Safety timeout → always hide.
        if now >= self.auto_hide_at { return false; }
        // After minimum but before safety timeout → show only if not explicitly hidden.
        !self.hidden
    }
}

/// Live camera capture stream. Owned by `PerWindowState`.
/// The capture thread writes RGBA frames into `frame_buf`;
/// the main render loop reads them and creates a `peniko::Image`.
struct CameraStream {
    /// Latest RGBA frame: (width, height, raw_bytes). `take()`d each frame by the render loop.
    frame_buf:      Arc<Mutex<Option<(u32, u32, Vec<u8>)>>>,
    /// Last raw frame ever written — never drained. Used by CaptureCamera so a
    /// photo can always be taken even after the render loop has already consumed frame_buf.
    last_raw_frame: Arc<Mutex<Option<(u32, u32, Vec<u8>)>>>,
    /// Set to `true` to signal the capture thread to exit.
    stop_flag:    Arc<std::sync::atomic::AtomicBool>,
    /// Latest peniko::Image built from the most recent frame.
    latest_image: Option<peniko::Image>,
    // ── Recording ─────────────────────────────────────────────────────────────
    /// When recording is active, the capture thread clones each RGBA frame and
    /// sends it here. Dropping the sender signals the recording thread to stop.
    record_frame_tx: Arc<Mutex<Option<std::sync::mpsc::SyncSender<(u32, u32, Vec<u8>)>>>>,
    /// Receives `Ok(output_path)` / `Err(msg)` from the recording thread after
    /// it finishes flushing the MP4. Consumed by `StopCameraRecord`.
    record_done_rx: Option<std::sync::mpsc::Receiver<Result<String, String>>>,
}

/// Live video playback stream. Owned by `PerWindowState`.
/// The decode thread reads frames from the velox-media DLL and writes RGBA frames
/// into `frame_buf`; the main render loop consumes them and builds a `peniko::Image`.
struct VideoStream {
    /// Latest decoded RGBA frame: (width, height, raw_bytes). `take()`d by the render loop.
    frame_buf:    Arc<Mutex<Option<(u32, u32, Vec<u8>)>>>,
    /// Signal the decode thread to stop (also stops the audio thread).
    stop_flag:    Arc<std::sync::atomic::AtomicBool>,
    /// Send seek-to-seconds requests to the decode thread.
    seek_tx:      std::sync::mpsc::SyncSender<f64>,
    /// Pending events (ended, metadata). Drained into velox-runtime's video_events each frame.
    events:       Arc<Mutex<std::collections::VecDeque<String>>>,
    /// Most recent peniko::Image built from the decoded frame. Used by render.rs.
    latest_image: Option<peniko::Image>,
    // Audio is played by a self-contained background thread that owns the
    // OutputStream + Sink — no audio fields needed here.
}

/// Per-window rendering + runtime state.
/// One instance per open window; keyed by `window_handle` (0 = main window).
struct PerWindowState {
    gpu:          GpuContext,
    renderer:     VeloxRenderer,
    text_sys:     TextSystem,
    layout:       LayoutTree,
    runtime:      VeloxRuntime,
    layout_dirty: bool,
    /// When true, the scene graph structure changed (nodes added/removed/reparented).
    /// `recompute_layout` must do a full Taffy tree rebuild before computing.
    /// When false but `layout_dirty` is true, only style props changed — Taffy's
    /// incremental path (mark_dirty + compute) is used, skipping clean subtrees.
    layout_structure_dirty: bool,
    resolved:     Vec<(NodeId, ResolvedLayout)>,
    js_nodes:     std::collections::HashMap<u32, JsNode>,
    js_root:      Option<u32>,
    images:       std::collections::HashMap<u32, peniko::Image>,
    /// Path-keyed image cache — decoded images reused across remounts without re-decoding.
    /// Capped at 64 entries (LRU eviction) so long sessions don't accumulate stale decoded bitmaps.
    images_by_path: lru::LruCache<String, peniko::Image>,
    image_cache_hits: u64,
    image_cache_misses: u64,
    /// Shaped text cache — keyed by (text, font_size_bits, max_width_bits, color).
    /// Capped at 256 entries (LRU eviction) to prevent unbounded growth during long sessions.
    label_cache: lru::LruCache<LabelKey, CachedLabel>,
    /// Current cursor position in physical pixels.
    cursor_x:     f32,
    cursor_y:     f32,
    /// Drag tracking: set when left button is held down and cursor has moved.
    drag_active:  bool,
    drag_start_x: f32,
    drag_start_y: f32,
    /// Callback to request another frame — used for cursor blinking.
    /// Wrapped in Arc so it can be cloned into the blink timer thread.
    request_redraw: Arc<dyn Fn() + Send + Sync>,
    /// Whether the cursor rect is visible in the current blink phase.
    cursor_blink_on:       bool,
    /// When to flip the blink phase next.
    cursor_blink_deadline: Instant,
    /// Rolling performance metrics — shared with the JS binding via Arc.
    perf: Arc<Mutex<velox_perf::PerfState>>,
    /// Process RSS bytes — written by a background tokio task every 2 s.
    /// Reading is always lock-free (Relaxed load) so it never stalls the frame loop.
    rss_bytes: Arc<std::sync::atomic::AtomicU64>,
    /// Draw commands for Canvas nodes, keyed by node ID.
    /// Updated each frame when JS calls `__velox_canvas_update`.
    canvas_cmds: std::collections::HashMap<u32, Vec<CanvasCmd>>,
    /// Scene descriptions for Canvas3D nodes, keyed by node ID.
    canvas3d_scenes: std::collections::HashMap<u32, velox_3d::Scene3D>,
    /// 3D renderer — lazy-initialised on first Canvas3D encounter.
    renderer_3d: Option<velox_3d::Renderer3D>,
    /// Live camera streams keyed by velox handle ID.
    camera_streams: std::collections::HashMap<u32, CameraStream>,
    /// Video playback streams keyed by velox handle ID.
    video_streams: std::collections::HashMap<u32, VideoStream>,
    /// Splash screen overlay. `None` if no splash was configured.
    splash_state: Option<SplashState>,
    /// Whether the window is frameless (decorations=false). When true, velox
    /// handles window drag via `veloxDraggable` nodes.
    decorations: bool,
    /// Closure that initiates an OS-level window drag. Populated only when
    /// `decorations=false`; calling it is equivalent to the user grabbing the
    /// title bar.
    drag_window_fn: Option<Arc<dyn Fn() + Send + Sync>>,
    #[cfg(feature = "dev")]
    dev_mode: Option<DevModeState>,
}

struct JsNode {
    node_type: NodeType,
    props:     NodeProps,
    /// Inline storage for up to 4 children — covers the vast majority of nodes
    /// without a heap allocation.  Spills to the heap only for containers with
    /// 5+ children (e.g. long lists rendered inside a loop).
    children:  SmallVec<[u32; 4]>,
    layout_id: Option<NodeId>,
}

#[cfg(feature = "dev")]
enum DevBuildEvent {
    BuildOk(String),
    BuildErr(String),
}

#[cfg(feature = "dev")]
struct DevModeState {
    rx: Receiver<DevBuildEvent>,
    overlay_visible: bool,
    last_reload: Option<Instant>,
    last_build_message: String,
    ctrl_down: bool,
    shift_down: bool,
    /// Cached text lines for the overlay — refreshed at most 4× per second
    /// so the numbers are readable instead of flickering at 120 fps.
    overlay_lines:        Vec<String>,
    overlay_next_refresh: Instant,
    /// Last JS exception from frame_tick — shown as an error overlay.
    /// Cleared on the next successful reload.
    last_js_error: Option<String>,
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

fn rgba_to_vello(c: [u8; 4]) -> peniko::Color {
    peniko::Color::rgba8(c[0], c[1], c[2], c[3])
}

#[cfg(feature = "dev")]
fn dev_mode_config_from_env() -> Option<DevModeConfig> {
    let root = std::env::var("VELOX_DEV_ROOT").ok()
        .map(PathBuf::from)
        .or_else(|| std::env::current_dir().ok())?;
    let entry_jsx = std::env::var("VELOX_DEV_ENTRY").ok().map(PathBuf::from)?;
    let output_js = std::env::var("VELOX_DEV_OUTPUT").ok().map(PathBuf::from)?;
    let watch_paths = std::env::var("VELOX_DEV_WATCH")
        .ok()
        .map(|v| v.split(';').filter(|s| !s.trim().is_empty()).map(PathBuf::from).collect::<Vec<_>>())
        .unwrap_or_default();
    if watch_paths.is_empty() {
        Some(DevModeConfig::from_entry(root, entry_jsx, output_js))
    } else {
        Some(DevModeConfig::new(root, entry_jsx, output_js, watch_paths))
    }
}

#[cfg(feature = "dev")]
fn start_dev_mode_worker(
    redraw: Arc<dyn Fn() + Send + Sync>,
    config: Option<DevModeConfig>,
) -> Option<Receiver<DevBuildEvent>> {
    let config = config.or_else(dev_mode_config_from_env)?;
    let cwd = if config.project_root.is_absolute() {
        config.project_root.clone()
    } else {
        std::env::current_dir().ok()?.join(config.project_root)
    };
    let app_jsx = if config.entry_jsx.is_absolute() {
        config.entry_jsx.clone()
    } else {
        cwd.join(config.entry_jsx)
    };
    let app_js = if config.output_js.is_absolute() {
        config.output_js.clone()
    } else {
        cwd.join(config.output_js)
    };
    if !app_jsx.exists() || app_js.as_os_str().is_empty() {
        return None;
    }

    let (out_tx, out_rx) = mpsc::channel::<DevBuildEvent>();
    std::thread::spawn(move || {
        let (watch_tx, watch_rx) = mpsc::channel::<()>();
        let out_tx_watch = out_tx.clone();
        // The output JS path — we skip events for this file to avoid a circular
        // rebuild loop (bun writes app.js → watcher fires → bun runs again → ...).
        let app_js_for_filter = app_js.clone();
        let mut watcher = match notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            match res {
                Ok(event) => {
                    // Skip events caused by the output file being written by bun itself.
                    // Only source file changes (.jsx/.tsx/.ts/.js source, not the bundle)
                    // should trigger a rebuild.
                    let is_output_file = event.paths.iter().any(|p| p == &app_js_for_filter);
                    if is_output_file {
                        return;
                    }
                    log::debug!("[HMR] file changed: {:?}", event.paths);
                    let _ = watch_tx.send(());
                }
                Err(e) => {
                    let _ = out_tx_watch.send(DevBuildEvent::BuildErr(e.to_string()));
                }
            }
        }) {
            Ok(w) => w,
            Err(e) => {
                let _ = out_tx.send(DevBuildEvent::BuildErr(e.to_string()));
                return;
            }
        };

        let watch_paths = if config.watch_paths.is_empty() {
            app_jsx.parent().map(|p| vec![p.to_path_buf()]).unwrap_or_default()
        } else {
            config.watch_paths.clone()
        };
        for p in &watch_paths {
            let wp = if p.is_absolute() { p.clone() } else { cwd.join(p) };
            if wp.exists() {
                log::info!("[HMR] watching {:?}", wp);
                let _ = watcher.watch(&wp, RecursiveMode::Recursive);
            } else {
                log::warn!("[HMR] watch path does not exist: {:?}", wp);
            }
        }
        log::info!("[HMR] ready — edit {:?} to hot-reload", app_jsx);

        while watch_rx.recv().is_ok() {
            while watch_rx.recv_timeout(Duration::from_millis(180)).is_ok() {}
            log::info!("[HMR] change detected — rebuilding… (cwd={:?})", cwd);

            // On Windows bun may only be resolvable through the shell (e.g.
            // installed via scoop/winget which adds a .cmd shim).  Try the
            // direct exe first; fall back to a cmd /C wrapper on failure.
            let run_bun = |cwd: &std::path::Path| -> std::io::Result<std::process::Output> {
                let bun_args = [
                    "build",
                    app_jsx.to_str().unwrap_or(""),
                    "--outfile",
                    app_js.to_str().unwrap_or(""),
                    "--target", "browser",
                    "--format",  "iife",
                    "--define",  "process.env.NODE_ENV='production'",
                ];
                #[cfg(target_os = "windows")]
                {
                    // First attempt: bun.exe directly.
                    match Command::new("bun").args(&bun_args).current_dir(cwd).output() {
                        Ok(o) => return Ok(o),
                        Err(_) => {
                            // Second attempt: through cmd /C so .cmd shims are resolved.
                            let mut cmd_args = vec!["/C", "bun"];
                            cmd_args.extend_from_slice(&bun_args);
                            return Command::new("cmd").args(&cmd_args).current_dir(cwd).output();
                        }
                    }
                }
                #[cfg(not(target_os = "windows"))]
                Command::new("bun").args(&bun_args).current_dir(cwd).output()
            };

            match run_bun(&cwd) {
                Ok(out) if out.status.success() => {
                    match std::fs::read_to_string(&app_js) {
                        Ok(js) => {
                            log::info!("[HMR] build ok — reloading app");
                            let _ = out_tx.send(DevBuildEvent::BuildOk(js));
                        }
                        Err(e) => {
                            log::warn!("[HMR] build succeeded but could not read output: {e}");
                            let _ = out_tx.send(DevBuildEvent::BuildErr(e.to_string()));
                        }
                    }
                }
                Ok(out) => {
                    let mut msg = String::new();
                    if !out.stderr.is_empty() {
                        msg.push_str(&String::from_utf8_lossy(&out.stderr));
                    }
                    if !out.stdout.is_empty() {
                        if !msg.is_empty() {
                            msg.push('\n');
                        }
                        msg.push_str(&String::from_utf8_lossy(&out.stdout));
                    }
                    if msg.is_empty() {
                        msg = format!("bun build failed (exit {:?})", out.status.code());
                    }
                    log::warn!("[HMR] build error: {msg}");
                    let _ = out_tx.send(DevBuildEvent::BuildErr(msg));
                }
                Err(e) => {
                    log::warn!("[HMR] failed to run bun: {e}  (is bun installed and in PATH?)");
                    let _ = out_tx.send(DevBuildEvent::BuildErr(e.to_string()));
                }
            }
            redraw();
        }
    });

    Some(out_rx)
}

#[cfg(feature = "dev")]
fn handle_dev_build_events(state: &mut PerWindowState) {
    if state.dev_mode.is_none() { return; }
    loop {
        // Borrow dev_mode only long enough to try_recv — released before apply_scene_commands.
        let event = state.dev_mode.as_mut().unwrap().rx.try_recv();
        match event {
            Ok(DevBuildEvent::BuildOk(js)) => {
                state.js_nodes.clear();
                state.js_root = None;
                state.images.clear();
                state.images_by_path.clear();
                state.image_cache_hits = 0;
                state.image_cache_misses = 0;
                state.label_cache.clear();
                state.resolved.clear();
                state.layout = LayoutTree::new();
                state.runtime.layout_cache.lock().unwrap().clear();
                state.canvas_cmds.clear();
                state.canvas3d_scenes.clear();
                // Discard any stale commands that accumulated before the reload.
                let _ = state.runtime.drain_scene_commands();
                match state.runtime.eval(&js) {
                    Ok(_) => {
                        // Flush V8 microtasks so any React work deferred via
                        // Promise/queueMicrotask during eval() is committed now.
                        state.runtime.flush_microtasks();
                        // Apply the new scene commands immediately rather than
                        // waiting for the frame loop's pre_commands drain — this
                        // guarantees js_root and js_nodes are populated before
                        // recompute_layout runs later in the same frame.
                        let reload_cmds = state.runtime.drain_scene_commands();
                        log::info!("[HMR] eval ok — {} scene commands", reload_cmds.len());
                        apply_scene_commands(state, reload_cmds);
                        state.layout_dirty = true;
                        if let Some(dev) = state.dev_mode.as_mut() {
                            dev.last_reload = Some(Instant::now());
                            dev.last_build_message = "reload ok".to_string();
                            dev.last_js_error = None;
                        }
                    }
                    Err(e) => {
                        log::warn!("[HMR] eval error: {e}");
                        if let Some(dev) = state.dev_mode.as_mut() {
                            dev.last_build_message = format!("reload error: {}", e);
                            dev.last_js_error = Some(format!("Eval error: {}", e));
                        }
                    }
                }
            }
            Ok(DevBuildEvent::BuildErr(msg)) => {
                if let Some(dev) = state.dev_mode.as_mut() {
                    dev.last_build_message = format!("build error: {}", msg);
                }
            }
            Err(TryRecvError::Empty) | Err(TryRecvError::Disconnected) => break,
        }
    }
}

#[cfg(feature = "dev")]
fn draw_dev_overlay(state: &mut PerWindowState, frame: &mut FrameBuilder) {
    let Some(dev) = state.dev_mode.as_mut() else { return };
    if !dev.overlay_visible { return; }

    let now = Instant::now();

    // Refresh the displayed text at most 4× per second so numbers are readable.
    if now >= dev.overlay_next_refresh || dev.overlay_lines.is_empty() {
        let perf_g = state.perf.lock().unwrap();
        let fps    = perf_g.fps();
        let avg_ms = perf_g.avg_frame_time();
        let p99_ms = perf_g.p99_frame_time();
        let js_ms  = perf_g.avg_js_time();
        let lay_ms = perf_g.avg_layout_time();
        let gpu_ms = perf_g.avg_gpu_time();
        let last_f = perf_g.last_frame();
        let last_ms = last_f.frame_time_ms;
        let heap_used_mb = last_f.heap_used_bytes / (1024 * 1024);
        let rss_mb = last_f.process_rss_bytes / (1024 * 1024);
        let budget = perf_g.budget_ms;
        drop(perf_g);
        let since = dev.last_reload
            .map(|t| now.saturating_duration_since(t).as_secs())
            .unwrap_or(0);
        dev.overlay_lines = vec![
            format!("Dev overlay (Ctrl+Shift+D)  budget {:.1}ms", budget),
            format!("FPS {:.0}  last {:.1}ms  avg {:.1}ms  P99 {:.1}ms", fps, last_ms, avg_ms, p99_ms),
            format!("JS {:.2}ms  layout {:.2}ms  GPU {:.2}ms  nodes {}  heap {}MB  RSS {}MB",
                js_ms, lay_ms, gpu_ms, state.js_nodes.len(), heap_used_mb, rss_mb),
            format!("{}  (reload {}s ago)", dev.last_build_message, since),
        ];
        dev.overlay_next_refresh = now + Duration::from_millis(250);
    }

    // Sparkline is always re-read (it's visual, not text to read).
    let sparkline_data: Vec<velox_perf::PerfFrame> = {
        let perf_g = state.perf.lock().unwrap();
        let budget = perf_g.budget_ms;
        let data: Vec<_> = perf_g.ring.iter().copied().collect();
        drop(perf_g);
        let _ = budget; // used below via the cached line
        data
    };
    let budget = {
        let perf_g = state.perf.lock().unwrap();
        perf_g.budget_ms
    };

    // ── Overlay background ────────────────────────────────────────────────
    let overlay_w = 490.0_f64;
    let overlay_h = 130.0_f64;
    frame.fill_rounded_rect(16.0, 16.0, overlay_w, overlay_h, 8.0, peniko::Color::rgba8(15, 15, 25, 225));

    // ── Text rows ─────────────────────────────────────────────────────────
    let txt_color = peniko::Color::rgba8(220, 220, 235, 255);
    let lines = &dev.overlay_lines;
    for (i, line) in lines.iter().enumerate() {
        let text = state.text_sys.label(line, 12.0, txt_color);
        frame.draw_text(&text, 26.0, 34.0 + (i as f64 * 20.0), txt_color);
    }

    // ── Sparkline — last 60 frame times ──────────────────────────────────
    // 2 px per bar × 60 bars = 120 px wide; 20 px tall; bottom at y=122
    let spark_x  = 26.0_f64;
    let spark_y  = 112.0_f64;  // top of sparkline
    let bar_w    = 2.0_f64;
    let spark_h  = 18.0_f64;
    let samples: Vec<f64> = sparkline_data.iter()
        .rev().take(60).map(|f| f.frame_time_ms).collect::<Vec<_>>()
        .into_iter().rev().collect();
    for (i, &ms) in samples.iter().enumerate() {
        let h   = (ms / (budget * 2.0)).min(1.0) * spark_h;
        let x   = spark_x + i as f64 * bar_w;
        let y   = spark_y + (spark_h - h);
        let col = if ms > budget * 2.0 {
            peniko::Color::rgba8(255, 80, 80, 220)
        } else if ms > budget {
            peniko::Color::rgba8(255, 180, 50, 220)
        } else {
            peniko::Color::rgba8(80, 200, 120, 200)
        };
        frame.fill_rect(x, y, bar_w - 0.5, h, col);
    }
}

/// Draw the JS error overlay — a red banner at the bottom of the window.
/// Shown whenever a JS exception was thrown during `frame_tick()`.
/// Always drawn in dev mode regardless of whether the perf overlay is toggled.
#[cfg(feature = "dev")]
fn draw_error_overlay(state: &mut PerWindowState, frame: &mut FrameBuilder) {
    let Some(dev) = state.dev_mode.as_ref() else { return };
    let Some(ref err) = dev.last_js_error.clone() else { return };

    let win_w = state.gpu.width()  as f64;
    let win_h = state.gpu.height() as f64;

    // Background panel — 130px tall, full width, anchored to bottom.
    let panel_h = 140.0_f64;
    let panel_y = win_h - panel_h;
    frame.fill_rounded_rect(0.0, panel_y, win_w, panel_h, 0.0,
        peniko::Color::rgba8(40, 5, 5, 245));

    // Red top border line.
    frame.fill_rect(0.0, panel_y, win_w, 2.0,
        peniko::Color::rgba8(220, 50, 50, 255));

    let title_color = peniko::Color::rgba8(255, 100, 100, 255);
    let body_color  = peniko::Color::rgba8(240, 200, 200, 255);
    let dim_color   = peniko::Color::rgba8(160, 120, 120, 200);

    // Title row.
    let title = state.text_sys.label("⚠  JavaScript Error  (fix and save to dismiss)", 12.0, title_color);
    frame.draw_text(&title, 16.0, panel_y + 12.0, title_color);

    // Error lines — up to 4 lines, truncated at 120 chars each.
    let max_line_chars = (win_w as usize).saturating_sub(40) / 7; // ~7px per char at 12pt
    let lines: Vec<&str> = err.lines().take(4).collect();
    for (i, line) in lines.iter().enumerate() {
        let truncated = if line.len() > max_line_chars {
            format!("{}…", &line[..max_line_chars.min(line.len())])
        } else {
            line.to_string()
        };
        let text = state.text_sys.label(&truncated, 11.0, body_color);
        frame.draw_text(&text, 16.0, panel_y + 34.0 + (i as f64 * 18.0), body_color);
    }
    if err.lines().count() > 4 {
        let more = state.text_sys.label("… (more lines in console)", 10.0, dim_color);
        frame.draw_text(&more, 16.0, panel_y + 34.0 + (4.0 * 18.0), dim_color);
    }

    // Footer hint.
    let hint = state.text_sys.label("Save any source file to rebuild and dismiss", 10.0, dim_color);
    frame.draw_text(&hint, 16.0, panel_y + panel_h - 16.0, dim_color);
}

// ── Window controller builder ─────────────────────────────────────────────────

fn build_window_controller(
    window: Arc<winit::window::Window>,
    create_window_fn: Option<Arc<dyn Fn(u32, String, u32, u32) + Send + Sync>>,
    quit_fn:    Option<Arc<dyn Fn() + Send + Sync>>,
    restart_fn: Option<Arc<dyn Fn() + Send + Sync>>,
) -> WindowController {
    use winit::window::Fullscreen;

    // Extract the raw platform HWND (Windows) so dialogs can be parented to
    // the Velox window and appear in front of it rather than behind it.
    let hwnd: Option<isize> = {
        #[cfg(target_os = "windows")]
        {
            use winit::raw_window_handle::{HasWindowHandle, RawWindowHandle};
            window.window_handle().ok().and_then(|h| {
                match h.as_raw() {
                    RawWindowHandle::Win32(w) => Some(w.hwnd.get()),
                    _ => None,
                }
            })
        }
        #[cfg(not(target_os = "windows"))]
        { None }
    };

    let w1 = Arc::clone(&window);
    let w2 = Arc::clone(&window);
    let w3 = Arc::clone(&window);
    let w4 = Arc::clone(&window);
    let w5 = Arc::clone(&window);
    let w6 = Arc::clone(&window);
    let w7 = Arc::clone(&window);
    let w8 = Arc::clone(&window);
    let w9 = Arc::clone(&window);
    let w10 = Arc::clone(&window);

    WindowController {
        get_window_size: Arc::new(move || {
            let s = w1.inner_size();
            (s.width, s.height)
        }),
        get_screen_size: Arc::new(move || {
            let monitor = w2.current_monitor()?;
            let s = monitor.size();
            Some((s.width, s.height))
        }),
        request_redraw: Arc::new(move || {
            w10.request_redraw();
        }),
        set_fullscreen: Arc::new(move |full| {
            if full {
                w3.set_fullscreen(Some(Fullscreen::Borderless(None)));
            } else {
                w3.set_fullscreen(None);
            }
        }),
        set_maximized: Arc::new(move |maximized| {
            w4.set_maximized(maximized);
        }),
        set_minimized: Arc::new(move || {
            w5.set_minimized(true);
        }),
        is_fullscreen: Arc::new(move || {
            w6.fullscreen().is_some()
        }),
        is_maximized: Arc::new(move || {
            w7.is_maximized()
        }),
        set_always_on_top: Arc::new(move |on| {
            use winit::window::WindowLevel;
            w8.set_window_level(if on { WindowLevel::AlwaysOnTop } else { WindowLevel::Normal });
        }),
        set_title: Arc::new(move |title| {
            w9.set_title(&title);
        }),
        hwnd,
        create_window: create_window_fn,
        quit:    quit_fn,
        restart: restart_fn,
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

pub fn run(mut config: AppConfig) -> bool {
    // Install Rust panic hook early so panics during init are also captured.
    install_panic_hook();

    // Set module-specific log levels first so they take precedence over any
    // global level set by RUST_LOG (e.g. RUST_LOG=info would otherwise
    // re-enable the very noisy wgpu_core submission-index spam).
    let mut log_builder = env_logger::Builder::new();
    log_builder
        .filter_module("wgpu_core", log::LevelFilter::Warn)
        .filter_module("wgpu_hal",  log::LevelFilter::Warn)
        .filter_module("naga",      log::LevelFilter::Warn)
        .filter_level(log::LevelFilter::Info);
    // RUST_LOG can still add more specific directives (e.g. velox_core=debug)
    // but cannot remove the per-module suppression above.
    if let Ok(rust_log) = std::env::var("RUST_LOG") {
        log_builder.parse_filters(&rust_log);
    }
    log_builder.init();

    // Load .env from the working directory (or any parent) if one exists.
    match dotenvy::dotenv() {
        Ok(path) => log::info!("velox: loaded env from {}", path.display()),
        Err(dotenvy::Error::Io(_)) => {}
        Err(e) => log::warn!("velox: .env parse error: {e}"),
    }

    let caps = load_velox_config(&mut config.window);
    velox_security::init(caps);

    // ── Deep link: check launch args for a URL matching the configured scheme ──
    //
    // If the app registered `"deeplink": { "scheme": "notes" }` and was launched
    // with `notes://note/42` as an argument, we capture it in `VELOX_LAUNCH_URL`
    // so the `__velox_deeplink_getInitialUrl()` binding can retrieve it.
    //
    // Single-instance mode (opt-in):
    //   First instance  — binds a TCP socket on localhost, writes port to a temp
    //                     file so second instances know where to forward URLs.
    //   Second instance — connects to that socket, sends the URL, exits.
    //
    // The TCP listener is started after the runtime is ready (inside WindowReady)
    // using the Tokio handle and the runtime's `deeplink_url_queue`.
    let mut single_instance_tcp: Option<std::net::TcpListener> = {
        if let Some(ref dl) = velox_security::get().deeplink {
            let scheme_prefix = format!("{}://", dl.scheme);
            let launch_url: Option<String> = std::env::args()
                .skip(1)
                .find(|a| a.starts_with(&scheme_prefix));

            if let Some(ref url) = launch_url {
                // Safety: this is the only write; bindings read it after runtime starts.
                #[allow(unused_unsafe)]
                unsafe { std::env::set_var("VELOX_LAUNCH_URL", url); }
                log::info!("velox: deep-link launch URL: {}", url);
            }

            if dl.single_instance {
                let app_name = std::env::current_exe()
                    .ok()
                    .and_then(|p| p.file_stem().map(|s| s.to_string_lossy().into_owned()))
                    .unwrap_or_else(|| "velox-app".to_string());
                let port_file = std::env::temp_dir().join(format!("velox-{}.port", app_name));

                // Try to connect as a second instance.
                let is_second = port_file.exists() && {
                    let connected = std::fs::read_to_string(&port_file)
                        .ok()
                        .and_then(|s| s.trim().parse::<u16>().ok())
                        .and_then(|port| {
                            use std::io::Write;
                            std::net::TcpStream::connect(("127.0.0.1", port))
                                .ok()
                                .and_then(|mut s| {
                                    let payload = launch_url.as_deref().unwrap_or("").to_string() + "\n";
                                    s.write_all(payload.as_bytes()).ok()
                                })
                        })
                        .is_some();
                    connected
                };

                if is_second {
                    log::info!("velox: second instance detected — forwarded URL and exiting");
                    std::process::exit(0);
                }

                // First instance: bind TCP listener.
                match std::net::TcpListener::bind("127.0.0.1:0") {
                    Ok(listener) => {
                        listener.set_nonblocking(true).ok();
                        let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
                        std::fs::write(&port_file, port.to_string()).ok();
                        log::info!("velox: single-instance listener on port {}", port);
                        Some(listener)
                    }
                    Err(e) => {
                        log::warn!("velox: could not bind single-instance socket: {}", e);
                        None
                    }
                }
            } else {
                None
            }
        } else {
            None
        }
    };

    // VELOX_PERF_CHECK=<duration_secs>:<budget_ms> — set by `velox build --check-performance`.
    // After the given duration the app prints a JSON perf summary and exits.
    let perf_check: Option<(u64, f64)> = std::env::var("VELOX_PERF_CHECK").ok().and_then(|v| {
        let mut parts = v.splitn(2, ':');
        let dur  = parts.next()?.parse::<u64>().ok()?;
        let bud  = parts.next()?.parse::<f64>().ok()?;
        Some((dur, bud))
    });

    let tokio_rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(1)
        .enable_all()
        .build()
        .expect("Failed to build Tokio runtime");
    let tokio_handle = tokio_rt.handle().clone();

    init_v8();

    let AppConfig { window, js_src, snapshot_blob, dev_mode: _dev_mode, extensions } = config;
    // Capture before `window` is moved into velox_shell::run().
    let window_decorations = window.decorations;

    // Load splash state from config (None = no splash configured).
    // Wrapped in Option so it can be moved into the main window's PerWindowState exactly once.
    let mut main_splash_state: Option<SplashState> = load_splash_state();

    // Shared across all windows.
    let ipc_bus        = new_ipc_bus();
    let next_window_id = Arc::new(std::sync::atomic::AtomicU32::new(1));

    // Wrap in Arc so secondary-window creation can reuse them.
    let js_src_arc        = Arc::new(js_src);
    let snapshot_blob_arc = Arc::new(snapshot_blob);
    let extensions_arc    = Arc::new(extensions);

    // Per-window state: handle → PerWindowState.
    let mut windows: std::collections::HashMap<u32, PerWindowState> =
        std::collections::HashMap::new();

    let restart = velox_shell::run(window, move |event| {
        match event {
            // ── Window ready — initialise per-window subsystems ──────────
            ShellEvent::WindowReady { window_handle, window, proxy: ev_proxy } => {
                let gpu_ctx = pollster::block_on(GpuContext::new(window.clone()))
                    .expect("Failed to initialise GPU");
                let renderer = VeloxRenderer::new(&gpu_ctx)
                    .expect("Failed to initialise Vello renderer");

                // Build callbacks that send events to the shell event loop.
                let proxy_for_fn = ev_proxy.clone();
                let create_fn: Arc<dyn Fn(u32, String, u32, u32) + Send + Sync> =
                    Arc::new(move |id, title, width, height| {
                        let _ = proxy_for_fn.send_event(
                            VeloxUserEvent::CreateWindow { id, title, width, height }
                        );
                    });

                let proxy_quit = ev_proxy.clone();
                let quit_fn: Arc<dyn Fn() + Send + Sync> =
                    Arc::new(move || { let _ = proxy_quit.send_event(VeloxUserEvent::Quit); });

                let proxy_restart = ev_proxy.clone();
                let restart_fn: Arc<dyn Fn() + Send + Sync> =
                    Arc::new(move || { let _ = proxy_restart.send_event(VeloxUserEvent::Restart); });

                let window_ctrl = build_window_controller(
                    Arc::clone(&window),
                    Some(Arc::clone(&create_fn)),
                    Some(Arc::clone(&quit_fn)),
                    Some(Arc::clone(&restart_fn)),
                );

                let ipc_clone  = Arc::clone(&ipc_bus);
                let nwid       = Arc::clone(&next_window_id);
                // Create the shared perf Arc BEFORE the runtime so both
                // PerWindowState (writer) and AsyncState binding (reader) share it.
                let shared_perf: Arc<Mutex<velox_perf::PerfState>> =
                    Arc::new(Mutex::new(velox_perf::PerfState::new()));

                // VELOX_PERF_CHECK: apply budget, then spawn a timer that exits after duration.
                if let Some((duration_secs, budget_ms)) = perf_check {
                    shared_perf.lock().unwrap().budget_ms = budget_ms;
                    let perf_arc  = Arc::clone(&shared_perf);
                    let proxy_pc  = ev_proxy.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_secs(duration_secs));
                        // Print perf summary to stdout for CLI to capture.
                        let p = perf_arc.lock().unwrap();
                        let violations = p.violations.len();
                        let avg_ms = p.avg_frame_time();
                        let p99_ms = p.p99_frame_time();
                        let fps    = p.fps();
                        drop(p);
                        let pass = violations == 0;
                        println!("VELOX_PERF_RESULT:{{\"violations\":{violations},\"avgFrameMs\":{avg_ms:.2},\"p99FrameMs\":{p99_ms:.2},\"fps\":{fps:.1},\"pass\":{pass}}}");
                        let _ = proxy_pc.send_event(VeloxUserEvent::Quit);
                    });
                }

                let mut rt = if let Some(ref blob) = *snapshot_blob_arc {
                    match VeloxRuntime::new_from_snapshot_with_ipc(
                        blob, tokio_handle.clone(), Some(window_ctrl),
                        Arc::clone(&ipc_clone), window_handle, Arc::clone(&nwid),
                        Arc::clone(&shared_perf),
                    ) {
                        Ok(rt) => {
                            log::info!("Window {}: restored from snapshot", window_handle);
                            rt
                        }
                        Err(e) => {
                            log::warn!("Window {}: snapshot restore failed ({}); eval mode", window_handle, e);
                            let proxy_fb  = ev_proxy.clone();
                            let proxy_qfb = ev_proxy.clone();
                            let proxy_rfb = ev_proxy.clone();
                            let wc = build_window_controller(
                                Arc::clone(&window),
                                Some(Arc::new(move |id, title, width, height| {
                                    let _ = proxy_fb.send_event(
                                        VeloxUserEvent::CreateWindow { id, title, width, height }
                                    );
                                })),
                                Some(Arc::new(move || {
                                    let _ = proxy_qfb.send_event(VeloxUserEvent::Quit);
                                })),
                                Some(Arc::new(move || {
                                    let _ = proxy_rfb.send_event(VeloxUserEvent::Restart);
                                })),
                            );
                            VeloxRuntime::new_with_ipc(
                                tokio_handle.clone(), Some(wc),
                                Arc::clone(&ipc_clone), window_handle, Arc::clone(&nwid),
                                Arc::clone(&shared_perf),
                            )
                        }
                    }
                } else {
                    VeloxRuntime::new_with_ipc(
                        tokio_handle.clone(), Some(window_ctrl),
                        Arc::clone(&ipc_clone), window_handle, Arc::clone(&nwid),
                        Arc::clone(&shared_perf),
                    )
                };

                rt.register_extensions(&*extensions_arc);

                // ── Single-instance deep-link listener (main window only) ──
                // If a TCP listener was created before the event loop started, hand it
                // to a Tokio task that forwards URLs from second instances into the
                // runtime's deeplink_url_queue.
                if window_handle == 0 {
                    if let Some(listener) = single_instance_tcp.take() {
                        let queue_clone = Arc::clone(&rt.deeplink_url_queue);
                        // Push URLs to the queue; the next frame will pick them up.
                        tokio_handle.spawn(async move {
                            use tokio::io::AsyncBufReadExt;
                            // Convert the std listener to a tokio listener.
                            let async_listener = match tokio::net::TcpListener::from_std(listener) {
                                Ok(l)  => l,
                                Err(e) => {
                                    log::warn!("velox: deep-link listener error: {}", e);
                                    return;
                                }
                            };
                            loop {
                                match async_listener.accept().await {
                                    Ok((stream, _addr)) => {
                                        let queue = Arc::clone(&queue_clone);
                                        tokio::spawn(async move {
                                            let reader = tokio::io::BufReader::new(stream);
                                            let mut lines = reader.lines();
                                            while let Ok(Some(line)) = lines.next_line().await {
                                                let url = line.trim().to_string();
                                                if !url.is_empty() {
                                                    log::info!("velox: deep-link forwarded URL: {}", url);
                                                    queue.lock().unwrap().push_back(url);
                                                    // Note: no request_redraw here — the frame loop will
                                                    // pick up the URL on the next scheduled frame.
                                                }
                                            }
                                        });
                                    }
                                    Err(e) => {
                                        log::warn!("velox: deep-link listener accept error: {}", e);
                                    }
                                }
                            }
                        });
                    }
                }

                if let Some(ref js) = *js_src_arc {
                    match rt.eval(js) {
                        Ok(_)  => log::info!("Window {}: JS eval complete.", window_handle),
                        Err(e) => log::error!("Window {}: JS eval error: {}", window_handle, e),
                    }
                }

                let win = window.clone();
                let request_redraw: Arc<dyn Fn() + Send + Sync> =
                    Arc::new(move || win.request_redraw());

                // Frameless drag closure — captures the window directly.
                let drag_window_fn: Option<Arc<dyn Fn() + Send + Sync>> =
                    if !window_decorations {
                        let w_drag = Arc::clone(&window);
                        Some(Arc::new(move || { w_drag.drag_window().ok(); }))
                    } else {
                        None
                    };

                let ws = PerWindowState {
                    gpu:          gpu_ctx,
                    renderer,
                    text_sys:     TextSystem::new(),
                    layout:       LayoutTree::new(),
                    runtime:      rt,
                    layout_dirty:           true,
                    layout_structure_dirty: true,
                    resolved:               Vec::new(),
                    js_nodes:     std::collections::HashMap::with_capacity(256),
                    js_root:      None,
                    images:       std::collections::HashMap::with_capacity(32),
                    images_by_path: lru::LruCache::new(std::num::NonZeroUsize::new(64).unwrap()),
                    image_cache_hits: 0,
                    image_cache_misses: 0,
                    label_cache:  lru::LruCache::new(std::num::NonZeroUsize::new(256).unwrap()),
                    cursor_x:     0.0,
                    cursor_y:     0.0,
                    drag_active:  false,
                    drag_start_x: 0.0,
                    drag_start_y: 0.0,
                    request_redraw: Arc::clone(&request_redraw),
                    cursor_blink_on:       true,
                    cursor_blink_deadline: Instant::now() + Duration::from_millis(500),
                    perf:          shared_perf,
                    rss_bytes:     {
                        // Spawn a background task that polls RSS every 2 s via sysinfo.
                        // This keeps the heavy OS syscall off the render thread entirely,
                        // eliminating the P99 spikes that the previous per-30-frame poll caused.
                        let rss_atomic = Arc::new(std::sync::atomic::AtomicU64::new(0));
                        let rss_clone  = Arc::clone(&rss_atomic);
                        let pid        = sysinfo::Pid::from_u32(std::process::id());
                        tokio_handle.spawn(async move {
                            let mut sys = sysinfo::System::new();
                            loop {
                                sys.refresh_processes(
                                    sysinfo::ProcessesToUpdate::Some(&[pid]), false,
                                );
                                let rss = sys.process(pid)
                                    .map(|p| p.memory())
                                    .unwrap_or(0);
                                rss_clone.store(rss, std::sync::atomic::Ordering::Relaxed);
                                tokio::time::sleep(std::time::Duration::from_secs(2)).await;
                            }
                        });
                        rss_atomic
                    },
                    canvas_cmds:     std::collections::HashMap::new(),
                    canvas3d_scenes: std::collections::HashMap::new(),
                    renderer_3d:     None,
                    camera_streams:  std::collections::HashMap::new(),
                    video_streams:   std::collections::HashMap::new(),
                    // Splash only applies to the main window; secondary windows get None.
                    splash_state: if window_handle == 0 { main_splash_state.take() } else { None },
                    decorations:     window_decorations,
                    drag_window_fn,
                    #[cfg(feature = "dev")]
                    dev_mode: if window_handle == 0 {
                        // Hot-reload dev overlay is only wired to the main window.
                        start_dev_mode_worker(
                            Arc::clone(&request_redraw),
                            _dev_mode.clone(),
                        )
                        .map(|rx| DevModeState {
                            rx,
                            overlay_visible: true,
                            last_reload: None,
                            last_build_message: "watching changes".to_string(),
                            ctrl_down: false,
                            shift_down: false,
                            overlay_lines:        Vec::new(),
                            overlay_next_refresh: Instant::now(),
                            last_js_error:        None,
                        })
                    } else {
                        None
                    },
                };
                windows.insert(window_handle, ws);
                window.request_redraw();

                // Kick off ffmpeg-sidecar download in the background once, on the
                // main window only.  The download is a no-op when ffmpeg is already
                // reachable via PATH or the sidecar dir.
                #[cfg(feature = "dev")]
                if window_handle == 0 {
                    crate::scene::ensure_dev_ffmpeg();
                }
            }

            // ── Resize ────────────────────────────────────────────────────
            ShellEvent::Resized { window_handle, width, height } => {
                if let Some(s) = windows.get_mut(&window_handle) {
                    let prev_w = s.gpu.width();
                    let prev_h = s.gpu.height();
                    s.gpu.resize(width, height);
                    if s.gpu.width() != prev_w || s.gpu.height() != prev_h {
                        s.layout_dirty = true;
                        s.runtime.push_event(InputEvent::Resize { width, height });
                    }
                }
            }

            // ── Cursor movement ───────────────────────────────────────────
            ShellEvent::CursorMoved { window_handle, x, y } => {
                if let Some(s) = windows.get_mut(&window_handle) {
                    let prev_x = s.cursor_x;
                    let prev_y = s.cursor_y;
                    s.cursor_x = x as f32;
                    s.cursor_y = y as f32;
                    s.runtime.push_event(InputEvent::CursorMoved {
                        x: s.cursor_x,
                        y: s.cursor_y,
                    });
                    if s.drag_active {
                        s.runtime.push_event(InputEvent::DragMove {
                            x: s.cursor_x,
                            y: s.cursor_y,
                            dx: s.cursor_x - prev_x,
                            dy: s.cursor_y - prev_y,
                        });
                    }
                    (s.request_redraw)();
                }
            }

            // ── Mouse button ──────────────────────────────────────────────
            ShellEvent::MouseInput { window_handle, button, pressed } => {
                if let Some(s) = windows.get_mut(&window_handle) {
                    // When frameless and left button pressed: check for a veloxDraggable
                    // node under the cursor. If found, initiate an OS window drag and
                    // skip the normal DragStart event so JS sliders/etc. aren't affected.
                    if button == 0 && pressed && !s.decorations {
                        if let Some(ref drag_fn) = s.drag_window_fn.clone() {
                            let cx = s.cursor_x;
                            let cy = s.cursor_y;
                            let hit = {
                                let cache = s.runtime.layout_cache.lock().unwrap();
                                s.js_nodes.iter().any(|(&id, node)| {
                                    node.props.draggable == Some(true)
                                        && cache.get(&id).map_or(false, |&[x, y, w, h]| {
                                            cx >= x && cx <= x + w && cy >= y && cy <= y + h
                                        })
                                })
                            };
                            if hit {
                                drag_fn();
                                // Still send MouseButton so onPressIn handlers fire, but
                                // do NOT start a DragStart — the OS owns this drag now.
                                s.runtime.push_event(InputEvent::MouseButton {
                                    x: cx, y: cy, button, pressed,
                                });
                                return;
                            }
                        }
                    }

                    s.runtime.push_event(InputEvent::MouseButton {
                        x: s.cursor_x, y: s.cursor_y, button, pressed,
                    });
                    // Track left-button drag state (button == 0).
                    if button == 0 {
                        if pressed {
                            s.drag_active  = true;
                            s.drag_start_x = s.cursor_x;
                            s.drag_start_y = s.cursor_y;
                            s.runtime.push_event(InputEvent::DragStart {
                                x: s.cursor_x, y: s.cursor_y,
                            });
                        } else if s.drag_active {
                            s.drag_active = false;
                            s.runtime.push_event(InputEvent::DragEnd {
                                x: s.cursor_x, y: s.cursor_y,
                            });
                        }
                    }
                }
            }

            // ── Keyboard ──────────────────────────────────────────────────
            ShellEvent::KeyInput { window_handle, key, text, pressed } => {
                if let Some(s) = windows.get_mut(&window_handle) {
                    #[cfg(feature = "dev")]
                    if let Some(dev) = s.dev_mode.as_mut() {
                        match key.as_str() {
                            "ControlLeft" | "ControlRight" => dev.ctrl_down = pressed,
                            "ShiftLeft" | "ShiftRight"     => dev.shift_down = pressed,
                            "KeyD" if pressed && dev.ctrl_down && dev.shift_down => {
                                dev.overlay_visible = !dev.overlay_visible;
                                (s.request_redraw)();
                            }
                            _ => {}
                        }
                    }
                    s.runtime.push_event(InputEvent::KeyInput { key, text, pressed });
                }
            }

            // ── Scroll ────────────────────────────────────────────────────
            ShellEvent::Scroll { window_handle, delta_y } => {
                if let Some(s) = windows.get_mut(&window_handle) {
                    s.runtime.push_event(InputEvent::Scroll { delta_y });
                }
            }

            // ── Draw ──────────────────────────────────────────────────────
            ShellEvent::RedrawRequested { window_handle } => {
                let Some(s) = windows.get_mut(&window_handle) else { return };

                #[cfg(feature = "dev")]
                handle_dev_build_events(s);

                // ── Perf: wall-clock frame time ───────────────────────────
                let frame_start = Instant::now();
                let frame_time_ms = {
                    let perf = s.perf.lock().unwrap();
                    if let Some(prev) = perf.last_frame_at {
                        (frame_start - prev).as_secs_f64() * 1000.0
                    } else {
                        0.0
                    }
                };

                // 1. Resolve async JS Promises.
                s.runtime.tick();

                // 2. Pre-frame scene commands (initial mount, async completions).
                let pre_commands = s.runtime.drain_scene_commands();
                apply_scene_commands(s, pre_commands);

                // 3. JS frame callback — dispatchEvents, React state updates.
                let js_start = Instant::now();
                let frame_tick_err = s.runtime.frame_tick();
                let js_time_ms = js_start.elapsed().as_secs_f64() * 1000.0;

                // In dev mode, surface JS exceptions as a visual overlay.
                #[cfg(feature = "dev")]
                if let Some(err) = frame_tick_err {
                    if let Some(dev) = s.dev_mode.as_mut() {
                        dev.last_js_error = Some(err);
                    }
                }

                // 4. Post-frame commands (React re-renders from step 3 events).
                let post_commands = s.runtime.drain_scene_commands();
                apply_scene_commands(s, post_commands);

                // 5a. Pull latest camera frames and build peniko::Images.
                for stream in s.camera_streams.values_mut() {
                    if let Some((w, h, data)) = stream.frame_buf.lock().unwrap().take() {
                        stream.latest_image = Some(
                            peniko::Image::new(data.into(), peniko::Format::Rgba8, w, h)
                        );
                    }
                }

                // 5b. Pull latest video frames and build peniko::Images.
                // Also drain video events into the runtime's video_events queue.
                for stream in s.video_streams.values_mut() {
                    if let Some((w, h, data)) = stream.frame_buf.lock().unwrap().take() {
                        stream.latest_image = Some(
                            peniko::Image::new(data.into(), peniko::Format::Rgba8, w, h)
                        );
                    }
                    let pending: Vec<_> = stream.events.lock().unwrap().drain(..).collect();
                    if !pending.is_empty() {
                        let mut ve = s.runtime.video_events.lock().unwrap();
                        ve.extend(pending);
                    }
                }

                // 5. Single layout pass.
                let layout_start = Instant::now();
                recompute_layout(s);
                let layout_time_ms = layout_start.elapsed().as_secs_f64() * 1000.0;

                // Placeholder for gpu_time_ms; set after render_frame+present below.
                let perf_snapshot_pre = (frame_time_ms, js_time_ms, layout_time_ms);
                let perf_node_count   = s.js_nodes.len();

                // 6. Scroll-adjusted positions for next frame's hit-testing.
                update_scroll_positions(s);

                // 7. Acquire swapchain texture.
                let texture = match s.gpu.current_texture() {
                    Ok(t)  => t,
                    Err(e) => {
                        log::warn!("Surface error: {}; reconfiguring.", e);
                        s.gpu.resize(s.gpu.width(), s.gpu.height());
                        return;
                    }
                };

                // 8. Cursor blink phase.
                let now = Instant::now();
                if now >= s.cursor_blink_deadline {
                    s.cursor_blink_on       = !s.cursor_blink_on;
                    s.cursor_blink_deadline = now + Duration::from_millis(500);
                }

                // 9. Render JS scene graph.
                let mut frame = s.renderer.begin_frame();
                let mut any_cursor_active = false;
                let mut canvas3d_overlays: Vec<(u32, f32, f32, f32, f32)> = Vec::new();

                if let Some(root_id) = s.js_root {
                    let mut render_ctx = RenderCtx {
                        nodes:             &s.js_nodes,
                        images:            &s.images,
                        resolved:          &s.resolved,
                        frame:             &mut frame,
                        text_sys:          &mut s.text_sys,
                        label_cache:       &mut s.label_cache,
                        canvas_cmds:       &s.canvas_cmds,
                        canvas3d_overlays: &mut canvas3d_overlays,
                        camera_streams:    &s.camera_streams,
                        video_streams:     &s.video_streams,
                        cursor_blink_on:   s.cursor_blink_on,
                        any_cursor_active: &mut any_cursor_active,
                    };
                    render_subtree(root_id, 0.0, &mut render_ctx);
                }

                // Splash screen overlay — drawn on top of JS scene.
                if let Some(sp) = &s.splash_state {
                    if sp.is_visible() {
                        let sw = s.gpu.width()  as f64;
                        let sh = s.gpu.height() as f64;
                        let bg = rgba_to_vello(sp.background);
                        frame.fill_rect(0.0, 0.0, sw, sh, bg);
                        if let Some(img) = &sp.image {
                            let iw = img.width  as f64;
                            let ih = img.height as f64;
                            let scale  = (sw / iw).min(sh / ih).min(1.0);
                            let dw = iw * scale;
                            let dh = ih * scale;
                            let dx = (sw - dw) * 0.5;
                            let dy = (sh - dh) * 0.5;
                            frame.draw_image(img, dx, dy, dw, dh);
                        }
                        // Request another frame so the splash keeps redrawing until hidden.
                        (s.request_redraw)();
                    }
                }

                #[cfg(feature = "dev")]
                draw_dev_overlay(s, &mut frame);

                #[cfg(feature = "dev")]
                draw_error_overlay(s, &mut frame);

                #[cfg(feature = "dev")]
                if s.dev_mode.as_ref().map(|d| d.overlay_visible).unwrap_or(false) {
                    (s.request_redraw)();
                }

                let gpu_start = Instant::now();
                if let Err(e) = s.renderer.render_frame(&s.gpu, &texture, frame) {
                    log::error!("Render error: {}", e);
                    return;
                }

                // 3D overlays — blitted on top of Vello with LoadOp::Load.
                if !canvas3d_overlays.is_empty() {
                    let surface_view = texture.texture.create_view(&Default::default());
                    let sw = s.gpu.width()  as f32;
                    let sh = s.gpu.height() as f32;
                    for (id, x, y, w, h) in &canvas3d_overlays {
                        // Lazy-initialise Renderer3D on first use.
                        if s.renderer_3d.is_none() {
                            s.renderer_3d = Some(velox_3d::Renderer3D::new(
                                &s.gpu.device,
                                s.gpu.surface_format(),
                            ));
                        }
                        if let Some(scene) = s.canvas3d_scenes.get(id) {
                            let scene = scene.clone();
                            let r3d = s.renderer_3d.as_mut().unwrap();
                            // Pre-warm any GLTF paths encountered in this scene.
                            for mesh in &scene.meshes {
                                if let velox_3d::Geometry3D::Gltf { path } = &mesh.geometry {
                                    if let Err(e) = r3d.load_gltf(&s.gpu.device, path) {
                                        log::warn!("GLTF load error '{}': {}", path, e);
                                    }
                                }
                            }
                            r3d.render(&s.gpu.device, &s.gpu.queue,
                                       *id, &scene, *x, *y, *w, *h,
                                       &surface_view, sw, sh);
                        }
                    }
                }

                texture.present();
                let gpu_time_ms = gpu_start.elapsed().as_secs_f64() * 1000.0;

                // Record perf sample (skips the first frame where frame_time_ms = 0).
                let (frame_time_ms, js_time_ms, layout_time_ms) = perf_snapshot_pre;
                if frame_time_ms > 0.0 {
                    let heap = s.runtime.heap_stats();
                    // RSS is updated by a background tokio task every 2 s — zero OS cost here.
                    let process_rss = s.rss_bytes.load(std::sync::atomic::Ordering::Relaxed);
                    let mut perf = s.perf.lock().unwrap();
                    perf.last_frame_at = Some(frame_start);

                    // Dev mode: simple node-count leak heuristic.
                    // If the node count grows monotonically for 600 frames (5s at 120fps),
                    // emit a warning suggesting a possible render leak.
                    #[cfg(feature = "dev")]
                    {
                        if perf._node_history.len() >= 600 { perf._node_history.pop_front(); }
                        let prev = perf._node_history.back().copied().unwrap_or(0);
                        perf._node_history.push_back(perf_node_count);
                        if perf_node_count > prev {
                            perf._monotonic_frames += 1;
                            if perf._monotonic_frames == 600 {
                                perf.push_leak_warning(format!(
                                    "{{\"type\":\"nodeCount\",\"count\":{},\"frames\":600,\"msg\":\"Node count has grown monotonically for 600 frames — possible render leak\"}}",
                                    perf_node_count
                                ));
                            }
                        } else {
                            perf._monotonic_frames = 0;
                        }
                    }

                    perf.push(velox_perf::PerfFrame {
                        frame_time_ms,
                        js_time_ms,
                        layout_time_ms,
                        gpu_time_ms,
                        node_count: perf_node_count,
                        heap_used_bytes: heap.used_heap_size,
                        process_rss_bytes: process_rss,
                    });
                } else {
                    s.perf.lock().unwrap().last_frame_at = Some(frame_start);
                }

                if any_cursor_active {
                    let redraw   = Arc::clone(&s.request_redraw);
                    let deadline = s.cursor_blink_deadline;
                    std::thread::spawn(move || {
                        let now = Instant::now();
                        if deadline > now { std::thread::sleep(deadline - now); }
                        redraw();
                    });
                }
            }

            // ── Close ─────────────────────────────────────────────────────
            ShellEvent::CloseRequested { window_handle } => {
                log::info!("Window {} closed.", window_handle);
                // Close SQLite pools gracefully before dropping the window state.
                if let Some(s) = windows.get(&window_handle) {
                    s.runtime.shutdown_db_pools();
                }
                windows.remove(&window_handle);
            }
        }
    });

    drop(tokio_rt);
    restart
}
