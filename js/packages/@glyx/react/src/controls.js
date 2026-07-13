import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  registerInput, unregisterInput,
  registerDraggable, unregisterDraggable,
  registerPressable, unregisterPressable,
  registerScrollView, unregisterScrollView,
  addGlobalClickListener, removeGlobalClickListener,
  addKeyListener,
} from './events.js';
import { View, Text, Image, ScrollView, Pressable, measureText, useWindowSize } from './core.js';
import { openPopover, closePopover } from './popover.js';
import { clipboard, dialog } from './api.js';

// ── Control width resolution ──────────────────────────────────────────────────
//
// THE sizing contract for fixed-footprint controls (Select, pickers, inputs):
//   1. If the caller's style controls width in ANY way (width, flex, flexGrow,
//      minWidth, alignSelf), the caller is in charge — layout decides, no
//      default is applied.
//   2. Otherwise the control gets a compact default: alignSelf 'flex-start'
//      (so stretch parents don't blow it up) + its default width.
// "Use the defaults or override" — stretching is one style away:
//   style={{ alignSelf: 'stretch' }}   or   style={{ flex: 1 }} (in a row).
function _sizedRootStyle(style, defaultWidth) {
  const sized = !!style && (
    style.width != null || style.flex != null || style.flexGrow != null ||
    style.minWidth != null || style.alignSelf != null
  );
  return sized
    ? { ...style }
    : { alignSelf: 'flex-start', width: defaultWidth, ...style };
}

// ── Select color context ──────────────────────────────────────────────────────
//
// Provides theme-matched colors to every Select in the subtree.
// @glyx-dev/design's ThemeProvider sets this automatically.
// The defaults below match the dark (Mocha) theme so existing apps
// that don't use ThemeProvider stay unchanged.

export const SELECT_COLORS_DARK = {
  triggerBg:           '#262b3f',
  triggerBgDisabled:   '#1a1d2e',
  triggerBorder:       '#3c4464',
  triggerBorderFocus:  '#7aa2f7',
  triggerText:         '#e7ecff',
  triggerPlaceholder:  '#9aa0b6',
  // chevron: arrow icons on triggers and calendar nav — subtler than accent
  chevron:             '#9aa0b6',
  dropdownBg:          '#1e2235',
  dropdownBorder:      '#3c4464',
  optionText:          '#cdd6f4',
  optionSelectedText:  '#7aa2f7',
  optionHoverBg:       '#2a3048',
  optionSelectedBg:    '#2e3555',
  optionCheck:         '#7aa2f7',
  // calCellSelectedBg: accent for the selected day cell (keep as primary)
  calCellSelectedBg:   '#7aa2f7',
  calCellSelectedText: '#1e1e2e',
  calDayName:          '#6c7086',
};

export const SelectColorsContext = React.createContext(SELECT_COLORS_DARK);

/** Wrap a subtree to override Select colors — used internally by ThemeProvider. */
export function SelectColorsProvider({ colors, children }) {
  return React.createElement(SelectColorsContext.Provider, { value: colors }, children);
}

// ── TextInput ─────────────────────────────────────────────────────────────────

