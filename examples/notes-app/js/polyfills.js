// V8 environment polyfills
//
// rusty_v8 runs a bare V8 isolate — no browser or Node globals.
// React's scheduler needs performance.now(), setTimeout, clearTimeout,
// and MessageChannel. We provide minimal stubs here.
//
// This file is imported FIRST in app.jsx so these globals exist before
// react-reconciler initialises its scheduler.

if (typeof performance === 'undefined') {
  globalThis.performance = {
    // __velox_getTime() returns Unix ms as a number.
    now: () => Number(__velox_getTime()),
  };
}

if (typeof setTimeout === 'undefined') {
  // Deferred timer queue — drained each frame by _veloxDrainTimers()
  // which is called from __velox_frameCallback in @velox/react/index.js.
  // Calling fn() immediately caused infinite recursion in animation loops.
  let _nextTimerId = 1;
  const _pendingTimers = new Map(); // id → { fn, due }

  globalThis.setTimeout = (fn, ms) => {
    const id = _nextTimerId++;
    _pendingTimers.set(id, { fn, due: performance.now() + (ms > 0 ? ms : 0) });
    return id;
  };

  globalThis.clearTimeout = (id) => { _pendingTimers.delete(id); };

  // Called once per frame from __velox_frameCallback (index.js).
  globalThis._veloxDrainTimers = () => {
    if (_pendingTimers.size === 0) return;
    const now = performance.now();
    const due = [];
    for (const [id, t] of _pendingTimers) {
      if (t.due <= now) due.push([id, t.fn]);
    }
    for (const [id] of due) _pendingTimers.delete(id);
    for (const [, fn] of due) fn();
  };
}

if (typeof queueMicrotask === 'undefined') {
  globalThis.queueMicrotask = (fn) => Promise.resolve().then(fn);
}

if (typeof MessageChannel === 'undefined') {
  // React's scheduler uses MessageChannel to yield between tasks.
  // This stub allows sync message passing so the scheduler still runs.
  globalThis.MessageChannel = class MessageChannel {
    constructor() {
      const ch = this;
      ch.port1 = {
        onmessage: null,
        postMessage(msg) { ch.port2.onmessage?.({ data: msg }); },
      };
      ch.port2 = {
        onmessage: null,
        postMessage(msg) { ch.port1.onmessage?.({ data: msg }); },
      };
    }
  };
}
