//! The canvas painter: runs a canvas's command list against a frame, with the 2D drawing state a canvas has.
//!
//! The renderer backends only share a few primitives (filled and stroked polygons, circles, images, rectangular
//! clips), so everything richer is worked out here, once, in glyx-core, and reaches every backend as those
//! primitives:
//!
//! - **Transforms** (`translate`, `rotate`, `scale`, `transform`) are applied to the geometry before it is drawn,
//!   so they work the same on Vello, tiny-skia and Direct2D. A circle under a non-uniform transform becomes an
//!   ellipse polygon; a rotated rectangle a polygon.
//! - **Line caps, joins and dashes** (and strokes under a skewing transform) are made by kurbo's stroker in the
//!   shape's own coordinates and filled as polygons, so they are exact under any transform. A plain stroke (round
//!   caps and joins, no dash) keeps the backends' own, faster stroker.
//! - **Shadows** are a handful of offset, translucent copies of the shape (a blur approximation: cheap, with no
//!   offscreen buffer).
//! - **Conic gradients** are filled as thin wedges clipped to the shape (not every backend has them).
//! - **Blend modes** use the backends' own blending (Vello, tiny-skia); Direct2D draws source-over.
//! - **Global alpha** multiplies the colours it draws.
//! - **Rotated text** is drawn from its glyph outlines on the CPU renderer and Direct2D, and natively on Vello; upright
//!   text keeps the fast cached path.
//! - **Path clips** (`clip()`) are a mask on tiny-skia, a layer with a shape on Vello, a geometric mask on Direct2D.
//!
//! Limits, by design: a rectangular clip (`pushClip`) under a rotation is the rectangle's bounding box (`clip()` with a
//! path is exact); a radial gradient's start radius is ignored by tiny-skia; a
//! scaled sub-rectangle of an image (`drawImage` with a source rect) picks up a little of the pixels beside it at its
//! edge, like a texture atlas (leave a pixel of space between sprites).

use std::collections::HashMap;
use glyx_renderer::{peniko, AnyFrame, BlendKind};
use glyx_renderer::peniko::kurbo::{self, Affine, BezPath, PathEl, Point};
use glyx_runtime::bindings::{CanvasBrush, CanvasCmd};
use glyx_text::TextSystem;
use crate::label_cache::LabelCache;
use crate::{CachedLabel, LabelKey};

/// Straight segments a circle gets per sqrt(radius in pixels) when it has to become a polygon.
const CIRCLE_SEGMENTS_PER_SQRT_PX: f64 = 8.0;
/// How closely a flattened curve follows the true one, in pixels.
const FLATTEN_TOLERANCE_PX: f64 = 0.2;
/// Wedges a conic gradient is drawn as.
const CONIC_WEDGES: usize = 72;
/// Most shadow copies drawn for one shape.
const SHADOW_TAPS: usize = 9;

#[derive(Clone, Copy, PartialEq, Debug)]
struct StrokeStyle {
    cap: u8,
    join: u8,
    miter_limit: f32,
    dash_offset: f32,
    // Up to 32 entries (the decoder's limit); kept inline so saving the state costs no allocation.
    dashes: [f32; 32],
    n_dashes: u8,
}

impl Default for StrokeStyle {
    /// Round caps and joins, solid: what canvases drew before the line style could be set (the canvas standard's
    /// butt caps and miter joins are opt-in here so existing drawings do not change).
    fn default() -> Self {
        Self { cap: 1, join: 1, miter_limit: 10.0, dash_offset: 0.0, dashes: [0.0; 32], n_dashes: 0 }
    }
}

impl StrokeStyle {
    fn is_plain(&self) -> bool { self.cap == 1 && self.join == 1 && self.n_dashes == 0 }
    fn dashes(&self) -> &[f32] { &self.dashes[..self.n_dashes as usize] }
}

#[derive(Clone, Copy, PartialEq, Debug)]
struct ShadowStyle { color: [u8; 4], blur: f32, dx: f32, dy: f32 }

#[derive(Clone)]
struct State {
    m: Affine,
    alpha: f32,
    blend: BlendKind,
    line: StrokeStyle,
    shadow: Option<ShadowStyle>,
    /// Clip layers open when this state was saved, so `restore` closes the ones opened since.
    clip_depth: usize,
}

impl State {
    fn new() -> Self {
        Self { m: Affine::IDENTITY, alpha: 1.0, blend: BlendKind::SourceOver, line: StrokeStyle::default(), shadow: None, clip_depth: 0 }
    }
}

pub(crate) struct Painter<'a> {
    frame: &'a mut AnyFrame,
    text_sys: &'a mut TextSystem,
    labels: &'a mut LabelCache,
    images: &'a HashMap<u32, peniko::ImageData>,
    /// The canvas node's top-left on the window, added after the canvas's own transform.
    origin: (f64, f64),
    /// The node's inherited opacity, multiplied into every colour.
    opacity: f32,
    /// A scale applied to the whole drawing (an export at a larger or smaller size); identity when drawing to the window.
    base: Affine,
    /// The canvas node's own (opaque) background colour, if it has one: what erasing (`destination-out`) reveals.
    /// The canvas draws straight into the window, so a true erase would cut through its background to the window
    /// behind; painting the background colour over the content looks the same as erasing down to it.
    erase_to: Option<[u8; 4]>,
    state: State,
    stack: Vec<State>,
    /// Clip layers currently open on the frame.
    clip_depth: usize,
    /// The blend mode the frame is currently set to (so it is only changed when it differs).
    frame_blend: BlendKind,
}

impl<'a> Painter<'a> {
    pub(crate) fn new(
        frame: &'a mut AnyFrame, text_sys: &'a mut TextSystem, labels: &'a mut LabelCache,
        images: &'a HashMap<u32, peniko::ImageData>, origin: (f64, f64), opacity: f32,
    ) -> Self {
        Self { frame, text_sys, labels, images, origin, opacity, base: Affine::IDENTITY, erase_to: None, state: State::new(), stack: Vec::new(), clip_depth: 0, frame_blend: BlendKind::SourceOver }
    }

    /// Erasing paints this colour (the canvas node's background) instead of cutting through to the window.
    pub(crate) fn erasing_to(mut self, bg: Option<[u8; 4]>) -> Self {
        self.erase_to = bg.filter(|c| c[3] == 255);
        self
    }

    /// Draw everything under this transform first (an export at another size, or of one region of the canvas).
    pub(crate) fn with_base(mut self, base: Affine) -> Self {
        self.base = base;
        self
    }

    /// Runs the whole list, then closes whatever it left open (clips, blend), so an unbalanced list cannot leak
    /// into the rest of the frame.
    pub(crate) fn paint_all(mut self, cmds: &[CanvasCmd]) {
        for cmd in cmds { self.paint(cmd); }
        self.finish();
    }

    fn finish(&mut self) {
        self.close_blend();
        while self.clip_depth > 0 { self.frame.pop_layer(); self.clip_depth -= 1; }
    }

    /// Canvas space to window space.
    fn full(&self) -> Affine { Affine::translate(self.origin) * self.base * self.state.m }

    fn color(&self, c: [u8; 4]) -> peniko::Color {
        let a = self.state.alpha * self.opacity;
        // Erasing onto a canvas with a background: the "erase" paints that background, with the drawing's own
        // strength (its alpha).
        let c = match (self.state.blend, self.erase_to) {
            (BlendKind::DestinationOut, Some(bg)) => [bg[0], bg[1], bg[2], c[3]],
            _ => c,
        };
        let col = peniko::Color::from_rgba8(c[0], c[1], c[2], c[3]);
        if a >= 1.0 { col } else { col.multiply_alpha(a.max(0.0)) }
    }

    // ── blend ────────────────────────────────────────────────────────────────────────────────────────────

