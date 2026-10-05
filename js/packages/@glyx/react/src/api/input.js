// @glyx-dev/react — gamepad, global shortcut, and app-focused shortcut input.
import { addKeyListener } from '../events.js';

// ── Global shortcut polling ───────────────────────────────────────────────────
//
// Callbacks registered via input.globalShortcut.register(acc, cb).
export const _globalShortcutCallbacks = new Map();  // id (number) → cb

export function _pollGlobalShortcuts() {
  if (typeof __glyx_shortcut_poll === 'undefined') return;
  if (_globalShortcutCallbacks.size === 0) return;
  let raw;
  try { raw = __glyx_shortcut_poll(); } catch { return; }
  if (!raw || raw === '[]') return;
  let ids;
  try { ids = JSON.parse(raw); } catch { return; }
  for (const id of ids) {
    const cb = _globalShortcutCallbacks.get(id);
    if (cb) try { cb(); } catch (e) { __glyx_log('[shortcut] callback error: ' + e); }
  }
}

export function _pollGamepads() {
  if (typeof __glyx_gamepad_poll === 'undefined') return;
  if (!globalThis._gamepadCallbacks || globalThis._gamepadCallbacks.length === 0) return;
  let raw;
  try { raw = __glyx_gamepad_poll(); } catch { return; }
  if (!raw || raw === '[]') return;
  let evs;
  try { evs = JSON.parse(raw); } catch { return; }
  for (const ev of evs) {
    for (const cb of globalThis._gamepadCallbacks) {
      try { cb(ev); } catch (e) { __glyx_log('[gamepad] callback error: ' + e); }
    }
  }
}

// ── App-focused shortcut registry ─────────────────────────────────────────────
//
// Keyed by id; entries are { mods: {ctrl,shift,alt,meta}, key: string, cb }.
// Dispatched via addKeyListener registered below.
export const _localShortcuts = new Map();  // id → { mods, key, cb }
export let   _localShortcutNextId = 1;

// Normalize a winit physical key name to the shortcut token a user would type.
// winit sends KeyCode::Debug names: 'KeyG' → 'g', 'Digit1' → '1', 'Space' → 'space'.
function _normalizeKey(winitKey) {
  if (/^Key[A-Z]$/.test(winitKey))   return winitKey[3].toLowerCase();  // KeyG → g
  if (/^Digit\d$/.test(winitKey))    return winitKey[5];                 // Digit1 → 1
  return winitKey.toLowerCase();                                          // Space → space, F1 → f1
}

// Listen to every key event from events.js and check local shortcuts.
addKeyListener(function _dispatchLocalShortcuts({ key, ctrl, shift, pressed }) {
  if (!pressed || _localShortcuts.size === 0) return;
  const norm = _normalizeKey(key);
  for (const { mods, key: sKey, cb } of _localShortcuts.values()) {
    if (sKey === norm && mods.ctrl === ctrl && mods.shift === shift) {
      try { cb(); } catch (e) { __glyx_log('[shortcut] local callback error: ' + e); }
    }
  }
});
export const input = {
  gamepads: {
    /**
     * Register a callback fired for every gamepad event polled each frame.
     * @param {function} cb  Called with `{id, name, event: {type, ...}}`
     * @returns {function} Unsubscribe
     */
    onInput(cb) {
      const key = Symbol();
      // poll gamepads each frame and fire cb
      const prev = globalThis.__glyx_gamepadCb;
      if (!globalThis._gamepadCallbacks) globalThis._gamepadCallbacks = [];
      globalThis._gamepadCallbacks.push(cb);
      return function unsubscribe() {
        const arr = globalThis._gamepadCallbacks;
        if (arr) {
          const i = arr.indexOf(cb);
          if (i !== -1) arr.splice(i, 1);
        }
      };
    },
  },

  /** System-wide shortcuts — fires even when the app is backgrounded. */
  globalShortcut: {
    /**
     * @param {string} accelerator  e.g. "ctrl+shift+v"
     * @param {function} cb
     * @returns {string} id — pass to unregister()
     */
    register(accelerator, cb) {
      if (typeof __glyx_shortcut_register === 'undefined') return null;
      try {
        const id = Number(__glyx_shortcut_register(accelerator));
        _globalShortcutCallbacks.set(id, cb);
        return String(id);
      } catch (e) {
        __glyx_log('[shortcut] register error: ' + e);
        return null;
      }
    },
    unregister(id) {
      const numId = Number(id);
      _globalShortcutCallbacks.delete(numId);
      if (typeof __glyx_shortcut_unregister !== 'undefined') __glyx_shortcut_unregister(String(numId));
    },
  },

  /** App-focused shortcuts — fires when the app window is focused (no OS registration). */
  shortcut: {
    /**
     * @param {string} accelerator  e.g. "ctrl+k"
     * @param {function} cb
     * @returns {number} id — pass to unregister()
     */
    register(accelerator, cb) {
      const parts = accelerator.toLowerCase().split('+').map(s => s.trim());
      const mods = { ctrl: false, shift: false, alt: false, meta: false };
      let key = null;
      for (const p of parts) {
        if (p === 'ctrl' || p === 'control') mods.ctrl = true;
        else if (p === 'shift') mods.shift = true;
        else if (p === 'alt') mods.alt = true;
        else if (p === 'meta' || p === 'cmd' || p === 'win') mods.meta = true;
        else key = p;
      }
      const id = _localShortcutNextId++;
      _localShortcuts.set(id, { mods, key, cb });
      return id;
    },
    unregister(id) { _localShortcuts.delete(id); },
  },
};
