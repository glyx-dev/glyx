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

use notify::{RecursiveMode, Watcher};
use std::collections::VecDeque;
use std::path::PathBuf;
use std::process::Command;
use std::sync::mpsc::{self, Receiver, TryRecvError};
use std::sync::Arc;
use std::time::{Duration, Instant};
use velox_gpu::GpuContext;
use velox_layout::{flex_column, LayoutTree, ResolvedLayout, TextMeasureCtx};
use velox_renderer::{colors, peniko, VeloxRenderer, FrameBuilder};
use velox_runtime::{init_v8, InputEvent, NodeProps, NodeType, SceneCommand, VeloxRuntime, WindowController};
use velox_security::Capabilities;
use velox_shell::ShellEvent;
use velox_text::{TextLayout, TextSystem};
use velox_layout::NodeId;

// ── Config file parsing ───────────────────────────────────────────────────────

/// Subset of `velox.config.json` that velox-core cares about.
/// The file may contain other keys (window title etc.) which are ignored here
/// since the window is configured via `AppConfig::window` in the example crate.
#[derive(serde::Deserialize, Default)]
struct VeloxConfigFile {
    capabilities: Option<Capabilities>,
}

/// Load `velox.config.json` from the current working directory and initialise
/// the global capability store.  Missing file → permissive warning + defaults.
fn load_velox_config() {
    let caps = std::fs::read_to_string("velox.config.json")
        .ok()
        .and_then(|src| {
            serde_json::from_str::<VeloxConfigFile>(&src)
                .map_err(|e| { log::error!("velox.config.json parse error: {e}"); e })
                .ok()
        })
        .and_then(|cfg| cfg.capabilities);

    match &caps {
        Some(c) => log::info!(
            "velox-security: capabilities loaded (fs_read={}, db={}, network={})",
            c.can_read_fs(),
            c.db,
            c.network.as_ref().map(|n| n.allow.len()).unwrap_or(0),
        ),
        None => log::warn!(
            "velox-security: no velox.config.json found — all capabilities default to OFF"
        ),
    }

    velox_security::init(caps.unwrap_or_default());
}

pub use velox_shell::ShellConfig as WindowConfig;
mod scene;
mod layout;
mod render;

use scene::apply_scene_commands;
use layout::{recompute_layout, update_scroll_positions};
use render::{render_subtree, RenderCtx};

/// Cache key for shaped text: (text, font_size_bits, max_width_bits, color).
/// `to_bits()` gives an exact bitwise representation of f32, so equal floats
/// always produce the same key.
type LabelKey = (String, u32, u32, [u8; 4]);

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
    ///     dev_mode: None,
    /// });
    /// ```
    pub js_src: Option<String>,
    pub dev_mode: Option<DevModeConfig>,
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
}

impl CachedLabel {
    fn new(ts: &mut TextSystem, text: &str, font_size: f32, max_width: f32, color: [u8; 4]) -> Self {
        let vello_color = peniko::Color::rgba8(color[0], color[1], color[2], color[3]);
        let layout      = ts.label_centered(text, font_size, max_width, vello_color);
        let width       = layout.width() as f64;
        let text_height = layout.height() as f64;
        // For an empty string Parley produces no glyph runs, so ascent() = 0.
        // Shape a reference "M" at the same size to get the real font ascent.
        let ascent = if layout.ascent() > 0.1 {
            layout.ascent() as f64
        } else {
            ts.label_centered("M", font_size, max_width, vello_color).ascent() as f64
        };
        Self { layout, width, ascent, text_height }
    }
}

// ── Application state ─────────────────────────────────────────────────────────

struct AppState {
    gpu:          GpuContext,
    renderer:     VeloxRenderer,
    text_sys:     TextSystem,
    layout:       LayoutTree,
    runtime:      VeloxRuntime,
    layout_dirty: bool,
    resolved:     Vec<(NodeId, ResolvedLayout)>,
    js_nodes:     std::collections::HashMap<u32, JsNode>,
    js_root:      Option<u32>,
    images:       std::collections::HashMap<u32, peniko::Image>,
    images_by_path: std::collections::HashMap<String, peniko::Image>,
    image_cache_hits: u64,
    image_cache_misses: u64,
    /// Shaped text cache — keyed by (text, font_size_bits, max_width_bits, color).
    label_cache: std::collections::HashMap<LabelKey, CachedLabel>,
    /// Current cursor position in physical pixels.
    cursor_x:     f32,
    cursor_y:     f32,
    /// Callback to request another frame — used for cursor blinking.
    /// Wrapped in Arc so it can be cloned into the blink timer thread.
    request_redraw: Arc<dyn Fn() + Send + Sync>,
    /// Whether the cursor rect is visible in the current blink phase.
    cursor_blink_on:       bool,
    /// When to flip the blink phase next.
    cursor_blink_deadline: Instant,
    dev_mode: Option<DevModeState>,
}

