// @velox/react — React renderer for the Velox runtime.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Reconciler from 'react-reconciler';
import HostConfig from './hostConfig.js';
import {
  registerPressable, unregisterPressable,
  registerInput, unregisterInput,
  registerScrollView, unregisterScrollView,
  dispatchEvents,
  addWindowSizeListener, removeWindowSizeListener,
  addKeyListener,
} from './events.js';

// ── Reconciler ────────────────────────────────────────────────────────────────

const VeloxReconciler = Reconciler(HostConfig);

const rootContainer = VeloxReconciler.createContainer(
  { isVeloxRoot: true },
  0,      // LegacyRoot — synchronous rendering
  null, false, null, '',
  (err) => __velox_log('[React] Recoverable error: ' + err.message),
  null
);

// ── WebSocket inbox polling ───────────────────────────────────────────────────
//
// Open sockets: id (number) → { onmessage, onclose, onerror }
const _wsOpenSockets = new Map();

// ── IPC inbox polling ─────────────────────────────────────────────────────────
//
// Callbacks registered via ipc.on('message', cb).
const _ipcListeners = [];

// ── Global shortcut polling ───────────────────────────────────────────────────
//
// Callbacks registered via input.globalShortcut.register(acc, cb).
const _globalShortcutCallbacks = new Map();  // id (number) → cb

function _pollGlobalShortcuts() {
  if (typeof __velox_shortcut_poll === 'undefined') return;
  if (_globalShortcutCallbacks.size === 0) return;
  let raw;
  try { raw = __velox_shortcut_poll(); } catch { return; }
  if (!raw || raw === '[]') return;
  let ids;
  try { ids = JSON.parse(raw); } catch { return; }
  for (const id of ids) {
    const cb = _globalShortcutCallbacks.get(id);
    if (cb) try { cb(); } catch (e) { __velox_log('[shortcut] callback error: ' + e); }
  }
}

function _pollGamepads() {
  if (typeof __velox_gamepad_poll === 'undefined') return;
  if (!globalThis._gamepadCallbacks || globalThis._gamepadCallbacks.length === 0) return;
  let raw;
  try { raw = __velox_gamepad_poll(); } catch { return; }
  if (!raw || raw === '[]') return;
  let evs;
  try { evs = JSON.parse(raw); } catch { return; }
  for (const ev of evs) {
    for (const cb of globalThis._gamepadCallbacks) {
      try { cb(ev); } catch (e) { __velox_log('[gamepad] callback error: ' + e); }
    }
  }
}

// ── App-focused shortcut registry ─────────────────────────────────────────────
//
// Keyed by id; entries are { mods: {ctrl,shift,alt,meta}, key: string, cb }.
// Dispatched via addKeyListener registered below.
const _localShortcuts = new Map();  // id → { mods, key, cb }
let   _localShortcutNextId = 1;

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
      try { cb(); } catch (e) { __velox_log('[shortcut] local callback error: ' + e); }
    }
  }
});

// ── Perf violation polling ────────────────────────────────────────────────────
//
// Callbacks registered via perf.onBudgetExceeded(cb).
const _perfBudgetCallbacks = [];

function _pollPerfViolations() {
  if (typeof __velox_perf_poll_violations === 'undefined') return;
  if (_perfBudgetCallbacks.length === 0) return;
  let raw;
  try { raw = __velox_perf_poll_violations(); } catch { return; }
  if (!raw || raw === '[]') return;
  let violations;
  try { violations = JSON.parse(raw); } catch { return; }
  for (const v of violations) {
    for (const cb of _perfBudgetCallbacks) {
      try { cb(v); } catch (e) { __velox_log('[perf] onBudgetExceeded callback error: ' + e); }
    }
  }
}

// ── Frame callback ────────────────────────────────────────────────────────────
//
// Rust calls __velox_frameCallback() once per RedrawRequested (frame_tick),
// between tick() and drain_scene_commands().

globalThis.__velox_frameCallback = function veloxFrameCallback() {
  // flushSync forces React to commit all state updates triggered by events
  // synchronously, so scene commands are in the queue before Rust drains them.
  VeloxReconciler.flushSync(() => {
    _pollWebSockets();
    _pollIpc();
    _pollGamepads();
    _pollGlobalShortcuts();
    _pollPerfViolations();
    dispatchEvents();
  });
};

// ── Public render API ─────────────────────────────────────────────────────────

export function render(element) {
  VeloxReconciler.updateContainer(element, rootContainer, null, null);
}

// ── Host components ───────────────────────────────────────────────────────────

export const View = ({ children, style, ...props }) =>
  React.createElement('view', { style, ...props }, children);

export const Text = ({ children, style, showCursor, ...props }) =>
  React.createElement('text', { text: children, style, showCursor, ...props });

export function Image({ src, width = 120, height = 120, resizeMode = 'stretch', style, ...props }) {
  const imageId = React.useMemo(() => {
    if (!src) return null;
    return __velox_createImage(src);
  }, [src]);

  return React.createElement('image', {
    imageId,
    resizeMode,
    style,
    width,
    height,
    ...props,
  });
}

// ── Pressable ─────────────────────────────────────────────────────────────────
//
// Registration strategy: register SYNCHRONOUSLY inside _veloxOnMount, which
// fires from createInstance during React's commit phase — guaranteed before
// any frame_tick dispatches events.
//
// A handlersRef proxy is stored in the registry so the registered callbacks
// always delegate to the latest closure values without needing re-registration
// on every render.

