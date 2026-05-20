use super::*;
use smallvec::SmallVec;
use crate::layout::layout_props_changed;

/// Locate the ffmpeg binary.
/// Priority: `FFMPEG_PATH` env var → ffmpeg-sidecar (dev) → common install locations → PATH.
fn find_ffmpeg() -> String {
    // 1. Explicit override.
    if let Ok(p) = std::env::var("FFMPEG_PATH") {
        if !p.is_empty() { return p; }
    }
    // 2. Dev mode: check ffmpeg-sidecar binary (downloaded to dir next to the executable).
    //    ffmpeg_path() checks the sidecar first, then falls back to system PATH automatically.
    #[cfg(feature = "dev")]
    {
        let p = ffmpeg_sidecar::paths::ffmpeg_path();
        if p.exists() {
            return p.to_string_lossy().into_owned();
        }
    }
    // 3. Common Windows install locations (winget, scoop, choco, manual).
    #[cfg(target_os = "windows")]
    {
        let candidates = [
            r"C:\ffmpeg\bin\ffmpeg.exe",
            r"C:\Program Files\ffmpeg\bin\ffmpeg.exe",
            r"C:\ProgramData\chocolatey\bin\ffmpeg.exe",
        ];
        if let Ok(local) = std::env::var("LOCALAPPDATA") {
            let winget = format!(r"{local}\Microsoft\WinGet\Links\ffmpeg.exe");
            if std::path::Path::new(&winget).exists() { return winget; }
        }
        for c in &candidates {
            if std::path::Path::new(c).exists() { return c.to_string(); }
        }
        if let Ok(home) = std::env::var("USERPROFILE") {
            let scoop = format!(r"{home}\scoop\apps\ffmpeg\current\bin\ffmpeg.exe");
            if std::path::Path::new(&scoop).exists() { return scoop; }
        }
    }
    // 4. Fall back to PATH lookup — works on all platforms when installed properly.
    "ffmpeg".to_string()
}

/// In dev mode, ensure an ffmpeg binary is available by downloading via ffmpeg-sidecar
/// if it is not already present in PATH or the sidecar directory.
/// The download is run on a background thread so it never blocks the render loop.
#[cfg(feature = "dev")]
pub(crate) fn ensure_dev_ffmpeg() {
    // ffmpeg_sidecar::download::auto_download() checks PATH + sidecar dir itself;
    // it is a no-op when ffmpeg is already reachable.
    std::thread::spawn(|| {
        match ffmpeg_sidecar::download::auto_download() {
            Ok(_) => log::info!(
                "[dev] ffmpeg-sidecar: binary ready at {:?}",
                ffmpeg_sidecar::paths::ffmpeg_path()
            ),
            Err(e) => log::warn!(
                "[dev] ffmpeg-sidecar: auto-download failed: {e}. \
                 Install ffmpeg in PATH or set FFMPEG_PATH to use camera recording."
            ),
        }
    });
}

fn srgb_to_linear_u8(v: u8) -> u8 {
    let c = v as f32 / 255.0;
    let lin = if c <= 0.04045 {
        c / 12.92
    } else {
        ((c + 0.055) / 1.055).powf(2.4)
    };
    (lin * 255.0).round().clamp(0.0, 255.0) as u8
}

fn load_image_from_path(path: &str) -> Option<peniko::Image> {
    let decoded = image::open(path).ok()?;
    let rgba = decoded.into_rgba8();
    let (w, h) = rgba.dimensions();
    let mut bytes = rgba.into_raw();
    for px in bytes.chunks_exact_mut(4) {
        px[0] = srgb_to_linear_u8(px[0]);
        px[1] = srgb_to_linear_u8(px[1]);
        px[2] = srgb_to_linear_u8(px[2]);
        let a = px[3] as u16;
        px[0] = ((px[0] as u16 * a + 127) / 255) as u8;
        px[1] = ((px[1] as u16 * a + 127) / 255) as u8;
        px[2] = ((px[2] as u16 * a + 127) / 255) as u8;
    }
    Some(peniko::Image::new(bytes.into(), peniko::Format::Rgba8, w, h))
}

