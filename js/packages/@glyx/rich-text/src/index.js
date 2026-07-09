// @glyx/rich-text — Rich text editor for Glyx apps.
//
// Architecture:
//   Document  = array of paragraphs
//   Paragraph = array of styled spans
//   Span      = { text, bold?, italic?, underline?, color?, fontSize? }
//   Cursor    = { para, offset }  (offset = char index in flat paragraph text)
//   Selection = { anchor: Cursor, focus: Cursor }
//
// Rendering uses native Text nodes (bold/italic/underline supported natively)
// with absolutely-positioned View overlays for cursor and selection highlight.
// Cursor pixel position is computed via __glyx_measure_text (styled).

import React, { useState, useEffect, useRef, useCallback, useContext, createContext } from 'react';
import { View, Text, Pressable, addKeyListener, removeKeyListener, addGlobalClickListener, removeGlobalClickListener, clipboard } from '@glyx/react';

// ── Document helpers ──────────────────────────────────────────────────────────

export function emptyDoc() {
  return { paragraphs: [{ spans: [{ text: '' }] }] };
}

function paraText(para) {
  return para.spans.map(s => s.text).join('');
}

function splitSpansAt(spans, offset) {
  const before = [], after = [];
  let rem = offset, split = false;
  for (const span of spans) {
    if (split) { after.push({ ...span }); continue; }
    if (rem >= span.text.length) { before.push({ ...span }); rem -= span.text.length; }
    else {
      if (rem > 0) before.push({ ...span, text: span.text.slice(0, rem) });
      after.push({ ...span, text: span.text.slice(rem) });
      split = true;
    }
  }
  return [before, after];
}

function mergeSpans(spans) {
  const out = [];
  for (const s of spans) {
    if (!s.text) continue;
    const p = out[out.length - 1];
    if (p && p.bold === s.bold && p.italic === s.italic && p.underline === s.underline &&
        p.color === s.color && p.fontSize === s.fontSize) {
      out[out.length - 1] = { ...p, text: p.text + s.text };
    } else {
      out.push({ ...s });
    }
  }
  return out.length ? out : [{ text: '' }];
}

// ── Cursor helpers ────────────────────────────────────────────────────────────

function cursorEq(a, b)  { return a.para === b.para && a.offset === b.offset; }
function cursorLt(a, b)  { return a.para < b.para || (a.para === b.para && a.offset < b.offset); }
function hasSelection(s) { return !cursorEq(s.anchor, s.focus); }
function normSel(s)      { return cursorLt(s.anchor, s.focus) ? s : { anchor: s.focus, focus: s.anchor }; }

function clampCursor(doc, c) {
  const para = Math.max(0, Math.min(doc.paragraphs.length - 1, c.para));
  const offset = Math.max(0, Math.min(paraText(doc.paragraphs[para]).length, c.offset));
  return { para, offset };
}

function moveCursorBy(doc, cursor, delta) {
  let { para, offset } = cursor;
  offset += delta;
  if (offset < 0 && para > 0) {
    para--;
    offset = paraText(doc.paragraphs[para]).length + offset + 1;
  } else if (offset > paraText(doc.paragraphs[para]).length && para < doc.paragraphs.length - 1) {
    const prevLen = paraText(doc.paragraphs[para]).length;
    para++;
    offset = offset - prevLen - 1;
  }
  return clampCursor(doc, { para, offset });
}

function moveCursorVertical(doc, cursor, dir, lineHeight, defaultFontSize) {
  const targetPara = cursor.para + dir;
  if (targetPara < 0) return { para: 0, offset: 0 };
  if (targetPara >= doc.paragraphs.length) {
    const last = doc.paragraphs.length - 1;
    return { para: last, offset: paraText(doc.paragraphs[last]).length };
  }
  const x = measureCursorX(doc.paragraphs[cursor.para], cursor.offset, defaultFontSize);
  const offset = clickToOffset(doc.paragraphs[targetPara], x, defaultFontSize);
  return { para: targetPara, offset };
}

// ── Edit operations ───────────────────────────────────────────────────────────

function insertText(doc, cursor, text) {
  const paras = [...doc.paragraphs];
  const para = paras[cursor.para];
  const [before, after] = splitSpansAt(para.spans, cursor.offset);
  const fmt = before[before.length - 1] ?? after[0] ?? {};
  paras[cursor.para] = { spans: mergeSpans([...before, { ...fmt, text }, ...after]) };
  return { doc: { ...doc, paragraphs: paras }, cursor: { para: cursor.para, offset: cursor.offset + text.length } };
}

