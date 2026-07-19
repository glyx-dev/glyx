import { test, expect } from 'bun:test';
import {
  emptyDoc, paraText, splitSpansAt, mergeSpans, cursorEq, hasSelection, normSel,
  clampCursor, moveCursorBy, insertText, insertBreak, deleteChar, deleteSelection,
  applyFormat, selectionHasFormat, selectedText, docToPlainText, docFromPlainText,
} from './index.js';

function doc(...paraTexts) {
  return { paragraphs: paraTexts.map((t) => ({ spans: [{ text: t }] })) };
}

// ── paraText / mergeSpans / splitSpansAt ────────────────────────────────────

test('paraText concatenates span text', () => {
  const para = { spans: [{ text: 'foo', bold: true }, { text: 'bar' }] };
  expect(paraText(para)).toBe('foobar');
});

test('splitSpansAt splits a single span at the offset', () => {
  const [before, after] = splitSpansAt([{ text: 'hello' }], 2);
  expect(before).toEqual([{ text: 'he' }]);
  expect(after).toEqual([{ text: 'llo' }]);
});

test('splitSpansAt splits across multiple spans', () => {
  const spans = [{ text: 'foo', bold: true }, { text: 'bar' }];
  const [before, after] = splitSpansAt(spans, 4);
  expect(before).toEqual([{ text: 'foo', bold: true }, { text: 'b' }]);
  expect(after).toEqual([{ text: 'ar' }]);
});

test('mergeSpans combines adjacent spans with identical formatting', () => {
  const merged = mergeSpans([{ text: 'foo', bold: true }, { text: 'bar', bold: true }]);
  expect(merged).toEqual([{ text: 'foobar', bold: true }]);
});

test('mergeSpans keeps spans with different formatting separate', () => {
  const merged = mergeSpans([{ text: 'foo', bold: true }, { text: 'bar', bold: false }]);
  expect(merged.length).toBe(2);
});

test('mergeSpans drops empty-text spans but keeps at least one', () => {
  expect(mergeSpans([{ text: '' }])).toEqual([{ text: '' }]);
  expect(mergeSpans([{ text: 'a' }, { text: '' }, { text: 'b' }])).toEqual([{ text: 'ab' }]);
});

// ── Cursor helpers ───────────────────────────────────────────────────────────

test('cursorEq / hasSelection / normSel', () => {
  const a = { para: 0, offset: 2 };
  const b = { para: 0, offset: 5 };
  expect(cursorEq(a, a)).toBe(true);
  expect(cursorEq(a, b)).toBe(false);
  expect(hasSelection({ anchor: a, focus: a })).toBe(false);
  expect(hasSelection({ anchor: a, focus: b })).toBe(true);
  // normSel always puts the earlier cursor as anchor
  expect(normSel({ anchor: b, focus: a })).toEqual({ anchor: a, focus: b });
  expect(normSel({ anchor: a, focus: b })).toEqual({ anchor: a, focus: b });
});

test('clampCursor clamps out-of-range paragraph and offset', () => {
  const d = doc('hello', 'hi');
  expect(clampCursor(d, { para: -1, offset: -5 })).toEqual({ para: 0, offset: 0 });
  expect(clampCursor(d, { para: 99, offset: 99 })).toEqual({ para: 1, offset: 2 });
});

test('moveCursorBy moves within a paragraph', () => {
  const d = doc('hello');
  expect(moveCursorBy(d, { para: 0, offset: 2 }, 1)).toEqual({ para: 0, offset: 3 });
  expect(moveCursorBy(d, { para: 0, offset: 2 }, -1)).toEqual({ para: 0, offset: 1 });
});

test('moveCursorBy crosses paragraph boundaries', () => {
  const d = doc('hi', 'yo');
  // moving right off the end of paragraph 0 lands at the start of paragraph 1
  expect(moveCursorBy(d, { para: 0, offset: 2 }, 1)).toEqual({ para: 1, offset: 0 });
  // moving left off the start of paragraph 1 lands at the end of paragraph 0
  expect(moveCursorBy(d, { para: 1, offset: 0 }, -1)).toEqual({ para: 0, offset: 2 });
});

// ── insertText / insertBreak ─────────────────────────────────────────────────

test('insertText inserts at the cursor and advances it', () => {
  const d = doc('hllo');
  const r = insertText(d, { para: 0, offset: 1 }, 'e');
  expect(paraText(r.doc.paragraphs[0])).toBe('hello');
  expect(r.cursor).toEqual({ para: 0, offset: 2 });
});

test('insertText inherits formatting from the preceding span', () => {
  const d = { paragraphs: [{ spans: [{ text: 'foo', bold: true }] }] };
  const r = insertText(d, { para: 0, offset: 3 }, 'bar');
  expect(paraText(r.doc.paragraphs[0])).toBe('foobar');
  expect(r.doc.paragraphs[0].spans[0].bold).toBe(true);
});

