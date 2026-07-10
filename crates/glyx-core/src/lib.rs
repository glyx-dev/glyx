//! glyx-core — application lifecycle coordinator.
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
//! JS hit-testing via `__glyx_getLayout` then returns the visually correct
//! position for Pressables inside scrolled containers.
//!
//! ## Text shaping
//!
//! `CachedLabel` holds a shaped result keyed by (text, font_size, max_width,
//! color).  Cache misses call Parley once; cache hits return instantly.

use mimalloc::MiMalloc;
#[global_allocator]
static GLOBAL: MiMalloc = MiMalloc;

use std::path::PathBuf;
use std::sync::Arc;
use parking_lot::Mutex;
use std::time::{Duration, Instant};
use glyx_gpu::GpuContext;
use glyx_layout::{flex_column, LayoutTree, ResolvedLayout, TextMeasureCtx};
use glyx_renderer::{colors, peniko, AnyRenderer, AnyFrame, BackendKind, Scene};
use glyx_runtime::{
    init_v8, new_ipc_bus,
    CanvasCmd, InputEvent, LengthValue, NodeProps, NodeType, SceneCommand,
    GlyxRuntime, WindowController,
};

pub use glyx_runtime::GlyxExtension;
use glyx_security::{self, Capabilities};
use glyx_media;
use glyx_shell::{ShellEvent, GlyxUserEvent};
use glyx_text::{TextLayout, TextSystem};
use glyx_layout::NodeId;

include!(concat!(env!("OUT_DIR"), "/embedded_snapshot.rs"));

// ── JS plugin bundling ────────────────────────────────────────────────────────

pub use glyx_runtime::{JsPlugin, JsPlugins, CancellableTask};

pub use glyx_shell::ShellConfig as WindowConfig;
pub use glyx_shell::StartupMode;
pub use glyx_shell::RenderMode;
mod config;
mod state;
mod dev_mode;
mod scene;
mod layout;
mod render;

use self::config::*;
use self::state::*;
use self::dev_mode::*;

use scene::{apply_scene_commands, update_dirty_from_layout, build_dirty_subtrees, snapshot_resolved};
use layout::{recompute_layout, update_scroll_positions};
use render::{render_subtree, RenderCtx, compute_scrollbar_thumb};

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
    bold:           bool,
    italic:         bool,
    // Color is intentionally NOT part of the key: CachedLabel stores only the
    // shaped layout, not color.  Color is applied at draw time via frame.draw_text,
    // so the same shaped result can be reused across all color variants of a string.
}

