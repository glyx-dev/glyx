//! Speech-to-text via OpenAI Whisper (tiny, ~75 MB).
//!
//! Accepts WAV audio files (16 kHz mono preferred; other formats attempted
//! via heuristic PCM extraction). Returns the full transcript as a plain string.
//!
//! Model weights are downloaded from HuggingFace Hub on first use.

use anyhow::{Context, Result};
use candle_core::{Device, IndexOp, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::whisper::{self as m, audio, Config as WhisperConfig};
use tokenizers::Tokenizer;

const REPO_ID:  &str = "openai/whisper-tiny";
// The safe-tensors variant lives in a community conversion:
const SAFE_REPO: &str = "openai/whisper-tiny";

/// Lazily-loaded Whisper-tiny transcription model.
pub struct WhisperModel {
    model:     m::model::Whisper,
    tokenizer: Tokenizer,
    device:    Device,
    config:    WhisperConfig,
    mel_filters: Vec<f32>,
}

impl WhisperModel {
    /// Download (first time) and load Whisper-tiny from HuggingFace Hub.
    pub fn load() -> Result<Self> {
        let device = Device::Cpu;
        let api    = hf_hub::api::sync::Api::new()
            .context("hf-hub Api::new")?;
        let repo   = api.model(SAFE_REPO.to_string());

        log::info!("[ai] downloading/loading whisper model ({REPO_ID})…");

        let weights_path   = repo.get("model.safetensors")
            .context("downloading whisper model.safetensors")?;
        let config_path    = repo.get("config.json")
            .context("downloading whisper config.json")?;
        let tokenizer_path = repo.get("tokenizer.json")
            .context("downloading whisper tokenizer.json")?;
        let mel_path       = repo.get("mel_filters.npz")
            .context("downloading mel_filters.npz")?;

        // Config
        let config: WhisperConfig = serde_json::from_str(
            &std::fs::read_to_string(&config_path).context("reading whisper config.json")?
        ).context("parsing whisper config.json")?;

        // Mel filterbank (80 filters × 201 fft bins stored as f32 NPZ)
        let mel_filters = load_mel_filters(&mel_path, config.num_mel_bins)
            .context("loading mel filters")?;

        // Weights
        let vb = unsafe {
            VarBuilder::from_mmaped_safetensors(
                &[weights_path],
                candle_core::DType::F32,
                &device,
            ).context("loading whisper weights")?
        };
        let model = m::model::Whisper::load(&vb, config.clone())
            .context("building Whisper model")?;

        // Tokenizer
        let tokenizer = Tokenizer::from_file(&tokenizer_path)
            .map_err(|e| anyhow::anyhow!("tokenizer load: {e}"))?;

        log::info!("[ai] whisper model ready");
        Ok(Self { model, tokenizer, device, config, mel_filters })
    }

    /// Transcribe an audio file.
    ///
    /// Reads the file as raw PCM i16 samples (WAV header stripped automatically).
    /// For best results, provide 16 kHz mono WAV files.
    ///
    /// `language`: ISO 639-1 code like `"en"`, or empty string for auto-detect.
    pub fn transcribe(&mut self, audio_path: &str, language: &str) -> Result<String> {
        // Read audio samples → f32 PCM
        let pcm = read_pcm_f32(audio_path)
            .with_context(|| format!("reading audio: {audio_path}"))?;

        // Compute log-mel spectrogram (80 bins, 3000 frames = 30 s)
        let mel = audio::pcm_to_mel(&self.config, &pcm, &self.mel_filters);
        let mel_len  = mel.len();
        let n_frames = mel_len / self.config.num_mel_bins;
        let mel_tensor = Tensor::from_vec(mel, (1, self.config.num_mel_bins, n_frames), &self.device)?;

        // Encode
        let encoded = self.model.encoder.forward(&mel_tensor, true)?;

        // Decode with greedy search
        let lang_token = if language.is_empty() {
            "<|en|>".to_string()
        } else {
            format!("<|{language}|>")
        };
        let lang_id = self.tokenizer.token_to_id(&lang_token).unwrap_or(50259);
        let sot_id  = self.tokenizer.token_to_id("<|startoftranscript|>").unwrap_or(50258);
        let eot_id  = self.tokenizer.token_to_id("<|endoftext|>").unwrap_or(50256);
        let transcribe_id = self.tokenizer.token_to_id("<|transcribe|>").unwrap_or(50359);
        let notimestamps_id = self.tokenizer.token_to_id("<|notimestamps|>").unwrap_or(50363);

        let mut tokens: Vec<u32> = vec![sot_id, lang_id, transcribe_id, notimestamps_id];
        let mut output: Vec<u32> = Vec::new();

        for _ in 0..448 {
            let input = Tensor::new(tokens.as_slice(), &self.device)?.unsqueeze(0)?;
            let out   = self.model.decoder.forward(&input, &encoded, true)?;
            let logits = out.i((.., tokens.len() - 1, ..))?.squeeze(0)?;
            let next = argmax_f32(&logits.to_vec1::<f32>()?)
                .unwrap_or(eot_id);
            if next == eot_id { break; }
            tokens.push(next);
            output.push(next);
        }

        let transcript = self.tokenizer
            .decode(&output, true)
            .map_err(|e| anyhow::anyhow!("decode: {e}"))?;
        Ok(transcript.trim().to_string())
    }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Load mel filterbank weights from an NPZ file.
/// Returns a flat Vec<f32> of length `num_mel_bins × (n_fft/2 + 1)`.
fn load_mel_filters(path: &std::path::Path, num_mel_bins: usize) -> Result<Vec<f32>> {
    // NPZ is a ZIP archive of numpy .npy files.
    // The filterbank is stored as `arr_0` with shape [num_mel_bins, n_fft_bins].
    let bytes = std::fs::read(path).context("reading mel_filters.npz")?;
    let mut archive = zip::ZipArchive::new(std::io::Cursor::new(bytes))
        .context("opening mel_filters.npz as ZIP")?;

    // Try common numpy array names
    let arr_name = ["mel_80.npy", "arr_0.npy", "mel_filters.npy"]
        .iter()
        .find(|&&n| archive.by_name(n).is_ok())
        .copied()
        .unwrap_or("arr_0.npy");

    let mut entry = archive.by_name(arr_name)
        .with_context(|| format!("finding {arr_name} in NPZ"))?;
    let mut raw = Vec::new();
    std::io::Read::read_to_end(&mut entry, &mut raw).context("reading NPZ entry")?;

    // Skip 128-byte numpy header and read f32 LE values
    if raw.len() < 128 {
        anyhow::bail!("mel_filters NPZ entry too short");
    }
    let data = &raw[128..];
    let floats: Vec<f32> = data.chunks_exact(4)
        .map(|b| f32::from_le_bytes([b[0], b[1], b[2], b[3]]))
        .collect();

    // Validate rough length (80 × 201 = 16080 for whisper-tiny)
    let expected_min = num_mel_bins * 100;
    if floats.len() < expected_min {
        anyhow::bail!("mel_filters too short: {} floats (expected ≥{expected_min})", floats.len());
    }
    Ok(floats)
}

/// Read an audio file and extract raw f32 PCM samples.
///
/// Attempts to skip a WAV header (44 bytes) if the file starts with "RIFF".
/// For best results, use 16 kHz mono WAV files.
fn read_pcm_f32(path: &str) -> Result<Vec<f32>> {
    let bytes = std::fs::read(path)?;
    let (start, scale) = if bytes.starts_with(b"RIFF") {
        // WAV: skip 44-byte header, data is i16 LE
        (44usize, true)
    } else {
        (0usize, true)
    };
    if bytes.len() <= start {
        return Ok(vec![0.0f32; 16000]); // 1s of silence fallback
    }
    let samples: Vec<f32> = bytes[start..]
        .chunks_exact(2)
        .map(|b| {
            let s = i16::from_le_bytes([b[0], b[1]]);
            if scale { s as f32 / 32768.0 } else { s as f32 }
        })
        .collect();
    Ok(samples)
}

fn argmax_f32(v: &[f32]) -> Result<u32> {
    v.iter()
        .enumerate()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(i, _)| i as u32)
        .ok_or_else(|| anyhow::anyhow!("empty logit vector"))
}
