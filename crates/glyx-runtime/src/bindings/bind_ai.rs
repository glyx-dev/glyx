use super::*;

// ── Embed ─────────────────────────────────────────────────────────────────────

#[cfg(feature = "ai")]
pub fn ai_embed_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().ai {
        rv.set(reject_cap_promise(scope, "ai").into()); return;
    }
    let text        = v8_arg_to_string(scope, &args, 0);
    let model_cache = Arc::clone(&state.ai_embed_model);
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());
    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let mut guard = model_cache.lock();
            if guard.is_none() {
                *guard = Some(glyx_ai::EmbedModel::load()
                    .map_err(|e| format!("ai.embed model load: {e}"))?);
            }
            let vec = guard.as_ref().unwrap().embed(&text)
                .map_err(|e| format!("ai.embed: {e}"))?;
            serde_json::to_string(&vec).map_err(|e| format!("ai.embed serialize: {e}"))
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

#[cfg(not(feature = "ai"))]
pub fn ai_embed_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().ai {
        rv.set(reject_cap_promise(scope, "ai").into()); return;
    }
    let cap = match state.caps.ai {
        Some(c) => c,
        None => { rv.set(reject_promise_with_error(scope, "ai capability not loaded").into()); return; }
    };
    let text = v8_arg_to_string(scope, &args, 0);
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());
    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let text_b = text.as_bytes();
            let mut out = vec![0u8; 65536];
            let mut out_len: usize = 0;
            let rc = unsafe { (cap.embed)(
                std::ptr::null(), 0,
                text_b.as_ptr(), text_b.len(),
                out.as_mut_ptr(), &mut out_len, out.len(),
            )};
            if rc != 0 { return Err(format!("ai.embed vtable error: {rc}")); }
            Ok(String::from_utf8_lossy(&out[..out_len]).into_owned())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// ── Generate ──────────────────────────────────────────────────────────────────

#[cfg(feature = "ai")]
pub fn ai_generate_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().ai {
        rv.set(reject_cap_promise(scope, "ai").into()); return;
    }
    let prompt      = v8_arg_to_string(scope, &args, 0);
    let opts_raw    = v8_arg_to_string(scope, &args, 1);
    let model_cache = Arc::clone(&state.ai_generate_model);
    let on_battery  = glyx_sysapi::battery_status().map(|b| !b.charging).unwrap_or(false);
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());
    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let opts        = serde_json::from_str::<serde_json::Value>(&opts_raw).unwrap_or_default();
            let max_tokens  = opts.get("maxTokens").and_then(|v| v.as_u64()).unwrap_or(200) as usize;
            let temperature = opts.get("temperature").and_then(|v| v.as_f64()).unwrap_or(0.7) as f32;
            if on_battery { log::info!("[ai] on battery — generation with default thread count"); }
            let mut guard = model_cache.lock();
            if guard.is_none() {
                *guard = Some(glyx_ai::GenerateModel::load()
                    .map_err(|e| format!("ai.generate model load: {e}"))?);
            }
            guard.as_mut().unwrap().generate(&prompt, max_tokens, temperature)
                .map_err(|e| format!("ai.generate: {e}"))
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

#[cfg(not(feature = "ai"))]
pub fn ai_generate_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().ai {
        rv.set(reject_cap_promise(scope, "ai").into()); return;
    }
    let cap = match state.caps.ai {
        Some(c) => c,
        None => { rv.set(reject_promise_with_error(scope, "ai capability not loaded").into()); return; }
    };
    let prompt   = v8_arg_to_string(scope, &args, 0);
    let opts_raw = v8_arg_to_string(scope, &args, 1);
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());
    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let prompt_b = prompt.as_bytes();
            let opts_b   = opts_raw.as_bytes();
            let mut out = vec![0u8; 131072];
            let mut out_len: usize = 0;
            let rc = unsafe { (cap.generate)(
                std::ptr::null(), 0,
                prompt_b.as_ptr(), prompt_b.len(),
                opts_b.as_ptr(),   opts_b.len(),
                out.as_mut_ptr(), &mut out_len, out.len(),
            )};
            if rc != 0 { return Err(format!("ai.generate vtable error: {rc}")); }
            Ok(String::from_utf8_lossy(&out[..out_len]).into_owned())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// ── Transcribe ────────────────────────────────────────────────────────────────

#[cfg(feature = "ai")]
pub fn ai_transcribe_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().ai {
        rv.set(reject_cap_promise(scope, "ai").into()); return;
    }
    let audio_path  = v8_arg_to_string(scope, &args, 0);
    let opts_raw    = v8_arg_to_string(scope, &args, 1);
    let model_cache = Arc::clone(&state.ai_whisper_model);
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());
    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let opts     = serde_json::from_str::<serde_json::Value>(&opts_raw).unwrap_or_default();
            let language = opts.get("language").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let mut guard = model_cache.lock();
            if guard.is_none() {
                *guard = Some(glyx_ai::WhisperModel::load()
                    .map_err(|e| format!("ai.transcribe model load: {e}"))?);
            }
            guard.as_mut().unwrap().transcribe(&audio_path, &language)
                .map_err(|e| format!("ai.transcribe: {e}"))
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

#[cfg(not(feature = "ai"))]
pub fn ai_transcribe_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().ai {
        rv.set(reject_cap_promise(scope, "ai").into()); return;
    }
    let cap = match state.caps.ai {
        Some(c) => c,
        None => { rv.set(reject_promise_with_error(scope, "ai capability not loaded").into()); return; }
    };
    let audio_path = v8_arg_to_string(scope, &args, 0);
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());
    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let path_b = audio_path.as_bytes();
            let mut out = vec![0u8; 65536];
            let mut out_len: usize = 0;
            let rc = unsafe { (cap.transcribe)(
                std::ptr::null(), 0,
                path_b.as_ptr(), path_b.len(),
                out.as_mut_ptr(), &mut out_len, out.len(),
            )};
            if rc != 0 { return Err(format!("ai.transcribe vtable error: {rc}")); }
            Ok(String::from_utf8_lossy(&out[..out_len]).into_owned())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// ── Unload ────────────────────────────────────────────────────────────────────

#[cfg(feature = "ai")]
pub fn ai_unload_embed_callback(
    _scope: &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    *state.ai_embed_model.lock() = None;
}

#[cfg(not(feature = "ai"))]
pub fn ai_unload_embed_callback(
    _scope: &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if let Some(cap) = state.caps.ai { unsafe { (cap.unload)(0) }; }
}

#[cfg(feature = "ai")]
pub fn ai_unload_generate_callback(
    _scope: &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    *state.ai_generate_model.lock() = None;
}

#[cfg(not(feature = "ai"))]
pub fn ai_unload_generate_callback(
    _scope: &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if let Some(cap) = state.caps.ai { unsafe { (cap.unload)(1) }; }
}

#[cfg(feature = "ai")]
pub fn ai_unload_transcribe_callback(
    _scope: &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    *state.ai_whisper_model.lock() = None;
}

#[cfg(not(feature = "ai"))]
pub fn ai_unload_transcribe_callback(
    _scope: &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if let Some(cap) = state.caps.ai { unsafe { (cap.unload)(2) }; }
}
