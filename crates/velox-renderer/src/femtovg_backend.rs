//! FemtoVG GPU-accelerated 2D backend.
//!
//! ## Draw-call strategy
//! Each Parley `GlyphRun` (a contiguous same-font/same-color span) is
//! rasterized into a single atlas region and drawn as **one** `fill_path`
//! call.  A notes-list frame with 1 000 glyphs across ~20 runs produces
//! ~20 GPU draw calls instead of ~1 000, eliminating the per-draw-call
//! command-buffer overhead that previously spiked to 720 MB on ANGLE.
//!
//! ## Atlas
//! One 2048×2048 RGBA8 texture (16 MB GPU, 16 MB CPU).  Glyphs are written
//! to a CPU pixel buffer and uploaded once per frame via a single
//! `update_image()` call (dirty rows only).
//!
//! ## Dirty frames
//! Renders into an intermediate cache texture; `blit_cached_frame()` re-blits
//! it so velox-core's dirty-frame skip works the same as Vello.

use std::collections::HashMap;
use femtovg::{Canvas, Color as FvgColor, ImageFlags, Paint, Path, PixelFormat,
              renderer::WGPURenderer};
use vello::{kurbo::Affine, peniko};
use velox_gpu::GpuContext;
use crate::RendererError;

const ATLAS_W:   u32 = 2048;
const ATLAS_H:   u32 = 2048;
const ATLAS_PAD: u32 = 1;

// ── Color helpers ─────────────────────────────────────────────────────────────

fn to_fvg(c: peniko::Color) -> FvgColor {
    let q = c.to_rgba8();
    FvgColor::rgba(q.r, q.g, q.b, q.a)
}

fn stop_color(dc: peniko::color::DynamicColor) -> peniko::Color {
    dc.to_alpha_color::<peniko::color::Srgb>()
}

fn gradient_paint(grad: &peniko::Gradient) -> Option<Paint> {
    use peniko::GradientKind;
    if grad.stops.is_empty() { return None; }
    let first = to_fvg(stop_color(grad.stops[0].color));
    let last  = to_fvg(stop_color(grad.stops[grad.stops.len() - 1].color));
    match &grad.kind {
        GradientKind::Linear(pos) => Some(Paint::linear_gradient(
            pos.start.x as f32, pos.start.y as f32,
            pos.end.x   as f32, pos.end.y   as f32,
            first, last,
        )),
        GradientKind::Radial(pos) => Some(Paint::radial_gradient(
            pos.start_center.x as f32, pos.start_center.y as f32,
            pos.start_radius,  pos.end_radius,
            first, last,
        )),
        _ => None,
    }
}

// ── Per-run glyph atlas ───────────────────────────────────────────────────────
//
// Instead of caching individual glyphs, we cache entire Parley GlyphRuns.
// One atlas entry covers all glyphs in a run, so each run = 1 fill_path call.

/// Cache key for a rasterized text run.
/// Color is baked into the RGBA pixels (composite tinting doesn't isolate
/// in femtovg's wgpu/ANGLE backend).
#[derive(Hash, Eq, PartialEq, Clone)]
struct RunKey {
    data_ptr:    usize,   // stable ptr to font blob bytes
    font_index:  u32,
    size_class:  u16,     // (font_size * 4) as u16
    r: u8, g: u8, b: u8,
    glyph_hash:  u64,     // FNV-1a over (glyph_id, advance) pairs
}

/// Atlas region for one rasterized text run.
#[derive(Clone, Copy)]
struct RunEntry {
    u: u32,     // atlas X origin
    v: u32,     // atlas Y origin
    w: u32,     // image width
    h: u32,     // image height
    /// Offset from run pen-start to the image left edge (pixels).
    x_off: f32,
    /// Offset from baseline to the image top edge (pixels, usually negative).
    y_off: f32,
}

/// Shelf-row atlas backed by a CPU pixel buffer + one GPU texture.
struct GlyphAtlas {
    image_id:    femtovg::ImageId,
    entries:     HashMap<RunKey, RunEntry>,
    pack_x:      u32,
    pack_y:      u32,
    row_h:       u32,
    /// Defer atlas clear to `begin_frame` so in-flight draw calls stay valid.
    needs_clear: bool,
    /// CPU pixel buffer — 2048×2048×4 = 16 MB.
    pixels:      Vec<u8>,
    dirty:       bool,
    dirty_min_y: u32,
    dirty_max_y: u32,
}

