use super::*;
use smallvec::SmallVec;
use crate::layout::layout_props_changed;
use crate::render_props::{parse_box_shadow, parse_gradient, parse_transform};

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

/// Advance every active property transition and keyframe animation one
/// frame, marking those nodes dirty so they actually re-render (values are
/// changing with no new `SceneCommand` behind them). Finished animations are
/// dropped (their node re-renders at its own style) unless they `fill:
/// 'forwards'`, which stay but stop driving frames. Returns `true` if any transition is still
/// running after this tick — the caller uses that to force a GPU render and
/// schedule the next frame, since nothing else would otherwise wake the
/// render loop mid-transition.
pub(crate) fn tick_transitions(state: &mut PerWindowState) -> bool {
    if state.transitions.is_empty() && state.animations.is_empty() { return false; }
    let now = Instant::now();
    let dirty_nodes = &mut state.dirty_nodes;
    state.transitions.retain(|&id, t| {
        let (_, finished) = t.sample(now);
        dirty_nodes.insert(id);
        !finished
    });
    let mut running = false;
    state.animations.retain(|&id, a| {
        if a.settled { return true; }
        dirty_nodes.insert(id);
        if !a.finished(now) {
            running = true;
            return true;
        }
        // This frame draws the final state; forwards-fill keeps it after.
        a.settled = true;
        a.spec.fill_forwards
    });
    running || !state.transitions.is_empty()
}

