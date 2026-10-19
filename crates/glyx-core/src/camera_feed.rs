//! Where a camera's frames go: the preview, the still-photo slot, and the recorder, whichever source made them.
//!
//! A frame is decoded once into a buffer from a small pool and then *shared* (`Arc`) with the three. A buffer is free again when nothing but the
//! pool holds it. A source whose pool is exhausted drops the frame: a camera that outruns its consumers should not pile frames up.
//!
//! The source is either the in-process capture thread (a runtime built with glyx-core's `camera` feature: `scene::OpenCamera`) or the camera
//! capability library (`spawn_cap_poller`: any runtime that loaded it), which is how a JS-only app gets a camera without the runner linking one in.

use crate::camera_record::RecFrame;
use crate::state::FrameBytes;
use parking_lot::Mutex;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::SyncSender;
use std::sync::Arc;

type FrameSlot = Arc<Mutex<Option<(u32, u32, Arc<FrameBytes>)>>>;

/// The shared places a camera's frames are published to (cheap to clone: it is all `Arc`s).
#[derive(Clone)]
pub(crate) struct CameraFeed {
    /// The newest frame, not yet taken by the renderer.
    pub frame_buf: FrameSlot,
    /// The newest frame, kept for `capture()`.
    pub last_raw_frame: FrameSlot,
    /// The recorder's queue, while one is recording.
    pub record_frame_tx: Arc<Mutex<Option<SyncSender<RecFrame>>>>,
    redraw: Arc<dyn Fn() + Send + Sync>,
}

impl CameraFeed {
    pub(crate) fn new(redraw: Arc<dyn Fn() + Send + Sync>) -> Self {
        Self { frame_buf: Arc::default(), last_raw_frame: Arc::default(), record_frame_tx: Arc::default(), redraw }
    }

    /// Hand a decoded frame to the preview, the photo slot and the recorder, and wake the event loop to paint it.
    pub(crate) fn publish(&self, w: u32, h: u32, frame: &Arc<FrameBytes>) {
        // The last frame, for CaptureCamera (still photo): replaces the one before (which the pool then reuses).
        *self.last_raw_frame.lock() = Some((w, h, Arc::clone(frame)));
        // Forward to the recorder if one is running (try_send: it never makes the camera wait).
        if let Some(tx) = self.record_frame_tx.lock().as_ref() {
            let _ = tx.try_send((w, h, Arc::clone(frame), std::time::Instant::now()));
        }
        // The render loop takes this to see that there is a new frame.
        *self.frame_buf.lock() = Some((w, h, Arc::clone(frame)));
        (self.redraw)();
    }
}

/// The index of a pool buffer of `size` bytes that nothing else holds (making one if the pool has room), or `None` when every buffer is in
/// use. Buffers of another size, left over from a different camera mode, are dropped once nobody shows them.
pub(crate) fn free_buffer(pool: &mut Vec<Arc<FrameBytes>>, size: usize) -> Option<usize> {
    pool.retain(|b| b.0.len() == size || Arc::strong_count(b) > 1);
    pool.iter().position(|b| b.0.len() == size && Arc::strong_count(b) == 1).or_else(|| {
        // The preview shows one and has one waiting, the photo slot holds one, the recorder has a queue and an encoder, one is being filled.
        (pool.len() < 10).then(|| {
            pool.push(Arc::new(FrameBytes(vec![0u8; size])));
            pool.len() - 1
        })
    })
}

/// Pull the frames of a camera the capability library opened: a thread that asks the library for each new frame (copied into a pooled buffer)
/// and publishes it, until `stop` is set, then closes the camera. `cap` is the library's static vtable (version 2 or later).
pub(crate) fn spawn_cap_poller(cap: &'static glyx_cap_abi::CameraCap, handle: u32, feed: CameraFeed, stop: Arc<AtomicBool>) {
    std::thread::spawn(move || {
        let mut pool: Vec<Arc<FrameBytes>> = Vec::new();
        let (mut seq, mut w, mut h) = (0u64, 0u32, 0u32);
        // A little under the frame time of the fastest camera worth showing; a frame is copied only when there is a new one.
        let idle = std::time::Duration::from_millis(4);
        while !stop.load(Ordering::Relaxed) {
            let size = w as usize * h as usize * 4;
            if size == 0 {
                // No frame yet, so the size is not known: ask with a buffer that cannot hold one, which still tells us the size.
                let (mut nw, mut nh, mut probe) = (0u32, 0u32, 0u64);
                unsafe { (cap.frame)(handle, std::ptr::null_mut(), 0, &mut nw, &mut nh, &mut probe) };
                (w, h) = (nw, nh);
                if size == 0 && (w, h) == (0, 0) { std::thread::sleep(idle); }
                continue;
            }
            let Some(i) = free_buffer(&mut pool, size) else { std::thread::sleep(idle); continue };
            let Some(buf) = Arc::get_mut(&mut pool[i]) else { continue };
            let (mut nw, mut nh) = (w, h);
            let n = unsafe { (cap.frame)(handle, buf.0.as_mut_ptr(), buf.0.len(), &mut nw, &mut nh, &mut seq) };
            if n > 0 {
                feed.publish(nw, nh, &pool[i]);
                (w, h) = (nw, nh);
            } else if (nw, nh) != (w, h) && nw > 0 && nh > 0 {
                (w, h) = (nw, nh); // the camera changed its size: the next round uses buffers of the new one
            } else {
                std::thread::sleep(idle);
            }
        }
        unsafe { (cap.close)(handle) };
    });
}
