import { test, expect } from 'bun:test';
import {
  dispatchEvents, registerInput, unregisterInput,
  registerPressable, unregisterPressable, registerFocusable, unregisterFocusable, setFocus,
  registerWheel, unregisterWheel, registerScrollView, unregisterScrollView,
} from './events.js';

// Feed one frame's worth of native events through the real dispatcher.
function dispatch(events) {
  const prev = globalThis.__glyx_pollEvents;
  globalThis.__glyx_pollEvents = () => events;
  try { dispatchEvents(); } finally { globalThis.__glyx_pollEvents = prev; }
}

test('a screen-reader text selection reaches the field it targets', () => {
  const calls = [];
  registerInput(501, { onSetSelection: (a, f) => calls.push([a, f]) });
  registerInput(502, { onSetSelection: () => calls.push('wrong field') });
  try {
    dispatch([{ type: 'accessibilityTextSelection', nodeId: 501, anchor: 7, focus: 2 }]);
    // Direction preserved (anchor 7, focus 2 = a leftward selection).
    expect(calls).toEqual([[7, 2]]);
  } finally {
    unregisterInput(501);
    unregisterInput(502);
  }
});

test('a screen-reader text selection for an unknown field is ignored', () => {
  expect(() =>
    dispatch([{ type: 'accessibilityTextSelection', nodeId: 999, anchor: 0, focus: 1 }])
  ).not.toThrow();
});

test('the hovered pressable gets onPointerMove with element-local coordinates', () => {
  const moves = [];
  registerPressable(601, { onPointerMove: (e) => moves.push(e) });
  const prevLayout = globalThis.__glyx_getLayout;
  globalThis.__glyx_getLayout = (id) => (id === 601 ? { x: 100, y: 50, width: 200, height: 80 } : null);
  try {
    dispatch([{ type: 'cursorMoved', x: 130, y: 70, target: 601 }]);
    dispatch([{ type: 'cursorMoved', x: 150, y: 90, target: 601 }]);
    expect(moves.map((m) => [m.locationX, m.locationY])).toEqual([[30, 20], [50, 40]]);
    expect(moves[1].x).toBe(150);
  } finally {
    dispatch([{ type: 'cursorMoved', x: 0, y: 0, target: undefined }]);
    globalThis.__glyx_getLayout = prevLayout;
    unregisterPressable(601);
  }
});

test('keys reach a focused non-text control through onKeyDown', () => {
  const keys = [];
  registerFocusable(602, { onKeyDown: (e) => keys.push(e.key) });
  try {
    setFocus(602);
    dispatch([{ type: 'keyInput', key: 'ArrowRight', pressed: true }]);
    dispatch([{ type: 'keyInput', key: 'ArrowRight', pressed: false }]); // releases ignored
    dispatch([{ type: 'keyInput', key: 'Home', pressed: true }]);
    expect(keys).toEqual(['ArrowRight', 'Home']);
  } finally {
    setFocus(null);
    unregisterFocusable(602);
  }
});

test('Enter and Space press a focused button; other keys and releases do not', () => {
  const presses = [];
  registerPressable(603, { onPress: (e) => presses.push(e.keyboard) });
  registerFocusable(603, {});
  try {
    setFocus(603);
    dispatch([{ type: 'keyInput', key: 'Enter', pressed: true }]);
    dispatch([{ type: 'keyInput', key: 'Enter', pressed: false }]);
    dispatch([{ type: 'keyInput', key: 'Space', pressed: true }]);
    dispatch([{ type: 'keyInput', key: 'NumpadEnter', pressed: true }]);
    dispatch([{ type: 'keyInput', key: 'KeyA', pressed: true }]);
    expect(presses).toEqual([true, true, true]);
  } finally {
    setFocus(null);
    unregisterPressable(603);
    unregisterFocusable(603);
  }
});

test('onKeyDown can keep Enter from pressing the button', () => {
  const presses = [];
  registerPressable(604, { onPress: () => presses.push('press') });
  registerFocusable(604, { onKeyDown: (e) => e.preventDefault() });
  try {
    setFocus(604);
    dispatch([{ type: 'keyInput', key: 'Enter', pressed: true }]);
    expect(presses).toEqual([]);
  } finally {
    setFocus(null);
    unregisterPressable(604);
    unregisterFocusable(604);
  }
});

test('a wheel handler gets first refusal on scrolling, with modifiers and a node-local position', () => {
  const wheel = [], scrolls = [];
  registerWheel(701, (e) => { wheel.push(e); return e.ctrl; });
  registerScrollView(702, { onScroll: (dy) => scrolls.push(dy) });
  const prevLayout = globalThis.__glyx_getLayout;
  globalThis.__glyx_getLayout = () => ({ x: 100, y: 50, width: 200, height: 80 });
  try {
    dispatch([{ type: 'cursorMoved', x: 130, y: 70, target: 701 }]);
    // Plain wheel: offered, declined, so the ScrollView scrolls.
    dispatch([{ type: 'scroll', deltaY: 40 }]);
    expect(scrolls).toEqual([40]);
    // Ctrl held: consumed, the ScrollView does not move.
    dispatch([{ type: 'keyInput', key: 'ControlLeft', pressed: true }]);
    dispatch([{ type: 'scroll', deltaY: -40 }]);
    dispatch([{ type: 'keyInput', key: 'ControlLeft', pressed: false }]);
    expect(scrolls).toEqual([40]);
    expect(wheel.map((e) => [e.deltaY, e.ctrl, e.x, e.y])).toEqual([[40, false, 30, 20], [-40, true, 30, 20]]);
  } finally {
    unregisterWheel(701);
    unregisterScrollView(702);
    dispatch([{ type: 'cursorMoved', x: 0, y: 0, target: undefined }]);
    globalThis.__glyx_getLayout = prevLayout;
  }
});

test('a wheel handler is only asked while the pointer is over it', () => {
  const asked = [];
  registerWheel(703, (e) => { asked.push(e); return true; });
  const prevLayout = globalThis.__glyx_getLayout;
  globalThis.__glyx_getLayout = () => ({ x: 100, y: 50, width: 200, height: 80 });
  try {
    dispatch([{ type: 'cursorMoved', x: 5, y: 5, target: undefined }]);
    dispatch([{ type: 'scroll', deltaY: 40 }]);
    expect(asked).toEqual([]);
  } finally {
    unregisterWheel(703);
    globalThis.__glyx_getLayout = prevLayout;
  }
});
