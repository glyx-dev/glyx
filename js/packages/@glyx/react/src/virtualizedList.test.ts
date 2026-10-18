import { test, expect, afterEach } from 'bun:test';
import React from 'react';
import { render, act, getNodeTree, mockBinding, installStubs } from '@glyx-dev/testing';
import { VirtualizedList, Text } from './index.js';
import { dispatchEvents } from './events.js';

function feed(events: any[]) {
  const prev = (globalThis as any).__glyx_pollEvents;
  (globalThis as any).__glyx_pollEvents = () => events;
  try { dispatchEvents(); } finally { (globalThis as any).__glyx_pollEvents = prev; }
}
const listId = () => [...getNodeTree()].find(([, n]: any) => n.props && n.props.style && n.props.style.scrollContentH !== undefined)![0] as number;
const scrollTo = (y: number) => act(() => feed([{ type: 'scrollbarDrag', nodeId: listId(), scrollY: y }]));
const shown = () => [...getNodeTree().values()].map((n: any) => n.props && n.props.text).filter((t: any) => typeof t === 'string');

afterEach(() => installStubs());

// 1000 rows of 30 px in a 300 px list, overscan 5: rows 0 to 14 at the top. At scroll y the window is rows
// max(0, floor(y/30) - 5) up to ceil((y + 300)/30) + 5 (exclusive).
const data = Array.from({ length: 1000 }, (_, i) => ({ id: i }));

function mockLayout() {
  mockBinding('__glyx_getLayout', () => ({ x: 0, y: 0, width: 200, height: 300, boxX: 0, boxY: 0, boxWidth: 200, boxHeight: 300 }));
}
const list = (renderItem: any) =>
  React.createElement(VirtualizedList, { data, renderItem, keyExtractor: (r: any) => String(r.id), itemHeight: 30, height: 300, width: 200 });

test('a scroll step builds only the rows that enter the window', async () => {
  const built: number[] = [];
  const renderItem = ({ item, index }: any) => { built.push(index); return React.createElement(Text, null, 'row ' + item.id); };
  mockLayout();
  await render(list(renderItem));
  await act(() => {});
  expect(built.length).toBe(15);                     // rows 0 to 14
  built.length = 0;

  await scrollTo(10);                                // the window grows by one row: only row 15 is built
  expect(built).toEqual([15]);
  built.length = 0;

  await scrollTo(30);                                // the same window: nothing to build
  expect(built).toEqual([]);

  await scrollTo(60);                                // one more row enters
  expect(built).toEqual([16]);
  expect(shown()).toContain('row 16');

  built.length = 0;
  await scrollTo(30 * 21);                           // a long jump: window 16 to 35, of which only 16 was already built
  expect(built).toEqual(Array.from({ length: 19 }, (_, k) => 17 + k));
  expect(shown()).not.toContain('row 0');
});

test('a new renderItem function rebuilds every visible row, so it can pick up what it closes over', async () => {
  const built: number[] = [];
  let setLabel: (l: string) => void = () => {};
  function Wrapper() {
    const [label, set] = React.useState('a');
    setLabel = set;
    // A new function each render, as an inline arrow would be.
    return list(({ item, index }: any) => { built.push(index); return React.createElement(Text, null, `${label}${item.id}`); });
  }
  mockLayout();
  await render(React.createElement(Wrapper));
  await act(() => {});
  expect(shown()).toContain('a0');
  built.length = 0;

  await act(() => setLabel('b'));
  expect(built.length).toBe(15);
  expect(shown()).toContain('b0');
  expect(shown()).not.toContain('a0');
});
