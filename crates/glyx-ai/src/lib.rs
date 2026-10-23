//! glyx-ai — Local AI inference for Glyx apps.
//!
//! Three capabilities, all CPU-first (CUDA/Metal can be enabled via features later):
//!
//! * [`EmbedModel`]   — 384-dim semantic embeddings via MiniLM-L6-v2 (~22 MB)
//! * [`GenerateModel`] — text generation via Phi-2 Q4_K_M GGUF (~1.7 GB)
//! * [`WhisperModel`]  — speech-to-text via Whisper-tiny (~75 MB)
//!
//! Models are downloaded from HuggingFace Hub on first use and cached in
//! `~/.cache/huggingface/`. All blocking I/O is intended to run inside
//! `tokio::task::spawn_blocking`.
//!
//! A loaded model is large (Phi-2 is ~1.7 GB in RAM), so the runtime keeps each one in a process-wide slot ([`shared_embed`] and friends):
//! every window of an app uses the same copy instead of loading its own.

pub mod audio;
pub mod embed;
pub(crate) mod idle;
pub mod generate;
pub mod whisper;

pub use embed::EmbedModel;
pub use generate::GenerateModel;
pub use whisper::WhisperModel;
pub use idle::{DEFAULT_IDLE_SECS, IDLE_ENV};

use std::sync::{Arc, OnceLock};

/// Whether this build of `glyx-ai` was compiled with AVX2 and FMA, which candle's quantized kernels (the ones `ai.generate` runs on)
/// pick at compile time. Without them they use scalar code: measured on an i7-8650U, 0.38 s per token against 0.13 s, and 8.2 s against
/// 2.2 s to read a 17-token prompt. The embedding and speech models use f32 matrix code that picks its SIMD at run time and are not affected.
/// Build with `RUSTFLAGS="-C target-feature=+avx2,+fma,+f16c"` for the fast path; the result then needs a CPU with AVX2 (most since 2013,
/// but not the Pentium and Celeron parts that have it disabled).
pub const BUILT_WITH_AVX2: bool = cfg!(all(target_arch = "x86_64", target_feature = "avx2", target_feature = "fma"));

/// Say once, in the log, that generation is running the slow path on a CPU that could run the fast one.
pub(crate) fn warn_if_slow_build() {
    #[cfg(target_arch = "x86_64")]
    {
        static ONCE: std::sync::Once = std::sync::Once::new();
        ONCE.call_once(|| {
            if !BUILT_WITH_AVX2 && std::is_x86_feature_detected!("avx2") && std::is_x86_feature_detected!("fma") {
                log::warn!(
                    "[ai] this build was compiled without AVX2, so ai.generate runs about 3x slower than this CPU allows. \
                     Build with RUSTFLAGS=\"-C target-feature=+avx2,+fma,+f16c\" (needs an AVX2 CPU) for the fast path."
                );
            }
        });
    }
}

/// Where a loaded model lives. `None` until the first use, and again after an unload.
pub type Slot<T> = Arc<parking_lot::Mutex<Option<T>>>;

macro_rules! shared_slot {
    ($(#[$doc:meta])* $name:ident, $model:ty) => {
        $(#[$doc])*
        pub fn $name() -> Slot<$model> {
            static SLOT: OnceLock<Slot<$model>> = OnceLock::new();
            Arc::clone(SLOT.get_or_init(|| Arc::new(parking_lot::Mutex::new(None))))
        }
    };
}

shared_slot!(/** The process-wide slot for the embedding model. */ shared_embed, EmbedModel);
shared_slot!(/** The process-wide slot for the text-generation model. */ shared_generate, GenerateModel);
shared_slot!(/** The process-wide slot for the speech-to-text model. */ shared_whisper, WhisperModel);

/// Empty a slot without waiting for it: a model that is mid-generation holds its lock for seconds, and the caller is often the thread
/// that draws the window. The model is freed as soon as the lock comes free.
pub fn unload<T: Send + 'static>(slot: &Slot<T>) {
    let freed_now = match slot.try_lock() {
        Some(mut guard) => { *guard = None; true }
        None => false,
    };
    if !freed_now {
        let slot = Arc::clone(slot);
        std::thread::spawn(move || *slot.lock() = None);
    }
}