export function TextInput({
  value = '',
  onChangeText,
  onSubmitEditing,
  placeholder = '',
  fontSize = 16,
  multiline = false,
  width,                     // explicit width; default 240 ONLY when no width-affecting style is given
  height,                    // default: 44 single-line; auto-sized multiline
  maxLength,                 // hard character limit (insertions truncated)
  minLines,                  // multiline auto-height floor  (default 3)
  maxLines,                  // multiline auto-height ceiling (default 10)
  secureTextEntry = false,   // mask characters (password fields)
  keyboardType = 'default',  // 'default' | 'numeric' | 'decimal'
  style,
  ...props
}) {
  const nodeIdRef   = useRef(null);
  const handlersRef = useRef(null);
  const [focused, setFocused] = useState(false);
  // Live layout width of the field — flex/stretch styles routinely make the
  // real node wider than the `width` prop (which defaults to 240), so text
  // wrapping, panning, and auto-height must all use the measured value.
  const [measuredW, setMeasuredW] = useState(0);

  // anchor: fixed end of selection; focus_: moving cursor end.
  // When anchor === focus_: no selection, cursor blinks at that position.
  const [anchor, setAnchor]   = useState(() => value.length);
  const [focus_,  setFocus_]  = useState(() => value.length);
  const [scrollX, setScrollX] = useState(0);
  const scrollXRef = useRef(0);
  // Vertical scroll for multiline mode (wheel, scrollbar drag, caret-follow).
  const [scrollY, setScrollY] = useState(0);
  const scrollYRef = useRef(0);
  const setScrollYBoth = (y) => { scrollYRef.current = y; setScrollY(y); };

  // Derived selection range (always ordered).
  const selStart = Math.min(anchor, focus_);
  const selEnd   = Math.max(anchor, focus_);

  // Text as rendered: masked for password fields (same char count as value,
  // so cursor indices line up), raw otherwise.
  const renderValue = secureTextEntry ? '•'.repeat([...value].length) : value;

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

  // Central commit point for every text mutation: applies the keyboardType
  // filter and maxLength cap, then emits + positions the cursor.
  const commit = (next, newPos) => {
    if (keyboardType === 'numeric' && !/^-?\d*$/.test(next)) return;
    if (keyboardType === 'decimal' && !/^-?\d*\.?\d*$/.test(next)) return;
    if (maxLength != null && next.length > maxLength) {
      next = next.slice(0, maxLength);
    }
    onChangeText?.(next);
    const pos = Math.max(0, Math.min(newPos, next.length));
    setAnchor(pos);
    setFocus_(pos);
  };

  // Measure the field's real layout width — runs after every render with an
  // equality guard, so it converges instead of looping.  Covers mount,
  // window resize, and flex reflow.
  useEffect(() => {
    const id = nodeIdRef.current;
    if (id == null || typeof __glyx_getLayout === 'undefined') return;
    try {
      const l = __glyx_getLayout(id);
      if (l && l.width > 0 && Math.abs(l.width - measuredW) > 1) {
        setMeasuredW(l.width);
      }
    } catch (_) {}
  });

  const innerPadding = multiline ? 10 : 8;
  // Width resolution: explicit `width` prop wins; otherwise, if the style
  // already controls width (width / flex / stretch), let layout decide; only
  // when NOTHING sizes the field does the 240px default apply.
  const styleSizesWidth = !!style && (
    style.width != null || style.flex != null || style.flexGrow != null ||
    style.minWidth != null || style.alignSelf === 'stretch'
  );
  const nodeWidth = width != null ? width : (styleSizesWidth ? undefined : 240);
  const fieldW = measuredW || (typeof nodeWidth === 'number' ? nodeWidth : 240);
  const innerW = Math.max(1, fieldW - innerPadding * 2);

  // Recompute horizontal scroll offset so the caret stays visible.
  // Only applies to single-line mode (multiline scrolls vertically via ScrollView).
  useEffect(() => {
    if (multiline) return;
    if (typeof __glyx_measure_text === 'undefined') return;
    const visibleW   = innerW;
    const caretX     = __glyx_measure_text(renderValue.slice(0, focus_), fontSize, 1e6).width;
    const textW      = __glyx_measure_text(renderValue, fontSize, 1e6).width;
    let sx = scrollXRef.current;
    if (caretX - sx > visibleW) sx = caretX - visibleW;
    if (caretX - sx < 0)        sx = caretX;
    // Pan back right when text shrinks (deletion): never leave blank space
    // on the right while text is clipped on the left.
    sx = Math.min(sx, Math.max(0, textW - visibleW));
    sx = Math.max(0, sx);
    if (sx !== scrollXRef.current) {
      scrollXRef.current = sx;
      setScrollX(sx);
    }
  }, [focus_, renderValue, fontSize, innerW, multiline]);

  // Multiline auto-height: count rendered lines (explicit '\n' plus soft
  // wraps at the real field width) and size the box between minLines and
  // maxLines.  An explicit `height` prop opts out.
  const lineH = fontSize * 1.4;
  let autoHeight;
  if (multiline && height == null) {
    const lo = Math.max(1, minLines ?? 3);
    const hi = Math.max(lo, maxLines ?? 10);
    let lineCount = 0;
    if (typeof __glyx_measure_text !== 'undefined' && innerW > 1) {
      for (const line of renderValue.split('\n')) {
        const w = line ? __glyx_measure_text(line, fontSize, 1e6).width : 0;
        lineCount += Math.max(1, Math.ceil(w / innerW));
      }
    } else {
      lineCount = renderValue.split('\n').length;
    }
    const lines = Math.max(lo, Math.min(hi, Math.max(1, lineCount)));
    autoHeight = Math.ceil(lines * lineH) + innerPadding * 2 + 4;
  }
  const resolvedHeight = height ?? (multiline ? autoHeight : 44);

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
            commit(value.slice(0, ss) + value.slice(se), ss);
          }
        } else if (key === 'KeyV') {
          try {
            const pasted = await clipboard.readText();
            if (pasted) {
              commit(value.slice(0, ss) + pasted + value.slice(se), ss + pasted.length);
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
        // Multiline: start of the current LOGICAL line (Ctrl+Home = document start).
        const target = (multiline && !ctrl)
          ? value.lastIndexOf('\n', Math.max(0, focus_ - 1)) + 1
          : 0;
        if (shift) { extendTo(target); } else { moveCursor(target); }
        return;
      }
      if (key === 'End') {
        // Multiline: end of the current LOGICAL line (Ctrl+End = document end).
        let target = value.length;
        if (multiline && !ctrl) {
          const nl = value.indexOf('\n', focus_);
          target = nl === -1 ? value.length : nl;
        }
        if (shift) { extendTo(target); } else { moveCursor(target); }
        return;
      }
      if (multiline && (key === 'PageUp' || key === 'PageDown')) {
        // Move the CARET a viewport's worth of lines (editor standard) —
        // the caret-follow effect then scrolls the view along with it.
        const id = nodeIdRef.current;
        const l = (id != null && typeof __glyx_getLayout !== 'undefined') ? __glyx_getLayout(id) : null;
        const lineH = fontSize * 1.4;
        const pageLines = Math.max(1, Math.floor(((l ? l.height : 300) - innerPadding * 2) / lineH) - 1);
        if (typeof __glyx_measure_text !== 'undefined' && typeof __glyx_text_pos_at !== 'undefined') {
          const caretY = __glyx_measure_text(renderValue.slice(0, focus_) || ' ', fontSize, innerW).height - lineH / 2;
          const caretX = 0; // column preservation via x would need caret x tracking; home-column is acceptable
          const targetY = key === 'PageUp' ? caretY - pageLines * lineH : caretY + pageLines * lineH;
          const pos = __glyx_text_pos_at(renderValue, fontSize, innerW, caretX, Math.max(0, targetY));
          if (shift) { extendTo(pos); } else { moveCursor(pos); }
        }
        return;
      }

      // ── Delete / Backspace ──────────────────────────────────────────────
      if (key === 'Backspace') {
        if (hasSel) {
          commit(value.slice(0, ss) + value.slice(se), ss);
        } else if (anchor > 0) {
          // Spread to handle multi-byte Unicode correctly.
          const chars = [...value];
          chars.splice(anchor - 1, 1);
          commit(chars.join(''), anchor - 1);
        }
        return;
      }
      if (key === 'Delete') {
        if (hasSel) {
          commit(value.slice(0, ss) + value.slice(se), ss);
        } else if (anchor < value.length) {
          const chars = [...value];
          chars.splice(anchor, 1);
          commit(chars.join(''), anchor);   // cursor stays put
        }
        return;
      }

      // ── Enter (multiline only) ──────────────────────────────────────────
      if (key === 'Enter') {
        if (multiline) {
          commit(value.slice(0, ss) + '\n' + value.slice(se), ss + 1);
        } else {
          onSubmitEditing?.(value);
        }
        return;
      }

      // ── Printable character ─────────────────────────────────────────────
      if (text) {
        // commit() clamps the cursor to the NEW value's length, so typing the
        // first character into an empty field positions correctly.
        commit(value.slice(0, ss) + text + value.slice(se), ss + text.length);
      }
    },
    // Character position under a pointer coordinate (shared by click + drag).
    posAt: (relX, relY) => {
      const padding = multiline ? 10 : 8;
      const textX   = relX - padding;

      if (multiline) {
        // Multiline: native 2-D hit-test against the WRAPPED layout (handles
        // soft wraps + '\n', which naive line-splitting cannot).  The click Y
        // is in viewport space — add the scroll offset to land in content space.
        const contentY = relY - padding + scrollYRef.current;
        if (typeof __glyx_text_pos_at !== 'undefined') {
          return __glyx_text_pos_at(renderValue, fontSize, innerW, Math.max(0, textX), Math.max(0, contentY));
        }
        // Fallback: '\n'-split line mapping (inaccurate with soft wraps).
        const lineHeight = fontSize * 1.4;
        const lineIdx    = Math.max(0, Math.floor(contentY / lineHeight));
        const lines      = renderValue.split('\n');
        const clampedLine = Math.min(lineIdx, lines.length - 1);
        const lineText   = lines[clampedLine];
        const col = (typeof __glyx_text_char_at_x !== 'undefined')
          ? __glyx_text_char_at_x(lineText, fontSize, 1e6, Math.max(0, textX))
          : Math.max(0, Math.min(Math.round(Math.max(0, textX) / (fontSize * 0.55)), lineText.length));
        let pos = 0;
        for (let i = 0; i < clampedLine; i++) pos += lines[i].length + 1;
        return pos + col;
      }
      // Single-line: add scrollX offset so click maps to the correct character
      // even when the text is shifted left.  Measured against renderValue so
      // masked (password) glyph widths line up with what's on screen.
      const localX = Math.max(0, textX) + scrollXRef.current;
      return (typeof __glyx_text_char_at_x !== 'undefined')
        ? __glyx_text_char_at_x(renderValue, fontSize, 1e6, localX)
        : Math.max(0, Math.min(Math.round(localX / (fontSize * 0.55)), renderValue.length));
    },
    onClickAt: (relX, relY) => {
      moveCursor(handlersRef.current.posAt(relX, relY));
    },
    // Mouse drag: keep the press-down anchor, move only the focus end.
    onDragAt: (relX, relY) => {
      extendTo(handlersRef.current.posAt(relX, relY));
    },
  };

  // Clamp a target scroll offset against the real (native-measured) overflow.
  const clampScrollY = (y) => {
    const id = nodeIdRef.current;
    if (id == null || typeof __glyx_getLayout === 'undefined') return 0;
    const l = __glyx_getLayout(id);
    const max = (l && typeof l.contentHeight === 'number')
      ? Math.max(0, l.contentHeight - l.height) : 0;
    return Math.min(max, Math.max(0, y));
  };

  const onMount = useCallback((id) => {
    nodeIdRef.current = id;
    registerInput(id, {
      onFocus:    () => handlersRef.current.onFocus(),
      onBlur:     () => handlersRef.current.onBlur(),
      onKeyPress: (ev) => handlersRef.current.onKeyPress(ev),
      onClickAt:  (relX, relY) => handlersRef.current.onClickAt(relX, relY),
      onDragAt:   (relX, relY) => handlersRef.current.onDragAt(relX, relY),
    });
    // Multiline fields scroll vertically like a ScrollView: wheel + native
    // scrollbar thumb/track drags both route here.
    if (multiline) {
      registerScrollView(id, {
        onScroll:         (dy) => setScrollYBoth(clampScrollY(scrollYRef.current + dy)),
        onAbsoluteScroll: (y)  => setScrollYBoth(clampScrollY(y)),
      });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    return () => {
      if (nodeIdRef.current !== null) {
        unregisterInput(nodeIdRef.current);
        unregisterScrollView(nodeIdRef.current);
      }
    };
  }, []);

  // Caret follow: when typing/moving the caret in a scrolled multiline field,
  // keep the caret's line inside the viewport.
  useEffect(() => {
    if (!multiline || !focused) return;
    if (typeof __glyx_measure_text === 'undefined') return;
    const id = nodeIdRef.current;
    if (id == null || typeof __glyx_getLayout === 'undefined') return;
    const l = __glyx_getLayout(id);
    if (!l) return;
    const lineH = Math.ceil(fontSize * 1.4);
    // Caret bottom y within the content = height of the text up to the caret.
    const caretBottom = __glyx_measure_text(renderValue.slice(0, focus_) || ' ', fontSize, innerW).height + innerPadding;
    const viewH = l.height;
    let sy = scrollYRef.current;
    if (caretBottom - sy > viewH - innerPadding) sy = caretBottom - viewH + innerPadding;
    if (caretBottom - lineH - sy < innerPadding) sy = Math.max(0, caretBottom - lineH - innerPadding);
    sy = clampScrollY(sy);
    if (sy !== scrollYRef.current) setScrollYBoth(sy);
  }, [focus_, renderValue, multiline, focused]); // eslint-disable-line react-hooks/exhaustive-deps

  const C = React.useContext(SelectColorsContext);

  // Show placeholder only when unfocused and value is empty (masked for
  // password fields so the real text never renders).
  const displayText  = (focused || value) ? renderValue : placeholder;
  const displayingPlaceholder = !focused && !value;
  const textColor    = displayingPlaceholder
    ? C.triggerPlaceholder
    : ((style && style.color) || C.triggerText);

  const inputStyle = {
    backgroundColor: C.triggerBg,
    borderRadius: 6,
    borderWidth: focused ? 2 : 1,
    borderColor: focused ? C.triggerBorderFocus : C.triggerBorder,
    justifyContent: multiline ? 'flex-start' : 'center',
    alignItems: 'flex-start',
    padding: innerPadding,
    clip: true,   // prevent text from rendering outside the input bounds
    ...style,
    // Vertical scroll state (after the user-style spread — not overridable).
    ...(multiline ? { scrollOffsetY: scrollY } : null),
  };

  return React.createElement(
    'view',
    { _glyxOnMount: onMount, style: inputStyle, width: nodeWidth, height: resolvedHeight, ...props },
    React.createElement('text', {
      text:           displayText,
      fontSize,
      // Wrap (multiline) at the REAL measured width, not the 240 prop default.
      width:          innerW,
      height:         multiline ? undefined : resolvedHeight - innerPadding * 2,
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

/**
 * Password field — a single-line TextInput that masks every character.
 * All TextInput props apply (maxLength, onSubmitEditing, …).
 */
export function PasswordInput(props) {
  return React.createElement(TextInput, { ...props, secureTextEntry: true, multiline: false });
}

/**
 * Numeric field — a single-line TextInput that only accepts numbers.
 * `keyboardType` defaults to `'decimal'` (digits, one dot, leading minus);
 * pass `keyboardType: 'numeric'` for integers only.
 */
export function NumericInput(props) {
  return React.createElement(TextInput, { keyboardType: 'decimal', ...props, multiline: false });
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
function _SelectOption({ label, selected, onSelect, C }) {
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
      backgroundColor: selected ? C.optionSelectedBg : (hover ? C.optionHoverBg : 'transparent'),
    },
  },
    React.createElement(Text, { height: 18, style: { color: selected ? C.optionSelectedText : C.optionText, fontSize: 14 } }, label),
    selected ? React.createElement(Text, { width: 14, height: 16, style: { color: C.optionCheck, fontSize: 13 } }, '✓') : null,
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
  const C    = React.useContext(SelectColorsContext);
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
      render: () => React.createElement(SelectColorsProvider, { colors: C },
        React.createElement(
          ScrollView,
          { width: cw, height: dropH, contentHeight: options.length * OPTION_H,
            style: { backgroundColor: C.dropdownBg, borderRadius: 8, borderWidth: 1, borderColor: C.dropdownBorder } },
          ...options.map((opt, i) => React.createElement(_SelectOption, {
            key: String(i),
            label: opt.label,
            selected: opt.value === value,
            onSelect: () => { onValueChange?.(opt.value); close(); },
            C,
          })),
        ),
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
    style: _sizedRootStyle(style, 240),
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
        backgroundColor: disabled ? C.triggerBgDisabled : C.triggerBg,
        borderWidth: 1,
        borderColor: open ? C.triggerBorderFocus : C.triggerBorder,
        clip: true,
      },
    },
      // Label auto-sizes; trigger clip:true prevents overflow past the arrow.
      React.createElement(Text, {
        height: 20,
        style: { color: selected ? C.triggerText : C.triggerPlaceholder, fontSize: 14 },
      }, selected ? selected.label : placeholder),
      React.createElement(Text, {
        style: { color: C.chevron, fontSize: 11 },
        width: 16, height: 16,
      }, open ? '▲' : '▼'),
    ),
  );
}

