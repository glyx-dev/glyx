//! velox-3d — wgpu-based 3D scene renderer for Canvas3D nodes.
//!
//! Architecture:
//! - Each Canvas3D node gets a per-canvas off-screen RGBA8+depth render target.
//! - The 3D scene is rendered to that target with a Phong-lit pipeline.
//! - After Vello renders the 2D scene to the swapchain, `render()` blits the
//!   3D texture onto the swapchain at the canvas node's screen position,
//!   using LoadOp::Load so Vello's output is preserved.

use std::collections::HashMap;
use std::num::NonZeroU64;
use bytemuck::{Pod, Zeroable};
use glam::{Mat4, Vec3};
use serde::Deserialize;

// ── Public scene description types ────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Scene3D {
    pub background: Option<[f32; 4]>,
    pub camera:     Camera3D,
    pub lights:     Vec<Light3D>,
    pub meshes:     Vec<Mesh3DInstance>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Camera3D {
    pub position: [f32; 3],
    pub target:   [f32; 3],
    #[serde(default = "default_up")]
    pub up:       [f32; 3],
    #[serde(rename = "fovDeg", default = "default_fov")]
    pub fov_deg:  f32,
    #[serde(default = "default_near")]
    pub near:     f32,
    #[serde(default = "default_far")]
    pub far:      f32,
}
fn default_up()   -> [f32; 3] { [0.0, 1.0, 0.0] }
fn default_fov()  -> f32      { 60.0 }
fn default_near() -> f32      { 0.1  }
fn default_far()  -> f32      { 1000.0 }

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Light3D {
    Ambient     { color: [f32; 3], intensity: f32 },
    Directional { direction: [f32; 3], color: [f32; 3], intensity: f32 },
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Mesh3DInstance {
    pub geometry:  Geometry3D,
    /// Column-major 4x4 model matrix (16 f32s).
    pub transform: [f32; 16],
    pub color:     [f32; 4],
}

#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum Geometry3D {
    Box    {},
    Sphere {},
    Plane  {},
    Gltf   { path: String },
}

// ── GPU uniform types (all repr(C), Pod) ──────────────────────────────────────

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct CameraUniform {
    view_proj: [[f32; 4]; 4],
    eye_pos:   [f32; 3],
    _pad:      f32,
}

/// Per-mesh model block. Buffer stride = 256 (wgpu min uniform alignment).
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct ModelBlock {
    model:      [[f32; 4]; 4],   // 64 B
    normal_mat: [[f32; 4]; 4],   // 64 B  → 128 B total, padded to MESH_STRIDE
}
const MESH_STRIDE: u64 = 256;

/// Per-mesh material block.  Stride in the buffer is MAT_STRIDE (256 B) so that
/// dynamic offsets are aligned; the struct itself is only 16 B — wgpu binds a
/// 16 B window at each aligned offset.
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct MaterialBlock {
    color: [f32; 4],
}
const MAT_STRIDE: u64 = 256;

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct DirLightUniform {
    direction: [f32; 3],
    intensity: f32,
    color:     [f32; 3],
    _pad:      f32,
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct AmbientUniform {
    color:     [f32; 3],
    intensity: f32,
}

#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct OverlayRect {
    x: f32, y: f32, w: f32, h: f32,
    sw: f32, sh: f32,
    _p0: f32, _p1: f32,
}

const MAX_MESHES: usize = 64;

// ── WGSL shaders ──────────────────────────────────────────────────────────────

const SHADER_3D: &str = r#"
struct Camera {
    view_proj: mat4x4<f32>,
    eye_pos:   vec3<f32>,
    _pad:      f32,
}
struct ModelBlock {
    model:      mat4x4<f32>,
    normal_mat: mat4x4<f32>,
}
struct Material  { color: vec4<f32> }
struct DirLight  { direction: vec3<f32>, intensity: f32, color: vec3<f32>, _pad: f32 }
struct AmbLight  { color: vec3<f32>, intensity: f32 }

