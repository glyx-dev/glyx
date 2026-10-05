// @glyx-dev/react — low-level video decoder bindings.

// ── Video API ─────────────────────────────────────────────────────────────────
//
// Low-level bindings for the glyx-media DLL decoder.
// Requires `video: true` in glyx.config.json.
// For a ready-made component, use the `<Video>` component (Phase 16H v3).
//
// Usage:
//   const handleId = await video.open('/path/to/movie.mp4');
//   // pass handleId as `videoHandle` prop to a <View nodeType="video"> node
//   video.seek(handleId, 30.0);  // jump to 30 seconds
//   video.close(handleId);

// Internal: video event listeners
// handleId → { onEnded, onMetadata, onTimeUpdate, onError }
export const _videoCallbacks = new Map();
export function _pollVideo() {
  if (typeof __glyx_video_poll === 'undefined') return;
  const events = JSON.parse(__glyx_video_poll());
  for (const ev of events) {
    const cbs = _videoCallbacks.get(ev.id);
    if (!cbs) continue;
    if      (ev.type === 'ended'      && cbs.onEnded)      cbs.onEnded();
    else if (ev.type === 'metadata'   && cbs.onMetadata)   cbs.onMetadata(ev);
    else if (ev.type === 'timeupdate' && cbs.onTimeUpdate) cbs.onTimeUpdate(ev.currentTime);
    else if (ev.type === 'error'      && cbs.onError)      cbs.onError(ev.message);
  }
}

export const video = {
  /**
   * Open a video file or URL for playback.
   * @param {string} url
   * @param {{ onEnded?, onMetadata?, onTimeUpdate?, onError? }} opts
   * @returns {Promise<number>} Resolves with the video handle ID.
   */
  async open(url, { onEnded, onMetadata, onTimeUpdate, onError } = {}) {
    const handleId = parseInt(await __glyx_video_open(url));
    _videoCallbacks.set(handleId, { onEnded, onMetadata, onTimeUpdate, onError });
    return handleId;
  },
  /** Seek to `seconds`. */
  seek(handleId, seconds) {
    __glyx_video_seek(String(handleId), Math.max(0, seconds));
  },
  /** Set playback volume (0.0 = mute, 1.0 = normal, up to 2.0). */
  setVolume(handleId, volume) {
    __glyx_video_set_volume(String(handleId), volume);
  },
  /** Pause decode and audio threads. */
  pause(handleId) {
    __glyx_video_pause(String(handleId));
  },
  /** Resume after pause. */
  play(handleId) {
    __glyx_video_play(String(handleId));
  },
  /** Close and release the video handle. */
  close(handleId) {
    __glyx_video_close(String(handleId));
    _videoCallbacks.delete(handleId);
  },
};
