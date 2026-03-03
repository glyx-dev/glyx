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
            // Height is intentionally left as Auto when not set — Taffy will
            // call the measure function to determine the natural wrapped height.
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

        let layout_id = if !child_ids.is_empty() {
            // Container node (has children) — no measure context needed.
            layout.add_container(style, &child_ids, Some(format!("js-{}", id))).ok()?
        } else {
            match node_type {
                NodeType::Text => {
                    // Text leaf: attach TextMeasureCtx so Taffy can call the
                    // measure function when height is not explicitly set.
                    let ctx = TextMeasureCtx {
                        text:      props.text.clone().unwrap_or_default(),
                        font_size: props.font_size.unwrap_or(16.0),
                    };
                    layout.add_text_node(style, ctx, Some(format!("js-{}", id))).ok()?
                }
                NodeType::View => {
                    layout.add_node(style, Some(format!("js-{}", id))).ok()?
                }
            }
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

/// Returns true if the props have any layout-affecting change relative to
/// the stored node props.  Visual-only changes (color, background, border,
/// clip, scroll_offset_y) return false so Taffy is not rebuilt unnecessarily.
///
/// `text` and `font_size` are layout-affecting for Text nodes because they
/// change the measured (wrapped) height returned by the Taffy measure function.
fn layout_props_changed(new: &NodeProps, old: &NodeProps) -> bool {
    new.width            != old.width
    || new.height        != old.height
    || new.flex          != old.flex
    || new.flex_direction   != old.flex_direction
    || new.justify_content  != old.justify_content
    || new.align_items      != old.align_items
    || new.padding          != old.padding
    || new.gap              != old.gap
    || new.text             != old.text
    || new.font_size        != old.font_size
}

fn apply_scene_commands(state: &mut AppState, commands: Vec<SceneCommand>) -> bool {
    if commands.is_empty() {
        return false;
    }
    let mut layout_changed = false;
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
                layout_changed = true;
            }
            SceneCommand::AppendChild { parent_id, child_id } => {
                if let Some(parent) = state.js_nodes.get_mut(&parent_id) {
                    if !parent.children.contains(&child_id) {
                        parent.children.push(child_id);
                    }
                }
                layout_changed = true;
            }
            SceneCommand::UpdateNode { id, props } => {
                if let Some(node) = state.js_nodes.get_mut(&id) {
                    // Detect layout-affecting changes *before* overwriting.
                    // React's commitUpdate always sends the complete current prop
                    // set, so comparing old vs new is reliable.
                    if layout_props_changed(&props, &node.props) {
                        layout_changed = true;
                    }
                    // Replace the entire props struct — React provides the full
                    // current state, so None means "this prop was removed".
                    node.props = props;
                }
            }
            SceneCommand::RemoveNode { id } => {
                state.js_nodes.remove(&id);
                layout_changed = true;
            }
            SceneCommand::SetRoot { id } => {
                state.js_root = Some(id);
                layout_changed = true;
            }
        }
    }
    if layout_changed {
        state.layout_dirty = true;
    }
    true
}

/// Re-run Taffy and update the runtime layout cache.
///
/// Uses `compute_with_measure` so Text nodes with no explicit `height` prop
/// have their natural wrapped height computed by Parley via the measure
/// closure.  The closure captures `&mut text_sys` (a different field from
/// `layout` — Rust's split-borrow allows this).
fn recompute_layout(state: &mut AppState) {
    if !state.layout_dirty { return; }
    log::info!("Layout dirty, recomputing...");
    let Some(root_id) = state.js_root else {
        log::warn!("No JS root, skipping layout");
        return;
    };
    rebuild_layout_from_scene(&mut state.layout, &mut state.js_nodes, root_id);

    let w = state.gpu.width()  as f32;
    let h = state.gpu.height() as f32;

    // Split-borrow: layout and text_sys are separate AppState fields.
    // The measure closure captures text_sys; compute_with_measure borrows layout.
    let layout   = &mut state.layout;
    let text_sys = &mut state.text_sys;

    let result = layout.compute_with_measure(w, h, |known_dims, available, _id, ctx, _style| {
        use taffy::prelude::{AvailableSpace, Size};

        let Some(ctx) = ctx else {
            // Non-text leaf (e.g. an empty View) — Taffy uses style dimensions.
            return Size::ZERO;
        };

        // Use the available width from Taffy's flex pass when width is not
        // fixed in the style.  Fall back to MAX so Parley doesn't wrap.
        let max_w = known_dims.width.unwrap_or_else(|| match available.width {
            AvailableSpace::Definite(w) => w,
            _                          => f32::MAX,
        });

        let (tw, th) = text_sys.measure(&ctx.text, ctx.font_size, max_w);

        Size {
            // Respect explicit width from style; otherwise use shaped width.
            width:  known_dims.width.unwrap_or(tw),
            // Respect explicit height from style; otherwise use shaped (wrapped) height.
            height: known_dims.height.unwrap_or(th),
        }
    });

    match result {
        Ok(r) => {
            log::info!("Layout computed: {} nodes", r.len());
            state.resolved = r;
            // Push raw absolute positions into the JS layout cache.
            // update_scroll_positions() overwrites these with scroll-adjusted
            // values immediately after recompute_layout returns.
            for (js_id, node) in &state.js_nodes {
                if let Some(lid) = node.layout_id {
                    if let Some((_, rl)) = state.resolved.iter().find(|(nid, _)| *nid == lid) {
                        state.runtime.update_layout(*js_id, rl.x, rl.y, rl.width, rl.height);
                    }
                }
            }
        }
        Err(e) => log::error!("Layout error: {}", e),
    }
    state.layout_dirty = false;
}