    /// The blend mode the frame should use: an erase onto a known background is source-over (see `erase_to`).
    fn wanted_blend(&self) -> BlendKind {
        if self.state.blend == BlendKind::DestinationOut && self.erase_to.is_some() { BlendKind::SourceOver } else { self.state.blend }
    }

    fn sync_blend(&mut self) {
        let want = self.wanted_blend();
        if self.frame_blend != want {
            self.frame.set_blend(want);
            self.frame_blend = want;
        }
    }

    /// Back to source-over on the frame (before a clip layer is pushed or popped); the next draw sets it again.
    fn close_blend(&mut self) {
        if self.frame_blend != BlendKind::SourceOver {
            self.frame.set_blend(BlendKind::SourceOver);
            self.frame_blend = BlendKind::SourceOver;
        }
    }

    // ── the commands ─────────────────────────────────────────────────────────────────────────────────────

    fn paint(&mut self, cmd: &CanvasCmd) {
        use CanvasCmd::*;
        match cmd {
            Clear => {} // the node paints its own background
            Save => {
                let mut s = self.state.clone();
                s.clip_depth = self.clip_depth;
                self.stack.push(s);
            }
            Restore => {
                if let Some(saved) = self.stack.pop() {
                    self.close_blend();
                    while self.clip_depth > saved.clip_depth { self.frame.pop_layer(); self.clip_depth -= 1; }
                    self.state = saved;
                }
            }
            Transform { m } => self.state.m = Affine::new(m.map(|v| v as f64)),
            GlobalAlpha { alpha } => self.state.alpha = if alpha.is_finite() { alpha.clamp(0.0, 1.0) } else { 1.0 },
            Blend { mode } => self.state.blend = BlendKind::from_u8(*mode),
            LineStyle { cap, join, miter_limit, dash_offset, dashes } => {
                let mut l = StrokeStyle { cap: (*cap).min(2), join: (*join).min(2), miter_limit: miter_limit.max(1.0), dash_offset: *dash_offset, ..Default::default() };
                // A pattern with a negative, non-finite or all-zero entry is ignored, as the canvas does.
                let valid = !dashes.is_empty() && dashes.iter().all(|d| d.is_finite() && *d >= 0.0) && dashes.iter().sum::<f32>() > 0.0;
                if valid {
                    // An odd count repeats itself, as the canvas does: [5] is [5, 5].
                    let mut n = 0usize;
                    for pass in 0..(if dashes.len() % 2 == 1 { 2 } else { 1 }) {
                        for d in dashes { if n < l.dashes.len() { l.dashes[n] = *d; n += 1; } let _ = pass; }
                    }
                    l.n_dashes = n as u8;
                }
                self.state.line = l;
            }
            Shadow { color, blur, dx, dy } => {
                self.state.shadow = if color[3] == 0 { None } else { Some(ShadowStyle { color: *color, blur: blur.max(0.0), dx: *dx, dy: *dy }) };
            }
            PushClip { x, y, w, h } => {
                let (bx, by, bw, bh) = self.aabb(&[(*x as f64, *y as f64), ((*x + *w) as f64, *y as f64), ((*x + *w) as f64, (*y + *h) as f64), (*x as f64, (*y + *h) as f64)]);
                self.close_blend();
                self.frame.push_layer(bx, by, bw, bh);
                self.clip_depth += 1;
            }
            ClipPath { contours, even_odd } => {
                let window = self.to_window(contours);
                self.close_blend();
                self.frame.push_clip_contours(&window, *even_odd);
                self.clip_depth += 1;
            }
            PopClip => {
                // Only closes a clip opened inside the current save level.
                let floor = self.stack.last().map_or(0, |s| s.clip_depth);
                if self.clip_depth > floor {
                    self.close_blend();
                    self.frame.pop_layer();
                    self.clip_depth -= 1;
                }
            }
            FillRect { x, y, w, h, color } => self.fill_rect(*x, *y, *w, *h, &CanvasBrush::solid(*color)),
            StrokeRect { x, y, w, h, color, line_width } => {
                let pts = rect_points(*x, *y, *w, *h);
                self.stroke(&pts, true, *line_width, &CanvasBrush::solid(*color));
            }
            FillCircle { cx, cy, r, color } => self.fill_circle(*cx, *cy, *r, &CanvasBrush::solid(*color)),
            StrokeCircle { cx, cy, r, color, line_width } => self.stroke_circle(*cx, *cy, *r, *line_width, &CanvasBrush::solid(*color)),
            StrokeLine { x0, y0, x1, y1, color, line_width } => self.stroke(&[*x0, *y0, *x1, *y1], false, *line_width, &CanvasBrush::solid(*color)),
            FillText { text, x, y, font_size, color, bold } => self.fill_text(text, *x, *y, *font_size, *color, *bold),
            FillPath { points, color } => self.fill(&[points.clone()], false, &CanvasBrush::solid(*color)),
            StrokePath { points, color, line_width, closed } => self.stroke(points, *closed, *line_width, &CanvasBrush::solid(*color)),
            FillPathGradient { points, x0, y0, x1, y1, stops } => {
                let brush = CanvasBrush { kind: 1, color: [0; 4], p: [*x0, *y0, *x1, *y1, 0.0, 0.0], stops: stops.clone() };
                self.fill(&[points.clone()], false, &brush);
            }
            FillPathBrush { points, brush } => self.fill(&[points.clone()], false, brush),
            StrokePathBrush { points, line_width, closed, brush } => self.stroke(points, *closed, *line_width, brush),
            FillPaths { contours, brush, even_odd } => self.fill(contours, *even_odd, brush),
            DrawImage { image, src, dst } => self.draw_image(*image, *src, *dst),
        }
    }

    // ── geometry helpers ─────────────────────────────────────────────────────────────────────────────────

    /// The window-space bounding box `(x, y, w, h)` of canvas-space points.
    fn aabb(&self, pts: &[(f64, f64)]) -> (f64, f64, f64, f64) {
        let full = self.full();
        let (mut x0, mut y0, mut x1, mut y1) = (f64::MAX, f64::MAX, f64::MIN, f64::MIN);
        for (x, y) in pts {
            let p = full * Point::new(*x, *y);
            x0 = x0.min(p.x); y0 = y0.min(p.y); x1 = x1.max(p.x); y1 = y1.max(p.y);
        }
        (x0, y0, (x1 - x0).max(0.0), (y1 - y0).max(0.0))
    }

    /// The transform keeps shapes' proportions (a rotation, translation and uniform scale, maybe with a flip),
    /// so a circle stays a circle and a stroke keeps one width.
    fn is_similarity(&self) -> bool { is_similarity(&self.state.m) }

    /// Canvas units to pixels: the scale of the whole transform (the export's scale included), and a fair
    /// average when it is not a similarity.
    fn scale(&self) -> f64 { (self.base * self.state.m).determinant().abs().sqrt() }

    /// Canvas-space contours to window-space ones.
    fn to_window(&self, contours: &[Vec<f32>]) -> Vec<Vec<f32>> {
        let full = self.full();
        contours.iter().map(|c| transform_points(c, full)).collect()
    }

    // ── fills ────────────────────────────────────────────────────────────────────────────────────────────

    fn fill_rect(&mut self, x: f32, y: f32, w: f32, h: f32, brush: &CanvasBrush) {
        // An upright rectangle (no rotation or skew) stays a rectangle: the backends draw those crisply.
        let m = self.state.m.as_coeffs();
        if brush.kind == 0 && self.state.shadow.is_none() && m[1].abs() < 1e-9 && m[2].abs() < 1e-9 {
            let full = self.full();
            let a = full * Point::new(x as f64, y as f64);
            let b = full * Point::new((x + w) as f64, (y + h) as f64);
            self.sync_blend();
            let (l, t, r, bt) = (a.x.min(b.x), a.y.min(b.y), a.x.max(b.x), a.y.max(b.y));
            self.frame.fill_rect(l, t, r - l, bt - t, self.color(brush.color));
            return;
        }
        self.fill(&[rect_points(x, y, w, h)], false, brush);
    }

