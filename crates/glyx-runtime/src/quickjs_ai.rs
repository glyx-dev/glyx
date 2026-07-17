//! `__glyx_ai_*` bindings, ported from `bind_ai.rs`'s V8 implementation.
//! Two mutually-exclusive paths, mirroring `bind_ai.rs`'s own `#[cfg(feature
//! = "ai")]`/`#[cfg(not(feature = "ai"))]` split on the exact same function
//! names: when `ai` is compiled in, `glyx-ai` is used directly (model
//! caching in-process); otherwise calls go through the `AiCap` C-ABI vtable
//! resolved by `cap_loader::load_caps()` — the dynamically-loaded
//! `glyx-cap-ai` plugin path, for apps that ship AI as a separate signed
//! plugin instead of linking it statically.

use std::sync::Arc;
#[cfg(feature = "ai")]
use parking_lot::Mutex;
use rquickjs::Ctx;
use tokio::runtime::Handle;

use crate::bindings::{CompletionQueue, RedrawRequest};
use crate::quickjs_runtime::QuickJsRuntime;

#[cfg(feature = "ai")]
pub(crate) type EmbedModelCache    = Arc<Mutex<Option<glyx_ai::EmbedModel>>>;
#[cfg(feature = "ai")]
pub(crate) type GenerateModelCache = Arc<Mutex<Option<glyx_ai::GenerateModel>>>;
#[cfg(feature = "ai")]
pub(crate) type WhisperModelCache  = Arc<Mutex<Option<glyx_ai::WhisperModel>>>;

fn cap_denied<'js>(ctx: &Ctx<'js>) -> rquickjs::Result<rquickjs::Promise<'js>> {
    QuickJsRuntime::reject_now(ctx, "Capability required: ai — add it to glyx.config.json under \"capabilities\"".to_string())
}

#[cfg(not(feature = "ai"))]
fn cap_not_loaded<'js>(ctx: &Ctx<'js>) -> rquickjs::Result<rquickjs::Promise<'js>> {
    QuickJsRuntime::reject_now(ctx, "ai capability not loaded".to_string())
}

#[cfg(feature = "ai")]
pub(crate) fn ai_embed<'js>(
    ctx: Ctx<'js>, text: String, model_cache: EmbedModelCache,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().ai { return cap_denied(&ctx); }
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || -> Result<String, String> {
            let mut guard = model_cache.lock();
            if guard.is_none() {
                if !glyx_security::get().can_ai_download() {
                    return Err("ai.embed: model not cached and 'aiModelDownload' capability is not declared. \
                        Add \"aiModelDownload\": true to glyx.config capabilities to permit downloads.".into());
                }
                *guard = Some(glyx_ai::EmbedModel::load().map_err(|e| format!("ai.embed model load: {e}"))?);
            }
            let vec = guard.as_ref().unwrap().embed(&text).map_err(|e| format!("ai.embed: {e}"))?;
            serde_json::to_string(&vec).map_err(|e| format!("ai.embed serialize: {e}"))
        }).await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

#[cfg(feature = "ai")]
pub(crate) fn ai_generate<'js>(
    ctx: Ctx<'js>, prompt: String, opts_raw: String, model_cache: GenerateModelCache,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().ai { return cap_denied(&ctx); }
    let on_battery = glyx_sysapi::battery_status().map(|b| !b.charging).unwrap_or(false);
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || -> Result<String, String> {
            let opts = serde_json::from_str::<serde_json::Value>(&opts_raw).unwrap_or_default();
            let max_tokens = opts.get("maxTokens").and_then(|v| v.as_u64()).unwrap_or(200) as usize;
            let temperature = opts.get("temperature").and_then(|v| v.as_f64()).unwrap_or(0.7) as f32;
            if on_battery { log::info!("[ai] on battery — generation with default thread count"); }
            let mut guard = model_cache.lock();
            if guard.is_none() {
                if !glyx_security::get().can_ai_download() {
                    return Err("ai.generate: model not cached and 'aiModelDownload' capability is not declared. \
                        Add \"aiModelDownload\": true to glyx.config capabilities to permit downloads.".into());
                }
                *guard = Some(glyx_ai::GenerateModel::load().map_err(|e| format!("ai.generate model load: {e}"))?);
            }
            guard.as_mut().unwrap().generate(&prompt, max_tokens, temperature).map_err(|e| format!("ai.generate: {e}"))
        }).await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

