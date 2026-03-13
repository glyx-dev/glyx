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

use std::sync::Arc;
use std::time::{Duration, Instant};
use velox_gpu::GpuContext;
use velox_layout::{flex_column, LayoutTree, ResolvedLayout, TextMeasureCtx};
use velox_renderer::{colors, peniko, VeloxRenderer, FrameBuilder};
use velox_runtime::{init_v8, InputEvent, NodeProps, NodeType, SceneCommand, VeloxRuntime};
use velox_shell::ShellEvent;
use velox_text::{TextLayout, TextSystem};
use velox_layout::NodeId;

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
    /// });
    /// ```
    pub js_src: Option<String>,
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
}

struct JsNode {
    node_type: NodeType,
    props:     NodeProps,
    children:  Vec<u32>,
    layout_id: Option<NodeId>,
}

// ── Colour helpers ─────────────────────────────────────────────────────────────

fn rgba_to_vello(c: [u8; 4]) -> peniko::Color {
    peniko::Color::rgba8(c[0], c[1], c[2], c[3])
}

// ── Entry point ───────────────────────────────────────────────────────────────

pub fn run(config: AppConfig) {
    env_logger::init();

    // Tokio runtime for async JS bindings.
    let tokio_rt = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(2)
        .enable_all()
        .build()
        .expect("Failed to build Tokio runtime");
    let tokio_handle = tokio_rt.handle().clone();

    init_v8();

    let AppConfig { window, js_src } = config;

    let mut state: Option<AppState> = None;

    velox_shell::run(window, move |event| {
        match event {
            // ── Window ready — initialise all subsystems ──────────────────
            ShellEvent::WindowReady { window } => {
                let gpu_ctx = pollster::block_on(GpuContext::new(window.clone()))
                    .expect("Failed to initialise GPU");

                let renderer = VeloxRenderer::new(&gpu_ctx)
                    .expect("Failed to initialise Vello renderer");

                let mut rt = VeloxRuntime::new(tokio_handle.clone());

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
                    request_redraw,
                    cursor_blink_on:       true,
                    cursor_blink_deadline: Instant::now() + Duration::from_millis(500),
                });

                window.request_redraw();
            }

            // ── Resize ────────────────────────────────────────────────────
            ShellEvent::Resized { width, height } => {
                if let Some(s) = &mut state {
                    s.gpu.resize(width, height);
                    s.layout_dirty = true;
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
