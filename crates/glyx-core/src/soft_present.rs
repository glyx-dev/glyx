//! Software present surface for CPU-rendered (TinySkia) apps.
//!
//! Presents the tiny-skia pixmap directly to the window through the OS
//! blitting primitive (Win32 DIB / X11 SHM / Wayland shm / CoreGraphics)
//! via `softbuffer`.  No wgpu instance, device, staging buffers, or DX12
//! swapchain exist in this mode — removing ~20 MB private + ~47 MB
//! GPU-shared RSS on integrated GPUs where GPU memory is system RAM.

use std::num::NonZeroU32;
use std::sync::Arc;
use winit::window::Window;

pub(crate) struct SoftPresent {
    // Context must outlive surface; kept together here.
    _context: softbuffer::Context<Arc<Window>>,
    surface:  softbuffer::Surface<Arc<Window>, Arc<Window>>,
    width:    u32,
    height:   u32,
    /// Copy of the last presented frame (0RGB u32) so unchanged frames can be
    /// re-presented without re-rasterizing (softbuffer does not guarantee the
    /// swap buffer preserves contents between frames).
    last_frame: Vec<u32>,
    /// For frame pacing (see `pace`).
    window:       Arc<Window>,
    last_present: Option<std::time::Instant>,
    /// How long the last `pace` slept (not work; excluded from present time).
    last_pace: std::time::Duration,
    /// `window.maxFps` from config; `None` = monitor refresh rate.
    max_fps:      Option<u32>,
}

impl SoftPresent {
    pub fn new(window: Arc<Window>, max_fps: Option<u32>) -> Result<Self, String> {
        let size = window.inner_size();
        let context = softbuffer::Context::new(Arc::clone(&window))
            .map_err(|e| format!("softbuffer context: {e}"))?;
        let mut surface = softbuffer::Surface::new(&context, Arc::clone(&window))
            .map_err(|e| format!("softbuffer surface: {e}"))?;
        let w = size.width.max(1);
        let h = size.height.max(1);
        surface
            .resize(NonZeroU32::new(w).unwrap(), NonZeroU32::new(h).unwrap())
            .map_err(|e| format!("softbuffer resize: {e}"))?;
        log::info!("glyx-core: software present active ({w}x{h}, no wgpu).");
        Ok(Self {
            _context: context, surface, width: w, height: h, last_frame: Vec::new(),
            window, last_present: None, last_pace: std::time::Duration::ZERO, max_fps,
        })
    }

    /// Milliseconds the last present spent sleeping for frame pacing.
    pub fn last_pace_ms(&self) -> f64 { self.last_pace.as_secs_f64() * 1000.0 }

    pub fn width(&self)  -> u32 { self.width }
    pub fn height(&self) -> u32 { self.height }

    /// The last presented frame as `(width, height, 0RGB pixels)`, or `None`
    /// before the first full frame (or right after a resize).
    pub fn last_frame(&self) -> Option<(u32, u32, &[u32])> {
        let total = (self.width * self.height) as usize;
        (self.last_frame.len() == total).then(|| (self.width, self.height, &self.last_frame[..]))
    }

    pub fn resize(&mut self, w: u32, h: u32) {
        let w = w.max(1);
        let h = h.max(1);
        if w == self.width && h == self.height { return; }
        self.width  = w;
        self.height = h;
        self.last_frame.clear();
        if let Err(e) = self
            .surface
            .resize(NonZeroU32::new(w).unwrap(), NonZeroU32::new(h).unwrap())
        {
            log::warn!("softbuffer resize failed: {e}");
        }
    }

    /// Present premultiplied RGBA8 pixels (tiny-skia layout) to the window.
    ///
    /// The top-level pixmap is always opaque (window background underneath),
    /// so premultiplied == straight and the conversion is a channel shuffle:
    /// RGBA bytes → 0x00RRGGBB u32 (softbuffer's format).
    ///
    /// With `damage: Some((x, y, dw, dh))` only that region is converted and
    /// pushed to the OS (`present_with_damage`), so a keystroke costs one text
    /// line's worth of pixels rather than the whole window.  Requires a valid
    /// `last_frame` (pixels outside the damage region are refreshed from it,
    /// since the OS swap buffer's previous contents aren't guaranteed).
    /// Keep back-to-back presents at most one per display refresh.
    ///
    /// The GPU and Direct2D paths present with vsync, which blocks until the
    /// next refresh. softbuffer presents immediately, so a continuous redraw
    /// (an animation, video, a drag) otherwise renders as fast as the CPU
    /// allows, several times the refresh rate, with every extra frame thrown
    /// away. A frame after idle never waits.
    fn pace(&mut self) {
        let hz = self.window.current_monitor()
            .and_then(|m| m.refresh_rate_millihertz())
            .map_or(60.0, |mhz| mhz as f64 / 1000.0)
            .clamp(30.0, 500.0)
            .min(self.max_fps.map_or(f64::INFINITY, f64::from));
        let interval = std::time::Duration::from_secs_f64(1.0 / hz);
        self.last_pace = std::time::Duration::ZERO;
        if let Some(last) = self.last_present {
            let since = last.elapsed();
            if since < interval {
                self.last_pace = interval - since;
                std::thread::sleep(interval - since);
            }
        }
        self.last_present = Some(std::time::Instant::now());
    }

