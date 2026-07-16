use super::*;
pub fn get_time(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    _args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as f64;
    rv.set(v8::Number::new(scope, ms).into());
}

/// `__glyx_request_frame(ms)` â€” schedule a redraw after `ms` milliseconds.
///
/// Called by the `setTimeout` polyfill so timer-driven animation loops
/// (canvas, React scheduler) wake the winit event loop at the right time
/// without spinning the GPU on static screens.
pub fn request_frame_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let ext   = v8::Local::<v8::External>::try_from(args.data()).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let ms = args.get(0)
        .number_value(scope)
        .unwrap_or(16.0)
        .max(0.0) as u64;
    if let Some(redraw) = state.request_redraw.as_ref().map(Arc::clone) {
        state.tokio.spawn(async move {
            if ms > 0 {
                tokio::time::sleep(std::time::Duration::from_millis(ms)).await;
            }
            redraw();
        });
    }
}

pub fn js_log(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let msg = args
        .get(0)
        .to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope.as_ref()))
        .unwrap_or_else(|| "<no message>".into());
    log::info!("[JS] {}", msg);

    // Forward to CDP inspector console if connected.
    let ext   = v8::Local::<v8::External>::try_from(args.data()).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if let Some(tx) = state.cdp_log_tx.lock().as_ref() {
        let ts = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .as_millis();
        let value_json = serde_json::to_string(&msg).unwrap_or_default();
        let cdp = format!(
            r#"{{"method":"Runtime.consoleAPICalled","params":{{"type":"log","args":[{{"type":"string","value":{value_json}}}],"timestamp":{ts},"executionContextId":1}}}}"#
        );
        let _ = tx.send(cdp);
    }
}

// â”€â”€ __glyx_pollEvents â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Returns a JS Array of event objects. Each object has a `type` string
// plus type-specific fields:
//   { type: "mouseButton", x, y, button, pressed }
//   { type: "cursorMoved", x, y }
//   { type: "keyInput",    key, text, pressed }
//   { type: "scroll",      deltaY }

pub fn poll_events_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let events: Vec<InputEvent> = {
        let mut q = state.events.lock();
        q.drain(..).collect()
    };

    let array = v8::Array::new(scope, events.len() as i32);
    for (i, ev) in events.into_iter().enumerate() {
        let obj = v8::Object::new(scope);

        macro_rules! set_str {
            ($key:literal, $val:expr) => {
                let k = v8::String::new(scope, $key).unwrap();
                let v = v8::String::new(scope, $val).unwrap();
                obj.set(scope, k.into(), v.into());
            };
        }
        macro_rules! set_num {
            ($key:literal, $val:expr) => {
                let k = v8::String::new(scope, $key).unwrap();
                let v = v8::Number::new(scope, $val as f64);
                obj.set(scope, k.into(), v.into());
            };
        }
        macro_rules! set_bool {
            ($key:literal, $val:expr) => {
                let k = v8::String::new(scope, $key).unwrap();
                let v = v8::Boolean::new(scope, $val);
                obj.set(scope, k.into(), v.into());
            };
        }

        match ev {
            InputEvent::MouseButton { x, y, button, pressed } => {
                set_str!("type", "mouseButton");
                set_num!("x", x);
                set_num!("y", y);
                set_num!("button", button);
                set_bool!("pressed", pressed);
            }
            InputEvent::CursorMoved { x, y } => {
                set_str!("type", "cursorMoved");
                set_num!("x", x);
                set_num!("y", y);
            }
            InputEvent::KeyInput { key, text, pressed } => {
                set_str!("type", "keyInput");
                set_str!("key", &key);
                set_bool!("pressed", pressed);
                if let Some(t) = text {
                    set_str!("text", &t);
                }
            }
            InputEvent::Scroll { delta_y } => {
                set_str!("type", "scroll");
                set_num!("deltaY", delta_y);
            }
            InputEvent::ScrollbarDrag { node_id, scroll_y } => {
                set_str!("type", "scrollbarDrag");
                set_num!("nodeId", node_id);
                set_num!("scrollY", scroll_y);
            }
            InputEvent::Resize { width, height } => {
                set_str!("type", "resize");
                set_num!("width", width);
                set_num!("height", height);
            }
            InputEvent::ImageError { image_id, path } => {
                set_str!("type", "imageError");
                set_num!("imageId", image_id);
                set_str!("path", &path);
            }
            InputEvent::SystemWatch { id, payload } => {
                set_str!("type", "systemWatch");
                set_num!("id", id);
                set_str!("payload", &payload);
            }
            InputEvent::DragStart { x, y } => {
                set_str!("type", "dragStart");
                set_num!("x", x);
                set_num!("y", y);
            }
            InputEvent::DragMove { x, y, dx, dy } => {
                set_str!("type", "dragMove");
                set_num!("x", x);
                set_num!("y", y);
                set_num!("dx", dx);
                set_num!("dy", dy);
            }
            InputEvent::DragEnd { x, y } => {
                set_str!("type", "dragEnd");
                set_num!("x", x);
                set_num!("y", y);
            }
        }

        array.set_index(scope, i as u32, obj.into());
    }

    rv.set(array.into());
}