impl GlyphAtlas {
    fn new(image_id: femtovg::ImageId) -> Self {
        Self {
            image_id,
            entries:     HashMap::new(),
            pack_x: 0, pack_y: 0, row_h: 0,
            needs_clear: false,
            pixels:      vec![0u8; (ATLAS_W * ATLAS_H * 4) as usize],
            dirty: false, dirty_min_y: 0, dirty_max_y: 0,
        }
    }

    fn alloc(&mut self, gw: u32, gh: u32) -> Option<(u32, u32)> {
        if gw > ATLAS_W || gh > ATLAS_H { return None; }
        if self.pack_x + gw > ATLAS_W {
            self.pack_y += self.row_h + ATLAS_PAD;
            self.pack_x  = 0;
            self.row_h   = 0;
        }
        if self.pack_y + gh > ATLAS_H { return None; }
        let (u, v) = (self.pack_x, self.pack_y);
        self.pack_x += gw + ATLAS_PAD;
        self.row_h   = self.row_h.max(gh);
        Some((u, v))
    }

    /// Write `rgba` pixels at atlas position `(u, v)` and mark rows dirty.
    fn write_region(&mut self, rgba: &[u8], u: u32, v: u32, pw: u32, ph: u32) {
        let stride = (ATLAS_W * 4) as usize;
        let row_bytes = (pw * 4) as usize;
        for row in 0..ph as usize {
            let src = &rgba[row * row_bytes..(row + 1) * row_bytes];
            let dst = (v as usize + row) * stride + u as usize * 4;
            self.pixels[dst..dst + row_bytes].copy_from_slice(src);
        }
        if !self.dirty {
            self.dirty       = true;
            self.dirty_min_y = v;
            self.dirty_max_y = v + ph - 1;
        } else {
            self.dirty_min_y = self.dirty_min_y.min(v);
            self.dirty_max_y = self.dirty_max_y.max(v + ph - 1);
        }
    }

    /// Upload only the dirty rows — called once per frame before flush_to_output.
    fn upload_dirty(&mut self, canvas: &mut Canvas<WGPURenderer>) {
        if !self.dirty { return; }
        self.dirty = false;
        let min_y  = self.dirty_min_y as usize;
        let max_y  = (self.dirty_max_y + 1).min(ATLAS_H) as usize;
        let stride = (ATLAS_W * 4) as usize;
        let slice  = self.pixels[min_y * stride..max_y * stride].to_vec();
        if let Some(img) = image::RgbaImage::from_raw(ATLAS_W, (max_y - min_y) as u32, slice) {
            let dyn_img = image::DynamicImage::ImageRgba8(img);
            if let Ok(src) = femtovg::ImageSource::try_from(&dyn_img) {
                let _ = canvas.update_image(self.image_id, src, 0, min_y);
            }
        }
    }

    fn clear_entries(&mut self) {
        self.entries.clear();
        self.pack_x = 0;
        self.pack_y = 0;
        self.row_h  = 0;
    }

    /// Call at the top of `begin_frame` to apply any deferred clear.
    fn begin_frame(&mut self) {
        if self.needs_clear {
            self.needs_clear = false;
            self.clear_entries();
        }
    }
}

// ── FemtoVgInner ─────────────────────────────────────────────────────────────

struct FemtoVgInner {
    canvas:       Canvas<WGPURenderer>,
    frame_images: Vec<femtovg::ImageId>,
    swash_ctx:    swash::scale::ScaleContext,
    atlas:        GlyphAtlas,
}

impl FemtoVgInner {
    fn clear_glyph_cache(&mut self) { self.atlas.clear_entries(); }
}

// ── FemtoVgFrame ─────────────────────────────────────────────────────────────

pub struct FemtoVgFrame {
    inner: FemtoVgInner,
}

impl FemtoVgFrame {
    pub fn supports_caching(&self) -> bool { false }

    // ── Shapes ──────────────────────────────────────────────────────────────

    pub fn fill_rounded_rect(&mut self, x: f64, y: f64, w: f64, h: f64,
                              radius: f64, color: peniko::Color) {
        let mut p = Path::new();
        if radius > 0.0 { p.rounded_rect(x as f32, y as f32, w as f32, h as f32, radius as f32); }
        else            { p.rect(x as f32, y as f32, w as f32, h as f32); }
        self.inner.canvas.fill_path(&mut p, &Paint::color(to_fvg(color)));
    }