impl LabelKey {
    fn new(text: &str, font_size: f32, max_width: f32, bold: bool, italic: bool) -> Self {
        use std::hash::{Hash, Hasher};
        let mut h = std::collections::hash_map::DefaultHasher::new();
        text.hash(&mut h);
        Self {
            text_hash:      h.finish(),
            font_size_bits: font_size.to_bits(),
            max_width_bits: max_width.to_bits(),
            bold,
            italic,
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
    /// ```ignore
    /// // Illustrative — the include_str! path is relative to your crate.
    /// glyx_core::run(glyx_core::AppConfig {
    ///     window: glyx_core::WindowConfig::default(),
    ///     js_src: Some(include_str!("../js/app.js").to_string()),
    ///     snapshot_blob: None,
    ///     dev_mode: None,
    ///     extensions: vec![],
    ///     js_plugins: vec![],
    /// });
    /// ```
    pub js_src: Option<String>,
    /// Pre-executed V8 snapshot blob (from glyx-snapshot tool).
    ///
    /// When provided, the isolate is restored from the snapshot (fast startup ~50ms).
    /// Falls back to eval() if not provided or if in dev mode.
    pub snapshot_blob: Option<Vec<u8>>,
    pub dev_mode: Option<DevModeConfig>,
    /// Optional native Rust extensions that register custom __glyx_* bindings.
    pub extensions: Vec<Box<dyn GlyxExtension>>,
    /// Bundled JS plugins from `glyx.config.json` `plugins` array.
    /// Each plugin's exported async functions are callable via `backend.<name>.<fn>()`.
    pub js_plugins: Vec<JsPlugin>,
}

impl AppConfig {
    /// Load configuration from `glyx.config.json` in the current directory.
    ///
    /// JS source is read from the path specified in `glyx.config.json`'s `dev.output`
    /// field (defaults to `js/dist/app.js`). This is the zero-boilerplate entry point:
    /// ```no_run
    /// fn main() {
    ///     glyx_core::run(glyx_core::AppConfig::from_config());
    /// }
    /// ```
    pub fn from_config() -> Self {
        let mut window = WindowConfig::default();
        let (caps, js_plugins) = load_glyx_config(&mut window);
        glyx_security::init(caps);
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
            js_plugins,
        }
    }

    /// Create an AppConfig from a binary trailer payload appended to the runner executable.
    ///
    /// Called by glyx-runner when it detects embedded payload in its own bytes.
    /// The trailer is written by `glyx build --mode snapshot` for JS-only projects
    /// without invoking cargo.
    pub fn from_trailer(snapshot_blob: Vec<u8>, js_src: String, config_json: &str) -> Self {
        let mut window = WindowConfig::default();
        let (caps, js_plugins) = apply_config_json(config_json, &mut window);
        glyx_security::init(caps);
        AppConfig {
            window,
            js_src: Some(js_src),
            snapshot_blob: Some(snapshot_blob),
            dev_mode: None,
            extensions: vec![],
            js_plugins,
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
    fn new(ts: &mut TextSystem, text: &str, font_size: f32, max_width: f32, color: [u8; 4], bold: bool, italic: bool) -> Self {
        let layout      = ts.styled_label(text, font_size, max_width, bold, italic);
        let width       = layout.width() as f64;
        let text_height = layout.height() as f64;
        // For an empty string Parley produces no glyph runs, so ascent() = 0.
        // Shape a reference "M" at the same size to get the real font ascent.
        let ref_layout = if layout.ascent() > 0.1 {
            None
        } else {
            Some(ts.label_centered("M", font_size, max_width))
        };
        let _ = color; // used at draw time via frame.draw_text
        let src = ref_layout.as_ref().unwrap_or(&layout);
        let (cursor_top_raw, cursor_height_raw) = src.cursor_metrics();
        Self {
            layout,
            width,
            text_height,
            cursor_top:    cursor_top_raw    as f64,
            cursor_height: cursor_height_raw as f64,
        }
    }
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

fn rgba_to_vello(c: [u8; 4]) -> peniko::Color {
    peniko::Color::from_rgba8(c[0], c[1], c[2], c[3])
}

/// Returns `true` if any descendant of `id` with `pressable=true` covers (cx, cy).
/// Used by the drag check to yield window-drag priority to interactive children
/// inside a `glyxDraggable` region (e.g. buttons inside a custom title bar).
fn has_pressable_descendant_at(
    id:     u32,
    cx:     f32,
    cy:     f32,
    nodes:  &std::collections::HashMap<u32, JsNode>,
    cache:  &std::collections::HashMap<u32, [f32; 4]>,
) -> bool {
    let Some(node) = nodes.get(&id) else { return false };
    for &child_id in &node.children {
        if let Some(child) = nodes.get(&child_id) {
            // Direct pressable covering cursor → stop drag
            if child.props.pressable == Some(true) {
                if cache.get(&child_id).map_or(false, |&[x, y, w, h]| {
                    cx >= x && cx <= x + w && cy >= y && cy <= y + h
                }) {
                    return true;
                }
            }
            // Recurse into non-pressable containers (e.g. a row View wrapping buttons)
            if has_pressable_descendant_at(child_id, cx, cy, nodes, cache) {
                return true;
            }
        }
    }
    false
}

/// Try to start a scrollbar thumb drag at the current cursor position.
/// Returns `Some(ScrollbarDragState)` if the cursor is over a scrollbar thumb.
fn try_start_scrollbar_drag(s: &mut PerWindowState) -> Option<ScrollbarDragState> {
    let cx = s.cursor_x as f64;
    let cy = s.cursor_y as f64;
    for (&id, node) in &s.js_nodes {
        let show = node.props.show_scrollbar.unwrap_or(true);
        if !show { continue; }
        let Some(lid) = node.layout_id else { continue };
        let Some((_, rl)) = s.resolved.iter().find(|(nid, _)| *nid == lid) else { continue };
        let scroll_y = node.props.scroll_offset_y.unwrap_or(0.0);
        let bar_w = node.props.scrollbar_width.unwrap_or(8.0);
        let rx = rl.x as f64;
        let ry = rl.y as f64;
        let rw = rl.width as f64;
        let rh = rl.height as f64;
        // Skip if cursor is not even in the track X range
        let track_x = rx + rw - bar_w as f64;
        if cx < track_x || cx > rx + rw { continue; }
        // Compute max_child_bottom from raw Taffy positions (not the scroll-adjusted cache)
        let max_child_bottom: f64 = node.children.iter()
            .filter_map(|&cid| {
                let cn   = s.js_nodes.get(&cid)?;
                let clid = cn.layout_id?;
                s.resolved.iter()
                    .find(|(nid, _)| *nid == clid)
                    .map(|(_, crl)| (crl.y + crl.height) as f64)
            })
            .fold(f64::NEG_INFINITY, f64::max);
        if !max_child_bottom.is_finite() { continue; }
        // Both rl.y and max_child_bottom are window-absolute; content height is
        // the distance from this node's top to the furthest child bottom.
        let content_h = max_child_bottom - rl.y as f64;
        if let Some((_tx, ty, _tw, th)) = compute_scrollbar_thumb(
            rx, ry, rw, rh,
            scroll_y as f64, content_h, bar_w as f64,
        ) {
            if cy >= ty && cy <= ty + th {
                let vp_h = rh;
                let scroll_range = (content_h - vp_h).max(0.0);
                return Some(ScrollbarDragState {
                    node_id: id,
                    track_h: rh,
                    thumb_h: th,
                    scroll_range,
                    start_scroll_y: scroll_y as f64,
                    start_mouse_y: s.cursor_y as f64,
                });
            }
        }
    }
    None
}

// ── Window controller builder ─────────────────────────────────────────────────

/// Register `scheme://` as a URL handler in the Windows registry under HKCU.
/// Uses the built-in `reg.exe` tool — no extra dependencies, no admin rights.
/// Called once at startup; idempotent (safe to call on every launch).
#[cfg(target_os = "windows")]
fn register_deeplink_scheme_windows(scheme: &str) {
    let exe = match std::env::current_exe() {
        Ok(p) => p.to_string_lossy().into_owned(),
        Err(_) => return,
    };
    // Normalise forward slashes to backslashes (Windows registry convention).
    let exe = exe.replace('/', "\\");

    // The command value: "C:\path\to\app.exe" "%1"
    let cmd_value = format!("\"{}\" \"%1\"", exe);

    let entries = [
        (
            format!("HKCU\\Software\\Classes\\{scheme}"),
            None,  // default value
            format!("URL:{scheme} Protocol"),
        ),
        (
            format!("HKCU\\Software\\Classes\\{scheme}"),
            Some("URL Protocol"),
            String::new(),
        ),
        (
            format!("HKCU\\Software\\Classes\\{scheme}\\shell\\open\\command"),
            None,
            cmd_value,
        ),
    ];

    for (key, value_name, data) in &entries {
        let mut args = vec!["add", key, "/f", "/d", data];
        if let Some(vn) = value_name {
            args.extend_from_slice(&["/v", vn]);
        } else {
            args.push("/ve");  // default (unnamed) value
        }
        let _ = std::process::Command::new("reg").args(&args).output();
    }

    log::debug!("glyx: registered deep-link scheme {}:// → {}", scheme, exe);
}

fn build_window_controller(
    window: Arc<winit::window::Window>,
    create_window_fn: Option<Arc<dyn Fn(u32, String, u32, u32) + Send + Sync>>,
    quit_fn:    Option<Arc<dyn Fn() + Send + Sync>>,
    restart_fn: Option<Arc<dyn Fn() + Send + Sync>>,
) -> WindowController {
    use winit::window::Fullscreen;

    // Extract the raw platform HWND (Windows) so dialogs can be parented to
    // the Glyx window and appear in front of it rather than behind it.
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
    // On Windows, Ctrl+C causes STATUS_CONTROL_C_EXIT (0xc000013a) by default,
    // which cargo treats as a failure even though the user intentionally quit.
    // Install a console ctrl handler that exits cleanly with code 0.
    #[cfg(target_os = "windows")]
    {
        #[link(name = "kernel32")]
        extern "system" {
            fn SetConsoleCtrlHandler(
                handler: Option<unsafe extern "system" fn(u32) -> i32>,
                add: i32,
            ) -> i32;
        }
        unsafe extern "system" fn ctrl_handler(_ctrl_type: u32) -> i32 {
            std::process::exit(0);
        }
        unsafe { SetConsoleCtrlHandler(Some(ctrl_handler), 1); }
    }

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
    // RUST_LOG can still add more specific directives (e.g. glyx_core=debug)
    // but cannot remove the per-module suppression above.
    if let Ok(rust_log) = std::env::var("RUST_LOG") {
        log_builder.parse_filters(&rust_log);
    }
    log_builder.init();

    // Load .env from the working directory (or any parent) if one exists.
    match dotenvy::dotenv() {
        Ok(path) => log::info!("glyx: loaded env from {}", path.display()),
        Err(dotenvy::Error::Io(_)) => {}
        Err(e) => log::warn!("glyx: .env parse error: {e}"),
    }

    // Init security from config only if not already done (e.g. via AppConfig::from_config()).
    // This fallback ensures security is initialised even when AppConfig is built manually.
    if !glyx_security::is_initialized() {
        let (caps, _plugins) = load_glyx_config(&mut config.window);
        glyx_security::init(caps);
    }

    // ── Deep link: check launch args for a URL matching the configured scheme ──
    //
    // If the app registered `"deeplink": { "scheme": "notes" }` and was launched
    // with `notes://note/42` as an argument, we capture it in `GLYX_LAUNCH_URL`
    // so the `__glyx_deeplink_getInitialUrl()` binding can retrieve it.
    //
    // Single-instance mode (opt-in):
    //   First instance  — binds a TCP socket on localhost, writes port to a temp
    //                     file so second instances know where to forward URLs.
    //   Second instance — connects to that socket, sends the URL, exits.
    //
    // The TCP listener is started after the runtime is ready (inside WindowReady)
    // using the Tokio handle and the runtime's `deeplink_url_queue`.
    let mut single_instance_tcp: Option<std::net::TcpListener> = {
        if let Some(ref dl) = glyx_security::get().deeplink {
            let scheme_prefix = format!("{}://", dl.scheme);
            let launch_url: Option<String> = std::env::args()
                .skip(1)
                .find(|a| a.starts_with(&scheme_prefix));

            if let Some(ref url) = launch_url {
                // Safety: this is the only write; bindings read it after runtime starts.
                #[allow(unused_unsafe)]
                unsafe { std::env::set_var("GLYX_LAUNCH_URL", url); }
                log::info!("glyx: deep-link launch URL: {}", url);
            }

            // Auto-register the URL scheme on Windows so the app handles deeplinks
            // without requiring a manual .reg import.  We write to HKCU (no admin needed).
            #[cfg(target_os = "windows")]
            register_deeplink_scheme_windows(&dl.scheme);

            if dl.single_instance {
                let app_name = std::env::current_exe()
                    .ok()
                    .and_then(|p| p.file_stem().map(|s| s.to_string_lossy().into_owned()))
                    .unwrap_or_else(|| "glyx-app".to_string());
                let port_file = std::env::temp_dir().join(format!("glyx-{}.port", app_name));

                // Try to connect as a second instance.
                let is_second = port_file.exists() && {
                    let connected = std::fs::read_to_string(&port_file)
                        .ok()
                        .and_then(|s| s.trim().parse::<u16>().ok())
                        .and_then(|port| {
                            use std::io::Write;
                            let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
                            std::net::TcpStream::connect_timeout(
                                &addr,
                                std::time::Duration::from_millis(150),
                            )
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
                    log::info!("glyx: second instance detected — forwarded URL and exiting");
                    std::process::exit(0);
                }

                // First instance: bind TCP listener.
                match std::net::TcpListener::bind("127.0.0.1:0") {
                    Ok(listener) => {
                        listener.set_nonblocking(true).ok();
                        let port = listener.local_addr().map(|a| a.port()).unwrap_or(0);
                        std::fs::write(&port_file, port.to_string()).ok();
                        log::info!("glyx: single-instance listener on port {}", port);
                        Some(listener)
                    }
                    Err(e) => {
                        log::warn!("glyx: could not bind single-instance socket: {}", e);
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

    // GLYX_PERF_CHECK=<duration_secs>:<budget_ms> — set by `glyx build --check-performance`.
    // After the given duration the app prints a JSON perf summary and exits.
    let perf_check: Option<(u64, f64)> = std::env::var("GLYX_PERF_CHECK").ok().and_then(|v| {
        let mut parts = v.splitn(2, ':');
        let dur  = parts.next()?.parse::<u64>().ok()?;
        let bud  = parts.next()?.parse::<f64>().ok()?;
        Some((dur, bud))
    });

    let tokio_rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(1)
        .enable_io()
        .enable_time()
        .build()
        .expect("Failed to build Tokio runtime");
    let tokio_handle = tokio_rt.handle().clone();

    init_v8();

    let AppConfig { window, js_src, snapshot_blob, dev_mode: _dev_mode, extensions, js_plugins } = config;
    // Capture before `window` is moved into glyx_shell::run().
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
    let js_plugins_arc: glyx_runtime::JsPlugins = Arc::new(js_plugins);
    // Build the backend command registry once; share it across all windows.
    let backend_registry  = Arc::new(glyx_runtime::build_backend_registry(&*extensions_arc));

    // Per-window state: handle → PerWindowState.
    let mut windows: std::collections::HashMap<u32, PerWindowState> =
        std::collections::HashMap::new();

    // Save background color and render mode before `window` (ShellConfig) is moved into run().
    let window_bg = window.background_color;
    // Capture configured mode; Auto is resolved after GPU adapter is known.
    let render_mode_config = window.render_mode;
    // Canvas2D transport config — applied to each runtime after construction.
    let canvas_protocol  = window.canvas_protocol.clone();
    let canvas_buffer_kb = window.canvas_buffer_kb.unwrap_or(256) as usize;
    // Compute V8 heap cap: explicit config wins; otherwise auto-calculate from bundle size.
    let heap_cap_mb: usize = match window.max_js_heap_mb {
        Some(mb) => mb as usize,
        None => {
            let bundle_bytes = (*js_src_arc).as_ref().map(|s| s.len()).unwrap_or(0);
            let cap = calc_heap_mb(bundle_bytes);
            log::info!("[v8] heap cap: {cap} MB (auto from {:.2} MB bundle)", bundle_bytes as f64 / (1024.0 * 1024.0));
            cap
        }
    };

    let restart = glyx_shell::run(window, move |event| {
        match event {
            // ── Window ready — initialise per-window subsystems ──────────
            ShellEvent::WindowReady { window_handle, window, proxy: ev_proxy } => {
                let gpu_ctx = pollster::block_on(GpuContext::new(window.clone()))
                    .expect("Failed to initialise GPU");
                // Resolve RenderMode → BackendKind.
                // GLYX_CPU_RENDER=1 forces the cheapest CPU path (TinySkia) for
                // CI, headless testing, or machines without a supported GPU.
                let force_cpu = std::env::var("GLYX_CPU_RENDER")
                    .map(|v| v.trim() == "1").unwrap_or(false);
                let backend_kind = resolve_backend(render_mode_config, gpu_ctx.gpu_tier(), force_cpu);
                if render_mode_config == RenderMode::Auto {
                    log::info!(
                        "[glyx] renderMode=auto → {} ({})",
                        match &backend_kind {
                            BackendKind::TinySkia                 => "skia",
                            BackendKind::FemtoVg                  => "femtovg",
                            BackendKind::Vello { use_cpu: false } => "vello",
                            BackendKind::Vello { use_cpu: true  } => "vello/cpu",
                        },
                        gpu_ctx.adapter_name(),
                    );
                }
                let mut renderer = AnyRenderer::new(&gpu_ctx, backend_kind)
                    .expect("Failed to initialise renderer");
                // Apply window background color so the GPU clear matches the
                // app theme from frame zero — no blank white flash on startup.
                renderer.set_background_color(rgba_to_vello(window_bg));

                // Build callbacks that send events to the shell event loop.
                let proxy_for_fn = ev_proxy.clone();
                let create_fn: Arc<dyn Fn(u32, String, u32, u32) + Send + Sync> =
                    Arc::new(move |id, title, width, height| {
                        let _ = proxy_for_fn.send_event(
                            GlyxUserEvent::CreateWindow { id, title, width, height }
                        );
                    });

                let proxy_quit = ev_proxy.clone();
                let quit_fn: Arc<dyn Fn() + Send + Sync> =
                    Arc::new(move || { let _ = proxy_quit.send_event(GlyxUserEvent::Quit); });

                let proxy_restart = ev_proxy.clone();
                let restart_fn: Arc<dyn Fn() + Send + Sync> =
                    Arc::new(move || { let _ = proxy_restart.send_event(GlyxUserEvent::Restart); });

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
                let shared_perf: Arc<Mutex<glyx_perf::PerfState>> =
                    Arc::new(Mutex::new(glyx_perf::PerfState::new()));

                // GLYX_PERF_CHECK: apply budget, then spawn a timer that exits after duration.
                if let Some((duration_secs, budget_ms)) = perf_check {
                    shared_perf.lock().budget_ms = budget_ms;
                    let perf_arc  = Arc::clone(&shared_perf);
                    let proxy_pc  = ev_proxy.clone();
                    std::thread::spawn(move || {
                        std::thread::sleep(std::time::Duration::from_secs(duration_secs));
                        // Print perf summary to stdout for CLI to capture.
                        let p = perf_arc.lock();
                        let violations = p.violations.len();
                        let avg_ms = p.avg_frame_time();
                        let p99_ms = p.p99_frame_time();
                        let fps    = p.fps();
                        drop(p);
                        let pass = violations == 0;
                        println!("GLYX_PERF_RESULT:{{\"violations\":{violations},\"avgFrameMs\":{avg_ms:.2},\"p99FrameMs\":{p99_ms:.2},\"fps\":{fps:.1},\"pass\":{pass}}}");
                        let _ = proxy_pc.send_event(GlyxUserEvent::Quit);
                    });
                }

                let mut rt = if let Some(ref blob) = *snapshot_blob_arc {
                    match GlyxRuntime::new_from_snapshot_with_ipc(
                        blob, tokio_handle.clone(), Some(window_ctrl),
                        Arc::clone(&ipc_clone), window_handle, Arc::clone(&nwid),
                        Arc::clone(&shared_perf),
                        Arc::clone(&backend_registry),
                        Arc::clone(&js_plugins_arc),
                        heap_cap_mb,
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
                                        GlyxUserEvent::CreateWindow { id, title, width, height }
                                    );
                                })),
                                Some(Arc::new(move || {
                                    let _ = proxy_qfb.send_event(GlyxUserEvent::Quit);
                                })),
                                Some(Arc::new(move || {
                                    let _ = proxy_rfb.send_event(GlyxUserEvent::Restart);
                                })),
                            );
                            GlyxRuntime::new_with_ipc(
                                tokio_handle.clone(), Some(wc),
                                Arc::clone(&ipc_clone), window_handle, Arc::clone(&nwid),
                                Arc::clone(&shared_perf),
                                Arc::clone(&backend_registry),
                                Arc::clone(&js_plugins_arc),
                                heap_cap_mb,
                            )
                        }
                    }
                } else {
                    GlyxRuntime::new_with_ipc(
                        tokio_handle.clone(), Some(window_ctrl),
                        Arc::clone(&ipc_clone), window_handle, Arc::clone(&nwid),
                        Arc::clone(&shared_perf),
                        Arc::clone(&backend_registry),
                        Arc::clone(&js_plugins_arc),
                        heap_cap_mb,
                    )
                };

                // Set up the Canvas2D binary command buffer (or mark json mode).
                rt.init_canvas_buffers(&canvas_protocol, canvas_buffer_kb);

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
                                    log::warn!("glyx: deep-link listener error: {}", e);
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
                                                    log::info!("glyx: deep-link forwarded URL: {}", url);
                                                    queue.lock().push_back(url);
                                                    // Note: no request_redraw here — the frame loop will
                                                    // pick up the URL on the next scheduled frame.
                                                }
                                            }
                                        });
                                    }
                                    Err(e) => {
                                        log::warn!("glyx: deep-link listener accept error: {}", e);
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
                    images_by_path: ByteBudgetImageCache::new(256 * 1024 * 1024),
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
                    cursor_was_active:     false,
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
                    gc_frame_counter: 0,
                    canvas_cmds:     std::collections::HashMap::new(),
                    canvas3d_scenes: std::collections::HashMap::new(),
                    canvas3d_dirty:  std::collections::HashSet::new(),
                    renderer_3d:     None,
                    camera_streams:  std::collections::HashMap::new(),
                    video_streams:   std::collections::HashMap::new(),
                    // Splash only applies to the main window; secondary windows get None.
                    splash_state: if window_handle == 0 { main_splash_state.take() } else { None },
                    decorations:     window_decorations,
                    drag_window_fn,
                    scrollbar_drag:  None,
                    dirty_nodes:              std::collections::HashSet::new(),
                    descendant_cascade_nodes: std::collections::HashSet::new(),
                    dirty_subtrees:           std::collections::HashSet::new(),
                    prev_resolved:   std::collections::HashMap::new(),
                    scene_cache:              std::collections::HashMap::new(),
                    scene_cache_new:          std::collections::HashMap::new(),
                    boundary_scene_cache:     std::collections::HashMap::new(),
                    boundary_scene_cache_new: std::collections::HashMap::new(),
                    pipeline_cache_saved:     false,
                    #[cfg(feature = "dev")]
                    dev_mode: if window_handle == 0 {
                        // Hot-reload dev overlay is only wired to the main window.
                        start_dev_mode_worker(
                            Arc::clone(&request_redraw),
                            _dev_mode.clone(),
                        )
                        .map(|rx| DevModeState {
                            rx,
                            overlay_visible: false,
                            last_reload: None,
                            last_build_message: "watching changes".to_string(),
                            ctrl_down: false,
                            shift_down: false,
                            overlay_lines:         Vec::new(),
                            overlay_next_refresh:  Instant::now(),
                            overlay_next_redraw:    Instant::now(),
                            last_js_error:          None,
                            startup_rss_bytes:      0,
                            startup_v8_total_bytes: 0,
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

                    // Scrollbar thumb drag
                    if let Some(ref drag) = s.scrollbar_drag {
                        let cursor_y = y as f64;
                        let mouse_delta = cursor_y - drag.start_mouse_y;
                        let drag_range = drag.track_h - drag.thumb_h;
                        if drag_range > 0.0 && drag.scroll_range > 0.0 {
                            let ratio = drag.scroll_range / drag_range;
                            let new_scroll_y =
                                (drag.start_scroll_y + mouse_delta * ratio).clamp(0.0, drag.scroll_range);
                            s.runtime.push_event(InputEvent::ScrollbarDrag {
                                node_id: drag.node_id,
                                scroll_y: new_scroll_y as f32,
                            });
                        }
                    }

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
                    // When frameless and left button pressed: check for a glyxDraggable
                    // node under the cursor. If found, initiate an OS window drag and
                    // skip the normal DragStart event so JS sliders/etc. aren't affected.
                    if button == 0 && pressed && !s.decorations {
                        if let Some(ref drag_fn) = s.drag_window_fn.clone() {
                            let cx = s.cursor_x;
                            let cy = s.cursor_y;
                            let hit = {
                                let cache = s.runtime.layout_cache.lock();
                                s.js_nodes.iter().any(|(&id, node)| {
                                    node.props.draggable == Some(true)
                                        && cache.get(&id).map_or(false, |&[x, y, w, h]| {
                                            cx >= x && cx <= x + w && cy >= y && cy <= y + h
                                        })
                                        // Skip drag if a Pressable descendant is under cursor.
                                        // Clicking a button inside the title bar should press
                                        // the button, not drag the window.
                                        && !has_pressable_descendant_at(id, cx, cy, &s.js_nodes, &cache)
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

                    // ── Scrollbar thumb drag ─────────────────────────────
                    if button == 0 {
                        if pressed {
                            // Clear any stale drag (e.g. from focus loss).
                            s.scrollbar_drag = None;
                            if let Some(drag) = try_start_scrollbar_drag(s) {
                                s.scrollbar_drag = Some(drag);
                                return;
                            }
                        } else if s.scrollbar_drag.take().is_some() {
                            return;
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
                    let perf = s.perf.lock();
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
                let pre_changed  = apply_scene_commands(s, pre_commands);

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
                let post_changed  = apply_scene_commands(s, post_commands);

                // 5a. Pull latest camera frames and dirty only the nodes displaying them.
                let mut updated_camera_handles: Vec<u32> = Vec::new();
                for (handle_id, stream) in s.camera_streams.iter_mut() {
                    if let Some((w, h, data)) = stream.frame_buf.lock().take() {
                        stream.latest_image = Some(peniko::ImageData {
                            data: peniko::Blob::from(data),
                            format: peniko::ImageFormat::Rgba8,
                            alpha_type: peniko::ImageAlphaType::Alpha,
                            width: w, height: h,
                        });
                        updated_camera_handles.push(*handle_id);
                    }
                }
                // 5b. Pull latest video frames and dirty only the nodes displaying them.
                // Also drain video events into the runtime's video_events queue.
                let mut updated_video_handles: Vec<u32> = Vec::new();
                for (handle_id, stream) in s.video_streams.iter_mut() {
                    if let Some((w, h, data)) = stream.frame_buf.lock().take() {
                        stream.latest_image = Some(peniko::ImageData {
                            data: peniko::Blob::from(data),
                            format: peniko::ImageFormat::Rgba8,
                            alpha_type: peniko::ImageAlphaType::Alpha,
                            width: w, height: h,
                        });
                        updated_video_handles.push(*handle_id);
                    }
                    let pending: Vec<_> = stream.events.lock().drain(..).collect();
                    if !pending.is_empty() {
                        let mut ve = s.runtime.video_events.lock();
                        ve.extend(pending);
                    }
                }
                let media_changed = !updated_camera_handles.is_empty() || !updated_video_handles.is_empty();
                // Collect media-node IDs into a local vec first to avoid a simultaneous
                // shared borrow of js_nodes and mutable borrow of dirty_nodes.
                if media_changed {
                    let media_dirty: Vec<u32> = s.js_nodes.iter()
                        .filter_map(|(&nid, node)| {
                            let cam_hit = node.props.camera_handle
                                .map_or(false, |h| updated_camera_handles.contains(&h));
                            let vid_hit = node.props.video_handle
                                .map_or(false, |h| updated_video_handles.contains(&h));
                            if cam_hit || vid_hit { Some(nid) } else { None }
                        })
                        .collect();
                    for nid in media_dirty { s.dirty_nodes.insert(nid); }
                }

                // 5. Single layout pass.
                let layout_start = Instant::now();
                recompute_layout(s);
                // Detect any position/size changes that cascaded out of layout and
                // add them to dirty_nodes before building the dirty subtree set.
                update_dirty_from_layout(s);
                build_dirty_subtrees(s);
                let layout_time_ms = layout_start.elapsed().as_secs_f64() * 1000.0;

                // Placeholder for gpu_time_ms; set after render_frame+present below.
                let perf_snapshot_pre = (frame_time_ms, js_time_ms, layout_time_ms);
                let perf_node_count   = s.js_nodes.len();

                // 6. Scroll-adjusted positions for next frame's hit-testing.
                update_scroll_positions(s);

                // 6b. Cursor blink phase — only relevant when a TextInput was visible
                //     last frame.  Skipping when no cursor is active avoids a forced
                //     full GPU render every 500 ms for apps with no focused text field.
                let now = Instant::now();
                let blink_changed = if s.cursor_was_active && now >= s.cursor_blink_deadline {
                    s.cursor_blink_on       = !s.cursor_blink_on;
                    s.cursor_blink_deadline = now + Duration::from_millis(500);
                    true
                } else {
                    false
                };

                // ── Frame gate ────────────────────────────────────────────────
                // Skip GPU work entirely when nothing changed visually.
                //
                // Two-level decision:
                //   • Release: nothing changed → return immediately, no GPU work.
                //   • Dev: overlay timer fires every ~50ms regardless of scene changes.
                //     Full Vello render only when scene changed OR overlay text is due
                //     for its 250ms refresh.  All other overlay-timer ticks blit the
                //     previous frame — skipping all 35 compute passes.
                let scene_needs_gpu = pre_changed || post_changed || media_changed || blink_changed;

                // Release: skip entirely when nothing changed.
                #[cfg(not(feature = "dev"))]
                if !scene_needs_gpu { return; }

                // Dev: compute whether a full render is actually required.
                #[cfg(feature = "dev")]
                let needs_full_render = {
                    let overlay_refresh_due = s.dev_mode.as_ref().map(|d| {
                        d.overlay_lines.is_empty()                   // first overlay draw
                        || Instant::now() >= d.overlay_next_refresh  // 250ms text refresh
                        || d.last_js_error.is_some()                 // error banner active
                    }).unwrap_or(false);
                    scene_needs_gpu || overlay_refresh_due
                };
                #[cfg(not(feature = "dev"))]
                let needs_full_render = true; // always true here (early return above)

                // 7. Acquire swapchain texture.
                let texture = match s.gpu.current_texture() {
                    Some(t) => t,
                    None => {
                        log::warn!("Surface lost or outdated; reconfiguring.");
                        s.gpu.resize(s.gpu.width(), s.gpu.height());
                        return;
                    }
                };

                // ── Overlay timer reschedule ───────────────────────────────────
                // Placed here — before any early return — so the timer keeps
                // firing on blit-only frames and static apps don't freeze.
                #[cfg(feature = "dev")]
                if let Some(dev) = s.dev_mode.as_mut() {
                    if dev.overlay_visible {
                        let now = Instant::now();
                        if now >= dev.overlay_next_redraw {
                            dev.overlay_next_redraw = now + Duration::from_millis(200);
                            let req = Arc::clone(&s.request_redraw);
                            tokio_handle.spawn(async move {
                                tokio::time::sleep(Duration::from_millis(200)).await;
                                req();
                            });
                        }
                    }
                }

                // ── Fast path: blit cached frame ──────────────────────────────
                // Neither the scene nor the overlay text changed.  Re-blit the
                // previous rendered frame — skips all Vello compute passes and
                // TinySkia CPU rasterization + write_texture upload.
                //
                // Guard: `pipeline_cache_saved` is set after the first successful
                // render_frame(), so the upload texture / Vello target always
                // holds a valid image when we enter this path.
                // `!scene_cache.is_empty()` covers the Vello-specific case where
                // pipeline_cache_saved is unavailable (shouldn't happen, but safe).
                //
                // Without this fix, TinySkia (supports_caching=false) never
                // populates scene_cache, so the old guard was always false and
                // TinySkia ran a full 60fps re-rasterize even on static screens.
                #[cfg(feature = "dev")]
                if !needs_full_render && (s.pipeline_cache_saved || !s.scene_cache.is_empty()) {
                    // Stamp last_frame_at so FPS reflects the visual refresh rate
                    // (~20fps from the overlay timer), not the full-render rate (~4fps).
                    s.perf.lock().last_frame_at = Some(frame_start);
                    if let Err(e) = s.renderer.blit_cached_frame(&s.gpu, &texture) {
                        log::warn!("blit_cached_frame: {e}");
                    } else {
                        texture.present();
                        s.gpu.poll();
                    }
                    return;
                }

                // 9. Render JS scene graph.
                // Sync renderer dims before begin_frame — TinySkia/FemtoVG create
                // their per-frame buffer at their stored size; if the window was
                // just maximized/resized, Resized only updated gpu, not the renderer.
                s.renderer.notify_resize(s.gpu.width().max(1), s.gpu.height().max(1));
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
                        dirty_subtrees:      &s.dirty_subtrees,
                        scene_cache:         &mut s.scene_cache,
                        scene_cache_new:     &mut s.scene_cache_new,
                        boundary_cache:      &mut s.boundary_scene_cache,
                        boundary_cache_new:  &mut s.boundary_scene_cache_new,
                        win_w: s.gpu.width()  as f64,
                        win_h: s.gpu.height() as f64,
                    };
                    render_subtree(root_id, 0.0, 1.0, &mut render_ctx);
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

                // (overlay timer reschedule moved to before the blit-only fast path above)

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
                            s.renderer_3d = Some(glyx_3d::Renderer3D::new(
                                &s.gpu.device,
                                &s.gpu.queue,
                                s.gpu.surface_format(),
                            ));
                        }
                        if s.canvas3d_dirty.contains(id) {
                            // Scene changed this frame: full re-render.
                            if let Some(scene) = s.canvas3d_scenes.get(id) {
                                let gltf_paths: Vec<&str> = scene.meshes.iter()
                                    .filter_map(|m| match &m.geometry {
                                        glyx_3d::Geometry3D::Gltf { path } => Some(path.as_str()),
                                        _ => None,
                                    })
                                    .collect();
                                let r3d = s.renderer_3d.as_mut().unwrap();
                                for path in gltf_paths {
                                    if let Err(e) = r3d.load_gltf(&s.gpu.device, &s.gpu.queue, path) {
                                        log::warn!("GLTF load error '{}': {}", path, e);
                                    }
                                }
                                r3d.render(&s.gpu.device, &s.gpu.queue,
                                           *id, scene, *x, *y, *w, *h,
                                           &surface_view, sw, sh);
                            }
                            s.canvas3d_dirty.remove(id);
                        } else if s.canvas3d_scenes.contains_key(id) {
                            // Scene unchanged: blit cached texture, skip the 3D pipeline.
                            let r3d = s.renderer_3d.as_mut().unwrap();
                            r3d.blit_only(&s.gpu.device, &s.gpu.queue,
                                          *id, *x, *y, *w, *h,
                                          &surface_view, sw, sh);
                        }
                    }
                }

                texture.present();

                // Release staging buffers and D3D12 command allocators from
                // completed GPU submissions.  Without this, wgpu's upload ring
                // buffer accumulates every frame (especially on DX12/iGPU where
                // GPU memory = system RAM), causing unbounded RSS growth.
                s.gpu.poll();

                // Periodic V8 major GC — every ~5 s at 60 fps.
                // Animation loops (Canvas3D at 30 fps, Canvas2D at 60 fps) promote
                // short-lived React objects into V8's old generation faster than
                // automatic minor GC can drain them, causing ~46 KB/s RSS growth.
                // `gc_hint()` forces a full collection that reclaims them (<2 ms).
                s.gc_frame_counter = s.gc_frame_counter.wrapping_add(1);
                if s.gc_frame_counter % 180 == 0 {
                    s.runtime.gc_hint();
                    // After V8 reclaims its heap, force mimalloc to immediately
                    // decommit any segments that are now completely free rather
                    // than waiting for its background purge timer (which can
                    // take 20+ minutes to trigger a large segment decommit).
                    // mi_collect(force=true) is a no-op if nothing is free,
                    // so it is safe to call unconditionally here.
                    extern "C" { fn mi_collect(force: bool); }
                    unsafe { mi_collect(true); }
                }

                // Persist compiled shader bytecode once so subsequent launches
                // skip Vulkan shader recompilation.  Runs exactly once per
                // process (no-op after the first frame; no-op on DX12/Metal).
                if !s.pipeline_cache_saved {
                    s.renderer.try_save_pipeline_cache();
                    s.pipeline_cache_saved = true;
                }

                // Update prev_resolved snapshot and clear per-frame dirty sets.
                snapshot_resolved(s);
                s.dirty_nodes.clear();
                s.dirty_subtrees.clear();

                // Rotate scene cache: scene_cache_new becomes the cache for the
                // next frame; the old scene_cache (stale entries for hidden /
                // removed nodes) is cleared and reused as the write buffer.
                std::mem::swap(&mut s.scene_cache, &mut s.scene_cache_new);
                s.scene_cache_new.clear();
                // Same rotation for RepaintBoundary fragment cache.
                std::mem::swap(&mut s.boundary_scene_cache, &mut s.boundary_scene_cache_new);
                s.boundary_scene_cache_new.clear();

                let gpu_time_ms = gpu_start.elapsed().as_secs_f64() * 1000.0;

                // Record perf sample (skips the first frame where frame_time_ms = 0).
                let (frame_time_ms, js_time_ms, layout_time_ms) = perf_snapshot_pre;
                if frame_time_ms > 0.0 {
                    let heap = s.runtime.heap_stats();
                    // RSS is updated by a background tokio task every 2 s — zero OS cost here.
                    let process_rss = s.rss_bytes.load(std::sync::atomic::Ordering::Relaxed);
                    // wgpu GPU memory counters — reads atomics, zero GPU cost.
                    let (gpu_buf_bytes, gpu_tex_bytes, gpu_reserved_bytes,
                         gpu_buf_count, gpu_tex_count) = s.gpu.memory_counters();
                    let mut perf = s.perf.lock();
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

                    // Capture startup baseline on first frame with valid RSS.
                    #[cfg(feature = "dev")]
                    if let Some(dev) = s.dev_mode.as_mut() {
                        if dev.startup_rss_bytes == 0 && process_rss > 0 {
                            dev.startup_rss_bytes      = process_rss;
                            dev.startup_v8_total_bytes = heap.total_heap_size;
                        }
                    }

                    perf.push(glyx_perf::PerfFrame {
                        frame_time_ms,
                        js_time_ms,
                        layout_time_ms,
                        gpu_time_ms,
                        node_count: perf_node_count,
                        heap_used_bytes:  heap.used_heap_size,
                        heap_total_bytes: heap.total_heap_size,
                        process_rss_bytes: process_rss,
                        gpu_buffer_bytes:   gpu_buf_bytes,
                        gpu_texture_bytes:  gpu_tex_bytes,
                        gpu_reserved_bytes: gpu_reserved_bytes,
                        gpu_buffer_count:   gpu_buf_count,
                        gpu_texture_count:  gpu_tex_count,
                    });
                } else {
                    s.perf.lock().last_frame_at = Some(frame_start);
                }

                s.cursor_was_active = any_cursor_active;
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
            // ── Window occluded (minimised / hidden) ──────────────────────
            // Release the ~100–170 MB Vello GPU buffer pool while the window
            // is not visible.  Buffers are reallocated lazily on first redraw
            // after restore (µs cost; compiled shaders stay cached in driver).
            ShellEvent::Occluded { window_handle, occluded: true } => {
                if let Some(s) = windows.get_mut(&window_handle) {
                    s.renderer.trim_resources();
                    // Also drop CPU-side decoded image pixels. They'll be re-decoded
                    // from disk on restore (fast; atlas re-upload is the slow part,
                    // and that cost is paid anyway after trim_resources clears GPU buffers).
                    s.images_by_path.clear();
                    log::debug!("Window {window_handle} occluded — GPU buffer pool + image CPU cache released.");
                }
            }

            ShellEvent::Occluded { .. } => {} // un-occlude: nothing to do, buffers reallocate lazily

            ShellEvent::FocusChanged { focused: false, .. } => {
                // Window lost focus — user switched to another app.
                // Run V8 GC + renderer pool trim + mimalloc segment decommit
                // immediately while no frame is in flight. This is the primary
                // intelligent trigger for memory recovery; no developer action
                // required. The renderer pools (Vello GPU buffers, skia/femtovg
                // glyph caches) rebuild lazily over the next few frames on return.
                for s in windows.values_mut() {
                    s.runtime.gc_hint();
                    s.renderer.trim_resources();
                }
                extern "C" { fn mi_collect(force: bool); }
                unsafe { mi_collect(true); }
                log::debug!("Focus lost — GC + renderer trim + mi_collect triggered.");
            }

            ShellEvent::FocusChanged { .. } => {} // gained focus: nothing to do

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

#[cfg(test)]
mod tests {
    use super::*;

    // ── Backend selection (renderMode + GPU tier → concrete backend) ──────────

    #[test]
    fn auto_selects_tinyskia_for_no_gpu_and_integrated() {
        // Integrated GPUs share system RAM, so GPU buffer pools inflate RSS —
        // the heuristic must route both tiers to the CPU rasterizer.
        assert_eq!(resolve_backend(RenderMode::Auto, GpuTier::None, false), BackendKind::TinySkia);
        assert_eq!(resolve_backend(RenderMode::Auto, GpuTier::Integrated, false), BackendKind::TinySkia);
    }

    #[test]
    fn auto_selects_femtovg_for_intel_arc() {
        assert_eq!(resolve_backend(RenderMode::Auto, GpuTier::DiscreteIntel, false), BackendKind::FemtoVg);
    }

    #[test]
    fn auto_selects_vello_gpu_for_discrete() {
        assert_eq!(
            resolve_backend(RenderMode::Auto, GpuTier::Discrete, false),
            BackendKind::Vello { use_cpu: false },
        );
    }

    #[test]
    fn explicit_pin_beats_auto_detection() {
        // Even on a discrete GPU, an explicit backend pin must win.
        assert_eq!(resolve_backend(RenderMode::TinySkia, GpuTier::Discrete, false), BackendKind::TinySkia);
        assert_eq!(resolve_backend(RenderMode::Femtovg, GpuTier::Discrete, false), BackendKind::FemtoVg);
        assert_eq!(
            resolve_backend(RenderMode::Cpu, GpuTier::Discrete, false),
            BackendKind::Vello { use_cpu: true },
        );
    }

    #[test]
    fn force_cpu_downgrades_auto_and_gpu_but_not_pins() {
        // GLYX_CPU_RENDER=1: Auto behaves as if there were no GPU...
        assert_eq!(resolve_backend(RenderMode::Auto, GpuTier::Discrete, true), BackendKind::TinySkia);
        // ...an explicit Gpu pin falls back to Vello's CPU path...
        assert_eq!(
            resolve_backend(RenderMode::Gpu, GpuTier::Discrete, true),
            BackendKind::Vello { use_cpu: true },
        );
        // ...and explicit CPU-safe pins are unaffected.
        assert_eq!(resolve_backend(RenderMode::TinySkia, GpuTier::None, true), BackendKind::TinySkia);
    }

    // ── renderMode string parsing ──────────────────────────────────────────────

    #[test]
    fn render_mode_strings_map_to_variants() {
        assert_eq!(parse_render_mode("auto"), RenderMode::Auto);
        assert_eq!(parse_render_mode("skia"), RenderMode::TinySkia);
        assert_eq!(parse_render_mode("femtovg"), RenderMode::Femtovg);
        assert_eq!(parse_render_mode("cpu"), RenderMode::Cpu);
        assert_eq!(parse_render_mode("gpu"), RenderMode::Gpu);
        // Unknown values fall back to Gpu rather than erroring.
        assert_eq!(parse_render_mode("not-a-mode"), RenderMode::Gpu);
    }

    // ── glyx.config.json → WindowConfig ───────────────────────────────────────

    fn apply(json: &str) -> (WindowConfig, Capabilities) {
        let mut cfg = WindowConfig::default();
        let (caps, _plugins) = apply_config_json(json, &mut cfg);
        (cfg, caps)
    }

    #[test]
    fn config_window_overrides_apply() {
        let (cfg, _) = apply(r#"{
            "window": {
                "title": "My App", "width": 900, "height": 600,
                "renderMode": "skia", "decorations": false
            }
        }"#);
        assert_eq!(cfg.title, "My App");
        assert_eq!(cfg.width, 900);
        assert_eq!(cfg.height, 600);
        assert_eq!(cfg.render_mode, RenderMode::TinySkia);
        assert!(!cfg.decorations);
    }

    #[test]
    fn config_no_size_implies_maximized() {
        let (cfg, _) = apply(r#"{ "window": { "title": "x" } }"#);
        assert_eq!(cfg.startup_mode, glyx_shell::StartupMode::Maximized);

        let (cfg, _) = apply(r#"{ "window": { "width": 800, "height": 500 } }"#);
        assert_eq!(cfg.startup_mode, glyx_shell::StartupMode::Windowed);

        let (cfg, _) = apply(r#"{ "window": { "startupMode": "fullscreen" } }"#);
        assert_eq!(cfg.startup_mode, glyx_shell::StartupMode::Fullscreen);
    }

    #[test]
    fn config_heap_cap_is_clamped() {
        let (cfg, _) = apply(r#"{ "window": { "maxJsHeapMb": 4 } }"#);
        assert_eq!(cfg.max_js_heap_mb, Some(16));
        let (cfg, _) = apply(r#"{ "window": { "maxJsHeapMb": 9999 } }"#);
        assert_eq!(cfg.max_js_heap_mb, Some(512));
        let (cfg, _) = apply(r#"{ "window": {} }"#);
        assert_eq!(cfg.max_js_heap_mb, None);
    }

    #[test]
    fn config_canvas_transport_defaults_and_clamps() {
        // Unknown protocol → binary (the default).
        let (cfg, _) = apply(r#"{ "canvas": { "protocol": "carrier-pigeon" } }"#);
        assert_eq!(cfg.canvas_protocol, "binary");
        let (cfg, _) = apply(r#"{ "canvas": { "protocol": "json" } }"#);
        assert_eq!(cfg.canvas_protocol, "json");
        // bufferKB clamped to [16, 4096].
        let (cfg, _) = apply(r#"{ "canvas": { "bufferKB": 1 } }"#);
        assert_eq!(cfg.canvas_buffer_kb, Some(16));
        let (cfg, _) = apply(r#"{ "canvas": { "bufferKB": 100000 } }"#);
        assert_eq!(cfg.canvas_buffer_kb, Some(4096));
    }

    #[test]
    fn config_capabilities_pass_through() {
        let (_, caps) = apply(r#"{
            "capabilities": {
                "db": true,
                "network": { "allow": ["api.example.com"] }
            }
        }"#);
        assert!(caps.db);
        assert!(caps.can_network("api.example.com"));
        assert!(!caps.can_network("other.example.com"));
    }

    #[test]
    fn config_invalid_json_yields_defaults() {
        // A corrupt config must not panic — it logs and leaves defaults intact.
        let (cfg, caps) = apply("{ this is not json");
        assert_eq!(cfg.render_mode, RenderMode::default());
        assert!(!caps.db);
        assert!(!caps.can_read_fs());
    }
}