// Self-contained month calendar — owns its view month/year so the prev/next
// arrows re-render it in place inside the popover layer.
// Hover-highlighted selectable cell — shared by calendar days and time
// columns.  Uses an explicit hover background (Pressable's opacity feedback
// is invisible on transparent backgrounds).
function _HoverCell({ selected, onPress, w = 36, h = 32, fontSize = 13, children }) {
  const C = React.useContext(SelectColorsContext);
  const [hov, setHov] = useState(false);
  return React.createElement(Pressable, {
    onPress,
    feedback: false,
    onHoverIn:  () => setHov(true),
    onHoverOut: () => setHov(false),
    width: w, height: h,
    style: {
      alignItems: 'center', justifyContent: 'center', borderRadius: 4,
      backgroundColor: selected ? C.calCellSelectedBg : hov ? C.optionHoverBg : 'transparent',
    },
  },
    React.createElement(Text, {
      height: Math.round(fontSize * 1.4),
      style: { color: selected ? C.calCellSelectedText : C.optionText, fontSize, textAlign: 'center' },
    }, children)
  );
}

// Small hoverable arrow button used in the calendar header.
function _CalArrow({ onPress, children }) {
  const C = React.useContext(SelectColorsContext);
  const [hov, setHov] = useState(false);
  return React.createElement(Pressable, {
    onPress, feedback: false,
    onHoverIn: () => setHov(true), onHoverOut: () => setHov(false),
    width: 28, height: 28,
    style: { justifyContent: 'center', alignItems: 'center', borderRadius: 4, backgroundColor: hov ? C.optionHoverBg : 'transparent' },
  }, React.createElement(Text, { height: 22, style: { color: C.chevron, fontSize: 18 } }, children));
}