function insertBreak(doc, cursor) {
  const paras = [...doc.paragraphs];
  const [before, after] = splitSpansAt(paras[cursor.para].spans, cursor.offset);
  paras[cursor.para] = { spans: mergeSpans(before.length ? before : [{ text: '' }]) };
  paras.splice(cursor.para + 1, 0, { spans: mergeSpans(after.length ? after : [{ text: '' }]) });
  return { doc: { ...doc, paragraphs: paras }, cursor: { para: cursor.para + 1, offset: 0 } };
}

function deleteChar(doc, cursor, backward) {
  const paras = [...doc.paragraphs];
  if (backward) {
    if (cursor.offset === 0) {
      if (cursor.para === 0) return { doc, cursor };
      const prevLen = paraText(paras[cursor.para - 1]).length;
      const merged = { spans: mergeSpans([...paras[cursor.para - 1].spans, ...paras[cursor.para].spans]) };
      paras.splice(cursor.para - 1, 2, merged);
      return { doc: { ...doc, paragraphs: paras }, cursor: { para: cursor.para - 1, offset: prevLen } };
    }
    const [before, rest] = splitSpansAt(paras[cursor.para].spans, cursor.offset - 1);
    const [, afterOne]   = splitSpansAt(rest, 1);
    paras[cursor.para] = { spans: mergeSpans([...before, ...afterOne]) };
    return { doc: { ...doc, paragraphs: paras }, cursor: { ...cursor, offset: cursor.offset - 1 } };
  } else {
    const text = paraText(paras[cursor.para]);
    if (cursor.offset === text.length) {
      if (cursor.para === paras.length - 1) return { doc, cursor };
      const merged = { spans: mergeSpans([...paras[cursor.para].spans, ...paras[cursor.para + 1].spans]) };
      paras.splice(cursor.para, 2, merged);
      return { doc: { ...doc, paragraphs: paras }, cursor };
    }
    const [before, rest] = splitSpansAt(paras[cursor.para].spans, cursor.offset);
    const [, afterOne]   = splitSpansAt(rest, 1);
    paras[cursor.para] = { spans: mergeSpans([...before, ...afterOne]) };
    return { doc: { ...doc, paragraphs: paras }, cursor };
  }
}

function deleteSelection(doc, sel) {
  const { anchor, focus } = normSel(sel);
  const paras = [...doc.paragraphs];
  if (anchor.para === focus.para) {
    const [before]  = splitSpansAt(paras[anchor.para].spans, anchor.offset);
    const [, after] = splitSpansAt(paras[anchor.para].spans, focus.offset);
    paras[anchor.para] = { spans: mergeSpans([...before, ...after]) };
    return { doc: { ...doc, paragraphs: paras }, cursor: anchor };
  }
  const [before]  = splitSpansAt(paras[anchor.para].spans, anchor.offset);
  const [, after] = splitSpansAt(paras[focus.para].spans, focus.offset);
  paras.splice(anchor.para, focus.para - anchor.para + 1, { spans: mergeSpans([...before, ...after]) });
  return { doc: { ...doc, paragraphs: paras }, cursor: anchor };
}

function applyFormat(doc, sel, key, value) {
  const { anchor, focus } = normSel(sel);
  const paras = [...doc.paragraphs];
  for (let pi = anchor.para; pi <= focus.para; pi++) {
    const s = pi === anchor.para ? anchor.offset : 0;
    const e = pi === focus.para  ? focus.offset  : paraText(paras[pi]).length;
    if (s === e) continue;
    const [pre, rest] = splitSpansAt(paras[pi].spans, s);
    const [mid, post] = splitSpansAt(rest, e - s);
    paras[pi] = { spans: mergeSpans([...pre, ...mid.map(sp => ({ ...sp, [key]: value })), ...post]) };
  }
  return { ...doc, paragraphs: paras };
}

function selectionHasFormat(doc, sel, key) {
  if (!hasSelection(sel)) return false;
  const { anchor, focus } = normSel(sel);
  for (let pi = anchor.para; pi <= focus.para; pi++) {
    const s = pi === anchor.para ? anchor.offset : 0;
    const e = pi === focus.para  ? focus.offset  : paraText(doc.paragraphs[pi]).length;
    if (s === e) continue;
    const [, rest] = splitSpansAt(doc.paragraphs[pi].spans, s);
    const [mid]    = splitSpansAt(rest, e - s);
    if (mid.some(sp => !sp[key])) return false;
  }
  return true;
}