test('insertBreak splits a paragraph into two at the cursor', () => {
  const d = doc('helloworld');
  const r = insertBreak(d, { para: 0, offset: 5 });
  expect(r.doc.paragraphs.length).toBe(2);
  expect(paraText(r.doc.paragraphs[0])).toBe('hello');
  expect(paraText(r.doc.paragraphs[1])).toBe('world');
  expect(r.cursor).toEqual({ para: 1, offset: 0 });
});

// ── deleteChar ────────────────────────────────────────────────────────────────

test('deleteChar backward removes the preceding character', () => {
  const d = doc('hello');
  const r = deleteChar(d, { para: 0, offset: 3 }, true);
  expect(paraText(r.doc.paragraphs[0])).toBe('helo');
  expect(r.cursor).toEqual({ para: 0, offset: 2 });
});

test('deleteChar forward removes the following character', () => {
  const d = doc('hello');
  const r = deleteChar(d, { para: 0, offset: 2 }, false);
  expect(paraText(r.doc.paragraphs[0])).toBe('helo');
  expect(r.cursor).toEqual({ para: 0, offset: 2 });
});

test('deleteChar backward at start of paragraph merges with previous paragraph', () => {
  const d = doc('foo', 'bar');
  const r = deleteChar(d, { para: 1, offset: 0 }, true);
  expect(r.doc.paragraphs.length).toBe(1);
  expect(paraText(r.doc.paragraphs[0])).toBe('foobar');
  expect(r.cursor).toEqual({ para: 0, offset: 3 });
});

test('deleteChar backward at the very start of the document is a no-op', () => {
  const d = doc('foo');
  const r = deleteChar(d, { para: 0, offset: 0 }, true);
  expect(paraText(r.doc.paragraphs[0])).toBe('foo');
  expect(r.cursor).toEqual({ para: 0, offset: 0 });
});

test('deleteChar forward at end of last paragraph is a no-op', () => {
  const d = doc('foo');
  const r = deleteChar(d, { para: 0, offset: 3 }, false);
  expect(paraText(r.doc.paragraphs[0])).toBe('foo');
});

// ── deleteSelection ───────────────────────────────────────────────────────────

test('deleteSelection removes text within a single paragraph', () => {
  const d = doc('hello world');
  const r = deleteSelection(d, { anchor: { para: 0, offset: 5 }, focus: { para: 0, offset: 11 } });
  expect(paraText(r.doc.paragraphs[0])).toBe('hello');
  expect(r.cursor).toEqual({ para: 0, offset: 5 });
});

test('deleteSelection merges across paragraphs and keeps the remainder', () => {
  const d = doc('hello', 'world');
  const r = deleteSelection(d, { anchor: { para: 0, offset: 2 }, focus: { para: 1, offset: 3 } });
  expect(r.doc.paragraphs.length).toBe(1);
  expect(paraText(r.doc.paragraphs[0])).toBe('held');
  expect(r.cursor).toEqual({ para: 0, offset: 2 });
});

test('deleteSelection handles a reversed selection (focus before anchor)', () => {
  const d = doc('hello world');
  const r = deleteSelection(d, { anchor: { para: 0, offset: 11 }, focus: { para: 0, offset: 5 } });
  expect(paraText(r.doc.paragraphs[0])).toBe('hello');
});

// ── applyFormat / selectionHasFormat / selectedText ──────────────────────────

test('applyFormat bolds only the selected range', () => {
  const d = doc('hello world');
  const sel = { anchor: { para: 0, offset: 0 }, focus: { para: 0, offset: 5 } };
  const result = applyFormat(d, sel, 'bold', true);
  expect(selectedText(result, sel)).toBe('hello');
  expect(selectionHasFormat(result, sel, 'bold')).toBe(true);
  // the untouched remainder should not be bold
  const restSel = { anchor: { para: 0, offset: 5 }, focus: { para: 0, offset: 11 } };
  expect(selectionHasFormat(result, restSel, 'bold')).toBe(false);
});

test('selectionHasFormat is false for a collapsed (empty) selection', () => {
  const d = doc('hello');
  const collapsed = { anchor: { para: 0, offset: 2 }, focus: { para: 0, offset: 2 } };
  expect(selectionHasFormat(d, collapsed, 'bold')).toBe(false);
});

test('selectedText spans multiple paragraphs with newline separators', () => {
  const d = doc('foo', 'bar', 'baz');
  const sel = { anchor: { para: 0, offset: 1 }, focus: { para: 2, offset: 2 } };
  expect(selectedText(d, sel)).toBe('oo\nbar\nba');
});

// ── Serialization ─────────────────────────────────────────────────────────────

test('docToPlainText / docFromPlainText round-trip', () => {
  const text = 'line one\nline two\nline three';
  const d = docFromPlainText(text);
  expect(d.paragraphs.length).toBe(3);
  expect(docToPlainText(d)).toBe(text);
});

test('emptyDoc has a single empty paragraph', () => {
  const d = emptyDoc();
  expect(d.paragraphs.length).toBe(1);
  expect(paraText(d.paragraphs[0])).toBe('');
});
