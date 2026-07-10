import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  registerInput, unregisterInput,
  registerDraggable, unregisterDraggable,
  registerPressable, unregisterPressable,
  addGlobalClickListener, removeGlobalClickListener,
  addKeyListener,
} from './events.js';
import { View, Text, Image, ScrollView, Pressable, measureText, useWindowSize } from './core.js';
import { openPopover, closePopover } from './popover.js';
import { clipboard, dialog } from './api.js';

// ── TextInput ─────────────────────────────────────────────────────────────────

export function TextInput({
  value = '',
  onChangeText,
  onSubmitEditing,
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
  const [scrollX, setScrollX] = useState(0);
  const scrollXRef = useRef(0);

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

  // Recompute horizontal scroll offset so the caret stays visible.
  // Only applies to single-line mode (multiline scrolls vertically via ScrollView).
  useEffect(() => {
    if (multiline) return;
    if (typeof __glyx_measure_text === 'undefined') return;
    const visibleW   = (typeof width === 'number' ? width : 240) - (multiline ? 10 : 8) * 2;
    const caretX     = __glyx_measure_text(value.slice(0, focus_), fontSize, 1e6).width;
    let sx = scrollXRef.current;
    if (caretX - sx > visibleW) sx = caretX - visibleW;
    if (caretX - sx < 0)        sx = caretX;
    sx = Math.max(0, sx);
    if (sx !== scrollXRef.current) {
      scrollXRef.current = sx;
      setScrollX(sx);
    }
  }, [focus_, value, fontSize, width, multiline]);

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
      const padding = multiline ? 10 : 8;
      const textX   = relX - padding;

      if (multiline) {
        // Multiline: find line by Y, then char by X within that line.
        const lineHeight = fontSize * 1.4;
        const lineIdx    = Math.max(0, Math.floor((relY - padding) / lineHeight));
        const lines      = value.split('\n');
        const clampedLine = Math.min(lineIdx, lines.length - 1);
        const lineText   = lines[clampedLine];
        const col = (typeof __glyx_text_char_at_x !== 'undefined')
          ? __glyx_text_char_at_x(lineText, fontSize, 1e6, Math.max(0, textX))
          : Math.max(0, Math.min(Math.round(Math.max(0, textX) / (fontSize * 0.55)), lineText.length));
        let pos = 0;
        for (let i = 0; i < clampedLine; i++) pos += lines[i].length + 1;
        moveCursor(pos + col);
      } else {
        // Single-line: add scrollX offset so click maps to the correct character
        // even when the text is shifted left.
        const localX = Math.max(0, textX) + scrollXRef.current;
        const col = (typeof __glyx_text_char_at_x !== 'undefined')
          ? __glyx_text_char_at_x(value, fontSize, 1e6, localX)
          : Math.max(0, Math.min(Math.round(localX / (fontSize * 0.55)), value.length));
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
    { _glyxOnMount: onMount, style: inputStyle, width, height, ...props },
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
      textScrollX:    multiline ? undefined : scrollX,
    })
  );
}

// ── Form field components ─────────────────────────────────────────────────────
//
// Tier 1: pure React components, no new native bindings.
// All styled for the Glyx dark-blue aesthetic.

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
 * Requires `dialog: true` capability in glyx.config.json.
 *
 * `accept` constrains the native dialog's file-type filter. Two forms:
 *   accept=".png,.jpg"                                  — extension shorthand
 *   accept={[{ name: 'Images', extensions: ['png'] }]}  — named filter groups,
 *     shown as the dropdown labels in the OS dialog (dialog.openFile shape)
 *
 * @param {{ onFilesSelected?: function,
 *           accept?: string | {name:string,extensions:string[]}[],
 *           multiple?: boolean, label?: string, disabled?: boolean,
 *           style?: object }} props
 */