export function Pressable({ children, onPress, onPressIn, onPressOut, onHoverIn, onHoverOut, style, ...props }) {
  const nodeIdRef    = useRef(null);
  const handlersRef  = useRef(null);
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Always keep handlersRef up to date with the latest prop values.
  handlersRef.current = {
    onPress:    () => onPress?.(),
    onPressIn:  () => { setPressed(true);  onPressIn?.(); },
    onPressOut: () => { setPressed(false); onPressOut?.(); },
    onHoverIn:  () => { setHovered(true);  onHoverIn?.(); },
    onHoverOut: () => { setHovered(false); onHoverOut?.(); },
  };

  // Called synchronously by createInstance the moment the native node exists.
  const onMount = useCallback((id) => {
    nodeIdRef.current = id;
    // Register stable proxy functions that delegate to handlersRef.
    registerPressable(id, {
      onPress:    () => handlersRef.current.onPress(),
      onPressIn:  () => handlersRef.current.onPressIn(),
      onPressOut: () => handlersRef.current.onPressOut(),
      onHoverIn:  () => handlersRef.current.onHoverIn(),
      onHoverOut: () => handlersRef.current.onHoverOut(),
    });
  }, []); // empty deps — fires exactly once per mount

  // Unregister on unmount. useEffect for cleanup only — no timing dependency.
  useEffect(() => {
    return () => {
      if (nodeIdRef.current !== null) {
        unregisterPressable(nodeIdRef.current);
      }
    };
  }, []);

  // Visual feedback:
  //   pressed → brighter border (confirms the click)
  //   hovered → subtle border (indicates interactivity)
  //   default → no border override
  const mergedStyle = pressed
    ? { ...style, borderWidth: 2, borderColor: '#ffffffaa' }
    : hovered
    ? { ...style, borderWidth: 1, borderColor: '#ffffff55' }
    : style;

  return React.createElement(
    'view',
    { _veloxOnMount: onMount, style: mergedStyle, ...props },
    children
  );
}

// ── ScrollView ────────────────────────────────────────────────────────────────
//
// A vertically-scrollable container backed by a Vello clip layer.
//
// The native view receives two extra props that the Rust renderer handles:
//   clip: true          — push a Vello clip layer around children
//   scrollOffsetY: n    — shift children upward by n pixels
//
// Scroll deltas arrive via the `scroll` input event, routed by events.js to
// whichever ScrollView the cursor is currently over.  The component converts
// deltas into a React state integer and re-renders, which triggers a
// visual-only UpdateNode (no Taffy rebuild — incremental layout).

