//! Direct2D backend — experimental, Windows-only (`renderMode: 'direct2d'`).
//!
//! Unlike Vello/TinySkia, this backend does not own its own device/swap
//! chain — that lives in `glyx-core`'s `D2DPresent` (needs the window's raw
//! HWND, which this crate has no access to). `Direct2DRenderer` is
//! constructed with a cloned `ID2D1DeviceContext` COM handle (cheap AddRef;
//! COM refcounting keeps the underlying object alive on both sides) and
//! draws directly into it every frame — no CPU pixel buffer, no wgpu
//! texture upload, unlike TinySkia's non-wgpu path.
//!
//! Phase 1 scope: basic shapes only (rects, circles, lines, paths). Text,
//! images, brush-based fills, and layers/opacity are later phases — their
//! `AnyFrame` methods here log a warning and no-op rather than panicking, so
//! partial UI (an app that also uses these) degrades visibly instead of
//! crashing during this backend's early development.

#![cfg(target_os = "windows")]

use std::collections::HashMap;

use windows::core::Interface;
use windows::Win32::Graphics::Direct2D::Common::*;
use windows::Win32::Graphics::Direct2D::*;
use windows::Win32::Graphics::DirectWrite::*;

use vello::{kurbo, peniko};

use crate::RendererError;

fn to_d2d_color(c: peniko::Color) -> D2D1_COLOR_F {
    let rgba = c.to_rgba8();
    D2D1_COLOR_F {
        r: rgba.r as f32 / 255.0,
        g: rgba.g as f32 / 255.0,
        b: rgba.b as f32 / 255.0,
        a: rgba.a as f32 / 255.0,
    }
}

/// Bridges Parley's in-memory font blobs (raw TTF/OTF/TTC bytes + face index
/// — the same `linebender_resource_handle::FontData` Vello consumes directly
/// and TinySkia rasterizes via `swash`) to real `IDWriteFontFace` objects, so
/// `DrawGlyphRun` gets native DirectWrite/ClearType text instead of a
/// from-scratch CPU rasterizer. Uses `IDWriteInMemoryFontFileLoader`
/// (Windows 10+) rather than hand-implementing `IDWriteFontFileLoader`/
/// `IDWriteFontFileStream` — avoids writing a custom COM object for what the
/// OS already provides.
///
/// Persists across frames on `Direct2DRenderer` (moved into `Direct2DFrame`
/// at `begin_frame` and back at `finish_frame_d2d`, mirroring TinySkia's
/// `TinySkiaShared`/glyph-cache dance) — `IDWriteFontFace` creation isn't
/// free, and the same font blob is drawn every frame for any static text.
struct Direct2DFontCache {
    dwrite_factory: IDWriteFactory5,
    mem_loader:     IDWriteInMemoryFontFileLoader,
    faces:          HashMap<(usize, u32), IDWriteFontFace>,
}

impl Direct2DFontCache {
    fn new() -> Option<Self> {
        unsafe {
            let dwrite_factory: IDWriteFactory5 =
                DWriteCreateFactory(DWRITE_FACTORY_TYPE_SHARED).ok()?;
            let mem_loader = dwrite_factory.CreateInMemoryFontFileLoader().ok()?;
            dwrite_factory.RegisterFontFileLoader(&mem_loader).ok()?;
            Some(Self { dwrite_factory, mem_loader, faces: HashMap::new() })
        }
    }

