//! tiny-skia CPU rasterization backend.
//!
//! Renders entirely on the CPU into a `Pixmap`, then uploads the result
//! to a wgpu texture and blits it to the surface each frame.
//!
//! ## RAM profile
//! ~8 MB for a 1920×1080 Pixmap + upload texture, vs Vello's ~130 MB GPU buffer pool.
//! No shader compilation, no GPU compute — starts instantly.
//!
//! ## Glyph cache
//! Each unique (font, size, glyph_id) alpha mask is rasterized via swash once
//! and cached in `TinySkiaShared::glyph_cache`.  On subsequent frames the
//! cached alpha bytes are colorized and blitted directly — no swash re-work.
//!
//! ## Limitations (experiment branch)
//! - `supports_caching()` returns `false` — Vello scene-fragment caching is disabled.
//! - `push_layer_with_alpha` clips correctly but does **not** apply the opacity value.
//!   A full implementation would composite into an offscreen Pixmap.

use std::sync::{Arc, Mutex};
use vello::{kurbo::Affine, peniko};
use glyx_gpu::GpuContext;
use crate::{CachedBlit, RendererError};

// ── Color helpers ─────────────────────────────────────────────────────────────

fn to_sk(c: peniko::Color) -> tiny_skia::Color {
    let q = c.to_rgba8();
    tiny_skia::Color::from_rgba8(q.r, q.g, q.b, q.a)
}

fn solid_paint(color: peniko::Color) -> tiny_skia::Paint<'static> {
    let mut p = tiny_skia::Paint::default();
    p.set_color(to_sk(color));
    p.anti_alias = true;
    p
}

// ── Gradient helper ───────────────────────────────────────────────────────────

/// Convert a `peniko::Gradient` to a tiny-skia `Shader<'static>`.
/// A vertical linear gradient as a 1-pixel-wide strip of precomputed rows, and
/// the y the strip starts at. Every pixel in a row of such a gradient has the
/// same colour, so painting it as a `Pattern` of the strip (nearest-neighbour,
/// padded at both ends) replaces the per-pixel gradient math: about 3x faster
/// for a chart's area fill, within 3/255 of the gradient shader on every
/// channel. `None` for any other gradient (angled, radial, a zero-length span),
/// which keeps using `gradient_shader`.
fn vertical_gradient_strip(grad: &peniko::Gradient) -> Option<(tiny_skia::Pixmap, f32)> {
    let peniko::GradientKind::Linear(pos) = &grad.kind else { return None };
    if (pos.start.x - pos.end.x).abs() > 1e-6 || (pos.start.y - pos.end.y).abs() < 1e-6 { return None; }
    let (sy, ey) = (pos.start.y as f32, pos.end.y as f32);
    // One extra row at each end, outside the gradient's span: its centre is past
    // the span, so it clamps to the exact end stop, and `Pad` then extends exactly
    // that colour (not the colour of the first or last row inside the span).
    let top = sy.min(ey).floor() - 1.0;
    let h = (sy.max(ey).ceil() - top + 1.0).max(1.0);
    if h > 8192.0 { return None; }
    let stops: Vec<(f32, [f32; 4])> = grad.stops.iter().map(|s| {
        let q = s.color.to_alpha_color::<peniko::color::Srgb>().to_rgba8();
        (s.offset, [q.r as f32, q.g as f32, q.b as f32, q.a as f32])
    }).collect();
    if stops.is_empty() { return None; }
    let mut pm = tiny_skia::Pixmap::new(1, h as u32)?;
    for row in 0..h as u32 {
        let y = top + row as f32 + 0.5;
        let t = ((y - sy) / (ey - sy)).clamp(0.0, 1.0);
        // Piecewise linear between the stops in unpremultiplied RGBA, then premultiplied.
        let c = if t <= stops[0].0 { stops[0].1 }
            else if t >= stops[stops.len() - 1].0 { stops[stops.len() - 1].1 }
            else {
                let i = stops.windows(2).position(|w| t >= w[0].0 && t <= w[1].0).unwrap_or(0);
                let (a, b) = (&stops[i], &stops[i + 1]);
                let u = if b.0 > a.0 { (t - a.0) / (b.0 - a.0) } else { 0.0 };
                std::array::from_fn(|k| a.1[k] + (b.1[k] - a.1[k]) * u)
            };
        let al = c[3] / 255.0;
        pm.pixels_mut()[row as usize] = tiny_skia::PremultipliedColorU8::from_rgba(
            (c[0] * al).round() as u8, (c[1] * al).round() as u8, (c[2] * al).round() as u8, c[3].round() as u8,
        )?;
    }
    Some((pm, top))
}

/// The paint for `brush`. A vertical gradient under a plain translation uses the
/// strip (`strip` holds it, so it outlives the paint); everything else is as before.
fn brush_paint<'a>(
    brush: &peniko::Brush,
    strip: &'a Option<(tiny_skia::Pixmap, f32)>,
) -> Option<tiny_skia::Paint<'a>> {
    if let Some((pm, top)) = strip {
        return Some(tiny_skia::Paint {
            shader: tiny_skia::Pattern::new(
                pm.as_ref(), tiny_skia::SpreadMode::Pad, tiny_skia::FilterQuality::Nearest, 1.0,
                tiny_skia::Transform::from_translate(0.0, *top),
            ),
            anti_alias: true,
            ..Default::default()
        });
    }
    match brush {
        peniko::Brush::Solid(c) => Some(solid_paint(*c)),
        peniko::Brush::Gradient(g) => Some(tiny_skia::Paint {
            shader: gradient_shader(g)?,
            anti_alias: true,
            ..Default::default()
        }),
        _ => None,
    }
}

fn gradient_shader(grad: &peniko::Gradient) -> Option<tiny_skia::Shader<'static>> {
    use peniko::GradientKind;
    use tiny_skia::{GradientStop, LinearGradient, RadialGradient, SpreadMode, Transform};

    let stops: Vec<GradientStop> = grad.stops.iter().map(|s| {
        let c: peniko::Color = s.color.to_alpha_color::<peniko::color::Srgb>();
        let q = c.to_rgba8();
        GradientStop::new(s.offset, tiny_skia::Color::from_rgba8(q.r, q.g, q.b, q.a))
    }).collect();
    if stops.is_empty() { return None; }

    match &grad.kind {
        GradientKind::Linear(pos) =>
            LinearGradient::new(
                tiny_skia::Point::from_xy(pos.start.x as f32, pos.start.y as f32),
                tiny_skia::Point::from_xy(pos.end.x   as f32, pos.end.y   as f32),
                stops,
                SpreadMode::Pad,
                Transform::identity(),
            ),
        GradientKind::Radial(pos) =>
            RadialGradient::new(
                tiny_skia::Point::from_xy(pos.start_center.x as f32, pos.start_center.y as f32),
                tiny_skia::Point::from_xy(pos.end_center.x   as f32, pos.end_center.y   as f32),
                pos.end_radius,
                stops,
                SpreadMode::Pad,
                Transform::identity(),
            ),
        _ => None,
    }
}

// ── Path helpers ──────────────────────────────────────────────────────────────

/// Bézier rounded-rectangle path.  Falls back to an axis-aligned rect when radius ≤ 0.
/// kurbo `[a,b,c,d,e,f]` (x'=ax+cy+e, y'=bx+dy+f) to tiny-skia
/// `from_row(sx,ky,kx,sy,tx,ty)` (x'=sx*x+kx*y+tx, y'=ky*x+sy*y+ty).
fn to_ts_transform(t: Affine) -> tiny_skia::Transform {
    let [a, b, c, d, e, f] = t.as_coeffs();
    tiny_skia::Transform::from_row(a as f32, b as f32, c as f32, d as f32, e as f32, f as f32)
}

fn rrect_path(x: f32, y: f32, w: f32, h: f32, radius: f32) -> Option<tiny_skia::Path> {
    // Guard degenerate dimensions — tiny-skia warns and discards empty/line paths.
    if w <= 0.0 || h <= 0.0 { return None; }
    let r = radius.min(w * 0.5).min(h * 0.5);
    if r <= 0.0 {
        let rect = tiny_skia::Rect::from_xywh(x, y, w, h)?;
        return Some(tiny_skia::PathBuilder::from_rect(rect));
    }
    // κ ≈ 0.5522847498 — cubic Bézier approximation of a quarter-circle
    const K: f32 = 0.5522847498;
    let kr = K * r;
    let mut pb = tiny_skia::PathBuilder::new();
    pb.move_to(x + r,           y);
    pb.line_to(x + w - r,       y);
    pb.cubic_to(x + w - r + kr, y,         x + w, y + r - kr,     x + w, y + r);
    pb.line_to(x + w,           y + h - r);
    pb.cubic_to(x + w,          y+h-r+kr,  x+w-r+kr, y+h,        x+w-r, y+h);
    pb.line_to(x + r,           y + h);
    pb.cubic_to(x + r - kr,     y + h,     x, y+h-r+kr,           x, y+h-r);
    pb.line_to(x,               y + r);
    pb.cubic_to(x,              y+r-kr,    x+r-kr, y,             x+r, y);
    pb.close();
    pb.finish()
}

/// Build a polyline/polygon path from a flat `[x0,y0,…]` list. `None` if < 2 pts.
fn poly_path(pts: &[f32], close: bool) -> Option<tiny_skia::Path> {
    if pts.len() < 4 { return None; }
    let mut pb = tiny_skia::PathBuilder::new();
    pb.move_to(pts[0], pts[1]);
    let mut i = 2;
    while i + 1 < pts.len() {
        pb.line_to(pts[i], pts[i + 1]);
        i += 2;
    }
    if close { pb.close(); }
    pb.finish()
}

/// The polygon `pts` (a flat `[x0, y0, …]` list, closed) cut down to the box
/// `(l, t, r, b)` — Sutherland–Hodgman against each side in turn. Inside the box
/// the result covers exactly what the original covers, so filling it there is
/// pixel-identical; outside, nothing is drawn. Concave input can leave edges that
/// run back along the box's sides, which enclose no area and fill nothing.
/// Empty when nothing of the polygon is inside the box.
fn clip_polygon_to_box(pts: &[f32], l: f32, t: f32, r: f32, b: f32) -> Vec<f32> {
    let mut poly: Vec<(f32, f32)> = pts.chunks_exact(2).map(|p| (p[0], p[1])).collect();
    // (is the point inside this side, where the segment a→b crosses it)
    type Side = (fn(&(f32, f32), f32) -> bool, fn((f32, f32), (f32, f32), f32) -> (f32, f32), f32);
    fn at_x(a: (f32, f32), b: (f32, f32), x: f32) -> (f32, f32) { (x, a.1 + (b.1 - a.1) * (x - a.0) / (b.0 - a.0)) }
    fn at_y(a: (f32, f32), b: (f32, f32), y: f32) -> (f32, f32) { (a.0 + (b.0 - a.0) * (y - a.1) / (b.1 - a.1), y) }
    let sides: [Side; 4] = [
        (|p, v| p.0 >= v, at_x, l), (|p, v| p.0 <= v, at_x, r),
        (|p, v| p.1 >= v, at_y, t), (|p, v| p.1 <= v, at_y, b),
    ];
    for (inside, cross, v) in sides {
        if poly.is_empty() { break; }
        let mut out = Vec::with_capacity(poly.len() + 4);
        let mut prev = *poly.last().unwrap();
        for &cur in &poly {
            match (inside(&prev, v), inside(&cur, v)) {
                (true, true)  => out.push(cur),
                (true, false) => out.push(cross(prev, cur, v)),
                (false, true) => { out.push(cross(prev, cur, v)); out.push(cur); }
                (false, false) => {}
            }
            prev = cur;
        }
        poly = out;
    }
    poly.iter().flat_map(|p| [p.0, p.1]).collect()
}

/// Index ranges `(first, last)` of the points of an open polyline whose
/// segments come within `reach` of the box `(l, t, r, b)`; a segment that stays
/// farther away than that cannot touch the box once stroked. Each range is
/// stroked on its own. Cutting there is invisible: the ends of a range meet the
/// dropped segments at a vertex, where a round join and a round cap are the
/// same disc.
fn polyline_runs_near(pts: &[f32], l: f32, t: f32, r: f32, b: f32, reach: f32) -> Vec<(usize, usize)> {
    let n = pts.len() / 2;
    let mut runs: Vec<(usize, usize)> = Vec::new();
    for i in 0..n.saturating_sub(1) {
        let (x0, y0, x1, y1) = (pts[i * 2], pts[i * 2 + 1], pts[i * 2 + 2], pts[i * 2 + 3]);
        let near = x0.max(x1) >= l - reach && x0.min(x1) <= r + reach
                && y0.max(y1) >= t - reach && y0.min(y1) <= b + reach;
        if !near { continue; }
        match runs.last_mut() {
            Some(run) if run.1 == i => run.1 = i + 1,
            _ => runs.push((i, i + 1)),
        }
    }
    runs
}

/// Narrows a clip mask to the box `(l, t, r, b)` in place: everything outside
/// is zeroed, and the edge pixels a fractional box only partly covers keep that
/// fraction. What `Mask::intersect_path` does for a rectangle, without
/// rasterizing a path and multiplying the whole buffer: a window-sized mask
/// costs a few hundred microseconds this way instead of a couple of
/// milliseconds, and a chart inside a rounded card pushes a clip or two per frame.
fn mask_intersect_rect(m: &mut tiny_skia::Mask, l: f32, t: f32, r: f32, b: f32) {
    let (w, h) = (m.width() as usize, m.height() as usize);
    let clamp_to = |v: f32, max: usize| (v.max(0.0) as usize).min(max);
    let (x0, x1) = (clamp_to(l.floor(), w), clamp_to(r.ceil(), w));
    let (y0, y1) = (clamp_to(t.floor(), h), clamp_to(b.ceil(), h));
    // How much of the pixel at `i` the span `lo..hi` covers.
    let cov = |i: usize, lo: f32, hi: f32| (hi.min(i as f32 + 1.0) - lo.max(i as f32)).clamp(0.0, 1.0);
    let data = m.data_mut();
    for row in 0..h {
        let line = &mut data[row * w..(row + 1) * w];
        if row < y0 || row >= y1 || x1 <= x0 { line.fill(0); continue; }
        line[..x0].fill(0);
        line[x1..].fill(0);
        let cy = cov(row, t, b);
        if cy < 1.0 {
            for v in line[x0..x1].iter_mut() { *v = (*v as f32 * cy + 0.5) as u8; }
        }
        // The left and right pixels of a fractional box are only partly inside.
        let (cl, cr) = (cov(x0, l, r), cov(x1 - 1, l, r));
        if cl < 1.0 { line[x0] = (line[x0] as f32 * cl + 0.5) as u8; }
        if cr < 1.0 && (x1 - 1 != x0 || cl >= 1.0) { line[x1 - 1] = (line[x1 - 1] as f32 * cr + 0.5) as u8; }
    }
}

// ── Glyph cache ───────────────────────────────────────────────────────────────

/// Cache key for a rasterized glyph alpha mask.
/// Color is NOT in the key — the raw alpha coverage is stored and colorized
/// cheaply at draw time, so one cache entry serves all text colors.
#[derive(Hash, Eq, PartialEq, Clone)]
struct GlyphKey {
    data_ptr:   usize,  // stable pointer to font blob bytes
    font_index: u32,
    glyph_id:   u16,
    size_class: u16,    // (font_size * 4.0) as u16 — quarter-pixel precision
}

struct CachedAlphaGlyph {
    /// Raw swash alpha coverage — one byte per pixel.
    alpha:  Vec<u8>,
    width:  u32,
    height: u32,
    left:   i32,   // placement.left
    top:    i32,   // placement.top
}

// ── TinySkiaShared ────────────────────────────────────────────────────────────

/// State that persists across frames (moved in/out of TinySkiaFrame).
struct TinySkiaShared {
    scale_ctx:   swash::scale::ScaleContext,
    /// Bounded LRU of rasterized glyph alpha masks. Capped so apps that render
    /// many distinct (glyph, size) combinations (animated font sizes, large CJK
    /// or emoji sets) can't grow CPU memory without limit. UIs with a small set
    /// of text sizes never hit the cap.
    glyph_cache: lru::LruCache<GlyphKey, CachedAlphaGlyph>,
    /// Reusable pixel buffer — avoids a fresh 8 MB allocation every frame.
    pixmap:      Option<tiny_skia::Pixmap>,
    /// sRGB-converted copies of `peniko::ImageData` bytes, keyed by the source
    /// blob's unique id (`Blob::id`) — see `linear_premul_to_srgb_premul`
    /// below. Avoids redoing the per-pixel conversion every frame for an
    /// unchanged image (same convention as `Direct2DImageCache`).
    ///
    /// NOT keyed by the bytes' address: that was the key originally, and
    /// allocators reuse freed addresses — a camera/video frame freed and the
    /// next same-sized frame allocated at the same address hit the old entry,
    /// showing stale frames interleaved with live ones (and frames from before
    /// a camera stop reappearing after restart). `Blob::id` comes from a global
    /// counter and is never reused.
    image_cache: lru::LruCache<u64, Vec<u8>>,
}

/// `peniko::ImageData` bytes are linear-premultiplied (`glyx-core/src/scene.rs`'s
/// `rgba_to_peniko`, chosen for Vello's colorspace-correct GPU compositing).
/// TinySkia blits raw bytes with no colorspace conversion of its own, so
/// linear bytes displayed as-is come out visibly darker/desaturated than
/// intended — this converts back to standard sRGB-premultiplied bytes first.
/// Identical math to `direct2d.rs`'s `linear_premul_to_srgb_premul`.
fn linear_to_srgb_u8(v: u8) -> u8 {
    let c = v as f32 / 255.0;
    let srgb = if c <= 0.0031308 {
        c * 12.92
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    };
    (srgb * 255.0).round().clamp(0.0, 255.0) as u8
}

/// `linear_to_srgb_u8` for every input byte — a `powf` per channel per pixel
/// is far too slow for camera/video frames, which are converted every frame.
fn srgb_lut() -> &'static [u8; 256] {
    static LUT: std::sync::OnceLock<[u8; 256]> = std::sync::OnceLock::new();
    LUT.get_or_init(|| std::array::from_fn(|i| linear_to_srgb_u8(i as u8)))
}

fn linear_premul_to_srgb_premul(bytes: &[u8]) -> Vec<u8> {
    let mut out = bytes.to_vec();
    linear_premul_to_srgb_premul_in_place(&mut out, false);
    out
}

/// Converts in place; `swap_rb` also turns BGRA into RGBA in the same pass.
fn linear_premul_to_srgb_premul_in_place(out: &mut [u8], swap_rb: bool) {
    let lut = srgb_lut();
    for px in out.chunks_exact_mut(4) {
        if swap_rb { px.swap(0, 2); }
        let a = px[3];
        if a == 0 { continue; }
        if a == 255 {
            // Opaque (every camera/video pixel): no un/re-premultiply needed.
            px[0] = lut[px[0] as usize];
            px[1] = lut[px[1] as usize];
            px[2] = lut[px[2] as usize];
            continue;
        }
        let inv = 255.0 / a as f32;
        let lr = (px[0] as f32 * inv).min(255.0) as u8;
        let lg = (px[1] as f32 * inv).min(255.0) as u8;
        let lb = (px[2] as f32 * inv).min(255.0) as u8;
        let a16 = a as u16;
        px[0] = ((lut[lr as usize] as u16 * a16 + 127) / 255) as u8;
        px[1] = ((lut[lg as usize] as u16 * a16 + 127) / 255) as u8;
        px[2] = ((lut[lb as usize] as u16 * a16 + 127) / 255) as u8;
    }
}


