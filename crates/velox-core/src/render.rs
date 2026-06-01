use super::*;

pub(crate) struct RenderCtx<'a> {
    pub nodes: &'a std::collections::HashMap<u32, JsNode>,
    pub images: &'a std::collections::HashMap<u32, peniko::Image>,
    pub resolved: &'a [(NodeId, ResolvedLayout)],
    pub frame: &'a mut FrameBuilder,
    pub text_sys: &'a mut TextSystem,
    pub label_cache: &'a mut lru::LruCache<LabelKey, CachedLabel>,
    pub canvas_cmds: &'a std::collections::HashMap<u32, Vec<CanvasCmd>>,
    /// Accumulated (canvas3d_id, x, y, w, h) for post-Vello 3D overlay rendering.
    pub canvas3d_overlays: &'a mut Vec<(u32, f32, f32, f32, f32)>,
    /// Live camera streams — read-only; latest_image drawn directly via Vello.
    pub camera_streams: &'a std::collections::HashMap<u32, CameraStream>,
    /// Video playback streams — read-only; latest_image drawn directly via Vello.
    pub video_streams: &'a std::collections::HashMap<u32, VideoStream>,
    pub cursor_blink_on: bool,
    pub any_cursor_active: &'a mut bool,
}

fn apply_opacity(c: peniko::Color, opacity: f32) -> peniko::Color {
    if opacity >= 1.0 { c } else { c.multiply_alpha(opacity) }
}

/// Parse a hex colour string (`#RGB`, `#RRGGBB`, `#RRGGBBAA`) into RGBA bytes.
fn hex_color(s: &str) -> Option<[u8; 4]> {
    let h = s.strip_prefix('#')?;
    let (r, g, b, a) = match h.len() {
        3 => (u8::from_str_radix(&h[0..1], 16).ok()? * 17,
              u8::from_str_radix(&h[1..2], 16).ok()? * 17,
              u8::from_str_radix(&h[2..3], 16).ok()? * 17, 255),
        6 => (u8::from_str_radix(&h[0..2], 16).ok()?,
              u8::from_str_radix(&h[2..4], 16).ok()?,
              u8::from_str_radix(&h[4..6], 16).ok()?, 255),
        8 => (u8::from_str_radix(&h[0..2], 16).ok()?,
              u8::from_str_radix(&h[2..4], 16).ok()?,
              u8::from_str_radix(&h[4..6], 16).ok()?,
              u8::from_str_radix(&h[6..8], 16).ok()?),
        _ => return None,
    };
    Some([r, g, b, a])
}

fn parse_box_shadow(s: &str) -> Option<(f64, f64, peniko::Color)> {
    let parts: Vec<&str> = s.split_whitespace().collect();
    if parts.len() < 4 { return None; }
    let dx    = parts[0].parse::<f64>().ok()?;
    let dy    = parts[1].parse::<f64>().ok()?;
    let color = hex_color(parts[3])?;
    Some((dx, dy, rgba_to_vello(color)))
}

fn parse_gradient(s: &str) -> Option<(peniko::Color, peniko::Color)> {
    let parts: Vec<&str> = s.split_whitespace().collect();
    if parts.len() < 2 { return None; }
    let c1 = hex_color(parts[0])?;
    let c2 = hex_color(parts[1])?;
    Some((rgba_to_vello(c1), rgba_to_vello(c2)))
}

