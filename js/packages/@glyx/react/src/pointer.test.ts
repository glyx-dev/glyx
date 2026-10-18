import { test, expect } from 'bun:test';
import {
  dispatchEvents, registerPressable, unregisterPressable, setPointerCapture, releasePointerCapture,
} from './events.js';

// Feed one frame's worth of native events through the real dispatcher.
function dispatch(events: any[]) {
  const prev = (globalThis as any).__glyx_pollEvents;
  (globalThis as any).__glyx_pollEvents = () => events;
  try { dispatchEvents(); } finally { (globalThis as any).__glyx_pollEvents = prev; }
}

// A 200 x 80 canvas at (100, 50).
const BOX = { x: 100, y: 50, width: 200, height: 80 };
function withLayout(fn: () => void) {
  const prev = (globalThis as any).__glyx_getLayout;
  (globalThis as any).__glyx_getLayout = (id: number) => (id === 701 ? BOX : null);
  try { fn(); } finally {
    // Let go of anything still held, and move the cursor away.
    dispatch([{ type: 'mouseButton', x: 0, y: 0, button: 0, pressed: false, target: null }]);
    dispatch([{ type: 'cursorMoved', x: 0, y: 0, target: undefined }]);
    (globalThis as any).__glyx_getLayout = prev;
    unregisterPressable(701);
  }
}

const press = (x: number, y: number) => ({ type: 'mouseButton', x, y, button: 0, pressed: true, target: 701 });
const release = (x: number, y: number) => ({ type: 'mouseButton', x, y, button: 0, pressed: false, target: 701 });

test('a move over the pressable reports the button state, pressure and pointer type like the web', () => {
  const moves: any[] = [];
  registerPressable(701, { onPointerMove: (e: any) => moves.push(e) } as any);
  withLayout(() => {
    dispatch([{ type: 'cursorMoved', x: 130, y: 70, target: 701 }]);
    expect(moves[0]).toMatchObject({ x: 130, y: 70, locationX: 30, locationY: 20, button: -1, buttons: 0, pressure: 0, pointerType: 'mouse', pointerId: 1 });
    expect(moves[0].points).toBeUndefined();            // one position: no list
  });
});

test('the positions a frame\'s moves passed through arrive as points, oldest first', () => {
  const moves: any[] = [];
  registerPressable(701, { onPointerMove: (e: any) => moves.push(e) } as any);
  withLayout(() => {
    // The runtime merged three moves: the latest (160, 90) and the two before it as the trail.
    dispatch([{ type: 'cursorMoved', x: 160, y: 90, target: 701, trail: [110, 60, 135, 75] }]);
    expect(moves[0].points.map((p: any) => [p.x, p.y])).toEqual([[110, 60], [135, 75], [160, 90]]);
    expect(moves[0].points[0]).toMatchObject({ locationX: 10, locationY: 10 });
    expect([moves[0].x, moves[0].y]).toEqual([160, 90]);
  });
});

test('a press captures the pointer: moves keep coming outside the pressable until the button is released', () => {
  const log: string[] = [];
  registerPressable(701, {
    onPress: () => log.push('press'),
    onPointerDown: (e: any) => log.push(`down ${e.locationX},${e.locationY} buttons=${e.buttons}`),
    onPointerMove: (e: any) => log.push(`move ${e.x},${e.y} pressure=${e.pressure}`),
    onPointerUp: (e: any) => log.push(`up ${e.x},${e.y} buttons=${e.buttons}`),
    capturesPointer: true,
  } as any);
  withLayout(() => {
    dispatch([press(120, 60)]);
    // Well outside the box (and over nothing): still delivered.
    dispatch([{ type: 'cursorMoved', x: 500, y: 400, target: undefined }]);
    dispatch([release(520, 410)]);
    // After release it is hover-only again: a move outside is not delivered.
    dispatch([{ type: 'cursorMoved', x: 600, y: 500, target: undefined }]);
    expect(log).toEqual(['press', 'down 20,10 buttons=1', 'move 500,400 pressure=0.5', 'up 520,410 buttons=0']);
  });
});

test('capturePointer: false keeps moves to the hovered pressable only', () => {
  const log: string[] = [];
  registerPressable(701, {
    onPointerMove: (e: any) => log.push(`move ${e.x}`),
    capturesPointer: false,
  } as any);
  withLayout(() => {
    dispatch([press(120, 60)]);
    dispatch([{ type: 'cursorMoved', x: 500, y: 400, target: undefined }]);
    expect(log).toEqual([]);
  });
});

test('setPointerCapture and releasePointerCapture control it by hand', () => {
  const log: number[] = [];
  registerPressable(701, { onPointerMove: (e: any) => log.push(e.x) } as any);
  withLayout(() => {
    setPointerCapture(701);
    dispatch([{ type: 'cursorMoved', x: 500, y: 400, target: undefined }]);
    releasePointerCapture(702);                         // another node: no effect
    dispatch([{ type: 'cursorMoved', x: 510, y: 400, target: undefined }]);
    releasePointerCapture(701);
    dispatch([{ type: 'cursorMoved', x: 520, y: 400, target: undefined }]);
    expect(log).toEqual([500, 510]);
  });
});

test('the held-buttons bitmask follows presses and releases of each button', () => {
  const downs: number[] = [];
  registerPressable(701, { onPointerDown: (e: any) => downs.push(e.buttons), capturesPointer: false } as any);
  withLayout(() => {
    dispatch([press(120, 60)]);                                                                         // left: 1
    dispatch([{ type: 'mouseButton', x: 120, y: 60, button: 1, pressed: true, target: 701 }]);          // + right: 3
    dispatch([release(120, 60)]);                                                                       // left up: 2
    dispatch([{ type: 'mouseButton', x: 120, y: 60, button: 2, pressed: true, target: 701 }]);          // + middle: 6
    expect(downs).toEqual([1, 3, 6]);
  });
});
