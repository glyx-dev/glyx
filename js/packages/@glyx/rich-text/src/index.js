// @glyx-dev/rich-text — Rich text editor for Glyx apps.
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

import React, { useState, useEffect, useRef, useCallback, useContext, useMemo, createContext } from 'react';
import { View, Text, Pressable, addGlobalClickListener, removeGlobalClickListener, clipboard, registerInput, unregisterInput, registerScrollView, unregisterScrollView, registerDraggable, unregisterDraggable } from '@glyx-dev/react';

// ── Document helpers ──────────────────────────────────────────────────────────

export function emptyDoc() {
  return { paragraphs: [{ spans: [{ text: '' }] }] };
}

export function paraText(para) {
  return para.spans.map(s => s.text).join('');
}

export function splitSpansAt(spans, offset) {
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

export function mergeSpans(spans) {
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

export function cursorEq(a, b)  { return a.para === b.para && a.offset === b.offset; }
function cursorLt(a, b)  { return a.para < b.para || (a.para === b.para && a.offset < b.offset); }
export function hasSelection(s) { return !cursorEq(s.anchor, s.focus); }
export function normSel(s)      { return cursorLt(s.anchor, s.focus) ? s : { anchor: s.focus, focus: s.anchor }; }

export function clampCursor(doc, c) {
  const para = Math.max(0, Math.min(doc.paragraphs.length - 1, c.para));
  const offset = Math.max(0, Math.min(paraText(doc.paragraphs[para]).length, c.offset));
  return { para, offset };
}

export function moveCursorBy(doc, cursor, delta) {
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

// Moves the cursor up/down by one VISUAL line (not one paragraph) using
// `layoutInfo` (see RichTextEditor) so this works whether a paragraph wraps
// to several visual lines or (when `wrap` is off) always exactly one — a
// non-wrapping paragraph is just the degenerate `lines.length === 1` case
// of the same math, so no separate code path is needed for it.
function moveCursorVertical(layoutInfo, cursor, dir, lineHeight, fontSize) {
  const items = layoutInfo.items;
  const item = items[cursor.para];
  let li = 0;
  for (; li < item.lines.length; li++) {
    const line = item.lines[li];
    if (cursor.offset >= line.start && (cursor.offset < line.end || li === item.lines.length - 1)) break;
  }
  const line = item.lines[Math.min(li, item.lines.length - 1)];
  const x = measureCursorX(lineAsParagraph(line), cursor.offset - line.start, fontSize);
  const targetY = item.y + li * lineHeight + dir * lineHeight;

  if (targetY < 0) return { para: 0, offset: 0 };
  const lastItem = items[items.length - 1];
  if (targetY >= lastItem.y + lastItem.height) {
    return { para: lastItem.pi, offset: paraText(lastItem.para).length };
  }
  for (const it of items) {
    if (targetY < it.y + it.height || it === lastItem) {
      const targetLi = Math.max(0, Math.min(it.lines.length - 1, Math.floor((targetY - it.y) / lineHeight)));
      const targetLine = it.lines[targetLi];
      const offset = clickToOffset(lineAsParagraph(targetLine), x, fontSize);
      return { para: it.pi, offset: targetLine.start + offset };
    }
  }
  return cursor;
}

// ── Edit operations ───────────────────────────────────────────────────────────

export function insertText(doc, cursor, text) {
  const paras = [...doc.paragraphs];
  const para = paras[cursor.para];
  const [before, after] = splitSpansAt(para.spans, cursor.offset);
  const fmt = before[before.length - 1] ?? after[0] ?? {};
  paras[cursor.para] = { spans: mergeSpans([...before, { ...fmt, text }, ...after]) };
  return { doc: { ...doc, paragraphs: paras }, cursor: { para: cursor.para, offset: cursor.offset + text.length } };
}

export function insertBreak(doc, cursor) {
  const paras = [...doc.paragraphs];
  const current = paras[cursor.para];
  // Enter on an EMPTY list item exits the list instead of creating another
  // item — matches common editor convention (Word/Google Docs).
  if (current.listType && paraText(current).length === 0) {
    paras[cursor.para] = { ...current, listType: null, indent: 0 };
    return { doc: { ...doc, paragraphs: paras }, cursor };
  }
  const [before, after] = splitSpansAt(current.spans, cursor.offset);
  paras[cursor.para] = { ...current, spans: mergeSpans(before.length ? before : [{ text: '' }]) };
  // Enter on a non-empty list item continues the list onto the new paragraph.
  const newPara = { spans: mergeSpans(after.length ? after : [{ text: '' }]) };
  if (current.listType) { newPara.listType = current.listType; newPara.indent = current.indent ?? 0; }
  paras.splice(cursor.para + 1, 0, newPara);
  return { doc: { ...doc, paragraphs: paras }, cursor: { para: cursor.para + 1, offset: 0 } };
}

export function deleteChar(doc, cursor, backward) {
  const paras = [...doc.paragraphs];
  if (backward) {
    if (cursor.offset === 0) {
      if (cursor.para === 0) return { doc, cursor };
      const prevLen = paraText(paras[cursor.para - 1]).length;
      // Merged paragraph keeps the EARLIER paragraph's list/indent state.
      const merged = { ...paras[cursor.para - 1], spans: mergeSpans([...paras[cursor.para - 1].spans, ...paras[cursor.para].spans]) };
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
      // Merged paragraph keeps the EARLIER paragraph's list/indent state.
      const merged = { ...paras[cursor.para], spans: mergeSpans([...paras[cursor.para].spans, ...paras[cursor.para + 1].spans]) };
      paras.splice(cursor.para, 2, merged);
      return { doc: { ...doc, paragraphs: paras }, cursor };
    }
    const [before, rest] = splitSpansAt(paras[cursor.para].spans, cursor.offset);
    const [, afterOne]   = splitSpansAt(rest, 1);
    paras[cursor.para] = { spans: mergeSpans([...before, ...afterOne]) };
    return { doc: { ...doc, paragraphs: paras }, cursor };
  }
}

export function deleteSelection(doc, sel) {
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
  // Merged paragraph keeps the EARLIER (anchor) paragraph's list/indent state.
  paras.splice(anchor.para, focus.para - anchor.para + 1, { ...paras[anchor.para], spans: mergeSpans([...before, ...after]) });
  return { doc: { ...doc, paragraphs: paras }, cursor: anchor };
}

export function applyFormat(doc, sel, key, value) {
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

export function selectionHasFormat(doc, sel, key) {
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

export function selectedText(doc, sel) {
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

// Real single-line height for `fontSize`, from the native shaper's own
// metrics rather than the `fontSize * 1.5` guess previously used everywhere
// in this file — that guess had no relationship to the renderer's actual
// line spacing, causing overlapping rows whenever a font's real line height
// was smaller than 1.5×. Mirrors the equivalent fix in @glyx-dev/react's
// TextInput (controls.js's `realLineHeight`).
function richTextLineHeight(fontSize) {
  if (typeof __glyx_measure_text !== 'undefined') {
    return __glyx_measure_text('M', fontSize, 1e6).height;
  }
  return fontSize * 1.5;
}

function spanStyle(span) {
  return [span.bold && 'bold', span.italic && 'italic'].filter(Boolean).join(' ') || undefined;
}

function measureSpan(text, span, defaultFontSize) {
  if (!text) return 0;
  const fs = span.fontSize ?? defaultFontSize;
  if (typeof __glyx_measure_text === 'undefined') {
    return text.length * fs * 0.55; // fallback estimate
  }
  const style = spanStyle(span);
  // Parley's `Layout::width()` deliberately EXCLUDES trailing whitespace
  // from the reported width (correct for line-box sizing). A string that
  // is ENTIRELY whitespace has no non-whitespace content to anchor to, so
  // it always reports ~0 regardless of how many space characters it has.
  // `wrapParagraph` measures whitespace TOKENS in isolation while
  // accumulating a running line width — every such token silently
  // contributing 0 let long lines under-count their real width and never
  // cross the wrap threshold. Fix: append a non-whitespace sentinel,
  // measure both, subtract — the same trick `glyx-text`'s Rust
  // `measure_to_cursor` already uses for the identical reason.
  if (/^\s+$/.test(text)) {
    const withSentinel = __glyx_measure_text(text + 'x', fs, 999999, style).width;
    const sentinelOnly = __glyx_measure_text('x', fs, 999999, style).width;
    return Math.max(0, withSentinel - sentinelOnly);
  }
  return __glyx_measure_text(text, fs, 999999, style).width;
}

// Cursor X for character index `charIdx` *within one span's full text*.
// Shapes `span.text` (the real, complete string — never a growing slice of
// it) exactly once per call and reads the position straight off that one
// layout via the native `Cursor` API, so it can never drift from what was
// actually rendered the way re-measuring independently-shaped prefixes
// (`span.text.slice(0, i)`) could.
function cursorXInSpan(span, charIdx, defaultFontSize) {
  const fs = span.fontSize ?? defaultFontSize;
  if (typeof __glyx_text_cursor_x !== 'undefined') {
    return __glyx_text_cursor_x(span.text, fs, 999999, charIdx, spanStyle(span));
  }
  return charIdx * fs * 0.55; // fallback estimate
}

// Nearest-boundary character index for pixel offset `localX` *within one
// span's full text* — same single-shape guarantee as `cursorXInSpan`, in
// the opposite direction (pixels → char index).
function charAtXInSpan(span, localX, defaultFontSize) {
  const fs = span.fontSize ?? defaultFontSize;
  if (typeof __glyx_text_char_at_x !== 'undefined') {
    return __glyx_text_char_at_x(span.text, fs, 999999, localX, spanStyle(span));
  }
  return Math.round(localX / (fs * 0.55)); // fallback estimate
}

function measureCursorX(para, offset, defaultFontSize) {
  let x = 0, rem = offset;
  for (const span of para.spans) {
    if (rem <= 0) break;
    if (rem >= span.text.length) {
      // NOT `measureSpan` here: Parley's `Layout::width()` (what
      // `measureSpan`/`__glyx_measure_text` report) deliberately EXCLUDES
      // trailing whitespace from the reported width — correct for line-box
      // sizing, wrong for "where does the cursor go after a trailing
      // space." `cursorXInSpan` (native `Cursor::geometry`, per-cluster
      // position) doesn't have that exclusion, so use it for the
      // full-piece case too, not just the partial-offset one below.
      x += cursorXInSpan(span, span.text.length, defaultFontSize);
      rem -= span.text.length;
    } else {
      x += cursorXInSpan(span, rem, defaultFontSize);
      break;
    }
  }
  return x;
}

function clickToOffset(para, clickX, defaultFontSize) {
  let x = 0, charOffset = 0;
  for (const span of para.spans) {
    const spanW = measureSpan(span.text, span, defaultFontSize);
    if (x + spanW >= clickX) {
      const localX = clickX - x;
      return charOffset + charAtXInSpan(span, localX, defaultFontSize);
    }
    x += spanW;
    charOffset += span.text.length;
  }
  return charOffset;
}

// For double-click word selection specifically: which character's pixel
// box actually CONTAINS clickX — not the nearest boundary/gap the way
// `clickToOffset` works. Nearest-boundary rounding is correct for caret
// placement, but it's ambiguous exactly at a word/space edge (it can round
// to the gap on either side), which is what let a double-click's word scan
// start from the wrong side of that gap and pick up an adjacent space.
// Containment removes the ambiguity: it always names one real character.
export function charIndexAtPoint(para, clickX, defaultFontSize) {
  let x = 0, charOffset = 0;
  for (const span of para.spans) {
    const spanW = measureSpan(span.text, span, defaultFontSize);
    if (clickX < x + spanW || charOffset + span.text.length >= paraText(para).length) {
      for (let i = 0; i < span.text.length; i++) {
        const wAfter = cursorXInSpan(span, i + 1, defaultFontSize);
        if (clickX < x + wAfter) return charOffset + i;
      }
      return charOffset + Math.max(0, span.text.length - 1);
    }
    x += spanW;
    charOffset += span.text.length;
  }
  return Math.max(0, charOffset - 1);
}

// ── Word-wrap ────────────────────────────────────────────────────────────────
//
// This document model has no multi-run native text layout available (Rust's
// shape() is single-style-per-call), so a paragraph with mixed bold/italic
// spans can't be wrapped in one native pass the way a plain string could.
// Instead: split every span into whitespace/word tokens (regex below),
// greedily pack tokens into "visual lines" using the SAME per-token
// `measureSpan` width used everywhere else in this file (so wrap decisions
// use exactly the same numbers as click/cursor math, not a separate
// estimate), and stop wrapping only when a single token alone exceeds the
// available width (it's simply allowed to overflow that one line).
//
// Each visual line is a plain { start, end, pieces } object where `pieces`
// is a `spans`-shaped array — `lineAsParagraph` wraps that back into a
// `{ spans }` shape so the EXISTING `measureCursorX` / `clickToOffset` /
// `charIndexAtPoint` functions can be reused verbatim against just that
// one visual line, instead of duplicating per-line pixel math.
export function wrapParagraph(para, maxWidth, fontSize) {
  const text = paraText(para);
  if (!text) return [{ start: 0, end: 0, pieces: [] }];

  const tokens = []; // { text, span, start }
  let offset = 0;
  for (const span of para.spans) {
    const re = /\s+|\S+/g;
    let m;
    while ((m = re.exec(span.text))) {
      tokens.push({ text: m[0], span, start: offset + m.index });
    }
    offset += span.text.length;
  }

  const lines = [];
  let curPieces = [];
  let curWidth = 0;
  let curStart = 0;

  const flush = (end) => {
    // Merge consecutive tokens that share the SAME original span (word,
    // space, word, ... all one style run) back into one piece per run,
    // rather than rendering one native Text node per token. A whitespace
    // token is otherwise a Text node whose ENTIRE content is blank, and at
    // least one native text-shaping path collapses such a node's rendered
    // width to zero (space glyphs are meant to sit *between* other glyphs
    // in the same shaped run, not be their own isolated run) — merging
    // keeps every space embedded inside a real run, exactly like the
    // pre-wrap single-Text-per-span rendering did.
    const merged = [];
    for (const p of curPieces) {
      const prev = merged[merged.length - 1];
      if (prev && prev.span === p.span) prev.text += p.text;
      else merged.push({ span: p.span, text: p.text, start: p.start });
    }
    lines.push({ start: curStart, end, pieces: merged });
    curPieces = [];
    curWidth = 0;
    curStart = end;
  };

  for (const tok of tokens) {
    const isWhitespace = /^\s+$/.test(tok.text);
    const w = measureSpan(tok.text, tok.span, fontSize);
    if (!isWhitespace && curPieces.length > 0 && curWidth + w > maxWidth) {
      flush(tok.start);
    }
    curPieces.push({ span: tok.span, text: tok.text, start: tok.start });
    curWidth += w;
  }
  flush(text.length);
  return lines;
}

// Wrap one visual line's pieces back into the `{ spans }` shape that
// `measureCursorX` / `clickToOffset` / `charIndexAtPoint` expect, so those
// (already correctness-fixed) functions can be reused unchanged per-line.
function lineAsParagraph(line) {
  return { spans: line.pieces.map((p) => ({ ...p.span, text: p.text })) };
}

// ── Word boundaries (double-click selection) ────────────────────────────────

// Three classes, not two — word / whitespace / punctuation-or-other — so a
// word-boundary scan can never bleed into an adjacent space (or vice
// versa). A two-class "word vs. everything else" split would merge
// whitespace and punctuation into one run, which is what let a
// double-click's selection include a trailing/leading space next to a word.
function _charClass(ch) {
  if (/[A-Za-z0-9_]/.test(ch)) return 0; // word
  if (/\s/.test(ch)) return 1;           // whitespace
  return 2;                              // punctuation / other
}

// A "word" is a maximal run of the same character class, matching standard
// desktop-editor double-click behavior. Mirrors @glyx-dev/react's
// TextInput (controls.js's `wordRangeAt`).
export function wordRangeAt(text, offset) {
  if (!text.length) return { start: 0, end: 0 };
  const idx = Math.max(0, Math.min(offset, text.length - 1));
  const sameClass = _charClass(text[idx]);
  let start = idx, end = idx + 1;
  while (start > 0 && _charClass(text[start - 1]) === sameClass) start--;
  while (end < text.length && _charClass(text[end]) === sameClass) end++;
  return { start, end };
}

// ── Lists ─────────────────────────────────────────────────────────────────────

const INDENT_PX    = 24;
const BULLET_CHARS = ['•', '◦', '▪'];
const MAX_INDENT   = 4;

// A numbered list's displayed number is always computed, never stored — so
// deleting/reordering/splitting items renumbers correctly with no separate
// bookkeeping. Walks backward from `idx` counting consecutive same-indent
// `number` paragraphs; a shallower indent or a same-indent non-number
// paragraph ends the run. Deeper-indented paragraphs (nested sub-lists) are
// skipped over without breaking the outer count.
export function computeListNumber(paragraphs, idx) {
  const p = paragraphs[idx];
  if (!p || p.listType !== 'number') return 1;
  const indent = p.indent ?? 0;
  let n = 1;
  for (let i = idx - 1; i >= 0; i--) {
    const q = paragraphs[i];
    const qIndent = q.indent ?? 0;
    if (qIndent < indent) break;
    if (qIndent === indent) {
      if (q.listType === 'number') { n++; continue; }
      break;
    }
    // qIndent > indent: nested item, doesn't affect this level's count.
  }
  return n;
}

function listMarkerText(para, number) {
  if (para.listType === 'number') return `${number}. `;
  if (para.listType === 'bullet') return `${BULLET_CHARS[(para.indent ?? 0) % BULLET_CHARS.length]} `;
  return '';
}

// Total pixel width a paragraph's list marker + indent occupies before its
// actual text content starts — needed both to render the marker in the
// right place and to offset cursor/selection/click math, which is computed
// purely in terms of paragraph TEXT (marker-unaware).
function markerWidth(para, fontSize, number) {
  if (!para.listType) return 0;
  const indentPx = (para.indent ?? 0) * INDENT_PX;
  const markerText = listMarkerText(para, number);
  return indentPx + (markerText ? measureSpan(markerText, { fontSize }, fontSize) : 0);
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
  autoFocus    = false,  // focus (and accept keystrokes) as soon as this mounts,
                         // without requiring a real click first — needed when a
                         // parent opens/creates a document programmatically
                         // (e.g. a "New file" action), since there's no ref/
                         // imperative API to focus an already-mounted editor.
  wrap         = true,   // true: long paragraphs soft-wrap to fit `width` (a
                         // normal editor/notes surface). false: paragraphs
                         // stay on one line and overflow horizontally instead
                         // (e.g. a single-line-per-entry log/code view) — set
                         // per-instance since either can be the right choice
                         // depending on what's being edited.
  style,
  children,    // optional: render toolbar etc. using context
}) {
  const [doc, setDoc_]   = useState(() => value ?? emptyDoc());
  const [cursor, setCursor_] = useState({ para: 0, offset: 0 });
  const [sel, setSel_]   = useState({ anchor: { para: 0, offset: 0 }, focus: { para: 0, offset: 0 } });
  const [focused, setFocused] = useState(false);
  const [blinkOn, setBlinkOn] = useState(true);
  const nodeIdRef = useRef(null);
  // Vertical scroll (wheel + native scrollbar drag) for the paragraphs
  // container — same `clip`/`scrollOffsetY`/`showScrollbar` native
  // infrastructure `@glyx-dev/react`'s `ScrollView`/multiline `TextInput`
  // already use, just applied to this editor's own paragraph list directly
  // rather than through the generic `ScrollView` component.
  const [scrollY, setScrollY] = useState(0);
  const scrollYRef = useRef(0);
  const scrollContainerIdRef = useRef(null);
  // Horizontal pan for `wrap={false}` (overflow) paragraphs — no native
  // scroll_offset_x exists in the engine (only scroll_offset_y does; adding
  // one would touch the core scene-caching pipeline for every node type in
  // the app), so this shifts rendered content via plain relative
  // positioning (`left: -scrollX`) instead, driven by a custom draggable
  // scrollbar built with the same `registerDraggable` registry Slider uses
  // for its thumb.
  const [scrollX, setScrollX] = useState(0);
  const scrollXRef = useRef(0);
  const scrollbarTrackIdRef = useRef(null);
  // Y (relative to the editor's top-left) at which the horizontal scrollbar
  // strip begins, or `null` when it isn't shown — click/drag handlers below
  // check this to avoid ALSO starting a text-selection drag underneath the
  // scrollbar. The scrollbar track is a plain descendant `<View>` of the
  // same Pressable this editor's own click/drag routing is registered on
  // (`registerInput`), so a mouse-down on it satisfies BOTH systems'
  // ancestor-walk hit-testing independently — nothing in this framework
  // stops that bubbling, so the guard has to live here instead.
  const hScrollbarBoundRef = useRef(null);

  // Keep refs current for stable callbacks
  const docRef    = useRef(doc);
  const cursorRef = useRef(cursor);
  const selRef    = useRef(sel);
  const layoutInfoRef = useRef(null); // set below, after `layoutInfo` is computed
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
  // Registered as this node's `onKeyPress` (via `registerInput`, in `onMount`
  // below) — NOT the global `addKeyListener` shortcuts channel. That
  // distinction matters: the global channel only carries `{key, ctrl, shift,
  // pressed}`, where `key` is a DOM `.code`-style value ("KeyA", "Digit1",
  // "Space", ...) — never the literal typed character except by the
  // coincidence that `key === 'Space'` matches its own code string. Every
  // *other* letter/digit key would silently never fire the printable-
  // character branch below. `onKeyPress` (same channel @glyx-dev/react's
  // TextInput uses) carries an additional `text` field with the real
  // character, which is what the printable-character branch actually needs.
  // Dispatch is already scoped to whichever input is focused (events.js's
  // own `focusedNodeId`/`inputRegistry`), so no extra focus check is needed
  // here — this only gets called when this editor is genuinely focused.
  const onKey = useCallback(({ key, text, ctrl, shift }) => {
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
      const LINE_H = richTextLineHeight(fontSize);
      const newPos = moveCursorVertical(layoutInfoRef.current, shift ? sel.focus : cursor, dir, LINE_H, fontSize);
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

    // ── Tab / Shift+Tab: indent/outdent list items ──────────────────────────
    if (key === 'Tab') {
      const range = hasSel ? normSel(sel) : { anchor: cursor, focus: cursor };
      const paras = [...doc.paragraphs];
      let changed = false;
      for (let pi = range.anchor.para; pi <= range.focus.para; pi++) {
        const p = paras[pi];
        if (!p.listType) continue;
        const next = Math.max(0, Math.min(MAX_INDENT, (p.indent ?? 0) + (shift ? -1 : 1)));
        if (next !== (p.indent ?? 0)) { paras[pi] = { ...p, indent: next }; changed = true; }
      }
      if (changed) setDoc({ ...doc, paragraphs: paras });
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
    if (text) {
      const ch = text;
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

  const EDITOR_PADDING = 8;
  // The caller's `style` prop is spread onto the SAME Pressable that click
  // coordinates are reported relative to (see render below). If it sets its
  // own `padding`, that shifts where the actual text content starts by an
  // amount this click math must also account for — otherwise every offset
  // computation silently drifts by exactly that many pixels, which is
  // exactly what @glyx-dev's `files` example hits (its RichTextEditor style
  // prop sets `padding: 12` for cosmetic spacing, on top of this
  // component's own internal EDITOR_PADDING).
  const outerPadLeft = (style && (style.paddingLeft ?? style.padding)) || 0;
  const outerPadTop  = (style && (style.paddingTop  ?? style.padding)) || 0;
  const LINE_H = richTextLineHeight(fontSize);

  // Per-paragraph layout: marker width, wrapped visual lines (or a single
  // "line" spanning the whole paragraph when `wrap` is off), and cumulative
  // Y so paragraphs of different visual-line counts stack correctly. Click
  // math and rendering both read from this SAME computation, so they can
  // never disagree about where a given paragraph/line actually sits.
  const layoutInfo = useMemo(() => {
    const paras = doc.paragraphs;
    const contentWidth = Math.max(20, (typeof width === 'number' ? width : 600) - 2 * (EDITOR_PADDING + outerPadLeft));
    let y = 0;
    let maxContentWidth = contentWidth;
    const items = paras.map((para, pi) => {
      const number = para.listType === 'number' ? computeListNumber(paras, pi) : null;
      const mw = markerWidth(para, fontSize, number);
      const lines = wrap
        ? wrapParagraph(para, Math.max(20, contentWidth - mw), fontSize)
        : [{ start: 0, end: paraText(para).length, pieces: para.spans.map((s) => ({ span: s, text: s.text, start: 0 })) }];
      if (!wrap) {
        // No wrapping means a paragraph's real width can exceed `contentWidth`
        // — track the widest one so the horizontal scrollbar/pan (below) know
        // how far there is to scroll.
        const lineW = mw + lines[0].pieces.reduce((sum, p) => sum + measureSpan(p.text, p.span, fontSize), 0);
        if (lineW > maxContentWidth) maxContentWidth = lineW;
      }
      const item = { pi, para, mw, number, lines, y, height: lines.length * LINE_H };
      y += item.height;
      return item;
    });
    return { items, totalHeight: y, contentWidth, maxContentWidth };
  }, [doc, fontSize, wrap, width, outerPadLeft, LINE_H]);
  layoutInfoRef.current = layoutInfo;

  const showHScrollbar = !wrap && layoutInfo.maxContentWidth > layoutInfo.contentWidth + 0.5;
  // Prefer the ACTUAL rendered layout height over the `height` prop — Taffy
  // can resolve the Pressable to a shorter box than requested (e.g. when the
  // parent doesn't have enough room), and using the requested prop value
  // here silently put this bound ~90px above where the scrollbar actually
  // renders, so the click-Y guard below never triggered for a real
  // scrollbar drag.
  const measuredH = (nodeIdRef.current != null && typeof __glyx_getLayout !== 'undefined')
    ? __glyx_getLayout(nodeIdRef.current)?.height
    : null;
  const effectiveHeight = (typeof measuredH === 'number' && measuredH > 0)
    ? measuredH
    : (typeof height === 'number' ? height : null);
  hScrollbarBoundRef.current = (showHScrollbar && effectiveHeight != null) ? effectiveHeight - 12 : null;

  // y (relative to the editor's top-left) → { para index, visual line index
  // within that paragraph }. Shared by posFromXY and onDoubleClickAt so both
  // agree on which line was clicked.
  //
  // Reads `layoutInfoRef.current` (NOT the `layoutInfo` variable) — this
  // function, transitively, is reachable from `onDragAt`/`onDoubleClickAt`,
  // which are registered ONCE via `registerInput` inside `_glyxOnMount`
  // (fires exactly once per node, ignores later identity changes — see
  // project history). Closing over `layoutInfo` directly would freeze
  // whatever wrapped-line layout existed at the FIRST render forever, going
  // stale the moment the user typed a single character — exactly what broke
  // mouse selection/highlighting after wrap was added. `docRef`/`cursorRef`/
  // `selRef` already use this same ref-indirection for the same reason;
  // `layoutInfoRef` (kept in sync every render, right after the `layoutInfo`
  // useMemo above) follows the identical pattern.
  const hitTestY = useCallback((y) => {
    // Parley draws each line with more leading space above the glyph than
    // below it within its line box, so the VISIBLE text sits lower than a
    // naive top-anchored row grid assumes — clicking near the bottom of a
    // glyph in row N was landing in row N+1's band instead. Bias the click
    // coordinate so each row's hit-test band extends further down before
    // crossing into the next one, matching where the glyph visually sits.
    // Tuned empirically — adjust this fraction if clicks still land one
    // row off after testing.
    const HIT_BIAS = LINE_H * 0.25;
    const items = layoutInfoRef.current.items;
    // `y` is viewport-relative (what the click/drag event reports); add the
    // current scroll offset to land in CONTENT-relative space, matching
    // `layoutInfo`'s own un-scrolled Y coordinates (same technique as
    // `@glyx-dev/react`'s multiline TextInput: `contentY = relY - padding +
    // scrollYRef.current`). Reads the ref (not `scrollY`) for the same
    // staleness reason as `layoutInfoRef` above.
    const adjY = y - EDITOR_PADDING - outerPadTop - HIT_BIAS + scrollYRef.current;
    for (const item of items) {
      if (adjY < item.y + item.height || item === items[items.length - 1]) {
        const lineIdx = Math.max(0, Math.min(item.lines.length - 1, Math.floor((adjY - item.y) / LINE_H)));
        return { pi: item.pi, lineIdx };
      }
    }
    return { pi: 0, lineIdx: 0 };
  }, [outerPadTop, LINE_H]);

  // Shared by click-to-position and drag-to-select: pixel (x, y) relative to
  // the editor's own top-left → nearest { para, offset }. Uses
  // `clickToOffset`'s nearest-BOUNDARY rounding, which is what you want for
  // caret placement (the caret belongs at a gap between characters, and
  // nearest-neighbor is the right tie-break there).
  const posFromXY = useCallback((x, y) => {
    const { pi, lineIdx } = hitTestY(y);
    const item = layoutInfoRef.current.items[pi];
    const line = item.lines[lineIdx];
    const localX = x - EDITOR_PADDING - outerPadLeft - item.mw + scrollXRef.current;
    const localOffset = clickToOffset(lineAsParagraph(line), localX, fontSize);
    return { para: pi, offset: line.start + localOffset };
  }, [fontSize, hitTestY, outerPadLeft]);

  // Click inside → position cursor, anchor a possible drag-selection.
  const dragAnchorRef = useRef({ para: 0, offset: 0 });
  // Latches for the WHOLE drag session (set once on mouse-down, read — never
  // re-evaluated — on every subsequent move) rather than re-checking `y`
  // against the scrollbar's band on each drag event: the scrollbar strip is
  // only 8px tall, and real mouse movement during a fast horizontal drag can
  // easily stray outside that band for a frame or two, which with a
  // per-move check let a selection update leak through and jump to whatever
  // stale anchor was last recorded.
  const textDragSuppressedRef = useRef(false);
  const onPress = useCallback((ev) => {
    const suppressed = hScrollbarBoundRef.current !== null && ev.locationY >= hScrollbarBoundRef.current;
    textDragSuppressedRef.current = suppressed;
    if (suppressed) return;
    _focusedEditor = nodeIdRef.current;
    setFocused(true);
    setBlinkOn(true);
    const c = posFromXY(ev.locationX, ev.locationY);
    dragAnchorRef.current = c;
    setCursor(c);
  }, [posFromXY, setCursor]);

  // Mouse-drag selection: registered as an "input" node (alongside the
  // Pressable) so events.js routes per-frame cursorMoved deltas here while
  // the button is held — Pressable only ever fires a single onPress on
  // release, with no drag/move callback of its own.
  const onDragAt = useCallback((x, y) => {
    if (textDragSuppressedRef.current) return;
    const c = posFromXY(x, y);
    setCursor_(c);
    setSel_({ anchor: dragAnchorRef.current, focus: c });
  }, [posFromXY]);

  // Double-click: select the word under the click, same convention as
  // @glyx-dev/react's TextInput (controls.js's onDoubleClickAt) — this is a
  // separate component with its own click handling, so it needs its own
  // word-boundary logic rather than sharing that one.
  const onDoubleClickAt = useCallback((x, y) => {
    if (hScrollbarBoundRef.current !== null && y >= hScrollbarBoundRef.current) return;
    _focusedEditor = nodeIdRef.current;
    setFocused(true);
    setBlinkOn(true);
    const { pi, lineIdx } = hitTestY(y);
    const item = layoutInfoRef.current.items[pi];
    const line = item.lines[lineIdx];
    // Containment (which character's box the click is actually inside), not
    // nearest-boundary rounding — right at a word/space edge, the boundary
    // is ambiguous and can round to the wrong side, which is what let this
    // pick up an adjacent space instead of the word.
    const localX = x - EDITOR_PADDING - outerPadLeft - item.mw + scrollXRef.current;
    const charIdx = line.start + charIndexAtPoint(lineAsParagraph(line), localX, fontSize);
    const { start, end } = wordRangeAt(paraText(item.para), charIdx);
    const anchor = { para: pi, offset: start };
    const focus  = { para: pi, offset: end };
    setCursor_(focus);
    setSel_({ anchor, focus });
  }, [hitTestY, fontSize, outerPadLeft]);

  // Clamp a target scroll offset against the real (native-measured) content
  // height — mirrors `@glyx-dev/react`'s `ScrollView`/multiline `TextInput`.
  const clampScrollY = useCallback((y) => {
    const id = scrollContainerIdRef.current;
    if (id == null || typeof __glyx_getLayout === 'undefined') return 0;
    const l = __glyx_getLayout(id);
    const max = (l && typeof l.contentHeight === 'number') ? Math.max(0, l.contentHeight - l.height) : 0;
    return Math.min(max, Math.max(0, y));
  }, []);

  const setScrollYBoth = useCallback((y) => {
    scrollYRef.current = y;
    setScrollY(y);
  }, []);

  // Registers the paragraphs container as a scrollable clip node — wheel
  // and native scrollbar-thumb drags both route here via the SAME
  // `registerScrollView` registry `ScrollView` uses. `onScroll`/
  // `onAbsoluteScroll` only ever touch refs, so (like every other
  // `_glyxOnMount`-registered handler in this file) this stays correct
  // forever despite firing exactly once at node creation.
  const onScrollContainerMount = useCallback((id) => {
    scrollContainerIdRef.current = id;
    registerScrollView(id, {
      onScroll:         (dy) => setScrollYBoth(clampScrollY(scrollYRef.current + dy)),
      onAbsoluteScroll: (y)  => setScrollYBoth(clampScrollY(y)),
    });
  }, [clampScrollY, setScrollYBoth]);

  useEffect(() => {
    return () => {
      if (scrollContainerIdRef.current !== null) unregisterScrollView(scrollContainerIdRef.current);
    };
  }, []);

  // Caret follow: keep the cursor's line inside the viewport whenever it
  // moves (typing, arrow keys, clicking) — same purpose as TextInput's own
  // caret-follow effect, using `layoutInfo` for the cursor's real Y instead
  // of re-measuring text height directly.
  useEffect(() => {
    if (!focused) return;
    const id = scrollContainerIdRef.current;
    if (id == null || typeof __glyx_getLayout === 'undefined') return;
    const l = __glyx_getLayout(id);
    if (!l) return;
    const item = layoutInfo.items[cursor.para];
    if (!item) return;
    let li = 0;
    for (; li < item.lines.length; li++) {
      const line = item.lines[li];
      if (cursor.offset >= line.start && (cursor.offset < line.end || li === item.lines.length - 1)) break;
    }
    const caretTop    = item.y + Math.min(li, item.lines.length - 1) * LINE_H;
    const caretBottom = caretTop + LINE_H;
    const viewH = l.height;
    let sy = scrollYRef.current;
    if (caretBottom - sy > viewH) sy = caretBottom - viewH;
    if (caretTop - sy < 0) sy = caretTop;
    sy = clampScrollY(sy);
    if (sy !== scrollYRef.current) setScrollYBoth(sy);
  }, [cursor, focused, layoutInfo, LINE_H, clampScrollY, setScrollYBoth]);

  const clampScrollX = useCallback((x) => {
    const li = layoutInfoRef.current;
    const max = Math.max(0, li.maxContentWidth - li.contentWidth);
    return Math.min(max, Math.max(0, x));
  }, []);

  const setScrollXBoth = useCallback((x) => {
    scrollXRef.current = x;
    setScrollX(x);
  }, []);

  // Custom horizontal scrollbar track — click/drag anywhere on it jumps or
  // pans, same "track IS the draggable" simplicity Slider uses for its own
  // rail (`registerDraggable` gives absolute screen-space `x`; subtract the
  // track's own layout `x` to get a local fraction).
  const onScrollbarTrackMount = useCallback((id) => {
    scrollbarTrackIdRef.current = id;
    const updateFromX = (x) => {
      const layout = typeof __glyx_getLayout !== 'undefined' ? __glyx_getLayout(id) : null;
      if (!layout || layout.width <= 0) return;
      const li = layoutInfoRef.current;
      const maxScroll = Math.max(0, li.maxContentWidth - li.contentWidth);
      const frac = Math.max(0, Math.min(1, (x - layout.x) / layout.width));
      setScrollXBoth(clampScrollX(frac * maxScroll));
    };
    registerDraggable(id, {
      onDragStart({ x }) { updateFromX(x); },
      onDragMove({ x })  { updateFromX(x); },
    });
  }, [clampScrollX, setScrollXBoth]);

  useEffect(() => {
    return () => {
      if (scrollbarTrackIdRef.current !== null) unregisterDraggable(scrollbarTrackIdRef.current);
    };
  }, []);

  // Caret follow (horizontal): keep the cursor visible when typing/moving
  // near either edge of a non-wrapping paragraph — mirrors the vertical
  // caret-follow effect above, and TextInput's own single-line panning.
  useEffect(() => {
    if (wrap || !focused) return;
    const li = layoutInfoRef.current;
    const item = li.items[cursor.para];
    if (!item) return;
    const line = item.lines[0];
    const caretX = item.mw + measureCursorX(lineAsParagraph(line), cursor.offset - line.start, fontSize);
    const viewportW = li.contentWidth;
    let sx = scrollXRef.current;
    if (caretX - sx > viewportW) sx = caretX - viewportW;
    if (caretX - sx < 0) sx = caretX;
    sx = clampScrollX(sx);
    if (sx !== scrollXRef.current) setScrollXBoth(sx);
  }, [cursor, focused, wrap, layoutInfo, fontSize, clampScrollX, setScrollXBoth]);

  const onMount = useCallback((id) => {
    nodeIdRef.current = id;
    registerInput(id, {
      onClickAt:       (x, y) => { onPress({ locationX: x, locationY: y }); },
      onDoubleClickAt,
      onDragAt,
      onKeyPress:      (ev) => onKey(ev),
      onBlur: () => { if (_focusedEditor === id) { _focusedEditor = null; setFocused(false); } },
    });
    if (autoFocus) {
      _focusedEditor = id;
      setFocused(true);
      setBlinkOn(true);
      // Cursor at the end of the document, same convention as
      // @glyx-dev/react's TextInput focusing (controls.js's onFocus).
      const paras = docRef.current.paragraphs;
      const last = paras.length - 1;
      const end = { para: last, offset: paraText(paras[last]).length };
      setCursor(end);
    }
  }, [onPress, onDoubleClickAt, onDragAt, onKey, autoFocus, setCursor]);

  useEffect(() => {
    return () => { if (nodeIdRef.current !== null) unregisterInput(nodeIdRef.current); };
  }, []);

  const PADDING = EDITOR_PADDING;

  const ctxValue = {
    doc, setDoc, cursor, setCursor, sel, setSel: setSel_, applyEdit,
    selectionHasFormat: (key) => selectionHasFormat(doc, sel, key),
    toggleFormat: (key) => {
      if (!hasSelection(sel)) return;
      const on = selectionHasFormat(doc, sel, key);
      setDoc(applyFormat(doc, sel, key, !on));
    },
    // Applies to the current line (or every line touched by the selection).
    // Toggling the SAME list type off exits the list; toggling a DIFFERENT
    // one switches it (matches common editor convention).
    toggleList: (listType) => {
      const range = hasSelection(sel) ? normSel(sel) : { anchor: cursor, focus: cursor };
      const paras = [...doc.paragraphs];
      for (let pi = range.anchor.para; pi <= range.focus.para; pi++) {
        const p = paras[pi];
        paras[pi] = p.listType === listType
          ? { ...p, listType: null, indent: 0 }
          : { ...p, listType, indent: p.indent ?? 0 };
      }
      setDoc({ ...doc, paragraphs: paras });
    },
    indent: (delta) => {
      const range = hasSelection(sel) ? normSel(sel) : { anchor: cursor, focus: cursor };
      const paras = [...doc.paragraphs];
      let changed = false;
      for (let pi = range.anchor.para; pi <= range.focus.para; pi++) {
        const p = paras[pi];
        if (!p.listType) continue;
        const next = Math.max(0, Math.min(MAX_INDENT, (p.indent ?? 0) + delta));
        if (next !== (p.indent ?? 0)) { paras[pi] = { ...p, indent: next }; changed = true; }
      }
      if (changed) setDoc({ ...doc, paragraphs: paras });
    },
    isListActive: (listType) => doc.paragraphs[cursor.para]?.listType === listType,
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
          position: 'relative',
          backgroundColor: '#1a1a24',
          borderRadius: 6,
          borderWidth: 1,
          borderColor: focused ? '#5c6bc0' : '#2a2a3a',
          overflow: 'hidden',
          ...style,
        }}
      >
        <View
          _glyxOnMount={onScrollContainerMount}
          style={{
            padding: PADDING,
            flex: 1,
            clip: true,
            scrollOffsetY: scrollY,
            showScrollbar: true,
            scrollbarWidth: 8,
            scrollbarColor: '#8c8caa99',
          }}
        >
          {isEmpty && placeholder ? (
            <Text style={{ fontSize, color: '#555577', position: 'absolute', top: PADDING, left: PADDING }}>
              {placeholder}
            </Text>
          ) : null}
          <View style={{ position: 'relative', left: -scrollX }}>
            {layoutInfo.items.map((item) => (
              <ParagraphRow
                key={item.pi}
                para={item.para}
                paraIdx={item.pi}
                mw={item.mw}
                lines={item.lines}
                listNumber={item.number}
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
        </View>
        {/* Horizontal scrollbar — only ever shown for `wrap={false}` when a
            paragraph is actually wider than the box. See the `scrollXRef`
            comment above for why this is a custom JS scrollbar (registerDraggable,
            same mechanism Slider's thumb uses) rather than native scrollOffsetX. */}
        {showHScrollbar ? (() => {
          const trackW    = layoutInfo.contentWidth;
          const maxScroll = layoutInfo.maxContentWidth - layoutInfo.contentWidth;
          const thumbW    = Math.max(24, (trackW / layoutInfo.maxContentWidth) * trackW);
          const thumbX    = (trackW - thumbW) * (scrollX / maxScroll);
          return (
            <View
              _glyxOnMount={onScrollbarTrackMount}
              style={{
                position: 'absolute',
                left: EDITOR_PADDING,
                width: trackW,
                bottom: 2,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#8c8caa33',
              }}
            >
              <View style={{
                position: 'absolute',
                top: 0,
                left: thumbX,
                width: thumbW,
                height: 8,
                borderRadius: 4,
                backgroundColor: '#8c8caa99',
              }} />
            </View>
          );
        })() : null}
      </Pressable>
    </EditorCtx.Provider>
  );
}

// ── ParagraphRow ──────────────────────────────────────────────────────────────

// Renders `mw` + one flow child per line so absolutely-positioned overlays
// (cursor/selection) line up exactly with where a line's text actually
// starts — same convention `markerWidth`'s callers rely on elsewhere.
function LineSpans({ mw, markerText, fontSize, color, pieces }) {
  return (
    <>
      {markerText ? (
        <Text style={{ fontSize, color, width: mw }} textScrollX={0}>{markerText}</Text>
      ) : mw ? (
        <View style={{ width: mw }} />
      ) : null}
      {/* `textScrollX={0}` forces the native renderer's single-line,
          never-wrap path (see glyx-core render.rs: any Text node with
          `textScrollX` set is shaped unbounded at max_width=1e6, matching
          what TextInput already does for its own single-line text).
          Wrapping is decided entirely in JS (`wrapParagraph`, one call per
          paragraph per render) — each visual line's pieces are already
          exactly what should fit, so the native Text itself must never
          re-wrap them on its own (which, mid-relayout while typing, could
          use a stale/squeezed width and visibly wrap+snap-back). */}
      {pieces.map((p, si) => (
        p.text ? (
          <Text
            key={si}
            textScrollX={0}
            style={{
              fontSize: p.span.fontSize ?? fontSize,
              color: p.span.color ?? color,
              fontWeight: p.span.bold ? 'bold' : 'normal',
              fontStyle: p.span.italic ? 'italic' : 'normal',
              textDecorationLine: p.span.underline ? 'underline' : 'none',
            }}
          >
            {p.text}
          </Text>
        ) : null
      ))}
    </>
  );
}

function ParagraphRow({ para, paraIdx, mw, lines, cursor, sel, focused, blinkOn, fontSize, color, lineHeight, listNumber }) {
  const { anchor, focus: selFocus } = normSel(sel);
  const markerText = para.listType ? listMarkerText(para, listNumber) : '';
  const selActive = hasSelection(sel) && paraIdx >= anchor.para && paraIdx <= selFocus.para;
  const selStart  = selActive ? (paraIdx === anchor.para  ? anchor.offset   : 0) : null;
  const selEnd    = selActive ? (paraIdx === selFocus.para ? selFocus.offset : paraText(para).length) : null;

  return (
    <>
      {lines.map((line, li) => {
        const lp = lineAsParagraph(line);
        const isLastLine = li === lines.length - 1;

        // Selection intersected with this visual line's [start, end) range.
        let selX0 = null, selX1 = null;
        if (selActive) {
          const s = Math.max(selStart, line.start);
          const e = Math.min(selEnd, line.end);
          if (s < e) {
            selX0 = measureCursorX(lp, s - line.start, fontSize);
            selX1 = measureCursorX(lp, e - line.start, fontSize);
          }
        }

        // A cursor offset exactly at a wrap boundary (== this line's end,
        // and this isn't the last line) belongs to the START of the NEXT
        // line, not the end of this one — matches standard editor caret
        // convention when a wrap point falls right at the cursor.
        const cursorHere = focused && cursor.para === paraIdx && cursor.offset >= line.start &&
          (cursor.offset < line.end || isLastLine);
        const cursorX = cursorHere ? measureCursorX(lp, cursor.offset - line.start, fontSize) : null;

        return (
          <View key={li} style={{ height: lineHeight, flexDirection: 'row', position: 'relative' }}>
            {selX0 !== null && (
              <View style={{
                position: 'absolute',
                left: mw + selX0,
                top: 2,
                width: Math.max(1, selX1 - selX0),
                height: lineHeight - 4,
                backgroundColor: '#3949ab55',
                borderRadius: 2,
              }} />
            )}
            <LineSpans mw={mw} markerText={li === 0 ? markerText : ''} fontSize={fontSize} color={color} pieces={line.pieces} />
            {cursorX !== null && blinkOn && (
              <View style={{
                position: 'absolute',
                left: mw + cursorX,
                top: 2,
                width: 2,
                height: lineHeight - 4,
                backgroundColor: '#7986cb',
                borderRadius: 1,
              }} />
            )}
          </View>
        );
      })}
    </>
  );
}

// ── RichTextToolbar ───────────────────────────────────────────────────────────

export function RichTextToolbar({ style }) {
  const ctx = useContext(EditorCtx);
  if (!ctx) return null;
  const { toggleFormat, selectionHasFormat, toggleList, indent, isListActive } = ctx;

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
      <ToolBtn label="•"    active={isListActive('bullet')} onPress={() => toggleList('bullet')} />
      <ToolBtn label="1."   active={isListActive('number')} onPress={() => toggleList('number')} />
      <ToolBtn label="→|"   onPress={() => indent(1)} />
      <ToolBtn label="|←"   onPress={() => indent(-1)} />
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
    paragraphs: text
      // Normalize CRLF/CR line endings (Windows/old-Mac text files) to LF —
      // a stray '\r' left in span text renders as a tofu box (no glyph),
      // same as a raw tab below.
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map(line => ({
        // Tab has no visible glyph — Parley shapes it as a missing-glyph
        // box rather than whitespace. Expand to spaces on import instead of
        // trying to special-case control characters in the renderer.
        spans: [{ text: line.replace(/\t/g, '    ') }],
      })),
  };
}

// ── useRichText hook ──────────────────────────────────────────────────────────

export function useEditorContext() {
  return useContext(EditorCtx);
}
