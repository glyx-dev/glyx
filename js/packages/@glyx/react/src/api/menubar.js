// @glyx-dev/react: native window menu bar (File / Edit / View under the title bar).
//
// Requires `menubar: true` in the app's capabilities. Windows and macOS; see
// `menubar.supported` (the macOS bar has not run on a Mac yet). The menu shape
// is described in ./menuSchema.js.

import { addKeyListener, removeKeyListener, addMenuBarListener, removeMenuBarListener, runEditCommand } from '../events.js';
import { validateMenu, normalizeMenu, flattenItems, parseAccelerator, matchesAccelerator, currentPlatform } from './menuSchema.js';

let handlers = [];
let items = new Map();       // id -> { checkable, checked, enabled, accel }
let nativeListener = null;
let keyListener = null;

const has = (name) => typeof globalThis[name] !== 'undefined';

function emit(ev) {
  for (const fn of handlers.slice()) {
    try { fn(ev); } catch (e) { if (has('__glyx_log')) globalThis.__glyx_log('[menubar] handler threw: ' + (e && e.message)); }
  }
}

// The runtime pushes a choice the moment it happens: no timer, so an idle app stays idle.
function onNative(ev) {
  const known = items.get(ev.id);
  if (known && known.checkable && typeof ev.checked === 'boolean') known.checked = ev.checked;
  // An editing item acts on the focused field first, then is reported like any other choice.
  if (known && known.role) { runEditCommand(known.role); emit({ ...ev, role: known.role }); return; }
  emit(ev);
}

// Win32 does not trigger accelerators for us (the event loop is not ours), so
// the key chords are matched here. The menu still shows them.
function onKey(ev) {
  if (!ev.pressed || currentPlatform() === 'macos') return;
  for (const [id, it] of items) {
    if (!it.accel || !it.enabled || !matchesAccelerator(it.accel, ev)) continue;
    if (it.checkable) {
      it.checked = !it.checked;
      if (has('__glyx_menubar_set_checked')) globalThis.__glyx_menubar_set_checked(id, it.checked);
      emit({ id, checked: it.checked });
    } else {
      emit({ id });
    }
    return;
  }
}

function sync() {
  const wantNative = items.size > 0 && handlers.length > 0;
  if (wantNative && !nativeListener) { nativeListener = onNative; addMenuBarListener(nativeListener); }
  if (!wantNative && nativeListener) { removeMenuBarListener(nativeListener); nativeListener = null; }
  // On macOS the menu's own key equivalents fire the items; matching keys here too would run them twice.
  const wantKeys = handlers.length > 0 && currentPlatform() !== 'macos' && [...items.values()].some((i) => i.accel);
  if (wantKeys && !keyListener) { keyListener = onKey; addKeyListener(keyListener); }
  if (!wantKeys && keyListener) { removeKeyListener(keyListener); keyListener = null; }
}

function register(menu) {
  items = new Map();
  for (const it of flattenItems(menu)) {
    items.set(it.id, {
      checkable: typeof it.checked === 'boolean',
      checked: it.checked === true,
      enabled: it.enabled !== false,
      role: it.role || null,
      // A role's accelerator is only shown: the text field handles those keys itself.
      accel: it.accelerator && !it.role ? parseAccelerator(it.accelerator) : null,
    });
  }
}

export const menubar = {
  /** True when this platform can show a native menu bar (Windows and macOS). */
  get supported() {
    return has('__glyx_menubar_supported') ? !!globalThis.__glyx_menubar_supported() : false;
  },

  /**
   * Replace the window's menu bar. Throws when the description is invalid, the
   * `menubar` capability is missing, or the platform cannot show one.
   * @param {Array} menu  see ./menuSchema.js
   */
  set(menu) {
    const problem = validateMenu(menu);
    if (problem) throw new Error('menubar.set: ' + problem);
    if (!has('__glyx_menubar_set')) throw new Error('menubar.set: not available in this runtime');
    const full = normalizeMenu(menu);
    const err = globalThis.__glyx_menubar_set(JSON.stringify(full));
    if (err) throw new Error('menubar.set: ' + err);
    register(full);
    sync();
  },

  /** Remove the menu bar. */
  clear() {
    if (has('__glyx_menubar_clear')) globalThis.__glyx_menubar_clear();
    items = new Map();
    sync();
  },

  /** Enable or disable an item by id. Returns false when there is no such item. */
  setEnabled(id, enabled) {
    if (!has('__glyx_menubar_set_enabled') || !globalThis.__glyx_menubar_set_enabled(id, !!enabled)) return false;
    const it = items.get(id);
    if (it) it.enabled = !!enabled;
    return true;
  },

  /** Check or uncheck a checkable item (one given a `checked` value). Returns false when there is none. */
  setChecked(id, checked) {
    if (!has('__glyx_menubar_set_checked') || !globalThis.__glyx_menubar_set_checked(id, !!checked)) return false;
    const it = items.get(id);
    if (it) it.checked = !!checked;
    return true;
  },

  /**
   * Called when an item is chosen, by mouse, keyboard or accelerator. A checkable
   * item's event carries its new `checked` state. Returns an unsubscribe function.
   * @param {(ev: { id: string, checked?: boolean }) => void} handler
   */
  onSelect(handler) {
    handlers.push(handler);
    sync();
    return () => {
      handlers = handlers.filter((h) => h !== handler);
      sync();
    };
  },
};

/** For tests: forget everything and stop the timers. */
export function _resetMenubar() {
  handlers = [];
  items = new Map();
  sync();
}

/** For tests: feed a raw key event as the global key listener would. */
export const _handleKey = onKey;

/** For tests: deliver a choice as the runtime would. */
export const _handleNative = onNative;
