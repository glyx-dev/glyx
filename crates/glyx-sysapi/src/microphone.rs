//! Microphone recording helper for glyx-sysapi.
//!
//! Provides one-shot blocking WAV recording via cpal + hound.
//! Designed to be called from a tokio `spawn_blocking` thread.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::{Receiver, SyncSender};
use std::sync::{Arc, Mutex};
use std::time::Instant;

pub struct MicDevice {
    pub name: String,
}

/// Enumerate available audio input devices.
pub fn list_microphones() -> Vec<MicDevice> {
    let host = cpal::default_host();
    match host.input_devices() {
        Ok(devices) => devices
            .filter_map(|d| d.name().ok().map(|name| MicDevice { name }))
            .collect(),
        Err(e) => {
            log::warn!("[mic] failed to enumerate input devices: {e}");
            Vec::new()
        }
    }
}

/// Record audio from `device_name` (or default device if `None`) for `duration_ms` milliseconds.
/// Writes a 16-bit PCM mono WAV file to a temp path and returns the path.
pub fn record_wav(device_name: Option<&str>, duration_ms: u64) -> Result<String, String> {
    let host = cpal::default_host();

    let device = match device_name.filter(|n| !n.is_empty()) {
        None => host.default_input_device()
            .ok_or_else(|| "No default input device".to_string())?,
        Some(name) => {
            host.input_devices().map_err(|e| e.to_string())?
                .find(|d| d.name().ok().as_deref() == Some(name))
                .ok_or_else(|| format!("Microphone '{}' not found", name))?
        }
    };

    log::info!("[mic] recording {}ms from '{}'",
        duration_ms,
        device.name().unwrap_or_else(|_| "?".into()));

    let config  = device.default_input_config().map_err(|e| e.to_string())?;
    let sr      = config.sample_rate().0;
    let channels = config.channels() as u16;

    let samples: Arc<Mutex<Vec<i16>>> = Arc::new(Mutex::new(Vec::new()));
    let samples_cb = Arc::clone(&samples);

    let stream = device.build_input_stream(
        &config.into(),
        move |data: &[i16], _: &cpal::InputCallbackInfo| {
            samples_cb.lock().unwrap().extend_from_slice(data);
        },
        |e| log::warn!("[mic] stream error: {e}"),
        None,
    ).map_err(|e| e.to_string())?;

    stream.play().map_err(|e| e.to_string())?;
    std::thread::sleep(std::time::Duration::from_millis(duration_ms));
    drop(stream);

    // Write WAV to temp directory
    let filename = format!(
        "glyx_mic_{}.wav",
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis()
    );
    let path = std::env::temp_dir().join(filename);

    let spec = hound::WavSpec {
        channels,
        sample_rate: sr,
        bits_per_sample: 16,
        sample_format: hound::SampleFormat::Int,
    };
    let mut writer = hound::WavWriter::create(&path, spec).map_err(|e| e.to_string())?;
    for s in samples.lock().unwrap().iter() {
        writer.write_sample(*s).map_err(|e| e.to_string())?;
    }
    writer.finalize().map_err(|e| e.to_string())?;

    let path_str = path.to_string_lossy().into_owned();
    log::info!("[mic] saved {} bytes to {}", std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0), path_str);
    Ok(path_str)
}

// ── A live microphone ─────────────────────────────────────────────────────────────────────────────

/// A block of microphone samples: interleaved 16-bit, and the moment the block had been captured (when the callback received it).
pub struct MicChunk {
    pub samples: Vec<i16>,
    pub captured_at: Instant,
}

/// A microphone that is capturing: its blocks arrive on `rx` until it is dropped. The stream lives on a thread of its own (a cpal stream
/// cannot move between threads), which stops and ends when this is dropped. If the receiver falls behind, blocks are dropped, not queued
/// without limit.
pub struct MicCapture {
    pub rx: Receiver<MicChunk>,
    pub sample_rate: u32,
    pub channels: u16,
    stop: Arc<AtomicBool>,
    thread: Option<std::thread::JoinHandle<()>>,
}

impl MicCapture {
    /// Start capturing from `device_name` (the default input device when `None` or empty).
    pub fn start(device_name: Option<&str>) -> Result<Self, String> {
        let device_name = device_name.filter(|n| !n.is_empty()).map(str::to_owned);
        let (tx, rx) = std::sync::mpsc::sync_channel::<MicChunk>(256);
        let stop = Arc::new(AtomicBool::new(false));
        let (ready_tx, ready_rx) = std::sync::mpsc::channel::<Result<(u32, u16), String>>();
        let stop_thread = Arc::clone(&stop);
        let thread = std::thread::spawn(move || {
            let stream = match build_stream(device_name.as_deref(), tx) {
                Ok((stream, rate, channels)) => { let _ = ready_tx.send(Ok((rate, channels))); stream }
                Err(e) => { let _ = ready_tx.send(Err(e)); return; }
            };
            while !stop_thread.load(Ordering::Relaxed) { std::thread::sleep(std::time::Duration::from_millis(20)); }
            drop(stream);
        });
        let (sample_rate, channels) = ready_rx.recv().map_err(|_| "microphone thread ended".to_string())??;
        Ok(Self { rx, sample_rate, channels, stop, thread: Some(thread) })
    }
}

impl Drop for MicCapture {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::Relaxed);
        if let Some(t) = self.thread.take() { let _ = t.join(); }
    }
}

fn build_stream(device_name: Option<&str>, tx: SyncSender<MicChunk>) -> Result<(cpal::Stream, u32, u16), String> {
    let host = cpal::default_host();
    let device = match device_name {
        None => host.default_input_device().ok_or_else(|| "No default input device".to_string())?,
        Some(name) => host.input_devices().map_err(|e| e.to_string())?
            .find(|d| d.name().ok().as_deref() == Some(name))
            .ok_or_else(|| format!("Microphone '{name}' not found"))?,
    };
    let config = device.default_input_config().map_err(|e| e.to_string())?;
    let (rate, channels, format) = (config.sample_rate().0, config.channels(), config.sample_format());
    log::info!("[mic] capturing from '{}': {rate} Hz, {channels} channel(s), {format:?}", device.name().unwrap_or_else(|_| "?".into()));
    let cfg: cpal::StreamConfig = config.into();
    let err = |e| log::warn!("[mic] stream error: {e}");
    // Whatever format the device gives, the chunks are 16-bit.
    let stream = match format {
        cpal::SampleFormat::I16 => device.build_input_stream(&cfg, move |d: &[i16], _| {
            let _ = tx.try_send(MicChunk { samples: d.to_vec(), captured_at: Instant::now() });
        }, err, None),
        cpal::SampleFormat::F32 => device.build_input_stream(&cfg, move |d: &[f32], _| {
            let samples = d.iter().map(|&s| (s.clamp(-1.0, 1.0) * 32767.0) as i16).collect();
            let _ = tx.try_send(MicChunk { samples, captured_at: Instant::now() });
        }, err, None),
        cpal::SampleFormat::U16 => device.build_input_stream(&cfg, move |d: &[u16], _| {
            let samples = d.iter().map(|&s| (i32::from(s) - 32768) as i16).collect();
            let _ = tx.try_send(MicChunk { samples, captured_at: Instant::now() });
        }, err, None),
        other => return Err(format!("microphone sample format {other:?} is not supported")),
    }.map_err(|e| e.to_string())?;
    stream.play().map_err(|e| e.to_string())?;
    Ok((stream, rate, channels))
}
