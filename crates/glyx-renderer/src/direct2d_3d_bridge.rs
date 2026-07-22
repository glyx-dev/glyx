//! Canvas3D-on-Direct2D bridge (Phase 6 of the Direct2D plan).
//!
//! Direct2D has no wgpu surface of its own — `Present::Direct2D` owns a D3D11
//! device/DXGI swap chain via `windows`-crate COM handles, not a
//! `wgpu::Surface`. The TinySkia/Vello paths composite `glyx-3d`'s output
//! directly onto their live wgpu surface texture (`LoadOp::Load` + blit); that
//! trick isn't available here.
//!
//! Instead: `glyx-3d`'s `Renderer3D` renders into an offscreen texture the
//! size of the window, the pixels are read back to the CPU, and the Direct2D
//! backend draws that as a single image overlay on top of its already-drawn
//! 2D content — the same `ID2D1Bitmap`/`DrawBitmap` path already used for
//! `<Image>` nodes.
//!
//! This struct owns a fully independent, headless `wgpu::Device` — a second
//! GPU device alongside Direct2D's own `D3D11Device` in `d2d_present.rs`. A
//! device-sharing design (wrapping Direct2D's device via
//! `D3D11On12CreateDevice` so both sides use exactly one `wgpu::Device`) was
//! investigated and built, but abandoned: it requires recreating Direct2D's
//! swap chain against the window's already-live HWND, which hit a real
//! DXGI/driver restriction (`CreateSwapChainForHwnd: Access is denied`) that
//! forced the device to be created eagerly at window-creation time instead of
//! lazily — defeating Direct2D's cheap no-3D baseline for every window, for a
//! measured memory result that came out no better than this simpler
//! independent-device version once both were given the same
//! `MemoryHints::MemoryUsage` device-request setting (see `new()` below).
//! Kept simple and lazy: this bridge (and its device) is only created on the
//! first `<Canvas3D>` node under a Direct2D-backed window, and torn down
//! after 60s of 3D inactivity.
//!
//! The CPU readback step is a further known cost (not removed here) — a
//! zero-copy path would need the same device-sharing this file deliberately
//! avoids, so it's not pursued for now.

use std::collections::HashMap;

use glyx_3d::{Renderer3D, Scene3D};

/// Independent headless `wgpu::Device` + `Renderer3D` + offscreen compose
/// target for the Canvas3D-on-Direct2D bridge. Lazily created on first
/// Canvas3D node under a Direct2D-backed window, torn down after 60s of 3D
/// inactivity — same policy as the TinySkia/Vello soft→wgpu upgrade, driven
/// from glyx-core.
pub struct Direct2DGpuBridge {
    device: wgpu::Device,
    queue:  wgpu::Queue,
    renderer_3d: Renderer3D,
    compose_tex:  wgpu::Texture,
    compose_view: wgpu::TextureView,
    width:  u32,
    height: u32,
}

/// sRGB Rgba8Unorm — matches the format the rest of this codebase already
/// uses for offscreen intermediates (Vello's `RenderTarget`, TinySkia's GPU
/// upload texture) — no extra color-space handling needed at this layer.
const COMPOSE_FORMAT: wgpu::TextureFormat = wgpu::TextureFormat::Rgba8Unorm;

/// wgpu requires `bytes_per_row` in a texture→buffer copy to be a multiple of
/// 256. Rgba8 is 4 bytes/pixel, so this rounds a row up to the nearest
/// 64-pixel boundary's worth of bytes.
fn padded_bytes_per_row(width: u32) -> u32 {
    let unpadded = width * 4;
    let align = wgpu::COPY_BYTES_PER_ROW_ALIGNMENT;
    (unpadded + align - 1) / align * align
}

