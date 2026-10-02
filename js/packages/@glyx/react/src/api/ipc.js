// @glyx-dev/react — inter-window messaging.
import { netIpc } from '../devNet.js';

// ── IPC inbox polling ─────────────────────────────────────────────────────────
//
// Callbacks registered via ipc.on('message', cb).
export const _ipcListeners = [];
export function _pollIpc() {
  if (typeof __glyx_ipc_poll === 'undefined') return;
  let msgs;
  try { msgs = __glyx_ipc_poll(); } catch { return; }
  if (!msgs) return;
  for (const msg of msgs) {
    netIpc('in', null, msg);
    for (const cb of _ipcListeners) {
      try { cb(msg); } catch {}
    }
  }
}

/**
 * Inter-window process communication.
 *
 * @example
 * // In window 0 (main):
 * const child = await glyxWindow.create({ title: 'Inspector', width: 400, height: 600 });
 * ipc.send(child.id, JSON.stringify({ type: 'init', data: 42 }));
 *
 * // In window N (secondary):
 * ipc.on('message', (msg) => console.log('received:', msg));
 */
export const ipc = {
  /**
   * Send a string message to another window by its handle.
   * @param {number} targetHandle
   * @param {string} message
   */
  send(targetHandle, message) {
    if (typeof __glyx_ipc_send !== 'undefined') {
      netIpc('out', targetHandle, message);
      __glyx_ipc_send(targetHandle, String(message));
    }
  },

  /**
   * Register a callback for messages received by this window.
   * @param {'message'} event  — currently only 'message' is supported
   * @param {(msg: string) => void} callback
   * @returns {() => void}  unsubscribe function
   */
  on(event, callback) {
    if (event !== 'message') return () => {};
    _ipcListeners.push(callback);
    return () => {
      const idx = _ipcListeners.indexOf(callback);
      if (idx !== -1) _ipcListeners.splice(idx, 1);
    };
  },
};