function selectedText(doc, sel) {
  if (!hasSelection(sel)) return '';
  const { anchor, focus } = normSel(sel);
  const parts = [];
  for (let pi = anchor.para; pi <= focus.para; pi++) {
    const s = pi === anchor.para ? anchor.offset : 0;
    const e = pi === focus.para  ? focus.offset  : paraText(doc.paragraphs[pi]).length;
    parts.push(paraText(doc.paragraphs[pi]).slice(s, e));
    if (pi < focus.para) parts.push('\n');
  }
  return parts.join('');
}

// ── Pixel measurement ─────────────────────────────────────────────────────────

function measureSpan(text, span, defaultFontSize) {
  if (!text) return 0;
  const fs = span.fontSize ?? defaultFontSize;
  const style = [span.bold && 'bold', span.italic && 'italic'].filter(Boolean).join(' ');
  if (typeof __glyx_measure_text !== 'undefined') {
    const r = __glyx_measure_text(text, fs, 999999, style || undefined);
    return r.width;
  }
  return text.length * fs * 0.55; // fallback estimate
}

function measureCursorX(para, offset, defaultFontSize) {
  let x = 0, rem = offset;
  for (const span of para.spans) {
    if (rem <= 0) break;
    if (rem >= span.text.length) { x += measureSpan(span.text, span, defaultFontSize); rem -= span.text.length; }
    else { x += measureSpan(span.text.slice(0, rem), span, defaultFontSize); break; }
  }
  return x;
}

function clickToOffset(para, clickX, defaultFontSize) {
  let x = 0, charOffset = 0;
  for (const span of para.spans) {
    const fs = span.fontSize ?? defaultFontSize;
    const spanW = measureSpan(span.text, span, defaultFontSize);
    if (x + spanW >= clickX) {
      const localX = clickX - x;
      for (let i = 0; i <= span.text.length; i++) {
        const w = measureSpan(span.text.slice(0, i), span, defaultFontSize);
        if (w >= localX) {
          const prevW = i > 0 ? measureSpan(span.text.slice(0, i - 1), span, defaultFontSize) : 0;
          return charOffset + (localX - prevW < w - localX ? i - 1 : i);
        }
      }
      return charOffset + span.text.length;
    }
    x += spanW;
    charOffset += span.text.length;
  }
  return charOffset;
}

// ── Context ───────────────────────────────────────────────────────────────────

const EditorCtx = createContext(null);

// ── RichTextEditor ────────────────────────────────────────────────────────────

let _focusedEditor = null; // global; only one editor focused at a time

