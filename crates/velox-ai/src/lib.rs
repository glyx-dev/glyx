//! velox-ai — Local AI inference for Velox apps.
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

pub mod embed;
pub mod generate;
pub mod whisper;

pub use embed::EmbedModel;
pub use generate::GenerateModel;
pub use whisper::WhisperModel;