    fn fill_circle(&mut self, cx: f32, cy: f32, r: f32, brush: &CanvasBrush) {
        if brush.kind == 0 && self.state.shadow.is_none() && self.is_similarity() {
            let c = self.full() * Point::new(cx as f64, cy as f64);
            self.sync_blend();
            self.frame.fill_circle(c.x, c.y, r as f64 * self.scale(), self.color(brush.color));
            return;
        }
        self.fill(&[circle_points(cx, cy, r, self.scale() as f32)], false, brush);
    }

    fn stroke_circle(&mut self, cx: f32, cy: f32, r: f32, width: f32, brush: &CanvasBrush) {
        if brush.kind == 0 && self.state.shadow.is_none() && self.is_similarity() && self.state.line.is_plain() {
            let c = self.full() * Point::new(cx as f64, cy as f64);
            let s = self.scale();
            self.sync_blend();
            self.frame.stroke_circle(c.x, c.y, r as f64 * s, width as f64 * s, self.color(brush.color));
            return;
        }
        let pts = circle_points(cx, cy, r, self.scale() as f32);
        self.stroke(&pts, true, width, brush);
    }

    /// Fill closed polygons (canvas space) with a brush, with the shadow under it.
    fn fill(&mut self, contours: &[Vec<f32>], even_odd: bool, brush: &CanvasBrush) {
        let window = self.to_window(contours);
        if window.iter().all(|c| c.len() < 6) { return; }
        if let Some(sh) = self.state.shadow {
            for (dx, dy, k) in shadow_taps(&sh) {
                let moved: Vec<Vec<f32>> = window.iter().map(|c| offset_points(c, dx, dy)).collect();
                let col = self.color([sh.color[0], sh.color[1], sh.color[2], (sh.color[3] as f32 * k).round() as u8]);
                self.sync_blend();
                if moved.len() == 1 { self.frame.fill_path(&moved[0], col); } else { self.frame.fill_contours(&moved, &peniko::Brush::Solid(col), even_odd); }
            }
        }
        self.sync_blend();
        if brush.kind == 3 {
            self.fill_conic(&window, even_odd, brush);
            return;
        }
        let Some(b) = self.brush(brush) else { return };
        match (&b, window.len()) {
            (peniko::Brush::Solid(c), 1) if !even_odd => self.frame.fill_path(&window[0], *c),
            (_, 1) if !even_odd => self.frame.fill_path_with_brush(&window[0], &b),
            _ => self.frame.fill_contours(&window, &b, even_odd),
        }
    }

    /// A brush for the frame, in window space; `None` for a conic gradient (filled as wedges instead).
    fn brush(&self, b: &CanvasBrush) -> Option<peniko::Brush> {
        let full = self.full();
        let stops = || -> Vec<(f32, peniko::Color)> {
            b.stops.iter().map(|(o, c)| (o.clamp(0.0, 1.0), self.color(*c))).collect()
        };
        match b.kind {
            0 => Some(peniko::Brush::Solid(self.color(b.color))),
            1 => {
                let p0 = full * Point::new(b.p[0] as f64, b.p[1] as f64);
                let p1 = full * Point::new(b.p[2] as f64, b.p[3] as f64);
                let st = stops();
                if st.is_empty() { return None; }
                Some(peniko::Brush::Gradient(peniko::Gradient::new_linear(p0, p1).with_stops(st.as_slice())))
            }
            2 => {
                let s = self.scale() as f32;
                let c0 = full * Point::new(b.p[0] as f64, b.p[1] as f64);
                let c1 = full * Point::new(b.p[3] as f64, b.p[4] as f64);
                let st = stops();
                if st.is_empty() { return None; }
                Some(peniko::Brush::Gradient(
                    peniko::Gradient::new_two_point_radial(c0, b.p[2].max(0.0) * s, c1, b.p[5].max(0.0) * s).with_stops(st.as_slice()),
                ))
            }
            _ => None,
        }
    }

    /// A conic (angular) gradient, as thin wedges of flat colour clipped to the shape. `window` is in window space.
    fn fill_conic(&mut self, window: &[Vec<f32>], even_odd: bool, b: &CanvasBrush) {
        if b.stops.is_empty() { return; }
        let full = self.full();
        let c = full * Point::new(b.p[0] as f64, b.p[1] as f64);
        // The gradient turns with the transform's rotation.
        let [m0, m1, ..] = self.state.m.as_coeffs();
        let start = b.p[2] as f64 + m1.atan2(m0);
        let reach = window.iter().flat_map(|p| p.chunks_exact(2))
            .map(|p| (p[0] as f64 - c.x).hypot(p[1] as f64 - c.y))
            .fold(1.0f64, f64::max) * 2.0 + 2.0;
        let step = std::f64::consts::TAU / CONIC_WEDGES as f64;
        for k in 0..CONIC_WEDGES {
            // A little overlap hides the seams anti-aliasing would leave between neighbours.
            let (a0, a1) = (start + k as f64 * step - 0.012, start + (k + 1) as f64 * step + 0.012);
            let wedge = [(c.x, c.y), (c.x + reach * a0.cos(), c.y + reach * a0.sin()), (c.x + reach * a1.cos(), c.y + reach * a1.sin())];
            let clipped: Vec<Vec<f32>> = window.iter().map(|poly| clip_to_convex(poly, &wedge)).filter(|p| p.len() >= 6).collect();
            if clipped.is_empty() { continue; }
            let col = self.color(stop_color(&b.stops, (k as f32 + 0.5) / CONIC_WEDGES as f32));
            if clipped.len() == 1 { self.frame.fill_path(&clipped[0], col); }
            else { self.frame.fill_contours(&clipped, &peniko::Brush::Solid(col), even_odd); }
        }
    }

    // ── strokes ──────────────────────────────────────────────────────────────────────────────────────────

    /// Stroke a polyline (canvas space), `width` in canvas units, with the shadow under it.
    fn stroke(&mut self, pts: &[f32], closed: bool, width: f32, brush: &CanvasBrush) {
        if pts.len() < 4 || !(width > 0.0) { return; }
        let line = self.state.line;
        // The backends' own stroker: round caps and joins, one solid colour, a transform that keeps proportions.
        if line.is_plain() && brush.kind == 0 && self.is_similarity() {
            let window = transform_points(pts, self.full());
            let w = width as f64 * self.scale();
            if let Some(sh) = self.state.shadow {
                for (dx, dy, k) in shadow_taps(&sh) {
                    let col = self.color([sh.color[0], sh.color[1], sh.color[2], (sh.color[3] as f32 * k).round() as u8]);
                    self.sync_blend();
                    self.frame.stroke_path(&offset_points(&window, dx, dy), w, closed, col);
                }
            }
            self.sync_blend();
            self.frame.stroke_path(&window, w, closed, self.color(brush.color));
            return;
        }
        // Anything else: the stroke's outline, made in the shape's own coordinates and filled.
        let outline = stroke_outline(pts, closed, width as f64, &line, FLATTEN_TOLERANCE_PX / self.scale().max(1e-6));
        if outline.is_empty() { return; }
        self.fill(&outline, false, brush);
    }

    // ── images ───────────────────────────────────────────────────────────────────────────────────────────