// ── TinySkiaFrame ─────────────────────────────────────────────────────────────

/// Test-only switch: build a mask at every clip push, as before clips were lazy.
/// Lets a benchmark compare the two behaviours in one process.
#[cfg(test)]
static NO_LAZY_CLIP: std::sync::atomic::AtomicBool = std::sync::atomic::AtomicBool::new(false);

/// Most rects a partial redraw is split into (`glyx-core`'s `damage_rects`
/// merges down to this many).
const MAX_DAMAGE_RECTS: usize = 8;

/// A few disjoint pixel rects, `Copy` so a clip layer can save and restore one
/// without allocating. The region a partial redraw repaints, and the (lazy)
/// rectangular clip it is intersected with.
#[derive(Clone, Copy)]
struct RectSet {
    n: usize,
    r: [tiny_skia::Rect; MAX_DAMAGE_RECTS],
}

impl RectSet {
    fn from_slice(rects: &[tiny_skia::Rect]) -> Option<Self> {
        if rects.is_empty() || rects.len() > MAX_DAMAGE_RECTS { return None; }
        let mut r = [rects[0]; MAX_DAMAGE_RECTS];
        r[..rects.len()].copy_from_slice(rects);
        Some(Self { n: rects.len(), r })
    }

    fn iter(&self) -> impl Iterator<Item = &tiny_skia::Rect> { self.r[..self.n].iter() }

    /// Whether the box lies inside ONE of the rects, with `slack` pixels to spare.
    fn contains_box(&self, l: f32, t: f32, r: f32, b: f32, slack: f32) -> bool {
        self.iter().any(|p| l - slack >= p.left() && t - slack >= p.top()
                         && r + slack <= p.right() && b + slack <= p.bottom())
    }

    fn intersects_box(&self, l: f32, t: f32, r: f32, b: f32) -> bool {
        self.iter().any(|d| !(r <= d.left() || l >= d.right() || b <= d.top() || t >= d.bottom()))
    }

    /// Every rect cut down to the box; the ones that miss it are dropped.
    /// `None` when none of them touches it.
    fn clipped_to(&self, l: f32, t: f32, r: f32, b: f32) -> Option<Self> {
        let mut out: Vec<tiny_skia::Rect> = Vec::with_capacity(self.n);
        for p in self.iter() {
            let (il, it, ir, ib) = (l.max(p.left()), t.max(p.top()), r.min(p.right()), b.min(p.bottom()));
            if ir > il && ib > it {
                if let Some(c) = tiny_skia::Rect::from_ltrb(il, it, ir, ib) { out.push(c); }
            }
        }
        Self::from_slice(&out)
    }

    /// The rects as one path, for building a clip mask.
    fn path(&self) -> Option<tiny_skia::Path> {
        let mut pb = tiny_skia::PathBuilder::new();
        for d in self.iter() { pb.push_rect(*d); }
        pb.finish()
    }
}

/// One frame accumulated in a CPU `Pixmap`.
pub struct TinySkiaFrame {
    pub(crate) pixmap: tiny_skia::Pixmap,
    /// Clip state saved by push_layer, restored by pop_layer: the mask and the
    /// pending rect (below) as they were before the push.
    clip_stack:   Vec<(Option<tiny_skia::Mask>, Option<RectSet>, bool)>,
    /// Active clip mask (`None` = no clip, or only a pending rect).
    current_mask: Option<tiny_skia::Mask>,
    /// A rectangular clip whose mask hasn't been built yet: the damage rect of a
    /// partial redraw, intersected with every rectangular layer pushed since.
    /// Most draws lie inside it and need no mask at all (see `needs_mask`), so
    /// the full-window mask — a window-sized allocation plus a pass over every
    /// pixel — is only built when some draw actually crosses the rect's edge
    /// (`ensure_mask`). Meaningful only while `current_mask` is `None`.
    pending_base: Option<RectSet>,
    /// `current_mask` is only the mask of `pending_base` (built by `ensure_mask`
    /// because some draw crossed an edge), kept as a cache: the rect set is still
    /// the clip, so further rect layers just narrow it and draws that lie inside
    /// it still skip the mask. When `false`, `current_mask` is the whole clip
    /// (it came from a rounded or rotated layer) and `pending_base` is `None`.
    mask_is_rects: bool,
    /// Damage region for partial redraw (`None` = full frame).  Draws are
    /// clipped to these rects via the base mask AND bbox-culled for speed.
    damage:       Option<RectSet>,
    /// Current transform (node `transform` props, composed down the tree),
    /// applied to every draw and clip. Identity keeps tiny-skia's fast paths.
    xf:           tiny_skia::Transform,
    /// Saved transforms, see `push_transform` / `pop_transform`.
    xf_stack:     Vec<tiny_skia::Transform>,
    /// Persistent state moved from TinySkiaRenderer for the frame duration.
    shared:       TinySkiaShared,
}

impl TinySkiaFrame {
    fn new(width: u32, height: u32, bg: peniko::Color, shared: TinySkiaShared)
        -> Option<Self>
    {
        Self::new_damaged(width, height, bg, shared, None)
    }

    /// Create a frame, optionally restricted to a damage rect.
    ///
    /// With `damage: Some(rect)`, the pooled pixmap's previous contents are
    /// KEPT outside the rect; only the rect is cleared to `bg`, and a base
    /// clip mask confines every subsequent draw (including nested layers,
    /// which intersect with it) to the rect.  Falls back to a full frame when
    /// no correctly-sized pooled pixmap exists (first frame, resize).
    fn new_damaged(
        width: u32, height: u32, bg: peniko::Color, mut shared: TinySkiaShared,
        damage: Option<&[(f64, f64, f64, f64)]>,
    ) -> Option<Self> {
        // Partial redraw needs last frame's pixels — only valid when the
        // pooled pixmap exists at the same size.
        let (mut pixmap, damage) = match (shared.pixmap.take(), damage) {
            (Some(p), Some(d)) if p.width() == width && p.height() == height => (p, Some(d)),
            (Some(p), _) if p.width() == width && p.height() == height => (p, None),
            _ => (tiny_skia::Pixmap::new(width, height)?, None),
        };

        // Clamp each rect to the pixmap; any that covers it all, or none left,
        // means a full frame.
        let damage_set = damage.and_then(|rects| {
            let mut out: Vec<tiny_skia::Rect> = Vec::with_capacity(rects.len());
            for &(x, y, w, h) in rects {
                let x0 = (x.max(0.0)).floor() as f32;
                let y0 = (y.max(0.0)).floor() as f32;
                let x1 = ((x + w).min(width  as f64)).ceil() as f32;
                let y1 = ((y + h).min(height as f64)).ceil() as f32;
                if x1 <= x0 || y1 <= y0 { continue; }                 // empty
                if x0 <= 0.0 && y0 <= 0.0
                    && x1 >= width as f32 && y1 >= height as f32 { return None; } // full
                out.push(tiny_skia::Rect::from_ltrb(x0, y0, x1, y1)?);
            }
            // Rounding outward can make neighbours overlap by a pixel, and a
            // translucent fill would then land twice there: merge any that do.
            'merge: loop {
                for i in 0..out.len() {
                    for j in i + 1..out.len() {
                        let (a, b) = (out[i], out[j]);
                        if a.left() < b.right() && b.left() < a.right() && a.top() < b.bottom() && b.top() < a.bottom() {
                            out[i] = tiny_skia::Rect::from_ltrb(
                                a.left().min(b.left()), a.top().min(b.top()),
                                a.right().max(b.right()), a.bottom().max(b.bottom()))?;
                            out.swap_remove(j);
                            continue 'merge;
                        }
                    }
                }
                break;
            }
            if out.len() > MAX_DAMAGE_RECTS {
                // More than we track: one box around them all.
                let l = out.iter().map(|r| r.left()).fold(f32::MAX, f32::min);
                let t = out.iter().map(|r| r.top()).fold(f32::MAX, f32::min);
                let r = out.iter().map(|r| r.right()).fold(f32::MIN, f32::max);
                let b = out.iter().map(|r| r.bottom()).fold(f32::MIN, f32::max);
                out = vec![tiny_skia::Rect::from_ltrb(l, t, r, b)?];
            }
            RectSet::from_slice(&out)
        });

        let q = bg.to_rgba8();
        let bg_color = tiny_skia::Color::from_rgba8(q.r, q.g, q.b, q.a);
        match &damage_set {
            None => pixmap.fill(bg_color),
            Some(set) => {
                // Clear only the damaged regions to the background color.
                let paint = tiny_skia::Paint {
                    shader: tiny_skia::Shader::SolidColor(bg_color),
                    blend_mode: tiny_skia::BlendMode::Source,
                    anti_alias: false,
                    ..Default::default()
                };
                for d in set.iter() {
                    pixmap.fill_rect(*d, &paint, tiny_skia::Transform::identity(), None);
                }
            }
        }

