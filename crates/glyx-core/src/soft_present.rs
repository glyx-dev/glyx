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

/// A layer drawn over the finished frame at present time (the dev overlays): premultiplied RGBA8 pixels for the whole
/// window, and the box `[x, y, w, h]` that has anything in it. The frame the app's own drawing leaves in the retained
/// pixmap (and in `last_frame`) never contains it, so changing or removing an overlay does not mean repainting the app.
#[derive(Clone, Copy)]
pub(crate) struct OverlayPixels<'a> {
    pub rgba: &'a [u8],
    pub bbox: [u32; 4],
}

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
    /// Whether an overlay was composited into the window buffer at the last present: the buffer holds its pixels until it
    /// is restored from `last_frame`.
    overlay_shown: bool,
}

/// The time between presents for a monitor of `monitor_hz` and a `render.maxFps` cap (0 = none): the monitor's rate, held to 30 to 500 Hz,
/// lowered to the cap. A cap below 15 acts as 15, so a stray value cannot make the window look frozen.
pub(crate) fn frame_interval(monitor_hz: f64, max_fps: i64) -> std::time::Duration {
    let mut hz = monitor_hz.clamp(30.0, 500.0);
    if max_fps > 0 {
        hz = hz.min(max_fps.clamp(15, 500) as f64);
    }
    std::time::Duration::from_secs_f64(1.0 / hz)
}

impl SoftPresent {
    pub fn new(window: Arc<Window>) -> Result<Self, String> {
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
            window, last_present: None, last_pace: std::time::Duration::ZERO, overlay_shown: false,
        })
    }

    /// Milliseconds the last present spent sleeping for frame pacing.
    pub fn last_pace_ms(&self) -> f64 { self.last_pace.as_secs_f64() * 1000.0 }

    pub fn width(&self)  -> u32 { self.width }
    pub fn height(&self) -> u32 { self.height }

    /// The last presented frame as `(width, height, 0RGB pixels)`, or `None`
    /// before the first full frame (or right after a resize).
    #[cfg_attr(not(feature = "dev"), allow(dead_code))] // DevTools only
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
        self.overlay_shown = false;
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
    /// With `damage: Some(rects)` only those regions are converted and
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
    ///
    /// The cap is the `render.maxFps` setting, read on every present, so a change (DevTools, or app JavaScript where the app allows it)
    /// applies to the next frame.
    fn pace(&mut self) {
        let monitor_hz = self.window.current_monitor()
            .and_then(|m| m.refresh_rate_millihertz())
            .map_or(60.0, |mhz| mhz as f64 / 1000.0);
        let interval = frame_interval(monitor_hz, glyx_settings::global().int("render.maxFps"));
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

    /// `overlay`: a layer composited over the frame in the window's buffer only; `last_frame` stays the clean frame.
    pub fn present_rgba(&mut self, rgba: &[u8], w: u32, h: u32,
                        damage: Option<&[(u32, u32, u32, u32)]>, overlay: Option<OverlayPixels>) {
        self.pace();
        if w != self.width || h != self.height {
            // Stale frame from just before a resize — drop it; the next
            // redraw renders at the new size.
            return;
        }
        let total = (w as usize) * (h as usize);
        if rgba.len() / 4 < total { return; }

        // The overlay, when there is anything in it; and whether one was composited last time.
        let overlay = overlay.filter(|o| o.bbox[2] > 0 && o.bbox[3] > 0 && o.rgba.len() / 4 >= total);
        let overlay_before = self.overlay_shown;

        // Partial present is only safe when we hold a full previous frame.
        let damage = match damage {
            Some(d) if self.last_frame.len() == total && !d.is_empty() => Some(d),
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
                if let Some(o) = overlay { composite_overlay(&mut buffer[..total], w as usize, &o); }
                if let Err(e) = buffer.present() {
                    log::warn!("softbuffer present: {e}");
                }
            }
            Some(rects) => {
                // The OS swap buffer may be double-buffered (contents undefined
                // or two frames old).  age()==1 means it holds last frame's
                // pixels; anything else → restore from our last_frame copy.
                // The buffer also still shows last time's overlay: restore it from the clean frame too.
                if buffer.age() != 1 || overlay_before {
                    buffer.copy_from_slice(&self.last_frame[..total]);
                }
                // Convert only the damaged rows/cols, rect by rect.
                let mut os_rects = Vec::with_capacity(rects.len());
                for &(dx, dy, dw, dh) in rects {
                    let dx = dx.min(w) as usize;
                    let dy = dy.min(h) as usize;
                    let dw = (dw as usize).min(w as usize - dx);
                    let dh = (dh as usize).min(h as usize - dy);
                    for row in dy..dy + dh {
                        let i = row * w as usize + dx;
                        rgba_to_0rgb(&rgba[i * 4..(i + dw) * 4], &mut buffer[i..i + dw]);
                        self.last_frame[i..i + dw].copy_from_slice(&buffer[i..i + dw]);
                    }
                    os_rects.push(softbuffer::Rect {
                        x: dx as u32, y: dy as u32,
                        width:  std::num::NonZeroU32::new(dw.max(1) as u32).unwrap(),
                        height: std::num::NonZeroU32::new(dh.max(1) as u32).unwrap(),
                    });
                }
                if let Some(o) = overlay {
                    composite_overlay(&mut buffer[..total], w as usize, &o);
                }
                // An overlay changes pixels outside the app's damage (where it was, where it is): push the whole window.
                let pushed = if overlay.is_some() || overlay_before {
                    buffer.present()
                } else {
                    buffer.present_with_damage(&os_rects)
                };
                if let Err(e) = pushed {
                    log::warn!("softbuffer present: {e}");
                }
            }
        }
        self.overlay_shown = overlay.is_some();
    }

    /// Re-present the previous frame without re-rasterizing (fast path for
    /// frames where neither the scene nor the overlay changed). Only called
    /// from the dev-mode cached-frame fast path in `lib.rs` — unused (and
    /// correctly compiled out) in non-dev release builds.
    #[cfg(feature = "dev")]
    pub fn re_present(&mut self, overlay: Option<OverlayPixels>) {
        if self.last_frame.is_empty() { return; }
        let total = self.last_frame.len();
        let w = self.width as usize;
        let mut buffer = match self.surface.buffer_mut() {
            Ok(b) => b,
            Err(e) => { log::warn!("softbuffer buffer_mut: {e}"); return; }
        };
        let n = total.min(buffer.len());
        buffer[..n].copy_from_slice(&self.last_frame[..n]);
        let overlay = overlay.filter(|o| o.bbox[2] > 0 && o.bbox[3] > 0 && o.rgba.len() / 4 >= total);
        if let Some(o) = overlay { composite_overlay(&mut buffer[..n], w, &o); }
        if let Err(e) = buffer.present() {
            log::warn!("softbuffer present: {e}");
        }
        self.overlay_shown = overlay.is_some();
    }
}