// â”€â”€ __glyx_getLayout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Returns `{ x, y, width, height }` for the given node id,
// or `null` if the node has not been laid out yet.

pub fn get_layout_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let cache = state.layout_cache.lock();

    if let Some(&[x, y, w, h]) = cache.get(&id) {
        let obj = v8::Object::new(scope);
        macro_rules! set_num {
            ($key:literal, $val:expr) => {
                let k = v8::String::new(scope, $key).unwrap();
                let v = v8::Number::new(scope, $val as f64);
                obj.set(scope, k.into(), v.into());
            };
        }
        set_num!("x",      x);
        set_num!("y",      y);
        set_num!("width",  w);
        set_num!("height", h);
        // Clip (scroll) nodes publish measured content height under the
        // high-bit key (see glyx-core layout.rs CONTENT_HEIGHT_KEY).
        if let Some(&[_, _, _, ch]) = cache.get(&(id | 0x8000_0000)) {
            set_num!("contentHeight", ch);
        }
        rv.set(obj.into());
    } else {
        rv.set(v8::null(scope).into());
    }
}

// â”€â”€ __glyx_measure_text â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Returns `{ width, height }` (logical px) for `text` shaped at `fontSize`,
// wrapped to `maxWidth` (pass a large value like 1e6 for single-line). Used for
// table column auto-sizing and rich-text cursor/layout math.

pub fn measure_text_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let text      = args.get(0).to_string(scope).map(|s| s.to_rust_string_lossy(scope.as_ref())).unwrap_or_default();
    let font_size = args.get(1).number_value(scope).unwrap_or(14.0) as f32;
    let mw = args.get(2).number_value(scope).unwrap_or(0.0);
    let max_width = if mw.is_finite() && mw > 0.0 { mw as f32 } else { 1.0e6 };
    // Optional 4th arg: "bold" | "italic" | "bold italic" | omit for normal
    let style_str = args.get(3).to_string(scope).map(|s| s.to_rust_string_lossy(scope.as_ref())).unwrap_or_default();
    let bold   = style_str.contains("bold");
    let italic = style_str.contains("italic");

    let (w, h) = if bold || italic {
        let layout = state.text_measure.borrow_mut().styled_label(&text, font_size, max_width, bold, italic);
        (layout.width(), layout.height())
    } else {
        state.text_measure.borrow_mut().measure(&text, font_size, max_width)
    };

    let obj = v8::Object::new(scope);
    let wk = v8::String::new(scope, "width").unwrap();
    let wv = v8::Number::new(scope, w as f64);
    obj.set(scope, wk.into(), wv.into());
    let hk = v8::String::new(scope, "height").unwrap();
    let hv = v8::Number::new(scope, h as f64);
    obj.set(scope, hk.into(), hv.into());
    rv.set(obj.into());
}

// â”€â”€ __glyx_text_char_at_x â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Returns the character index (0-based) nearest to `x` pixels from the left
// edge of `text` shaped at `fontSize` / `maxWidth`. Used by SelectableText for
// pointer hit-testing (mouse-down / drag â†’ selection range).
//
// Signature: __glyx_text_char_at_x(text, fontSize, maxWidth, x) â†’ number

pub fn text_char_at_x_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let text      = args.get(0).to_string(scope).map(|s| s.to_rust_string_lossy(scope.as_ref())).unwrap_or_default();
    let font_size = args.get(1).number_value(scope).unwrap_or(16.0) as f32;
    let mw        = args.get(2).number_value(scope).unwrap_or(0.0);
    let max_width = if mw.is_finite() && mw > 0.0 { mw as f32 } else { 1.0e6 };
    let target_x  = args.get(3).number_value(scope).unwrap_or(0.0) as f32;

    let idx = state.text_measure.borrow_mut().char_at_x(&text, font_size, max_width, target_x);
    rv.set(v8::Number::new(scope, idx as f64).into());
}