        Some(Self {
            pixmap,
            clip_stack:   Vec::new(),
            current_mask: None,
            mask_is_rects: false,
            pending_base: damage_set,
            damage:       damage_set,
            xf:           tiny_skia::Transform::identity(),
            xf_stack:     Vec::new(),
            shared,
        })
    }

    /// The clamped damage rects this frame was created with (`None` = full).
    pub fn damage(&self) -> Option<Vec<(u32, u32, u32, u32)>> {
        self.damage.map(|set| set.iter().map(|d| {
            (d.left() as u32, d.top() as u32,
             (d.right() - d.left()) as u32, (d.bottom() - d.top()) as u32)
        }).collect())
    }

    /// True when a draw with the given bbox lies entirely outside the damage
    /// region and can be skipped (the base mask would zero it anyway; this
    /// avoids the rasterization work).
    #[inline]
    fn culled(&self, x: f64, y: f64, w: f64, h: f64) -> bool {
        let Some(d) = &self.damage else { return false };
        let (l, t, r, b) = self.screen_bbox(x, y, w, h);
        !d.intersects_box(l, t, r, b)
    }

    /// Screen-space bbox `(l, t, r, b)` of a local-space box under the
    /// current transform.
    #[inline]
    fn screen_bbox(&self, x: f64, y: f64, w: f64, h: f64) -> (f32, f32, f32, f32) {
        if self.xf.is_identity() {
            return (x as f32, y as f32, (x + w) as f32, (y + h) as f32);
        }
        // A rotated/moved draw can land somewhere its local box doesn't.
        let mut pts = [
            tiny_skia::Point::from_xy(x as f32, y as f32),
            tiny_skia::Point::from_xy((x + w) as f32, y as f32),
            tiny_skia::Point::from_xy(x as f32, (y + h) as f32),
            tiny_skia::Point::from_xy((x + w) as f32, (y + h) as f32),
        ];
        self.xf.map_points(&mut pts);
        let (mut l, mut t, mut r, mut b) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
        for p in pts { l = l.min(p.x); t = t.min(p.y); r = r.max(p.x); b = b.max(p.y); }
        (l, t, r, b)
    }

    /// Whether a draw with local bbox `(x, y, w, h)` needs the clip mask. During a
    /// partial redraw the base mask is just the damage rect; when no clip
    /// layer is pushed on top and the draw lies entirely inside the damage,
    /// that mask can't change a pixel, so skip it: tiny-skia's masked
    /// pipeline is several times slower per pixel than the unmasked one.
    #[inline]
    fn needs_mask(&self, x: f64, y: f64, w: f64, h: f64) -> bool {
        let (l, t, r, b) = self.screen_bbox(x, y, w, h);
        self.clip_needs_mask(l, t, r, b)
    }

    /// Whether a draw covering the screen box `(l, t, r, b)` can be changed by
    /// the active clip. With only a pending rect (no built mask) it can't when
    /// the box lies inside the rect, with 1px slack for anti-aliased edges. A
    /// built mask (a rounded or rotated clip, or a rect a draw already
    /// crossed) is applied conservatively.
    #[inline]
    fn clip_needs_mask(&self, l: f32, t: f32, r: f32, b: f32) -> bool {
        self.clip_needs_mask_with(l, t, r, b, 1.0)
    }

    /// `clip_needs_mask` with an explicit `slack` in pixels: 1 for an
    /// anti-aliased shape, 0 for one whose edges lie on whole pixels.
    #[inline]
    fn clip_needs_mask_with(&self, l: f32, t: f32, r: f32, b: f32, slack: f32) -> bool {
        if self.current_mask.is_some() && !self.mask_is_rects { return true; }
        match self.pending_base {
            None => false,
            Some(p) => !p.contains_box(l, t, r, b, slack),
        }
    }

    /// Build the deferred damage-rect clip mask (see `pending_base`). Every
    /// draw that passes `current_mask` without a `needs_mask` check, and
    /// every clip push, calls this first.
    fn ensure_mask(&mut self) {
        if self.current_mask.is_some() { return; }
        let Some(d) = self.pending_base else { return };
        let Some(p) = d.path() else { return };
        self.current_mask = tiny_skia::Mask::new(self.pixmap.width(), self.pixmap.height()).map(|mut m| {
            m.fill_path(&p, tiny_skia::FillRule::Winding, true, tiny_skia::Transform::identity());
            m
        });
        self.mask_is_rects = self.current_mask.is_some();
    }

    /// `needs_mask`, materializing the deferred mask when it's needed.
    fn mask_needed(&mut self, x: f64, y: f64, w: f64, h: f64) -> bool {
        let needed = self.needs_mask(x, y, w, h);
        if needed { self.ensure_mask(); }
        needed
    }

    /// With a damage rect, the part of a filled (rounded) rect that matters is
    /// its intersection with the damage. tiny-skia rasterizes a shape over its
    /// whole bbox before applying the clip mask, so a full-window background
    /// costs a full-window fill even when 5% of the window changed. Returns
    /// that intersection when filling it alone is pixel-identical: no
    /// transform, and the intersection stays clear of the rounded corners.
    /// A rounded rect is convex, so that holds when all four corners of the
    /// intersection lie inside it. Straight edges are exact; inside a corner
    /// square the point must be a pixel inside the arc, so the arc's
    /// anti-aliased pixels are never part of the plain fill. (The damage rect
    /// carries a few pixels of slack, which often reaches into a corner's
    /// square without touching its arc.) `None` → draw the shape normally.
    fn damage_clipped_fill(&self, x: f64, y: f64, w: f64, h: f64, radius: f64)
        -> Option<RectSet>
    {
        let d = self.damage?;
        if !self.xf.is_identity() { return None; }
        let (x, y, r, b) = (x as f32, y as f32, (x + w) as f32, (y + h) as f32);
        let rad = (radius as f32).min((r - x) * 0.5).min((b - y) * 0.5).max(0.0);
        let inside = |px: f32, py: f32| {
            if px < x || px > r || py < y || py > b { return false; }
            if rad < 1.0 { return true; }
            // The rounded rect is every point within `rad` of its inner rectangle.
            let (dx, dy) = (px - px.clamp(x + rad, r - rad), py - py.clamp(y + rad, b - rad));
            // Only a point in a corner square (off the inner rect on both axes) is near an arc.
            dx == 0.0 || dy == 0.0 || dx * dx + dy * dy <= (rad - 1.0) * (rad - 1.0)
        };
        // The shape's intersection with each damage rect (they are disjoint, so
        // together they cover exactly what the damage will show of it).
        let mut parts: Vec<tiny_skia::Rect> = Vec::with_capacity(d.n);
        for dr in d.iter() {
            let (il, it) = (x.max(dr.left()), y.max(dr.top()));
            let (ir, ib) = (r.min(dr.right()), b.min(dr.bottom()));
            if ir <= il || ib <= it { continue; }
            // Not worth it (and not needed) when the shape is already inside.
            if il == x && it == y && ir == r && ib == b { return None; }
            if rad > 0.0 && !(inside(il, it) && inside(ir, it) && inside(il, ib) && inside(ir, ib)) { return None; }
            parts.push(tiny_skia::Rect::from_ltrb(il, it, ir, ib)?);
        }
        RectSet::from_slice(&parts)
    }

    // ── Transforms ────────────────────────────────────────────────────────────

    /// Apply `affine` to everything drawn until the matching `pop_transform`,
    /// composed with any transform already in effect (a transformed node
    /// inside a transformed node gets both).
    pub fn push_transform(&mut self, affine: Affine) {
        self.xf_stack.push(self.xf);
        self.xf = self.xf.pre_concat(to_ts_transform(affine));
    }

    pub fn pop_transform(&mut self) {
        self.xf = self.xf_stack.pop().unwrap_or_default();
    }

    // ── Primitives ────────────────────────────────────────────────────────────

    pub fn fill_rounded_rect(&mut self, x: f64, y: f64, w: f64, h: f64,
                              radius: f64, color: peniko::Color) {
        if self.culled(x, y, w, h) { return; }
        if let Some(set) = self.damage_clipped_fill(x, y, w, h, radius) {
            let paint = solid_paint(color);
            for rect in set.iter() {
                // The rect IS inside the damage, so only a pushed clip layer matters.
                let needs = !self.clip_stack.is_empty()
                    && self.clip_needs_mask(rect.left(), rect.top(), rect.right(), rect.bottom());
                if needs { self.ensure_mask(); }
                let mask = if needs { self.current_mask.as_ref() } else { None };
                self.pixmap.fill_rect(*rect, &paint, self.xf, mask);
            }
            return;
        }
        let Some(path) = rrect_path(x as f32, y as f32, w as f32, h as f32, radius as f32)
            else { return };
        let paint = solid_paint(color);
        // A big rounded rect is mostly flat interior, and what makes filling it
        // slow is the clip mask, not the shape: through the damage mask a panel
        // takes ~19x longer than without one. So fill an integer-aligned inner
        // rectangle as a plain rect — cropped to the damage, so it needs no mask
        // to stay inside it — and only the thin ring around it through the mask.
        // The split lies on whole pixels, so the two never overlap or leave a
        // seam, even for a translucent colour.
        if let Some(hole) = self.interior_rect(x, y, w, h, radius) {
            let mut pb = tiny_skia::PathBuilder::new();
            pb.push_path(&path);
            pb.push_rect(hole);
            if let Some(ring) = pb.finish() {
                // The hole cropped to each damage rect, so it needs no mask to
                // stay inside the damage.
                let parts: Vec<tiny_skia::Rect> = match &self.damage {
                    Some(set) => set.iter().filter_map(|d| tiny_skia::Rect::from_ltrb(
                        hole.left().max(d.left()), hole.top().max(d.top()),
                        hole.right().min(d.right()), hole.bottom().min(d.bottom()))).collect(),
                    None => vec![hole],
                };
                for part in parts {
                    // Whole-pixel edges: no anti-aliasing, so no slack is needed.
                    let needs = self.clip_needs_mask_with(part.left(), part.top(), part.right(), part.bottom(), 0.0);
                    if needs { self.ensure_mask(); }
                    let m = if needs { self.current_mask.as_ref() } else { None };
                    self.pixmap.fill_rect(part, &paint, self.xf, m);
                }
                let mask = if self.mask_needed(x, y, w, h) { self.current_mask.as_ref() } else { None };
                self.pixmap.fill_path(&ring, &paint, tiny_skia::FillRule::EvenOdd, self.xf, mask);
                return;
            }
        }
        let mask  = if self.mask_needed(x, y, w, h) { self.current_mask.as_ref() } else { None };
        self.pixmap.fill_path(&path, &paint, tiny_skia::FillRule::Winding,
                              self.xf, mask);
    }

    /// The whole-pixel rectangle strictly inside a rounded rect's flat interior
    /// (inset by the corner radius), for `fill_rounded_rect`'s ring-and-hole
    /// split. Only for an unmoved frame — under a fractional translation the
    /// split would land between pixels and show a seam — and only for shapes
    /// large enough that the saved path fill outweighs the extra draw call.
    fn interior_rect(&self, x: f64, y: f64, w: f64, h: f64, radius: f64) -> Option<tiny_skia::Rect> {
        if !self.xf.is_identity() { return None; }
        let rad = radius.min(w * 0.5).min(h * 0.5).max(0.0);
        let (l, t, r, b) = ((x + rad).ceil(), (y + rad).ceil(), (x + w - rad).floor(), (y + h - rad).floor());
        if rad < 2.0 || w * h < 20_000.0 || r - l < 8.0 || b - t < 8.0 { return None; }
        tiny_skia::Rect::from_ltrb(l as f32, t as f32, r as f32, b as f32)
    }

    pub fn fill_rounded_rect_with_brush(&mut self, x: f64, y: f64, w: f64, h: f64,
                                         radius: f64, brush: &peniko::Brush) {
        if self.culled(x, y, w, h) { return; }
        let Some(path) = rrect_path(x as f32, y as f32, w as f32, h as f32, radius as f32)
            else { return };
        let strip = self.gradient_strip(brush);
        let Some(paint) = brush_paint(brush, &strip) else { return };
        let mask = if self.mask_needed(x, y, w, h) { self.current_mask.as_ref() } else { None };
        self.pixmap.fill_path(&path, &paint, tiny_skia::FillRule::Winding,
                              self.xf, mask);
    }

    pub fn fill_rect(&mut self, x: f64, y: f64, w: f64, h: f64, color: peniko::Color) {
        if self.culled(x, y, w, h) { return; }
        let paint = solid_paint(color);
        // A damage-clipped rect is inside the damage by construction, so only
        // a pushed clip layer can still matter.
        if let Some(set) = self.damage_clipped_fill(x, y, w, h, 0.0) {
            for r in set.iter() {
                let needs = !self.clip_stack.is_empty()
                    && self.clip_needs_mask(r.left(), r.top(), r.right(), r.bottom());
                if needs { self.ensure_mask(); }
                let mask = if needs { self.current_mask.as_ref() } else { None };
                self.pixmap.fill_rect(*r, &paint, self.xf, mask);
            }
            return;
        }
        let needs = self.mask_needed(x, y, w, h);
        let mask = if needs { self.current_mask.as_ref() } else { None };
        if let Some(rect) = tiny_skia::Rect::from_xywh(x as f32, y as f32, w as f32, h as f32) {
            self.pixmap.fill_rect(rect, &paint, self.xf, mask);
        }
    }

    pub fn stroke_rounded_rect(&mut self, x: f64, y: f64, w: f64, h: f64,
                                radius: f64, sw: f64, color: peniko::Color) {
        // Inflate bbox by the stroke width (strokes extend past the rect).
        if self.culled(x - sw, y - sw, w + sw * 2.0, h + sw * 2.0) { return; }
        let Some(path) = rrect_path(x as f32, y as f32, w as f32, h as f32, radius as f32)
            else { return };
        let paint  = solid_paint(color);
        let stroke = tiny_skia::Stroke { width: sw as f32, ..Default::default() };
        let mask   = if self.mask_needed(x - sw, y - sw, w + sw * 2.0, h + sw * 2.0) { self.current_mask.as_ref() } else { None };
        self.pixmap.stroke_path(&path, &paint, &stroke,
                                self.xf, mask);
    }

    pub fn fill_circle(&mut self, cx: f64, cy: f64, r: f64, color: peniko::Color) {
        if self.culled(cx - r, cy - r, r * 2.0, r * 2.0) { return; }
        let Some(path) = tiny_skia::PathBuilder::from_circle(cx as f32, cy as f32, r as f32)
            else { return };
        let paint = solid_paint(color);
        let mask  = if self.mask_needed(cx - r, cy - r, r * 2.0, r * 2.0) { self.current_mask.as_ref() } else { None };
        self.pixmap.fill_path(&path, &paint, tiny_skia::FillRule::Winding,
                              self.xf, mask);
    }

    pub fn stroke_circle(&mut self, cx: f64, cy: f64, r: f64, width: f64, color: peniko::Color) {
        let rr = r + width;
        if self.culled(cx - rr, cy - rr, rr * 2.0, rr * 2.0) { return; }
        let Some(path) = tiny_skia::PathBuilder::from_circle(cx as f32, cy as f32, r as f32)
            else { return };
        let paint  = solid_paint(color);
        let stroke = tiny_skia::Stroke { width: width as f32, ..Default::default() };
        let mask   = if self.mask_needed(cx - rr, cy - rr, rr * 2.0, rr * 2.0) { self.current_mask.as_ref() } else { None };
        self.pixmap.stroke_path(&path, &paint, &stroke,
                                self.xf, mask);
    }

    pub fn stroke_line(&mut self, x0: f64, y0: f64, x1: f64, y1: f64,
                        width: f64, color: peniko::Color) {
        {
            let (lx, hx) = if x0 < x1 { (x0, x1) } else { (x1, x0) };
            let (ly, hy) = if y0 < y1 { (y0, y1) } else { (y1, y0) };
            if self.culled(lx - width, ly - width,
                           hx - lx + width * 2.0, hy - ly + width * 2.0) { return; }
        }
        let mut pb = tiny_skia::PathBuilder::new();
        pb.move_to(x0 as f32, y0 as f32);
        pb.line_to(x1 as f32, y1 as f32);
        let Some(path) = pb.finish() else { return };
        let paint  = solid_paint(color);
        let stroke = tiny_skia::Stroke {
            width:    width as f32,
            line_cap: tiny_skia::LineCap::Round,
            ..Default::default()
        };
        // The stroke reaches past the endpoints by its half width (round caps).
        let (lx, hx) = if x0 < x1 { (x0, x1) } else { (x1, x0) };
        let (ly, hy) = if y0 < y1 { (y0, y1) } else { (y1, y0) };
        let mask = if self.mask_needed(lx - width, ly - width, hx - lx + width * 2.0, hy - ly + width * 2.0) { self.current_mask.as_ref() } else { None };
        self.pixmap.stroke_path(&path, &paint, &stroke,
                                self.xf, mask);
    }

    /// `(x, y, w, h)` of the box holding a flat `[x0, y0, x1, y1, …]` point
    /// list, grown by `pad` on every side. `None` for an empty list.
    fn points_box(pts: &[f32], pad: f64) -> Option<(f64, f64, f64, f64)> {
        let mut it = pts.chunks_exact(2);
        let first = it.next()?;
        let (mut l, mut t, mut r, mut b) = (first[0], first[1], first[0], first[1]);
        for p in it { l = l.min(p[0]); r = r.max(p[0]); t = t.min(p[1]); b = b.max(p[1]); }
        Some((l as f64 - pad, t as f64 - pad, (r - l) as f64 + pad * 2.0, (b - t) as f64 + pad * 2.0))
    }

    /// The box around the damage rects, grown by `margin` (`None` for a full
    /// frame, or when a transform means local points aren't screen points).
    fn damage_box(&self, margin: f32) -> Option<(f32, f32, f32, f32)> {
        if !self.xf.is_identity() { return None; }
        let d = self.damage.as_ref()?;
        let l = d.iter().map(|r| r.left()).fold(f32::MAX, f32::min);
        let t = d.iter().map(|r| r.top()).fold(f32::MAX, f32::min);
        let r = d.iter().map(|r| r.right()).fold(f32::MIN, f32::max);
        let b = d.iter().map(|r| r.bottom()).fold(f32::MIN, f32::max);
        Some((l - margin, t - margin, r + margin, b + margin))
    }

    /// A filled polygon only has to be rasterized where the damage is: tiny-skia
    /// scan-converts a whole path before the clip mask trims it, so a chart's
    /// area fill costs the same for a thin crosshair strip as for a repaint of
    /// the whole chart. Returns the polygon cut to the damage (grown a couple of
    /// pixels, so its new edges never reach a visible pixel), or `None` when
    /// there is nothing to gain: no damage, a transform, or it already fits.
    fn clip_fill_to_damage(&self, pts: &[f32]) -> Option<Vec<f32>> {
        let (l, t, r, b) = self.damage_box(2.0)?;
        let (x, y, w, h) = Self::points_box(pts, 0.0)?;
        let inside = x as f32 >= l && y as f32 >= t && (x + w) as f32 <= r && (y + h) as f32 <= b;
        if inside || w * h < 8_000.0 { return None; }
        Some(clip_polygon_to_box(pts, l, t, r, b))
    }

    pub fn fill_path(&mut self, pts: &[f32], color: peniko::Color) {
        if let Some((x, y, w, h)) = Self::points_box(pts, 0.0) { if self.culled(x, y, w, h) { return; } }
        let clipped = self.clip_fill_to_damage(pts);
        let pts = match &clipped { Some(c) if c.len() < 6 => return, Some(c) => c.as_slice(), None => pts };
        let Some(path) = poly_path(pts, true) else { return };
        let paint = solid_paint(color);
        let needs = Self::points_box(pts, 0.0).map_or(true, |(x, y, w, h)| self.mask_needed(x, y, w, h));
        let mask  = if needs { self.current_mask.as_ref() } else { None };
        self.pixmap.fill_path(&path, &paint, tiny_skia::FillRule::Winding,
                              self.xf, mask);
    }

    /// `fill_path` with any brush (a linear gradient for chart area fills).
    /// The precomputed strip for `brush` when it is a vertical gradient and the
    /// transform is a plain translation (a rotated or scaled strip would be
    /// sampled unevenly, so those keep the exact gradient shader).
    fn gradient_strip(&self, brush: &peniko::Brush) -> Option<(tiny_skia::Pixmap, f32)> {
        match brush {
            peniko::Brush::Gradient(g) if self.xf.is_identity() || self.xf.is_translate() => vertical_gradient_strip(g),
            _ => None,
        }
    }

    pub fn fill_path_with_brush(&mut self, pts: &[f32], brush: &peniko::Brush) {
        if let Some((x, y, w, h)) = Self::points_box(pts, 0.0) { if self.culled(x, y, w, h) { return; } }
        let clipped = self.clip_fill_to_damage(pts);
        let pts = match &clipped { Some(c) if c.len() < 6 => return, Some(c) => c.as_slice(), None => pts };
        let Some(path) = poly_path(pts, true) else { return };
        let strip = self.gradient_strip(brush);
        let Some(paint) = brush_paint(brush, &strip) else { return };
        let needs = Self::points_box(pts, 0.0).map_or(true, |(x, y, w, h)| self.mask_needed(x, y, w, h));
        let mask = if needs { self.current_mask.as_ref() } else { None };
        self.pixmap.fill_path(&path, &paint, tiny_skia::FillRule::Winding, self.xf, mask);
    }

    pub fn stroke_path(&mut self, pts: &[f32], width: f64, closed: bool, color: peniko::Color) {
        if let Some((x, y, w, h)) = Self::points_box(pts, width) { if self.culled(x, y, w, h) { return; } }
        // An open polyline is only stroked where it comes near the damage.
        if !closed {
            if let (Some((l, t, r, b)), Some((x, y, w, h))) = (self.damage_box(0.0), Self::points_box(pts, width)) {
                let fits = x as f32 >= l && y as f32 >= t && (x + w) as f32 <= r && (y + h) as f32 <= b;
                if !fits && pts.len() >= 8 {
                    for (a, z) in polyline_runs_near(pts, l, t, r, b, width as f32 + 2.0) {
                        self.stroke_polyline(&pts[a * 2..z * 2 + 2], width, false, color);
                    }
                    return;
                }
            }
        }
        self.stroke_polyline(pts, width, closed, color);
    }

    /// Strokes the polyline exactly as given (`stroke_path` decides which parts).
    fn stroke_polyline(&mut self, pts: &[f32], width: f64, closed: bool, color: peniko::Color) {
        let Some(path) = poly_path(pts, closed) else { return };
        let paint  = solid_paint(color);
        let stroke = tiny_skia::Stroke {
            width: width as f32,
            line_cap:  tiny_skia::LineCap::Round,
            line_join: tiny_skia::LineJoin::Round,
            ..Default::default()
        };
        // Round joins and caps reach past the points by half the width.
        let needs = Self::points_box(pts, width).map_or(true, |(x, y, w, h)| self.mask_needed(x, y, w, h));
        let mask = if needs { self.current_mask.as_ref() } else { None };
        self.pixmap.stroke_path(&path, &paint, &stroke,
                                self.xf, mask);
    }

    // ── Text ──────────────────────────────────────────────────────────────────

    /// Rasterize a Parley text layout at `(x, y)` using swash glyph outlines.
    ///
    /// Alpha masks are cached in `shared.glyph_cache` (color-independent).
    /// On a cache hit the mask is colorized in ~O(pixels) arithmetic and blitted
    /// directly — no swash rasterization at all.
    pub fn draw_text(&mut self, layout: &glyx_text::TextLayout, x: f64, y: f64,
                     color: peniko::Color) {
        // 2px slack: glyphs (italics, swashes) can extend slightly past the
        // shaped advance box.
        if self.culled(x - 2.0, y - 2.0,
                       layout.width() as f64 + 4.0, layout.height() as f64 + 4.0) { return; }
        use swash::{FontRef, scale::{Render, Source}, zeno::Format};

        let q   = color.to_rgba8();
        let (cr, cg, cb) = (q.r, q.g, q.b);
        let xf  = self.xf;
        // Same slack as the cull above.
        let text_mask_needed = self.mask_needed(x - 2.0, y - 2.0,
            layout.width() as f64 + 4.0, layout.height() as f64 + 4.0);

        for line in layout.inner.lines() {
            for item in line.items() {
                let parley::layout::PositionedLayoutItem::GlyphRun(gr) = item else { continue };
                let run      = gr.run();
                let font     = run.font();
                let size     = run.font_size();
                let baseline = gr.baseline() as f64;
                let run_off  = gr.offset()   as f64;

                let font_data  = font.data.data();
                let font_index = font.index;
                let data_ptr   = font_data.as_ptr() as usize;
                let size_class = (size * 4.0) as u16;

                let Some(font_ref) = FontRef::from_index(font_data, font_index as usize)
                    else { continue };

                let glyph_key = |glyph_id: swash::GlyphId| GlyphKey {
                    data_ptr, font_index, glyph_id, size_class,
                };

                // Pass 1: rasterize whatever this run is missing, in one go with
                // one scaler. Building a scaler costs far more than drawing a
                // cached glyph (~20x a whole cached label), so it must be paid
                // only for glyphs that are genuinely new — never per frame, and
                // never per glyph. A glyph with nothing to draw (a space) is
                // remembered as empty too, or any label with a space in it
                // would rebuild a scaler on every frame to rediscover that.
                // `scaler` borrows self.shared.scale_ctx — separate from
                // self.pixmap and self.shared.glyph_cache via field splitting.
                if gr.glyphs().any(|g| !self.shared.glyph_cache.contains(&glyph_key(g.id as u16))) {
                    let mut scaler = self.shared.scale_ctx
                        .builder(font_ref)
                        .size(size)
                        .hint(true)
                        .build();
                    for g in gr.glyphs() {
                        let glyph_id: swash::GlyphId = g.id as u16;
                        let key = glyph_key(glyph_id);
                        if self.shared.glyph_cache.contains(&key) { continue; }
                        let rendered = Render::new(&[Source::Outline])
                            .format(Format::Alpha)
                            .render(&mut scaler, glyph_id)
                            .filter(|img| img.placement.width > 0 && img.placement.height > 0);
                        let entry = match rendered {
                            // Raw alpha, color-independent: colorized at draw time.
                            Some(image) => CachedAlphaGlyph {
                                alpha:  image.data.to_vec(),
                                width:  image.placement.width,
                                height: image.placement.height,
                                left:   image.placement.left,
                                top:    image.placement.top,
                            },
                            None => CachedAlphaGlyph { alpha: Vec::new(), width: 0, height: 0, left: 0, top: 0 },
                        };
                        self.shared.glyph_cache.put(key, entry);
                    }
                }

                // Pass 2: draw from the cache.
                // In Parley 0.10, g.x / g.y are shaping *adjustments* from the
                // current pen, NOT cumulative positions.  Advance pen by g.advance.
                let mut pen_x = run_off;
                let mask = if text_mask_needed { self.current_mask.as_ref() } else { None };

                for g in gr.glyphs() {
                    let bx = (x + pen_x + g.x as f64) as i32;
                    let by = (y + baseline + g.y as f64) as i32;
                    pen_x += g.advance as f64;

                    // The cache stores the raw alpha mask — no color in the
                    // key. (A glyph evicted mid-run by a full cache is skipped
                    // for this frame and re-rasterized by the next.)
                    let Some(cached) = self.shared.glyph_cache.get(&glyph_key(g.id as u16)) else { continue };
                    if cached.width == 0 || cached.height == 0 { continue; } // a space
                    let draw_x = bx + cached.left;
                    let draw_y = by - cached.top;
                    // Colorize cached alpha into premultiplied RGBA.
                    let mut rgba = Vec::with_capacity((cached.width * cached.height * 4) as usize);
                    for &alpha in &cached.alpha {
                        let a = alpha as u32;
                        rgba.push((cr as u32 * a / 255) as u8);
                        rgba.push((cg as u32 * a / 255) as u8);
                        rgba.push((cb as u32 * a / 255) as u8);
                        rgba.push(alpha);
                    }
                    if let Some(glyph_pm) = tiny_skia::PixmapRef::from_bytes(
                        &rgba, cached.width, cached.height,
                    ) {
                        self.pixmap.draw_pixmap(
                            draw_x, draw_y, glyph_pm,
                            &tiny_skia::PixmapPaint::default(),
                            xf,
                            mask,
                        );
                    }
                }
            }
        }
    }

    // ── Images ────────────────────────────────────────────────────────────────

    pub fn draw_image(&mut self, image: &peniko::ImageData, x: f64, y: f64,
                      w: f64, h: f64) {
        if self.culled(x, y, w, h) { return; }
        let (iw, ih) = (image.width, image.height);
        if iw == 0 || ih == 0 { return; }
        let rgba = self.srgb_bytes(image, true);
        self.blit_scaled(&rgba, iw, ih, x, y, w, h);
    }

    /// Convert `image`'s linear-premultiplied (and possibly BGRA) bytes to
    /// sRGB-premultiplied RGBA — see `linear_premul_to_srgb_premul` above.
    /// With `cache`, memoized per source blob in `shared.image_cache`; without
    /// it (live camera/video frames, each shown once) converted fresh and not
    /// stored, so a stream can't flood the cache with hundreds of frames.
    fn srgb_bytes(&mut self, image: &peniko::ImageData, cache: bool) -> Vec<u8> {
        let bytes = image.data.data();
        let key = image.data.id();
        if cache {
            if let Some(cached) = self.shared.image_cache.get(&key) {
                return cached.clone();
            }
        }
        let converted = match image.format {
            peniko::ImageFormat::Bgra8 => {
                let mut rgba = bytes.to_vec();
                linear_premul_to_srgb_premul_in_place(&mut rgba, true);
                rgba
            }
            _ => linear_premul_to_srgb_premul(bytes),
        };
        if cache {
            self.shared.image_cache.put(key, converted.clone());
        }
        converted
    }

    pub fn draw_image_with_transform(&mut self, image: &peniko::ImageData, transform: Affine) {
        self.draw_image_transformed(image, transform, true);
    }

    /// Like `draw_image_with_transform`, for a live camera/video frame: each
    /// frame is a new image shown once, so its converted bytes aren't cached.
    pub fn draw_frame_image(&mut self, image: &peniko::ImageData, transform: Affine) {
        self.draw_image_transformed(image, transform, false);
    }

    fn draw_image_transformed(&mut self, image: &peniko::ImageData, transform: Affine, cache: bool) {
        let (iw, ih) = (image.width, image.height);
        if iw == 0 || ih == 0 { return; }
        let bytes = self.srgb_bytes(image, cache);

        // kurbo Affine [a,b,c,d,e,f]:  x'=ax+cy+e, y'=bx+dy+f
        // tiny-skia from_row(sx,ky,kx,sy,tx,ty): x'=sx*x+kx*y+tx, y'=ky*x+sy*y+ty
        let [a, b, c, d, e, f] = transform.as_coeffs();
        let ts = self.xf.pre_concat(tiny_skia::Transform::from_row(
            a as f32, b as f32, c as f32, d as f32, e as f32, f as f32,
        ));

        let apply = |src: &[u8], pixmap: &mut tiny_skia::Pixmap,
                     mask: Option<&tiny_skia::Mask>| {
            if let Some(pm) = tiny_skia::PixmapRef::from_bytes(src, iw, ih) {
                let shader = tiny_skia::Pattern::new(
                    pm,
                    tiny_skia::SpreadMode::Pad,
                    tiny_skia::FilterQuality::Bilinear,
                    1.0,
                    ts,
                );
                let paint = tiny_skia::Paint { shader, anti_alias: true, ..Default::default() };
                let pw = pixmap.width() as f32;
                let ph = pixmap.height() as f32;
                if let Some(r) = tiny_skia::Rect::from_xywh(0.0, 0.0, pw, ph) {
                    pixmap.fill_rect(r, &paint, tiny_skia::Transform::identity(), mask);
                }
            }
        };

        // `bytes` is already RGBA + sRGB-converted by `srgb_bytes` above —
        // the BGRA swap (if any) already happened there, doing it again here
        // would undo it.
        self.ensure_mask();
        let mask = self.current_mask.as_ref();
        apply(&bytes, &mut self.pixmap, mask);
    }

    /// Scale and blit `src` (RGBA, iw×ih) to fill the destination rect.
    fn blit_scaled(&mut self, src: &[u8], iw: u32, ih: u32,
                   x: f64, y: f64, w: f64, h: f64) {
        let Some(src_pm) = tiny_skia::PixmapRef::from_bytes(src, iw, ih) else { return };

        let dw = w.ceil() as u32;
        let dh = h.ceil() as u32;
        if dw == 0 || dh == 0 { return; }

        let paint = tiny_skia::PixmapPaint {
            opacity:    1.0,
            blend_mode: tiny_skia::BlendMode::SourceOver,
            quality:    tiny_skia::FilterQuality::Bilinear,
        };
        self.ensure_mask();
        let mask = self.current_mask.as_ref();

        if iw == dw && ih == dh {
            // 1:1 blit — place source directly at (x, y).
            self.pixmap.draw_pixmap(
                x as i32, y as i32,
                src_pm,
                &paint,
                self.xf,
                mask,
            );
        } else {
            // Scaled blit — draw into a temporary pixmap at destination size,
            // then blit the temporary to (x, y).
            let Some(mut tmp) = tiny_skia::Pixmap::new(dw, dh) else { return };
            // `Pattern`'s transform maps PATTERN space -> destination space,
            // so shrinking a `iw`x`ih` source to fit a `dw`x`dh` box needs
            // scale = dw/iw (< 1 for downscale), not iw/dw. The inverted
            // version previously here *enlarged* the pattern before
            // filling a `dw`x`dh` rect, so only a small corner of the
            // enlarged source ever landed inside the fill — visible as the
            // image being cropped to its top-left corner on any real
            // downscale (mild ratios looked like odd "zoomed in" framing;
            // more aggressive ratios showed it outright).
            let sx = dw as f32 / iw as f32;
            let sy = dh as f32 / ih as f32;
            let shader = tiny_skia::Pattern::new(
                src_pm,
                tiny_skia::SpreadMode::Pad,
                tiny_skia::FilterQuality::Bilinear,
                1.0,
                tiny_skia::Transform::from_scale(sx, sy),
            );
            let fill = tiny_skia::Paint { shader, ..Default::default() };
            if let Some(r) = tiny_skia::Rect::from_xywh(0.0, 0.0, dw as f32, dh as f32) {
                tmp.fill_rect(r, &fill, tiny_skia::Transform::identity(), None);
            }
            self.pixmap.draw_pixmap(
                x as i32, y as i32,
                tmp.as_ref(),
                &paint,
                self.xf,
                mask,
            );
        }
    }

    // ── Layers / clipping ─────────────────────────────────────────────────────

    fn push_clip_path(&mut self, path: &tiny_skia::Path) {
        self.ensure_mask();
        // The new mask folds in whatever rect clip is pending, so from here the
        // clip is the mask alone; the rect set and mask are saved to restore.
        let saved = self.current_mask.take();
        let saved_pending = self.pending_base.take();
        let saved_flag = std::mem::replace(&mut self.mask_is_rects, false);
        let new_mask = match saved.as_ref() {
            Some(parent) => {
                let mut m = parent.clone();
                m.intersect_path(path, tiny_skia::FillRule::Winding, true, self.xf);
                Some(m)
            }
            None => {
                let w = self.pixmap.width();
                let h = self.pixmap.height();
                let xf = self.xf;
                tiny_skia::Mask::new(w, h).map(|mut m| {
                    m.fill_path(path, tiny_skia::FillRule::Winding, true, xf);
                    m
                })
            }
        };
        self.clip_stack.push((saved, saved_pending, saved_flag));
        self.current_mask = new_mask;
    }

    /// Clip to an axis-aligned rect without building a mask: fold it into the
    /// pending rect (see `pending_base`). Returns `false` when it can't — a
    /// mask is already built, the transform isn't a plain translation, or the
    /// rect doesn't overlap the current clip — and the caller builds one.
    fn push_clip_rect(&mut self, x: f64, y: f64, w: f64, h: f64) -> bool {
        #[cfg(test)]
        if NO_LAZY_CLIP.load(std::sync::atomic::Ordering::Relaxed) { return false; }
        if !(self.xf.is_identity() || self.xf.is_translate()) { return false; }
        let (l, t, r, b) = self.screen_bbox(x, y, w, h);
        if self.current_mask.is_some() && !self.mask_is_rects {
            // The clip is already a mask (a rounded or rotated layer): narrow a
            // copy of it to this rect directly instead of rasterizing a path.
            if !(r > l && b > t) { return false; }
            let Some(parent) = self.current_mask.take() else { return false };
            let mut narrowed = parent.clone();
            mask_intersect_rect(&mut narrowed, l, t, r, b);
            self.clip_stack.push((Some(parent), self.pending_base.take(), false));
            self.current_mask = Some(narrowed);
            return true;
        }
        let merged = match &self.pending_base {
            // Every pending rect cut down to the layer; none left means it
            // misses the clip altogether, which a mask has to handle.
            Some(p) => match p.clipped_to(l, t, r, b) { Some(m) => m, None => return false },
            None => {
                if !(r > l && b > t) { return false; }
                let Some(rect) = tiny_skia::Rect::from_ltrb(l, t, r, b) else { return false };
                let Some(set) = RectSet::from_slice(&[rect]) else { return false };
                set
            }
        };
        // The cached mask (if any) belongs to the clip being narrowed: set it
        // aside, and build a new one only if a draw crosses the narrower edge.
        let saved = self.current_mask.take();
        self.clip_stack.push((saved, self.pending_base, self.mask_is_rects));
        self.mask_is_rects = false;
        self.pending_base = Some(merged);
        true
    }

    pub fn push_layer(&mut self, x: f64, y: f64, w: f64, h: f64) {
        if self.push_clip_rect(x, y, w, h) { return; }
        if let Some(path) = rrect_path(x as f32, y as f32, w as f32, h as f32, 0.0) {
            self.push_clip_path(&path);
        }
    }

    pub fn push_rounded_layer(&mut self, x: f64, y: f64, w: f64, h: f64, radius: f64) {
        if let Some(path) = rrect_path(x as f32, y as f32, w as f32, h as f32, radius as f32) {
            self.push_clip_path(&path);
        }
    }

    pub fn push_layer_with_alpha(&mut self, x: f64, y: f64, w: f64, h: f64, _alpha: f32) {
        // Clip is applied; per-layer opacity compositing is not implemented in this experiment.
        self.push_layer(x, y, w, h);
    }

    pub fn pop_layer(&mut self) {
        // Back to the clip as it was before the matching push: its mask, or the
        // rect still waiting to become one.
        let (mask, pending, rects) = self.clip_stack.pop().unwrap_or((None, None, false));
        self.current_mask = mask;
        self.pending_base = pending;
        self.mask_is_rects = rects;
    }
}

