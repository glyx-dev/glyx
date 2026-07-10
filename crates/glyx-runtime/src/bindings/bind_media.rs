use super::*;
pub fn audio_play_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().audio {
        rv.set(reject_cap_promise(scope, "audio").into()); return;
    }
    let src = args.get(0).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default();
    let opts_raw = args.get(1).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_else(|| "{}".into());

    // Parse opts: { volume?: f32, loop?: bool }
    let volume: f32 = serde_json::from_str::<serde_json::Value>(&opts_raw)
        .ok()
        .and_then(|v| v.get("volume").and_then(|v| v.as_f64()).map(|f| f as f32))
        .unwrap_or(1.0);

    // Lazy-init audio device on first play.
    if state.audio_handle.borrow().is_none() {
        match rodio::OutputStream::try_default() {
            Ok((stream, handle)) => {
                *state.audio_stream.borrow_mut() = Some(stream);
                *state.audio_handle.borrow_mut() = Some(handle);
            }
            Err(e) => {
                log::warn!("[glyx] Audio init failed: {e}. Audio playback unavailable.");
            }
        }
    }
    let Some(handle) = state.audio_handle.borrow().as_ref().map(Clone::clone) else {
        rv.set(reject_promise_with_error(scope, "audio device unavailable").into());
        return;
    };

    let sinks    = Arc::clone(&state.audio_sinks);
    let trackers = Arc::clone(&state.audio_trackers);
    let id = state.next_audio_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let src_path = src.clone();
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let file = std::fs::File::open(&src)
                .map_err(|e| format!("audio open '{}': {e}", src))?;
            let decoder = rodio::Decoder::new(std::io::BufReader::new(file))
                .map_err(|e| format!("audio decode: {e}"))?;
            let sink = rodio::Sink::try_new(&handle)
                .map_err(|e| format!("audio sink: {e}"))?;
            sink.set_volume(volume);
            sink.append(decoder);
            sink.play();
            sinks.lock().insert(id, sink);
            trackers.lock().insert(id, AudioTracker {
                path:        src_path,
                offset_secs: 0.0,
                started_at:  Some(std::time::Instant::now()),
            });
            Ok(id.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr, result });
    });
    rv.set(promise.into());
}

/// `__glyx_audio_pause(handle)` â†’ void (sync)
#[cfg(feature = "audio")]
pub fn audio_pause_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let id = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    if let Some(sink) = state.audio_sinks.lock().get(&id) {
        sink.pause();
    }
    if let Some(tracker) = state.audio_trackers.lock().get_mut(&id) {
        tracker.offset_secs = tracker.current_time();
        tracker.started_at  = None;
    }
}

/// `__glyx_audio_resume(handle)` â†’ void (sync)
#[cfg(feature = "audio")]
pub fn audio_resume_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let id = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    if let Some(sink) = state.audio_sinks.lock().get(&id) {
        sink.play();
    }
    if let Some(tracker) = state.audio_trackers.lock().get_mut(&id) {
        tracker.started_at = Some(std::time::Instant::now());
    }
}

/// `__glyx_audio_stop(handle)` â†’ void (sync)
///
/// Stops playback and removes the sink from the map.
#[cfg(feature = "audio")]
pub fn audio_stop_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let id = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    if let Some(sink) = state.audio_sinks.lock().remove(&id) {
        sink.stop();
    }
    state.audio_trackers.lock().remove(&id);
}

/// `__glyx_audio_setVolume(handle, volume)` â†’ void (sync)
#[cfg(feature = "audio")]
pub fn audio_set_volume_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let id  = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let vol = args.get(1).number_value(scope).unwrap_or(1.0) as f32;
    if let Some(sink) = state.audio_sinks.lock().get(&id) {
        sink.set_volume(vol.clamp(0.0, 2.0));
    }
}

/// `__glyx_audio_getVolume(handle)` â†’ f32 (sync)
#[cfg(feature = "audio")]
pub fn audio_get_volume_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let id  = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let vol = state.audio_sinks.lock().get(&id).map(|s| s.volume()).unwrap_or(1.0);
    rv.set(v8::Number::new(scope, vol as f64).into());
}