struct JsNode {
    node_type: NodeType,
    props:     NodeProps,
    children:  Vec<u32>,
    layout_id: Option<NodeId>,
}

enum DevBuildEvent {
    BuildOk(String),
    BuildErr(String),
}

struct DevModeState {
    rx: Receiver<DevBuildEvent>,
    overlay_visible: bool,
    last_reload: Option<Instant>,
    last_build_message: String,
    frame_times_ms: VecDeque<f64>,
    last_frame_at: Option<Instant>,
    ctrl_down: bool,
    shift_down: bool,
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

fn rgba_to_vello(c: [u8; 4]) -> peniko::Color {
    peniko::Color::rgba8(c[0], c[1], c[2], c[3])
}

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
        let mut watcher = match notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
            match res {
                Ok(_) => {
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
                let _ = watcher.watch(&wp, RecursiveMode::Recursive);
            }
        }

        while watch_rx.recv().is_ok() {
            while watch_rx.recv_timeout(Duration::from_millis(180)).is_ok() {}

            let output = Command::new("bun")
                .arg("build")
                .arg(app_jsx.as_os_str())
                .arg("--outfile")
                .arg(app_js.as_os_str())
                .arg("--target")
                .arg("browser")
                .arg("--format")
                .arg("iife")
                .arg("--define")
                .arg("process.env.NODE_ENV='production'")
                .current_dir(&cwd)
                .output();

            match output {
                Ok(out) if out.status.success() => {
                    match std::fs::read_to_string(&app_js) {
                        Ok(js) => {
                            let _ = out_tx.send(DevBuildEvent::BuildOk(js));
                        }
                        Err(e) => {
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
                        msg = "bun build failed".to_string();
                    }
                    let _ = out_tx.send(DevBuildEvent::BuildErr(msg));
                }
                Err(e) => {
                    let _ = out_tx.send(DevBuildEvent::BuildErr(e.to_string()));
                }
            }
            redraw();
        }
    });

    Some(out_rx)
}

fn handle_dev_build_events(state: &mut AppState) {
    let Some(dev) = state.dev_mode.as_mut() else { return };
    loop {
        match dev.rx.try_recv() {
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
                let _ = state.runtime.drain_scene_commands();
                match state.runtime.eval(&js) {
                    Ok(_) => {
                        dev.last_reload = Some(Instant::now());
                        dev.last_build_message = "reload ok".to_string();
                        state.layout_dirty = true;
                    }
                    Err(e) => {
                        dev.last_build_message = format!("reload error: {}", e);
                    }
                }
            }
            Ok(DevBuildEvent::BuildErr(msg)) => {
                dev.last_build_message = format!("build error: {}", msg);
            }
            Err(TryRecvError::Empty) => break,
            Err(TryRecvError::Disconnected) => break,
        }
    }
}

fn draw_dev_overlay(state: &mut AppState, frame: &mut FrameBuilder) {
    let Some(dev) = state.dev_mode.as_mut() else { return };
    let now = Instant::now();
    if let Some(prev) = dev.last_frame_at {
        let ms = (now - prev).as_secs_f64() * 1000.0;
        dev.frame_times_ms.push_back(ms);
        while dev.frame_times_ms.len() > 60 {
            dev.frame_times_ms.pop_front();
        }
    }
    dev.last_frame_at = Some(now);

    if !dev.overlay_visible {
        return;
    }

    let frame_ms = dev.frame_times_ms.back().copied().unwrap_or(0.0);
    let avg_ms = if dev.frame_times_ms.is_empty() {
        0.0
    } else {
        dev.frame_times_ms.iter().sum::<f64>() / dev.frame_times_ms.len() as f64
    };
    let fps = if avg_ms > 0.0 { 1000.0 / avg_ms } else { 0.0 };
    let heap = state.runtime.heap_stats();
    let since = dev.last_reload.map(|t| now.saturating_duration_since(t).as_secs()).unwrap_or(0);

    frame.fill_rounded_rect(16.0, 16.0, 470.0, 140.0, 8.0, peniko::Color::rgba8(20, 20, 30, 220));

    let lines = [
        "Dev overlay (Ctrl+Shift+D)".to_string(),
        format!("FPS {:.1} | frame {:.2}ms | avg60 {:.2}ms", fps, frame_ms, avg_ms),
        format!("Nodes {} | JS heap {} / {} MB", state.js_nodes.len(), heap.used_heap_size / (1024 * 1024), heap.total_heap_size / (1024 * 1024)),
        format!("Last reload {}s ago", since),
        dev.last_build_message.clone(),
    ];

    for (i, line) in lines.iter().enumerate() {
        let text = state.text_sys.label(line, 13.0, peniko::Color::rgba8(230, 230, 240, 255));
        frame.draw_text(&text, 26.0, 34.0 + (i as f64 * 22.0), peniko::Color::rgba8(230, 230, 240, 255));
    }
}