// ── Persistent staging buffers ────────────────────────────────────────────────

/// One persistently-mapped `MAP_WRITE | COPY_SRC` GPU buffer for zero-allocation
/// pixmap upload.  `map_async` re-maps the buffer after the GPU consumes it,
/// bounding staging memory to exactly `w × h × 4` bytes regardless of frame
/// rate — eliminating the per-frame allocation that `queue.write_texture()` causes
/// through wgpu's internal StagingPool.  A single buffer means the CPU may wait
/// for the GPU copy of the previous frame before writing the next one; for a UI
/// workload (a memcpy-sized copy, mostly idle frames) that wait is negligible and
/// halves staging memory vs. double-buffering.
struct StagingBuf {
    buf:   wgpu::Buffer,
    /// `true` when the buffer is mapped and ready for CPU writes.
    ready: Arc<Mutex<bool>>,
    /// Row stride in the staging buffer, aligned to COPY_BYTES_PER_ROW_ALIGNMENT.
    /// May be > `width * 4` when width is not a multiple of 64.
    bytes_per_row: u32,
}

impl StagingBuf {
    fn new(device: &wgpu::Device, w: u32, h: u32) -> Self {
        // copy_buffer_to_texture requires bytes_per_row to be a multiple of
        // COPY_BYTES_PER_ROW_ALIGNMENT (256).  Round up to the next multiple.
        let raw   = w * 4;
        let align = wgpu::COPY_BYTES_PER_ROW_ALIGNMENT;
        let bpr   = (raw + align - 1) & !(align - 1);
        let size  = bpr as u64 * h as u64;
        let buf   = device.create_buffer(&wgpu::BufferDescriptor {
            label:              Some("skia-staging"),
            size,
            usage:              wgpu::BufferUsages::MAP_WRITE | wgpu::BufferUsages::COPY_SRC,
            mapped_at_creation: true,
        });
        Self {
            buf,
            ready:         Arc::new(Mutex::new(true)),
            bytes_per_row: bpr,
        }
    }
}

// ── TinySkiaRenderer ──────────────────────────────────────────────────────────

/// wgpu resources for presenting the CPU pixmap through a swapchain.
/// Absent when the renderer was created via `new_cpu_only` (softbuffer present).
struct GpuUpload {
    upload_texture: wgpu::Texture,
    upload_view:    wgpu::TextureView,
    blit:           CachedBlit,
    staging:        StagingBuf,
    /// Actual dimensions of `upload_texture`.  May differ from renderer
    /// width/height when `notify_resize` updated the dims but `render_frame`
    /// hasn't had a chance to recreate the texture yet.
    upload_w:       u32,
    upload_h:       u32,
}

/// Manages CPU rasterization (and optionally CPU→GPU upload) for the
/// tiny-skia backend.
pub struct TinySkiaRenderer {
    gpu_upload:     Option<GpuUpload>,
    width:          u32,
    height:         u32,
    pub background_color: peniko::Color,
    /// Swash context + glyph cache — moved into TinySkiaFrame during render.
    shared:         Option<TinySkiaShared>,
}

impl TinySkiaRenderer {
    fn make_shared() -> Option<TinySkiaShared> {
        Some(TinySkiaShared {
            scale_ctx:   swash::scale::ScaleContext::new(),
            // 2048 entries ≈ ~1 MB for typical UI text; ample headroom for
            // several font sizes' worth of Latin glyphs without thrashing.
            glyph_cache: lru::LruCache::new(std::num::NonZeroUsize::new(2048).unwrap()),
            pixmap:      None,
            image_cache: lru::LruCache::new(std::num::NonZeroUsize::new(256).unwrap()),
        })
    }

    pub fn new(gpu: &GpuContext) -> Result<Self, RendererError> {
        log::info!("glyx-renderer: tiny-skia CPU backend active (wgpu present).");
        let w = gpu.width().max(1);
        let h = gpu.height().max(1);
        let (texture, view) = Self::make_upload(gpu, w, h);
        // Raw (non-sRGB) pipeline format: the upload texture holds TinySkia's
        // raw CPU pixmap bytes, already final-encoded — writing them through
        // an sRGB-format pipeline/view would double-apply gamma on store.
        // See `GpuContext::surface_format_raw` (same fix as Vello's blit).
        let mut blit = CachedBlit::new(&gpu.device, gpu.surface_format_raw());
        blit.set_source(&gpu.device, &view);
        let staging = StagingBuf::new(&gpu.device, w, h);
        Ok(Self {
            gpu_upload: Some(GpuUpload {
                upload_texture: texture,
                upload_view:    view,
                blit, staging,
                upload_w: w, upload_h: h,
            }),
            width: w, height: h,
            background_color: crate::colors::BACKGROUND,
            shared: Self::make_shared(),
        })
    }

    /// CPU-only renderer: rasterizes to the pixmap with no wgpu resources at
    /// all.  The caller presents via [`finish_frame_soft`] (softbuffer / DIB).
    pub fn new_cpu_only(w: u32, h: u32) -> Self {
        log::info!("glyx-renderer: tiny-skia CPU backend active (software present, no wgpu).");
        Self {
            gpu_upload: None,
            width: w.max(1), height: h.max(1),
            background_color: crate::colors::BACKGROUND,
            shared: Self::make_shared(),
        }
    }

    /// Finalize a frame for software present: hands the premultiplied RGBA8
    /// pixel data (plus the frame's damage rect, `None` = full) to `write`,
    /// then returns the pixmap to the pool.  No GPU work.
    pub fn finish_frame_soft(
        &mut self,
        frame: TinySkiaFrame,
        write: impl FnOnce(&[u8], u32, u32, Option<&[(u32, u32, u32, u32)]>),
    ) {
        let damage = frame.damage();
        let TinySkiaFrame { pixmap, shared, .. } = frame;
        let w = pixmap.width();
        let h = pixmap.height();
        write(pixmap.data(), w, h, damage.as_deref());
        let mut shared = shared;
        if self.width == w && self.height == h {
            shared.pixmap = Some(pixmap);
        }
        self.shared = Some(shared);
    }

    fn make_upload(gpu: &GpuContext, w: u32, h: u32)
        -> (wgpu::Texture, wgpu::TextureView)
    {
        let tex = gpu.device.create_texture(&wgpu::TextureDescriptor {
            label:           Some("skia-upload"),
            size:            wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
            mip_level_count: 1,
            sample_count:    1,
            dimension:       wgpu::TextureDimension::D2,
            format:          wgpu::TextureFormat::Rgba8Unorm,
            usage:           wgpu::TextureUsages::TEXTURE_BINDING
                           | wgpu::TextureUsages::COPY_DST,
            view_formats:    &[],
        });
        let view = tex.create_view(&Default::default());
        (tex, view)
    }

    pub fn begin_frame(&mut self) -> TinySkiaFrame {
        let shared = self.shared.take().expect("skia: frame already in progress");
        TinySkiaFrame::new(self.width, self.height, self.background_color, shared)
            .expect("Pixmap creation failed — zero-sized window?")
    }

    /// Begin a frame restricted to a damage rect (falls back to a full frame
    /// when no pooled pixmap is available — first frame or just-resized).
    pub fn begin_frame_damaged(&mut self, damage: Option<&[(f64, f64, f64, f64)]>) -> TinySkiaFrame {
        let shared = self.shared.take().expect("skia: frame already in progress");
        TinySkiaFrame::new_damaged(self.width, self.height, self.background_color, shared, damage)
            .expect("Pixmap creation failed — zero-sized window?")
    }

