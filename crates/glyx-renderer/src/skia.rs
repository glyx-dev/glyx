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

/// One frame accumulated in a CPU `Pixmap`.
pub struct TinySkiaFrame {
    pub(crate) pixmap: tiny_skia::Pixmap,
    /// Mask stack — saved/restored across push_layer / pop_layer.
    clip_stack:   Vec<Option<tiny_skia::Mask>>,
    /// Active clip mask (`None` = no clip).
    current_mask: Option<tiny_skia::Mask>,
    /// Partial redraw: the damage rect whose clip mask hasn't been built yet.
    /// Most draws lie inside the damage and need no mask at all (see
    /// `needs_mask`), so the full-window mask is only allocated and filled
    /// when some draw actually needs it (`ensure_mask`).
    pending_base: Option<tiny_skia::Rect>,
    /// Damage region for partial redraw (`None` = full frame).  Draws are
    /// clipped to this rect via the base mask AND bbox-culled for speed.
    damage:       Option<tiny_skia::Rect>,
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
        damage: Option<(f64, f64, f64, f64)>,
    ) -> Option<Self> {
        // Partial redraw needs last frame's pixels — only valid when the
        // pooled pixmap exists at the same size.
        let (mut pixmap, damage) = match (shared.pixmap.take(), damage) {
            (Some(p), Some(d)) if p.width() == width && p.height() == height => (p, Some(d)),
            (Some(p), _) if p.width() == width && p.height() == height => (p, None),
            _ => (tiny_skia::Pixmap::new(width, height)?, None),
        };

        // Clamp damage to the pixmap; treat degenerate/full-coverage as full.
        let damage_rect = damage.and_then(|(x, y, w, h)| {
            let x0 = (x.max(0.0)).floor() as f32;
            let y0 = (y.max(0.0)).floor() as f32;
            let x1 = ((x + w).min(width  as f64)).ceil() as f32;
            let y1 = ((y + h).min(height as f64)).ceil() as f32;
            if x1 <= x0 || y1 <= y0 { return None; }             // empty
            if x0 <= 0.0 && y0 <= 0.0
                && x1 >= width as f32 && y1 >= height as f32 { return None; } // full
            tiny_skia::Rect::from_ltrb(x0, y0, x1, y1)
        });

        let q = bg.to_rgba8();
        let bg_color = tiny_skia::Color::from_rgba8(q.r, q.g, q.b, q.a);
        match damage_rect {
            None => pixmap.fill(bg_color),
            Some(d) => {
                // Clear only the damaged region to the background color.
                let paint = tiny_skia::Paint {
                    shader: tiny_skia::Shader::SolidColor(bg_color),
                    blend_mode: tiny_skia::BlendMode::Source,
                    anti_alias: false,
                    ..Default::default()
                };
                pixmap.fill_rect(d, &paint, tiny_skia::Transform::identity(), None);
            }
        }

        Some(Self {
            pixmap,
            clip_stack:   Vec::new(),
            current_mask: None,
            pending_base: damage_rect,
            damage:       damage_rect,
            xf:           tiny_skia::Transform::identity(),
            xf_stack:     Vec::new(),
            shared,
        })
    }

    /// The clamped damage rect this frame was created with (`None` = full).
    pub fn damage(&self) -> Option<(u32, u32, u32, u32)> {
        self.damage.map(|d| {
            (d.left() as u32, d.top() as u32,
             (d.right() - d.left()) as u32, (d.bottom() - d.top()) as u32)
        })
    }

    /// True when a draw with the given bbox lies entirely outside the damage
    /// region and can be skipped (the base mask would zero it anyway; this
    /// avoids the rasterization work).
    #[inline]
    fn culled(&self, x: f64, y: f64, w: f64, h: f64) -> bool {
        let Some(d) = self.damage else { return false };
        let (l, t, r, b) = self.screen_bbox(x, y, w, h);
        r <= d.left() || l >= d.right() || b <= d.top() || t >= d.bottom()
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
        if let Some(d) = self.damage {
            if self.clip_stack.is_empty() {
                let (l, t, r, b) = self.screen_bbox(x, y, w, h);
                // 1px slack for anti-aliased edges.
                if l - 1.0 >= d.left() && t - 1.0 >= d.top()
                    && r + 1.0 <= d.right() && b + 1.0 <= d.bottom() {
                    return false;
                }
            }
        }
        self.current_mask.is_some() || self.pending_base.is_some()
    }

    /// Build the deferred damage-rect clip mask (see `pending_base`). Every
    /// draw that passes `current_mask` without a `needs_mask` check, and
    /// every clip push, calls this first.
    fn ensure_mask(&mut self) {
        let Some(d) = self.pending_base.take() else { return };
        self.current_mask = tiny_skia::Mask::new(self.pixmap.width(), self.pixmap.height()).map(|mut m| {
            let p = tiny_skia::PathBuilder::from_rect(d);
            m.fill_path(&p, tiny_skia::FillRule::Winding, true, tiny_skia::Transform::identity());
            m
        });
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
    /// transform, and the intersection avoids the rounded corners (it lies in
    /// the rect's straight-edged horizontal or vertical band). `None` → draw
    /// the shape normally.
    fn damage_clipped_fill(&self, x: f64, y: f64, w: f64, h: f64, radius: f64)
        -> Option<tiny_skia::Rect>
    {
        let d = self.damage?;
        if !self.xf.is_identity() { return None; }
        let (x, y, r, b) = (x as f32, y as f32, (x + w) as f32, (y + h) as f32);
        let (il, it) = (x.max(d.left()), y.max(d.top()));
        let (ir, ib) = (r.min(d.right()), b.min(d.bottom()));
        if ir <= il || ib <= it { return None; }
        // Not worth it (and not needed) when the shape is already inside.
        if il == x && it == y && ir == r && ib == b { return None; }
        let rad = (radius as f32).min((r - x) * 0.5).min((b - y) * 0.5).max(0.0);
        let in_h_band = il >= x + rad && ir <= r - rad;
        let in_v_band = it >= y + rad && ib <= b - rad;
        if rad > 0.0 && !in_h_band && !in_v_band { return None; }
        tiny_skia::Rect::from_ltrb(il, it, ir, ib)
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
        if let Some(rect) = self.damage_clipped_fill(x, y, w, h, radius) {
            let paint = solid_paint(color);
            // The rect IS inside the damage, so only a pushed clip layer matters.
            let mask = if self.clip_stack.is_empty() { None } else { self.current_mask.as_ref() };
            self.pixmap.fill_rect(rect, &paint, self.xf, mask);
            return;
        }
        let Some(path) = rrect_path(x as f32, y as f32, w as f32, h as f32, radius as f32)
            else { return };
        let paint = solid_paint(color);
        let mask  = if self.mask_needed(x, y, w, h) { self.current_mask.as_ref() } else { None };
        self.pixmap.fill_path(&path, &paint, tiny_skia::FillRule::Winding,
                              self.xf, mask);
    }

    pub fn fill_rounded_rect_with_brush(&mut self, x: f64, y: f64, w: f64, h: f64,
                                         radius: f64, brush: &peniko::Brush) {
        if self.culled(x, y, w, h) { return; }
        let Some(path) = rrect_path(x as f32, y as f32, w as f32, h as f32, radius as f32)
            else { return };
        let paint: tiny_skia::Paint<'static> = match brush {
            peniko::Brush::Solid(c) => solid_paint(*c),
            peniko::Brush::Gradient(g) => match gradient_shader(g) {
                Some(shader) => tiny_skia::Paint {
                    shader,
                    anti_alias: true,
                    ..Default::default()
                },
                None => return,
            },
            _ => return,
        };
        let mask = if self.mask_needed(x, y, w, h) { self.current_mask.as_ref() } else { None };
        self.pixmap.fill_path(&path, &paint, tiny_skia::FillRule::Winding,
                              self.xf, mask);
    }

    pub fn fill_rect(&mut self, x: f64, y: f64, w: f64, h: f64, color: peniko::Color) {
        if self.culled(x, y, w, h) { return; }
        let paint = solid_paint(color);
        // A damage-clipped rect is inside the damage by construction, so only
        // a pushed clip layer can still matter.
        let (rect, needs) = match self.damage_clipped_fill(x, y, w, h, 0.0) {
            Some(r) => (Some(r), !self.clip_stack.is_empty()),
            None    => (tiny_skia::Rect::from_xywh(x as f32, y as f32, w as f32, h as f32),
                        self.mask_needed(x, y, w, h)),
        };
        let mask = if needs { self.current_mask.as_ref() } else { None };
        if let Some(rect) = rect {
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
        self.ensure_mask();
        let mask   = self.current_mask.as_ref();
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
        self.ensure_mask();
        let mask = self.current_mask.as_ref();
        self.pixmap.stroke_path(&path, &paint, &stroke,
                                self.xf, mask);
    }

    pub fn fill_path(&mut self, pts: &[f32], color: peniko::Color) {
        let Some(path) = poly_path(pts, true) else { return };
        let paint = solid_paint(color);
        self.ensure_mask();
        let mask  = self.current_mask.as_ref();
        self.pixmap.fill_path(&path, &paint, tiny_skia::FillRule::Winding,
                              self.xf, mask);
    }

    pub fn stroke_path(&mut self, pts: &[f32], width: f64, closed: bool, color: peniko::Color) {
        let Some(path) = poly_path(pts, closed) else { return };
        let paint  = solid_paint(color);
        let stroke = tiny_skia::Stroke {
            width: width as f32,
            line_cap:  tiny_skia::LineCap::Round,
            line_join: tiny_skia::LineJoin::Round,
            ..Default::default()
        };
        self.ensure_mask();
        let mask = self.current_mask.as_ref();
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

                // `scaler` borrows self.shared.scale_ctx — separate from
                // self.pixmap and self.shared.glyph_cache via field splitting.
                let mut scaler = self.shared.scale_ctx
                    .builder(font_ref)
                    .size(size)
                    .hint(true)
                    .build();

                // In Parley 0.10, g.x / g.y are shaping *adjustments* from the
                // current pen, NOT cumulative positions.  Advance pen by g.advance.
                let mut pen_x = run_off;

                for g in gr.glyphs() {
                    let glyph_id: swash::GlyphId = g.id as u16;
                    let bx = (x + pen_x + g.x as f64) as i32;
                    let by = (y + baseline + g.y as f64) as i32;
                    pen_x += g.advance as f64;

                    let key = GlyphKey {
                        data_ptr, font_index, glyph_id, size_class,
                    };

                    // Check cache.  The cache stores the raw alpha mask — no
                    // color in the key, colorized cheaply at draw time.
                    let mask = if text_mask_needed { self.current_mask.as_ref() } else { None };
                    if let Some(cached) = self.shared.glyph_cache.get(&key) {
                        let draw_x = bx + cached.left;
                        let draw_y = by - cached.top;
                        // Colorize cached alpha into premultiplied RGBA.
                        let mut rgba = Vec::with_capacity(
                            (cached.width * cached.height * 4) as usize
                        );
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
                        continue;
                    }

                    // Cache miss — rasterize via swash.
                    let Some(image) = Render::new(&[Source::Outline])
                        .format(Format::Alpha)
                        .render(&mut scaler, glyph_id)
                    else { continue };

                    let pw = image.placement.width;
                    let ph = image.placement.height;
                    if pw == 0 || ph == 0 { continue; }

                    let draw_x = bx + image.placement.left;
                    let draw_y = by - image.placement.top;

                    // Colorize alpha → premultiplied RGBA.
                    let mut rgba = Vec::with_capacity((pw * ph * 4) as usize);
                    for &alpha in &image.data {
                        let a = alpha as u32;
                        rgba.push((cr as u32 * a / 255) as u8);
                        rgba.push((cg as u32 * a / 255) as u8);
                        rgba.push((cb as u32 * a / 255) as u8);
                        rgba.push(alpha);
                    }

                    if let Some(glyph_pm) = tiny_skia::PixmapRef::from_bytes(&rgba, pw, ph) {
                        self.pixmap.draw_pixmap(
                            draw_x, draw_y, glyph_pm,
                            &tiny_skia::PixmapPaint::default(),
                            xf,
                            mask,
                        );
                    }

                    // Store raw alpha in cache (color-independent).
                    self.shared.glyph_cache.put(key, CachedAlphaGlyph {
                        alpha:  image.data.to_vec(),
                        width:  pw,
                        height: ph,
                        left:   image.placement.left,
                        top:    image.placement.top,
                    });
                }
                // `scaler` dropped here — releases &mut self.shared.scale_ctx.
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
        let saved = self.current_mask.take();
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
        self.clip_stack.push(saved);
        self.current_mask = new_mask;
    }

    pub fn push_layer(&mut self, x: f64, y: f64, w: f64, h: f64) {
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
        self.current_mask = self.clip_stack.pop().flatten();
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
        write: impl FnOnce(&[u8], u32, u32, Option<(u32, u32, u32, u32)>),
    ) {
        let damage = frame.damage();
        let TinySkiaFrame { pixmap, shared, .. } = frame;
        let w = pixmap.width();
        let h = pixmap.height();
        write(pixmap.data(), w, h, damage);
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
    pub fn begin_frame_damaged(&mut self, damage: Option<(f64, f64, f64, f64)>) -> TinySkiaFrame {
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
        let mut frame = r.begin_frame_damaged(Some((20.0, 0.0, 20.0, 16.0)));
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
        let mut frame = r.begin_frame_damaged(Some((40.0, 0.0, 20.0, 16.0)));
        assert!(frame.damage().is_some());
        // Untransformed box (0..10) is outside the damage; the moved one isn't.
        frame.push_transform(Affine::translate((40.0, 0.0)));
        frame.fill_rect(0.0, 0.0, 10.0, 10.0, RED);
        frame.pop_transform();
        assert!(is_red(px(&frame, 45, 5)), "must not be culled by its untransformed box");
    }
}
