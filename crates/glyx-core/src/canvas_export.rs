//! Canvas image export: a canvas's drawing as a PNG.
//!
//! JavaScript asks with `__glyx_canvas_export` (`SceneCommand::CanvasExport`); this renders the canvas's command
//! list into an offscreen pixmap and answers with a `canvasExport` input event carrying the PNG as base64. The
//! render uses the CPU rasterizer whatever the window's renderer is, so it works on every backend, costs no GPU
//! memory and leaves the window's frame alone; it runs on the render thread and takes a few milliseconds for a
//! typical canvas (a large export takes longer: that is why the size is capped).

use base64::Engine as _;
use glyx_renderer::{peniko, AnyFrame, TinySkiaRenderer};
use glyx_renderer::kurbo::Affine;
use glyx_runtime::bindings::InputEvent;
use crate::state::PerWindowState;
use crate::NodeType;

/// Most pixels an export may have (about 8192 x 4096): the pixmap is four bytes each, plus the PNG.
pub(crate) const MAX_EXPORT_PIXELS: u64 = 32 * 1024 * 1024;

/// The pixel size of an export: `width` x `height` when both are given, else the canvas's size times `scale`
/// (1 when it is not a positive number). `Err` for no size, or one over [`MAX_EXPORT_PIXELS`].
pub(crate) fn export_size(width: u32, height: u32, scale: f32, canvas: Option<(f32, f32)>) -> Result<(u32, u32), String> {
    let (w, h) = if width > 0 && height > 0 {
        (width as f64, height as f64)
    } else {
        let (cw, ch) = canvas.ok_or("the canvas has no size yet: give a width and height, or export after it has been laid out")?;
        let s = if scale.is_finite() && scale > 0.0 { scale as f64 } else { 1.0 };
        ((cw as f64 * s).round(), (ch as f64 * s).round())
    };
    if w < 1.0 || h < 1.0 { return Err("the canvas is empty".into()); }
    if (w as u64).saturating_mul(h as u64) > MAX_EXPORT_PIXELS {
        return Err(format!("{}x{} is over the {} megapixel limit", w as u64, h as u64, MAX_EXPORT_PIXELS / (1024 * 1024)));
    }
    Ok((w as u32, h as u32))
}

/// Premultiplied RGBA to straight (what PNG stores), in place.
fn unpremultiply(px: &mut [u8]) {
    for p in px.chunks_exact_mut(4) {
        let a = p[3] as u32;
        if a == 0 || a == 255 { continue; }
        for c in &mut p[..3] { *c = ((*c as u32 * 255 + a / 2) / a).min(255) as u8; }
    }
}

/// Most pixels of a raw (RGBA) export: four bytes each, sent as base64 text.
pub(crate) const MAX_RAW_PIXELS: u64 = 4 * 1024 * 1024;

/// Renders canvas `id` and answers request `req_id`: a PNG, or with `raw` the straight RGBA bytes, of the whole
/// canvas or of `region` (`[x, y, w, h]` in output pixels, ignored when its width or height is 0).
pub(crate) fn handle(state: &mut PerWindowState, id: u32, req_id: u32, width: u32, height: u32, scale: f32, region: [u32; 4], raw: bool) {
    let result = render_export(state, id, width, height, scale, region, raw);
    let ev = match result {
        Ok(bytes) => InputEvent::CanvasExport { req_id, data: base64::engine::general_purpose::STANDARD.encode(bytes), error: String::new() },
        Err(error) => InputEvent::CanvasExport { req_id, data: String::new(), error },
    };
    state.runtime.push_event(ev);
}

/// Draws `cmds` into a `w` x `h` pixmap under `base` (a scale for a bigger or smaller copy, a translation to show one
/// region), over `background` if it has one, and returns it as straight (not premultiplied) RGBA8: what a PNG stores.
/// Uses the CPU rasterizer.
pub(crate) fn render_rgba(
    cmds: &[glyx_runtime::bindings::CanvasCmd],
    images: &std::collections::HashMap<u32, peniko::ImageData>,
    text_sys: &mut glyx_text::TextSystem,
    labels: &mut crate::label_cache::LabelCache,
    w: u32, h: u32, base: Affine, background: Option<[u8; 4]>,
) -> Vec<u8> {
    let mut rgba = render_premul(cmds, images, text_sys, labels, w, h, base, background);
    unpremultiply(&mut rgba);
    rgba
}