    /// `data_ptr` doubles as the cache key's font identity — same convention
    /// TinySkia's `GlyphKey` already uses (`skia.rs`'s `data_ptr: usize`),
    /// valid because Parley/Vello's `FontData` blob is a stable,
    /// reference-counted allocation for the lifetime it's referenced.
    fn get_or_create(&mut self, font_bytes: &[u8], font_index: u32) -> Option<IDWriteFontFace> {
        let key = (font_bytes.as_ptr() as usize, font_index);
        if let Some(face) = self.faces.get(&key) {
            return Some(face.clone());
        }
        unsafe {
            let font_file = self
                .mem_loader
                .CreateInMemoryFontFileReference(
                    &self.dwrite_factory,
                    font_bytes.as_ptr() as *const core::ffi::c_void,
                    font_bytes.len() as u32,
                    None,
                )
                .ok()?;
            // TTF/OTF/TTC all analyze as TRUETYPE or TRUETYPE_COLLECTION in
            // DirectWrite's classification (bare CFF-only fonts are rare in
            // practice); try both rather than requiring exact upfront
            // knowledge of the container format.
            let files = [Some(font_file)];
            let face = self.dwrite_factory
                .CreateFontFace(
                    DWRITE_FONT_FACE_TYPE_TRUETYPE,
                    &files,
                    font_index,
                    DWRITE_FONT_SIMULATIONS_NONE,
                )
                .or_else(|_| self.dwrite_factory.CreateFontFace(
                    DWRITE_FONT_FACE_TYPE_TRUETYPE_COLLECTION,
                    &files,
                    font_index,
                    DWRITE_FONT_SIMULATIONS_NONE,
                ))
                .ok()?;
            self.faces.insert(key, face.clone());
            Some(face)
        }
    }
}

fn linear_to_srgb_u8(v: u8) -> u8 {
    let c = v as f32 / 255.0;
    let srgb = if c <= 0.0031308 {
        c * 12.92
    } else {
        1.055 * c.powf(1.0 / 2.4) - 0.055
    };
    (srgb * 255.0).round().clamp(0.0, 255.0) as u8
}

/// Inverse of `glyx-core/src/scene.rs`'s `rgba_to_peniko`: `peniko::ImageData`
/// bytes are linear-premultiplied (chosen for Vello's colorspace-correct GPU
/// compositing). D2D's `D2D1_ALPHA_MODE_PREMULTIPLIED` bitmap format expects
/// standard sRGB-premultiplied bytes, not linear ones — uploading the linear
/// bytes as-is would double-apply gamma and look visibly wrong (too dark/
/// desaturated), unlike TinySkia's shortcut of blitting them unconverted
/// (flagged in the plan as a pre-existing latent inconsistency, not
/// something to replicate here).
fn linear_premul_to_srgb_premul(bytes: &[u8]) -> Vec<u8> {
    let mut out = bytes.to_vec();
    for px in out.chunks_exact_mut(4) {
        let a = px[3];
        if a == 0 { continue; }
        let inv = 255.0 / a as f32;
        let lr = (px[0] as f32 * inv).min(255.0) as u8;
        let lg = (px[1] as f32 * inv).min(255.0) as u8;
        let lb = (px[2] as f32 * inv).min(255.0) as u8;
        let sr = linear_to_srgb_u8(lr);
        let sg = linear_to_srgb_u8(lg);
        let sb = linear_to_srgb_u8(lb);
        let a16 = a as u16;
        px[0] = ((sr as u16 * a16 + 127) / 255) as u8;
        px[1] = ((sg as u16 * a16 + 127) / 255) as u8;
        px[2] = ((sb as u16 * a16 + 127) / 255) as u8;
    }
    out
}

/// Cache of `ID2D1Bitmap`s keyed by the source `peniko::ImageData` blob's
/// identity (same convention as `Direct2DFontCache` and TinySkia's glyph
/// cache) — avoids redoing the sRGB/premultiply conversion above every
/// frame for an image that hasn't changed. Persists across frames on
/// `Direct2DRenderer`, moved into `Direct2DFrame` at `begin_frame` and back
/// at `finish_frame_d2d`, same shape as the font cache.
#[derive(Default)]
struct Direct2DImageCache {
    bitmaps: HashMap<usize, ID2D1Bitmap>,
}

impl Direct2DImageCache {
    fn new() -> Self { Self::default() }

