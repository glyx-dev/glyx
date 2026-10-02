// @glyx-dev/react — deep-link URL handling.

// ── Deep link polling ─────────────────────────────────────────────────────────
//
// Forwarded URLs arrive each frame via __glyx_deeplink_poll().
// The initial launch URL is retrieved once on startup via __glyx_deeplink_getInitialUrl().

export const _deeplinkCallbacks = [];
export let   _deeplinkInitialFired = false;

export function _pollDeeplinks() {
  // Fire initial URL once (the URL that launched this instance of the app).
  if (!_deeplinkInitialFired && _deeplinkCallbacks.length > 0) {
    _deeplinkInitialFired = true;
    if (typeof __glyx_deeplink_getInitialUrl !== 'undefined') {
      try {
        const url = __glyx_deeplink_getInitialUrl();
        if (url) {
          for (const cb of _deeplinkCallbacks) {
            try { cb(url); } catch (e) { __glyx_log('[deeplink] callback error: ' + e); }
          }
        }
      } catch {}
    }
  }

  // Drain forwarded URLs from the single-instance listener queue.
  if (typeof __glyx_deeplink_poll === 'undefined') return;
  let raw;
  try { raw = __glyx_deeplink_poll(); } catch { return; }
  if (!raw || raw === '[]') return;
  let urls;
  try { urls = JSON.parse(raw); } catch { return; }
  for (const url of urls) {
    for (const cb of _deeplinkCallbacks) {
      try { cb(url); } catch (e) { __glyx_log('[deeplink] callback error: ' + e); }
    }
  }
}
// ── Deep links ────────────────────────────────────────────────────────────────

/**
 * Deep-link URL handling.
 *
 * Fires for both the initial launch URL (the URL that opened the app) and
 * any URLs forwarded by a second instance (when `singleInstance: true`).
 *
 * @example
 * import { deeplink } from '@glyx-dev/react';
 * deeplink.onOpen((url) => {
 *   // url = "notes://note/42"
 *   navigate('noteDetail', { id: url.split('/').pop() });
 * });
 */
export const deeplink = {
  /**
   * Register a callback fired for every deep-link URL, including the initial launch URL.
   * @param {function(string): void} cb  Called with the full URL string.
   * @returns {function} Unsubscribe function.
   */
  onOpen(cb) {
    _deeplinkCallbacks.push(cb);
    return function unsubscribe() {
      const i = _deeplinkCallbacks.indexOf(cb);
      if (i !== -1) _deeplinkCallbacks.splice(i, 1);
    };
  },
};
