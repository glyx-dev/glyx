// @glyx-dev/react — local AI (Candle) — embed/generate/transcribe.

import { _noBinding } from './_shared.js';
import { _readStreamOf, _streamCall, utf8Decode } from './streams.js';

// ── Local AI (Candle) ─────────────────────────────────────────────────────────
//
// Capability gate: `ai: true` in glyx.config.json.
//
// Models are downloaded from HuggingFace Hub on first call and cached in
// ~/.cache/huggingface/. Subsequent calls reuse cached weights.
//
// WARNING: first calls block until download completes:
//   - ai.embed()      — ~22 MB (MiniLM-L6-v2), loads in ~2s after download, ~15 ms a sentence
//   - ai.generate()   — ~1.7 GB (Phi-2 Q4_K_M), 0.13 s a token built with AVX2, 0.38 s without
//   - ai.transcribe() — ~75 MB (Whisper-tiny), about 3x faster than real time
//
// A download also needs `aiModelDownload: true` next to `ai: true`. Details: the Local AI guide.

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
  async embed(text: any) {
    if (typeof __glyx_ai_embed === 'undefined')
      throw new Error('ai.embed: binding unavailable — add ai:true to glyx.config.json');
    const raw = await __glyx_ai_embed(String(text));
    return JSON.parse(raw);
  },

  /**
   * Generate text from a prompt using Phi-2 (quantized Q4_K_M, CPU).
   *
   * Resolves with the full generated string when done.
   * Long-running — about 0.13 s a token on a runtime built with AVX2, 0.38 s without (a 100-token answer: 13 to 38 s).
   *
   * @param {string} prompt
   * @param {{ maxTokens?: number, temperature?: number }} [opts]
   * @returns {Promise<string>}
   */
  async generate(prompt: any, { maxTokens = 200, temperature = 0.7 }: any = {}) {
    if (typeof __glyx_ai_generate === 'undefined')
      throw new Error('ai.generate: binding unavailable — add ai:true to glyx.config.json');
    return __glyx_ai_generate(String(prompt), JSON.stringify({ maxTokens, temperature }));
  },

  /**
   * Like `generate`, but the text arrives as the model produces it, so a slow answer shows its first words after a token or two instead of
   * at the end:
   *
   * ```ts
   * let answer = ''
   * for await (const piece of ai.generateStream(prompt)) { answer += piece; setAnswer(answer) }
   * ```
   *
   * Each piece is whole characters. Leaving the loop early (`break`, or an error thrown inside it) stops the model, which frees the CPU for
   * the next call. A slow consumer holds the model back rather than letting text pile up. Same options and model as `generate`.
   *
   * @param {string} prompt
   * @param {{ maxTokens?: number, temperature?: number }} [opts]
   * @returns {AsyncIterable<string>}
   */
  generateStream(prompt: any, { maxTokens = 200, temperature = 0.7 }: any = {}): AsyncIterable<string> {
    return {
      async *[Symbol.asyncIterator]() {
        if (typeof (globalThis as any).__glyx_backend_call2 !== 'function') await _noBinding('ai.generateStream');
        const { id } = await _streamCall('glyx_stream.generate', { prompt: String(prompt), maxTokens, temperature });
        const stream = _readStreamOf(id);
        try {
          for (let chunk = await stream.read(); chunk !== null; chunk = await stream.read()) yield utf8Decode(chunk);
        } finally {
          await stream.cancel(); // harmless after the end; stops the model if the loop was left early
        }
      },
    };
  },

  /**
   * Transcribe an audio file to text using Whisper-tiny (CPU).
   *
   * Supports WAV, MP3, FLAC and OGG (Vorbis), any channel count and sample rate; other formats are refused.
   * Audio longer than 30 s is transcribed in 30 s windows and joined.
   *
   * @param {string} audioPath  Absolute path to the audio file
   * @param {{ language?: string }} [opts]  ISO 639-1 code, e.g. 'en'; empty = auto-detect
   * @returns {Promise<string>}  Plain text transcript
   */
  async transcribe(audioPath: any, { language = '' }: any = {}) {
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