    pub fn fill_rounded_rect_with_brush(&mut self, x: f64, y: f64, w: f64, h: f64,
                                         radius: f64, brush: &peniko::Brush) {
        let paint = match brush {
            peniko::Brush::Solid(c)    => Paint::color(to_fvg(*c)),
            peniko::Brush::Gradient(g) => match gradient_paint(g) { Some(p) => p, None => return },
            _ => return,
        };
        let mut p = Path::new();
        if radius > 0.0 { p.rounded_rect(x as f32, y as f32, w as f32, h as f32, radius as f32); }
        else            { p.rect(x as f32, y as f32, w as f32, h as f32); }
        self.inner.canvas.fill_path(&mut p, &paint);
    }

    pub fn fill_rect(&mut self, x: f64, y: f64, w: f64, h: f64, color: peniko::Color) {
        let mut p = Path::new();
        p.rect(x as f32, y as f32, w as f32, h as f32);
        self.inner.canvas.fill_path(&mut p, &Paint::color(to_fvg(color)));
    }

    pub fn stroke_rounded_rect(&mut self, x: f64, y: f64, w: f64, h: f64,
                                radius: f64, sw: f64, color: peniko::Color) {
        let mut p = Path::new();
        if radius > 0.0 { p.rounded_rect(x as f32, y as f32, w as f32, h as f32, radius as f32); }
        else            { p.rect(x as f32, y as f32, w as f32, h as f32); }
        let mut paint = Paint::color(to_fvg(color));
        paint.set_line_width(sw as f32);
        self.inner.canvas.stroke_path(&mut p, &paint);
    }

    pub fn fill_circle(&mut self, cx: f64, cy: f64, r: f64, color: peniko::Color) {
        let mut p = Path::new();
        p.circle(cx as f32, cy as f32, r as f32);
        self.inner.canvas.fill_path(&mut p, &Paint::color(to_fvg(color)));
    }

    pub fn stroke_circle(&mut self, cx: f64, cy: f64, r: f64, width: f64, color: peniko::Color) {
        let mut p = Path::new();
        p.circle(cx as f32, cy as f32, r as f32);
        let mut paint = Paint::color(to_fvg(color));
        paint.set_line_width(width as f32);
        self.inner.canvas.stroke_path(&mut p, &paint);
    }

    pub fn stroke_line(&mut self, x0: f64, y0: f64, x1: f64, y1: f64,
                        width: f64, color: peniko::Color) {
        let mut p = Path::new();
        p.move_to(x0 as f32, y0 as f32);
        p.line_to(x1 as f32, y1 as f32);
        let mut paint = Paint::color(to_fvg(color));
        paint.set_line_width(width as f32);
        paint.set_line_cap(femtovg::LineCap::Round);
        self.inner.canvas.stroke_path(&mut p, &paint);
    }

    // ── Text ──────────────────────────────────────────────────────────────────