function _Calendar({ value, onSelect }) {
  const base = value ? new Date(value) : new Date();
  const [viewYear, setViewYear]   = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());
  // 'days' | 'months' | 'years'
  const [mode, setMode] = useState('days');
  // anchor year for the 12-year grid shown in year mode
  const [yearBase, setYearBase] = useState(() => Math.floor(base.getFullYear() / 12) * 12);

  const monthNames = ['January','February','March','April','May','June',
                      'July','August','September','October','November','December'];
  const monthShort = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
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

  // --- header label hover ---
  const [labelHov, setLabelHov] = useState(false);

  // --- month picker grid ---
  const renderMonths = () => {
    const MCW = Math.floor(CAL_W / 3), MCH = 36;
    const mrows = [[0,1,2],[3,4,5],[6,7,8],[9,10,11]];
    return React.createElement(View, { width: CAL_W },
      mrows.map((row, ri) => React.createElement(View, {
        key: ri, width: CAL_W, height: MCH,
        style: { flexDirection: 'row' },
      },
        row.map(m => React.createElement(_HoverCell, {
          key: m, selected: m === viewMonth, onPress: () => { setViewMonth(m); setMode('days'); },
          w: MCW, h: MCH, fontSize: 12,
        }, monthShort[m]))
      ))
    );
  };

  // --- year picker grid (12 years) ---
  const renderYears = () => {
    const YCW = Math.floor(CAL_W / 4), YCH = 36;
    const years = Array.from({ length: 12 }, (_, i) => yearBase + i);
    const yrows = [[0,1,2,3],[4,5,6,7],[8,9,10,11]];
    return React.createElement(View, { width: CAL_W },
      yrows.map((row, ri) => React.createElement(View, {
        key: ri, width: CAL_W, height: YCH,
        style: { flexDirection: 'row' },
      },
        row.map(i => React.createElement(_HoverCell, {
          key: i, selected: years[i] === viewYear, onPress: () => { setViewYear(years[i]); setMode('months'); },
          w: YCW, h: YCH, fontSize: 12,
        }, String(years[i])))
      ))
    );
  };

  const onPrev = () => {
    if (mode === 'days') prevMonth();
    else if (mode === 'months') setViewYear(y => y - 1);
    else setYearBase(b => b - 12);
  };
  const onNext = () => {
    if (mode === 'days') nextMonth();
    else if (mode === 'months') setViewYear(y => y + 1);
    else setYearBase(b => b + 12);
  };

  const headerLabel = mode === 'years'
    ? `${yearBase} – ${yearBase + 11}`
    : mode === 'months'
    ? String(viewYear)
    : `${monthNames[viewMonth]} ${viewYear}`;

  const C = React.useContext(SelectColorsContext);
  return React.createElement(View, {
    style: { backgroundColor: C.dropdownBg, borderRadius: 8, padding: 8, borderWidth: 1, borderColor: C.dropdownBorder },
  },
    // header row
    React.createElement(View, {
      width: CAL_W, height: 28,
      style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
    },
      React.createElement(_CalArrow, { onPress: onPrev }, '<'),
      React.createElement(Pressable, {
        feedback: false,
        onHoverIn: () => setLabelHov(true), onHoverOut: () => setLabelHov(false),
        onPress: () => setMode(m => m === 'days' ? 'months' : m === 'months' ? 'years' : 'days'),
        style: { paddingHorizontal: 6, height: 24, justifyContent: 'center', alignItems: 'center', borderRadius: 4, backgroundColor: labelHov ? C.optionHoverBg : 'transparent' },
      },
        React.createElement(Text, { height: 18, style: { color: C.optionText, fontSize: 13, textAlign: 'center' } }, headerLabel)
      ),
      React.createElement(_CalArrow, { onPress: onNext }, '>'),
    ),
    // body
    mode === 'months' ? renderMonths() :
    mode === 'years'  ? renderYears()  :
    React.createElement(View, null,
      React.createElement(View, { width: CAL_W, height: 20, style: { flexDirection: 'row', marginBottom: 2 } },
        ...dayNames.map(d => React.createElement(View, { key: d, width: CELL_W, height: 20, style: { alignItems: 'center', justifyContent: 'center' } },
          React.createElement(Text, { height: 14, style: { color: C.calDayName, fontSize: 10, textAlign: 'center' } }, d))),
      ),
      ...rows.map((row, ri) => React.createElement(View, {
        key: `${viewYear}-${viewMonth}-${ri}`, width: CAL_W, height: CELL_H, style: { flexDirection: 'row' },
      },
        ...row.map((day, ci) => {
          if (day === null) return React.createElement(View, { key: `e${ci}`, width: CELL_W, height: CELL_H });
          const isSel = sel && sel.getDate() === day && sel.getMonth() === viewMonth && sel.getFullYear() === viewYear;
          return React.createElement(_HoverCell, {
            key: ci,
            selected: !!isSel,
            onPress: () => onSelect(new Date(viewYear, viewMonth, day)),
            w: CELL_W, h: CELL_H,
          }, String(day));
        }),
      )),
    ),
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
  const C = React.useContext(SelectColorsContext);
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
      render: () => React.createElement(SelectColorsProvider, { colors: C },
        React.createElement(_Calendar, {
          value,
          onSelect: (d) => { onValueChange?.(d); close(); },
        }),
      ),
    });
  };
  useEffect(() => () => close(), []);

  const dlabel = value
    ? `${new Date(value).getFullYear()}-${String(new Date(value).getMonth() + 1).padStart(2, '0')}-${String(new Date(value).getDate()).padStart(2, '0')}`
    : 'Select date…';

  return React.createElement(View, {
    _glyxOnMount: onContainerMount,
    style: _sizedRootStyle(style, 240),
    ...rest,
  },
    React.createElement(Pressable, {
      onPress: toggle,
      style: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingLeft: 12, paddingRight: 10, height: 40, borderRadius: 8,
        backgroundColor: disabled ? C.triggerBgDisabled : C.triggerBg,
        borderWidth: 1, borderColor: open ? C.triggerBorderFocus : C.triggerBorder,
      },
    },
      React.createElement(Text, { height: 20, style: { color: value ? C.triggerText : C.triggerPlaceholder, fontSize: 14 } }, dlabel),
      React.createElement(Text, { width: 16, height: 16, style: { color: C.chevron, fontSize: 11 } }, open ? '▲' : '▼'),
    ),
  );
}