/// `__glyx_audio_poll()` â†’ JSON string â€” drained each frame by JS.
///
/// Scans sinks; for any that have finished playing emits `{"handle":N,"event":"ended"}`.
/// Finished sinks are removed from the map.
#[cfg(feature = "audio")]
pub fn audio_poll_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let mut sinks_guard = state.audio_sinks.lock();
    let mut ended_ids: Vec<u32> = Vec::new();
    for (&id, sink) in sinks_guard.iter() {
        if sink.empty() {
            ended_ids.push(id);
        }
    }
    for id in &ended_ids {
        sinks_guard.remove(id);
    }
    drop(sinks_guard);
    // Remove trackers for ended sinks.
    let mut tr = state.audio_trackers.lock();
    for id in &ended_ids { tr.remove(id); }
    drop(tr);

    // Merge newly-ended events with the shared events queue, then drain all.
    let json = {
        let mut evts = state.audio_events.lock();
        for id in ended_ids {
            evts.push_back(format!("{{\"handle\":{id},\"event\":\"ended\"}}"));
        }
        if evts.is_empty() {
            "[]".to_string()
        } else {
            let items: Vec<String> = evts.drain(..).collect();
            format!("[{}]", items.join(","))
        }
    };

    let s = v8::String::new(scope, &json).unwrap();
    rv.set(s.into());
}

/// `__glyx_audio_get_time(handle)` â†’ f64 seconds (sync).
///
/// Returns the current playback position. Based on wall-clock tracking since
/// rodio 0.17 has no built-in get_pos(). Returns 0.0 for unknown handles.
#[cfg(feature = "audio")]
pub fn audio_get_time_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let id = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let t  = state.audio_trackers.lock().get(&id).map(|t| t.current_time()).unwrap_or(0.0);
    rv.set(v8::Number::new(scope, t).into());
}

/// `__glyx_audio_duration(handle)` â†’ Promise<f64> seconds.
///
/// Opens the file with rodio::Decoder and calls `total_duration()`.
/// May return -1.0 for formats that don't expose a duration header.
#[cfg(feature = "audio")]
pub fn audio_duration_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let id   = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let path = state.audio_trackers.lock().get(&id).map(|t| t.path.clone());
    let Some(path) = path else {
        rv.set(reject_promise_with_error(scope, "unknown audio handle").into());
        return;
    };
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);
    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            use rodio::Source;
            let file = std::fs::File::open(&path).map_err(|e| format!("{e}"))?;
            let dec  = rodio::Decoder::new(std::io::BufReader::new(file)).map_err(|e| format!("{e}"))?;
            let dur  = dec.total_duration().map(|d| d.as_secs_f64()).unwrap_or(-1.0);
            Ok(dur.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr, result });
    });
    rv.set(promise.into());
}

/// `__glyx_audio_seek(handle, seconds)` â†’ Promise<void>.
///
/// Stops the current sink, re-opens the file, skips `seconds` via
/// `skip_duration`, and inserts a fresh sink. Updates the tracker.
#[cfg(feature = "audio")]
pub fn audio_seek_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let id   = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let secs = args.get(1).number_value(scope).unwrap_or(0.0).max(0.0);
    if id == 0 {
        rv.set(reject_promise_with_error(scope, "invalid audio handle").into());
        return;
    }
    let path = state.audio_trackers.lock().get(&id).map(|t| t.path.clone());
    let Some(path) = path else {
        rv.set(reject_promise_with_error(scope, "unknown audio handle").into());
        return;
    };
    // Was the sink paused before seek?  Keep paused state after seek.
    let was_paused = state.audio_trackers.lock()
        .get(&id).map(|t| t.started_at.is_none()).unwrap_or(false);

    // NOTE: do NOT remove the old sink here â€” that would let audio_poll_callback
    // see a "gap" and fire a spurious "ended" event before the new sink is ready.
    // Instead, we atomically swap oldâ†’new inside spawn_blocking while holding the Mutex.

    let Some(handle) = state.audio_handle.borrow().as_ref().map(Clone::clone) else {
        rv.set(reject_promise_with_error(scope, "audio device unavailable").into());
        return;
    };
    let sinks    = Arc::clone(&state.audio_sinks);
    let trackers = Arc::clone(&state.audio_trackers);
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);
    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            use rodio::Source;
            // Build the new source first (before touching the sinks map).
            let file = std::fs::File::open(&path).map_err(|e| format!("audio open: {e}"))?;
            let decoder = rodio::Decoder::new(std::io::BufReader::new(file))
                .map_err(|e| format!("audio decode: {e}"))?;
            let skipped = decoder.skip_duration(std::time::Duration::from_secs_f64(secs));
            let sink = rodio::Sink::try_new(&handle).map_err(|e| format!("audio sink: {e}"))?;
            sink.append(skipped);
            if was_paused { sink.pause(); } else { sink.play(); }
            // Atomic swap: remove old + insert new while holding the Mutex so
            // audio_poll_callback never sees the handle missing (no spurious "ended").
            {
                let mut sg = sinks.lock();
                if let Some(old) = sg.remove(&id) { old.stop(); }
                sg.insert(id, sink);
            }
            // Update tracker position.
            let mut tr = trackers.lock();
            if let Some(t) = tr.get_mut(&id) {
                t.offset_secs = secs;
                t.started_at  = if was_paused { None } else { Some(std::time::Instant::now()) };
            }
            Ok("null".to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr, result });
    });
    rv.set(promise.into());
}

