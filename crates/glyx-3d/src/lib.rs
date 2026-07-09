//! glyx-3d — wgpu-based 3D scene renderer for Canvas3D nodes.
//!
//! Architecture:
//! - Each Canvas3D node gets a per-canvas off-screen RGBA8+depth render target.
//! - The 3D scene is rendered to that target with a Phong-lit pipeline.
//! - After Vello renders the 2D scene to the swapchain, `render()` blits the
//!   3D texture onto the swapchain at the canvas node's screen position,
//!   using LoadOp::Load so Vello's output is preserved.

use std::collections::HashMap;
use lru::LruCache;
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
    /// Omnidirectional light at a point. `range` = 0 means no distance falloff.
    Point {
        position: [f32; 3], color: [f32; 3], intensity: f32,
        #[serde(default)] range: f32,
    },
    /// Cone light. `inner_deg`/`outer_deg` are the half-angles (degrees) of the
    /// full-bright inner cone and the falloff outer cone.
    Spot {
        position: [f32; 3], direction: [f32; 3], color: [f32; 3], intensity: f32,
        #[serde(default)] range: f32,
        #[serde(rename = "innerDeg", default = "default_inner")] inner_deg: f32,
        #[serde(rename = "outerDeg", default = "default_outer")] outer_deg: f32,
    },
}
fn default_inner() -> f32 { 15.0 }
fn default_outer() -> f32 { 25.0 }

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

const MAX_LIGHTS: usize = 8;

/// One GPU light (std140-friendly, 64 B). `pos_kind.w` selects the type:
/// 0 = directional, 1 = point, 2 = spot.
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct GpuLight {
    pos_kind:    [f32; 4],  // xyz position, w kind
    dir_int:     [f32; 4],  // xyz direction, w intensity
    color_range: [f32; 4],  // xyz color, w range (0 = infinite)
    cone:        [f32; 4],  // x inner-cos, y outer-cos, zw pad
}