export function ScrollView({
  children,
  style,
  width        = 300,
  height       = 200,
  contentHeight,        // explicit content height override (more reliable than auto-detect)
  ...props
}) {
  const nodeIdRef    = useRef(null);
  const maxScrollRef = useRef(0);
  const [scrollY, setScrollY] = useState(0);

  // ── Compute max scroll ──────────────────────────────────────────────────────
  // Prefer the explicit `contentHeight` prop when provided (most reliable).
  // Otherwise estimate by summing child `height` props from the React element
  // tree — works for uniform-height lists where heights are explicit props.
  const childArray = React.Children.toArray(children);
  const gap        = (style && style.gap)     || 0;
  const padding    = (style && style.padding) || 0;
  const autoContentH = childArray.reduce((sum, c) => sum + (c.props?.height || 0), 0)
                     + Math.max(0, childArray.length - 1) * gap
                     + 2 * padding;
  const resolvedContentH = contentHeight ?? autoContentH;

  // Always keep maxScrollRef current so the stable `onScroll` callback reads
  // the latest cap without needing to be re-registered on each render.
  maxScrollRef.current = Math.max(0, resolvedContentH - height);

  // ── Stable scroll handler ───────────────────────────────────────────────────
  // Empty dep array → created once, re-registered never.
  // Reads maxScrollRef.current (not a captured value) so the cap is always fresh.
  const onScroll = useCallback((deltaY) => {
    setScrollY((prev) => {
      const max = maxScrollRef.current;
      return Math.min(max, Math.max(0, prev + deltaY));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onMount = useCallback((id) => {
    nodeIdRef.current = id;
    registerScrollView(id, { onScroll });
  }, [onScroll]);

  useEffect(() => {
    return () => {
      if (nodeIdRef.current !== null) {
        unregisterScrollView(nodeIdRef.current);
      }
    };
  }, []);

  const viewStyle = {
    // Items stack from top: prevents Taffy centering overflowing content
    // above the viewport origin, which would make early items invisible.
    justifyContent: 'flex-start',
    alignItems:     'flex-start',
    // Rust: push Vello clip layer + shift children by scrollOffsetY.
    clip:           true,
    scrollOffsetY:  scrollY,
    ...style,
  };

  return React.createElement(
    'view',
    { _veloxOnMount: onMount, style: viewStyle, width, height, ...props },
    children,
  );
}

// ── TextInput ─────────────────────────────────────────────────────────────────

export function TextInput({
  value = '',
  onChangeText,
  placeholder = '',
  fontSize = 16,
  multiline = false,
  width  = 240,
  height = 44,
  style,
  ...props
}) {
  const nodeIdRef   = useRef(null);
  const handlersRef = useRef(null);
  const [focused, setFocused] = useState(false);

  // anchor: fixed end of selection; focus_: moving cursor end.
  // When anchor === focus_: no selection, cursor blinks at that position.
  const [anchor, setAnchor]   = useState(() => value.length);
  const [focus_,  setFocus_]  = useState(() => value.length);

  // Derived selection range (always ordered).
  const selStart = Math.min(anchor, focus_);
  const selEnd   = Math.max(anchor, focus_);

  // Collapse cursor to `pos`, clamped to [0, value.length].
  const moveCursor = (pos) => {
    const clamped = Math.max(0, Math.min(pos, value.length));
    setAnchor(clamped);
    setFocus_(clamped);
  };

  // Extend only the moving focus end (shift-selection).
  const extendTo = (pos) => {
    setFocus_(Math.max(0, Math.min(pos, value.length)));
  };

  // Keep handlersRef current so it always captures the latest state/props.
  handlersRef.current = {
    onFocus: () => {
      setFocused(true);
      // Place cursor at end of text on focus.
      const end = value.length;
      setAnchor(end);
      setFocus_(end);
    },
    onBlur: () => {
      setFocused(false);
    },
    onKeyPress: async ({ key, text, ctrl, shift }) => {
      const ss     = Math.min(anchor, focus_);
      const se     = Math.max(anchor, focus_);
      const hasSel = ss < se;

      // ── Ctrl shortcuts ──────────────────────────────────────────────────
      if (ctrl) {
        if (key === 'KeyA') {
          setAnchor(0);
          setFocus_(value.length);
        } else if (key === 'KeyC') {
          if (hasSel) {
            try { await clipboard.writeText(value.slice(ss, se)); } catch (_) {}
          }
        } else if (key === 'KeyX') {
          if (hasSel) {
            try { await clipboard.writeText(value.slice(ss, se)); } catch (_) {}
            const newVal = value.slice(0, ss) + value.slice(se);
            onChangeText?.(newVal);
            moveCursor(ss);
          }
        } else if (key === 'KeyV') {
          try {
            const pasted = await clipboard.readText();
            if (pasted) {
              const newVal = value.slice(0, ss) + pasted + value.slice(se);
              onChangeText?.(newVal);
              const newPos = ss + pasted.length;
              setAnchor(newPos);
              setFocus_(newPos);
            }
          } catch (_) {}
        }
        return;
      }

      // ── Arrow / navigation keys ─────────────────────────────────────────
      if (key === 'ArrowLeft') {
        if (shift) {
          extendTo(focus_ - 1);
        } else if (hasSel) {
          moveCursor(ss);           // collapse to start of selection
        } else {
          moveCursor(anchor - 1);
        }
        return;
      }
      if (key === 'ArrowRight') {
        if (shift) {
          extendTo(focus_ + 1);
        } else if (hasSel) {
          moveCursor(se);           // collapse to end of selection
        } else {
          moveCursor(anchor + 1);
        }
        return;
      }
      if (key === 'Home') {
        if (shift) { extendTo(0); } else { moveCursor(0); }
        return;
      }
      if (key === 'End') {
        if (shift) { extendTo(value.length); } else { moveCursor(value.length); }
        return;
      }

      // ── Delete / Backspace ──────────────────────────────────────────────
      if (key === 'Backspace') {
        if (hasSel) {
          onChangeText?.(value.slice(0, ss) + value.slice(se));
          moveCursor(ss);
        } else if (anchor > 0) {
          // Spread to handle multi-byte Unicode correctly.
          const chars = [...value];
          chars.splice(anchor - 1, 1);
          onChangeText?.(chars.join(''));
          moveCursor(anchor - 1);
        }
        return;
      }
      if (key === 'Delete') {
        if (hasSel) {
          onChangeText?.(value.slice(0, ss) + value.slice(se));
          moveCursor(ss);
        } else if (anchor < value.length) {
          const chars = [...value];
          chars.splice(anchor, 1);
          onChangeText?.(chars.join(''));
          // cursor stays at same position
        }
        return;
      }

      // ── Enter (multiline only) ──────────────────────────────────────────
      if (key === 'Enter') {
        if (multiline) {
          const newVal = value.slice(0, ss) + '\n' + value.slice(se);
          onChangeText?.(newVal);
          const newPos = ss + 1;
          setAnchor(newPos);
          setFocus_(newPos);
        }
        return;
      }

      // ── Printable character ─────────────────────────────────────────────
      if (text) {
        const newVal = value.slice(0, ss) + text + value.slice(se);
        onChangeText?.(newVal);
        // Do NOT use moveCursor() here — it clamps to the old value.length,
        // which is 0 when typing the first character into an empty field.
        const newPos = ss + text.length;
        setAnchor(newPos);
        setFocus_(newPos);
      }
    },
  };

  const onMount = useCallback((id) => {
    nodeIdRef.current = id;
    registerInput(id, {
      onFocus:    () => handlersRef.current.onFocus(),
      onBlur:     () => handlersRef.current.onBlur(),
      onKeyPress: (ev) => handlersRef.current.onKeyPress(ev),
    });
  }, []);

  useEffect(() => {
    return () => {
      if (nodeIdRef.current !== null) {
        unregisterInput(nodeIdRef.current);
      }
    };
  }, []);

  // Show placeholder only when unfocused and value is empty.
  const displayText  = (focused || value) ? value : placeholder;
  const textColor    = value ? '#ffffff' : '#888888';
  const innerPadding = multiline ? 10 : 8;

  const inputStyle = {
    backgroundColor: focused ? '#4a4a7e' : '#2a2a3e',
    borderRadius: 6,
    borderWidth: focused ? 2 : 1,
    borderColor: focused ? '#8080ff' : '#44446a',
    justifyContent: multiline ? 'flex-start' : 'center',
    alignItems: 'flex-start',
    padding: innerPadding,
    ...style,
  };

  return React.createElement(
    'view',
    { _veloxOnMount: onMount, style: inputStyle, width, height, ...props },
    React.createElement('text', {
      text:           displayText,
      fontSize,
      width:          width - innerPadding * 2,
      height:         multiline ? undefined : height - innerPadding * 2,
      style:          { color: textColor },
      showCursor:     focused,
      cursorPosition: focused ? focus_ : undefined,
      selectionStart: (focused && selStart < selEnd) ? selStart : undefined,
      selectionEnd:   (focused && selStart < selEnd) ? selEnd   : undefined,
      textAlign:      'left',
    })
  );
}

// ── Responsive layout hooks ───────────────────────────────────────────────────

/**
 * Returns the current window size in physical pixels, updating on resize.
 * @returns {{ width: number, height: number }}
 */
export function useWindowSize() {
  const [size, setSize] = useState(() => {
    const s = typeof __velox_getWindowSize !== 'undefined' ? __velox_getWindowSize() : null;
    return s ? { width: s.width, height: s.height } : { width: 0, height: 0 };
  });

  useEffect(() => {
    const handler = (s) => setSize(s);
    addWindowSizeListener(handler);
    return () => removeWindowSizeListener(handler);
  }, []);

  return size;
}

/**
 * Returns the current monitor size in physical pixels (read-once, does not update).
 * @returns {{ width: number, height: number }}
 */
export function useScreenSize() {
  const [size] = useState(() => {
    const s = typeof __velox_getScreenSize !== 'undefined' ? __velox_getScreenSize() : null;
    return s ? { width: s.width, height: s.height } : { width: 0, height: 0 };
  });
  return size;
}

/**
 * Returns true when the window width is at least `minWidth` pixels.
 * Equivalent to CSS `@media (min-width: Xpx)`.
 * @param {number} minWidth
 * @returns {boolean}
 */
export function useMediaQuery(minWidth) {
  const { width } = useWindowSize();
  return width >= minWidth;
}

// ── Window imperative API ─────────────────────────────────────────────────────

/**
 * Imperative window control API.
 *
 * @example
 * veloxWindow.setFullscreen(true);   // game-style fullscreen (covers taskbar)
 * veloxWindow.setMaximized(true);    // maximize (taskbar remains visible)
 * veloxWindow.setMinimized();        // minimize to taskbar
 * veloxWindow.isFullscreen();        // → boolean
 * veloxWindow.isMaximized();         // → boolean
 * veloxWindow.getWindowSize();       // → { width, height } physical pixels
 * veloxWindow.getScreenSize();       // → { width, height } physical pixels
 */
// ── Secure env access ─────────────────────────────────────────────────────────
//
// Reads a single environment variable by name.
// Returns null if the name is not in the `env.allow` capability list, or if
// the variable does not exist in the process environment.
// `process.env` is not available — only explicitly allowed names are readable.

/**
 * Read a single environment variable declared in `velox.config.json`.
 * @param {string} name — The variable name (e.g. `"API_KEY"`).
 * @returns {string | null}
 */
export function getEnv(name) {
  return typeof __velox_getEnv !== 'undefined' ? __velox_getEnv(name) : null;
}

export const veloxWindow = {
  setFullscreen:   (full)  => typeof __velox_setFullscreen   !== 'undefined' && __velox_setFullscreen(full),
  setMaximized:    (max)   => typeof __velox_setMaximized    !== 'undefined' && __velox_setMaximized(max),
  setMinimized:    ()      => typeof __velox_setMinimized    !== 'undefined' && __velox_setMinimized(),
  isFullscreen:    ()      => typeof __velox_isFullscreen    !== 'undefined' ? __velox_isFullscreen()    : false,
  isMaximized:     ()      => typeof __velox_isMaximized     !== 'undefined' ? __velox_isMaximized()     : false,
  getWindowSize:   ()      => typeof __velox_getWindowSize   !== 'undefined' ? __velox_getWindowSize()   : { width: 0, height: 0 },
  getScreenSize:   ()      => typeof __velox_getScreenSize   !== 'undefined' ? __velox_getScreenSize()   : { width: 0, height: 0 },
  setAlwaysOnTop:  (on)    => typeof __velox_setAlwaysOnTop  !== 'undefined' && __velox_setAlwaysOnTop(on),
  setTitle:        (title) => typeof __velox_setTitle        !== 'undefined' && __velox_setTitle(title),
};

// ── File system API ───────────────────────────────────────────────────────────
//
// All methods return Promises. Requires `fs.read` / `fs.write` capabilities
// declared in `velox.config.json`. Attempting to call without the capability
// rejects the Promise with a descriptive error.
//
// Usage:
//   import { fs } from '@velox/react';
//   await fs.writeFile('data/notes.txt', 'hello');
//   const entries = await fs.listDir('data/');  // [{ name, isDir }, ...]

const _noBinding = (name) => Promise.reject(new Error(`${name}: binding not available`));

export const fs = {
  /** Read the entire file as a UTF-8 string. Requires `fs.read`. */
  readFile:   (path)          => typeof __velox_readFile   !== 'undefined' ? __velox_readFile(path)          : _noBinding('readFile'),
  /** Write (overwrite) a file with the given string content. Requires `fs.write`. */
  writeFile:  (path, content) => typeof __velox_writeFile  !== 'undefined' ? __velox_writeFile(path, content) : _noBinding('writeFile'),
  /** Append string content to a file (creates it if missing). Requires `fs.write`. */
  appendFile: (path, content) => typeof __velox_appendFile !== 'undefined' ? __velox_appendFile(path, content): _noBinding('appendFile'),
  /** List directory entries. Resolves with `[{ name: string, isDir: boolean }]`. Requires `fs.read`. */
  listDir:    (path)          => typeof __velox_listDir    !== 'undefined' ? __velox_listDir(path).then(JSON.parse)   : _noBinding('listDir'),
  /** Delete a file. Requires `fs.write`. */
  deleteFile: (path)          => typeof __velox_deleteFile !== 'undefined' ? __velox_deleteFile(path)         : _noBinding('deleteFile'),
  /** Create a directory and all missing parents. Requires `fs.write`. */
  mkdirp:     (path)          => typeof __velox_mkdirp     !== 'undefined' ? __velox_mkdirp(path)             : _noBinding('mkdirp'),
};

// ── SQLite database API ───────────────────────────────────────────────────────
//
// Thin async wrapper over the Rust `sqlx` bindings. Requires `db: true` in
// `velox.config.json`.
//
// Usage:
//   import { db } from '@velox/react';
//   const handle = await db.open('app.db');
//   await db.run(handle, 'CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT)');
//   await db.run(handle, 'INSERT INTO items (name) VALUES (?)', ['hello']);
//   const rows = await db.query(handle, 'SELECT * FROM items');  // [{ id, name }, ...]

// ── SQLite default-handle state ───────────────────────────────────────────────
//
// `_defaultHandle` is set automatically when the first db.open() resolves.
// This lets single-db apps skip passing the handle on every call:
//
//   Single-DB (simple):
//     await db.open('app.db');
//     await db.run('INSERT INTO items (name) VALUES (?)', ['hello']);
//     const rows = await db.query('SELECT * FROM items');
//
//   Multi-DB (explicit handle):
//     const h1 = await db.open('users.db');
//     const h2 = await db.open('logs.db');
//     db.setDefault(h2);
//     await db.run(h1, 'INSERT INTO users ...', []);   // explicit
//     await db.run('INSERT INTO logs ...', []);         // uses default (h2)

let _defaultHandle = null;

/** Resolve the handle: explicit number > default > error. */
function _dbHandle(h) {
  if (typeof h === 'number') return h;
  if (_defaultHandle !== null) return _defaultHandle;
  throw new Error('db: no handle provided and no default set (call db.open() first)');
}

export const db = {
  /**
   * Open (or create) a SQLite database at the given path.
   * `":memory:"` opens an in-memory database.
   * The first call auto-sets the default handle; use `db.setDefault(h)` to change it.
   * @returns {Promise<number>} Opaque integer handle for subsequent calls.
   */
  open: (path) =>
    typeof __velox_db_open !== 'undefined'
      ? __velox_db_open(path).then((s) => {
          const h = Number(s);
          if (_defaultHandle === null) _defaultHandle = h;
          return h;
        })
      : _noBinding('db.open'),

  /** Manually set the default handle used when no handle is passed to run/query/transaction. */
  setDefault: (handle) => { _defaultHandle = handle; },

  /**
   * Close a database and release its connections.
   * Idempotent — closing an already-closed handle is a no-op.
   * @param {number} [handle] - Defaults to the current default handle.
   * @returns {Promise<void>}
   */
  close: (handle) => {
    const h = handle ?? _defaultHandle;
    if (h === null || h === undefined) return Promise.resolve();
    if (_defaultHandle === h) _defaultHandle = null;
    return typeof __velox_db_close !== 'undefined'
      ? __velox_db_close(h)
      : _noBinding('db.close');
  },

  /**
   * Execute a SELECT statement and return all rows as plain objects.
   *
   * Overloaded — handle is optional when a default is set:
   *   db.query('SELECT * FROM items')             // uses default handle
   *   db.query('SELECT * FROM items WHERE id=?', [1])
   *   db.query(handle, 'SELECT * FROM items')     // explicit handle
   *   db.query(handle, 'SELECT * FROM items WHERE id=?', [1])
   *
   * @returns {Promise<Object[]>}
   */
  query: (handleOrSql, sqlOrParams = [], paramsOrUndef = []) => {
    const isExplicit = typeof handleOrSql === 'number';
    const handle = isExplicit ? handleOrSql        : _dbHandle(null);
    const sql    = isExplicit ? sqlOrParams         : handleOrSql;
    const params = isExplicit ? paramsOrUndef       : sqlOrParams;
    return typeof __velox_db_query !== 'undefined'
      ? __velox_db_query(handle, sql, JSON.stringify(params)).then(JSON.parse)
      : _noBinding('db.query');
  },

  /**
   * Execute an INSERT / UPDATE / DELETE / DDL statement.
   *
   * Overloaded — handle is optional when a default is set:
   *   db.run('CREATE TABLE IF NOT EXISTS ...')
   *   db.run('INSERT INTO items (name) VALUES (?)', ['hello'])
   *   db.run(handle, 'INSERT INTO items (name) VALUES (?)', ['hello'])
   *
   * @returns {Promise<{ rowsAffected: number, lastInsertId: number }>}
   */
  run: (handleOrSql, sqlOrParams = [], paramsOrUndef = []) => {
    const isExplicit = typeof handleOrSql === 'number';
    const handle = isExplicit ? handleOrSql  : _dbHandle(null);
    const sql    = isExplicit ? sqlOrParams   : handleOrSql;
    const params = isExplicit ? paramsOrUndef : sqlOrParams;
    return typeof __velox_db_run !== 'undefined'
      ? __velox_db_run(handle, sql, JSON.stringify(params)).then(JSON.parse)
      : _noBinding('db.run');
  },

  /**
   * Execute multiple SQL statements atomically in a single transaction.
   * Any failure rolls back all statements.
   *
   * Overloaded — handle is optional when a default is set:
   *   db.transaction([
   *     { sql: 'INSERT INTO a (x) VALUES (?)', params: [1] },
   *     { sql: 'UPDATE b SET n = n + 1 WHERE id = ?', params: [42] },
   *   ])
   *   db.transaction(handle, [...stmts])
   *
   * @returns {Promise<void>}
   */
  transaction: (handleOrStmts, stmtsOrUndef) => {
    const isExplicit = typeof handleOrStmts === 'number';
    const handle = isExplicit ? handleOrStmts : _dbHandle(null);
    const stmts  = isExplicit ? stmtsOrUndef  : handleOrStmts;
    return typeof __velox_db_transaction !== 'undefined'
      ? __velox_db_transaction(handle, JSON.stringify(stmts))
      : _noBinding('db.transaction');
  },
};

// ── Vector Database ────────────────────────────────────────────────────────────
//
// vectorDb.open(path) → Promise<VectorDbHandle>
//
// VectorDbHandle:
//   .upsert(table, id, vector, metadata?) → Promise<void>
//   .search(table, queryVector, limit?)   → Promise<{id,score,metadata}[]>
//   .close()                             → Promise<void>

export const vectorDb = {
  /**
   * Open (or create) a vector store at the given path.
   * `":memory:"` opens an in-process ephemeral store (lost on close).
   * @param {string} path
   * @returns {Promise<VectorDbHandle>}
   */
  open: (path) => {
    if (typeof __velox_vectorDb_open === 'undefined') return _noBinding('vectorDb.open');
    return __velox_vectorDb_open(path).then((s) => {
      const handle = Number(s);
      return {
        /**
         * Insert or replace a vector record.
         * @param {string}   table    — collection name
         * @param {string}   id       — unique record key
         * @param {number[]} vector   — embedding (array of floats)
         * @param {any}      [meta]   — optional metadata (JSON-serialisable)
         * @returns {Promise<void>}
         */
        upsert(table, id, vector, meta) {
          const metaStr = meta !== undefined ? JSON.stringify(meta) : '';
          return __velox_vectorDb_upsert(handle, table, id, JSON.stringify(vector), metaStr);
        },

        /**
         * Find the nearest vectors by cosine similarity.
         * @param {string}   table       — collection name
         * @param {number[]} queryVector — query embedding
         * @param {number}   [limit=10]  — max results
         * @returns {Promise<{id:string, score:number, metadata:any}[]>}
         */
        search(table, queryVector, limit = 10) {
          return __velox_vectorDb_search(handle, table, JSON.stringify(queryVector), limit)
            .then(JSON.parse);
        },

        /**
         * Close the vector store and release its resources.
         * @returns {Promise<void>}
         */
        close() {
          return __velox_vectorDb_close(handle);
        },
      };
    });
  },
};

// ── File Dialogs ───────────────────────────────────────────────────────────────
//
// Requires `dialog: true` capability in velox.config.json.
//
// dialog.openFile({ filters?, multiple? }) → Promise<string[] | null>
// dialog.saveFile({ defaultName?, filters? }) → Promise<string | null>
// dialog.openFolder()                         → Promise<string | null>
//
// Filter shape: [{ name: string, extensions: string[] }]

export const dialog = {
  /**
   * Show a native open-file dialog.
   * @param {{ filters?: {name:string,extensions:string[]}[], multiple?: boolean }} [opts]
   * @returns {Promise<string[] | null>} Selected path(s), or null if cancelled.
   */
  openFile({ filters = [], multiple = false } = {}) {
    if (typeof __velox_dialog_openFile === 'undefined') return _noBinding('dialog.openFile');
    return __velox_dialog_openFile(JSON.stringify(filters), multiple).then(JSON.parse);
  },

  /**
   * Show a native save-file dialog.
   * @param {{ defaultName?: string, filters?: {name:string,extensions:string[]}[] }} [opts]
   * @returns {Promise<string | null>} Chosen save path, or null if cancelled.
   */
  saveFile({ defaultName = '', filters = [] } = {}) {
    if (typeof __velox_dialog_saveFile === 'undefined') return _noBinding('dialog.saveFile');
    return __velox_dialog_saveFile(defaultName, JSON.stringify(filters)).then(JSON.parse);
  },

  /**
   * Show a native open-folder dialog.
   * @returns {Promise<string | null>} Selected folder path, or null if cancelled.
   */
  openFolder() {
    if (typeof __velox_dialog_openFolder === 'undefined') return _noBinding('dialog.openFolder');
    return __velox_dialog_openFolder().then(JSON.parse);
  },
};

// ── Clipboard ─────────────────────────────────────────────────────────────────
//
// Requires `clipboard: true` capability in velox.config.json.

export const clipboard = {
  /**
   * Read plain text from the system clipboard.
   * @returns {Promise<string>}
   */
  readText() {
    if (typeof __velox_clipboard_readText === 'undefined') return _noBinding('clipboard.readText');
    return __velox_clipboard_readText();
  },

  /**
   * Write plain text to the system clipboard.
   * @param {string} text
   * @returns {Promise<void>}
   */
  writeText(text) {
    if (typeof __velox_clipboard_writeText === 'undefined') return _noBinding('clipboard.writeText');
    return __velox_clipboard_writeText(text);
  },
};

// ── Notifications ─────────────────────────────────────────────────────────────
//
// Requires `notification: true` capability in velox.config.json.

export const notification = {
  /**
   * Send a native desktop notification. Fire-and-forget; never rejects.
   * @param {{ title: string, body?: string }} opts
   * @returns {Promise<void>}
   */
  send({ title, body = '' }) {
    if (typeof __velox_notification_send === 'undefined') return _noBinding('notification.send');
    return __velox_notification_send(title, body);
  },
};

// ── fetch ─────────────────────────────────────────────────────────────────────
//
// Browser-compatible fetch API backed by the Rust reqwest HTTP client.
// Requires `network.allow` capability in velox.config.json:
//   { "capabilities": { "network": { "allow": ["api.example.com"] } } }
// Use ["*"] to allow all outbound requests.
//
// Response shape mirrors the browser Fetch API (subset):
//   res.status      → number
//   res.ok          → boolean (true when 200-299)
//   res.statusText  → string
//   res.headers     → plain object  { "content-type": "..." }
//   res.text()      → Promise<string>
//   res.json()      → Promise<any>

/**
 * Make an HTTP request.
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string,string>, body?: string }} [options]
 * @returns {Promise<{ status: number, ok: boolean, statusText: string,
 *                     headers: Record<string,string>,
 *                     text: () => Promise<string>, json: () => Promise<any> }>}
 */
export async function fetch(url, options = {}) {
  if (typeof __velox_fetch === 'undefined') {
    throw new Error('fetch: __velox_fetch binding is not available');
  }
  const raw  = await __velox_fetch(url, JSON.stringify(options));
  const data = JSON.parse(raw);
  return {
    status:     data.status,
    ok:         data.ok,
    statusText: data.statusText,
    headers:    data.headers ?? {},
    text:       () => Promise.resolve(data.body),
    json:       () => Promise.resolve(JSON.parse(data.body)),
  };
}

// ── WebSocket ─────────────────────────────────────────────────────────────────
//
// Drains each open socket's inbox once per frame and fires registered handlers.
// Called from __velox_frameCallback (defined above) inside flushSync so that
// onmessage callbacks that call setState are batched with the rest of the frame.
function _pollWebSockets() {
  for (const [id, handlers] of _wsOpenSockets) {
    let raw;
    try { raw = __velox_ws_poll(id); } catch { continue; }
    if (!raw) continue;
    let msgs;
    try { msgs = JSON.parse(raw); } catch { continue; }
    for (const m of msgs) {
      if (m === '__VELOX_WS_CLOSED__') {
        handlers.onclose?.();
        _wsOpenSockets.delete(id);
        break;
      } else {
        handlers.onmessage?.({ data: m });
      }
    }
  }
}

/**
 * WebSocket API.
 *
 * @example
 * const socket = await ws.connect('wss://echo.websocket.org', {
 *   onmessage: (ev) => console.log('received:', ev.data),
 *   onclose:   ()   => console.log('closed'),
 * });
 * socket.send('Hello!');
 * // later:
 * socket.close();
 */
// ── mDNS service discovery ────────────────────────────────────────────────────
//
// Requires `mdns: true` capability in velox.config.json.
//
// Usage:
//   import { mdns } from '@velox/react';
//   const services = await mdns.discover('_http._tcp.local.', { timeout: 4000 });
//   // [{ name, hostname, port, addresses: string[] }, ...]

export const mdns = {
  /**
   * Browse for mDNS/Bonjour services of the given type.
   * @param {string} serviceType  e.g. "_http._tcp.local."
   * @param {{ timeout?: number }} [opts]  timeout in ms (default 5000)
   * @returns {Promise<{name:string, hostname:string, port:number, addresses:string[]}[]>}
   */
  discover(serviceType, { timeout = 5000 } = {}) {
    if (typeof __velox_mdns_discover === 'undefined') return _noBinding('mdns.discover');
    return __velox_mdns_discover(serviceType, timeout).then(JSON.parse);
  },
};

export const ws = {
  /**
   * Open a WebSocket connection.
   *
   * @param {string} url  ws:// or wss:// URL
   * @param {{ onmessage?: (ev: {data:string}) => void,
   *            onclose?:  () => void,
   *            onerror?:  (err: string) => void }} [handlers]
   * @returns {Promise<{ send: (msg:string)=>void, close: ()=>void, id: number }>}
   */
  connect(url, handlers = {}) {
    return __velox_ws_connect(url).then(idStr => {
      const id = Number(idStr);
      _wsOpenSockets.set(id, handlers);
      return {
        get id() { return id; },
        send(msg)  { __velox_ws_send(id, String(msg)); },
        close()    {
          __velox_ws_close(id);
          _wsOpenSockets.delete(id);
          handlers.onclose?.();
        },
      };
    });
  },
};

// ── IPC (inter-window messaging) ──────────────────────────────────────────────
//
// Drain this window's IPC inbox each frame and fire registered listeners.
function _pollIpc() {
  if (typeof __velox_ipc_poll === 'undefined') return;
  let raw;
  try { raw = __velox_ipc_poll(); } catch { return; }
  if (!raw) return;
  let msgs;
  try { msgs = JSON.parse(raw); } catch { return; }
  for (const msg of msgs) {
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
 * const child = await veloxWindow.create({ title: 'Inspector', width: 400, height: 600 });
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
    if (typeof __velox_ipc_send !== 'undefined') {
      __velox_ipc_send(targetHandle, String(message));
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

// ── Multi-window ──────────────────────────────────────────────────────────────
//
// Extends veloxWindow with a create() method for opening secondary windows.
// This export adds to the existing veloxWindow object (defined earlier in the
// file) — import veloxWindow to use all window control methods.

/**
 * Open a secondary window running an independent instance of the app.
 * Returns a handle object usable with the `ipc` API.
 *
 * @param {{ title?: string, width?: number, height?: number }} opts
 * @returns {Promise<{ id: number, send: (msg: string) => void }>}
 *
 * @example
 * const win = await veloxWindow.create({ title: 'Inspector', width: 400, height: 600 });
 * win.send(JSON.stringify({ type: 'hello' }));
 */
veloxWindow.create = function create(opts = {}) {
  if (typeof __velox_window_create === 'undefined') return _noBinding('veloxWindow.create');
  return __velox_window_create(JSON.stringify(opts)).then(idStr => {
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
veloxWindow.quit = function quit() {
  if (typeof __velox_quit !== 'undefined') __velox_quit();
};

// ── Performance monitoring ────────────────────────────────────────────────────

/**
 * Performance monitoring API.
 *
 * @example
 * const snap = perf.snapshot();
 * // → { fps: 60.1, frameTime: 14.2, frameTimeP99: 18.5, jsTime: 2.1,
 * //      layoutTime: 0.8, memoryJS: 12.4, nodeCount: 42 }
 *
 * const unsub = perf.onBudgetExceeded((v) => console.log('slow frame:', v), { target: 16.667 });
 * unsub(); // remove listener
 */
export const perf = {
  /**
   * Synchronously returns a snapshot of current performance metrics.
   * @returns {{ fps, frameTime, frameTimeP99, jsTime, layoutTime, memoryJS, nodeCount }}
   */
  snapshot() {
    if (typeof __velox_perf_snapshot === 'undefined') return null;
    try { return JSON.parse(__velox_perf_snapshot()); } catch { return null; }
  },

  /**
   * Register a callback fired whenever a frame exceeds `target` ms.
   * @param {function} cb  Called with `{ budget, actual, jsTime, layoutTime }`
   * @param {{ target?: number }} opts  Default target = 16.667 ms (60 fps)
   * @returns {function} Unsubscribe function
   */
  onBudgetExceeded(cb, { target = 16.667 } = {}) {
    if (typeof __velox_perf_set_budget !== 'undefined') __velox_perf_set_budget(target);
    _perfBudgetCallbacks.push(cb);
    return function unsubscribe() {
      const idx = _perfBudgetCallbacks.indexOf(cb);
      if (idx !== -1) _perfBudgetCallbacks.splice(idx, 1);
    };
  },
};

// ── OS system APIs ────────────────────────────────────────────────────────────

export const battery = {
  /** @returns {Promise<{level:number, charging:boolean, timeRemainingSecs:number|null}|null>} */
  async getStatus() {
    if (typeof __velox_battery_getStatus === 'undefined') return null;
    const raw = await __velox_battery_getStatus();
    return raw === 'null' ? null : JSON.parse(raw);
  },
};

export const system = {
  /** @returns {Promise<{cpuName,cpuCores,memoryTotalMb,memoryUsedMb,osName,osVersion}>} */
  async getInfo() {
    if (typeof __velox_system_getInfo === 'undefined') return null;
    return JSON.parse(await __velox_system_getInfo());
  },
};

export const power = {
  /** Prevent system sleep. Returns a guard handle string. */
  preventSleep(reason = 'Velox app running') {
    if (typeof __velox_power_preventSleep === 'undefined') return null;
    return __velox_power_preventSleep(reason);
  },
  /** Release sleep prevention guard by handle string. */
  allowSleep(handle) {
    if (typeof __velox_power_allowSleep !== 'undefined') __velox_power_allowSleep(handle);
  },
};

export const storage = {
  /** @returns {Promise<Array<{name,mountPoint,totalBytes,availableBytes}>>} */
  async getDrives() {
    if (typeof __velox_storage_getDrives === 'undefined') return [];
    return JSON.parse(await __velox_storage_getDrives());
  },
};

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
      const prev = globalThis.__velox_gamepadCb;
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
      if (typeof __velox_shortcut_register === 'undefined') return null;
      try {
        const id = Number(__velox_shortcut_register(accelerator));
        _globalShortcutCallbacks.set(id, cb);
        return String(id);
      } catch (e) {
        __velox_log('[shortcut] register error: ' + e);
        return null;
      }
    },
    unregister(id) {
      const numId = Number(id);
      _globalShortcutCallbacks.delete(numId);
      if (typeof __velox_shortcut_unregister !== 'undefined') __velox_shortcut_unregister(String(numId));
    },
  },

  /** App-focused shortcuts — fires when the app window is focused. */
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
