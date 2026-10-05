import { test, expect } from 'bun:test';
import { mergeRuns, easingPoints, easingLabel, LINGER_MS, type Run, type Lane } from './model';

const run = (nodeId: number, extra: Partial<Run> = {}): Run => ({
  nodeId, kind: 'transition', durationMs: 600, iterations: 1, elapsedMs: 100, progress: 0.2, easing: 'Linear', ...extra,
});

test('lanes follow the list: update, end, linger, drop', () => {
  let lanes: Lane[] = mergeRuns([], [run(1), run(2)], 0);
  expect(lanes.map((l) => l.key)).toEqual(['transition:1', 'transition:2']);
  lanes = mergeRuns(lanes, [run(1, { progress: 0.8 })], 100);
  expect(lanes.find((l) => l.nodeId === 1)!.progress).toBe(0.8);
  const ended = lanes.find((l) => l.nodeId === 2)!;
  expect(ended.endedAt).toBe(100);
  expect(ended.progress).toBe(1);
  lanes = mergeRuns(lanes, [run(1)], 100 + LINGER_MS - 1);
  expect(lanes).toHaveLength(2);
  lanes = mergeRuns(lanes, [run(1)], 100 + LINGER_MS + 1);
  expect(lanes.map((l) => l.nodeId)).toEqual([1]);
});

test('a restarted run on the same element keeps its lane', () => {
  let lanes = mergeRuns([], [run(3)], 0);
  lanes = mergeRuns(lanes, [run(3, { elapsedMs: 5 })], 50);
  expect(lanes).toHaveLength(1);
  expect(lanes[0].endedAt).toBeUndefined();
});

test('easing curves and labels', () => {
  expect(easingPoints('Linear', 4)).toEqual([[0, 0], [0.25, 0.25], [0.5, 0.5], [0.75, 0.75], [1, 1]]);
  const out = easingPoints('EaseOutCubic', 2);
  expect(out[1][1]).toBeCloseTo(0.875);
  const back = easingPoints('Bezier(0.34, 1.56, 0.64, 1.0)', 10);
  expect(Math.max(...back.map(([, y]) => y))).toBeGreaterThan(1); // overshoot
  expect(easingLabel('Bezier(0.34, 1.56, 0.64, 1.0)')).toBe('cubic-bezier(0.34, 1.56, 0.64, 1)');
  expect(easingLabel('Linear')).toBe('linear');
  expect(easingLabel('EaseOutCubic')).toBe('ease-out');
});
