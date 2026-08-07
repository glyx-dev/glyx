use super::*;
use smallvec::SmallVec;
use crate::layout::layout_props_changed;

/// Locate the ffmpeg binary.
/// Priority: `FFMPEG_PATH` env var → ffmpeg-sidecar (dev) → common install locations → PATH.
#[cfg(feature = "camera")]
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
///
/// F4 — Supply-chain acceptance: `ffmpeg_sidecar::download::auto_download()` fetches
/// ffmpeg from a third-party CDN without a SHA-256 pin.  This is accepted because:
/// (a) this path is `#[cfg(feature = "dev")]` only — production builds use the
///     glyx-media DLL (which is Ed25519-signed + SHA-256 verified); (b) dev machines
///     are not part of the release trust chain; (c) pinning would require forking the
///     crate.  Documented here as an accepted low-severity residual (F4).
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

/// Placeholder shown when an image fails to load: light panel, gray border,
/// red diagonal cross — the classic "broken image" glyph. Built once, shared.
fn broken_image_placeholder() -> peniko::ImageData {
    static PLACEHOLDER: std::sync::OnceLock<peniko::ImageData> = std::sync::OnceLock::new();
    PLACEHOLDER.get_or_init(|| {
        const S: u32 = 64;
        let mut bytes = vec![0u8; (S * S * 4) as usize];
        for y in 0..S {
            for x in 0..S {
                let i = ((y * S + x) * 4) as usize;
                let border = x < 2 || y < 2 || x >= S - 2 || y >= S - 2;
                let d1 = (x as i32 - y as i32).abs() <= 2;
                let d2 = (x as i32 + y as i32 - (S as i32 - 1)).abs() <= 2;
                let (r, g, b) = if border {
                    (0x99, 0x99, 0x99)
                } else if d1 || d2 {
                    (0xCC, 0x44, 0x44)
                } else {
                    (0xEE, 0xEE, 0xEE)
                };
                bytes[i] = r;
                bytes[i + 1] = g;
                bytes[i + 2] = b;
                bytes[i + 3] = 0xFF;
            }
        }
        rgba_to_peniko(bytes, S, S).expect("placeholder image")
    }).clone()
}

fn load_image_from_path(path: &str, width: Option<f32>, height: Option<f32>) -> Option<peniko::ImageData> {
    // ── Data URI (e.g. from @glyx-dev/icons inline SVGs) ─────────────────────────
    if path.starts_with("data:") {
        let rest = &path["data:".len()..];
        if let Some(comma) = rest.find(',') {
            let meta    = &rest[..comma];
            let payload = &rest[comma + 1..];
            let is_svg  = meta.starts_with("image/svg+xml");
            let svg_bytes = if meta.contains(";base64") {
                use base64::Engine;
                base64::engine::general_purpose::STANDARD.decode(payload).ok()?
            } else {
                // URL-encoded plain text (encodeURIComponent from JS)
                let decoded = percent_decode(payload);
                decoded.into_owned().into_bytes()
            };
            if is_svg {
                return load_svg_from_bytes(&svg_bytes, width, height);
            }
        }
        log::warn!("[image] unsupported data URI scheme, skipping");
        return None;
    }
    let lower = path.to_ascii_lowercase();
    if lower.ends_with(".svg") {
        return load_svg_from_path(path, width, height);
    }
    let decoded = image::open(path).ok()?;
    let rgba = decoded.into_rgba8();
    let (w, h) = rgba.dimensions();
    rgba_to_peniko(rgba.into_raw(), w, h)
}

