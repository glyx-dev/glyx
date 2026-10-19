//! nokhwa-backed CameraCap implementation.
//!
//! Supports device listing, open/close, and single-frame JPEG capture.
//! Live preview rendering requires `--features camera` in glyx-core (render-loop
//! integration is not possible via the DLL boundary).

use glyx_cap_abi::{CameraCap, ABI_VERSION};
use parking_lot::Mutex;
use std::collections::HashMap;
use std::sync::Arc;

// ── Internal state ────────────────────────────────────────────────

/// The newest frame the camera thread has finished: its bytes, size and number. The thread decodes into a buffer of its own and swaps it
/// in, so a reader never waits for a decode and nothing is allocated per frame.
struct Slot {
    rgba: Vec<u8>,
    w:    u32,
    h:    u32,
    seq:  u64,
}

struct CameraHandle {
    latest: Arc<Mutex<Slot>>,
    stop:   Arc<std::sync::atomic::AtomicBool>,
}

struct CameraState {
    handles: HashMap<u32, CameraHandle>,
    next_id: u32,
}

static STATE: Mutex<Option<CameraState>> = Mutex::new(None);

fn with_state<R>(f: impl FnOnce(&mut CameraState) -> R) -> R {
    let mut g = STATE.lock();
    if g.is_none() {
        *g = Some(CameraState { handles: HashMap::new(), next_id: 1 });
    }
    f(g.as_mut().unwrap())
}

/// The stream mode to ask for given the size the preview will be shown at: the smallest frame that is at least that big and runs at 15
/// frames a second or more (else the largest there is), so a small preview does not decode full-size frames.
fn pick_format(formats: &[nokhwa::utils::CameraFormat], hint: (u32, u32)) -> Option<nokhwa::utils::CameraFormat> {
    let area = |f: &nokhwa::utils::CameraFormat| u64::from(f.width()) * u64::from(f.height());
    let big_enough = |f: &&nokhwa::utils::CameraFormat| f.width() >= hint.0 && f.height() >= hint.1;
    let smooth = formats.iter().filter(big_enough).filter(|f| f.frame_rate() >= 15);
    smooth.min_by_key(|f| (area(f), std::cmp::Reverse(f.frame_rate())))
        .or_else(|| formats.iter().filter(big_enough).min_by_key(|f| (area(f), std::cmp::Reverse(f.frame_rate()))))
        .or_else(|| formats.iter().max_by_key(|f| (area(f), f.frame_rate())))
        .copied()
}

// ── ABI function implementations ────────────────────────────────────────────