// ── Scroll-adjusted layout cache (Week 15A) ───────────────────────────────────

/// Walk the JS tree and write scroll-adjusted Y values into the layout cache.
///
/// `recompute_layout` stores raw absolute Taffy positions.  A Pressable inside
/// a ScrollView appears at a *different* visual Y when scrolled, so hit-testing
/// via `__velox_getLayout` would miss unless we correct the cached Y.
///
/// This function mirrors the scroll accumulation and clamping logic in
/// `render_subtree` so the cached positions exactly match what's drawn.
/// It runs every frame (not just when layout is dirty) because scroll state
/// changes as a visual-only prop update.
fn update_scroll_positions(state: &AppState) {
    if let Some(root_id) = state.js_root {
        let mut cache = state.runtime.layout_cache.lock().unwrap();
        scroll_walk(root_id, &state.js_nodes, &state.resolved, 0.0, &mut cache);
    }
}

fn scroll_walk(
    id:       u32,
    nodes:    &std::collections::HashMap<u32, JsNode>,
    resolved: &[(NodeId, ResolvedLayout)],
    scroll_y: f64,
    cache:    &mut std::collections::HashMap<u32, [f32; 4]>,
) {
    let Some(node)      = nodes.get(&id)                                      else { return };
    let Some(layout_id) = node.layout_id                                      else { return };
    let Some((_, rl))   = resolved.iter().find(|(nid, _)| *nid == layout_id) else { return };

    // Store the scroll-adjusted Y — this is what the cursor hit-tests against.
    cache.insert(id, [rl.x, (rl.y as f64 - scroll_y) as f32, rl.width, rl.height]);

    let is_clip = node.props.clip.unwrap_or(false);

    // Mirror the same clamping logic as render_subtree so the stored positions
    // match the visual positions exactly.
    let child_scroll_y = {
        let raw = scroll_y + node.props.scroll_offset_y.unwrap_or(0.0) as f64;
        if is_clip {
            let rh = rl.height as f64;
            let max_child_bottom = node.children.iter()
                .filter_map(|&cid| {
                    let cn   = nodes.get(&cid)?;
                    let clid = cn.layout_id?;
                    resolved.iter()
                        .find(|(nid, _)| *nid == clid)
                        .map(|(_, crl)| (crl.y + crl.height) as f64)
                })
                .fold(f64::NEG_INFINITY, f64::max);

            if max_child_bottom.is_finite() {
                let pad   = node.props.padding.unwrap_or(0.0) as f64;
                let max_s = (max_child_bottom + pad - (rl.y as f64 + rh)).max(0.0);
                raw.min(max_s).max(0.0)
            } else {
                raw.max(0.0)
            }
        } else {
            raw
        }
    };

    let children: Vec<u32> = node.children.clone();
    for child_id in children {
        scroll_walk(child_id, nodes, resolved, child_scroll_y, cache);
    }
}

// ── Recursive renderer ────────────────────────────────────────────────────────