/// The box `[x, y, w, h]` of the pixels in a premultiplied RGBA8 `w` x `h` image that are not fully transparent, or `None` when
/// the whole image is. Reads each pixel's alpha once, a row at a time.
#[cfg_attr(not(feature = "dev"), allow(dead_code))] // DevTools overlays only
pub(crate) fn pixel_bbox(rgba: &[u8], w: u32, h: u32) -> Option<[u32; 4]> {
    let (w, h) = (w as usize, h as usize);
    if w == 0 || h == 0 || rgba.len() < w * h * 4 { return None; }
    let (mut x0, mut y0, mut x1, mut y1) = (usize::MAX, usize::MAX, 0usize, 0usize);
    for y in 0..h {
        let row = &rgba[y * w * 4..(y + 1) * w * 4];
        let Some(first) = row.chunks_exact(4).position(|p| p[3] != 0) else { continue };
        let last = row.chunks_exact(4).rposition(|p| p[3] != 0).unwrap_or(first);
        x0 = x0.min(first);
        x1 = x1.max(last);
        y0 = y0.min(y);
        y1 = y;
    }
    (x0 != usize::MAX).then(|| [x0 as u32, y0 as u32, (x1 - x0 + 1) as u32, (y1 - y0 + 1) as u32])
}

/// Source-over of a premultiplied RGBA8 overlay onto 0x00RRGGBB window pixels, inside the overlay's box only.
fn composite_overlay(buffer: &mut [u32], w: usize, o: &OverlayPixels) {
    let [bx, by, bw, bh] = o.bbox.map(|v| v as usize);
    for row in by..by + bh {
        let base = row * w;
        for x in bx..(bx + bw).min(w) {
            let i = base + x;
            if i >= buffer.len() { return; }
            let p = &o.rgba[i * 4..i * 4 + 4];
            let a = p[3] as u32;
            if a == 0 { continue; }
            if a == 255 {
                buffer[i] = ((p[0] as u32) << 16) | ((p[1] as u32) << 8) | p[2] as u32;
                continue;
            }
            let d = buffer[i];
            let inv = 255 - a;
            let mix = |src: u8, dst: u32| (src as u32 + (dst * inv + 127) / 255).min(255);
            buffer[i] = (mix(p[0], (d >> 16) & 255) << 16) | (mix(p[1], (d >> 8) & 255) << 8) | mix(p[2], d & 255);
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
    fn the_box_of_an_overlay_is_found_and_empty_is_none() {
        let (w, h) = (6u32, 5u32);
        let mut px = vec![0u8; (w * h * 4) as usize];
        assert_eq!(super::pixel_bbox(&px, w, h), None);
        let set = |px: &mut Vec<u8>, x: usize, y: usize| px[(y * w as usize + x) * 4 + 3] = 200;
        set(&mut px, 2, 1);
        set(&mut px, 4, 3);
        assert_eq!(super::pixel_bbox(&px, w, h), Some([2, 1, 3, 3]));
        set(&mut px, 0, 4);
        assert_eq!(super::pixel_bbox(&px, w, h), Some([0, 1, 5, 4]));
    }

    #[test]
    fn an_overlay_blends_inside_its_box_and_leaves_the_rest_of_the_window_alone() {
        let w = 4usize;
        let mut buf = vec![0x0010_2030u32; 4 * 3];
        let mut rgba = vec![0u8; 4 * 3 * 4];
        // Opaque red at (1,1); half-transparent white (premultiplied 128,128,128,128) at (2,1); something outside the box.
        rgba[(w + 1) * 4..(w + 1) * 4 + 4].copy_from_slice(&[255, 0, 0, 255]);
        rgba[(w + 2) * 4..(w + 2) * 4 + 4].copy_from_slice(&[128, 128, 128, 128]);
        rgba[(2 * w + 3) * 4..(2 * w + 3) * 4 + 4].copy_from_slice(&[0, 255, 0, 255]);
        let o = super::OverlayPixels { rgba: &rgba, bbox: [1, 1, 2, 1] };
        super::composite_overlay(&mut buf, w, &o);
        assert_eq!(buf[w + 1], 0x00FF_0000, "opaque replaces");
        let mix = |src: u32, dst: u32| src + (dst * 127 + 127) / 255; // under 50% white
        assert_eq!(buf[w + 2], (mix(128, 0x10) << 16) | (mix(128, 0x20) << 8) | mix(128, 0x30));
        assert_eq!(buf[2 * w + 3], 0x0010_2030, "outside the box is untouched even if the layer has pixels there");
        assert_eq!(buf[0], 0x0010_2030);
    }

    #[test]
    fn rgba_converts_to_0rgb() {
        let src = [1u8, 2, 3, 255, 0xAA, 0xBB, 0xCC, 0x10];
        let mut dst = [0u32; 2];
        super::rgba_to_0rgb(&src, &mut dst);
        assert_eq!(dst, [0x0001_0203, 0x00AA_BBCC]);
    }

    #[test]
    fn the_frame_interval_follows_the_monitor_and_the_cap() {
        use std::time::Duration;
        let ms = |d: Duration| (d.as_secs_f64() * 1000.0 * 10.0).round() / 10.0;
        // No cap: the monitor's rate, held to 30 to 500 Hz.
        assert_eq!(ms(super::frame_interval(60.0, 0)), 16.7);
        assert_eq!(ms(super::frame_interval(144.0, 0)), 6.9);
        assert_eq!(ms(super::frame_interval(10.0, 0)), 33.3);
        // A cap lowers it, and never raises it.
        assert_eq!(ms(super::frame_interval(144.0, 60)), 16.7);
        assert_eq!(ms(super::frame_interval(60.0, 144)), 16.7);
        assert_eq!(ms(super::frame_interval(120.0, 30)), 33.3);
        // A cap below 15 acts as 15; one above 500 is held to 500.
        assert_eq!(ms(super::frame_interval(120.0, 1)), 66.7);
        assert_eq!(ms(super::frame_interval(500.0, 9999)), 2.0);
    }
}
