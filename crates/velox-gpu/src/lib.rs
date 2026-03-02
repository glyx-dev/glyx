//! velox-gpu — wgpu device, queue, surface, and adapter management.
//!
//! This crate owns every GPU resource. Nothing else touches `Device`,
//! `Queue`, or `Surface` directly. Other crates receive a `&GpuContext`
//! and call methods on it.

use std::sync::Arc;
use thiserror::Error;
use winit::window::Window;

#[derive(Debug, Error)]
pub enum GpuError {
    #[error("No suitable GPU adapter found")]
    NoAdapter,
    #[error("Failed to request device: {0}")]
    DeviceRequest(#[from] wgpu::RequestDeviceError),
    #[error("Failed to create surface: {0}")]
    SurfaceCreation(#[from] wgpu::CreateSurfaceError),
    #[error("Surface error: {0}")]
    Surface(#[from] wgpu::SurfaceError),
}

/// Everything wgpu-related, owned in one place.
pub struct GpuContext {
    pub device:  wgpu::Device,
    pub queue:   wgpu::Queue,
    pub surface: wgpu::Surface<'static>,
    pub config:  wgpu::SurfaceConfiguration,
    pub adapter: wgpu::Adapter,
}

impl GpuContext {
    /// Create the GPU context from an existing window.
    ///
    /// `window` must already be visible (call this from `resumed()`).
    pub async fn new(window: Arc<Window>) -> Result<Self, GpuError> {
        let size = window.inner_size();

        let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
            // Prefer Vulkan > Metal > DX12 > GL — wgpu picks best available.
            backends: wgpu::Backends::all(),
            ..Default::default()
        });

        // Safety: `window` is Arc-owned and outlives `surface` because both
        // are stored together in GpuContext. The 'static bound is satisfied
        // by the Arc keeping the window alive.
        let surface = instance.create_surface(window)?;

        let adapter = instance
            .request_adapter(&wgpu::RequestAdapterOptions {
                power_preference:       wgpu::PowerPreference::HighPerformance,
                compatible_surface:     Some(&surface),
                force_fallback_adapter: false,
            })
            .await
            .ok_or(GpuError::NoAdapter)?;

        log::info!(
            "GPU adapter: {} ({:?})",
            adapter.get_info().name,
            adapter.get_info().backend
        );

        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label:             Some("velox-device"),
                    required_features: wgpu::Features::empty(),
                    required_limits:   wgpu::Limits::default(),
                    memory_hints:      wgpu::MemoryHints::default(),
                },
                None,
            )
            .await?;

        let caps   = surface.get_capabilities(&adapter);
        // Prefer sRGB surface formats; fall back to whatever is available.
        let format = caps
            .formats
            .iter()
            .copied()
            .find(|f| f.is_srgb())
            .unwrap_or(caps.formats[0]);

        let config = wgpu::SurfaceConfiguration {
            usage:                         wgpu::TextureUsages::RENDER_ATTACHMENT,
            format,
            width:                         size.width.max(1),
            height:                        size.height.max(1),
            present_mode:                  wgpu::PresentMode::Fifo,
            alpha_mode:                    caps.alpha_modes[0],
            view_formats:                  vec![],
            desired_maximum_frame_latency: 2,
        };
        surface.configure(&device, &config);

        Ok(Self { device, queue, surface, config, adapter })
    }

    /// Reconfigure the surface after a window resize.
    ///
    /// Safe to call with any size — zero dimensions are clamped to 1 so wgpu
    /// never panics on a minimized window.
    pub fn resize(&mut self, width: u32, height: u32) {
        let w = width.max(1);
        let h = height.max(1);
        if w == self.config.width && h == self.config.height {
            return; // no-op if size unchanged
        }
        self.config.width  = w;
        self.config.height = h;
        self.surface.configure(&self.device, &self.config);
        log::debug!("Surface reconfigured: {}×{}", w, h);
    }

    /// Acquire the next frame texture.
    ///
    /// Returns `None` on `Outdated`/`Lost` — the caller should call
    /// `resize()` with the current window size and retry next frame.
    pub fn current_texture(&self) -> Result<wgpu::SurfaceTexture, GpuError> {
        Ok(self.surface.get_current_texture()?)
    }

    pub fn surface_format(&self) -> wgpu::TextureFormat {
        self.config.format
    }

    pub fn width(&self)  -> u32 { self.config.width  }
    pub fn height(&self) -> u32 { self.config.height }
}
