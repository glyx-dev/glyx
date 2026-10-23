//! Text generation as a stream: `glyx_stream.generate` runs the local model on a blocking thread and the text arrives, piece by piece, as
//! the chunks of a registry reader (see `streams.rs`), so a slow answer shows its first words after a token or two instead of at the end.
//!
//! Two ways to reach the model, as for the other `ai` calls: compiled in (feature `ai`, the shared `glyx-ai` slot), or through the loaded
//! `glyx_cap_ai` module, whose ABI 3 has `generate_stream`. A module built for ABI 2 cannot stream; the command says so.

/// The arguments of `glyx_stream.generate`.
#[derive(serde::Deserialize)]
pub(crate) struct GenerateArgs {
    pub prompt: String,
    #[serde(rename = "maxTokens")]
    pub max_tokens: Option<usize>,
    pub temperature: Option<f32>,
}

/// Whether there is a model to generate with, as an error message when there is not. Checked when the stream opens, so the caller hears
/// at once instead of from the first read.
pub(crate) fn available() -> Result<(), String> {
    #[cfg(feature = "ai")]
    { Ok(()) }
    #[cfg(not(feature = "ai"))]
    {
        match crate::cap_loader::ai_cap() {
            None => Err("ai capability not loaded".to_string()),
            Some(cap) if !cap.has_streaming() => Err(format!(
                "this ai module is ABI {} and cannot stream; update glyx_cap_ai (streaming needs ABI 3)", cap.version
            )),
            Some(_) => Ok(()),
        }
    }
}

/// Generate on this thread (it blocks for the whole answer), calling `on_text` with each piece of text as soon as it is complete.
/// `on_text` returns `false` to stop; that is not an error.
#[cfg(feature = "ai")]
pub(crate) fn generate_into(args: &GenerateArgs, on_text: &mut dyn FnMut(&str) -> bool) -> Result<(), String> {
    let slot = glyx_ai::shared_generate();
    let mut model = slot.lock();
    if model.is_none() {
        // R3: block download unless aiModelDownload capability is declared.
        if !glyx_security::get().can_ai_download() {
            return Err("ai.generate: model not cached and 'aiModelDownload' capability is not declared. \
                Add \"aiModelDownload\": true to glyx.config capabilities to permit downloads.".into());
        }
        *model = Some(glyx_ai::GenerateModel::load().map_err(|e| format!("ai.generate model load: {e}"))?);
    }
    model.as_mut().expect("just loaded")
        .generate_stream(&args.prompt, args.max_tokens.unwrap_or(200), args.temperature.unwrap_or(0.7), |piece| on_text(piece))
        .map(|_| ())
        .map_err(|e| format!("ai.generate: {e}"))
}

#[cfg(not(feature = "ai"))]
pub(crate) fn generate_into(args: &GenerateArgs, on_text: &mut dyn FnMut(&str) -> bool) -> Result<(), String> {
    use std::ffi::c_void;

    // Called by the module for each piece; `user` is the `&mut dyn FnMut` below.
    unsafe extern "C" fn piece(user: *mut c_void, text: *const u8, len: usize) -> i32 {
        let on_text = &mut *(user as *mut &mut dyn FnMut(&str) -> bool);
        let text = std::str::from_utf8(std::slice::from_raw_parts(text, len)).unwrap_or("");
        if on_text(text) { 0 } else { 1 }
    }

    available()?;
    let cap = crate::cap_loader::ai_cap().expect("available() checked");
    let opts = serde_json::json!({ "maxTokens": args.max_tokens.unwrap_or(200), "temperature": args.temperature.unwrap_or(0.7) }).to_string();
    let mut err = vec![0u8; 4096];
    let mut err_len = 0usize;
    let mut callback: &mut dyn FnMut(&str) -> bool = on_text;
    let rc = unsafe {
        (cap.generate_stream)(
            args.prompt.as_ptr(), args.prompt.len(),
            opts.as_ptr(), opts.len(),
            piece, &mut callback as *mut &mut dyn FnMut(&str) -> bool as *mut c_void,
            err.as_mut_ptr(), &mut err_len, err.len(),
        )
    };
    if rc != 0 {
        return Err(format!("ai.generate: {}", String::from_utf8_lossy(&err[..err_len.min(err.len())])));
    }
    Ok(())
}
