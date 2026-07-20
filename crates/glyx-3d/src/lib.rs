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
    Gltf   { path: String, #[serde(default)] animation: Option<GltfAnimState> },
}

/// JS-driven animation playback state for a `Geometry3D::Gltf` instance —
/// consistent with the framework's "JS drives state, Rust is a dumb
/// renderer" model (same as all 2D animation): JS tracks elapsed time and
/// sends `{clip, time}` every frame via the existing `canvas3d_update` JSON
/// payload. `clip` matches an animation by name, or by index if it parses
/// as an integer; an unresolvable `clip` falls back to animation 0.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GltfAnimState {
    pub clip: String,
    pub time: f32,
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
///
/// Also carries the raw rest-pose vertex data (`rest_positions`/`rest_normals`/
/// `uvs`) plus optional skinning data (`joints`/`weights`) so animated frames
/// can CPU-recompute and re-upload `geom.vbuf` without touching the GPU
/// pipeline/vertex format at all — see [`Renderer3D::apply_gltf_animation`].
struct Primitive {
    geom:   Geometry,
    tex_bg: Option<wgpu::BindGroup>,
    node_index: usize,
    skin_index: Option<usize>,
    rest_positions: Vec<[f32; 3]>,
    rest_normals:   Vec<[f32; 3]>,
    uvs:            Vec<[f32; 2]>,
    /// Up to 4 joint indices (into the skin's `joints` list) per vertex.
    /// Empty when `skin_index` is `None`.
    joints:  Vec<[u16; 4]>,
    /// Blend weights matching `joints`. Empty when `skin_index` is `None`.
    weights: Vec<[f32; 4]>,
}

/// A glTF scene-graph node's rest-pose local transform + hierarchy, used to
/// compose world matrices for both the initial (bind-pose) upload and
/// per-frame animation sampling.
#[derive(Clone)]
struct GltfNode {
    parent:      Option<usize>,
    translation: Vec3,
    rotation:    glam::Quat,
    scale:       Vec3,
}
impl GltfNode {
    fn local_matrix(&self) -> Mat4 {
        Mat4::from_scale_rotation_translation(self.scale, self.rotation, self.translation)
    }
}

/// A skin's joint list (node indices) + matching inverse-bind matrices.
struct GltfSkin {
    joints:       Vec<usize>,
    inverse_bind: Vec<Mat4>,
}

#[derive(Clone, Copy, PartialEq)]
enum AnimTarget { Translation, Rotation, Scale }

/// One animated property of one node — a list of (time, value) keyframes.
/// Rotation values are quaternions (`values4`); translation/scale use
/// `values3`. Interpolation is always linear (nlerp for rotation) — glTF's
/// `CubicSpline` mode is sampled as if it were `Linear`, a documented
/// simplification (adequate for the "ordinary three.js game" target bar).
struct AnimChannel {
    node:    usize,
    target:  AnimTarget,
    times:   Vec<f32>,
    values3: Vec<[f32; 3]>,
    values4: Vec<[f32; 4]>,
}

struct AnimClip {
    name:     String,
    /// Max keyframe time across all channels. Not read yet — JS drives
    /// playback and doesn't currently query clip length — kept since it's
    /// already computed for free and a future `get_gltf_animations()`
    /// introspection binding (so apps can loop by clip duration) would need it.
    #[allow(dead_code)]
    duration: f32,
    channels: Vec<AnimChannel>,
}

/// A loaded GLTF model: its drawable primitives plus a local-space AABB
/// (computed once at load time from the raw vertex positions) used for
/// AABB-precision raycasting — see [`Renderer3D::raycast`] — and the node/
/// skin/animation data needed to play back GLTF animations.
struct GltfModel {
    prims:      Vec<Primitive>,
    aabb_min:   Vec3,
    aabb_max:   Vec3,
    nodes:      Vec<GltfNode>,
    skins:      Vec<GltfSkin>,
    animations: Vec<AnimClip>,
}

/// Vertex = position(3) + normal(3) + uv(2) = 8 floats.
const VERT_FLOATS: usize = 8;