    fn get_or_create(&mut self, rt: &ID2D1RenderTarget, image: &peniko::ImageData) -> Option<ID2D1Bitmap> {
        let bytes = image.data.data();
        let key = bytes.as_ptr() as usize;
        if let Some(bmp) = self.bitmaps.get(&key) {
            return Some(bmp.clone());
        }
        let rgba: Vec<u8> = match image.format {
            peniko::ImageFormat::Bgra8 => {
                let mut b = bytes.to_vec();
                for px in b.chunks_exact_mut(4) { px.swap(0, 2); }
                linear_premul_to_srgb_premul(&b)
            }
            _ => linear_premul_to_srgb_premul(bytes),
        };
        let props = D2D1_BITMAP_PROPERTIES {
            pixelFormat: D2D1_PIXEL_FORMAT {
                format: windows::Win32::Graphics::Dxgi::Common::DXGI_FORMAT_R8G8B8A8_UNORM,
                alphaMode: D2D1_ALPHA_MODE_PREMULTIPLIED,
            },
            dpiX: 96.0,
            dpiY: 96.0,
        };
        let size = D2D_SIZE_U { width: image.width, height: image.height };
        let pitch = image.width * 4;
        let bmp = unsafe {
            rt.CreateBitmap(size, Some(rgba.as_ptr() as *const core::ffi::c_void), pitch, &props as *const _).ok()?
        };
        self.bitmaps.insert(key, bmp.clone());
        Some(bmp)
    }
}

pub struct Direct2DRenderer {
    pub background_color: peniko::Color,
    device_context: ID2D1DeviceContext,
    font_cache: Option<Direct2DFontCache>,
    image_cache: Direct2DImageCache,
}

impl Direct2DRenderer {
    /// `device_context` is a clone of the same COM object `D2DPresent` owns
    /// (glyx-core constructs `D2DPresent` first, then passes a clone here
    /// when building `AnyRenderer::Direct2D`, bypassing `AnyRenderer::new`'s
    /// wgpu-taking signature entirely — mirrors `TinySkiaRenderer::new_cpu_only`'s
    /// bypass of the same constructor for the soft-present path).
    pub fn new(device_context: ID2D1DeviceContext) -> Self {
        let font_cache = Direct2DFontCache::new();
        if font_cache.is_none() {
            log::warn!("Direct2D backend: DirectWrite font cache init failed — text will not render.");
        }
        Self {
            background_color: peniko::Color::WHITE,
            device_context,
            font_cache,
            image_cache: Direct2DImageCache::new(),
        }
    }

    /// No-op: the target bitmap's size is owned and resized by `D2DPresent`
    /// (`SetTarget` after `ResizeBuffers`) — there's no renderer-local pixel
    /// buffer to keep in sync here, unlike TinySkia's CPU pixmap.
    pub fn notify_resize(&mut self, _w: u32, _h: u32) {}

    pub fn begin_frame(&mut self) -> Direct2DFrame {
        let ctx = self.device_context.clone();
        let rt: ID2D1RenderTarget = ctx
            .cast()
            .expect("ID2D1DeviceContext always implements ID2D1RenderTarget");
        unsafe {
            rt.BeginDraw();
            let color = to_d2d_color(self.background_color);
            rt.Clear(Some(&color as *const _));
        }
        Direct2DFrame {
            ctx, rt,
            font_cache: self.font_cache.take(),
            image_cache: std::mem::take(&mut self.image_cache),
        }
    }

    /// Finish the frame — `EndDraw()`, and reclaim the font/image caches
    /// moved into the frame at `begin_frame` (mirrors `TinySkiaRenderer::
    /// render_frame`/`finish_frame_soft` moving `TinySkiaShared` back after
    /// drawing). Presenting the swap chain is `D2DPresent::present()`'s job,
    /// called directly from glyx-core's `Present::Direct2D` dispatch arm
    /// right after this returns.
    pub fn finish_frame_d2d(&mut self, frame: Direct2DFrame) -> Result<(), RendererError> {
        self.font_cache  = frame.font_cache;
        self.image_cache = frame.image_cache;
        unsafe {
            frame.rt
                .EndDraw(None, None)
                .map_err(|e| RendererError::Render(format!("D2D EndDraw failed: {e}")))
        }
    }

