//! velox-renderer — Vello-based 2D rendering.
//!
//! ## Why FrameBuilder owns Scene (not borrows it)
//!
//! If FrameBuilder held &mut Scene from VeloxRenderer, that borrow would
//! keep &mut VeloxRenderer alive across the whole frame-build span.
//! Calling renderer.render_frame() while that borrow was live would be a
//! second &mut — rejected by the borrow checker as E0499.
//!
//! Fix: FrameBuilder owns its Scene value. begin_frame() moves a pre-reset
//! Scene out of the renderer; render_frame() moves it back via assignment.
//! Zero extra allocation — Scene's internal Vec buffers survive the move.

use thiserror::Error;
use velox_gpu::GpuContext;
use vello::{
    kurbo::{Affine, Circle, Line, Point, RoundedRect, Stroke},
    peniko::{Brush, Color, Fill, ImageData},
    AaConfig, Renderer, RendererOptions,
};
pub use vello::kurbo;
pub use vello::peniko;
pub use vello::Scene;

#[derive(Debug, Error)]
pub enum RendererError {
    #[error("Failed to create Vello renderer: {0}")]
    Init(String),
    #[error("Render error: {0}")]
    Render(String),
}

pub mod colors {
    use vello::peniko::Color;
    pub const BRAND_GREEN:  Color = Color::from_rgba8(0x00, 0xA8, 0x78, 0xFF);
    pub const BACKGROUND:   Color = Color::from_rgba8(0x14, 0x14, 0x1A, 0xFF);
    pub const TEXT_PRIMARY: Color = Color::from_rgba8(0xF0, 0xF0, 0xF2, 0xFF);
    pub const TEXT_MUTED:   Color = Color::from_rgba8(0x88, 0x88, 0x99, 0xFF);
}


// ── Render target ─────────────────────────────────────────────────────────────

struct RenderTarget {
    // `texture` is never read by CPU code but must be kept alive because
    // `view` holds an internal reference into it on the GPU side.
    #[allow(dead_code)]
    texture: wgpu::Texture,
    view:    wgpu::TextureView,
    width:   u32,
    height:  u32,
}

impl RenderTarget {
    fn new(device: &wgpu::Device, width: u32, height: u32) -> Self {
        let texture = device.create_texture(&wgpu::TextureDescriptor {
            label:           Some("vello-target"),
            size:            wgpu::Extent3d { width, height, depth_or_array_layers: 1 },
            mip_level_count: 1,
            sample_count:    1,
            dimension:       wgpu::TextureDimension::D2,
            format:          wgpu::TextureFormat::Rgba8Unorm,
            usage:           wgpu::TextureUsages::STORAGE_BINDING
                           | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats:    &[],
        });
        let view = texture.create_view(&Default::default());
        Self { texture, view, width, height }
    }

    fn needs_resize(&self, w: u32, h: u32) -> bool {
        self.width != w || self.height != h
    }
}

// ── VeloxRenderer ─────────────────────────────────────────────────────────────

pub struct VeloxRenderer {
    renderer: Renderer,
    /// wgpu 29 built-in blit helper — replaces the hand-rolled BlitPipeline.
    blit:     wgpu::util::TextureBlitter,
    target:   RenderTarget,
    /// Swapped into FrameBuilder each frame and back on render_frame.
    /// Kept here so its Vec allocations survive across frames.
    scene:    Scene,
    /// Window background color — clears the surface each frame.
    /// Set from `window.background` in velox.config.json; defaults to
    /// the Velox dark background so the window is never a blank white flash.
    pub background_color: vello::peniko::Color,
}

impl VeloxRenderer {
    pub fn new(gpu: &GpuContext) -> Result<Self, RendererError> {
        let use_cpu = std::env::var("VELOX_CPU_RENDER")
            .map(|v| v.trim() == "1")
            .unwrap_or(false);
        if use_cpu {
            log::warn!("velox-renderer: CPU fallback active (VELOX_CPU_RENDER=1).");
        }

        let renderer = Renderer::new(&gpu.device, RendererOptions {
            use_cpu,
            antialiasing_support: vello::AaSupport::area_only(),
            num_init_threads:     std::num::NonZeroUsize::new(1),
            pipeline_cache:       None,
        }).map_err(|e| RendererError::Init(e.to_string()))?;

        let blit   = wgpu::util::TextureBlitter::new(&gpu.device, gpu.surface_format());
        let target = RenderTarget::new(&gpu.device, gpu.width().max(1), gpu.height().max(1));

        Ok(Self { renderer, blit, target, scene: Scene::new(), background_color: colors::BACKGROUND })
    }