export function RichTextEditor({
  value,
  onChange,
  width        = 600,
  height       = 400,
  fontSize     = 14,
  color        = '#e8e8f0',
  placeholder  = '',
  style,
  children,    // optional: render toolbar etc. using context
}) {
  const [doc, setDoc_]   = useState(() => value ?? emptyDoc());
  const [cursor, setCursor_] = useState({ para: 0, offset: 0 });
  const [sel, setSel_]   = useState({ anchor: { para: 0, offset: 0 }, focus: { para: 0, offset: 0 } });
  const [focused, setFocused] = useState(false);
  const [blinkOn, setBlinkOn] = useState(true);
  const nodeIdRef = useRef(null);

  // Keep refs current for stable callbacks
  const docRef    = useRef(doc);
  const cursorRef = useRef(cursor);
  const selRef    = useRef(sel);
  docRef.current    = doc;
  cursorRef.current = cursor;
  selRef.current    = sel;

  // Sync controlled value
  useEffect(() => { if (value) setDoc_(value); }, [value]);

  const setDoc = useCallback((d) => {
    setDoc_(d);
    onChange?.(d);
  }, [onChange]);

  const setCursor = useCallback((c) => {
    setCursor_(c);
    setSel_({ anchor: c, focus: c });
  }, []);

  const applyEdit = useCallback((fn) => {
    const result = fn(docRef.current, cursorRef.current);
    setDoc(result.doc);
    setCursor_(result.cursor);
    setSel_({ anchor: result.cursor, focus: result.cursor });
  }, [setDoc]);

  // Cursor blink — only while focused
  useEffect(() => {
    if (!focused) { setBlinkOn(true); return; }
    const id = setInterval(() => setBlinkOn(v => !v), 530);
    return () => clearInterval(id);
  }, [focused]);

  // Key handler
  const onKey = useCallback(({ key, ctrl, shift, pressed }) => {
    if (_focusedEditor !== nodeIdRef.current) return;
    if (!pressed) return;

    setBlinkOn(true); // reset blink on any key

    const doc    = docRef.current;
    const cursor = cursorRef.current;
    const sel    = selRef.current;
    const hasSel = hasSelection(sel);

    // ── Ctrl shortcuts ───────────────────────────────────────────────────────
    if (ctrl) {
      if (key === 'KeyA') {
        const last = doc.paragraphs.length - 1;
        setSel_({ anchor: { para: 0, offset: 0 }, focus: { para: last, offset: paraText(doc.paragraphs[last]).length } });
        setCursor_({ para: last, offset: paraText(doc.paragraphs[last]).length });
        return;
      }
      if (key === 'KeyC') { try { clipboard.writeText(selectedText(doc, sel)); } catch {} return; }
      if (key === 'KeyX') {
        if (!hasSel) return;
        try { clipboard.writeText(selectedText(doc, sel)); } catch {}
        const r = deleteSelection(doc, sel);
        setDoc(r.doc); setCursor_(r.cursor); setSel_({ anchor: r.cursor, focus: r.cursor });
        return;
      }
      if (key === 'KeyV') {
        clipboard.readText().then(text => {
          if (!text) return;
          let d = docRef.current, c = cursorRef.current, s = selRef.current;
          if (hasSelection(s)) { const r = deleteSelection(d, s); d = r.doc; c = r.cursor; }
          // Insert each line as a paragraph break
          const lines = text.split('\n');
          let result = { doc: d, cursor: c };
          for (let i = 0; i < lines.length; i++) {
            if (i > 0) result = insertBreak(result.doc, result.cursor);
            if (lines[i]) result = insertText(result.doc, result.cursor, lines[i]);
          }
          setDoc(result.doc); setCursor_(result.cursor); setSel_({ anchor: result.cursor, focus: result.cursor });
        }).catch(() => {});
        return;
      }
      // Bold / italic / underline
      if (key === 'KeyB') {
        if (!hasSel) return;
        const on = selectionHasFormat(doc, sel, 'bold');
        setDoc(applyFormat(doc, sel, 'bold', !on));
        return;
      }
      if (key === 'KeyI') {
        if (!hasSel) return;
        const on = selectionHasFormat(doc, sel, 'italic');
        setDoc(applyFormat(doc, sel, 'italic', !on));
        return;
      }
      if (key === 'KeyU') {
        if (!hasSel) return;
        const on = selectionHasFormat(doc, sel, 'underline');
        setDoc(applyFormat(doc, sel, 'underline', !on));
        return;
      }
      return;
    }

    // ── Arrow navigation ─────────────────────────────────────────────────────
    if (key === 'ArrowLeft' || key === 'ArrowRight') {
      const delta = key === 'ArrowLeft' ? -1 : 1;
      if (shift) {
        const newFocus = moveCursorBy(doc, sel.focus, delta);
        setSel_(s => ({ ...s, focus: newFocus }));
        setCursor_(newFocus);
      } else if (hasSel && !shift) {
        const { anchor, focus } = normSel(sel);
        const c = key === 'ArrowLeft' ? anchor : focus;
        setCursor(c);
      } else {
        setCursor(moveCursorBy(doc, cursor, delta));
      }
      return;
    }
    if (key === 'ArrowUp' || key === 'ArrowDown') {
      const dir = key === 'ArrowUp' ? -1 : 1;
      const LINE_H = (fontSize) * 1.5;
      const newPos = moveCursorVertical(doc, shift ? sel.focus : cursor, dir, LINE_H, fontSize);
      if (shift) { setSel_(s => ({ ...s, focus: newPos })); setCursor_(newPos); }
      else { setCursor(newPos); }
      return;
    }
    if (key === 'Home') {
      const c = { para: cursor.para, offset: 0 };
      if (shift) { setSel_(s => ({ ...s, focus: c })); setCursor_(c); } else { setCursor(c); }
      return;
    }
    if (key === 'End') {
      const c = { para: cursor.para, offset: paraText(doc.paragraphs[cursor.para]).length };
      if (shift) { setSel_(s => ({ ...s, focus: c })); setCursor_(c); } else { setCursor(c); }
      return;
    }

    // ── Delete / Backspace ───────────────────────────────────────────────────
    if (key === 'Backspace' || key === 'Delete') {
      if (hasSel) {
        const r = deleteSelection(doc, sel);
        setDoc(r.doc); setCursor_(r.cursor); setSel_({ anchor: r.cursor, focus: r.cursor });
      } else {
        applyEdit((d, c) => deleteChar(d, c, key === 'Backspace'));
      }
      return;
    }

    // ── Enter ────────────────────────────────────────────────────────────────
    if (key === 'Enter') {
      if (hasSel) { const r = deleteSelection(doc, sel); setDoc(r.doc); setCursor_(r.cursor); setSel_({ anchor: r.cursor, focus: r.cursor }); }
      applyEdit((d, c) => insertBreak(d, c));
      return;
    }

    // ── Printable characters ─────────────────────────────────────────────────
    if (key.length === 1 || key === 'Space') {
      const ch = key === 'Space' ? ' ' : key;
      if (hasSel) {
        const r = deleteSelection(doc, sel);
        const r2 = insertText(r.doc, r.cursor, ch);
        setDoc(r2.doc); setCursor_(r2.cursor); setSel_({ anchor: r2.cursor, focus: r2.cursor });
      } else {
        applyEdit((d, c) => insertText(d, c, ch));
      }
      return;
    }
  }, [applyEdit, setDoc, setCursor, fontSize]);

  useEffect(() => {
    addKeyListener(onKey);
    return () => removeKeyListener(onKey);
  }, [onKey]);

  // Click outside → blur
  const onGlobalClick = useCallback((ev) => {
    if (!nodeIdRef.current) return;
    const layout = typeof __glyx_getLayout !== 'undefined' ? __glyx_getLayout(nodeIdRef.current) : null;
    if (layout && (ev.x < layout.x || ev.x > layout.x + layout.width || ev.y < layout.y || ev.y > layout.y + layout.height)) {
      if (_focusedEditor === nodeIdRef.current) { _focusedEditor = null; setFocused(false); }
    }
  }, []);

  useEffect(() => {
    addGlobalClickListener(onGlobalClick);
    return () => removeGlobalClickListener(onGlobalClick);
  }, [onGlobalClick]);

  // Click inside → position cursor
  const onPress = useCallback((ev) => {
    _focusedEditor = nodeIdRef.current;
    setFocused(true);
    setBlinkOn(true);
    const LINE_H = fontSize * 1.5;
    const PADDING = 8;
    const paraIdx = Math.min(
      doc.paragraphs.length - 1,
      Math.max(0, Math.floor((ev.locationY - PADDING) / LINE_H))
    );
    const offset = clickToOffset(doc.paragraphs[paraIdx], ev.locationX - PADDING, fontSize);
    const c = { para: paraIdx, offset };
    setCursor(c);
  }, [doc, fontSize, setCursor]);

  const onMount = useCallback((id) => { nodeIdRef.current = id; }, []);

  const LINE_H  = fontSize * 1.5;
  const PADDING = 8;

  const ctxValue = {
    doc, setDoc, cursor, setCursor, sel, setSel: setSel_, applyEdit,
    selectionHasFormat: (key) => selectionHasFormat(doc, sel, key),
    toggleFormat: (key) => {
      if (!hasSelection(sel)) return;
      const on = selectionHasFormat(doc, sel, key);
      setDoc(applyFormat(doc, sel, key, !on));
    },
    fontSize,
  };

  const isEmpty = doc.paragraphs.length === 1 && paraText(doc.paragraphs[0]) === '';

  return (
    <EditorCtx.Provider value={ctxValue}>
      {children}
      <Pressable
        onPress={onPress}
        _glyxOnMount={onMount}
        style={{
          width,
          height,
          backgroundColor: '#1a1a24',
          borderRadius: 6,
          borderWidth: 1,
          borderColor: focused ? '#5c6bc0' : '#2a2a3a',
          overflow: 'hidden',
          ...style,
        }}
      >
        <View style={{ padding: PADDING, flex: 1 }}>
          {isEmpty && placeholder ? (
            <Text style={{ fontSize, color: '#555577', position: 'absolute', top: PADDING, left: PADDING }}>
              {placeholder}
            </Text>
          ) : null}
          {doc.paragraphs.map((para, pi) => (
            <ParagraphRow
              key={pi}
              para={para}
              paraIdx={pi}
              cursor={cursor}
              sel={sel}
              focused={focused}
              blinkOn={blinkOn}
              fontSize={fontSize}
              color={color}
              lineHeight={LINE_H}
            />
          ))}
        </View>
      </Pressable>
    </EditorCtx.Provider>
  );
}

