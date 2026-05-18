//! Microphone recording helper for velox-sysapi.
//!
//! Provides one-shot blocking WAV recording via cpal + hound.
//! Designed to be called from a tokio `spawn_blocking` thread.

use cpal::traits::{DeviceTrait, HostTrait, StreamTrait};
use std::sync::{Arc, Mutex};

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
        "velox_mic_{}.wav",
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
