//! `__glyx_canvas_*`/`webview_*` bindings, ported from `bind_canvas.rs`.
//! Includes the binary fast-path (`__glyx_canvas_flush`): a shared
//! `ArrayBuffer` with `Float32Array`/`Uint32Array`/`Uint8Array` views
//! exposed as globals, so JS writes draw commands directly into raw memory
//! instead of `JSON.stringify`-ing a command array every frame. Unlike V8
//! (which stashes a raw pointer into the external backing store once at
//! init time), this reads bytes straight out of whichever typed-array
//! values JS passes as arguments each `canvas_flush` call — no pointer
//! needs to survive across calls, since `decode_canvas_binary` fully
//! copies into owned `CanvasCmd`s before returning either way.

use rquickjs::{ArrayBuffer, Ctx, Function, TypedArray, Value};

use crate::bindings::{decode_canvas_binary, CanvasCmd, RaycastRequest, RaycastRequestQueue, RaycastResults, SceneCommand, SceneQueue};

static NEXT_RAYCAST_ID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(1);

pub(crate) fn canvas_update(id: u32, json: String, scene: &SceneQueue) {
    let cmds: Vec<CanvasCmd> = match serde_json::from_str(&json) {
        Ok(c) => c,
        Err(e) => { log::warn!("canvas_update parse error: {e}"); return; }
    };
    scene.lock().push_back(SceneCommand::CanvasUpdate { id, cmds, append: false });
}

#[cfg(feature = "canvas3d")]
pub(crate) fn canvas3d_update(id: u32, json: String, scene: &SceneQueue) {
    let s: glyx_3d::Scene3D = match serde_json::from_str(&json) {
        Ok(s) => s,
        Err(e) => { log::warn!("canvas3d_update parse error: {e}"); return; }
    };
    scene.lock().push_back(SceneCommand::Canvas3DUpdate { id, scene: s });
}

#[cfg(feature = "canvas3d")]
pub(crate) fn canvas3d_load_gltf(id: u32, path: String, scene: &SceneQueue) -> Result<(), String> {
    let path = glyx_security::resolve_and_check_read(std::path::Path::new(&path))
        .map(|c| c.to_string_lossy().into_owned())
        .map_err(|e| format!("canvas3d.loadGltf denied: {e}"))?;
    let s = glyx_3d::Scene3D {
        background: None,
        camera: glyx_3d::Camera3D { position: [0., 1., 3.], target: [0.; 3], up: [0., 1., 0.], fov_deg: 60., near: 0.1, far: 1000. },
        lights: vec![],
        meshes: vec![glyx_3d::Mesh3DInstance {
            geometry: glyx_3d::Geometry3D::Gltf { path, animation: None },
            transform: [1.,0.,0.,0., 0.,1.,0.,0., 0.,0.,1.,0., 0.,0.,0.,1.],
            color: [1.; 4],
        }],
    };
    scene.lock().push_back(SceneCommand::Canvas3DUpdate { id, scene: s });
    Ok(())
}

#[cfg(feature = "canvas3d")]
pub(crate) fn canvas3d_unload_gltf(path: String, scene: &SceneQueue) {
    scene.lock().push_back(SceneCommand::Canvas3DUnloadGltf { path });
}

/// `__glyx_canvas3d_raycast(id, ndcX, ndcY) -> reqId` — sync, returns
/// immediately with a request id (NOT a promise — see module doc on
/// `bindings::RaycastRequest`: raycasting needs the live `Renderer3D`,
/// which only glyx-core has; answered on the next frame, polled via
/// `canvas3d_raycast_poll` like video/webview events).
#[cfg(feature = "canvas3d")]
pub(crate) fn canvas3d_raycast(id: u32, ndc_x: f32, ndc_y: f32, requests: &RaycastRequestQueue) -> u32 {
    let req_id = NEXT_RAYCAST_ID.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    requests.lock().push_back(RaycastRequest { req_id, canvas_id: id, ndc_x, ndc_y });
    req_id
}

/// `__glyx_canvas3d_raycast_poll() -> string` — JSON array of pending
/// raycast results, drained each frame from JS.
#[cfg(feature = "canvas3d")]
pub(crate) fn canvas3d_raycast_poll(results: &RaycastResults) -> String {
    let mut results = results.lock();
    if results.is_empty() { "[]".to_string() } else { format!("[{}]", results.drain(..).collect::<Vec<_>>().join(",")) }
}

