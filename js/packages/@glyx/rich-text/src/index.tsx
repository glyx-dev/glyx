// @glyx-dev/rich-text — Rich text editor for Glyx apps.
//
// Architecture:
//   Document  = array of paragraphs
//   Paragraph = array of styled spans
//   Span      = { text, bold?, italic?, underline?, code?, link?, highlight?, color?, fontSize?, fontFamily?, fontVariationSettings?, fontFeatureSettings? }
//   Paragraph = { spans, listType?, indent?, align? }
//   Cursor    = { para, offset }  (offset = char index in flat paragraph text)
//   Selection = { anchor: Cursor, focus: Cursor }
//
// Rendering uses native Text nodes (bold/italic/underline supported natively)
// with absolutely-positioned View overlays for cursor and selection highlight.
// Cursor pixel position is computed via __glyx_measure_text (styled).

import React, { useState, useEffect, useRef, useCallback, useContext, useMemo, createContext } from 'react';
import { View, Text, TextInput, Pressable, addGlobalClickListener, removeGlobalClickListener, clipboard, openPopover, closePopover, setFocus, registerInput, unregisterInput, registerScrollView, unregisterScrollView, registerDraggable, unregisterDraggable } from '@glyx-dev/react';
import type { GlyxStyle } from '@glyx-dev/react';
import { Icon } from '@glyx-dev/icons';
import { DocHistory, type EditKind } from './history.js';

// ── The document model ───────────────────────────────

/** A run of text with one set of formatting. */
export interface Span {
  text:       string;
  bold?:      boolean;
  italic?:    boolean;
  underline?: boolean;
  /** Inline code: drawn in a monospace family and a subtle background unless the run sets its own family or highlight. */
  code?:      boolean;
  /** A URL this run links to. Links are drawn in the link colour and underlined. */
  link?:      string;
  /** Inline highlight colour (a background behind this run). */
  highlight?: string;
  color?:     string;
  fontSize?:  number;
  /** This run's font family (a `fontFamily` value); the editor's `fontFamily` when absent. */
  fontFamily?: string;
  /** This run's variable-font axes (a `fontVariationSettings` value); the editor's when absent. */
  fontVariationSettings?: string;
  /** This run's OpenType features (a `fontFeatureSettings` value); the editor's when absent. */
  fontFeatureSettings?: string;
}

export type ListType = 'bullet' | 'number';
export type TextAlign = 'left' | 'center' | 'right';

/** One paragraph: runs of text, and optionally a list marker with a nesting level. */
export interface Paragraph {
  spans:     Span[];
  listType?: ListType | null;
  /** Nesting level of a list item (0 = top level). */
  indent?:   number;
  /** Horizontal alignment of the paragraph (default `left`). */
  align?:    TextAlign;
}

export interface RichTextDocument {
  paragraphs: Paragraph[];
}

/** A position in the document: a paragraph, and a character offset into its text. */
export interface Cursor {
  para:   number;
  offset: number;
}

export interface Selection {
  anchor: Cursor;
  focus:  Cursor;
}

/** The character range of the link run under a click, and its URL. */
export interface LinkRange {
  para:  number;
  /** Character offset where the linked run starts. */
  start: number;
  /** Character offset just after the linked run. */
  end:   number;
  url:   string;
}

/** The character formats that can be toggled on and off. */
export type FormatKey = 'bold' | 'italic' | 'underline' | 'code';

/** The per-run formats that take a value instead of on/off: fonts, size, colour, a link target and a highlight colour. */
export type ValueFormatKey =
  | 'fontFamily'
  | 'fontVariationSettings'
  | 'fontFeatureSettings'
  | 'fontSize'
  | 'color'
  | 'link'
  | 'highlight';

/** A value a {@link ValueFormatKey} can take; `undefined` removes the run's own value (the editor's default applies again). */
export type FormatValue = string | number | undefined;

/** The result of an edit: the new document and where the cursor ends up. */
export interface EditResult {
  doc:    RichTextDocument;
  cursor: Cursor;
}

export interface RichTextEditorProps {
  /** The document to show (controlled). Without it the editor starts empty and keeps its own. */
  value?:       RichTextDocument;
  /** Called with the new document on every edit. */
  onChange?:    (doc: RichTextDocument) => void;
  /** Editor width in px (default 600). */
  width?:       number;
  /** Editor height in px (default 400). */
  height?:      number;
  /** Default text size in px (default 14). */
  fontSize?:    number;
  /** Default text colour. */
  color?:       string;
  placeholder?: string;
  /** Focus as soon as it mounts, with no click first. Use it when a parent opens or creates a document in code. */
  autoFocus?:   boolean;
  /** The font family of the text (a `fontFamily` value: `'Inter'`, `'Cascadia Mono, monospace'`); the caret and clicks are measured in it. */
  fontFamily?:  string;
  /** The variable-font axes of the text (a `fontVariationSettings` value); a span can set its own. */
  fontVariationSettings?: string;
  /** The OpenType features of the text (a `fontFeatureSettings` value); a span can set its own. */
  fontFeatureSettings?: string;
  /** `true` (default) wraps long paragraphs to `width`; `false` keeps each paragraph on one line and scrolls sideways. */
  wrap?:        boolean;
  /** Ctrl+Z undoes and Ctrl+Y (or Ctrl+Shift+Z) redoes, as in a browser (default true; false turns the history off). */
  undoHistory?: boolean;
  style?:       GlyxStyle;
  /** Offer an Open button in the link editor. Opening still goes through `onLinkPress`; clicking a link always opens the editor. */
  openLinks?:   boolean;
  /** Receives the URL when the user chooses Open in a link's editor. Requires `openLinks`. */
  onLinkPress?: (url: string) => void;
  /** Rendered inside the editor's context, so a {@link RichTextToolbar} can sit above the text. */
  children?:    React.ReactNode;
}

export interface RichTextToolbarProps {
  style?: GlyxStyle;
  /**
   * The families the font menu offers, as `fontFamily` values. Defaults to a short list of fonts that ship with Windows, macOS
   * or the app (`Segoe UI`, `Georgia`, `Cascadia Mono`, ...); pass the families from the app's `fonts` config and any installed
   * fonts you want to offer.
   */
  fontFamilies?: string[];
}

/** One OpenType feature preset shown by {@link RichTextFeaturePicker}. */
export interface RichTextFeaturePreset {
  label: string;
  /** A `fontFeatureSettings` value, e.g. `"'tnum' 1"`. */
  value: string;
}

export interface RichTextFeaturePickerProps {
  /** Presets to offer; defaults to tabular figures, small caps and ligatures off. */
  features?: RichTextFeaturePreset[];
  /** Label at the start of the row (default `Features`). */
  label?: string;
  /** Label for the button that removes the feature (default `Clear`). */
  clearLabel?: string;
  /** Width of the row; useful when it sits above a fixed-width editor. */
  width?: number;
  style?: GlyxStyle;
}

/** What {@link useEditorContext} returns, inside a {@link RichTextEditor}. */
export interface EditorContextValue {
  doc:                RichTextDocument;
  setDoc:             (doc: RichTextDocument, kind?: 'type' | 'backspace' | 'delete' | 'other') => void;
  cursor:             Cursor;
  setCursor:          (cursor: Cursor) => void;
  sel:                Selection;
  setSel:             (sel: Selection) => void;
  /** Runs `fn(doc, cursor)` and applies the document and cursor it returns. */
  applyEdit:          (fn: (doc: RichTextDocument, cursor: Cursor) => EditResult) => void;
  selectionHasFormat: (key: FormatKey) => boolean;
  toggleFormat:       (key: FormatKey) => void;
  /** The value every selected run shares for a value format, or the run at the caret's when the selection is empty. */
  formatValue:        (key: ValueFormatKey) => FormatValue;
  /** Sets a value format on the selection, or, with an empty selection, on the text typed next (the format is kept until the caret moves). */
  setFormat:          (key: ValueFormatKey, value: FormatValue) => void;
  toggleList:         (listType: ListType) => void;
  /** Changes the nesting level of the list items in the selection by `delta`. */
  indent:             (delta: number) => void;
  isListActive:       (listType: ListType) => boolean;
  /** The alignment shown for the caret paragraph, or `left` when it has none. */
  align:              TextAlign;
  /** Sets the alignment of every paragraph the selection touches (or the caret paragraph). */
  setAlign:           (align: TextAlign) => void;
  fontSize:           number;
  /** Restores this editor's caret/focus after a custom control is pressed; give that control `keepFocus` too. */
  refocus:            () => void;
}

// ── Document helpers ──────────────────────────────────────────────────────────

export function emptyDoc(): RichTextDocument {
  return { paragraphs: [{ spans: [{ text: '' }] }] };
}

export function paraText(para: Paragraph) {
  return para.spans.map((s) => s.text).join('');
}

