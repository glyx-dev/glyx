//! Recording camera frames to an MP4.
//!
//! The camera thread sends every frame it captures (shared, not copied: see `FrameBytes`) with the time it arrived; this thread encodes them.
//!
//! With a media library that can write timed frames (`vm_encoder_open_timed`) the encoder opens on the first frame and each frame is written
//! at its own capture time: nothing is buffered, the file's timing is what the camera delivered, the bit rate follows the frame size, and the
//! MP4 is fragmented, so an app that dies mid-recording leaves a file that plays up to its last second.
//!
//! Without one (an older library, or none: then an `ffmpeg` executable) the frame rate has to be known before the encoder opens, so the first
//! eight frames are held while it is measured, as before.

use crate::state::FrameBytes;
use std::sync::mpsc::{Receiver, Sender};
use std::sync::Arc;
use std::time::{Duration, Instant};

/// A captured frame on its way to the recorder: size, RGBA bytes, and when it arrived.
pub(crate) type RecFrame = (u32, u32, Arc<FrameBytes>, Instant);

/// How many frames may wait for the recorder. A recorder that falls behind makes the camera drop frames rather than pile them up
/// (each one is a whole frame of memory).
pub(crate) const REC_QUEUE: usize = 3;

/// Records the frames that arrive on `frame_rx` until the channel closes, then reports the finished file (or what went wrong) on `done_tx`.
/// `fps_hint` is what the camera says it delivers (drivers often get it wrong; it only steers the encoder).
pub(crate) fn run(
    frame_rx: Receiver<RecFrame>, done_tx: Sender<Result<String, String>>, output_path: String, fps_hint: u32,
    mic: Option<glyx_sysapi::microphone::MicCapture>,
) {
    let frame_timeout = Duration::from_secs(2);
    let mut held: Vec<RecFrame> = Vec::new();

    if let Some(media) = glyx_media::get_media().filter(|m| m.has_timed_encoder()) {
        let first = match frame_rx.recv_timeout(frame_timeout) {
            Ok(f) => f,
            Err(_) => { let _ = done_tx.send(Err("no frames received".to_string())); return; }
        };
        let (w, h, t0) = (first.0, first.1, first.3);
        let hint = if (10..=120).contains(&fps_hint) { fps_hint } else { 30 };
        // With a microphone (and a library that can write audio) the file gets an AAC track.
        let mic = mic.filter(|_| media.has_audio_encoder());
        let opened = match &mic {
            Some(m) => media.encoder_open_timed_av(&output_path, w, h, hint, m.sample_rate, u32::from(m.channels)),
            None => media.encoder_open_timed(&output_path, w, h, hint),
        };
        match opened {
            Ok(enc) => {
                let with_audio = mic.is_some() && media.encoder_has_audio(&enc);
                log::info!("[camera] recording {w}x{h} with {}, frames written at their capture times{}", media.encoder_name(&enc),
                    if with_audio { ", and the microphone" } else { "" });
                let mut ok = media.encoder_write_rgba_at(&enc, &first.2 .0, 0).is_ok();
                drop(first);
                // The microphone's blocks are written as they come, between frames. A block starts when it was received less its own length;
                // those that ended before the first frame are dropped (the recording starts with the picture).
                let mic = mic.filter(|_| with_audio);
                let write_audio = |ok: &mut bool| {
                    let Some(m) = &mic else { return };
                    let per_ms = (m.sample_rate as f64 / 1000.0) * f64::from(m.channels);
                    while let Ok(chunk) = m.rx.try_recv() {
                        if chunk.captured_at < t0 { continue; }
                        let len_ms = (chunk.samples.len() as f64 / per_ms) as i64;
                        let start = chunk.captured_at.saturating_duration_since(t0).as_millis() as i64 - len_ms;
                        if media.encoder_write_audio(&enc, &chunk.samples, u32::from(m.channels), start).is_err() { *ok = false; break; }
                    }
                };
                while ok {
                    write_audio(&mut ok);
                    // Wait for a frame, but not long enough for the microphone's blocks to pile up behind it.
                    match frame_rx.recv_timeout(Duration::from_millis(10)) {
                        Ok((fw, fh, data, at)) => {
                            if (fw, fh) != (w, h) { continue; } // the camera changed its size mid-recording: this file keeps the first
                            let pts = at.saturating_duration_since(t0).as_millis() as i64;
                            if media.encoder_write_rgba_at(&enc, &data.0, pts).is_err() { ok = false; }
                        }
                        Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {}
                        Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => break,
                    }
                }
                write_audio(&mut ok);
                media.encoder_close(enc);
                let _ = done_tx.send(if ok { Ok(output_path) } else { Err("glyx-media encoder write failed".to_string()) });
                return;
            }
            Err(e) => {
                log::warn!("[camera] timed encoder unavailable: {e}; measuring the frame rate first");
                held.push(first);
            }
        }
    }

    // ── Constant rate: measure the rate, then open the encoder ────────────────────────────────────
    // Collect up to CAL_FRAMES to measure the intervals between frames. (N-1) intervals over the elapsed time leave out thread-start lag.
    const CAL_FRAMES: usize = 8;
    let mut t_first: Option<Instant> = held.first().map(|f| f.3);
    let mut t_last = held.last().map_or_else(Instant::now, |f| f.3);
    while held.len() < CAL_FRAMES {
        match frame_rx.recv_timeout(frame_timeout) {
            Ok(f) => {
                let now = Instant::now();
                if t_first.is_none() { t_first = Some(now); }
                t_last = now;
                held.push(f);
            }
            Err(_) => break, // channel closed or timeout
        }
    }
    if held.is_empty() {
        let _ = done_tx.send(Err("no frames received".to_string()));
        return;
    }
    let fps: u32 = if held.len() >= 2 {
        let span = t_last.saturating_duration_since(t_first.unwrap()).as_secs_f64().max(0.001);
        (((held.len() - 1) as f64 / span).round() as u32).clamp(5, 60)
    } else {
        24 // a single-frame recording: a conservative default
    };
    log::info!("[camera] encoder fps={fps} (measured over {} calibration frames)", held.len());
    let (w, h) = (held[0].0, held[0].1);

    if let Some(media) = glyx_media::get_media() {
        match media.encoder_open(&output_path, w, h, fps) {
            Ok(enc) => {
                let mut ok = true;
                // drain(): the held frames are let go as they are written.
                for (_, _, data, _) in held.drain(..) {
                    if media.encoder_write_rgba(&enc, &data.0).is_err() { ok = false; break; }
                }
                held.shrink_to_fit();
                if ok {
                    for (_, _, data, _) in frame_rx.iter() {
                        if media.encoder_write_rgba(&enc, &data.0).is_err() { ok = false; break; }
                    }
                }
                media.encoder_close(enc);
                let _ = done_tx.send(if ok { Ok(output_path) } else { Err("glyx-media encoder write failed".to_string()) });
                return;
            }
            Err(e) => log::warn!("[camera] glyx-media encoder unavailable: {e}, falling back to ffmpeg"),
        }
    }

    // ── Fallback: subprocess ffmpeg ───────────────────────────────────────────────────────────────
    use std::io::Write;
    use std::process::{Command, Stdio};

    let ffmpeg_bin = crate::scene::find_ffmpeg();
    let child = Command::new(&ffmpeg_bin)
        .args([
            "-y", "-f", "rawvideo", "-pixel_format", "rgba", "-video_size", &format!("{w}x{h}"), "-framerate", &fps.to_string(),
            "-i", "pipe:0", "-vf", "format=yuv420p", "-c:v", "libx264", "-preset", "ultrafast", "-crf", "23", &output_path,
        ])
        .stdin(Stdio::piped())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn();
    let mut child = match child {
        Ok(c) => c,
        Err(e) => {
            let _ = done_tx.send(Err(format!(
                "ffmpeg not found (tried '{ffmpeg_bin}'): {e}\n\
                 Install ffmpeg and make sure it is in PATH, or set the FFMPEG_PATH environment variable."
            )));
            return;
        }
    };
    let mut stdin = child.stdin.take().unwrap();
    for (_, _, data, _) in held.drain(..) {
        if stdin.write_all(&data.0).is_err() { break; }
    }
    drop(held);
    while let Ok((_, _, data, _)) = frame_rx.recv() {
        if stdin.write_all(&data.0).is_err() { break; }
    }
    drop(stdin); // close stdin → ffmpeg finalises the MP4
    match child.wait() {
        Ok(status) if status.success() => { let _ = done_tx.send(Ok(output_path)); }
        Ok(status) => { let _ = done_tx.send(Err(format!("ffmpeg exited with {status}"))); }
        Err(e) => { let _ = done_tx.send(Err(format!("ffmpeg wait error: {e}"))); }
    }
}