    pub fn render_frame(
        &mut self,
        gpu:     &GpuContext,
        texture: &wgpu::SurfaceTexture,
        frame:   TinySkiaFrame,
    ) -> Result<(), RendererError> {
        // Destructure frame so we can move pixmap independently of shared.
        let TinySkiaFrame { pixmap, mut shared, .. } = frame;

        // Use the pixmap's actual dimensions as the source of truth.
        // `notify_resize` may have updated self.width/height ahead of this call,
        // so comparing against gpu.width() alone is not sufficient.
        let w = pixmap.width();
        let h = pixmap.height();

        let up = self.gpu_upload.as_mut()
            .expect("skia: render_frame called on a cpu-only renderer (use finish_frame_soft)");

        // Recreate upload texture AND staging buffers on resize.
        if up.upload_w != w || up.upload_h != h {
            up.upload_w = w;
            up.upload_h = h;
            let (tex, view) = Self::make_upload(gpu, w, h);
            up.upload_texture = tex;
            up.upload_view    = view;
            // Refresh cached bind group for the new texture view — pipeline is reused.
            up.blit.set_source(&gpu.device, &up.upload_view);
            // New staging buffers sized for the new resolution.
            // Old buffers are dropped here; wgpu schedules their GPU-side destruction
            // after any pending commands referencing them complete.
            up.staging = StagingBuf::new(&gpu.device, w, h);
        }

        // Non-blocking poll: process completed GPU work and fire any pending
        // map_async callbacks so staging slots are available for CPU writes.
        let _ = gpu.device.poll(wgpu::PollType::Poll);

        // --- Persistent staging upload (replaces queue.write_texture) ----------
        // Single-buffered: if the GPU hasn't finished copying last frame's pixels
        // yet, block until it has.  The copy is a plain memcpy-sized transfer, so
        // this wait is sub-millisecond even on integrated GPUs.
        if !*up.staging.ready.lock().unwrap() {
            let _ = gpu.device.poll(wgpu::PollType::Wait { submission_index: None, timeout: None });
        }

        // Write CPU pixels into the currently-mapped staging buffer.
        // If bytes_per_row > w*4 (alignment padding), copy row-by-row so padding
        // bytes stay in the correct positions expected by copy_buffer_to_texture.
        let bpr     = up.staging.bytes_per_row as usize;
        let row_src = w as usize * 4;
        {
            let mut view = up.staging.buf.slice(..).get_mapped_range_mut();
            let src = pixmap.data();
            if bpr == row_src {
                // Tightly-packed rows — single copy.
                view.copy_from_slice(src);
            } else {
                // Width not a multiple of 64 px: write each row separately,
                // leaving the alignment-padding bytes between rows untouched.
                for row in 0..h as usize {
                    let s = row * row_src;
                    let d = row * bpr;
                    view.slice(d..d + row_src)
                        .copy_from_slice(&src[s..s + row_src]);
                }
            }
        }
        *up.staging.ready.lock().unwrap() = false;
        up.staging.buf.unmap();

        // One command buffer: copy staging → upload texture, then blit to surface.
        // Raw (non-sRGB) view — see the comment on `blit`'s construction above.
        let surface_view = texture.texture.create_view(&wgpu::TextureViewDescriptor {
            format: Some(gpu.surface_format_raw()),
            ..Default::default()
        });
        let mut enc = gpu.device.create_command_encoder(
            &wgpu::CommandEncoderDescriptor { label: Some("skia-blit") });
        enc.copy_buffer_to_texture(
            wgpu::TexelCopyBufferInfo {
                buffer: &up.staging.buf,
                layout: wgpu::TexelCopyBufferLayout {
                    offset:         0,
                    bytes_per_row:  Some(up.staging.bytes_per_row),
                    rows_per_image: None,
                },
            },
            up.upload_texture.as_image_copy(),
            wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
        );
        up.blit.copy(&mut enc, &surface_view);
        gpu.queue.submit([enc.finish()]);

        // Schedule async re-map AFTER submit.  The callback fires on the next
        // poll() once the GPU has finished the copy, which takes at most one
        // frame; if it hasn't fired by then, render_frame blocks briefly above.
        let ready_clone = Arc::clone(&up.staging.ready);
        up.staging.buf.slice(..).map_async(wgpu::MapMode::Write, move |r| {
            if r.is_ok() { *ready_clone.lock().unwrap() = true; }
        });
        // -----------------------------------------------------------------------

        // Return pixmap to pool (same size → reuse the allocation next frame).
        // On resize the old pixmap is dropped and the pool stays empty until
        // the next call to TinySkiaFrame::new allocates a fresh one.
        if self.width == w && self.height == h {
            shared.pixmap = Some(pixmap);
        }
        self.shared = Some(shared);
        Ok(())
    }

    pub fn blit_cached_frame(
        &self,
        gpu:     &GpuContext,
        texture: &wgpu::SurfaceTexture,
    ) -> Result<(), RendererError> {
        let Some(up) = self.gpu_upload.as_ref() else { return Ok(()) };
        // Raw (non-sRGB) view — see the comment on `blit`'s construction above.
        let surface_view = texture.texture.create_view(&wgpu::TextureViewDescriptor {
            format: Some(gpu.surface_format_raw()),
            ..Default::default()
        });
        let mut enc = gpu.device.create_command_encoder(
            &wgpu::CommandEncoderDescriptor { label: Some("skia-blit-cached") });
        up.blit.copy(&mut enc, &surface_view);
        gpu.queue.submit([enc.finish()]);
        Ok(())
    }

    /// Sync stored dimensions to the current GPU surface size.
    ///
    /// Must be called before `begin_frame()` whenever the window has been resized.
    /// `begin_frame` creates the Pixmap at `self.width × self.height`; if those
    /// are stale, the pixmap / wgpu upload dims diverge and wgpu panics.
    pub fn notify_resize(&mut self, w: u32, h: u32) {
        self.width  = w;
        self.height = h;
    }

    /// Drop cached glyph alpha masks / converted image bytes to free CPU
    /// memory under pressure.
    pub fn trim_resources(&mut self) {
        if let Some(shared) = self.shared.as_mut() {
            shared.glyph_cache.clear();
            shared.image_cache.clear();
        }
    }

    pub fn try_save_pipeline_cache(&self) {}
}

#[cfg(test)]
mod image_cache_tests {
    #[test]
    fn lut_conversion_matches_the_exact_formula() {
        let px: Vec<u8> = (0..=255u8).flat_map(|v| [v, 255 - v, v / 2, 255]).collect();
        let fast = super::linear_premul_to_srgb_premul(&px);
        for (i, v) in (0..=255u8).enumerate() {
            assert_eq!(fast[i * 4], super::linear_to_srgb_u8(v));
            assert_eq!(fast[i * 4 + 1], super::linear_to_srgb_u8(255 - v));
            assert_eq!(fast[i * 4 + 3], 255);
        }
    }

    use super::*;

    /// Bytes read through a raw pointer, so a test can put DIFFERENT content
    /// at the SAME address — exactly what allocator reuse does to back-to-back
    /// same-sized camera/video frames.
    struct RawBytes(*const u8, usize);
    unsafe impl Send for RawBytes {}
    unsafe impl Sync for RawBytes {}
    impl AsRef<[u8]> for RawBytes {
        fn as_ref(&self) -> &[u8] { unsafe { std::slice::from_raw_parts(self.0, self.1) } }
    }

    fn image(bytes: std::sync::Arc<dyn AsRef<[u8]> + Send + Sync>, w: u32, h: u32) -> peniko::ImageData {
        peniko::ImageData {
            data: peniko::Blob::new(bytes),
            format: peniko::ImageFormat::Rgba8,
            alpha_type: peniko::ImageAlphaType::Alpha,
            width: w, height: h,
        }
    }

    fn fill(buf: &mut [u8], rgba: [u8; 4]) {
        for px in buf.chunks_exact_mut(4) { px.copy_from_slice(&rgba); }
    }

    fn center_pixel(frame: &TinySkiaFrame) -> [u8; 4] {
        let p = frame.pixmap.pixel(2, 2).expect("in bounds");
        [p.red(), p.green(), p.blue(), p.alpha()]
    }

    #[test]
    fn a_new_image_at_a_reused_address_is_not_served_from_the_cache() {
        // Regression: the cache was keyed by the bytes' address. A frame freed
        // and the next one allocated at the same address hit the old entry, so
        // camera/video showed stale frames mixed with live ones.
        let mut buf = vec![0u8; 4 * 4 * 4];
        let ptr = buf.as_mut_ptr();
        let mut r = TinySkiaRenderer::new_cpu_only(4, 4);
        let mut frame = r.begin_frame();

        fill(&mut buf, [255, 0, 0, 255]);
        let red = image(std::sync::Arc::new(RawBytes(ptr, buf.len())), 4, 4);
        frame.draw_image_with_transform(&red, Affine::IDENTITY);
        let first = center_pixel(&frame);

        // Same address, new content — a different image.
        fill(&mut buf, [0, 255, 0, 255]);
        let green = image(std::sync::Arc::new(RawBytes(ptr, buf.len())), 4, 4);
        frame.draw_image_with_transform(&green, Affine::IDENTITY);
        let second = center_pixel(&frame);

        assert!(first[0] > first[1], "first draw should be red: {first:?}");
        assert!(second[1] > second[0], "second draw must show the NEW (green) content, got {second:?}");
    }

    #[test]
    fn live_frames_do_not_accumulate_in_the_image_cache() {
        let mut r = TinySkiaRenderer::new_cpu_only(4, 4);
        let mut frame = r.begin_frame();
        for i in 0..20u8 {
            let mut buf = vec![0u8; 4 * 4 * 4];
            fill(&mut buf, [i, 0, 0, 255]);
            frame.draw_frame_image(&image(std::sync::Arc::new(buf), 4, 4), Affine::IDENTITY);
        }
        assert_eq!(frame.shared.image_cache.len(), 0, "stream frames must bypass the cache");

        // A regular image is still cached (reused across frames).
        let still = image(std::sync::Arc::new(vec![9u8; 4 * 4 * 4]), 4, 4);
        frame.draw_image_with_transform(&still, Affine::IDENTITY);
        frame.draw_image_with_transform(&still, Affine::IDENTITY);
        assert_eq!(frame.shared.image_cache.len(), 1);
    }
}

#[cfg(test)]
mod transform_tests {
    use super::*;

    const RED: peniko::Color = peniko::Color::from_rgba8(255, 0, 0, 255);

    fn px(frame: &TinySkiaFrame, x: u32, y: u32) -> [u8; 4] {
        let p = frame.pixmap.pixel(x, y).expect("in bounds");
        [p.red(), p.green(), p.blue(), p.alpha()]
    }

    fn is_red(p: [u8; 4]) -> bool { p[0] > 200 && p[1] < 50 && p[2] < 50 }

    #[test]
    fn pushed_transform_moves_draws_and_pop_restores() {
        let mut r = TinySkiaRenderer::new_cpu_only(64, 16);
        let mut frame = r.begin_frame();
        frame.push_transform(Affine::translate((40.0, 0.0)));
        frame.fill_rect(0.0, 0.0, 10.0, 10.0, RED);
        frame.pop_transform();
        assert!(is_red(px(&frame, 45, 5)), "drawn at the translated position");
        assert!(!is_red(px(&frame, 5, 5)), "not at the untransformed position");

        frame.fill_rect(0.0, 0.0, 10.0, 10.0, RED);
        assert!(is_red(px(&frame, 5, 5)), "identity again after pop");
    }

    #[test]
    fn nested_transforms_compose() {
        let mut r = TinySkiaRenderer::new_cpu_only(64, 64);
        let mut frame = r.begin_frame();
        frame.push_transform(Affine::translate((20.0, 0.0)));
        frame.push_transform(Affine::translate((0.0, 30.0)));
        frame.fill_rect(0.0, 0.0, 8.0, 8.0, RED);
        frame.pop_transform();
        frame.pop_transform();
        assert!(is_red(px(&frame, 24, 34)));
    }

    #[test]
    fn clips_follow_the_transform() {
        let mut r = TinySkiaRenderer::new_cpu_only(64, 16);
        let mut frame = r.begin_frame();
        frame.push_transform(Affine::translate((40.0, 0.0)));
        frame.push_layer(0.0, 0.0, 10.0, 10.0);
        // Wider than the clip: only the clipped (moved) part may show.
        frame.fill_rect(0.0, 0.0, 20.0, 10.0, RED);
        frame.pop_layer();
        frame.pop_transform();
        assert!(is_red(px(&frame, 45, 5)), "inside the moved clip");
        assert!(!is_red(px(&frame, 55, 5)), "clipped by the moved clip rect");
    }

    #[test]
    fn partial_redraw_never_touches_pixels_outside_the_damage() {
        // The damage clip mask is built lazily; draws straddling the damage
        // edge must still be clipped to it (a fill, a stroke, and text-free
        // path draws that don't check bounds).
        let mut r = TinySkiaRenderer::new_cpu_only(64, 16);
        let seed = r.begin_frame();
        r.finish_frame_soft(seed, |_, _, _, _| {});
        let mut frame = r.begin_frame_damaged(Some(&[(20.0, 0.0, 20.0, 16.0)]));
        frame.fill_rounded_rect(0.0, 0.0, 64.0, 16.0, 4.0, RED);
        frame.stroke_line(0.0, 8.0, 64.0, 8.0, 3.0, RED);
        frame.fill_path(&[0.0, 0.0, 64.0, 0.0, 64.0, 16.0], RED);
        assert!(is_red(px(&frame, 30, 8)), "inside the damage is drawn");
        for x in [5, 15, 45, 60] {
            assert!(!is_red(px(&frame, x, 8)), "x={x} is outside the damage and must be untouched");
        }
    }

    #[test]
    fn partial_redraw_culls_on_the_transformed_bounds() {
        let mut r = TinySkiaRenderer::new_cpu_only(64, 16);
        let seed = r.begin_frame(); // seeds the pooled pixmap so damage is honoured
        r.finish_frame_soft(seed, |_, _, _, _| {});
        let mut frame = r.begin_frame_damaged(Some(&[(40.0, 0.0, 20.0, 16.0)]));
        assert!(frame.damage().is_some());
        // Untransformed box (0..10) is outside the damage; the moved one isn't.
        frame.push_transform(Affine::translate((40.0, 0.0)));
        frame.fill_rect(0.0, 0.0, 10.0, 10.0, RED);
        frame.pop_transform();
        assert!(is_red(px(&frame, 45, 5)), "must not be culled by its untransformed box");
    }
}

#[cfg(test)]
mod text_cost {
    use super::*;
    use std::time::Instant;

    const WHITE: peniko::Color = peniko::Color::from_rgba8(255, 255, 255, 255);

    fn ink(frame: &TinySkiaFrame) -> usize {
        frame.pixmap.pixels().iter().filter(|p| p.alpha() > 0).count()
    }

    #[test]
    fn text_draws_and_a_space_is_remembered_as_empty() {
        let mut ts = glyx_text::TextSystem::new();
        let tight = ts.label("ab", 14.0);
        let spaced = ts.label("a b", 14.0);
        let mut r = TinySkiaRenderer::new_cpu_only(120, 24);

        let mut frame = r.begin_frame();
        frame.draw_text(&tight, 4.0, 4.0, WHITE);
        let first = ink(&frame);
        r.finish_frame_soft(frame, |_, _, _, _| {});
        assert!(first > 0, "text puts pixels on the screen");

        let mut frame = r.begin_frame();
        frame.draw_text(&spaced, 4.0, 4.0, WHITE);
        let with_space = ink(&frame);
        r.finish_frame_soft(frame, |_, _, _, _| {});
        assert!(with_space >= first, "a, b and the gap between them are all drawn: {with_space} vs {first}");
        // a, b and the space: three distinct glyphs, the space stored as empty.
        let cached = r.shared.as_ref().unwrap().glyph_cache.len();
        assert_eq!(cached, 3, "a, b and an empty entry for the space");

        // Drawing it again adds nothing and looks the same (all from cache).
        let mut frame = r.begin_frame();
        frame.draw_text(&spaced, 4.0, 4.0, WHITE);
        assert_eq!(ink(&frame), with_space, "cached glyphs draw identically to freshly rasterized ones");
        r.finish_frame_soft(frame, |_, _, _, _| {});
        assert_eq!(r.shared.as_ref().unwrap().glyph_cache.len(), cached);
    }

    /// What drawing already-shaped text costs per call once its glyphs are
    /// cached: a chart redraws a couple of dozen axis labels on every frame.
    /// Prints the numbers; run with
    /// `cargo test -p glyx-renderer text_cost -- --ignored --nocapture`.
    #[test]
    #[ignore = "benchmark: prints timings"]
    fn drawing_cached_labels_per_call() {
        let mut ts = glyx_text::TextSystem::new();
        let labels: Vec<_> = ["0", "250", "500", "1.0k", "12:03:41", "Total sales", "1.2k", "Jan 12", "New users", "12:03 PM"]
            .iter().map(|t| ts.label(t, 11.0)).collect();

        let mut r = TinySkiaRenderer::new_cpu_only(900, 300);
        // Warm the glyph cache (misses rasterize via swash).
        let mut frame = r.begin_frame();
        for (i, l) in labels.iter().enumerate() { frame.draw_text(l, 10.0 + i as f64 * 60.0, 10.0, WHITE); }
        r.finish_frame_soft(frame, |_, _, _, _| {});

        let frames = 200;
        let t0 = Instant::now();
        for _ in 0..frames {
            let mut frame = r.begin_frame();
            for (i, l) in labels.iter().enumerate() {
                for row in 0..3 { frame.draw_text(l, 10.0 + i as f64 * 60.0, 10.0 + row as f64 * 20.0, WHITE); }
            }
            r.finish_frame_soft(frame, |_, _, _, _| {});
        }
        let calls = frames * labels.len() * 3;
        let per_call = t0.elapsed().as_secs_f64() * 1e6 / calls as f64;
        println!("draw_text (glyphs cached): {per_call:.1} µs per label, {:.2} ms per 30-label frame", per_call * 30.0 / 1000.0);
    }
}

#[cfg(test)]
mod canvas_cost {
    use super::*;
    use std::time::Instant;

    /// One chart-like canvas: a clipped layer holding a gradient area fill, a
    /// 120-point line and some grid lines — what an AreaChart frame draws.
    fn chart(frame: &mut TinySkiaFrame, ox: f64, oy: f64) {
        let (w, h) = (836.0f64, 250.0f64);
        frame.push_layer(ox, oy, w, h);
        let n = 120;
        let mut line = Vec::new();
        for i in 0..n {
            let x = i as f64 / (n - 1) as f64 * (w - 60.0) + 50.0;
            let y = 120.0 + 70.0 * (i as f64 * 0.11).sin() + 20.0 * (i as f64 * 0.43).sin();
            line.push((ox + x) as f32);
            line.push((oy + y) as f32);
        }
        let mut area = line.clone();
        area.extend([(ox + w - 10.0) as f32, (oy + h - 30.0) as f32, (ox + 50.0) as f32, (oy + h - 30.0) as f32]);
        let grad = peniko::Gradient::new_linear(
            peniko::kurbo::Point::new(ox, oy + 40.0), peniko::kurbo::Point::new(ox, oy + h - 30.0),
        ).with_stops([
            (0.0f32, peniko::Color::from_rgba8(129, 140, 248, 90)),
            (1.0f32, peniko::Color::from_rgba8(129, 140, 248, 0)),
        ].as_slice());
        frame.fill_path_with_brush(&area, &peniko::Brush::Gradient(grad));
        frame.stroke_path(&line, 2.5, false, peniko::Color::from_rgba8(129, 140, 248, 255));
        for k in 0..6 {
            let y = oy + 40.0 + k as f64 * 30.0;
            frame.stroke_line(ox + 50.0, y, ox + w - 10.0, y, 1.0, peniko::Color::from_rgba8(255, 255, 255, 30));
        }
        frame.pop_layer();
    }

    /// Prints what a frame of two chart canvases costs on the CPU renderer,
    /// with the whole window repainted and with only the charts' region.
    /// `cargo test -p glyx-renderer canvas_cost -- --ignored --nocapture`
    #[test]
    #[ignore = "benchmark: prints timings"]
    fn two_chart_canvases_per_frame() {
        let mut r = TinySkiaRenderer::new_cpu_only(908, 708);
        let seed = r.begin_frame();
        r.finish_frame_soft(seed, |_, _, _, _| {});
        let mut run = |label: &str, damage: Option<(f64, f64, f64, f64)>| {
            let frames = 60;
            let t0 = Instant::now();
            for _ in 0..frames {
                let mut f = match damage { Some(d) => r.begin_frame_damaged(Some(&[d])), None => r.begin_frame() };
                chart(&mut f, 32.0, 100.0);
                chart(&mut f, 32.0, 380.0);
                r.finish_frame_soft(f, |_, _, _, _| {});
            }
            println!("{label}: {:.2} ms per frame (two charts)", t0.elapsed().as_secs_f64() * 1000.0 / frames as f64);
        };
        run("full window ", None);
        run("charts only ", Some((28.0, 96.0, 844.0, 540.0)));
    }
}

#[cfg(test)]
mod canvas_cost_parts {
    use super::*;
    use std::time::Instant;