fn upload_geometry(device: &wgpu::Device, verts: &[f32], indices: &[u32]) -> Geometry {
    use wgpu::util::DeviceExt;
    // COPY_DST so animated GLTF primitives can have their vbuf re-uploaded
    // per frame (CPU skinning / node-TRS animation) without recreating it —
    // see `Renderer3D::apply_gltf_animation`. Free for static geometry.
    let vbuf = device.create_buffer_init(&wgpu::util::BufferInitDescriptor {
        label: Some("geom-verts"), usage: wgpu::BufferUsages::VERTEX | wgpu::BufferUsages::COPY_DST,
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
    gltf_cache:  LruCache<String, GltfModel>,

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

        // Apply GLTF animation state (if any) before drawing — CPU-samples the
        // clip's channels at the given time, recomposes joint/node world
        // matrices, and re-uploads the affected models' vertex buffers.
        // Note: animation is keyed by model `path`, not by mesh instance — two
        // instances of the same GLTF sharing a canvas play back in lockstep
        // (the last-applied `{clip,time}` this frame wins). Adequate for the
        // "ordinary three.js game" target bar; per-instance animated clones of
        // one model is a documented future refinement.
        for mesh in scene.meshes.iter().take(n) {
            if let Geometry3D::Gltf { path, animation: Some(state) } = &mesh.geometry {
                self.apply_gltf_animation(queue, path, &state.clip, state.time);
            }
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
                    Geometry3D::Gltf { path, .. } => {
                        if let Some(model_data) = self.gltf_cache.get(path) {
                            // A model is all its primitives — each with its own
                            // geometry + (optional) base-color texture.
                            for prim in &model_data.prims {
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

        // ── Node graph (rest-pose local TRS + hierarchy) ───────────────────
        // Needed for both the initial bind-pose upload (a node's rest-world
        // transform is baked into its primitives' vertex data below, since
        // this was previously ignored entirely — ok because no shipped test
        // asset used non-identity node transforms) and per-frame animation
        // sampling. Node indices are stable == `Node::index()`.
        let mut nodes: Vec<GltfNode> = doc.nodes().map(|n| {
            let (t, r, s) = n.transform().decomposed();
            GltfNode {
                parent: None,
                translation: Vec3::from(t),
                rotation: glam::Quat::from_xyzw(r[0], r[1], r[2], r[3]),
                scale: Vec3::from(s),
            }
        }).collect();
        for n in doc.nodes() {
            for child in n.children() {
                nodes[child.index()].parent = Some(n.index());
            }
        }

        // ── Skins ───────────────────────────────────────────────────────────
        let skins: Vec<GltfSkin> = doc.skins().map(|skin| {
            let joints: Vec<usize> = skin.joints().map(|j| j.index()).collect();
            let reader = skin.reader(|b| Some(&buffers[b.index()]));
            let inverse_bind: Vec<Mat4> = match reader.read_inverse_bind_matrices() {
                Some(it) => it.map(|m| Mat4::from_cols_array_2d(&m)).collect(),
                None => vec![Mat4::IDENTITY; joints.len()],
            };
            GltfSkin { joints, inverse_bind }
        }).collect();

        // ── Animations ──────────────────────────────────────────────────────
        let animations: Vec<AnimClip> = doc.animations().map(|anim| {
            let mut duration = 0.0f32;
            let channels: Vec<AnimChannel> = anim.channels().filter_map(|ch| {
                let target = match ch.target().property() {
                    gltf::animation::Property::Translation => AnimTarget::Translation,
                    gltf::animation::Property::Rotation    => AnimTarget::Rotation,
                    gltf::animation::Property::Scale       => AnimTarget::Scale,
                    gltf::animation::Property::MorphTargetWeights => return None, // unsupported, skip
                };
                let node = ch.target().node().index();
                let reader = ch.reader(|b| Some(&buffers[b.index()]));
                let times: Vec<f32> = reader.read_inputs()?.collect();
                if let Some(&last) = times.last() { duration = duration.max(last); }
                let (values3, values4) = match reader.read_outputs()? {
                    gltf::animation::util::ReadOutputs::Translations(it) => (it.collect(), Vec::new()),
                    gltf::animation::util::ReadOutputs::Scales(it)       => (it.collect(), Vec::new()),
                    gltf::animation::util::ReadOutputs::Rotations(rot)   => (Vec::new(), rot.into_f32().collect()),
                    gltf::animation::util::ReadOutputs::MorphTargetWeights(_) => return None,
                };
                Some(AnimChannel { node, target, times, values3, values4 })
            }).collect();
            AnimClip {
                name: anim.name().unwrap_or_default().to_string(),
                duration,
                channels,
            }
        }).collect();

        // ── Primitives (walked via nodes, not `doc.meshes()`, so we know
        //    each primitive's owning node — needed for animation targeting) ──
        let mut tex_views: HashMap<usize, wgpu::TextureView> = HashMap::new();
        let mut prims_out: Vec<Primitive> = Vec::new();
        let mut aabb_min = Vec3::splat(f32::INFINITY);
        let mut aabb_max = Vec3::splat(f32::NEG_INFINITY);
        for node in doc.nodes() {
            let Some(mesh) = node.mesh() else { continue };
            let skin_index = node.skin().map(|s| s.index());
            // Rest-pose world transform, used to bake the initial upload for
            // non-skinned primitives (skinned primitives upload raw bind-pose
            // data — inverse-bind matrices are defined to cancel the joints'
            // bind-pose world transform, per the glTF spec).
            let world = node_world_matrix(&nodes, node.index());
            let normal_mat = world.inverse().transpose();

            for prim in mesh.primitives() {
                let reader = prim.reader(|b| Some(&buffers[b.index()]));
                let Some(pos_iter) = reader.read_positions() else { continue };
                let pos: Vec<[f32; 3]> = pos_iter.collect();
                if pos.is_empty() { continue; }
                let nor: Vec<[f32; 3]> = reader.read_normals().map(|r| r.collect()).unwrap_or_default();
                let uvs: Vec<[f32; 2]> = reader.read_tex_coords(0)
                    .map(|r| r.into_f32().collect())
                    .unwrap_or_default();
                let joints: Vec<[u16; 4]> = if skin_index.is_some() {
                    reader.read_joints(0).map(|r| r.into_u16().collect()).unwrap_or_default()
                } else { Vec::new() };
                let weights: Vec<[f32; 4]> = if skin_index.is_some() {
                    reader.read_weights(0).map(|r| r.into_f32().collect()).unwrap_or_default()
                } else { Vec::new() };
                let skinned = skin_index.is_some() && joints.len() == pos.len() && weights.len() == pos.len();

                // Initial GPU upload: bake the node's rest-world transform in
                // for non-skinned primitives (matches static rendering);
                // skinned primitives upload raw bind-pose data unchanged.
                let mut verts: Vec<f32> = Vec::with_capacity(pos.len() * VERT_FLOATS);
                for (i, p) in pos.iter().enumerate() {
                    let n = *nor.get(i).unwrap_or(&[0.0, 1.0, 0.0]);
                    let (up, un) = if skinned {
                        (*p, n)
                    } else {
                        let wp = world.transform_point3(Vec3::from(*p));
                        let wn = normal_mat.transform_vector3(Vec3::from(n)).normalize_or_zero();
                        (wp.to_array(), wn.to_array())
                    };
                    verts.extend_from_slice(&up);
                    verts.extend_from_slice(&un);
                    verts.extend_from_slice(uvs.get(i).unwrap_or(&[0.0, 0.0]));
                }
                for p in &pos {
                    let v = Vec3::from(*p);
                    let wv = if skinned { v } else { world.transform_point3(v) };
                    aabb_min = aabb_min.min(wv);
                    aabb_max = aabb_max.max(wv);
                }
                let indices: Vec<u32> = match reader.read_indices() {
                    Some(r) => r.into_u32().collect(),
                    None    => (0..pos.len() as u32).collect(),
                };
                let geom = upload_geometry(device, &verts, &indices);

                // Base-color texture (if the material declares one and we can
                // decode it). Untextured primitives fall back to the shared white.
                // `baseColorFactor` is baked into the texture bytes at load time
                // (rather than a new per-primitive uniform/bind-group slot) so
                // this needs no shader/pipeline/uniform-layout changes at all.
                let factor = prim.material().pbr_metallic_roughness().base_color_factor();
                let tex_bg = self.load_base_color_bg(device, queue, &prim, &images, &mut tex_views, factor);
                prims_out.push(Primitive {
                    geom, tex_bg,
                    node_index: node.index(),
                    skin_index: if skinned { skin_index } else { None },
                    rest_positions: pos,
                    rest_normals: nor,
                    uvs,
                    joints,
                    weights,
                });
            }
        }

        if prims_out.is_empty() { return Err("gltf: no drawable primitives".into()); }
        self.gltf_cache.put(path.to_string(), GltfModel {
            prims: prims_out, aabb_min, aabb_max, nodes, skins, animations,
        });
        Ok(())
    }

    /// Build a group-3 bind group for a primitive's base-color texture
    /// (with `factor` baked in), or `None` if there's no texture AND the
    /// factor is the default white (→ caller falls back to the renderer's
    /// shared white texture). `factor` is glTF's `baseColorFactor` — a
    /// constant tint multiplied into the texture (or the sole color, for
    /// untextured primitives).
    fn load_base_color_bg(
        &self,
        device:    &wgpu::Device,
        queue:     &wgpu::Queue,
        prim:      &gltf::Primitive,
        images:    &[gltf::image::Data],
        tex_views: &mut HashMap<usize, wgpu::TextureView>,
        factor:    [f32; 4],
    ) -> Option<wgpu::BindGroup> {
        const DEFAULT_FACTOR: [f32; 4] = [1.0, 1.0, 1.0, 1.0];
        let tinted = factor != DEFAULT_FACTOR;

        let view: wgpu::TextureView = if let Some(info) = prim.material().pbr_metallic_roughness().base_color_texture() {
            let idx = info.texture().source().index();
            if !tinted {
                // Common case: no tint, share one decoded+uploaded texture
                // across every primitive in this model that references it.
                if !tex_views.contains_key(&idx) {
                    let img  = images.get(idx)?;
                    let rgba = gltf_image_to_rgba8(img)?;
                    tex_views.insert(idx, make_rgba_texture(device, queue, img.width, img.height, &rgba));
                }
                tex_views.get(&idx)?.clone()
            } else {
                // Tinted: bake the factor into a fresh copy of the decoded
                // bytes. Not cached/shared (tinted primitives referencing the
                // same source image are rare), but correctness-first is fine
                // here — this only runs once per model load, not per frame.
                let img  = images.get(idx)?;
                let mut rgba = gltf_image_to_rgba8(img)?;
                tint_rgba8(&mut rgba, factor);
                make_rgba_texture(device, queue, img.width, img.height, &rgba)
            }
        } else if tinted {
            // Untextured but tinted: synthesize a 1×1 texture of the factor
            // color instead of falling back to shared white.
            let rgba = [
                (factor[0].clamp(0.0, 1.0) * 255.0).round() as u8,
                (factor[1].clamp(0.0, 1.0) * 255.0).round() as u8,
                (factor[2].clamp(0.0, 1.0) * 255.0).round() as u8,
                (factor[3].clamp(0.0, 1.0) * 255.0).round() as u8,
            ];
            make_rgba_texture(device, queue, 1, 1, &rgba)
        } else {
            // Untextured, untinted — use the shared white texture.
            return None;
        };

        // The bind group holds an internal ref to the texture, so it stays alive
        // after `tex_views` (and its views) are dropped at end of load.
        Some(device.create_bind_group(&wgpu::BindGroupDescriptor {
            label: Some("gltf-tex-bg"), layout: &self.tex_bgl,
            entries: &[
                wgpu::BindGroupEntry { binding: 0, resource: wgpu::BindingResource::TextureView(&view) },
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

    /// Cast a ray from the camera through NDC point `(ndc_x, ndc_y)` (each in
    /// `[-1, 1]`, standard NDC — caller converts screen-space click coords
    /// before calling this) and return the closest hit, if any.
    ///
    /// Box/Sphere/Plane get exact analytic intersection in local space (all
    /// three are unit-sized primitives — see `gen_box`/`gen_sphere`/
    /// `gen_plane` — so testing in local space after inverse-transforming the
    /// ray is both simpler and exact, not an approximation). GLTF models use
    /// their cached local-space AABB (computed once at load time in
    /// `load_gltf`) — good enough for "click to select a model", triangle
    /// precision is a documented future refinement, not required for Tier 1.
    pub fn raycast(&self, canvas_id: u32, scene: &Scene3D, ndc_x: f32, ndc_y: f32) -> Option<RaycastHit> {
        let target = self.targets.get(&canvas_id)?;
        let aspect = target.width as f32 / target.height.max(1) as f32;
        let cam = &scene.camera;
        let proj = Mat4::perspective_rh(cam.fov_deg.to_radians(), aspect, cam.near, cam.far);
        let view = Mat4::look_at_rh(Vec3::from(cam.position), Vec3::from(cam.target), Vec3::from(cam.up));
        let inv_vp = (proj * view).inverse();

        // Unproject the near/far NDC points (wgpu clip-space z in [0, 1]) to
        // build a world-space ray.
        let near = inv_vp * glam::Vec4::new(ndc_x, ndc_y, 0.0, 1.0);
        let far  = inv_vp * glam::Vec4::new(ndc_x, ndc_y, 1.0, 1.0);
        let near = near.truncate() / near.w;
        let far  = far.truncate()  / far.w;
        let ray_origin = near;
        let ray_dir = (far - near).normalize();

        let mut best: Option<RaycastHit> = None;
        for (i, mesh) in scene.meshes.iter().enumerate() {
            let model = Mat4::from_cols_array(&mesh.transform);
            let inv_model = model.inverse();
            let local_origin = inv_model.transform_point3(ray_origin);
            let local_dir = inv_model.transform_vector3(ray_dir).normalize();

            let local_t = match &mesh.geometry {
                Geometry3D::Box {}    => ray_aabb(local_origin, local_dir, Vec3::splat(-0.5), Vec3::splat(0.5)),
                Geometry3D::Sphere {} => ray_sphere(local_origin, local_dir, 0.5),
                Geometry3D::Plane {}  => ray_plane_bounded(local_origin, local_dir),
                Geometry3D::Gltf { path, .. } => self.gltf_cache.peek(path)
                    .and_then(|m| ray_aabb(local_origin, local_dir, m.aabb_min, m.aabb_max)),
            };

            let Some(t_local) = local_t else { continue };
            // Measure distance in world space (not local `t`), since a
            // non-uniform scale would make local-space `t` incomparable
            // across meshes with different transforms.
            let local_point = local_origin + local_dir * t_local;
            let world_point = model.transform_point3(local_point);
            let distance = (world_point - ray_origin).length();
            if best.as_ref().is_none_or(|b| distance < b.distance) {
                best = Some(RaycastHit { mesh_index: i, point: world_point.to_array(), distance });
            }
        }
        best
    }

    /// Sample `clip` (by name, or by index if `clip` parses as an integer —
    /// an unresolvable name falls back to animation 0) at `time` and
    /// re-upload the vertex buffers of every affected primitive in the
    /// model at `path`. CPU-side only — no shader/pipeline/vertex-format
    /// change, per the plan's "CPU skinning over GPU vertex-shader skinning"
    /// decision. No-op if the model isn't loaded or has no animations.
    fn apply_gltf_animation(&mut self, queue: &wgpu::Queue, path: &str, clip: &str, time: f32) {
        let Some(model) = self.gltf_cache.get(path) else { return };
        if model.animations.is_empty() { return }
        let clip_data = clip.parse::<usize>().ok()
            .and_then(|i| model.animations.get(i))
            .or_else(|| model.animations.iter().find(|a| a.name == clip))
            .unwrap_or(&model.animations[0]);

        // Sample each animated node's T/R/S independently — a node commonly
        // has separate translation/rotation/scale channels, so overwriting a
        // single combined local matrix per channel would silently drop
        // whichever property was sampled first. Un-targeted nodes/properties
        // keep their rest-pose value.
        let mut trans:  Vec<Vec3>       = model.nodes.iter().map(|n| n.translation).collect();
        let mut rots:   Vec<glam::Quat> = model.nodes.iter().map(|n| n.rotation).collect();
        let mut scales: Vec<Vec3>       = model.nodes.iter().map(|n| n.scale).collect();
        for ch in &clip_data.channels {
            match ch.target {
                AnimTarget::Translation => if let Some(v) = sample_vec3(ch, time) { trans[ch.node] = v; },
                AnimTarget::Scale       => if let Some(v) = sample_vec3(ch, time) { scales[ch.node] = v; },
                AnimTarget::Rotation    => if let Some(q) = sample_quat(ch, time) { rots[ch.node] = q; },
            }
        }
        let local_mats: Vec<Mat4> = (0..model.nodes.len())
            .map(|i| Mat4::from_scale_rotation_translation(scales[i], rots[i], trans[i]))
            .collect();
        // World matrices via the (static) hierarchy — walk to root, composing
        // the sampled local matrices.
        let world_mats = compose_world_matrices(&model.nodes, &local_mats);

        for prim in &model.prims {
            if let Some(skin_idx) = prim.skin_index {
                let skin = &model.skins[skin_idx];
                let palette: Vec<Mat4> = skin.joints.iter().zip(&skin.inverse_bind)
                    .map(|(&joint_node, ibm)| world_mats[joint_node] * *ibm)
                    .collect();
                let mut verts: Vec<f32> = Vec::with_capacity(prim.rest_positions.len() * VERT_FLOATS);
                for i in 0..prim.rest_positions.len() {
                    let p = Vec3::from(prim.rest_positions[i]);
                    let n = Vec3::from(*prim.rest_normals.get(i).unwrap_or(&[0.0, 1.0, 0.0]));
                    let js = prim.joints[i];
                    let ws = prim.weights[i];
                    let mut sp = Vec3::ZERO;
                    let mut sn = Vec3::ZERO;
                    for k in 0..4 {
                        if ws[k] == 0.0 { continue }
                        let m = &palette[js[k] as usize];
                        sp += m.transform_point3(p) * ws[k];
                        sn += m.transform_vector3(n) * ws[k];
                    }
                    verts.extend_from_slice(&sp.to_array());
                    verts.extend_from_slice(&sn.normalize_or_zero().to_array());
                    verts.extend_from_slice(prim.uvs.get(i).unwrap_or(&[0.0, 0.0]));
                }
                queue.write_buffer(&prim.geom.vbuf, 0, bytemuck::cast_slice(&verts));
            } else {
                // Non-skinned primitive on a (possibly) animated node — only
                // worth re-uploading if this node (or an ancestor) is
                // actually targeted by the clip; cheap check via world vs.
                // rest-world comparison would cost the same as just doing
                // the transform, so always re-apply when a clip is present.
                let world = world_mats[prim.node_index];
                let normal_mat = world.inverse().transpose();
                let mut verts: Vec<f32> = Vec::with_capacity(prim.rest_positions.len() * VERT_FLOATS);
                for i in 0..prim.rest_positions.len() {
                    let p = world.transform_point3(Vec3::from(prim.rest_positions[i]));
                    let n = normal_mat
                        .transform_vector3(Vec3::from(*prim.rest_normals.get(i).unwrap_or(&[0.0, 1.0, 0.0])))
                        .normalize_or_zero();
                    verts.extend_from_slice(&p.to_array());
                    verts.extend_from_slice(&n.to_array());
                    verts.extend_from_slice(prim.uvs.get(i).unwrap_or(&[0.0, 0.0]));
                }
                queue.write_buffer(&prim.geom.vbuf, 0, bytemuck::cast_slice(&verts));
            }
        }
    }
}

/// World-space transform of node `idx`, composed by walking up to the root
/// via `parent` links and multiplying rest-pose local matrices root-to-leaf.
/// Used for the initial (bind-pose) GPU upload in `load_gltf`.
fn node_world_matrix(nodes: &[GltfNode], idx: usize) -> Mat4 {
    let mut chain = vec![idx];
    let mut cur = nodes[idx].parent;
    while let Some(p) = cur {
        chain.push(p);
        cur = nodes[p].parent;
    }
    let mut m = Mat4::IDENTITY;
    for &n in chain.iter().rev() {
        m *= nodes[n].local_matrix();
    }
    m
}

/// Same composition as [`node_world_matrix`] but for every node at once,
/// using already-sampled (possibly animated) local matrices instead of each
/// node's rest pose. O(depth) per node via the same parent-walk approach —
/// fine for typical rig sizes (tens of joints), and avoids needing a
/// topological sort of the node array (glTF doesn't guarantee parents come
/// before children by index).
fn compose_world_matrices(nodes: &[GltfNode], local_mats: &[Mat4]) -> Vec<Mat4> {
    (0..nodes.len()).map(|idx| {
        let mut chain = vec![idx];
        let mut cur = nodes[idx].parent;
        while let Some(p) = cur {
            chain.push(p);
            cur = nodes[p].parent;
        }
        let mut m = Mat4::IDENTITY;
        for &n in chain.iter().rev() {
            m *= local_mats[n];
        }
        m
    }).collect()
}

/// Sample an animation channel at `time` (clamped to the channel's own
/// keyframe range — callers pass a shared clip time, individual channels may
/// have shorter ranges). Linear interpolation for translation/scale, nlerp
/// for rotation (adequate — the visual difference vs. slerp is negligible at
/// typical frame-to-frame rotation deltas). `CubicSpline` keyframes (which
/// pack `[in-tangent, value, out-tangent]` triples per keyframe) are treated
/// as plain `Linear` samples of the value component — a documented
/// simplification, not a full cubic-Hermite implementation.
/// Find the bracketing keyframe indices + interpolation fraction for `time`
/// within `ch.times`. Shared by `sample_vec3`/`sample_quat`.
fn bracket_keyframes(times: &[f32], time: f32) -> Option<(usize, usize, f32)> {
    if times.is_empty() { return None }
    let t = time.clamp(times[0], *times.last().unwrap());
    let idx = match times.binary_search_by(|x| x.partial_cmp(&t).unwrap()) {
        Ok(i) => i,
        Err(i) => i,
    };
    Some(if idx == 0 {
        (0, 0, 0.0)
    } else if idx >= times.len() {
        let last = times.len() - 1;
        (last, last, 0.0)
    } else {
        let (t0, t1) = (times[idx - 1], times[idx]);
        let f = if t1 > t0 { (t - t0) / (t1 - t0) } else { 0.0 };
        (idx - 1, idx, f)
    })
}

/// Sample a translation or scale channel at `time`. `CubicSpline` keyframes
/// are sampled as plain `Linear` (see [`AnimChannel`] docs).
fn sample_vec3(ch: &AnimChannel, time: f32) -> Option<Vec3> {
    let (i0, i1, frac) = bracket_keyframes(&ch.times, time)?;
    let a = Vec3::from(ch.values3[i0]);
    let b = Vec3::from(ch.values3[i1]);
    Some(a.lerp(b, frac))
}

/// Sample a rotation channel at `time` via nlerp (adequate — see
/// [`AnimChannel`] docs for why full slerp precision isn't needed here).
fn sample_quat(ch: &AnimChannel, time: f32) -> Option<glam::Quat> {
    let (i0, i1, frac) = bracket_keyframes(&ch.times, time)?;
    let a = glam::Quat::from_xyzw(ch.values4[i0][0], ch.values4[i0][1], ch.values4[i0][2], ch.values4[i0][3]);
    let b = glam::Quat::from_xyzw(ch.values4[i1][0], ch.values4[i1][1], ch.values4[i1][2], ch.values4[i1][3]);
    Some(a.normalize().slerp(b.normalize(), frac))
}

/// Result of [`Renderer3D::raycast`] — the closest mesh the ray hit.
#[derive(Debug, Clone, Copy)]
pub struct RaycastHit {
    /// Index into `Scene3D.meshes` of the hit mesh.
    pub mesh_index: usize,
    /// World-space hit point.
    pub point: [f32; 3],
    /// World-space distance from the ray origin (camera near plane) to the hit.
    pub distance: f32,
}

/// Ray-vs-axis-aligned-box intersection in local space. Returns the nearest
/// non-negative `t` along `dir` (assumed normalized), or `None` if the ray
/// misses or the box is entirely behind the origin.
fn ray_aabb(origin: Vec3, dir: Vec3, min: Vec3, max: Vec3) -> Option<f32> {
    let mut tmin = 0.0f32;
    let mut tmax = f32::INFINITY;
    for axis in 0..3 {
        let o = origin[axis];
        let d = dir[axis];
        if d.abs() < 1e-8 {
            if o < min[axis] || o > max[axis] { return None; }
        } else {
            let inv_d = 1.0 / d;
            let mut t0 = (min[axis] - o) * inv_d;
            let mut t1 = (max[axis] - o) * inv_d;
            if t0 > t1 { std::mem::swap(&mut t0, &mut t1); }
            tmin = tmin.max(t0);
            tmax = tmax.min(t1);
            if tmin > tmax { return None; }
        }
    }
    Some(tmin)
}

/// Ray-vs-sphere intersection in local space (sphere centered at origin).
fn ray_sphere(origin: Vec3, dir: Vec3, radius: f32) -> Option<f32> {
    let b = origin.dot(dir);
    let c = origin.dot(origin) - radius * radius;
    let disc = b * b - c;
    if disc < 0.0 { return None; }
    let sq = disc.sqrt();
    let (t0, t1) = (-b - sq, -b + sq);
    if t0 >= 0.0 { Some(t0) } else if t1 >= 0.0 { Some(t1) } else { None }
}

/// Ray-vs-bounded-plane intersection: the plane `y = 0`, bounded to
/// `|x| <= 0.5, |z| <= 0.5` (matching `gen_plane`'s extents) in local space.
fn ray_plane_bounded(origin: Vec3, dir: Vec3) -> Option<f32> {
    if dir.y.abs() < 1e-8 { return None; }
    let t = -origin.y / dir.y;
    if t < 0.0 { return None; }
    let p = origin + dir * t;
    if p.x.abs() <= 0.5 && p.z.abs() <= 0.5 { Some(t) } else { None }
}

/// Multiply a tightly-packed RGBA8 buffer in-place by a `[0,1]` factor —
/// used to bake glTF's `baseColorFactor` into a decoded texture at load
/// time, since the renderer has no per-primitive material uniform.
fn tint_rgba8(rgba: &mut [u8], factor: [f32; 4]) {
    for px in rgba.chunks_exact_mut(4) {
        px[0] = (px[0] as f32 * factor[0]).round().clamp(0.0, 255.0) as u8;
        px[1] = (px[1] as f32 * factor[1]).round().clamp(0.0, 255.0) as u8;
        px[2] = (px[2] as f32 * factor[2]).round().clamp(0.0, 255.0) as u8;
        px[3] = (px[3] as f32 * factor[3]).round().clamp(0.0, 255.0) as u8;
    }
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

#[cfg(test)]
mod math_tests {
    use super::*;

    fn node(parent: Option<usize>, t: [f32; 3]) -> GltfNode {
        GltfNode { parent, translation: Vec3::from(t), rotation: glam::Quat::IDENTITY, scale: Vec3::ONE }
    }

    #[test]
    fn node_world_matrix_composes_parent_chain() {
        let nodes = vec![node(None, [1.0, 0.0, 0.0]), node(Some(0), [0.0, 2.0, 0.0])];
        let m = node_world_matrix(&nodes, 1);
        assert_eq!(m.transform_point3(Vec3::ZERO), Vec3::new(1.0, 2.0, 0.0));
    }

    #[test]
    fn compose_world_matrices_matches_node_world_matrix() {
        let nodes = vec![node(None, [1.0, 0.0, 0.0]), node(Some(0), [0.0, 2.0, 0.0]), node(Some(1), [0.0, 0.0, 3.0])];
        let locals: Vec<Mat4> = nodes.iter().map(|n| n.local_matrix()).collect();
        let world = compose_world_matrices(&nodes, &locals);
        for i in 0..nodes.len() {
            assert_eq!(world[i], node_world_matrix(&nodes, i));
        }
    }

    #[test]
    fn bracket_keyframes_interpolates_and_clamps() {
        let times = [0.0, 1.0, 2.0];
        assert_eq!(bracket_keyframes(&times, 0.5), Some((0, 1, 0.5)));
        assert_eq!(bracket_keyframes(&times, -1.0), Some((0, 0, 0.0)));
        assert_eq!(bracket_keyframes(&times, 5.0), Some((1, 2, 1.0)));
        assert_eq!(bracket_keyframes(&[], 0.0), None);
    }

    #[test]
    fn sample_vec3_lerps_between_keyframes() {
        let ch = AnimChannel {
            node: 0, target: AnimTarget::Translation,
            times: vec![0.0, 2.0],
            values3: vec![[0.0, 0.0, 0.0], [2.0, 0.0, 0.0]],
            values4: vec![],
        };
        assert_eq!(sample_vec3(&ch, 1.0), Some(Vec3::new(1.0, 0.0, 0.0)));
    }

    #[test]
    fn sample_quat_slerps_between_keyframes() {
        let identity = glam::Quat::IDENTITY;
        let half_turn_y = glam::Quat::from_rotation_y(std::f32::consts::PI);
        let ch = AnimChannel {
            node: 0, target: AnimTarget::Rotation,
            times: vec![0.0, 1.0],
            values3: vec![],
            values4: vec![identity.to_array(), half_turn_y.to_array()],
        };
        let mid = sample_quat(&ch, 0.5).unwrap();
        let expected = identity.slerp(half_turn_y, 0.5);
        assert!((mid.dot(expected)).abs() > 0.999);
    }

    #[test]
    fn ray_aabb_hits_and_misses() {
        let hit = ray_aabb(Vec3::new(0.0, 0.0, -5.0), Vec3::Z, Vec3::splat(-1.0), Vec3::splat(1.0));
        assert_eq!(hit, Some(4.0));
        let miss = ray_aabb(Vec3::new(5.0, 0.0, -5.0), Vec3::Z, Vec3::splat(-1.0), Vec3::splat(1.0));
        assert_eq!(miss, None);
    }

    #[test]
    fn ray_sphere_hits_and_misses() {
        let hit = ray_sphere(Vec3::new(0.0, 0.0, -5.0), Vec3::Z, 1.0);
        assert_eq!(hit, Some(4.0));
        let miss = ray_sphere(Vec3::new(5.0, 0.0, -5.0), Vec3::Z, 1.0);
        assert_eq!(miss, None);
    }

    #[test]
    fn ray_plane_bounded_hits_within_extent_and_misses_outside() {
        let hit = ray_plane_bounded(Vec3::new(0.0, 1.0, 0.0), -Vec3::Y);
        assert_eq!(hit, Some(1.0));
        let miss = ray_plane_bounded(Vec3::new(10.0, 1.0, 0.0), -Vec3::Y);
        assert_eq!(miss, None);
    }

    #[test]
    fn tint_rgba8_multiplies_channels_and_clamps() {
        let mut px = [200u8, 100, 50, 255];
        tint_rgba8(&mut px, [0.5, 2.0, 1.0, 1.0]);
        assert_eq!(px, [100, 200, 50, 255]);

        // Values that would overflow 255 are clamped.
        let mut px2 = [200u8, 0, 0, 0];
        tint_rgba8(&mut px2, [2.0, 1.0, 1.0, 1.0]);
        assert_eq!(px2, [255, 0, 0, 0]);
    }
}