// ── ParagraphRow ──────────────────────────────────────────────────────────────

function ParagraphRow({ para, paraIdx, cursor, sel, focused, blinkOn, fontSize, color, lineHeight }) {
  const { anchor, focus: selFocus } = normSel(sel);

  // Compute selection rect within this paragraph (if any)
  let selX0 = null, selX1 = null;
  if (hasSelection(sel) && paraIdx >= anchor.para && paraIdx <= selFocus.para) {
    const s = paraIdx === anchor.para  ? anchor.offset   : 0;
    const e = paraIdx === selFocus.para ? selFocus.offset : paraText(para).length;
    if (s < e) {
      selX0 = measureCursorX(para, s, fontSize);
      selX1 = measureCursorX(para, e, fontSize);
    }
  }

  // Compute cursor x within this paragraph
  const cursorX = (focused && cursor.para === paraIdx)
    ? measureCursorX(para, cursor.offset, fontSize)
    : null;

  return (
    <View style={{ height: lineHeight, flexDirection: 'row', position: 'relative' }}>
      {/* Selection highlight */}
      {selX0 !== null && (
        <View style={{
          position: 'absolute',
          left: selX0,
          top: 2,
          width: Math.max(1, selX1 - selX0),
          height: lineHeight - 4,
          backgroundColor: '#3949ab55',
          borderRadius: 2,
        }} />
      )}
      {/* Text spans */}
      {para.spans.map((span, si) => (
        span.text ? (
          <Text
            key={si}
            style={{
              fontSize: span.fontSize ?? fontSize,
              color: span.color ?? color,
              fontWeight: span.bold ? 'bold' : 'normal',
              fontStyle: span.italic ? 'italic' : 'normal',
              textDecorationLine: span.underline ? 'underline' : 'none',
            }}
          >
            {span.text}
          </Text>
        ) : null
      ))}
      {/* Cursor */}
      {cursorX !== null && blinkOn && (
        <View style={{
          position: 'absolute',
          left: cursorX,
          top: 2,
          width: 2,
          height: lineHeight - 4,
          backgroundColor: '#7986cb',
          borderRadius: 1,
        }} />
      )}
    </View>
  );
}