    /// Which part of a chart canvas costs what. Each part is timed alone, in
    /// a clipped layer (as the Canvas node draws) and without one.
    /// `cargo test -p glyx-renderer canvas_cost_parts -- --ignored --nocapture`
    #[test]
    #[ignore = "benchmark: prints timings"]
    fn where_a_chart_frame_goes() {
        let (ox, oy, w, h) = (32.0f64, 100.0f64, 836.0f64, 250.0f64);
        let n = 120;
        let mut line = Vec::new();
        for i in 0..n {
            let x = i as f64 / (n - 1) as f64 * (w - 60.0) + 50.0;
            let y = 120.0 + 70.0 * (i as f64 * 0.11).sin() + 20.0 * (i as f64 * 0.43).sin();
            line.push((ox + x) as f32); line.push((oy + y) as f32);
        }
        let mut area = line.clone();
        area.extend([(ox + w - 10.0) as f32, (oy + h - 30.0) as f32, (ox + 50.0) as f32, (oy + h - 30.0) as f32]);
        let grad = peniko::Brush::Gradient(peniko::Gradient::new_linear(
            peniko::kurbo::Point::new(ox, oy + 40.0), peniko::kurbo::Point::new(ox, oy + h - 30.0),
        ).with_stops([(0.0f32, peniko::Color::from_rgba8(129, 140, 248, 90)), (1.0f32, peniko::Color::from_rgba8(129, 140, 248, 0))].as_slice()));
        let solid = peniko::Brush::Solid(peniko::Color::from_rgba8(129, 140, 248, 90));
        let ink = peniko::Color::from_rgba8(129, 140, 248, 255);
        let faint = peniko::Color::from_rgba8(255, 255, 255, 30);

        let mut r = TinySkiaRenderer::new_cpu_only(908, 708);
        let seed = r.begin_frame();
        r.finish_frame_soft(seed, |_, _, _, _| {});

        let frames = 80;
        let mut time = |label: &str, clip: bool, part: &dyn Fn(&mut TinySkiaFrame)| {
            let t0 = Instant::now();
            for _ in 0..frames {
                let mut f = r.begin_frame_damaged(Some(&[(28.0, 96.0, 844.0, 270.0)]));
                if clip { f.push_layer(ox, oy, w, h); }
                part(&mut f);
                if clip { f.pop_layer(); }
                r.finish_frame_soft(f, |_, _, _, _| {});
            }
            println!("{label:<34} {:6.2} ms", t0.elapsed().as_secs_f64() * 1000.0 / frames as f64);
        };
        time("nothing (frame + clip layer only)", true,  &|_| {});
        time("nothing (frame only, no clip)",     false, &|_| {});
        time("gradient area, clipped",             true,  &|f| f.fill_path_with_brush(&area, &grad));
        time("gradient area, no clip",             false, &|f| f.fill_path_with_brush(&area, &grad));
        time("SOLID area, clipped",                true,  &|f| f.fill_path_with_brush(&area, &solid));
        time("line stroke 2.5px, clipped",         true,  &|f| f.stroke_path(&line, 2.5, false, ink));
        time("line stroke 2.5px, no clip",         false, &|f| f.stroke_path(&line, 2.5, false, ink));
        time("6 grid lines, clipped",              true,  &|f| for k in 0..6 { let y = oy + 40.0 + k as f64 * 30.0; f.stroke_line(ox + 50.0, y, ox + w - 10.0, y, 1.0, faint); });
    }
}

#[cfg(test)]
mod lazy_clip_tests {
    use super::*;

    fn col(r: u8, g: u8, b: u8, a: u8) -> peniko::Color { peniko::Color::from_rgba8(r, g, b, a) }

    /// A scene that crosses, touches and stays inside a clip at (40.5, 20.25) 120×60.
    fn scene(f: &mut TinySkiaFrame, label: &glyx_text::TextLayout) {
        // Crosses the clip's edges.
        f.fill_rect(10.0, 10.0, 200.0, 40.0, col(200, 40, 40, 255));
        f.stroke_line(0.0, 50.0, 220.0, 55.0, 3.0, col(40, 200, 40, 255));
        f.stroke_path(&[5.0, 30.0, 70.0, 70.0, 130.0, 20.0, 215.0, 60.0], 2.5, false, col(40, 40, 200, 255));
        f.fill_path(&[30.0, 100.0, 90.0, 5.0, 190.0, 100.0], col(230, 230, 20, 160));
        let g = peniko::Gradient::new_linear(peniko::kurbo::Point::new(0.0, 15.0), peniko::kurbo::Point::new(0.0, 85.0))
            .with_stops([(0.0f32, col(255, 255, 255, 220)), (1.0f32, col(255, 255, 255, 0))].as_slice());
        f.fill_path_with_brush(&[20.0, 85.0, 60.0, 30.0, 120.0, 50.0, 200.0, 25.0, 200.0, 85.0], &peniko::Brush::Gradient(g));
        f.stroke_circle(100.0, 50.0, 22.0, 2.0, col(255, 255, 255, 255));
        f.fill_circle(48.0, 28.0, 6.0, col(20, 230, 230, 255));
        f.fill_rounded_rect(60.0, 30.0, 70.0, 30.0, 6.0, col(120, 60, 200, 200));
        f.stroke_rounded_rect(150.0, 25.0, 60.0, 50.0, 4.0, 2.0, col(255, 160, 0, 255));
        f.draw_text(label, 38.0, 22.0, col(255, 255, 255, 255));
        // Fully inside.
        f.fill_rect(70.0, 40.0, 30.0, 10.0, col(10, 10, 10, 255));
        f.stroke_line(80.0, 35.0, 120.0, 35.0, 1.0, col(255, 255, 255, 255));
        // Entirely outside.
        f.fill_rect(0.0, 90.0, 20.0, 10.0, col(255, 0, 255, 255));
    }

    fn render(damage: Option<(f64, f64, f64, f64)>, forced: bool, nested: bool) -> Vec<u8> {
        let mut ts = glyx_text::TextSystem::new();
        let label = ts.label("Clipped label", 14.0);
        let mut r = TinySkiaRenderer::new_cpu_only(240, 120);
        let seed = r.begin_frame();
        r.finish_frame_soft(seed, |_, _, _, _| {});
        let mut f = match damage { Some(d) => r.begin_frame_damaged(Some(&[d])), None => r.begin_frame() };
        f.push_layer(40.5, 20.25, 120.0, 60.0);
        // The reference behaviour: the mask built the moment the clip is pushed.
        if forced { f.ensure_mask(); }
        if nested {
            f.push_layer(60.25, 30.0, 70.5, 40.0);
            if forced { f.ensure_mask(); }
        }
        scene(&mut f, &label);
        if nested { f.pop_layer(); }
        // After the pops the outer clip must still apply, and the inner one must be gone.
        f.fill_rect(150.0, 70.0, 30.0, 30.0, col(0, 120, 255, 255));
        f.pop_layer();
        f.fill_rect(200.0, 100.0, 30.0, 12.0, col(255, 255, 0, 255)); // no clip any more
        let mut out = Vec::new();
        r.finish_frame_soft(f, |px, _, _, _| out = px.to_vec());
        out
    }

    #[test]
    fn a_lazy_rect_clip_draws_exactly_what_a_built_mask_draws() {
        for damage in [None, Some((20.0, 10.0, 180.0, 90.0)), Some((50.0, 25.0, 60.0, 40.0))] {
            for nested in [false, true] {
                let lazy   = render(damage, false, nested);
                let forced = render(damage, true, nested);
                assert!(lazy == forced, "damage {damage:?}, nested {nested}: lazy and mask-built clips must be pixel-identical");
            }
        }
    }

    #[test]
    fn the_clip_still_clips_and_is_released_on_pop() {
        let px = |buf: &[u8], x: usize, y: usize| { let i = (y * 240 + x) * 4; [buf[i], buf[i + 1], buf[i + 2], buf[i + 3]] };
        let img = render(None, false, false);
        let red = |p: [u8; 4]| p[0] > 150 && p[1] < 100 && p[2] < 100;
        // The wide red bar (x 10..210, y 10..50) shows only inside the clip (x 40.5..160.5, y 20.25..80.25).
        assert!(red(px(&img, 45, 45)), "inside the clip");
        assert!(!red(px(&img, 20, 45)), "left of the clip");
        assert!(!red(px(&img, 190, 30)), "right of the clip");
        assert!(!red(px(&img, 100, 14)), "above the clip");
        // After pop_layer a fill is unclipped again.
        assert_eq!(px(&img, 215, 105)[0..2], [255, 255], "unclipped yellow after the pop");
    }

    #[test]
    fn a_rounded_layer_inside_a_rect_layer_still_clips_to_both() {
        let mut r = TinySkiaRenderer::new_cpu_only(120, 80);
        let seed = r.begin_frame();
        r.finish_frame_soft(seed, |_, _, _, _| {});
        let mut f = r.begin_frame();
        f.push_layer(10.0, 10.0, 80.0, 40.0);          // lazy rect clip
        f.push_rounded_layer(30.0, 10.0, 90.0, 60.0, 12.0); // builds a mask, intersected with the rect
        f.fill_rect(0.0, 0.0, 120.0, 80.0, col(255, 0, 0, 255));
        f.pop_layer();
        // Back to the rect clip alone (pending again, not a leftover mask).
        f.fill_rect(0.0, 0.0, 120.0, 80.0, col(0, 0, 255, 255));
        f.pop_layer();
        let mut out = Vec::new();
        r.finish_frame_soft(f, |px, _, _, _| out = px.to_vec());
        let px = |x: usize, y: usize| { let i = (y * 120 + x) * 4; [out[i], out[i + 1], out[i + 2]] };
        let bg = px(115, 75); // a pixel no clip or fill reaches
        assert_eq!(px(5, 5), bg, "outside every clip is untouched");
        // Inside the rect but left of the rounded layer: blue only.
        assert_eq!(px(20, 30)[2], 255);
        assert_eq!(px(20, 30)[0], 0, "not red: outside the rounded layer");
        // Inside both: blue painted last over red.
        assert_eq!(px(60, 30), [0, 0, 255]);
        // Outside the rect (below it): neither colour.
        assert_ne!(px(60, 60), [0, 0, 255]);
        assert_ne!(px(60, 60), [255, 0, 0]);
    }
}

#[cfg(test)]
mod lazy_clip_ab {
    use super::*;
    use std::sync::atomic::Ordering;
    use std::time::Instant;

    fn col(r: u8, g: u8, b: u8, a: u8) -> peniko::Color { peniko::Color::from_rgba8(r, g, b, a) }

    fn chart(f: &mut TinySkiaFrame, ox: f64, oy: f64) {
        let (w, h, n) = (836.0f64, 250.0f64, 120);
        f.push_layer(ox, oy, w, h);
        let mut line = Vec::new();
        for i in 0..n {
            let x = i as f64 / (n - 1) as f64 * (w - 60.0) + 50.0;
            let y = 120.0 + 70.0 * (i as f64 * 0.11).sin() + 20.0 * (i as f64 * 0.43).sin();
            line.push((ox + x) as f32); line.push((oy + y) as f32);
        }
        let mut area = line.clone();
        area.extend([(ox + w - 10.0) as f32, (oy + h - 30.0) as f32, (ox + 50.0) as f32, (oy + h - 30.0) as f32]);
        let g = peniko::Gradient::new_linear(peniko::kurbo::Point::new(ox, oy + 40.0), peniko::kurbo::Point::new(ox, oy + h - 30.0))
            .with_stops([(0.0f32, col(129, 140, 248, 90)), (1.0f32, col(129, 140, 248, 0))].as_slice());
        f.fill_path_with_brush(&area, &peniko::Brush::Gradient(g));
        f.stroke_path(&line, 2.5, false, col(129, 140, 248, 255));
        for k in 0..6 { let y = oy + 40.0 + k as f64 * 30.0; f.stroke_line(ox + 50.0, y, ox + w - 10.0, y, 1.0, col(255, 255, 255, 30)); }
        f.pop_layer();
    }

    /// The same two-chart frame with lazy rect clips and with a mask built at
    /// every push, interleaved over several rounds so machine noise hits both
    /// alike. `cargo test -p glyx-renderer lazy_clip_ab -- --ignored --nocapture --test-threads=1`
    #[test]
    #[ignore = "benchmark: prints timings"]
    fn two_chart_frame_lazy_vs_mask_per_push() {
        let mut r = TinySkiaRenderer::new_cpu_only(908, 708);
        let seed = r.begin_frame();
        r.finish_frame_soft(seed, |_, _, _, _| {});
        let mut one = |lazy: bool| -> f64 {
            NO_LAZY_CLIP.store(!lazy, Ordering::Relaxed);
            let frames = 30;
            let t0 = Instant::now();
            for _ in 0..frames {
                let mut f = r.begin_frame_damaged(Some(&[(28.0, 96.0, 844.0, 540.0)]));
                chart(&mut f, 32.0, 100.0);
                chart(&mut f, 32.0, 380.0);
                r.finish_frame_soft(f, |_, _, _, _| {});
            }
            t0.elapsed().as_secs_f64() * 1000.0 / frames as f64
        };
        let (mut lazy, mut eager) = (Vec::new(), Vec::new());
        for _ in 0..8 { eager.push(one(false)); lazy.push(one(true)); }
        NO_LAZY_CLIP.store(false, Ordering::Relaxed);
        let best = |v: &[f64]| v.iter().cloned().fold(f64::MAX, f64::min);
        let med  = |v: &[f64]| { let mut s = v.to_vec(); s.sort_by(|a, b| a.partial_cmp(b).unwrap()); s[s.len() / 2] };
        println!("mask at every push: best {:.2} ms, median {:.2} ms per frame (two charts)", best(&eager), med(&eager));
        println!("lazy rect clips   : best {:.2} ms, median {:.2} ms per frame (two charts)", best(&lazy),  med(&lazy));
    }
}

#[cfg(test)]
mod gradient_fill_cost {
    use super::*;
    use std::time::Instant;

    fn col(r: u8, g: u8, b: u8, a: u8) -> peniko::Color { peniko::Color::from_rgba8(r, g, b, a) }

    fn area_polygon() -> Vec<f32> {
        let (ox, oy, w, h, n) = (32.0f64, 100.0f64, 836.0f64, 250.0f64, 120);
        let mut line = Vec::new();
        for i in 0..n {
            let x = i as f64 / (n - 1) as f64 * (w - 60.0) + 50.0;
            let y = 120.0 + 70.0 * (i as f64 * 0.11).sin() + 20.0 * (i as f64 * 0.43).sin();
            line.push((ox + x) as f32); line.push((oy + y) as f32);
        }
        line.extend([(ox + w - 10.0) as f32, (oy + h - 30.0) as f32, (ox + 50.0) as f32, (oy + h - 30.0) as f32]);
        line
    }

    fn the_gradient() -> peniko::Gradient {
        peniko::Gradient::new_linear(peniko::kurbo::Point::new(32.0, 140.0), peniko::kurbo::Point::new(32.0, 320.0))
            .with_stops([(0.0f32, col(129, 140, 248, 90)), (1.0f32, col(129, 140, 248, 0))].as_slice())
    }

    fn paint_with(pixmap: &mut tiny_skia::Pixmap, pts: &[f32], shader: tiny_skia::Shader<'_>) {
        let path = poly_path(pts, true).unwrap();
        let paint = tiny_skia::Paint { shader, anti_alias: true, ..Default::default() };
        pixmap.fill_path(&path, &paint, tiny_skia::FillRule::Winding, tiny_skia::Transform::identity(), None);
    }

    /// `cargo test -p glyx-renderer gradient_fill_cost -- --ignored --nocapture --test-threads=1`
    #[test]
    #[ignore = "benchmark: prints timings and pixel differences"]
    fn strip_pattern_vs_gradient_shader() {
        let pts = area_polygon();
        let grad = the_gradient();
        let (st, top) = vertical_gradient_strip(&grad).expect("a vertical two-stop gradient");
        let pattern = || tiny_skia::Pattern::new(st.as_ref(), tiny_skia::SpreadMode::Pad, tiny_skia::FilterQuality::Nearest, 1.0,
                                                 tiny_skia::Transform::from_translate(0.0, top));

        // Pixels: the same area filled both ways over the same background.
        let bg = tiny_skia::Color::from_rgba8(18, 19, 26, 255);
        let mut a = tiny_skia::Pixmap::new(908, 708).unwrap(); a.fill(bg);
        let mut b = tiny_skia::Pixmap::new(908, 708).unwrap(); b.fill(bg);
        paint_with(&mut a, &pts, gradient_shader(&grad).unwrap());
        paint_with(&mut b, &pts, pattern());
        let (mut max_d, mut sum_d, mut n_d, mut off) = (0i32, 0i64, 0i64, 0usize);
        for (p, q) in a.pixels().iter().zip(b.pixels()) {
            let d = [(p.red() as i32 - q.red() as i32).abs(), (p.green() as i32 - q.green() as i32).abs(), (p.blue() as i32 - q.blue() as i32).abs(), (p.alpha() as i32 - q.alpha() as i32).abs()];
            let m = *d.iter().max().unwrap();
            max_d = max_d.max(m); sum_d += m as i64; n_d += 1; if m > 2 { off += 1; }
        }
        println!("pixels: max channel difference {max_d}/255, mean {:.4}, {off} of {n_d} pixels differ by more than 2", sum_d as f64 / n_d as f64);

        // Time: interleaved rounds so noise hits all alike.
        let time = |label: &str, f: &dyn Fn(&mut tiny_skia::Pixmap)| -> f64 {
            let mut pm = tiny_skia::Pixmap::new(908, 708).unwrap();
            let t0 = Instant::now();
            for _ in 0..40 { pm.fill(bg); f(&mut pm); }
            let ms = t0.elapsed().as_secs_f64() * 1000.0 / 40.0;
            let _ = label; ms
        };
        let (mut g, mut p, mut s) = (Vec::new(), Vec::new(), Vec::new());
        for _ in 0..8 {
            g.push(time("gradient", &|pm| paint_with(pm, &pts, gradient_shader(&grad).unwrap())));
            p.push(time("pattern", &|pm| paint_with(pm, &pts, pattern())));
            s.push(time("solid", &|pm| paint_with(pm, &pts, tiny_skia::Shader::SolidColor(tiny_skia::Color::from_rgba8(129, 140, 248, 60)))));
        }
        let best = |v: &[f64]| v.iter().cloned().fold(f64::MAX, f64::min);
        println!("area fill, best of 8 rounds: gradient shader {:.2} ms | 1px strip pattern {:.2} ms | solid colour {:.2} ms", best(&g), best(&p), best(&s));
    }
}

#[cfg(test)]
mod gradient_strip_tests {
    use super::*;

    fn col(r: u8, g: u8, b: u8, a: u8) -> peniko::Color { peniko::Color::from_rgba8(r, g, b, a) }
    const BG: peniko::Color = peniko::Color::from_rgba8(18, 19, 26, 255);

    fn linear(x0: f64, y0: f64, x1: f64, y1: f64, stops: &[(f32, peniko::Color)]) -> peniko::Gradient {
        peniko::Gradient::new_linear(peniko::kurbo::Point::new(x0, y0), peniko::kurbo::Point::new(x1, y1)).with_stops(stops)
    }

