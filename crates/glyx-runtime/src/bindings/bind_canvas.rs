use super::*;
pub fn canvas_update_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id   = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let json = args.get(1).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope.as_ref()))
        .unwrap_or_default();

    let cmds: Vec<CanvasCmd> = match serde_json::from_str(&json) {
        Ok(c)  => c,
        Err(e) => { log::warn!("canvas_update parse error: {e}"); return; }
    };
    state.scene.lock().push_back(SceneCommand::CanvasUpdate { id, cmds, append: false });
}

/// `__glyx_canvas_flush(id, f32buf, floatCount, u8buf, strLen, append)` â€” sync.
///
/// Binary fast path: decodes the command stream straight out of the shared
/// backing store (no JSON.stringify, no V8â†’Rust string copy, no serde parse).
/// The typed-array views are passed by reference each call (no per-flush
/// allocation). Falls back via the JSON `__glyx_canvas_update` binding when
/// the binary protocol isn't active.
pub fn canvas_flush_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id          = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let float_count = args.get(2).number_value(scope).unwrap_or_default() as usize;
    let str_len     = args.get(4).number_value(scope).unwrap_or_default() as usize;
    let append      = args.get(5).boolean_value(scope);

    // Extract (data ptr, byte length) for a typed-array view over the shared
    // backing store. The store is an external (non-moving) backing store kept
    // alive by the globals, so the pointer is stable for this synchronous read.
    fn view_ptr_len(scope: &mut v8::PinScope<'_, '_, v8::Context>, v: v8::Local<v8::Value>) -> Option<(*const u8, usize)> {
        let view = v8::Local::<v8::ArrayBufferView>::try_from(v).ok()?;
        let buf  = view.buffer(scope)?;
        let raw  = buf.get_backing_store().data();
        if raw.is_none() { return None; }
        let ptr  = unsafe { (raw.unwrap().as_ptr() as *const u8).add(view.byte_offset()) };
        Some((ptr, view.byte_length()))
    }

    let Some((cmd_ptr, cmd_len)) = view_ptr_len(scope, args.get(1)) else {
        log::warn!("canvas_flush: command buffer unavailable");
        return;
    };
    let (str_ptr, str_cap) = view_ptr_len(scope, args.get(3)).unwrap_or((std::ptr::null(), 0));

    // SAFETY: single-threaded V8; slices are read (and fully copied into owned
    // CanvasCmds by decode) before returning to JS, which cannot mutate or
    // reallocate the buffer in the meantime.
    let cmds = unsafe {
        let cmd_bytes = std::slice::from_raw_parts(cmd_ptr, cmd_len);
        let str_avail = str_len.min(str_cap);
        let str_bytes: &[u8] = if str_ptr.is_null() || str_avail == 0 {
            &[]
        } else {
            std::slice::from_raw_parts(str_ptr, str_avail)
        };
        decode_canvas_binary(cmd_bytes, float_count, str_bytes)
    };
    state.scene.lock().push_back(SceneCommand::CanvasUpdate { id, cmds, append });
}

/// `__glyx_canvas3d_update(id, sceneJson)` â€” sync.
/// Parses a JSON Scene3D and pushes a Canvas3DUpdate scene command.
#[cfg(feature = "canvas3d")]
pub fn canvas3d_update_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id   = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let json = args.get(1).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope.as_ref()))
        .unwrap_or_default();

    let scene: glyx_3d::Scene3D = match serde_json::from_str(&json) {
        Ok(s)  => s,
        Err(e) => { log::warn!("canvas3d_update parse error: {e}"); return; }
    };
    state.scene.lock().push_back(SceneCommand::Canvas3DUpdate { id, scene });
}

/// `__glyx_webview_post_message(id, msg)` — sync.
/// Pushes a message INTO the webview page at node `id` (JS→page half of the
/// postMessage bridge). Delivered as a `message` event on `window`.
#[cfg(feature = "webview")]
pub fn webview_post_message_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id  = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let msg = args.get(1).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope.as_ref()))
        .unwrap_or_default();

    state.scene.lock().push_back(SceneCommand::WebviewPostMessage { id, msg });
}

/// `__glyx_webview_poll() → JSON`
///
/// Returns a JSON array of `{"id":N,"message":"..."}` objects — messages the
/// page(s) have posted OUT via `window.ipc.postMessage(str)` since the last
/// poll (page→JS half of the bridge). Called each frame from JS.
#[cfg(feature = "webview")]
pub fn webview_poll_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let _ = args; // no arguments

    let mut events = state.webview_events.lock();
    let json = if events.is_empty() {
        "[]".to_string()
    } else {
        let items: Vec<_> = events.drain(..).collect();
        format!("[{}]", items.join(","))
    };
    let s = v8::String::new(scope, &json).unwrap();
    rv.set(s.into());
}

/// `__glyx_canvas3d_load_gltf(id, path)` â€” sync.
/// Signals that a GLTF file should be loaded for this canvas on the render side.
/// (Actual loading happens in glyx-core on next frame via renderer_3d.)
#[cfg(feature = "canvas3d")]
pub fn canvas3d_load_gltf_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id   = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let path = args.get(1).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope.as_ref()))
        .unwrap_or_default();

    // M2: gate GLTF loads behind fs.read capability.
    let path = match glyx_security::resolve_and_check_read(std::path::Path::new(&path)) {
        Ok(c)  => c.to_string_lossy().into_owned(),
        Err(e) => { throw_js_error(scope, &format!("canvas3d.loadGltf denied: {e}")); return; }
    };

    // Push a dummy scene update that triggers GLTF loading on render side.
    // The GLTF geometry becomes available on the next canvas3d_update.
    let scene = glyx_3d::Scene3D {
        background: None,
        camera:     glyx_3d::Camera3D { position: [0.,1.,3.], target: [0.;3], up: [0.,1.,0.], fov_deg: 60., near: 0.1, far: 1000. },
        lights:     vec![],
        meshes:     vec![glyx_3d::Mesh3DInstance {
            geometry:  glyx_3d::Geometry3D::Gltf { path: path.clone() },
            transform: [1.,0.,0.,0., 0.,1.,0.,0., 0.,0.,1.,0., 0.,0.,0.,1.],
            color:     [1.;4],
        }],
    };
    let _ = id; // used by canvas3d_update; here we just warm up gltf cache
    // The load itself is triggered by the renderer when it encounters Gltf geometry.
    // Push an info scene command with the path so glyx-core can pre-warm the cache.
    state.scene.lock().push_back(SceneCommand::Canvas3DUpdate { id, scene });
}

/// `__glyx_canvas3d_unload_gltf(path)` â€” drop a GLTF model from the LRU cache.
/// Useful before loading a large new model to reclaim GPU memory immediately.
#[cfg(feature = "canvas3d")]
pub fn canvas3d_unload_gltf_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let path = args.get(0).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope.as_ref()))
        .unwrap_or_default();

    state.scene.lock().push_back(SceneCommand::Canvas3DUnloadGltf { path });
}