/// `render_rgba` before the last step: the pixels as the rasterizer holds them (premultiplied), which is what a cached canvas
/// is blitted from.
pub(crate) fn render_premul(
    cmds: &[glyx_runtime::bindings::CanvasCmd],
    images: &std::collections::HashMap<u32, peniko::ImageData>,
    text_sys: &mut glyx_text::TextSystem,
    labels: &mut crate::label_cache::LabelCache,
    w: u32, h: u32, base: Affine, background: Option<[u8; 4]>,
) -> Vec<u8> {
    let mut renderer = TinySkiaRenderer::new_cpu_only(w, h);
    renderer.background_color = peniko::Color::from_rgba8(0, 0, 0, 0);
    let mut frame = AnyFrame::TinySkia(renderer.begin_frame());
    if let Some(bg) = background {
        frame.fill_rect(0.0, 0.0, w as f64, h as f64, peniko::Color::from_rgba8(bg[0], bg[1], bg[2], bg[3]));
    }
    crate::canvas_paint::Painter::new(&mut frame, text_sys, labels, images, (0.0, 0.0), 1.0)
        .erasing_to(background)
        .with_base(base)
        .paint_all(cmds);
    let AnyFrame::TinySkia(f) = frame else { unreachable!("built as tiny-skia above") };
    let mut rgba = Vec::new();
    renderer.finish_frame_soft(f, |px, _, _, _| rgba = px.to_vec());
    rgba
}

