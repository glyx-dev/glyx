import { test, expect } from 'bun:test';
import { percentile, summarize, otherTime, cost, toRecording, fromRecording, type Frame } from './model';

const f = (frameTime: number, extra: Partial<Frame> = {}): Frame => ({
  seq: 1, frameTime, jsTime: 1, layoutTime: 1, renderTime: 2, presentTime: 1,
  damagePx: 100, partial: true, animating: 0, nodeCount: 10, heapUsed: 1, ...extra,
});

test('percentiles use nearest rank', () => {
  const v = Array.from({ length: 100 }, (_, i) => i + 1);
  expect(percentile(v, 50)).toBe(50);
  expect(percentile(v, 99)).toBe(99);
  expect(percentile([5], 90)).toBe(5);
  expect(percentile([], 50)).toBe(0);
});

test('summary: fps from gaps (idle left out), budget from each frame\'s own cost', () => {
  const frames = [
    f(10, { workTime: 4 }), f(10, { workTime: 5 }),
    f(20, { workTime: 20, partial: false }),
    f(5000, { workTime: 30, partial: false }),   // after a 5 s pause: slow because of its cost, not the pause
  ];
  const s = summarize(frames, 16.7);
  expect(s.frames).toBe(4);
  expect(s.fps).toBeCloseTo(3000 / 40);           // the 5000 ms gap is idle, not a frame rate
  expect(s.overBudget).toBe(2);
  expect(s.p99).toBe(30);
  expect(s.overBudgetPct).toBe(50);
  expect(s.partialPct).toBe(50);
  expect(s.avg.renderTime).toBe(2);
  expect(summarize([], 16.7).fps).toBe(0);
});

test('cost and "other" time', () => {
  expect(cost(f(5000, { workTime: 7 }))).toBe(7);
  expect(cost(f(12))).toBe(12);                    // old recordings without workTime
  expect(otherTime(f(10, { workTime: 8 }))).toBe(3);
  expect(otherTime(f(10, { workTime: 2 }))).toBe(0);
});

test('recordings round-trip and reject other files', () => {
  const r = toRecording([f(8)], 16.7, 'calculator', 'QuickJS');
  expect(fromRecording(JSON.stringify(r)).frames).toHaveLength(1);
  expect(() => fromRecording('nope')).toThrow('Not a JSON file');
  expect(() => fromRecording('{"format":"x"}')).toThrow('Not a Glyx DevTools performance recording');
});
