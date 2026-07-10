//! Static glyx-ai-backed AiCap implementation.

use glyx_cap_abi::{AiCap, ABI_VERSION};
use parking_lot::Mutex;

// ── Model cache ───────────────────────────────────────────────────────────────

static EMBED_MODEL:    Mutex<Option<glyx_ai::EmbedModel>>    = Mutex::new(None);
static GENERATE_MODEL: Mutex<Option<glyx_ai::GenerateModel>> = Mutex::new(None);
static WHISPER_MODEL:  Mutex<Option<glyx_ai::WhisperModel>>  = Mutex::new(None);

// ── Helpers ───────────────────────────────────────────────────────────────────

unsafe fn bytes_to_str<'a>(ptr: *const u8, len: usize) -> &'a str {
    std::str::from_utf8(std::slice::from_raw_parts(ptr, len)).unwrap_or("")
}

fn write_result(s: &str, out_buf: *mut u8, out_len: *mut usize, buf_cap: usize) {
    let bytes = s.as_bytes();
    let write = bytes.len().min(buf_cap);
    unsafe {
        std::ptr::copy_nonoverlapping(bytes.as_ptr(), out_buf, write);
        *out_len = write;
    }
}

// ── ABI implementations ───────────────────────────────────────────────────────

unsafe extern "C" fn ai_embed(
    _model_path: *const u8, _model_path_len: usize,
    text: *const u8, text_len: usize,
    out_buf: *mut u8, out_len: *mut usize, buf_cap: usize,
) -> i32 {
    let text = bytes_to_str(text, text_len).to_string();
    let result = (|| -> Result<String, String> {
        let mut g = EMBED_MODEL.lock();
        if g.is_none() {
            *g = Some(glyx_ai::EmbedModel::load().map_err(|e| e.to_string())?);
        }
        let vec = g.as_ref().unwrap().embed(&text).map_err(|e| e.to_string())?;
        serde_json::to_string(&vec).map_err(|e| e.to_string())
    })();
    match result {
        Ok(s)  => { write_result(&s, out_buf, out_len, buf_cap); 0 }
        Err(e) => { log::error!("[glyx-cap-ai] embed: {e}"); *out_len = 0; -1 }
    }
}

unsafe extern "C" fn ai_generate(
    _model_path: *const u8, _model_path_len: usize,
    prompt: *const u8, prompt_len: usize,
    opts_json: *const u8, opts_json_len: usize,
    out_buf: *mut u8, out_len: *mut usize, buf_cap: usize,
) -> i32 {
    let prompt   = bytes_to_str(prompt, prompt_len).to_string();
    let opts_raw = bytes_to_str(opts_json, opts_json_len);
    let opts = serde_json::from_str::<serde_json::Value>(opts_raw).unwrap_or_default();
    let max_tokens:  usize = opts.get("maxTokens").and_then(|v| v.as_u64()).unwrap_or(200) as usize;
    let temperature: f32   = opts.get("temperature").and_then(|v| v.as_f64()).unwrap_or(0.7) as f32;

    let result = (|| -> Result<String, String> {
        let mut g = GENERATE_MODEL.lock();
        if g.is_none() {
            *g = Some(glyx_ai::GenerateModel::load().map_err(|e| e.to_string())?);
        }
        g.as_mut().unwrap().generate(&prompt, max_tokens, temperature).map_err(|e| e.to_string())
    })();
    match result {
        Ok(s)  => { write_result(&s, out_buf, out_len, buf_cap); 0 }
        Err(e) => { log::error!("[glyx-cap-ai] generate: {e}"); *out_len = 0; -1 }
    }
}

unsafe extern "C" fn ai_transcribe(
    _model_path: *const u8, _model_path_len: usize,
    audio_path: *const u8, audio_path_len: usize,
    out_buf: *mut u8, out_len: *mut usize, buf_cap: usize,
) -> i32 {
    let audio_path = bytes_to_str(audio_path, audio_path_len).to_string();
    let result = (|| -> Result<String, String> {
        let mut g = WHISPER_MODEL.lock();
        if g.is_none() {
            *g = Some(glyx_ai::WhisperModel::load().map_err(|e| e.to_string())?);
        }
        g.as_mut().unwrap().transcribe(&audio_path, "").map_err(|e| e.to_string())
    })();
    match result {
        Ok(s)  => { write_result(&s, out_buf, out_len, buf_cap); 0 }
        Err(e) => { log::error!("[glyx-cap-ai] transcribe: {e}"); *out_len = 0; -1 }
    }
}

unsafe extern "C" fn ai_unload(kind: u8) {
    match kind {
        0 => { *EMBED_MODEL.lock()    = None; }
        1 => { *GENERATE_MODEL.lock() = None; }
        2 => { *WHISPER_MODEL.lock()  = None; }
        _ => {}
    }
}

unsafe extern "C" fn ai_shutdown() {
    *EMBED_MODEL.lock()    = None;
    *GENERATE_MODEL.lock() = None;
    *WHISPER_MODEL.lock()  = None;
}

// ── Static vtable ─────────────────────────────────────────────────────────────

static AI_CAP: AiCap = AiCap {
    version:    ABI_VERSION,
    embed:      ai_embed,
    generate:   ai_generate,
    transcribe: ai_transcribe,
    unload:     ai_unload,
    shutdown:   ai_shutdown,
};

pub fn static_cap() -> &'static AiCap {
    &AI_CAP
}

#[no_mangle]
pub extern "C" fn glyx_cap_ai() -> *const AiCap {
    &AI_CAP
}
