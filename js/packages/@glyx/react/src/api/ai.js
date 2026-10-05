// @glyx-dev/react — local AI (Candle) — embed/generate/transcribe.

// ── Local AI (Candle) ─────────────────────────────────────────────────────────
//
// Capability gate: `ai: true` in glyx.config.json.
//
// Models are downloaded from HuggingFace Hub on first call and cached in
// ~/.cache/huggingface/. Subsequent calls reuse cached weights.
//
// WARNING: first calls block until download completes:
//   - ai.embed()      — ~22 MB (MiniLM-L6-v2), loads in ~1s after download
//   - ai.generate()   — ~1.7 GB (Phi-2 Q4_K_M), CPU inference ~10-30s/200 tokens
//   - ai.transcribe() — ~75 MB (Whisper-tiny), ~5s for a 30s clip

export const ai = {
  /**
   * Embed text into a 384-dimensional unit-normalised vector.
   *
   * Uses sentence-transformers/all-MiniLM-L6-v2. Suitable for cosine-similarity
   * search with the `vectorDb` API — replaces keyword-bag fake embeddings.
   *
   * @param {string} text
   * @returns {Promise<number[]>}  384-element float32 array
   */
  async embed(text) {
    if (typeof __glyx_ai_embed === 'undefined')
      throw new Error('ai.embed: binding unavailable — add ai:true to glyx.config.json');
    const raw = await __glyx_ai_embed(String(text));
    return JSON.parse(raw);
  },

  /**
   * Generate text from a prompt using Phi-2 (quantized Q4_K_M, CPU).
   *
   * Resolves with the full generated string when done.
   * Long-running — expect 10-30 seconds per 200 tokens on CPU.
   *
   * @param {string} prompt
   * @param {{ maxTokens?: number, temperature?: number }} [opts]
   * @returns {Promise<string>}
   */
  async generate(prompt, { maxTokens = 200, temperature = 0.7 } = {}) {
    if (typeof __glyx_ai_generate === 'undefined')
      throw new Error('ai.generate: binding unavailable — add ai:true to glyx.config.json');
    return __glyx_ai_generate(String(prompt), JSON.stringify({ maxTokens, temperature }));
  },

  /**
   * Transcribe an audio file to text using Whisper-tiny (CPU).
   *
   * Supports WAV (16 kHz mono preferred), MP3, FLAC, OGG.
   *
   * @param {string} audioPath  Absolute path to the audio file
   * @param {{ language?: string }} [opts]  ISO 639-1 code, e.g. 'en'; empty = auto-detect
   * @returns {Promise<string>}  Plain text transcript
   */
  async transcribe(audioPath, { language = '' } = {}) {
    if (typeof __glyx_ai_transcribe === 'undefined')
      throw new Error('ai.transcribe: binding unavailable — add ai:true to glyx.config.json');
    return __glyx_ai_transcribe(String(audioPath), JSON.stringify({ language }));
  },

  /** Unload API — free model RAM immediately without restarting the app. */
  unload: {
    embed()      { if (typeof __glyx_ai_unload_embed      !== 'undefined') __glyx_ai_unload_embed(); },
    generate()   { if (typeof __glyx_ai_unload_generate   !== 'undefined') __glyx_ai_unload_generate(); },
    transcribe() { if (typeof __glyx_ai_unload_transcribe !== 'undefined') __glyx_ai_unload_transcribe(); },
  },
};
