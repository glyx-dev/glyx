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
    kurbo::{Affine, RoundedRect, Stroke},
    peniko::{Brush, Color, Fill},
    AaConfig, Renderer, RendererOptions, Scene,
};
pub use vello::kurbo;
pub use vello::peniko;

#[derive(Debug, Error)]
pub enum RendererError {
    #[error("Failed to create Vello renderer: {0}")]
    Init(String),
    #[error("Render error: {0}")]
    Render(String),
}

pub mod colors {
    use vello::peniko::Color;
    pub const BRAND_GREEN:  Color = Color::rgba8(0x00, 0xA8, 0x78, 0xFF);
    pub const BACKGROUND:   Color = Color::rgba8(0x14, 0x14, 0x1A, 0xFF);
    pub const TEXT_PRIMARY: Color = Color::rgba8(0xF0, 0xF0, 0xF2, 0xFF);
    pub const TEXT_MUTED:   Color = Color::rgba8(0x88, 0x88, 0x99, 0xFF);
}

// ── Blit pipeline ─────────────────────────────────────────────────────────────

struct BlitPipeline {
    pipeline:    wgpu::RenderPipeline,
    bind_layout: wgpu::BindGroupLayout,
    sampler:     wgpu::Sampler,
}

impl BlitPipeline {
    fn new(device: &wgpu::Device, surface_format: wgpu::TextureFormat) -> Self {
        let shader = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label:  Some("blit"),
            source: wgpu::ShaderSource::Wgsl(r#"
@group(0) @binding(0) var t: texture_2d<f32>;
@group(0) @binding(1) var s: sampler;
struct Vert { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };
@vertex fn vs(@builtin(vertex_index) vi: u32) -> Vert {
    var pos = array<vec2<f32>,3>(vec2(-1.0,-1.0),vec2(3.0,-1.0),vec2(-1.0,3.0));
    var uv  = array<vec2<f32>,3>(vec2(0.0,1.0),vec2(2.0,1.0),vec2(0.0,-1.0));
    var o: Vert; o.pos = vec4(pos[vi],0.0,1.0); o.uv = uv[vi]; return o;
}
@fragment fn fs(v: Vert) -> @location(0) vec4<f32> { return textureSample(t,s,v.uv); }
"#.into()),
        });

        let bind_layout = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label:   Some("blit-bgl"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0, visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type:    wgpu::TextureSampleType::Float { filterable: true },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled:   false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1, visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::Filtering),
                    count: None,
                },
            ],
        });

        let layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("blit-layout"), bind_group_layouts: &[&bind_layout],
            push_constant_ranges: &[],
        });

        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label:  Some("blit-pipeline"),
            layout: Some(&layout),
            vertex: wgpu::VertexState {
                module: &shader, entry_point: "vs", buffers: &[],
                compilation_options: Default::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &shader, entry_point: "fs",
                targets: &[Some(wgpu::ColorTargetState {
                    format: surface_format, blend: None,
                    write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive:     wgpu::PrimitiveState::default(),
            depth_stencil: None,
            multisample:   wgpu::MultisampleState::default(),
            multiview:     None,
            cache:         None,
        });

        // Linear — smoother than Nearest at any scale / HiDPI factor.
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label: Some("blit-sampler"),
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });

        Self { pipeline, bind_layout, sampler }
    }

    fn blit(&self, device: &wgpu::Device, queue: &wgpu::Queue,
            bind_group: &wgpu::BindGroup, dst: &wgpu::TextureView) {
        let mut enc = device.create_command_encoder(
            &wgpu::CommandEncoderDescriptor { label: Some("blit-enc") });
        {
            let mut pass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("blit-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: dst, resolve_target: None,
                    ops: wgpu::Operations {
                        load:  wgpu::LoadOp::Clear(wgpu::Color::BLACK),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                ..Default::default()
            });
            pass.set_pipeline(&self.pipeline);
            pass.set_bind_group(0, bind_group, &[]);
            pass.draw(0..3, 0..1);
        }
        queue.submit([enc.finish()]);
    }
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
                           | wgpu::TextureUsages::TEXTURE_BINDING
                           | wgpu::TextureUsages::COPY_SRC,
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
    renderer:        Renderer,
    blit:            BlitPipeline,
    target:          RenderTarget,
    /// Swapped into FrameBuilder each frame and back on render_frame.
    /// Kept here so its Vec allocations survive across frames.
    scene:           Scene,
    /// Cached blit bind group — rebuilt only on window resize.
    blit_bind_group: Option<wgpu::BindGroup>,
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
            surface_format:       None,
            use_cpu,
            antialiasing_support: vello::AaSupport::area_only(),
            num_init_threads:     std::num::NonZeroUsize::new(1),
        }).map_err(|e| RendererError::Init(e.to_string()))?;

        let blit   = BlitPipeline::new(&gpu.device, gpu.surface_format());
        let target = RenderTarget::new(&gpu.device, gpu.width().max(1), gpu.height().max(1));

        Ok(Self { renderer, blit, target, scene: Scene::new(), blit_bind_group: None })
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
            self.blit_bind_group = None;
        }

        self.renderer.render_to_texture(
            &gpu.device, &gpu.queue, &self.scene, &self.target.view,
            &vello::RenderParams {
                base_color:          colors::BACKGROUND,
                width:               w,
                height:              h,
                antialiasing_method: AaConfig::Area,
            },
        ).map_err(|e| RendererError::Render(e.to_string()))?;

        let bind_group = self.blit_bind_group.get_or_insert_with(|| {
            gpu.device.create_bind_group(&wgpu::BindGroupDescriptor {
                label:   Some("blit-bg"),
                layout:  &self.blit.bind_layout,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding:  0,
                        resource: wgpu::BindingResource::TextureView(&self.target.view),
                    },
                    wgpu::BindGroupEntry {
                        binding:  1,
                        resource: wgpu::BindingResource::Sampler(&self.blit.sampler),
                    },
                ],
            })
        });

        let surface_view = texture.texture.create_view(&Default::default());
        self.blit.blit(&gpu.device, &gpu.queue, bind_group, &surface_view);

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

    pub fn fill_rect(&mut self, x: f64, y: f64, w: f64, h: f64, color: Color) {
        self.fill_rounded_rect(x, y, w, h, 0.0, color);
    }

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
                let run      = gr.run();
                let font     = run.font().clone();
                let size     = run.font_size();
                let baseline = gr.baseline() as f64;
                let run_off  = gr.offset()   as f64;

                let transform = Affine::translate(
                    vello::kurbo::Vec2::new(x + run_off, y + baseline)
                );

                let mut glyphs: Vec<(vello::Glyph, f32)> = gr.glyphs()
                    .map(|g| (vello::Glyph { id: g.id as u32, x: g.x, y: -g.y }, g.advance))
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

    /// Push a rectangular clip layer.  All drawing until the matching
    /// `pop_layer` call is clipped to the rectangle `(x, y, x+w, y+h)`.
    pub fn push_layer(&mut self, x: f64, y: f64, w: f64, h: f64) {
        use vello::kurbo::Rect;
        let rect = Rect::new(x, y, x + w, y + h);
        self.scene.push_layer(
            vello::peniko::Mix::Normal,
            1.0,
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
}
