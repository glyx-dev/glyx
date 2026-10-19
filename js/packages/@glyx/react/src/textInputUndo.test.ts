import { test, expect, afterEach } from 'bun:test';
import React from 'react';
import { render, act, getNodeTree } from '@glyx-dev/testing';
import { dispatchEvents, setFocus } from './events.js';
import { TextInput } from './controls.js';

// Feed events through the real dispatcher, as the runtime does each frame.
function feed(events: any[]) {
  const prev = (globalThis as any).__glyx_pollEvents;
  (globalThis as any).__glyx_pollEvents = () => events;
  try { dispatchEvents(); } finally { (globalThis as any).__glyx_pollEvents = prev; }
}
const press = (key: string, text?: string) => [
  { type: 'keyInput', key, text, pressed: true },
  { type: 'keyInput', key, pressed: false },
];
const ctrl = (key: string, shift = false) => [
  { type: 'keyInput', key: 'ControlLeft', pressed: true },
  ...(shift ? [{ type: 'keyInput', key: 'ShiftLeft', pressed: true }] : []),
  ...press(key),
  ...(shift ? [{ type: 'keyInput', key: 'ShiftLeft', pressed: false }] : []),
  { type: 'keyInput', key: 'ControlLeft', pressed: false },
];
const textboxId = () => [...getNodeTree()].find(([, n]: any) => n.props?.role === 'textbox')![0];

let current: any = null;
let latest = '';
afterEach(async () => {
  if (current) await act(() => current.unmount());
  current = null;
});

// A controlled field, as apps write it: the value lives in state.
function Field({ props = {}, initial = '' }: { props?: any; initial?: string }) {
  const [v, setV] = React.useState(initial);
  latest = v;
  (globalThis as any).__setField = setV;
  return React.createElement(TextInput, { value: v, onChangeText: setV, multiline: true, ...props });
}
async function mount(props: any = {}, initial = '') {
  latest = initial;
  current = await render(React.createElement(Field, { props, initial }));
  await act(() => setFocus(textboxId()));
}
const type = async (s: string) => { for (const ch of s) await act(() => feed(press('Key' + ch.toUpperCase(), ch))); };
const key = async (k: string) => act(() => feed(press(k)));
const chord = async (k: string, shift = false) => act(() => feed(ctrl(k, shift)));

test('Ctrl+Z undoes a run of typing, Ctrl+Y and Ctrl+Shift+Z redo it', async () => {
  await mount();
  await type('hello');
  expect(latest).toBe('hello');
  await chord('KeyZ');
  expect(latest).toBe('');
  await chord('KeyY');
  expect(latest).toBe('hello');
  await chord('KeyZ');
  expect(latest).toBe('');
  await chord('KeyZ', true);
  expect(latest).toBe('hello');
});

test('moving the caret ends a typing run, so undo takes back only the last one', async () => {
  await mount();
  await type('abc');
  await key('ArrowLeft');
  await type('X');
  expect(latest).toBe('abXc');
  await chord('KeyZ');
  expect(latest).toBe('abc');
  await chord('KeyZ');
  expect(latest).toBe('');
});

test('Backspace runs and Enter are their own steps, and a new edit after an undo clears redo', async () => {
  await mount();
  await type('abcd');
  await key('Backspace');
  await key('Backspace');
  expect(latest).toBe('ab');
  await key('Enter');
  expect(latest).toBe('ab\n');
  await chord('KeyZ');                  // the Enter
  expect(latest).toBe('ab');
  await chord('KeyZ');                  // both Backspaces
  expect(latest).toBe('abcd');
  await type('Z');                      // a new edit
  await chord('KeyY');                  // nothing to redo now
  expect(latest).toBe('abcdZ');
});

test('undo restores the caret, so typing carries on where the undone edit was', async () => {
  await mount({}, 'hello world');
  // focus puts the caret at the end; select the word "world" with Home then shift+arrows is long, so use select all and replace
  await chord('KeyA');
  await type('Q');
  expect(latest).toBe('Q');
  await chord('KeyZ');
  expect(latest).toBe('hello world');
  await type('!');                      // the selection (all) came back: typing replaces it
  expect(latest).toBe('!');
});

test('setting the value from outside drops the history', async () => {
  await mount();
  await type('abc');
  await act(() => (globalThis as any).__setField('from the app'));
  await chord('KeyZ');
  expect(latest).toBe('from the app');
});

test('undoHistory={false} turns it off', async () => {
  await mount({ undoHistory: false });
  await type('abc');
  await chord('KeyZ');
  expect(latest).toBe('abc');
});
