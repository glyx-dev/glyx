import { test, expect, afterEach } from 'bun:test';
import React from 'react';
import { render, act, getNodeTree, mockBinding, installStubs } from '@glyx-dev/testing';
// Not part of the public API: the test feeds native events the way the runtime does.
import { dispatchEvents } from '../../react/src/events.js';
import { DataTable, visibleColumns } from './index.js';

test('visibleColumns picks the columns that intersect the view plus the overscan', () => {
  const widths = Array.from({ length: 20 }, () => 100);            // columns at x 0..100, 100..200, ...
  // At the left edge, 400 wide, 200 overscan: x -200..600 touches columns 0 to 5.
  expect(visibleColumns(widths, 0, 0, 400, 200)).toEqual({ first: 0, last: 5, before: 0 });
  // Scrolled to 1000: x 800..1600 touches columns 8 to 15; the spacer is everything before column 8.
  expect(visibleColumns(widths, 0, 1000, 400, 200)).toEqual({ first: 8, last: 15, before: 800 });
  // The end of the table.
  expect(visibleColumns(widths, 0, 1600, 400, 200)).toEqual({ first: 14, last: 19, before: 1400 });
});

test('visibleColumns leaves the selection column out of the spacer', () => {
  const widths = [100, 100, 100, 100];
  // A 40px selection column leads: column 0 spans x 40..140, so x 130..230 (no overscan) is columns 0 to 1.
  expect(visibleColumns(widths, 40, 130, 100, 0)).toEqual({ first: 0, last: 1, before: 0 });
  expect(visibleColumns(widths, 40, 300, 50, 0)).toEqual({ first: 2, last: 3, before: 200 });
});

test('visibleColumns copes with no columns and with a view past the content', () => {
  expect(visibleColumns([], 0, 0, 400).last).toBeLessThan(0);
  expect(visibleColumns([100], 0, 5000, 400, 0).last).toBeLessThan(0);
});

// ── the rendered table ─────────────────────────────────────────────────────────

const LAYOUT = { x: 0, y: 0, width: 400, height: 300, boxX: 0, boxY: 0, boxWidth: 400, boxHeight: 300, contentWidth: 2000, contentHeight: 300 };
const columns = Array.from({ length: 20 }, (_, c) => ({ key: 'c' + c, label: 'Col ' + c, width: 100 }));
const rows = [{ id: 0, ...Object.fromEntries(columns.map((c) => [c.key, 'v' + c.key])) }];

function feed(events: any[]) {
  const prev = (globalThis as any).__glyx_pollEvents;
  (globalThis as any).__glyx_pollEvents = () => events;
  try { dispatchEvents(); } finally { (globalThis as any).__glyx_pollEvents = prev; }
}
const texts = () => [...getNodeTree().values()].map((n: any) => n.props && n.props.text).filter((c: any) => typeof c === 'string');
const scrollerId = () => [...getNodeTree()].find(([, n]: any) => n.props && n.props.style && n.props.style.scrollOffsetX !== undefined)![0] as number;

afterEach(() => installStubs());

test('a table wider than its width renders only the columns near the view, and follows the scroll', async () => {
  mockBinding('__glyx_getLayout', () => LAYOUT);
  await render(React.createElement(DataTable, { columns, rows, width: 400, height: 300, rowHeight: 28 }));
  await act(() => {});
  const headers = () => texts().filter((t: string) => /^COL \d+$/.test(t));
  // 400 wide, 200 overscan: columns 0 to 5 of 20.
  expect(headers()).toEqual(['COL 0', 'COL 1', 'COL 2', 'COL 3', 'COL 4', 'COL 5']);

  await act(() => feed([{ type: 'scrollbarDragX', nodeId: scrollerId(), scrollX: 1000 }]));
  expect(headers()).toEqual(['COL 8', 'COL 9', 'COL 10', 'COL 11', 'COL 12', 'COL 13', 'COL 14', 'COL 15']);
  // Cells follow the same window: the one row shows the same columns.
  expect(texts()).toContain('vc10');
  expect(texts()).not.toContain('vc0');
});

test('a table that fits renders every column and does not scroll sideways', async () => {
  mockBinding('__glyx_getLayout', () => LAYOUT);
  const few = columns.slice(0, 3);
  await render(React.createElement(DataTable, { columns: few, rows, width: 400, height: 300, rowHeight: 28 }));
  await act(() => {});
  expect(texts().filter((t: string) => /^COL \d+$/.test(t)).length).toBe(3);
  expect([...getNodeTree().values()].some((n: any) => n.props && n.props.style && n.props.style.scrollOffsetX !== undefined)).toBe(false);
});
