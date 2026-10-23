//! Text generation via quantized Phi-2 (GGUF Q4_K_M, ~1.7 GB).
//!
//! Model weights are downloaded from HuggingFace Hub on first use.
//! Generation runs entirely on CPU via candle quantized inference.

use anyhow::{Context, Result};
use candle_core::{Device, Tensor};
use candle_transformers::models::quantized_phi as phi;
use tokenizers::Tokenizer;

// We use TheBloke's Phi-2 GGUF repo because the official microsoft/phi-2 repo
// does not publish GGUF files.
const REPO_ID: &str   = "TheBloke/phi-2-GGUF";
const GGUF_FILE: &str  = "phi-2.Q4_K_M.gguf";
// Tokenizer lives in the base model repo.
const TOK_REPO: &str  = "microsoft/phi-2";

// F2: SHA-256 of the pinned GGUF.  A MITM/compromised mirror would produce a
// different hash and be rejected before the file reaches Candle's parser.
// Update this constant whenever the model is intentionally upgraded.
// It is the `lfs.oid` that https://huggingface.co/api/models/TheBloke/phi-2-GGUF/tree/main lists for the file (1,789,239,136 bytes).
const GGUF_SHA256: &str =
    "324356668fa5ba9f4135de348447bb2bbe2467eaa1b8fcfb53719de62fbd2499";

/// Phi-2's context window: the prompt and the reply together must fit.
const CONTEXT_TOKENS: usize = 2048;

/// Sampling keeps the most likely `TOP_K` tokens, then the smallest set of those holding `TOP_P` of the probability.
const TOP_K: usize = 40;
const TOP_P: f32 = 0.95;

/// Tokens seen in the last `REPEAT_WINDOW` are made less likely when sampling (`REPEAT_PENALTY` > 1), which stops the small model looping.
const REPEAT_PENALTY: f32 = 1.1;
const REPEAT_WINDOW: usize = 64;

/// Phi-2 GGUF quantized model for CPU text generation.
pub struct GenerateModel {
    weights:   phi::ModelWeights,
    tokenizer: Tokenizer,
    device:    Device,
    eos_token: u32,
    rng:       Rng,
}

impl GenerateModel {
    /// Download (first time) and load Phi-2 Q4_K_M from HuggingFace Hub.
    ///
    /// Large download (~1.7 GB) on first use; subsequent calls use cached file.
    /// Run from `spawn_blocking`.
    pub fn load() -> Result<Self> {
        let device = Device::Cpu;
        crate::warn_if_slow_build();
        let api    = hf_hub::api::sync::Api::new()
            .context("hf-hub Api::new")?;

        log::info!("[ai] downloading/loading generate model ({REPO_ID})…");

        // GGUF weights
        let gguf_path = api.model(REPO_ID.to_string())
            .get(GGUF_FILE)
            .with_context(|| format!("downloading {GGUF_FILE}"))?;

        // F2: Verify GGUF SHA-256 before passing to Candle's parser.
        verify_sha256(&gguf_path)?;

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
        Ok(Self { weights, tokenizer, device, eos_token, rng: Rng::from_clock() })
    }

    /// Generate text from `prompt`.
    ///
    /// - `max_tokens`: upper bound on tokens to generate.
    /// - `temperature`: sampling temperature (0.0 = greedy, 1.0 = random).
    pub fn generate(&mut self, prompt: &str, max_tokens: usize, temperature: f32) -> Result<String> {
        self.generate_stream(prompt, max_tokens, temperature, |_| true)
    }

