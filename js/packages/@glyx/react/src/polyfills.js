// V8 environment polyfills — auto-loaded by @glyx-dev/react
//
// rusty_v8 runs a bare V8 isolate — no browser or Node globals.
// React's scheduler needs performance.now(), setTimeout, clearTimeout,
// and MessageChannel. These stubs are installed once when @glyx-dev/react
// is first imported, before the reconciler initialises its scheduler.

if (typeof performance === 'undefined') {
  globalThis.performance = {
    now: () => Number(__glyx_getTime()),
  };
}

// V8 is embedded without ICU data, so locale-aware builtins throw
// "Internal error. Icu error.".  Replace localeCompare with a plain
// code-unit comparison (sufficient for sorting file names etc.).
try {
  'a'.localeCompare('b');
} catch {
  // eslint-disable-next-line no-extend-native
  String.prototype.localeCompare = function (other) {
    const a = String(this), b = String(other);
    return a < b ? -1 : a > b ? 1 : 0;
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
    const id    = _nextIntervalId++;
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
    let earliest = Infinity;
    for (const [, t] of _pendingIntervals) {
      if (now >= t.nextDue) {
        t.nextDue = now + t.ms;
        t.fn();
      }
      if (t.nextDue < earliest) earliest = t.nextDue;
    }
    // Re-arm the native wakeup for the next due interval.  Without this,
    // intervals fire once and then only tick when something else (input,
    // a setTimeout) happens to cause a frame — animations stall unless
    // the user keeps moving the mouse.
    if (earliest < Infinity && typeof __glyx_request_frame !== 'undefined') {
      __glyx_request_frame(Math.max(0, earliest - performance.now()));
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