/// Scene lighting block: ambient + a bounded array of dynamic lights.
#[repr(C)]
#[derive(Clone, Copy, Pod, Zeroable)]
struct LightsUniform {
    ambient: [f32; 4],            // xyz color, w intensity
    count:   [u32; 4],            // x = active light count
    lights:  [GpuLight; MAX_LIGHTS],
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
struct GpuLight {
    pos_kind:    vec4<f32>,
    dir_int:     vec4<f32>,
    color_range: vec4<f32>,
    cone:        vec4<f32>,
}
struct Lights {
    ambient: vec4<f32>,
    count:   vec4<u32>,
    lights:  array<GpuLight, 8>,
}

@group(0) @binding(0) var<uniform> cam:  Camera;
@group(1) @binding(0) var<uniform> mblk: ModelBlock;
@group(1) @binding(1) var<uniform> mat:  Material;
@group(2) @binding(0) var<uniform> L:    Lights;
@group(3) @binding(0) var base_tex:  texture_2d<f32>;
@group(3) @binding(1) var base_samp: sampler;

struct VIn  { @location(0) pos: vec3<f32>, @location(1) nor: vec3<f32>, @location(2) uv: vec2<f32> };
struct VOut { @builtin(position) clip: vec4<f32>,
              @location(0) wpos: vec3<f32>, @location(1) wnor: vec3<f32>, @location(2) uv: vec2<f32> };

@vertex fn vs(vin: VIn) -> VOut {
    let wp4 = mblk.model * vec4<f32>(vin.pos, 1.0);
    var out: VOut;
    out.clip = cam.view_proj * wp4;
    out.wpos = wp4.xyz;
    out.wnor = normalize((mblk.normal_mat * vec4<f32>(vin.nor, 0.0)).xyz);
    out.uv   = vin.uv;
    return out;
}

@fragment fn fs(v: VOut) -> @location(0) vec4<f32> {
    let N = normalize(v.wnor);
    let V = normalize(cam.eye_pos - v.wpos);

    var lit = vec3<f32>(0.0, 0.0, 0.0);
    for (var i: u32 = 0u; i < 8u; i = i + 1u) {
        if (i >= L.count.x) { break; }
        let lt   = L.lights[i];
        let kind = lt.pos_kind.w;
        var Ldir  = vec3<f32>(0.0, 1.0, 0.0);
        var atten = 1.0;
        if (kind < 0.5) {
            // Directional.
            Ldir = normalize(-lt.dir_int.xyz);
        } else {
            // Point or spot — direction toward the light + distance falloff.
            let to_light = lt.pos_kind.xyz - v.wpos;
            let dist     = length(to_light);
            Ldir = to_light / max(dist, 0.0001);
            let range = lt.color_range.w;
            if (range > 0.0) {
                let a = clamp(1.0 - dist / range, 0.0, 1.0);
                atten = a * a;
            }
            if (kind > 1.5) {
                // Spot cone falloff (inner→outer cosine).
                let cd = dot(-Ldir, normalize(lt.dir_int.xyz));
                let t  = clamp((cd - lt.cone.y) / max(lt.cone.x - lt.cone.y, 0.0001), 0.0, 1.0);
                atten = atten * t;
            }
        }
        let diff = max(dot(N, Ldir), 0.0);
        let R    = reflect(-Ldir, N);
        let spec = pow(max(dot(V, R), 0.0), 32.0) * 0.25;
        lit = lit + lt.color_range.xyz * lt.dir_int.w * (diff + spec) * atten;
    }

    // Base color = texture × material color. Untextured meshes bind a 1×1 white
    // texture, so the sample is (1,1,1,1) and the result is just `mat.color`.
    let tex  = textureSample(base_tex, base_samp, v.uv);
    let base = tex.rgb * mat.color.rgb;
    let amb  = L.ambient.xyz * L.ambient.w;
    return vec4<f32>((amb + lit) * base, tex.a * mat.color.a);
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

/// One drawable piece of a model: geometry + optional base-color texture bind
/// group (group 3). `tex_bg = None` means "use the renderer's shared 1×1 white
/// texture" — keeps untextured primitives from each allocating a duplicate.
struct Primitive {
    geom:   Geometry,
    tex_bg: Option<wgpu::BindGroup>,
}

/// Vertex = position(3) + normal(3) + uv(2) = 8 floats.
const VERT_FLOATS: usize = 8;

fn upload_geometry(device: &wgpu::Device, verts: &[f32], indices: &[u32]) -> Geometry {
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

/// Upload `rgba` (w×h, 4 bytes/px) to a new TEXTURE_BINDING texture and return
/// its view. Used for the 1×1 white default and GLTF base-color textures.
fn make_rgba_texture(device: &wgpu::Device, queue: &wgpu::Queue, w: u32, h: u32, rgba: &[u8]) -> wgpu::TextureView {
    let tex = device.create_texture(&wgpu::TextureDescriptor {
        label: Some("mesh-tex"),
        size:  wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
        mip_level_count: 1, sample_count: 1,
        dimension: wgpu::TextureDimension::D2,
        format:    wgpu::TextureFormat::Rgba8Unorm,
        usage:     wgpu::TextureUsages::TEXTURE_BINDING | wgpu::TextureUsages::COPY_DST,
        view_formats: &[],
    });
    queue.write_texture(
        wgpu::TexelCopyTextureInfo {
            texture: &tex, mip_level: 0,
            origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All,
        },
        rgba,
        wgpu::TexelCopyBufferLayout { offset: 0, bytes_per_row: Some(w * 4), rows_per_image: Some(h) },
        wgpu::Extent3d { width: w, height: h, depth_or_array_layers: 1 },
    );
    tex.create_view(&Default::default())
}

fn gen_box() -> (Vec<f32>, Vec<u32>) {
    let mut v: Vec<f32> = Vec::new();
    let mut idx: Vec<u32> = Vec::new();
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
    // Per-quad UVs for the 4 corners.
    let uv: [[f32; 2]; 4] = [[0.0, 1.0], [1.0, 1.0], [1.0, 0.0], [0.0, 0.0]];
    for (n, corners) in faces {
        let base = (v.len() / VERT_FLOATS) as u32;
        for (k, c) in corners.iter().enumerate() {
            v.extend_from_slice(c);
            v.extend_from_slice(n);
            v.extend_from_slice(&uv[k]);
        }
        idx.extend_from_slice(&[base, base+1, base+2, base, base+2, base+3]);
    }
    (v, idx)
}

fn gen_sphere(stacks: u32, slices: u32) -> (Vec<f32>, Vec<u32>) {
    let mut v: Vec<f32> = Vec::new();
    let mut idx: Vec<u32> = Vec::new();
    use std::f32::consts::PI;
    for i in 0..=stacks {
        let phi = PI * i as f32 / stacks as f32;
        let (sp, cp) = (phi.sin(), phi.cos());
        for j in 0..=slices {
            let theta = 2.0 * PI * j as f32 / slices as f32;
            let (st, ct) = (theta.sin(), theta.cos());
            let (x, y, z) = (sp * ct, cp, sp * st);
            let u = j as f32 / slices as f32;
            let vv = i as f32 / stacks as f32;
            v.extend_from_slice(&[x * 0.5, y * 0.5, z * 0.5, x, y, z, u, vv]);
        }
    }
    for i in 0..stacks {
        for j in 0..slices {
            let a = i * (slices + 1) + j;
            let b = i * (slices + 1) + j + 1;
            let c = (i+1)*(slices+1) + j;
            let d = (i+1)*(slices+1) + j + 1;
            idx.extend_from_slice(&[a, c, b, b, c, d]);
        }
    }
    (v, idx)
}

fn gen_plane() -> (Vec<f32>, Vec<u32>) {
    let v: Vec<f32> = vec![
        -0.5, 0.0,  0.5,  0.0, 1.0, 0.0,  0.0, 1.0,
         0.5, 0.0,  0.5,  0.0, 1.0, 0.0,  1.0, 1.0,
         0.5, 0.0, -0.5,  0.0, 1.0, 0.0,  1.0, 0.0,
        -0.5, 0.0, -0.5,  0.0, 1.0, 0.0,  0.0, 0.0,
    ];
    (v, vec![0, 1, 2, 0, 2, 3])
}

// ── Per-canvas render target ───────────────────────────────────────────────────

struct Canvas3DTarget {
    color_view: wgpu::TextureView,
    depth_view: wgpu::TextureView,
    width:  u32,
    height: u32,
    /// Cached overlay bind group — created once per resize, reused every frame.
    /// Referencing color_view, overlay_sampler, and overlay_rect_buf (buffer
    /// handle is stable even though its contents are updated via write_buffer).
    overlay_bg: Option<wgpu::BindGroup>,
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
        Self { color_view, depth_view, width: w, height: h, overlay_bg: None, _color_tex: color_tex, _depth_tex: depth_tex }
    }
}

// ── Renderer3D ─────────────────────────────────────────────────────────────────

pub struct Renderer3D {
    pipeline_3d:  wgpu::RenderPipeline,
    // Bind-group layouts are only consumed inside `new()` today; kept on the
    // struct for dynamic bind-group rebuilds (streaming meshes/lights).
    #[allow(dead_code)]
    camera_bgl:   wgpu::BindGroupLayout,
    #[allow(dead_code)]
    per_obj_bgl:  wgpu::BindGroupLayout,
    #[allow(dead_code)]
    lighting_bgl: wgpu::BindGroupLayout,
    tex_bgl:      wgpu::BindGroupLayout,
    overlay_bgl:  wgpu::BindGroupLayout,

    camera_buf:      wgpu::Buffer,
    mesh_buf:        wgpu::Buffer,
    mat_buf:         wgpu::Buffer,
    lights_buf:      wgpu::Buffer,
    overlay_rect_buf: wgpu::Buffer,

    camera_bg:    wgpu::BindGroup,
    lighting_bg:  wgpu::BindGroup,
    per_obj_bgs:  Vec<wgpu::BindGroup>,

    /// Shared base-color sampler for mesh textures.
    mesh_sampler: wgpu::Sampler,
    /// Group-3 bind group backed by a 1×1 white texture; used by every
    /// untextured primitive so the shader's `texture × color` works uniformly.
    white_tex_bg: wgpu::BindGroup,

    box_geom:    Geometry,
    sphere_geom: Geometry,
    plane_geom:  Geometry,
    /// Loaded GLTF models, keyed by path. Capped at 16 models (LRU eviction).
    /// Each evicted model's wgpu buffers are freed when its Arc refcount hits 0.
    /// Call `unload_gltf` to evict a specific model ahead of the LRU limit.
    gltf_cache:  LruCache<String, Vec<Primitive>>,

    targets:  HashMap<u32, Canvas3DTarget>,

    overlay_pipeline: wgpu::RenderPipeline,
    overlay_sampler:  wgpu::Sampler,
}

impl Renderer3D {
    pub fn new(device: &wgpu::Device, queue: &wgpu::Queue, surface_format: wgpu::TextureFormat) -> Self {

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
                bgl_entry(0, wgpu::ShaderStages::FRAGMENT, std::mem::size_of::<LightsUniform>() as u64),
            ],
        });
        // Group-3: base-color texture + sampler (shared by mesh + overlay shapes).
        let tex_bgl = device.create_bind_group_layout(&wgpu::BindGroupLayoutDescriptor {
            label: Some("tex-bgl"),
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

        // pos(3) + normal(3) + uv(2), stride = 32 bytes.
        let vbl_attrs = wgpu::vertex_attr_array![0 => Float32x3, 1 => Float32x3, 2 => Float32x2];
        let vbl = wgpu::VertexBufferLayout {
            array_stride: (VERT_FLOATS * 4) as u64,
            step_mode:    wgpu::VertexStepMode::Vertex,
            attributes:   &vbl_attrs,
        };

        let pipeline_3d = {
            let layout = device.create_pipeline_layout(&wgpu::PipelineLayoutDescriptor {
                label: Some("3d-pl"),
                bind_group_layouts: &[Some(&camera_bgl), Some(&per_obj_bgl), Some(&lighting_bgl), Some(&tex_bgl)],
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
        let lights_buf     = ubuf(device, "lights",   std::mem::size_of::<LightsUniform>() as u64);
        let overlay_rect_buf = ubuf(device, "ov-rect", std::mem::size_of::<OverlayRect>() as u64);

        let camera_bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("cam-bg"), layout: &camera_bgl,
            entries: &[wgpu::BindGroupEntry { binding: 0, resource: camera_buf.as_entire_binding() }],
        });
        let lighting_bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("light-bg"), layout: &lighting_bgl,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: lights_buf.as_entire_binding() },
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

        // Mesh texture sampler: linear + repeat (typical for UV-mapped models).
        let mesh_sampler = device.create_sampler(&wgpu::SamplerDescriptor {
            label:        Some("mesh-sampler"),
            address_mode_u: wgpu::AddressMode::Repeat,
            address_mode_v: wgpu::AddressMode::Repeat,
            mag_filter:   wgpu::FilterMode::Linear,
            min_filter:   wgpu::FilterMode::Linear,
            ..Default::default()
        });

        // 1×1 white texture + its group-3 bind group, shared by all untextured
        // primitives (created once; never reallocated).
        let white_view = make_rgba_texture(device, queue, 1, 1, &[255, 255, 255, 255]);
        let white_tex_bg = device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("white-tex-bg"), layout: &tex_bgl,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&white_view) },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::Sampler(&mesh_sampler) },
            ],
        });

        Self {
            pipeline_3d,
            camera_bgl, per_obj_bgl, lighting_bgl, tex_bgl, overlay_bgl,
            camera_buf, mesh_buf, mat_buf, lights_buf, overlay_rect_buf,
            camera_bg, lighting_bg, per_obj_bgs,
            mesh_sampler, white_tex_bg,
            box_geom:    upload_geometry(device, &bv, &bi),
            sphere_geom: upload_geometry(device, &sv, &si),
            plane_geom:  upload_geometry(device, &pv, &pi),
            gltf_cache:  LruCache::new(std::num::NonZeroUsize::new(16).unwrap()),
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

        // Resize target if needed, then (re-)build the overlay bind group once.
        let needs_resize = self.targets.get(&canvas_id)
            .map(|t| t.width != tw || t.height != th).unwrap_or(true);
        if needs_resize {
            self.targets.insert(canvas_id, Canvas3DTarget::new(device, tw, th));
            // Build the overlay bind group now that color_view is finalised.
            // We do it here (not in Canvas3DTarget::new) so we have access to
            // overlay_bgl, overlay_sampler, and overlay_rect_buf.
            let target = self.targets.get_mut(&canvas_id).unwrap();
            target.overlay_bg = Some(device.create_bind_group(&wgpu::BindGroupDescriptor {
                label:  Some("ov-bg"), layout: &self.overlay_bgl,
                entries: &[
                    wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&target.color_view) },
                    wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::Sampler(&self.overlay_sampler) },
                    wgpu::BindGroupEntry { binding: 2, resource: self.overlay_rect_buf.as_entire_binding() },
                ],
            }));
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

        // Lighting — pack ambient + up to MAX_LIGHTS dynamic lights.
        let mut lu = LightsUniform {
            ambient: [0.0, 0.0, 0.0, 0.0],
            count:   [0, 0, 0, 0],
            lights:  [GpuLight::zeroed(); MAX_LIGHTS],
        };
        let mut have_ambient = false;
        let mut n_lights = 0usize;
        for l in &scene.lights {
            match l {
                Light3D::Ambient { color, intensity } => {
                    lu.ambient = [color[0], color[1], color[2], *intensity];
                    have_ambient = true;
                }
                Light3D::Directional { direction, color, intensity } if n_lights < MAX_LIGHTS => {
                    lu.lights[n_lights] = GpuLight {
                        pos_kind:    [0.0, 0.0, 0.0, 0.0],
                        dir_int:     [direction[0], direction[1], direction[2], *intensity],
                        color_range: [color[0], color[1], color[2], 0.0],
                        cone:        [0.0; 4],
                    };
                    n_lights += 1;
                }
                Light3D::Point { position, color, intensity, range } if n_lights < MAX_LIGHTS => {
                    lu.lights[n_lights] = GpuLight {
                        pos_kind:    [position[0], position[1], position[2], 1.0],
                        dir_int:     [0.0, 0.0, 0.0, *intensity],
                        color_range: [color[0], color[1], color[2], *range],
                        cone:        [0.0; 4],
                    };
                    n_lights += 1;
                }
                Light3D::Spot { position, direction, color, intensity, range, inner_deg, outer_deg } if n_lights < MAX_LIGHTS => {
                    lu.lights[n_lights] = GpuLight {
                        pos_kind:    [position[0], position[1], position[2], 2.0],
                        dir_int:     [direction[0], direction[1], direction[2], *intensity],
                        color_range: [color[0], color[1], color[2], *range],
                        cone:        [inner_deg.to_radians().cos(), outer_deg.to_radians().cos(), 0.0, 0.0],
                    };
                    n_lights += 1;
                }
                _ => {} // ambient already handled; extras beyond MAX_LIGHTS ignored
            }
        }
        // Sensible defaults so a scene is never pitch black.
        if !have_ambient { lu.ambient = [1.0, 1.0, 1.0, 0.15]; }
        if n_lights == 0 {
            lu.lights[0] = GpuLight {
                pos_kind:    [0.0, 0.0, 0.0, 0.0],
                dir_int:     [0.0, -1.0, 0.0, 0.8],
                color_range: [1.0, 1.0, 1.0, 0.0],
                cone:        [0.0; 4],
            };
            n_lights = 1;
        }
        lu.count = [n_lights as u32, 0, 0, 0];
        queue.write_buffer(&self.lights_buf, 0, bytemuck::bytes_of(&lu));

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
        // Reuse the cached overlay bind group (created once per resize above).
        let ov_bg = target.overlay_bg.as_ref().unwrap();

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
                match &mesh.geometry {
                    Geometry3D::Gltf { path } => {
                        if let Some(prims) = self.gltf_cache.get(path) {
                            // A model is all its primitives — each with its own
                            // geometry + (optional) base-color texture.
                            for prim in prims {
                                let tex = prim.tex_bg.as_ref().unwrap_or(&self.white_tex_bg);
                                pass.set_bind_group(3, tex, &[]);
                                pass.set_vertex_buffer(0, prim.geom.vbuf.slice(..));
                                pass.set_index_buffer(prim.geom.ibuf.slice(..), wgpu::IndexFormat::Uint32);
                                pass.draw_indexed(0..prim.geom.idx_count, 0, 0..1);
                            }
                        } else {
                            // Not loaded yet — draw a white box placeholder.
                            pass.set_bind_group(3, &self.white_tex_bg, &[]);
                            pass.set_vertex_buffer(0, self.box_geom.vbuf.slice(..));
                            pass.set_index_buffer(self.box_geom.ibuf.slice(..), wgpu::IndexFormat::Uint32);
                            pass.draw_indexed(0..self.box_geom.idx_count, 0, 0..1);
                        }
                    }
                    other => {
                        let geom = match other {
                            Geometry3D::Sphere {} => &self.sphere_geom,
                            Geometry3D::Plane  {} => &self.plane_geom,
                            _                     => &self.box_geom,
                        };
                        pass.set_bind_group(3, &self.white_tex_bg, &[]);
                        pass.set_vertex_buffer(0, geom.vbuf.slice(..));
                        pass.set_index_buffer(geom.ibuf.slice(..), wgpu::IndexFormat::Uint32);
                        pass.draw_indexed(0..geom.idx_count, 0, 0..1);
                    }
                }
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
            pass.set_bind_group(0, ov_bg, &[]);
            pass.draw(0..4, 0..1);
        }

        queue.submit([enc.finish()]);
    }

    /// Blit the previously-rendered 3D frame onto `surface_view` without
    /// re-running the 3D pipeline or updating any uniform buffers.
    /// Call on frames where the scene has not changed since the last `render()`.
    pub fn blit_only(
        &mut self,
        device: &wgpu::Device,
        queue:  &wgpu::Queue,
        canvas_id: u32,
        x: f32, y: f32, w: f32, h: f32,
        surface_view: &wgpu::TextureView,
        surface_w: f32,
        surface_h: f32,
    ) {
        let Some(target) = self.targets.get(&canvas_id) else { return };
        let Some(ov_bg)  = target.overlay_bg.as_ref()  else { return };

        // Only the overlay rect may have changed (e.g. layout shift); everything
        // else (geometry, camera, lights) is unchanged from last render().
        queue.write_buffer(&self.overlay_rect_buf, 0, bytemuck::bytes_of(&OverlayRect {
            x, y, w, h, sw: surface_w, sh: surface_h, _p0: 0., _p1: 0.,
        }));

        let mut enc = device.create_command_encoder(
            &wgpu::CommandEncoderDescriptor { label: Some("3d-blit-only") });
        {
            let mut pass = enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("3d-blit-only-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: surface_view, resolve_target: None, depth_slice: None,
                    ops: wgpu::Operations { load: wgpu::LoadOp::Load, store: wgpu::StoreOp::Store },
                })],
                depth_stencil_attachment: None, ..Default::default()
            });
            pass.set_pipeline(&self.overlay_pipeline);
            pass.set_bind_group(0, ov_bg, &[]);
            pass.draw(0..4, 0..1);
        }
        queue.submit([enc.finish()]);
    }

    /// Load a GLTF/GLB file: every mesh × every primitive, with position/normal/
    /// UV vertex data and base-color textures. Cached by `path`; a no-op if
    /// already loaded. Memory is bounded by the set of distinct models loaded and
    /// is released when the renderer is dropped (last Canvas3D node removed) or
    /// via [`unload_gltf`](Self::unload_gltf).
    pub fn load_gltf(&mut self, device: &wgpu::Device, queue: &wgpu::Queue, path: &str) -> Result<(), String> {
        if self.gltf_cache.contains(path) { return Ok(()); }
        let (doc, buffers, images) = gltf::import(path).map_err(|e| e.to_string())?;

        // Per-model texture cache: image source index → uploaded view. Ensures a
        // texture shared by several primitives is uploaded to the GPU only once.
        let mut tex_views: HashMap<usize, wgpu::TextureView> = HashMap::new();
        let mut prims_out: Vec<Primitive> = Vec::new();
        for mesh in doc.meshes() {
            for prim in mesh.primitives() {
                let reader = prim.reader(|b| Some(&buffers[b.index()]));
                let Some(pos_iter) = reader.read_positions() else { continue };
                let pos: Vec<[f32; 3]> = pos_iter.collect();
                if pos.is_empty() { continue; }
                let nor: Vec<[f32; 3]> = reader.read_normals().map(|r| r.collect()).unwrap_or_default();
                let uvs: Vec<[f32; 2]> = reader.read_tex_coords(0)
                    .map(|r| r.into_f32().collect())
                    .unwrap_or_default();

                let mut verts: Vec<f32> = Vec::with_capacity(pos.len() * VERT_FLOATS);
                for (i, p) in pos.iter().enumerate() {
                    verts.extend_from_slice(p);
                    verts.extend_from_slice(nor.get(i).unwrap_or(&[0.0, 1.0, 0.0]));
                    verts.extend_from_slice(uvs.get(i).unwrap_or(&[0.0, 0.0]));
                }
                let indices: Vec<u32> = match reader.read_indices() {
                    Some(r) => r.into_u32().collect(),
                    None    => (0..pos.len() as u32).collect(),
                };
                let geom = upload_geometry(device, &verts, &indices);

                // Base-color texture (if the material declares one and we can
                // decode it). Untextured primitives fall back to the shared white.
                let tex_bg = self.load_base_color_bg(device, queue, &prim, &images, &mut tex_views);
                prims_out.push(Primitive { geom, tex_bg });
            }
        }

        if prims_out.is_empty() { return Err("gltf: no drawable primitives".into()); }
        self.gltf_cache.put(path.to_string(), prims_out);
        Ok(())
    }

    /// Build a group-3 bind group for a primitive's base-color texture, or
    /// `None` if it has no texture / the format is unsupported (→ shared white).
    fn load_base_color_bg(
        &self,
        device:    &wgpu::Device,
        queue:     &wgpu::Queue,
        prim:      &gltf::Primitive,
        images:    &[gltf::image::Data],
        tex_views: &mut HashMap<usize, wgpu::TextureView>,
    ) -> Option<wgpu::BindGroup> {
        let info = prim.material().pbr_metallic_roughness().base_color_texture()?;
        let idx  = info.texture().source().index();
        // Upload the image once per model; reuse the view for later primitives.
        if !tex_views.contains_key(&idx) {
            let img  = images.get(idx)?;
            let rgba = gltf_image_to_rgba8(img)?;
            tex_views.insert(idx, make_rgba_texture(device, queue, img.width, img.height, &rgba));
        }
        let view = tex_views.get(&idx)?;
        // The bind group holds an internal ref to the texture, so it stays alive
        // after `tex_views` (and its views) are dropped at end of load.
        Some(device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("gltf-tex-bg"), layout: &self.tex_bgl,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(view) },
                wgpu::BindGroupEntry { binding: 1, resource: wgpu::BindingResource::Sampler(&self.mesh_sampler) },
            ],
        }))
    }

    /// Drop a loaded GLTF model, freeing its geometry + textures. Useful for
    /// games that stream assets between levels.
    pub fn unload_gltf(&mut self, path: &str) {
        self.gltf_cache.pop(path);
    }

    pub fn remove_canvas(&mut self, id: u32) { self.targets.remove(&id); }
}

/// Convert a decoded GLTF image to tightly-packed RGBA8. Returns `None` for
/// formats we don't handle (caller falls back to the white texture).
fn gltf_image_to_rgba8(img: &gltf::image::Data) -> Option<Vec<u8>> {
    use gltf::image::Format;
    let px = &img.pixels;
    let n  = (img.width * img.height) as usize;
    Some(match img.format {
        Format::R8G8B8A8 => px.clone(),
        Format::R8G8B8 => {
            let mut out = Vec::with_capacity(n * 4);
            for c in px.chunks_exact(3) { out.extend_from_slice(&[c[0], c[1], c[2], 255]); }
            out
        }
        Format::R8 => {
            let mut out = Vec::with_capacity(n * 4);
            for &g in px.iter() { out.extend_from_slice(&[g, g, g, 255]); }
            out
        }
        Format::R8G8 => {
            let mut out = Vec::with_capacity(n * 4);
            for c in px.chunks_exact(2) { out.extend_from_slice(&[c[0], c[0], c[0], c[1]]); }
            out
        }
        _ => return None, // 16-bit / float formats unsupported → white fallback
    })
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
