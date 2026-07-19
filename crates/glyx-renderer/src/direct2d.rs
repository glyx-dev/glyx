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

use windows::core::Interface;
use windows::Win32::Graphics::Direct2D::Common::*;
use windows::Win32::Graphics::Direct2D::*;

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

pub struct Direct2DRenderer {
    pub background_color: peniko::Color,
    device_context: ID2D1DeviceContext,
}

impl Direct2DRenderer {
    /// `device_context` is a clone of the same COM object `D2DPresent` owns
    /// (glyx-core constructs `D2DPresent` first, then passes a clone here
    /// when building `AnyRenderer::Direct2D`, bypassing `AnyRenderer::new`'s
    /// wgpu-taking signature entirely — mirrors `TinySkiaRenderer::new_cpu_only`'s
    /// bypass of the same constructor for the soft-present path).
    pub fn new(device_context: ID2D1DeviceContext) -> Self {
        Self { background_color: peniko::Color::WHITE, device_context }
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
        Direct2DFrame { ctx, rt }
    }

    /// D2D/D3D11 resource caches are OS/driver-managed, not an app-owned
    /// pool (that's the whole reason this backend exists — see the plan
    /// doc's memory measurements) — nothing for this backend to trim itself.
    pub fn trim_resources(&mut self) {}

    pub fn try_save_pipeline_cache(&self) {}
}

pub struct Direct2DFrame {
    /// Kept for later phases (`PushLayer`/`DrawGlyphRun`/`CreateBitmapFromWicBitmap`
    /// live on the device-context interface, not the base render-target one).
    #[allow(dead_code)]
    ctx: ID2D1DeviceContext,
    /// `ID2D1DeviceContext` inherits `ID2D1RenderTarget`; windows-rs only
    /// exposes inherited COM methods via an explicit interface cast (same
    /// gotcha hit in the standalone spike) — cast once here rather than
    /// per draw call.
    rt: ID2D1RenderTarget,
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

    // ── Phase 3/4/5 stubs — log once per call and no-op ────────────────────

    pub fn draw_text(&mut self, _layout: &glyx_text::TextLayout, _x: f64, _y: f64, _color: peniko::Color) {
        log::warn!("Direct2D backend: draw_text not yet implemented (Phase 3), skipping.");
    }

    pub fn draw_image(&mut self, _image: &peniko::ImageData, _x: f64, _y: f64, _w: f64, _h: f64) {
        log::warn!("Direct2D backend: draw_image not yet implemented (Phase 4), skipping.");
    }

    pub fn draw_image_with_transform(&mut self, _image: &peniko::ImageData, _transform: kurbo::Affine) {
        log::warn!("Direct2D backend: draw_image_with_transform not yet implemented (Phase 4), skipping.");
    }

    pub fn push_layer(&mut self, _x: f64, _y: f64, _w: f64, _h: f64) {
        log::warn!("Direct2D backend: push_layer not yet implemented (Phase 5), skipping.");
    }

    pub fn push_rounded_layer(&mut self, _x: f64, _y: f64, _w: f64, _h: f64, _radius: f64) {
        log::warn!("Direct2D backend: push_rounded_layer not yet implemented (Phase 5), skipping.");
    }

    pub fn push_layer_with_alpha(&mut self, _x: f64, _y: f64, _w: f64, _h: f64, _alpha: f32) {
        log::warn!("Direct2D backend: push_layer_with_alpha not yet implemented (Phase 5), skipping.");
    }

    pub fn pop_layer(&mut self) {
        log::warn!("Direct2D backend: pop_layer not yet implemented (Phase 5), skipping.");
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

    /// Finish the frame — `EndDraw()` only. Presenting the swap chain is
    /// `D2DPresent::present()`'s job, called directly from `glyx-core`'s
    /// `Present::Direct2D` render-dispatch arm after this returns, mirroring
    /// `finish_frame_soft`'s split (renderer finishes drawing, present
    /// target owns the actual OS-level present call).
    pub fn finish(self) -> Result<(), RendererError> {
        unsafe {
            self.rt
                .EndDraw(None, None)
                .map_err(|e| RendererError::Render(format!("D2D EndDraw failed: {e}")))
        }
    }
}