// ── TimePicker / DateTimePicker ───────────────────────────────────────────────

/** Format hour/minute for display: '14:05' (24h) or '2:05 PM' (12h). */
function _fmtTime(hour, minute, use24) {
  const mm = String(minute).padStart(2, '0');
  if (use24) return `${String(hour).padStart(2, '0')}:${mm}`;
  const h12 = hour % 12 === 0 ? 12 : hour % 12;
  return `${h12}:${mm} ${hour < 12 ? 'AM' : 'PM'}`;
}

// Scrollable hour/minute (+ AM/PM) columns.  Selecting updates immediately;
// the popover stays open so both parts can be set, backdrop click dismisses.
function _TimeColumns({ hour, minute, use24, minuteStep, onChange }) {
  const COL_H = 6 * 28;
  const hours   = use24 ? Array.from({ length: 24 }, (_, i) => i)
                        : Array.from({ length: 12 }, (_, i) => (i === 0 ? 12 : i));
  const minutes = [];
  for (let m = 0; m < 60; m += minuteStep) minutes.push(m);
  const isPM  = hour >= 12;
  const h12   = hour % 12 === 0 ? 12 : hour % 12;

  const col = (items, isSel, pick, w) => React.createElement(ScrollView, {
    height: COL_H, showScrollbar: false, style: { width: w },
    contentHeight: items.length * 28,
  }, ...items.map((it) => React.createElement(_HoverCell, {
    key: String(it), selected: isSel(it), onPress: () => pick(it), w, h: 28,
  }, String(it).padStart(2, '0'))));

  const C = React.useContext(SelectColorsContext);
  return React.createElement(View, {
    style: {
      flexDirection: 'row', gap: 4, padding: 8,
      backgroundColor: C.dropdownBg, borderRadius: 8, borderWidth: 1, borderColor: C.dropdownBorder,
    },
  },
    col(hours,   (h) => (use24 ? h === hour : h === h12),
        (h) => onChange(use24 ? h : ((h % 12) + (isPM ? 12 : 0)), minute), 48),
    col(minutes, (m) => m === minute, (m) => onChange(hour, m), 48),
    !use24 && React.createElement(View, { style: { gap: 4 } },
      React.createElement(_HoverCell, { selected: !isPM, onPress: () => onChange(hour % 12, minute), w: 44, h: 28 }, 'AM'),
      React.createElement(_HoverCell, { selected:  isPM, onPress: () => onChange((hour % 12) + 12, minute), w: 44, h: 28 }, 'PM'),
    ),
  );
}

