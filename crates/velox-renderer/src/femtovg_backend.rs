//! FemtoVG GPU-accelerated 2D backend.
//!
//! Uses femtovg 0.25 with its native wgpu 29 renderer.
//! Path rendering is GPU-tessellation + stencil on the GPU.
//! No compute shaders — faster cold-start than Vello.
//!
//! ## RAM profile
//! Estimated ~120–150 MB vs Vello's ~285 MB.
//! Still needs wgpu device+queue, but avoids Vello's compute buffer pools.
//!
//! ## Text
//! Glyph outlines rasterized via swash (same as TinySkia backend), then
//! uploaded as GPU images via femtovg.  A persistent glyph cache on
//! `FemtoVgInner` ensures each unique (font, size, color) glyph is rasterized
//! and uploaded only once; subsequent frames reuse the cached `ImageId`.
//!
//! ## Limitations (experiment branch)
//! - `supports_caching()` returns `false` — Vello scene caching disabled.
//! - Gradients support linear and radial (2-stop min; mid-stops approximated).
//! - `push_rounded_layer` approximates with a rectangular scissor.
//! - Opacity layers set canvas global alpha (may bleed across siblings).

use std::collections::HashMap;
use femtovg::{Canvas, Color as FvgColor, ImageFlags, Paint, Path, renderer::WGPURenderer};
use vello::{kurbo::Affine, peniko};
use velox_gpu::GpuContext;
use crate::RendererError;

// ── Color helper ──────────────────────────────────────────────────────────────

fn to_fvg(c: peniko::Color) -> FvgColor {
    let q = c.to_rgba8();
    FvgColor::rgba(q.r, q.g, q.b, q.a)
}

// ── Gradient helper ───────────────────────────────────────────────────────────

/// Convert a `DynamicColor` stop color to peniko::Color (AlphaColor<Srgb>).
fn stop_color(dc: peniko::color::DynamicColor) -> peniko::Color {
    dc.to_alpha_color::<peniko::color::Srgb>()
}

/// Convert a `peniko::Gradient` to a femtovg `Paint`.
/// Uses the first and last stop; mid-stops are approximated (femtovg 0.25
/// natively supports 2-stop linear/radial only).
fn gradient_paint(grad: &peniko::Gradient) -> Option<Paint> {
    use peniko::GradientKind;
    if grad.stops.is_empty() { return None; }
    let first = to_fvg(stop_color(grad.stops[0].color));
    let last  = to_fvg(stop_color(grad.stops[grad.stops.len() - 1].color));
    match &grad.kind {
        GradientKind::Linear(pos) =>
            Some(Paint::linear_gradient(
                pos.start.x as f32, pos.start.y as f32,
                pos.end.x   as f32, pos.end.y   as f32,
                first, last,
            )),
        GradientKind::Radial(pos) =>
            Some(Paint::radial_gradient(
                pos.start_center.x as f32, pos.start_center.y as f32,
                pos.start_radius,  pos.end_radius,
                first, last,
            )),
        _ => None,
    }
}

// ── Glyph cache ───────────────────────────────────────────────────────────────

/// Cache key for a rasterized glyph texture.
/// Color is included because we bake R/G/B into the GPU image alongside the
/// swash alpha coverage.
#[derive(Hash, Eq, PartialEq, Clone)]
struct GlyphKey {
    /// Stable pointer to the font blob bytes — unique per loaded font file.
    data_ptr:   usize,
    font_index: u32,
    glyph_id:   u16,
    /// `(font_size * 4.0) as u16` — quarter-pixel precision.
    size_class: u16,
    r: u8, g: u8, b: u8,
}

/// Cached GPU glyph.  All fields are `Copy` so we can copy the value out of
/// the HashMap before mutably borrowing `canvas` (avoids borrow conflicts).
#[derive(Clone, Copy)]
struct CachedGlyph {
    image_id: femtovg::ImageId,
    width:    u32,
    height:   u32,
    /// `placement.left` — offset from pen X to glyph left edge.
    bx_off:   f32,
    /// `-placement.top` — offset from baseline to glyph top edge.
    by_off:   f32,
}