#[cfg(feature = "webview")]
pub(crate) fn webview_post_message(id: u32, msg: String, scene: &SceneQueue) {
    scene.lock().push_back(SceneCommand::WebviewPostMessage { id, msg });
}

#[cfg(feature = "webview")]
pub(crate) fn webview_poll(events: &crate::bindings::WebviewEvents) -> String {
    let mut events = events.lock();
    if events.is_empty() { "[]".to_string() } else { format!("[{}]", events.drain(..).collect::<Vec<_>>().join(",")) }
}

/// Set up the Canvas2D binary command buffer and expose typed-array globals,
/// mirroring `V8Runtime::init_canvas_buffers`'s layout exactly:
///   * `__glyx_canvas_cmdbuf_f32` — Float32Array (geometry args)
///   * `__glyx_canvas_cmdbuf_u32` — Uint32Array  (packed RGBA, aliases f32)
///   * `__glyx_canvas_strbuf`     — Uint8Array   (UTF-8 text for fillText)
/// plus `__glyx_canvas_protocol` = `"binary"` | `"json"`. JS feature-detects
/// these globals and falls back to the JSON `__glyx_canvas_update` path
/// when `protocol != "binary"` or buffer setup fails.
///
/// Built via a small eval'd JS constructor function (`new Float32Array(buf,
/// byteOffset, length)`) rather than hand-rolled `qjs::JS_NewTypedArray` FFI
/// — rquickjs's public `TypedArray` API doesn't expose byte-offset subviews
/// directly, and going through real JS constructors is both simpler and
/// exactly as correct as the C API would be.
pub(crate) fn init_canvas_buffers(ctx: &Ctx<'_>, protocol: &str, buffer_kb: usize) {
    let globals = ctx.globals();
    if protocol != "binary" {
        let _ = globals.set("__glyx_canvas_protocol", "json");
        log::info!("canvas: JSON protocol (configured)");
        return;
    }

    let cmd_bytes = (buffer_kb.max(16) * 1024) & !3;
    let str_bytes = (cmd_bytes / 4).max(16 * 1024);
    let total     = cmd_bytes + str_bytes;

    let make_views: Result<(), rquickjs::Error> = (|| {
        let ab = ArrayBuffer::new(ctx.clone(), vec![0u8; total])?;
        let make_views_fn: Function = ctx.eval(
            r#"(function(buf, cmdBytes, strBytes) {
                globalThis.__glyx_canvas_cmdbuf_f32 = new Float32Array(buf, 0, cmdBytes / 4);
                globalThis.__glyx_canvas_cmdbuf_u32 = new Uint32Array(buf, 0, cmdBytes / 4);
                globalThis.__glyx_canvas_strbuf     = new Uint8Array(buf, cmdBytes, strBytes);
            })"#,
        )?;
        make_views_fn.call::<_, ()>((ab, cmd_bytes as u32, str_bytes as u32))?;
        Ok(())
    })();

    match make_views {
        Ok(()) => {
            let _ = globals.set("__glyx_canvas_protocol", "binary");
            log::info!("canvas: binary protocol ready ({} KiB cmd + {} KiB str)", cmd_bytes / 1024, str_bytes / 1024);
        }
        Err(e) => {
            let _ = globals.set("__glyx_canvas_protocol", "json");
            log::warn!("canvas: typed-array setup failed ({e}) → JSON fallback");
        }
    }
}

/// `__glyx_canvas_flush(id, f32buf, floatCount, u8buf, strLen, append)` — sync.
/// Binary fast path: decodes straight out of the typed-array bytes passed
/// as arguments — no JSON.stringify, no string copy, no serde parse.
pub(crate) fn canvas_flush(
    id: u32, f32buf: Value<'_>, float_count: usize, u8buf: Value<'_>, str_len: usize, append: bool,
    scene: &SceneQueue,
) {
    let Some(f32_array) = TypedArray::<f32>::from_value(f32buf).ok() else {
        log::warn!("canvas_flush: command buffer unavailable");
        return;
    };
    let Some(cmd_bytes) = f32_array.as_bytes() else {
        log::warn!("canvas_flush: command buffer unavailable");
        return;
    };
    let u8_array = TypedArray::<u8>::from_value(u8buf).ok();
    let str_bytes: &[u8] = u8_array.as_ref()
        .and_then(|a| a.as_bytes())
        .map(|b| &b[..str_len.min(b.len())])
        .unwrap_or(&[]);

    let cmds = decode_canvas_binary(cmd_bytes, float_count, str_bytes);
    scene.lock().push_back(SceneCommand::CanvasUpdate { id, cmds, append });
}