@group(0) @binding(0) var<uniform> cam:  Camera;
@group(1) @binding(0) var<uniform> mblk: ModelBlock;
@group(1) @binding(1) var<uniform> mat:  Material;
@group(2) @binding(0) var<uniform> dirl: DirLight;
@group(2) @binding(1) var<uniform> ambl: AmbLight;

struct VIn  { @location(0) pos: vec3<f32>, @location(1) nor: vec3<f32> };
struct VOut { @builtin(position) clip: vec4<f32>,
              @location(0) wpos: vec3<f32>, @location(1) wnor: vec3<f32> };

@vertex fn vs(vin: VIn) -> VOut {
    let wp4 = mblk.model * vec4<f32>(vin.pos, 1.0);
    var out: VOut;
    out.clip = cam.view_proj * wp4;
    out.wpos = wp4.xyz;
    out.wnor = normalize((mblk.normal_mat * vec4<f32>(vin.nor, 0.0)).xyz);
    return out;
}

@fragment fn fs(v: VOut) -> @location(0) vec4<f32> {
    let N    = normalize(v.wnor);
    let L    = normalize(-dirl.direction);
    let diff = max(dot(N, L), 0.0);
    let V    = normalize(cam.eye_pos - v.wpos);
    let R    = reflect(-L, N);
    let spec = pow(max(dot(V, R), 0.0), 32.0) * 0.25;
    let base = mat.color.rgb;
    let amb  = ambl.color * ambl.intensity;
    let lit  = dirl.color * dirl.intensity * (diff + spec);
    return vec4<f32>((amb + lit) * base, mat.color.a);
}
"#;

const SHADER_OVERLAY: &str = r#"
struct Rect { x: f32, y: f32, w: f32, h: f32, sw: f32, sh: f32, _p0: f32, _p1: f32 };
@group(0) @binding(0) var t: texture_2d<f32>;
@group(0) @binding(1) var s: sampler;
@group(0) @binding(2) var<uniform> r: Rect;

struct VOut { @builtin(position) pos: vec4<f32>, @location(0) uv: vec2<f32> };

@vertex fn vs(@builtin(vertex_index) vi: u32) -> VOut {
    // Triangle-strip order: TL, TR, BL, BR — no dynamic array indexing (SM5 compat).
    let px = select(r.x, r.x + r.w, (vi & 1u) != 0u);
    let py = select(r.y, r.y + r.h, (vi & 2u) != 0u);
    let u  = select(0.0, 1.0,       (vi & 1u) != 0u);
    let v  = select(0.0, 1.0,       (vi & 2u) != 0u);
    let ndc = vec2<f32>(px / r.sw * 2.0 - 1.0, 1.0 - py / r.sh * 2.0);
    var o: VOut; o.pos = vec4<f32>(ndc, 0.0, 1.0); o.uv = vec2<f32>(u, v); return o;
}

@fragment fn fs(v: VOut) -> @location(0) vec4<f32> {
    return textureSample(t, s, v.uv);
}
"#;

// ── Geometry generation ────────────────────────────────────────────────────────

struct Geometry {
    vbuf:      wgpu::Buffer,
    ibuf:      wgpu::Buffer,
    idx_count: u32,
}

fn upload_geometry(device: &wgpu::Device, verts: &[f32], indices: &[u16]) -> Geometry {
    use wgpu::util::DeviceExt;
    let vbuf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some("geom-verts"), usage: wgpu::BufferUsages::VERTEX,
        contents: bytemuck::cast_slice(verts),
    });
    let ibuf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some("geom-idx"), usage: wgpu::BufferUsages::INDEX,
        contents: bytemuck::cast_slice(indices),
    });
    Geometry { vbuf, ibuf, idx_count: indices.len() as u32 }
}