// ── Internal state ────────────────────────────────────────────────────────────

struct FemtoVgInner {
    canvas:       Canvas<WGPURenderer>,
    /// Per-frame GPU images (app images, not glyphs) — deleted after flush.
    frame_images: Vec<femtovg::ImageId>,
    swash_ctx:    swash::scale::ScaleContext,
    /// Persistent glyph texture cache — NOT freed each frame.
    /// Freed only on `trim_resources` or window resize.
    glyph_cache:  HashMap<GlyphKey, CachedGlyph>,
}

impl FemtoVgInner {
    /// Delete all cached glyph GPU textures (call on resize or memory trim).
    fn clear_glyph_cache(&mut self) {
        for (_, g) in self.glyph_cache.drain() {
            self.canvas.delete_image(g.image_id);
        }
    }
}

// ── FemtoVgFrame ─────────────────────────────────────────────────────────────

/// One frame accumulated in a femtovg canvas.
pub struct FemtoVgFrame {
    inner: FemtoVgInner,
}

impl FemtoVgFrame {
    pub fn supports_caching(&self) -> bool { false }

    // ── Shapes ──────────────────────────────────────────────────────────────

    pub fn fill_rounded_rect(&mut self, x: f64, y: f64, w: f64, h: f64,
                              radius: f64, color: peniko::Color) {
        let mut path = Path::new();
        if radius > 0.0 {
            path.rounded_rect(x as f32, y as f32, w as f32, h as f32, radius as f32);
        } else {
            path.rect(x as f32, y as f32, w as f32, h as f32);
        }
        self.inner.canvas.fill_path(&mut path, &Paint::color(to_fvg(color)));
    }

    pub fn fill_rounded_rect_with_brush(&mut self, x: f64, y: f64, w: f64, h: f64,
                                         radius: f64, brush: &peniko::Brush) {
        let paint = match brush {
            peniko::Brush::Solid(c)    => Paint::color(to_fvg(*c)),
            peniko::Brush::Gradient(g) => match gradient_paint(g) {
                Some(p) => p,
                None    => return,
            },
            _ => return,
        };
        let mut path = Path::new();
        if radius > 0.0 {
            path.rounded_rect(x as f32, y as f32, w as f32, h as f32, radius as f32);
        } else {
            path.rect(x as f32, y as f32, w as f32, h as f32);
        }
        self.inner.canvas.fill_path(&mut path, &paint);
    }

    pub fn fill_rect(&mut self, x: f64, y: f64, w: f64, h: f64, color: peniko::Color) {
        let mut path = Path::new();
        path.rect(x as f32, y as f32, w as f32, h as f32);
        self.inner.canvas.fill_path(&mut path, &Paint::color(to_fvg(color)));
    }

    pub fn stroke_rounded_rect(&mut self, x: f64, y: f64, w: f64, h: f64,
                                radius: f64, sw: f64, color: peniko::Color) {
        let mut path = Path::new();
        if radius > 0.0 {
            path.rounded_rect(x as f32, y as f32, w as f32, h as f32, radius as f32);
        } else {
            path.rect(x as f32, y as f32, w as f32, h as f32);
        }
        let mut paint = Paint::color(to_fvg(color));
        paint.set_line_width(sw as f32);
        self.inner.canvas.stroke_path(&mut path, &paint);
    }

    pub fn fill_circle(&mut self, cx: f64, cy: f64, r: f64, color: peniko::Color) {
        let mut path = Path::new();
        path.circle(cx as f32, cy as f32, r as f32);
        self.inner.canvas.fill_path(&mut path, &Paint::color(to_fvg(color)));
    }

    pub fn stroke_circle(&mut self, cx: f64, cy: f64, r: f64, width: f64, color: peniko::Color) {
        let mut path = Path::new();
        path.circle(cx as f32, cy as f32, r as f32);
        let mut paint = Paint::color(to_fvg(color));
        paint.set_line_width(width as f32);
        self.inner.canvas.stroke_path(&mut path, &paint);
    }