    /// Like [`generate`](Self::generate), but `on_text` is called with each new piece of text as soon as it is complete (never half a
    /// character). Return `false` from it to stop early; the text so far is returned either way.
    pub fn generate_stream(
        &mut self,
        prompt: &str,
        max_tokens: usize,
        temperature: f32,
        mut on_text: impl FnMut(&str) -> bool,
    ) -> Result<String> {
        let _in_use = crate::idle::in_use(crate::idle::Kind::Generate);
        let enc = self.tokenizer
            .encode(prompt, true)
            .map_err(|e| anyhow::anyhow!("tokenize: {e}"))?;
        let prompt_ids: Vec<u32> = enc.get_ids().to_vec();
        let prompt_len = prompt_ids.len();
        if prompt_len == 0 {
            anyhow::bail!("ai.generate: the prompt is empty");
        }
        if prompt_len >= CONTEXT_TOKENS {
            anyhow::bail!("ai.generate: the prompt is {prompt_len} tokens; the model holds {CONTEXT_TOKENS} for the prompt and the reply together");
        }
        let max_tokens = max_tokens.min(CONTEXT_TOKENS - prompt_len);

        // The whole prompt in one pass (position 0 also clears the previous call's cache). The result is the last position's logits,
        // which is where the first new token comes from.
        let input = Tensor::new(prompt_ids.as_slice(), &self.device)?.unsqueeze(0)?;
        let mut logits = self.weights.forward(&input, 0)?.squeeze(0)?.to_vec1::<f32>()?;

        let mut seen = prompt_ids;
        let mut output_ids: Vec<u32> = Vec::with_capacity(max_tokens);
        let mut emitted = 0usize; // bytes of the decoded text already handed to `on_text`
        for step in 0..max_tokens {
            let sampled = if temperature < 1e-6 {
                argmax_f32(&logits)?
            } else {
                let from = seen.len().saturating_sub(REPEAT_WINDOW);
                self.rng.sample(&mut logits, temperature, &seen[from..])
            };
            if sampled == self.eos_token { break; }
            output_ids.push(sampled);
            seen.push(sampled);

            // Hand out the text that is complete: a token can end in the middle of a multi-byte character, which decodes to U+FFFD.
            let text = self.tokenizer.decode(&output_ids, true).map_err(|e| anyhow::anyhow!("decode: {e}"))?;
            if !text.ends_with('\u{FFFD}') && text.len() > emitted {
                let keep_going = on_text(&text[emitted..]);
                emitted = text.len();
                if !keep_going { return Ok(text); }
            }

            if step + 1 == max_tokens { break; }
            let input = Tensor::new(&[sampled], &self.device)?.unsqueeze(0)?;
            logits = self.weights.forward(&input, prompt_len + step)?.squeeze(0)?.to_vec1::<f32>()?;
        }

        let text = self.tokenizer
            .decode(&output_ids, true)
            .map_err(|e| anyhow::anyhow!("decode: {e}"))?;
        if text.len() > emitted { on_text(&text[emitted..]); }
        Ok(text)
    }
}

/// Check the cached file against the pinned hash without holding it in memory, and remember a pass (keyed by the file's size and
/// modification time) so the 1.7 GB are not read again on every load. A mismatch deletes the file so the next run downloads it afresh.
fn verify_sha256(path: &std::path::Path) -> Result<()> {
    use sha2::Digest;
    use std::io::Read;

    let stamp = std::fs::metadata(path).ok().map(|m| {
        let modified = m.modified().ok().and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok()).map_or(0, |d| d.as_nanos());
        format!("{GGUF_SHA256}:{}:{modified}", m.len())
    });
    let marker = path.with_file_name(format!("{GGUF_FILE}.verified"));
    if let Some(stamp) = &stamp {
        if std::fs::read_to_string(&marker).is_ok_and(|saved| &saved == stamp) { return Ok(()); }
    }

    let mut file = std::fs::File::open(path).with_context(|| format!("reading {GGUF_FILE} for integrity check"))?;
    let mut hasher = sha2::Sha256::new();
    let mut buf = vec![0u8; 1 << 20];
    loop {
        let n = file.read(&mut buf).with_context(|| format!("reading {GGUF_FILE} for integrity check"))?;
        if n == 0 { break; }
        hasher.update(&buf[..n]);
    }
    let actual = format!("{:x}", hasher.finalize());
    if actual != GGUF_SHA256 {
        // Delete the corrupt cache (the link and the file it points at) so a re-run triggers a fresh download.
        let real = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
        let _ = std::fs::remove_file(path);
        let _ = std::fs::remove_file(real);
        anyhow::bail!(
            "ai.generate: SHA-256 mismatch for {GGUF_FILE}\n  \
             expected: {GGUF_SHA256}\n  actual:   {actual}\n  \
             Cached file deleted -- restart to re-download."
        );
    }
    if let Some(stamp) = stamp { let _ = std::fs::write(&marker, stamp); }
    Ok(())
}

fn argmax_f32(v: &[f32]) -> Result<u32> {
    v.iter()
        .enumerate()
        .max_by(|a, b| a.1.partial_cmp(b.1).unwrap_or(std::cmp::Ordering::Equal))
        .map(|(i, _)| i as u32)
        .ok_or_else(|| anyhow::anyhow!("empty logit vector"))
}

/// xorshift64*: a small, fast generator whose state advances on every draw (the old code used the clock's nanoseconds per draw, which
/// repeats and is correlated between calls).
struct Rng(u64);

impl Rng {
    fn from_clock() -> Self {
        let nanos = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap_or_default().as_nanos() as u64;
        Rng(nanos | 1)
    }

    /// A number in 0.0..1.0.
    fn next_f32(&mut self) -> f32 {
        self.0 ^= self.0 >> 12;
        self.0 ^= self.0 << 25;
        self.0 ^= self.0 >> 27;
        (self.0.wrapping_mul(0x2545_F491_4F6C_DD1D) >> 40) as f32 / (1u64 << 24) as f32
    }