unsafe extern "C" fn camera_list(
    out_buf: *mut u8,
    out_len: *mut usize,
    buf_cap: usize,
) -> i32 {
    use nokhwa::utils::{ApiBackend, CameraIndex};
    let devices = match nokhwa::query(ApiBackend::Auto) {
        Ok(d) => d,
        Err(e) => {
            log::warn!("[glyx-cap-camera] list failed: {e}");
            return -1;
        }
    };
    let json = {
        let mut parts = Vec::with_capacity(devices.len());
        for info in &devices {
            let index = match info.index() {
                CameraIndex::Index(n) => *n as i64,
                CameraIndex::String(_) => -1,
            };
            let name = serde_json_escape(&info.human_name());
            parts.push(format!(r#"{{"index":{index},"name":"{name}"}}"#));
        }
        format!("[{}]", parts.join(","))
    };
    write_buf(json.as_bytes(), out_buf, out_len, buf_cap);
    0
}

unsafe extern "C" fn camera_open(index: u32) -> u32 {
    camera_open_sized(index, 0, 0)
}

unsafe extern "C" fn camera_open_sized(index: u32, hint_w: u32, hint_h: u32) -> u32 {
    use nokhwa::utils::{CameraIndex, RequestedFormat, RequestedFormatType};
    use nokhwa::pixel_format::RgbAFormat;

    let latest = Arc::new(Mutex::new(Slot { rgba: Vec::new(), w: 0, h: 0, seq: 0 }));
    let stop   = Arc::new(std::sync::atomic::AtomicBool::new(false));
    let latest_clone = Arc::clone(&latest);
    let stop_clone   = Arc::clone(&stop);

    std::thread::spawn(move || {
        let fmt = RequestedFormat::new::<RgbAFormat>(RequestedFormatType::AbsoluteHighestFrameRate);
        let mut cam = match nokhwa::Camera::new(CameraIndex::Index(index), fmt) {
            Ok(c)  => c,
            Err(e) => { log::warn!("[glyx-cap-camera] open index {index}: {e}"); return; }
        };
        if hint_w > 0 && hint_h > 0 {
            if let Ok(formats) = cam.compatible_camera_formats() {
                if let Some(f) = pick_format(&formats, (hint_w, hint_h)) {
                    let _ = cam.set_camera_requset(RequestedFormat::new::<RgbAFormat>(RequestedFormatType::Exact(f)));
                }
            }
        }
        if let Err(e) = cam.open_stream() {
            log::warn!("[glyx-cap-camera] stream open: {e}"); return;
        }
        let mut back: Vec<u8> = Vec::new();
        while !stop_clone.load(std::sync::atomic::Ordering::Relaxed) {
            match cam.frame() {
                Ok(frame) => {
                    let res = frame.resolution();
                    let (w, h) = (res.width(), res.height());
                    back.resize(w as usize * h as usize * 4, 0);
                    if frame.decode_image_to_buffer::<RgbAFormat>(&mut back).is_ok() {
                        let mut slot = latest_clone.lock();
                        std::mem::swap(&mut slot.rgba, &mut back);
                        slot.w = w; slot.h = h; slot.seq += 1;
                    }
                }
                Err(_) => std::thread::sleep(std::time::Duration::from_millis(5)),
            }
        }
        let _ = cam.stop_stream();
    });

    with_state(|s| {
        let id = s.next_id;
        s.next_id += 1;
        s.handles.insert(id, CameraHandle { latest, stop });
        id
    })
}

unsafe extern "C" fn camera_frame(
    handle:  u32,
    out_buf: *mut u8,
    buf_cap: usize,
    out_w:   *mut u32,
    out_h:   *mut u32,
    seq:     *mut u64,
) -> usize {
    let slot = with_state(|s| s.handles.get(&handle).map(|h| Arc::clone(&h.latest)));
    let Some(slot) = slot else { return 0 };
    let slot = slot.lock();
    if slot.seq == 0 { return 0; }
    *out_w = slot.w;
    *out_h = slot.h;
    let n = slot.w as usize * slot.h as usize * 4;
    if slot.seq <= *seq || n > buf_cap || slot.rgba.len() < n { return 0; }
    std::ptr::copy_nonoverlapping(slot.rgba.as_ptr(), out_buf, n);
    *seq = slot.seq;
    n
}

unsafe extern "C" fn camera_close(handle: u32) {
    with_state(|s| {
        if let Some(h) = s.handles.remove(&handle) {
            h.stop.store(true, std::sync::atomic::Ordering::Relaxed);
        }
    });
}

unsafe extern "C" fn camera_capture(
    handle:  u32,
    out_buf: *mut u8,
    buf_cap: usize,
) -> usize {
    let frame = with_state(|s| {
        s.handles.get(&handle).and_then(|h| { let slot = h.latest.lock(); (slot.seq > 0).then(|| (slot.w, slot.h, slot.rgba.clone())) })
    });
    let (w, h, rgba) = match frame {
        Some(f) => f,
        None => return 0,
    };
    // Encode RGBA → JPEG
    let mut jpeg_buf = std::io::Cursor::new(Vec::new());
    let img = image::RgbaImage::from_raw(w, h, rgba).unwrap_or_default();
    if image::DynamicImage::ImageRgba8(img)
        .write_to(&mut jpeg_buf, image::ImageFormat::Jpeg)
        .is_err()
    {
        return 0;
    }
    let bytes = jpeg_buf.into_inner();
    let write = bytes.len().min(buf_cap);
    unsafe { std::ptr::copy_nonoverlapping(bytes.as_ptr(), out_buf, write); }
    write
}

unsafe extern "C" fn camera_record_start(_handle: u32) {
    log::warn!("[glyx-cap-camera] record_start not implemented in DLL — use --features camera for recording");
}

unsafe extern "C" fn camera_record_stop(
    _handle:  u32,
    _out_buf: *mut u8,
    out_len:  *mut usize,
    _buf_cap: usize,
) -> i32 {
    log::warn!("[glyx-cap-camera] record_stop not implemented in DLL — use --features camera for recording");
    *out_len = 0;
    -1
}

unsafe extern "C" fn camera_shutdown() {
    let mut g = STATE.lock();
    if let Some(state) = g.as_mut() {
        for (_, h) in state.handles.drain() {
            h.stop.store(true, std::sync::atomic::Ordering::Relaxed);
        }
    }
    *g = None;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn serde_json_escape(s: &str) -> String {
    s.replace('\\', "\\\\").replace('"', "\\\"")
}

fn write_buf(src: &[u8], out_buf: *mut u8, out_len: *mut usize, buf_cap: usize) {
    let n = src.len().min(buf_cap);
    unsafe {
        std::ptr::copy_nonoverlapping(src.as_ptr(), out_buf, n);
        *out_len = n;
    }
}

// ── Static vtable ─────────────────────────────────────────────────────────────

static CAMERA_CAP: CameraCap = CameraCap {
    version:      ABI_VERSION,
    list:         camera_list,
    open:         camera_open,
    close:        camera_close,
    capture:      camera_capture,
    record_start: camera_record_start,
    record_stop:  camera_record_stop,
    shutdown:     camera_shutdown,
    open_sized:   camera_open_sized,
    frame:        camera_frame,
};

/// Return the static vtable reference.
pub fn static_cap() -> &'static CameraCap {
    &CAMERA_CAP
}

/// C export symbol for DLL loading.
#[no_mangle]
pub extern "C" fn glyx_cap_camera() -> *const CameraCap {
    &CAMERA_CAP
}
