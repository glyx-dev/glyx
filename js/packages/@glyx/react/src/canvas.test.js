import { test, expect } from 'bun:test';
import { GlyxCanvasContext } from './canvas.js';

// No native binary buffers under bun: the context uses its JSON command list.
const ctx = () => new GlyxCanvasContext(1);

test('a gradient fillStyle turns fill() and fillRect() into fillPathGradient', () => {
  const c = ctx();
  const g = c.createLinearGradient(0, 0, 0, 100);
  g.addColorStop(1, [0, 0, 255, 0]);
  g.addColorStop(0, '#ff0000');
  c.fillStyle = g;
  c.fillRect(10, 20, 30, 40);
  const cmd = c._cmds[0];
  expect(cmd.type).toBe('fillPathGradient');
  expect(cmd.points).toEqual([10, 20, 40, 20, 40, 60, 10, 60]);
  expect([cmd.x0, cmd.y0, cmd.x1, cmd.y1]).toEqual([0, 0, 0, 100]);
  expect(cmd.stops).toEqual([[0, [255, 0, 0, 255]], [1, [0, 0, 255, 0]]]); // sorted by offset
});

test('textAlign / textBaseline shift fillText by the measured size; fontWeight marks bold', () => {
  const c = ctx();
  const m = c.measureText('Hello', 10);
  c.textAlign = 'center'; c.textBaseline = 'middle'; c.fontWeight = 'bold';
  c.fillText('Hello', 100, 50, 10);
  const cmd = c._cmds[0];
  expect(cmd.x).toBeCloseTo(100 - m.width / 2);
  expect(cmd.y).toBeCloseTo(50 - m.height / 2);
  expect(cmd.bold).toBe(true);

  c.textAlign = 'right'; c.textBaseline = 'top'; c.fontWeight = 'normal';
  c.fillText('Hello', 100, 50, 10);
  expect(c._cmds[1].x).toBeCloseTo(100 - m.width);
  expect(c._cmds[1].y).toBe(50);
  expect(c._cmds[1].bold).toBe(false);
});

test('pushClip / popClip are recorded in order', () => {
  const c = ctx();
  c.pushClip(1, 2, 3, 4);
  c.fillCircle(0, 0, 1);
  c.popClip();
  expect(c._cmds.map((x) => x.type)).toEqual(['pushClip', 'fillCircle', 'popClip']);
});

test('arc() uses more segments for a wider sweep by default, or exactly `segments` when given', () => {
  const count = (a1, segments) => {
    const c = ctx();
    c.beginPath();
    c.arc(0, 0, 50, 0, a1, false, segments);
    return c._path.length / 2;
  };
  // Default: the wider arc needs more points.
  expect(count(Math.PI * 1.5)).toBeGreaterThan(count(Math.PI * 0.2));
  // Fixed: one more point than segments, whatever the sweep.
  expect(count(Math.PI * 1.5, 40)).toBe(41);
  expect(count(Math.PI * 0.2, 40)).toBe(41);
  expect(count(0.001, 40)).toBe(41);
});

test('bezierCurveTo() splits into 20 segments by default, or exactly `segments` when given', () => {
  const count = (segments) => {
    const c = ctx();
    c.beginPath();
    c.moveTo(0, 0);
    const before = c._path.length / 2;
    c.bezierCurveTo(10, 0, 20, 30, 30, 30, segments);
    return c._path.length / 2 - before;
  };
  expect(count()).toBe(20);       // unchanged for every existing caller
  expect(count(6)).toBe(6);
  expect(count(4.2)).toBe(5);     // rounded up, never fewer than asked
});
