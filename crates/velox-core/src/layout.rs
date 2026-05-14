use super::*;

fn to_taffy_style(node_type: &NodeType, props: &NodeProps) -> taffy::prelude::Style {
    use taffy::prelude::*;

    match node_type {
        NodeType::View => {
            let mut style = Style {
                display: Display::Flex,
                flex_direction: match props.flex_direction.as_deref() {
                    Some("row")            => FlexDirection::Row,
                    Some("row-reverse")    => FlexDirection::RowReverse,
                    Some("column-reverse") => FlexDirection::ColumnReverse,
                    _                      => FlexDirection::Column,
                },
                justify_content: match props.justify_content.as_deref() {
                    Some("flex-start")    => Some(JustifyContent::FlexStart),
                    Some("flex-end")      => Some(JustifyContent::FlexEnd),
                    Some("space-between") => Some(JustifyContent::SpaceBetween),
                    Some("space-around")  => Some(JustifyContent::SpaceAround),
                    Some("space-evenly")  => Some(JustifyContent::SpaceEvenly),
                    _                     => Some(JustifyContent::Center),
                },
                align_items: match props.align_items.as_deref() {
                    Some("flex-start") => Some(AlignItems::FlexStart),
                    Some("flex-end")   => Some(AlignItems::FlexEnd),
                    Some("stretch")    => Some(AlignItems::Stretch),
                    Some("baseline")   => Some(AlignItems::Baseline),
                    _                  => Some(AlignItems::Center),
                },
                ..Default::default()
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
        NodeType::Text | NodeType::Image => {
            let mut style = taffy::prelude::Style::default();
            if let Some(w) = props.width  { style.size.width  = length(w); }
            if let Some(h) = props.height { style.size.height = length(h); }
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
            layout.add_container(style, &child_ids, Some(format!("js-{}", id))).ok()?
        } else {
            match node_type {
                NodeType::Text => {
                    let ctx = TextMeasureCtx {
                        text:      props.text.clone().unwrap_or_default(),
                        font_size: props.font_size.unwrap_or(16.0),
                    };
                    layout.add_text_node(style, ctx, Some(format!("js-{}", id))).ok()?
                }
                NodeType::View | NodeType::Image => {
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
        if let Ok(wrapper_id) = layout
            .add_container(flex_column(0.0), &[content_root], Some("js-root".into()))
        {
            layout.set_root(wrapper_id);
        }
    }
}

pub(crate) fn layout_props_changed(new: &NodeProps, old: &NodeProps) -> bool {
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

pub(crate) fn recompute_layout(state: &mut PerWindowState) {
    if !state.layout_dirty { return; }
    log::info!("Layout dirty, recomputing...");
    let Some(root_id) = state.js_root else {
        log::warn!("No JS root, skipping layout");
        return;
    };
    rebuild_layout_from_scene(&mut state.layout, &mut state.js_nodes, root_id);

    let w = state.gpu.width()  as f32;
    let h = state.gpu.height() as f32;

    let layout   = &mut state.layout;
    let text_sys = &mut state.text_sys;

    let result = layout.compute_with_measure(w, h, |known_dims, available, _id, ctx, _style| {
        use taffy::prelude::{AvailableSpace, Size};

        let Some(ctx) = ctx else {
            return Size::ZERO;
        };

        let max_w = known_dims.width.unwrap_or(match available.width {
            AvailableSpace::Definite(w) => w,
            _                          => f32::MAX,
        });

        let (tw, th) = text_sys.measure(&ctx.text, ctx.font_size, max_w);

        Size {
            width:  known_dims.width.unwrap_or(tw),
            height: known_dims.height.unwrap_or(th),
        }
    });

    match result {
        Ok(r) => {
            log::info!("Layout computed: {} nodes", r.len());
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
        let mut cache = state.runtime.layout_cache.lock().unwrap();
        scroll_walk(root_id, &state.js_nodes, &state.resolved, 0.0, None, &mut cache);
    }
}

/// [x, y, width, height] in screen space of the nearest clipping ancestor.
type ClipRect = Option<[f32; 4]>;

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
            let children: Vec<u32> = node.children.clone();
            for child_id in children {
                scroll_walk(child_id, nodes, resolved, scroll_y, clip_rect, cache);
            }
            return;
        }
    }

    cache.insert(id, [visible_x, visible_y, rl.width, rl.height]);

    let is_clip = node.props.clip.unwrap_or(false);

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

    // If this node is a clip container, its screen-space rect becomes the active
    // clip rect for all descendants.  Use visible_y (not rl.y) because an outer
    // scroll may already have shifted this container on screen.
    let child_clip = if is_clip {
        Some([visible_x, visible_y, rl.width, rl.height])
    } else {
        clip_rect
    };

    let children: Vec<u32> = node.children.clone();
    for child_id in children {
        scroll_walk(child_id, nodes, resolved, child_scroll_y, child_clip, cache);
    }
}