    /// D2D/D3D11 resource caches are OS/driver-managed, not an app-owned
    /// pool (that's the whole reason this backend exists — see the plan
    /// doc's memory measurements) — nothing for this backend to trim itself.
    pub fn trim_resources(&mut self) {}

    pub fn try_save_pipeline_cache(&self) {}
}

pub struct Direct2DFrame {
    /// Kept for later phases (`PushLayer`/`CreateBitmapFromWicBitmap`
    /// live on the device-context interface, not the base render-target one).
    #[allow(dead_code)]
    ctx: ID2D1DeviceContext,
    /// `ID2D1DeviceContext` inherits `ID2D1RenderTarget`; windows-rs only
    /// exposes inherited COM methods via an explicit interface cast (same
    /// gotcha hit in the standalone spike) — cast once here rather than
    /// per draw call.
    rt: ID2D1RenderTarget,
    /// Moved out of `Direct2DRenderer` at `begin_frame`, moved back at
    /// `finish_frame_d2d`. `None` only if `Direct2DFontCache::new()` failed
    /// at renderer construction (logged once there) — `draw_text` no-ops
    /// rather than panicking in that case.
    font_cache: Option<Direct2DFontCache>,
    /// Same move-in/move-out pattern as `font_cache`.
    image_cache: Direct2DImageCache,
}

impl Direct2DFrame {
    pub fn supports_caching(&self) -> bool { false }

    fn solid_brush(&self, color: peniko::Color) -> Option<ID2D1SolidColorBrush> {
        let d2color = to_d2d_color(color);
        unsafe { self.rt.CreateSolidColorBrush(&d2color as *const _, None).ok() }
    }

    pub fn fill_rounded_rect(&mut self, x: f64, y: f64, w: f64, h: f64, radius: f64, color: peniko::Color) {
        if w <= 0.0 || h <= 0.0 { return; }
        let Some(brush) = self.solid_brush(color) else { return };
        let rect = D2D_RECT_F { left: x as f32, top: y as f32, right: (x + w) as f32, bottom: (y + h) as f32 };
        let rr = D2D1_ROUNDED_RECT { rect, radiusX: radius as f32, radiusY: radius as f32 };
        unsafe { self.rt.FillRoundedRectangle(&rr as *const _, &brush); }
    }

    /// Build a D2D gradient-stop collection from a `peniko::Gradient`'s stops
    /// (same source data TinySkia's `gradient_shader` already converts from,
    /// see skia.rs — same stop list, different target brush type).
    fn gradient_stops(&self, grad: &peniko::Gradient) -> Option<ID2D1GradientStopCollection> {
        let stops: Vec<D2D1_GRADIENT_STOP> = grad.stops.iter().map(|s| {
            let c = s.color.to_alpha_color::<peniko::color::Srgb>();
            let rgba = c.to_rgba8();
            D2D1_GRADIENT_STOP {
                position: s.offset,
                color: D2D1_COLOR_F {
                    r: rgba.r as f32 / 255.0,
                    g: rgba.g as f32 / 255.0,
                    b: rgba.b as f32 / 255.0,
                    a: rgba.a as f32 / 255.0,
                },
            }
        }).collect();
        if stops.is_empty() { return None; }
        unsafe {
            self.rt
                .CreateGradientStopCollection(&stops, D2D1_GAMMA_2_2, D2D1_EXTEND_MODE_CLAMP)
                .ok()
        }
    }

