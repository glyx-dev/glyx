// @velox/react — React renderer for the Velox runtime.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Reconciler from 'react-reconciler';
import HostConfig from './hostConfig.js';
import {
  registerPressable, unregisterPressable,
  registerInput, unregisterInput,
  registerScrollView, unregisterScrollView,
  registerDraggable, unregisterDraggable,
  dispatchEvents,
  addWindowSizeListener, removeWindowSizeListener,
  addKeyListener,
  addGlobalClickListener, removeGlobalClickListener,
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

// ── Deep link polling ─────────────────────────────────────────────────────────
//
// Forwarded URLs arrive each frame via __velox_deeplink_poll().
// The initial launch URL is retrieved once on startup via __velox_deeplink_getInitialUrl().

const _deeplinkCallbacks = [];
let   _deeplinkInitialFired = false;

function _pollDeeplinks() {
  // Fire initial URL once (the URL that launched this instance of the app).
  if (!_deeplinkInitialFired && _deeplinkCallbacks.length > 0) {
    _deeplinkInitialFired = true;
    if (typeof __velox_deeplink_getInitialUrl !== 'undefined') {
      try {
        const url = __velox_deeplink_getInitialUrl();
        if (url) {
          for (const cb of _deeplinkCallbacks) {
            try { cb(url); } catch (e) { __velox_log('[deeplink] callback error: ' + e); }
          }
        }
      } catch {}
    }
  }

  // Drain forwarded URLs from the single-instance listener queue.
  if (typeof __velox_deeplink_poll === 'undefined') return;
  let raw;
  try { raw = __velox_deeplink_poll(); } catch { return; }
  if (!raw || raw === '[]') return;
  let urls;
  try { urls = JSON.parse(raw); } catch { return; }
  for (const url of urls) {
    for (const cb of _deeplinkCallbacks) {
      try { cb(url); } catch (e) { __velox_log('[deeplink] callback error: ' + e); }
    }
  }
}

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

// ── Perf violation + leak polling ─────────────────────────────────────────────

const _perfBudgetCallbacks = [];
const _perfLeakCallbacks   = [];

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

function _pollLeakWarnings() {
  if (typeof __velox_perf_poll_leak_warnings === 'undefined') return;
  if (_perfLeakCallbacks.length === 0) return;
  let raw;
  try { raw = __velox_perf_poll_leak_warnings(); } catch { return; }
  if (!raw || raw === '[]') return;
  let warnings;
  try { warnings = JSON.parse(raw); } catch { return; }
  for (const w of warnings) {
    for (const cb of _perfLeakCallbacks) {
      try { cb(w); } catch (e) { __velox_log('[perf] onLeakDetected callback error: ' + e); }
    }
  }
}

// ── Audio event polling ───────────────────────────────────────────────────────
//
// Drains `__velox_audio_poll()` each frame and fires registered onEnded callbacks.
// Map: handle (string) → array of { onEnded } objects.

const _audioCallbacks = new Map();

function _pollAudio() {
  if (typeof __velox_audio_poll === 'undefined') return;
  let raw;
  try { raw = __velox_audio_poll(); } catch { return; }
  if (!raw || raw === '[]') return;
  let events;
  try { events = JSON.parse(raw); } catch { return; }
  for (const ev of events) {
    const key = String(ev.handle);
    const cbs = _audioCallbacks.get(key);
    if (cbs) {
      for (const cb of cbs) {
        if (ev.event === 'ended' && cb.onEnded) {
          try { cb.onEnded(); } catch (e) { __velox_log('[audio] onEnded error: ' + e); }
        }
      }
      if (ev.event === 'ended') _audioCallbacks.delete(key);
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
    // Drain deferred setTimeout callbacks (animation loops, React scheduler).
    globalThis._veloxDrainTimers?.();
    _pollWebSockets();
    _pollIpc();
    _pollDeeplinks();
    _pollGamepads();
    _pollGlobalShortcuts();
    _pollPerfViolations();
    _pollLeakWarnings();
    _pollAudio();
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
      if ((key === 'ArrowUp' || key === 'ArrowDown') && multiline) {
        // Split at current anchor to find line index + column.
        const lines = value.split('\n');
        let lineIdx = 0, lineStart = 0;
        for (let i = 0; i < lines.length; i++) {
          const lineEnd = lineStart + lines[i].length;
          if (anchor <= lineEnd || i === lines.length - 1) { lineIdx = i; break; }
          lineStart += lines[i].length + 1;
        }
        const col = anchor - lineStart;
        if (key === 'ArrowUp' && lineIdx > 0) {
          const prevLineStart = lineStart - lines[lineIdx - 1].length - 1;
          const newPos = prevLineStart + Math.min(col, lines[lineIdx - 1].length);
          if (shift) { extendTo(newPos); } else { moveCursor(newPos); }
        } else if (key === 'ArrowDown' && lineIdx < lines.length - 1) {
          const nextLineStart = lineStart + lines[lineIdx].length + 1;
          const newPos = nextLineStart + Math.min(col, lines[lineIdx + 1].length);
          if (shift) { extendTo(newPos); } else { moveCursor(newPos); }
        }
        return;
      }
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
    onClickAt: (relX, relY) => {
      // Estimate character index from click position using avg char width heuristic.
      const padding = multiline ? 10 : 8;
      const textX   = relX - padding;
      const avgW    = fontSize * 0.55; // rough avg glyph advance for most sans-serif fonts

      if (multiline) {
        const lineHeight   = fontSize * 1.4;
        const lineIdx      = Math.max(0, Math.floor((relY - padding) / lineHeight));
        const lines        = value.split('\n');
        const clampedLine  = Math.min(lineIdx, lines.length - 1);
        const col          = Math.max(0, Math.min(Math.round(Math.max(0, textX) / avgW), lines[clampedLine].length));
        let pos = 0;
        for (let i = 0; i < clampedLine; i++) pos += lines[i].length + 1;
        moveCursor(pos + col);
      } else {
        const col = Math.max(0, Math.min(Math.round(Math.max(0, textX) / avgW), value.length));
        moveCursor(col);
      }
    },
  };

  const onMount = useCallback((id) => {
    nodeIdRef.current = id;
    registerInput(id, {
      onFocus:    () => handlersRef.current.onFocus(),
      onBlur:     () => handlersRef.current.onBlur(),
      onKeyPress: (ev) => handlersRef.current.onKeyPress(ev),
      onClickAt:  (relX, relY) => handlersRef.current.onClickAt(relX, relY),
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
    clip: true,   // prevent text from rendering outside the input bounds
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
  readFile:   (path)          => typeof __velox_readFile      !== 'undefined' ? __velox_readFile(path)          : _noBinding('readFile'),
  /**
   * Read the entire file as raw bytes, returned as a base64-encoded string.
   * Use this for binary files (images, PDFs, etc.) before uploading via fetch multipart.
   * Requires `fs.read`.
   */
  readFileBytes: (path)       => typeof __velox_readFileBytes !== 'undefined' ? __velox_readFileBytes(path)     : _noBinding('readFileBytes'),
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
    return __velox_dialog_openFile(JSON.stringify(filters), multiple).then(raw => {
      const result = JSON.parse(raw);
      if (result === null) return null;
      // multiple=false returns a bare JSON string; multiple=true returns a JSON array.
      // Always normalise to string[] so callers can use result[0] uniformly.
      return Array.isArray(result) ? result : [result];
    });
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
 *
 * Supports plain string bodies and multipart/form-data uploads:
 * ```js
 * // JSON POST
 * fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'},
 *              body: JSON.stringify(payload) });
 *
 * // Multipart upload (text field + binary file)
 * const bytes = await fs.readFileBytes(filePath);          // base64 string
 * fetch(url, { method: 'POST', multipart: [
 *   { name: 'description', value: 'my upload' },
 *   { name: 'file', filename: 'photo.jpg', base64: bytes, contentType: 'image/jpeg' },
 * ]});
 * ```
 *
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string,string>,
 *           body?: string,
 *           multipart?: Array<{name:string, value?:string, filename?:string,
 *                              base64?:string, contentType?:string}> }} [options]
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

/**
 * Restart the application — quits cleanly then re-launches the same executable.
 * Useful after applying an update or settings that require a full reload.
 */
veloxWindow.restart = function restart() {
  if (typeof __velox_restart !== 'undefined') __velox_restart();
};

/**
 * Close the window (main window: exits the app; secondary windows: closes that window).
 * In the current implementation this is equivalent to `veloxWindow.quit()`.
 */
veloxWindow.close = function close() {
  if (typeof __velox_window_close !== 'undefined') __velox_window_close();
};

/** Cache so platform() never calls the binding twice. */
let _platformCache = null;

/**
 * Returns the host OS: `"windows"` | `"macos"` | `"linux"`.
 * Value is determined at compile time and never changes at runtime.
 */
veloxWindow.platform = function platform() {
  if (_platformCache !== null) return _platformCache;
  _platformCache = typeof __velox_platform !== 'undefined' ? __velox_platform() : 'unknown';
  return _platformCache;
};

// ── Performance monitoring ────────────────────────────────────────────────────

/**
 * Performance monitoring API.
 *
 * @example
 * const snap = perf.snapshot();
 * // → { fps: 60.1, frameTime: 14.2, frameTimeP99: 18.5, jsTime: 2.1,
 * //      layoutTime: 0.8, gpuTime: 1.3, memoryJS: 12.4, nodeCount: 42 }
 *
 * const unsub = perf.onBudgetExceeded((v) => console.log('slow frame:', v), { target: 16.667 });
 * unsub(); // remove listener
 */
export const perf = {
  /**
   * Synchronously returns a snapshot of current performance metrics.
   * @returns {{ fps, frameTime, frameTimeP99, jsTime, layoutTime, gpuTime, memoryJS, nodeCount }}
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
  /**
   * Register a callback for dev-mode memory/node leak warnings.
   * Fires when the Rust layer detects a sustained monotonic growth in node count.
   * Only active in dev builds (no-op in production).
   * @param {(warning: {type: string, count: number, msg: string}) => void} cb
   * @returns {() => void} unsubscribe function
   */
  onLeakDetected(cb) {
    _perfLeakCallbacks.push(cb);
    return function unsubscribe() {
      const idx = _perfLeakCallbacks.indexOf(cb);
      if (idx !== -1) _perfLeakCallbacks.splice(idx, 1);
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
  /**
   * Returns the OS-level color scheme preference synchronously (~1 µs).
   * @returns {"dark"|"light"|"unknown"}
   */
  getDarkMode() {
    if (typeof __velox_system_getDarkMode === 'undefined') return 'unknown';
    return __velox_system_getDarkMode();
  },
  /**
   * Returns whether battery-saver / power-saver mode is active synchronously (~1 µs).
   * Windows: reads GetSystemPowerStatus(). macOS/Linux: always false until native support lands.
   * @returns {boolean}
   */
  isBatterySaverActive() {
    if (typeof __velox_system_getBatterySaver === 'undefined') return false;
    return __velox_system_getBatterySaver();
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

/**
 * OS credential store — Windows Credential Manager, macOS Keychain, Linux Secret Service.
 * Data is encrypted by the OS and tied to the logged-in user account.
 * Never stored as plaintext on disk. Survives app restarts.
 *
 * Use for: auth tokens, session IDs, API keys the user provides at runtime.
 * Do NOT embed build-time secrets in the binary — use a backend proxy instead.
 *
 * Requires `credentials: true` in velox.config.ts capabilities.
 */
export const credentials = {
  /**
   * Store a secret. Replaces any existing value for the same key.
   * @param {string} key
   * @param {string} value
   * @param {{ service?: string }} [options]  service defaults to 'velox'
   * @returns {Promise<void>}
   */
  async set(key, value, { service = 'velox' } = {}) {
    await __velox_credentials_set(service, key, value);
  },
  /**
   * Retrieve a secret. Returns null if no entry exists.
   * @param {string} key
   * @param {{ service?: string }} [options]
   * @returns {Promise<string|null>}
   */
  async get(key, { service = 'velox' } = {}) {
    const raw = await __velox_credentials_get(service, key);
    return raw === 'null' ? null : JSON.parse(raw);
  },
  /**
   * Delete a secret. No-op if it does not exist.
   * @param {string} key
   * @param {{ service?: string }} [options]
   * @returns {Promise<void>}
   */
  async delete(key, { service = 'velox' } = {}) {
    await __velox_credentials_delete(service, key);
  },
};

// ── Audio playback ────────────────────────────────────────────────────────────

/**
 * Audio playback API.
 *
 * Capability: `audio: true` in velox.config.json.
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
    if (typeof __velox_audio_play === 'undefined')
      throw new Error('audio binding unavailable');
    const rawId = await __velox_audio_play(src, JSON.stringify({ volume }));
    const id = String(JSON.parse(rawId));
    if (onEnded) {
      if (!_audioCallbacks.has(id)) _audioCallbacks.set(id, []);
      _audioCallbacks.get(id).push({ onEnded });
    }
    return {
      id,
      pause()           { if (typeof __velox_audio_pause     !== 'undefined') __velox_audio_pause(id); },
      resume()          { if (typeof __velox_audio_resume    !== 'undefined') __velox_audio_resume(id); },
      stop()            { if (typeof __velox_audio_stop      !== 'undefined') __velox_audio_stop(id); _audioCallbacks.delete(id); },
      setVolume(v)      { if (typeof __velox_audio_setVolume !== 'undefined') __velox_audio_setVolume(id, v); },
      getVolume()       { return typeof __velox_audio_getVolume !== 'undefined' ? __velox_audio_getVolume(id) : 1.0; },
      onEnded(cb)       {
        if (!_audioCallbacks.has(id)) _audioCallbacks.set(id, []);
        _audioCallbacks.get(id).push({ onEnded: cb });
      },
    };
  },
};

// ── Form field components ─────────────────────────────────────────────────────
//
// Tier 1: pure React components, no new native bindings.
// All styled for the Velox dark-blue aesthetic.

/**
 * Controlled checkbox.
 *
 * @param {{ checked?: boolean, onChange?: function, disabled?: boolean,
 *           label?: string, style?: object }} props
 */
export function Checkbox({ checked = false, onChange, disabled = false, label, style, ...rest }) {
  const SIZE = 20;
  const active = checked && !disabled;
  const box = React.createElement(View, {
    style: {
      width: SIZE, height: SIZE,
      borderWidth: 2,
      borderColor: disabled ? '#555' : (active ? '#7aa2f7' : '#555'),
      borderRadius: 4,
      backgroundColor: active ? '#7aa2f7' : 'transparent',
      justifyContent: 'center',
      alignItems: 'center',
    },
  },
    // Draw the check indicator as a small inner View (no font dependency).
    active ? React.createElement(View, {
      style: { width: 10, height: 10, backgroundColor: '#171923', borderRadius: 2 },
    }) : null,
  );

  const lbl = label != null
    ? React.createElement(Text, { style: { color: disabled ? '#555' : '#e7ecff', fontSize: 14 } }, String(label))
    : null;

  return React.createElement(Pressable, {
    onPress: () => { if (!disabled && onChange) onChange(!checked); },
    style: { flexDirection: 'row', alignItems: 'center', gap: 8, ...style },
    ...rest,
  }, box, lbl);
}

/**
 * Toggle switch.
 *
 * @param {{ value?: boolean, onValueChange?: function, disabled?: boolean,
 *           style?: object }} props
 */
export function Switch({ value = false, onValueChange, disabled = false, style, ...rest }) {
  return React.createElement(Pressable, {
    onPress: () => { if (!disabled && onValueChange) onValueChange(!value); },
    style: {
      width: 48, height: 24,
      backgroundColor: disabled ? '#333' : (value ? '#7aa2f7' : '#3c4464'),
      borderRadius: 12,
      justifyContent: 'center',
      alignItems: value ? 'flex-end' : 'flex-start',
      padding: 2,
      ...style,
    },
    ...rest,
  },
    React.createElement(View, {
      style: { width: 20, height: 20, backgroundColor: disabled ? '#666' : '#fff', borderRadius: 10 },
    })
  );
}

// Context for RadioGroup → Radio communication.
const _RadioCtx = React.createContext(null);

/**
 * Radio button group wrapper. Provides context for child Radio components.
 *
 * @param {{ value: any, onValueChange?: function, children, style?: object }} props
 */
export function RadioGroup({ value, onValueChange, children, style, ...rest }) {
  return React.createElement(
    _RadioCtx.Provider,
    { value: { value, onValueChange } },
    React.createElement(View, { style: { gap: 8, ...style }, ...rest }, children)
  );
}

/**
 * Individual radio option. Must be a descendant of RadioGroup.
 *
 * @param {{ value: any, label?: string, disabled?: boolean, style?: object }} props
 */
export function Radio({ value, label, disabled = false, style, ...rest }) {
  const ctx      = React.useContext(_RadioCtx);
  const selected = ctx != null && ctx.value === value;
  const ringColor = disabled ? '#555' : (selected ? '#7aa2f7' : '#555');

  const circle = React.createElement(View, {
    style: {
      width: 20, height: 20,
      borderWidth: 2,
      borderColor: ringColor,
      borderRadius: 10,
      justifyContent: 'center',
      alignItems: 'center',
      backgroundColor: 'transparent',
    },
  }, selected ? React.createElement(View, {
    style: { width: 10, height: 10, backgroundColor: disabled ? '#555' : '#7aa2f7', borderRadius: 5 },
  }) : null);

  const lbl = label != null
    ? React.createElement(Text, { style: { color: disabled ? '#555' : '#e7ecff', fontSize: 14 } }, String(label))
    : null;

  return React.createElement(Pressable, {
    onPress: () => { if (!disabled && ctx && ctx.onValueChange) ctx.onValueChange(value); },
    style: { flexDirection: 'row', alignItems: 'center', gap: 8, ...style },
    ...rest,
  }, circle, lbl);
}

/**
 * File picker button. Opens the OS file dialog and fires `onFilesSelected`
 * with an array of selected absolute paths.
 *
 * Requires `dialog: true` capability in velox.config.json.
 *
 * @param {{ onFilesSelected?: function, accept?: string, multiple?: boolean,
 *           label?: string, disabled?: boolean, style?: object }} props
 */
export function FileInput({
  onFilesSelected,
  accept,
  multiple = false,
  label = 'Browse files\u2026',
  disabled = false,
  style,
  ...rest
}) {
  const handlePress = () => {
    if (disabled) return;
    const filters = accept
      ? accept.split(',').map(e => e.trim().replace(/^\./, ''))
      : [];
    dialog.openFile({ filters, multiple })
      .then(paths => {
        if (paths && paths.length > 0 && onFilesSelected) onFilesSelected(paths);
      })
      .catch(e => __velox_log('[FileInput] error: ' + e));
  };

  return React.createElement(Pressable, {
    onPress: handlePress,
    style: {
      padding: 8,
      backgroundColor: disabled ? '#1f2333' : '#262b3f',
      borderWidth: 1,
      borderColor: disabled ? '#3c4464' : '#7aa2f7',
      borderRadius: 6,
      justifyContent: 'center',
      alignItems: 'center',
      ...style,
    },
    ...rest,
  },
    React.createElement(Text, {
      style: { color: disabled ? '#555' : '#7aa2f7', fontSize: 14 },
    }, label)
  );
}

// ── Local AI (Candle) ─────────────────────────────────────────────────────────
//
// Capability gate: `ai: true` in velox.config.json.
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
    if (typeof __velox_ai_embed === 'undefined')
      throw new Error('ai.embed: binding unavailable — add ai:true to velox.config.json');
    const raw = await __velox_ai_embed(String(text));
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
    if (typeof __velox_ai_generate === 'undefined')
      throw new Error('ai.generate: binding unavailable — add ai:true to velox.config.json');
    return __velox_ai_generate(String(prompt), JSON.stringify({ maxTokens, temperature }));
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
    if (typeof __velox_ai_transcribe === 'undefined')
      throw new Error('ai.transcribe: binding unavailable — add ai:true to velox.config.json');
    return __velox_ai_transcribe(String(audioPath), JSON.stringify({ language }));
  },
};

// ── Camera API ────────────────────────────────────────────────────────────────

export const camera = {
  /** List connected camera devices. @returns {Promise<{index:number,name:string}[]>} */
  async listDevices() {
    return JSON.parse(await __velox_camera_list());
  },
  /** Open camera by device index. @returns {Promise<number>} handle ID */
  async open(deviceIndex = 0) {
    return parseInt(await __velox_camera_open(deviceIndex));
  },
  /** Close a previously opened camera. @param {number} handle */
  close(handle) {
    __velox_camera_close(String(handle));
  },
  /**
   * Capture the current frame as a PNG file.
   * @param {number} handle  Handle returned by open() or Camera.start().
   * @returns {Promise<string>}  Absolute path to the saved PNG.
   */
  async capture(handle) {
    return __velox_camera_capture(String(handle));
  },
  /**
   * Start recording to an MP4 file via ffmpeg (must be in PATH).
   * @param {number} handle
   * @param {string} outputPath  Absolute path for the output MP4.
   */
  startRecord(handle, outputPath) {
    __velox_camera_record_start(String(handle), outputPath);
  },
  /**
   * Stop recording and flush the MP4.
   * @param {number} handle
   * @returns {Promise<string>}  Absolute path to the finished MP4.
   */
  async stopRecord(handle) {
    return __velox_camera_record_stop(String(handle));
  },
};

// ── Microphone API ────────────────────────────────────────────────────────────

export const microphone = {
  /** List connected input devices. @returns {Promise<{name:string}[]>} */
  async listDevices() {
    return JSON.parse(await __velox_microphone_list());
  },
  /**
   * Record from the microphone to a WAV file.
   * @param {number} [durationMs=3000] Recording duration in milliseconds.
   * @param {string|null} [deviceName=null] Device name, or null for default.
   * @returns {Promise<string>} Absolute path to the recorded WAV file.
   */
  async record(durationMs = 3000, deviceName = null) {
    return __velox_microphone_record(deviceName || '', durationMs);
  },
};

// ── Camera component ──────────────────────────────────────────────────────────
//
// Renders a live camera preview as a native node — frames NEVER cross the JS
// bridge. JS only controls lifecycle (open / close / capture / record).
//
// Usage:
//   const camRef = useRef();
//   <Camera ref={camRef} mirror style={{ width: 640, height: 480 }} />
//   await camRef.current.start(0);       // open device index 0
//   const path = await camRef.current.capture();   // take photo → PNG path
//   camRef.current.startRecord('/tmp/out.mp4');
//   const mp4 = await camRef.current.stopRecord(); // flush → MP4 path
//   camRef.current.stop();

export const Camera = React.forwardRef(function Camera({ mirror, style, ...rest }, ref) {
  const [cameraHandle, setCameraHandle] = React.useState(null);

  React.useImperativeHandle(ref, () => ({
    /** @returns {number|null} current handle, or null if not open */
    get handle() { return cameraHandle; },

    async start(deviceIndex = 0) {
      const handle = parseInt(await __velox_camera_open(deviceIndex));
      setCameraHandle(handle);
      return handle;
    },
    stop() {
      if (cameraHandle !== null) {
        __velox_camera_close(String(cameraHandle));
        setCameraHandle(null);
      }
    },
    /** Capture current frame → PNG. @returns {Promise<string>} path */
    async capture() {
      if (cameraHandle === null) throw new Error('Camera not open');
      return __velox_camera_capture(String(cameraHandle));
    },
    /** Start MP4 recording via ffmpeg. @param {string} outputPath */
    startRecord(outputPath) {
      if (cameraHandle === null) throw new Error('Camera not open');
      __velox_camera_record_start(String(cameraHandle), outputPath);
    },
    /** Stop recording and flush MP4. @returns {Promise<string>} path */
    async stopRecord() {
      if (cameraHandle === null) throw new Error('Camera not open');
      return __velox_camera_record_stop(String(cameraHandle));
    },
  }), [cameraHandle]);

  return React.createElement('camera', {
    cameraHandle: cameraHandle,
    mirror: mirror === true,
    style,
    ...rest,
  });
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

// ── Deep links ────────────────────────────────────────────────────────────────

/**
 * Deep-link URL handling.
 *
 * Fires for both the initial launch URL (the URL that opened the app) and
 * any URLs forwarded by a second instance (when `singleInstance: true`).
 *
 * @example
 * import { deeplink } from '@velox/react';
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

// ── Form field components — Tier 2 ────────────────────────────────────────────
//
// Slider:    draggable thumb backed by native drag events.
// Select:    inline-expandable option list (accordion style).
// DatePicker: inline month calendar.

/**
 * Horizontal range slider.
 *
 * @param {{ value?: number, onValueChange?: function,
 *           min?: number, max?: number, step?: number,
 *           disabled?: boolean, style?: object }} props
 */
export function Slider({
  value = 0, onValueChange,
  min = 0, max = 1, step = 0,
  disabled = false, style,
  ...rest
}) {
  const pct = max === min ? 0 : Math.max(0, Math.min(1, (Math.min(max, Math.max(min, value)) - min) / (max - min)));

  // Native node ID for the track container — draggable is registered on it.
  const trackNodeId = useRef(null);

  // Always-current refs so the stable drag handler never has stale closures.
  const minRef      = useRef(min);   minRef.current      = min;
  const maxRef      = useRef(max);   maxRef.current      = max;
  const stepRef     = useRef(step);  stepRef.current     = step;
  const disabledRef = useRef(disabled); disabledRef.current = disabled;
  const onChangeRef = useRef(onValueChange); onChangeRef.current = onValueChange;

  // Shared update logic: compute value from absolute cursor x position.
  // Using absolute x (not delta) means each dragMove is independent — no
  // accumulation issue with stepped sliders, and clicking the rail works too.
  const updateFromX = useCallback((x) => {
    if (disabledRef.current || !onChangeRef.current) return;
    const layout = __velox_getLayout(trackNodeId.current);
    if (!layout || layout.width <= 0) return;
    const range = maxRef.current - minRef.current;
    const frac = Math.max(0, Math.min(1, (x - layout.x) / layout.width));
    let v = minRef.current + frac * range;
    const s = stepRef.current;
    if (s > 0) v = Math.round(v / s) * s;
    onChangeRef.current(v);
  }, []);

  // Register the track container as draggable so the full width is interactive.
  // onDragStart handles rail-click; onDragMove handles continuous drag.
  const onTrackMount = useCallback((id) => {
    trackNodeId.current = id;
    registerDraggable(id, {
      onDragStart({ x }) { updateFromX(x); },
      onDragMove({ x })  { updateFromX(x); },
    });
  }, []); // stable — updateFromX and all refs are stable

  useEffect(() => {
    return () => {
      if (trackNodeId.current !== null) unregisterDraggable(trackNodeId.current);
    };
  }, []);

  const THUMB = 20;
  const TRACK = 4;
  const accent = disabled ? '#555' : '#7aa2f7';

  return React.createElement(View, {
    _veloxOnMount: onTrackMount,
    style: { flexDirection: 'row', alignItems: 'center', height: THUMB, ...style },
    ...rest,
  },
    React.createElement(View, { style: { flex: pct, height: TRACK, backgroundColor: accent } }),
    React.createElement(View, {
      style: { width: THUMB, height: THUMB, borderRadius: THUMB / 2, backgroundColor: accent },
    }),
    React.createElement(View, { style: { flex: 1 - pct, height: TRACK, backgroundColor: '#3c4464' } }),
  );
}

/**
 * Inline-expandable select (accordion style — no absolute positioning needed).
 *
 * @param {{ value?: any, options?: {label:string,value:any}[],
 *           onValueChange?: function, disabled?: boolean,
 *           placeholder?: string, style?: object }} props
 */
export function Select({
  value, options = [], onValueChange,
  disabled = false, placeholder = 'Select\u2026', style,
  ...rest
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find(o => o.value === value);

  // Native node ID of the outer container — used to check if a global click is
  // inside or outside the Select, so we can close the dropdown on outside clicks.
  const containerNodeId = useRef(null);
  const onContainerMount = useCallback((id) => { containerNodeId.current = id; }, []);

  // When open, register a global click listener that closes the dropdown if the
  // user clicks outside the Select's bounding box.
  useEffect(() => {
    if (!open) return;
    const onGlobalClick = ({ x, y }) => {
      const layout = typeof __velox_getLayout !== 'undefined'
        ? __velox_getLayout(containerNodeId.current)
        : null;
      if (!layout) { setOpen(false); return; }
      const inside = x >= layout.x && x < layout.x + layout.width &&
                     y >= layout.y && y < layout.y + layout.height;
      if (!inside) setOpen(false);
    };
    addGlobalClickListener(onGlobalClick);
    return () => removeGlobalClickListener(onGlobalClick);
  }, [open]);

  // Height of one option row — used to give the dropdown an explicit height.
  const OPTION_H = 40;
  const dropH = options.length * OPTION_H;

  return React.createElement(View, {
    _veloxOnMount: onContainerMount,
    style,
    ...rest,
  },
    // Trigger button — fixed height so text never overflows.
    React.createElement(Pressable, {
      onPress: () => { if (!disabled) setOpen(o => !o); },
      style: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 10,
        height: 40,
        borderRadius: 8,
        backgroundColor: disabled ? '#1a1d2e' : '#262b3f',
        borderWidth: 1,
        borderColor: open ? '#7aa2f7' : '#3c4464',
        clip: true,
      },
    },
      // Label — clip to prevent overflow; leave 24px for the arrow.
      React.createElement(View, { style: { flex: 1, clip: true }, height: 20 },
        React.createElement(Text, {
          style: { color: selected ? '#e7ecff' : '#666', fontSize: 14 },
        }, selected ? selected.label : placeholder),
      ),
      React.createElement(Text, {
        style: { color: '#7aa2f7', fontSize: 11 },
        width: 16, height: 16,
      }, open ? '\u25b2' : '\u25bc'),
    ),
    // Dropdown list — shown inline below the trigger when open.
    open && React.createElement(View, {
      style: {
        backgroundColor: '#1e2235',
        borderRadius: 8,
        marginTop: 4,
        borderWidth: 1,
        borderColor: '#3c4464',
      },
      height: dropH,
    },
      ...options.map((opt, i) =>
        React.createElement(Pressable, {
          key: String(i),
          onPress: () => { onValueChange?.(opt.value); setOpen(false); },
          style: {
            paddingLeft: 12,
            paddingRight: 12,
            height: OPTION_H,
            justifyContent: 'center',
            backgroundColor: opt.value === value ? '#2e3555' : 'transparent',
            borderRadius: 6,
          },
        },
          React.createElement(Text, {
            style: { color: opt.value === value ? '#7aa2f7' : '#cdd6f4', fontSize: 14 },
          }, opt.label),
        )
      ),
    ),
  );
}

/**
 * Inline date picker with month navigation.
 *
 * @param {{ value?: Date|null, onValueChange?: function,
 *           disabled?: boolean, style?: object }} props
 */
export function DatePicker({ value = null, onValueChange, disabled = false, style, ...rest }) {
  const today       = value ? new Date(value) : new Date();
  const [open, setOpen]           = React.useState(false);
  const [viewYear, setViewYear]   = React.useState(today.getFullYear());
  const [viewMonth, setViewMonth] = React.useState(today.getMonth());

  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  const dayNames   = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

  // Build flat cell array: null for padding, number for actual days.
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  // Build rows (7 cells each).
  const rowCount = Math.ceil(cells.length / 7);
  const rows = Array.from({ length: rowCount }, (_, r) => cells.slice(r * 7, r * 7 + 7));

  // Fixed cell size: compact 36×32 grid so the calendar is always 268px wide.
  const CELL_W = 36;
  const CELL_H = 32;
  const CAL_W  = CELL_W * 7; // 252px content; +16 for 8px padding each side

  // Native node ID for outside-click detection (same pattern as Select).
  const containerNodeId = useRef(null);
  const onContainerMount = useCallback((id) => { containerNodeId.current = id; }, []);

  useEffect(() => {
    if (!open) return;
    const onGlobalClick = ({ x, y }) => {
      const layout = typeof __velox_getLayout !== 'undefined'
        ? __velox_getLayout(containerNodeId.current)
        : null;
      if (!layout) { setOpen(false); return; }
      const inside = x >= layout.x && x < layout.x + layout.width &&
                     y >= layout.y && y < layout.y + layout.height;
      if (!inside) setOpen(false);
    };
    addGlobalClickListener(onGlobalClick);
    return () => removeGlobalClickListener(onGlobalClick);
  }, [open]);

  // Calendar height used to reserve space above the trigger.
  const CAL_ROWS_H = Math.ceil(cells.length / 7) * CELL_H;
  const CAL_TOTAL_H = 8 + 32 + 22 + CAL_ROWS_H + 8; // pad + header + dow + rows + pad

  return React.createElement(View, {
    _veloxOnMount: onContainerMount,
    style,
    ...rest,
  },
    // Calendar opens ABOVE the trigger so it's never clipped by the bottom of a ScrollView.
    open && React.createElement(View, {
      width: CAL_W + 16,
      height: CAL_TOTAL_H,
      style: {
        backgroundColor: '#1e2235',
        borderRadius: 8,
        marginBottom: 4,
        padding: 8,
        borderWidth: 1,
        borderColor: '#3c4464',
      },
    },
      // Month navigation header
      React.createElement(View, {
        width: CAL_W, height: 28,
        style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
      },
        React.createElement(Pressable, { onPress: prevMonth, width: 24, height: 28, style: { justifyContent: 'center', alignItems: 'center' } },
          React.createElement(Text, { style: { color: '#7aa2f7', fontSize: 18 }, width: 20, height: 22 }, '\u2039'),
        ),
        React.createElement(Text, { style: { color: '#cdd6f4', fontSize: 13 }, width: CAL_W - 56, height: 18 },
          `${monthNames[viewMonth]} ${viewYear}`),
        React.createElement(Pressable, { onPress: nextMonth, width: 24, height: 28, style: { justifyContent: 'center', alignItems: 'center' } },
          React.createElement(Text, { style: { color: '#7aa2f7', fontSize: 18 }, width: 20, height: 22 }, '\u203a'),
        ),
      ),

      // Day-of-week header row
      React.createElement(View, { width: CAL_W, height: 20, style: { flexDirection: 'row', marginBottom: 2 } },
        ...dayNames.map(d =>
          React.createElement(View, {
            key: d, width: CELL_W, height: 20,
            style: { alignItems: 'center', justifyContent: 'center' },
          },
            React.createElement(Text, { style: { color: '#555', fontSize: 10 }, width: CELL_W, height: 14 }, d),
          )
        ),
      ),

      // Calendar day rows — explicit width + height for every cell keeps the grid tight.
      ...rows.map((row, ri) =>
        React.createElement(View, {
          key: ri, width: CAL_W, height: CELL_H,
          style: { flexDirection: 'row' },
        },
          ...row.map((day, ci) => {
            if (day === null) {
              return React.createElement(View, { key: ci, width: CELL_W, height: CELL_H });
            }
            const selDate = value ? new Date(value) : null;
            const isSelected = selDate &&
              selDate.getDate() === day &&
              selDate.getMonth() === viewMonth &&
              selDate.getFullYear() === viewYear;

            return React.createElement(Pressable, {
              key: ci,
              onPress: () => { onValueChange?.(new Date(viewYear, viewMonth, day)); setOpen(false); },
              width: CELL_W, height: CELL_H,
              style: {
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                backgroundColor: isSelected ? '#7aa2f7' : 'transparent',
              },
            },
              React.createElement(Text, {
                style: { color: isSelected ? '#171923' : '#cdd6f4', fontSize: 13 },
                width: CELL_W, height: 18,
              }, String(day)),
            );
          }),
        )
      ),
    ),

    // Trigger button — always at the bottom; calendar renders above it when open.
    React.createElement(Pressable, {
      onPress: () => { if (!disabled) setOpen(o => !o); },
      style: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingLeft: 12,
        paddingRight: 10,
        height: 40,
        borderRadius: 8,
        backgroundColor: disabled ? '#1a1d2e' : '#262b3f',
        borderWidth: 1,
        borderColor: open ? '#7aa2f7' : '#3c4464',
      },
    },
      React.createElement(Text, {
        style: { color: value ? '#e7ecff' : '#666', fontSize: 14 },
      }, value
        ? `${new Date(value).getFullYear()}-${String(new Date(value).getMonth() + 1).padStart(2, '0')}-${String(new Date(value).getDate()).padStart(2, '0')}`
        : 'Select date\u2026'),
      React.createElement(Text, {
        style: { color: '#7aa2f7', fontSize: 11 },
        width: 16, height: 16,
      }, open ? '\u25b2' : '\u25bc'),
    ),
  );
}

// ── Canvas 2D ─────────────────────────────────────────────────────────────────
//
// <Canvas ref={canvasRef} style={{ width: 300, height: 200 }} />
//
// Exposes a lightweight 2D drawing context via ref:
//   const ctx = canvasRef.current;
//   ctx.fillStyle = '#ff0000';      // or [r,g,b,a]
//   ctx.strokeStyle = '#ffffff';
//   ctx.lineWidth = 2;
//   ctx.fillRect(x, y, w, h);
//   ctx.strokeRect(x, y, w, h);
//   ctx.fillCircle(cx, cy, r);
//   ctx.strokeCircle(cx, cy, r);
//   ctx.strokeLine(x0, y0, x1, y1);
//   ctx.fillText(text, x, y, fontSize);
//   ctx.clear();
//   ctx.flush();     // or commands are flushed automatically on the next frame

function _parseColor(c) {
  if (Array.isArray(c)) return c;
  if (typeof c === 'string' && c.startsWith('#')) {
    const h = c.slice(1);
    if (h.length === 3) {
      const [r, g, b] = h.split('').map(x => parseInt(x + x, 16));
      return [r, g, b, 255];
    }
    if (h.length === 6) {
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
        255,
      ];
    }
    if (h.length === 8) {
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
        parseInt(h.slice(6, 8), 16),
      ];
    }
  }
  return [255, 255, 255, 255];
}

class VeloxCanvasContext {
  constructor(nativeId) {
    this._id    = nativeId;
    this._cmds  = [];
    this.fillStyle   = [255, 255, 255, 255];
    this.strokeStyle = [255, 255, 255, 255];
    this.lineWidth   = 1;
  }

  clear() { this._cmds = [{ type: 'clear' }]; }

  fillRect(x, y, w, h) {
    this._cmds.push({ type: 'fillRect', x, y, w, h, color: _parseColor(this.fillStyle) });
  }
  strokeRect(x, y, w, h) {
    this._cmds.push({ type: 'strokeRect', x, y, w, h, color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth });
  }
  fillCircle(cx, cy, r) {
    this._cmds.push({ type: 'fillCircle', cx, cy, r, color: _parseColor(this.fillStyle) });
  }
  strokeCircle(cx, cy, r) {
    this._cmds.push({ type: 'strokeCircle', cx, cy, r, color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth });
  }
  strokeLine(x0, y0, x1, y1) {
    this._cmds.push({ type: 'strokeLine', x0, y0, x1, y1, color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth });
  }
  fillText(text, x, y, fontSize = 16) {
    this._cmds.push({ type: 'fillText', text: String(text), x, y, fontSize, color: _parseColor(this.fillStyle) });
  }

  /** Send accumulated draw commands to the native layer. */
  flush() {
    if (typeof __velox_canvas_update === 'undefined') return;
    try {
      __velox_canvas_update(this._id, JSON.stringify(this._cmds));
    } catch (e) {
      __velox_log('[canvas] flush error: ' + e);
    }
    this._cmds = [];
  }
}

/**
 * A 2D canvas node backed by Vello primitives.
 *
 * @param {{ style?: object, ref?: React.Ref<VeloxCanvasContext> }} props
 */
export const Canvas = React.forwardRef(function Canvas({ style, ...props }, ref) {
  const ctxRef   = useRef(null);
  const nativeId = useRef(null);

  const onMount = useCallback((id) => {
    nativeId.current = id;
    const ctx = new VeloxCanvasContext(id);
    ctxRef.current = ctx;
    if (ref) {
      if (typeof ref === 'function') ref(ctx);
      else ref.current = ctx;
    }
  }, [ref]);

  return React.createElement('canvas', {
    _veloxOnMount: onMount,
    style,
    ...props,
  });
});

// ── Canvas 3D ─────────────────────────────────────────────────────────────────
//
// <Canvas3D ref={c3dRef} style={{ width: 400, height: 300 }} />
//
// Exposes:
//   c3dRef.current.updateScene(scene);   // push Scene3D JSON description
//   c3dRef.current.loadGltf(path);       // preload a GLTF file
//
// Scene shape (all optional fields):
//   {
//     background: [r, g, b, a],          // background fill color 0.0–1.0
//     camera: {
//       position: [x, y, z],
//       target:   [x, y, z],
//       up:       [x, y, z],
//       fovDeg:   60,
//       near:     0.1,
//       far:      1000,
//     },
//     lights: [
//       { type: 'ambient',     color: [r,g,b,a], intensity: 0.3 },
//       { type: 'directional', color: [r,g,b,a], intensity: 1.0, direction: [x,y,z] },
//     ],
//     meshes: [
//       {
//         geometry: { type: 'box',    width: 1, height: 1, depth: 1 },
//         // or:    { type: 'sphere', radius: 1, rings: 20, sectors: 20 },
//         // or:    { type: 'plane',  width: 10, depth: 10 },
//         // or:    { type: 'gltf',   path: '/path/to/model.glb' },
//         transform: [16 floats, row-major 4x4 matrix],  // identity by default
//         color:     [r, g, b, a],
//       },
//     ],
//   }

class VeloxCanvas3DContext {
  constructor(nativeId) {
    this._id = nativeId;
  }

  updateScene(scene) {
    if (typeof __velox_canvas3d_update === 'undefined') return;
    try {
      __velox_canvas3d_update(this._id, JSON.stringify(scene));
    } catch (e) {
      __velox_log('[canvas3d] updateScene error: ' + e);
    }
  }

  loadGltf(path) {
    if (typeof __velox_canvas3d_load_gltf === 'undefined') return;
    try {
      __velox_canvas3d_load_gltf(this._id, path);
    } catch (e) {
      __velox_log('[canvas3d] loadGltf error: ' + e);
    }
  }
}

/**
 * A 3D canvas node rendered via wgpu as a post-Vello overlay.
 *
 * @param {{ style?: object, ref?: React.Ref<VeloxCanvas3DContext> }} props
 */
export const Canvas3D = React.forwardRef(function Canvas3D({ style, ...props }, ref) {
  const onMount = useCallback((id) => {
    const ctx = new VeloxCanvas3DContext(id);
    if (ref) {
      if (typeof ref === 'function') ref(ctx);
      else ref.current = ctx;
    }
  }, [ref]);

  return React.createElement('canvas3d', {
    _veloxOnMount: onMount,
    style,
    ...props,
  });
});

// ── WindowControls ────────────────────────────────────────────────────────────
//
// A ready-made minimize / maximize-or-restore / close button row for custom
// title bars (`window.decorations: false` in velox.config.json).
//
// Usage:
//   import { WindowControls } from '@velox/react';
//   <View veloxDraggable style={styles.titleBar}>
//     <Text style={styles.title}>My App</Text>
//     <WindowControls />
//   </View>
//
// Platform-aware button order:
//   macOS   → traffic-light order on the LEFT side  (close · minimize · maximize)
//   Windows / Linux → standard order on the RIGHT side (minimize · maximize · close)

const _wc_btn = (label, onPress, bg) =>
  React.createElement(Pressable, {
    onPress,
    style: {
      width: 14, height: 14, borderRadius: 7,
      backgroundColor: bg,
      justifyContent: 'center', alignItems: 'center',
    },
  }, React.createElement(Text, { style: { fontSize: 8, color: '#00000088' } }, label));

export function WindowControls({ style } = {}) {
  const [maximized, setMaximized] = React.useState(() => veloxWindow.isMaximized());

  const minimize = () => veloxWindow.setMinimized();
  const toggleMax = () => {
    if (veloxWindow.isMaximized()) {
      veloxWindow.setMaximized(false);
      setMaximized(false);
    } else {
      veloxWindow.setMaximized(true);
      setMaximized(true);
    }
  };
  const close = () => veloxWindow.close();

  const isMac    = veloxWindow.platform() === 'macos';
  const btnClose = _wc_btn('✕', close,     '#ff5f57');
  const btnMin   = _wc_btn('−', minimize,  '#febc2e');
  const btnMax   = _wc_btn(maximized ? '⊡' : '⊞', toggleMax, '#28c840');

  const buttons = isMac
    ? [btnClose, btnMin, btnMax]   // traffic-light order: close · min · max
    : [btnMin,   btnMax, btnClose]; // Windows/Linux: min · max · close

  return React.createElement(View, {
    style: {
      flexDirection: 'row',
      gap: 6,
      alignItems: 'center',
      ...(isMac ? { marginLeft: 8 } : { marginRight: 8 }),
      ...style,
    },
  }, ...buttons);
}
