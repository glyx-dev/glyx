use super::*;
use smallvec::SmallVec;
use taffy::prelude::*;
use taffy::{GridTemplateRepetition, MinMax};

pub(super) fn to_taffy_style(node_type: &NodeType, props: &NodeProps) -> taffy::prelude::Style {
    use taffy::prelude::*;

    // Helpers to convert our LengthValue → Taffy types.
    let to_dim = |v: LengthValue| -> Dimension {
        match v {
            LengthValue::Px(px)    => Dimension::length(px),
            LengthValue::Percent(p) => Dimension::percent(p),
        }
    };
    let to_lp = |v: LengthValue| -> LengthPercentage {
        match v {
            LengthValue::Px(px)    => LengthPercentage::length(px),
            LengthValue::Percent(p) => LengthPercentage::percent(p),
        }
    };
    let to_lpa = |v: LengthValue| -> LengthPercentageAuto {
        match v {
            LengthValue::Px(px)    => LengthPercentageAuto::length(px),
            LengthValue::Percent(p) => LengthPercentageAuto::percent(p),
        }
    };

    match node_type {
        // RepaintBoundary is a transparent container — same flex/grid layout as View.
        NodeType::View | NodeType::RepaintBoundary => {
            let display = match props.display.as_deref() {
                Some("grid") => Display::Grid,
                Some("none") => Display::None,
                _            => Display::Flex,
            };
            let mut style = Style {
                display,
                flex_direction: match props.flex_direction.as_deref() {
                    Some("row")            => FlexDirection::Row,
                    Some("row-reverse")    => FlexDirection::RowReverse,
                    Some("column-reverse") => FlexDirection::ColumnReverse,
                    _                      => FlexDirection::Column,
                },
                justify_content: match props.justify_content.as_deref() {
                    Some("flex-start")    => Some(JustifyContent::FlexStart),
                    Some("flex-end")      => Some(JustifyContent::FlexEnd),
                    Some("center")        => Some(JustifyContent::Center),
                    Some("space-between") => Some(JustifyContent::SpaceBetween),
                    Some("space-around")  => Some(JustifyContent::SpaceAround),
                    Some("space-evenly")  => Some(JustifyContent::SpaceEvenly),
                    _                     => Some(JustifyContent::FlexStart),  // CSS default
                },
                align_items: match props.align_items.as_deref() {
                    Some("flex-start") => Some(AlignItems::FlexStart),
                    Some("flex-end")   => Some(AlignItems::FlexEnd),
                    Some("center")     => Some(AlignItems::Center),
                    Some("stretch")    => Some(AlignItems::Stretch),
                    Some("baseline")   => Some(AlignItems::Baseline),
                    _                  => Some(AlignItems::Stretch),  // CSS default
                },
                ..Default::default()
            };

            if let Some(bs) = props.box_sizing.as_deref() {
                style.box_sizing = match bs {
                    "border-box" => BoxSizing::BorderBox,
                    _            => BoxSizing::ContentBox,
                };
            }

            if let Some(w) = props.width  { style.size.width  = to_dim(w); }
            if let Some(h) = props.height { style.size.height = to_dim(h); }

            // ── Margin ────────────────────────────────────────────────────
            // Precedence: per-side > horizontal/vertical shorthand > uniform.
            // Default is 0 (CSS default). NOTE: do NOT default to `auto` — auto
            // margins absorb flex free space and override the parent's
            // justifyContent/alignItems, which silently breaks centering of
            // child Views (checkbox indicators, switch knobs, etc.).
            let m  = props.margin;
            let mh = props.margin_horizontal;
            let mv = props.margin_vertical;
            let zero_a = LengthPercentageAuto::length(0.0);
            style.margin = Rect {
                left:   props.margin_left.or(mh).or(m).map_or(zero_a, to_lpa),
                right:  props.margin_right.or(mh).or(m).map_or(zero_a, to_lpa),
                top:    props.margin_top.or(mv).or(m).map_or(zero_a, to_lpa),
                bottom: props.margin_bottom.or(mv).or(m).map_or(zero_a, to_lpa),
            };

            // ── Padding ───────────────────────────────────────────────────
            // Precedence: per-side > horizontal/vertical shorthand > uniform.
            let p  = props.padding;
            let ph = props.padding_horizontal;
            let pv = props.padding_vertical;
            let zero_p = LengthPercentage::length(0.0);
            style.padding = Rect {
                left:   props.padding_left.or(ph).or(p).map_or(zero_p, to_lp),
                right:  props.padding_right.or(ph).or(p).map_or(zero_p, to_lp),
                top:    props.padding_top.or(pv).or(p).map_or(zero_p, to_lp),
                bottom: props.padding_bottom.or(pv).or(p).map_or(zero_p, to_lp),
            };

            // ── Min / max dimensions ──────────────────────────────────────
            if let Some(v) = props.min_width  { style.min_size.width  = to_dim(v); }
            if let Some(v) = props.min_height { style.min_size.height = to_dim(v); }
            if let Some(v) = props.max_width  { style.max_size.width  = to_dim(v); }
            if let Some(v) = props.max_height { style.max_size.height = to_dim(v); }

            // ── Overflow ──────────────────────────────────────────────────
            // Clip containers (ScrollView sets clip:true) must use
            // Overflow::Hidden, not Clip: Taffy only zeroes the automatic
            // min-content size for Hidden/Scroll.  With Visible/Clip a flex:1
            // ScrollView can never shrink below its content, blowing the
            // whole flex chain past the window (no overflow → no scrolling).
            let clips = props.clip.unwrap_or(false)
                || matches!(props.overflow.as_deref(), Some("hidden") | Some("scroll"));
            let ov = if clips { taffy::style::Overflow::Hidden } else { taffy::style::Overflow::Visible };
            style.overflow = taffy::geometry::Point { x: ov, y: ov };

            if let Some(g) = props.gap {
                let d = to_lp(g);
                style.gap = Size { width: d, height: d };
            }

            if let Some(f) = props.flex {
                // React Native semantics: `flex: N` = grow N, shrink 1, basis 0,
                // and NO automatic minimum size (Yoga has no CSS auto-min rule).
                // Without this, a flex:1 chain containing a tall ScrollView can
                // never shrink below its content and overflows the window.
                style.flex_grow   = f;
                style.flex_shrink = 1.0;
                style.flex_basis  = Dimension::length(0.0);
                if props.min_width.is_none()  { style.min_size.width  = Dimension::length(0.0); }
                if props.min_height.is_none() { style.min_size.height = Dimension::length(0.0); }
            }

            // ── Flex item overrides ───────────────────────────────────────
            if let Some(g) = props.flex_grow   { style.flex_grow   = g; }
            if let Some(s) = props.flex_shrink { style.flex_shrink = s; }
            if let Some(b) = props.flex_basis  { style.flex_basis  = to_dim(b); }

            style.flex_wrap = match props.flex_wrap.as_deref() {
                Some("wrap")         => FlexWrap::Wrap,
                Some("wrap-reverse") => FlexWrap::WrapReverse,
                _                    => FlexWrap::NoWrap,
            };

            // ── Item-level alignment overrides ────────────────────────────
            let parse_align_self = |s: &str| -> AlignSelf {
                match s {
                    "flex-start" => AlignSelf::FlexStart,
                    "flex-end"   => AlignSelf::FlexEnd,
                    "center"     => AlignSelf::Center,
                    "baseline"   => AlignSelf::Baseline,
                    "stretch"    => AlignSelf::Stretch,
                    _            => AlignSelf::Start,
                }
            };
            if let Some(a) = props.align_self.as_deref() {
                style.align_self = Some(parse_align_self(a));
            }
            if let Some(a) = props.align_content.as_deref() {
                style.align_content = Some(match a {
                    "flex-start"     => AlignContent::FlexStart,
                    "flex-end"       => AlignContent::FlexEnd,
                    "center"         => AlignContent::Center,
                    "space-between"  => AlignContent::SpaceBetween,
                    "space-around"   => AlignContent::SpaceAround,
                    "space-evenly"   => AlignContent::SpaceEvenly,
                    "stretch"        => AlignContent::Stretch,
                    _                => AlignContent::Start,
                });
            }
            // justify-self and justify-items are grid-only in Taffy —
            // still set them so they work when grid is enabled.
            if let Some(a) = props.justify_self.as_deref() {
                style.justify_self = Some(parse_align_self(a));
            }
            if let Some(a) = props.justify_items.as_deref() {
                let v = match a {
                    "flex-start" => AlignItems::FlexStart,
                    "flex-end"   => AlignItems::FlexEnd,
                    "center"     => AlignItems::Center,
                    "baseline"   => AlignItems::Baseline,
                    "stretch"    => AlignItems::Stretch,
                    _            => AlignItems::Start,
                };
                style.justify_items = Some(v);
            }

            // ── Position (absolute/relative) ──────────────────────────────
            style.position = match props.position.as_deref() {
                Some("absolute") => Position::Absolute,
                _                => Position::Relative,
            };

            // ── Inset (top/left/right/bottom) ────────────────────────────
            style.inset = Rect {
                top:    props.top.map_or(LengthPercentageAuto::auto(), to_lpa),
                left:   props.left.map_or(LengthPercentageAuto::auto(), to_lpa),
                right:  props.right.map_or(LengthPercentageAuto::auto(), to_lpa),
                bottom: props.bottom.map_or(LengthPercentageAuto::auto(), to_lpa),
            };

            // ── CSS Grid ────────────────────────────────────────────
            if display == Display::Grid {
                if let Some(s) = props.grid_template_columns.as_deref() {
                    if let Some(tracks) = parse_grid_template_string(s) {
                        style.grid_template_columns = tracks;
                    }
                }
                if let Some(s) = props.grid_template_rows.as_deref() {
                    if let Some(tracks) = parse_grid_template_string(s) {
                        style.grid_template_rows = tracks;
                    }
                }
                // CSS Grid default: items fill their grid area. Only apply when
                // the user hasn't set an explicit `justify_items` prop.
                if props.justify_items.is_none() {
                    style.justify_items = Some(AlignItems::Stretch);
                }
            }
            // Child grid placement — set on any View (only takes effect inside a grid parent).
            if let Some(s) = props.grid_column.as_deref() {
                style.grid_column = parse_grid_placement_line(s);
            }
            if let Some(s) = props.grid_row.as_deref() {
                style.grid_row = parse_grid_placement_line(s);
            }

            style
        }
        NodeType::Text | NodeType::Image | NodeType::Canvas | NodeType::Canvas3D | NodeType::Camera | NodeType::Video | NodeType::WebView => {
            let mut style = taffy::prelude::Style::default();
            if let Some(w) = props.width  { style.size.width  = to_dim(w); }
            if let Some(h) = props.height { style.size.height = to_dim(h); }

            // ── Flex participation (Text/Image as flex items) ─────────────
            // Allows `flex: 1` and `flexShrink` on Text nodes in row/column
            // containers, matching CSS where inline content participates in flex.
            if let Some(f) = props.flex        { style.flex_grow   = f; }
            if let Some(g) = props.flex_grow   { style.flex_grow   = g; }
            if let Some(s) = props.flex_shrink { style.flex_shrink = s; }
            if let Some(b) = props.flex_basis  { style.flex_basis  = to_dim(b); }
            if let Some(s) = props.align_self.as_deref() {
                style.align_self = match s {
                    "flex-start" => Some(AlignSelf::FlexStart),
                    "flex-end"   => Some(AlignSelf::FlexEnd),
                    "center"     => Some(AlignSelf::Center),
                    "stretch"    => Some(AlignSelf::Stretch),
                    _            => None,
                };
            }

            // ── Margin ────────────────────────────────────────────────────
            // Text/Image/etc. default to zero margin — `margin: auto` on a leaf
            // node absorbs flex space and breaks parent `alignItems: center`.
            let m  = props.margin;
            let mh = props.margin_horizontal;
            let mv = props.margin_vertical;
            let zero = LengthPercentageAuto::length(0.0);
            style.margin = Rect {
                left:   props.margin_left.or(mh).or(m).map_or(zero, to_lpa),
                right:  props.margin_right.or(mh).or(m).map_or(zero, to_lpa),
                top:    props.margin_top.or(mv).or(m).map_or(zero, to_lpa),
                bottom: props.margin_bottom.or(mv).or(m).map_or(zero, to_lpa),
            };

            // ── Position (absolute/relative) ──────────────────────────────
            style.position = match props.position.as_deref() {
                Some("absolute") => Position::Absolute,
                _                => Position::Relative,
            };
            // ── Inset (top/left/right/bottom) ────────────────────────────
            style.inset = Rect {
                top:    props.top.map_or(LengthPercentageAuto::auto(), to_lpa),
                left:   props.left.map_or(LengthPercentageAuto::auto(), to_lpa),
                right:  props.right.map_or(LengthPercentageAuto::auto(), to_lpa),
                bottom: props.bottom.map_or(LengthPercentageAuto::auto(), to_lpa),
            };

            style
        }
    }
}

