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

use std::collections::HashMap;
use vello::{kurbo::Affine, peniko};
use velox_gpu::GpuContext;
use crate::RendererError;

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
fn rrect_path(x: f32, y: f32, w: f32, h: f32, radius: f32) -> Option<tiny_skia::Path> {
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
    glyph_cache: HashMap<GlyphKey, CachedAlphaGlyph>,
}

// ── TinySkiaFrame ─────────────────────────────────────────────────────────────

/// One frame accumulated in a CPU `Pixmap`.
pub struct TinySkiaFrame {
    pub(crate) pixmap: tiny_skia::Pixmap,
    /// Mask stack — saved/restored across push_layer / pop_layer.
    clip_stack:   Vec<Option<tiny_skia::Mask>>,
    /// Active clip mask (`None` = no clip).
    current_mask: Option<tiny_skia::Mask>,
    /// Persistent state moved from TinySkiaRenderer for the frame duration.
    shared:       TinySkiaShared,
}

impl TinySkiaFrame {
    fn new(width: u32, height: u32, bg: peniko::Color, shared: TinySkiaShared)
        -> Option<Self>
    {
        let mut pixmap = tiny_skia::Pixmap::new(width, height)?;
        let q = bg.to_rgba8();
        pixmap.fill(tiny_skia::Color::from_rgba8(q.r, q.g, q.b, q.a));
        Some(Self {
            pixmap,
            clip_stack:   Vec::new(),
            current_mask: None,
            shared,
        })
    }

    // ── Primitives ────────────────────────────────────────────────────────────

    pub fn fill_rounded_rect(&mut self, x: f64, y: f64, w: f64, h: f64,
                              radius: f64, color: peniko::Color) {
        let Some(path) = rrect_path(x as f32, y as f32, w as f32, h as f32, radius as f32)
            else { return };
        let paint = solid_paint(color);
        let mask  = self.current_mask.as_ref();
        self.pixmap.fill_path(&path, &paint, tiny_skia::FillRule::Winding,
                              tiny_skia::Transform::identity(), mask);
    }

    pub fn fill_rounded_rect_with_brush(&mut self, x: f64, y: f64, w: f64, h: f64,
                                         radius: f64, brush: &peniko::Brush) {
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
        let mask = self.current_mask.as_ref();
        self.pixmap.fill_path(&path, &paint, tiny_skia::FillRule::Winding,
                              tiny_skia::Transform::identity(), mask);
    }

    pub fn fill_rect(&mut self, x: f64, y: f64, w: f64, h: f64, color: peniko::Color) {
        let paint = solid_paint(color);
        let mask  = self.current_mask.as_ref();
        if let Some(rect) = tiny_skia::Rect::from_xywh(x as f32, y as f32, w as f32, h as f32) {
            self.pixmap.fill_rect(rect, &paint, tiny_skia::Transform::identity(), mask);
        }
    }

    pub fn stroke_rounded_rect(&mut self, x: f64, y: f64, w: f64, h: f64,
                                radius: f64, sw: f64, color: peniko::Color) {
        let Some(path) = rrect_path(x as f32, y as f32, w as f32, h as f32, radius as f32)
            else { return };
        let paint  = solid_paint(color);
        let stroke = tiny_skia::Stroke { width: sw as f32, ..Default::default() };
        let mask   = self.current_mask.as_ref();
        self.pixmap.stroke_path(&path, &paint, &stroke,
                                tiny_skia::Transform::identity(), mask);
    }

    pub fn fill_circle(&mut self, cx: f64, cy: f64, r: f64, color: peniko::Color) {
        let Some(path) = tiny_skia::PathBuilder::from_circle(cx as f32, cy as f32, r as f32)
            else { return };
        let paint = solid_paint(color);
        let mask  = self.current_mask.as_ref();
        self.pixmap.fill_path(&path, &paint, tiny_skia::FillRule::Winding,
                              tiny_skia::Transform::identity(), mask);
    }

    pub fn stroke_circle(&mut self, cx: f64, cy: f64, r: f64, width: f64, color: peniko::Color) {
        let Some(path) = tiny_skia::PathBuilder::from_circle(cx as f32, cy as f32, r as f32)
            else { return };
        let paint  = solid_paint(color);
        let stroke = tiny_skia::Stroke { width: width as f32, ..Default::default() };
        let mask   = self.current_mask.as_ref();
        self.pixmap.stroke_path(&path, &paint, &stroke,
                                tiny_skia::Transform::identity(), mask);
    }