    /// Start a new frame.
    ///
    /// Moves the renderer's cached Scene (reset) into the returned FrameBuilder.
    /// No lifetime on FrameBuilder — the caller is free to call render_frame
    /// without any borrow conflict.
    pub fn begin_frame(&mut self) -> FrameBuilder {
        self.scene.reset();
        // Move scene out; render_frame puts it back.
        let scene = std::mem::replace(&mut self.scene, Scene::new());
        FrameBuilder { scene }
    }

    /// Submit the frame to the GPU.
    ///
    /// Takes frame by value, moves its Scene back into self, then renders.
    pub fn render_frame(
        &mut self,
        gpu:     &GpuContext,
        texture: &wgpu::SurfaceTexture,
        frame:   FrameBuilder,
    ) -> Result<(), RendererError> {
        // Reclaim the scene the caller drew into.
        self.scene = frame.scene;

        let w = gpu.width().max(1);
        let h = gpu.height().max(1);

        if self.target.needs_resize(w, h) {
            self.target = RenderTarget::new(&gpu.device, w, h);
        }

        self.renderer.render_to_texture(
            &gpu.device, &gpu.queue, &self.scene, &self.target.view,
            &vello::RenderParams {
                base_color:          self.background_color,
                width:               w,
                height:              h,
                antialiasing_method: AaConfig::Area,
            },
        ).map_err(|e| RendererError::Render(e.to_string()))?;

        let surface_view = texture.texture.create_view(&Default::default());
        let mut enc = gpu.device.create_command_encoder(
            &wgpu::CommandEncoderDescriptor { label: Some("blit") });
        self.blit.copy(&gpu.device, &mut enc, &self.target.view, &surface_view);
        gpu.queue.submit([enc.finish()]);

        Ok(())
    }
}

// ── FrameBuilder ──────────────────────────────────────────────────────────────

/// Accumulates draw commands for one frame.
///
/// No lifetime parameter — owns its Scene outright.  This is what lets
/// velox-core hold the builder and call renderer.render_frame() on the same
/// renderer without a double-borrow error.
pub struct FrameBuilder {
    pub(crate) scene: Scene,
}

impl FrameBuilder {
    pub fn fill_rounded_rect(&mut self, x: f64, y: f64, w: f64, h: f64,
                              radius: f64, color: Color) {
        let rect = RoundedRect::new(x, y, x + w, y + h, radius);
        self.scene.fill(Fill::NonZero, Affine::IDENTITY, &Brush::Solid(color), None, &rect);
    }

    pub fn fill_rounded_rect_with_brush(&mut self, x: f64, y: f64, w: f64, h: f64,
                                         radius: f64, brush: &Brush) {
        let rect = RoundedRect::new(x, y, x + w, y + h, radius);
        self.scene.fill(Fill::NonZero, Affine::IDENTITY, brush, None, &rect);
    }

    pub fn fill_rect(&mut self, x: f64, y: f64, w: f64, h: f64, color: Color) {
        self.fill_rounded_rect(x, y, w, h, 0.0, color);
    }

    #[allow(clippy::too_many_arguments)]
    pub fn stroke_rounded_rect(&mut self, x: f64, y: f64, w: f64, h: f64,
                                radius: f64, stroke_width: f64, color: Color) {
        let rect   = RoundedRect::new(x, y, x + w, y + h, radius);
        let stroke = Stroke::new(stroke_width);
        self.scene.stroke(&stroke, Affine::IDENTITY, &Brush::Solid(color), None, &rect);
    }

    /// Draw shaped text with its top-left corner at `(x, y)`.
    ///
    /// Use `layout.ascent()` (not `layout.height()`) for vertical centering:
    ///
    ///   let ty = box_top + (box_height - label.ascent() as f64) / 2.0;
    ///   frame.draw_text(&label, tx, ty, color);
    ///
    /// height() includes invisible inter-line leading; ascent() is the visual
    /// cap-height from the layout top to the baseline.
    pub fn draw_text(&mut self, layout: &velox_text::TextLayout,
                     x: f64, y: f64, color: Color) {
        for line in layout.inner.lines() {
            for item in line.items() {
                let parley::layout::PositionedLayoutItem::GlyphRun(gr) = item else {
                    continue;
                };
                let run  = gr.run();
                // vello 0.9 and parley 0.10 both use FontData from
                // linebender_resource_handle — pass directly, no bridge needed.
                let font = run.font();
                let size = run.font_size();
                let baseline = gr.baseline() as f64;
                let run_off  = gr.offset()   as f64;

                let transform = Affine::translate(
                    vello::kurbo::Vec2::new(x + run_off, y + baseline)
                );

                // parley 0.8+ uses Y-down convention (same as vello) — no negation needed.
                let mut glyphs: Vec<(vello::Glyph, f32)> = gr.glyphs()
                    .map(|g| (vello::Glyph { id: g.id as u32, x: g.x, y: g.y }, g.advance))
                    .collect();

                if glyphs.is_empty() { continue; }

                // Some fonts / Parley configurations return all glyph x values
                // as 0.0 (relying on advance widths for layout instead of
                // explicit positions). When that happens, reconstruct positions
                // from the raw advances. We deliberately do NOT scale by
                // layout.width() because that value excludes trailing spaces,
                // which would shift earlier characters when a space is typed.
                if glyphs.len() > 1 {
                    let all_zero = glyphs.iter().all(|(g, _)| g.x.abs() < 0.001);
                    if all_zero {
                        let mut cursor = 0.0f32;
                        for (g, adv) in glyphs.iter_mut() {
                            g.x = cursor;
                            cursor += adv.max(0.0);
                        }
                    }
                }

                self.scene
                    .draw_glyphs(&font)
                    .font_size(size)
                    .transform(transform)
                    .brush(&Brush::Solid(color))
                    .draw(Fill::NonZero, glyphs.into_iter().map(|(g, _)| g));
            }
        }
    }