    fn pixels(frame: &TinySkiaFrame) -> Vec<[u8; 4]> {
        frame.pixmap.pixels().iter().map(|p| [p.red(), p.green(), p.blue(), p.alpha()]).collect()
    }

    /// The reference: what the exact gradient shader paints.
    fn reference(pts: &[f32], grad: &peniko::Gradient, xf: Option<peniko::kurbo::Affine>) -> Vec<[u8; 4]> {
        let mut r = TinySkiaRenderer::new_cpu_only(200, 160);
        let mut f = r.begin_frame();
        if let Some(a) = xf { f.push_transform(a); }
        let paint = tiny_skia::Paint { shader: gradient_shader(grad).unwrap(), anti_alias: true, ..Default::default() };
        f.pixmap.fill_path(&poly_path(pts, true).unwrap(), &paint, tiny_skia::FillRule::Winding, f.xf, None);
        pixels(&f)
    }

    fn through_renderer(pts: &[f32], grad: &peniko::Gradient, xf: Option<peniko::kurbo::Affine>) -> Vec<[u8; 4]> {
        let mut r = TinySkiaRenderer::new_cpu_only(200, 160);
        let mut f = r.begin_frame();
        if let Some(a) = xf { f.push_transform(a); }
        f.fill_path_with_brush(pts, &peniko::Brush::Gradient(grad.clone()));
        pixels(&f)
    }

    /// Largest channel difference, and how many pixels differ by more than 2.
    fn diff(a: &[[u8; 4]], b: &[[u8; 4]]) -> (i32, usize) {
        let mut worst = 0; let mut over = 0;
        for (p, q) in a.iter().zip(b) {
            let d = (0..4).map(|k| (p[k] as i32 - q[k] as i32).abs()).max().unwrap();
            worst = worst.max(d); if d > 2 { over += 1; }
        }
        (worst, over)
    }

    const AREA: [f32; 10] = [20.0, 130.0, 60.0, 40.0, 110.0, 70.0, 170.0, 30.0, 170.0, 130.0];

    #[test]
    fn a_vertical_gradient_matches_the_exact_shader() {
        let cases = [
            ("two-stop fade", linear(0.0, 40.0, 0.0, 130.0, &[(0.0, col(129, 140, 248, 90)), (1.0, col(129, 140, 248, 0))])),
            ("three opaque stops", linear(0.0, 30.0, 0.0, 130.0, &[(0.0, col(255, 0, 0, 255)), (0.5, col(0, 255, 0, 255)), (1.0, col(0, 0, 255, 255))])),
            ("pointing up", linear(0.0, 130.0, 0.0, 30.0, &[(0.0, col(255, 255, 255, 220)), (1.0, col(255, 255, 255, 0))])),
            ("shorter than the shape (padded)", linear(0.0, 60.0, 0.0, 100.0, &[(0.0, col(250, 200, 20, 255)), (1.0, col(20, 40, 250, 255))])),
            ("offset stops", linear(0.0, 30.0, 0.0, 130.0, &[(0.2, col(255, 90, 0, 255)), (0.8, col(0, 90, 255, 255))])),
        ];
        for (name, g) in cases {
            let (worst, over) = diff(&through_renderer(&AREA, &g, None), &reference(&AREA, &g, None));
            assert!(worst <= 3, "{name}: largest channel difference {worst}");
            assert!(over < 40, "{name}: {over} pixels differ by more than 2");
        }
    }

    #[test]
    fn it_still_matches_under_a_translation() {
        let g = linear(0.0, 40.0, 0.0, 130.0, &[(0.0, col(129, 140, 248, 90)), (1.0, col(129, 140, 248, 0))]);
        let shift = Some(peniko::kurbo::Affine::translate((12.0, 9.0)));
        let (worst, over) = diff(&through_renderer(&AREA, &g, shift), &reference(&AREA, &g, shift));
        assert!(worst <= 3 && over < 40, "worst {worst}, {over} over");
    }

    #[test]
    fn anything_else_keeps_the_exact_gradient_shader() {
        // Rotated, angled and radial gradients take the original path, so they are identical to it.
        let g = linear(0.0, 40.0, 0.0, 130.0, &[(0.0, col(129, 140, 248, 255)), (1.0, col(10, 10, 40, 255))]);
        let rot = Some(peniko::kurbo::Affine::rotate(0.3));
        assert_eq!(through_renderer(&AREA, &g, rot), reference(&AREA, &g, rot), "rotated");
        let angled = linear(20.0, 40.0, 170.0, 130.0, &[(0.0, col(255, 0, 0, 255)), (1.0, col(0, 0, 255, 255))]);
        assert_eq!(through_renderer(&AREA, &angled, None), reference(&AREA, &angled, None), "angled");
        assert!(vertical_gradient_strip(&angled).is_none());
        let flat = linear(0.0, 50.0, 0.0, 50.0, &[(0.0, col(255, 0, 0, 255)), (1.0, col(0, 0, 255, 255))]);
        assert!(vertical_gradient_strip(&flat).is_none(), "a zero-length span has no strip");
    }

    #[test]
    fn a_gradient_rounded_rect_matches_too() {
        let g = linear(0.0, 20.0, 0.0, 100.0, &[(0.0, col(80, 120, 255, 255)), (1.0, col(30, 40, 120, 255))]);
        let mut r = TinySkiaRenderer::new_cpu_only(200, 160);
        let mut f = r.begin_frame();
        f.fill_rounded_rect_with_brush(20.0, 20.0, 150.0, 80.0, 10.0, &peniko::Brush::Gradient(g.clone()));
        let got = pixels(&f);

        let mut r2 = TinySkiaRenderer::new_cpu_only(200, 160);
        let mut f2 = r2.begin_frame();
        let paint = tiny_skia::Paint { shader: gradient_shader(&g).unwrap(), anti_alias: true, ..Default::default() };
        f2.pixmap.fill_path(&rrect_path(20.0, 20.0, 150.0, 80.0, 10.0).unwrap(), &paint, tiny_skia::FillRule::Winding, f2.xf, None);
        let (worst, over) = diff(&got, &pixels(&f2));
        assert!(worst <= 3 && over < 40, "worst {worst}, {over} over");
        let _ = BG;
    }
}

#[cfg(test)]
mod damage_fill_tests {
    use super::*;

    const PANEL: peniko::Color = peniko::Color::from_rgba8(18, 19, 26, 255);
    const PAGE: peniko::Color = peniko::Color::from_rgba8(13, 13, 20, 255);

    /// Draws one rounded rect over a seeded page, either with a damage rect or as a full frame.
    fn draw(shape: (f64, f64, f64, f64, f64), damage: Option<(f64, f64, f64, f64)>) -> (TinySkiaFrame, TinySkiaRenderer) {
        let mut r = TinySkiaRenderer::new_cpu_only(300, 200);
        let mut seed = r.begin_frame();
        seed.fill_rect(0.0, 0.0, 300.0, 200.0, PAGE);
        r.finish_frame_soft(seed, |_, _, _, _| {});
        let mut f = match damage { Some(d) => r.begin_frame_damaged(Some(&[d])), None => r.begin_frame() };
        f.fill_rect(0.0, 0.0, 300.0, 200.0, PAGE);
        f.fill_rounded_rect(shape.0, shape.1, shape.2, shape.3, shape.4, PANEL);
        (f, r)
    }

    fn px(f: &TinySkiaFrame, x: u32, y: u32) -> [u8; 4] {
        let p = f.pixmap.pixel(x, y).unwrap();
        [p.red(), p.green(), p.blue(), p.alpha()]
    }

    #[test]
    fn filling_only_the_damaged_part_of_a_rounded_rect_looks_the_same() {
        let shapes = [(20.0, 20.0, 260.0, 120.0, 12.0), (20.4, 20.3, 259.2, 119.6, 12.0), (20.0, 20.0, 260.0, 120.0, 40.0)];
        // Inside; slack that reaches into a corner square without reaching its arc;
        // across a straight edge; right into the arc; the whole shape; off to the side.
        let damages = [
            (60.0, 40.0, 100.0, 60.0), (28.0, 28.0, 244.0, 104.0), (10.0, 60.0, 80.0, 40.0),
            (20.0, 20.0, 14.0, 14.0), (0.0, 0.0, 300.0, 200.0), (250.0, 120.0, 50.0, 70.0),
            // Slack at the sides, running down past the bottom edge: reaches both bottom arcs.
            (28.0, 28.0, 244.0, 170.0),
        ];
        for shape in shapes {
            for d in damages {
                let (fast, _r1) = draw(shape, Some(d));
                let (full, _r2) = draw(shape, None);
                let (dx0, dy0) = (d.0.floor().max(0.0) as u32, d.1.floor().max(0.0) as u32);
                let (dx1, dy1) = (((d.0 + d.2).ceil() as u32).min(300), ((d.1 + d.3).ceil() as u32).min(200));
                for y in dy0..dy1 {
                    for x in dx0..dx1 {
                        let (a, b) = (px(&fast, x, y), px(&full, x, y));
                        assert!((0..4).all(|k| (a[k] as i32 - b[k] as i32).abs() <= 1),
                            "shape {shape:?} damage {d:?}: pixel ({x},{y}) {a:?} vs {b:?}");
                    }
                }
            }
        }
    }

    #[test]
    fn the_fast_path_is_taken_when_it_is_safe_and_declined_at_the_arc() {
        let (r, mut keep) = (12.0, TinySkiaRenderer::new_cpu_only(900, 700));
        let seed = keep.begin_frame();
        keep.finish_frame_soft(seed, |_, _, _, _| {});
        // Damage whose slack reaches into the top corner squares of a radius-12 panel, but stops
        // short of its bottom edge: every corner of the intersection is clear of the arcs.
        let f = keep.begin_frame_damaged(Some(&[(28.0, 116.0, 844.0, 100.0)]));
        assert!(f.damage_clipped_fill(20.0, 108.0, 860.0, 274.0, r).is_some(), "slack inside the corner square, clear of the arc");
        drop(f);
        // The same slack on damage that runs down past the panel's bottom edge reaches the bottom
        // corners' arcs, so a plain rect would paint outside the rounded shape: it must decline.
        let mut keep3 = TinySkiaRenderer::new_cpu_only(900, 700);
        let seed = keep3.begin_frame();
        keep3.finish_frame_soft(seed, |_, _, _, _| {});
        let f3 = keep3.begin_frame_damaged(Some(&[(28.0, 116.0, 844.0, 540.0)]));
        assert!(f3.damage_clipped_fill(20.0, 108.0, 860.0, 274.0, r).is_none(), "the rect would cross the bottom corners' arcs");
        drop(f3);
        // Damage that reaches the shape's own corner point (far outside the arc) must not use the plain fill.
        let mut keep2 = TinySkiaRenderer::new_cpu_only(900, 700);
        let seed = keep2.begin_frame();
        keep2.finish_frame_soft(seed, |_, _, _, _| {});
        let f2 = keep2.begin_frame_damaged(Some(&[(20.0, 108.0, 10.0, 10.0)]));
        assert!(f2.damage_clipped_fill(20.0, 108.0, 860.0, 274.0, r).is_none(), "the corner of the damage is outside the arc");
    }
}

#[cfg(test)]
mod ring_fill_tests {
    use super::*;
    use std::time::Instant;

    fn col(r: u8, g: u8, b: u8, a: u8) -> peniko::Color { peniko::Color::from_rgba8(r, g, b, a) }

    /// What a plain full path fill paints: the reference the split must match.
    fn reference(shape: (f64, f64, f64, f64, f64), color: peniko::Color) -> Vec<[u8; 4]> {
        let mut r = TinySkiaRenderer::new_cpu_only(300, 220);
        let mut f = r.begin_frame();
        f.fill_rect(0.0, 0.0, 300.0, 220.0, col(40, 90, 160, 255));
        let path = rrect_path(shape.0 as f32, shape.1 as f32, shape.2 as f32, shape.3 as f32, shape.4 as f32).unwrap();
        f.pixmap.fill_path(&path, &solid_paint(color), tiny_skia::FillRule::Winding, tiny_skia::Transform::identity(), None);
        f.pixmap.pixels().iter().map(|p| [p.red(), p.green(), p.blue(), p.alpha()]).collect()
    }

    fn through_renderer(shape: (f64, f64, f64, f64, f64), color: peniko::Color) -> Vec<[u8; 4]> {
        let mut r = TinySkiaRenderer::new_cpu_only(300, 220);
        let mut f = r.begin_frame();
        f.fill_rect(0.0, 0.0, 300.0, 220.0, col(40, 90, 160, 255));
        f.fill_rounded_rect(shape.0, shape.1, shape.2, shape.3, shape.4, color);
        f.pixmap.pixels().iter().map(|p| [p.red(), p.green(), p.blue(), p.alpha()]).collect()
    }

    #[test]
    fn a_split_rounded_rect_looks_the_same_as_a_plain_path_fill() {
        let shapes = [
            (20.0, 20.0, 260.0, 160.0, 12.0), (20.4, 20.3, 259.2, 159.6, 12.0), (20.5, 20.5, 259.0, 159.0, 40.0),
            (10.0, 10.0, 280.0, 200.0, 4.0), (30.25, 15.75, 200.5, 120.5, 20.0),
        ];
        let colors = [col(18, 19, 26, 255), col(200, 60, 60, 128), col(255, 255, 255, 40)];
        for shape in shapes {
            for color in colors {
                let (a, b) = (through_renderer(shape, color), reference(shape, color));
                let worst = a.iter().zip(&b).map(|(p, q)| (0..4).map(|k| (p[k] as i32 - q[k] as i32).abs()).max().unwrap()).max().unwrap();
                assert!(worst <= 1, "shape {shape:?} colour {color:?}: largest channel difference {worst}");
            }
        }
    }

    #[test]
    fn only_large_unmoved_rounded_rects_are_split() {
        let mut r = TinySkiaRenderer::new_cpu_only(300, 220);
        let mut f = r.begin_frame();
        assert!(f.interior_rect(20.0, 20.0, 260.0, 160.0, 12.0).is_some());
        let hole = f.interior_rect(20.5, 20.5, 259.0, 159.0, 12.0).unwrap();
        assert_eq!((hole.left().fract(), hole.top().fract(), hole.right().fract(), hole.bottom().fract()), (0.0, 0.0, 0.0, 0.0), "whole pixels");
        assert!(f.interior_rect(20.0, 20.0, 60.0, 40.0, 12.0).is_none(), "too small to be worth it");
        assert!(f.interior_rect(20.0, 20.0, 260.0, 160.0, 1.0).is_none(), "no real rounding");
        f.push_transform(peniko::kurbo::Affine::translate((0.5, 0.5)));
        assert!(f.interior_rect(20.0, 20.0, 260.0, 160.0, 12.0).is_none(), "a moved frame would put the split between pixels");
    }

    #[test]
    fn a_split_rounded_rect_crossing_a_lazy_clip_matches_a_built_mask() {
        let render = |forced: bool, damage: Option<(f64, f64, f64, f64)>| {
            let mut r = TinySkiaRenderer::new_cpu_only(300, 220);
            let mut seed = r.begin_frame();
            seed.fill_rect(0.0, 0.0, 300.0, 220.0, col(13, 13, 20, 255));
            r.finish_frame_soft(seed, |_, _, _, _| {});
            let mut f = match damage { Some(d) => r.begin_frame_damaged(Some(&[d])), None => r.begin_frame() };
            f.fill_rect(0.0, 0.0, 300.0, 220.0, col(13, 13, 20, 255));
            f.push_layer(40.5, 30.25, 190.0, 130.0);
            if forced { f.ensure_mask(); }
            f.fill_rounded_rect(20.0, 20.0, 260.0, 170.0, 14.0, col(200, 60, 60, 160)); // crosses the clip's edges
            f.fill_rounded_rect(50.0, 40.0, 120.0, 100.0, 10.0, col(18, 19, 26, 255));   // inside it
            f.pop_layer();
            f.pixmap.pixels().iter().map(|p| [p.red(), p.green(), p.blue(), p.alpha()]).collect::<Vec<_>>()
        };
        for damage in [None, Some((28.0, 22.0, 250.0, 180.0))] {
            let (lazy, forced) = (render(false, damage), render(true, damage));
            assert!(lazy == forced, "damage {damage:?}: lazy clip and mask-built clip must match");
        }
    }

    /// Prints what a panel-sized rounded rect costs with and without the split.
    /// `cargo test -p glyx-renderer ring_fill -- --ignored --nocapture --test-threads=1`
    #[test]
    #[ignore = "benchmark: prints timings"]
    fn a_panel_fill_with_and_without_the_split() {
        let mut r = TinySkiaRenderer::new_cpu_only(908, 708);
        let seed = r.begin_frame();
        r.finish_frame_soft(seed, |_, _, _, _| {});
        let c = col(18, 19, 26, 255);
        let mut split = |on: bool| -> f64 {
            let t0 = Instant::now();
            for _ in 0..40 {
                let mut f = r.begin_frame();
                if on {
                    f.fill_rounded_rect(20.0, 108.0, 860.0, 274.0, 12.0, c);
                } else {
                    let path = rrect_path(20.0, 108.0, 860.0, 274.0, 12.0).unwrap();
                    f.pixmap.fill_path(&path, &solid_paint(c), tiny_skia::FillRule::Winding, tiny_skia::Transform::identity(), None);
                }
                r.finish_frame_soft(f, |_, _, _, _| {});
            }
            t0.elapsed().as_secs_f64() * 1000.0 / 40.0
        };
        let (mut plain, mut ring) = (Vec::new(), Vec::new());
        for _ in 0..8 { plain.push(split(false)); ring.push(split(true)); }
        let best = |v: &[f64]| v.iter().cloned().fold(f64::MAX, f64::min);
        println!("860x274 rounded panel, best of 8: plain path fill {:.2} ms | ring + hole {:.2} ms", best(&plain), best(&ring));
        // The same panel drawn the way the live frame draws it: inside a partial redraw, so through the damage mask.
        let mut masked = Vec::new();
        for _ in 0..8 {
            let t0 = Instant::now();
            for _ in 0..40 {
                let mut f = r.begin_frame_damaged(Some(&[(28.0, 116.0, 844.0, 540.0)]));
                f.fill_rounded_rect(20.0, 108.0, 860.0, 274.0, 12.0, c);
                r.finish_frame_soft(f, |_, _, _, _| {});
            }
            masked.push(t0.elapsed().as_secs_f64() * 1000.0 / 40.0);
        }
        println!("same panel in a partial redraw (damage mask): {:.2} ms", best(&masked));
    }
}

#[cfg(test)]
mod stroke_cost_by_points {
    use super::*;
    use std::time::Instant;

    /// A noisy 836px line like the chart example's, tessellated into `n` points.
    fn line(n: usize) -> Vec<f32> {
        let mut v = Vec::with_capacity(n * 2);
        for i in 0..n {
            let t = i as f32 / (n - 1) as f32;
            let x = 50.0 + t * 776.0;
            let y = 120.0 + 70.0 * (t * 13.0).sin() + 20.0 * (t * 51.0).sin() + 6.0 * (t * 700.0).sin();
            v.push(x); v.push(y);
        }
        v
    }

