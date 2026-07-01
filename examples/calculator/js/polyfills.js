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
    now: () => Number(__glyx_getTime()),
  };
}

if (typeof setTimeout === 'undefined') {
  let _nextTimerId = 1;
  const _pendingTimers = new Map();

  globalThis.setTimeout = (fn, ms) => {
    const id = _nextTimerId++;
    const delay = ms > 0 ? ms : 0;
    _pendingTimers.set(id, { fn, due: performance.now() + delay });
    if (typeof __glyx_request_frame !== 'undefined') {
      __glyx_request_frame(delay);
    }
    return id;
  };

  globalThis.clearTimeout = (id) => { _pendingTimers.delete(id); };

  globalThis._glyxDrainTimers = () => {
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

if (typeof setInterval === 'undefined') {
  let _nextIntervalId = 1;
  const _pendingIntervals = new Map();

  globalThis.setInterval = (fn, ms) => {
    const id   = _nextIntervalId++;
    const delay = ms > 0 ? ms : 0;
    _pendingIntervals.set(id, { fn, ms: delay, nextDue: performance.now() + delay });
    if (typeof __glyx_request_frame !== 'undefined') __glyx_request_frame(delay);
    return id;
  };

  globalThis.clearInterval = (id) => { _pendingIntervals.delete(id); };

  const _prevDrain = globalThis._glyxDrainTimers;
  globalThis._glyxDrainTimers = () => {
    _prevDrain?.();
    if (_pendingIntervals.size === 0) return;
    const now = performance.now();
    for (const [, t] of _pendingIntervals) {
      if (now >= t.nextDue) {
        t.nextDue = now + t.ms;
        t.fn();
      }
    }
  };
}

if (typeof queueMicrotask === 'undefined') {
  globalThis.queueMicrotask = (fn) => Promise.resolve().then(fn);
}

if (typeof MessageChannel === 'undefined') {
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