/// Parse `"ctrl+shift+v"` into a `global_hotkey::hotkey::HotKey`.
pub fn camera_list_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().camera {
        rv.set(reject_cap_promise(scope, "camera").into()); return;
    }

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(|| -> Result<String, String> {
            let devices = glyx_sysapi::camera::list_cameras();
            serde_json::to_string(&devices.iter().map(|d| {
                serde_json::json!({ "index": d.index, "name": d.name })
            }).collect::<Vec<_>>()).map_err(|e| e.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_camera_open(deviceIndex) â†’ Promise<string>` â€” resolves with handle ID string.
pub fn camera_open_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().camera {
        rv.set(reject_cap_promise(scope, "camera").into()); return;
    }

    let device_index = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let handle_id = state.next_camera_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let scene = Arc::clone(&state.scene);

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            // Verify device exists
            let devices = glyx_sysapi::camera::list_cameras();
            if device_index as usize >= devices.len() {
                return Err(format!("camera device index {device_index} not found"));
            }
            scene.lock().push_back(SceneCommand::OpenCamera { handle_id, device_index });
            Ok(handle_id.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_camera_close(handleId)` â€” sync. Pushes CloseCamera scene command.
pub fn camera_close_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle_id = args.get(0).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default()
        .parse::<u32>().unwrap_or(0);

    state.scene.lock().push_back(SceneCommand::CloseCamera { handle_id });
}

/// `__glyx_camera_capture(handleId) â†’ Promise<string>` â€” saves current frame as PNG.
/// Resolves with the absolute path to the saved PNG file.
pub fn camera_capture_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().camera {
        rv.set(reject_cap_promise(scope, "camera").into()); return;
    }

    let handle_id = args.get(0).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default()
        .parse::<u32>().unwrap_or(0);

    let (tx, rx) = tokio::sync::oneshot::channel::<Result<String, String>>();
    state.scene.lock().push_back(SceneCommand::CaptureCamera {
        handle_id,
        tx: OneshotSender(tx),
    });

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = rx.await.unwrap_or_else(|_| Err("capture channel closed".to_string()));
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_camera_record_start(handleId, outputPath)` â€” sync. Starts MP4 recording via ffmpeg.
pub fn camera_record_start_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle_id   = args.get(0).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default()
        .parse::<u32>().unwrap_or(0);
    let output_path = v8_arg_to_string(scope, &args, 1);

    state.scene.lock().push_back(SceneCommand::StartCameraRecord { handle_id, output_path });
}

/// `__glyx_camera_record_stop(handleId) â†’ Promise<string>` â€” stops recording.
/// Resolves with the absolute path to the finished MP4 file.
pub fn camera_record_stop_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle_id = args.get(0).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default()
        .parse::<u32>().unwrap_or(0);

    let (tx, rx) = tokio::sync::oneshot::channel::<Result<String, String>>();
    state.scene.lock().push_back(SceneCommand::StopCameraRecord {
        handle_id,
        tx: OneshotSender(tx),
    });

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = rx.await.unwrap_or_else(|_| Err("record-stop channel closed".to_string()));
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// â”€â”€ Microphone bindings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/// `__glyx_microphone_list() â†’ Promise<string>` â€” JSON array of mic devices.
pub fn microphone_list_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().microphone {
        rv.set(reject_cap_promise(scope, "microphone").into()); return;
    }

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(|| -> Result<String, String> {
            let devices = glyx_sysapi::microphone::list_microphones();
            serde_json::to_string(&devices.iter().map(|d| {
                serde_json::json!({ "name": d.name })
            }).collect::<Vec<_>>()).map_err(|e| e.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_microphone_record(deviceName, durationMs) â†’ Promise<string>` â€” path to WAV file.
pub fn microphone_record_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().microphone {
        rv.set(reject_cap_promise(scope, "microphone").into()); return;
    }

    let device_name_raw = v8_arg_to_string(scope, &args, 0);
    let duration_ms = args.get(1).number_value(scope).unwrap_or(3000.0) as u64;

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let device_name = if device_name_raw.is_empty() {
                None
            } else {
                Some(device_name_raw.as_str())
            };
            glyx_sysapi::microphone::record_wav(device_name, duration_ms)
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// â”€â”€ HID callbacks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/// `__glyx_hid_enumerate() â†’ Promise<JSON>` â€” list HID devices.
#[cfg(feature = "hid")]
pub fn hid_enumerate_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().hid {
        rv.set(reject_cap_promise(scope, "hid").into()); return;
    }

    let hid_api = Arc::clone(&state.hid_api);
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let mut guard = hid_api.lock();
            if guard.is_none() {
                *guard = Some(hidapi::HidApi::new().map_err(|e| e.to_string())?);
            }
            let api = guard.as_ref().unwrap();
            let devices: Vec<serde_json::Value> = api.device_list()
                .map(|info| serde_json::json!({
                    "vendorId":        info.vendor_id(),
                    "productId":       info.product_id(),
                    "manufacturer":    info.manufacturer_string().unwrap_or(""),
                    "product":         info.product_string().unwrap_or(""),
                    "serialNumber":    info.serial_number().unwrap_or(""),
                    "interfaceNumber": info.interface_number(),
                    "path":            info.path().to_str().unwrap_or(""),
                }))
                .collect();
            serde_json::to_string(&devices).map_err(|e| e.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_hid_open(vendorId, productId) â†’ Promise<handleId>` â€” open a HID device.
#[cfg(feature = "hid")]
pub fn hid_open_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().hid {
        rv.set(reject_cap_promise(scope, "hid").into()); return;
    }

    let vendor_id  = args.get(0).number_value(scope).unwrap_or(0.0) as u16;
    let product_id = args.get(1).number_value(scope).unwrap_or(0.0) as u16;

    let hid_api     = Arc::clone(&state.hid_api);
    let hid_devices = Arc::clone(&state.hid_devices);
    let handle_id   = state.next_hid_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let mut guard = hid_api.lock();
            if guard.is_none() {
                *guard = Some(hidapi::HidApi::new().map_err(|e| e.to_string())?);
            }
            let api = guard.as_ref().unwrap();
            let device = api.open(vendor_id, product_id).map_err(|e| e.to_string())?;
            hid_devices.lock().insert(handle_id, device);
            Ok(handle_id.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_hid_read(handleId, timeoutMs) â†’ Promise<JSON>` â€” read bytes from device.
#[cfg(feature = "hid")]
pub fn hid_read_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().hid {
        rv.set(reject_cap_promise(scope, "hid").into()); return;
    }

    let handle_id  = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let timeout_ms = args.get(1).number_value(scope).unwrap_or(100.0) as i32;

    let hid_devices = Arc::clone(&state.hid_devices);
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let devices = hid_devices.lock();
            let device  = devices.get(&handle_id)
                .ok_or_else(|| format!("HID handle {} not found", handle_id))?;
            let mut buf = vec![0u8; 64];
            let n = device.read_timeout(&mut buf, timeout_ms)
                .map_err(|e| e.to_string())?;
            buf.truncate(n);
            serde_json::to_string(&buf).map_err(|e| e.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_hid_write(handleId, dataJson) â†’ Promise<bytesWritten>` â€” write bytes to device.
#[cfg(feature = "hid")]
pub fn hid_write_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().hid {
        rv.set(reject_cap_promise(scope, "hid").into()); return;
    }

    let handle_id = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let data_json = v8_arg_to_string(scope, &args, 1);

    let hid_devices = Arc::clone(&state.hid_devices);
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let bytes: Vec<u8> = serde_json::from_str(&data_json)
                .map_err(|e| format!("Invalid data JSON: {e}"))?;
            let devices = hid_devices.lock();
            let device  = devices.get(&handle_id)
                .ok_or_else(|| format!("HID handle {} not found", handle_id))?;
            let n = device.write(&bytes).map_err(|e| e.to_string())?;
            Ok(n.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_hid_close(handleId)` â€” close a HID device handle (sync, no promise).
#[cfg(feature = "hid")]
pub fn hid_close_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle_id = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    state.hid_devices.lock().remove(&handle_id);
}

// â”€â”€ Updater callbacks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/// `__glyx_updater_check(owner, repo, currentVersion) â†’ Promise<JSON>`
///
/// Fetches the latest GitHub release and returns:
///   `{ hasUpdate: bool, latestVersion: string, body: string }`
#[cfg(feature = "updater")]
pub fn video_open_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !glyx_security::get().video {
        rv.set(reject_cap_promise(scope, "video").into()); return;
    }

    let url       = v8_arg_to_string(scope, &args, 0);
    let handle_id = state.next_video_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let scene     = Arc::clone(&state.scene);

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            // Verify the DLL is available before pushing the scene command.
            if glyx_media::get_media().is_none() {
                return Err("GlyxMediaNotAvailable: glyx-media DLL not loaded. \
                    Run `glyx runtime build` to download and cache the media DLL.".to_string());
            }
            scene.lock().push_back(SceneCommand::OpenVideo { handle_id, url });
            Ok(handle_id.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_video_seek(handleId: string, seconds: number)` â€” sync
///
/// Seeks the video to `seconds`. No-op if the handle is not active.
pub fn video_seek_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle_id = v8_arg_to_string(scope, &args, 0)
        .parse::<u32>().unwrap_or(0);
    let seconds   = args.get(1).number_value(scope).unwrap_or(0.0);

    state.scene.lock()
        .push_back(SceneCommand::SeekVideo { handle_id, seconds });
}

/// `__glyx_video_set_volume(handleId: string, volume: number)` â€” sync
///
/// Sets playback volume (0.0 = mute, 1.0 = normal, up to 2.0).
/// Applied to the audio sink within ~50ms.
pub fn video_set_volume_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle_id = v8_arg_to_string(scope, &args, 0).parse::<u32>().unwrap_or(0);
    let volume    = args.get(1).number_value(scope).unwrap_or(1.0) as f32;

    state.scene.lock()
        .push_back(SceneCommand::SetVideoVolume { handle_id, volume });
}

/// `__glyx_video_close(handleId: string)` â€” sync
///
/// Stops playback and releases all resources for this video handle.
pub fn video_close_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle_id = v8_arg_to_string(scope, &args, 0)
        .parse::<u32>().unwrap_or(0);

    state.scene.lock()
        .push_back(SceneCommand::CloseVideo { handle_id });
}

/// `__glyx_video_pause(handleId: string)` â€” sync
///
/// Pauses the decode thread (spin-wait) and the audio sink.
pub fn video_pause_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let handle_id = v8_arg_to_string(scope, &args, 0).parse::<u32>().unwrap_or(0);
    state.scene.lock().push_back(SceneCommand::PauseVideo { handle_id });
}

/// `__glyx_video_play(handleId: string)` â€” sync
///
/// Resumes the decode thread and audio sink after a pause.
pub fn video_play_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let handle_id = v8_arg_to_string(scope, &args, 0).parse::<u32>().unwrap_or(0);
    state.scene.lock().push_back(SceneCommand::ResumeVideo { handle_id });
}

/// `__glyx_video_poll() â†’ JSON`
///
/// Returns a JSON array of pending video events since the last poll.
/// Each event: `{type:"ended",id:N}` or `{type:"metadata",id:N,width:W,height:H,fps:F,durationSecs:D}`.
/// Called each frame from JS (inside `__glyx_frameCallback`).
pub fn video_poll_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let _ = args; // no arguments

    let mut events = state.video_events.lock();
    let json = if events.is_empty() {
        "[]".to_string()
    } else {
        let items: Vec<_> = events.drain(..).collect();
        format!("[{}]", items.join(","))
    };
    let s = v8::String::new(scope, &json).unwrap();
    rv.set(s.into());
}