pub(crate) fn render_subtree(id: u32, scroll_y: f64, opacity: f32, ctx: &mut RenderCtx<'_>) {
    let Some(node)      = ctx.nodes.get(&id)                                        else { return };
    // Hidden nodes and their entire subtree are invisible — skip rendering.
    if node.props.hidden.unwrap_or(false) { return; }
    let Some(layout_id) = node.layout_id                                             else { return };
    let Some((_, rl))   = ctx.resolved.iter().find(|(nid, _)| *nid == layout_id) else { return };

    let rx = rl.x as f64;
    let ry = rl.y as f64 - scroll_y;
    let rw = rl.width  as f64;
    let rh = rl.height as f64;

    let child_opacity = opacity * node.props.opacity.unwrap_or(1.0);

    match node.node_type {
        NodeType::View => {
            let radius = node.props.border_radius.unwrap_or(0.0) as f64;

            // ── Box shadow ────────────────────────────────────────────────
            if let Some(ref ss) = node.props.box_shadow {
                if let Some((sx, sy, sc)) = parse_box_shadow(ss) {
                    ctx.frame.fill_rounded_rect(
                        rx + sx, ry + sy, rw, rh, radius,
                        apply_opacity(sc, child_opacity),
                    );
                }
            }

            // ── Background (gradient takes precedence over solid) ─────────
            if let Some(ref gs) = node.props.background_gradient {
                if let Some((c1, c2)) = parse_gradient(gs) {
                    let gradient = peniko::Gradient::new_linear(
                        velox_renderer::peniko::kurbo::Point::new(rx, ry),
                        velox_renderer::peniko::kurbo::Point::new(rx, ry + rh),
                    )
                    .with_stops([
                        peniko::ColorStop { offset: 0.0, color: apply_opacity(c1, child_opacity) },
                        peniko::ColorStop { offset: 1.0, color: apply_opacity(c2, child_opacity) },
                    ]);
                    let brush = peniko::Brush::Gradient(gradient);
                    ctx.frame.fill_rounded_rect_with_brush(rx, ry, rw, rh, radius, &brush);
                }
            } else if let Some(bg) = node.props.background_color.map(|c| apply_opacity(rgba_to_vello(c), child_opacity)) {
                ctx.frame.fill_rounded_rect(rx, ry, rw, rh, radius, bg);
            }

            // ── Border ────────────────────────────────────────────────────
            if let Some(bw) = node.props.border_width {
                let bc = node.props.border_color.unwrap_or([80, 80, 120, 255]);
                ctx.frame.stroke_rounded_rect(rx, ry, rw, rh, radius, bw as f64, apply_opacity(rgba_to_vello(bc), child_opacity));
            }

            let overflows = matches!(node.props.overflow.as_deref(), Some("hidden" | "scroll"));
            let is_clip = node.props.clip.unwrap_or(false) || overflows;

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
                        let pad   = match node.props.padding { Some(LengthValue::Px(px)) => px as f64, _ => 0.0 };
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

            // Sort children by z_index (stable — preserves document order for ties).
            let mut children: Vec<u32> = node.children.to_vec();
            children.sort_by_key(|&cid| {
                ctx.nodes.get(&cid).and_then(|n| n.props.z_index).unwrap_or(0)
            });
            for child_id in children {
                render_subtree(child_id, child_scroll_y, child_opacity, ctx);
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
                        ctx.frame.stroke_rounded_rect(rx, ry, rw, rh, radius, bw as f64, apply_opacity(rgba_to_vello(bc), child_opacity));
                    }
                } else {
                    ctx.frame.fill_rounded_rect(rx, ry, rw, rh, 0.0, apply_opacity(colors::TEXT_MUTED, child_opacity));
                }
            } else {
                ctx.frame.fill_rounded_rect(rx, ry, rw, rh, 0.0, apply_opacity(colors::TEXT_MUTED, child_opacity));
            }
        }

        NodeType::Text => {
            let text       = node.props.text.as_deref().unwrap_or("Text");
            let font_size  = node.props.font_size.unwrap_or(16.0);
            let color      = node.props.color.unwrap_or([255, 255, 255, 255]);
            let max_width  = rw.max(1.0) as f32;
            let left_align = node.props.text_align.as_deref() == Some("left");
            let show_cursor     = node.props.show_cursor.unwrap_or(false);
            let cursor_position = node.props.cursor_position.map(|p| p as usize);
            let selection_start = node.props.selection_start.map(|p| p as usize);
            let selection_end   = node.props.selection_end.map(|p| p as usize);

            // LabelKey::new() is allocation-free (hashes text, packs fields).
            // Derive it twice instead of cloning — cheaper than a String clone.
            if ctx.label_cache.peek(&LabelKey::new(text, font_size, max_width, color)).is_none() {
                let lbl = CachedLabel::new(ctx.text_sys, text, font_size, max_width, color);
                ctx.label_cache.put(LabelKey::new(text, font_size, max_width, color), lbl);
            }
            let label = ctx.label_cache.get(&LabelKey::new(text, font_size, max_width, color)).unwrap();

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

            let label_width = label.width;
            // Cursor/selection positioned using font metrics (not the line-box)
            // so they align with visible glyph strokes rather than floating above
            // them due to Parley's line leading.
            let cur_top    = ty + label.cursor_top;
            let cur_height = label.cursor_height;

            // 1. Selection highlight — drawn before text so text renders on top.
            if let (Some(ss), Some(se)) = (selection_start, selection_end) {
                if ss < se {
                    let char_count = text.chars().count();
                    let x0 = ctx.text_sys.measure_to_cursor(
                        text, font_size, max_width, ss.min(char_count),
                    ) as f64;
                    let x1 = ctx.text_sys.measure_to_cursor(
                        text, font_size, max_width, se.min(char_count),
                    ) as f64;
                    if x1 > x0 {
                        ctx.frame.fill_rounded_rect(
                            tx + x0, cur_top, x1 - x0, cur_height, 0.0,
                            apply_opacity(peniko::Color::rgba8(100, 120, 255, 120), child_opacity),
                        );
                    }
                }
            }

            // 2. Draw shaped text.
            ctx.frame.draw_text(&label.layout, tx, ty, apply_opacity(rgba_to_vello(color), child_opacity));

            // 3. Blinking cursor line — uses same metrics as selection highlight.
            if show_cursor {
                *ctx.any_cursor_active = true;
                if ctx.cursor_blink_on {
                    let cx = if let Some(cp) = cursor_position {
                        let char_count = text.chars().count();
                        ctx.text_sys.measure_to_cursor(
                            text, font_size, max_width, cp.min(char_count),
                        ) as f64
                    } else {
                        label_width
                    };
                    ctx.frame.fill_rounded_rect(
                        tx + cx, cur_top, 2.0, cur_height, 0.0,
                        apply_opacity(rgba_to_vello(color), child_opacity),
                    );
                }
            }
        }

        NodeType::Canvas => {
            // Draw optional background.
            if let Some(bg) = node.props.background_color.map(|c| apply_opacity(rgba_to_vello(c), child_opacity)) {
                let radius = node.props.border_radius.unwrap_or(0.0) as f64;
                ctx.frame.fill_rounded_rect(rx, ry, rw, rh, radius, bg);
            }
            // Clip all canvas draw commands to the node's layout rect.
            ctx.frame.push_layer(rx, ry, rw, rh);
            if let Some(cmds) = ctx.canvas_cmds.get(&id) {
                for cmd in cmds {
                    draw_canvas_cmd(ctx.frame, cmd, rx, ry);
                }
            }
            ctx.frame.pop_layer();
        }

        NodeType::Canvas3D => {
            // Draw optional background fill in the 2D scene so the layout box is
            // visible even before the first 3D render completes.
            if let Some(bg) = node.props.background_color.map(|c| apply_opacity(rgba_to_vello(c), child_opacity)) {
                ctx.frame.fill_rect(rx, ry, rw, rh, bg);
            }
            // Register this canvas for post-Vello 3D rendering.
            ctx.canvas3d_overlays.push((id, rx as f32, ry as f32, rw as f32, rh as f32));
        }
        NodeType::Camera => {
            // Draw the latest camera frame using the same Vello image path as NodeType::Image.
            // Frames are updated each tick by the capture thread → frame_buf → peniko::Image.
            if let Some(handle_id) = node.props.camera_handle {
                if let Some(stream) = ctx.camera_streams.get(&handle_id) {
                    if let Some(img) = &stream.latest_image {
                        let mirror = node.props.mirror.unwrap_or(false);
                        let iw = img.width  as f64;
                        let ih = img.height as f64;
                        let sx = rw / iw;
                        let sy = rh / ih;
                        // Mirror: negate X scale, shift origin to right edge.
                        // Normal:    Affine [sx,  0, 0, sy, rx,    ry]
                        // Mirrored:  Affine [-sx, 0, 0, sy, rx+rw, ry]
                        let transform = if mirror {
                            velox_renderer::peniko::kurbo::Affine::new([-sx, 0.0, 0.0, sy, rx + rw, ry])
                        } else {
                            velox_renderer::peniko::kurbo::Affine::new([sx, 0.0, 0.0, sy, rx, ry])
                        };
                        ctx.frame.push_layer(rx, ry, rw, rh);
                        ctx.frame.draw_image_with_transform(img, transform);
                        ctx.frame.pop_layer();
                    } else {
                        // No frame yet — draw a placeholder background.
                        ctx.frame.fill_rect(rx, ry, rw, rh,
                            apply_opacity(peniko::Color::rgba8(0, 0, 0, 255), child_opacity));
                    }
                }
            }
        }
        NodeType::Video => {
            // Draw the latest decoded video frame. Frames are pushed by the decode thread
            // at the video's natural FPS via the velox-media DLL decoder.
            if let Some(handle_id) = node.props.video_handle {
                if let Some(stream) = ctx.video_streams.get(&handle_id) {
                    if let Some(img) = &stream.latest_image {
                        let iw = img.width  as f64;
                        let ih = img.height as f64;
                        let sx = rw / iw;
                        let sy = rh / ih;
                        let transform = velox_renderer::peniko::kurbo::Affine::new([sx, 0.0, 0.0, sy, rx, ry]);
                        ctx.frame.push_layer(rx, ry, rw, rh);
                        ctx.frame.draw_image_with_transform(img, transform);
                        ctx.frame.pop_layer();
                    } else {
                        // No frame yet — draw a black placeholder.
                        ctx.frame.fill_rect(rx, ry, rw, rh,
                            apply_opacity(peniko::Color::rgba8(0, 0, 0, 255), child_opacity));
                    }
                }
            }
        }
    }
}