export function FileInput({
  onFilesSelected,
  accept,
  multiple = false,
  label = 'Browse files…',
  disabled = false,
  style,
  ...rest
}) {
  const handlePress = () => {
    if (disabled) return;
    let filters = [];
    if (Array.isArray(accept)) {
      filters = accept; // already [{ name, extensions }]
    } else if (typeof accept === 'string' && accept.trim()) {
      const extensions = accept.split(',')
        .map(e => e.trim().replace(/^\./, ''))
        .filter(Boolean);
      if (extensions.length > 0) {
        filters = [{ name: `Accepted (${extensions.map(e => '.' + e).join(', ')})`, extensions }];
      }
    }
    dialog.openFile({ filters, multiple })
      .then(paths => {
        if (paths && paths.length > 0 && onFilesSelected) onFilesSelected(paths);
      })
      .catch(e => __glyx_log('[FileInput] error: ' + e));
  };

  return React.createElement(Pressable, {
    onPress: handlePress,
    style: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      backgroundColor: disabled ? '#1f2333' : '#262b3f',
      borderWidth: 1,
      borderColor: disabled ? '#3c4464' : '#7aa2f7',
      borderRadius: 6,
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      flexShrink: 0,
      ...style,
    },
    ...rest,
  },
    React.createElement(Text, {
      style: { color: disabled ? '#555' : '#7aa2f7', fontSize: 14 },
    }, label)
  );
}

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
  value = 0, onValueChange, onChange,
  min = 0, max = 1, step = 0,
  disabled = false, style,
  width: widthProp = 200,
  ...rest
}) {
  const _cb = onValueChange ?? onChange;
  const THUMB = 20;
  const TRACK = 4;
  const accent = disabled ? '#555' : '#7aa2f7';

  // The rendered width may come from the `width` prop, `style.width`, or flex —
  // so measure the ACTUAL laid-out width and compute fill/thumb from that.
  // Otherwise the thumb (sized from widthProp) and the click mapping (from the
  // real width) disagree, and the slider feels broken.
  const styleW = (style && typeof style.width === 'number') ? style.width : null;
  const [measuredW, setMeasuredW] = useState(styleW ?? widthProp);
  const effW = measuredW > 0 ? measuredW : (styleW ?? widthProp);

  const pct    = max === min ? 0 : Math.max(0, Math.min(1, (Math.min(max, Math.max(min, value)) - min) / (max - min)));
  const fillW  = Math.max(0, Math.round(pct * (effW - THUMB)));
  const rightW = Math.max(0, effW - THUMB - fillW);

  // Native node ID for the track container — draggable is registered on it.
  const trackNodeId = useRef(null);

  // Always-current refs so the stable drag handler never has stale closures.
  const minRef      = useRef(min);   minRef.current      = min;
  const maxRef      = useRef(max);   maxRef.current      = max;
  const stepRef     = useRef(step);  stepRef.current     = step;
  const disabledRef = useRef(disabled); disabledRef.current = disabled;
  const onChangeRef = useRef(_cb); onChangeRef.current = _cb;

  // Shared update logic: compute value from absolute cursor x position.
  // Using absolute x (not delta) means each dragMove is independent — no
  // accumulation issue with stepped sliders, and clicking the rail works too.
  const updateFromX = useCallback((x) => {
    if (disabledRef.current || !onChangeRef.current) return;
    const layout = __glyx_getLayout(trackNodeId.current);
    if (!layout || layout.width <= 0) return;
    const range = maxRef.current - minRef.current;
    const frac = Math.max(0, Math.min(1, (x - layout.x) / layout.width));
    let v = minRef.current + frac * range;
    const s = stepRef.current;
    if (s > 0) v = Math.round(v / s) * s;
    onChangeRef.current(v);
  }, []);

  // Register the track as BOTH draggable (continuous drag) and pressable (plain
  // clicks — a tap has no drag-movement threshold, so without this, clicking the
  // rail wouldn't move the thumb). Both paths feed the same updateFromX(x).
  const measureWidth = useCallback(() => {
    const id = trackNodeId.current;
    if (id == null || typeof __glyx_getLayout === 'undefined') return;
    const l = __glyx_getLayout(id);
    if (l && l.width > 0) setMeasuredW((prev) => (Math.abs(l.width - prev) > 0.5 ? l.width : prev));
  }, []);

  const onTrackMount = useCallback((id) => {
    trackNodeId.current = id;
    registerDraggable(id, {
      onDragStart({ x }) { updateFromX(x); },
      onDragMove({ x })  { updateFromX(x); },
    });
    registerPressable(id, {
      onPress({ x }) { updateFromX(x); },
      onPressIn() {}, onPressOut() {}, onHoverIn() {}, onHoverOut() {},
    });
    setTimeout(measureWidth, 0); // measure after the first native layout pass
  }, []); // stable — updateFromX and all refs are stable

  // Re-measure each render (cheap, guarded) so the fill tracks the real width
  // after style/flex/resize changes.
  useEffect(() => { measureWidth(); });

  useEffect(() => {
    return () => {
      if (trackNodeId.current !== null) {
        unregisterDraggable(trackNodeId.current);
        unregisterPressable(trackNodeId.current);
      }
    };
  }, []);

  // Explicit pixel widths for all three pieces so Taffy updates correctly.
  // The container is registered as draggable — clicking anywhere on the rail
  // (including the thumb area) fires updateFromX.
  return React.createElement(View, {
    _glyxOnMount: onTrackMount,
    width: widthProp,
    pressable: true, // mark interactive so clicks hit-test to this node
    style: { flexDirection: 'row', alignItems: 'center', ...style },
    ...rest,
  },
    React.createElement(View, { width: fillW,  height: TRACK, style: { backgroundColor: accent } }),
    React.createElement(View, { width: THUMB,  height: THUMB, style: { borderRadius: THUMB / 2, backgroundColor: accent } }),
    React.createElement(View, { width: rightW, height: TRACK, style: { backgroundColor: '#3c4464' } }),
  );
}

