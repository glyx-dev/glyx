//! Text embedding via sentence-transformers/all-MiniLM-L6-v2.
//!
//! Produces 384-dimensional unit-normalised float32 vectors suitable for
//! cosine-similarity search — the same semantic space as the notes-app vectorDb.
//!
//! Model weights (~22 MB) are downloaded to the HuggingFace cache
//! (~/.cache/huggingface/) on first use and reused on subsequent calls.

use anyhow::{Context, Result};
use candle_core::{Device, Tensor};
use candle_nn::VarBuilder;
use candle_transformers::models::bert::{BertModel, Config as BertConfig};
use tokenizers::Tokenizer;

const REPO_ID: &str = "sentence-transformers/all-MiniLM-L6-v2";

/// Lazily-loaded BERT embedding model.
pub struct EmbedModel {
    model:     BertModel,
    tokenizer: Tokenizer,
    device:    Device,
}

impl EmbedModel {
    /// Download (first time) and load the MiniLM-L6-v2 model from HuggingFace Hub.
    ///
    /// Subsequent calls reuse the cached weights in `~/.cache/huggingface/`.
    /// This function runs synchronously and should be called from `spawn_blocking`.
    pub fn load() -> Result<Self> {
        let device = Device::Cpu;

        let api  = hf_hub::api::sync::Api::new()
            .context("hf-hub Api::new")?;
        let repo = api.model(REPO_ID.to_string());

        log::info!("[ai] downloading/loading embed model ({REPO_ID})…");

        let weights_path   = repo.get("model.safetensors")
            .context("downloading model.safetensors")?;
        let config_path    = repo.get("config.json")
            .context("downloading config.json")?;
        let tokenizer_path = repo.get("tokenizer.json")
            .context("downloading tokenizer.json")?;

        // Config
        let config_str = std::fs::read_to_string(&config_path)
            .context("reading config.json")?;
        let config: BertConfig = serde_json::from_str(&config_str)
            .context("parsing config.json")?;

        // Weights
        let vb = unsafe {
            VarBuilder::from_mmaped_safetensors(
                &[weights_path],
                candle_core::DType::F32,
                &device,
            ).context("loading safetensors weights")?
        };

        let model = BertModel::load(vb, &config)
            .context("building BertModel")?;

        // Tokenizer
        let tokenizer = Tokenizer::from_file(&tokenizer_path)
            .map_err(|e| anyhow::anyhow!("tokenizer load: {e}"))?;

        log::info!("[ai] embed model ready");
        Ok(Self { model, tokenizer, device })
    }

    /// Embed a single text string into a 384-dim unit-normalised vector.
    pub fn embed(&self, text: &str) -> Result<Vec<f32>> {
        // Tokenise
        let encoding = self.tokenizer
            .encode(text, true)
            .map_err(|e| anyhow::anyhow!("tokenize: {e}"))?;

        let ids: Vec<u32> = encoding.get_ids().to_vec();
        if ids.is_empty() {
            return Ok(vec![0.0f32; 384]);
        }

        let token_ids   = Tensor::new(ids.as_slice(), &self.device)?.unsqueeze(0)?;
        let token_types = token_ids.zeros_like()?;

        // Forward pass (no attention mask for short texts)
        let out = self.model.forward(&token_ids, &token_types, None)?;

        // Mean pool over sequence dimension
        let (_, seq_len, _) = out.dims3()?;
        let pooled = (out.sum(1)? / (seq_len as f64))?;

        // L2 normalise
        let norm = pooled.sqr()?.sum_all()?.sqrt()?.to_scalar::<f32>()?;
        let norm = if norm == 0.0 { 1.0 } else { norm };
        let normalised = (pooled / norm as f64)?;

        Ok(normalised.squeeze(0)?.to_vec1::<f32>()?)
    }
}
