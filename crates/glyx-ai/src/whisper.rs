//! Speech-to-text via OpenAI Whisper (tiny, ~75 MB).
//!
//! Reads WAV, MP3, FLAC and OGG files (see [`crate::audio`]: any channel count and sample rate, mixed down to mono and resampled to
//! 16 kHz) and returns the transcript as a plain string. Audio longer than 30 s is transcribed in consecutive 30 s windows and joined;
//! the file is decoded window by window, so a long recording does not have to fit in memory.
//!
//! Model weights are downloaded from HuggingFace Hub on first use. The mel filterbank is computed here (the repository does not ship one).

use anyhow::{Context, Result};
use candle_core::{Device, IndexOp, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::whisper::{self as m, audio, Config as WhisperConfig};
use tokenizers::Tokenizer;

use crate::audio::Windows;

const REPO_ID: &str = "openai/whisper-tiny";

/// Tokens decoded per 30 s window at most (half the decoder's 448 positions, as the reference implementation does).
const MAX_NEW_TOKENS: usize = 224;

/// A window quieter than this (peak amplitude, full scale = 1.0) is silence: skipped instead of fed to the model, which would invent words.
const SILENCE_PEAK: f32 = 0.002;

/// Lazily-loaded Whisper-tiny transcription model.
pub struct WhisperModel {
    model:       m::model::Whisper,
    tokenizer:   Tokenizer,
    device:      Device,
    config:      WhisperConfig,
    mel_filters: Vec<f32>,
}

impl WhisperModel {
    /// Download (first time) and load Whisper-tiny from HuggingFace Hub.
    pub fn load() -> Result<Self> {
        let device = Device::Cpu;
        let api    = hf_hub::api::sync::Api::new()
            .context("hf-hub Api::new")?;
        let repo   = api.model(REPO_ID.to_string());

        log::info!("[ai] downloading/loading whisper model ({REPO_ID})…");

        let weights_path   = repo.get("model.safetensors")
            .context("downloading whisper model.safetensors")?;
        let config_path    = repo.get("config.json")
            .context("downloading whisper config.json")?;
        let tokenizer_path = repo.get("tokenizer.json")
            .context("downloading whisper tokenizer.json")?;

        let config: WhisperConfig = serde_json::from_str(
            &std::fs::read_to_string(&config_path).context("reading whisper config.json")?
        ).context("parsing whisper config.json")?;

        let mel_filters = mel_filterbank(config.num_mel_bins, m::N_FFT, m::SAMPLE_RATE);

        let vb = unsafe {
            VarBuilder::from_mmaped_safetensors(
                &[weights_path],
                candle_core::DType::F32,
                &device,
            ).context("loading whisper weights")?
        };
        let model = m::model::Whisper::load(&vb, config.clone())
            .context("building Whisper model")?;

        let tokenizer = Tokenizer::from_file(&tokenizer_path)
            .map_err(|e| anyhow::anyhow!("tokenizer load: {e}"))?;

        log::info!("[ai] whisper model ready");
        Ok(Self { model, tokenizer, device, config, mel_filters })
    }

    /// Transcribe an audio file (WAV, MP3, FLAC or OGG).
    ///
    /// `language`: ISO 639-1 code like `"en"`, or empty string to detect it from the first 30 s.
    pub fn transcribe(&mut self, audio_path: &str, language: &str) -> Result<String> {
        let _in_use = crate::idle::in_use(crate::idle::Kind::Whisper);
        let mut windows = Windows::open(audio_path)
            .with_context(|| format!("reading audio: {audio_path}"))?;

        let token = |s: &str| self.tokenizer.token_to_id(s);
        let sot_id  = token(m::SOT_TOKEN).context("tokenizer has no <|startoftranscript|>")?;
        let eot_id  = token(m::EOT_TOKEN).context("tokenizer has no <|endoftext|>")?;
        let transcribe_id   = token(m::TRANSCRIBE_TOKEN).context("tokenizer has no <|transcribe|>")?;
        let notimestamps_id = token(m::NO_TIMESTAMPS_TOKEN).context("tokenizer has no <|notimestamps|>")?;
        let mut lang_id = if language.is_empty() {
            None
        } else {
            Some(token(&format!("<|{language}|>")).with_context(|| format!("unknown language code {language:?}"))?)
        };

        // Tokens never produced: the config's list, plus every special token after <|endoftext|> (timestamps, languages, tasks).
        let mut suppress = vec![false; self.config.vocab_size];
        for &t in &self.config.suppress_tokens { if let Some(s) = suppress.get_mut(t as usize) { *s = true; } }
        for s in suppress.iter_mut().skip(eot_id as usize + 1) { *s = true; }

        let mut text = String::new();
        while let Some(window) = windows.next_window().with_context(|| format!("reading audio: {audio_path}"))? {
            if window.iter().fold(0f32, |peak, s| peak.max(s.abs())) < SILENCE_PEAK { continue; }

            // Log-mel spectrogram. candle pads the audio with silence, so there are always at least 3000 frames: keep exactly one window.
            let mel = audio::pcm_to_mel(&self.config, &window, &self.mel_filters);
            let bins = self.config.num_mel_bins;
            let frames = mel.len() / bins;
            let mel = Tensor::from_vec(mel, (1, bins, frames), &self.device)?.narrow(2, 0, m::N_FRAMES)?;
            let encoded = self.model.encoder.forward(&mel, true)?;

            // The language is detected once, on the first window with sound, then kept for the rest.
            let lang = match lang_id {
                Some(l) => l,
                None => {
                    let l = self.detect_language(&encoded, sot_id)?;
                    lang_id = Some(l);
                    l
                }
            };

            let mut tokens: Vec<u32> = vec![sot_id, lang, transcribe_id, notimestamps_id];
            let prompt_len = tokens.len();
            for step in 0..MAX_NEW_TOKENS {
                let next = self.next_token(&tokens, &encoded, step == 0, &suppress)?;
                if next == eot_id { break; }
                tokens.push(next);
            }
            let piece = self.tokenizer
                .decode(&tokens[prompt_len..], true)
                .map_err(|e| anyhow::anyhow!("decode: {e}"))?;
            let piece = piece.trim();
            if !piece.is_empty() {
                if !text.is_empty() { text.push(' '); }
                text.push_str(piece);
            }
        }
        Ok(text)
    }

    /// The most likely token after `tokens` (greedy), skipping the suppressed ones. `first` renews the encoder-side cache for a new window.
    fn next_token(&mut self, tokens: &[u32], encoded: &Tensor, first: bool, suppress: &[bool]) -> Result<u32> {
        let input = Tensor::new(tokens, &self.device)?.unsqueeze(0)?;
        let hidden = self.model.decoder.forward(&input, encoded, first)?;
        let (_, len, _) = hidden.dims3()?;
        let logits = self.model.decoder.final_linear(&hidden.narrow(1, len - 1, 1)?)?.i(0)?.i(0)?.to_vec1::<f32>()?;
        argmax(logits.iter().enumerate().filter(|(i, _)| !suppress[*i]).map(|(i, &v)| (i as u32, v)))
    }

    /// The language Whisper hears: the most likely language token right after `<|startoftranscript|>`.
    fn detect_language(&mut self, encoded: &Tensor, sot_id: u32) -> Result<u32> {
        let input = Tensor::new(&[sot_id], &self.device)?.unsqueeze(0)?;
        let hidden = self.model.decoder.forward(&input, encoded, true)?;
        let logits = self.model.decoder.final_linear(&hidden.narrow(1, 0, 1)?)?.i(0)?.i(0)?.to_vec1::<f32>()?;
        // The 99 language tokens follow <|startoftranscript|> directly.
        let languages = (sot_id + 1)..=(sot_id + 99);
        argmax(languages.map(|t| (t, logits[t as usize])))
    }
}

fn argmax(candidates: impl Iterator<Item = (u32, f32)>) -> Result<u32> {
    candidates
        .max_by(|a, b| a.1.partial_cmp(&b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(i, _)| i)
        .ok_or_else(|| anyhow::anyhow!("no candidate tokens"))
}

// ── Mel filterbank ───────────────────────────────────────────────────────────

/// The Slaney-scale, Slaney-normalised mel filterbank Whisper was trained with (librosa's `mel(sr, n_fft, n_mels)`), as a flat
/// `n_mels × (n_fft / 2 + 1)` row-major matrix.
fn mel_filterbank(n_mels: usize, n_fft: usize, sample_rate: usize) -> Vec<f32> {
    let hz_to_mel = |f: f64| if f < 1000.0 { f * 3.0 / 200.0 } else { 15.0 + (f / 1000.0).ln() / (6.4f64.ln() / 27.0) };
    let mel_to_hz = |m: f64| if m < 15.0 { m * 200.0 / 3.0 } else { 1000.0 * ((m - 15.0) * (6.4f64.ln() / 27.0)).exp() };

    let bins = n_fft / 2 + 1;
    let (lo, hi) = (hz_to_mel(0.0), hz_to_mel(sample_rate as f64 / 2.0));
    let edges: Vec<f64> = (0..n_mels + 2).map(|i| mel_to_hz(lo + (hi - lo) * i as f64 / (n_mels + 1) as f64)).collect();
    let fft_freqs: Vec<f64> = (0..bins).map(|k| k as f64 * sample_rate as f64 / n_fft as f64).collect();

    let mut out = vec![0f32; n_mels * bins];
    for i in 0..n_mels {
        let (left, centre, right) = (edges[i], edges[i + 1], edges[i + 2]);
        let norm = 2.0 / (right - left);
        for (k, &f) in fft_freqs.iter().enumerate() {
            let rise = (f - left) / (centre - left);
            let fall = (right - f) / (right - centre);
            out[i * bins + k] = (rise.min(fall).max(0.0) * norm) as f32;
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_mel_filterbank_matches_librosa() {
        let f = mel_filterbank(80, 400, 16000);
        assert_eq!(f.len(), 80 * 201);
        // librosa.filters.mel(sr=16000, n_fft=400, n_mels=80): first filter peaks at bin 1 (weight 0.0249), the last reaches bin 200 (7.9 kHz).
        let row = |i: usize| &f[i * 201..(i + 1) * 201];
        let peak = |r: &[f32]| r.iter().cloned().fold(0f32, f32::max);
        assert!((peak(row(0)) - 0.0249).abs() < 0.001, "first filter peak {}", peak(row(0)));
        assert!(row(79)[190..].iter().any(|&w| w > 0.0));
        assert!(f.iter().all(|w| *w >= 0.0));
        // Every filter has weight somewhere and the filters tile the spectrum (every bin from 1 to 200 is covered).
        assert!((0..80).all(|i| peak(row(i)) > 0.0));
        assert!((1..200).all(|k| (0..80).any(|i| row(i)[k] > 0.0)));
    }
}