// ── __glyx_text_pos_at ────────────────────────────────────────────────────────
//
// 2-D caret hit-test for WRAPPED text: returns the character index nearest to
// point (x, y) in `text` shaped at `fontSize` and wrapped to `maxWidth`.
// Handles soft wraps and '\n' — used by multiline TextInput click/drag.
//
// Signature: __glyx_text_pos_at(text, fontSize, maxWidth, x, y) → number

pub fn text_pos_at_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let text      = args.get(0).to_string(scope).map(|s| s.to_rust_string_lossy(scope.as_ref())).unwrap_or_default();
    let font_size = args.get(1).number_value(scope).unwrap_or(16.0) as f32;
    let mw        = args.get(2).number_value(scope).unwrap_or(0.0);
    let max_width = if mw.is_finite() && mw > 0.0 { mw as f32 } else { 1.0e6 };
    let x         = args.get(3).number_value(scope).unwrap_or(0.0) as f32;
    let y         = args.get(4).number_value(scope).unwrap_or(0.0) as f32;

    let idx = state.text_measure.borrow_mut().pos_at_point(&text, font_size, max_width, x, y);
    rv.set(v8::Number::new(scope, idx as f64).into());
}

// â”€â”€ Sync binding: __glyx_getEnv â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Returns the value of an environment variable as a string, or JS `null` if
// the variable is absent OR the name is not in the `env.allow` capability list.
//
// Returning null (rather than throwing) is intentional â€” a capability miss is
// not a programmer error; the app should handle missing values gracefully.

pub fn get_env_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let name = args
        .get(0)
        .to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope.as_ref()))
        .unwrap_or_default();

    // Silent null for undeclared names â€” does not reveal that the var exists.
    if !glyx_security::get().can_get_env(&name) {
        rv.set(v8::null(scope).into());
        return;
    }

    match std::env::var(&name) {
        Ok(val) => rv.set(v8::String::new(scope, &val).unwrap().into()),
        Err(_)  => rv.set(v8::null(scope).into()),
    }
}

// â”€â”€ Async binding: __glyx_readFile â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pub fn read_file_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let path = args
        .get(0)
        .to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope.as_ref()))
        .unwrap_or_default();

    // Capability gate â€” per-path glob check; throws a JS Error when denied.
    // M1: canonicalize then check -- TOCTOU-safe; open the returned canonical path.
    let path = match glyx_security::resolve_and_check_read(std::path::Path::new(&path)) {
        Ok(c)  => c.to_string_lossy().into_owned(),
        Err(e) => { throw_js_error(scope, &format!("fs.read denied: {e}")); return; }
    };

    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| e.to_string());
        enqueue_completion(
            &queue_clone,
            redraw.as_ref(),
            Completion { resolver_ptr: resolver, result },
        );
    });
}

// â”€â”€ Async binding: __glyx_readFileBytes â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
//
// Reads a file as raw bytes and returns a base64-encoded string.
// Used for binary files (images, PDFs, etc.) before uploading via fetch multipart.
//
// `__glyx_readFileBytes(path) -> Promise<string>`   (base64)

pub fn read_file_bytes_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let path = args.get(0).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope.as_ref()))
        .unwrap_or_default();

    // M1: canonicalize then check -- TOCTOU-safe; open the returned canonical path.
    let path = match glyx_security::resolve_and_check_read(std::path::Path::new(&path)) {
        Ok(c)  => c.to_string_lossy().into_owned(),
        Err(e) => { throw_js_error(scope, &format!("fs.read denied: {e}")); return; }
    };

    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::fs::read(&path)
            .await
            .map(|bytes| base64::engine::general_purpose::STANDARD.encode(&bytes))
            .map_err(|e| e.to_string());
        enqueue_completion(&queue_clone, redraw.as_ref(),
            Completion { resolver_ptr: resolver, result });
    });
}

// â”€â”€ Scene graph bindings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pub fn create_node_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id = state.next_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let node_type = parse_node_type(scope, args.get(0));
    let props = parse_props(scope, args.get(1));

    state.scene.lock()
        .push_back(SceneCommand::CreateNode { id, node_type, props });

    rv.set(v8::Number::new(scope, id as f64).into());
}