    pub fn fill_rounded_rect_with_brush(&mut self, x: f64, y: f64, w: f64, h: f64, radius: f64, brush: &peniko::Brush) {
        if w <= 0.0 || h <= 0.0 { return; }
        let rect = D2D_RECT_F { left: x as f32, top: y as f32, right: (x + w) as f32, bottom: (y + h) as f32 };
        let rr = D2D1_ROUNDED_RECT { rect, radiusX: radius as f32, radiusY: radius as f32 };

        match brush {
            peniko::Brush::Solid(color) => self.fill_rounded_rect(x, y, w, h, radius, *color),
            peniko::Brush::Gradient(grad) => {
                let Some(stops) = self.gradient_stops(grad) else { return };
                match &grad.kind {
                    peniko::GradientKind::Linear(pos) => {
                        let props = D2D1_LINEAR_GRADIENT_BRUSH_PROPERTIES {
                            startPoint: D2D_POINT_2F { x: pos.start.x as f32, y: pos.start.y as f32 },
                            endPoint:   D2D_POINT_2F { x: pos.end.x   as f32, y: pos.end.y   as f32 },
                        };
                        let Ok(gb) = (unsafe { self.rt.CreateLinearGradientBrush(&props as *const _, None, &stops) }) else { return };
                        unsafe { self.rt.FillRoundedRectangle(&rr as *const _, &gb); }
                    }
                    peniko::GradientKind::Radial(pos) => {
                        let props = D2D1_RADIAL_GRADIENT_BRUSH_PROPERTIES {
                            center: D2D_POINT_2F { x: pos.end_center.x as f32, y: pos.end_center.y as f32 },
                            gradientOriginOffset: D2D_POINT_2F {
                                x: (pos.start_center.x - pos.end_center.x) as f32,
                                y: (pos.start_center.y - pos.end_center.y) as f32,
                            },
                            radiusX: pos.end_radius,
                            radiusY: pos.end_radius,
                        };
                        let Ok(gb) = (unsafe { self.rt.CreateRadialGradientBrush(&props as *const _, None, &stops) }) else { return };
                        unsafe { self.rt.FillRoundedRectangle(&rr as *const _, &gb); }
                    }
                    // Sweep gradients: unsupported by D2D's built-in brush
                    // types (same limitation TinySkia has — see skia.rs's
                    // gradient_shader `_ => None` arm). Skip rather than draw
                    // something visually wrong.
                    _ => {}
                }
            }
            // Image-brush fills (bitmap pattern brush) are Phase 4 territory
            // alongside the rest of image drawing — not yet implemented.
            peniko::Brush::Image(_) => {
                log::warn!("Direct2D backend: image-brush fills not yet implemented (Phase 4), skipping.");
            }
        }
    }

    pub fn fill_rect(&mut self, x: f64, y: f64, w: f64, h: f64, color: peniko::Color) {
        self.fill_rounded_rect(x, y, w, h, 0.0, color);
    }

    pub fn stroke_rounded_rect(&mut self, x: f64, y: f64, w: f64, h: f64, radius: f64, stroke_width: f64, color: peniko::Color) {
        if w <= 0.0 || h <= 0.0 { return; }
        let Some(brush) = self.solid_brush(color) else { return };
        let rect = D2D_RECT_F { left: x as f32, top: y as f32, right: (x + w) as f32, bottom: (y + h) as f32 };
        unsafe {
            if radius > 0.0 {
                let rr = D2D1_ROUNDED_RECT { rect, radiusX: radius as f32, radiusY: radius as f32 };
                self.rt.DrawRoundedRectangle(&rr as *const _, &brush, stroke_width as f32, None);
            } else {
                self.rt.DrawRectangle(&rect as *const _, &brush, stroke_width as f32, None);
            }
        }
    }

    pub fn fill_circle(&mut self, cx: f64, cy: f64, r: f64, color: peniko::Color) {
        if r <= 0.0 { return; }
        let Some(brush) = self.solid_brush(color) else { return };
        let ellipse = D2D1_ELLIPSE {
            point: D2D_POINT_2F { x: cx as f32, y: cy as f32 },
            radiusX: r as f32,
            radiusY: r as f32,
        };
        unsafe { self.rt.FillEllipse(&ellipse as *const _, &brush); }
    }

