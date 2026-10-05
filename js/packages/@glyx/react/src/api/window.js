// @glyx-dev/react — window control + multi-window.
import { _noBinding } from './_shared.js';
import { ipc } from './ipc.js';

// ── Multi-window ──────────────────────────────────────────────────────────────
//
// Extends glyxWindow with a create() method for opening secondary windows.
// This export adds to the existing glyxWindow object (defined earlier in the
// file) — import glyxWindow to use all window control methods.

/**
 * Open a secondary window running an independent instance of the app.
 * Returns a handle object usable with the `ipc` API.
 *
 * @param {{ title?: string, width?: number, height?: number }} opts
 * @returns {Promise<{ id: number, send: (msg: string) => void }>}
 *
 * @example
 * const win = await glyxWindow.create({ title: 'Inspector', width: 400, height: 600 });
 * win.send(JSON.stringify({ type: 'hello' }));
 */
export const glyxWindow = {
  setFullscreen:   (full)  => typeof __glyx_setFullscreen   !== 'undefined' && __glyx_setFullscreen(full),
  setMaximized:    (max)   => typeof __glyx_setMaximized    !== 'undefined' && __glyx_setMaximized(max),
  setMinimized:    (minimized = true) => typeof __glyx_setMinimized !== 'undefined' && __glyx_setMinimized(minimized),
  isFullscreen:    ()      => typeof __glyx_isFullscreen    !== 'undefined' ? __glyx_isFullscreen()    : false,
  isMaximized:     ()      => typeof __glyx_isMaximized     !== 'undefined' ? __glyx_isMaximized()     : false,
  getWindowSize:   ()      => typeof __glyx_getWindowSize   !== 'undefined' ? __glyx_getWindowSize()   : { width: 0, height: 0 },
  getScreenSize:   ()      => typeof __glyx_getScreenSize   !== 'undefined' ? __glyx_getScreenSize()   : { width: 0, height: 0 },
  setAlwaysOnTop:  (on)    => typeof __glyx_setAlwaysOnTop  !== 'undefined' && __glyx_setAlwaysOnTop(on),
  setTitle:        (title) => typeof __glyx_setTitle        !== 'undefined' && __glyx_setTitle(title),
  /** Set the mouse cursor icon: 'default' | 'pointer' | 'text' | 'move' |
   *  'grab' | 'grabbing' | 'col-resize' | 'row-resize' | 'ew-resize' |
   *  'ns-resize' | 'crosshair' | 'not-allowed' | 'wait'. */
  setCursor:       (name)  => typeof __glyx_setCursor       !== 'undefined' && __glyx_setCursor(name),
  /** Immediately run V8 GC + mimalloc segment decommit. The framework does
   *  this automatically on focus loss; call manually at level transitions or
   *  loading screens for faster memory recovery. */
  collectMemory:   ()      => typeof __glyx_collect_memory  !== 'undefined' && __glyx_collect_memory(),
  /** Open an http(s)/mailto URL in the OS default app (browser). */
  openExternal:    (url)   => typeof __glyx_open_external   !== 'undefined' && __glyx_open_external(url),
};

glyxWindow.create = function create(opts = {}) {
  if (typeof __glyx_window_create === 'undefined') return _noBinding('glyxWindow.create');
  return __glyx_window_create(JSON.stringify(opts)).then(idStr => {
    const id = Number(idStr);
    return {
      get id() { return id; },
      send(msg) { ipc.send(id, msg); },
    };
  });
};

/**
 * Quit the application — closes all windows and exits the event loop.
 * Safe to call from any window.
 */
glyxWindow.quit = function quit() {
  if (typeof __glyx_quit !== 'undefined') __glyx_quit();
};

/**
 * Restart the application — quits cleanly then re-launches the same executable.
 * Useful after applying an update or settings that require a full reload.
 */
glyxWindow.restart = function restart() {
  if (typeof __glyx_restart !== 'undefined') __glyx_restart();
};

/**
 * Close the window (main window: exits the app; secondary windows: closes that window).
 * In the current implementation this is equivalent to `glyxWindow.quit()`.
 */
glyxWindow.close = function close() {
  if (typeof __glyx_window_close !== 'undefined') __glyx_window_close();
};

/** Cache so platform() never calls the binding twice. */
let _platformCache = null;

/**
 * Returns the host OS: `"windows"` | `"macos"` | `"linux"`.
 * Value is determined at compile time and never changes at runtime.
 */
glyxWindow.platform = function platform() {
  if (_platformCache !== null) return _platformCache;
  _platformCache = typeof __glyx_platform !== 'undefined' ? __glyx_platform() : 'unknown';
  return _platformCache;
};

/**
 * Hide the splash screen overlay programmatically.
 *
 * Call this once your app has loaded its initial data and is ready to show
 * the main UI. If `minimumMs` is configured in glyx.config.json, the splash
 * stays visible for at least that duration even after this call.
 */
glyxWindow.hideSplash = function hideSplash() {
  if (typeof __glyx_splash_hide !== 'undefined') __glyx_splash_hide();
};
