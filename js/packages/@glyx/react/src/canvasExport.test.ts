import { test, expect, afterEach } from 'bun:test';
import { GlyxCanvasContext } from './canvas.js';
import { dispatchEvents } from './events.js';

const g = globalThis as any;

function dispatch(events: any[]) {
  const prev = g.__glyx_pollEvents;
  g.__glyx_pollEvents = () => events;
  try { dispatchEvents(); } finally { g.__glyx_pollEvents = prev; }
}

afterEach(() => { delete g.__glyx_canvas_export; });

// "iVBORw0KGgo" is the start of every PNG: 89 50 4E 47 0D 0A 1A 0A.
const PNG_HEAD_B64 = 'iVBORw0KGgo=';

test('toDataURL asks the native side for a PNG and resolves with a data URL when the event arrives', async () => {
  const calls: any[] = [];
  g.__glyx_canvas_export = (...args: any[]) => { calls.push(args); return 41; };
  const c = new GlyxCanvasContext(7);
  const p = c.toDataURL('image/png', { scale: 2 });
  expect(calls).toEqual([[7, 0, 0, 2, [], false]]);
  dispatch([{ type: 'canvasExport', reqId: 41, data: PNG_HEAD_B64 }]);
  expect(await p).toBe('data:image/png;base64,' + PNG_HEAD_B64);
});

test('toPNG resolves with the decoded bytes', async () => {
  g.__glyx_canvas_export = () => 42;
  const c = new GlyxCanvasContext(7);
  const p = c.toPNG({ width: 300, height: 200 });
  dispatch([{ type: 'canvasExport', reqId: 42, data: PNG_HEAD_B64 }]);
  const bytes = await p;
  expect(Array.from(bytes)).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
});

test('a failed export rejects with the reason, and an answer for an unknown request is ignored', async () => {
  g.__glyx_canvas_export = () => 43;
  const c = new GlyxCanvasContext(7);
  const p = c.toDataURL();
  dispatch([{ type: 'canvasExport', reqId: 999, data: 'AAAA' }]);          // not ours: nothing happens
  dispatch([{ type: 'canvasExport', reqId: 43, error: 'the canvas has no size yet' }]);
  await expect(p).rejects.toThrow('the canvas has no size yet');
});

test('an export waits for what was drawn, and does not wipe an unchanged canvas with an empty flush', async () => {
  const sent: any[] = [];
  g.__glyx_canvas_update = (_id: number, json: string) => sent.push(JSON.parse(json));
  g.__glyx_canvas_export = () => 44;
  try {
    const c = new GlyxCanvasContext(7);
    c.fillRect(0, 0, 10, 10);
    const p = c.toPNG();
    expect(sent.length).toBe(1);                                          // the drawing went first
    expect(sent[0].some((x: any) => x.type === 'fillRect')).toBe(true);
    dispatch([{ type: 'canvasExport', reqId: 44, data: PNG_HEAD_B64 }]);
    await p;
    // Nothing drawn since: exporting again sends no (empty) update that would replace the drawing.
    g.__glyx_canvas_export = () => 45;
    const p2 = c.toPNG();
    expect(sent.length).toBe(1);
    dispatch([{ type: 'canvasExport', reqId: 45, data: PNG_HEAD_B64 }]);
    await p2;
  } finally {
    delete g.__glyx_canvas_update;
  }
});

test('only PNG is supported, and an old runner without the binding says so', async () => {
  const c = new GlyxCanvasContext(7);
  await expect(c.toDataURL()).rejects.toThrow('newer runner');
  g.__glyx_canvas_export = () => 1;
  await expect(c.toDataURL('image/jpeg')).rejects.toThrow('only image/png');
});

// ── clip(), toBlob, getImageData ─────────────────────────────────────────────────────────────────────

test('clip() sends the current path (all its sub-paths) as a clip, with the even-odd choice', () => {
  const c = new GlyxCanvasContext(7);
  c.beginPath();
  c.rect(0, 0, 100, 100);
  c.rect(25, 25, 50, 50);
  c.save();
  c.clip('evenodd');
  const cmd = c._cmds.find((x: any) => x.type === 'clipPath');
  expect(cmd.evenOdd).toBe(true);
  expect(cmd.contours.length).toBe(2);
  expect(cmd.contours[0]).toEqual([0, 0, 100, 0, 100, 100, 0, 100]);
  c._cmds.length = 0;
  c.clip();
  expect(c._cmds.find((x: any) => x.type === 'clipPath').evenOdd).toBe(false);
  // A path with fewer than three points clips everything away (an empty list of shapes), and is still balanced.
  c._cmds.length = 0;
  c.beginPath(); c.moveTo(1, 1);
  c.clip();
  expect(c._cmds.find((x: any) => x.type === 'clipPath').contours).toEqual([]);
});

test('toBlob resolves a blob-like object, and also calls a callback like the web\'s', async () => {
  g.__glyx_canvas_export = () => 51;
  const c = new GlyxCanvasContext(7);
  let got: any = null;
  const p = c.toBlob((b: any) => { got = b; });
  dispatch([{ type: 'canvasExport', reqId: 51, data: PNG_HEAD_B64 }]);
  const blob = await p;
  expect(got).toBe(blob);
  expect([blob.type, blob.size]).toEqual(['image/png', 8]);
  expect(Array.from(await blob.bytes())).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expect((await blob.arrayBuffer()).byteLength).toBe(8);
  await expect(c.toBlob(undefined, 'image/webp')).rejects.toThrow('only image/png');
});

test('getImageData asks for the raw pixels of a region and returns them as a Uint8ClampedArray', async () => {
  const calls: any[] = [];
  g.__glyx_canvas_export = (...a: any[]) => { calls.push(a); return 61; };
  const c = new GlyxCanvasContext(7);
  const p = c.getImageData(3, 4, 2, 1);
  expect(calls).toEqual([[7, 0, 0, 1, [3, 4, 2, 1], true]]);
  // Two pixels, RGBA each: 8 bytes ("AQIDBAUGBwg=" is 01 02 03 04 05 06 07 08).
  dispatch([{ type: 'canvasExport', reqId: 61, data: 'AQIDBAUGBwg=' }]);
  const img = await p;
  expect([img.width, img.height]).toEqual([2, 1]);
  expect(img.data).toBeInstanceOf(Uint8ClampedArray);
  expect(Array.from(img.data)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
});

test('getImageData reads a negative-size rectangle the other way and refuses an empty one', async () => {
  const calls: any[] = [];
  g.__glyx_canvas_export = (...a: any[]) => { calls.push(a); return 62; };
  const c = new GlyxCanvasContext(7);
  const p = c.getImageData(10, 10, -4, -2);
  expect(calls[0][4]).toEqual([6, 8, 4, 2]);
  dispatch([{ type: 'canvasExport', reqId: 62, error: 'over the limit' }]);
  await expect(p).rejects.toThrow('over the limit');
  await expect(c.getImageData(0, 0, 0, 5)).rejects.toThrow('above zero');
});
