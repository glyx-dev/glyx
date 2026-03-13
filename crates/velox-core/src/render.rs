use super::*;

pub(crate) struct RenderCtx<'a> {
    pub nodes: &'a std::collections::HashMap<u32, JsNode>,
    pub images: &'a std::collections::HashMap<u32, peniko::Image>,
    pub resolved: &'a [(NodeId, ResolvedLayout)],
    pub frame: &'a mut FrameBuilder,
    pub text_sys: &'a mut TextSystem,
    pub label_cache: &'a mut std::collections::HashMap<LabelKey, CachedLabel>,
    pub cursor_blink_on: bool,
    pub any_cursor_active: &'a mut bool,
}

pub(crate) fn render_subtree(id: u32, scroll_y: f64, ctx: &mut RenderCtx<'_>) {
    let Some(node)      = ctx.nodes.get(&id)                                        else { return };
    let Some(layout_id) = node.layout_id                                             else { return };
    let Some((_, rl))   = ctx.resolved.iter().find(|(nid, _)| *nid == layout_id) else { return };

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

            ctx.frame.fill_rounded_rect(rx, ry, rw, rh, radius, bg);

            if let Some(bw) = node.props.border_width {
                let bc = node.props.border_color.unwrap_or([80, 80, 120, 255]);
                ctx.frame.stroke_rounded_rect(rx, ry, rw, rh, radius, bw as f64, rgba_to_vello(bc));
            }

            let is_clip = node.props.clip.unwrap_or(false);

            let child_scroll_y = {
                let raw = scroll_y + node.props.scroll_offset_y.unwrap_or(0.0) as f64;
                if is_clip {
                    let max_child_bottom = node.children.iter()
                        .filter_map(|&cid| {
                            let cn   = ctx.nodes.get(&cid)?;
                            let clid = cn.layout_id?;
                            ctx.resolved.iter()
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

            if is_clip {
                ctx.frame.push_layer(rx, ry, rw, rh);
            }

            let children: Vec<u32> = node.children.clone();
            for child_id in children {
                render_subtree(child_id, child_scroll_y, ctx);
            }

            if is_clip {
                ctx.frame.pop_layer();
            }
        }

        NodeType::Image => {
            let radius = node.props.border_radius.unwrap_or(0.0) as f64;
            let resize_mode = node.props.image_resize_mode.as_deref().unwrap_or("stretch");
            if let Some(image_id) = node.props.image_id {
                if let Some(image) = ctx.images.get(&image_id) {
                    let iw = image.width as f64;
                    let ih = image.height as f64;
                    let (dx, dy, dw, dh) = match resize_mode {
                        "contain" => {
                            let s = (rw / iw).min(rh / ih);
                            let dw = iw * s;
                            let dh = ih * s;
                            let dx = rx + (rw - dw) * 0.5;
                            let dy = ry + (rh - dh) * 0.5;
                            (dx, dy, dw, dh)
                        }
                        "cover" => {
                            let s = (rw / iw).max(rh / ih);
                            let dw = iw * s;
                            let dh = ih * s;
                            let dx = rx + (rw - dw) * 0.5;
                            let dy = ry + (rh - dh) * 0.5;
                            (dx, dy, dw, dh)
                        }
                        _ => (rx, ry, rw, rh),
                    };

                    let needs_clip = resize_mode == "cover" || radius > 0.0;
                    if needs_clip {
                        if radius > 0.0 {
                            ctx.frame.push_rounded_layer(rx, ry, rw, rh, radius);
                        } else {
                            ctx.frame.push_layer(rx, ry, rw, rh);
                        }
                    }

                    ctx.frame.draw_image(image, dx, dy, dw, dh);

                    if needs_clip {
                        ctx.frame.pop_layer();
                    }

                    if let Some(bw) = node.props.border_width {
                        let bc = node.props.border_color.unwrap_or([80, 80, 120, 255]);
                        ctx.frame.stroke_rounded_rect(rx, ry, rw, rh, radius, bw as f64, rgba_to_vello(bc));
                    }
                } else {
                    ctx.frame.fill_rounded_rect(rx, ry, rw, rh, 0.0, colors::TEXT_MUTED);
                }
            } else {
                ctx.frame.fill_rounded_rect(rx, ry, rw, rh, 0.0, colors::TEXT_MUTED);
            }
        }

        NodeType::Text => {
            let text       = node.props.text.as_deref().unwrap_or("Text");
            let font_size  = node.props.font_size.unwrap_or(16.0);
            let color      = node.props.color.unwrap_or([255, 255, 255, 255]);
            let max_width  = rw.max(1.0) as f32;
            let left_align = node.props.text_align.as_deref() == Some("left");
            let show_cursor = node.props.show_cursor.unwrap_or(false);

            let key: LabelKey = (
                text.to_owned(),
                font_size.to_bits(),
                max_width.to_bits(),
                color,
            );
            if !ctx.label_cache.contains_key(&key) {
                let lbl = CachedLabel::new(ctx.text_sys, text, font_size, max_width, color);
                ctx.label_cache.insert(key.clone(), lbl);
            }
            let label = ctx.label_cache.get(&key).unwrap();

            let bw = rw;
            let bh = rh;
            let tx = if left_align {
                rx
            } else {
                rx + (bw - label.width).max(0.0) / 2.0
            };
            let ty = if bh <= label.text_height + 2.0 {
                ry
            } else {
                ry + (bh - label.ascent).max(0.0) / 2.0
            };

            ctx.frame.draw_text(&label.layout, tx, ty, rgba_to_vello(color));

            let (lw, la) = (label.width, label.ascent);

            if show_cursor {
                *ctx.any_cursor_active = true;
                if ctx.cursor_blink_on {
                    ctx.frame.fill_rounded_rect(tx + lw + 2.0, ty, 2.0, la, 0.0, rgba_to_vello(color));
                }
            }
        }
    }
}