    fn draw_image(&mut self, id: u32, src: [f32; 4], dst: [f32; 4]) {
        let Some(image) = self.images.get(&id) else { return };
        let (iw, ih) = (image.width as f32, image.height as f32);
        if iw <= 0.0 || ih <= 0.0 { return; }
        let whole = src[2] <= 0.0 || src[3] <= 0.0;
        let (sx, sy, sw, sh) = if whole { (0.0, 0.0, iw, ih) } else { (src[0], src[1], src[2], src[3]) };
        // A negative width or height means "its own size" (the canvas's `drawImage(img, dx, dy)`).
        let (dx, dy) = (dst[0], dst[1]);
        let dw = if dst[2] < 0.0 { sw } else { dst[2] };
        let dh = if dst[3] < 0.0 { sh } else { dst[3] };
        if dw == 0.0 || dh == 0.0 { return; }
        let t = self.full()
            * Affine::translate((dx as f64, dy as f64))
            * Affine::scale_non_uniform((dw / sw) as f64, (dh / sh) as f64)
            * Affine::translate((-(sx as f64), -(sy as f64)));
        let alpha = self.state.alpha * self.opacity;
        // Always clipped to the destination: the CPU rasterizer repeats an image's edge pixels outward (`Pad`), so
        // without a clip an opaque image would smear over the whole canvas.
        let (bx, by, bw, bh) = self.aabb(&[(dx as f64, dy as f64), ((dx + dw) as f64, dy as f64), ((dx + dw) as f64, (dy + dh) as f64), (dx as f64, (dy + dh) as f64)]);
        self.close_blend();
        self.frame.push_layer(bx, by, bw, bh);
        self.sync_blend();
        self.frame.draw_image_alpha(image, t, alpha);
        self.close_blend();
        self.frame.pop_layer();
    }

    // ── text ─────────────────────────────────────────────────────────────────────────────────────────────

    /// Text keeps the transform's translation and scale (not its rotation): the label is shaped at the scaled
    /// size and drawn at the transformed top-left. `y` is the TOP of the text box.
    fn fill_text(&mut self, text: &str, x: f32, y: f32, font_size: f32, color: [u8; 4], bold: bool) {
        // A turned, skewed or mirrored transform: the glyphs are drawn under it as they are (outlines on the CPU
        // renderer and Direct2D, natively on Vello); the label is shaped at its own size, not the scaled one.
        let m = (self.base * self.state.m).as_coeffs();
        if m[1].abs() > 1e-9 || m[2].abs() > 1e-9 || m[0] < 0.0 || m[3] < 0.0 {
            return self.fill_text_transformed(text, x, y, font_size, color, bold);
        }
        let p = self.full() * Point::new(x as f64, y as f64);
        let size = (font_size as f64 * self.scale()).max(1.0) as f32;
        let key = LabelKey::new(text, size, f32::MAX, bold, false, None);
        if self.labels.peek(&key).is_none() {
            let lbl = CachedLabel::new(self.text_sys, text, size, f32::MAX, color, bold, false, None);
            self.labels.put(LabelKey::new(text, size, f32::MAX, bold, false, None), lbl);
        }
        self.sync_blend();
        if let Some(sh) = self.state.shadow {
            // Text gets one offset copy, without blur: cheap, and enough for a drop shadow.
            let col = self.color([sh.color[0], sh.color[1], sh.color[2], sh.color[3]]);
            let key = LabelKey::new(text, size, f32::MAX, bold, false, None);
            if let Some(label) = self.labels.get(&key) { self.frame.draw_text(&label.layout, p.x + sh.dx as f64, p.y + sh.dy as f64, col); }
        }
        let col = self.color(color);
        let key = LabelKey::new(text, size, f32::MAX, bold, false, None);
        if let Some(label) = self.labels.get(&key) { self.frame.draw_text(&label.layout, p.x, p.y, col); }
    }
}

impl<'a> Painter<'a> {
    fn fill_text_transformed(&mut self, text: &str, x: f32, y: f32, font_size: f32, color: [u8; 4], bold: bool) {
        let size = font_size.max(1.0);
        let key = LabelKey::new(text, size, f32::MAX, bold, false, None);
        if self.labels.peek(&key).is_none() {
            let lbl = CachedLabel::new(self.text_sys, text, size, f32::MAX, color, bold, false, None);
            self.labels.put(LabelKey::new(text, size, f32::MAX, bold, false, None), lbl);
        }
        self.sync_blend();
        // The layout's own space (origin at its top-left) to the window.
        let at = self.full() * Affine::translate((x as f64, y as f64));
        if let Some(sh) = self.state.shadow {
            let col = self.color([sh.color[0], sh.color[1], sh.color[2], sh.color[3]]);
            let key = LabelKey::new(text, size, f32::MAX, bold, false, None);
            if let Some(label) = self.labels.get(&key) { self.frame.draw_text_transformed(&label.layout, Affine::translate((sh.dx as f64, sh.dy as f64)) * at, col); }
        }
        let col = self.color(color);
        let key = LabelKey::new(text, size, f32::MAX, bold, false, None);
        if let Some(label) = self.labels.get(&key) { self.frame.draw_text_transformed(&label.layout, at, col); }
    }
}

// ── pure geometry (tested below) ─────────────────────────────────────────────────────────────────────────

fn is_similarity(m: &Affine) -> bool {
    let [a, b, c, d, ..] = m.as_coeffs();
    let (n1, n2) = (a * a + b * b, c * c + d * d);
    let big = n1.max(n2).max(1e-12);
    (n1 - n2).abs() <= 1e-6 * big && (a * c + b * d).abs() <= 1e-6 * big
}

fn rect_points(x: f32, y: f32, w: f32, h: f32) -> Vec<f32> {
    vec![x, y, x + w, y, x + w, y + h, x, y + h]
}

/// A circle as a polygon, with enough segments for its size on screen (`scale` = canvas units to pixels).
fn circle_points(cx: f32, cy: f32, r: f32, scale: f32) -> Vec<f32> {
    let px = (r * scale).abs() as f64;
    let n = ((px.sqrt() * CIRCLE_SEGMENTS_PER_SQRT_PX).ceil() as usize).clamp(12, 160);
    let mut out = Vec::with_capacity(n * 2);
    for i in 0..n {
        let t = std::f64::consts::TAU * i as f64 / n as f64;
        out.push(cx + r * t.cos() as f32);
        out.push(cy + r * t.sin() as f32);
    }
    out
}

fn transform_points(pts: &[f32], m: Affine) -> Vec<f32> {
    let [a, b, c, d, e, f] = m.as_coeffs();
    let mut out = Vec::with_capacity(pts.len());
    for p in pts.chunks_exact(2) {
        let (x, y) = (p[0] as f64, p[1] as f64);
        out.push((a * x + c * y + e) as f32);
        out.push((b * x + d * y + f) as f32);
    }
    out
}

fn offset_points(pts: &[f32], dx: f32, dy: f32) -> Vec<f32> {
    pts.chunks_exact(2).flat_map(|p| [p[0] + dx, p[1] + dy]).collect()
}

/// The copies a shadow is drawn as: `(dx, dy, alpha factor)`. No blur is one copy; a blur spreads copies over a
/// ring (and the middle) of radius half the blur, each carrying an equal share of the alpha.
fn shadow_taps(sh: &ShadowStyle) -> Vec<(f32, f32, f32)> {
    if sh.blur < 0.75 { return vec![(sh.dx, sh.dy, 1.0)]; }
    let ring = (SHADOW_TAPS - 1).min(8);
    let share = 1.0 / SHADOW_TAPS as f32;
    let r = sh.blur * 0.5;
    let mut taps = vec![(sh.dx, sh.dy, share * 1.6)];
    for i in 0..ring {
        let t = std::f32::consts::TAU * i as f32 / ring as f32;
        taps.push((sh.dx + r * t.cos(), sh.dy + r * t.sin(), share * 1.6));
    }
    taps
}