    pub fn present_rgba(&mut self, rgba: &[u8], w: u32, h: u32,
                        damage: Option<(u32, u32, u32, u32)>) {
        self.pace();
        if w != self.width || h != self.height {
            // Stale frame from just before a resize — drop it; the next
            // redraw renders at the new size.
            return;
        }
        let total = (w as usize) * (h as usize);
        if rgba.len() / 4 < total { return; }

        // Partial present is only safe when we hold a full previous frame.
        let damage = match damage {
            Some(d) if self.last_frame.len() == total => Some(d),
            _ => None,
        };

        let mut buffer = match self.surface.buffer_mut() {
            Ok(b) => b,
            Err(e) => { log::warn!("softbuffer buffer_mut: {e}"); return; }
        };
        if buffer.len() < total { return; }

        match damage {
            None => {
                rgba_to_0rgb(&rgba[..total * 4], &mut buffer[..total]);
                self.last_frame.clear();
                self.last_frame.extend_from_slice(&buffer[..total]);
                if let Err(e) = buffer.present() {
                    log::warn!("softbuffer present: {e}");
                }
            }
            Some((dx, dy, dw, dh)) => {
                let dx = dx.min(w) as usize;
                let dy = dy.min(h) as usize;
                let dw = (dw as usize).min(w as usize - dx);
                let dh = (dh as usize).min(h as usize - dy);
                // The OS swap buffer may be double-buffered (contents undefined
                // or two frames old).  age()==1 means it holds last frame's
                // pixels; anything else → restore from our last_frame copy.
                if buffer.age() != 1 {
                    buffer.copy_from_slice(&self.last_frame[..total]);
                }
                // Convert only the damaged rows/cols.
                for row in dy..dy + dh {
                    let i = row * w as usize + dx;
                    rgba_to_0rgb(&rgba[i * 4..(i + dw) * 4], &mut buffer[i..i + dw]);
                    self.last_frame[i..i + dw].copy_from_slice(&buffer[i..i + dw]);
                }
                let rect = softbuffer::Rect {
                    x: dx as u32, y: dy as u32,
                    width:  std::num::NonZeroU32::new(dw.max(1) as u32).unwrap(),
                    height: std::num::NonZeroU32::new(dh.max(1) as u32).unwrap(),
                };
                if let Err(e) = buffer.present_with_damage(&[rect]) {
                    log::warn!("softbuffer present_with_damage: {e}");
                }
            }
        }
    }

    /// Re-present the previous frame without re-rasterizing (fast path for
    /// frames where neither the scene nor the overlay changed). Only called
    /// from the dev-mode cached-frame fast path in `lib.rs` — unused (and
    /// correctly compiled out) in non-dev release builds.
    #[cfg(feature = "dev")]
    pub fn re_present(&mut self) {
        if self.last_frame.is_empty() { return; }
        let mut buffer = match self.surface.buffer_mut() {
            Ok(b) => b,
            Err(e) => { log::warn!("softbuffer buffer_mut: {e}"); return; }
        };
        let n = self.last_frame.len().min(buffer.len());
        buffer[..n].copy_from_slice(&self.last_frame[..n]);
        if let Err(e) = buffer.present() {
            log::warn!("softbuffer present: {e}");
        }
    }
}

/// RGBA8 bytes → softbuffer's 0x00RRGGBB, `dst.len()` pixels. Written as a
/// straight zip over exact 4-byte chunks so it compiles to a tight,
/// vectorizable loop (no per-pixel slicing or bounds checks).
fn rgba_to_0rgb(src: &[u8], dst: &mut [u32]) {
    for (d, p) in dst.iter_mut().zip(src.chunks_exact(4)) {
        *d = ((p[0] as u32) << 16) | ((p[1] as u32) << 8) | (p[2] as u32);
    }
}

#[cfg(test)]
mod tests {
    #[test]
    fn rgba_converts_to_0rgb() {
        let src = [1u8, 2, 3, 255, 0xAA, 0xBB, 0xCC, 0x10];
        let mut dst = [0u32; 2];
        super::rgba_to_0rgb(&src, &mut dst);
        assert_eq!(dst, [0x0001_0203, 0x00AA_BBCC]);
    }
}
