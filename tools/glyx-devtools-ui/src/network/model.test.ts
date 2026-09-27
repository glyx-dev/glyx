import { test, expect } from 'bun:test';
import { formatMs, formatSize, isError, matches, merge, prettyBody, splitUrl, statusLabel, waterfall, KINDS, type Kind, type Summary } from './model';

const s = (o: Partial<Summary>): Summary => ({
  key: '1:1', windowId: 1, seq: 1, kind: 'fetch', method: 'GET', url: 'https://api.example.com/v1/items?page=2',
  state: 'pending', start: 1000, end: null, duration: null, status: null, statusText: null, error: null,
  requestSize: 0, responseSize: 0, messages: 0, messageBytes: 0, contentType: null, ...o,
});

test('updates replace older versions of a request and keep start order', () => {
  let list = merge([], [s({ key: 'a', start: 2 }), s({ key: 'b', start: 1 })]);
  expect(list.map((r) => r.key)).toEqual(['b', 'a']);
  list = merge(list, [s({ key: 'a', start: 2, seq: 5, state: 'done', status: 200 })]);
  expect(list.find((r) => r.key === 'a')!.status).toBe(200);
  // A stale update is ignored.
  list = merge(list, [s({ key: 'a', start: 2, seq: 3, state: 'pending' })]);
  expect(list.find((r) => r.key === 'a')!.state).toBe('done');
  expect(list).toHaveLength(2);
});

test('filters by kind, errors and text', () => {
  const all = new Set<Kind>(KINDS);
  expect(matches(s({}), all, 'items', false)).toBe(true);
  expect(matches(s({}), all, 'nope', false)).toBe(false);
  expect(matches(s({}), new Set<Kind>(['websocket']), '', false)).toBe(false);
  expect(matches(s({ status: 404, state: 'done' }), all, '', true)).toBe(true);
  expect(matches(s({ status: 200, state: 'done' }), all, '', true)).toBe(false);
  expect(isError(s({ state: 'failed' }))).toBe(true);
});

test('labels and formatting', () => {
  expect(statusLabel(s({ state: 'done', status: 201 }))).toBe('201');
  expect(statusLabel(s({ kind: 'websocket', state: 'open' }))).toBe('Open');
  expect(statusLabel(s({ kind: 'command', state: 'done', statusText: 'Returned' }))).toBe('Returned');
  expect(splitUrl('https://api.example.com/v1/items?page=2')).toEqual({ name: 'items?page=2', host: 'api.example.com' });
  expect(splitUrl('greet')).toEqual({ name: 'greet', host: '' });
  expect([formatSize(12), formatSize(2048), formatMs(45), formatMs(1500)]).toEqual(['12 B', '2.0 KB', '45 ms', '1.50 s']);
  expect(prettyBody('{"a":1}').text).toBe('{\n  "a": 1\n}');
  expect(prettyBody('<p>x</p>').json).toBe(false);
});

test('waterfall bars sit inside the span', () => {
  expect(waterfall(s({ start: 1500, end: 2000 }), 1000, 3000, 3000)).toEqual({ left: 0.25, width: 0.25 });
  // Still running: runs to now.
  expect(waterfall(s({ start: 2000 }), 1000, 3000, 3000).width).toBe(0.5);
});
