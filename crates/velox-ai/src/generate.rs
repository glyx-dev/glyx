//! Text generation via quantized Phi-2 (GGUF Q4_K_M, ~1.7 GB).
//!
//! Model weights are downloaded from HuggingFace Hub on first use.
//! Generation runs entirely on CPU via candle quantized inference.
//!
//! Expect ~10-30 seconds per 200 tokens on a modern CPU.
//! For battery-aware throttling, pass `thread_count` from the caller.

use anyhow::{Context, Result};
use candle_core::{Device, Tensor};
use candle_transformers::models::quantized_phi as phi;
use tokenizers::Tokenizer;

// We use TheBloke's Phi-2 GGUF repo because the official microsoft/phi-2 repo
// does not publish GGUF files.
const REPO_ID: &str  = "TheBloke/phi-2-GGUF";
const GGUF_FILE: &str = "phi-2.Q4_K_M.gguf";
// Tokenizer lives in the base model repo.
const TOK_REPO: &str = "microsoft/phi-2";

/// Phi-2 GGUF quantized model for CPU text generation.
pub struct GenerateModel {
    weights:   phi::ModelWeights,
    tokenizer: Tokenizer,
    device:    Device,
    eos_token: u32,
}

impl GenerateModel {
    /// Download (first time) and load Phi-2 Q4_K_M from HuggingFace Hub.
    ///
    /// Large download (~1.7 GB) on first use; subsequent calls use cached file.
    /// Run from `spawn_blocking`.
    pub fn load() -> Result<Self> {
        let device = Device::Cpu;
        let api    = hf_hub::api::sync::Api::new()
            .context("hf-hub Api::new")?;

        log::info!("[ai] downloading/loading generate model ({REPO_ID})…");

        // GGUF weights
        let gguf_path = api.model(REPO_ID.to_string())
            .get(GGUF_FILE)
            .with_context(|| format!("downloading {GGUF_FILE}"))?;

        // Tokenizer from base model
        let tok_path = api.model(TOK_REPO.to_string())
            .get("tokenizer.json")
            .context("downloading phi-2 tokenizer.json")?;

        let tokenizer = Tokenizer::from_file(&tok_path)
            .map_err(|e| anyhow::anyhow!("tokenizer load: {e}"))?;

        // EOS token id
        let eos_token = tokenizer
            .token_to_id("<|endoftext|>")
            .unwrap_or(50256);

        // Load GGUF
        let mut file = std::fs::File::open(&gguf_path)
            .with_context(|| format!("opening {GGUF_FILE}"))?;
        let gguf = candle_core::quantized::gguf_file::Content::read(&mut file)
            .context("reading GGUF file")?;
        let weights = phi::ModelWeights::from_gguf(gguf, &mut file, &device)
            .context("building ModelWeights from GGUF")?;

        log::info!("[ai] generate model ready");
        Ok(Self { weights, tokenizer, device, eos_token })
    }

    /// Generate text from `prompt`.
    ///
    /// - `max_tokens`: upper bound on tokens to generate.
    /// - `temperature`: sampling temperature (0.0 = greedy, 1.0 = random).
    pub fn generate(&mut self, prompt: &str, max_tokens: usize, temperature: f32) -> Result<String> {
        let enc = self.tokenizer
            .encode(prompt, true)
            .map_err(|e| anyhow::anyhow!("tokenize: {e}"))?;
        let prompt_ids: Vec<u32> = enc.get_ids().to_vec();
        let prompt_len = prompt_ids.len();

        // Prime the KV cache by running all prompt tokens.
        // We feed them one at a time; this is slightly slower but avoids
        // building a batch tensor whose type depends on candle version.
        for (pos, &tok) in prompt_ids.iter().enumerate() {
            let input = Tensor::new(&[tok], &self.device)?;
            self.weights.forward(&input, pos)?;
        }

        // Autoregressive generation
        let mut output_ids: Vec<u32> = Vec::with_capacity(max_tokens);
        let mut next_tok = *prompt_ids.last().unwrap_or(&0);

        for step in 0..max_tokens {
            let input  = Tensor::new(&[next_tok], &self.device)?;
            let logits = self.weights.forward(&input, prompt_len + step)?;
            // logits shape: [1, vocab_size] or [vocab_size]
            let logits  = logits.squeeze(0)?;
            let sampled = if temperature < 1e-6 {
                // Greedy
                argmax_f32(&logits.to_vec1::<f32>()?)?
            } else {
                temperature_sample(&logits.to_vec1::<f32>()?, temperature)?
            };
            if sampled == self.eos_token { break; }
            output_ids.push(sampled);
            next_tok = sampled;
        }

        let text = self.tokenizer
            .decode(&output_ids, true)
            .map_err(|e| anyhow::anyhow!("decode: {e}"))?;
        Ok(text)
    }
}

fn argmax_f32(v: &[f32]) -> Result<u32> {
    v.iter()
        .enumerate()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(i, _)| i as u32)
        .ok_or_else(|| anyhow::anyhow!("empty logit vector"))
}

fn temperature_sample(logits: &[f32], temperature: f32) -> Result<u32> {
    // Softmax with temperature then sample
    let max = logits.iter().cloned().fold(f32::NEG_INFINITY, f32::max);
    let exp: Vec<f64> = logits.iter()
        .map(|&x| ((x - max) as f64 / temperature as f64).exp())
        .collect();
    let sum: f64 = exp.iter().sum();
    let probs: Vec<f64> = exp.iter().map(|&e| e / sum).collect();

    // Simple weighted selection using a pseudo-random f64 based on process time.
    let rand_val: f64 = {
        let t = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .subsec_nanos() as f64 / 1_000_000_000.0;
        // Cheap LCG-style scramble
        (t * 6364136223846793005.0).fract().abs()
    };

    let mut cumul = 0.0f64;
    for (i, &p) in probs.iter().enumerate() {
        cumul += p;
        if rand_val < cumul {
            return Ok(i as u32);
        }
    }
    Ok((probs.len() - 1) as u32)
}
