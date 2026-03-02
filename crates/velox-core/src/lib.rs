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
//!   - any other state mutation occurs.
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
use velox_renderer::{colors, VeloxRenderer};
use velox_runtime::{init_v8, NodeProps, NodeType, SceneCommand, VeloxRuntime};
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
    /// Use ascent, not height — height includes leading above/below glyphs.
    ascent: f64,
}

impl CachedLabel {
    fn new(ts: &mut TextSystem, text: &str, font_size: f32, max_width: f32) -> Self {
        let layout = ts.label_centered(text, font_size, max_width, colors::TEXT_PRIMARY);
        let width  = layout.width()  as f64;
        let ascent = layout.ascent() as f64;
        Self { layout, width, ascent }
    }

    /// Top-left draw origin that visually centres the text inside `rl`.
    ///
    /// `draw_text` adds `glyph_run.baseline()` before passing to Vello, so
    /// the baseline lands at `ty + ascent` — which is the centred position.
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
}

struct JsNode {
    node_type: NodeType,
    props:     NodeProps,
    children:  Vec<u32>,
    layout_id: Option<NodeId>,
}

// ── Layout helpers ────────────────────────────────────────────────────────────

fn to_taffy_style(node_type: &NodeType, props: &NodeProps) -> taffy::prelude::Style {
    match node_type {
        NodeType::View => {
            let mut style = taffy::prelude::Style::default();
            style.display           = taffy::prelude::Display::Flex;
            style.flex_direction    = taffy::prelude::FlexDirection::Column;
            style.align_items       = Some(taffy::prelude::AlignItems::Center);
            style.justify_content   = Some(taffy::prelude::JustifyContent::Center);
            if let Some(w) = props.width  { style.size.width  = taffy::prelude::length(w); }
            if let Some(h) = props.height { style.size.height = taffy::prelude::length(h); }
            style
        }
        NodeType::Text => {
            let mut style = taffy::prelude::Style::default();
            // Use the explicit dimensions from props so Taffy can position the
            // text node within its parent flex container correctly.
            // Without these, Taffy gives the node zero size — the container
            // then centres a zero-size box, which places the draw origin at the
            // container midpoint. Text extends right and down from there,
            // appearing in the bottom-right quadrant instead of the centre.
            if let Some(w) = props.width  { style.size.width  = taffy::prelude::length(w); }
            if let Some(h) = props.height { style.size.height = taffy::prelude::length(h); }
            style
        }
    }
}

/// Rebuild the entire Taffy tree from the current JS node map.
///
/// Called whenever `layout_dirty` is true and a JS root exists.
/// The full rebuild is correct at this scale; incremental updates are a
/// Week 14+ concern (hundreds of nodes, animations).
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

/// Depth-first render order with cycle detection (guards against JS bugs
/// that create circular parent-child references).
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

    // Destructure so `window` can be moved into velox_shell::run() while
    // `js_src` is captured by the event-loop closure.
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

                // Evaluate application startup JavaScript.
                // Synchronous scene-graph calls (createNode, appendChild)
                // execute immediately. Async calls (readFile) queue Promises
                // that resolve during the render-loop tick().
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

            // ── Draw ──────────────────────────────────────────────────────
            ShellEvent::RedrawRequested => {
                let Some(s) = &mut state else { return };

                // 1. Resolve async JS Promises (readFile, etc.).
                s.runtime.tick();

                // 2. Process scene-graph commands queued by JS bindings.
                let commands = s.runtime.drain_scene_commands();
                if !commands.is_empty() {
                    for cmd in commands {
                        match cmd {
                            SceneCommand::CreateNode { id, node_type, props } => {
                                s.js_nodes.insert(id, JsNode {
                                    node_type,
                                    props,
                                    children:  Vec::new(),
                                    layout_id: None,
                                });
                                // The first node created becomes the scene root.
                                if s.js_root.is_none() {
                                    s.js_root = Some(id);
                                }
                            }
                            SceneCommand::AppendChild { parent_id, child_id } => {
                                if let Some(parent) = s.js_nodes.get_mut(&parent_id) {
                                    if !parent.children.contains(&child_id) {
                                        parent.children.push(child_id);
                                    }
                                }
                            }
                            SceneCommand::UpdateNode { id, props } => {
                                if let Some(node) = s.js_nodes.get_mut(&id) {
                                    if props.width.is_some()     { node.props.width     = props.width;     }
                                    if props.height.is_some()    { node.props.height    = props.height;    }
                                    if props.text.is_some()      { node.props.text      = props.text;      }
                                    if props.font_size.is_some() { node.props.font_size = props.font_size; }
                                }
                            }
                            SceneCommand::RemoveNode { id } => {
                                s.js_nodes.remove(&id);
                                // Stale child refs in parent nodes are skipped
                                // gracefully by rebuild_layout_from_scene.
                            }
                            SceneCommand::SetRoot { id } => {
                                s.js_root = Some(id);
                            }
                        }
                    }
                    s.layout_dirty = true;
                }

                // 3. Recompute layout if the scene has changed.
                if s.layout_dirty {
                    if let Some(root_id) = s.js_root {
                        rebuild_layout_from_scene(&mut s.layout, &mut s.js_nodes, root_id);
                        match s.layout.compute(s.gpu.width() as f32, s.gpu.height() as f32) {
                            Ok(r)  => { s.resolved = r; }
                            Err(e) => { log::error!("Layout error: {}", e); return; }
                        }
                    }
                    s.layout_dirty = false;
                }

                // 4. Acquire the next swapchain texture.
                let texture = match s.gpu.current_texture() {
                    Ok(t)  => t,
                    Err(e) => {
                        log::warn!("Surface error: {}; reconfiguring.", e);
                        s.gpu.resize(s.gpu.width(), s.gpu.height());
                        return;
                    }
                };

                // 5. Render the JS scene graph (or a blank frame if no JS root yet).
                let mut frame = s.renderer.begin_frame();

                if let Some(root_id) = s.js_root {
                    for id in build_render_order(root_id, &s.js_nodes) {
                        let Some(node)      = s.js_nodes.get(&id)                                  else { continue };
                        let Some(layout_id) = node.layout_id                                       else { continue };
                        let Some((_, rl))   = s.resolved.iter().find(|(nid, _)| *nid == layout_id) else { continue };

                        match node.node_type {
                            NodeType::View => {
                                frame.fill_rounded_rect(
                                    rl.x as f64, rl.y as f64,
                                    rl.width as f64, rl.height as f64,
                                    8.0, colors::BRAND_GREEN,
                                );
                            }
                            NodeType::Text => {
                                let text      = node.props.text.as_deref().unwrap_or("Text");
                                let font_size = node.props.font_size.unwrap_or(16.0);
                                let label     = CachedLabel::new(
                                    &mut s.text_sys, text, font_size, rl.width.max(1.0),
                                );
                                let (tx, ty) = label.centred_origin(rl);
                                frame.draw_text(&label.layout, tx, ty, colors::TEXT_PRIMARY);
                            }
                        }
                    }
                }

                if let Err(e) = s.renderer.render_frame(&s.gpu, &texture, frame) {
                    log::error!("Render error: {}", e);
                    return;
                }
                texture.present();
            }

            ShellEvent::CloseRequested => {
                log::info!("Window close requested — shutting down.");
            }

            _ => {}
        }
    });

    drop(tokio_rt);
}
