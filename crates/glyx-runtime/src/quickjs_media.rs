//! Audio playback bindings, ported from `bind_media.rs`'s V8 implementation.
//! Video/camera/microphone/HID deferred — audio is the highest-value,
//! self-contained subsystem; the rest follow the same shape once needed.

use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::sync::atomic::{AtomicU32, Ordering};
use std::cell::RefCell;
use parking_lot::Mutex;
use rquickjs::Ctx;
use tokio::runtime::Handle;

use crate::bindings::{AudioTracker, CompletionQueue, RedrawRequest};
use crate::quickjs_runtime::QuickJsRuntime;

pub(crate) type AudioSinks    = Arc<Mutex<HashMap<u32, rodio::Sink>>>;
pub(crate) type AudioTrackers = Arc<Mutex<HashMap<u32, AudioTracker>>>;
pub(crate) type AudioEvents   = Arc<Mutex<VecDeque<String>>>;

/// Holds the rodio output stream/handle — mirrors `AsyncState`'s use of
/// `RefCell` for this in V8's implementation (the stream itself never
/// crosses threads and is lazily initialized on first `audio.play`).
#[derive(Default)]
pub(crate) struct AudioDevice {
    pub(crate) stream: RefCell<Option<rodio::OutputStream>>,
    pub(crate) handle: RefCell<Option<rodio::OutputStreamHandle>>,
}

fn cap_denied<'js>(ctx: &Ctx<'js>) -> rquickjs::Result<rquickjs::Promise<'js>> {
    QuickJsRuntime::reject_now(ctx, "Capability required: audio — add it to glyx.config.json under \"capabilities\"".to_string())
}

fn probe_audio_duration(path: &str) -> f64 {
    use symphonia::core::io::MediaSourceStream;
    use symphonia::core::probe::Hint;
    use symphonia::core::meta::MetadataOptions;
    use symphonia::core::formats::{FormatOptions, SeekMode, SeekTo};
    use symphonia::core::units::Time;

    let file = match std::fs::File::open(path) { Ok(f) => f, Err(_) => return -1.0 };
    let mss = MediaSourceStream::new(Box::new(file), Default::default());
    let probed = match symphonia::default::get_probe()
        .format(&Hint::new(), mss, &FormatOptions::default(), &MetadataOptions::default())
    { Ok(p) => p, Err(_) => return -1.0 };
    let mut reader = probed.format;

    if let Some(track) = reader.tracks().iter().find(|t| t.codec_params.sample_rate.is_some()) {
        if let (Some(n_frames), Some(sr)) = (track.codec_params.n_frames, track.codec_params.sample_rate) {
            if n_frames > 0 && sr > 0 { return n_frames as f64 / sr as f64; }
        }
    }
    let track_id = reader.default_track().map(|t| t.id).unwrap_or(0);
    let beyond = Time { seconds: u64::MAX / 2, frac: 0.0 };
    if let Ok(seeked) = reader.seek(SeekMode::Coarse, SeekTo::Time { time: beyond, track_id: None }) {
        let tb = reader.tracks().get(track_id as usize).and_then(|t| t.codec_params.time_base);
        let (numer, denom) = match tb {
            Some(tb) => (tb.numer as f64, tb.denom as f64),
            None => match reader.tracks().get(track_id as usize).and_then(|t| t.codec_params.sample_rate) {
                Some(sr) if sr > 0 => (1.0, sr as f64),
                _ => return -1.0,
            },
        };
        if denom > 0.0 {
            let secs = seeked.actual_ts as f64 * numer / denom;
            if secs > 0.0 && secs.is_finite() { return secs; }
        }
    }
    -1.0
}