    pub fn stroke_circle(&mut self, cx: f64, cy: f64, r: f64, width: f64, color: peniko::Color) {
        if r <= 0.0 { return; }
        let Some(brush) = self.solid_brush(color) else { return };
        let ellipse = D2D1_ELLIPSE {
            point: D2D_POINT_2F { x: cx as f32, y: cy as f32 },
            radiusX: r as f32,
            radiusY: r as f32,
        };
        unsafe { self.rt.DrawEllipse(&ellipse as *const _, &brush, width as f32, None); }
    }

    pub fn stroke_line(&mut self, x0: f64, y0: f64, x1: f64, y1: f64, width: f64, color: peniko::Color) {
        let Some(brush) = self.solid_brush(color) else { return };
        let p0 = D2D_POINT_2F { x: x0 as f32, y: y0 as f32 };
        let p1 = D2D_POINT_2F { x: x1 as f32, y: y1 as f32 };
        unsafe { self.rt.DrawLine(p0, p1, &brush, width as f32, None); }
    }

    fn build_path_geometry(&self, pts: &[f32], closed: bool) -> Option<ID2D1PathGeometry> {
        if pts.len() < 4 { return None; }
        unsafe {
            let factory: ID2D1Factory = self.rt.GetFactory().ok()?;
            let geometry = factory.CreatePathGeometry().ok()?;
            let sink = geometry.Open().ok()?;
            sink.BeginFigure(
                D2D_POINT_2F { x: pts[0], y: pts[1] },
                D2D1_FIGURE_BEGIN_FILLED,
            );
            let mut i = 2;
            while i + 1 < pts.len() {
                sink.AddLine(D2D_POINT_2F { x: pts[i], y: pts[i + 1] });
                i += 2;
            }
            sink.EndFigure(if closed { D2D1_FIGURE_END_CLOSED } else { D2D1_FIGURE_END_OPEN });
            sink.Close().ok()?;
            Some(geometry)
        }
    }

    pub fn fill_path(&mut self, pts: &[f32], color: peniko::Color) {
        let Some(geometry) = self.build_path_geometry(pts, true) else { return };
        let Some(brush) = self.solid_brush(color) else { return };
        unsafe { self.rt.FillGeometry(&geometry, &brush, None); }
    }

    pub fn stroke_path(&mut self, pts: &[f32], width: f64, closed: bool, color: peniko::Color) {
        let Some(geometry) = self.build_path_geometry(pts, closed) else { return };
        let Some(brush) = self.solid_brush(color) else { return };
        unsafe { self.rt.DrawGeometry(&geometry, &brush, width as f32, None); }
    }

