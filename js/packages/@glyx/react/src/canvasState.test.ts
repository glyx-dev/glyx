import { test, expect } from 'bun:test';
import { GlyxCanvasContext } from './canvas.js';

// No native binary buffers under bun: the context uses its JSON command list.
const ctx = () => new GlyxCanvasContext(1);
const types = (c: any) => c._cmds.map((x: any) => x.type);

test('state commands are written lazily, only when they differ, and just before a draw', () => {
  const c = ctx();
  c.translate(10, 20);
  c.globalAlpha = 0.5;
  expect(c._cmds).toEqual([]);                           // nothing yet: no draw
  c.fillRect(0, 0, 5, 5);
  expect(types(c)).toEqual(['transform', 'globalAlpha', 'fillRect']);
  expect(c._cmds[0].m).toEqual([1, 0, 0, 1, 10, 20]);
  expect(c._cmds[1].alpha).toBe(0.5);
  c._cmds.length = 0;
  c.fillRect(1, 1, 5, 5);                                // the same state: only the draw
  expect(types(c)).toEqual(['fillRect']);
  c._cmds.length = 0;
  c.globalAlpha = 1;
  c.fillRect(1, 1, 5, 5);
  expect(types(c)).toEqual(['globalAlpha', 'fillRect']);
});

test('transforms compose in the canvas order: the newest is applied to a point first', () => {
  const c = ctx();
  c.translate(100, 0);
  c.scale(2, 2);                                          // a point (1, 1) -> scale -> (2, 2) -> translate -> (102, 2)
  c.fillRect(0, 0, 1, 1);
  const [a, b, cc, d, e, f] = c._cmds[0].m;
  expect([a * 1 + cc * 1 + e, b * 1 + d * 1 + f]).toEqual([102, 2]);
  c.setTransform(1, 0, 0, 1, 0, 0);
  expect(c.getTransform()).toEqual({ a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
  c.rotate(Math.PI / 2);
  expect(c._m[0]).toBeCloseTo(0); expect(c._m[1]).toBeCloseTo(1); expect(c._m[2]).toBeCloseTo(-1);
  c.resetTransform();
  expect(c._m).toEqual([1, 0, 0, 1, 0, 0]);
});

test('save and restore bring back the styles and the transform, and tell the native side', () => {
  const c = ctx();
  c.fillStyle = '#ff0000'; c.lineWidth = 3; c.translate(5, 5);
  c.fillRect(0, 0, 1, 1);
  c.save();
  c.fillStyle = '#00ff00'; c.lineWidth = 9; c.translate(7, 7); c.globalAlpha = 0.25;
  c.fillRect(0, 0, 1, 1);
  c.restore();
  expect(c.fillStyle).toBe('#ff0000');
  expect(c.lineWidth).toBe(3);
  expect(c.globalAlpha).toBe(1);
  expect(c._m).toEqual([1, 0, 0, 1, 5, 5]);
  c._cmds.length = 0;
  c.fillRect(0, 0, 1, 1);                                 // back to what the native side held at save(): no state to resend
  expect(types(c)).toEqual(['fillRect']);
  c.restore();                                            // an unmatched restore is ignored
  expect(c.fillStyle).toBe('#ff0000');
  expect(types(c)).toEqual(['fillRect']);
});

test('line style, dash pattern and shadow become one command each when they change', () => {
  const c = ctx();
  c.lineCap = 'butt'; c.lineJoin = 'miter'; c.setLineDash([6, 3]); c.lineDashOffset = 2;
  c.shadowColor = '#00000080'; c.shadowBlur = 8; c.shadowOffsetX = 2; c.shadowOffsetY = 3;
  c.strokeLine(0, 0, 10, 10);
  const line = c._cmds.find((x: any) => x.type === 'lineStyle');
  expect(line).toEqual({ type: 'lineStyle', cap: 0, join: 0, miterLimit: 10, dashOffset: 2, dashes: [6, 3] });
  const sh = c._cmds.find((x: any) => x.type === 'shadow');
  expect(sh).toEqual({ type: 'shadow', color: [0, 0, 0, 128], blur: 8, dx: 2, dy: 3 });
  // A shadow with no blur and no offset is off, and a bad dash pattern is ignored.
  c._cmds.length = 0;
  c.shadowBlur = 0; c.shadowOffsetX = 0; c.shadowOffsetY = 0; c.setLineDash([0, 0]);
  c.strokeLine(0, 0, 10, 10);
  expect(c._cmds.find((x: any) => x.type === 'shadow').color).toEqual([0, 0, 0, 0]);
  expect(c._cmds.find((x: any) => x.type === 'lineStyle').dashes).toEqual([]);
});

test('globalCompositeOperation maps to the native blend modes, and unknown ones mean source-over', () => {
  const c = ctx();
  c.globalCompositeOperation = 'multiply';
  c.fillRect(0, 0, 1, 1);
  expect(c._cmds[0]).toEqual({ type: 'blend', mode: 1 });
  c._cmds.length = 0;
  c.globalCompositeOperation = 'destination-out';
  c.fillRect(0, 0, 1, 1);
  expect(c._cmds[0].mode).toBe(8);
  c._cmds.length = 0;
  c.globalCompositeOperation = 'not-a-mode';
  c.fillRect(0, 0, 1, 1);
  expect(c._cmds[0]).toEqual({ type: 'blend', mode: 0 });
});

test('radial and conic gradients, and gradient strokes, go out as brush commands', () => {
  const c = ctx();
  const r = c.createRadialGradient(50, 50, 0, 50, 50, 40);
  r.addColorStop(0, '#ffffff'); r.addColorStop(1, '#000000');
  c.fillStyle = r;
  c.fillRect(10, 10, 80, 80);
  const fill = c._cmds.find((x: any) => x.type === 'fillPathBrush');
  expect(fill.brush.kind).toBe(2);
  expect(fill.brush.p).toEqual([50, 50, 0, 50, 50, 40]);
  expect(fill.brush.stops).toEqual([[0, [255, 255, 255, 255]], [1, [0, 0, 0, 255]]]);
  c._cmds.length = 0;
  const k = c.createConicGradient(0.5, 20, 30);
  k.addColorStop(0, '#ff0000'); k.addColorStop(1, '#0000ff');
  c.strokeStyle = k; c.lineWidth = 4;
  c.strokeRect(0, 0, 10, 10);
  const stroke = c._cmds.find((x: any) => x.type === 'strokePathBrush');
  expect(stroke.brush.kind).toBe(3);
  expect(stroke.brush.p.slice(0, 3)).toEqual([20, 30, 0.5]);
  expect([stroke.lineWidth, stroke.closed]).toEqual([4, true]);
});

test('a path with several sub-paths fills them together (holes) and strokes each', () => {
  const c = ctx();
  c.beginPath();
  c.rect(0, 0, 100, 100);
  c.rect(25, 25, 50, 50);
  c.fillStyle = '#ff0000';
  c.fill('evenodd');
  const cmd = c._cmds.find((x: any) => x.type === 'fillPaths');
  expect(cmd.contours.length).toBe(2);
  expect(cmd.evenOdd).toBe(true);
  expect(cmd.contours[1]).toEqual([25, 25, 75, 25, 75, 75, 25, 75]);
  c._cmds.length = 0;
  c.stroke();
  expect(c._cmds.filter((x: any) => x.type === 'strokePath').length).toBe(2);
  expect(c._cmds.every((x: any) => x.type !== 'strokePath' || x.closed)).toBe(true);
  // A plain single path still uses the original solid command.
  c._cmds.length = 0;
  c.beginPath(); c.moveTo(0, 0); c.lineTo(10, 0); c.lineTo(5, 8);
  c.fill();
  expect(types(c)).toContain('fillPath');
});

test('moveTo starts a new sub-path instead of joining a line to the last one', () => {
  const c = ctx();
  c.beginPath();
  c.moveTo(0, 0); c.lineTo(10, 0);
  c.moveTo(50, 50); c.lineTo(60, 50);
  expect(c._subs).toEqual([[0, 0, 10, 0], [50, 50, 60, 50]]);
  c.beginPath();
  expect(c._subs).toEqual([[]]);
});

test('the path helpers: roundRect, ellipse and arcTo add points that stay near their shapes', () => {
  const c = ctx();
  c.beginPath(); c.roundRect(0, 0, 100, 50, 10);
  const pts = c._subs[0];
  for (let i = 0; i < pts.length; i += 2) {
    expect(pts[i]).toBeGreaterThanOrEqual(-1e-6); expect(pts[i]).toBeLessThanOrEqual(100 + 1e-6);
    expect(pts[i + 1]).toBeGreaterThanOrEqual(-1e-6); expect(pts[i + 1]).toBeLessThanOrEqual(50 + 1e-6);
  }
  expect(c._closed[0]).toBe(true);
  c.beginPath(); c.ellipse(0, 0, 20, 10, 0, 0, Math.PI * 2);
  const e = c._subs[0];
  for (let i = 0; i < e.length; i += 2) expect(Math.abs((e[i] / 20) ** 2 + (e[i + 1] / 10) ** 2 - 1)).toBeLessThan(1e-9);
  // arcTo a right angle: the arc's end points are `r` back from the corner along each side.
  c.beginPath(); c.moveTo(0, 0); c.arcTo(100, 0, 100, 100, 20);
  const a = c._subs[0];
  expect(a[2]).toBeCloseTo(80); expect(a[3]).toBeCloseTo(0);
  expect(a[a.length - 2]).toBeCloseTo(100); expect(a[a.length - 1]).toBeCloseTo(20);
});

test('drawImage takes its three forms', () => {
  const c = ctx();
  c.drawImage(7, 10, 20);
  expect(c._cmds[0]).toEqual({ type: 'drawImage', image: 7, src: [0, 0, 0, 0], dst: [10, 20, -1, -1] });
  c.drawImage({ id: 8 }, 1, 2, 30, 40);
  expect(c._cmds[1].dst).toEqual([1, 2, 30, 40]);
  c.drawImage({ id: 9 }, 5, 6, 7, 8, 100, 110, 120, 130);
  expect(c._cmds[2]).toEqual({ type: 'drawImage', image: 9, src: [5, 6, 7, 8], dst: [100, 110, 120, 130] });
  c.drawImage(null, 0, 0);                                // not an image: ignored
  expect(c._cmds.length).toBe(3);
});

test('a new frame starts from the default state: the state is sent again', () => {
  const c = ctx();
  c.translate(3, 4);
  c.fillRect(0, 0, 1, 1);
  c.flush();                                              // the JSON list goes (and is cleared) at the end of a frame
  c.fillRect(0, 0, 1, 1);
  expect(types(c)).toEqual(['transform', 'fillRect']);
});
