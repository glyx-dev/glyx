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
//! ## Layout dirty flag
//!
//! Taffy layout is only recomputed when `layout_dirty` is true. It is set
//! on init and whenever the window resizes or the JS scene changes. Unchanged
//! frames skip Taffy entirely.
//!
//! ## Text shaping
//!
//! Parley text shaping is expensive relative to rendering. `CachedLabel`
//! holds a shaped result. JS Text nodes currently re-shape each frame —
//! future work: cache shaped layouts keyed by (text, font_size, max_width).

use velox_gpu::GpuContext;
use velox_layout::{flex_column, LayoutTree, ResolvedLayout};
use velox_renderer::{colors, peniko, VeloxRenderer};
use velox_runtime::{init_v8, InputEvent, NodeProps, NodeType, SceneCommand, VeloxRuntime};
use velox_shell::ShellEvent;
use velox_text::{TextLayout, TextSystem};
use velox_layout::NodeId;

pub use velox_shell::ShellConfig as WindowConfig;

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
    width:  f64,
    /// Pre-computed ascent for *visual* vertical centering.
    ascent: f64,
}

impl CachedLabel {
    fn new(ts: &mut TextSystem, text: &str, font_size: f32, max_width: f32, color: [u8; 4]) -> Self {
        let vello_color = peniko::Color::rgba8(color[0], color[1], color[2], color[3]);
        let layout = ts.label_centered(text, font_size, max_width, vello_color);
        let width  = layout.width()  as f64;
        let ascent = layout.ascent() as f64;
        Self { layout, width, ascent }
    }