pub(crate) fn audio_play<'js>(
    ctx: Ctx<'js>, src: String, opts_json: String, device: Arc<AudioDevice>,
    sinks: AudioSinks, trackers: AudioTrackers, next_id: Arc<AtomicU32>,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().audio { return cap_denied(&ctx); }
    let volume: f32 = serde_json::from_str::<serde_json::Value>(&opts_json).ok()
        .and_then(|v| v.get("volume").and_then(|v| v.as_f64()).map(|f| f as f32)).unwrap_or(1.0);

    if device.handle.borrow().is_none() {
        match rodio::OutputStream::try_default() {
            Ok((stream, handle)) => {
                *device.stream.borrow_mut() = Some(stream);
                *device.handle.borrow_mut() = Some(handle);
            }
            Err(e) => log::warn!("[glyx] Audio init failed: {e}. Audio playback unavailable."),
        }
    }
    let Some(handle) = device.handle.borrow().as_ref().cloned() else {
        return QuickJsRuntime::reject_now(&ctx, "audio device unavailable".to_string());
    };
    let id = next_id.fetch_add(1, Ordering::Relaxed);
    let src_path = src.clone();
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || -> Result<String, String> {
            let file = std::fs::File::open(&src).map_err(|e| format!("audio open '{src}': {e}"))?;
            let decoder = rodio::Decoder::new(std::io::BufReader::new(file)).map_err(|e| format!("audio decode: {e}"))?;
            let sink = rodio::Sink::try_new(&handle).map_err(|e| format!("audio sink: {e}"))?;
            sink.set_volume(volume);
            sink.append(decoder);
            sink.play();
            sinks.lock().insert(id, sink);
            trackers.lock().insert(id, AudioTracker { path: src_path, offset_secs: 0.0, started_at: Some(std::time::Instant::now()) });
            Ok(id.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

pub(crate) fn audio_pause(sinks: &AudioSinks, trackers: &AudioTrackers, id: u32) {
    if let Some(sink) = sinks.lock().get(&id) { sink.pause(); }
    if let Some(t) = trackers.lock().get_mut(&id) { t.offset_secs = t.current_time(); t.started_at = None; }
}

pub(crate) fn audio_resume(sinks: &AudioSinks, trackers: &AudioTrackers, id: u32) {
    if let Some(sink) = sinks.lock().get(&id) { sink.play(); }
    if let Some(t) = trackers.lock().get_mut(&id) { t.started_at = Some(std::time::Instant::now()); }
}

pub(crate) fn audio_stop(sinks: &AudioSinks, trackers: &AudioTrackers, id: u32) {
    if let Some(sink) = sinks.lock().remove(&id) { sink.stop(); }
    trackers.lock().remove(&id);
}

pub(crate) fn audio_set_volume(sinks: &AudioSinks, id: u32, vol: f32) {
    if let Some(sink) = sinks.lock().get(&id) { sink.set_volume(vol.clamp(0.0, 2.0)); }
}

pub(crate) fn audio_get_volume(sinks: &AudioSinks, id: u32) -> f32 {
    sinks.lock().get(&id).map(|s| s.volume()).unwrap_or(1.0)
}

pub(crate) fn audio_get_time(trackers: &AudioTrackers, id: u32) -> f64 {
    trackers.lock().get(&id).map(|t| t.current_time()).unwrap_or(0.0)
}

pub(crate) fn audio_poll(sinks: &AudioSinks, trackers: &AudioTrackers, events: &AudioEvents) -> String {
    let mut sinks_guard = sinks.lock();
    let ended_ids: Vec<u32> = sinks_guard.iter().filter(|(_, s)| s.empty()).map(|(&id, _)| id).collect();
    for id in &ended_ids { sinks_guard.remove(id); }
    drop(sinks_guard);
    let mut tr = trackers.lock();
    for id in &ended_ids { tr.remove(id); }
    drop(tr);
    let mut evts = events.lock();
    for id in ended_ids { evts.push_back(format!("{{\"handle\":{id},\"event\":\"ended\"}}")); }
    if evts.is_empty() { "[]".to_string() } else { format!("[{}]", evts.drain(..).collect::<Vec<_>>().join(",")) }
}

pub(crate) fn audio_duration<'js>(
    ctx: Ctx<'js>, id: u32, trackers: AudioTrackers,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    let path = trackers.lock().get(&id).map(|t| t.path.clone());
    let Some(path) = path else {
        return QuickJsRuntime::reject_now(&ctx, "unknown audio handle".to_string());
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || Ok::<String, String>(probe_audio_duration(&path).to_string()))
            .await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

pub(crate) fn audio_seek<'js>(
    ctx: Ctx<'js>, id: u32, secs: f64, device: Arc<AudioDevice>, sinks: AudioSinks, trackers: AudioTrackers,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if id == 0 { return QuickJsRuntime::reject_now(&ctx, "invalid audio handle".to_string()); }
    let secs = secs.max(0.0);
    let path = trackers.lock().get(&id).map(|t| t.path.clone());
    let Some(path) = path else {
        return QuickJsRuntime::reject_now(&ctx, "unknown audio handle".to_string());
    };
    let was_paused = trackers.lock().get(&id).map(|t| t.started_at.is_none()).unwrap_or(false);
    let Some(handle) = device.handle.borrow().as_ref().cloned() else {
        return QuickJsRuntime::reject_now(&ctx, "audio device unavailable".to_string());
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || -> Result<String, String> {
            use rodio::Source;
            let file = std::fs::File::open(&path).map_err(|e| format!("audio open: {e}"))?;
            let decoder = rodio::Decoder::new(std::io::BufReader::new(file)).map_err(|e| format!("audio decode: {e}"))?;
            let skipped = decoder.skip_duration(std::time::Duration::from_secs_f64(secs));
            let sink = rodio::Sink::try_new(&handle).map_err(|e| format!("audio sink: {e}"))?;
            sink.append(skipped);
            if was_paused { sink.pause(); } else { sink.play(); }
            {
                let mut sg = sinks.lock();
                if let Some(old) = sg.remove(&id) { old.stop(); }
                sg.insert(id, sink);
            }
            let mut tr = trackers.lock();
            if let Some(t) = tr.get_mut(&id) {
                t.offset_secs = secs;
                t.started_at = if was_paused { None } else { Some(std::time::Instant::now()) };
            }
            Ok("null".to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}