    pub fn draw_image(&mut self, image: &ImageData, x: f64, y: f64, w: f64, h: f64) {
        if image.width == 0 || image.height == 0 {
            return;
        }
        let sx = w / image.width as f64;
        let sy = h / image.height as f64;
        let transform = Affine::new([sx, 0.0, 0.0, sy, x, y]);
        self.draw_image_with_transform(image, transform);
    }

    pub fn draw_image_with_transform(&mut self, image: &ImageData, transform: Affine) {
        self.scene.draw_image(image, transform);
    }

    /// Borrow the inner scene mutably — used for advanced operations like
    /// sub-scene rendering with a transform.
    pub fn scene_mut(&mut self) -> &mut Scene {
        &mut self.scene
    }

    /// Swap out the inner scene for a new one and return the old one.
    pub fn replace_scene(&mut self, new: Scene) -> Scene {
        std::mem::replace(&mut self.scene, new)
    }

    /// Push a rectangular clip layer.  All drawing until the matching
    /// `pop_layer` call is clipped to the rectangle `(x, y, x+w, y+h)`.
    pub fn push_layer(&mut self, x: f64, y: f64, w: f64, h: f64) {
        use vello::kurbo::Rect;
        let rect = Rect::new(x, y, x + w, y + h);
        self.scene.push_layer(
            Fill::NonZero,
            vello::peniko::Mix::Normal,
            1.0,
            Affine::IDENTITY,
            &rect,
        );
    }

    pub fn push_rounded_layer(&mut self, x: f64, y: f64, w: f64, h: f64, radius: f64) {
        let rect = RoundedRect::new(x, y, x + w, y + h, radius);
        self.scene.push_layer(
            Fill::NonZero,
            vello::peniko::Mix::Normal,
            1.0,
            Affine::IDENTITY,
            &rect,
        );
    }

    /// Push a rectangular clip layer with a per-layer alpha (opacity).
    pub fn push_layer_with_alpha(&mut self, x: f64, y: f64, w: f64, h: f64, alpha: f32) {
        use vello::kurbo::Rect;
        let rect = Rect::new(x, y, x + w, y + h);
        self.scene.push_layer(
            Fill::NonZero,
            vello::peniko::Mix::Normal,
            alpha,
            Affine::IDENTITY,
            &rect,
        );
    }

    /// Pop the most recently pushed clip layer.
    pub fn pop_layer(&mut self) {
        self.scene.pop_layer();
    }

    pub fn append_scene(&mut self, other: &Scene, transform: Option<Affine>) {
        self.scene.append(other, transform);
    }

    pub fn fill_circle(&mut self, cx: f64, cy: f64, r: f64, color: Color) {
        let c = Circle::new(Point::new(cx, cy), r);
        self.scene.fill(vello::peniko::Fill::NonZero, Affine::IDENTITY, &Brush::Solid(color), None, &c);
    }

    pub fn stroke_circle(&mut self, cx: f64, cy: f64, r: f64, width: f64, color: Color) {
        let c      = Circle::new(Point::new(cx, cy), r);
        let stroke = Stroke::new(width);
        self.scene.stroke(&stroke, Affine::IDENTITY, &Brush::Solid(color), None, &c);
    }

    pub fn stroke_line(&mut self, x0: f64, y0: f64, x1: f64, y1: f64, width: f64, color: Color) {
        let line   = Line::new(Point::new(x0, y0), Point::new(x1, y1));
        let stroke = Stroke::new(width);
        self.scene.stroke(&stroke, Affine::IDENTITY, &Brush::Solid(color), None, &line);
    }
}
