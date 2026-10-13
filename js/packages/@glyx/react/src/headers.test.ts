import { test, expect } from 'bun:test';
// Importing the full package also proves @glyx-dev/react loads in a plain Bun
// process with only the @glyx-dev/testing stubs installed (no window, no GPU).
import { Headers } from './index.js';

test('Headers get/has are case-insensitive', () => {
  const h = new Headers({ 'Content-Type': 'application/json' });
  expect(h.get('content-type')).toBe('application/json');
  expect(h.has('CONTENT-TYPE')).toBe(true);
  expect(h.get('missing')).toBe(null);
});

test('Headers append accumulates values', () => {
  const h = new Headers();
  h.append('Accept', 'text/html');
  h.append('accept', 'application/json');
  expect(h.get('accept')).toContain('text/html');
  expect(h.get('accept')).toContain('application/json');
});

test('Headers is iterable', () => {
  const h = new Headers({ A: '1', B: '2' });
  const entries = [...h].map(([k]) => k.toLowerCase()).sort();
  expect(entries).toEqual(['a', 'b']);
});
