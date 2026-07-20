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

// ── Native wakeup coalescing ─────────────────────────────────────────────
//
// __glyx_request_frame(ms) spawns a Rust-side tokio timer that calls
// request_redraw() when it fires. Every RedrawRequested unconditionally
// runs the JS frame callback (dispatchEvents, timer drain, React commit),
// so calling __glyx_request_frame from *inside* that same drain (e.g. to
// re-arm a still-pending setInterval) creates a frame -> re-arm -> frame
// loop that never goes idle — catastrophic on Vello, since its GPU scratch
// buffer pool is never reclaimed outside occlusion/focus-loss.
//
// Fix: only one native wakeup is ever in flight. _glyxFramePending tracks
// that; it's set the moment we ask Rust for a wakeup and cleared at the
// top of the next real frame callback (see index.js). While a wakeup is
// already pending, new timer registrations and the interval-drain re-arm
// don't request another one — the pending frame will observe the new/
// updated due time when it runs and re-request from there if still needed.
globalThis._glyxFramePending = false;
globalThis._glyxFramePendingDeadline = Infinity;
function _glyxRequestFrame(ms) {
  if (typeof __glyx_request_frame === 'undefined') return;
  const deadline = performance.now() + ms;
  // Skip only if an already-pending wakeup fires at least as soon as this
  // one would — a later pending wakeup doesn't cover an earlier request.
  if (globalThis._glyxFramePending && deadline >= globalThis._glyxFramePendingDeadline) return;
  globalThis._glyxFramePending = true;
  globalThis._glyxFramePendingDeadline = deadline;
  __glyx_request_frame(ms);
}

if (typeof setTimeout === 'undefined') {
  let _nextTimerId = 1;
  const _pendingTimers = new Map();

  globalThis.setTimeout = (fn, ms) => {
    const id = _nextTimerId++;
    const delay = ms > 0 ? ms : 0;
    _pendingTimers.set(id, { fn, due: performance.now() + delay });
    _glyxRequestFrame(delay);
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
    _glyxRequestFrame(delay);
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
    // Re-arm the native wakeup for the next due interval, coalesced via
    // _glyxRequestFrame — a no-op if a wakeup is already pending (it will
    // pick up this interval's updated nextDue when it runs and re-request
    // from there). Without this, intervals fire once and then only tick
    // when something else happens to cause a frame.
    if (earliest < Infinity) {
      _glyxRequestFrame(Math.max(0, earliest - performance.now()));
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

// TextEncoder is a Web Platform API, not a V8 built-in — bare V8 isolates
// don't have it unless the embedder provides it, and this one doesn't.
// `canvas.js`'s `fillText` calls `encodeInto()` with no fallback (unlike
// `api.js`'s `toBytes()`, which degrades to a manual byte loop when
// TextEncoder is missing) — silently writing zero bytes every time, so
// every Canvas `fillText()` call across the whole framework renders no
// glyphs at all, with no error. Real UTF-8 encode/encodeInto, not a
// Latin1-only shortcut, so non-ASCII text (labels, user content) works too.
if (typeof TextEncoder === 'undefined') {
  function _glyxUtf8Bytes(codePoint) {
    if (codePoint < 0x80) return [codePoint];
    if (codePoint < 0x800) {
      return [0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f)];
    }
    if (codePoint < 0x10000) {
      return [
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f),
      ];
    }
    return [
      0xf0 | (codePoint >> 18),
      0x80 | ((codePoint >> 12) & 0x3f),
      0x80 | ((codePoint >> 6) & 0x3f),
      0x80 | (codePoint & 0x3f),
    ];
  }

  globalThis.TextEncoder = class TextEncoder {
    get encoding() { return 'utf-8'; }

    encode(input) {
      const str = String(input ?? '');
      const out = [];
      for (let i = 0; i < str.length; i++) {
        const code = str.codePointAt(i);
        if (code > 0xffff) i++; // consumed a surrogate pair
        out.push(..._glyxUtf8Bytes(code));
      }
      return new Uint8Array(out);
    }

    // Matches the spec shape canvas.js relies on: writes as many whole
    // code points as fit in `dest`, returns { read, written } in JS
    // string-unit / byte counts respectively — never writes a partial
    // multi-byte sequence.
    encodeInto(input, dest) {
      const str = String(input ?? '');
      let read = 0, written = 0;
      for (let i = 0; i < str.length; i++) {
        const code = str.codePointAt(i);
        const isPair = code > 0xffff;
        const bytes = _glyxUtf8Bytes(code);
        if (written + bytes.length > dest.length) break;
        for (let k = 0; k < bytes.length; k++) dest[written + k] = bytes[k];
        written += bytes.length;
        read += isPair ? 2 : 1;
        if (isPair) i++;
      }
      return { read, written };
    }
  };
}