/// Decode a `%xx` percent-encoded string (output of JS `encodeURIComponent`).
fn percent_decode(s: &str) -> std::borrow::Cow<'_, str> {
    if !s.contains('%') { return std::borrow::Cow::Borrowed(s); }
    let bytes = s.as_bytes();
    let mut out = Vec::with_capacity(s.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            if let Ok(hi) = u8::from_str_radix(std::str::from_utf8(&bytes[i+1..i+2]).unwrap_or(""), 16) {
                if let Ok(lo) = u8::from_str_radix(std::str::from_utf8(&bytes[i+2..i+3]).unwrap_or(""), 16) {
                    out.push(hi << 4 | lo);
                    i += 3;
                    continue;
                }
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    std::borrow::Cow::Owned(String::from_utf8_lossy(&out).into_owned())
}

fn load_svg_from_path(path: &str, width: Option<f32>, height: Option<f32>) -> Option<peniko::ImageData> {
    let svg_data = std::fs::read(path).ok()?;
    load_svg_from_bytes(&svg_data, width, height)
}

fn load_svg_from_bytes(svg_data: &[u8], width: Option<f32>, height: Option<f32>) -> Option<peniko::ImageData> {
    let opts = resvg::usvg::Options::default();
    let tree = resvg::usvg::Tree::from_data(svg_data, &opts).ok()?;
    let size = tree.size();
    let (iw, ih) = (size.width(), size.height());
    if iw <= 0.0 || ih <= 0.0 {
        return None;
    }
    let (tw, th) = match (width, height) {
        (Some(w), Some(h)) => (w, h),
        (Some(w), None)    => (w, w * ih / iw),
        (None, Some(h))    => (h * iw / ih, h),
        (None, None)       => (iw, ih),
    };
    let w = tw.ceil().max(1.0) as u32;
    let h = th.ceil().max(1.0) as u32;
    let mut pixmap = resvg::tiny_skia::Pixmap::new(w, h)?;
    let transform = resvg::tiny_skia::Transform::from_scale(tw / iw, th / ih);
    resvg::render(&tree, transform, &mut pixmap.as_mut());
    rgba_premul_srgb_to_peniko(pixmap.take(), w, h)
}

/// Convert straight-alpha sRGB bytes (from image crate) → linear premultiplied RGBA.
fn rgba_to_peniko(mut bytes: Vec<u8>, w: u32, h: u32) -> Option<peniko::ImageData> {
    for px in bytes.chunks_exact_mut(4) {
        px[0] = srgb_to_linear_u8(px[0]);
        px[1] = srgb_to_linear_u8(px[1]);
        px[2] = srgb_to_linear_u8(px[2]);
        let a = px[3] as u16;
        px[0] = ((px[0] as u16 * a + 127) / 255) as u8;
        px[1] = ((px[1] as u16 * a + 127) / 255) as u8;
        px[2] = ((px[2] as u16 * a + 127) / 255) as u8;
    }
    Some(peniko::ImageData {
        data: peniko::Blob::from(bytes),
        format: peniko::ImageFormat::Rgba8,
        alpha_type: peniko::ImageAlphaType::AlphaPremultiplied,
        width: w, height: h,
    })
}

/// Convert premultiplied sRGB bytes (resvg/tiny_skia output) → linear premultiplied RGBA.
/// Must un-premultiply before linearising to avoid double-premultiplication, which
/// would make antialiased edges nearly transparent and render thin SVG strokes invisible.
fn rgba_premul_srgb_to_peniko(mut bytes: Vec<u8>, w: u32, h: u32) -> Option<peniko::ImageData> {
    for px in bytes.chunks_exact_mut(4) {
        let a = px[3];
        if a == 0 { continue; }
        if a == 255 {
            // Fully opaque: just linearise in place.
            px[0] = srgb_to_linear_u8(px[0]);
            px[1] = srgb_to_linear_u8(px[1]);
            px[2] = srgb_to_linear_u8(px[2]);
        } else {
            // Un-premultiply → linearise → re-premultiply.
            let inv = 255.0 / a as f32;
            let lr = srgb_to_linear_u8((px[0] as f32 * inv).min(255.0) as u8);
            let lg = srgb_to_linear_u8((px[1] as f32 * inv).min(255.0) as u8);
            let lb = srgb_to_linear_u8((px[2] as f32 * inv).min(255.0) as u8);
            let a16 = a as u16;
            px[0] = ((lr as u16 * a16 + 127) / 255) as u8;
            px[1] = ((lg as u16 * a16 + 127) / 255) as u8;
            px[2] = ((lb as u16 * a16 + 127) / 255) as u8;
        }
    }
    Some(peniko::ImageData {
        data: peniko::Blob::from(bytes),
        format: peniko::ImageFormat::Rgba8,
        alpha_type: peniko::ImageAlphaType::AlphaPremultiplied,
        width: w, height: h,
    })
}

/// Advance every active opacity transition one frame, marking transitioning
/// nodes dirty so they actually re-render (opacity is changing with no new
/// `SceneCommand` behind it). Returns `true` if any transition is still
/// running after this tick — the caller uses that to force a GPU render and
/// schedule the next frame, since nothing else would otherwise wake the
/// render loop mid-transition.
pub(crate) fn tick_opacity_transitions(state: &mut PerWindowState) -> bool {
    if state.opacity_transitions.is_empty() { return false; }
    let now = Instant::now();
    let dirty_nodes = &mut state.dirty_nodes;
    state.opacity_transitions.retain(|&id, t| {
        let (_, finished) = t.sample(now);
        dirty_nodes.insert(id);
        !finished
    });
    !state.opacity_transitions.is_empty()
}

pub(crate) fn apply_scene_commands(state: &mut PerWindowState, commands: Vec<SceneCommand>) -> bool {
    if commands.is_empty() {
        return false;
    }
    // Mark the a11y tree dirty whenever any scene command actually ran, rather
    // than rebuilding it every rendered frame regardless of activity — the
    // tree only needs to change when the scene graph does. Slightly
    // conservative (canvas/media commands don't affect the tree but still
    // set this), which is fine: idle frames where NOTHING changed are the
    // case this actually needs to avoid.
    #[cfg(feature = "a11y")]
    { state.a11y_dirty = true; }
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
                state.dirty_nodes.insert(id);
                layout_changed   = true;
                structure_changed = true;
            }
            SceneCommand::CreateImage { id, path, width, height } => {
                // SVGs are rasterized per requested display size, so the cache
                // key carries the size; bitmaps decode once regardless of size.
                let cache_key = if path.to_ascii_lowercase().ends_with(".svg") {
                    format!(
                        "{path}#{}x{}",
                        width.map_or(0, |v| v.ceil() as u32),
                        height.map_or(0, |v| v.ceil() as u32),
                    )
                } else {
                    path.clone()
                };
                if let Some(image) = state.images_by_path.get(&cache_key).cloned() {
                    state.image_cache_hits += 1;
                    state.images.insert(id, image);
                } else {
                    state.image_cache_misses += 1;
                    if let Some(image) = load_image_from_path(&path, width, height) {
                        state.images_by_path.put(cache_key, image.clone());
                        state.images.insert(id, image);
                    } else {
                        log::error!("Failed to load image at path: {}", path);
                        // Show a broken-image placeholder instead of rendering
                        // nothing. Deliberately NOT cached by path, so a fixed
                        // file is retried on the next CreateImage for that src.
                        state.images.insert(id, broken_image_placeholder());
                        // Let JS fire the <Image onError> callback.
                        state.runtime.push_event(
                            crate::InputEvent::ImageError { image_id: id, path: path.clone() },
                        );
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
                state.dirty_nodes.insert(parent_id);
                layout_changed   = true;
                structure_changed = true;
            }
            SceneCommand::InsertBefore { parent_id, child_id, before_id } => {
                if let Some(parent) = state.js_nodes.get_mut(&parent_id) {
                    parent.children.retain(|c| *c != child_id);
                    if let Some(pos) = parent.children.iter().position(|&c| c == before_id) {
                        parent.children.insert(pos, child_id);
                    } else {
                        parent.children.push(child_id);
                    }
                }
                state.dirty_nodes.insert(parent_id);
                layout_changed   = true;
                structure_changed = true;
            }
            SceneCommand::UpdateNode { id, props } => {
                // Check layout-prop changes before mutating — need old props for comparison.
                // Also detect prop changes that must cascade dirty state to all descendants:
                //   • opacity  — child_opacity is a running product; parent change affects leaves
                //   • scroll_offset_y — absolute y-positions are baked into cached leaf scenes
                // Other visual changes (background, border, shadow, transform) do NOT cascade
                // because they are rendered at the container level and leave leaf scenes intact.
                let (changed, opt_lid, opt_nt, needs_cascade) =
                    if let Some(node) = state.js_nodes.get(&id) {
                        let cascade = node.props.opacity         != props.opacity
                                   || node.props.scroll_offset_y != props.scroll_offset_y;
                        if layout_props_changed(&props, &node.props) {
                            (true, node.layout_id, Some(node.node_type.clone()), cascade)
                        } else {
                            (false, None, None, cascade)
                        }
                    } else {
                        (false, None, None, false)
                    };
                if needs_cascade {
                    state.descendant_cascade_nodes.insert(id);
                }
                // `@glyx-dev/motion` v1: an opacity change with `transitionMs` set
                // starts (or retargets) a Rust-owned interpolation instead of
                // snapping. Must read the OLD effective opacity (mid-transition
                // value if one was already running) before it's overwritten below.
                if let (Some(old), Some(ms)) = (
                    state.js_nodes.get(&id),
                    props.transition_ms,
                ) {
                    let new_opacity = props.opacity.unwrap_or(1.0);
                    let from = state.opacity_transitions.get(&id)
                        .map(|t| t.sample(Instant::now()).0)
                        .unwrap_or_else(|| old.props.opacity.unwrap_or(1.0));
                    if (new_opacity - from).abs() > f32::EPSILON {
                        state.opacity_transitions.insert(id, OpacityTransition {
                            from, to: new_opacity, start: Instant::now(), duration_ms: ms,
                        });
                    }
                } else {
                    // No transition declared (or first-ever props for this node) —
                    // any previously-running transition for this id is stale.
                    state.opacity_transitions.remove(&id);
                }

                if let Some(node) = state.js_nodes.get_mut(&id) {
                    node.props = props.clone();
                }
                // Any UpdateNode is a visual change — mark dirty regardless of layout impact.
                state.dirty_nodes.insert(id);
                if changed {
                    layout_changed = true;
                    // Incremental path: update Taffy style in-place + mark dirty.
                    // No structure change — skip full rebuild in recompute_layout.
                    if let (Some(lid), Some(nt)) = (opt_lid, opt_nt) {
                        let new_style = layout::to_taffy_style(&nt, &props);
                        let _ = state.layout.set_style(lid, new_style);
                        let _ = state.layout.mark_dirty(lid);

                        // Text nodes also carry a `TextMeasureCtx` set once at
                        // creation (see `build_subtree`) — `set_style` above never
                        // touches it. Without refreshing it here, Taffy keeps
                        // auto-sizing against the node's *original* text forever,
                        // so a growing string (a counter passing single digits,
                        // for example) gets painted into a box still sized for the
                        // first render and silently wraps/clips.
                        if nt == NodeType::Text {
                            let font_size = props.font_size.unwrap_or(16.0);
                            let max_height = props.number_of_lines
                                .map(|n| n as f32 * font_size * 1.4);
                            let ctx = TextMeasureCtx {
                                text: props.text.clone().unwrap_or_default(),
                                font_size,
                                max_height,
                                bold:   props.font_weight.as_deref() == Some("bold"),
                                italic: props.font_style.as_deref()  == Some("italic"),
                            };
                            let _ = state.layout.set_text_ctx(lid, ctx);
                        }
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
                #[cfg(feature = "canvas3d")]
                {
                    state.canvas3d_scenes.remove(&id);
                    state.canvas3d_dirty.remove(&id);
                    if let Some(r3d) = &mut state.renderer_3d {
                        r3d.remove_canvas(id);
                        if state.canvas3d_scenes.is_empty() {
                            state.renderer_3d = None;
                        }
                    }
                }
                #[cfg(feature = "webview")]
                {
                    if let Some(handle) = state.webview_instances.remove(&id) {
                        if let Some(cap) = state.webview_cap {
                            unsafe { (cap.destroy)(handle); }
                        }
                    }
                    state.webview_last_src.remove(&id);
                    state.webview_last_bounds.remove(&id);
                    state.webview_hidden.remove(&id);
                }
                state.js_nodes.remove(&id);
                if state.focused_node == Some(id) {
                    state.focused_node = None;
                }
                // Clean up all per-node state for the removed node.
                state.dirty_nodes.remove(&id);
                state.dirty_subtrees.remove(&id);
                state.prev_resolved.remove(&id);
                state.scene_cache.remove(&id);
                state.scene_cache_new.remove(&id);
                // If a scrollbar drag was active on this node, cancel it so the
                // stale node_id is never used for scroll updates after removal.
                if state.scrollbar_drag.as_ref().is_some_and(|d| d.node_id == id) {
                    state.scrollbar_drag = None;
                }
                // Unlink from any parent's children list so stale ghost IDs don't
                // accumulate in the renderer's traversal.  O(n × avg_children) but
                // n < 1000 in practice so this is negligible.
                let mut dirtied_parents: SmallVec<[u32; 2]> = SmallVec::new();
                for (&parent_id, node) in state.js_nodes.iter_mut() {
                    let before = node.children.len();
                    node.children.retain(|c| *c != id);
                    if node.children.len() != before {
                        dirtied_parents.push(parent_id);
                    }
                }
                for pid in dirtied_parents {
                    state.dirty_nodes.insert(pid);
                }
                layout_changed   = true;
                structure_changed = true;
            }
            SceneCommand::SetRoot { id } => {
                state.js_root = Some(id);
                state.dirty_nodes.insert(id);
                layout_changed   = true;
                structure_changed = true;
            }
            SceneCommand::SetFocus { id } => {
                state.focused_node = id;
                // Only allow IME composition while a text field is actually
                // focused — otherwise the OS may show a candidate window with
                // nowhere for composed text to go.
                state.window.set_ime_allowed(id.is_some());
            }
            SceneCommand::CanvasUpdate { id, cmds, append } => {
                if append {
                    // Overflow continuation: extend the existing command list.
                    state.canvas_cmds.entry(id).or_default().extend(cmds);
                } else {
                    state.canvas_cmds.insert(id, cmds);
                }
                state.dirty_nodes.insert(id);
                // Canvas draw commands don't affect layout.
            }
            #[cfg(feature = "canvas3d")]
            SceneCommand::Canvas3DUpdate { id, scene } => {
                state.canvas3d_scenes.insert(id, scene);
                state.dirty_nodes.insert(id);
                state.canvas3d_dirty.insert(id);
            }
            #[cfg(feature = "canvas3d")]
            SceneCommand::Canvas3DUnloadGltf { path } => {
                if let Some(r3d) = state.renderer_3d.as_mut() {
                    r3d.unload_gltf(&path);
                }
            }
            #[cfg(feature = "webview")]
            SceneCommand::WebviewPostMessage { id, msg } => {
                if let Some(&handle) = state.webview_instances.get(&id) {
                    if let Some(cap) = state.webview_cap {
                        unsafe { (cap.post_message)(handle, msg.as_ptr(), msg.len()); }
                    }
                }
            }
            #[cfg(feature = "camera")]
            SceneCommand::OpenCamera { handle_id, device_index } => {
                let frame_buf       = Arc::new(Mutex::new(None::<(u32, u32, Vec<u8>)>));
                let last_raw_frame  = Arc::new(Mutex::new(None::<(u32, u32, Vec<u8>)>));
                let stop_flag       = Arc::new(std::sync::atomic::AtomicBool::new(false));
                let capture_fps     = Arc::new(std::sync::atomic::AtomicU32::new(30));
                let record_frame_tx = Arc::new(Mutex::new(None::<std::sync::mpsc::SyncSender<(u32, u32, Vec<u8>)>>));
                let buf_clone      = Arc::clone(&frame_buf);
                let raw_clone      = Arc::clone(&last_raw_frame);
                let stop_clone     = Arc::clone(&stop_flag);
                let fps_clone      = Arc::clone(&capture_fps);
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

                    let actual_fps = cam.camera_format().frame_rate().clamp(1, 240);
                    fps_clone.store(actual_fps, std::sync::atomic::Ordering::Relaxed);
                    log::info!("[camera] stream open (nokhwa reports {}fps)", actual_fps);

                    // No pre-throttling — forward every frame as it arrives.
                    // The recording thread measures actual inter-frame intervals and uses
                    // that rate as the encoder FPS, so playback speed is always correct.
                    while !stop_clone.load(std::sync::atomic::Ordering::Relaxed) {
                        match cam.frame() {
                            Ok(frame) => {
                                if let Ok(rgba) = frame.decode_image::<RgbAFormat>() {
                                    let (w, h) = (rgba.width(), rgba.height());
                                    let data = rgba.into_raw();
                                    // Keep a permanent copy for CaptureCamera (still photo).
                                    *raw_clone.lock() = Some((w, h, data.clone()));
                                    // Forward to recording thread if active (try_send = non-blocking).
                                    if let Some(tx) = rec_tx_clone.lock().as_ref() {
                                        let _ = tx.try_send((w, h, data.clone()));
                                    }
                                    // Render loop uses take() to detect new frames.
                                    *buf_clone.lock() = Some((w, h, data));
                                    // Wake the winit event loop to paint the new frame.
                                    redraw();
                                }
                            }
                            // No frame ready yet — brief backoff to avoid busy-looping.
                            Err(_) => std::thread::sleep(std::time::Duration::from_millis(1)),
                        }
                    }
                    let _ = cam.stop_stream();
                });

                state.camera_streams.insert(handle_id, CameraStream {
                    frame_buf,
                    last_raw_frame,
                    stop_flag,
                    latest_image: None,
                    capture_fps,
                    record_frame_tx,
                    record_done_rx: None,
                });
            }
            #[cfg(feature = "camera")]
            SceneCommand::CloseCamera { handle_id } => {
                if let Some(stream) = state.camera_streams.remove(&handle_id) {
                    stream.stop_flag.store(true, std::sync::atomic::Ordering::Relaxed);
                }
            }
            #[cfg(feature = "camera")]
            SceneCommand::CaptureCamera { handle_id, tx } => {
                let result = if let Some(stream) = state.camera_streams.get(&handle_id) {
                    // Read last_raw_frame — never taken by render loop, always available.
                    match stream.last_raw_frame.lock().clone() {
                        Some((w, h, data)) => {
                            let path = format!("{}/glyx_photo_{}.png",
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
            #[cfg(feature = "camera")]
            SceneCommand::StartCameraRecord { handle_id, output_path } => {
                if let Some(stream) = state.camera_streams.get_mut(&handle_id) {
                    // Buffer enough frames for FPS calibration before the encoder opens.
                    // 8 slots: capture thread can pipeline frames while calibration runs.
                    let (frame_tx, frame_rx) = std::sync::mpsc::sync_channel::<(u32, u32, Vec<u8>)>(8);
                    let (done_tx, done_rx)   = std::sync::mpsc::channel::<Result<String, String>>();
                    *stream.record_frame_tx.lock() = Some(frame_tx);
                    stream.record_done_rx = Some(done_rx);

                    std::thread::spawn(move || {
                        // ── Phase 1: Calibrate actual frame delivery rate ──────────────────
                        // Collect up to CAL_FRAMES to measure inter-frame intervals.
                        // Using (N-1) intervals / elapsed avoids including thread-spawn lag.
                        const CAL_FRAMES: usize = 8;
                        let frame_timeout = std::time::Duration::from_secs(2);
                        let mut buffered: Vec<(u32, u32, Vec<u8>)> = Vec::with_capacity(CAL_FRAMES);
                        let mut t_first: Option<std::time::Instant> = None;
                        let mut t_last  = std::time::Instant::now();

                        loop {
                            if buffered.len() >= CAL_FRAMES { break; }
                            match frame_rx.recv_timeout(frame_timeout) {
                                Ok(f) => {
                                    let now = std::time::Instant::now();
                                    if t_first.is_none() { t_first = Some(now); }
                                    t_last = now;
                                    buffered.push(f);
                                }
                                Err(_) => break, // channel closed or timeout
                            }
                        }

                        if buffered.is_empty() {
                            let _ = done_tx.send(Err("no frames received".to_string()));
                            return;
                        }

                        let fps: u32 = if buffered.len() >= 2 {
                            let span = (t_last - t_first.unwrap()).as_secs_f64().max(0.001);
                            let intervals = (buffered.len() - 1) as f64;
                            ((intervals / span).round() as u32).clamp(5, 60)
                        } else {
                            24 // single-frame recording — conservative default
                        };
                        log::info!("[camera] encoder fps={fps} (measured over {} calibration frames)", buffered.len());

                        let (w, h) = (buffered[0].0, buffered[0].1);

                        // ── Phase 2: Open encoder and write all frames ────────────────────
                        if let Some(media) = glyx_media::get_media() {
                            match media.encoder_open(&output_path, w, h, fps) {
                                Ok(enc) => {
                                    let mut ok = true;
                                    for (_, _, ref data) in &buffered {
                                        if media.encoder_write_rgba(&enc, data).is_err() { ok = false; break; }
                                    }
                                    if ok {
                                        for (_, _, data) in frame_rx.iter() {
                                            if media.encoder_write_rgba(&enc, &data).is_err() { ok = false; break; }
                                        }
                                    }
                                    media.encoder_close(enc);
                                    let _ = done_tx.send(if ok {
                                        Ok(output_path)
                                    } else {
                                        Err("glyx-media encoder write failed".to_string())
                                    });
                                    return;
                                }
                                Err(e) => {
                                    log::warn!("[camera] glyx-media encoder unavailable: {e}, falling back to ffmpeg");
                                }
                            }
                        }

                        // ── Fallback: subprocess ffmpeg ───────────────────────────────────
                        use std::process::{Command, Stdio};
                        use std::io::Write;

                        let ffmpeg_bin = find_ffmpeg();
                        let fps_str = fps.to_string();
                        let child = Command::new(&ffmpeg_bin)
                            .args([
                                "-y",
                                "-f", "rawvideo",
                                "-pixel_format", "rgba",
                                "-video_size", &format!("{}x{}", w, h),
                                "-framerate", &fps_str,
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
                        for (_, _, ref data) in &buffered {
                            if stdin.write_all(data).is_err() { break; }
                        }
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
            #[cfg(feature = "camera")]
            SceneCommand::StopCameraRecord { handle_id, tx } => {
                if let Some(stream) = state.camera_streams.get_mut(&handle_id) {
                    // Drop the sender — signals recording thread to stop.
                    *stream.record_frame_tx.lock() = None;

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
                let frame_buf      = Arc::new(Mutex::new(None::<(u32, u32, Vec<u8>)>));
                let stop_flag      = Arc::new(std::sync::atomic::AtomicBool::new(false));
                let pause_flag     = Arc::new(std::sync::atomic::AtomicBool::new(false));
                let audio_stop_flag = Arc::new(std::sync::atomic::AtomicBool::new(false));
                let video_volume   = Arc::new(Mutex::new(1.0_f32));
                let (seek_tx, seek_rx) = std::sync::mpsc::sync_channel::<f64>(4);
                let events = Arc::new(Mutex::new(std::collections::VecDeque::<String>::new()));

                // Audio thread owns its OutputStream + Sink (!Send) — reads volume + pause_flag each poll.
                spawn_video_audio(&url, Arc::clone(&stop_flag), Arc::clone(&audio_stop_flag), Arc::clone(&pause_flag), Arc::clone(&video_volume), 0.0);

                let url_stored  = url.clone(); // keep a copy for SeekVideo audio restart
                let buf_clone   = Arc::clone(&frame_buf);
                let stop_clone  = Arc::clone(&stop_flag);
                let pause_clone = Arc::clone(&pause_flag);
                let ev_clone    = Arc::clone(&events);
                let redraw      = Arc::clone(&state.request_redraw);

                std::thread::spawn(move || {
                    let media = match glyx_media::get_media() {
                        Some(m) => m,
                        None => {
                            let msg = format!(
                                r#"{{"type":"error","id":{handle_id},"message":"GlyxMediaNotAvailable"}}"#
                            );
                            ev_clone.lock().push_back(msg);
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
                            ev_clone.lock().push_back(msg);
                            return;
                        }
                    };

                    let (w, h, fps) = (dec.width, dec.height, dec.fps);
                    let rgba_size   = (w * h * 4) as usize;
                    let duration_secs = media.decoder_duration(&dec);
                    let meta_msg = format!(
                        r#"{{"type":"metadata","id":{handle_id},"width":{w},"height":{h},"fps":{fps:.3},"durationSecs":{duration_secs:.3}}}"#
                    );
                    ev_clone.lock().push_back(meta_msg);

                    let mut rgba_buf = vec![0u8; rgba_size];

                    let mut wall_start: Option<std::time::Instant> = None;
                    let mut pts_start  = 0f64;

                    // Push timeupdate events at most 4× per second (250ms throttle).
                    let timeupdate_interval = std::time::Duration::from_millis(250);
                    let mut last_timeupdate = std::time::Instant::now();

                    loop {
                        if stop_clone.load(std::sync::atomic::Ordering::Relaxed) { break; }

                        // Pause: spin-wait and reset A/V sync anchor so resume stays in sync.
                        if pause_clone.load(std::sync::atomic::Ordering::Relaxed) {
                            wall_start = None; // reset so A/V sync restarts fresh on resume
                            std::thread::sleep(std::time::Duration::from_millis(20));
                            continue;
                        }

                        while let Ok(secs) = seek_rx.try_recv() {
                            media.decoder_seek(&dec, secs);
                            wall_start = None;
                        }

                        match media.decoder_next_frame(&dec, &mut rgba_buf) {
                            Ok(Some(pts)) => {
                                *buf_clone.lock() = Some((w, h, rgba_buf.clone()));
                                (redraw)(); // wake the event loop so this frame is painted immediately

                                let ws = wall_start.get_or_insert_with(|| {
                                    pts_start = pts;
                                    std::time::Instant::now()
                                });

                                let video_pos = pts - pts_start;
                                let to_sleep  = video_pos - ws.elapsed().as_secs_f64();
                                if to_sleep > 0.001 {
                                    std::thread::sleep(
                                        std::time::Duration::from_secs_f64(to_sleep));
                                }

                                // Throttled timeupdate event.
                                if last_timeupdate.elapsed() >= timeupdate_interval {
                                    let msg = format!(
                                        r#"{{"type":"timeupdate","id":{handle_id},"currentTime":{pts:.3}}}"#
                                    );
                                    ev_clone.lock().push_back(msg);
                                    last_timeupdate = std::time::Instant::now();
                                }
                            }
                            Ok(None) => {
                                let msg = format!(r#"{{"type":"ended","id":{handle_id}}}"#);
                                ev_clone.lock().push_back(msg);
                                break;
                            }
                            Err(_) => break,
                        }
                    }

                    media.decoder_close(dec);
                });

                state.video_streams.insert(handle_id, VideoStream {
                    frame_buf,
                    stop_flag,
                    pause_flag,
                    audio_stop_flag,
                    seek_tx,
                    events,
                    latest_image: None,
                    video_volume,
                    url: url_stored,
                });
            }

            SceneCommand::SeekVideo { handle_id, seconds } => {
                if let Some(stream) = state.video_streams.get_mut(&handle_id) {
                    // Seek the video decode thread.
                    let _ = stream.seek_tx.try_send(seconds);
                    // Restart audio from the new position:
                    // signal old audio thread to stop, spawn a new one from `seconds`.
                    stream.audio_stop_flag.store(true, std::sync::atomic::Ordering::Relaxed);
                    let new_audio_stop = Arc::new(std::sync::atomic::AtomicBool::new(false));
                    stream.audio_stop_flag = Arc::clone(&new_audio_stop);
                    spawn_video_audio(
                        &stream.url,
                        Arc::clone(&stream.stop_flag),
                        new_audio_stop,
                        Arc::clone(&stream.pause_flag),
                        Arc::clone(&stream.video_volume),
                        seconds,
                    );
                }
            }

            SceneCommand::SetVideoVolume { handle_id, volume } => {
                if let Some(stream) = state.video_streams.get(&handle_id) {
                    *stream.video_volume.lock() = volume.clamp(0.0, 2.0);
                }
            }

            SceneCommand::PauseVideo { handle_id } => {
                if let Some(stream) = state.video_streams.get(&handle_id) {
                    stream.pause_flag.store(true, std::sync::atomic::Ordering::Relaxed);
                }
            }

            SceneCommand::ResumeVideo { handle_id } => {
                if let Some(stream) = state.video_streams.get(&handle_id) {
                    stream.pause_flag.store(false, std::sync::atomic::Ordering::Relaxed);
                }
            }

            SceneCommand::CloseVideo { handle_id } => {
                if let Some(stream) = state.video_streams.remove(&handle_id) {
                    stream.stop_flag.store(true, std::sync::atomic::Ordering::Relaxed);
                }
            }
            SceneCommand::HideSplash => {
                if let Some(sp) = state.splash_state.as_mut() {
                    sp.hidden = true;
                }
            }
        }
    }
    if layout_changed   { state.layout_dirty           = true; }
    if structure_changed { state.layout_structure_dirty = true; }
    true
}

/// Compare the freshly computed layout positions against the previous frame's
/// snapshot.  Any node whose x/y/width/height changed is added to `dirty_nodes`.
///
/// Call this **after** `recompute_layout` and **before** `build_dirty_subtrees`.
/// Returns `true` if at least one node moved/resized (feeds the frame gate).
pub(crate) fn update_dirty_from_layout(state: &mut PerWindowState) -> bool {
    // Build reverse map: Taffy NodeId → JS node u32
    let node_id_to_js: std::collections::HashMap<NodeId, u32> = state.js_nodes
        .iter()
        .filter_map(|(&js_id, node)| node.layout_id.map(|lid| (lid, js_id)))
        .collect();

    let mut any_changed = false;
    for &(nid, ref rl) in &state.resolved {
        let Some(&js_id) = node_id_to_js.get(&nid) else { continue };
        let changed = match state.prev_resolved.get(&js_id) {
            Some(prev) => {
                prev.x != rl.x || prev.y != rl.y
                    || prev.width != rl.width || prev.height != rl.height
            }
            None => true, // new node — treat as dirty
        };
        if changed {
            state.dirty_nodes.insert(js_id);
            any_changed = true;
        }
    }
    any_changed
}

/// Compute the union damage rect for this frame from the dirty node set.
///
/// Returns `Some((x, y, w, h))` when every visual change this frame is
/// provably contained in that rect, `None` when a full-frame render is
/// required.  Used by the software present path to redraw + push only the
/// changed region (a hover repaints one button, a keystroke one line).
///
/// Full-frame bailout conditions (correctness over cleverness):
/// - a dirty node has a `transform` (visual bounds ≠ layout bounds) or a
///   `box_shadow` (draws outside its rect),
/// - a dirty node is missing from the tree or has no resolved layout
///   (just removed / not yet laid out),
/// - `dirty_nodes` is empty (callers treat that as "render everything").
///
/// Scroll handling: a node inside a scrolled ancestor renders at
/// `resolved.y - Σ ancestor offsets`, which this function does not replay.
/// Instead, the OUTERMOST ancestor with a non-zero `scroll_offset_y` is used
/// as the damage contribution — its own rect is absolute-correct and clips
/// its content, so it bounds the node's old and new visual positions.
pub(crate) fn compute_frame_damage(state: &PerWindowState) -> Option<(f64, f64, f64, f64)> {
    if state.dirty_nodes.is_empty() {
        return None;
    }

    // layout NodeId → resolved rect
    let resolved: std::collections::HashMap<NodeId, &ResolvedLayout> =
        state.resolved.iter().map(|(nid, rl)| (*nid, rl)).collect();
    // child → parent
    let mut parent_of: std::collections::HashMap<u32, u32> =
        std::collections::HashMap::with_capacity(state.js_nodes.len());
    for (&pid, node) in &state.js_nodes {
        for &cid in &node.children {
            parent_of.insert(cid, pid);
        }
    }

    let mut ltrb: Option<(f64, f64, f64, f64)> = None;

    fn add(ltrb: &mut Option<(f64, f64, f64, f64)>, x: f64, y: f64, w: f64, h: f64) {
        // Padding covers anti-aliased edges and 1px layout rounding.
        const PAD: f64 = 4.0;
        let (l, t, r, b) = (x - PAD, y - PAD, x + w + PAD, y + h + PAD);
        *ltrb = Some(match *ltrb {
            None                     => (l, t, r, b),
            Some((ul, ut, ur, ub))   => (ul.min(l), ut.min(t), ur.max(r), ub.max(b)),
        });
    }

    for &id in &state.dirty_nodes {
        let Some(node) = state.js_nodes.get(&id) else { return None };
        if node.props.transform.is_some() || node.props.box_shadow.is_some() {
            return None;
        }

        // Outermost scrolled ancestor bounds this node's visual position.
        let mut cur = id;
        let mut outer_scrolled: Option<u32> = None;
        while let Some(&pid) = parent_of.get(&cur) {
            if let Some(pn) = state.js_nodes.get(&pid) {
                if pn.props.scroll_offset_y.unwrap_or(0.0) != 0.0 {
                    outer_scrolled = Some(pid);
                }
            }
            cur = pid;
        }

        let target = outer_scrolled.unwrap_or(id);
        let Some(tnode) = state.js_nodes.get(&target)     else { return None };
        let Some(lid)   = tnode.layout_id                  else { return None };
        let Some(rl)    = resolved.get(&lid)               else { return None };
        add(&mut ltrb, rl.x as f64, rl.y as f64, rl.width as f64, rl.height as f64);

        // Include the PREVIOUS rect so moved/shrunk nodes erase their old
        // pixels (prev_resolved is keyed by JS id and still holds last frame).
        if let Some(prl) = state.prev_resolved.get(&target) {
            add(&mut ltrb, prl.x as f64, prl.y as f64,
                prl.width as f64, prl.height as f64);
        }
    }

    ltrb.map(|(l, t, r, b)| (l, t, r - l, b - t))
}

/// Update `prev_resolved` snapshot with the positions computed this frame.
/// Call this **after** `render_subtree` (once the frame is definitely going to screen).
pub(crate) fn snapshot_resolved(state: &mut PerWindowState) {
    let node_id_to_js: std::collections::HashMap<NodeId, u32> = state.js_nodes
        .iter()
        .filter_map(|(&js_id, node)| node.layout_id.map(|lid| (lid, js_id)))
        .collect();

    state.prev_resolved.clear();
    for &(nid, rl) in &state.resolved {
        if let Some(&js_id) = node_id_to_js.get(&nid) {
            state.prev_resolved.insert(js_id, rl);
        }
    }
}

/// Build `dirty_subtrees` from `dirty_nodes`:
///
/// - The dirty nodes themselves (need fresh render).
/// - All **ancestors** of dirty nodes — so `render_subtree` can traverse the
///   tree down to dirty leaves without being blocked by the early-return guard.
/// - All **descendants** of dirty nodes — because changing a node's background,
///   clip, or opacity affects everything painted on top of it.
///
/// An empty `dirty_subtrees` means "render everything" (blink / media frames).
pub(crate) fn build_dirty_subtrees(state: &mut PerWindowState) {
    state.dirty_subtrees.clear();
    if state.dirty_nodes.is_empty() {
        // Empty → early-return guard in render_subtree never fires → full render.
        // Also nothing to cascade, so clear the cascade set and return.
        state.descendant_cascade_nodes.clear();
        return;
    }

    // Seed with the dirty nodes themselves.
    state.dirty_subtrees.extend(state.dirty_nodes.iter().copied());

    // Build child→parent map for the ancestor walk.
    let mut parent_of: std::collections::HashMap<u32, u32> =
        std::collections::HashMap::with_capacity(state.js_nodes.len());
    for (&pid, node) in &state.js_nodes {
        for &cid in &node.children {
            parent_of.insert(cid, pid);
        }
    }

    // Walk ancestors so render_subtree traversal can reach each dirty node.
    // Required for ALL dirty nodes (containers need ancestors to recurse into them).
    let dirty_snap: SmallVec<[u32; 16]> = state.dirty_nodes.iter().copied().collect();
    for &start in &dirty_snap {
        let mut cur = start;
        while let Some(&pid) = parent_of.get(&cur) {
            if !state.dirty_subtrees.insert(pid) {
                break; // ancestor chain already visited
            }
            cur = pid;
        }
    }

    // Selectively cascade to descendants — only for opacity and scroll changes.
    //
    // Most visual prop changes (background, border, shadow, transform) are
    // rendered at the container level and do NOT affect cached leaf scenes.
    // Only opacity and scroll_offset_y changes require descendant cascade:
    //   • opacity:         child_opacity is a product through the tree; cached
    //                      leaf draw-calls used the old multiplied opacity.
    //   • scroll_offset_y: absolute y-positions are baked into cached leaf scenes.
    //
    // This avoids invalidating 100 cached leaf nodes when only a hover color
    // changes on a container, saving the majority of O4b cache hits in practice.
    if !state.descendant_cascade_nodes.is_empty() {
        let mut stack: SmallVec<[u32; 32]> =
            state.descendant_cascade_nodes.iter().copied().collect();
        while let Some(cur) = stack.pop() {
            if let Some(node) = state.js_nodes.get(&cur) {
                for &cid in &node.children {
                    if state.dirty_subtrees.insert(cid) {
                        stack.push(cid);
                    }
                }
            }
        }
    }
    state.descendant_cascade_nodes.clear();
}

#[cfg(feature = "audio")]
/// Spawn a self-contained audio thread for a video file.
///
/// Uses the glyx-media C library (ffmpeg) to decode the audio track, feeding
/// interleaved i16 PCM into a rodio Sink via `FfmpegAudioSource`.  This
/// handles any container/codec that ffmpeg supports (MKV+AAC, MP4+AAC,
/// MKV+AC3, etc.) without rodio/symphonia trying to probe the container.
///
/// Non-blocking: returns immediately.
/// `stop_flag`       — global stop (close video); `audio_stop_flag` — audio-only stop (seek).
/// `start_secs`      — seek offset: source is wrapped with `skip_duration` when > 0.
fn spawn_video_audio(
    url:             &str,
    stop_flag:       Arc<std::sync::atomic::AtomicBool>,
    audio_stop_flag: Arc<std::sync::atomic::AtomicBool>,
    pause_flag:      Arc<std::sync::atomic::AtomicBool>,
    volume:          Arc<Mutex<f32>>,
    start_secs:      f64,
) {
    use rodio::Source;
    // Only local files — skip network streams.
    if url.starts_with("http://") || url.starts_with("https://") || url.starts_with("rtsp://") {
        return;
    }
    let path = url
        .trim_start_matches("file:///")
        .trim_start_matches("file://")
        .to_string();

    std::thread::spawn(move || {
        let Some(media) = glyx_media::get_media() else {
            log::debug!("[video-audio] glyx-media not available");
            return;
        };

        let audio_dec = match media.audio_decoder_open(&path) {
            Ok(d)  => d,
            Err(e) => { log::debug!("[video-audio] no audio track: {e}"); return; }
        };

        let sample_rate = audio_dec.sample_rate;
        let channels    = audio_dec.channels;

        let (_stream, handle) = match rodio::OutputStream::try_default() {
            Ok(pair) => pair,
            Err(e)   => { log::warn!("[video-audio] no audio output device: {e}"); return; }
        };
        let sink = match rodio::Sink::try_new(&handle) {
            Ok(s)  => s,
            Err(e) => { log::warn!("[video-audio] cannot create sink: {e}"); return; }
        };

        let source = FfmpegAudioSource {
            media:       media.clone(),
            dec:         Some(audio_dec),
            sample_rate,
            channels,
            buf:         vec![0i16; 4096],
            buf_pos:     0,
            buf_valid:   0,
            done:        false,
        };

        if start_secs > 0.001 {
            // Prefer a real FFmpeg seek (instant) over rodio's skip_duration()
            // which decodes and discards every sample up to start_secs.
            let sought = source.dec.as_ref()
                .map(|dec| media.audio_decoder_seek(dec, start_secs))
                .unwrap_or(false);
            if sought {
                sink.append(source);
            } else {
                // Older DLL without vm_audio_decoder_seek — fall back to software skip.
                sink.append(source.skip_duration(std::time::Duration::from_secs_f64(start_secs)));
            }
        } else {
            sink.append(source);
        }
        sink.play();
        log::debug!("[video-audio] audio playing via ffmpeg ({sample_rate}Hz/{channels}ch), start={start_secs:.2}s");

        // Keep alive; apply pause + volume changes each poll tick.
        // Exit when global stop, audio-only stop (seek restart), or source exhausted.
        let mut audio_paused = false;
        while !stop_flag.load(std::sync::atomic::Ordering::Relaxed)
            && !audio_stop_flag.load(std::sync::atomic::Ordering::Relaxed)
            && !sink.empty()
        {
            let should_pause = pause_flag.load(std::sync::atomic::Ordering::Relaxed);
            if should_pause && !audio_paused { sink.pause(); audio_paused = true; }
            if !should_pause && audio_paused  { sink.play();  audio_paused = false; }
            let vol = *volume.lock();
            if (sink.volume() - vol).abs() > 0.01 { sink.set_volume(vol); }
            std::thread::sleep(std::time::Duration::from_millis(50));
        }
        sink.stop();
        log::debug!("[video-audio] audio thread exiting for '{path}'");
    });
}

/// A `rodio::Source` backed by the glyx-media C audio decoder (ffmpeg).
/// Calls `vm_audio_decoder_next_samples` in 4096-sample chunks, so ffmpeg
/// runs in rodio's audio thread — never blocks the main render loop.
#[cfg(feature = "audio")]
struct FfmpegAudioSource {
    media:      std::sync::Arc<glyx_media::GlyxMedia>,
    dec:        Option<glyx_media::VmAudioDecoder>,  // Some until dropped
    sample_rate: u32,
    channels:   u16,
    buf:        Vec<i16>,
    buf_pos:    usize,
    buf_valid:  usize,
    done:       bool,
}

// SAFETY: FfmpegAudioSource owns a VmAudioDecoder (opaque C pointer, no TLS).
// It is only ever accessed from rodio's single audio thread.
#[cfg(feature = "audio")]
unsafe impl Send for FfmpegAudioSource {}

#[cfg(feature = "audio")]
impl Drop for FfmpegAudioSource {
    fn drop(&mut self) {
        if let Some(dec) = self.dec.take() {
            self.media.audio_decoder_close(dec);
        }
    }
}

#[cfg(feature = "audio")]
impl FfmpegAudioSource {
    fn fill_buf(&mut self) {
        if self.done { return; }
        if let Some(ref dec) = self.dec {
            let n = self.media.audio_decoder_next_samples(dec, &mut self.buf);
            if n <= 0 {
                self.done      = true;
                self.buf_valid = 0;
            } else {
                self.buf_valid = n as usize;
            }
            self.buf_pos = 0;
        }
    }
}

#[cfg(feature = "audio")]
impl Iterator for FfmpegAudioSource {
    type Item = i16;
    fn next(&mut self) -> Option<i16> {
        if self.buf_pos >= self.buf_valid {
            self.fill_buf();
        }
        if self.done || self.buf_pos >= self.buf_valid {
            return None;
        }
        let s = self.buf[self.buf_pos];
        self.buf_pos += 1;
        Some(s)
    }
}

#[cfg(feature = "audio")]
impl rodio::Source for FfmpegAudioSource {
    fn current_frame_len(&self) -> Option<usize> { None }
    fn channels(&self)         -> u16  { self.channels }
    fn sample_rate(&self)      -> u32  { self.sample_rate }
    fn total_duration(&self)   -> Option<std::time::Duration> { None }
}

#[cfg(not(feature = "audio"))]
fn spawn_video_audio(
    _url:             &str,
    _stop_flag:       Arc<std::sync::atomic::AtomicBool>,
    _audio_stop_flag: Arc<std::sync::atomic::AtomicBool>,
    _pause_flag:      Arc<std::sync::atomic::AtomicBool>,
    _volume:          Arc<Mutex<f32>>,
    _start_secs:      f64,
) {
    // audio feature not enabled — video plays without sound
}