#[cfg(feature = "ai")]
pub(crate) fn ai_transcribe<'js>(
    ctx: Ctx<'js>, audio_path: String, opts_raw: String, model_cache: WhisperModelCache,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().ai { return cap_denied(&ctx); }
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || -> Result<String, String> {
            let opts = serde_json::from_str::<serde_json::Value>(&opts_raw).unwrap_or_default();
            let language = opts.get("language").and_then(|v| v.as_str()).unwrap_or("").to_string();
            let mut guard = model_cache.lock();
            if guard.is_none() {
                if !glyx_security::get().can_ai_download() {
                    return Err("ai.transcribe: model not cached and 'aiModelDownload' capability is not declared. \
                        Add \"aiModelDownload\": true to glyx.config capabilities to permit downloads.".into());
                }
                *guard = Some(glyx_ai::WhisperModel::load().map_err(|e| format!("ai.transcribe model load: {e}"))?);
            }
            guard.as_mut().unwrap().transcribe(&audio_path, &language).map_err(|e| format!("ai.transcribe: {e}"))
        }).await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

#[cfg(feature = "ai")]
pub(crate) fn ai_unload_embed(model_cache: &EmbedModelCache) { *model_cache.lock() = None; }
#[cfg(feature = "ai")]
pub(crate) fn ai_unload_generate(model_cache: &GenerateModelCache) { *model_cache.lock() = None; }
#[cfg(feature = "ai")]
pub(crate) fn ai_unload_transcribe(model_cache: &WhisperModelCache) { *model_cache.lock() = None; }

// ── Dynamic plugin-vtable fallback (feature "ai" off) ────────────────────

#[cfg(not(feature = "ai"))]
pub(crate) fn ai_embed<'js>(
    ctx: Ctx<'js>, text: String, cap: Option<&'static glyx_cap_abi::AiCap>,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().ai { return cap_denied(&ctx); }
    let Some(cap) = cap else { return cap_not_loaded(&ctx); };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || -> Result<String, String> {
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
        }).await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

#[cfg(not(feature = "ai"))]
pub(crate) fn ai_generate<'js>(
    ctx: Ctx<'js>, prompt: String, opts_raw: String, cap: Option<&'static glyx_cap_abi::AiCap>,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().ai { return cap_denied(&ctx); }
    let Some(cap) = cap else { return cap_not_loaded(&ctx); };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || -> Result<String, String> {
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
        }).await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

#[cfg(not(feature = "ai"))]
pub(crate) fn ai_transcribe<'js>(
    ctx: Ctx<'js>, audio_path: String, cap: Option<&'static glyx_cap_abi::AiCap>,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().ai { return cap_denied(&ctx); }
    let Some(cap) = cap else { return cap_not_loaded(&ctx); };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || -> Result<String, String> {
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
        }).await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

#[cfg(not(feature = "ai"))]
pub(crate) fn ai_unload_embed(cap: Option<&'static glyx_cap_abi::AiCap>) {
    if let Some(cap) = cap { unsafe { (cap.unload)(0) }; }
}
#[cfg(not(feature = "ai"))]
pub(crate) fn ai_unload_generate(cap: Option<&'static glyx_cap_abi::AiCap>) {
    if let Some(cap) = cap { unsafe { (cap.unload)(1) }; }
}
#[cfg(not(feature = "ai"))]
pub(crate) fn ai_unload_transcribe(cap: Option<&'static glyx_cap_abi::AiCap>) {
    if let Some(cap) = cap { unsafe { (cap.unload)(2) }; }
}