    pub fn stroke_line(&mut self, x0: f64, y0: f64, x1: f64, y1: f64,
                        width: f64, color: peniko::Color) {
        let mut path = Path::new();
        path.move_to(x0 as f32, y0 as f32);
        path.line_to(x1 as f32, y1 as f32);
        let mut paint = Paint::color(to_fvg(color));
        paint.set_line_width(width as f32);
        paint.set_line_cap(femtovg::LineCap::Round);
        self.inner.canvas.stroke_path(&mut path, &paint);
    }

    // ── Text ──────────────────────────────────────────────────────────────────

    /// Rasterize a Parley layout at `(x, y)`.
    ///
    /// Each unique (font, size, color, glyph) is rasterized via swash **once**
    /// and stored in `FemtoVgInner::glyph_cache` as a persistent GPU `ImageId`.
    /// Subsequent frames hit the cache and skip both rasterization and upload.
    ///
    /// ### Borrow note
    /// `scaler` borrows `self.inner.swash_ctx`.  `canvas` and `glyph_cache`
    /// are accessed via **different fields** of `FemtoVgInner` — Rust's
    /// NLL / split-field borrow rules allow these to coexist.
    pub fn draw_text(&mut self, layout: &velox_text::TextLayout,
                     x: f64, y: f64, color: peniko::Color) {
        use swash::{FontRef, scale::{Render, Source}, zeno::Format};

        let q = color.to_rgba8();
        let (cr, cg, cb) = (q.r, q.g, q.b);

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

                // `scaler` borrows self.inner.swash_ctx only.
                // canvas and glyph_cache are distinct fields — no conflict.
                let mut scaler = self.inner.swash_ctx
                    .builder(font_ref)
                    .size(size)
                    .hint(true)
                    .build();

                let mut pen_x = run_off;

                for g in gr.glyphs() {
                    let glyph_id = g.id as u16;
                    let bx = (x + pen_x + g.x as f64) as f32;
                    let by = (y + baseline + g.y as f64) as f32;
                    pen_x += g.advance as f64;

                    let key = GlyphKey {
                        data_ptr, font_index, glyph_id, size_class,
                        r: cr, g: cg, b: cb,
                    };

                    // Copy cached value so the immutable glyph_cache borrow
                    // ends before the mutable canvas borrow begins.
                    if let Some(&cached) = self.inner.glyph_cache.get(&key) {
                        let dx = bx + cached.bx_off;
                        let dy = by + cached.by_off;
                        let paint = Paint::image(
                            cached.image_id,
                            dx, dy, cached.width as f32, cached.height as f32,
                            0.0, 1.0,
                        );
                        let mut path = Path::new();
                        path.rect(dx, dy, cached.width as f32, cached.height as f32);
                        self.inner.canvas.fill_path(&mut path, &paint);
                        continue;
                    }

                    // Cache miss — rasterize.
                    let Some(image) = Render::new(&[Source::Outline])
                        .format(Format::Alpha)
                        .render(&mut scaler, glyph_id)
                    else { continue };

                    let pw = image.placement.width;
                    let ph = image.placement.height;
                    if pw == 0 || ph == 0 { continue; }

                    let bx_off =  image.placement.left as f32;
                    let by_off = -image.placement.top  as f32;

                    // Non-premultiplied RGBA: femtovg blends with src-alpha.
                    let mut rgba: Vec<u8> = Vec::with_capacity((pw * ph * 4) as usize);
                    for &alpha in &image.data {
                        rgba.push(cr); rgba.push(cg); rgba.push(cb); rgba.push(alpha);
                    }

                    // Access canvas directly (field borrow — not a self method)
                    // so the scaler's borrow of swash_ctx stays valid.
                    if let Some(img) = image::RgbaImage::from_raw(pw, ph, rgba) {
                        let dyn_img = image::DynamicImage::ImageRgba8(img);
                        if let Ok(src) = femtovg::ImageSource::try_from(&dyn_img) {
                            if let Ok(img_id) = self.inner.canvas
                                .create_image(src, ImageFlags::empty())
                            {
                                let dx = bx + bx_off;
                                let dy = by + by_off;
                                let paint = Paint::image(
                                    img_id,
                                    dx, dy, pw as f32, ph as f32,
                                    0.0, 1.0,
                                );
                                let mut path = Path::new();
                                path.rect(dx, dy, pw as f32, ph as f32);
                                self.inner.canvas.fill_path(&mut path, &paint);

                                self.inner.glyph_cache.insert(key, CachedGlyph {
                                    image_id: img_id,
                                    width: pw, height: ph,
                                    bx_off, by_off,
                                });
                            }
                        }
                    }
                }
                // `scaler` dropped here — releases &mut self.inner.swash_ctx.
            }
        }
    }

    // ── Images ────────────────────────────────────────────────────────────────

    pub fn draw_image(&mut self, image: &peniko::ImageData, x: f64, y: f64,
                      w: f64, h: f64) {
        let (iw, ih) = (image.width, image.height);
        if iw == 0 || ih == 0 { return; }
        let bytes = image.data.data();
        if image.format == peniko::ImageFormat::Bgra8 {
            let mut rgba = bytes.to_vec();
            for px in rgba.chunks_exact_mut(4) { px.swap(0, 2); }
            self.blit_image(&rgba, iw, ih, x, y, w, h);
        } else {
            self.blit_image(bytes, iw, ih, x, y, w, h);
        }
    }

    pub fn draw_image_with_transform(&mut self, image: &peniko::ImageData, transform: Affine) {
        let [a, b, c, d, e, f] = transform.as_coeffs();
        let iw = image.width  as f64;
        let ih = image.height as f64;
        let w  = (a * iw + c * ih).abs();
        let h  = (b * iw + d * ih).abs();
        self.draw_image(image, e, f, w, h);
    }

    fn blit_image(&mut self, rgba: &[u8], iw: u32, ih: u32,
                  x: f64, y: f64, w: f64, h: f64) {
        if let Some(img_id) = self.upload_frame_image(rgba, iw, ih) {
            let paint = Paint::image(img_id, x as f32, y as f32, w as f32, h as f32, 0.0, 1.0);
            let mut path = Path::new();
            path.rect(x as f32, y as f32, w as f32, h as f32);
            self.inner.canvas.fill_path(&mut path, &paint);
        }
    }

    /// Upload raw RGBA bytes as a **per-frame** GPU image (freed after `render_frame`).
    fn upload_frame_image(&mut self, rgba: &[u8], w: u32, h: u32)
        -> Option<femtovg::ImageId>
    {
        let img = image::RgbaImage::from_raw(w, h, rgba.to_vec())?;
        let dyn_img = image::DynamicImage::ImageRgba8(img);
        let src = femtovg::ImageSource::try_from(&dyn_img).ok()?;
        let img_id = self.inner.canvas.create_image(src, ImageFlags::empty()).ok()?;
        self.inner.frame_images.push(img_id);
        Some(img_id)
    }

    // ── Layers / clipping ─────────────────────────────────────────────────────

    pub fn push_layer(&mut self, x: f64, y: f64, w: f64, h: f64) {
        self.inner.canvas.save();
        self.inner.canvas.scissor(x as f32, y as f32, w as f32, h as f32);
    }

    pub fn push_rounded_layer(&mut self, x: f64, y: f64, w: f64, h: f64, _radius: f64) {
        // Approximate with rectangular scissor — path-clip needs stencil pass.
        self.push_layer(x, y, w, h);
    }

    pub fn push_layer_with_alpha(&mut self, x: f64, y: f64, w: f64, h: f64, alpha: f32) {
        self.inner.canvas.save();
        self.inner.canvas.scissor(x as f32, y as f32, w as f32, h as f32);
        self.inner.canvas.set_global_alpha(alpha);
    }

    pub fn pop_layer(&mut self) {
        self.inner.canvas.restore();
    }
}