export function splitSpansAt(spans: Span[], offset: number): [Span[], Span[]] {
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

export function mergeSpans(spans: Span[]): Span[] {
  const out: any[] = [];
  for (const s of spans) {
    if (!s.text) continue;
    const p = out[out.length - 1];
    if (p && p.bold === s.bold && p.italic === s.italic && p.underline === s.underline &&
        p.code === s.code && p.link === s.link && p.highlight === s.highlight &&
        p.color === s.color && p.fontSize === s.fontSize && p.fontFamily === s.fontFamily &&
        p.fontVariationSettings === s.fontVariationSettings && p.fontFeatureSettings === s.fontFeatureSettings) {
      out[out.length - 1] = { ...p, text: p.text + s.text };
    } else {
      out.push({ ...s });
    }
  }
  return out.length ? out : [{ text: '' }];
}

// ── Cursor helpers ────────────────────────────────────────────────────────────

export function cursorEq(a: Cursor, b: Cursor)  { return a.para === b.para && a.offset === b.offset; }
function cursorLt(a: Cursor, b: Cursor)  { return a.para < b.para || (a.para === b.para && a.offset < b.offset); }
export function hasSelection(s: Selection) { return !cursorEq(s.anchor, s.focus); }
export function normSel(s: Selection)      { return cursorLt(s.anchor, s.focus) ? s : { anchor: s.focus, focus: s.anchor }; }

export function clampCursor(doc: RichTextDocument, c: Cursor) {
  const para = Math.max(0, Math.min(doc.paragraphs.length - 1, c.para));
  const offset = Math.max(0, Math.min(paraText(doc.paragraphs[para]).length, c.offset));
  return { para, offset };
}

export function moveCursorBy(doc: RichTextDocument, cursor: Cursor, delta: number) {
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
function moveCursorVertical(layoutInfo: any, cursor: Cursor, dir: number, fontSize: number) {
  const items = layoutInfo.items;
  const item = items[cursor.para];
  if (!item) return cursor;
  let li = 0;
  for (; li < item.lines.length; li++) {
    const line = item.lines[li];
    if (cursor.offset >= line.start && (cursor.offset < line.end || li === item.lines.length - 1)) break;
  }
  li = Math.min(li, item.lines.length - 1);
  const line = item.lines[li];
  const x = measureCursorX(lineAsParagraph(line), cursor.offset - line.start, fontSize);

  // Paragraphs can have different line heights (a heading run, a 24 px run),
  // so walk the visual lines instead of assuming one global line height.
  const visualLines: Array<{ it: any; li: number }> = [];
  for (const it of items) {
    for (let i = 0; i < it.lines.length; i++) visualLines.push({ it, li: i });
  }
  let at = visualLines.findIndex((v) => v.it === item && v.li === li);
  if (at < 0) at = 0;
  const target = at + dir;
  if (target < 0) return { para: 0, offset: 0 };
  if (target >= visualLines.length) {
    const lastItem = items[items.length - 1];
    return { para: lastItem.pi, offset: paraText(lastItem.para).length };
  }
  const { it, li: targetLi } = visualLines[target];
  const targetLine = it.lines[targetLi];
  const offset = clickToOffset(lineAsParagraph(targetLine), x, fontSize);
  return { para: it.pi, offset: targetLine.start + offset };
}

// ── Edit operations ───────────────────────────────────────────────────────────

export function insertText(
  doc: RichTextDocument,
  cursor: Cursor,
  text: string,
  format?: Partial<Span>,
): EditResult {
  const paras = [...doc.paragraphs];
  const para = paras[cursor.para];
  const [before, after] = splitSpansAt(para.spans, cursor.offset);
  const fmt = { ...(before[before.length - 1] ?? after[0] ?? {}), ...format };
  paras[cursor.para] = { ...para, spans: mergeSpans([...before, { ...fmt, text }, ...after]) };
  return { doc: { ...doc, paragraphs: paras }, cursor: { para: cursor.para, offset: cursor.offset + text.length } };
}

export function insertBreak(doc: RichTextDocument, cursor: Cursor) {
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
  const newPara: any = { spans: mergeSpans(after.length ? after : [{ text: '' }]) };
  if (current.listType) { newPara.listType = current.listType; newPara.indent = current.indent ?? 0; }
  if (current.align && current.align !== 'left') newPara.align = current.align;
  paras.splice(cursor.para + 1, 0, newPara);
  return { doc: { ...doc, paragraphs: paras }, cursor: { para: cursor.para + 1, offset: 0 } };
}

export function deleteChar(doc: RichTextDocument, cursor: Cursor, backward: boolean) {
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
    paras[cursor.para] = { ...paras[cursor.para], spans: mergeSpans([...before, ...afterOne]) };
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
    paras[cursor.para] = { ...paras[cursor.para], spans: mergeSpans([...before, ...afterOne]) };
    return { doc: { ...doc, paragraphs: paras }, cursor };
  }
}

export function deleteSelection(doc: RichTextDocument, sel: Selection) {
  const { anchor, focus } = normSel(sel);
  const paras = [...doc.paragraphs];
  if (anchor.para === focus.para) {
    const [before]  = splitSpansAt(paras[anchor.para].spans, anchor.offset);
    const [, after] = splitSpansAt(paras[anchor.para].spans, focus.offset);
    paras[anchor.para] = { ...paras[anchor.para], spans: mergeSpans([...before, ...after]) };
    return { doc: { ...doc, paragraphs: paras }, cursor: anchor };
  }
  const [before]  = splitSpansAt(paras[anchor.para].spans, anchor.offset);
  const [, after] = splitSpansAt(paras[focus.para].spans, focus.offset);
  // Merged paragraph keeps the EARLIER (anchor) paragraph's list/indent state.
  paras.splice(anchor.para, focus.para - anchor.para + 1, { ...paras[anchor.para], spans: mergeSpans([...before, ...after]) });
  return { doc: { ...doc, paragraphs: paras }, cursor: anchor };
}

/**
 * Applies a format to every run the selection touches. `key` is a span field: the on/off formats (`bold`, `italic`, `underline`)
 * and the value formats (`fontFamily`, `fontVariationSettings`, `fontFeatureSettings`, `fontSize`, `color`). `undefined` removes the
 * run's own value, so it falls back to the editor's default. An empty selection changes nothing here; the editor keeps that format
 * for the text typed next (see `setFormat` in {@link EditorContextValue}).
 */
export function applyFormat(doc: RichTextDocument, sel: Selection, key: keyof Span, value: any) {
  const { anchor, focus } = normSel(sel);
  const paras = [...doc.paragraphs];
  for (let pi = anchor.para; pi <= focus.para; pi++) {
    const s = pi === anchor.para ? anchor.offset : 0;
    const e = pi === focus.para  ? focus.offset  : paraText(paras[pi]).length;
    if (s === e) continue;
    const [pre, rest] = splitSpansAt(paras[pi].spans, s);
    const [mid, post] = splitSpansAt(rest, e - s);
    paras[pi] = {
      ...paras[pi],
      spans: mergeSpans([
        ...pre,
        ...mid.map((sp) => {
          const next: any = { ...sp };
          if (value === undefined) delete next[key];
          else next[key] = value;
          return next;
        }),
        ...post,
      ]),
    };
  }
  return { ...doc, paragraphs: paras };
}

/** The run whose text contains `cursor.offset` (clicks inside a link use this rather than the caret-inheritance rule). */
export function spanAtOffset(doc: RichTextDocument, cursor: Cursor): Span | undefined {
  const spans = doc.paragraphs[cursor.para]?.spans ?? [];
  let offset = 0;
  for (const span of spans) {
    if (cursor.offset >= offset && cursor.offset < offset + span.text.length) return span;
    offset += span.text.length;
  }
  return undefined;
}

/**
 * The range of the link run containing `cursor.offset`, or `undefined` when
 * that character is not linked. Used by the click-to-edit link popover so it
 * edits exactly the run the pointer is inside, even when the click's nearest
 * caret boundary would fall in the next run.
 */
export function linkRangeAtOffset(doc: RichTextDocument, cursor: Cursor): LinkRange | undefined {
  const spans = doc.paragraphs[cursor.para]?.spans ?? [];
  let offset = 0;
  for (const span of spans) {
    const end = offset + span.text.length;
    if (span.link && cursor.offset >= offset && cursor.offset < end) {
      return { para: cursor.para, start: offset, end, url: span.link };
    }
    offset = end;
  }
  return undefined;
}

/** The span a caret sits in: the run before it (the one typing inherits), else the run after it, else none. */
export function spanAtCursor(doc: RichTextDocument, cursor: Cursor): Span | undefined {
  const spans = doc.paragraphs[cursor.para]?.spans ?? [];
  let offset = 0;
  let next: Span | undefined;
  for (const span of spans) {
    if (cursor.offset <= offset + span.text.length) {
      if (cursor.offset > offset) return span;
      next = span;
      break;
    }
    offset += span.text.length;
    next = span;
  }
  return next ?? spans[spans.length - 1];
}

/**
 * The one value every selected run shares for `key`, or `undefined` when they differ (or nothing is selected).
 * With an empty selection it reads the run at the caret, which is what a toolbar shows for the next typed text.
 */
export function selectionFormatValue(doc: RichTextDocument, sel: Selection, key: keyof Span): any {
  if (!hasSelection(sel)) return spanAtCursor(doc, sel.focus)?.[key];
  const { anchor, focus } = normSel(sel);
  let value: any;
  let seen = false;
  for (let pi = anchor.para; pi <= focus.para; pi++) {
    const s = pi === anchor.para ? anchor.offset : 0;
    const e = pi === focus.para  ? focus.offset  : paraText(doc.paragraphs[pi]).length;
    if (s === e) continue;
    const [, rest] = splitSpansAt(doc.paragraphs[pi].spans, s);
    const [mid]    = splitSpansAt(rest, e - s);
    for (const span of mid) {
      if (!seen) { value = span[key]; seen = true; }
      else if (span[key] !== value) return undefined;
    }
  }
  return seen ? value : undefined;
}

export function selectionHasFormat(doc: RichTextDocument, sel: Selection, key: FormatKey): boolean {
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

export function selectedText(doc: RichTextDocument, sel: Selection) {
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

/** The alignment of the paragraph that contains `cursor`, or `left` when it has none. */
export function paragraphAlign(doc: RichTextDocument, cursor: Cursor): TextAlign {
  return doc.paragraphs[cursor.para]?.align ?? 'left';
}

/** Sets the alignment of every paragraph the selection touches, or of the caret paragraph when nothing is selected. */
export function setParagraphAlign(doc: RichTextDocument, sel: Selection, align: TextAlign): RichTextDocument {
  const { anchor, focus } = normSel(sel);
  const paras = [...doc.paragraphs];
  for (let pi = anchor.para; pi <= focus.para; pi++) {
    const next: any = { ...paras[pi] };
    if (align === 'left') delete next.align;
    else next.align = align;
    paras[pi] = next;
  }
  return { ...doc, paragraphs: paras };
}

/**
 * The part of a document covered by `sel`, with paragraph properties preserved. Used by copy/cut; an empty selection copies an empty
 * paragraph rather than the whole document.
 */
export function sliceDocument(doc: RichTextDocument, sel: Selection): RichTextDocument {
  if (!hasSelection(sel)) return { paragraphs: [{ spans: [{ text: '' }] }] };
  const { anchor, focus } = normSel(sel);
  const paragraphs: Paragraph[] = [];
  for (let pi = anchor.para; pi <= focus.para; pi++) {
    const s = pi === anchor.para ? anchor.offset : 0;
    const e = pi === focus.para  ? focus.offset  : paraText(doc.paragraphs[pi]).length;
    const [, rest] = splitSpansAt(doc.paragraphs[pi].spans, s);
    const [mid] = splitSpansAt(rest, Math.max(0, e - s));
    const next: Paragraph = { spans: mergeSpans(mid) };
    const source = doc.paragraphs[pi];
    if (source.listType) next.listType = source.listType;
    if (source.indent) next.indent = source.indent;
    if (source.align) next.align = source.align;
    paragraphs.push(next);
  }
  return { paragraphs };
}

/**
 * Inserts a document fragment at `cursor`. The destination paragraph keeps its list/alignment for the first line; the pasted
 * paragraphs carry their own paragraph properties, and the last one inherits the destination's where the fragment has none.
 */
export function insertDocument(doc: RichTextDocument, cursor: Cursor, fragment: RichTextDocument): EditResult {
  const frag = fragment.paragraphs.length ? fragment.paragraphs : [{ spans: [{ text: '' }] }];
  const paras = [...doc.paragraphs];
  const current = paras[cursor.para];
  const [before, after] = splitSpansAt(current.spans, cursor.offset);

  if (frag.length === 1) {
    paras[cursor.para] = {
      ...current,
      spans: mergeSpans([...before, ...frag[0].spans, ...after]),
    };
    return { doc: { ...doc, paragraphs: paras }, cursor: { para: cursor.para, offset: cursor.offset + paraText(frag[0]).length } };
  }

  const first: Paragraph = { ...current, spans: mergeSpans([...before, ...frag[0].spans]) };
  const middle: Paragraph[] = frag.slice(1, -1).map((p) => ({ ...p, spans: mergeSpans(p.spans) }));
  const lastSource = frag[frag.length - 1];
  const last: Paragraph = {
    ...current,
    ...lastSource,
    spans: mergeSpans([...lastSource.spans, ...after]),
  };
  paras.splice(cursor.para, 1, first, ...middle, last);
  return {
    doc: { ...doc, paragraphs: paras },
    cursor: { para: cursor.para + frag.length - 1, offset: paraText(lastSource).length },
  };
}

// The system clipboard only carries text here, so a formatted copy also keeps
// its fragment in this module for a later paste. If the clipboard text no
// longer matches (the user copied something else, or another app changed it),
// paste falls back to plain text rather than resurrecting stale formatting.
let richClipboard: { text: string; doc: RichTextDocument } | null = null;

/** Copies the selection as plain text, and remembers its formatting for an in-app paste. */
function copySelectionToClipboard(doc: RichTextDocument, sel: Selection) {
  if (!hasSelection(sel)) return;
  const fragment = sliceDocument(doc, sel);
  const text = docToPlainText(fragment);
  if (!text) return;
  richClipboard = { text, doc: fragment };
  try { clipboard.writeText(text); } catch {}
}

/** Paste helper shared by Ctrl+V and the context API. `plainText` is what the system clipboard returned. */
function pasteIntoDocument(doc: RichTextDocument, cursor: Cursor, sel: Selection, plainText: string) {
  let base = doc, at = cursor;
  if (hasSelection(sel)) {
    const deleted = deleteSelection(base, sel);
    base = deleted.doc;
    at = deleted.cursor;
  }
  const fragment = richClipboard && richClipboard.text === plainText
    ? richClipboard.doc
    : docFromPlainText(plainText);
  return insertDocument(base, at, fragment);
}

// ── Pixel measurement ─────────────────────────────────────────────────────────

// Real single-line height for `fontSize`, from the native shaper's own
// metrics rather than the `fontSize * 1.5` guess previously used everywhere
// in this file — that guess had no relationship to the renderer's actual
// line spacing, causing overlapping rows whenever a font's real line height
// was smaller than 1.5×. Mirrors the equivalent fix in @glyx-dev/react's
// TextInput (controls.ts's `realLineHeight`).
// The editor's `fontFamily`, which the measuring helpers below shape in. The editor sets it at the start of its render and of every handler
// (each entry point), so two editors with different families never see each other's.
let _family: string | undefined;
let _variations: string | undefined;
let _features: string | undefined;

/** The family a run is actually drawn in (code gets a monospace fallback unless it names a family). */
const CODE_FONT_FAMILY = 'Cascadia Mono, Consolas, monospace';
function spanFamily(span?: any): string | undefined {
  return span?.fontFamily ?? (span?.code ? CODE_FONT_FAMILY : _family);
}

/** What the native measuring calls take for a span's font: its own font props, else the editor's. Code does not inherit the editor's
 *  variable axes/features, which usually belong to a proportional UI family and would be meaningless (or noisy) on a mono fallback. */
function spanFont(span?: any): any {
  const family = spanFamily(span);
  const variations = span?.fontVariationSettings ?? (span?.code ? undefined : _variations);
  const features = span?.fontFeatureSettings ?? (span?.code ? undefined : _features);
  return (variations || features) ? { family, variations, features } : family;
}

function richTextLineHeight(fontSize: number) {
  if (typeof __glyx_measure_text !== 'undefined') {
    return __glyx_measure_text('M', fontSize, 1e6, undefined, undefined, spanFont()).height;
  }
  return fontSize * 1.5;
}

// A paragraph's row must fit its largest run: without this a 26 px heading
// in a 14 px editor paints over the paragraph below it.
function paragraphLineHeight(para: Paragraph, defaultFontSize: number) {
  let size = defaultFontSize;
  for (const span of para.spans) {
    if (typeof span.fontSize === 'number' && span.fontSize > size) size = span.fontSize;
  }
  return richTextLineHeight(size);
}

function spanStyle(span: any) {
  return [span.bold && 'bold', span.italic && 'italic'].filter(Boolean).join(' ') || undefined;
}

function measureSpan(text: string, span: any, defaultFontSize: number) {
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
  // Same for a span that merely ENDS in whitespace ("Hello " before a bold
  // span): its trailing space is drawn, so clicks past it must count it.
  if (/\s$/.test(text)) {
    const withSentinel = __glyx_measure_text(text + 'x', fs, 999999, style, undefined, spanFont(span)).width;
    const sentinelOnly = __glyx_measure_text('x', fs, 999999, style, undefined, spanFont(span)).width;
    return Math.max(0, withSentinel - sentinelOnly);
  }
  return __glyx_measure_text(text, fs, 999999, style, undefined, spanFont(span)).width;
}

// Cursor X for character index `charIdx` *within one span's full text*.
// Shapes `span.text` (the real, complete string — never a growing slice of
// it) exactly once per call and reads the position straight off that one
// layout via the native `Cursor` API, so it can never drift from what was
// actually rendered the way re-measuring independently-shaped prefixes
// (`span.text.slice(0, i)`) could.
function cursorXInSpan(span: any, charIdx: number, defaultFontSize: any) {
  const fs = span.fontSize ?? defaultFontSize;
  if (typeof __glyx_text_cursor_x !== 'undefined') {
    return __glyx_text_cursor_x(span.text, fs, 999999, charIdx, spanStyle(span), spanFont(span));
  }
  return charIdx * fs * 0.55; // fallback estimate
}

// Nearest-boundary character index for pixel offset `localX` *within one
// span's full text* — same single-shape guarantee as `cursorXInSpan`, in
// the opposite direction (pixels → char index).
function charAtXInSpan(span: any, localX: number, defaultFontSize: any) {
  const fs = span.fontSize ?? defaultFontSize;
  if (typeof __glyx_text_char_at_x !== 'undefined') {
    return __glyx_text_char_at_x(span.text, fs, 999999, localX, spanStyle(span), spanFont(span));
  }
  return Math.round(localX / (fs * 0.55)); // fallback estimate
}

function measureCursorX(para: Paragraph, offset: number, defaultFontSize: number) {
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

function clickToOffset(para: Paragraph, clickX: number, defaultFontSize: number) {
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
export function charIndexAtPoint(para: Paragraph, clickX: number, defaultFontSize: number) {
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
export function wrapParagraph(para: Paragraph, maxWidth: number, fontSize: number) {
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

  const lines: { start: number; end: any; pieces: { span: any; text: any; start: any; }[]; }[] = [];
  let curPieces: { span: any; text: string; start: number; }[] = [];
  let curWidth = 0;
  let curStart = 0;

  const flush = (end: number) => {
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
function lineAsParagraph(line: { pieces: any[]; }) {
  return { spans: line.pieces.map((p: { span: any; text: any; }) => ({ ...p.span, text: p.text })) };
}

// ── Word boundaries (double-click selection) ────────────────────────────────

// Three classes, not two — word / whitespace / punctuation-or-other — so a
// word-boundary scan can never bleed into an adjacent space (or vice
// versa). A two-class "word vs. everything else" split would merge
// whitespace and punctuation into one run, which is what let a
// double-click's selection include a trailing/leading space next to a word.
function _charClass(ch: string) {
  if (/[A-Za-z0-9_]/.test(ch)) return 0; // word
  if (/\s/.test(ch)) return 1;           // whitespace
  return 2;                              // punctuation / other
}

// A "word" is a maximal run of the same character class, matching standard
// desktop-editor double-click behavior. Mirrors @glyx-dev/react's
// TextInput (controls.ts's `wordRangeAt`).
export function wordRangeAt(text: string | any[], offset: number) {
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
export function computeListNumber(paragraphs: Paragraph[], idx: number): number {
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

function listMarkerText(para: any, number: any) {
  if (para.listType === 'number') return `${number}. `;
  if (para.listType === 'bullet') return `${BULLET_CHARS[(para.indent ?? 0) % BULLET_CHARS.length]} `;
  return '';
}

// Total pixel width a paragraph's list marker + indent occupies before its
// actual text content starts — needed both to render the marker in the
// right place and to offset cursor/selection/click math, which is computed
// purely in terms of paragraph TEXT (marker-unaware).
function markerWidth(para: any, fontSize: number, number: number | null) {
  if (!para.listType) return 0;
  const indentPx = (para.indent ?? 0) * INDENT_PX;
  const markerText = listMarkerText(para, number);
  return indentPx + (markerText ? measureSpan(markerText, { fontSize }, fontSize) : 0);
}

// ── Context ───────────────────────────────────────────────────────────────────

const EditorCtx = createContext<EditorContextValue | null>(null);

// ── RichTextEditor ────────────────────────────────────────────────────────────

let _focusedEditor: number | null = null; // global; only one editor focused at a time

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
  undoHistory  = true,
  fontFamily,
  fontVariationSettings,
  fontFeatureSettings,
  openLinks    = false,
  onLinkPress,
  wrap         = true,   // true: long paragraphs soft-wrap to fit `width` (a
                         // normal editor/notes surface). false: paragraphs
                         // stay on one line and overflow horizontally instead
                         // (e.g. a single-line-per-entry log/code view) — set
                         // per-instance since either can be the right choice
                         // depending on what's being edited.
  style,
  children,    // optional: render toolbar etc. using context
}: RichTextEditorProps) {
  // The measuring helpers shape in the editor's family: set it here for this render and at the start of each handler (see `_family`).
  _family = fontFamily; _variations = fontVariationSettings; _features = fontFeatureSettings;
  const familyRef = useRef({ fontFamily, fontVariationSettings, fontFeatureSettings });
  familyRef.current = { fontFamily, fontVariationSettings, fontFeatureSettings };
  const [doc, setDoc_]   = useState(() => value ?? emptyDoc());
  const [cursor, setCursor_] = useState({ para: 0, offset: 0 });
  const [sel, setSel_]   = useState({ anchor: { para: 0, offset: 0 }, focus: { para: 0, offset: 0 } });
  const [focused, setFocused] = useState(false);
  const [blinkOn, setBlinkOn] = useState(true);
  const nodeIdRef = useRef<any>(null);
  const linkPopoverRef = useRef<number | null>(null);
  // Vertical scroll (wheel + native scrollbar drag) for the paragraphs
  // container — same `clip`/`scrollOffsetY`/`showScrollbar` native
  // infrastructure `@glyx-dev/react`'s `ScrollView`/multiline `TextInput`
  // already use, just applied to this editor's own paragraph list directly
  // rather than through the generic `ScrollView` component.
  const [scrollY, setScrollY] = useState(0);
  const scrollYRef = useRef(0);
  const scrollContainerIdRef = useRef<any>(null);
  // Horizontal pan for `wrap={false}` (overflow) paragraphs — no native
  // scroll_offset_x exists in the engine (only scroll_offset_y does; adding
  // one would touch the core scene-caching pipeline for every node type in
  // the app), so this shifts rendered content via plain relative
  // positioning (`left: -scrollX`) instead, driven by a custom draggable
  // scrollbar built with the same `registerDraggable` registry Slider uses
  // for its thumb.
  const [scrollX, setScrollX] = useState(0);
  const scrollXRef = useRef(0);
  const scrollbarTrackIdRef = useRef<any>(null);
  // Y (relative to the editor's top-left) at which the horizontal scrollbar
  // strip begins, or `null` when it isn't shown — click/drag handlers below
  // check this to avoid ALSO starting a text-selection drag underneath the
  // scrollbar. The scrollbar track is a plain descendant `<View>` of the
  // same Pressable this editor's own click/drag routing is registered on
  // (`registerInput`), so a mouse-down on it satisfies BOTH systems'
  // ancestor-walk hit-testing independently — nothing in this framework
  // stops that bubbling, so the guard has to live here instead.
  const hScrollbarBoundRef = useRef<any>(null);

  // Keep refs current for stable callbacks
  const docRef    = useRef(doc);
  const cursorRef = useRef(cursor);
  const selRef    = useRef(sel);
  const layoutInfoRef = useRef<any>(null); // set below, after `layoutInfo` is computed
  docRef.current    = doc;
  cursorRef.current = cursor;
  selRef.current    = sel;

  // Undo / redo: references to the documents before each edit (they share every untouched paragraph), capped, freed with the editor.
  const historyRef = useRef<DocHistory<any, any, any> | null>(null);
  const history = () => (historyRef.current ??= new DocHistory());
  // Format values chosen while the selection is empty (or after formatting a selection): they are applied to the text typed next,
  // and cleared when the caret moves, so the format follows the typing run rather than sticking to the whole editor.
  const typingFormatRef = useRef<Partial<Span>>({});
  const [, setFormatEpoch] = useState(0);
  const rememberFormat = useCallback((key: keyof Span, value: any) => {
    const next: any = { ...typingFormatRef.current };
    if (value === undefined) delete next[key];
    else next[key] = value;
    typingFormatRef.current = next;
    setFormatEpoch((n) => n + 1);
  }, []);

  // Sync controlled value. A document the editor did not make (the app set it) ends the old history.
  useEffect(() => {
    if (!value) return;
    if (value !== docRef.current) historyRef.current?.clear();
    setDoc_(value);
  }, [value]);

  // Every change to the document goes through here, so the state before it can be kept for undo.
  const setDoc = useCallback((d: any, kind: EditKind = 'other') => {
    if (undoHistory) history().push({ doc: docRef.current, cursor: cursorRef.current, sel: selRef.current }, kind);
    setDoc_(d);
    onChange?.(d);
  }, [onChange, undoHistory]);

  // The link editor popover owns the native focus while it is open. Once it
  // unmounts, put keyboard focus back on the editor so typing can continue
  // without requiring another click.
  const focusEditorSoon = useCallback(() => {
    const id = nodeIdRef.current;
    if (id == null) return;
    setTimeout(() => {
      if (nodeIdRef.current === id) setFocus(id);
    }, 0);
  }, []);

  // Apply a link value directly to a known run range. The click resolves the
  // exact linked run before the popover opens, so this does not depend on the
  // editor's current selection (which may still be from before the click).
  const applyLinkRange = useCallback((range: LinkRange, value: string) => {
    const url = normalizeLink(value);
    if (url === range.url) return;
    setDoc(applyFormat(docRef.current, {
      anchor: { para: range.para, offset: range.start },
      focus:  { para: range.para, offset: range.end },
    }, 'link', url || undefined));
  }, [setDoc]);

  const setCursor = useCallback((c: { para: number; offset: number }) => {
    historyRef.current?.breakRun();
    typingFormatRef.current = {};
    setCursor_(c);
    setSel_({ anchor: c, focus: c });
  }, []);

  const applyEdit = useCallback((fn: (arg0: any, arg1: { para: number; offset: number; }) => any, kind: EditKind = 'other') => {
    const result = fn(docRef.current, cursorRef.current);
    setDoc(result.doc, kind);
    setCursor_(result.cursor);
    setSel_({ anchor: result.cursor, focus: result.cursor });
  }, [setDoc]);

  // Ctrl+Z / Ctrl+Y: show the document, caret and selection from before the last edit (or the one an undo took back).
  const stepHistory = useCallback((redo: boolean) => {
    if (!undoHistory) return;
    const now = { doc: docRef.current, cursor: cursorRef.current, sel: selRef.current };
    const s = redo ? history().redo(now) : history().undo(now);
    if (!s) return;
    typingFormatRef.current = {};
    setDoc_(s.doc);
    onChange?.(s.doc);
    setCursor_(s.cursor);
    setSel_(s.sel);
  }, [onChange, undoHistory]);

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
  // Dispatch is already scoped to whichever input is focused (events.ts's
  // own `focusedNodeId`/`inputRegistry`), so no extra focus check is needed
  // here — this only gets called when this editor is genuinely focused.
  const onKey = useCallback(({ key, text, ctrl, shift }: Record<string, any>) => {
    _family = familyRef.current.fontFamily; _variations = familyRef.current.fontVariationSettings;
    _features = familyRef.current.fontFeatureSettings;
    setBlinkOn(true); // reset blink on any key

    const doc    = docRef.current;
    const cursor = cursorRef.current;
    const sel    = selRef.current;
    const hasSel = hasSelection(sel);

    // Anything but typing and deleting (arrows, Home, a chord) ends a run of typing.
    if (ctrl || !(key === 'Backspace' || key === 'Delete' || text)) history().breakRun();
    // Moving the caret ends a pending format too: the new position's own run decides what typing looks like.
    if (!text && key !== 'Backspace' && key !== 'Delete') typingFormatRef.current = {};

    // ── Ctrl shortcuts ───────────────────────────────────────────────────────
    if (ctrl) {
      if (key === 'KeyZ') { stepHistory(shift); return; }
      if (key === 'KeyY') { stepHistory(true); return; }
      if (key === 'KeyA') {
        const last = doc.paragraphs.length - 1;
        setSel_({ anchor: { para: 0, offset: 0 }, focus: { para: last, offset: paraText(doc.paragraphs[last]).length } });
        setCursor_({ para: last, offset: paraText(doc.paragraphs[last]).length });
        return;
      }
      if (key === 'KeyC') { if (hasSel) copySelectionToClipboard(doc, sel); return; }
      if (key === 'KeyX') {
        if (!hasSel) return;
        copySelectionToClipboard(doc, sel);
        const r = deleteSelection(doc, sel);
        setDoc(r.doc); setCursor_(r.cursor); setSel_({ anchor: r.cursor, focus: r.cursor });
        return;
      }
      if (key === 'KeyV') {
        clipboard.readText().then((text: string) => {
          if (!text) return;
          const result = pasteIntoDocument(docRef.current, cursorRef.current, selRef.current, text);
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
      if (key === 'KeyE') {
        if (!hasSel) return;
        const on = selectionHasFormat(doc, sel, 'code');
        setDoc(applyFormat(doc, sel, 'code', !on));
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
      const newPos = moveCursorVertical(layoutInfoRef.current, shift ? sel.focus : cursor, dir, fontSize);
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
        applyEdit((d: any, c: any) => deleteChar(d, c, key === 'Backspace'), key === 'Backspace' ? 'backspace' : 'delete');
      }
      return;
    }

    // ── Enter ────────────────────────────────────────────────────────────────
    if (key === 'Enter') {
      if (hasSel) { const r = deleteSelection(doc, sel); setDoc(r.doc); setCursor_(r.cursor); setSel_({ anchor: r.cursor, focus: r.cursor }); }
      applyEdit((d: any, c: any) => insertBreak(d, c));
      return;
    }

    // ── Printable characters ─────────────────────────────────────────────────
    if (text) {
      const ch = text;
      if (hasSel) {
        const r = deleteSelection(doc, sel);
        const r2 = insertText(r.doc, r.cursor, ch, typingFormatRef.current);
        setDoc(r2.doc); setCursor_(r2.cursor); setSel_({ anchor: r2.cursor, focus: r2.cursor });
      } else {
        applyEdit((d: any, c: any) => insertText(d, c, ch, typingFormatRef.current), 'type');
      }
      return;
    }
  }, [applyEdit, setDoc, setCursor, stepHistory, fontSize]);

  // Click outside → blur
  const onGlobalClick = useCallback((ev: { x: number; y: number; }) => {
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
  const padPx = (v: unknown): number => (typeof v === 'number' ? v : 0);
  const outerPadLeft = padPx(style && (style.paddingLeft ?? style.padding));
  const outerPadTop  = padPx(style && (style.paddingTop  ?? style.padding));
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
    const items = paras.map((para: Paragraph, pi: number) => {
      const number = para.listType === 'number' ? computeListNumber(paras, pi) : null;
      const mw = markerWidth(para, fontSize, number);
      const lines = wrap
        ? wrapParagraph(para, Math.max(20, contentWidth - mw), fontSize)
        : [{ start: 0, end: paraText(para).length, pieces: para.spans.map((s: { text: any; }) => ({ span: s, text: s.text, start: 0 })) }];
      // Alignment is applied per visual line, inside the content width. Each
      // line remembers its own offset so the click/caret math can subtract the
      // same amount the renderer adds.
      for (const line of lines) {
        const textW = line.pieces.reduce((sum: number, p: { text: any; span: any }) => sum + measureSpan(p.text, p.span, fontSize), 0);
        const lineW = mw + textW;
        const free = Math.max(0, contentWidth - lineW);
        (line as any).width = lineW;
        (line as any).alignOffset = para.align === 'center' ? free / 2 : para.align === 'right' ? free : 0;
        if (!wrap && lineW > maxContentWidth) maxContentWidth = lineW;
      }
      const lineHeight = paragraphLineHeight(para, fontSize);
      const item = { pi, para, mw, number, lines, y, lineHeight, height: lines.length * lineHeight };
      y += item.height;
      return item;
    });
    return { items, totalHeight: y, contentWidth, maxContentWidth };
  }, [doc, fontSize, wrap, width, outerPadLeft, fontFamily, fontVariationSettings, fontFeatureSettings]);
  layoutInfoRef.current = layoutInfo;

  const showHScrollbar = !wrap && layoutInfo.maxContentWidth > layoutInfo.contentWidth + 0.5;
  // Prefer the ACTUAL rendered layout height over the `height` prop — Taffy
  // can resolve the Pressable to a shorter box than requested (e.g. when the
  // parent doesn't have enough room), and using the requested prop value
  // here silently put this bound ~90px above where the scrollbar actually
  // renders, so the click-Y guard below never triggered for a real
  // scrollbar drag.
  const measuredH = (nodeIdRef.current != null && typeof __glyx_getLayout !== 'undefined')
    // Full (unclipped) height: click Y arrives relative to the editor's
    // unclipped origin (events.ts boxOriginY), so the bound must share it.
    ? (l => l && (l.boxHeight ?? l.height))(__glyx_getLayout(nodeIdRef.current))
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
  const hitTestY = useCallback((y: number) => {
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
        const lineIdx = Math.max(0, Math.min(item.lines.length - 1, Math.floor((adjY - item.y) / item.lineHeight)));
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
  const posFromXY = useCallback((x: number, y: any) => {
    const { pi, lineIdx } = hitTestY(y);
    const item = layoutInfoRef.current.items[pi];
    const line = item.lines[lineIdx];
    const localX = x - EDITOR_PADDING - outerPadLeft - item.mw - (line.alignOffset ?? 0) + scrollXRef.current;
    const localOffset = clickToOffset(lineAsParagraph(line), localX, fontSize);
    return { para: pi, offset: line.start + localOffset };
  }, [fontSize, hitTestY, outerPadLeft]);

  // Link hit-testing deliberately uses character CONTAINMENT rather than
  // `posFromXY`'s nearest-boundary rounding. At a link's right edge the
  // boundary offset is also the offset of the next run, so boundary-based
  // testing would make the first character after a link open that link.
  const linkRangeAtXY = useCallback((x: number, y: any): LinkRange | undefined => {
    const { pi, lineIdx } = hitTestY(y);
    const item = layoutInfoRef.current.items[pi];
    const line = item.lines[lineIdx];
    const linePara = lineAsParagraph(line);
    const localX = x - EDITOR_PADDING - outerPadLeft - item.mw - (line.alignOffset ?? 0) + scrollXRef.current;
    if (localX < 0 || localX > measureCursorX(linePara, paraText(linePara).length, fontSize)) return undefined;
    const charIdx = line.start + charIndexAtPoint(linePara, localX, fontSize);
    return linkRangeAtOffset(docRef.current, { para: pi, offset: charIdx });
  }, [fontSize, hitTestY, outerPadLeft]);

  // Clicking a linked run opens a small editor anchored to the link. It edits
  // the run's URL, can remove it, and (when the app supplies an opener) can
  // open it through `onLinkPress`. Clicks never launch a browser directly.
  const openLinkEditor = useCallback((range: LinkRange, x: number, y: number) => {
    if (linkPopoverRef.current != null) {
      closePopover(linkPopoverRef.current);
      linkPopoverRef.current = null;
    }
    const layout = typeof __glyx_getLayout !== 'undefined' && nodeIdRef.current != null
      ? __glyx_getLayout(nodeIdRef.current)
      : null;
    const anchorX = (layout ? (layout.boxX ?? layout.x) : 0) + x;
    const anchorY = (layout ? (layout.boxY ?? layout.y) : 0) + y;
    const id = openPopover({
      x: anchorX,
      y: anchorY,
      h: 4,
      width: 332,
      contentH: 118,
      render: (popoverId) => (
        <LinkEditorCard
          initialUrl={range.url}
          canOpen={openLinks && Boolean(onLinkPress)}
          onApply={(url) => {
            applyLinkRange(range, url);
            closePopover(popoverId);
            focusEditorSoon();
          }}
          onRemove={() => {
            applyLinkRange(range, '');
            closePopover(popoverId);
            focusEditorSoon();
          }}
          onOpen={(url) => {
            onLinkPress?.(normalizeLink(url));
            closePopover(popoverId);
            focusEditorSoon();
          }}
          onClose={() => {
            closePopover(popoverId);
            focusEditorSoon();
          }}
        />
      ),
      onClose: () => { linkPopoverRef.current = null; },
    });
    linkPopoverRef.current = id;
  }, [applyLinkRange, focusEditorSoon, openLinks, onLinkPress]);

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
  const onPress = useCallback((ev: { locationY: number; locationX: any; }) => {
    _family = familyRef.current.fontFamily; _variations = familyRef.current.fontVariationSettings;
    _features = familyRef.current.fontFeatureSettings;
    const suppressed = hScrollbarBoundRef.current !== null && ev.locationY >= hScrollbarBoundRef.current;
    textDragSuppressedRef.current = suppressed;
    if (suppressed) return;
    _focusedEditor = nodeIdRef.current;
    setFocused(true);
    setBlinkOn(true);
    const c = posFromXY(ev.locationX, ev.locationY);
    const link = linkRangeAtXY(ev.locationX, ev.locationY);
    if (link) {
      dragAnchorRef.current = c;
      setCursor(c);
      openLinkEditor(link, ev.locationX, ev.locationY);
      return;
    }
    dragAnchorRef.current = c;
    setCursor(c);
  }, [posFromXY, linkRangeAtXY, setCursor, openLinkEditor]);

  // Mouse-drag selection: registered as an "input" node (alongside the
  // Pressable) so events.ts routes per-frame cursorMoved deltas here while
  // the button is held — Pressable only ever fires a single onPress on
  // release, with no drag/move callback of its own.
  const onDragAt = useCallback((x: any, y: any) => {
    if (textDragSuppressedRef.current) return;
    _family = familyRef.current.fontFamily; _variations = familyRef.current.fontVariationSettings;
    _features = familyRef.current.fontFeatureSettings;
    const c = posFromXY(x, y);
    typingFormatRef.current = {};
    historyRef.current?.breakRun();
    setCursor_(c);
    setSel_({ anchor: dragAnchorRef.current, focus: c });
  }, [posFromXY]);

  // Double-click: select the word under the click, same convention as
  // @glyx-dev/react's TextInput (controls.ts's onDoubleClickAt) — this is a
  // separate component with its own click handling, so it needs its own
  // word-boundary logic rather than sharing that one.
  const onDoubleClickAt = useCallback((x: number, y: number) => {
    if (hScrollbarBoundRef.current !== null && y >= hScrollbarBoundRef.current) return;
    _family = familyRef.current.fontFamily; _variations = familyRef.current.fontVariationSettings;
    _features = familyRef.current.fontFeatureSettings;
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
    const localX = x - EDITOR_PADDING - outerPadLeft - item.mw - (line.alignOffset ?? 0) + scrollXRef.current;
    const charIdx = line.start + charIndexAtPoint(lineAsParagraph(line), localX, fontSize);
    const { start, end } = wordRangeAt(paraText(item.para), charIdx);
    const anchor = { para: pi, offset: start };
    const focus  = { para: pi, offset: end };
    historyRef.current?.breakRun();
    setCursor_(focus);
    setSel_({ anchor, focus });
  }, [hitTestY, fontSize, outerPadLeft]);

  // Clamp a target scroll offset against the real (native-measured) content
  // height — mirrors `@glyx-dev/react`'s `ScrollView`/multiline `TextInput`.
  const clampScrollY = useCallback((y: number) => {
    const id = scrollContainerIdRef.current;
    if (id == null || typeof __glyx_getLayout === 'undefined') return 0;
    const l = __glyx_getLayout(id);
    // contentHeight is measured natively from UNCLIPPED rects, so subtract
    // the unclipped viewport height too (the plain `height` shrinks when an
    // outer ScrollView clips this editor, letting the max overshoot).
    const max = (l && typeof l.contentHeight === 'number') ? Math.max(0, l.contentHeight - (l.boxHeight ?? l.height)) : 0;
    return Math.min(max, Math.max(0, y));
  }, []);

  const setScrollYBoth = useCallback((y: number) => {
    scrollYRef.current = y;
    setScrollY(y);
  }, []);

  // Registers the paragraphs container as a scrollable clip node — wheel
  // and native scrollbar-thumb drags both route here via the SAME
  // `registerScrollView` registry `ScrollView` uses. `onScroll`/
  // `onAbsoluteScroll` only ever touch refs, so (like every other
  // `_glyxOnMount`-registered handler in this file) this stays correct
  // forever despite firing exactly once at node creation.
  const onScrollContainerMount = useCallback((id: number) => {
    scrollContainerIdRef.current = id;
    registerScrollView(id, {
      onScroll:         (dy) => setScrollYBoth(clampScrollY(scrollYRef.current + dy)),
      onAbsoluteScroll: (y: any)  => setScrollYBoth(clampScrollY(y)),
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
    const caretTop    = item.y + Math.min(li, item.lines.length - 1) * item.lineHeight;
    const caretBottom = caretTop + item.lineHeight;
    const viewH = l.boxHeight ?? l.height; // own viewport, not the clipped part
    let sy = scrollYRef.current;
    if (caretBottom - sy > viewH) sy = caretBottom - viewH;
    if (caretTop - sy < 0) sy = caretTop;
    sy = clampScrollY(sy);
    if (sy !== scrollYRef.current) setScrollYBoth(sy);
  }, [cursor, focused, layoutInfo, LINE_H, clampScrollY, setScrollYBoth]);

  const clampScrollX = useCallback((x: number) => {
    const li = layoutInfoRef.current;
    const max = Math.max(0, li.maxContentWidth - li.contentWidth);
    return Math.min(max, Math.max(0, x));
  }, []);

  const setScrollXBoth = useCallback((x: number) => {
    scrollXRef.current = x;
    setScrollX(x);
  }, []);

  // Custom horizontal scrollbar track — click/drag anywhere on it jumps or
  // pans, same "track IS the draggable" simplicity Slider uses for its own
  // rail (`registerDraggable` gives absolute screen-space `x`; subtract the
  // track's own layout `x` to get a local fraction).
  const onScrollbarTrackMount = useCallback((id: number) => {
    scrollbarTrackIdRef.current = id;
    const updateFromX = (x: number) => {
      const layout = typeof __glyx_getLayout !== 'undefined' ? __glyx_getLayout(id) : null;
      const trackW = layout ? (layout.boxWidth ?? layout.width) : 0;
      if (!layout || trackW <= 0) return;
      const li = layoutInfoRef.current;
      const maxScroll = Math.max(0, li.maxContentWidth - li.contentWidth);
      // Track origin/width from the unclipped box — see events.ts boxOriginX.
      const frac = Math.max(0, Math.min(1, (x - (layout.boxX ?? layout.x)) / trackW));
      setScrollXBoth(clampScrollX(frac * maxScroll));
    };
    registerDraggable(id, {
      onDragStart({ x }: Record<string, any>) { updateFromX(x); },
      onDragMove({ x }: Record<string, any>)  { updateFromX(x); },
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
    const caretX = item.mw + (line.alignOffset ?? 0) + measureCursorX(lineAsParagraph(line), cursor.offset - line.start, fontSize);
    const viewportW = li.contentWidth;
    let sx = scrollXRef.current;
    if (caretX - sx > viewportW) sx = caretX - viewportW;
    if (caretX - sx < 0) sx = caretX;
    sx = clampScrollX(sx);
    if (sx !== scrollXRef.current) setScrollXBoth(sx);
  }, [cursor, focused, wrap, layoutInfo, fontSize, clampScrollX, setScrollXBoth]);

  const onMount = useCallback((id: number) => {
    nodeIdRef.current = id;
    registerInput(id, {
      onClickAt:       (x, y) => { onPress({ locationX: x, locationY: y }); },
      onDoubleClickAt,
      onDragAt,
      onKeyPress:      (ev) => onKey(ev),
      onFocus: () => { _focusedEditor = id; setFocused(true); setBlinkOn(true); },
      onBlur: () => { if (_focusedEditor === id) { _focusedEditor = null; setFocused(false); } },
    });
    if (autoFocus) {
      _focusedEditor = id;
      setFocused(true);
      setBlinkOn(true);
      // Cursor at the end of the document, same convention as
      // @glyx-dev/react's TextInput focusing (controls.ts's onFocus).
      const paras = docRef.current.paragraphs;
      const last = paras.length - 1;
      const end = { para: last, offset: paraText(paras[last]).length };
      setCursor(end);
    }
  }, [onPress, onDoubleClickAt, onDragAt, onKey, autoFocus, setCursor]);

  useEffect(() => {
    return () => {
      if (linkPopoverRef.current != null) closePopover(linkPopoverRef.current);
      if (nodeIdRef.current !== null) unregisterInput(nodeIdRef.current);
    };
  }, []);

  const PADDING = EDITOR_PADDING;

  const ctxValue = {
    doc, setDoc, cursor, setCursor, sel, setSel: setSel_, applyEdit,
    selectionHasFormat: (key: FormatKey) => {
      if (hasSelection(sel)) return selectionHasFormat(doc, sel, key);
      const pending = typingFormatRef.current[key];
      if (pending !== undefined) return Boolean(pending);
      return Boolean(spanAtCursor(doc, cursor)?.[key]);
    },
    toggleFormat: (key: FormatKey) => {
      const on = hasSelection(sel)
        ? selectionHasFormat(doc, sel, key)
        : Boolean(typingFormatRef.current[key] ?? spanAtCursor(doc, cursor)?.[key]);
      if (hasSelection(sel)) setDoc(applyFormat(doc, sel, key, !on));
      rememberFormat(key, !on);
    },
    formatValue: (key: ValueFormatKey): FormatValue => {
      if (!hasSelection(sel) && key in typingFormatRef.current) return typingFormatRef.current[key] as FormatValue;
      return selectionFormatValue(doc, sel, key as keyof Span) as FormatValue;
    },
    setFormat: (key: ValueFormatKey, value: FormatValue) => {
      if (hasSelection(sel)) setDoc(applyFormat(doc, sel, key as keyof Span, value));
      rememberFormat(key as keyof Span, value);
    },
    // Applies to the current line (or every line touched by the selection).
    // Toggling the SAME list type off exits the list; toggling a DIFFERENT
    // one switches it (matches common editor convention).
    toggleList: (listType: any) => {
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
    indent: (delta: any) => {
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
    isListActive: (listType: any) => doc.paragraphs[cursor.para]?.listType === listType,
    align: paragraphAlign(doc, cursor),
    setAlign: (align: TextAlign) => {
      setDoc(setParagraphAlign(doc, sel, align));
    },
    fontSize,
    // Toolbar Pressables use `keepFocus`, so the event layer keeps routing
    // keys here; this also reverses the editor's own outside-click blur.
    refocus: () => {
      const id = nodeIdRef.current;
      if (id == null) return;
      _focusedEditor = id;
      setFocused(true);
      setBlinkOn(true);
    },
  };

  const isEmpty = doc.paragraphs.length === 1 && paraText(doc.paragraphs[0]) === '';

  return (
    <EditorCtx.Provider value={ctxValue}>
      {children}
      <Pressable
        onPress={onPress}
        _glyxOnMount={onMount}
        cursor="text"
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
          } as any}
        >
          {isEmpty && placeholder ? (
            <Text style={{ fontSize, color: '#555577', position: 'absolute', top: PADDING, left: PADDING }}>
              {placeholder}
            </Text>
          ) : null}
          <View style={{ position: 'relative', left: -scrollX }}>
            {layoutInfo.items.map((item: any) => (
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
                lineHeight={item.lineHeight}
                contentWidth={layoutInfo.contentWidth}
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

// ── Link editor ───────────────────────────────────────────────────────────────

// The popover shown when a linked run is clicked. It applies to the exact run
// range captured at click time (not the editor's current selection), so changing
// the URL never depends on where the caret happened to be before the click.
function LinkEditorCard({
  initialUrl,
  canOpen,
  onApply,
  onRemove,
  onOpen,
  onClose,
}: {
  initialUrl: string;
  canOpen: boolean;
  onApply: (url: string) => void;
  onRemove: () => void;
  onOpen: (url: string) => void;
  onClose: () => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const trimmedUrl = normalizeLink(url);
  const showOpen = canOpen && Boolean(trimmedUrl);
  return (
    <View style={{
      backgroundColor: '#1c1c29',
      borderRadius: 9,
      borderWidth: 1,
      borderColor: '#36364e',
      padding: 10,
      boxShadow: '0 14 36 #00000088',
    }}>
      <Text style={{ fontSize: 10, color: '#74748f', paddingHorizontal: 2, paddingBottom: 6 }}>
        EDIT LINK
      </Text>
      <TextInput
        value={url}
        onChangeText={setUrl}
        onSubmitEditing={() => onApply(url)}
        autoFocus
        placeholder="https://example.com"
        placeholderTextColor="#66667f"
        style={{
          height: 32, backgroundColor: '#15151f', borderRadius: 5,
          borderWidth: 1, borderColor: '#36364e', color: '#e8e8f0',
          paddingHorizontal: 8, fontSize: 12,
        } as any}
      />
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 10 }}>
        <LinkEditorButton label="Cancel" onPress={onClose} />
        <View style={{ flex: 1 }} />
        <LinkEditorButton label="Remove" danger onPress={onRemove} />
        {showOpen ? <LinkEditorButton label="Open" onPress={() => onOpen(url)} /> : null}
        <LinkEditorButton label="Apply" primary onPress={() => onApply(url)} />
      </View>
    </View>
  );
}

function LinkEditorButton({
  label,
  primary = false,
  danger = false,
  onPress,
}: {
  label: string;
  primary?: boolean;
  danger?: boolean;
  onPress: () => void;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      feedback={false}
      ariaLabel={label}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        height: 28,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 5,
        backgroundColor: primary ? (hover ? '#4250c4' : TOOLBAR_ACTIVE) : hover ? '#2a2a3d' : 'transparent',
      }}
    >
      <Text style={{
        fontSize: 12,
        color: primary ? '#ffffff' : danger ? '#e08a9b' : '#b8b8cc',
        fontWeight: primary ? 'bold' : 'normal',
      }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── ParagraphRow ──────────────────────────────────────────────────────────────

// Renders `mw` + one flow child per line so absolutely-positioned overlays
// (cursor/selection) line up exactly with where a line's text actually
// starts — same convention `markerWidth`'s callers rely on elsewhere.
function LineSpans({ mw, markerText, fontSize, color, pieces }: Record<string, any>) {
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
      {pieces.map((p: { text: string | number | boolean | React.ReactElement<any, string | React.JSXElementConstructor<any>> | Iterable<React.ReactNode> | React.ReactPortal | null | undefined; span: { fontSize: any; color: any; bold: any; italic: any; underline: any; code?: boolean; link?: string; highlight?: string; fontFamily?: string; fontVariationSettings?: string; fontFeatureSettings?: string; }; }, si: React.Key | null | undefined) => (
        p.text ? (
          <Text
            key={si}
            textScrollX={0}
            style={{
              fontSize: p.span.fontSize ?? fontSize,
              ...(spanFamily(p.span) ? { fontFamily: spanFamily(p.span) } : null),
              ...((p.span.fontVariationSettings ?? (p.span.code ? undefined : _variations))
                ? { fontVariationSettings: p.span.fontVariationSettings ?? (p.span.code ? undefined : _variations) } : null),
              ...((p.span.fontFeatureSettings ?? (p.span.code ? undefined : _features))
                ? { fontFeatureSettings: p.span.fontFeatureSettings ?? (p.span.code ? undefined : _features) } : null),
              color: p.span.color ?? (p.span.link ? '#8ab4f8' : color),
              fontWeight: p.span.bold ? 'bold' : 'normal',
              fontStyle: p.span.italic ? 'italic' : 'normal',
              textDecorationLine: (p.span.underline || p.span.link) ? 'underline' : 'none',
              ...(p.span.link ? { cursor: 'pointer' } : null),
            }}
          >
            {p.text}
          </Text>
        ) : null
      ))}
    </>
  );
}

function ParagraphRow({ para, paraIdx, mw, lines, cursor, sel, focused, blinkOn, fontSize, color, lineHeight, listNumber, contentWidth }: Record<string, any>) {
  const { anchor, focus: selFocus } = normSel(sel);
  const markerText = para.listType ? listMarkerText(para, listNumber) : '';
  const selActive = hasSelection(sel) && paraIdx >= anchor.para && paraIdx <= selFocus.para;
  const selStart  = selActive ? (paraIdx === anchor.para  ? anchor.offset   : 0) : null;
  const selEnd    = selActive ? (paraIdx === selFocus.para ? selFocus.offset : paraText(para).length) : null;

  return (
    <>
      {lines.map((line: any, li: number) => {
        const lp = lineAsParagraph(line);
        const isLastLine = li === lines.length - 1;
        const alignOffset = line.alignOffset ?? 0;

        // Selection intersected with this visual line's [start, end) range.
        let selX0 = null, selX1: any = null;
        if (selActive) {
          const s = Math.max(selStart as number, line.start);
          const e = Math.min(selEnd as number, line.end);
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

        // Inline code and highlight backgrounds. Native `Text` nodes paint
        // their own box, not a run background that follows the glyphs across a
        // line, so these are explicit rectangles behind the line's text. The
        // selection overlay goes above them; the text and caret go above both.
        const backgrounds: Array<{ left: number; width: number; color: string }> = [];
        let pieceX = 0;
        for (const piece of line.pieces) {
          const width = measureSpan(piece.text, piece.span, fontSize);
          const color = piece.span.highlight ?? (piece.span.code ? '#2a2a3d' : null);
          if (color && piece.text) backgrounds.push({ left: alignOffset + mw + pieceX, width, color });
          pieceX += width;
        }

        return (
          <View key={li} style={{ height: lineHeight, width: contentWidth, flexDirection: 'row', position: 'relative' }}>
            {backgrounds.map((bg, bi) => (
              <View key={`bg-${bi}`} style={{
                position: 'absolute',
                left: bg.left,
                top: 2,
                width: Math.max(1, bg.width),
                height: lineHeight - 4,
                backgroundColor: bg.color,
                borderRadius: 2,
              }} />
            ))}
            {selX0 !== null && (
              <View style={{
                position: 'absolute',
                left: alignOffset + mw + selX0,
                top: 2,
                width: Math.max(1, selX1 - selX0),
                height: lineHeight - 4,
                backgroundColor: '#3949ab55',
                borderRadius: 2,
              }} />
            )}
            <View style={{ flexDirection: 'row', marginLeft: alignOffset }}>
              <LineSpans mw={mw} markerText={li === 0 ? markerText : ''} fontSize={fontSize} color={color} pieces={line.pieces} />
            </View>
            {cursorX !== null && blinkOn && (
              <View style={{
                position: 'absolute',
                left: alignOffset + mw + cursorX,
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

/** Families a plain toolbar offers before the app passes its own: common on Windows, macOS and Linux, then the generic stacks. */
const DEFAULT_FONT_FAMILIES = [
  'system-ui', 'Segoe UI', 'Arial', 'Georgia', 'Times New Roman',
  'Cascadia Mono', 'Consolas', 'Courier New', 'serif', 'monospace',
];

const FONT_SIZES = [10, 11, 12, 13, 14, 16, 18, 20, 24, 28, 32, 40];

const TOOLBAR_BG = '#1b1b28';
const TOOLBAR_BORDER = '#2c2c40';
const TOOLBAR_HOVER = '#28283a';
const TOOLBAR_ACTIVE = '#3541a3';
const TOOLBAR_ICON = '#b8b8ce';

const HIGHLIGHT_COLORS = [
  '#f6e05e66', '#68d39166', '#63b3ed66', '#f687b366', '#b794f466', '#f6ad5566',
];
const ALIGN_ICON: Record<TextAlign, string> = {
  left: 'align-left', center: 'align-center', right: 'align-right',
};
const ALIGN_LABEL: Record<TextAlign, string> = { left: 'Left', center: 'Center', right: 'Right' };

function normalizeLink(value: string) {
  const url = value.trim();
  if (!url) return '';
  return /^[a-z][a-z0-9+.-]*:/i.test(url) ? url : `https://${url}`;
}

export function RichTextToolbar({ style, fontFamilies = DEFAULT_FONT_FAMILIES }: RichTextToolbarProps) {
  const ctx = useContext(EditorCtx);
  const [open, setOpen] = useState<'font' | 'size' | 'highlight' | 'align' | 'link' | null>(null);
  const [linkURL, setLinkURL] = useState('');
  if (!ctx) return null;
  const { toggleFormat, selectionHasFormat, formatValue, setFormat, toggleList, indent, isListActive, align, setAlign, fontSize, refocus } = ctx;

  const currentFamily = (formatValue('fontFamily') as string | undefined) ?? 'system-ui';
  const currentSize = Math.round(Number(formatValue('fontSize') ?? fontSize));
  const currentHighlight = formatValue('highlight') as string | undefined;
  const families = Array.from(new Set([currentFamily, ...fontFamilies]));
  const familyLabel = currentFamily === 'system-ui' ? 'Default' : currentFamily;
  const shownFamily = familyLabel.length > 16 ? `${familyLabel.slice(0, 15)}…` : familyLabel;

  const openMenu = (menu: 'font' | 'size' | 'highlight' | 'align' | 'link') => {
    refocus();
    if (menu === 'link') setLinkURL((formatValue('link') as string | undefined) ?? '');
    setOpen((o) => o === menu ? null : menu);
  };
  const applyLink = () => {
    const url = normalizeLink(linkURL);
    setFormat('link', url || undefined);
    setOpen(null);
    refocus();
  };

  return (
    <Pressable
      keepFocus
      feedback={false}
      onPress={() => { refocus(); setOpen(null); }}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        padding: 5,
        backgroundColor: TOOLBAR_BG,
        borderRadius: 7,
        borderWidth: 1,
        borderColor: TOOLBAR_BORDER,
        marginBottom: 8,
        // The toolbar must outrank the status/feature rows that follow it in
        // the editor's children, or an open menu is painted underneath them.
        zIndex: open ? 80 : undefined,
        ...style,
      }}
    >
      {open ? (
        <Pressable
          keepFocus
          feedback={false}
          onPress={() => { refocus(); setOpen(null); }}
          style={{ position: 'absolute', left: -2000, top: -2000, width: 4000, height: 4000, zIndex: 0 }}
        />
      ) : null}

      <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 3, flex: 1, zIndex: 1 }}>
        <ToolButton icon="bold" label="Bold" active={selectionHasFormat('bold')}
          onPress={() => { refocus(); setOpen(null); toggleFormat('bold'); }} />
        <ToolButton icon="italic" label="Italic" active={selectionHasFormat('italic')}
          onPress={() => { refocus(); setOpen(null); toggleFormat('italic'); }} />
        <ToolButton icon="underline" label="Underline" active={selectionHasFormat('underline')}
          onPress={() => { refocus(); setOpen(null); toggleFormat('underline'); }} />
        <ToolButton icon="code" label="Inline code" active={selectionHasFormat('code')}
          onPress={() => { refocus(); setOpen(null); toggleFormat('code'); }} />

        {/* Highlight and link menus use icon-only triggers to keep the bar compact. */}
        <View style={{ position: 'relative', zIndex: 55 }}>
          <IconMenuTrigger
            icon="highlighter"
            label="Highlight"
            open={open === 'highlight'}
            active={Boolean(currentHighlight)}
            onPress={() => openMenu('highlight')}
          />
          {open === 'highlight' ? (
            <View style={{
              position: 'absolute', top: 35, left: -40, width: 196,
              backgroundColor: '#1c1c29', borderRadius: 9, borderWidth: 1, borderColor: '#36364e',
              padding: 4, zIndex: 60, boxShadow: '0 14 36 #00000088',
            }}>
              <Text style={{ fontSize: 10, color: '#74748f', paddingHorizontal: 8, paddingTop: 5, paddingBottom: 4 }}>
                HIGHLIGHT
              </Text>
              <View style={{ flexDirection: 'row', gap: 8, paddingHorizontal: 8, paddingVertical: 6 }}>
                {HIGHLIGHT_COLORS.map((colour) => (
                  <Pressable
                    key={colour}
                    keepFocus
                    feedback={false}
                    ariaLabel={`Highlight ${colour}`}
                    onPress={() => { refocus(); setFormat('highlight', colour); setOpen(null); }}
                    style={{
                      width: 22, height: 22, borderRadius: 11,
                      backgroundColor: colour,
                      borderWidth: 2,
                      borderColor: currentHighlight === colour ? '#ffffff' : '#3a3a52',
                    }}
                  />
                ))}
              </View>
              <MenuRow
                label="No highlight"
                selected={!currentHighlight}
                onPress={() => { refocus(); setFormat('highlight', undefined); setOpen(null); }}
              />
            </View>
          ) : null}
        </View>

        <View style={{ position: 'relative', zIndex: 55 }}>
          <IconMenuTrigger
            icon="link"
            label="Link"
            open={open === 'link'}
            active={Boolean(formatValue('link'))}
            onPress={() => openMenu('link')}
          />
          {open === 'link' ? (
            <View style={{
              position: 'absolute', top: 35, left: -96, width: 286,
              backgroundColor: '#1c1c29', borderRadius: 9, borderWidth: 1, borderColor: '#36364e',
              padding: 8, zIndex: 60, boxShadow: '0 14 36 #00000088',
            }}>
              <Text style={{ fontSize: 10, color: '#74748f', paddingHorizontal: 2, paddingBottom: 5 }}>
                LINK URL
              </Text>
              <TextInput
                value={linkURL}
                onChangeText={setLinkURL}
                onSubmitEditing={applyLink}
                autoFocus
                placeholder="https://example.com"
                placeholderTextColor="#66667f"
                style={{
                  height: 32, backgroundColor: '#15151f', borderRadius: 5,
                  borderWidth: 1, borderColor: '#36364e', color: '#e8e8f0',
                  paddingHorizontal: 8, fontSize: 12,
                } as any}
              />
              <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 6, marginTop: 8 }}>
                <Pressable
                  keepFocus
                  feedback={false}
                  onPress={() => { refocus(); setFormat('link', undefined); setOpen(null); }}
                  style={{ height: 28, paddingHorizontal: 10, justifyContent: 'center', borderRadius: 5 }}
                >
                  <Text style={{ fontSize: 12, color: '#a9a9c4' }}>Remove</Text>
                </Pressable>
                <Pressable
                  keepFocus
                  feedback={false}
                  onPress={applyLink}
                  style={{
                    height: 28, paddingHorizontal: 12, justifyContent: 'center',
                    borderRadius: 5, backgroundColor: TOOLBAR_ACTIVE,
                  }}
                >
                  <Text style={{ fontSize: 12, color: '#ffffff', fontWeight: 'bold' }}>Apply</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>

        <ToolbarSeparator />

        <ToolButton icon="list" label="Bullet list" active={isListActive('bullet')}
          onPress={() => { refocus(); setOpen(null); toggleList('bullet'); }} />
        <ToolButton icon="list-ordered" label="Numbered list" active={isListActive('number')}
          onPress={() => { refocus(); setOpen(null); toggleList('number'); }} />

        <ToolbarSeparator />

        <ToolButton icon="indent-increase" label="Increase indent"
          onPress={() => { refocus(); setOpen(null); indent(1); }} />
        <ToolButton icon="indent-decrease" label="Decrease indent"
          onPress={() => { refocus(); setOpen(null); indent(-1); }} />

        <ToolbarSeparator />

        {/* Font family: the trigger shows the name in its own font; the menu
            previews each family the same way. */}
        <View style={{ position: 'relative', zIndex: 55 }}>
          <MenuTrigger
            width={132}
            open={open === 'font'}
            onPress={() => openMenu('font')}
          >
            <Icon name="type" size={14} color={open === 'font' ? '#fff' : TOOLBAR_ICON} />
            <Text style={{
              fontSize: 12,
              fontFamily: currentFamily === 'system-ui' ? undefined : currentFamily,
              color: open === 'font' ? '#fff' : '#d0d0e2',
              flex: 1,
            }}>{shownFamily}</Text>
          </MenuTrigger>
          {open === 'font' ? (
            <View style={{
              position: 'absolute', top: 35, left: 0, width: 232,
              backgroundColor: '#1c1c29', borderRadius: 9, borderWidth: 1, borderColor: '#36364e',
              padding: 4, zIndex: 60, boxShadow: '0 14 36 #00000088',
            }}>
              <Text style={{ fontSize: 10, color: '#74748f', paddingHorizontal: 8, paddingTop: 5, paddingBottom: 4 }}>
                FONT FAMILY
              </Text>
              {families.map((family) => {
                const selected = family === currentFamily;
                return (
                  <MenuRow
                    key={family}
                    label={family === 'system-ui' ? 'Default' : family}
                    selected={selected}
                    fontFamily={family === 'system-ui' ? undefined : family}
                    onPress={() => {
                      refocus();
                      setFormat('fontFamily', family === 'system-ui' ? undefined : family);
                      setOpen(null);
                    }}
                  />
                );
              })}
            </View>
          ) : null}
        </View>

        {/* Font size: same menu behaviour, sized to the numbers it carries. */}
        <View style={{ position: 'relative', zIndex: 55 }}>
          <MenuTrigger
            width={60}
            open={open === 'size'}
            onPress={() => openMenu('size')}
          >
            <Text style={{ fontSize: 12, color: open === 'size' ? '#fff' : '#d0d0e2', flex: 1 }}>
              {currentSize}
            </Text>
          </MenuTrigger>
          {open === 'size' ? (
            <View style={{
              position: 'absolute', top: 35, left: 0, width: 84,
              backgroundColor: '#1c1c29', borderRadius: 9, borderWidth: 1, borderColor: '#36364e',
              padding: 4, zIndex: 60, boxShadow: '0 14 36 #00000088',
            }}>
              <Text style={{ fontSize: 10, color: '#74748f', paddingHorizontal: 8, paddingTop: 5, paddingBottom: 4 }}>
                SIZE
              </Text>
              {FONT_SIZES.map((size) => (
                <MenuRow
                  key={size}
                  label={String(size)}
                  selected={size === currentSize}
                  onPress={() => { refocus(); setFormat('fontSize', size); setOpen(null); }}
                />
              ))}
            </View>
          ) : null}
        </View>

        <View style={{ position: 'relative', zIndex: 55 }}>
          <IconMenuTrigger
            icon={ALIGN_ICON[align]}
            label={`Align ${ALIGN_LABEL[align].toLowerCase()}`}
            open={open === 'align'}
            onPress={() => openMenu('align')}
          />
          {open === 'align' ? (
            <View style={{
              position: 'absolute', top: 35, right: 0, width: 132,
              backgroundColor: '#1c1c29', borderRadius: 9, borderWidth: 1, borderColor: '#36364e',
              padding: 4, zIndex: 60, boxShadow: '0 14 36 #00000088',
            }}>
              <Text style={{ fontSize: 10, color: '#74748f', paddingHorizontal: 8, paddingTop: 5, paddingBottom: 4 }}>
                ALIGN
              </Text>
              {(['left', 'center', 'right'] as TextAlign[]).map((value) => (
                <MenuRow
                  key={value}
                  label={ALIGN_LABEL[value]}
                  icon={ALIGN_ICON[value]}
                  selected={align === value}
                  onPress={() => { refocus(); setAlign(value); setOpen(null); }}
                />
              ))}
            </View>
          ) : null}
        </View>
      </View>
    </Pressable>
  );
}

export const DEFAULT_FEATURE_PRESETS: RichTextFeaturePreset[] = [
  { label: 'Tabular figures', value: "'tnum' 1" },
  { label: 'Small caps', value: "'smcp' 1" },
  { label: 'No ligatures', value: "'liga' 0" },
];

/**
 * A reusable row of OpenType-feature presets (tabular figures, small caps,
 * ligatures off, and any presets the app supplies). It must be rendered inside
 * a {@link RichTextEditor}, like the toolbar, and applies the feature to the
 * selection or to the text typed next.
 */
export function RichTextFeaturePicker({
  features = DEFAULT_FEATURE_PRESETS,
  label = 'Features',
  clearLabel = 'Clear',
  width,
  style,
}: RichTextFeaturePickerProps) {
  const ctx = useContext(EditorCtx);
  if (!ctx) return null;
  const current = ctx.formatValue('fontFeatureSettings') as string | undefined;
  return (
    <View style={[{
      width,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      marginBottom: 8,
    }, style]}>
      <Text style={{ fontSize: 11, color: '#707090', width: 60 }}>{label}</Text>
      {features.map((preset) => {
        const selected = current === preset.value;
        return (
          <FeatureButton
            key={`${preset.label}:${preset.value}`}
            label={preset.label}
            selected={selected}
            onPress={() => {
              ctx.refocus();
              ctx.setFormat('fontFeatureSettings', selected ? undefined : preset.value);
            }}
          />
        );
      })}
      <FeatureButton
        label={clearLabel}
        selected={!current}
        onPress={() => {
          ctx.refocus();
          ctx.setFormat('fontFeatureSettings', undefined);
        }}
      />
    </View>
  );
}

function FeatureButton({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      keepFocus
      feedback={false}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        height: 26, paddingHorizontal: 8, alignItems: 'center', justifyContent: 'center',
        borderRadius: 5, borderWidth: 1,
        borderColor: selected ? '#5c6bc0' : hover ? '#3a3a52' : '#2a2a3a',
        backgroundColor: selected ? '#3949ab' : hover ? '#242432' : '#1b1b28',
      }}
    >
      <Text style={{ fontSize: 11, color: selected ? '#fff' : '#b8b8cc' }}>{label}</Text>
    </Pressable>
  );
}

function ToolbarSeparator() {
  return <View style={{ width: 1, height: 18, backgroundColor: '#323248', marginHorizontal: 3 }} />;
}

function ToolButton({ icon, label, active, onPress }: Record<string, any>) {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      keepFocus
      feedback={false}
      ariaLabel={label}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        width: 30, height: 30,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: active ? TOOLBAR_ACTIVE : hover ? TOOLBAR_HOVER : 'transparent',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: active ? '#5968d8' : 'transparent',
      }}
    >
      <Icon
        name={icon}
        size={16}
        strokeWidth={2}
        color={active ? '#ffffff' : hover ? '#e4e4f2' : TOOLBAR_ICON}
      />
    </Pressable>
  );
}

function IconMenuTrigger({ icon, label, open, active, onPress }: Record<string, any>) {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      keepFocus
      feedback={false}
      ariaLabel={label}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        width: 30, height: 30,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: open ? '#2d2d42' : active ? TOOLBAR_ACTIVE : hover ? TOOLBAR_HOVER : 'transparent',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: open ? '#484866' : active ? '#5968d8' : 'transparent',
      }}
    >
      <Icon name={icon} size={16} strokeWidth={2} color={open || active ? '#ffffff' : hover ? '#e4e4f2' : TOOLBAR_ICON} />
    </Pressable>
  );
}

function MenuTrigger({ width, open, onPress, children }: Record<string, any>) {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      keepFocus
      feedback={false}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        width, height: 30,
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 8,
        backgroundColor: open ? '#2d2d42' : hover ? TOOLBAR_HOVER : 'transparent',
        borderRadius: 5,
        borderWidth: 1,
        borderColor: open ? '#484866' : 'transparent',
      }}
    >
      {children}
      <Icon name="chevron-down" size={12} color="#8585a0" />
    </Pressable>
  );
}

function MenuRow({ label, selected, fontFamily, icon, onPress }: Record<string, any>) {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      keepFocus
      feedback={false}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        height: 32,
        paddingHorizontal: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        borderRadius: 5,
        backgroundColor: selected ? '#343fa8' : hover ? '#2a2a3d' : 'transparent',
      }}
    >
      {icon ? <Icon name={icon} size={14} color={selected ? '#fff' : '#a9a9c4'} /> : null}
      <Text style={{ flex: 1, fontSize: 13, color: selected ? '#fff' : '#d0d0e2', fontFamily }}>{label}</Text>
      {selected ? <Icon name="check" size={14} color="#ffffff" /> : null}
    </Pressable>
  );
}

// ── Serialization ─────────────────────────────────────────────────────────────

function escapeMarkdown(text: string) {
  return text.replace(/([\\`*_[\]<>])/g, '\\$1');
}

function spanToMarkdown(span: Span) {
  if (span.code) return `\`${span.text.replace(/`/g, '\\`')}\``;
  let text = escapeMarkdown(span.text);
  if (span.highlight) text = `<mark style="background-color:${span.highlight}">${text}</mark>`;
  if (span.underline) text = `<u>${text}</u>`;
  if (span.italic) text = `*${text}*`;
  if (span.bold) text = `**${text}**`;
  if (span.link) text = `[${text}](${span.link})`;
  return text;
}

/** The document as Markdown: headings are not a paragraph property yet, so the supported block features are lists and paragraphs. */
export function docToMarkdown(doc: RichTextDocument): string {
  const blocks: string[] = [];
  let list: string[] | null = null;
  let listType: ListType | null = null;

  const flushList = () => {
    if (list && list.length) blocks.push(list.join('\n'));
    list = null;
    listType = null;
  };

  doc.paragraphs.forEach((para, index) => {
    const inline = para.spans.map(spanToMarkdown).join('');
    if (para.listType) {
      if (list && listType !== para.listType) flushList();
      if (!list) { list = []; listType = para.listType; }
      const indent = '  '.repeat(para.indent ?? 0);
      const marker = para.listType === 'bullet' ? '-' : `${computeListNumber(doc.paragraphs, index)}.`;
      list.push(`${indent}${marker} ${inline}`);
      return;
    }
    flushList();
    blocks.push(inline);
  });
  flushList();
  return blocks.join('\n\n');
}

function escapeHTML(text: string) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function spanToHTML(span: Span) {
  let text = escapeHTML(span.text);
  if (span.code) text = `<code>${text}</code>`;
  if (span.highlight) text = `<mark style="background-color:${escapeHTML(span.highlight)}">${text}</mark>`;
  if (span.underline) text = `<u>${text}</u>`;
  if (span.italic) text = `<em>${text}</em>`;
  if (span.bold) text = `<strong>${text}</strong>`;
  if (span.link) text = `<a href="${escapeHTML(span.link)}">${text}</a>`;
  return text;
}

/** The document as simple HTML. Lists become `ul`/`ol`; paragraph alignment becomes an inline `text-align`. */
export function docToHTML(doc: RichTextDocument): string {
  let html = '';
  let listType: ListType | null = null;
  let items: string[] = [];

  const flushList = () => {
    if (!items.length) return;
    const tag = listType === 'number' ? 'ol' : 'ul';
    html += `<${tag}>${items.join('')}</${tag}>`;
    items = [];
    listType = null;
  };

  for (const para of doc.paragraphs) {
    const inline = para.spans.map(spanToHTML).join('');
    if (para.listType) {
      if (listType && listType !== para.listType) flushList();
      if (!listType) listType = para.listType;
      const indent = para.indent ? ` style="margin-left:${para.indent * 20}px"` : '';
      items.push(`<li${indent}>${inline || '<br>'}</li>`);
      continue;
    }
    flushList();
    const style = para.align && para.align !== 'left' ? ` style="text-align:${para.align}"` : '';
    html += `<p${style}>${inline || '<br>'}</p>`;
  }
  flushList();
  return html;
}

export function docToPlainText(doc: RichTextDocument): string {
  return doc.paragraphs.map((p): any => paraText(p)).join('\n');
}

export function docFromPlainText(text: string): RichTextDocument {
  return {
    paragraphs: text
      // Normalize CRLF/CR line endings (Windows/old-Mac text files) to LF —
      // a stray '\r' left in span text renders as a tofu box (no glyph),
      // same as a raw tab below.
      .replace(/\r\n?/g, '\n')
      .split('\n')
      .map((line) => ({
        // Tab has no visible glyph — Parley shapes it as a missing-glyph
        // box rather than whitespace. Expand to spaces on import instead of
        // trying to special-case control characters in the renderer.
        spans: [{ text: line.replace(/\t/g, '    ') }],
      })),
  };
}

// ── useRichText hook ──────────────────────────────────────────────────────────

export function useEditorContext(): EditorContextValue | null {
  return useContext(EditorCtx);
}