fn gen_box() -> (Vec<f32>, Vec<u16>) {
    let mut v: Vec<f32> = Vec::new();
    let mut idx: Vec<u16> = Vec::new();
    // [normal, 4 corners] per face
    // Corners ordered CCW when viewed from outside (so (v1-v0)×(v2-v0) points outward).
    let faces: &[([f32; 3], [[f32; 3]; 4])] = &[
        ([ 1.0, 0.0, 0.0], [[ 0.5,-0.5,-0.5],[ 0.5, 0.5,-0.5],[ 0.5, 0.5, 0.5],[ 0.5,-0.5, 0.5]]),
        ([-1.0, 0.0, 0.0], [[-0.5,-0.5, 0.5],[-0.5, 0.5, 0.5],[-0.5, 0.5,-0.5],[-0.5,-0.5,-0.5]]),
        ([ 0.0, 1.0, 0.0], [[ 0.5, 0.5,-0.5],[-0.5, 0.5,-0.5],[-0.5, 0.5, 0.5],[ 0.5, 0.5, 0.5]]),
        ([ 0.0,-1.0, 0.0], [[ 0.5,-0.5, 0.5],[-0.5,-0.5, 0.5],[-0.5,-0.5,-0.5],[ 0.5,-0.5,-0.5]]),
        ([ 0.0, 0.0, 1.0], [[-0.5,-0.5, 0.5],[ 0.5,-0.5, 0.5],[ 0.5, 0.5, 0.5],[-0.5, 0.5, 0.5]]),
        ([ 0.0, 0.0,-1.0], [[-0.5,-0.5,-0.5],[-0.5, 0.5,-0.5],[ 0.5, 0.5,-0.5],[ 0.5,-0.5,-0.5]]),
    ];
    for (n, corners) in faces {
        let base = (v.len() / 6) as u16;
        for c in corners { v.extend_from_slice(c); v.extend_from_slice(n); }
        idx.extend_from_slice(&[base, base+1, base+2, base, base+2, base+3]);
    }
    (v, idx)
}

fn gen_sphere(stacks: u32, slices: u32) -> (Vec<f32>, Vec<u16>) {
    let mut v: Vec<f32> = Vec::new();
    let mut idx: Vec<u16> = Vec::new();
    use std::f32::consts::PI;
    for i in 0..=stacks {
        let phi = PI * i as f32 / stacks as f32;
        let (sp, cp) = (phi.sin(), phi.cos());
        for j in 0..=slices {
            let theta = 2.0 * PI * j as f32 / slices as f32;
            let (st, ct) = (theta.sin(), theta.cos());
            let (x, y, z) = (sp * ct, cp, sp * st);
            v.extend_from_slice(&[x * 0.5, y * 0.5, z * 0.5, x, y, z]);
        }
    }
    for i in 0..stacks {
        for j in 0..slices {
            let a = (i * (slices + 1) + j)       as u16;
            let b = (i * (slices + 1) + j + 1)   as u16;
            let c = ((i+1)*(slices+1) + j)        as u16;
            let d = ((i+1)*(slices+1) + j + 1)    as u16;
            idx.extend_from_slice(&[a, c, b, b, c, d]);
        }
    }
    (v, idx)
}

fn gen_plane() -> (Vec<f32>, Vec<u16>) {
    let v: Vec<f32> = vec![
        -0.5, 0.0,  0.5,  0.0, 1.0, 0.0,
         0.5, 0.0,  0.5,  0.0, 1.0, 0.0,
         0.5, 0.0, -0.5,  0.0, 1.0, 0.0,
        -0.5, 0.0, -0.5,  0.0, 1.0, 0.0,
    ];
    (v, vec![0, 1, 2, 0, 2, 3])
}

// ── Per-canvas render target ───────────────────────────────────────────────────

struct Canvas3DTarget {
    color_view: wgpu::TextureView,
    depth_view: wgpu::TextureView,
    width:  u32,
    height: u32,
    // Keep textures alive
    _color_tex: wgpu::Texture,
    _depth_tex: wgpu::Texture,
}