/// Render one node and all its descendants.
///
/// `scroll_y` is the cumulative vertical scroll offset in pixels that has
/// been applied by ancestor ScrollView nodes.  It shifts each node's
/// rendered position upward relative to its Taffy-computed layout position,
/// producing a scroll effect.
///
/// When a node has `clip: true`, a Vello clip layer is pushed around the
/// children's rendering so they cannot bleed outside this node's bounds.
fn render_subtree(
    id: u32,
    nodes: &std::collections::HashMap<u32, JsNode>,
    resolved: &[(NodeId, ResolvedLayout)],
    frame: &mut FrameBuilder,
    text_sys: &mut TextSystem,
    label_cache: &mut std::collections::HashMap<LabelKey, CachedLabel>,
    cursor_blink_on: bool,
    scroll_y: f64,
    any_cursor_active: &mut bool,
) {
    let Some(node)      = nodes.get(&id)                                     else { return };
    let Some(layout_id) = node.layout_id                                     else { return };
    let Some((_, rl))   = resolved.iter().find(|(nid, _)| *nid == layout_id) else { return };

    // Apply the accumulated scroll offset from ancestor ScrollViews.
    let rx = rl.x as f64;
    let ry = rl.y as f64 - scroll_y;
    let rw = rl.width  as f64;
    let rh = rl.height as f64;

    match node.node_type {
        NodeType::View => {
            let bg     = node.props.background_color
                .map(rgba_to_vello)
                .unwrap_or(colors::BRAND_GREEN);
            let radius = node.props.border_radius.unwrap_or(0.0) as f64;

            frame.fill_rounded_rect(rx, ry, rw, rh, radius, bg);

            // Optional border stroke drawn on top of fill.
            if let Some(bw) = node.props.border_width {
                let bc = node.props.border_color.unwrap_or([80, 80, 120, 255]);
                frame.stroke_rounded_rect(rx, ry, rw, rh, radius, bw as f64, rgba_to_vello(bc));
            }

            // ScrollView clip: push a Vello layer that clips children to the
            // node's visual bounds, then shift their positions by scroll_offset_y.
            let is_clip = node.props.clip.unwrap_or(false);

            // Compute the effective child scroll, clamped so no child can
            // scroll above the clip's top edge or below the clip's bottom.
            //
            // For clip nodes we compute the max scroll from the actual
            // Taffy-resolved child extents — this is the definitive ground
            // truth regardless of what the JS side sent.  The JS side sends
            // a JS-computed cap via `scrollOffsetY`, but the Rust clamp here
            // ensures the last item never disappears even if that cap is stale.
            let child_scroll_y = {
                let raw = scroll_y + node.props.scroll_offset_y.unwrap_or(0.0) as f64;
                if is_clip {
                    // Bottom of the furthest-down direct child (absolute coords).
                    let max_child_bottom = node.children.iter()
                        .filter_map(|&cid| {
                            let cn   = nodes.get(&cid)?;
                            let clid = cn.layout_id?;
                            resolved.iter()
                                .find(|(nid, _)| *nid == clid)
                                .map(|(_, crl)| (crl.y + crl.height) as f64)
                        })
                        .fold(f64::NEG_INFINITY, f64::max);

                    if max_child_bottom.is_finite() {
                        // Add trailing padding so the last item doesn't flush
                        // against the clip edge when fully scrolled.
                        let pad   = node.props.padding.unwrap_or(0.0) as f64;
                        let max_s = (max_child_bottom + pad - (rl.y as f64 + rh)).max(0.0);
                        raw.min(max_s).max(0.0)
                    } else {
                        raw.max(0.0)
                    }
                } else {
                    raw
                }
            };

            if is_clip {
                frame.push_layer(rx, ry, rw, rh);
            }

            // Clone children ids so we can release the node borrow before
            // recursing (multiple immutable borrows of `nodes` are fine,
            // but being explicit avoids future confusion).
            let children: Vec<u32> = node.children.clone();
            for child_id in children {
                render_subtree(
                    child_id, nodes, resolved, frame,
                    text_sys, label_cache,
                    cursor_blink_on, child_scroll_y, any_cursor_active,
                );
            }

            if is_clip {
                frame.pop_layer();
            }
        }

        NodeType::Text => {
            let text       = node.props.text.as_deref().unwrap_or("Text");
            let font_size  = node.props.font_size.unwrap_or(16.0);
            let color      = node.props.color.unwrap_or([255, 255, 255, 255]);
            let max_width  = rw.max(1.0) as f32;
            let left_align = node.props.text_align.as_deref() == Some("left");
            let show_cursor = node.props.show_cursor.unwrap_or(false);

            // ── Text shaping cache ─────────────────────────────────────────────
            let key: LabelKey = (
                text.to_owned(),
                font_size.to_bits(),
                max_width.to_bits(),
                color,
            );
            if !label_cache.contains_key(&key) {
                let lbl = CachedLabel::new(text_sys, text, font_size, max_width, color);
                label_cache.insert(key.clone(), lbl);
            }
            let label = label_cache.get(&key).unwrap();

            // Compute draw origin with scroll offset applied.
            let bw = rw;
            let bh = rh;
            let tx = if left_align {
                rx
            } else {
                rx + (bw - label.width).max(0.0) / 2.0
            };
            // Vertical placement:
            //   auto-sized box  (bh ≈ text_height) → top-align so all wrapped
            //                   lines stay inside the box.
            //   fixed-size box  (bh > text_height)  → center using ascent so a
            //                   single-line label sits visually centred.
            let ty = if bh <= label.text_height + 2.0 {
                ry  // top-align: box was sized by the measure function
            } else {
                ry + (bh - label.ascent).max(0.0) / 2.0  // center in larger box
            };

            frame.draw_text(&label.layout, tx, ty, rgba_to_vello(color));

            // Copy metrics before label borrow ends (NLL).
            let (lw, la) = (label.width, label.ascent);

            // Text cursor: a thin rect drawn after the text when focused.
            if show_cursor {
                *any_cursor_active = true;
                if cursor_blink_on {
                    frame.fill_rounded_rect(tx + lw + 2.0, ty, 2.0, la, 0.0, rgba_to_vello(color));
                }
            }
        }
    }
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
                    render_subtree(
                        root_id,
                        &s.js_nodes,
                        &s.resolved,
                        &mut frame,
                        &mut s.text_sys,
                        &mut s.label_cache,
                        s.cursor_blink_on,
                        0.0,
                        &mut any_cursor_active,
                    );
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
