import { test, expect } from 'bun:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import {
  Draggable, DropZone, SortableList, Board, insertionIndex, insertionIndexLazy, dropIndex, moveItem,
} from './index.js';

test('Draggable renders its children', () => {
  const html = renderToStaticMarkup(
    React.createElement(Draggable, { data: { id: 1 }, type: 'card' },
      React.createElement('text', null, 'DRAG-ME'))
  );
  expect(html).toContain('DRAG-ME');
});

test('DropZone renders its children', () => {
  const html = renderToStaticMarkup(
    React.createElement(DropZone, { onDrop: () => {}, accepts: 'card' },
      React.createElement('text', null, 'DROP-HERE'))
  );
  expect(html).toContain('DROP-HERE');
});

// ── insertion geometry ───────────────────────────────────────────────────────

const vertical = [
  { boxX: 10, boxY: 0, boxWidth: 100, boxHeight: 40 },
  { boxX: 10, boxY: 48, boxWidth: 100, boxHeight: 40 },
  { boxX: 10, boxY: 96, boxWidth: 100, boxHeight: 40 },
];

test('insertionIndex finds the gap above, between and below vertical items', () => {
  expect(insertionIndex(vertical, 50, -20)).toBe(0);
  expect(insertionIndex(vertical, 50, 20)).toBe(1);
  expect(insertionIndex(vertical, 50, 44)).toBe(1);
  expect(insertionIndex(vertical, 50, 90)).toBe(2);
  expect(insertionIndex(vertical, 50, 500)).toBe(3);
  expect(insertionIndex([], 50, 500)).toBe(0);
});

test('insertionIndex reads horizontal lists left to right', () => {
  const horizontal = [
    { boxX: 0, boxY: 10, boxWidth: 40, boxHeight: 30 },
    { boxX: 48, boxY: 10, boxWidth: 40, boxHeight: 30 },
    { boxX: 96, boxY: 10, boxWidth: 40, boxHeight: 30 },
  ];
  expect(insertionIndex(horizontal, -10, 20, 'horizontal')).toBe(0);
  expect(insertionIndex(horizontal, 20, 20, 'horizontal')).toBe(1);
  expect(insertionIndex(horizontal, 90, 20, 'horizontal')).toBe(2);
  expect(insertionIndex(horizontal, 1000, 20, 'horizontal')).toBe(3);
});

test('dropIndex converts an insertion boundary into the final index', () => {
  // [A,B,C] with A dragged: boundaries 0 and 1 both leave it first.
  expect(dropIndex(0, 0, 3)).toBe(0);
  expect(dropIndex(0, 1, 3)).toBe(0);
  expect(dropIndex(0, 2, 3)).toBe(1);
  expect(dropIndex(0, 3, 3)).toBe(2);
  // C dragged: boundary 0 is the front, boundaries 2 and 3 are its old place.
  expect(dropIndex(2, 0, 3)).toBe(0);
  expect(dropIndex(2, 1, 3)).toBe(1);
  expect(dropIndex(2, 2, 3)).toBe(2);
  expect(dropIndex(2, 3, 3)).toBe(2);
});

test('moveItem reorders a copy and clamps the target', () => {
  const items = ['a', 'b', 'c', 'd'];
  expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  expect(moveItem(items, 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  expect(moveItem(items, 1, 1)).toEqual(items);
  expect(moveItem(items, 1, 99)).toEqual(['a', 'c', 'd', 'b']);
  expect(items).toEqual(['a', 'b', 'c', 'd']); // unchanged
});

// ── component shapes ─────────────────────────────────────────────────────────

test('SortableList renders every item and passes its index to renderItem', () => {
  const items = [{ id: 'a' }, { id: 'b' }];
  const html = renderToStaticMarkup(
    React.createElement(SortableList, {
      items,
      getKey: (item: any) => item.id,
      renderItem: (item: any, index: number) =>
        React.createElement('text', null, `${item.id}-${index}`),
    })
  );
  expect(html).toContain('a-0');
  expect(html).toContain('b-1');
});

test('SortableList shows its empty state', () => {
  const html = renderToStaticMarkup(
    React.createElement(SortableList, {
      items: [] as any[],
      getKey: (_item: any, i: number) => i,
      renderItem: () => null,
      empty: React.createElement('text', null, 'NOTHING-HERE'),
    })
  );
  expect(html).toContain('NOTHING-HERE');
});

test('Board renders column titles, counts and cards', () => {
  const columns = [
    { id: 'todo', title: 'To do', items: [{ id: 1, title: 'Write tests' }] },
    { id: 'done', title: 'Done', items: [] as any[] },
  ];
  const html = renderToStaticMarkup(
    React.createElement(Board, {
      columns,
      getKey: (item: any) => item.id,
      renderCard: (item: any) => React.createElement('text', null, item.title),
      renderEmpty: () => React.createElement('text', null, 'EMPTY-COLUMN'),
      scrollable: false,
    })
  );
  expect(html).toContain('To do');
  expect(html).toContain('Done');
  expect(html).toContain('Write tests');
  expect(html).toContain('EMPTY-COLUMN');
});

test('insertionIndexLazy agrees with insertionIndex and asks for only a few rectangles', () => {
  const rects = Array.from({ length: 200 }, (_, i) => ({ boxX: 0, boxY: i * 44, boxWidth: 100, boxHeight: 40 }));
  for (const y of [-10, 0, 19, 21, 43, 500, 4400, 8799, 9000]) {
    let asked = 0;
    const lazy = insertionIndexLazy(rects.length, (i) => { asked++; return rects[i]; }, 50, y);
    expect(lazy).toBe(insertionIndex(rects, 50, y));
    expect(asked).toBeLessThanOrEqual(9);          // about log2(200), not 200
  }
  // an item that is not on screen: the answer is still the one the plain scan gives
  const gappy = (i: number) => (i % 7 === 3 ? null : rects[i]);
  expect(insertionIndexLazy(rects.length, gappy, 50, 1000)).toBe(insertionIndex(rects.filter((_, i) => i % 7 !== 3), 50, 1000));
  expect(insertionIndexLazy(0, () => null, 0, 0)).toBe(0);
  expect(insertionIndexLazy(3, (i) => ({ boxX: i * 110, boxY: 0, boxWidth: 100, boxHeight: 10 }), 120, 0, 'horizontal')).toBe(
    insertionIndex([0, 1, 2].map((i) => ({ boxX: i * 110, boxY: 0, boxWidth: 100, boxHeight: 10 })), 120, 0, 'horizontal'));
});