impl Canvas3DTarget {
    fn new(device: &wgpu::Device, w: u32, h: u32) -> Self {
        let color_tex = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("c3d-color"),
            size:  wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
            mip_level_count: 1, sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format:    wgpu::TextureFormat::Rgba8Unorm,
            usage:     wgpu::TextureUsages::RENDER_ATTACHMENT | wgpu::TextureUsages::TEXTURE_BINDING,
            view_formats: &[],
        });
        let color_view = color_tex.create_view(&Default::default());
        let depth_tex = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("c3d-depth"),
            size:  wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
            mip_level_count: 1, sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format:    wgpu::TextureFormat::Depth32Float,
            // TRANSIENT: depth stays in tile memory on iGPU (Apple Silicon,
            // Intel iGPU, etc.) — never written to main memory.  Requires StoreOp::Discard.
            usage:     wgpu::TextureUsages::RENDER_ATTACHMENT
                     | wgpu::TextureUsages::TRANSIENT,
            view_formats: &[],
        });
        let depth_view = depth_tex.create_view(&Default::default());
        Self { color_view, depth_view, width: w, height: h, _color_tex: color_tex, _depth_tex: depth_tex }
    }
}

// ── Renderer3D ─────────────────────────────────────────────────────────────────

pub struct Renderer3D {
    pipeline_3d:  wgpu::RenderPipeline,
    camera_bgl:   wgpu::BindGroupLayout,
    per_obj_bgl:  wgpu::BindGroupLayout,
    lighting_bgl: wgpu::BindGroupLayout,
    overlay_bgl:  wgpu::BindGroupLayout,

    camera_buf:      wgpu::Buffer,
    mesh_buf:        wgpu::Buffer,
    mat_buf:         wgpu::Buffer,
    dir_buf:         wgpu::Buffer,
    amb_buf:         wgpu::Buffer,
    overlay_rect_buf: wgpu::Buffer,

    camera_bg:    wgpu::BindGroup,
    lighting_bg:  wgpu::BindGroup,
    per_obj_bgs:  Vec<wgpu::BindGroup>,

    box_geom:    Geometry,
    sphere_geom: Geometry,
    plane_geom:  Geometry,
    gltf_cache:  HashMap<String, Geometry>,

    targets:  HashMap<u32, Canvas3DTarget>,

    overlay_pipeline: wgpu::RenderPipeline,
    overlay_sampler:  wgpu::Sampler,
}

