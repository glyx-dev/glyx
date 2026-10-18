import { test, expect } from 'bun:test';
import { GlyxCanvasContext } from './canvas.js';

// The colour a fill style becomes: draw a rect and read it back from the JSON command list.
function colorOf(style: any): number[] {
  const c = new GlyxCanvasContext(1);
  c.fillStyle = style;
  c.fillRect(0, 0, 1, 1);
  return c._cmds[0].color;
}

test('hex colours, as before', () => {
  expect(colorOf('#f00')).toEqual([255, 0, 0, 255]);
  expect(colorOf('#10203040')).toEqual([16, 32, 48, 64]);
  expect(colorOf([1, 2, 3, 4])).toEqual([1, 2, 3, 4]);
});

test('rgb() and rgba() colours, with commas, spaces or a slash, and percentages', () => {
  expect(colorOf('rgb(10, 20, 30)')).toEqual([10, 20, 30, 255]);
  expect(colorOf('rgba(10,20,30,0.5)')).toEqual([10, 20, 30, 128]);
  expect(colorOf('rgb(10 20 30 / 0.25)')).toEqual([10, 20, 30, 64]);
  expect(colorOf('rgba(100%, 0%, 50%, 100%)')).toEqual([255, 0, 128, 255]);
  expect(colorOf('rgba(300, -5, 30, 2)')).toEqual([255, 0, 30, 255]);            // clamped
});

test('the common colour names, case-insensitively, and transparent', () => {
  expect(colorOf('red')).toEqual([255, 0, 0, 255]);
  expect(colorOf('  White ')).toEqual([255, 255, 255, 255]);
  expect(colorOf('transparent')).toEqual([0, 0, 0, 0]);
});

test('anything unrecognised is white, as it always was', () => {
  expect(colorOf('not-a-colour')).toEqual([255, 255, 255, 255]);
  expect(colorOf('rgba(oops)')).toEqual([255, 255, 255, 255]);
});
