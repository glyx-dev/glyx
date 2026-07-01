//! Cached fullscreen blit helper — shared between TinySkia and FemtoVG backends.
//!
//! `wgpu::util::TextureBlitter::copy()` creates a new `BindGroup` on **every
//! call** (confirmed in wgpu 29 texture_blitter.rs:183).  At 60 fps that
//! produces 43 200 GPU descriptor allocations per 12 minutes — a dominant
//! source of steady RSS growth.  `CachedBlit` creates the bind group **once**
//! per source texture and reuses it every frame.

/// WGSL shader — identical to wgpu's own `blit.wgsl` so pixel output is the same.
const BLIT_WGSL: &str = "
struct VertexOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) tex_coords: vec2<f32>,
}
@vertex
fn vs_main(@builtin(vertex_index) vi: u32) -> VertexOutput {
    var out: VertexOutput;
    out.tex_coords = vec2<f32>(f32((vi << 1u) & 2u), f32(vi & 2u));
    out.position   = vec4<f32>(out.tex_coords * 2.0 - 1.0, 0.0, 1.0);
    out.tex_coords.y = 1.0 - out.tex_coords.y;
    return out;
}
@group(0) @binding(0) var src_tex: texture_2d<f32>;
@group(0) @binding(1) var src_sam: sampler;
@fragment
fn fs_main(v: VertexOutput) -> @location(0) vec4<f32> {
    return textureSample(src_tex, src_sam, v.tex_coords);
}
";

pub struct CachedBlit {
    pipeline:   wgpu::RenderPipeline,
    bgl:        wgpu::BindGroupLayout,
    sampler:    wgpu::Sampler,
    /// Bind group cached per source texture — recreated only on resize.
    bind_group: Option<wgpu::BindGroup>,
}

impl CachedBlit {
    pub fn new(device: &wgpu::Device, format: wgpu::TextureFormat) -> Self {
        let sm = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label:  Some("cached-blit-shader"),
            source: wgpu::ShaderSource::Wgsl(BLIT_WGSL.into()),
        });
        let sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label:      Some("cached-blit-sampler"),
            mag_filter: wgpu::FilterMode::Nearest,
            min_filter: wgpu::FilterMode::Nearest,
            ..Default::default()
        });
        let bgl = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("cached-blit-bgl"),
            entries: &[
                wgpu::BindGroupLayoutEntry {
                    binding: 0, visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Texture {
                        sample_type:    wgpu::TextureSampleType::Float { filterable: false },
                        view_dimension: wgpu::TextureViewDimension::D2,
                        multisampled:   false,
                    },
                    count: None,
                },
                wgpu::BindGroupLayoutEntry {
                    binding: 1, visibility: wgpu::ShaderStages::FRAGMENT,
                    ty: wgpu::BindingType::Sampler(wgpu::SamplerBindingType::NonFiltering),
                    count: None,
                },
            ],
        });
        let layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
            label: Some("cached-blit-pl"), bind_group_layouts: &[Some(&bgl)],
            ..Default::default()
        });
        let pipeline = device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
            label: Some("cached-blit-pipe"), layout: Some(&layout),
            vertex: wgpu::VertexState {
                module: &sm, entry_point: Some("vs_main"), buffers: &[],
                compilation_options: Default::default(),
            },
            fragment: Some(wgpu::FragmentState {
                module: &sm, entry_point: Some("fs_main"),
                targets: &[Some(wgpu::ColorTargetState {
                    format, blend: None, write_mask: wgpu::ColorWrites::ALL,
                })],
                compilation_options: Default::default(),
            }),
            primitive: wgpu::PrimitiveState {
                topology: wgpu::PrimitiveTopology::TriangleList,
                ..Default::default()
            },
            depth_stencil: None, multisample: wgpu::MultisampleState::default(),
            multiview_mask: None, cache: None,
        });
        Self { pipeline, bgl, sampler, bind_group: None }
    }

    /// (Re-)create the cached bind group for `source`.
    /// Call once after init and again whenever the source texture is replaced (resize).
    pub fn set_source(&mut self, device: &wgpu::Device, source: &wgpu::TextureView) {
        self.bind_group = Some(device.create_bind_group(&wgpu::BindGroupDescriptor {
            label:  Some("cached-blit-bg"),
            layout: &self.bgl,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(source) },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::Sampler(&self.sampler) },
            ],
        }));
    }

    /// Blit from the cached source to `target`. No GPU allocation on this path.
    pub fn copy(&self, encoder: &mut wgpu::CommandEncoder, target: &wgpu::TextureView) {
        let bg = self.bind_group.as_ref().expect("CachedBlit: call set_source before copy");
        let mut pass = encoder.begin_render_pass(&wgpu::RenderPassDescriptor {
            label: Some("cached-blit-pass"),
            color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                view: target, resolve_target: None, depth_slice: None,
                ops: wgpu::Operations { load: wgpu::LoadOp::Load, store: wgpu::StoreOp::Store },
            })],
            depth_stencil_attachment: None, ..Default::default()
        });
        pass.set_pipeline(&self.pipeline);
        pass.set_bind_group(0, bg, &[]);
        pass.draw(0..3, 0..1);
    }
}
