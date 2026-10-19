import { test, expect, afterEach } from 'bun:test';
import React from 'react';
import { render, act, getNodeTree } from '@glyx-dev/testing';
import { dispatchEvents, setFocus } from '../../react/src/events.js';
import { RichTextEditor, docToPlainText, docFromPlainText } from './index.js';
import { DocHistory, MAX_STEPS, RUN_GAP_MS } from './history.js';

// ── The history list ──────────────────────────────────────────────────────

const snap = (n: number) => ({ doc: n, cursor: n, sel: n });

function clocked(max = MAX_STEPS) {
  let t = 1000;
  return { h: new DocHistory<number, number, number>(max, () => t), tick: (ms: number) => { t += ms; } };
}

test('a run of typing is one step, undone and redone as a whole', () => {
  const { h } = clocked();
  h.push(snap(0), 'type'); h.push(snap(1), 'type'); h.push(snap(2), 'type');
  expect(h.steps).toBe(1);
  expect(h.undo(snap(3))).toEqual(snap(0));
  expect(h.canUndo).toBe(false);
  expect(h.redo(snap(0))).toEqual(snap(3));
});

test('a pause, a caret move, another kind of edit or an "other" edit makes a new step', () => {
  const { h, tick } = clocked();
  h.push(snap(0), 'type');
  tick(RUN_GAP_MS + 1);
  h.push(snap(1), 'type');
  expect(h.steps).toBe(2);
  h.breakRun();
  h.push(snap(2), 'type');
  expect(h.steps).toBe(3);
  h.push(snap(3), 'backspace');
  expect(h.steps).toBe(4);
  h.push(snap(4), 'other'); h.push(snap(5), 'other');
  expect(h.steps).toBe(6);
});

test('a new edit drops the redo steps, and the list is capped', () => {
  const { h } = clocked(3);
  for (let i = 0; i < 10; i++) h.push(snap(i), 'other');
  expect(h.steps).toBe(3);
  h.undo(snap(10));
  expect(h.canRedo).toBe(true);
  h.push(snap(11), 'other');
  expect(h.canRedo).toBe(false);
});

// ── In the editor ─────────────────────────────────────────────────────────

function feed(events: any[]) {
  const prev = (globalThis as any).__glyx_pollEvents;
  (globalThis as any).__glyx_pollEvents = () => events;
  try { dispatchEvents(); } finally { (globalThis as any).__glyx_pollEvents = prev; }
}
const press = (key: string, text?: string) => [{ type: 'keyInput', key, text, pressed: true }, { type: 'keyInput', key, pressed: false }];
const chord = (key: string, shift = false) => [
  { type: 'keyInput', key: 'ControlLeft', pressed: true },
  ...(shift ? [{ type: 'keyInput', key: 'ShiftLeft', pressed: true }] : []),
  ...press(key),
  ...(shift ? [{ type: 'keyInput', key: 'ShiftLeft', pressed: false }] : []),
  { type: 'keyInput', key: 'ControlLeft', pressed: false },
];

let current: any = null;
let latest = '';
afterEach(async () => { if (current) await act(() => current.unmount()); current = null; });

async function mount(props: any = {}) {
  latest = '';
  const App = () => {
    const [d, setD] = React.useState(() => docFromPlainText(''));
    latest = docToPlainText(d);
    return React.createElement(RichTextEditor, { value: d, onChange: setD, ...props });
  };
  current = await render(React.createElement(App));
  const id = [...getNodeTree()].find(([, n]: any) => n.props?.pressable)![0];
  await act(() => setFocus(id));
}
const type = async (s: string) => { for (const ch of s) await act(() => feed(press('Key' + ch.toUpperCase(), ch))); };

test('Ctrl+Z undoes a run of typing in the editor, Ctrl+Y and Ctrl+Shift+Z redo it', async () => {
  await mount();
  await type('hello');
  expect(latest).toBe('hello');
  await act(() => feed(chord('KeyZ')));
  expect(latest).toBe('');
  await act(() => feed(chord('KeyY')));
  expect(latest).toBe('hello');
  await act(() => feed(chord('KeyZ')));
  await act(() => feed(chord('KeyZ', true)));
  expect(latest).toBe('hello');
});

test('Enter is its own step, and moving the caret ends a typing run', async () => {
  await mount();
  await type('ab');
  await act(() => feed(press('Enter')));
  await type('cd');
  expect(latest).toBe('ab\ncd');
  await act(() => feed(chord('KeyZ')));
  expect(latest).toBe('ab\n');
  await act(() => feed(chord('KeyZ')));
  expect(latest).toBe('ab');
});

test('undoHistory={false} turns it off', async () => {
  await mount({ undoHistory: false });
  await type('abc');
  await act(() => feed(chord('KeyZ')));
  expect(latest).toBe('abc');
});
