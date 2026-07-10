//! Static rodio-backed AudioCap implementation.
//!
//! Exported as both a static vtable (used when compiled into glyx-runtime via
//! the `audio` feature) and as a `#[no_mangle]` C symbol (used when the crate
//! is built as a standalone `cdylib` capability DLL).

use glyx_cap_abi::{AudioCap, ABI_VERSION};
use parking_lot::Mutex;
use std::collections::HashMap;

// ── Internal state ────────────────────────────────────────────────────────────

struct AudioState {
    stream:       Option<rodio::OutputStream>,
    handle:       Option<rodio::OutputStreamHandle>,
    sinks:        HashMap<u32, rodio::Sink>,
    paths:        HashMap<u32, String>,
    offset_secs:  HashMap<u32, f64>,
    started_at:   HashMap<u32, std::time::Instant>,
    events:       std::collections::VecDeque<String>,
    next_id:      u32,
}

// rodio::OutputStream holds a *mut () internally but is only ever accessed
// from the single audio thread behind our Mutex — safe to declare Send.
unsafe impl Send for AudioState {}

impl AudioState {
    fn ensure_device(&mut self) -> bool {
        if self.handle.is_some() { return true; }
        match rodio::OutputStream::try_default() {
            Ok((stream, handle)) => {
                self.stream = Some(stream);
                self.handle = Some(handle);
                true
            }
            Err(e) => {
                log::warn!("[glyx-cap-audio] device init failed: {e}");
                false
            }
        }
    }
}

static STATE: Mutex<Option<AudioState>> = Mutex::new(None);

fn with_state<R>(f: impl FnOnce(&mut AudioState) -> R) -> R {
    let mut g = STATE.lock();
    if g.is_none() {
        *g = Some(AudioState {
            stream:      None,
            handle:      None,
            sinks:       HashMap::new(),
            paths:       HashMap::new(),
            offset_secs: HashMap::new(),
            started_at:  HashMap::new(),
            events:      std::collections::VecDeque::new(),
            next_id:     1,
        });
    }
    f(g.as_mut().unwrap())
}

// ── ABI function implementations ──────────────────────────────────────────────

unsafe extern "C" fn audio_init() -> i32 {
    with_state(|s| if s.ensure_device() { 0 } else { -1 })
}

unsafe extern "C" fn audio_play(
    path:    *const u8,
    path_len: usize,
    volume:  f32,
    _looping: u8,
) -> u32 {
    let path_str = match std::str::from_utf8(std::slice::from_raw_parts(path, path_len)) {
        Ok(s) => s.to_string(),
        Err(_) => return 0,
    };

    with_state(|s| {
        if !s.ensure_device() { return 0; }
        let handle = match s.handle.as_ref() { Some(h) => h.clone(), None => return 0 };

        let file = match std::fs::File::open(&path_str) {
            Ok(f) => f,
            Err(e) => { log::warn!("[audio] open '{}': {e}", path_str); return 0; }
        };
        let decoder = match rodio::Decoder::new(std::io::BufReader::new(file)) {
            Ok(d) => d,
            Err(e) => { log::warn!("[audio] decode: {e}"); return 0; }
        };
        let sink = match rodio::Sink::try_new(&handle) {
            Ok(sk) => sk,
            Err(e) => { log::warn!("[audio] sink: {e}"); return 0; }
        };
        sink.set_volume(volume.clamp(0.0, 2.0));
        sink.append(decoder);
        sink.play();

        let id = s.next_id;
        s.next_id += 1;
        s.sinks.insert(id, sink);
        s.paths.insert(id, path_str);
        s.offset_secs.insert(id, 0.0);
        s.started_at.insert(id, std::time::Instant::now());
        id
    })
}

unsafe extern "C" fn audio_pause(handle: u32) {
    with_state(|s| {
        if let Some(sink) = s.sinks.get(&handle) { sink.pause(); }
        let elapsed = s.started_at.remove(&handle).map(|t| t.elapsed().as_secs_f64()).unwrap_or(0.0);
        let off = s.offset_secs.entry(handle).or_insert(0.0);
        *off += elapsed;
    });
}

unsafe extern "C" fn audio_resume(handle: u32) {
    with_state(|s| {
        if let Some(sink) = s.sinks.get(&handle) { sink.play(); }
        s.started_at.insert(handle, std::time::Instant::now());
    });
}

unsafe extern "C" fn audio_stop(handle: u32) {
    with_state(|s| {
        if let Some(sink) = s.sinks.remove(&handle) { sink.stop(); }
        s.paths.remove(&handle);
        s.offset_secs.remove(&handle);
        s.started_at.remove(&handle);
    });
}

unsafe extern "C" fn audio_set_volume(handle: u32, volume: f32) {
    with_state(|s| {
        if let Some(sink) = s.sinks.get(&handle) {
            sink.set_volume(volume.clamp(0.0, 2.0));
        }
    });
}