/**
 * Time picker — floating hour/minute columns (AM/PM in 12-hour mode).
 *
 * @param {{ value?: string|null, onValueChange?: (hhmm: string) => void,
 *           use24Hour?: boolean, minuteStep?: number,
 *           disabled?: boolean, style?: object }} props
 *   `value` is always the 24-hour string 'HH:MM' (display honors use24Hour).
 */
export function TimePicker({
  value = null, onValueChange, use24Hour = false, minuteStep = 5,
  disabled = false, style, ...rest
}) {
  const C = React.useContext(SelectColorsContext);
  const [open, setOpen] = React.useState(false);
  const containerNodeId = useRef(null);
  const popoverId = useRef(null);
  const onContainerMount = useCallback((id) => { containerNodeId.current = id; }, []);

  const [hh, mm] = (value || '').split(':').map(Number);
  const hour   = Number.isFinite(hh) ? Math.max(0, Math.min(23, hh)) : 12;
  const minute = Number.isFinite(mm) ? Math.max(0, Math.min(59, mm)) : 0;

  const close = () => { if (popoverId.current != null) { closePopover(popoverId.current); popoverId.current = null; } };
  const emit  = (h, m) => onValueChange?.(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);

  const toggle = () => {
    if (disabled) return;
    if (open) { close(); return; }
    const l = (typeof __glyx_getLayout !== 'undefined') ? __glyx_getLayout(containerNodeId.current) : null;
    if (!l) return;
    setOpen(true);
    popoverId.current = openPopover({
      x: l.x, y: l.y, h: l.height,
      width: (use24Hour ? 48 * 2 + 4 : 48 * 2 + 44 + 8) + 18,
      contentH: 6 * 28 + 18,
      onClose: () => { popoverId.current = null; setOpen(false); },
      render: () => React.createElement(SelectColorsProvider, { colors: C },
        React.createElement(_TimeColumnsLive, {
          initial: { hour, minute }, use24: use24Hour, minuteStep, onEmit: emit,
        }),
      ),
    });
  };
  useEffect(() => () => close(), []);

  const label = value != null && value !== '' ? _fmtTime(hour, minute, use24Hour) : 'Select time…';

  return React.createElement(View, {
    _glyxOnMount: onContainerMount,
    style: _sizedRootStyle(style, 160),
    ...rest,
  },
    React.createElement(Pressable, {
      onPress: toggle,
      style: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingLeft: 12, paddingRight: 10, height: 40, borderRadius: 8,
        backgroundColor: disabled ? C.triggerBgDisabled : C.triggerBg,
        borderWidth: 1, borderColor: open ? C.triggerBorderFocus : C.triggerBorder,
      },
    },
      React.createElement(Text, { height: 20, style: { color: value ? C.triggerText : C.triggerPlaceholder, fontSize: 14 } }, label),
      React.createElement(Text, { width: 16, height: 16, style: { color: C.chevron, fontSize: 11 } }, open ? '▲' : '▼'),
    ),
  );
}