pub(crate) fn apply_scene_commands(state: &mut PerWindowState, commands: Vec<SceneCommand>) -> bool {
    if commands.is_empty() {
        return false;
    }
    let mut layout_changed   = false;
    // Tracks whether the Taffy tree structure itself changed (nodes added / removed /
    // reparented).  When only style props changed we skip the full rebuild and rely
    // on the incremental mark_dirty path already applied per-node below.
    let mut structure_changed = false;
    for cmd in commands {
        match cmd {
            SceneCommand::CreateNode { id, node_type, props } => {
                state.js_nodes.insert(id, JsNode {
                    node_type,
                    props,
                    children:  SmallVec::new(),
                    layout_id: None,
                });
                if state.js_root.is_none() {
                    state.js_root = Some(id);
                }
                layout_changed   = true;
                structure_changed = true;
            }
            SceneCommand::CreateImage { id, path } => {
                if let Some(image) = state.images_by_path.get(&path).cloned() {
                    state.image_cache_hits += 1;
                    state.images.insert(id, image);
                } else {
                    state.image_cache_misses += 1;
                    if let Some(image) = load_image_from_path(&path) {
                        state.images_by_path.put(path.clone(), image.clone());
                        state.images.insert(id, image);
                    } else {
                        log::error!("Failed to load image at path: {}", path);
                    }
                }
                let total = state.image_cache_hits + state.image_cache_misses;
                if total > 0 && total % 16 == 0 {
                    let rate = state.image_cache_hits as f64 * 100.0 / total as f64;
                    log::info!(
                        "Image cache stats: hits={}, misses={}, hit_rate={:.1}%",
                        state.image_cache_hits,
                        state.image_cache_misses,
                        rate
                    );
                }
            }
            SceneCommand::AppendChild { parent_id, child_id } => {
                if let Some(parent) = state.js_nodes.get_mut(&parent_id) {
                    if !parent.children.contains(&child_id) {
                        parent.children.push(child_id);
                    }
                }
                layout_changed   = true;
                structure_changed = true;
            }
            SceneCommand::UpdateNode { id, props } => {
                // Check layout-prop changes before mutating — need old props for comparison.
                let (changed, opt_lid, opt_nt) = if let Some(node) = state.js_nodes.get(&id) {
                    if layout_props_changed(&props, &node.props) {
                        (true, node.layout_id, Some(node.node_type.clone()))
                    } else {
                        (false, None, None)
                    }
                } else {
                    (false, None, None)
                };
                if let Some(node) = state.js_nodes.get_mut(&id) {
                    node.props = props.clone();
                }
                if changed {
                    layout_changed = true;
                    // Incremental path: update Taffy style in-place + mark dirty.
                    // No structure change — skip full rebuild in recompute_layout.
                    if let (Some(lid), Some(nt)) = (opt_lid, opt_nt) {
                        let new_style = layout::to_taffy_style(&nt, &props);
                        let _ = state.layout.set_style(lid, new_style);
                        let _ = state.layout.mark_dirty(lid);
                    }
                }
            }
            SceneCommand::RemoveNode { id } => {
                // If this is an Image node, drop its decoded resource from the
                // id-keyed cache.  images_by_path keeps the bytes for reuse on
                // remount (no re-decode), but images must not accumulate stale
                // entries for node ids that no longer exist.
                if let Some(node) = state.js_nodes.get(&id) {
                    if let Some(image_id) = node.props.image_id {
                        state.images.remove(&image_id);
                    }
                }
                // Also clean up canvas data for this node.
                state.canvas_cmds.remove(&id);
                state.canvas3d_scenes.remove(&id);
                if let Some(r3d) = &mut state.renderer_3d {
                    r3d.remove_canvas(id);
                }
                state.js_nodes.remove(&id);
                // Unlink from any parent's children list so stale ghost IDs don't
                // accumulate in the renderer's traversal.  O(n × avg_children) but
                // n < 1000 in practice so this is negligible.
                for node in state.js_nodes.values_mut() {
                    node.children.retain(|c| *c != id);
                }
                layout_changed   = true;
                structure_changed = true;
            }
            SceneCommand::SetRoot { id } => {
                state.js_root = Some(id);
                layout_changed   = true;
                structure_changed = true;
            }
            SceneCommand::CanvasUpdate { id, cmds } => {
                state.canvas_cmds.insert(id, cmds);
                // Canvas draw commands don't affect layout.
            }
            SceneCommand::Canvas3DUpdate { id, scene } => {
                state.canvas3d_scenes.insert(id, scene);
                // 3D scenes don't affect layout — they blit on top of Vello.
            }
            SceneCommand::OpenCamera { handle_id, device_index } => {
                let frame_buf       = Arc::new(Mutex::new(None::<(u32, u32, Vec<u8>)>));
                let last_raw_frame  = Arc::new(Mutex::new(None::<(u32, u32, Vec<u8>)>));
                let stop_flag       = Arc::new(std::sync::atomic::AtomicBool::new(false));
                let record_frame_tx = Arc::new(Mutex::new(None::<std::sync::mpsc::SyncSender<(u32, u32, Vec<u8>)>>));
                let buf_clone      = Arc::clone(&frame_buf);
                let raw_clone      = Arc::clone(&last_raw_frame);
                let stop_clone     = Arc::clone(&stop_flag);
                let rec_tx_clone   = Arc::clone(&record_frame_tx);
                let redraw         = Arc::clone(&state.request_redraw);

                std::thread::spawn(move || {
                    use nokhwa::utils::{CameraIndex, RequestedFormat, RequestedFormatType};
                    use nokhwa::pixel_format::RgbAFormat;
                    let fmt = RequestedFormat::new::<RgbAFormat>(
                        RequestedFormatType::AbsoluteHighestFrameRate);
                    let mut cam = match nokhwa::Camera::new(CameraIndex::Index(device_index), fmt) {
                        Ok(c)  => c,
                        Err(e) => { log::warn!("[camera] open failed: {e}"); return; }
                    };
                    if let Err(e) = cam.open_stream() {
                        log::warn!("[camera] stream open failed: {e}"); return;
                    }
                    while !stop_clone.load(std::sync::atomic::Ordering::Relaxed) {
                        if let Ok(frame) = cam.frame() {
                            if let Ok(rgba) = frame.decode_image::<RgbAFormat>() {
                                let (w, h) = (rgba.width(), rgba.height());
                                let data = rgba.into_raw();
                                // Keep a permanent copy for CaptureCamera (never taken, only overwritten).
                                *raw_clone.lock().unwrap() = Some((w, h, data.clone()));
                                // Forward to recording thread if active.
                                if let Some(tx) = rec_tx_clone.lock().unwrap().as_ref() {
                                    let _ = tx.try_send((w, h, data.clone()));
                                }
                                // Render loop uses take() to detect new frames.
                                *buf_clone.lock().unwrap() = Some((w, h, data));
                                // Wake the winit event loop so the new frame is painted
                                // even when the user is not moving the mouse.
                                redraw();
                            }
                        }
                        std::thread::sleep(std::time::Duration::from_millis(33)); // ~30fps
                    }
                    let _ = cam.stop_stream();
                });

                state.camera_streams.insert(handle_id, CameraStream {
                    frame_buf,
                    last_raw_frame,
                    stop_flag,
                    latest_image: None,
                    record_frame_tx,
                    record_done_rx: None,
                });
            }
            SceneCommand::CloseCamera { handle_id } => {
                if let Some(stream) = state.camera_streams.remove(&handle_id) {
                    stream.stop_flag.store(true, std::sync::atomic::Ordering::Relaxed);
                }
            }
            SceneCommand::CaptureCamera { handle_id, tx } => {
                let result = if let Some(stream) = state.camera_streams.get(&handle_id) {
                    // Read last_raw_frame — never taken by render loop, always available.
                    match stream.last_raw_frame.lock().unwrap().clone() {
                        Some((w, h, data)) => {
                            let path = format!("{}/velox_photo_{}.png",
                                std::env::temp_dir().display(), handle_id);
                            match image::save_buffer(&path, &data, w, h, image::ColorType::Rgba8) {
                                Ok(())  => Ok(path),
                                Err(e)  => Err(format!("capture save failed: {e}")),
                            }
                        }
                        None => Err("no frame available yet — wait for stream to start".to_string()),
                    }
                } else {
                    Err(format!("camera handle {handle_id} not found"))
                };
                let _ = tx.0.send(result);
            }
            SceneCommand::StartCameraRecord { handle_id, output_path } => {
                if let Some(stream) = state.camera_streams.get_mut(&handle_id) {
                    // Bounded channel: at most 4 buffered frames so we don't OOM on slow encoder.
                    let (frame_tx, frame_rx) = std::sync::mpsc::sync_channel::<(u32, u32, Vec<u8>)>(4);
                    let (done_tx, done_rx)   = std::sync::mpsc::channel::<Result<String, String>>();
                    *stream.record_frame_tx.lock().unwrap() = Some(frame_tx);
                    stream.record_done_rx = Some(done_rx);

                    std::thread::spawn(move || {
                        // Wait for the first frame to learn dimensions.
                        let (w, h, first_data) = match frame_rx.recv() {
                            Ok(f)  => f,
                            Err(_) => { let _ = done_tx.send(Err("no frames received".to_string())); return; }
                        };

                        // ── Try velox-media DLL encoder first ────────────────────────────────
                        if let Some(media) = velox_media::get_media() {
                            match media.encoder_open(&output_path, w, h, 30) {
                                Ok(enc) => {
                                    let ok = media.encoder_write_rgba(&enc, &first_data).is_ok()
                                        && frame_rx.iter().all(|(_, _, data)| {
                                            media.encoder_write_rgba(&enc, &data).is_ok()
                                        });
                                    media.encoder_close(enc);
                                    let result = if ok {
                                        Ok(output_path)
                                    } else {
                                        Err("velox-media encoder write failed".to_string())
                                    };
                                    let _ = done_tx.send(result);
                                    return;
                                }
                                Err(e) => {
                                    log::warn!("[camera] velox-media encoder unavailable: {e}, falling back to ffmpeg");
                                }
                            }
                        }

                        // ── Fallback: subprocess ffmpeg ───────────────────────────────────────
                        use std::process::{Command, Stdio};
                        use std::io::Write;

                        let ffmpeg_bin = find_ffmpeg();
                        let child = Command::new(&ffmpeg_bin)
                            .args([
                                "-y",
                                "-f", "rawvideo",
                                "-pixel_format", "rgba",
                                "-video_size", &format!("{}x{}", w, h),
                                "-framerate", "30",
                                "-i", "pipe:0",
                                "-vf", "format=yuv420p",
                                "-c:v", "libx264",
                                "-preset", "ultrafast",
                                "-crf", "23",
                                &output_path,
                            ])
                            .stdin(Stdio::piped())
                            .stdout(Stdio::null())
                            .stderr(Stdio::null())
                            .spawn();

                        let mut child = match child {
                            Ok(c)  => c,
                            Err(e) => {
                                let _ = done_tx.send(Err(format!(
                                    "ffmpeg not found (tried '{ffmpeg_bin}'): {e}\n\
                                     Install ffmpeg and make sure it is in PATH, \
                                     or set the FFMPEG_PATH environment variable."
                                )));
                                return;
                            }
                        };

                        let mut stdin = child.stdin.take().unwrap();
                        let _ = stdin.write_all(&first_data);
                        while let Ok((_, _, data)) = frame_rx.recv() {
                            if stdin.write_all(&data).is_err() { break; }
                        }
                        drop(stdin); // close stdin → ffmpeg finalises the MP4
                        match child.wait() {
                            Ok(status) if status.success() => { let _ = done_tx.send(Ok(output_path)); }
                            Ok(status) => { let _ = done_tx.send(Err(format!("ffmpeg exited with {status}"))); }
                            Err(e)     => { let _ = done_tx.send(Err(format!("ffmpeg wait error: {e}"))); }
                        }
                    });
                }
            }
            SceneCommand::StopCameraRecord { handle_id, tx } => {
                if let Some(stream) = state.camera_streams.get_mut(&handle_id) {
                    // Drop the sender — signals recording thread to stop.
                    *stream.record_frame_tx.lock().unwrap() = None;

                    if let Some(done_rx) = stream.record_done_rx.take() {
                        // Wait off the main thread so we don't stall rendering.
                        std::thread::spawn(move || {
                            let result = done_rx
                                .recv()
                                .unwrap_or_else(|_| Err("recorder disconnected".to_string()));
                            let _ = tx.0.send(result);
                        });
                    } else {
                        let _ = tx.0.send(Err("no active recording".to_string()));
                    }
                } else {
                    let _ = tx.0.send(Err(format!("camera handle {handle_id} not found")));
                }
            }

            // ── Video player ──────────────────────────────────────────────────
            SceneCommand::OpenVideo { handle_id, url } => {
                let frame_buf = Arc::new(Mutex::new(None::<(u32, u32, Vec<u8>)>));
                let stop_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
                let (seek_tx, seek_rx) = std::sync::mpsc::sync_channel::<f64>(4);
                let events    = Arc::new(Mutex::new(std::collections::VecDeque::<String>::new()));

                // Open audio BEFORE the thread spawn which moves `url`.
                let (audio_sink, _audio_stream) = open_video_audio(&url);

                let buf_clone   = Arc::clone(&frame_buf);
                let stop_clone  = Arc::clone(&stop_flag);
                let ev_clone    = Arc::clone(&events);

                std::thread::spawn(move || {
                    let media = match velox_media::get_media() {
                        Some(m) => m,
                        None => {
                            let msg = format!(
                                r#"{{"type":"error","id":{handle_id},"message":"VeloxMediaNotAvailable"}}"#
                            );
                            ev_clone.lock().unwrap().push_back(msg);
                            return;
                        }
                    };

                    let dec = match media.decoder_open(&url) {
                        Ok(d)  => d,
                        Err(e) => {
                            let msg = format!(
                                r#"{{"type":"error","id":{handle_id},"message":{}}}"#,
                                serde_json::to_string(&e).unwrap_or_else(|_| format!("\"{e}\""))
                            );
                            ev_clone.lock().unwrap().push_back(msg);
                            return;
                        }
                    };

                    let (w, h, fps) = (dec.width, dec.height, dec.fps);
                    let rgba_size   = (w * h * 4) as usize;
                    let meta_msg = format!(
                        r#"{{"type":"metadata","id":{handle_id},"width":{w},"height":{h},"fps":{fps:.3}}}"#
                    );
                    ev_clone.lock().unwrap().push_back(meta_msg);

                    let frame_interval = std::time::Duration::from_secs_f64(1.0 / fps.max(1.0));
                    let mut rgba_buf   = vec![0u8; rgba_size];

                    loop {
                        if stop_clone.load(std::sync::atomic::Ordering::Relaxed) { break; }

                        // Handle seek requests (non-blocking drain).
                        while let Ok(secs) = seek_rx.try_recv() {
                            media.decoder_seek(&dec, secs);
                        }

                        match media.decoder_next_frame(&dec, &mut rgba_buf) {
                            Ok(Some(_pts)) => {
                                *buf_clone.lock().unwrap() = Some((w, h, rgba_buf.clone()));
                            }
                            Ok(None) => {
                                // End of stream.
                                let msg = format!(r#"{{"type":"ended","id":{handle_id}}}"#);
                                ev_clone.lock().unwrap().push_back(msg);
                                break;
                            }
                            Err(_) => break,
                        }

                        std::thread::sleep(frame_interval);
                    }

                    media.decoder_close(dec);
                });

                state.video_streams.insert(handle_id, VideoStream {
                    frame_buf,
                    stop_flag,
                    seek_tx,
                    events,
                    latest_image: None,
                    audio_sink,
                    _audio_stream,
                });
            }

            SceneCommand::SeekVideo { handle_id, seconds } => {
                if let Some(stream) = state.video_streams.get(&handle_id) {
                    let _ = stream.seek_tx.try_send(seconds);
                    // Audio seek requires rodio 0.18+; skip for now (audio continues from
                    // current position). Seeking to 0 restarts audio to minimize drift.
                    if seconds == 0.0 {
                        if let Some(sink) = &stream.audio_sink {
                            sink.stop();  // stops this source; audio will be silent after seek to 0
                        }
                    }
                }
            }

            SceneCommand::CloseVideo { handle_id } => {
                if let Some(stream) = state.video_streams.remove(&handle_id) {
                    stream.stop_flag.store(true, std::sync::atomic::Ordering::Relaxed);
                }
            }
        }
    }
    if layout_changed   { state.layout_dirty           = true; }
    if structure_changed { state.layout_structure_dirty = true; }
    true
}

/// Try to open the audio track of a local video file via rodio.
/// Returns `(None, None)` for network URLs or if no audio is found.
fn open_video_audio(url: &str) -> (Option<rodio::Sink>, Option<rodio::OutputStream>) {
    // Only handle local paths / file:// URIs
    let path = if url.starts_with("file:///") {
        url.trim_start_matches("file:///")
    } else if url.starts_with("file://") {
        url.trim_start_matches("file://")
    } else if url.starts_with("http://") || url.starts_with("https://") || url.starts_with("rtsp://") {
        return (None, None);
    } else {
        url
    };

    let file = match std::fs::File::open(path) {
        Ok(f)  => f,
        Err(e) => { log::debug!("[video-audio] cannot open {path}: {e}"); return (None, None); }
    };

    let (stream, handle) = match rodio::OutputStream::try_default() {
        Ok(pair) => pair,
        Err(e)   => { log::warn!("[video-audio] no audio output device: {e}"); return (None, None); }
    };

    let sink = match rodio::Sink::try_new(&handle) {
        Ok(s)  => s,
        Err(e) => { log::warn!("[video-audio] cannot create sink: {e}"); return (None, None); }
    };

    let source = match rodio::Decoder::new(std::io::BufReader::new(file)) {
        Ok(s)  => s,
        Err(e) => { log::debug!("[video-audio] no decodable audio track: {e}"); return (None, None); }
    };

    sink.append(source);
    sink.play();
    log::debug!("[video-audio] audio playing for {path}");
    (Some(sink), Some(stream))
}