// ── FemtoVgRenderer ───────────────────────────────────────────────────────────

/// Manages the femtovg canvas and per-frame GPU resource lifecycle.
pub struct FemtoVgRenderer {
    width:  u32,
    height: u32,
    pub background_color: peniko::Color,
    /// Moved into `FemtoVgFrame` during a frame, returned on render_frame.
    inner:  Option<FemtoVgInner>,
}

impl FemtoVgRenderer {
    pub fn new(gpu: &GpuContext) -> Result<Self, RendererError> {
        log::info!("velox-renderer: femtovg GPU backend active.");

        // wgpu 29: Device and Queue implement Clone (cheap Arc increment).
        // femtovg::WGPURenderer takes ownership of device + queue.
        let renderer = WGPURenderer::new(gpu.device.clone(), gpu.queue.clone());
        let canvas   = Canvas::new(renderer)
            .map_err(|e| RendererError::Init(format!("femtovg canvas: {e}")))?;

        Ok(Self {
            width:            gpu.width().max(1),
            height:           gpu.height().max(1),
            background_color: crate::colors::BACKGROUND,
            inner:            Some(FemtoVgInner {
                canvas,
                frame_images: Vec::new(),
                swash_ctx:    swash::scale::ScaleContext::new(),
                glyph_cache:  HashMap::new(),
            }),
        })
    }