fn render_export(state: &mut PerWindowState, id: u32, width: u32, height: u32, scale: f32, region: [u32; 4], raw: bool) -> Result<Vec<u8>, String> {
    let node = state.js_nodes.get(&id).ok_or("no such canvas")?;
    if !matches!(node.node_type, NodeType::Canvas) { return Err("that node is not a Canvas".into()); }
    let layout = node.layout_id.and_then(|l| state.resolved_by_id.get(&l)).map(|r| (r.width, r.height));
    let (w, h) = export_size(width, height, scale, layout)?;
    // What the Canvas node paints under its commands.
    let background = node.props.background_color;
    // A given size shows the same drawing scaled to fit it; otherwise `scale`.
    let k = match (width > 0 && height > 0, layout) {
        (true, Some((cw, ch))) if cw > 0.0 && ch > 0.0 => (w as f64 / cw as f64).min(h as f64 / ch as f64),
        (true, _) => 1.0,
        _ => if scale.is_finite() && scale > 0.0 { scale as f64 } else { 1.0 },
    };

    // One region of the canvas, or all of it.
    let (ow, oh, base) = if region[2] > 0 && region[3] > 0 {
        (region[2], region[3], Affine::translate((-(region[0] as f64), -(region[1] as f64))) * Affine::scale(k))
    } else {
        (w, h, Affine::scale(k))
    };
    let limit = if raw { MAX_RAW_PIXELS } else { MAX_EXPORT_PIXELS };
    if (ow as u64).saturating_mul(oh as u64) > limit {
        return Err(format!("{ow}x{oh} is over the {} megapixel limit", limit / (1024 * 1024)));
    }
    let rgba = match state.canvas_cmds.get(&id) {
        Some(cmds) => render_rgba(cmds, &state.images, &mut state.text_sys, &mut state.label_cache, ow, oh, base, background),
        None => render_rgba(&[], &state.images, &mut state.text_sys, &mut state.label_cache, ow, oh, base, background),
    };
    if raw { return Ok(rgba); }
    let img = image::RgbaImage::from_raw(ow, oh, rgba).ok_or("could not build the image")?;
    let mut out = Vec::new();
    img.write_to(&mut std::io::Cursor::new(&mut out), image::ImageFormat::Png).map_err(|e| format!("PNG encoding failed: {e}"))?;
    Ok(out)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_size_is_given_or_the_canvas_times_the_scale_and_is_capped() {
        assert_eq!(export_size(300, 200, 5.0, Some((10.0, 10.0))), Ok((300, 200)), "an explicit size wins");
        assert_eq!(export_size(0, 0, 2.0, Some((100.0, 50.0))), Ok((200, 100)));
        assert_eq!(export_size(0, 0, 0.0, Some((100.0, 50.0))), Ok((100, 50)), "no usable scale means 1");
        assert_eq!(export_size(0, 0, f32::NAN, Some((100.0, 50.0))), Ok((100, 50)));
        assert!(export_size(0, 0, 1.0, None).is_err(), "not laid out yet");
        assert!(export_size(0, 0, 1.0, Some((0.0, 50.0))).is_err(), "an empty canvas");
        assert!(export_size(20_000, 20_000, 1.0, None).unwrap_err().contains("megapixel"));
        assert!(export_size(8192, 4096, 1.0, None).is_ok(), "exactly the limit is fine");
    }

    /// How many pixels of the rendering are visibly painted (alpha over half).
    fn painted(rgba: &[u8]) -> usize { rgba.chunks_exact(4).filter(|p| p[3] > 127).count() }

    fn render(cmds: &[glyx_runtime::bindings::CanvasCmd], w: u32, h: u32, k: f64) -> Vec<u8> {
        let mut ts = glyx_text::TextSystem::new();
        let mut labels = crate::label_cache::LabelCache::new(Some(64));
        render_rgba(cmds, &std::collections::HashMap::new(), &mut ts, &mut labels, w, h, Affine::scale(k), None)
    }

    #[test]
    fn everything_scales_with_the_export_circles_strokes_and_the_canvas_transform() {
        use glyx_runtime::bindings::CanvasCmd::*;
        let red = [255, 0, 0, 255];
        let circle = [FillCircle { cx: 20.0, cy: 20.0, r: 10.0, color: red }];
        let line = [StrokeLine { x0: 4.0, y0: 20.0, x1: 36.0, y1: 20.0, color: red, line_width: 4.0 }];
        // A transform in the list scales along with the export too.
        let moved = [Transform { m: [2.0, 0.0, 0.0, 2.0, 0.0, 0.0] }, FillCircle { cx: 10.0, cy: 10.0, r: 5.0, color: red }];
        for (name, cmds) in [("circle", &circle[..]), ("line", &line[..]), ("scaled circle", &moved[..])] {
            let one = painted(&render(cmds, 40, 40, 1.0));
            let two = painted(&render(cmds, 80, 80, 2.0));
            assert!(one > 40, "{name} drew something at 1x: {one}");
            let ratio = two as f64 / one as f64;
            assert!((ratio - 4.0).abs() < 0.25, "{name}: twice as big is four times the pixels, got {ratio} ({one} -> {two})");
        }
        // And the circle covers about what its radius says (pi r^2 = 314).
        let area = painted(&render(&circle, 40, 40, 1.0));
        assert!((area as f64 - 314.0).abs() < 25.0, "{area}");
    }

    #[test]
    fn a_transparent_canvas_exports_transparent_pixels_and_a_background_fills_them() {
        let clear = render(&[], 8, 8, 1.0);
        assert_eq!(painted(&clear), 0);
        let mut ts = glyx_text::TextSystem::new();
        let mut labels = crate::label_cache::LabelCache::new(Some(64));
        let filled = render_rgba(&[], &std::collections::HashMap::new(), &mut ts, &mut labels, 8, 8, Affine::IDENTITY, Some([10, 20, 30, 255]));
        assert_eq!(&filled[0..4], &[10, 20, 30, 255]);
        assert_eq!(painted(&filled), 64);
    }

    #[test]
    fn erasing_cuts_a_hole_in_a_transparent_export_and_paints_the_background_when_there_is_one() {
        use glyx_runtime::bindings::{blend_mode, CanvasCmd::*};
        let cmds = [
            FillRect { x: 0.0, y: 0.0, w: 40.0, h: 40.0, color: [255, 0, 0, 255] },
            Blend { mode: blend_mode::DESTINATION_OUT },
            FillCircle { cx: 20.0, cy: 20.0, r: 8.0, color: [0, 0, 0, 255] },
        ];
        let centre = |px: &[u8]| { let i = (20 * 40 + 20) * 4; [px[i], px[i + 1], px[i + 2], px[i + 3]] };
        // No background: a real hole.
        assert_eq!(centre(&render(&cmds, 40, 40, 1.0))[3], 0);
        // With one: the hole shows it.
        let mut ts = glyx_text::TextSystem::new();
        let mut labels = crate::label_cache::LabelCache::new(Some(64));
        let with_bg = render_rgba(&cmds, &std::collections::HashMap::new(), &mut ts, &mut labels, 40, 40, Affine::IDENTITY, Some([9, 8, 7, 255]));
        assert_eq!(centre(&with_bg), [9, 8, 7, 255]);
    }

    #[test]
    fn unpremultiplying_restores_straight_colour_and_leaves_opaque_and_clear_pixels_alone() {
        let mut px = [128, 64, 0, 128,   10, 20, 30, 255,   0, 0, 0, 0];
        unpremultiply(&mut px);
        assert_eq!(&px[0..4], &[255, 128, 0, 128], "64 * 255 / 128 = 127.5 rounds up");
        assert_eq!(&px[4..8], &[10, 20, 30, 255]);
        assert_eq!(&px[8..12], &[0, 0, 0, 0]);
    }
}