    /// Render `layout` at `(x, y)` using per-run atlas caching.
    ///
    /// Each Parley `GlyphRun` is rasterized into a single atlas region (all
    /// glyphs composited into one RGBA image).  A cache hit = **one**
    /// `fill_path` call per run regardless of glyph count.  A miss rasterizes
    /// all glyphs via swash, builds the combined image, writes it into the CPU
    /// pixel buffer, and then also emits one `fill_path`.
    ///
    /// The CPU buffer is uploaded to the GPU once per frame in `render_frame`
    /// (dirty rows only), not once per glyph.
    pub fn draw_text(&mut self, layout: &velox_text::TextLayout,
                     x: f64, y: f64, color: peniko::Color) {
        use swash::{FontRef, scale::{Render, Source}, zeno::Format};

        let q = color.to_rgba8();
        let (cr, cg, cb) = (q.r, q.g, q.b);

        for line in layout.inner.lines() {
            for item in line.items() {
                let parley::layout::PositionedLayoutItem::GlyphRun(gr) = item
                    else { continue };

                let run      = gr.run();
                let font     = run.font();
                let size     = run.font_size();
                let baseline = gr.baseline() as f32;
                let run_off  = gr.offset()   as f32;

                let font_data  = font.data.data();
                let font_index = font.index;
                let data_ptr   = font_data.as_ptr() as usize;
                let size_class = (size * 4.0) as u16;

                // Collect glyphs up-front so we can hash them and check the cache
                // before spending any time on font/scaler setup.
                let glyphs_vec: Vec<_> = gr.glyphs().collect();
                if glyphs_vec.is_empty() { continue; }

                // ── Build run cache key ──────────────────────────────────────
                let glyph_hash = {
                    let mut h: u64 = 0xcbf29ce484222325;
                    for g in &glyphs_vec {
                        h ^= g.id as u64;
                        h  = h.wrapping_mul(0x100000001b3);
                        h ^= (g.advance * 4.0) as u64;
                        h  = h.wrapping_mul(0x100000001b3);
                    }
                    h
                };
                let run_key = RunKey {
                    data_ptr, font_index, size_class,
                    r: cr, g: cg, b: cb,
                    glyph_hash,
                };

                // ── Screen origin of this run ────────────────────────────────
                let origin_x = x as f32 + run_off;
                let origin_y = y as f32 + baseline;

                // ── Cache hit — one draw call ────────────────────────────────
                if let Some(re) = self.inner.atlas.entries.get(&run_key).copied() {
                    let rx = origin_x + re.x_off;
                    let ry = origin_y + re.y_off;
                    let paint = Paint::image(
                        self.inner.atlas.image_id,
                        rx - re.u as f32, ry - re.v as f32,
                        ATLAS_W as f32, ATLAS_H as f32,
                        0.0, 1.0,
                    );
                    let mut path = Path::new();
                    path.rect(rx, ry, re.w as f32, re.h as f32);
                    self.inner.canvas.fill_path(&mut path, &paint);
                    continue;
                }

                // ── Cache miss — rasterize the whole run ─────────────────────
                // Scoped so the borrow of swash_ctx ends before we touch atlas/canvas.
                struct GlyphImg {
                    pen_x: f32, gx: f32, gy: f32,
                    pw: u32, ph: u32,
                    bx: f32, by: f32,   // placement offsets
                    data: Vec<u8>,       // alpha channel
                }

                let imgs: Vec<GlyphImg> = {
                    let Some(font_ref) = FontRef::from_index(font_data, font_index as usize)
                        else { continue };
                    let mut scaler = self.inner.swash_ctx
                        .builder(font_ref).size(size).hint(true).build();
                    let mut pen_x = 0.0f32;
                    let mut out   = Vec::with_capacity(glyphs_vec.len());
                    for g in &glyphs_vec {
                        let gid = g.id as u16;
                        if let Some(img) = Render::new(&[Source::Outline])
                            .format(Format::Alpha)
                            .render(&mut scaler, gid)
                        {
                            let pw = img.placement.width;
                            let ph = img.placement.height;
                            if pw > 0 && ph > 0 {
                                out.push(GlyphImg {
                                    pen_x,
                                    gx: g.x,
                                    gy: g.y,
                                    pw, ph,
                                    bx:  img.placement.left as f32,
                                    by: -(img.placement.top as f32),
                                    data: img.data,
                                });
                            }
                        }
                        pen_x += g.advance;
                    }
                    out
                    // scaler dropped here — swash_ctx borrow released
                };

                if imgs.is_empty() { continue; }

                // Compute tight bounding box relative to (origin_x, origin_y)
                let left   = imgs.iter().map(|i| i.pen_x + i.gx + i.bx)
                                  .fold(f32::MAX, f32::min);
                let top    = imgs.iter().map(|i| i.gy + i.by)
                                  .fold(f32::MAX, f32::min);
                let right  = imgs.iter().map(|i| i.pen_x + i.gx + i.bx + i.pw as f32)
                                  .fold(f32::MIN, f32::max);
                let bottom = imgs.iter().map(|i| i.gy + i.by + i.ph as f32)
                                  .fold(f32::MIN, f32::max);

                let run_w = (right  - left).ceil() as u32;
                let run_h = (bottom - top ).ceil() as u32;
                if run_w == 0 || run_h == 0 { continue; }

                // Build combined RGBA image (color baked in)
                let mut rgba = vec![0u8; (run_w * run_h * 4) as usize];
                for gi in &imgs {
                    let dx = (gi.pen_x + gi.gx + gi.bx - left).round() as i32;
                    let dy = (gi.gy   + gi.by       - top ).round() as i32;
                    for row in 0..gi.ph as i32 {
                        for col in 0..gi.pw as i32 {
                            let dst_x = dx + col;
                            let dst_y = dy + row;
                            if dst_x < 0 || dst_y < 0
                                || dst_x >= run_w as i32 || dst_y >= run_h as i32
                            { continue; }
                            let alpha = gi.data[(row * gi.pw as i32 + col) as usize];
                            if alpha == 0 { continue; }
                            let di = (dst_y as u32 * run_w + dst_x as u32) as usize * 4;
                            rgba[di]     = cr;
                            rgba[di + 1] = cg;
                            rgba[di + 2] = cb;
                            rgba[di + 3] = alpha;
                        }
                    }
                }

                // Allocate atlas space — defer clear to next frame if full
                let Some((u, v)) = self.inner.atlas.alloc(run_w, run_h) else {
                    self.inner.atlas.needs_clear = true;
                    continue;
                };

                self.inner.atlas.write_region(&rgba, u, v, run_w, run_h);
                self.inner.atlas.entries.insert(run_key, RunEntry {
                    u, v, w: run_w, h: run_h,
                    x_off: left, y_off: top,
                });

                // One draw call for the entire run
                let rx = origin_x + left;
                let ry = origin_y + top;
                let paint = Paint::image(
                    self.inner.atlas.image_id,
                    rx - u as f32, ry - v as f32,
                    ATLAS_W as f32, ATLAS_H as f32,
                    0.0, 1.0,
                );
                let mut path = Path::new();
                path.rect(rx, ry, run_w as f32, run_h as f32);
                self.inner.canvas.fill_path(&mut path, &paint);
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
        self.draw_image(image, e, f, (a * iw + c * ih).abs(), (b * iw + d * ih).abs());
    }

    fn blit_image(&mut self, rgba: &[u8], iw: u32, ih: u32,
                  x: f64, y: f64, w: f64, h: f64) {
        if let Some(id) = self.upload_frame_image(rgba, iw, ih) {
            let paint = Paint::image(id, x as f32, y as f32, w as f32, h as f32, 0.0, 1.0);
            let mut p = Path::new();
            p.rect(x as f32, y as f32, w as f32, h as f32);
            self.inner.canvas.fill_path(&mut p, &paint);
        }
    }

    fn upload_frame_image(&mut self, rgba: &[u8], w: u32, h: u32) -> Option<femtovg::ImageId> {
        let img    = image::RgbaImage::from_raw(w, h, rgba.to_vec())?;
        let dyn_img = image::DynamicImage::ImageRgba8(img);
        let src    = femtovg::ImageSource::try_from(&dyn_img).ok()?;
        let id     = self.inner.canvas.create_image(src, ImageFlags::empty()).ok()?;
        self.inner.frame_images.push(id);
        Some(id)
    }

    // ── Layers ────────────────────────────────────────────────────────────────

    pub fn push_layer(&mut self, x: f64, y: f64, w: f64, h: f64) {
        self.inner.canvas.save();
        self.inner.canvas.scissor(x as f32, y as f32, w as f32, h as f32);
    }
    pub fn push_rounded_layer(&mut self, x: f64, y: f64, w: f64, h: f64, _r: f64) {
        self.push_layer(x, y, w, h);
    }
    pub fn push_layer_with_alpha(&mut self, x: f64, y: f64, w: f64, h: f64, alpha: f32) {
        self.inner.canvas.save();
        self.inner.canvas.scissor(x as f32, y as f32, w as f32, h as f32);
        self.inner.canvas.set_global_alpha(alpha);
    }
    pub fn pop_layer(&mut self) { self.inner.canvas.restore(); }
}

// ── FemtoVgRenderer ───────────────────────────────────────────────────────────

pub struct FemtoVgRenderer {
    width:       u32,
    height:      u32,
    surface_fmt: wgpu::TextureFormat,
    pub background_color: peniko::Color,
    inner:       Option<FemtoVgInner>,
    cache_tex:   wgpu::Texture,
    cache_view:  wgpu::TextureView,
    blit:        wgpu::util::TextureBlitter,
}

impl FemtoVgRenderer {
    pub fn new(gpu: &GpuContext) -> Result<Self, RendererError> {
        log::info!("velox-renderer: femtovg GPU backend active.");

        let renderer   = WGPURenderer::new(gpu.device.clone(), gpu.queue.clone());
        let mut canvas = Canvas::new(renderer)
            .map_err(|e| RendererError::Init(format!("femtovg canvas: {e}")))?;

        let atlas_id = canvas
            .create_image_empty(ATLAS_W as usize, ATLAS_H as usize,
                                PixelFormat::Rgba8, ImageFlags::NEAREST)
            .map_err(|e| RendererError::Init(format!("femtovg atlas: {e:?}")))?;

        let surface_fmt = gpu.surface_format();
        let blit        = wgpu::util::TextureBlitter::new(&gpu.device, surface_fmt);
        let (cache_tex, cache_view) =
            Self::make_cache(&gpu.device, gpu.width().max(1), gpu.height().max(1), surface_fmt);

        Ok(Self {
            width:  gpu.width().max(1),
            height: gpu.height().max(1),
            surface_fmt,
            background_color: crate::colors::BACKGROUND,
            inner: Some(FemtoVgInner {
                canvas,
                frame_images: Vec::new(),
                swash_ctx:    swash::scale::ScaleContext::new(),
                atlas:        GlyphAtlas::new(atlas_id),
            }),
            cache_tex, cache_view, blit,
        })
    }

    fn make_cache(device: &wgpu::Device, w: u32, h: u32, fmt: wgpu::TextureFormat)
        -> (wgpu::Texture, wgpu::TextureView)
    {
        let tex = device.create_texture(&wgpu::TextureDescriptor {
            label:           Some("femtovg-cache"),
            size:            wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
            mip_level_count: 1, sample_count: 1,
            dimension:       wgpu::TextureDimension::D2,
            format:          fmt,
            usage:           wgpu::TextureUsages::RENDER_ATTACHMENT
                           | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats:    &[],
        });
        let view = tex.create_view(&Default::default());
        (tex, view)
    }

    pub fn begin_frame(&mut self) -> FemtoVgFrame {
        let mut inner = self.inner.take().expect("femtovg: begin_frame called twice");
        inner.atlas.begin_frame();
        let q = self.background_color.to_rgba8();
        inner.canvas.set_size(self.width, self.height, 1.0);
        inner.canvas.clear_rect(0, 0, self.width, self.height,
                                FvgColor::rgba(q.r, q.g, q.b, q.a));
        FemtoVgFrame { inner }
    }

    pub fn render_frame(
        &mut self,
        gpu:     &GpuContext,
        texture: &wgpu::SurfaceTexture,
        mut frame: FemtoVgFrame,
    ) -> Result<(), RendererError> {
        let (w, h) = (gpu.width().max(1), gpu.height().max(1));
        if self.width != w || self.height != h {
            self.width  = w; self.height = h;
            let (t, v) = Self::make_cache(&gpu.device, w, h, self.surface_fmt);
            self.cache_tex = t; self.cache_view = v;
            frame.inner.clear_glyph_cache();
        }

        // Single batched atlas upload (dirty rows only)
        frame.inner.atlas.upload_dirty(&mut frame.inner.canvas);

        // Render into intermediate cache texture
        let cmd = frame.inner.canvas.flush_to_output(&self.cache_tex);
        gpu.queue.submit(cmd);

        // Free per-frame app images
        for id in frame.inner.frame_images.drain(..) {
            frame.inner.canvas.delete_image(id);
        }

        // Blit cache → swapchain
        let surface_view = texture.texture.create_view(&Default::default());
        let mut enc = gpu.device.create_command_encoder(
            &wgpu::CommandEncoderDescriptor { label: Some("femtovg-blit") });
        self.blit.copy(&gpu.device, &mut enc, &self.cache_view, &surface_view);
        gpu.queue.submit([enc.finish()]);

        self.inner = Some(frame.inner);
        Ok(())
    }

    /// Re-blit the last rendered frame — zero draw calls (dev-mode overlay skip).
    pub fn blit_cached_frame(&self, gpu: &GpuContext, texture: &wgpu::SurfaceTexture)
        -> Result<(), RendererError>
    {
        let surface_view = texture.texture.create_view(&Default::default());
        let mut enc = gpu.device.create_command_encoder(
            &wgpu::CommandEncoderDescriptor { label: Some("femtovg-blit-cached") });
        self.blit.copy(&gpu.device, &mut enc, &self.cache_view, &surface_view);
        gpu.queue.submit([enc.finish()]);
        Ok(())
    }

    pub fn notify_resize(&mut self, w: u32, h: u32) { self.width = w; self.height = h; }

    pub fn trim_resources(&mut self) {
        if let Some(inner) = self.inner.as_mut() { inner.clear_glyph_cache(); }
    }

    pub fn try_save_pipeline_cache(&self) {}
}