// ── RichTextToolbar ───────────────────────────────────────────────────────────

export function RichTextToolbar({ style }) {
  const ctx = useContext(EditorCtx);
  if (!ctx) return null;
  const { toggleFormat, selectionHasFormat } = ctx;

  return (
    <View style={{
      flexDirection: 'row',
      gap: 4,
      padding: 6,
      backgroundColor: '#1e1e2e',
      borderRadius: 6,
      borderWidth: 1,
      borderColor: '#2a2a3a',
      marginBottom: 6,
      ...style,
    }}>
      <ToolBtn label="B" active={selectionHasFormat('bold')}      onPress={() => toggleFormat('bold')}
        style={{ fontWeight: 'bold' }} />
      <ToolBtn label="I" active={selectionHasFormat('italic')}    onPress={() => toggleFormat('italic')}
        style={{ fontStyle: 'italic' }} />
      <ToolBtn label="U" active={selectionHasFormat('underline')} onPress={() => toggleFormat('underline')}
        style={{ textDecorationLine: 'underline' }} />
    </View>
  );
}

function ToolBtn({ label, active, onPress, style: textStyle }) {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        width: 30, height: 28,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? '#3949ab' : hover ? '#2a2a3a' : 'transparent',
        borderRadius: 4,
        borderWidth: 1,
        borderColor: active ? '#5c6bc0' : 'transparent',
      }}
    >
      <Text style={{ fontSize: 13, color: active ? '#fff' : '#aaa', ...textStyle }}>{label}</Text>
    </Pressable>
  );
}

// ── Serialization ─────────────────────────────────────────────────────────────

export function docToPlainText(doc) {
  return doc.paragraphs.map(p => paraText(p)).join('\n');
}

export function docFromPlainText(text) {
  return {
    paragraphs: text.split('\n').map(line => ({ spans: [{ text: line }] })),
  };
}

// ── useRichText hook ──────────────────────────────────────────────────────────

export function useEditorContext() {
  return useContext(EditorCtx);
}