    /// Same Parley traversal Vello/TinySkia already use (`layout.inner.lines()`
    /// → `line.items()` → `GlyphRun`), translated to `DWRITE_GLYPH_RUN` +
    /// `ID2D1RenderTarget::DrawGlyphRun` instead of Vello's `draw_glyphs` or
    /// TinySkia's swash rasterization. Pen-accumulation (`pen_x += g.advance`)
    /// matches TinySkia's approach (skia.rs) rather than Vello's — Parley's
    /// `g.x`/`g.y` are shaping *adjustments* from the current pen, not
    /// absolute positions, so accumulating advances is correct and needs no
    /// "all glyph x are zero" fallback hack.
    pub fn draw_text(&mut self, layout: &glyx_text::TextLayout, x: f64, y: f64, color: peniko::Color) {
        let Some(brush) = self.solid_brush(color) else { return };
        let Some(cache) = self.font_cache.as_mut() else { return };
        let brush: ID2D1Brush = match brush.cast() {
            Ok(b) => b,
            Err(_) => return,
        };

        for line in layout.inner.lines() {
            for item in line.items() {
                let parley::layout::PositionedLayoutItem::GlyphRun(gr) = item else { continue };
                let run  = gr.run();
                let font = run.font();
                let size = run.font_size();
                let baseline = gr.baseline() as f64;
                let run_off  = gr.offset()   as f64;

                let font_bytes = font.data.data();
                let font_index = font.index;
                let Some(face) = cache.get_or_create(font_bytes, font_index) else { continue };

                let mut pen_x = run_off;
                let mut indices  = Vec::new();
                let mut advances = Vec::new();
                let mut offsets  = Vec::new();
                for g in gr.glyphs() {
                    let gx = x + pen_x + g.x as f64;
                    let gy = y + baseline + g.y as f64;
                    // DWRITE_GLYPH_OFFSET is relative to the run's shared
                    // baseline origin (set below), not absolute — encode each
                    // glyph's absolute position as an offset from that origin.
                    indices.push(g.id as u16);
                    advances.push(0.0f32); // advance folded into per-glyph offset instead
                    offsets.push(DWRITE_GLYPH_OFFSET {
                        advanceOffset:  (gx - x - run_off) as f32,
                        ascenderOffset: -(gy - y - baseline) as f32, // DWrite Y-up offset convention
                    });
                    pen_x += g.advance as f64;
                }
                if indices.is_empty() { continue; }

                let glyph_run = DWRITE_GLYPH_RUN {
                    fontFace: std::mem::ManuallyDrop::new(Some(face)),
                    fontEmSize: size,
                    glyphCount: indices.len() as u32,
                    glyphIndices: indices.as_ptr(),
                    glyphAdvances: advances.as_ptr(),
                    glyphOffsets: offsets.as_ptr(),
                    isSideways: windows::Win32::Foundation::BOOL(0),
                    bidiLevel: 0,
                };
                let baseline_origin = D2D_POINT_2F { x: (x + run_off) as f32, y: (y + baseline) as f32 };
                unsafe {
                    self.rt.DrawGlyphRun(
                        baseline_origin,
                        &glyph_run as *const _,
                        &brush,
                        DWRITE_MEASURING_MODE_NATURAL,
                    );
                }
            }
        }
    }

    pub fn draw_image(&mut self, image: &peniko::ImageData, x: f64, y: f64, w: f64, h: f64) {
        if w <= 0.0 || h <= 0.0 || image.width == 0 || image.height == 0 { return; }
        let Some(bitmap) = self.image_cache.get_or_create(&self.rt, image) else { return };
        let dest = D2D_RECT_F { left: x as f32, top: y as f32, right: (x + w) as f32, bottom: (y + h) as f32 };
        unsafe {
            self.rt.DrawBitmap(
                &bitmap,
                Some(&dest as *const _),
                1.0,
                D2D1_BITMAP_INTERPOLATION_MODE_LINEAR,
                None,
            );
        }
    }

    /// `transform` carries both position and scale — draw the bitmap at its
    /// natural size under a world transform, matching TinySkia's
    /// `Pattern`-based approach (skia.rs) rather than pre-computing a
    /// destination rect.
    pub fn draw_image_with_transform(&mut self, image: &peniko::ImageData, transform: kurbo::Affine) {
        if image.width == 0 || image.height == 0 { return; }
        let Some(bitmap) = self.image_cache.get_or_create(&self.rt, image) else { return };
        let [a, b, c, d, e, f] = transform.as_coeffs();
        let matrix = windows::Foundation::Numerics::Matrix3x2 {
            M11: a as f32, M12: b as f32,
            M21: c as f32, M22: d as f32,
            M31: e as f32, M32: f as f32,
        };
        let dest = D2D_RECT_F { left: 0.0, top: 0.0, right: image.width as f32, bottom: image.height as f32 };
        unsafe {
            self.rt.SetTransform(&matrix as *const _);
            self.rt.DrawBitmap(
                &bitmap,
                Some(&dest as *const _),
                1.0,
                D2D1_BITMAP_INTERPOLATION_MODE_LINEAR,
                None,
            );
            self.rt.SetTransform(&windows::Foundation::Numerics::Matrix3x2 {
                M11: 1.0, M12: 0.0, M21: 0.0, M22: 1.0, M31: 0.0, M32: 0.0,
            } as *const _);
        }
    }

