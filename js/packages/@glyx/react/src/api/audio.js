// @glyx-dev/react — audio playback.

// ── Audio event polling ───────────────────────────────────────────────────────
//
// Drains `__glyx_audio_poll()` each frame and fires registered onEnded callbacks.
// Map: handle (string) → array of { onEnded } objects.

export const _audioCallbacks = new Map();

export function _pollAudio() {
  if (typeof __glyx_audio_poll === 'undefined') return;
  let raw;
  try { raw = __glyx_audio_poll(); } catch { return; }
  if (!raw || raw === '[]') return;
  let events;
  try { events = JSON.parse(raw); } catch { return; }
  for (const ev of events) {
    const key = String(ev.handle);
    const cbs = _audioCallbacks.get(key);
    if (cbs) {
      for (const cb of cbs) {
        if (ev.event === 'ended' && cb.onEnded) {
          try { cb.onEnded(); } catch (e) { __glyx_log('[audio] onEnded error: ' + e); }
        }
      }
      if (ev.event === 'ended') _audioCallbacks.delete(key);
    }
  }
}
// ── Audio playback ────────────────────────────────────────────────────────────

/**
 * Audio playback API.
 *
 * Capability: `audio: true` in glyx.config.json.
 *
 * @example
 * const player = await audio.play('/path/to/file.mp3');
 * player.pause();
 * player.setVolume(0.5);
 * player.stop();
 */
export const audio = {
  /**
   * Play an audio file. Returns a player handle.
   * @param {string} src  Absolute path to the audio file (mp3, flac, ogg, wav).
   * @param {{ volume?: number, onEnded?: function }} [opts]
   * @returns {Promise<{ id: string, pause, resume, stop, setVolume, getVolume }>}
   */
  async play(src, { volume = 1.0, onEnded } = {}) {
    if (typeof __glyx_audio_play === 'undefined')
      throw new Error('audio binding unavailable');
    const rawId = await __glyx_audio_play(src, JSON.stringify({ volume }));
    const id = String(JSON.parse(rawId));
    if (onEnded) {
      if (!_audioCallbacks.has(id)) _audioCallbacks.set(id, []);
      _audioCallbacks.get(id).push({ onEnded });
    }
    return {
      id,
      pause()           { if (typeof __glyx_audio_pause     !== 'undefined') __glyx_audio_pause(id); },
      resume()          { if (typeof __glyx_audio_resume    !== 'undefined') __glyx_audio_resume(id); },
      play()            { if (typeof __glyx_audio_resume    !== 'undefined') __glyx_audio_resume(id); },
      stop()            { if (typeof __glyx_audio_stop      !== 'undefined') __glyx_audio_stop(id); _audioCallbacks.delete(id); },
      setVolume(v)      { if (typeof __glyx_audio_setVolume !== 'undefined') __glyx_audio_setVolume(id, v); },
      getVolume()       { return typeof __glyx_audio_getVolume !== 'undefined' ? __glyx_audio_getVolume(id) : 1.0; },
      getTime()         { return typeof __glyx_audio_get_time !== 'undefined' ? __glyx_audio_get_time(id) : 0.0; },
      async getDuration() { return typeof __glyx_audio_duration !== 'undefined' ? parseFloat(await __glyx_audio_duration(id)) : -1; },
      async seek(secs)  { if (typeof __glyx_audio_seek !== 'undefined') await __glyx_audio_seek(id, secs); },
      onEnded(cb)       {
        if (!_audioCallbacks.has(id)) _audioCallbacks.set(id, []);
        _audioCallbacks.get(id).push({ onEnded: cb });
      },
    };
  },
};