/// The outline of a stroked polyline as closed polygons (canvas space), made by kurbo's stroker with the
/// line style's caps, joins and dashes. `tolerance` is how closely curves (round caps and joins) follow the
/// true curve, in canvas units.
fn stroke_outline(pts: &[f32], closed: bool, width: f64, line: &StrokeStyle, tolerance: f64) -> Vec<Vec<f32>> {
    let mut path = BezPath::new();
    path.move_to((pts[0] as f64, pts[1] as f64));
    for p in pts[2..].chunks_exact(2) { path.line_to((p[0] as f64, p[1] as f64)); }
    if closed { path.close_path(); }
    let cap = match line.cap { 0 => kurbo::Cap::Butt, 2 => kurbo::Cap::Square, _ => kurbo::Cap::Round };
    let join = match line.join { 0 => kurbo::Join::Miter, 2 => kurbo::Join::Bevel, _ => kurbo::Join::Round };
    let mut style = kurbo::Stroke::new(width).with_caps(cap).with_join(join).with_miter_limit(line.miter_limit as f64);
    if line.n_dashes > 0 {
        style = style.with_dashes(line.dash_offset as f64, line.dashes().iter().map(|d| *d as f64));
    }
    let outline = kurbo::stroke(path.iter(), &style, &kurbo::StrokeOpts::default(), tolerance.clamp(1e-4, 10.0));
    flatten_to_contours(&outline, tolerance.clamp(1e-4, 10.0))
}

/// A path as flat polygons, one per sub-path.
fn flatten_to_contours(path: &BezPath, tolerance: f64) -> Vec<Vec<f32>> {
    let mut out: Vec<Vec<f32>> = Vec::new();
    let mut cur: Vec<f32> = Vec::new();
    kurbo::flatten(path.iter(), tolerance, |el| match el {
        PathEl::MoveTo(p) => {
            if cur.len() >= 6 { out.push(std::mem::take(&mut cur)); } else { cur.clear(); }
            cur.push(p.x as f32); cur.push(p.y as f32);
        }
        PathEl::LineTo(p) => { cur.push(p.x as f32); cur.push(p.y as f32); }
        PathEl::ClosePath => { if cur.len() >= 6 { out.push(std::mem::take(&mut cur)); } else { cur.clear(); } }
        _ => {}
    });
    if cur.len() >= 6 { out.push(cur); }
    out
}

/// Sutherland-Hodgman: the polygon `subject` (flat points) cut down to the convex polygon `clip` (any winding).
fn clip_to_convex(subject: &[f32], clip: &[(f64, f64)]) -> Vec<f32> {
    // Which side of an edge is inside depends on the clip's winding.
    let area: f64 = (0..clip.len()).map(|i| { let (a, b) = (clip[i], clip[(i + 1) % clip.len()]); a.0 * b.1 - b.0 * a.1 }).sum();
    let sign = if area >= 0.0 { 1.0 } else { -1.0 };
    let mut poly: Vec<(f64, f64)> = subject.chunks_exact(2).map(|p| (p[0] as f64, p[1] as f64)).collect();
    for i in 0..clip.len() {
        if poly.is_empty() { break; }
        let (a, b) = (clip[i], clip[(i + 1) % clip.len()]);
        let side = |p: (f64, f64)| sign * ((b.0 - a.0) * (p.1 - a.1) - (b.1 - a.1) * (p.0 - a.0));
        let mut next = Vec::with_capacity(poly.len() + 2);
        for j in 0..poly.len() {
            let (p, q) = (poly[j], poly[(j + 1) % poly.len()]);
            let (sp, sq) = (side(p), side(q));
            if sp >= 0.0 { next.push(p); }
            if (sp >= 0.0) != (sq >= 0.0) {
                let t = sp / (sp - sq);
                next.push((p.0 + (q.0 - p.0) * t, p.1 + (q.1 - p.1) * t));
            }
        }
        poly = next;
    }
    poly.iter().flat_map(|p| [p.0 as f32, p.1 as f32]).collect()
}