    pub fn stroke_line(&mut self, x0: f64, y0: f64, x1: f64, y1: f64,
                        width: f64, color: peniko::Color) {
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
        let mask = self.current_mask.as_ref();
        self.pixmap.stroke_path(&path, &paint, &stroke,
                                tiny_skia::Transform::identity(), mask);
    }

    // ── Text ──────────────────────────────────────────────────────────────────

    /// Rasterize a Parley text layout at `(x, y)` using swash glyph outlines.
    ///
    /// Alpha masks are cached in `shared.glyph_cache` (color-independent).
    /// On a cache hit the mask is colorized in ~O(pixels) arithmetic and blitted
    /// directly — no swash rasterization at all.
    pub fn draw_text(&mut self, layout: &velox_text::TextLayout, x: f64, y: f64,
                     color: peniko::Color) {
        use swash::{FontRef, scale::{Render, Source}, zeno::Format};

        let q   = color.to_rgba8();
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
                    let mask = self.current_mask.as_ref();
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
                                tiny_skia::Transform::identity(),
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
                            tiny_skia::Transform::identity(),
                            mask,
                        );
                    }

                    // Store raw alpha in cache (color-independent).
                    self.shared.glyph_cache.insert(key, CachedAlphaGlyph {
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
        let (iw, ih) = (image.width, image.height);
        if iw == 0 || ih == 0 { return; }
        let bytes = image.data.data();
        if image.format == peniko::ImageFormat::Bgra8 {
            let mut rgba = bytes.to_vec();
            for px in rgba.chunks_exact_mut(4) { px.swap(0, 2); }
            self.blit_scaled(&rgba, iw, ih, x, y, w, h);
        } else {
            self.blit_scaled(bytes, iw, ih, x, y, w, h);
        }
    }

    pub fn draw_image_with_transform(&mut self, image: &peniko::ImageData, transform: Affine) {
        let (iw, ih) = (image.width, image.height);
        if iw == 0 || ih == 0 { return; }
        let bytes = image.data.data();

        // kurbo Affine [a,b,c,d,e,f]:  x'=ax+cy+e, y'=bx+dy+f
        // tiny-skia from_row(sx,ky,kx,sy,tx,ty): x'=sx*x+kx*y+tx, y'=ky*x+sy*y+ty
        let [a, b, c, d, e, f] = transform.as_coeffs();
        let ts = tiny_skia::Transform::from_row(
            a as f32, b as f32, c as f32, d as f32, e as f32, f as f32,
        );

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

        let mask = self.current_mask.as_ref();
        if image.format == peniko::ImageFormat::Bgra8 {
            let mut rgba = bytes.to_vec();
            for px in rgba.chunks_exact_mut(4) { px.swap(0, 2); }
            apply(&rgba, &mut self.pixmap, mask);
        } else {
            apply(bytes, &mut self.pixmap, mask);
        }
    }

    /// Scale and blit `src` (RGBA, iw×ih) to fill the destination rect.
    fn blit_scaled(&mut self, src: &[u8], iw: u32, ih: u32,
                   x: f64, y: f64, w: f64, h: f64) {
        let Some(pm) = tiny_skia::PixmapRef::from_bytes(src, iw, ih) else { return };
        let sx = iw as f32 / w as f32;
        let sy = ih as f32 / h as f32;
        let tx = -(x as f32) * sx;
        let ty = -(y as f32) * sy;
        let local = tiny_skia::Transform::from_row(sx, 0.0, 0.0, sy, tx, ty);
        let shader = tiny_skia::Pattern::new(
            pm,
            tiny_skia::SpreadMode::Pad,
            tiny_skia::FilterQuality::Bilinear,
            1.0,
            local,
        );
        let paint = tiny_skia::Paint { shader, ..Default::default() };
        let mask  = self.current_mask.as_ref();
        if let Some(rect) = tiny_skia::Rect::from_xywh(x as f32, y as f32, w as f32, h as f32) {
            self.pixmap.fill_rect(rect, &paint, tiny_skia::Transform::identity(), mask);
        }
    }

    // ── Layers / clipping ─────────────────────────────────────────────────────

    fn push_clip_path(&mut self, path: &tiny_skia::Path) {
        let saved = self.current_mask.take();
        let new_mask = match saved.as_ref() {
            Some(parent) => {
                let mut m = parent.clone();
                m.intersect_path(path, tiny_skia::FillRule::Winding, true,
                                 tiny_skia::Transform::identity());
                Some(m)
            }
            None => {
                let w = self.pixmap.width();
                let h = self.pixmap.height();
                tiny_skia::Mask::new(w, h).map(|mut m| {
                    m.fill_path(path, tiny_skia::FillRule::Winding, true,
                                tiny_skia::Transform::identity());
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

// ── TinySkiaRenderer ──────────────────────────────────────────────────────────

/// Manages CPU→GPU upload for the tiny-skia backend.
pub struct TinySkiaRenderer {
    upload_texture: wgpu::Texture,
    upload_view:    wgpu::TextureView,
    blit:           wgpu::util::TextureBlitter,
    width:          u32,
    height:         u32,
    pub background_color: peniko::Color,
    /// Swash context + glyph cache — moved into TinySkiaFrame during render.
    shared:         Option<TinySkiaShared>,
}

impl TinySkiaRenderer {
    pub fn new(gpu: &GpuContext) -> Result<Self, RendererError> {
        log::info!("velox-renderer: tiny-skia CPU backend active.");
        let w = gpu.width().max(1);
        let h = gpu.height().max(1);
        let (texture, view) = Self::make_upload(gpu, w, h);
        let blit = wgpu::util::TextureBlitter::new(&gpu.device, gpu.surface_format());
        Ok(Self {
            upload_texture: texture,
            upload_view:    view,
            blit, width: w, height: h,
            background_color: crate::colors::BACKGROUND,
            shared: Some(TinySkiaShared {
                scale_ctx:   swash::scale::ScaleContext::new(),
                glyph_cache: HashMap::new(),
            }),
        })
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

    pub fn render_frame(
        &mut self,
        gpu:     &GpuContext,
        texture: &wgpu::SurfaceTexture,
        frame:   TinySkiaFrame,
    ) -> Result<(), RendererError> {
        let w = gpu.width().max(1);
        let h = gpu.height().max(1);

        if self.width != w || self.height != h {
            self.width  = w;
            self.height = h;
            let (tex, view) = Self::make_upload(gpu, w, h);
            self.upload_texture = tex;
            self.upload_view    = view;
            self.blit = wgpu::util::TextureBlitter::new(&gpu.device, gpu.surface_format());
        }

        // Reclaim the persistent cache + scaler from the frame.
        let mut shared = frame.shared;
        // On resize, drop cached glyphs (hinting pixels may differ).
        if self.width != w || self.height != h {
            shared.glyph_cache.clear();
        }
        self.shared = Some(shared);

        // Upload CPU pixmap to GPU.
        gpu.queue.write_texture(
            self.upload_texture.as_image_copy(),
            frame.pixmap.data(),
            wgpu::TexelCopyBufferLayout {
                offset:         0,
                bytes_per_row:  Some(w * 4),
                rows_per_image: None,
            },
            wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
        );

        let surface_view = texture.texture.create_view(&Default::default());
        let mut enc = gpu.device.create_command_encoder(
            &wgpu::CommandEncoderDescriptor { label: Some("skia-blit") });
        self.blit.copy(&gpu.device, &mut enc, &self.upload_view, &surface_view);
        gpu.queue.submit([enc.finish()]);
        Ok(())
    }

    pub fn blit_cached_frame(
        &self,
        gpu:     &GpuContext,
        texture: &wgpu::SurfaceTexture,
    ) -> Result<(), RendererError> {
        let surface_view = texture.texture.create_view(&Default::default());
        let mut enc = gpu.device.create_command_encoder(
            &wgpu::CommandEncoderDescriptor { label: Some("skia-blit-cached") });
        self.blit.copy(&gpu.device, &mut enc, &self.upload_view, &surface_view);
        gpu.queue.submit([enc.finish()]);
        Ok(())
    }

    /// Drop cached glyph alpha masks to free CPU memory under pressure.
    pub fn trim_resources(&mut self) {
        if let Some(shared) = self.shared.as_mut() {
            shared.glyph_cache.clear();
        }
    }

    pub fn try_save_pipeline_cache(&self) {}
}