    /// What drawing the chart line costs as its vertex count grows (2.5px round-join stroke
    /// plus the area polygon under it). `cargo test -p glyx-renderer stroke_cost -- --ignored --nocapture --test-threads=1`
    #[test]
    #[ignore = "benchmark: prints timings"]
    fn vertex_count_vs_cost() {
        let mut r = TinySkiaRenderer::new_cpu_only(908, 400);
        let seed = r.begin_frame();
        r.finish_frame_soft(seed, |_, _, _, _| {});
        for n in [120usize, 240, 480, 714, 1200, 2380] {
            let pts = line(n);
            let mut area = pts.clone();
            area.extend([826.0, 250.0, 50.0, 250.0]);
            let mut best = (f64::MAX, f64::MAX);
            for _ in 0..6 {
                let t0 = Instant::now();
                for _ in 0..30 {
                    let mut f = r.begin_frame();
                    f.stroke_path(&pts, 2.5, false, peniko::Color::from_rgba8(129, 140, 248, 255));
                    r.finish_frame_soft(f, |_, _, _, _| {});
                }
                let stroke = t0.elapsed().as_secs_f64() * 1000.0 / 30.0;
                let t0 = Instant::now();
                for _ in 0..30 {
                    let mut f = r.begin_frame();
                    f.fill_path(&area, peniko::Color::from_rgba8(129, 140, 248, 80));
                    r.finish_frame_soft(f, |_, _, _, _| {});
                }
                let fill = t0.elapsed().as_secs_f64() * 1000.0 / 30.0;
                best = (best.0.min(stroke), best.1.min(fill));
            }
            println!("{n:5} vertices: stroke {:.2} ms | area fill {:.2} ms", best.0, best.1);
        }
    }
}

#[cfg(test)]
mod multi_damage_tests {
    use super::*;

    const PAGE:  peniko::Color = peniko::Color::from_rgba8(13, 13, 20, 255);
    const PANEL: peniko::Color = peniko::Color::from_rgba8(18, 19, 26, 255);
    const BLUE:  peniko::Color = peniko::Color::from_rgba8(76, 141, 246, 255);
    const GOLD:  peniko::Color = peniko::Color::from_rgba8(242, 169, 59, 255);
    const GLASS: peniko::Color = peniko::Color::from_rgba8(255, 255, 255, 40);

    const W: u32 = 400;
    const H: u32 = 260;

    /// A little scene. `variant` moves the two things that "changed" between
    /// frames, both inside the damage rects the tests pass; everything else is
    /// identical in both variants, as it would be for a real partial redraw.
    fn scene(f: &mut TinySkiaFrame, variant: u32) {
        f.fill_rect(0.0, 0.0, W as f64, H as f64, PAGE);
        f.fill_rounded_rect(10.0, 10.0, 380.0, 240.0, 14.0, PANEL);
        // A translucent band across the whole panel: drawn through every damage
        // rect, so a piece that landed twice would show as a brighter strip.
        f.fill_rect(10.0, 120.0, 380.0, 30.0, GLASS);
        f.stroke_line(20.0, 200.0, 380.0, 200.0, 2.0, BLUE);
        f.fill_circle(300.0, 60.0, 14.0, GOLD);
        // Something clipped, partly outside its layer.
        f.push_layer(60.0, 160.0, 120.0, 60.0);
        f.fill_rect(40.0, 170.0, 200.0, 20.0, BLUE);
        f.pop_layer();
        // The changing parts.
        let dx = if variant == 0 { 0.0 } else { 7.0 };
        f.fill_rounded_rect(40.0 + dx, 40.0, 50.0, 40.0, 6.0, GOLD);
        f.fill_rect(250.0, 90.0 + dx, 30.0, 70.0, BLUE);
    }

    fn render(variant: u32, seed_variant: Option<u32>, damage: Option<&[(f64, f64, f64, f64)]>) -> Vec<u8> {
        let mut r = TinySkiaRenderer::new_cpu_only(W, H);
        if let Some(sv) = seed_variant {
            let mut seed = r.begin_frame();
            scene(&mut seed, sv);
            r.finish_frame_soft(seed, |_, _, _, _| {});
        }
        let mut f = match damage { Some(d) => r.begin_frame_damaged(Some(d)), None => r.begin_frame() };
        scene(&mut f, variant);
        let mut out = Vec::new();
        r.finish_frame_soft(f, |px, _, _, _| out = px.to_vec());
        out
    }

    #[test]
    fn repainting_through_several_rects_matches_a_full_repaint() {
        // Every changed pixel lies inside one of the rects.
        let cases: [&[(f64, f64, f64, f64)]; 5] = [
            &[(30.0, 30.0, 80.0, 60.0), (240.0, 80.0, 50.0, 100.0)],
            &[(30.0, 30.0, 80.0, 60.0), (240.0, 80.0, 50.0, 100.0), (60.0, 160.0, 40.0, 50.0)],
            // Fractional edges, which round outward and may touch.
            &[(30.5, 30.5, 80.2, 60.1), (110.7, 30.5, 30.0, 60.0), (239.5, 79.5, 50.5, 100.5)],
            // Rects that touch or overlap before rounding.
            &[(30.0, 30.0, 80.0, 60.0), (110.0, 30.0, 40.0, 60.0), (200.0, 70.0, 100.0, 120.0), (260.0, 150.0, 100.0, 60.0)],
            // One rect: the old behaviour.
            &[(25.0, 25.0, 280.0, 180.0)],
        ];
        let full = render(1, None, None);
        for rects in cases {
            let part = render(1, Some(0), Some(rects));
            let mut bad = 0usize;
            let mut worst = 0i32;
            for i in 0..full.len() {
                let d = (full[i] as i32 - part[i] as i32).abs();
                worst = worst.max(d);
                if d > 2 { bad += 1; }
            }
            assert!(bad == 0 && worst <= 12, "{rects:?}: {bad} bytes differ by more than 2 (worst {worst})");
        }
    }

    #[test]
    fn nothing_outside_the_rects_is_touched() {
        // Seed with variant 0, then repaint with variant 1 but a scene that would
        // paint everywhere: only the rects may change.
        let rects: &[(f64, f64, f64, f64)] = &[(30.0, 30.0, 80.0, 60.0), (240.0, 80.0, 50.0, 100.0)];
        let mut r = TinySkiaRenderer::new_cpu_only(W, H);
        let mut seed = r.begin_frame();
        seed.fill_rect(0.0, 0.0, W as f64, H as f64, PAGE);
        r.finish_frame_soft(seed, |_, _, _, _| {});
        let mut f = r.begin_frame_damaged(Some(rects));
        f.fill_rect(0.0, 0.0, W as f64, H as f64, GOLD);
        f.fill_rounded_rect(0.0, 0.0, W as f64, H as f64, 20.0, BLUE);
        f.stroke_line(0.0, 130.0, W as f64, 130.0, 6.0, GOLD);
        f.fill_circle(200.0, 130.0, 150.0, GLASS);
        let mut out = Vec::new();
        r.finish_frame_soft(f, |px, _, _, _| out = px.to_vec());
        let inside = |x: u32, y: u32| rects.iter().any(|&(rx, ry, rw, rh)| {
            (x as f64) >= rx.floor() && (x as f64) < (rx + rw).ceil() && (y as f64) >= ry.floor() && (y as f64) < (ry + rh).ceil()
        });
        let page = [13u8, 13, 20, 255];
        for y in 0..H {
            for x in 0..W {
                let i = ((y * W + x) * 4) as usize;
                if !inside(x, y) {
                    assert_eq!(&out[i..i + 4], &page, "({x},{y}) is outside every rect and must still be the page colour");
                }
            }
        }
        // And the rects themselves were repainted.
        let i = ((60 * W + 60) * 4) as usize;
        assert_ne!(&out[i..i + 4], &page);
    }

    #[test]
    fn the_frame_reports_every_rect_it_repaints() {
        let mut r = TinySkiaRenderer::new_cpu_only(W, H);
        let seed = r.begin_frame();
        r.finish_frame_soft(seed, |_, _, _, _| {});
        let f = r.begin_frame_damaged(Some(&[(10.0, 10.0, 20.0, 20.0), (100.0, 100.0, 30.0, 30.0)]));
        let mut got = f.damage().expect("partial");
        got.sort();
        assert_eq!(got, vec![(10, 10, 20, 20), (100, 100, 30, 30)]);
        // Any rect that covers the window makes it a full frame.
        let mut r2 = TinySkiaRenderer::new_cpu_only(W, H);
        let seed = r2.begin_frame();
        r2.finish_frame_soft(seed, |_, _, _, _| {});
        assert!(r2.begin_frame_damaged(Some(&[(10.0, 10.0, 20.0, 20.0), (0.0, 0.0, W as f64, H as f64)])).damage().is_none());
    }
}

#[cfg(test)]
mod path_clip_tests {
    use super::*;

    fn col(r: u8, g: u8, b: u8, a: u8) -> peniko::Color { peniko::Color::from_rgba8(r, g, b, a) }

    fn shoelace(pts: &[f32]) -> f64 {
        let n = pts.len() / 2;
        let mut a = 0.0f64;
        for i in 0..n {
            let (x0, y0) = (pts[i * 2] as f64, pts[i * 2 + 1] as f64);
            let (x1, y1) = (pts[((i + 1) % n) * 2] as f64, pts[((i + 1) % n) * 2 + 1] as f64);
            a += x0 * y1 - x1 * y0;
        }
        (a / 2.0).abs()
    }

    #[test]
    fn a_polygon_is_cut_to_the_box_and_keeps_its_area_there() {
        // A 100x100 square, cut to the box x 50..150, y 20..80: a 50x60 piece.
        let sq = [0.0f32, 0.0, 100.0, 0.0, 100.0, 100.0, 0.0, 100.0];
        let c = clip_polygon_to_box(&sq, 50.0, 20.0, 150.0, 80.0);
        assert!((shoelace(&c) - 50.0 * 60.0).abs() < 1e-3, "{c:?}");
        // A triangle fully inside is untouched; one fully outside vanishes.
        let tri = [10.0f32, 10.0, 40.0, 10.0, 10.0, 40.0];
        assert!((shoelace(&clip_polygon_to_box(&tri, 0.0, 0.0, 100.0, 100.0)) - 450.0).abs() < 1e-3);
        assert!(clip_polygon_to_box(&tri, 200.0, 200.0, 300.0, 300.0).is_empty());
    }

    #[test]
    fn a_concave_polygon_keeps_exactly_the_area_inside_the_box() {
        // A "U": 0..90 wide, 0..60 tall, with a notch 30..60 x 0..40 cut from the top.
        let u = [0.0f32, 0.0, 30.0, 0.0, 30.0, 40.0, 60.0, 40.0, 60.0, 0.0, 90.0, 0.0, 90.0, 60.0, 0.0, 60.0];
        assert!((shoelace(&u) - (90.0 * 60.0 - 30.0 * 40.0)).abs() < 1e-3);
        // The box spans the notch: only the left and right legs plus the base are inside.
        let c = clip_polygon_to_box(&u, 20.0, 10.0, 70.0, 50.0);
        let expect = 50.0 * 40.0 - 30.0 * 30.0; // box minus the notch part inside it (30x30)
        // Degenerate edges along the box side enclose no area, so compare filled pixels instead.
        let mut a = tiny_skia::Pixmap::new(100, 70).unwrap();
        let mut paint = tiny_skia::Paint::default();
        paint.set_color_rgba8(255, 255, 255, 255);
        paint.anti_alias = false;
        a.fill_path(&poly_path(&c, true).unwrap(), &paint, tiny_skia::FillRule::Winding, tiny_skia::Transform::identity(), None);
        let filled = a.pixels().iter().filter(|p| p.alpha() > 127).count() as f64;
        assert!((filled - expect).abs() <= 60.0, "{filled} px filled, expected about {expect}");
    }

    #[test]
    fn a_polyline_keeps_the_runs_that_come_near_the_box() {
        // A zig-zag along x, y alternating 0/100.
        let pts: Vec<f32> = (0..20).flat_map(|i| [i as f32 * 10.0, if i % 2 == 0 { 0.0 } else { 100.0 }]).collect();
        // A box around x 95..105 only: only segments near it (4..6) are kept, as one run.
        let runs = polyline_runs_near(&pts, 95.0, 0.0, 105.0, 100.0, 2.0);
        assert_eq!(runs.len(), 1, "{runs:?}");
        let (a, z) = runs[0];
        assert!(a >= 7 && z <= 12 && z > a, "{runs:?}");
        // Two far-apart boxes' worth of nearness make two runs.
        let mut far = pts.clone();
        far.extend([500.0, 0.0]); // nothing special; just checking nothing near gives nothing
        assert!(polyline_runs_near(&pts, 1000.0, 0.0, 1010.0, 100.0, 2.0).is_empty());
    }

    const W: u32 = 908;
    const H: u32 = 708;

    fn chart(f: &mut TinySkiaFrame, ox: f64, oy: f64) {
        let (w, h, n) = (836.0f64, 250.0f64, 120);
        f.push_layer(ox, oy, w, h);
        let mut line = Vec::new();
        for i in 0..n {
            let x = i as f64 / (n - 1) as f64 * (w - 60.0) + 50.0;
            let y = 120.0 + 70.0 * (i as f64 * 0.11).sin() + 20.0 * (i as f64 * 0.43).sin();
            line.push((ox + x) as f32); line.push((oy + y) as f32);
        }
        let mut area = line.clone();
        area.extend([(ox + w - 10.0) as f32, (oy + h - 30.0) as f32, (ox + 50.0) as f32, (oy + h - 30.0) as f32]);
        let g = peniko::Gradient::new_linear(peniko::kurbo::Point::new(ox, oy + 40.0), peniko::kurbo::Point::new(ox, oy + h - 30.0))
            .with_stops([(0.0f32, col(129, 140, 248, 90)), (1.0f32, col(129, 140, 248, 0))].as_slice());
        f.fill_path_with_brush(&area, &peniko::Brush::Gradient(g));
        f.fill_path(&area, col(255, 200, 80, 40));
        f.stroke_path(&line, 2.5, false, col(129, 140, 248, 255));
        for k in 0..6 { let y = oy + 40.0 + k as f64 * 30.0; f.stroke_line(ox + 50.0, y, ox + w - 10.0, y, 1.0, col(255, 255, 255, 30)); }
        f.pop_layer();
    }

    fn render(damage: Option<&[(f64, f64, f64, f64)]>) -> Vec<u8> {
        let mut r = TinySkiaRenderer::new_cpu_only(W, H);
        let mut seed = r.begin_frame();
        seed.fill_rect(0.0, 0.0, W as f64, H as f64, col(18, 19, 26, 255));
        chart(&mut seed, 32.0, 100.0);
        chart(&mut seed, 32.0, 380.0);
        r.finish_frame_soft(seed, |_, _, _, _| {});
        let mut f = match damage { Some(d) => r.begin_frame_damaged(Some(d)), None => r.begin_frame() };
        f.fill_rect(0.0, 0.0, W as f64, H as f64, col(18, 19, 26, 255));
        chart(&mut f, 32.0, 100.0);
        chart(&mut f, 32.0, 380.0);
        let mut out = Vec::new();
        r.finish_frame_soft(f, |px, _, _, _| out = px.to_vec());
        out
    }

    #[test]
    fn a_chart_repainted_through_thin_damage_matches_a_full_repaint() {
        let full = render(None);
        let cases: [&[(f64, f64, f64, f64)]; 6] = [
            &[(300.0, 100.0, 16.0, 250.0)],                              // a crosshair strip
            &[(60.0, 150.0, 140.0, 90.0), (500.0, 100.0, 16.0, 250.0)],  // a card and a strip
            &[(850.0, 100.0, 40.0, 250.0)],                               // the right edge of the plot
            &[(32.0, 330.0, 840.0, 20.0)],                                // a band across both fills
            &[(0.0, 0.0, 908.0, 40.0)],                                   // nowhere near the chart
            &[(100.4, 120.6, 50.3, 40.2), (400.5, 400.5, 60.0, 60.0)],   // fractional, two charts
        ];
        for rects in cases {
            let part = render(Some(rects));
            let mut bad = 0usize;
            for i in 0..full.len() {
                if (full[i] as i32 - part[i] as i32).abs() > 1 { bad += 1; }
            }
            assert_eq!(bad, 0, "{rects:?}: {bad} bytes differ from a full repaint");
        }
    }
}

#[cfg(test)]
mod mask_rect_tests {
    use super::*;

    fn round_mask(w: u32, h: u32) -> tiny_skia::Mask {
        // Something that is not a plain rect: a rounded rect.
        let mut m = tiny_skia::Mask::new(w, h).unwrap();
        let p = rrect_path(10.0, 10.0, w as f32 - 20.0, h as f32 - 20.0, 24.0).unwrap();
        m.fill_path(&p, tiny_skia::FillRule::Winding, true, tiny_skia::Transform::identity());
        m
    }

    fn via_path(mut m: tiny_skia::Mask, l: f32, t: f32, r: f32, b: f32) -> tiny_skia::Mask {
        let p = rrect_path(l, t, r - l, b - t, 0.0).unwrap();
        m.intersect_path(&p, tiny_skia::FillRule::Winding, true, tiny_skia::Transform::identity());
        m
    }

    #[test]
    fn narrowing_a_mask_to_a_whole_pixel_rect_matches_intersecting_a_path() {
        for (l, t, r, b) in [(30.0, 40.0, 200.0, 150.0), (0.0, 0.0, 64.0, 64.0), (50.0, 20.0, 51.0, 120.0), (-10.0, -10.0, 90.0, 300.0), (150.0, 100.0, 400.0, 400.0)] {
            let mut fast = round_mask(240, 180);
            mask_intersect_rect(&mut fast, l, t, r, b);
            let slow = via_path(round_mask(240, 180), l, t, r, b);
            assert_eq!(fast.data(), slow.data(), "rect {l},{t},{r},{b}");
        }
    }

    #[test]
    fn a_fractional_rect_differs_from_the_path_version_only_by_edge_antialiasing() {
        for (l, t, r, b) in [(30.5, 40.25, 200.75, 150.5), (12.3, 7.7, 99.9, 60.1)] {
            let mut fast = round_mask(240, 180);
            mask_intersect_rect(&mut fast, l, t, r, b);
            let slow = via_path(round_mask(240, 180), l, t, r, b);
            let worst = fast.data().iter().zip(slow.data()).map(|(a, b)| (*a as i32 - *b as i32).abs()).max().unwrap();
            let off = fast.data().iter().zip(slow.data()).filter(|(a, b)| (**a as i32 - **b as i32).abs() > 24).count();
            assert!(worst <= 64, "rect {l},{t},{r},{b}: worst difference {worst}/255");
            // Only the one-pixel border can differ much.
            assert!(off <= 2 * ((r - l) as usize + (b - t) as usize) + 8, "{off} pixels differ by more than 24");
        }
    }

    #[test]
    fn a_rect_that_misses_the_mask_empties_it() {
        let mut m = round_mask(100, 100);
        mask_intersect_rect(&mut m, 500.0, 500.0, 600.0, 600.0);
        assert!(m.data().iter().all(|v| *v == 0));
        let mut m2 = round_mask(100, 100);
        mask_intersect_rect(&mut m2, 50.0, 50.0, 50.0, 80.0); // zero width
        assert!(m2.data().iter().all(|v| *v == 0));
    }
}