/// Start, restart or stop node `id`'s keyframe animation to match `props`.
/// Re-sent identical props (every React re-render) leave a running
/// animation alone; a changed spec restarts it from the beginning.
fn sync_animation(state: &mut PerWindowState, id: u32, props: &NodeProps) {
    match motion::AnimSpec::from_props(props) {
        Some(spec) => {
            if state.animations.get(&id).map_or(true, |a| a.spec != spec) {
                state.animations.insert(id, motion::Animation { spec, start: Instant::now(), settled: false });
                (state.request_redraw)();
            }
        }
        None => {
            if state.animations.remove(&id).is_some() {
                state.dirty_nodes.insert(id);
            }
        }
    }
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
                sync_animation(state, id, &props);
                state.js_nodes.insert(id, JsNode::new(node_type, props));
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
                if let Some(child) = state.js_nodes.get_mut(&child_id) {
                    child.parent = Some(parent_id);
                }
                state.dirty_nodes.insert(parent_id);
                state.z_order_dirty.insert(parent_id);
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
                if let Some(child) = state.js_nodes.get_mut(&child_id) {
                    child.parent = Some(parent_id);
                }
                state.dirty_nodes.insert(parent_id);
                state.z_order_dirty.insert(parent_id);
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
                if state.js_nodes.contains_key(&id) {
                    sync_animation(state, id, &props);
                }
                // `@glyx-dev/motion`: a change to a transitioned property starts
                // (or retargets) a Rust-owned interpolation instead of snapping.
                // `from` is what's on screen NOW — mid-flight values included —
                // read before the old props are overwritten below.
                if let (Some(old), Some(ms)) = (state.js_nodes.get(&id), props.transition_ms) {
                    let (old_v, new_v) = (motion::Visual::of(&old.props), motion::Visual::of(&props));
                    // Unrelated updates (text, layout, …) leave a running
                    // transition alone — restarting its clock would stall it.
                    if old_v != new_v {
                        let now  = Instant::now();
                        let from = match state.transitions.get(&id) {
                            Some(t) => t.current(&old_v, now),
                            None    => old_v,
                        };
                        let mask   = motion::property_mask(props.transition_property.as_deref());
                        let easing = motion::Easing::parse(props.transition_easing.as_deref());
                        match motion::Transition::between(&from, &new_v, mask, ms, easing, now) {
                            Some(t) => { state.transitions.insert(id, t); }
                            // Only non-transitioned properties changed: they snap.
                            None    => { state.transitions.remove(&id); }
                        }
                    }
                } else {
                    // No transition declared (or first-ever props for this node) —
                    // any previously-running transition for this id is stale.
                    state.transitions.remove(&id);
                }

                // A child's z_index changed → its parent's z-sorted child list is stale.
                // (Structural changes are already flagged by AppendChild/InsertBefore.)
                if let Some(node) = state.js_nodes.get(&id) {
                    if node.props.z_index != props.z_index {
                        if let Some(pid) = node.parent {
                            state.z_order_dirty.insert(pid);
                        }
                    }
                }

                if let Some(node) = state.js_nodes.get_mut(&id) {
                    node.props = props.clone();
                    // Keep the pre-parsed render props in sync (see JsNode::new) —
                    // render never re-parses these strings.
                    node.transform  = props.transform.as_deref().and_then(parse_transform);
                    node.box_shadow = props.box_shadow.as_deref().and_then(parse_box_shadow);
                    node.gradient   = props.background_gradient.as_deref().and_then(parse_gradient);
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
                                line_height: props.line_height,
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
                // Also clean up canvas data and any running motion for this node.
                state.canvas_cmds.remove(&id);
                state.transitions.remove(&id);
                state.animations.remove(&id);
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
                // Clear parent pointers on direct children before dropping the
                // node, so ancestor walks never chase a dead id. Also grab the
                // removed node's OWN parent before it's gone — see below.
                let (orphan_children, removed_parent): (SmallVec<[u32; 4]>, Option<u32>) = state.js_nodes
                    .get(&id)
                    .map(|n| (n.children.clone(), n.parent))
                    .unwrap_or_default();
                state.js_nodes.remove(&id);
                for cid in orphan_children {
                    if let Some(child) = state.js_nodes.get_mut(&cid) {
                        if child.parent == Some(id) {
                            child.parent = None;
                        }
                    }
                }
                if state.focused_node == Some(id) {
                    // Focus survival: rather than dropping focus to nowhere,
                    // move it to whichever focusable node would come next in
                    // the (now-current, post-removal) Tab order. Falls back
                    // to `None` only when nothing focusable remains at all.
                    state.focused_node = state.js_root.and_then(|root| {
                        let mut order = focus_order(&state.js_nodes, root);
                        let positions: std::collections::HashMap<u32, (f32, f32)> = order
                            .iter()
                            .filter_map(|&nid| {
                                let node = state.js_nodes.get(&nid)?;
                                let rl = state.resolved_rect(node.layout_id?)?;
                                Some((nid, (rl.y, rl.x)))
                            })
                            .collect();
                        sort_by_position(&mut order, &positions);
                        next_focus(&order, None, false)
                    });
                    state.window.set_ime_allowed(state.focused_node.is_some());
                    if let Some(new_focus) = state.focused_node {
                        // Same event JS already handles for AT/Tab-driven
                        // focus moves — keeps onFocus/styling in sync when
                        // focus moves off a removed node, not just when a
                        // human presses Tab.
                        state.runtime.push_event(InputEvent::AccessibilityFocus { node_id: new_focus });
                        reveal_focus_if_needed(state, new_focus);
                    }
                }
                // Clean up all per-node state for the removed node.
                state.dirty_nodes.remove(&id);
                state.dirty_subtrees.remove(&id);
                state.prev_resolved.remove(&id);
                state.scene_cache.remove(&id);
                state.scene_cache_new.remove(&id);
                // Layout-cache entries (the rect `__glyx_getLayout` reads, plus
                // the high-bit content-height / unclipped-rect entries). Node
                // ids are never reused, so without this every removed node's
                // entries stayed forever — unbounded growth for anything that
                // churns nodes (VirtualizedList row recycling, route changes).
                {
                    let lc = state.runtime.layout_cache();
                    let mut lc = lc.lock();
                    lc.remove(&id);
                    lc.remove(&(id | crate::layout::CONTENT_HEIGHT_KEY));
                    lc.remove(&(id | crate::layout::UNCLIPPED_KEY));
                }
                // If a scrollbar drag was active on this node, cancel it so the
                // stale node_id is never used for scroll updates after removal.
                if state.scrollbar_drag.as_ref().is_some_and(|d| d.node_id == id) {
                    state.scrollbar_drag = None;
                }
                // Unlink from the parent's children list so stale ghost IDs don't
                // accumulate in the renderer's traversal. O(1) via the removed
                // node's own `parent` pointer (maintained by every Append/Insert/
                // SetRoot) instead of scanning every remaining node to find who
                // references `id` — that O(n × remaining_nodes) scan was the
                // dominant cost (several seconds) when a commit removes ~8,000
                // nodes at once (e.g. `bench-app`'s full-render → virtualized
                // mode switch), found by timing `recompute_layout` around it and
                // seeing the time sink sit entirely between commands, not inside
                // layout itself.
                if let Some(parent_id) = removed_parent {
                    if let Some(parent) = state.js_nodes.get_mut(&parent_id) {
                        let before = parent.children.len();
                        parent.children.retain(|c| *c != id);
                        if parent.children.len() != before {
                            state.dirty_nodes.insert(parent_id);
                            state.z_order_dirty.insert(parent_id);
                        }
                    }
                }
                layout_changed   = true;
                structure_changed = true;
            }
            SceneCommand::SetRoot { id } => {
                state.js_root = Some(id);
                if let Some(node) = state.js_nodes.get_mut(&id) {
                    node.parent = None;
                }
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
                                    // drain(): the calibration frames (~4-8 MB each) are
                                    // freed as they're written, not held all recording long.
                                    for (_, _, data) in buffered.drain(..) {
                                        if media.encoder_write_rgba(&enc, &data).is_err() { ok = false; break; }
                                    }
                                    buffered.shrink_to_fit();
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
                        for (_, _, data) in buffered.drain(..) {
                            if stdin.write_all(&data).is_err() { break; }
                        }
                        drop(buffered);
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
/// Each dirty node contributes its VISUAL bounds (see `visual_bounds`: layout
/// rect + shadow, mapped through its own and its ancestors' transforms, with
/// mid-transition values from `overrides`) for this frame AND where it was
/// drawn last frame (`prev_visual`, falling back to its previous layout
/// rect), so a moving/rotating node erases its old pixels.
///
/// Full-frame bailout conditions (correctness over cleverness):
/// - a dirty node is missing from the tree or has no resolved layout
///   (just removed / not yet laid out),
/// - `dirty_nodes` is empty (callers treat that as "render everything").
///
/// Scroll handling: a node inside a scrolled ancestor renders at
/// `resolved.y - Σ ancestor offsets`, which this function does not replay.
/// Instead, the OUTERMOST ancestor with a non-zero `scroll_offset_y` is used
/// as the damage contribution — its own rect is absolute-correct and clips
/// its content, so it bounds the node's old and new visual positions.
pub(crate) fn compute_frame_damage(
    state:     &PerWindowState,
    overrides: &std::collections::HashMap<u32, crate::motion::Overrides>,
) -> Option<(f64, f64, f64, f64)> {
    if state.dirty_nodes.is_empty() {
        return None;
    }

    // layout NodeId → resolved rect
    let resolved: std::collections::HashMap<NodeId, &ResolvedLayout> =
        state.resolved.iter().map(|(nid, rl)| (*nid, rl)).collect();

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

    let rect_of = |id: u32| -> Option<(f64, f64, f64, f64)> {
        let rl = resolved.get(&state.js_nodes.get(&id)?.layout_id?)?;
        Some((rl.x as f64, rl.y as f64, rl.width as f64, rl.height as f64))
    };

    for &id in &state.dirty_nodes {
        if !state.js_nodes.contains_key(&id) { return None; }

        // Outermost scrolled ancestor bounds this node's visual position.
        // Walks the persistent `parent` pointers maintained by
        // `apply_scene_commands` — no per-frame child→parent map needed.
        let target = outermost_scrolled_ancestor(&state.js_nodes, id).unwrap_or(id);
        let (l, t, r, b) = visual_bounds(&state.js_nodes, &rect_of, overrides, target)?;
        add(&mut ltrb, l, t, r - l, b - t);

        // Include where it was drawn LAST frame so moved/shrunk/rotated nodes
        // erase their old pixels.
        if let Some(&(pl, pt, pr, pb)) = state.prev_visual.get(&target) {
            add(&mut ltrb, pl, pt, pr - pl, pb - pt);
        }
        if let Some(prl) = state.prev_resolved.get(&target) {
            add(&mut ltrb, prl.x as f64, prl.y as f64,
                prl.width as f64, prl.height as f64);
        }
    }

    ltrb.map(|(l, t, r, b)| (l, t, r - l, b - t))
}

/// Screen-space bounds `(l, t, r, b)` of what node `id` draws: its layout
/// rect grown by its box shadow, then mapped through its own transform and
/// every ancestor's (each centred on that node's own rect, as the renderer
/// does). Transform/shadow values come from `overrides` while a transition
/// runs. Descendants are assumed to lie inside the node's rect (normal flow),
/// matching the rest of the damage analysis. `None` if a rect is unknown.
pub(crate) fn visual_bounds(
    nodes:     &std::collections::HashMap<u32, JsNode>,
    rect_of:   &dyn Fn(u32) -> Option<(f64, f64, f64, f64)>,
    overrides: &std::collections::HashMap<u32, crate::motion::Overrides>,
    id:        u32,
) -> Option<(f64, f64, f64, f64)> {
    use peniko::kurbo::{Affine, Point};
    let node = nodes.get(&id)?;
    let (x, y, w, h) = rect_of(id)?;
    let (mut l, mut t, mut r, mut b) = (x, y, x + w, y + h);

    let ov = overrides.get(&id);
    if let Some((dx, dy, _)) = ov.and_then(|o| o.shadow).or(node.box_shadow) {
        l = l.min(x + dx); t = t.min(y + dy);
        r = r.max(x + w + dx); b = b.max(y + h + dy);
    }

    let mut cur = Some(id);
    for _ in 0..=nodes.len() {
        let Some(cid) = cur else { break };
        let Some(n) = nodes.get(&cid) else { break };
        let affine = overrides.get(&cid).and_then(|o| o.transform).or(n.transform);
        if let Some(a) = affine {
            let (nx, ny, nw, nh) = rect_of(cid)?;
            let c = (nx + nw / 2.0, ny + nh / 2.0);
            let m = Affine::translate(c) * a * Affine::translate((-c.0, -c.1));
            let pts = [Point::new(l, t), Point::new(r, t), Point::new(l, b), Point::new(r, b)].map(|p| m * p);
            l = pts.iter().map(|p| p.x).fold(f64::INFINITY, f64::min);
            t = pts.iter().map(|p| p.y).fold(f64::INFINITY, f64::min);
            r = pts.iter().map(|p| p.x).fold(f64::NEG_INFINITY, f64::max);
            b = pts.iter().map(|p| p.y).fold(f64::NEG_INFINITY, f64::max);
        }
        cur = n.parent;
    }
    Some((l, t, r, b))
}

/// Remember where each node drawn this frame actually landed on screen
/// (`visual_bounds`), so next frame's damage can erase it. Call after the
/// frame is rendered, before `dirty_nodes` is cleared.
pub(crate) fn record_visual_bounds(
    state:     &mut PerWindowState,
    overrides: &std::collections::HashMap<u32, crate::motion::Overrides>,
) {
    let resolved = &state.resolved_by_id;
    let nodes = &state.js_nodes;
    let rect_of = |id: u32| -> Option<(f64, f64, f64, f64)> {
        let rl = resolved.get(&nodes.get(&id)?.layout_id?)?;
        Some((rl.x as f64, rl.y as f64, rl.width as f64, rl.height as f64))
    };
    for &id in &state.dirty_nodes {
        match visual_bounds(nodes, &rect_of, overrides, id) {
            Some(v) => { state.prev_visual.insert(id, v); }
            None    => { state.prev_visual.remove(&id); }
        }
    }
    state.prev_visual.retain(|id, _| nodes.contains_key(id));
}

/// Find the topmost solid (click-opaque) node covering window-relative
/// point `(x, y)`, or `None`.
///
/// Ports `events.js`'s `findTopmostSolid` to native code, computed once per
/// real input event (see the `MouseButton`/`CursorMoved` construction sites
/// in `lib.rs`) instead of JS calling `__glyx_getLayout` once per candidate
/// node on every click and every cursor move. JS owned none of the state
/// this needs to move faster — `js_nodes`, `parent`, and the layout cache
/// are all native already — so this replaces N JS→native crossings per
/// input event with zero: the result rides along as a field on the event
/// JS was already going to receive.
///
/// Algorithm (must stay in lockstep with `findTopmostSolid` — same
/// candidate set, same ancestor filter, same tie-break):
/// 1. Every `View` node (not `pointerEvents:'none'`) whose cached layout
///    rect covers `(x, y)`.
/// 2. Keep only "deepest" nodes — drop any candidate that is an ancestor of
///    another candidate (an ancestor is painted beneath its descendants).
/// 3. Among the remaining siblings/cousins: highest ancestor-inherited
///    z-index wins; ties broken by highest node id. Ids are allocated by a
///    monotonically-increasing, never-reused counter (verified: `next_id`
///    is a plain `fetch_add`, nothing returns freed ids to a pool), so
///    comparing ids directly reproduces `solidRegistry`'s insertion-order
///    rank without needing a separate counter natively.
pub(crate) fn hit_test_solid(state: &PerWindowState, x: f32, y: f32) -> Option<u32> {
    let cache_arc = state.runtime.layout_cache();
    let cache = cache_arc.lock();
    hit_test_solid_impl(&state.js_nodes, &cache, x, y)
}

/// The actual algorithm, taking its two dependencies directly instead of a
/// whole `PerWindowState` — lets this be unit-tested without needing a full
/// `JsRuntime` mock just to reach `layout_cache()`. See `hit_test_solid`'s
/// doc comment for the algorithm and why this exists.
fn hit_test_solid_impl(
    js_nodes: &std::collections::HashMap<u32, JsNode>,
    cache: &std::collections::HashMap<u32, [f32; 4]>,
    x: f32, y: f32,
) -> Option<u32> {
    let mut covering: SmallVec<[u32; 8]> = SmallVec::new();
    for (&id, node) in js_nodes {
        if !matches!(node.node_type, NodeType::View) { continue; }
        if node.props.pointer_events.as_deref() == Some("none") { continue; }
        if node.props.hidden.unwrap_or(false) { continue; }
        let Some(&[rx, ry, rw, rh]) = cache.get(&id) else { continue };
        if x >= rx && x < rx + rw && y >= ry && y < ry + rh {
            covering.push(id);
        }
    }

    if covering.len() <= 1 {
        return covering.first().copied();
    }

    // Is `ancestor_id` an ancestor of `descendant_id`? Walks up the persistent
    // `parent` chain, same direction as `events.js`'s `isAncestorOf`.
    let is_ancestor_of = |ancestor_id: u32, descendant_id: u32| -> bool {
        let mut cur = js_nodes.get(&descendant_id).and_then(|n| n.parent);
        while let Some(id) = cur {
            if id == ancestor_id { return true; }
            cur = js_nodes.get(&id).and_then(|n| n.parent);
        }
        false
    };

    let deepest: SmallVec<[u32; 8]> = covering.iter().copied()
        .filter(|&id| !covering.iter().any(|&other| other != id && is_ancestor_of(id, other)))
        .collect();

    if deepest.len() <= 1 {
        return deepest.first().copied();
    }

    // Effective z-index: a node's own z-index, or its highest ancestor's if
    // that's greater — matches `events.js`'s `effectiveZ`.
    let effective_z = |id: u32| -> i32 {
        let mut z = js_nodes.get(&id).and_then(|n| n.props.z_index).unwrap_or(0);
        let mut cur = js_nodes.get(&id).and_then(|n| n.parent);
        while let Some(p) = cur {
            if let Some(pz) = js_nodes.get(&p).and_then(|n| n.props.z_index) {
                if pz > z { z = pz; }
            }
            cur = js_nodes.get(&p).and_then(|n| n.parent);
        }
        z
    };

    let mut best = deepest[0];
    let mut best_z = effective_z(best);
    for &id in &deepest[1..] {
        let z = effective_z(id);
        if z > best_z || (z == best_z && id > best) {
            best = id;
            best_z = z;
        }
    }
    Some(best)
}

/// Shrink collections whose backing capacity is still sized for a past
/// transient spike (e.g. a big list rendered once) long after the spike is
/// gone. `Vec`/`HashMap` never shrink their own allocation when elements are
/// removed, and allocator-level reclaim (`mi_collect`) can't help either —
/// that memory was never freed, just underused, which is invisible to the
/// allocator. See the project performance changelog's memory-retention entry
/// for the measurement that motivated this (a benchmark spiking `js_nodes`
/// from 53 to 8,017 entries and never coming back down).
///
/// Called from the existing idle-trim gate (`lib.rs`, same cadence as
/// `Renderer::trim_resources`), not its own timer — shrinking only makes
/// sense once the app has been quiet for a while, never on every size
/// fluctuation (a list that legitimately oscillates 8000 → 50 → 7000 → 20
/// would turn every drop into a wasted reallocation if this ran eagerly).
///
/// Deliberately narrow in scope for now: only `js_nodes` and
/// `resolved`/`resolved_by_id`, the two proven to spike in the benchmark
/// that motivated this. `layout_cache` (native per-engine state, behind the
/// `JsRuntime` trait boundary) is a likely candidate too but is left for a
/// deliberate follow-up rather than being swept in here.
// Conservative on purpose: small collections and modest oversizing aren't
// worth a reallocation, and this must never fire often enough to turn normal
// fluctuation into thrash.
fn oversized(len: usize, cap: usize) -> bool {
    cap > (len.saturating_mul(4)).max(256)
}

// Target the next power of two above `len` (with a small floor) rather than
// an exact fit — leaves headroom so modest regrowth right after doesn't
// immediately pay for another reallocation.
fn target_capacity(len: usize) -> usize {
    len.next_power_of_two().max(64)
}

pub(crate) fn shrink_oversized_collections(state: &mut PerWindowState) {
    let len = state.js_nodes.len();
    let cap = state.js_nodes.capacity();
    if oversized(len, cap) {
        let target = target_capacity(len);
        log::debug!("[mem] shrinking js_nodes: len={len} capacity={cap} -> target={target}");
        state.js_nodes.shrink_to(target);
    }

    let len = state.resolved.len();
    let cap = state.resolved.capacity();
    if oversized(len, cap) {
        let target = target_capacity(len);
        log::debug!("[mem] shrinking resolved: len={len} capacity={cap} -> target={target}");
        state.resolved.shrink_to(target);
    }

    let len = state.resolved_by_id.len();
    let cap = state.resolved_by_id.capacity();
    if oversized(len, cap) {
        let target = target_capacity(len);
        log::debug!("[mem] shrinking resolved_by_id: len={len} capacity={cap} -> target={target}");
        state.resolved_by_id.shrink_to(target);
    }
}

/// Walk `id`'s persistent `parent` chain and return the **outermost**
/// ancestor with a non-zero `scroll_offset_y` (if any). The chain is kept up
/// to date by `apply_scene_commands`, so this is O(tree depth) with no
/// per-frame child→parent map. Terminates on a stale link (parent id no
/// longer present) because `js_nodes.get` then yields `None`.
///
/// Depth-bounded by `js_nodes.len()`: a well-formed tree can never have a
/// parent chain longer than the total node count, so hitting the bound means
/// a cycle has formed in `parent` pointers (a scene-command bug, e.g. a
/// reparent creating a loop) — bail out instead of spinning forever. This
/// guard exists because `build_dirty_subtrees`'s equivalent ancestor walk
/// (same file) already needs one via its visited-set insert/break; this walk
/// had none and hung the frame loop under `VirtualizedList`'s row recycling.
fn outermost_scrolled_ancestor(
    js_nodes: &std::collections::HashMap<u32, JsNode>,
    id: u32,
) -> Option<u32> {
    let mut cur = id;
    let mut outer = None;
    for _ in 0..js_nodes.len() {
        let Some(pid) = js_nodes.get(&cur).and_then(|n| n.parent) else { break };
        if let Some(pn) = js_nodes.get(&pid) {
            if pn.props.scroll_offset_y.unwrap_or(0.0) != 0.0 {
                outer = Some(pid);
            }
        }
        cur = pid;
    }
    outer
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
/// Rebuild z-sorted child lists for every node whose child membership or a
/// child's `z_index` changed (flagged by `apply_scene_commands`). Called once
/// per frame after the scene-command batch; drains the dirty set so a clean
/// frame costs nothing. The built table is read-only during render.
pub(crate) fn reconcile_z_order(state: &mut PerWindowState) {
    if state.z_order_dirty.is_empty() {
        return;
    }
    let dirty: SmallVec<[u32; 16]> = state.z_order_dirty.drain().collect();
    for pid in dirty {
        let Some(node) = state.js_nodes.get(&pid) else {
            state.z_order.remove(&pid);
            continue;
        };
        let mut sorted: SmallVec<[u32; 4]> = node.children.iter().copied().collect();
        // Stable sort — document order preserved for ties (same semantics as the
        // old per-frame `sort_by_key` on the child ids).
        sorted.sort_by_key(|&cid| {
            state.js_nodes.get(&cid).and_then(|n| n.props.z_index).unwrap_or(0)
        });
        state.z_order.insert(pid, sorted);
    }
}

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

    // Walk ancestors so render_subtree traversal can reach each dirty node.
    // Required for ALL dirty nodes (containers need ancestors to recurse into them).
    // Uses the persistent `parent` pointers (no per-frame map build).
    let dirty_snap: SmallVec<[u32; 16]> = state.dirty_nodes.iter().copied().collect();
    for &start in &dirty_snap {
        let mut cur = start;
        while let Some(pid) = state.js_nodes.get(&cur).and_then(|n| n.parent) {
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

#[cfg(test)]
mod tests {
    use super::*;

    fn node(parent: Option<u32>, scroll_y: Option<f32>) -> JsNode {
        let mut n = JsNode::new(NodeType::View, NodeProps { scroll_offset_y: scroll_y, ..NodeProps::default() });
        n.parent = parent;
        n
    }

    fn rects(list: &[(u32, (f64, f64, f64, f64))]) -> impl Fn(u32) -> Option<(f64, f64, f64, f64)> + '_ {
        move |id| list.iter().find(|(i, _)| *i == id).map(|(_, r)| *r)
    }

    #[test]
    fn visual_bounds_is_the_layout_rect_without_transform_or_shadow() {
        let mut nodes = std::collections::HashMap::new();
        nodes.insert(1, node(None, None));
        let r = [(1, (10.0, 20.0, 30.0, 40.0))];
        let ov = std::collections::HashMap::new();
        assert_eq!(visual_bounds(&nodes, &rects(&r), &ov, 1), Some((10.0, 20.0, 40.0, 60.0)));
    }

    #[test]
    fn visual_bounds_follows_translate_rotate_and_shadow() {
        let mut nodes = std::collections::HashMap::new();
        let mut n = JsNode::new(NodeType::View, NodeProps {
            transform: Some("translate(100, 0)".into()),
            box_shadow: Some("5 5 0 #000000".into()),
            ..NodeProps::default()
        });
        n.parent = None;
        nodes.insert(1, n);
        let r = [(1, (0.0, 0.0, 10.0, 10.0))];
        let ov = std::collections::HashMap::new();
        // Rect + shadow = (0,0)-(15,15), moved right by 100.
        assert_eq!(visual_bounds(&nodes, &rects(&r), &ov, 1), Some((100.0, 0.0, 115.0, 15.0)));

        // A 90° rotation about the centre of a 20x10 box swaps its extents.
        let mut nodes = std::collections::HashMap::new();
        nodes.insert(2, JsNode::new(NodeType::View, NodeProps { transform: Some("rotate(90)".into()), ..NodeProps::default() }));
        let r = [(2, (0.0, 0.0, 20.0, 10.0))];
        let (l, t, rr, b) = visual_bounds(&nodes, &rects(&r), &ov, 2).unwrap();
        assert!((l - 5.0).abs() < 1e-9 && (t + 5.0).abs() < 1e-9 && (rr - 15.0).abs() < 1e-9 && (b - 15.0).abs() < 1e-9);
    }

    #[test]
    fn visual_bounds_applies_ancestor_transforms_and_live_overrides() {
        let mut nodes = std::collections::HashMap::new();
        nodes.insert(1, JsNode::new(NodeType::View, NodeProps { transform: Some("translate(50, 0)".into()), ..NodeProps::default() }));
        nodes.insert(2, node(Some(1), None));
        let r = [(1, (0.0, 0.0, 100.0, 100.0)), (2, (10.0, 10.0, 10.0, 10.0))];
        let mut ov = std::collections::HashMap::new();
        // A child inside a translated parent lands where the parent moved it.
        assert_eq!(visual_bounds(&nodes, &rects(&r), &ov, 2), Some((60.0, 10.0, 70.0, 20.0)));
        // Mid-transition, the override (not the prop) decides.
        ov.insert(1, crate::motion::Overrides {
            transform: Some(peniko::kurbo::Affine::translate((20.0, 0.0))),
            ..Default::default()
        });
        assert_eq!(visual_bounds(&nodes, &rects(&r), &ov, 2), Some((30.0, 10.0, 40.0, 20.0)));
    }

    #[test]
    fn outermost_scrolled_ancestor_prefers_the_highest_scrolled_link() {
        let mut nodes = std::collections::HashMap::new();
        nodes.insert(1, node(None, None));        // root (not scrolled)
        nodes.insert(2, node(Some(1), Some(20.0))); // outer scrolled
        nodes.insert(3, node(Some(2), Some(5.0)));  // inner scrolled
        nodes.insert(4, node(Some(3), None));

        // Walking up from 4 hits 3 then 2; outermost wins.
        assert_eq!(outermost_scrolled_ancestor(&nodes, 4), Some(2));
        // A node with no scrolled ancestor returns None.
        assert_eq!(outermost_scrolled_ancestor(&nodes, 1), None);
    }

    #[test]
    fn outermost_scrolled_ancestor_terminates_on_a_stale_parent_link() {
        let mut nodes = std::collections::HashMap::new();
        nodes.insert(10, node(Some(99), None)); // 99 has been removed
        assert_eq!(outermost_scrolled_ancestor(&nodes, 10), None);
    }

    #[test]
    fn outermost_scrolled_ancestor_terminates_on_a_parent_cycle() {
        // A malformed `parent` chain (a scene-command bug elsewhere producing
        // a loop, e.g. under `VirtualizedList`'s row-recycling) must not hang
        // the frame loop — this reproduces the crash found by actually
        // running bench-app's virtualized benchmark, where this walk had no
        // cycle guard (unlike its sibling in `build_dirty_subtrees`).
        let mut nodes = std::collections::HashMap::new();
        nodes.insert(1, node(Some(2), Some(1.0)));
        nodes.insert(2, node(Some(1), Some(1.0))); // 1 <-> 2 cycle

        // Must return (not hang) and give some deterministic answer — the
        // exact node found isn't the contract here, termination is.
        let _ = outermost_scrolled_ancestor(&nodes, 1);
    }

    // ── hit_test_solid ──────────────────────────────────────────────────

    fn solid(parent: Option<u32>, z_index: Option<i32>, pointer_events_none: bool) -> JsNode {
        let props = NodeProps {
            z_index,
            pointer_events: if pointer_events_none { Some("none".to_string()) } else { None },
            ..NodeProps::default()
        };
        let mut n = JsNode::new(NodeType::View, props);
        n.parent = parent;
        n
    }

    #[test]
    fn hit_test_solid_returns_none_when_nothing_covers_the_point() {
        let mut nodes = std::collections::HashMap::new();
        nodes.insert(1, solid(None, None, false));
        let mut cache = std::collections::HashMap::new();
        cache.insert(1, [0.0, 0.0, 10.0, 10.0]);
        assert_eq!(hit_test_solid_impl(&nodes, &cache, 50.0, 50.0), None);
    }

    #[test]
    fn hit_test_solid_picks_the_only_covering_node() {
        let mut nodes = std::collections::HashMap::new();
        nodes.insert(1, solid(None, None, false));
        let mut cache = std::collections::HashMap::new();
        cache.insert(1, [0.0, 0.0, 10.0, 10.0]);
        assert_eq!(hit_test_solid_impl(&nodes, &cache, 5.0, 5.0), Some(1));
    }

    #[test]
    fn hit_test_solid_skips_pointer_events_none() {
        let mut nodes = std::collections::HashMap::new();
        nodes.insert(1, solid(None, None, true)); // covers but pointer-events:none
        let mut cache = std::collections::HashMap::new();
        cache.insert(1, [0.0, 0.0, 10.0, 10.0]);
        assert_eq!(hit_test_solid_impl(&nodes, &cache, 5.0, 5.0), None);
    }

    #[test]
    fn hit_test_solid_prefers_the_deepest_of_two_overlapping_siblings_by_ancestry() {
        // 1 is the parent of 2; both cover (5,5). The ancestor filter must
        // drop 1 (it's an ancestor of a covering node), leaving 2.
        let mut nodes = std::collections::HashMap::new();
        nodes.insert(1, solid(None, None, false));
        nodes.insert(2, solid(Some(1), None, false));
        let mut cache = std::collections::HashMap::new();
        cache.insert(1, [0.0, 0.0, 10.0, 10.0]);
        cache.insert(2, [0.0, 0.0, 10.0, 10.0]);
        assert_eq!(hit_test_solid_impl(&nodes, &cache, 5.0, 5.0), Some(2));
    }

    #[test]
    fn hit_test_solid_breaks_ties_between_unrelated_siblings_by_z_index() {
        // Two unrelated (non-ancestor) nodes both cover the point; higher
        // z-index wins regardless of id order.
        let mut nodes = std::collections::HashMap::new();
        nodes.insert(1, solid(None, Some(5), false));
        nodes.insert(2, solid(None, Some(1), false));
        let mut cache = std::collections::HashMap::new();
        cache.insert(1, [0.0, 0.0, 10.0, 10.0]);
        cache.insert(2, [0.0, 0.0, 10.0, 10.0]);
        assert_eq!(hit_test_solid_impl(&nodes, &cache, 5.0, 5.0), Some(1));
    }

    #[test]
    fn hit_test_solid_breaks_equal_z_index_ties_by_highest_id() {
        // Equal z-index (both default 0): higher id (created later, "on
        // top") wins — matches solidRegistry's insertion-order rank.
        let mut nodes = std::collections::HashMap::new();
        nodes.insert(1, solid(None, None, false));
        nodes.insert(2, solid(None, None, false));
        let mut cache = std::collections::HashMap::new();
        cache.insert(1, [0.0, 0.0, 10.0, 10.0]);
        cache.insert(2, [0.0, 0.0, 10.0, 10.0]);
        assert_eq!(hit_test_solid_impl(&nodes, &cache, 5.0, 5.0), Some(2));
    }

    #[test]
    fn hit_test_solid_inherits_z_index_from_an_ancestor() {
        // Node 3's own z-index (0) loses to node 2's z-index (1) directly —
        // but node 4 is a plain child of an ancestor (1) with z-index 10,
        // which must beat node 2 via inheritance (`effectiveZ`).
        let mut nodes = std::collections::HashMap::new();
        nodes.insert(1, solid(None, Some(10), false));       // high-z overlay layer
        nodes.insert(4, solid(Some(1), None, false));         // leaf inside it, no own z
        nodes.insert(2, solid(None, Some(1), false));         // unrelated sibling, lower z
        let mut cache = std::collections::HashMap::new();
        cache.insert(1, [0.0, 0.0, 10.0, 10.0]);
        cache.insert(4, [0.0, 0.0, 10.0, 10.0]);
        cache.insert(2, [0.0, 0.0, 10.0, 10.0]);
        // 1 is an ancestor of 4, so 1 gets filtered out by the ancestor
        // filter; the contest is between 4 (inherited z=10) and 2 (z=1).
        assert_eq!(hit_test_solid_impl(&nodes, &cache, 5.0, 5.0), Some(4));
    }

    // ── shrink_oversized_collections ─────────────────────────────────────

    #[test]
    fn oversized_matches_the_reviewed_threshold_table() {
        assert!(!oversized(50, 100));
        assert!(!oversized(50, 200));
        assert!(oversized(50, 500));
        assert!(oversized(53, 8017));
        assert!(!oversized(500, 1500));
        assert!(oversized(500, 3000));
    }

    #[test]
    fn oversized_does_not_fire_on_tiny_collections_despite_a_large_ratio() {
        // len=2, cap=9 is a 4.5x ratio but the absolute floor (256) must
        // keep this from triggering — not worth a reallocation either way.
        assert!(!oversized(2, 9));
    }

    #[test]
    fn target_capacity_leaves_power_of_two_headroom_above_len() {
        assert_eq!(target_capacity(53), 64);
        assert_eq!(target_capacity(500), 512);
        // Small len still gets the floor, not an undersized target.
        assert_eq!(target_capacity(2), 64);
    }
}
