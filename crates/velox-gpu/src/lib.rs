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
    #[error("Failed to request adapter: {0}")]
    AdapterRequest(#[from] wgpu::RequestAdapterError),
    #[error("Failed to request device: {0}")]
    DeviceRequest(#[from] wgpu::RequestDeviceError),
    #[error("Failed to create surface: {0}")]
    SurfaceCreation(#[from] wgpu::CreateSurfaceError),
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
    /// Try backend sets in priority order and return the first working
    /// (surface, adapter) pair.
    ///
    /// On Windows we probe DX12 first: the Intel/AMD Vulkan drivers pre-allocate
    /// large memory pools upfront, which on integrated-GPU hardware (where GPU
    /// memory IS system RAM) inflates process RSS by 200–300 MB.  DX12 allocates
    /// on demand and avoids this.  We fall back to all backends if DX12 is
    /// unavailable (old Windows, VMs, CI runners without DX12 support).
    async fn pick_adapter(
        window: Arc<Window>,
    ) -> Result<(wgpu::Surface<'static>, wgpu::Adapter), GpuError> {
        #[cfg(target_os = "windows")]
        let sets: &[wgpu::Backends] = &[wgpu::Backends::DX12, wgpu::Backends::all()];
        #[cfg(not(target_os = "windows"))]
        let sets: &[wgpu::Backends] = &[wgpu::Backends::PRIMARY];

        for &backends in sets {
            let instance = wgpu::Instance::new(wgpu::InstanceDescriptor {
                backends,
                ..wgpu::InstanceDescriptor::new_without_display_handle()
            });
            // Surface borrows Arc<Window> — 'static is satisfied because Arc
            // keeps the window alive for the lifetime of GpuContext.
            let Ok(surface) = instance.create_surface(Arc::clone(&window)) else {
                continue;
            };
            let adapter = match instance
                .request_adapter(&wgpu::RequestAdapterOptions {
                    power_preference:       wgpu::PowerPreference::HighPerformance,
                    compatible_surface:     Some(&surface),
                    force_fallback_adapter: false,
                })
                .await
            {
                Ok(a)  => a,
                Err(_) => continue,
            };
            log::info!(
                "GPU adapter: {} ({:?})",
                adapter.get_info().name,
                adapter.get_info().backend,
            );
            return Ok((surface, adapter));
        }

        Err(GpuError::NoAdapter)
    }

    /// Create the GPU context from an existing window.
    ///
    /// `window` must already be visible (call this from `resumed()`).
    pub async fn new(window: Arc<Window>) -> Result<Self, GpuError> {
        let size = window.inner_size();

        let (surface, adapter) = Self::pick_adapter(Arc::clone(&window)).await?;

        let (device, queue) = adapter
            .request_device(
                &wgpu::DeviceDescriptor {
                    label:             Some("velox-device"),
                    required_features: wgpu::Features::empty(),
                    required_limits:   wgpu::Limits::default(),
                    // MemoryUsage: prefer smaller allocations over pre-allocated
                    // pools. Costs a small amount of GPU throughput but
                    // meaningfully reduces process RSS for UI-heavy workloads.
                    memory_hints:      wgpu::MemoryHints::MemoryUsage,
                    ..Default::default()
                },
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
            // AutoVsync: picks the best available vsync mode for the platform.
            // On Windows this avoids the DWM Fifo stall that costs ~5–15ms/frame.
            present_mode:                  wgpu::PresentMode::AutoVsync,
            alpha_mode:                    caps.alpha_modes[0],
            view_formats:                  vec![],
            // 2 = allows CPU to encode frame N+1 while GPU renders frame N.
            // Setting this to 1 serialises CPU+GPU and halves throughput on iGPU.
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
    pub fn current_texture(&self) -> Option<wgpu::SurfaceTexture> {
        match self.surface.get_current_texture() {
            wgpu::CurrentSurfaceTexture::Success(t)    => Some(t),
            wgpu::CurrentSurfaceTexture::Suboptimal(t) => Some(t),
            _ => None,
        }
    }

    pub fn surface_format(&self) -> wgpu::TextureFormat {
        self.config.format
    }

    pub fn width(&self)  -> u32 { self.config.width  }
    pub fn height(&self) -> u32 { self.config.height }
}