// ── Window controller builder ─────────────────────────────────────────────────

fn build_window_controller(window: Arc<winit::window::Window>) -> WindowController {
    use winit::window::Fullscreen;

    let w1 = Arc::clone(&window);
    let w2 = Arc::clone(&window);
    let w3 = Arc::clone(&window);
    let w4 = Arc::clone(&window);
    let w5 = Arc::clone(&window);
    let w6 = Arc::clone(&window);
    let w7 = Arc::clone(&window);

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
    }
}

// ── Entry point ───────────────────────────────────────────────────────────────

pub fn run(config: AppConfig) {
    env_logger::init();

    // Load velox.config.json and lock in the capability set before any
    // JS bindings are registered.  Must be the first thing after the logger.
    load_velox_config();

    // Tokio runtime for async JS bindings.
    let tokio_rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .expect("Failed to build Tokio runtime");
    let tokio_handle = tokio_rt.handle().clone();

    init_v8();

    let AppConfig { window, js_src, dev_mode } = config;

    let mut state: Option<AppState> = None;

    velox_shell::run(window, move |event| {
        match event {
            // ── Window ready — initialise all subsystems ──────────────────
            ShellEvent::WindowReady { window } => {
                let gpu_ctx = pollster::block_on(GpuContext::new(window.clone()))
                    .expect("Failed to initialise GPU");

                let renderer = VeloxRenderer::new(&gpu_ctx)
                    .expect("Failed to initialise Vello renderer");

                let window_ctrl = build_window_controller(Arc::clone(&window));
                let mut rt = VeloxRuntime::new(tokio_handle.clone(), Some(window_ctrl));

                if let Some(ref js) = js_src {
                    match rt.eval(js) {
                        Ok(_)  => log::info!("JS startup eval complete."),
                        Err(e) => log::error!("JS startup error: {}", e),
                    }
                }

                log::info!("All subsystems initialised.");

                let win = window.clone();
                let request_redraw: Arc<dyn Fn() + Send + Sync> =
                    Arc::new(move || win.request_redraw());
                state = Some(AppState {
                    gpu:          gpu_ctx,
                    renderer,
                    text_sys:     TextSystem::new(),
                    layout:       LayoutTree::new(),
                    runtime:      rt,
                    layout_dirty: true,
                    resolved:     Vec::new(),
                    js_nodes:     std::collections::HashMap::new(),
                    js_root:      None,
                    images:       std::collections::HashMap::new(),
                    images_by_path: std::collections::HashMap::new(),
                    image_cache_hits: 0,
                    image_cache_misses: 0,
                    label_cache:  std::collections::HashMap::new(),
                    cursor_x:     0.0,
                    cursor_y:     0.0,
                    request_redraw: Arc::clone(&request_redraw),
                    cursor_blink_on:       true,
                    cursor_blink_deadline: Instant::now() + Duration::from_millis(500),
                    dev_mode: start_dev_mode_worker(Arc::clone(&request_redraw), dev_mode.clone()).map(|rx| DevModeState {
                        rx,
                        overlay_visible: true,
                        last_reload: None,
                        last_build_message: "watching changes".to_string(),
                        frame_times_ms: VecDeque::new(),
                        last_frame_at: Some(Instant::now()),
                        ctrl_down: false,
                        shift_down: false,
                    }),
                });

                window.request_redraw();
            }

            // ── Resize ────────────────────────────────────────────────────
            ShellEvent::Resized { width, height } => {
                if let Some(s) = &mut state {
                    s.gpu.resize(width, height);
                    s.layout_dirty = true;
                    s.runtime.push_event(InputEvent::Resize { width, height });
                }
            }

            // ── Cursor movement ───────────────────────────────────────────
            ShellEvent::CursorMoved { x, y } => {
                if let Some(s) = &mut state {
                    s.cursor_x = x as f32;
                    s.cursor_y = y as f32;
                    s.runtime.push_event(InputEvent::CursorMoved {
                        x: s.cursor_x,
                        y: s.cursor_y,
                    });
                    // Request a redraw so hover states (Pressable onHoverIn/Out)
                    // are reflected this frame.
                    (s.request_redraw)();
                }
            }

            // ── Mouse button ──────────────────────────────────────────────
            ShellEvent::MouseInput { button, pressed } => {
                if let Some(s) = &mut state {
                    s.runtime.push_event(InputEvent::MouseButton {
                        x:       s.cursor_x,
                        y:       s.cursor_y,
                        button,
                        pressed,
                    });
                }
            }

            // ── Keyboard ──────────────────────────────────────────────────
            ShellEvent::KeyInput { key, text, pressed } => {
                if let Some(s) = &mut state {
                    if let Some(dev) = s.dev_mode.as_mut() {
                        match key.as_str() {
                            "ControlLeft" | "ControlRight" => dev.ctrl_down = pressed,
                            "ShiftLeft" | "ShiftRight" => dev.shift_down = pressed,
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
            ShellEvent::Scroll { delta_y } => {
                if let Some(s) = &mut state {
                    s.runtime.push_event(InputEvent::Scroll { delta_y });
                }
            }

            // ── Draw ──────────────────────────────────────────────────────
            ShellEvent::RedrawRequested => {
                let Some(s) = &mut state else { return };
                handle_dev_build_events(s);

                // 1. Resolve async JS Promises (readFile, etc.).
                s.runtime.tick();

                // 2. Apply pre-frame scene commands (initial mount, etc.).
                let pre_commands = s.runtime.drain_scene_commands();
                apply_scene_commands(s, pre_commands);

                // 3. Recompute layout only when layout-affecting props changed.
                recompute_layout(s);

                // 4. Write scroll-adjusted positions into the layout cache so
                //    JS hit-testing (step 5) works correctly for Pressables
                //    inside scrolled ScrollViews.
                update_scroll_positions(s);

                // 5. Run JS frame callback — dispatchEvents, React state updates.
                s.runtime.frame_tick();

                // 6. Apply post-frame commands (React re-renders from events).
                let post_commands = s.runtime.drain_scene_commands();
                apply_scene_commands(s, post_commands);

                // 7. Re-layout if any post-frame command dirtied layout.
                recompute_layout(s);

                // 8. Acquire the next swapchain texture.
                let texture = match s.gpu.current_texture() {
                    Ok(t)  => t,
                    Err(e) => {
                        log::warn!("Surface error: {}; reconfiguring.", e);
                        s.gpu.resize(s.gpu.width(), s.gpu.height());
                        return;
                    }
                };

                // 9. Advance cursor blink phase if the deadline has passed.
                let now = Instant::now();
                if now >= s.cursor_blink_deadline {
                    s.cursor_blink_on       = !s.cursor_blink_on;
                    s.cursor_blink_deadline = now + Duration::from_millis(500);
                }

                // 10. Render the JS scene graph (depth-first, scroll-aware).
                let mut frame = s.renderer.begin_frame();
                let mut any_cursor_active = false;

                if let Some(root_id) = s.js_root {
                    let mut render_ctx = RenderCtx {
                        nodes: &s.js_nodes,
                        images: &s.images,
                        resolved: &s.resolved,
                        frame: &mut frame,
                        text_sys: &mut s.text_sys,
                        label_cache: &mut s.label_cache,
                        cursor_blink_on: s.cursor_blink_on,
                        any_cursor_active: &mut any_cursor_active,
                    };
                    render_subtree(root_id, 0.0, &mut render_ctx);
                }
                draw_dev_overlay(s, &mut frame);

                // Keep the dev overlay live by requesting the next frame
                // whenever the overlay is visible (dev-only; harmless cost).
                if s.dev_mode.as_ref().map(|d| d.overlay_visible).unwrap_or(false) {
                    (s.request_redraw)();
                }

                if let Err(e) = s.renderer.render_frame(&s.gpu, &texture, frame) {
                    log::error!("Render error: {}", e);
                    return;
                }
                texture.present();

                // Schedule the next blink redraw without busy-looping.
                if any_cursor_active {
                    let redraw   = Arc::clone(&s.request_redraw);
                    let deadline = s.cursor_blink_deadline;
                    std::thread::spawn(move || {
                        let now = Instant::now();
                        if deadline > now {
                            std::thread::sleep(deadline - now);
                        }
                        redraw();
                    });
                }
            }

            ShellEvent::CloseRequested => {
                log::info!("Window close requested — shutting down.");
            }
        }
    });

    drop(tokio_rt);
}
