//! Direct2D present target — experimental Windows-only backend for
//! `renderMode: 'direct2d'` (see `glyx_shell::RenderMode::Direct2D`).
//!
//! Owns a D3D11 device + DXGI swap chain + `ID2D1DeviceContext` bound to the
//! window's HWND. Unlike `soft_present.rs` (pure CPU, no GPU at all), this
//! genuinely uses the GPU — but through the OS's own Direct2D/DirectWrite
//! caches rather than an app-owned scene/compute-buffer pool (Vello's
//! approach). Session profiling (see plan doc) measured this pattern at
//! ~32.5 MB idle with zero growth under a 500-repaint burst, vs. Vello's
//! ~350-700 MB range under the same stress — because D2D's resource caches
//! are managed by the driver and shared system-wide, not privately allocated
//! per app.

#![cfg(target_os = "windows")]

use std::sync::Arc;
use winit::window::Window;

use windows::core::Interface;
use windows::Win32::Foundation::HWND;
use windows::Win32::Graphics::Direct2D::Common::*;
use windows::Win32::Graphics::Direct2D::*;
use windows::Win32::Graphics::Direct3D::D3D_DRIVER_TYPE_HARDWARE;
use windows::Win32::Graphics::Direct3D11::*;
use windows::Win32::Graphics::Dxgi::Common::*;
use windows::Win32::Graphics::Dxgi::*;

pub(crate) struct D2DPresent {
    _d3d_device:  ID3D11Device,
    swap_chain:   IDXGISwapChain1,
    d2d_context:  ID2D1DeviceContext,
    width:        u32,
    height:       u32,
}

impl D2DPresent {
    pub fn new(window: Arc<Window>) -> Result<Self, String> {
        use raw_window_handle::{HasWindowHandle, RawWindowHandle};

        let hwnd = match window
            .window_handle()
            .map_err(|e| format!("no window handle: {e}"))?
            .as_raw()
        {
            RawWindowHandle::Win32(h) => HWND(h.hwnd.get() as *mut core::ffi::c_void),
            _ => return Err("D2DPresent requires a Win32 window handle".into()),
        };

        let size = window.inner_size();
        let w = size.width.max(1);
        let h = size.height.max(1);

        unsafe {
            let mut d3d_device: Option<ID3D11Device> = None;
            let mut d3d_context: Option<ID3D11DeviceContext> = None;
            D3D11CreateDevice(
                None,
                D3D_DRIVER_TYPE_HARDWARE,
                None,
                D3D11_CREATE_DEVICE_BGRA_SUPPORT,
                None,
                D3D11_SDK_VERSION,
                Some(&mut d3d_device),
                None,
                Some(&mut d3d_context),
            )
            .map_err(|e| format!("D3D11CreateDevice: {e}"))?;
            let d3d_device = d3d_device.ok_or("D3D11CreateDevice returned no device")?;

            let dxgi_device: IDXGIDevice = d3d_device
                .cast()
                .map_err(|e| format!("ID3D11Device -> IDXGIDevice: {e}"))?;
            let dxgi_adapter = dxgi_device
                .GetAdapter()
                .map_err(|e| format!("IDXGIDevice::GetAdapter: {e}"))?;
            let dxgi_factory: IDXGIFactory2 = dxgi_adapter
                .GetParent()
                .map_err(|e| format!("IDXGIAdapter::GetParent -> IDXGIFactory2: {e}"))?;

            let swap_chain_desc = DXGI_SWAP_CHAIN_DESC1 {
                Width: w,
                Height: h,
                Format: DXGI_FORMAT_B8G8R8A8_UNORM,
                Stereo: false.into(),
                SampleDesc: DXGI_SAMPLE_DESC { Count: 1, Quality: 0 },
                BufferUsage: DXGI_USAGE_RENDER_TARGET_OUTPUT,
                BufferCount: 2,
                Scaling: DXGI_SCALING_STRETCH,
                SwapEffect: DXGI_SWAP_EFFECT_FLIP_DISCARD,
                AlphaMode: DXGI_ALPHA_MODE_IGNORE,
                Flags: 0,
            };
            let swap_chain = dxgi_factory
                .CreateSwapChainForHwnd(&d3d_device, hwnd, &swap_chain_desc, None, None)
                .map_err(|e| format!("CreateSwapChainForHwnd: {e}"))?;

            let d2d_factory: ID2D1Factory1 =
                D2D1CreateFactory(D2D1_FACTORY_TYPE_SINGLE_THREADED, None)
                    .map_err(|e| format!("D2D1CreateFactory: {e}"))?;
            let d2d_device = d2d_factory
                .CreateDevice(&dxgi_device)
                .map_err(|e| format!("ID2D1Factory1::CreateDevice: {e}"))?;
            let d2d_context = d2d_device
                .CreateDeviceContext(D2D1_DEVICE_CONTEXT_OPTIONS_NONE)
                .map_err(|e| format!("ID2D1Device::CreateDeviceContext: {e}"))?;

            bind_target_bitmap(&swap_chain, &d2d_context)?;

            log::info!("glyx-core: Direct2D present active ({w}x{h}, experimental).");

            Ok(Self {
                _d3d_device: d3d_device,
                swap_chain,
                d2d_context,
                width: w,
                height: h,
            })
        }
    }

