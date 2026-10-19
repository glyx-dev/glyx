//! Text as filled outlines, for text that is rotated or skewed.
//!
//! The CPU renderer draws text from cached glyph bitmaps and Direct2D from its own text path; neither can turn
//! a glyph. When a canvas rotates its text, the glyphs are drawn as what they are, closed outlines, flattened to
//! polygons and filled with the multi-contour fill every backend has (`AnyFrame::fill_contours`), so it looks the
//! same on all of them. Upright text keeps its fast cached path; only rotated text pays for this.

use std::cell::RefCell;
use swash::scale::ScaleContext;
use swash::zeno::Verb;
use vello::kurbo::{self, Affine, BezPath, PathEl};

/// How closely a flattened curve follows the glyph's outline, in pixels.
const TOLERANCE_PX: f64 = 0.08;

thread_local! {
    // Building a scale context allocates; rotated text is drawn on one thread, so keep one.
    static SCALE_CTX: RefCell<ScaleContext> = RefCell::new(ScaleContext::new());
}

/// The glyph outlines of `layout`, transformed by `transform` (layout space to window space: its origin is the
/// layout's top-left), as closed polygons `[x0, y0, x1, y1, ...]`. Fill them together with the non-zero rule.
pub(crate) fn contours(layout: &glyx_text::TextLayout, transform: Affine) -> Vec<Vec<f32>> {
    let mut out: Vec<Vec<f32>> = Vec::new();
    SCALE_CTX.with(|ctx| {
        let mut ctx = ctx.borrow_mut();
        for line in layout.inner.lines() {
            for item in line.items() {
                let parley::layout::PositionedLayoutItem::GlyphRun(gr) = item else { continue };
                let run = gr.run();
                let font = run.font();
                let Some(font_ref) = swash::FontRef::from_index(font.data.data(), font.index as usize) else { continue };
                let mut scaler = ctx.builder(font_ref).size(run.font_size()).hint(false).build();
                let baseline = gr.baseline() as f64;
                // Parley's glyph x / y are adjustments from the pen, which advances by each glyph's advance (the
                // same rule the CPU renderer's text drawing uses).
                let mut pen_x = gr.offset() as f64;
                for g in gr.glyphs() {
                    let origin = (pen_x + g.x as f64, baseline + g.y as f64);
                    pen_x += g.advance as f64;
                    let Some(outline) = scaler.scale_outline(g.id as u16) else { continue };
                    let path = glyph_path(outline.verbs(), outline.points(), origin);
                    if path.elements().is_empty() { continue; }
                    flatten_into(&(transform * path), &mut out);
                }
            }
        }
    });
    out
}

/// A glyph's verbs and points (font outlines have y up) as a path in layout space (y down) at `origin`.
fn glyph_path(verbs: &[Verb], points: &[swash::zeno::Point], origin: (f64, f64)) -> BezPath {
    let pt = |p: &swash::zeno::Point| kurbo::Point::new(origin.0 + p.x as f64, origin.1 - p.y as f64);
    let mut path = BezPath::new();
    let mut i = 0usize;
    for v in verbs {
        match v {
            Verb::MoveTo => { if let Some(p) = points.get(i) { path.move_to(pt(p)); } i += 1; }
            Verb::LineTo => { if let Some(p) = points.get(i) { path.line_to(pt(p)); } i += 1; }
            Verb::QuadTo => {
                if let (Some(a), Some(b)) = (points.get(i), points.get(i + 1)) { path.quad_to(pt(a), pt(b)); }
                i += 2;
            }
            Verb::CurveTo => {
                if let (Some(a), Some(b), Some(c)) = (points.get(i), points.get(i + 1), points.get(i + 2)) { path.curve_to(pt(a), pt(b), pt(c)); }
                i += 3;
            }
            Verb::Close => path.close_path(),
        }
    }
    path
}

/// Appends the sub-paths of `path` to `out` as flat polygons (those with fewer than three points are dropped).
fn flatten_into(path: &BezPath, out: &mut Vec<Vec<f32>>) {
    let mut cur: Vec<f32> = Vec::new();
    let finish = |cur: &mut Vec<f32>, out: &mut Vec<Vec<f32>>| {
        if cur.len() >= 6 { out.push(std::mem::take(cur)); } else { cur.clear(); }
    };
    kurbo::flatten(path.iter(), TOLERANCE_PX, |el| match el {
        PathEl::MoveTo(p) => { finish(&mut cur, out); cur.push(p.x as f32); cur.push(p.y as f32); }
        PathEl::LineTo(p) => { cur.push(p.x as f32); cur.push(p.y as f32); }
        PathEl::ClosePath => finish(&mut cur, out),
        _ => {}
    });
    finish(&mut cur, out);
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bbox(contours: &[Vec<f32>]) -> (f32, f32, f32, f32) {
        let (mut x0, mut y0, mut x1, mut y1) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
        for c in contours { for p in c.chunks_exact(2) { x0 = x0.min(p[0]); y0 = y0.min(p[1]); x1 = x1.max(p[0]); y1 = y1.max(p[1]); } }
        (x0, y0, x1, y1)
    }

    #[test]
    fn a_glyph_lays_out_y_down_from_the_origin_and_its_quads_and_curves_are_flattened() {
        // A square with a quadratic bump on top, in font units (y up), at origin (10, 50): the square's top is above
        // the baseline, so smaller y on screen.
        use swash::zeno::Point;
        let verbs = [Verb::MoveTo, Verb::LineTo, Verb::LineTo, Verb::QuadTo, Verb::Close];
        let pts = [Point::new(0.0, 0.0), Point::new(10.0, 0.0), Point::new(10.0, 10.0), Point::new(5.0, 20.0), Point::new(0.0, 10.0)];
        let path = glyph_path(&verbs, &pts, (10.0, 50.0));
        let mut out = Vec::new();
        flatten_into(&path, &mut out);
        assert_eq!(out.len(), 1);
        let (x0, y0, x1, y1) = bbox(&out);
        assert!((x0 - 10.0).abs() < 1e-3 && (x1 - 20.0).abs() < 1e-3, "x {x0}..{x1}");
        assert!((y1 - 50.0).abs() < 1e-3, "the baseline is the bottom: {y1}");
        assert!(y0 < 40.0 && y0 > 34.0, "the curve rises above the square: {y0}");
        assert!(out[0].len() > 10, "the quad became several segments: {}", out[0].len() / 2);
    }

    #[test]
    fn rotating_a_path_rotates_its_flattened_polygon() {
        let mut path = BezPath::new();
        path.move_to((0.0, 0.0)); path.line_to((10.0, 0.0)); path.line_to((10.0, 4.0)); path.line_to((0.0, 4.0)); path.close_path();
        let mut out = Vec::new();
        flatten_into(&(Affine::rotate(std::f64::consts::FRAC_PI_2) * path), &mut out);
        let (x0, y0, x1, y1) = bbox(&out);
        assert!((x0 + 4.0).abs() < 1e-3 && x1.abs() < 1e-3, "x {x0}..{x1}");
        assert!(y0.abs() < 1e-3 && (y1 - 10.0).abs() < 1e-3, "y {y0}..{y1}");
    }
}
