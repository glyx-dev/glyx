import { test, expect } from 'bun:test';
import { diffSnapshots, formatBytes, formatDelta, pushSample, type Snapshot, type Sample } from './model';

const snap = (byComponent: { component: string; elements: number; instances: number }[]): Snapshot => ({
  timestamp: 0, heapUsed: 0, heapTotal: 0, rss: 0, gpuBuffers: 0, gpuTextures: 0, nodes: 0,
  elements: 0, detached: 0, byType: {}, byComponent,
});

test('bytes and deltas read naturally', () => {
  expect(formatBytes(0)).toBe('0 B');
  expect(formatBytes(512)).toBe('512 B');
  expect(formatBytes(1536)).toBe('1.5 KB');
  expect(formatBytes(48 * 1024 * 1024)).toBe('48.0 MB');
  expect(formatBytes(300 * 1024 * 1024)).toBe('300 MB');
  expect(formatDelta(2048)).toBe('+2.0 KB');
  expect(formatDelta(-3, false)).toBe('−3');
  expect(formatDelta(0)).toBe('±0');
});

test('snapshot diff: growth first, vanished components negative', () => {
  const a = snap([{ component: 'Row', elements: 10, instances: 5 }, { component: 'Toast', elements: 4, instances: 1 }]);
  const b = snap([{ component: 'Row', elements: 30, instances: 15 }, { component: 'App', elements: 2, instances: 1 }]);
  const d = diffSnapshots(a, b);
  expect(d.map((r) => [r.component, r.deltaElements])).toEqual([['Row', 20], ['App', 2], ['Toast', -4]]);
  expect(d[0].deltaInstances).toBe(10);
  // First snapshot: no deltas, sorted by size.
  expect(diffSnapshots(undefined, b).map((r) => [r.component, r.deltaElements])).toEqual([['Row', 0], ['App', 0]]);
});

test('samples are capped', () => {
  let s: Sample[] = [];
  for (let i = 0; i < 5; i++) s = pushSample(s, { timestamp: i, heapUsed: i, heapTotal: 0, rss: 0, gpuBuffers: 0, gpuTextures: 0, nodes: 0 }, 3);
  expect(s.map((x) => x.timestamp)).toEqual([2, 3, 4]);
});