pub(crate) fn rebuild_layout_from_scene(
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
            (node.node_type.clone(), node.props.clone(),
             node.children.iter().copied().collect::<SmallVec<[u32; 4]>>())
        };
        let style = to_taffy_style(&node_type, &props);

        let mut child_ids = Vec::new();
        for child in children {
            if let Some(cid) = build_subtree(layout, nodes, child) {
                child_ids.push(cid);
            }
        }

        let layout_id = if !child_ids.is_empty() {
            layout.add_container(style, &child_ids, Some(format!("js-{}", id))).ok()?
        } else {
            match node_type {
                NodeType::Text => {
                    let font_size = props.font_size.unwrap_or(16.0);
                    // ~1.4× font-size is a reliable approximation of Parley's
                    // line height for the default font (matches browser 1.2–1.5 range).
                    let max_height = props.number_of_lines
                        .map(|n| n as f32 * font_size * 1.4);
                    let ctx = TextMeasureCtx {
                        text: props.text.clone().unwrap_or_default(),
                        font_size,
                        max_height,
                        bold:   props.font_weight.as_deref() == Some("bold"),
                        italic: props.font_style.as_deref()  == Some("italic"),
                    };
                    layout.add_text_node(style, ctx, Some(format!("js-{}", id))).ok()?
                }
                NodeType::View | NodeType::Image | NodeType::Canvas | NodeType::Canvas3D | NodeType::Camera | NodeType::Video | NodeType::RepaintBoundary | NodeType::WebView => {
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
        // Root wrapper: stretch children to fill the full window width.
        // flex_column uses align_items:center which shrinks app to content width.
        let root_style = {
            let mut s = flex_column(0.0);
            s.align_items = Some(AlignItems::Stretch);
            s.justify_content = Some(JustifyContent::FlexStart);
            s
        };
        if let Ok(wrapper_id) = layout
            .add_container(root_style, &[content_root], Some("js-root".into()))
        {
            layout.set_root(wrapper_id);
        }
    }
}

pub(crate) fn layout_props_changed(new: &NodeProps, old: &NodeProps) -> bool {
    new.width  != old.width || new.height != old.height ||
    new.flex   != old.flex || new.flex_direction != old.flex_direction ||
    new.justify_content != old.justify_content ||
    new.align_items != old.align_items ||
    new.padding != old.padding || new.padding_left != old.padding_left ||
    new.padding_right != old.padding_right || new.padding_top != old.padding_top ||
    new.padding_bottom != old.padding_bottom ||
    new.gap != old.gap ||
    new.text != old.text || new.font_size != old.font_size || new.number_of_lines != old.number_of_lines ||
    new.margin != old.margin || new.margin_left != old.margin_left ||
    new.margin_right != old.margin_right || new.margin_top != old.margin_top ||
    new.margin_bottom != old.margin_bottom ||
    new.min_width != old.min_width || new.min_height != old.min_height ||
    new.max_width != old.max_width || new.max_height != old.max_height ||
    new.overflow != old.overflow ||
    new.flex_grow != old.flex_grow || new.flex_shrink != old.flex_shrink ||
    new.flex_basis != old.flex_basis || new.flex_wrap != old.flex_wrap ||
    new.align_self != old.align_self || new.align_content != old.align_content ||
    new.justify_self != old.justify_self || new.justify_items != old.justify_items ||
    new.display != old.display ||
    new.grid_template_columns != old.grid_template_columns ||
    new.grid_template_rows != old.grid_template_rows ||
    new.grid_column != old.grid_column ||
    new.grid_row != old.grid_row ||
    new.position != old.position ||
    new.top != old.top || new.left != old.left ||
    new.right != old.right || new.bottom != old.bottom ||
    new.box_sizing != old.box_sizing
}

pub(crate) fn recompute_layout(state: &mut PerWindowState) {
    if !state.layout_dirty { return; }
    let Some(root_id) = state.js_root else { return };

    if state.layout_structure_dirty {
        // Tree structure changed (nodes added/removed/reparented) — full rebuild.
        rebuild_layout_from_scene(&mut state.layout, &mut state.js_nodes, root_id);
        state.layout_structure_dirty = false;
    }
    // else: incremental path — set_style + mark_dirty already applied per-node in
    // apply_scene_commands; Taffy skips clean subtrees automatically.

    let w = state.gpu.width()  as f32;
    let h = state.gpu.height() as f32;

    // Framework guarantee: the layout root is always exactly the GPU viewport size.
    // This prevents child views from ever overflowing the window, even during the
    // one frame between a window resize and React re-rendering with new winW/winH.
    //
    // IMPORTANT: clamp BOTH the tree root and the js_root's own layout node —
    // they are different nodes (the tree root is a synthetic wrapper).  Clamping
    // only the wrapper lets the js_root grow to content height (auto sizing),
    // which silently breaks every flex:1 chain below it: ScrollViews size to
    // their content, never overflow, and scrolling/scrollbars are dead.
    let js_root_lid = state.js_root
        .and_then(|rid| state.js_nodes.get(&rid))
        .and_then(|n| n.layout_id);
    for lid in [state.layout.root(), js_root_lid].into_iter().flatten() {
        if let Ok(style) = state.layout.get_style(lid) {
            let need_w = Dimension::length(w);
            let need_h = Dimension::length(h);
            if style.size.width != need_w || style.size.height != need_h {
                let mut s = style;
                s.size.width  = need_w;
                s.size.height = need_h;
                let _ = state.layout.set_style(lid, s);
                let _ = state.layout.mark_dirty(lid);
            }
        }
    }

    let layout   = &mut state.layout;
    let text_sys = &mut state.text_sys;

    let result = layout.compute_with_measure(w, h, |known_dims, available, _id, ctx, _style| {
        use taffy::prelude::{AvailableSpace, Size};

        let Some(ctx) = ctx else {
            return Size::ZERO;
        };

        // CSS-like intrinsic sizing so Text auto-fits without an explicit width:
        //   Definite   → wrap to that width
        //   MaxContent → single line (natural width)
        //   MinContent → longest word (fully wrapped)  [max_width≈0 forces this]
        let max_w = match known_dims.width {
            Some(w) => w,
            None => match available.width {
                AvailableSpace::Definite(w) => w,
                AvailableSpace::MaxContent  => f32::MAX,
                AvailableSpace::MinContent  => 0.0,
            },
        };

        let (tw, th) = text_sys.measure_styled(&ctx.text, ctx.font_size, max_w, ctx.bold, ctx.italic);
        let th = if let Some(max_h) = ctx.max_height { th.min(max_h) } else { th };

        Size {
            width:  known_dims.width.unwrap_or(tw),
            height: known_dims.height.unwrap_or(th),
        }
    });

    match result {
        Ok(r) => {
            log::debug!("Layout computed: {} nodes", r.len());
            state.resolved = r;
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

pub(crate) fn update_scroll_positions(state: &PerWindowState) {
    if let Some(root_id) = state.js_root {
        let layout_cache = state.runtime.layout_cache();
        let mut cache = layout_cache.lock();
        scroll_walk(root_id, &state.js_nodes, &state.resolved, 0.0, None, &mut cache);
    }
}

/// [x, y, width, height] in screen space of the nearest clipping ancestor.
type ClipRect = Option<[f32; 4]>;

/// High-bit key marker: `id | CONTENT_HEIGHT_KEY` stores `[0,0,0,content_h]`
/// for clip (scroll) nodes.  Node ids are a small counter, so the high bit
/// never collides with a real id.
pub(crate) const CONTENT_HEIGHT_KEY: u32 = 0x8000_0000;

fn scroll_walk(
    id:        u32,
    nodes:     &std::collections::HashMap<u32, JsNode>,
    resolved:  &[(NodeId, ResolvedLayout)],
    scroll_y:  f64,
    clip_rect: ClipRect,
    cache:     &mut std::collections::HashMap<u32, [f32; 4]>,
) {
    let Some(node)      = nodes.get(&id)                                      else { return };
    let Some(layout_id) = node.layout_id                                      else { return };
    let Some((_, rl))   = resolved.iter().find(|(nid, _)| *nid == layout_id) else { return };

    // Hidden nodes are invisible to both rendering and hit-testing.
    // Mark them off-screen and skip layout-cache updates for their subtree
    // (children are also hidden).
    if node.props.hidden.unwrap_or(false) {
        cache.insert(id, [-9999.0, -9999.0, 0.0, 0.0]);
        let child_ids: SmallVec<[u32; 4]> = node.children.iter().copied().collect();
        for child_id in child_ids {
            scroll_walk(child_id, nodes, resolved, scroll_y, clip_rect, cache);
        }
        return;
    }

    let visible_x = rl.x;
    let visible_y = (rl.y as f64 - scroll_y) as f32;

    // If this node is inside a clipping ancestor, check whether it is at least
    // partially within the clip bounds.  A node that is fully outside the clip
    // window is invisible — write impossible coords so hit-testing misses it.
    if let Some([cx, cy, cw, ch]) = clip_rect {
        let node_bottom = visible_y + rl.height;
        let node_right  = visible_x + rl.width;
        if node_bottom <= cy || visible_y >= cy + ch
            || node_right <= cx || visible_x >= cx + cw
        {
            cache.insert(id, [-9999.0, -9999.0, 0.0, 0.0]);
            // Still recurse so children that might themselves be clipped containers
            // also get their cache entries invalidated.
            let child_ids: SmallVec<[u32; 4]> = node.children.iter().copied().collect();
            for child_id in child_ids {
                scroll_walk(child_id, nodes, resolved, scroll_y, clip_rect, cache);
            }
            return;
        }
    }

    // Store the rect INTERSECTED with the clip ancestor: a node half-scrolled
    // out of a ScrollView must only be hit-testable where it is actually
    // visible — otherwise scrolled content invisibly covers fixed chrome
    // (headers, tab bars) and steals its clicks.
    if let Some([cx, cy, cw, ch]) = clip_rect {
        let ix = visible_x.max(cx);
        let iy = visible_y.max(cy);
        let iw = (visible_x + rl.width).min(cx + cw) - ix;
        let ih = (visible_y + rl.height).min(cy + ch) - iy;
        cache.insert(id, [ix, iy, iw.max(0.0), ih.max(0.0)]);
    } else {
        cache.insert(id, [visible_x, visible_y, rl.width, rl.height]);
    }

    let overflows = matches!(node.props.overflow.as_deref(), Some("hidden" | "scroll"));
    let is_clip = node.props.clip.unwrap_or(false) || overflows;

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
                let pad   = match node.props.padding { Some(LengthValue::Px(px)) => px as f64, _ => 0.0 };
                // Publish the measured content height under the high-bit key so
                // __glyx_getLayout can report it as `contentHeight` — JS ScrollView
                // uses it to clamp wheel/scrollbar scrolling to real content.
                let content_h = (max_child_bottom + pad - rl.y as f64).max(0.0) as f32;
                cache.insert(id | CONTENT_HEIGHT_KEY, [0.0, 0.0, 0.0, content_h]);
                let max_s = (max_child_bottom + pad - (rl.y as f64 + rh)).max(0.0);
                raw.min(max_s).max(0.0)
            } else {
                raw.max(0.0)
            }
        } else {
            raw
        }
    };

    // If this node is a clip container, its screen-space rect becomes the active
    // clip rect for all descendants.  Use visible_y (not rl.y) because an outer
    // scroll may already have shifted this container on screen.
    let child_clip = if is_clip {
        Some([visible_x, visible_y, rl.width, rl.height])
    } else {
        clip_rect
    };

    let child_ids: SmallVec<[u32; 4]> = node.children.iter().copied().collect();
    for child_id in child_ids {
        scroll_walk(child_id, nodes, resolved, child_scroll_y, child_clip, cache);
    }
}

// ── CSS Grid string-parsing helpers ─────────────────────────────────────

/// Tokenize a grid template string, respecting `repeat(...)` as a single token.
fn tokenize_template(s: &str) -> Vec<String> {
    let mut tokens = Vec::new();
    let mut current = String::new();
    let mut depth = 0i32;
    for c in s.chars() {
        match c {
            '(' => { depth += 1; current.push(c); }
            ')' => { depth -= 1; current.push(c); }
            c if c.is_whitespace() && depth == 0 => {
                if !current.is_empty() {
                    tokens.push(current.clone());
                    current.clear();
                }
            }
            c => { current.push(c); }
        }
    }
    if !current.is_empty() {
        tokens.push(current);
    }
    tokens
}

/// Parse a single non-repeated track value (`"1fr"`, `"100px"`, `"50%"`, etc.)
fn parse_non_repeated_track(s: &str) -> Option<TrackSizingFunction> {
    let s = s.trim();
    if let Some(n) = s.strip_suffix("fr") {
        let flex: f32 = n.trim().parse().ok()?;
        return Some(MinMax {
            min: MinTrackSizingFunction::AUTO,
            max: MaxTrackSizingFunction::from_fr(flex),
        });
    }
    if let Some(n) = s.strip_suffix("px") {
        let v: f32 = n.trim().parse().ok()?;
        return Some(MinMax { min: MinTrackSizingFunction::length(v), max: MaxTrackSizingFunction::length(v) });
    }
    if let Some(p) = s.strip_suffix('%') {
        let v: f32 = p.trim().parse().ok()?;
        return Some(MinMax { min: MinTrackSizingFunction::percent(v / 100.0), max: MaxTrackSizingFunction::percent(v / 100.0) });
    }
    match s {
        "min-content" => Some(MinMax { min: MinTrackSizingFunction::MIN_CONTENT, max: MaxTrackSizingFunction::MIN_CONTENT }),
        "max-content" => Some(MinMax { min: MinTrackSizingFunction::MAX_CONTENT, max: MaxTrackSizingFunction::MAX_CONTENT }),
        "auto" => Some(MinMax { min: MinTrackSizingFunction::AUTO, max: MaxTrackSizingFunction::AUTO }),
        _ => None,
    }
}

/// Parse a `minmax(a, b)` expression.
fn parse_minmax(s: &str) -> Option<TrackSizingFunction> {
    let inner = s.strip_prefix("minmax(")?.strip_suffix(')')?;
    let (a, b) = inner.split_once(',')?;
    let min = parse_min_track(a.trim());
    let max = parse_max_track(b.trim());
    match (min, max) {
        (Some(min), Some(max)) => Some(MinMax { min, max }),
        _ => None,
    }
}

fn parse_min_track(s: &str) -> Option<MinTrackSizingFunction> {
    let s = s.trim();
    if let Some(n) = s.strip_suffix("px") {
        let v: f32 = n.parse().ok()?;
        return Some(MinTrackSizingFunction::length(v));
    }
    if let Some(p) = s.strip_suffix('%') {
        let v: f32 = p.parse().ok()?;
        return Some(MinTrackSizingFunction::percent(v / 100.0));
    }
    match s {
        "min-content" => Some(MinTrackSizingFunction::MIN_CONTENT),
        "max-content" => Some(MinTrackSizingFunction::MAX_CONTENT),
        "auto" => Some(MinTrackSizingFunction::AUTO),
        _ => None,
    }
}

fn parse_max_track(s: &str) -> Option<MaxTrackSizingFunction> {
    let s = s.trim();
    if let Some(n) = s.strip_suffix("fr") {
        let flex: f32 = n.parse().ok()?;
        return Some(MaxTrackSizingFunction::from_fr(flex));
    }
    if let Some(n) = s.strip_suffix("px") {
        let v: f32 = n.parse().ok()?;
        return Some(MaxTrackSizingFunction::length(v));
    }
    if let Some(p) = s.strip_suffix('%') {
        let v: f32 = p.parse().ok()?;
        return Some(MaxTrackSizingFunction::percent(v / 100.0));
    }
    match s {
        "min-content" => Some(MaxTrackSizingFunction::MIN_CONTENT),
        "max-content" => Some(MaxTrackSizingFunction::MAX_CONTENT),
        "auto" => Some(MaxTrackSizingFunction::AUTO),
        _ => None,
    }
}

/// Parse a `repeat(N, ...)` expression.
fn parse_repeat(s: &str) -> Option<GridTemplateComponent<String>> {
    let inner = s.strip_prefix("repeat(")?.strip_suffix(')')?;
    let (count_str, rest) = inner.split_once(',')?;
    let count_str = count_str.trim();
    let count = match count_str {
        "auto-fill" => RepetitionCount::AutoFill,
        "auto-fit"  => RepetitionCount::AutoFit,
        _           => RepetitionCount::Count(count_str.parse().ok()?),
    };
    let mut tracks = Vec::new();
    for tok in tokenize_template(rest) {
        if let Some(t) = parse_non_repeated_track(&tok) {
            tracks.push(t);
        }
    }
    if tracks.is_empty() { return None; }
    Some(GridTemplateComponent::Repeat(GridTemplateRepetition { count, tracks, line_names: vec![] }))
}

/// Parse a `gridTemplateColumns` or `gridTemplateRows` string into `Vec<GridTemplateComponent>`.
fn parse_grid_template_string(s: &str) -> Option<Vec<GridTemplateComponent<String>>> {
    let mut result = Vec::new();
    for token in tokenize_template(s) {
        if token.starts_with("repeat(") {
            if let Some(t) = parse_repeat(&token) {
                result.push(t);
            }
        } else if token.starts_with("minmax(") {
            if let Some(t) = parse_minmax(&token) {
                result.push(GridTemplateComponent::Single(t));
            }
        } else if let Some(t) = parse_non_repeated_track(&token) {
            result.push(GridTemplateComponent::Single(t));
        }
    }
    if result.is_empty() { None } else { Some(result) }
}

/// Parse a `gridColumn` or `gridRow` string like `"1 / -1"`, `"span 2"`, `"auto"` into `Line<GridPlacement>`.
fn parse_grid_placement_line(s: &str) -> Line<GridPlacement> {
    let s = s.trim();
    if let Some((start, end)) = s.split_once('/') {
        Line {
            start: parse_single_placement(start.trim()),
            end: parse_single_placement(end.trim()),
        }
    } else {
        let p = parse_single_placement(s);
        Line { start: p, end: GridPlacement::Auto }
    }
}

fn parse_single_placement(s: &str) -> GridPlacement {
    let s = s.trim();
    if s == "auto" { return GridPlacement::Auto; }
    if let Some(n) = s.strip_prefix("span ") {
        if let Ok(span) = n.trim().parse::<u16>() {
            return GridPlacement::Span(span);
        }
    }
    // Try as a raw line index (positive or negative).
    if let Ok(n) = s.parse::<i16>() {
        return GridPlacement::from_line_index(n);
    }
    GridPlacement::Auto
}