// One option row in a Select dropdown — hover highlight + selected state + check.
function _SelectOption({ label, selected, onSelect }) {
  const [hover, setHover] = useState(false);
  return React.createElement(Pressable, {
    onPress: onSelect,
    onHoverIn:  () => setHover(true),
    onHoverOut: () => setHover(false),
    height: 40,
    style: {
      alignSelf: 'stretch',   // fill the full popup width so hover spans the row
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
      paddingLeft: 12, paddingRight: 12,
      backgroundColor: selected ? '#2e3555' : (hover ? '#2a3048' : 'transparent'),
    },
  },
    React.createElement(Text, { height: 18, style: { color: selected ? '#7aa2f7' : '#cdd6f4', fontSize: 14 } }, label),
    selected ? React.createElement(Text, { width: 14, height: 16, style: { color: '#7aa2f7', fontSize: 13 } }, '✓') : null,
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
  disabled = false, placeholder = 'Select…', style,
  ...rest
}) {
  const [open, setOpen] = React.useState(false);
  const selected = options.find(o => o.value === value);
  const containerNodeId = useRef(null);
  const popoverId = useRef(null);
  const onContainerMount = useCallback((id) => { containerNodeId.current = id; }, []);

  const OPTION_H = 40;
  const close = () => { if (popoverId.current != null) { closePopover(popoverId.current); popoverId.current = null; } };

  const toggle = () => {
    if (disabled) return;
    if (open) { close(); return; }
    const l = (typeof __glyx_getLayout !== 'undefined') ? __glyx_getLayout(containerNodeId.current) : null;
    if (!l) return;
    const cw = l.width;
    const dropH = Math.min(options.length * OPTION_H, 280);
    setOpen(true);
    popoverId.current = openPopover({
      x: l.x, y: l.y, h: l.height, width: cw, contentH: dropH + 2,
      onClose: () => { popoverId.current = null; setOpen(false); },
      render: () => React.createElement(
        ScrollView,
        { width: cw, height: dropH, contentHeight: options.length * OPTION_H,
          style: { backgroundColor: '#1e2235', borderRadius: 8, borderWidth: 1, borderColor: '#3c4464' } },
        ...options.map((opt, i) => React.createElement(_SelectOption, {
          key: String(i),
          label: opt.label,
          selected: opt.value === value,
          onSelect: () => { onValueChange?.(opt.value); close(); },
        })),
      ),
    });
  };

  // Close the floating list if the Select unmounts while open.
  useEffect(() => () => close(), []);

  return React.createElement(View, {
    _glyxOnMount: onContainerMount,
    // Default to a sensible width (not full-window). alignSelf:flex-start stops
    // the parent's default `alignItems: stretch` from expanding it. User `style`
    // (incl. width) overrides.
    style: { alignSelf: 'flex-start', width: 240, ...style },
    ...rest,
  },
    // Trigger button — fixed height so text never overflows.
    React.createElement(Pressable, {
      onPress: toggle,
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
      // Label auto-sizes; trigger clip:true prevents overflow past the arrow.
      React.createElement(Text, {
        height: 20,
        style: { color: selected ? '#e7ecff' : '#9aa0b6', fontSize: 14 },
      }, selected ? selected.label : placeholder),
      React.createElement(Text, {
        style: { color: '#7aa2f7', fontSize: 11 },
        width: 16, height: 16,
      }, open ? '▲' : '▼'),
    ),
  );
}

// Self-contained month calendar — owns its view month/year so the prev/next
// arrows re-render it in place inside the popover layer.
function _Calendar({ value, onSelect }) {
  const base = value ? new Date(value) : new Date();
  const [viewYear, setViewYear]   = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());

  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  const dayNames = ['Su','Mo','Tu','We','Th','Fr','Sa'];

  const firstDow    = new Date(viewYear, viewMonth, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const rows = Array.from({ length: Math.ceil(cells.length / 7) }, (_, r) => cells.slice(r * 7, r * 7 + 7));

  const prevMonth = () => { if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); } else setViewMonth(m => m - 1); };
  const nextMonth = () => { if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); } else setViewMonth(m => m + 1); };

  const CELL_W = 36, CELL_H = 32, CAL_W = CELL_W * 7;
  const sel = value ? new Date(value) : null;

  return React.createElement(View, {
    style: { backgroundColor: '#1e2235', borderRadius: 8, padding: 8, borderWidth: 1, borderColor: '#3c4464' },
  },
    React.createElement(View, {
      width: CAL_W, height: 28,
      style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    },
      React.createElement(Pressable, { onPress: prevMonth, width: 28, height: 28, style: { justifyContent: 'center', alignItems: 'center' } },
        React.createElement(Text, { height: 22, style: { color: '#7aa2f7', fontSize: 18 } }, '‹')),
      React.createElement(Text, { height: 18, style: { color: '#cdd6f4', fontSize: 13 } }, `${monthNames[viewMonth]} ${viewYear}`),
      React.createElement(Pressable, { onPress: nextMonth, width: 28, height: 28, style: { justifyContent: 'center', alignItems: 'center' } },
        React.createElement(Text, { height: 22, style: { color: '#7aa2f7', fontSize: 18 } }, '›')),
    ),
    React.createElement(View, { width: CAL_W, height: 20, style: { flexDirection: 'row', marginBottom: 2 } },
      ...dayNames.map(d => React.createElement(View, { key: d, width: CELL_W, height: 20, style: { alignItems: 'center', justifyContent: 'center' } },
        React.createElement(Text, { height: 14, style: { color: '#666', fontSize: 10, textAlign: 'center' } }, d))),
    ),
    ...rows.map((row, ri) => React.createElement(View, {
      key: `${viewYear}-${viewMonth}-${ri}`, width: CAL_W, height: CELL_H, style: { flexDirection: 'row' },
    },
      ...row.map((day, ci) => {
        if (day === null) return React.createElement(View, { key: `e${ci}`, width: CELL_W, height: CELL_H });
        const isSel = sel && sel.getDate() === day && sel.getMonth() === viewMonth && sel.getFullYear() === viewYear;
        return React.createElement(Pressable, {
          key: ci,
          onPress: () => onSelect(new Date(viewYear, viewMonth, day)),
          width: CELL_W, height: CELL_H,
          style: { alignItems: 'center', justifyContent: 'center', borderRadius: 4, backgroundColor: isSel ? '#7aa2f7' : 'transparent' },
        },
          React.createElement(Text, { height: 18, style: { color: isSel ? '#171923' : '#cdd6f4', fontSize: 13, textAlign: 'center' } }, String(day)));
      }),
    )),
  );
}