    /// Top-left draw origin that visually centres the text inside `rl`.
    fn centred_origin(&self, rl: &ResolvedLayout) -> (f64, f64) {
        let bw = rl.width  as f64;
        let bh = rl.height as f64;
        let bx = rl.x      as f64;
        let by = rl.y      as f64;

        let tx = bx + (bw - self.width).max(0.0) / 2.0;
        let ty = by + (bh - self.ascent).max(0.0) / 2.0;
        (tx, ty)
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
    /// Current cursor position in physical pixels.
    cursor_x:     f32,
    cursor_y:     f32,
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

// ── Layout helpers ────────────────────────────────────────────────────────────

fn to_taffy_style(node_type: &NodeType, props: &NodeProps) -> taffy::prelude::Style {
    use taffy::prelude::*;

    match node_type {
        NodeType::View => {
            let mut style = Style::default();
            style.display = Display::Flex;

            // flex_direction
            style.flex_direction = match props.flex_direction.as_deref() {
                Some("row")            => FlexDirection::Row,
                Some("row-reverse")    => FlexDirection::RowReverse,
                Some("column-reverse") => FlexDirection::ColumnReverse,
                _                      => FlexDirection::Column,
            };

            // justify_content
            style.justify_content = match props.justify_content.as_deref() {
                Some("flex-start")    => Some(JustifyContent::FlexStart),
                Some("flex-end")      => Some(JustifyContent::FlexEnd),
                Some("space-between") => Some(JustifyContent::SpaceBetween),
                Some("space-around")  => Some(JustifyContent::SpaceAround),
                Some("space-evenly")  => Some(JustifyContent::SpaceEvenly),
                _                     => Some(JustifyContent::Center),
            };

            // align_items
            style.align_items = match props.align_items.as_deref() {
                Some("flex-start") => Some(AlignItems::FlexStart),
                Some("flex-end")   => Some(AlignItems::FlexEnd),
                Some("stretch")    => Some(AlignItems::Stretch),
                Some("baseline")   => Some(AlignItems::Baseline),
                _                  => Some(AlignItems::Center),
            };

            if let Some(w) = props.width  { style.size.width  = length(w); }
            if let Some(h) = props.height { style.size.height = length(h); }

            if let Some(p) = props.padding {
                style.padding = Rect {
                    left:   length(p),
                    right:  length(p),
                    top:    length(p),
                    bottom: length(p),
                };
            }

            if let Some(g) = props.gap {
                style.gap = Size { width: length(g), height: length(g) };
            }

            if let Some(f) = props.flex {
                style.flex_grow = f;
            }

            style
        }
        NodeType::Text => {
            let mut style = taffy::prelude::Style::default();
            if let Some(w) = props.width  { style.size.width  = length(w); }
            if let Some(h) = props.height { style.size.height = length(h); }
            style
        }
    }
}

/// Rebuild the entire Taffy tree from the current JS node map.
fn rebuild_layout_from_scene(
    layout:  &mut LayoutTree,
    nodes:   &mut std::collections::HashMap<u32, JsNode>,
    root_id: u32,
) {
    *layout = LayoutTree::new();
    for node in nodes.values_mut() {
        node.layout_id = None;
    }

    fn build_subtree(
        layout: &mut LayoutTree,
        nodes:  &mut std::collections::HashMap<u32, JsNode>,
        id:     u32,
    ) -> Option<NodeId> {
        let (node_type, props, children) = {
            let node = nodes.get(&id)?;
            (node.node_type.clone(), node.props.clone(), node.children.clone())
        };
        let style = to_taffy_style(&node_type, &props);

        let mut child_ids = Vec::new();
        for child in children {
            if let Some(cid) = build_subtree(layout, nodes, child) {
                child_ids.push(cid);
            }
        }

        let layout_id = if child_ids.is_empty() {
            layout.add_node(style, Some(format!("js-{}", id))).ok()?
        } else {
            layout.add_container(style, &child_ids, Some(format!("js-{}", id))).ok()?
        };

        if let Some(node) = nodes.get_mut(&id) {
            node.layout_id = Some(layout_id);
        }
        Some(layout_id)
    }

    if let Some(content_root) = build_subtree(layout, nodes, root_id) {
        if let Some(wrapper_id) = layout
            .add_container(flex_column(0.0), &[content_root], Some("js-root".into()))
            .ok()
        {
            layout.set_root(wrapper_id);
        }
    }
}

/// Depth-first render order with cycle detection.
fn build_render_order(
    root_id: u32,
    nodes:   &std::collections::HashMap<u32, JsNode>,
) -> Vec<u32> {
    fn visit(
        id:    u32,
        nodes: &std::collections::HashMap<u32, JsNode>,
        seen:  &mut std::collections::HashSet<u32>,
        out:   &mut Vec<u32>,
    ) {
        if !seen.insert(id) { return; }
        out.push(id);
        if let Some(node) = nodes.get(&id) {
            for child in &node.children {
                visit(*child, nodes, seen, out);
            }
        }
    }
    let mut out  = Vec::new();
    let mut seen = std::collections::HashSet::new();
    visit(root_id, nodes, &mut seen, &mut out);
    out
}

fn apply_scene_commands(state: &mut AppState, commands: Vec<SceneCommand>) -> bool {
    if commands.is_empty() {
        return false;
    }
    for cmd in commands {
        match cmd {
            SceneCommand::CreateNode { id, node_type, props } => {
                state.js_nodes.insert(id, JsNode {
                    node_type,
                    props,
                    children:  Vec::new(),
                    layout_id: None,
                });
                if state.js_root.is_none() {
                    state.js_root = Some(id);
                }
            }
            SceneCommand::AppendChild { parent_id, child_id } => {
                if let Some(parent) = state.js_nodes.get_mut(&parent_id) {
                    if !parent.children.contains(&child_id) {
                        parent.children.push(child_id);
                    }
                }
            }
            SceneCommand::UpdateNode { id, props } => {
                if let Some(node) = state.js_nodes.get_mut(&id) {
                    if props.width.is_some()            { node.props.width            = props.width;            }
                    if props.height.is_some()           { node.props.height           = props.height;           }
                    if props.text.is_some()             { node.props.text             = props.text;             }
                    if props.font_size.is_some()        { node.props.font_size        = props.font_size;        }
                    if props.color.is_some()            { node.props.color            = props.color;            }
                    if props.background_color.is_some() { node.props.background_color = props.background_color; }
                    if props.border_radius.is_some()    { node.props.border_radius    = props.border_radius;    }
                    if props.flex.is_some()             { node.props.flex             = props.flex;             }
                    if props.flex_direction.is_some()   { node.props.flex_direction   = props.flex_direction;   }
                    if props.justify_content.is_some()  { node.props.justify_content  = props.justify_content;  }
                    if props.align_items.is_some()      { node.props.align_items      = props.align_items;      }
                    if props.padding.is_some()          { node.props.padding          = props.padding;          }
                    if props.gap.is_some()              { node.props.gap              = props.gap;              }
                    if props.show_cursor.is_some()      { node.props.show_cursor      = props.show_cursor;      }
                }
            }
            SceneCommand::RemoveNode { id } => {
                state.js_nodes.remove(&id);
            }
            SceneCommand::SetRoot { id } => {
                state.js_root = Some(id);
            }
        }
    }
    state.layout_dirty = true;
    true
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
                    cursor_x:     0.0,
                    cursor_y:     0.0,
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
                    // Request redraw so pressed state updates visually this frame.
                    // velox-shell already requests redraw for mouse events; this
                    // is left here as documentation of intent.
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

                let commands = s.runtime.drain_scene_commands();
                if apply_scene_commands(s, commands) {
                    s.layout_dirty = true;
                }

                // 3. Recompute layout if the scene has changed.
                if s.layout_dirty {
                    log::info!("Layout dirty, recomputing...");
                    if let Some(root_id) = s.js_root {
                        rebuild_layout_from_scene(&mut s.layout, &mut s.js_nodes, root_id);
                        match s.layout.compute(s.gpu.width() as f32, s.gpu.height() as f32) {
                            Ok(r)  => {
                                log::info!("Layout computed: {} nodes", r.len());
                                s.resolved = r;
                                // Update the layout cache so JS hit-testing works.
                                for (js_id, node) in &s.js_nodes {
                                    if let Some(lid) = node.layout_id {
                                        if let Some((_, rl)) = s.resolved.iter().find(|(nid, _)| *nid == lid) {
                                            s.runtime.update_layout(*js_id, rl.x, rl.y, rl.width, rl.height);
                                        }
                                    }
                                }
                            }
                            Err(e) => { log::error!("Layout error: {}", e); return; }
                        }
                    } else {
                        log::warn!("No JS root, skipping layout");
                    }
                    s.layout_dirty = false;
                } else {
                    // log::info!("Layout clean, skipping compute");
                }

                s.runtime.frame_tick();
                let post_frame_commands = s.runtime.drain_scene_commands();
                if apply_scene_commands(s, post_frame_commands) {
                    if let Some(root_id) = s.js_root {
                        rebuild_layout_from_scene(&mut s.layout, &mut s.js_nodes, root_id);
                        match s.layout.compute(s.gpu.width() as f32, s.gpu.height() as f32) {
                            Ok(r)  => {
                                s.resolved = r;
                                for (js_id, node) in &s.js_nodes {
                                    if let Some(lid) = node.layout_id {
                                        if let Some((_, rl)) = s.resolved.iter().find(|(nid, _)| *nid == lid) {
                                            s.runtime.update_layout(*js_id, rl.x, rl.y, rl.width, rl.height);
                                        }
                                    }
                                }
                            }
                            Err(e) => { log::error!("Layout error: {}", e); return; }
                        }
                    }
                }

                // 5. Acquire the next swapchain texture.
                let texture = match s.gpu.current_texture() {
                    Ok(t)  => t,
                    Err(e) => {
                        log::warn!("Surface error: {}; reconfiguring.", e);
                        s.gpu.resize(s.gpu.width(), s.gpu.height());
                        return;
                    }
                };

                // 6. Render the JS scene graph.
                let mut frame = s.renderer.begin_frame();

                if let Some(root_id) = s.js_root {
                    for id in build_render_order(root_id, &s.js_nodes) {
                        let Some(node)      = s.js_nodes.get(&id)                                  else { continue };
                        let Some(layout_id) = node.layout_id                                       else { continue };
                        let Some((_, rl))   = s.resolved.iter().find(|(nid, _)| *nid == layout_id) else { continue };

                        match node.node_type {
                            NodeType::View => {
                                let bg = node.props.background_color
                                    .map(rgba_to_vello)
                                    .unwrap_or(colors::BRAND_GREEN);
                                let radius = node.props.border_radius.unwrap_or(8.0) as f64;

                                frame.fill_rounded_rect(
                                    rl.x as f64, rl.y as f64,
                                    rl.width as f64, rl.height as f64,
                                    radius, bg,
                                );
                            }
                            NodeType::Text => {
                                let text      = node.props.text.as_deref().unwrap_or("Text");
                                let font_size = node.props.font_size.unwrap_or(16.0);
                                let color     = node.props.color.unwrap_or([255, 255, 255, 255]);
                                let label     = CachedLabel::new(
                                    &mut s.text_sys, text, font_size, rl.width.max(1.0), color,
                                );
                                let (tx, ty) = label.centred_origin(rl);
                                frame.draw_text(&label.layout, tx, ty, rgba_to_vello(color));

                                // Text cursor: a thin rect drawn after the text when focused.
                                if node.props.show_cursor.unwrap_or(false) {
                                    let cursor_x = tx + label.width + 2.0;
                                    let cursor_h = (font_size as f64) * 1.2;
                                    let cursor_y = ty + label.ascent - cursor_h;
                                    frame.fill_rounded_rect(
                                        cursor_x, cursor_y, 2.0, cursor_h,
                                        0.0, rgba_to_vello(color),
                                    );
                                }
                            }
                        }
                    }
                }

                if let Err(e) = s.renderer.render_frame(&s.gpu, &texture, frame) {
                    log::error!("Render error: {}", e);
                    return;
                }
                texture.present();

                // Request next frame if there are pending events (keeps UI responsive
                // without busy-looping when idle).
                if !s.runtime.events.lock().unwrap().is_empty() {
                    // The window handle is not accessible here — events in the queue
                    // will trigger their own redraws via the input event paths above.
                }
            }

            ShellEvent::CloseRequested => {
                log::info!("Window close requested — shutting down.");
            }
        }
    });

    drop(tokio_rt);
}
