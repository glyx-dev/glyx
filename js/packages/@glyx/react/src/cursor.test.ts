import { test, expect, afterEach, afterAll } from 'bun:test';
import React from 'react';
import { render, act, getNodeTree } from '@glyx-dev/testing';
import { dispatchEvents, setNodeCursor, setNodeParent, removeNodeFromTree } from './events.js';
import { View, Pressable } from './core.js';

function feed(events: any[]) {
  const prev = (globalThis as any).__glyx_pollEvents;
  (globalThis as any).__glyx_pollEvents = () => events;
  try { dispatchEvents(); } finally { (globalThis as any).__glyx_pollEvents = prev; }
}
const move = (target: number | undefined) => feed([{ type: 'cursorMoved', x: 5, y: 5, target }]);

const saved = (globalThis as any).__glyx_setCursor;
let calls: string[] = [];
(globalThis as any).__glyx_setCursor = (name: string) => { calls.push(name); };
afterEach(() => { calls = []; });
afterAll(() => { (globalThis as any).__glyx_setCursor = saved; });

test('the cursor of the node under the pointer, or its nearest ancestor with one, is set, and only when it changes', () => {
  setNodeParent(902, 901);                 // 902 is inside 901
  setNodeParent(903, 901);
  setNodeCursor(901, 'grab');
  setNodeCursor(903, 'text');
  move(902);                               // no cursor of its own: the parent's
  expect(calls).toEqual(['grab']);
  move(902);                               // unchanged: nothing is set again
  expect(calls).toEqual(['grab']);
  move(903);
  expect(calls).toEqual(['grab', 'text']);
  move(undefined);                         // over nothing with a cursor: back to default
  expect(calls).toEqual(['grab', 'text', 'default']);
  setNodeCursor(901, undefined); setNodeCursor(903, undefined);
  removeNodeFromTree(902); removeNodeFromTree(903);
});

test('while a button is held the cursor is left as it is', () => {
  setNodeParent(912, 911);
  setNodeCursor(911, 'move');
  move(912);
  expect(calls).toEqual(['move']);
  feed([{ type: 'mouseButton', x: 5, y: 5, button: 0, pressed: true, target: undefined }]);
  move(undefined);                         // dragging off the element: the cursor stays
  expect(calls).toEqual(['move']);
  feed([{ type: 'mouseButton', x: 5, y: 5, button: 0, pressed: false, target: undefined }]);
  move(undefined);
  expect(calls).toEqual(['move', 'default']);
  setNodeCursor(911, undefined); removeNodeFromTree(912);
});

let current: any = null;
afterEach(async () => { if (current) await act(() => current.unmount()); current = null; });

test('a Pressable with onPress asks for the hand, a disabled one and one without onPress do not, and style.cursor is kept', async () => {
  const App = () => React.createElement(View, null,
    React.createElement(Pressable, { onPress: () => {}, ariaLabel: 'a' }),
    React.createElement(Pressable, { onPress: () => {}, disabled: true, ariaLabel: 'b' }),
    React.createElement(Pressable, { ariaLabel: 'c' }),
    React.createElement(Pressable, { onPress: () => {}, style: { cursor: 'crosshair' }, ariaLabel: 'd' }),
  );
  current = await render(React.createElement(App));
  // (The test renderer keeps the props the host config reads the cursor from.)
  const cursorOf = (label: string) => [...getNodeTree()].find(([, n]: any) => n.props?.ariaLabel === label)![1].props.cursor;
  const styleCursor = (label: string) => [...getNodeTree()].find(([, n]: any) => n.props?.ariaLabel === label)![1].props.style?.cursor;
  expect(cursorOf('a')).toBe('pointer');
  expect(cursorOf('b')).toBeUndefined();
  expect(cursorOf('c')).toBeUndefined();
  expect(styleCursor('d')).toBe('crosshair');   // the style's cursor is merged over the default when the node is created
});
