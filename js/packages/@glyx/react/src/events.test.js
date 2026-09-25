import { test, expect } from 'bun:test';
import { dispatchEvents, registerInput, unregisterInput } from './events.js';

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
