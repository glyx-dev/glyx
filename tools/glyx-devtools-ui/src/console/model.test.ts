import { test, expect } from 'bun:test';
import { capped, counts, formatTime, pushHistory, splitFirstLine, summary, visible, type Entry } from './model';

const m = (level: any, text: string, seq = 1): Entry => ({ kind: 'message', key: String(seq), seq, level, text, timestamp: 0 });

test('filters by level and search; REPL lines always shown', () => {
  const entries: Entry[] = [m('log', 'hello', 1), m('error', 'boom', 2), { kind: 'input', key: 'i', text: '1+1', timestamp: 0 }];
  expect(visible(entries, new Set(['error']), '').map((e) => e.key)).toEqual(['2', 'i']);
  expect(visible(entries, new Set(['log', 'error']), 'BOO').map((e) => e.key)).toEqual(['2']);
  expect(counts(entries)).toEqual({ log: 1, warn: 0, error: 1, debug: 0 });
});

test('history skips blanks and repeats, and is capped', () => {
  let h: string[] = [];
  h = pushHistory(h, '1+1'); h = pushHistory(h, '1+1'); h = pushHistory(h, '  ');
  expect(h).toEqual(['1+1']);
  for (let i = 0; i < 5; i++) h = pushHistory(h, `x${i}`, 3);
  expect(h).toEqual(['x2', 'x3', 'x4']);
});

test('formatting helpers', () => {
  expect(formatTime(new Date(2026, 0, 1, 3, 4, 5, 6).getTime())).toBe('03:04:05.006');
  expect(splitFirstLine('Error: x\n  at a\n  at b')).toEqual(['Error: x', '  at a\n  at b']);
  expect(summary({ t: 'array', n: 3 })).toBe('Array(3)');
  expect(summary({ t: 'object', ctor: 'Point', n: 2 })).toBe('Point {…}');
  expect(summary({ t: 'string', v: 'a"b' })).toBe('"a\\"b"');
  expect(capped(Array.from({ length: 10 }, (_, i) => m('log', String(i), i)), 4).map((e) => e.key)).toEqual(['6', '7', '8', '9']);
});