    /// Begin a new frame: clear canvas to background color.
    pub fn begin_frame(&mut self) -> FemtoVgFrame {
        let mut inner = self.inner.take().expect("femtovg: frame already in progress");
        let q = self.background_color.to_rgba8();
        inner.canvas.set_size(self.width, self.height, 1.0);
        inner.canvas.clear_rect(
            0, 0, self.width, self.height,
            FvgColor::rgba(q.r, q.g, q.b, q.a),
        );
        FemtoVgFrame { inner }
    }

    /// Flush draw calls to the swapchain texture and clean up per-frame images.
    pub fn render_frame(
        &mut self,
        gpu:     &GpuContext,
        texture: &wgpu::SurfaceTexture,
        mut frame: FemtoVgFrame,
    ) -> Result<(), RendererError> {
        let w = gpu.width().max(1);
        let h = gpu.height().max(1);
        if self.width != w || self.height != h {
            self.width  = w;
            self.height = h;
            // Clear glyph cache on resize — sub-pixel hinting may differ at
            // new DPI / logical-pixel scale.
            frame.inner.clear_glyph_cache();
        }

        // Render femtovg draw list to the swapchain texture.
        // flush_to_output creates its own CommandEncoder internally and
        // returns Option<CommandBuffer>; submit() accepts Option<_> as IntoIterator.
        let cmd = frame.inner.canvas.flush_to_output(&texture.texture);
        gpu.queue.submit(cmd);

        // Free per-frame (non-cached) GPU images.
        for id in frame.inner.frame_images.drain(..) {
            frame.inner.canvas.delete_image(id);
        }

        // Return canvas + persistent caches to the renderer.
        self.inner = Some(frame.inner);
        Ok(())
    }

    /// No cached-frame support — femtovg has no retained render target.
    pub fn blit_cached_frame(
        &self,
        _gpu:     &GpuContext,
        _texture: &wgpu::SurfaceTexture,
    ) -> Result<(), RendererError> {
        Err(RendererError::Render("femtovg: no cached frame".into()))
    }

    /// Sync stored dimensions to the current GPU surface size.
    ///
    /// Must be called before `begin_frame()` whenever the window has been resized.
    /// `begin_frame` calls `canvas.set_size(self.width, self.height)` — if those
    /// are stale, the canvas clips to old bounds and glyphs outside render as red.
    pub fn notify_resize(&mut self, w: u32, h: u32) {
        self.width  = w;
        self.height = h;
    }

    /// Free all cached glyph GPU textures to release VRAM under memory pressure.
    pub fn trim_resources(&mut self) {
        if let Some(inner) = self.inner.as_mut() {
            inner.clear_glyph_cache();
        }
    }

    pub fn try_save_pipeline_cache(&self) {}
}