// Popover-local state wrapper: cell clicks re-render the columns in place
// (closure-snapshot columns couldn't update selection, same lesson as the
// _Calendar arrows).
function _TimeColumnsLive({ initial, use24, minuteStep, onEmit }) {
  const [hour, setHour]     = useState(initial.hour);
  const [minute, setMinute] = useState(initial.minute);
  return React.createElement(_TimeColumns, {
    hour, minute, use24, minuteStep,
    onChange: (h, m) => { setHour(h); setMinute(m); onEmit(h, m); },
  });
}

/**
 * Combined date + time picker: calendar and time columns side by side.
 *
 * @param {{ value?: Date|string|null, onValueChange?: (d: Date) => void,
 *           use24Hour?: boolean, minuteStep?: number,
 *           disabled?: boolean, style?: object }} props
 */
export function DateTimePicker({
  value = null, onValueChange, use24Hour = false, minuteStep = 5,
  disabled = false, style, ...rest
}) {
  const C = React.useContext(SelectColorsContext);
  const [open, setOpen] = React.useState(false);
  const containerNodeId = useRef(null);
  const popoverId = useRef(null);
  const onContainerMount = useCallback((id) => { containerNodeId.current = id; }, []);

  const d = value ? new Date(value) : null;
  const close = () => { if (popoverId.current != null) { closePopover(popoverId.current); popoverId.current = null; } };

  const toggle = () => {
    if (disabled) return;
    if (open) { close(); return; }
    const l = (typeof __glyx_getLayout !== 'undefined') ? __glyx_getLayout(containerNodeId.current) : null;
    if (!l) return;
    setOpen(true);
    popoverId.current = openPopover({
      x: l.x, y: l.y, h: l.height,
      width: 36 * 7 + (use24Hour ? 48 * 2 + 4 : 48 * 2 + 44 + 8) + 34,
      contentH: 8 + 28 + 22 + 6 * 32 + 8,
      onClose: () => { popoverId.current = null; setOpen(false); },
      render: () => React.createElement(SelectColorsProvider, { colors: C },
        React.createElement(_DateTimePanel, {
          initial: d, use24: use24Hour, minuteStep,
          onEmit: (nd) => onValueChange?.(nd),
        }),
      ),
    });
  };
  useEffect(() => () => close(), []);

  const label = d
    ? `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${_fmtTime(d.getHours(), d.getMinutes(), use24Hour)}`
    : 'Select date & time…';

  return React.createElement(View, {
    _glyxOnMount: onContainerMount,
    style: _sizedRootStyle(style, 280),
    ...rest,
  },
    React.createElement(Pressable, {
      onPress: toggle,
      style: {
        flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
        paddingLeft: 12, paddingRight: 10, height: 40, borderRadius: 8,
        backgroundColor: disabled ? C.triggerBgDisabled : C.triggerBg,
        borderWidth: 1, borderColor: open ? C.triggerBorderFocus : C.triggerBorder,
      },
    },
      React.createElement(Text, { height: 20, style: { color: d ? C.triggerText : C.triggerPlaceholder, fontSize: 14 } }, label),
      React.createElement(Text, { width: 16, height: 16, style: { color: C.chevron, fontSize: 11 } }, open ? '▲' : '▼'),
    ),
  );
}

function _DateTimePanel({ initial, use24, minuteStep, onEmit }) {
  const [dt, setDt] = useState(initial || new Date());
  const emit = (next) => { setDt(next); onEmit(next); };
  return React.createElement(View, { style: { flexDirection: 'row', gap: 6, alignItems: 'flex-start' } },
    React.createElement(_Calendar, {
      value: dt,
      onSelect: (day) => emit(new Date(
        day.getFullYear(), day.getMonth(), day.getDate(), dt.getHours(), dt.getMinutes())),
    }),
    React.createElement(_TimeColumns, {
      hour: dt.getHours(), minute: dt.getMinutes(), use24, minuteStep,
      onChange: (h, m) => emit(new Date(
        dt.getFullYear(), dt.getMonth(), dt.getDate(), h, m)),
    }),
  );
}
