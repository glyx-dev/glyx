import { test, expect } from 'bun:test';
import {
  dispatchEvents, registerInput, unregisterInput,
  registerPressable, unregisterPressable, registerFocusable, unregisterFocusable, setFocus,
  registerWheel, unregisterWheel, registerScrollView, unregisterScrollView, setNodeParent, removeNodeFromTree,
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

// ── Horizontal scrolling: input is routed per axis ─────────────────────────────────────────────────

// Layout stub: node `id` covers [x, x+w] x [y, y+h]. Nesting is declared with setNodeParent, as hostConfig does.
function withLayouts(rects, fn) {
  const prev = globalThis.__glyx_getLayout;
  globalThis.__glyx_getLayout = (id) => rects[id] ?? null;
  try { fn(); } finally { globalThis.__glyx_getLayout = prev; }
}

test('horizontal input goes to the nearest node that scrolls sideways, vertical to the nearest that scrolls up and down', () => {
  const pane = [], list = [];
  registerScrollView(710, { horizontal: true, onScroll: (dy, dx) => pane.push([dy, dx]), onAbsoluteScroll() {} });
  registerScrollView(711, { onScroll: (dy, dx) => list.push([dy, dx]), onAbsoluteScroll() {} });   // scrolls up and down; sits inside the pane
  setNodeParent(711, 710);
  withLayouts({ 710: { x: 0, y: 0, width: 400, height: 300 }, 711: { x: 50, y: 50, width: 200, height: 200 } }, () => {
    try {
      dispatch([{ type: 'cursorMoved', x: 100, y: 100, target: 711 }]);
      dispatch([{ type: 'scroll', deltaY: 40, deltaX: 0 }]);      // up/down: the list
      dispatch([{ type: 'scroll', deltaY: 0, deltaX: 30 }]);      // sideways: the pane
      dispatch([{ type: 'scroll', deltaY: 20, deltaX: 10 }]);     // a diagonal touchpad swipe: each its own way
      expect(list).toEqual([[40, 0], [20, 0]]);
      expect(pane).toEqual([[0, 30], [0, 10]]);
    } finally {
      unregisterScrollView(710);
      unregisterScrollView(711);
      removeNodeFromTree(711);
      dispatch([{ type: 'cursorMoved', x: 0, y: 0, target: undefined }]);
    }
  });
});

test('one node that scrolls both ways gets both deltas in one call', () => {
  const calls = [];
  registerScrollView(712, { horizontal: true, onScroll: (dy, dx) => calls.push([dy, dx]), onAbsoluteScroll() {} });
  withLayouts({ 712: { x: 0, y: 0, width: 400, height: 300 } }, () => {
    try {
      dispatch([{ type: 'cursorMoved', x: 100, y: 100, target: 712 }]);
      dispatch([{ type: 'scroll', deltaY: 20, deltaX: 10 }]);
      expect(calls).toEqual([[20, 10]]);
    } finally {
      unregisterScrollView(712);
      dispatch([{ type: 'cursorMoved', x: 0, y: 0, target: undefined }]);
    }
  });
});

test('a node that only scrolls up and down is never offered sideways input', () => {
  const calls = [];
  registerScrollView(713, { onScroll: (dy, dx) => calls.push([dy, dx]), onAbsoluteScroll() {} });
  withLayouts({ 713: { x: 0, y: 0, width: 400, height: 300 } }, () => {
    try {
      dispatch([{ type: 'cursorMoved', x: 100, y: 100, target: 713 }]);
      dispatch([{ type: 'scroll', deltaY: 0, deltaX: 30 }]);
      expect(calls).toEqual([]);
    } finally {
      unregisterScrollView(713);
      dispatch([{ type: 'cursorMoved', x: 0, y: 0, target: undefined }]);
    }
  });
});

test('Shift+wheel scrolls sideways where something scrolls sideways, and still scrolls up and down elsewhere', () => {
  const side = [], tall = [];
  registerScrollView(714, { horizontal: true, vertical: false, onScroll: (dy, dx) => side.push([dy, dx]), onAbsoluteScroll() {} });
  registerScrollView(715, { onScroll: (dy, dx) => tall.push([dy, dx]), onAbsoluteScroll() {} });
  withLayouts({ 714: { x: 0, y: 0, width: 100, height: 100 }, 715: { x: 200, y: 0, width: 100, height: 100 } }, () => {
    try {
      dispatch([{ type: 'keyInput', key: 'ShiftLeft', pressed: true }]);
      dispatch([{ type: 'cursorMoved', x: 50, y: 50, target: 714 }]);
      dispatch([{ type: 'scroll', deltaY: 40, deltaX: 0 }]);        // over the sideways node: becomes sideways
      dispatch([{ type: 'cursorMoved', x: 250, y: 50, target: 715 }]);
      dispatch([{ type: 'scroll', deltaY: 40, deltaX: 0 }]);        // over the tall one: stays up/down
      dispatch([{ type: 'keyInput', key: 'ShiftLeft', pressed: false }]);
      expect(side).toEqual([[0, 40]]);
      expect(tall).toEqual([[40, 0]]);
    } finally {
      unregisterScrollView(714);
      unregisterScrollView(715);
      dispatch([{ type: 'cursorMoved', x: 0, y: 0, target: undefined }]);
    }
  });
});

test('a wheel handler is offered deltaX as well, unchanged by Shift', () => {
  const wheel = [];
  registerWheel(716, (e) => { wheel.push([e.deltaX, e.deltaY, e.shift]); return true; });
  withLayouts({ 716: { x: 0, y: 0, width: 100, height: 100 } }, () => {
    try {
      dispatch([{ type: 'cursorMoved', x: 50, y: 50, target: 716 }]);
      dispatch([{ type: 'scroll', deltaY: 40, deltaX: 12 }]);
      dispatch([{ type: 'scroll', deltaY: 40 }]);                    // an older runner without deltaX
      expect(wheel).toEqual([[12, 40, false], [0, 40, false]]);
    } finally {
      unregisterWheel(716);
      dispatch([{ type: 'cursorMoved', x: 0, y: 0, target: undefined }]);
    }
  });
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