/**
 * Date picker. The calendar floats in the root popover layer (never clipped),
 * flips above the trigger near the window bottom, and the arrows navigate
 * months in place.
 *
 * @param {{ value?: Date|null, onValueChange?: function,
 *           disabled?: boolean, style?: object }} props
 */
export function DatePicker({ value = null, onValueChange, disabled = false, style, ...rest }) {
  const [open, setOpen] = React.useState(false);
  const containerNodeId = useRef(null);
  const popoverId = useRef(null);
  const onContainerMount = useCallback((id) => { containerNodeId.current = id; }, []);

  const close = () => { if (popoverId.current != null) { closePopover(popoverId.current); popoverId.current = null; } };
  const toggle = () => {
    if (disabled) return;
    if (open) { close(); return; }
    const l = (typeof __glyx_getLayout !== 'undefined') ? __glyx_getLayout(containerNodeId.current) : null;
    if (!l) return;
    setOpen(true);
    popoverId.current = openPopover({
      x: l.x, y: l.y, h: l.height, width: 36 * 7 + 18, contentH: 8 + 28 + 22 + 6 * 32 + 8,
      onClose: () => { popoverId.current = null; setOpen(false); },
      render: () => React.createElement(_Calendar, {
        value,
        onSelect: (d) => { onValueChange?.(d); close(); },
      }),
    });
  };
  useEffect(() => () => close(), []);

  const dlabel = value
    ? `${new Date(value).getFullYear()}-${String(new Date(value).getMonth() + 1).padStart(2, '0')}-${String(new Date(value).getDate()).padStart(2, '0')}`
    : 'Select date…';

  return React.createElement(View, {
    _glyxOnMount: onContainerMount,
    style: { alignSelf: 'flex-start', width: 240, ...style },
    ...rest,
  },
    React.createElement(Pressable, {
      onPress: toggle,
      style: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingLeft: 12, paddingRight: 10, height: 40, borderRadius: 8,
        backgroundColor: disabled ? '#1a1d2e' : '#262b3f',
        borderWidth: 1, borderColor: open ? '#7aa2f7' : '#3c4464',
      },
    },
      React.createElement(Text, { height: 20, style: { color: value ? '#e7ecff' : '#9aa0b6', fontSize: 14 } }, dlabel),
      React.createElement(Text, { width: 16, height: 16, style: { color: '#7aa2f7', fontSize: 11 } }, open ? '▲' : '▼'),
    ),
  );
}