pub fn create_image_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let path = args
        .get(0)
        .to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope.as_ref()))
        .unwrap_or_default();

    // M2: gate local-path image loads behind fs.read capability.
    // data: URIs and http(s): URLs are not local filesystem reads -- skip the check.
    let is_local = !path.starts_with("data:")
        && !path.starts_with("http://")
        && !path.starts_with("https://");
    let path = if is_local {
        match glyx_security::resolve_and_check_read(std::path::Path::new(&path)) {
            Ok(c)  => c.to_string_lossy().into_owned(),
            Err(e) => { throw_js_error(scope, &format!("createImage denied: {e}")); return; }
        }
    } else {
        path
    };

    // Optional display-size hint (used to rasterize SVGs at the rendered size).
    let width  = args.get(1).number_value(scope).filter(|v| *v > 0.0).map(|v| v as f32);
    let height = args.get(2).number_value(scope).filter(|v| *v > 0.0).map(|v| v as f32);

    let id = state.next_image_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    state.scene.lock()
        .push_back(SceneCommand::CreateImage { id, path, width, height });

    rv.set(v8::Number::new(scope, id as f64).into());
}

pub fn append_child_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let parent_id = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let child_id  = args.get(1).number_value(scope).unwrap_or_default() as u32;

    state.scene.lock()
        .push_back(SceneCommand::AppendChild { parent_id, child_id });

    rv.set(v8::Boolean::new(scope, true).into());
}

pub fn insert_before_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let parent_id = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let child_id  = args.get(1).number_value(scope).unwrap_or_default() as u32;
    let before_id = args.get(2).number_value(scope).unwrap_or_default() as u32;

    state.scene.lock()
        .push_back(SceneCommand::InsertBefore { parent_id, child_id, before_id });

    rv.set(v8::Boolean::new(scope, true).into());
}

pub fn update_node_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id    = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let props = parse_props(scope, args.get(1));

    state.scene.lock().push_back(SceneCommand::UpdateNode { id, props });
    rv.set(v8::Boolean::new(scope, true).into());
}

pub fn remove_node_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id = args.get(0).number_value(scope).unwrap_or_default() as u32;
    state.scene.lock().push_back(SceneCommand::RemoveNode { id });
    rv.set(v8::Boolean::new(scope, true).into());
}

pub fn set_root_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id = args.get(0).number_value(scope).unwrap_or_default() as u32;
    state.scene.lock().push_back(SceneCommand::SetRoot { id });
    rv.set(v8::Boolean::new(scope, true).into());
}

/// `__glyx_set_focus(nodeId | null)` — sync.
/// Updates the global keyboard-focus registry. Called from JS on a control's
/// onFocus (with its node id) and onBlur (with `null`, if nothing else is
/// about to claim focus in the same tick).
pub fn set_focus_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let arg = args.get(0);
    let id = if arg.is_null_or_undefined() {
        None
    } else {
        Some(arg.number_value(scope).unwrap_or_default() as u32)
    };
    state.scene.lock().push_back(SceneCommand::SetFocus { id });
    rv.set(v8::Boolean::new(scope, true).into());
}

// â”€â”€ Window control bindings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

pub fn get_window_size_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if let Some(ctrl) = &state.window {
        let (w, h) = (ctrl.get_window_size)();
        let obj = v8::Object::new(scope);
        macro_rules! set_num {
            ($key:literal, $val:expr) => {
                let k = v8::String::new(scope, $key).unwrap();
                let v = v8::Number::new(scope, $val as f64);
                obj.set(scope, k.into(), v.into());
            };
        }
        set_num!("width",  w);
        set_num!("height", h);
        rv.set(obj.into());
    } else {
        rv.set(v8::null(scope).into());
    }
}

pub fn get_screen_size_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if let Some(ctrl) = &state.window {
        if let Some((w, h)) = (ctrl.get_screen_size)() {
            let obj = v8::Object::new(scope);
            macro_rules! set_num {
                ($key:literal, $val:expr) => {
                    let k = v8::String::new(scope, $key).unwrap();
                    let v = v8::Number::new(scope, $val as f64);
                    obj.set(scope, k.into(), v.into());
                };
            }
            set_num!("width",  w);
            set_num!("height", h);
            rv.set(obj.into());
            return;
        }
    }
    rv.set(v8::null(scope).into());
}
