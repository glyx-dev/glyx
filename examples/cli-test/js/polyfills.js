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
    // __glyx_getTime() returns Unix ms as a number.
    now: () => Number(__glyx_getTime()),
  };
}

if (typeof setTimeout === 'undefined') {
  // React uses setTimeout for low-priority deferred work.
  // In LegacyRoot sync mode the initial render never defers, so calling
  // fn() immediately is correct for Week 11.
  let _nextId = 1;
  globalThis.setTimeout  = (fn, _ms) => { fn(); return _nextId++; };
  globalThis.clearTimeout = (_id) => {};
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
