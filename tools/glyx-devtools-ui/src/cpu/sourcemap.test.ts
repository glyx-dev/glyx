import { test, expect } from 'bun:test';
import { decodeMappings, makeMapper, mapProfile, prettySource } from './sourcemap';

// Generated line 0: col 0 → a.js 0:0, col 10 → a.js 2:4. Line 1: col 5 → b.js 7:1.
// "AAAA,UAEI" / "KCKD" per the VLQ spec.
const map = { version: 3, sources: ['../src/a.js', '../node_modules/react/index.js'], mappings: 'AAAA,UAEI;KCKD' };

test('decodes VLQ mappings into segments per line', () => {
  expect(decodeMappings(map.mappings)).toEqual([[[0, 0, 0, 0], [10, 0, 2, 4]], [[5, 1, 7, 3]]]);
});

test('looks up the segment at or before a column', () => {
  const m = makeMapper(map);
  expect(m(0, 3)).toEqual({ source: '../src/a.js', line: 0, col: 0 });
  expect(m(0, 12)).toEqual({ source: '../src/a.js', line: 2, col: 4 });
  expect(m(1, 9)!.source).toBe('../node_modules/react/index.js');
  expect(m(5, 0)).toBe(null);
  expect(prettySource('../node_modules/react/index.js')).toBe('react/index.js');
  expect(prettySource('../src/a.js')).toBe('src/a.js');
});

test('maps only bundle frames in a profile', () => {
  const profile = {
    nodes: [
      { id: 1, callFrame: { functionName: '', url: 'glyx://app/bundle.js', lineNumber: 0, columnNumber: 11 } },
      { id: 2, callFrame: { functionName: 'x', url: '', lineNumber: 0, columnNumber: 11 } },
    ],
    startTime: 0, endTime: 1, samples: [], timeDeltas: [],
  };
  const out = mapProfile(profile, map, 'glyx://app/bundle.js');
  expect(out.nodes[0].callFrame).toMatchObject({ url: 'src/a.js', lineNumber: 2, columnNumber: 4 });
  expect(out.nodes[1].callFrame.url).toBe('');
  expect(mapProfile(profile, null, 'glyx://app/bundle.js')).toBe(profile);
});