fn draw_canvas_cmd(frame: &mut FrameBuilder, cmd: &CanvasCmd, ox: f64, oy: f64) {
    use CanvasCmd::*;
    match cmd {
        Clear => {
            // Clear is a no-op here — background is drawn by the Canvas node itself.
        }
        FillRect { x, y, w, h, color } => {
            frame.fill_rect(ox + *x as f64, oy + *y as f64, *w as f64, *h as f64, rgba_to_vello(*color));
        }
        StrokeRect { x, y, w, h, color, line_width } => {
            frame.stroke_rounded_rect(ox + *x as f64, oy + *y as f64, *w as f64, *h as f64, 0.0, *line_width as f64, rgba_to_vello(*color));
        }
        FillCircle { cx, cy, r, color } => {
            frame.fill_circle(ox + *cx as f64, oy + *cy as f64, *r as f64, rgba_to_vello(*color));
        }
        StrokeCircle { cx, cy, r, color, line_width } => {
            frame.stroke_circle(ox + *cx as f64, oy + *cy as f64, *r as f64, *line_width as f64, rgba_to_vello(*color));
        }
        StrokeLine { x0, y0, x1, y1, color, line_width } => {
            frame.stroke_line(ox + *x0 as f64, oy + *y0 as f64, ox + *x1 as f64, oy + *y1 as f64, *line_width as f64, rgba_to_vello(*color));
        }
        FillText { text, x, y, font_size, color } => {
            // Canvas text: draw a filled placeholder rect sized to the text.
            // Full Parley shaping requires a mutable TextSystem not available here.
            frame.fill_rect(ox + *x as f64, oy + *y as f64, *font_size as f64 * text.len() as f64 * 0.6, *font_size as f64 * 1.2, rgba_to_vello(*color));
        }
    }
}