/// The colour of a gradient at `t` (0 to 1): linear between the stops, flat outside them.
fn stop_color(stops: &[(f32, [u8; 4])], t: f32) -> [u8; 4] {
    let first = stops[0];
    let last = stops[stops.len() - 1];
    if t <= first.0 { return first.1; }
    if t >= last.0 { return last.1; }
    let i = stops.windows(2).position(|w| t >= w[0].0 && t <= w[1].0).unwrap_or(0);
    let (a, b) = (stops[i], stops[i + 1]);
    let u = if b.0 > a.0 { (t - a.0) / (b.0 - a.0) } else { 0.0 };
    std::array::from_fn(|k| (a.1[k] as f32 + (b.1[k] as f32 - a.1[k] as f32) * u).round() as u8)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn bbox(pts: &[f32]) -> (f32, f32, f32, f32) {
        let (mut x0, mut y0, mut x1, mut y1) = (f32::MAX, f32::MAX, f32::MIN, f32::MIN);
        for p in pts.chunks_exact(2) { x0 = x0.min(p[0]); y0 = y0.min(p[1]); x1 = x1.max(p[0]); y1 = y1.max(p[1]); }
        (x0, y0, x1, y1)
    }

    #[test]
    fn a_similarity_keeps_proportions_and_a_stretch_or_skew_does_not() {
        assert!(is_similarity(&Affine::IDENTITY));
        assert!(is_similarity(&(Affine::translate((5.0, 9.0)) * Affine::rotate(0.7) * Affine::scale(3.0))));
        assert!(is_similarity(&Affine::scale_non_uniform(-2.0, 2.0)), "a flip is fine");
        assert!(!is_similarity(&Affine::scale_non_uniform(2.0, 1.0)));
        assert!(!is_similarity(&Affine::new([1.0, 0.0, 0.5, 1.0, 0.0, 0.0])), "a skew");
    }

    #[test]
    fn points_follow_a_transform() {
        let out = transform_points(&[1.0, 0.0, 0.0, 1.0], Affine::translate((10.0, 20.0)) * Affine::scale(2.0));
        assert_eq!(out, vec![12.0, 20.0, 10.0, 22.0]);
    }

    #[test]
    fn a_circle_polygon_has_more_sides_when_it_is_bigger_and_stays_on_the_circle() {
        let small = circle_points(0.0, 0.0, 4.0, 1.0);
        let big = circle_points(0.0, 0.0, 400.0, 1.0);
        assert!(big.len() > small.len());
        for p in big.chunks_exact(2) { assert!(((p[0] * p[0] + p[1] * p[1]).sqrt() - 400.0).abs() < 0.01); }
    }

    #[test]
    fn a_butt_capped_line_ends_flat_a_square_one_extends_and_a_round_one_extends_by_its_radius() {
        let line = [10.0, 10.0, 50.0, 10.0];
        let ext = |cap: u8| {
            let style = StrokeStyle { cap, join: 0, ..Default::default() };
            let out = stroke_outline(&line, false, 8.0, &style, 0.05);
            assert_eq!(out.len(), 1);
            bbox(&out[0])
        };
        let (bx0, by0, bx1, by1) = ext(0);
        assert!((bx0 - 10.0).abs() < 1e-3 && (bx1 - 50.0).abs() < 1e-3, "butt: {bx0}..{bx1}");
        assert!((by0 - 6.0).abs() < 1e-3 && (by1 - 14.0).abs() < 1e-3);
        let (sx0, _, sx1, _) = ext(2);
        assert!((sx0 - 6.0).abs() < 1e-3 && (sx1 - 54.0).abs() < 1e-3, "square: {sx0}..{sx1}");
        let (rx0, _, rx1, _) = ext(1);
        assert!((rx0 - 6.0).abs() < 0.1 && (rx1 - 54.0).abs() < 0.1, "round: {rx0}..{rx1}");
    }

    #[test]
    fn a_dashed_line_is_several_separate_pieces() {
        let mut line = StrokeStyle { cap: 0, join: 0, ..Default::default() };
        line.dashes[..2].copy_from_slice(&[10.0, 10.0]);
        line.n_dashes = 2;
        let out = stroke_outline(&[0.0, 0.0, 100.0, 0.0], false, 2.0, &line, 0.05);
        assert_eq!(out.len(), 5, "100 units of 10-on, 10-off is five dashes");
        for dash in &out { let (x0, _, x1, _) = bbox(dash); assert!((x1 - x0 - 10.0).abs() < 1e-3); }
        // An offset slides the pattern: starting 5 into a dash, the first piece is 5 long, then 10-off, 10-on...
        line.dash_offset = 5.0;
        let shifted = stroke_outline(&[0.0, 0.0, 100.0, 0.0], false, 2.0, &line, 0.05);
        let mut spans: Vec<(f32, f32)> = shifted.iter().map(|d| { let b = bbox(d); (b.0, b.2) }).collect();
        spans.sort_by(|a, b| a.0.partial_cmp(&b.0).unwrap());
        assert!(spans[0].0.abs() < 1e-3 && (spans[0].1 - 5.0).abs() < 1e-3, "first piece {:?}", spans[0]);
        assert!((spans[1].0 - 15.0).abs() < 1e-3 && (spans[1].1 - 25.0).abs() < 1e-3, "second piece {:?}", spans[1]);
    }

    #[test]
    fn a_closed_stroke_is_a_ring_two_contours_not_one() {
        let sq = rect_points(0.0, 0.0, 20.0, 20.0);
        let out = stroke_outline(&sq, true, 4.0, &StrokeStyle { cap: 0, join: 0, ..Default::default() }, 0.05);
        assert_eq!(out.len(), 2, "outer and inner outline");
    }

    #[test]
    fn a_miter_join_comes_to_a_point_and_a_bevel_cuts_it() {
        // An L: the outer corner of a 6-wide stroke around (20, 20) is (23, 23) mitred, and cut off by a bevel.
        let corner = [0.0, 20.0, 20.0, 20.0, 20.0, 0.0];
        let reach = |join: u8| {
            let out = stroke_outline(&corner, false, 6.0, &StrokeStyle { cap: 0, join, ..Default::default() }, 0.05);
            out.iter().flat_map(|c| c.chunks_exact(2)).map(|p| p[0] + p[1]).fold(f32::MIN, f32::max)
        };
        assert!((reach(0) - 46.0).abs() < 1e-3, "the miter tip is at (23, 23)");
        assert!((reach(2) - 43.0).abs() < 1e-3, "the bevel cuts it to (23, 20)-(20, 23)");
        assert!(reach(1) > reach(2) && reach(1) < reach(0), "a round join sits between the two");
    }

    #[test]
    fn clipping_a_square_to_a_triangle_leaves_their_intersection() {
        // The unit-ish square 0..10 cut by the half-plane triangle (0,0)-(20,0)-(0,20): the corner at (10,10) is
        // on the hypotenuse's far side (x + y = 20), so the result is the square.
        let sq = rect_points(0.0, 0.0, 10.0, 10.0);
        let all = clip_to_convex(&sq, &[(0.0, 0.0), (20.0, 0.0), (0.0, 20.0)]);
        assert_eq!(bbox(&all), (0.0, 0.0, 10.0, 10.0));
        // A smaller triangle (x + y <= 10) keeps just the lower-left half.
        let half = clip_to_convex(&sq, &[(0.0, 0.0), (10.0, 0.0), (0.0, 10.0)]);
        assert_eq!(bbox(&half), (0.0, 0.0, 10.0, 10.0));
        let area: f32 = (0..half.len() / 2).map(|i| { let j = (i + 1) % (half.len() / 2); half[i * 2] * half[j * 2 + 1] - half[j * 2] * half[i * 2 + 1] }).sum::<f32>() / 2.0;
        assert!((area.abs() - 50.0).abs() < 1e-3, "{area}");
        // Entirely outside: nothing; and the clip's winding does not matter.
        assert!(clip_to_convex(&sq, &[(50.0, 50.0), (60.0, 50.0), (50.0, 60.0)]).len() < 6);
        let reversed = clip_to_convex(&sq, &[(0.0, 20.0), (20.0, 0.0), (0.0, 0.0)]);
        assert_eq!(bbox(&reversed), (0.0, 0.0, 10.0, 10.0));
    }

    #[test]
    fn gradient_colours_interpolate_between_stops_and_are_flat_outside() {
        let stops = [(0.2, [0, 0, 0, 255]), (0.8, [200, 100, 50, 255])];
        assert_eq!(stop_color(&stops, 0.0), [0, 0, 0, 255]);
        assert_eq!(stop_color(&stops, 1.0), [200, 100, 50, 255]);
        assert_eq!(stop_color(&stops, 0.5), [100, 50, 25, 255]);
    }

    #[test]
    fn a_shadow_is_one_copy_without_blur_and_a_spread_of_copies_with_it() {
        let hard = shadow_taps(&ShadowStyle { color: [0, 0, 0, 255], blur: 0.0, dx: 3.0, dy: 4.0 });
        assert_eq!(hard, vec![(3.0, 4.0, 1.0)]);
        let soft = shadow_taps(&ShadowStyle { color: [0, 0, 0, 255], blur: 8.0, dx: 0.0, dy: 0.0 });
        assert_eq!(soft.len(), SHADOW_TAPS);
        assert!(soft.iter().skip(1).all(|(x, y, _)| ((x * x + y * y).sqrt() - 4.0).abs() < 1e-3), "the ring is half the blur out");
    }

    // ── pixels: the painter through the real CPU rasterizer ──────────────────────────────────────────────

    use glyx_runtime::bindings::{blend_mode, CanvasBrush, CanvasCmd};

    const RED: [u8; 4] = [255, 0, 0, 255];
    const BLUE: [u8; 4] = [0, 0, 255, 255];

    /// A drawing as pixels: `px(x, y)` reads a straight-alpha RGBA pixel.
    struct Shot { rgba: Vec<u8>, w: u32 }
    impl Shot {
        fn px(&self, x: u32, y: u32) -> [u8; 4] {
            let i = ((y * self.w + x) * 4) as usize;
            [self.rgba[i], self.rgba[i + 1], self.rgba[i + 2], self.rgba[i + 3]]
        }
    }
    /// `cmds` drawn into a `w` x `h` transparent pixmap.
    fn shot(cmds: &[CanvasCmd], w: u32, h: u32) -> Shot {
        let mut ts = glyx_text::TextSystem::new();
        let mut labels = crate::label_cache::LabelCache::new(Some(64));
        let rgba = crate::canvas_export::render_rgba(cmds, &HashMap::new(), &mut ts, &mut labels, w, h, Affine::IDENTITY, None);
        Shot { rgba, w }
    }
    fn rect(x: f32, y: f32, w: f32, h: f32, color: [u8; 4]) -> CanvasCmd { CanvasCmd::FillRect { x, y, w, h, color } }

    #[test]
    fn a_transform_moves_and_turns_what_follows_it() {
        // Translate, then a rect: it lands offset. Rotate 90 degrees: a rect along +x runs along +y.
        let moved = shot(&[CanvasCmd::Transform { m: [1.0, 0.0, 0.0, 1.0, 20.0, 10.0] }, rect(0.0, 0.0, 10.0, 10.0, RED)], 40, 40);
        assert_eq!(moved.px(25, 15), RED);
        assert_eq!(moved.px(5, 5)[3], 0, "not at the origin any more");
        let turned = shot(&[CanvasCmd::Transform { m: [0.0, 1.0, -1.0, 0.0, 20.0, 5.0] }, rect(0.0, 0.0, 20.0, 6.0, RED)], 40, 40);
        assert_eq!(turned.px(17, 15), RED, "the rect now runs down from (20, 5), 6 wide to its left");
        assert_eq!(turned.px(30, 7)[3], 0);
    }

    #[test]
    fn global_alpha_and_save_restore() {
        let s = shot(&[
            CanvasCmd::Save, CanvasCmd::GlobalAlpha { alpha: 0.5 }, rect(0.0, 0.0, 10.0, 10.0, RED), CanvasCmd::Restore,
            rect(10.0, 0.0, 10.0, 10.0, RED),
        ], 20, 10);
        let half = s.px(5, 5);
        assert!((half[3] as i32 - 128).abs() <= 2 && half[0] == 255, "half transparent red: {half:?}");
        assert_eq!(s.px(15, 5), RED, "restored: opaque again");
    }

    #[test]
    fn a_clip_cuts_what_is_drawn_inside_it_and_popclip_ends_it() {
        let s = shot(&[
            CanvasCmd::PushClip { x: 10.0, y: 0.0, w: 10.0, h: 20.0 }, rect(0.0, 0.0, 40.0, 20.0, RED), CanvasCmd::PopClip,
            rect(30.0, 0.0, 10.0, 20.0, BLUE),
        ], 40, 20);
        assert_eq!(s.px(5, 10)[3], 0);
        assert_eq!(s.px(15, 10), RED);
        assert_eq!(s.px(25, 10)[3], 0);
        assert_eq!(s.px(35, 10), BLUE);
    }

    #[test]
    fn an_unmatched_restore_or_popclip_does_nothing_and_an_open_clip_is_closed_at_the_end() {
        let s = shot(&[CanvasCmd::Restore, CanvasCmd::PopClip, CanvasCmd::PushClip { x: 0.0, y: 0.0, w: 5.0, h: 5.0 }, rect(0.0, 0.0, 20.0, 20.0, RED)], 20, 20);
        assert_eq!(s.px(2, 2), RED);
        assert_eq!(s.px(10, 10)[3], 0);
    }

    #[test]
    fn a_dashed_line_has_gaps_and_a_solid_one_does_not() {
        let line = |dashes: Vec<f32>| shot(&[
            CanvasCmd::LineStyle { cap: 0, join: 0, miter_limit: 10.0, dash_offset: 0.0, dashes },
            CanvasCmd::StrokeLine { x0: 0.0, y0: 5.0, x1: 100.0, y1: 5.0, color: RED, line_width: 4.0 },
        ], 100, 10);
        let edges = |s: &Shot| (1..100).filter(|x| (s.px(*x, 5)[3] > 127) != (s.px(*x - 1, 5)[3] > 127)).count();
        assert!(edges(&line(vec![])) <= 1, "solid: no gaps");
        // 10 on, 10 off over 100: dashes at 0-10, 20-30, ... 80-90, and the last gap: 9 edges inside the line.
        assert_eq!(edges(&line(vec![10.0, 10.0])), 9);
    }

    #[test]
    fn caps_extend_a_line_past_its_ends_as_set() {
        let ends = |cap: u8| {
            let s = shot(&[
                CanvasCmd::LineStyle { cap, join: 0, miter_limit: 10.0, dash_offset: 0.0, dashes: vec![] },
                CanvasCmd::StrokePath { points: vec![10.0, 10.0, 30.0, 10.0], color: RED, line_width: 8.0, closed: false },
            ], 40, 20);
            (s.px(8, 10)[3] > 127, s.px(5, 10)[3] > 127)
        };
        assert_eq!(ends(0), (false, false), "butt: nothing past the end");
        assert_eq!(ends(2), (true, false), "square: half a width past it");
    }

    #[test]
    fn a_radial_gradient_goes_from_its_centre_colour_to_its_edge_colour() {
        let brush = CanvasBrush { kind: 2, color: [0; 4], p: [20.0, 20.0, 0.0, 20.0, 20.0, 20.0], stops: vec![(0.0, RED), (1.0, BLUE)] };
        let s = shot(&[CanvasCmd::FillPathBrush { points: vec![0.0, 0.0, 40.0, 0.0, 40.0, 40.0, 0.0, 40.0], brush }], 40, 40);
        let (c, e) = (s.px(20, 20), s.px(2, 20));
        assert!(c[0] > 230 && c[2] < 25, "red at the centre: {c:?}");
        assert!(e[2] > 200 && e[0] < 55, "blue at the edge: {e:?}");
    }

    #[test]
    fn a_conic_gradient_turns_through_its_stops_around_the_centre() {
        // Red at angle 0 (pointing right), blue half a turn on (pointing left).
        let brush = CanvasBrush { kind: 3, color: [0; 4], p: [20.0, 20.0, 0.0, 0.0, 0.0, 0.0], stops: vec![(0.0, RED), (0.5, BLUE), (1.0, RED)] };
        let s = shot(&[CanvasCmd::FillPathBrush { points: vec![0.0, 0.0, 40.0, 0.0, 40.0, 40.0, 0.0, 40.0], brush }], 40, 40);
        let (right, left) = (s.px(36, 21), s.px(3, 21));
        assert!(right[0] > 200 && right[2] < 60, "red to the right: {right:?}");
        assert!(left[2] > 200 && left[0] < 60, "blue to the left: {left:?}");
    }

    #[test]
    fn an_even_odd_fill_leaves_a_hole_and_non_zero_fills_it() {
        let outer = vec![0.0, 0.0, 40.0, 0.0, 40.0, 40.0, 0.0, 40.0];
        let inner = vec![10.0, 10.0, 30.0, 10.0, 30.0, 30.0, 10.0, 30.0];   // the same winding: non-zero fills it too
        let fill = |even_odd| shot(&[CanvasCmd::FillPaths { contours: vec![outer.clone(), inner.clone()], brush: CanvasBrush::solid(RED), even_odd }], 40, 40);
        assert_eq!(fill(true).px(20, 20)[3], 0, "even-odd: a hole");
        assert_eq!(fill(false).px(20, 20), RED, "non-zero, same direction: filled");
        assert_eq!(fill(true).px(5, 5), RED);
    }

    #[test]
    fn multiply_darkens_what_is_under_it() {
        let s = shot(&[
            rect(0.0, 0.0, 20.0, 20.0, [200, 100, 50, 255]),
            CanvasCmd::Blend { mode: blend_mode::MULTIPLY }, rect(0.0, 0.0, 20.0, 20.0, [128, 128, 128, 255]),
        ], 20, 20);
        let m = s.px(10, 10);
        assert!((m[0] as i32 - 100).abs() <= 3 && (m[1] as i32 - 50).abs() <= 3 && (m[2] as i32 - 25).abs() <= 3, "multiplied by about half: {m:?}");
    }

    #[test]
    fn a_shadow_appears_beside_the_shape_and_a_blurred_one_has_a_soft_edge() {
        let with = shot(&[
            CanvasCmd::Shadow { color: [0, 0, 0, 255], blur: 0.0, dx: 10.0, dy: 0.0 }, rect(0.0, 0.0, 10.0, 10.0, RED),
        ], 30, 10);
        assert_eq!(with.px(5, 5), RED);
        assert!(with.px(15, 5)[3] > 200 && with.px(15, 5)[0] < 30, "an opaque black copy, 10 to the right: {:?}", with.px(15, 5));
        let blurred = shot(&[
            CanvasCmd::Shadow { color: [0, 0, 0, 255], blur: 8.0, dx: 0.0, dy: 0.0 }, rect(10.0, 10.0, 10.0, 10.0, RED),
        ], 30, 30);
        let halo = blurred.px(8, 15)[3];
        assert!(halo > 0 && halo < 255, "a soft edge just outside the shape: {halo}");
    }

    #[test]
    fn an_image_is_drawn_into_its_destination_and_a_source_rect_picks_a_part() {
        // A 4x2 image: left half red, right half blue.
        let mut data = Vec::new();
        for _ in 0..2 { for x in 0..4 { data.extend_from_slice(if x < 2 { &[255u8, 0, 0, 255] } else { &[0u8, 0, 255, 255] }); } }
        let image = peniko::ImageData {
            data: peniko::Blob::new(std::sync::Arc::new(data)),
            format: peniko::ImageFormat::Rgba8, alpha_type: peniko::ImageAlphaType::Alpha, width: 4, height: 2,
        };
        let mut images = HashMap::new();
        images.insert(7u32, image);
        let draw = |cmds: &[CanvasCmd]| {
            let mut ts = glyx_text::TextSystem::new();
            let mut labels = crate::label_cache::LabelCache::new(Some(64));
            Shot { rgba: crate::canvas_export::render_rgba(cmds, &images, &mut ts, &mut labels, 40, 20, Affine::IDENTITY, None), w: 40 }
        };
        // The whole image into a 40 x 20 box: red left, blue right.
        let whole = draw(&[CanvasCmd::DrawImage { image: 7, src: [0.0; 4], dst: [0.0, 0.0, 40.0, 20.0] }]);
        assert!(whole.px(5, 10)[0] > 200 && whole.px(5, 10)[2] < 60, "{:?}", whole.px(5, 10));
        assert!(whole.px(35, 10)[2] > 200 && whole.px(35, 10)[0] < 60, "{:?}", whole.px(35, 10));
        // Just the right half (source x 2..4) fills the box with blue.
        let part = draw(&[CanvasCmd::DrawImage { image: 7, src: [2.0, 0.0, 2.0, 2.0], dst: [0.0, 0.0, 40.0, 20.0] }]);
        // (Near its left edge a scaled, smoothed sub-rect still picks up a little of the pixel next to it, as
        // any texture atlas does; so look inside it.)
        assert!(part.px(25, 10)[2] > 240 && part.px(25, 10)[0] < 15, "{:?}", part.px(25, 10));
        // Its own size (negative width and height): 4 x 2 pixels at the destination.
        let own = draw(&[CanvasCmd::DrawImage { image: 7, src: [0.0; 4], dst: [10.0, 10.0, -1.0, -1.0] }]);
        assert!(own.px(11, 10)[3] > 200 && own.px(20, 10)[3] == 0, "{:?} {:?}", own.px(11, 10), own.px(20, 10));
    }

    #[test]
    fn a_path_clip_keeps_only_what_is_inside_its_shape_until_restore() {
        // A triangle (0,0)-(40,0)-(0,40): the half of the square under its diagonal.
        let tri = vec![0.0, 0.0, 40.0, 0.0, 0.0, 40.0];
        let s = shot(&[
            CanvasCmd::Save,
            CanvasCmd::ClipPath { contours: vec![tri], even_odd: false },
            rect(0.0, 0.0, 40.0, 40.0, RED),
            CanvasCmd::Restore,
            rect(30.0, 30.0, 10.0, 10.0, BLUE),
        ], 40, 40);
        assert_eq!(s.px(5, 5), RED, "inside the triangle");
        assert_eq!(s.px(35, 35)[0], 0, "outside it the red was cut");
        assert_eq!(s.px(35, 35), BLUE, "after restore the clip is gone");
        assert_eq!(s.px(10, 35)[3], 0, "outside the triangle and not blue");
    }

    #[test]
    fn an_even_odd_path_clip_leaves_a_hole_and_a_clip_inside_a_clip_intersects() {
        let outer = vec![0.0, 0.0, 40.0, 0.0, 40.0, 40.0, 0.0, 40.0];
        let inner = vec![10.0, 10.0, 30.0, 10.0, 30.0, 30.0, 10.0, 30.0];
        let holed = shot(&[CanvasCmd::ClipPath { contours: vec![outer.clone(), inner], even_odd: true }, rect(0.0, 0.0, 40.0, 40.0, RED)], 40, 40);
        assert_eq!(holed.px(5, 5), RED);
        assert_eq!(holed.px(20, 20)[3], 0, "the hole is clipped away");
        // Two clips: only where both allow.
        let both = shot(&[
            CanvasCmd::ClipPath { contours: vec![vec![0.0, 0.0, 25.0, 0.0, 25.0, 40.0, 0.0, 40.0]], even_odd: false },
            CanvasCmd::ClipPath { contours: vec![vec![15.0, 0.0, 40.0, 0.0, 40.0, 40.0, 15.0, 40.0]], even_odd: false },
            rect(0.0, 0.0, 40.0, 40.0, RED),
        ], 40, 40);
        assert_eq!(both.px(20, 20), RED, "in both");
        assert_eq!(both.px(5, 20)[3], 0);
        assert_eq!(both.px(35, 20)[3], 0);
    }

    /// The bounding box (x0, y0, x1, y1) of the visibly painted pixels, and how many there are.
    fn painted_box(s: &Shot, h: u32) -> (u32, u32, u32, u32, usize) {
        let (mut x0, mut y0, mut x1, mut y1, mut n) = (u32::MAX, u32::MAX, 0, 0, 0usize);
        for y in 0..h { for x in 0..s.w { if s.px(x, y)[3] > 127 { x0 = x0.min(x); y0 = y0.min(y); x1 = x1.max(x); y1 = y1.max(y); n += 1; } } }
        (x0, y0, x1, y1, n)
    }

    #[test]
    fn rotated_text_is_drawn_turned_and_about_as_big_as_upright_text() {
        let text = |m: [f32; 6]| shot(&[
            CanvasCmd::Transform { m },
            CanvasCmd::FillText { text: "HHHH".into(), x: 0.0, y: 0.0, font_size: 24.0, color: RED, bold: false },
        ], 120, 120);
        let flat = text([1.0, 0.0, 0.0, 1.0, 10.0, 10.0]);
        let (fx0, fy0, fx1, fy1, flat_n) = painted_box(&flat, 120);
        assert!(flat_n > 100, "upright text drew something");
        assert!((fx1 - fx0) > (fy1 - fy0) * 2, "upright text is wider than tall: {}x{}", fx1 - fx0, fy1 - fy0);
        // Turned a quarter turn (x axis down the page): the same text is now taller than wide, and has about the
        // same amount of ink.
        let turned = text([0.0, 1.0, -1.0, 0.0, 100.0, 10.0]);
        let (tx0, ty0, tx1, ty1, turned_n) = painted_box(&turned, 120);
        assert!((ty1 - ty0) > (tx1 - tx0) * 2, "turned text is taller than wide: {}x{}", tx1 - tx0, ty1 - ty0);
        let ratio = turned_n as f64 / flat_n as f64;
        assert!(ratio > 0.8 && ratio < 1.25, "about the same ink, got {ratio} ({flat_n} vs {turned_n})");
        // And a mirrored transform draws it too (it used to ignore the flip).
        let mirrored = text([-1.0, 0.0, 0.0, 1.0, 110.0, 10.0]);
        assert!(painted_box(&mirrored, 120).4 > 100);
    }

    #[test]
    fn a_region_render_matches_that_part_of_the_whole_render() {
        let cmds = [
            rect(0.0, 0.0, 40.0, 40.0, [10, 20, 30, 255]),
            CanvasCmd::FillCircle { cx: 22.0, cy: 18.0, r: 9.0, color: RED },
            CanvasCmd::StrokeLine { x0: 0.0, y0: 39.0, x1: 40.0, y1: 0.0, color: BLUE, line_width: 3.0 },
        ];
        let render = |w: u32, h: u32, base: Affine| {
            let mut ts = glyx_text::TextSystem::new();
            let mut labels = crate::label_cache::LabelCache::new(Some(64));
            Shot { rgba: crate::canvas_export::render_rgba(&cmds, &HashMap::new(), &mut ts, &mut labels, w, h, base, None), w }
        };
        let whole = render(40, 40, Affine::IDENTITY);
        let part = render(20, 16, Affine::translate((-12.0, -9.0)));
        for y in 0..16 { for x in 0..20 {
            // The same up to anti-aliasing noise on the diagonal's edge.
            let (a, b) = (part.px(x, y), whole.px(x + 12, y + 9));
            assert!((0..4).all(|k| (a[k] as i32 - b[k] as i32).abs() <= 24), "pixel ({x}, {y}): {a:?} vs {b:?}");
        } }
    }
}