    /// Pick a token: penalise `recent` ones, keep the `TOP_K` best, soften by `temperature`, cut to `TOP_P`, then draw.
    fn sample(&mut self, logits: &mut [f32], temperature: f32, recent: &[u32]) -> u32 {
        for &t in recent {
            if let Some(l) = logits.get_mut(t as usize) {
                *l = if *l >= 0.0 { *l / REPEAT_PENALTY } else { *l * REPEAT_PENALTY };
            }
        }
        let mut best: Vec<(u32, f32)> = logits.iter().enumerate().map(|(i, &l)| (i as u32, l)).collect();
        let k = TOP_K.min(best.len());
        best.select_nth_unstable_by(k - 1, |a, b| b.1.total_cmp(&a.1));
        best.truncate(k);
        best.sort_by(|a, b| b.1.total_cmp(&a.1));

        let top = best[0].1;
        let mut probs: Vec<f32> = best.iter().map(|&(_, l)| ((l - top) / temperature).exp()).collect();
        let total: f32 = probs.iter().sum();
        let mut kept = 0.0;
        let mut cut = probs.len();
        for (i, p) in probs.iter_mut().enumerate() {
            *p /= total;
            kept += *p;
            if kept >= TOP_P { cut = i + 1; break; }
        }
        let mass: f32 = probs[..cut].iter().sum();
        let mut draw = self.next_f32() * mass;
        for (i, p) in probs[..cut].iter().enumerate() {
            if draw < *p { return best[i].0; }
            draw -= p;
        }
        best[cut - 1].0
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn logits(n: usize, hot: &[(usize, f32)]) -> Vec<f32> {
        let mut v = vec![0.0; n];
        for &(i, l) in hot { v[i] = l; }
        v
    }

    #[test]
    fn a_dominant_token_is_always_drawn_and_the_tail_never_is() {
        let mut rng = Rng(12345);
        for _ in 0..200 {
            let mut l = logits(1000, &[(7, 30.0), (8, 5.0)]);
            assert_eq!(rng.sample(&mut l, 1.0, &[]), 7);
        }
    }

    #[test]
    fn a_hot_temperature_spreads_over_the_top_tokens_but_stays_inside_the_top_k() {
        let mut rng = Rng(99);
        let mut seen = std::collections::HashSet::new();
        for _ in 0..500 {
            // 60 equally likely tokens: only 40 can be drawn.
            let mut l = logits(1000, &(0..60).map(|i| (i, 10.0)).collect::<Vec<_>>());
            seen.insert(rng.sample(&mut l, 1.0, &[]));
        }
        assert!(seen.len() > 10, "drew only {} different tokens", seen.len());
        assert!(seen.iter().all(|&t| t < 60));
    }

    #[test]
    fn a_recent_token_is_penalised_enough_to_lose_a_near_tie() {
        let mut rng = Rng(5);
        // Token 1 is a hair ahead, but was just used: 10.2 / 1.1 = 9.27 < 10.
        for _ in 0..100 {
            let mut l = logits(100, &[(1, 10.2), (2, 10.0)]);
            let t = rng.sample(&mut l, 0.05, &[1]);
            assert_eq!(t, 2);
        }
    }

    #[test]
    fn the_generator_does_not_repeat_and_spans_the_unit_interval() {
        let mut rng = Rng(1);
        let draws: Vec<f32> = (0..10_000).map(|_| rng.next_f32()).collect();
        assert!(draws.iter().all(|d| (0.0..1.0).contains(d)));
        let mean = draws.iter().sum::<f32>() / draws.len() as f32;
        assert!((mean - 0.5).abs() < 0.02, "mean {mean}");
        assert!(draws.windows(2).all(|w| w[0] != w[1]));
    }

    #[test]
    fn the_pinned_hash_is_a_sha256_hex_string() {
        assert_eq!(GGUF_SHA256.len(), 64);
        assert!(GGUF_SHA256.bytes().all(|b| b.is_ascii_hexdigit()));
    }

    #[test]
    fn a_wrong_file_fails_the_check_and_is_removed_and_a_pass_is_remembered() {
        let dir = std::env::temp_dir().join(format!("glyx_ai_sha_{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let file = dir.join(GGUF_FILE);
        std::fs::write(&file, b"not a model").unwrap();
        let err = verify_sha256(&file).unwrap_err().to_string();
        assert!(err.contains("SHA-256 mismatch"), "{err}");
        assert!(!file.exists(), "the corrupt file should have been deleted");

        // A file that was verified is not read again: fake the marker for the file's current size and time.
        std::fs::write(&file, b"another").unwrap();
        let m = std::fs::metadata(&file).unwrap();
        let modified = m.modified().unwrap().duration_since(std::time::UNIX_EPOCH).unwrap().as_nanos();
        std::fs::write(dir.join(format!("{GGUF_FILE}.verified")), format!("{GGUF_SHA256}:{}:{modified}", m.len())).unwrap();
        verify_sha256(&file).expect("a remembered pass is trusted while size and time are unchanged");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