    /// Shared implementation for all three `push_*_layer` variants —
    /// `ID2D1DeviceContext::PushLayer` with `D2D1_LAYER_PARAMETERS1`, which
    /// (unlike `ID2D1HwndRenderTarget`'s older layer API) supports a real
    /// per-layer `opacity` field. This is the correctness win the plan
    /// called out for choosing the device-context path over the legacy
    /// HWND render target: TinySkia's `push_layer_with_alpha` only clips,
    /// it doesn't actually apply opacity (see skia.rs doc comment) — this
    /// implementation does both correctly.
    fn push_layer_impl(&mut self, x: f64, y: f64, w: f64, h: f64, radius: f64, opacity: f32) {
        if w <= 0.0 || h <= 0.0 { return; }
        let bounds = D2D_RECT_F { left: x as f32, top: y as f32, right: (x + w) as f32, bottom: (y + h) as f32 };

        let geometric_mask: Option<ID2D1Geometry> = if radius > 0.0 {
            unsafe {
                self.rt.GetFactory().ok().and_then(|factory: ID2D1Factory| {
                    let rr = D2D1_ROUNDED_RECT { rect: bounds, radiusX: radius as f32, radiusY: radius as f32 };
                    factory.CreateRoundedRectangleGeometry(&rr as *const _).ok()
                }).and_then(|g| g.cast::<ID2D1Geometry>().ok())
            }
        } else {
            None
        };

        let identity = windows::Foundation::Numerics::Matrix3x2 {
            M11: 1.0, M12: 0.0, M21: 0.0, M22: 1.0, M31: 0.0, M32: 0.0,
        };
        let params = D2D1_LAYER_PARAMETERS1 {
            contentBounds: bounds,
            geometricMask: std::mem::ManuallyDrop::new(geometric_mask),
            maskAntialiasMode: D2D1_ANTIALIAS_MODE_PER_PRIMITIVE,
            maskTransform: identity,
            opacity,
            opacityBrush: std::mem::ManuallyDrop::new(None),
            layerOptions: D2D1_LAYER_OPTIONS1_NONE,
        };
        unsafe { self.ctx.PushLayer(&params as *const _, None); }
    }

    pub fn push_layer(&mut self, x: f64, y: f64, w: f64, h: f64) {
        self.push_layer_impl(x, y, w, h, 0.0, 1.0);
    }

    pub fn push_rounded_layer(&mut self, x: f64, y: f64, w: f64, h: f64, radius: f64) {
        self.push_layer_impl(x, y, w, h, radius, 1.0);
    }

    pub fn push_layer_with_alpha(&mut self, x: f64, y: f64, w: f64, h: f64, alpha: f32) {
        self.push_layer_impl(x, y, w, h, 0.0, alpha);
    }

    pub fn pop_layer(&mut self) {
        unsafe { self.ctx.PopLayer(); }
    }

    pub fn scene_mut(&mut self) -> &mut vello::Scene {
        panic!("Direct2DFrame::scene_mut called — supports_caching() is false, callers must check it first (same contract as TinySkiaFrame)");
    }
    pub fn replace_scene(&mut self, _scene: vello::Scene) -> vello::Scene {
        panic!("Direct2DFrame::replace_scene called — supports_caching() is false, callers must check it first");
    }
    pub fn append_scene(&mut self, _scene: &vello::Scene, _transform: Option<kurbo::Affine>) {
        panic!("Direct2DFrame::append_scene called — supports_caching() is false, callers must check it first");
    }
}