unsafe extern "C" fn audio_get_volume(handle: u32) -> f32 {
    with_state(|s| s.sinks.get(&handle).map(|sk| sk.volume()).unwrap_or(1.0))
}

unsafe extern "C" fn audio_get_time(handle: u32) -> f64 {
    with_state(|s| {
        let offset = s.offset_secs.get(&handle).copied().unwrap_or(0.0);
        let elapsed = s.started_at.get(&handle).map(|t| t.elapsed().as_secs_f64()).unwrap_or(0.0);
        offset + elapsed
    })
}

unsafe extern "C" fn audio_duration(handle: u32) -> f64 {
    let path = with_state(|s| s.paths.get(&handle).cloned());
    let path = match path { Some(p) => p, None => return -1.0 };
    use rodio::Source;
    let file = match std::fs::File::open(&path) { Ok(f) => f, Err(_) => return -1.0 };
    let dec  = match rodio::Decoder::new(std::io::BufReader::new(file)) { Ok(d) => d, Err(_) => return -1.0 };
    dec.total_duration().map(|d| d.as_secs_f64()).unwrap_or(-1.0)
}

unsafe extern "C" fn audio_seek(handle: u32, seconds: f64) {
    let path = with_state(|s| s.paths.get(&handle).cloned());
    let path = match path { Some(p) => p, None => return };
    let was_paused = with_state(|s| s.started_at.get(&handle).is_none());
    let handle_ref = with_state(|s| s.handle.as_ref().map(Clone::clone));
    let h = match handle_ref { Some(h) => h, None => return };
    use rodio::Source;
    let file = match std::fs::File::open(&path) { Ok(f) => f, Err(e) => { log::warn!("[audio] seek open: {e}"); return; } };
    let decoder = match rodio::Decoder::new(std::io::BufReader::new(file)) { Ok(d) => d, Err(e) => { log::warn!("[audio] seek decode: {e}"); return; } };
    let skipped = decoder.skip_duration(std::time::Duration::from_secs_f64(seconds.max(0.0)));
    let new_sink = match rodio::Sink::try_new(&h) { Ok(sk) => sk, Err(e) => { log::warn!("[audio] seek sink: {e}"); return; } };
    new_sink.append(skipped);
    if was_paused { new_sink.pause(); } else { new_sink.play(); }
    with_state(|s| {
        if let Some(old) = s.sinks.remove(&handle) { old.stop(); }
        s.sinks.insert(handle, new_sink);
        s.offset_secs.insert(handle, seconds.max(0.0));
        if was_paused {
            s.started_at.remove(&handle);
        } else {
            s.started_at.insert(handle, std::time::Instant::now());
        }
    });
}

unsafe extern "C" fn audio_poll(
    out_buf: *mut u8,
    out_len: *mut usize,
    buf_cap: usize,
) {
    let json = with_state(|s| {
        // Collect ended sinks.
        let ended: Vec<u32> = s.sinks.iter()
            .filter(|(_, sk)| sk.empty())
            .map(|(&id, _)| id)
            .collect();
        for id in &ended {
            s.sinks.remove(id);
            s.paths.remove(id);
            s.offset_secs.remove(id);
            s.started_at.remove(id);
            s.events.push_back(format!("{{\"handle\":{id},\"event\":\"ended\"}}"));
        }
        if s.events.is_empty() {
            "[]".to_string()
        } else {
            let items: Vec<String> = s.events.drain(..).collect();
            format!("[{}]", items.join(","))
        }
    });

    let bytes = json.as_bytes();
    let write = bytes.len().min(buf_cap);
    std::ptr::copy_nonoverlapping(bytes.as_ptr(), out_buf, write);
    *out_len = write;
}

unsafe extern "C" fn audio_shutdown() {
    let mut g = STATE.lock();
    *g = None;
}

// ── Static vtable ─────────────────────────────────────────────────────────────

static AUDIO_CAP: AudioCap = AudioCap {
    version:    ABI_VERSION,
    init:       audio_init,
    play:       audio_play,
    pause:      audio_pause,
    resume:     audio_resume,
    stop:       audio_stop,
    set_volume: audio_set_volume,
    get_volume: audio_get_volume,
    get_time:   audio_get_time,
    duration:   audio_duration,
    seek:       audio_seek,
    poll:       audio_poll,
    shutdown:   audio_shutdown,
};

/// Return the static vtable reference.  Used by `glyx-runtime`'s `cap_loader`
/// when the `audio` feature is compiled in.
pub fn static_cap() -> &'static AudioCap {
    &AUDIO_CAP
}

/// DLL entry point.  Called by `cap_loader::try_load_dynamic` when this crate
/// is shipped as a standalone capability DLL.
#[no_mangle]
pub extern "C" fn glyx_cap_audio() -> *const AudioCap {
    &AUDIO_CAP
}
