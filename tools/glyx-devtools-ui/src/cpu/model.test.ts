import { test, expect } from 'bun:test';
import { commitBoxes, componentTotals, flameSpans, frameLocation, functionTotals, type CpuProfile } from './model';

const cf = (functionName: string, url = '', lineNumber = -1) => ({ functionName, url, lineNumber, columnNumber: 0 });
// (root) → (program)
//        → main → work
//               → draw
//        → (idle)
const profile: CpuProfile = {
  nodes: [
    { id: 1, callFrame: cf('(root)'), children: [2, 3, 6] },
    { id: 2, callFrame: cf('(program)') },
    { id: 3, callFrame: cf('main', 'file:///app/dist/app.js', 9), children: [4, 5] },
    { id: 4, callFrame: cf('work', 'file:///app/dist/app.js', 20) },
    { id: 5, callFrame: cf('draw', 'file:///app/dist/app.js', 30) },
    { id: 6, callFrame: cf('(idle)') },
  ],
  startTime: 0, endTime: 6000,
  // 1 ms apart: work, work, draw, idle, program, work
  samples: [4, 4, 5, 6, 2, 4],
  timeDeltas: [0, 1000, 1000, 1000, 1000, 1000],
};

test('flame spans merge consecutive samples and skip idle', () => {
  const { spans, duration } = flameSpans(profile);
  expect(duration).toBe(6);
  const at = (d: number) => spans.filter((s) => s.depth === d).map((s) => [s.name, s.start, s.end]);
  expect(at(0)).toEqual([['main', 0, 3], ['(program)', 4, 5], ['main', 5, 6]]);
  expect(at(1)).toEqual([['work', 0, 2], ['draw', 2, 3], ['work', 5, 6]]);
  expect(spans.find((s) => s.name === 'work')!.location).toBe('app.js:21');
});

test('function totals: self where on top, total anywhere on the stack', () => {
  const t = Object.fromEntries(functionTotals(profile).map((f) => [f.name, [f.self, f.total]]));
  expect(t.work).toEqual([3, 3]);
  expect(t.draw).toEqual([1, 1]);
  expect(t.main).toEqual([0, 4]);
  expect(t['(idle)']).toEqual([1, 1]);
  expect(frameLocation(cf('x'))).toBe('');
});

test('components rank by self time; commit boxes nest under parents', () => {
  const commit = { at: 0, duration: 10, components: [
    { name: 'App', depth: 0, parent: -1, self: 2, total: 10, library: false, mount: false },
    { name: 'List', depth: 1, parent: 0, self: 6, total: 6, library: false, mount: false },
    { name: 'Pressable', depth: 1, parent: 0, self: 2, total: 2, library: true, mount: false },
  ] };
  expect(componentTotals([commit, commit]).map((c) => [c.name, c.renders, c.self])).toEqual([['List', 2, 12], ['App', 2, 4], ['Pressable', 2, 4]]);
  expect(commitBoxes(commit).map((b) => [commit.components[b.i].name, +b.x.toFixed(3), +b.w.toFixed(3)])).toEqual([['App', 0, 1], ['List', 0, 0.6], ['Pressable', 0.6, 0.2]]);
});