    pub fn width(&self) -> u32 { self.width }
    pub fn height(&self) -> u32 { self.height }

    /// The device context frames draw into. Borrowed by `Direct2DFrame`
    /// during `begin_frame`/draw calls; not owned by the renderer since the
    /// swap chain (and thus the target bitmap bound to it) lives here.
    pub fn device_context(&self) -> &ID2D1DeviceContext { &self.d2d_context }

    pub fn resize(&mut self, w: u32, h: u32) {
        let w = w.max(1);
        let h = h.max(1);
        if w == self.width && h == self.height { return; }
        self.width = w;
        self.height = h;
        unsafe {
            // The device context must release its reference to the old
            // target bitmap before ResizeBuffers, or DXGI refuses (buffers
            // still "in use").
            self.d2d_context.SetTarget(None);
            if let Err(e) = self.swap_chain.ResizeBuffers(
                0, w, h, DXGI_FORMAT_UNKNOWN, DXGI_SWAP_CHAIN_FLAG(0),
            ) {
                log::warn!("D2D swap chain ResizeBuffers failed: {e}");
                return;
            }
            if let Err(e) = bind_target_bitmap(&self.swap_chain, &self.d2d_context) {
                log::warn!("D2D re-bind target bitmap after resize failed: {e}");
            }
        }
    }

    /// Present the swap chain after the frame's `EndDraw()` has already run
    /// (called from `Direct2DFrame`'s finish path, not here — this struct
    /// only owns the swap chain, drawing happens through `device_context()`).
    pub fn present(&self) {
        unsafe {
            let hr = self.swap_chain.Present(1, DXGI_PRESENT(0));
            if hr.is_err() {
                log::warn!("D2D swap chain Present failed: {hr:?}");
            }
        }
    }
}

unsafe fn bind_target_bitmap(
    swap_chain: &IDXGISwapChain1,
    d2d_context: &ID2D1DeviceContext,
) -> Result<(), String> {
    let dxgi_back_buffer: IDXGISurface = swap_chain
        .GetBuffer(0)
        .map_err(|e| format!("IDXGISwapChain1::GetBuffer: {e}"))?;
    let bitmap_props = D2D1_BITMAP_PROPERTIES1 {
        pixelFormat: D2D1_PIXEL_FORMAT {
            format: DXGI_FORMAT_B8G8R8A8_UNORM,
            alphaMode: D2D1_ALPHA_MODE_IGNORE,
        },
        dpiX: 96.0,
        dpiY: 96.0,
        bitmapOptions: D2D1_BITMAP_OPTIONS_TARGET | D2D1_BITMAP_OPTIONS_CANNOT_DRAW,
        colorContext: std::mem::ManuallyDrop::new(None),
    };
    let target_bitmap = d2d_context
        .CreateBitmapFromDxgiSurface(&dxgi_back_buffer, Some(&bitmap_props))
        .map_err(|e| format!("CreateBitmapFromDxgiSurface: {e}"))?;
    d2d_context.SetTarget(&target_bitmap);
    Ok(())
}