impl Renderer3D {
    pub fn new(device: &wgpu::Device, surface_format: wgpu::TextureFormat) -> Self {
        use wgpu::util::DeviceExt;

        let sm3d = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label:  Some("3d"),
            source: wgpu::ShaderSource::Wgsl(SHADER_3D.into()),
        });
        let smov = device.create_shader_module(wgpu::ShaderModuleDescriptor {
            label:  Some("overlay"),
            source: wgpu::ShaderSource::Wgsl(SHADER_OVERLAY.into()),
        });

        let camera_bgl = bgl_uniform(device, "cam-bgl",
            wgpu::ShaderStages::VERTEX_FRAGMENT,
            std::mem::size_of::<CameraUniform>() as u64);

        let per_obj_bgl = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("per-obj-bgl"),
            entries: &[
                bgl_entry(0, wgpu::ShaderStages::VERTEX,   std::mem::size_of::<ModelBlock>()    as u64),
                bgl_entry(1, wgpu::ShaderStages::FRAGMENT, std::mem::size_of::<MaterialBlock>() as u64),
            ],
        });
        let lighting_bgl = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("light-bgl"),
            entries: &[
                bgl_entry(0, wgpu::ShaderStages::FRAGMENT, std::mem::size_of::<DirLightUniform>() as u64),
                bgl_entry(1, wgpu::ShaderStages::FRAGMENT, std::mem::size_of::<AmbientUniform>()  as u64),
            ],
        });
        let overlay_bgl = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("ov-bgl"),
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
                bgl_entry(2, wgpu::ShaderStages::VERTEX, std::mem::size_of::<OverlayRect>() as u64),
            ],
        });

        let vbl_attrs = wgpu::vertex_attr_array![0 => Float32x3, 1 => Float32x3];
        let vbl = wgpu::VertexBufferLayout {
            array_stride: 24,
            step_mode:    wgpu::VertexStepMode::Vertex,
            attributes:   &vbl_attrs,
        };

        let pipeline_3d = {
            let layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("3d-pl"),
                bind_group_layouts: &[Some(&camera_bgl), Some(&per_obj_bgl), Some(&lighting_bgl)],
                ..Default::default()
            });
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some("3d-pipe"), layout: Some(&layout),
                vertex: wgpu::VertexState {
                    module: &sm3d, entry_point: Some("vs"), buffers: &[vbl],
                    compilation_options: Default::default(),
                },
                fragment: Some(wgpu::FragmentState {
                    module: &sm3d, entry_point: Some("fs"),
                    targets: &[Some(wgpu::ColorTargetState {
                        format: wgpu::TextureFormat::Rgba8Unorm,
                        blend: None, write_mask: wgpu::ColorWrites::ALL,
                    })],
                    compilation_options: Default::default(),
                }),
                primitive: wgpu::PrimitiveState {
                    topology:   wgpu::PrimitiveTopology::TriangleList,
                    front_face: wgpu::FrontFace::Ccw,
                    cull_mode:  Some(wgpu::Face::Back),
                    ..Default::default()
                },
                depth_stencil: Some(wgpu::DepthStencilState {
                    format:              wgpu::TextureFormat::Depth32Float,
                    depth_write_enabled: Some(true),
                    depth_compare:       Some(wgpu::CompareFunction::Less),
                    stencil: Default::default(), bias: Default::default(),
                }),
                multisample:   wgpu::MultisampleState::default(),
                multiview_mask: None, cache: None,
            })
        };

        let overlay_pipeline = {
            let layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("ov-pl"),
                bind_group_layouts: &[Some(&overlay_bgl)],
                ..Default::default()
            });
            device.create_render_pipeline(&wgpu::RenderPipelineDescriptor {
                label: Some("ov-pipe"), layout: Some(&layout),
                vertex: wgpu::VertexState {
                    module: &smov, entry_point: Some("vs"), buffers: &[],
                    compilation_options: Default::default(),
                },
                fragment: Some(wgpu::FragmentState {
                    module: &smov, entry_point: Some("fs"),
                    targets: &[Some(wgpu::ColorTargetState {
                        format: surface_format,
                        blend:  Some(wgpu::BlendState::ALPHA_BLENDING),
                        write_mask: wgpu::ColorWrites::ALL,
                    })],
                    compilation_options: Default::default(),
                }),
                primitive:    wgpu::PrimitiveState {
                    topology: wgpu::PrimitiveTopology::TriangleStrip,
                    ..Default::default()
                },
                depth_stencil: None,
                multisample:   wgpu::MultisampleState::default(),
                multiview_mask: None, cache: None,
            })
        };

        // Uniform buffers
        let camera_buf     = ubuf(device, "cam",      std::mem::size_of::<CameraUniform>()  as u64);
        let mesh_buf       = ubuf(device, "mesh",     MAX_MESHES as u64 * MESH_STRIDE);
        let mat_buf        = ubuf(device, "mat",      MAX_MESHES as u64 * MAT_STRIDE);
        let dir_buf        = ubuf(device, "dir",      std::mem::size_of::<DirLightUniform>() as u64);
        let amb_buf        = ubuf(device, "amb",      std::mem::size_of::<AmbientUniform>()  as u64);
        let overlay_rect_buf = ubuf(device, "ov-rect", std::mem::size_of::<OverlayRect>() as u64);

        let camera_bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("cam-bg"), layout: &camera_bgl,
            entries: &[wgpu::BindGroupEntry { binding: 0, resource: camera_buf.as_entire_binding() }],
        });
        let lighting_bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("light-bg"), layout: &lighting_bgl,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: dir_buf.as_entire_binding() },
                wgpu::BindGroupEntry { binding: 1, resource: amb_buf.as_entire_binding() },
            ],
        });

        // Pre-build per-object bind groups (one per mesh slot, each reads a fixed slice
        // of the mesh/material buffers at offset i*STRIDE).
        let per_obj_bgs: Vec<wgpu::BindGroup> = (0..MAX_MESHES).map(|i| {
            device.create_bind_group(&wgpu::BindGroupDescriptor {
                label: Some(&format!("obj-{i}")), layout: &per_obj_bgl,
                entries: &[
                    wgpu::BindGroupEntry {
                        binding: 0,
                        resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding {
                            buffer: &mesh_buf,
                            offset: i as u64 * MESH_STRIDE,
                            size:   NonZeroU64::new(std::mem::size_of::<ModelBlock>() as u64),
                        }),
                    },
                    wgpu::BindGroupEntry {
                        binding: 1,
                        resource: wgpu::BindingResource::Buffer(wgpu::BufferBinding {
                            buffer: &mat_buf,
                            offset: i as u64 * MAT_STRIDE,
                            size:   NonZeroU64::new(std::mem::size_of::<MaterialBlock>() as u64),
                        }),
                    },
                ],
            })
        }).collect();

        let (bv, bi) = gen_box();
        let (sv, si) = gen_sphere(20, 20);
        let (pv, pi) = gen_plane();

        let overlay_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label:      Some("ov-sampler"),
            mag_filter: wgpu::FilterMode::Linear,
            min_filter: wgpu::FilterMode::Linear,
            ..Default::default()
        });

        Self {
            pipeline_3d,
            camera_bgl, per_obj_bgl, lighting_bgl, overlay_bgl,
            camera_buf, mesh_buf, mat_buf, dir_buf, amb_buf, overlay_rect_buf,
            camera_bg, lighting_bg, per_obj_bgs,
            box_geom:    upload_geometry(device, &bv, &bi),
            sphere_geom: upload_geometry(device, &sv, &si),
            plane_geom:  upload_geometry(device, &pv, &pi),
            gltf_cache:  HashMap::new(),
            targets:     HashMap::new(),
            overlay_pipeline,
            overlay_sampler,
        }
    }

    /// Render the 3D scene for `canvas_id` onto `surface_view` at pixel rect
    /// `(x, y, w, h)`.  The surface already has Vello's 2D content; this
    /// pass uses `LoadOp::Load` to preserve it and blits the 3D scene on top.
    pub fn render(
        &mut self,
        device: &wgpu::Device,
        queue:  &wgpu::Queue,
        canvas_id: u32,
        scene:  &Scene3D,
        x: f32, y: f32, w: f32, h: f32,
        surface_view: &wgpu::TextureView,
        surface_w:    f32,
        surface_h:    f32,
    ) {
        let tw = (w as u32).max(1);
        let th = (h as u32).max(1);

        // Resize target if needed.
        let needs_resize = self.targets.get(&canvas_id)
            .map(|t| t.width != tw || t.height != th).unwrap_or(true);
        if needs_resize {
            self.targets.insert(canvas_id, Canvas3DTarget::new(device, tw, th));
        }

        // Camera.
        let cam  = &scene.camera;
        let asp  = tw as f32 / th as f32;
        let proj = Mat4::perspective_rh(cam.fov_deg.to_radians(), asp, cam.near, cam.far);
        let view = Mat4::look_at_rh(Vec3::from(cam.position), Vec3::from(cam.target), Vec3::from(cam.up));
        queue.write_buffer(&self.camera_buf, 0, bytemuck::bytes_of(&CameraUniform {
            view_proj: (proj * view).to_cols_array_2d(),
            eye_pos:   cam.position,
            _pad:      0.0,
        }));

        // Lighting.
        let mut dir_u = DirLightUniform { direction: [0.0,-1.0,0.0], intensity: 0.8, color: [1.0,1.0,1.0], _pad: 0.0 };
        let mut amb_u = AmbientUniform  { color: [1.0,1.0,1.0], intensity: 0.15 };
        for l in &scene.lights {
            match l {
                Light3D::Ambient     { color, intensity }            => { amb_u.color = *color; amb_u.intensity = *intensity; }
                Light3D::Directional { direction, color, intensity } => { dir_u.direction = *direction; dir_u.color = *color; dir_u.intensity = *intensity; }
            }
        }
        queue.write_buffer(&self.dir_buf, 0, bytemuck::bytes_of(&dir_u));
        queue.write_buffer(&self.amb_buf, 0, bytemuck::bytes_of(&amb_u));

        // Per-mesh uniforms.
        let n = scene.meshes.len().min(MAX_MESHES);
        for (i, mesh) in scene.meshes.iter().take(n).enumerate() {
            let model = Mat4::from_cols_array(&mesh.transform);
            queue.write_buffer(&self.mesh_buf, i as u64 * MESH_STRIDE, bytemuck::bytes_of(&ModelBlock {
                model:      model.to_cols_array_2d(),
                normal_mat: model.inverse().transpose().to_cols_array_2d(),
            }));
            queue.write_buffer(&self.mat_buf, i as u64 * MAT_STRIDE, bytemuck::bytes_of(&MaterialBlock {
                color: mesh.color,
            }));
        }

        // Overlay rect.
        queue.write_buffer(&self.overlay_rect_buf, 0, bytemuck::bytes_of(&OverlayRect {
            x, y, w, h, sw: surface_w, sh: surface_h, _p0: 0., _p1: 0.,
        }));

        let target = self.targets.get(&canvas_id).unwrap();

        // Overlay bind group references this canvas's color view.
        let ov_bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label:  Some("ov-bg"), layout: &self.overlay_bgl,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&target.color_view) },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::Sampler(&self.overlay_sampler) },
                wgpu::BindGroupEntry { binding: 2, resource: self.overlay_rect_buf.as_entire_binding() },
            ],
        });

        let mut enc = device.create_command_encoder(&wgpu::CommandEncoderDescriptor { label: Some("3d-enc") });

        // 3D render pass → off-screen target.
        {
            let bg = scene.background.unwrap_or([0.05, 0.05, 0.1, 1.0]);
            let mut pass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("3d-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &target.color_view, resolve_target: None, depth_slice: None,
                    ops: wgpu::Operations {
                        load:  wgpu::LoadOp::Clear(wgpu::Color { r: bg[0] as f64, g: bg[1] as f64, b: bg[2] as f64, a: bg[3] as f64 }),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: Some(wgpu::RenderPassDepthStencilAttachment {
                    view: &target.depth_view,
                    // Discard: pairs with TRANSIENT_ATTACHMENT — depth never written to main memory.
                    depth_ops:   Some(wgpu::Operations { load: wgpu::LoadOp::Clear(1.0), store: wgpu::StoreOp::Discard }),
                    stencil_ops: None,
                }),
                ..Default::default()
            });
            pass.set_pipeline(&self.pipeline_3d);
            pass.set_bind_group(0, &self.camera_bg,  &[]);
            pass.set_bind_group(2, &self.lighting_bg, &[]);
            for (i, mesh) in scene.meshes.iter().take(n).enumerate() {
                pass.set_bind_group(1, &self.per_obj_bgs[i], &[]);
                let geom = self.geom_for(&mesh.geometry);
                pass.set_vertex_buffer(0, geom.vbuf.slice(..));
                pass.set_index_buffer(geom.ibuf.slice(..), wgpu::IndexFormat::Uint16);
                pass.draw_indexed(0..geom.idx_count, 0, 0..1);
            }
        }

        // Overlay blit pass → surface (LoadOp::Load preserves Vello).
        {
            let mut pass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("ov-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: surface_view, resolve_target: None, depth_slice: None,
                    ops: wgpu::Operations { load: wgpu::LoadOp::Load, store: wgpu::StoreOp::Store },
                })],
                depth_stencil_attachment: None, ..Default::default()
            });
            pass.set_pipeline(&self.overlay_pipeline);
            pass.set_bind_group(0, &ov_bg, &[]);
            pass.draw(0..4, 0..1);
        }

        queue.submit([enc.finish()]);
    }

    fn geom_for(&self, g: &Geometry3D) -> &Geometry {
        match g {
            Geometry3D::Box    {}     => &self.box_geom,
            Geometry3D::Sphere {}     => &self.sphere_geom,
            Geometry3D::Plane  {}     => &self.plane_geom,
            Geometry3D::Gltf { path } => self.gltf_cache.get(path).unwrap_or(&self.box_geom),
        }
    }

    /// Load a GLTF/GLB file and cache its first mesh's geometry.
    pub fn load_gltf(&mut self, device: &wgpu::Device, path: &str) -> Result<(), String> {
        if self.gltf_cache.contains_key(path) { return Ok(()); }
        let (doc, buffers, _) = gltf::import(path).map_err(|e| e.to_string())?;
        let mesh = doc.meshes().next().ok_or("no mesh")?;
        let prim = mesh.primitives().next().ok_or("no primitive")?;
        let reader = prim.reader(|b| Some(&buffers[b.index()]));
        let pos: Vec<[f32; 3]>  = reader.read_positions().ok_or("no positions")?.collect();
        let nor: Vec<[f32; 3]>  = reader.read_normals().map(|r| r.collect()).unwrap_or_default();
        let mut verts: Vec<f32> = Vec::with_capacity(pos.len() * 6);
        for (i, p) in pos.iter().enumerate() {
            verts.extend_from_slice(p);
            verts.extend_from_slice(nor.get(i).unwrap_or(&[0.0, 1.0, 0.0]));
        }
        let indices: Vec<u16> = match reader.read_indices() {
            Some(r) => r.into_u32().map(|i| i as u16).collect(),
            None    => (0..pos.len() as u16).collect(),
        };
        self.gltf_cache.insert(path.to_string(), upload_geometry(device, &verts, &indices));
        Ok(())
    }

    pub fn remove_canvas(&mut self, id: u32) { self.targets.remove(&id); }
}

// ── wgpu helpers ──────────────────────────────────────────────────────────────

fn ubuf(device: &wgpu::Device, label: &str, size: u64) -> wgpu::Buffer {
    device.create_buffer(&wgpu::BufferDescriptor {
        label: Some(label), mapped_at_creation: false, size,
        usage: wgpu::BufferUsages::UNIFORM | wgpu::BufferUsages::COPY_DST,
    })
}

fn bgl_entry(binding: u32, vis: wgpu::ShaderStages, size: u64) -> wgpu::BindGroupLayoutEntry {
    wgpu::BindGroupLayoutEntry {
        binding, visibility: vis,
        ty: wgpu::BindingType::Buffer {
            ty: wgpu::BufferBindingType::Uniform,
            has_dynamic_offset: false,
            min_binding_size: NonZeroU64::new(size),
        },
        count: None,
    }
}

fn bgl_uniform(device: &wgpu::Device, label: &str, vis: wgpu::ShaderStages, size: u64) -> wgpu::BindGroupLayout {
    device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
        label: Some(label),
        entries: &[bgl_entry(0, vis, size)],
    })
}
