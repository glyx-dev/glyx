use super::*;
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

    let text          = v8_arg_to_string(scope, &args, 0);
    let model_cache   = Arc::clone(&state.ai_embed_model);
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
            serde_json::to_string(&vec)
                .map_err(|e| format!("ai.embed serialize: {e}"))
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_ai_generate(prompt, optsJson) â†’ Promise<string>`
///
/// `optsJson` shape: `{ "maxTokens": 200, "temperature": 0.7 }`
///
/// Loads Phi-2 Q4_K_M GGUF on first call (~1.7 GB download). Runs entirely on CPU.
/// Expected latency: 10-30 seconds per 200 tokens on modern desktop CPUs.
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

    let prompt   = v8_arg_to_string(scope, &args, 0);
    let opts_raw = v8_arg_to_string(scope, &args, 1);
    let model_cache = Arc::clone(&state.ai_generate_model);

    // Battery-aware thread throttling: use fewer threads when on battery.
    let on_battery = glyx_sysapi::battery_status()
        .map(|b| !b.charging)
        .unwrap_or(false);

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let opts = serde_json::from_str::<serde_json::Value>(&opts_raw).unwrap_or_default();
            let max_tokens:  usize = opts.get("maxTokens").and_then(|v| v.as_u64())
                .unwrap_or(200) as usize;
            let temperature: f32   = opts.get("temperature").and_then(|v| v.as_f64())
                .unwrap_or(0.7) as f32;

            if on_battery {
                log::info!("[ai] on battery â€” generation running with default thread count");
            }

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

/// `__glyx_ai_transcribe(audioPath, optsJson) â†’ Promise<string>`
///
/// `optsJson` shape: `{ "language": "en" }` (empty string = auto-detect).
///
/// Loads Whisper-tiny on first call (~75 MB download from HuggingFace Hub).
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
            let opts = serde_json::from_str::<serde_json::Value>(&opts_raw).unwrap_or_default();
            let language = opts.get("language").and_then(|v| v.as_str())
                .unwrap_or("").to_string();

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

// â”€â”€ AI unload bindings â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

/// `__glyx_ai_unload_embed() â†’ undefined` â€” drops the embed model from RAM immediately.
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

/// `__glyx_ai_unload_generate() â†’ undefined` â€” drops the generate model (~1.7 GB) from RAM.
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

/// `__glyx_ai_unload_transcribe() â†’ undefined` â€” drops the Whisper model from RAM.
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
