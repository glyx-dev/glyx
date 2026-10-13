import { test, expect } from 'bun:test';
import { textLineLimit } from './core.js';

test('a Text line limit can be a prop, a style, or the web ellipsis style', () => {
  expect(textLineLimit(undefined, undefined)).toBeUndefined();
  expect(textLineLimit(undefined, { color: 'red' })).toBeUndefined();
  expect(textLineLimit(2, undefined)).toBe(2);
  expect(textLineLimit(undefined, { numberOfLines: 1 })).toBe(1);
  expect(textLineLimit(undefined, { whiteSpace: 'nowrap', textOverflow: 'ellipsis' })).toBe(1);
  expect(textLineLimit(undefined, { textOverflow: 'ellipsis' })).toBe(1);
  expect(textLineLimit(undefined, { textOverflow: 'clip' })).toBeUndefined();
  // The prop wins over the style.
  expect(textLineLimit(3, { numberOfLines: 1 })).toBe(3);
});
