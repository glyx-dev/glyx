import { test, expect, afterEach } from 'bun:test';
import React from 'react';
import { render, act, getNodeTree, mockBinding, installStubs } from '@glyx-dev/testing';
import { ScrollView, Text } from './index.js';
import { dispatchEvents } from './events.js';

// What the native side measures for the scroll view: 500 x 900 of content in a 200 x 300 viewport.
const LAYOUT = { x: 0, y: 0, width: 200, height: 300, boxX: 0, boxY: 0, boxWidth: 200, boxHeight: 300, contentWidth: 500, contentHeight: 900 };

// Feed native events through the real dispatcher, as the runtime would.
function feed(events: any[]) {
  const prev = (globalThis as any).__glyx_pollEvents;
  (globalThis as any).__glyx_pollEvents = () => events;
  try { dispatchEvents(); } finally { (globalThis as any).__glyx_pollEvents = prev; }
}

/** The ScrollView's own host node: the clipping one. The test host keeps what React was given, so the
 * native props are in `style`. */
function scroller() {
  const entry = [...getNodeTree()].find(([, n]: any) => n.props && n.props.style && n.props.style.clip === true);
  if (!entry) throw new Error('no clipping node rendered');
  return { id: entry[0] as number, props: () => (getNodeTree().get(entry[0] as number) as any).props.style };
}

async function mount(props: Record<string, unknown>) {
  mockBinding('__glyx_getLayout', () => LAYOUT);
  await render(React.createElement(ScrollView, props, React.createElement(Text, null, 'content')));
  await act(() => {});
  return scroller();
}

afterEach(() => installStubs());

test('a vertical ScrollView has no horizontal offset and ignores horizontal events', async () => {
  const s = await mount({});
  expect(s.props().scrollOffsetY).toBe(0);
  expect(s.props().scrollOffsetX).toBeUndefined();
  await act(() => feed([{ type: 'scrollbarDragX', nodeId: s.id, scrollX: 80 }]));
  expect(s.props().scrollOffsetX).toBeUndefined();
  await act(() => feed([{ type: 'scrollbarDrag', nodeId: s.id, scrollY: 1000 }]));
  expect(s.props().scrollOffsetY).toBe(600);          // 900 of content in 300: the most it can scroll
});

test('horizontal scrolls on x only, clamped to the content width', async () => {
  const s = await mount({ horizontal: true });
  expect(s.props().scrollOffsetX).toBe(0);
  expect(s.props().scrollOffsetY).toBeUndefined();
  expect(s.props().flexDirection).toBe('row');
  await act(() => feed([{ type: 'scrollbarDragX', nodeId: s.id, scrollX: 150 }]));
  expect(s.props().scrollOffsetX).toBe(150);
  await act(() => feed([{ type: 'scrollIntoViewX', nodeId: s.id, scrollX: 9999 }]));
  expect(s.props().scrollOffsetX).toBe(300);          // 500 of content in 200
  await act(() => feed([{ type: 'scrollbarDrag', nodeId: s.id, scrollY: 100 }]));
  expect(s.props().scrollOffsetY).toBeUndefined();    // vertical events do nothing here
});

test('horizontal keeps its content at natural width, in a wrapper that does not shrink', async () => {
  await mount({ horizontal: true });
  const wrapper = [...getNodeTree().values()].find((n: any) => n.props && n.props.style && n.props.style.flexShrink === 0 && n.props.style.flexDirection === 'row');
  expect(wrapper).toBeDefined();
});

test('both scrolls on each axis, clamped separately', async () => {
  const s = await mount({ both: true });
  expect(s.props().scrollOffsetX).toBe(0);
  expect(s.props().scrollOffsetY).toBe(0);
  await act(() => feed([{ type: 'scrollbarDragX', nodeId: s.id, scrollX: 120 }, { type: 'scrollbarDrag', nodeId: s.id, scrollY: 450 }]));
  expect(s.props().scrollOffsetX).toBe(120);
  expect(s.props().scrollOffsetY).toBe(450);
  await act(() => feed([{ type: 'scrollbarDragX', nodeId: s.id, scrollX: -50 }, { type: 'scrollbarDrag', nodeId: s.id, scrollY: 5000 }]));
  expect(s.props().scrollOffsetX).toBe(0);
  expect(s.props().scrollOffsetY).toBe(600);
});

test('showsScrollIndicator is React Native\'s name for showScrollbar, and showScrollbar wins', async () => {
  expect((await mount({ showsScrollIndicator: false })).props().showScrollbar).toBe(false);
  expect((await mount({ showsScrollIndicator: false, showScrollbar: true })).props().showScrollbar).toBe(true);
  expect((await mount({})).props().showScrollbar).toBe(true);
});