impl Direct2DGpuBridge {
    /// Stands up its own headless `wgpu::Device` (DX12 backend, no window
    /// surface — Direct2D owns presentation) plus `Renderer3D` and an
    /// offscreen compose texture. Blocks on device creation internally
    /// (`pollster::block_on`) so callers stay synchronous, matching the
    /// lazy-upgrade call site in `glyx-core`.
    pub fn new(width: u32, height: u32) -> Result<Self, String> {
        let width  = width.max(1);
        let height = height.max(1);

        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            backends: wgpu::Backends::DX12,
            flags: wgpu::InstanceFlags::from_build_config()
                .difference(wgpu::InstanceFlags::VALIDATION)
                .with_env(),
            ..wgpu::InstanceDescriptor::new_without_display_handle()
        });
        let adapter = pollster::block_on(instance.request_adapter(&wgpu::RequestAdapterOptions {
            power_preference:       wgpu::PowerPreference::HighPerformance,
            compatible_surface:     None, // headless — Direct2D owns presentation
            force_fallback_adapter: false,
        }))
        .map_err(|e| format!("Direct2D 3D bridge: no DX12 adapter: {e}"))?;
        let (device, queue) = pollster::block_on(adapter.request_device(&wgpu::DeviceDescriptor {
            label:             Some("glyx-d2d-3d-bridge-device"),
            required_limits:   wgpu::Limits::default(),
            // Prefer smaller on-demand allocations over wgpu's default
            // pre-allocated pools — matches glyx-gpu's real device request
            // (crates/glyx-gpu/src/lib.rs); without this a headless device
            // alone measured 3-4x the RSS of an equivalent tuned device.
            memory_hints:      wgpu::MemoryHints::MemoryUsage,
            ..Default::default()
        }))
        .map_err(|e| format!("Direct2D 3D bridge: request_device failed: {e}"))?;

        let renderer_3d = Renderer3D::new(&device, &queue, COMPOSE_FORMAT);
        let (compose_tex, compose_view) = Self::make_compose_target(&device, width, height);
        Ok(Self { device, queue, renderer_3d, compose_tex, compose_view, width, height })
    }

    fn make_compose_target(device: &wgpu::Device, width: u32, height: u32) -> (wgpu::Texture, wgpu::TextureView) {
        let tex = device.create_texture(&wgpu::TextureDescriptor {
            label: Some("d2d-3d-compose"),
            size: wgpu::Extent3d { width, height, depth_or_array_layers: 1 },
            mip_level_count: 1,
            sample_count: 1,
            dimension: wgpu::TextureDimension::D2,
            format: COMPOSE_FORMAT,
            usage: wgpu::TextureUsages::RENDER_ATTACHMENT
                 | wgpu::TextureUsages::TEXTURE_BINDING
                 | wgpu::TextureUsages::COPY_SRC,
            view_formats: &[],
        });
        let view = tex.create_view(&Default::default());
        (tex, view)
    }

    fn resize(&mut self, width: u32, height: u32) {
        let width  = width.max(1);
        let height = height.max(1);
        if width == self.width && height == self.height { return; }
        let (tex, view) = Self::make_compose_target(&self.device, width, height);
        self.compose_tex  = tex;
        self.compose_view = view;
        self.width  = width;
        self.height = height;
    }

    /// Render every Canvas3D overlay for this frame and return the composed
    /// result as straight-alpha RGBA8 bytes the size of the window — fully
    /// transparent everywhere except the overlay rects, ready to be drawn as
    /// a single full-window image on top of Direct2D's already-drawn 2D
    /// content. Returns `None` if there's nothing to render this frame.
    pub fn render_overlays(
        &mut self,
        overlays: &[(u32, f32, f32, f32, f32)],
        scenes: &HashMap<u32, Scene3D>,
        window_width: u32,
        window_height: u32,
    ) -> Option<Vec<u8>> {
        if overlays.is_empty() { return None; }
        self.resize(window_width, window_height);
        let (device, queue) = (&self.device, &self.queue);

        // Clear the whole compose target to transparent first — Renderer3D::render
        // uses LoadOp::Load (it's designed to preserve existing 2D content on the
        // TinySkia/Vello paths), so without an explicit clear pass here, stale
        // content from a previous frame — or undefined memory on the very first
        // frame — would persist outside each overlay's own rect.
        {
            let mut enc = device.create_command_encoder(
                &wgpu::CommandEncoderDescriptor { label: Some("d2d-3d-clear") });
            enc.begin_render_pass(&wgpu::RenderPassDescriptor {
                label: Some("d2d-3d-clear-pass"),
                color_attachments: &[Some(wgpu::RenderPassColorAttachment {
                    view: &self.compose_view, resolve_target: None, depth_slice: None,
                    ops: wgpu::Operations {
                        load: wgpu::LoadOp::Clear(wgpu::Color::TRANSPARENT),
                        store: wgpu::StoreOp::Store,
                    },
                })],
                depth_stencil_attachment: None,
                ..Default::default()
            });
            queue.submit([enc.finish()]);
        }

        let sw = window_width  as f32;
        let sh = window_height as f32;
        for &(canvas_id, x, y, w, h) in overlays {
            let Some(scene) = scenes.get(&canvas_id) else { continue };
            self.renderer_3d.render(
                device, queue,
                canvas_id, scene,
                x, y, w, h,
                &self.compose_view, sw, sh,
            );
        }

        // Read back: copy_texture_to_buffer requires the row stride to be
        // 256-byte aligned, so the staging buffer is padded per row and we
        // strip the padding back out below.
        let bpr = padded_bytes_per_row(self.width);
        let buf_size = (bpr as u64) * (self.height as u64);
        let staging = device.create_buffer(&wgpu::BufferDescriptor {
            label: Some("d2d-3d-readback"),
            size: buf_size,
            usage: wgpu::BufferUsages::COPY_DST | wgpu::BufferUsages::MAP_READ,
            mapped_at_creation: false,
        });

        let mut enc = device.create_command_encoder(
            &wgpu::CommandEncoderDescriptor { label: Some("d2d-3d-readback-enc") });
        enc.copy_texture_to_buffer(
            wgpu::TexelCopyTextureInfo {
                texture: &self.compose_tex, mip_level: 0,
                origin: wgpu::Origin3d::ZERO, aspect: wgpu::TextureAspect::All,
            },
            wgpu::TexelCopyBufferInfo {
                buffer: &staging,
                layout: wgpu::TexelCopyBufferLayout {
                    offset: 0, bytes_per_row: Some(bpr), rows_per_image: None,
                },
            },
            wgpu::Extent3d { width: self.width, height: self.height, depth_or_array_layers: 1 },
        );
        queue.submit([enc.finish()]);

        // Synchronous map — acceptable here since this whole bridge is
        // already a "correctness first" v1 (see module doc); this blocks the
        // render thread for one GPU round trip per Canvas3D-on-Direct2D frame.
        let slice = staging.slice(..);
        let (tx, rx) = std::sync::mpsc::channel();
        slice.map_async(wgpu::MapMode::Read, move |r| { let _ = tx.send(r); });
        device.poll(wgpu::PollType::Wait { submission_index: None, timeout: None }).ok()?;
        rx.recv().ok()?.ok()?;

        let padded = slice.get_mapped_range();
        let row_bytes = (self.width * 4) as usize;
        let mut out = Vec::with_capacity(row_bytes * self.height as usize);
        for row in 0..self.height as usize {
            let start = row * bpr as usize;
            out.extend_from_slice(&padded[start..start + row_bytes]);
        }
        drop(padded);
        staging.unmap();

        Some(out)
    }
}
