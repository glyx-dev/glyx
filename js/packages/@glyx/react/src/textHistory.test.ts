import { test, expect } from 'bun:test';
import { TextHistory, diff, MAX_STEPS, MAX_BYTES, RUN_GAP_MS } from './textHistory.js';

const at = (n: number) => ({ anchor: n, focus: n });

/** A history whose clock the test moves. */
function make(max = MAX_STEPS, bytes = MAX_BYTES) {
  let t = 1000;
  const h = new TextHistory(max, bytes, () => t);
  return { h, tick: (ms: number) => { t += ms; } };
}

/** Type `s` one character at a time into `text` at its end. */
function typeInto(h: TextHistory, text: string, s: string) {
  for (const ch of s) { const next = text + ch; h.record(text, next, at(text.length), at(next.length), 'type'); text = next; }
  return text;
}

test('diff finds the one change between two texts', () => {
  expect(diff('hello world', 'hello brave world')).toEqual({ pos: 6, removed: '', inserted: 'brave ' });
  expect(diff('hello', 'help')).toEqual({ pos: 3, removed: 'lo', inserted: 'p' });
  expect(diff('abc', 'abc')).toEqual({ pos: 3, removed: '', inserted: '' });
  // not through the middle of an emoji (a surrogate pair)
  expect(diff('a\u{1F600}', 'a\u{1F601}')).toEqual({ pos: 1, removed: '\u{1F600}', inserted: '\u{1F601}' });
});

test('a run of typing is one undo step, and redo puts it back', () => {
  const { h } = make();
  const text = typeInto(h, '', 'hello');
  expect(h.steps).toBe(1);
  const u = h.undo(text)!;
  expect(u.text).toBe('');
  expect(u.selection).toEqual(at(0));
  expect(h.canUndo).toBe(false);
  const r = h.redo(u.text)!;
  expect(r.text).toBe('hello');
  expect(r.selection).toEqual(at(5));
});

test('a pause, a caret move or a different kind of edit starts a new step', () => {
  const { h, tick } = make();
  let text = typeInto(h, '', 'ab');
  tick(RUN_GAP_MS + 1);
  text = typeInto(h, text, 'cd');
  expect(h.steps).toBe(2);
  h.breakRun();                       // the caret was moved
  text = typeInto(h, text, 'ef');
  expect(h.steps).toBe(3);
  // a paste is its own step, and typing after it is another
  h.record(text, text + 'PASTE', at(text.length), at(text.length + 5), 'paste');
  text += 'PASTE';
  text = typeInto(h, text, 'x');
  expect(h.steps).toBe(5);
  expect(h.undo(text)!.text).toBe('abcdefPASTE');
  expect(h.undo('abcdefPASTE')!.text).toBe('abcdef');
});

test('a run of Backspace is one step and a run of Delete is one step, and the selection comes back', () => {
  const { h } = make();
  let text = 'hello';
  for (let i = 5; i > 2; i--) { const next = text.slice(0, i - 1); h.record(text, next, at(i), at(i - 1), 'backspace'); text = next; }
  expect(text).toBe('he');
  expect(h.steps).toBe(1);
  const u = h.undo(text)!;
  expect(u.text).toBe('hello');
  expect(u.selection).toEqual(at(5));

  const d = make();
  let t2 = 'hello';
  for (let i = 0; i < 3; i++) { const next = t2.slice(0, 1) + t2.slice(2); d.h.record(t2, next, at(1), at(1), 'delete'); t2 = next; }
  expect(t2).toBe('ho');
  expect(d.h.steps).toBe(1);
  expect(d.h.undo(t2)!.text).toBe('hello');
});

test('a new edit after an undo drops the redo steps', () => {
  const { h } = make();
  let text = typeInto(h, '', 'abc');
  text = h.undo(text)!.text;
  expect(h.canRedo).toBe(true);
  text = typeInto(h, text, 'z');
  expect(h.canRedo).toBe(false);
  expect(h.redo(text)).toBeNull();
});

test('a change the history did not see (the app set the value) drops the history', () => {
  const { h } = make();
  typeInto(h, '', 'abc');
  h.sync('abc');
  expect(h.canUndo).toBe(true);
  h.sync('something else');
  expect(h.canUndo).toBe(false);
});

test('undo and redo refuse a text they do not fit and drop the history', () => {
  const { h } = make();
  typeInto(h, '', 'abc');
  expect(h.undo('abc')).not.toBeNull();   // fits
  const { h: h2 } = make();
  typeInto(h2, '', 'abc');
  h2.sync('abc');
  expect(h2.undo('xyz')).toBeNull();      // changed under it
  expect(h2.canUndo).toBe(false);
});

test('the history is capped by steps and by bytes, keeping the newest', () => {
  const { h, tick } = make(5, MAX_BYTES);
  let text = '';
  for (let i = 0; i < 20; i++) { tick(RUN_GAP_MS + 1); text = typeInto(h, text, 'x'); }
  expect(h.steps).toBe(5);
  // 300 KB of pastes against a 64 KB cap
  const b = make(MAX_STEPS, 64 * 1024);
  let big = '';
  for (let i = 0; i < 10; i++) { const next = big + 'y'.repeat(30_000); b.h.record(big, next, at(big.length), at(next.length), 'paste'); big = next; }
  expect(b.h.size).toBeLessThanOrEqual(64 * 1024 + 30_000 * 2 + 64);
  expect(b.h.steps).toBeLessThan(10);
  expect(b.h.canUndo).toBe(true);
});

test('typing over a selection is one step that undo reverses with the old text back', () => {
  const { h } = make();
  const before = 'hello world';
  h.record(before, 'hello X', { anchor: 6, focus: 11 }, at(7), 'other');
  const u = h.undo('hello X')!;
  expect(u.text).toBe(before);
  expect(u.selection).toEqual({ anchor: 6, focus: 11 });
});
