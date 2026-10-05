// @glyx-dev/react — performance monitoring.

// ── Perf violation + leak polling ─────────────────────────────────────────────

export const _perfBudgetCallbacks = [];
export const _perfLeakCallbacks   = [];

export function _pollPerfViolations() {
  if (typeof __glyx_perf_poll_violations === 'undefined') return;
  if (_perfBudgetCallbacks.length === 0) return;
  let raw;
  try { raw = __glyx_perf_poll_violations(); } catch { return; }
  if (!raw || raw === '[]') return;
  let violations;
  try { violations = JSON.parse(raw); } catch { return; }
  for (const v of violations) {
    for (const cb of _perfBudgetCallbacks) {
      try { cb(v); } catch (e) { __glyx_log('[perf] onBudgetExceeded callback error: ' + e); }
    }
  }
}

export function _pollLeakWarnings() {
  if (typeof __glyx_perf_poll_leak_warnings === 'undefined') return;
  if (_perfLeakCallbacks.length === 0) return;
  let raw;
  try { raw = __glyx_perf_poll_leak_warnings(); } catch { return; }
  if (!raw || raw === '[]') return;
  let warnings;
  try { warnings = JSON.parse(raw); } catch { return; }
  for (const w of warnings) {
    for (const cb of _perfLeakCallbacks) {
      try { cb(w); } catch (e) { __glyx_log('[perf] onLeakDetected callback error: ' + e); }
    }
  }
}
// ── Performance monitoring ────────────────────────────────────────────────────

/**
 * Performance monitoring API.
 *
 * @example
 * const snap = perf.snapshot();
 * // → { fps: 60.1, frameTime: 14.2, frameTimeP99: 18.5, jsTime: 2.1,
 * //      layoutTime: 0.8, gpuTime: 1.3, memoryJS: 12.4, nodeCount: 42 }
 *
 * const unsub = perf.onBudgetExceeded((v) => console.log('slow frame:', v), { target: 16.667 });
 * unsub(); // remove listener
 */
export const perf = {
  /**
   * Synchronously returns a snapshot of current performance metrics.
   * @returns {{ fps, frameTime, frameTimeP99, jsTime, layoutTime, gpuTime, memoryJS, nodeCount }}
   */
  snapshot() {
    if (typeof __glyx_perf_snapshot === 'undefined') return null;
    try { return JSON.parse(__glyx_perf_snapshot()); } catch { return null; }
  },

  /**
   * Register a callback fired whenever a frame exceeds `target` ms.
   * @param {function} cb  Called with `{ budget, actual, jsTime, layoutTime }`
   * @param {{ target?: number }} opts  Default target = 16.667 ms (60 fps)
   * @returns {function} Unsubscribe function
   */
  onBudgetExceeded(cb, { target = 16.667 } = {}) {
    if (typeof __glyx_perf_set_budget !== 'undefined') __glyx_perf_set_budget(target);
    _perfBudgetCallbacks.push(cb);
    return function unsubscribe() {
      const idx = _perfBudgetCallbacks.indexOf(cb);
      if (idx !== -1) _perfBudgetCallbacks.splice(idx, 1);
    };
  },
  /**
   * Register a callback for dev-mode memory/node leak warnings.
   * Fires when the Rust layer detects a sustained monotonic growth in node count.
   * Only active in dev builds (no-op in production).
   * @param {(warning: {type: string, count: number, msg: string}) => void} cb
   * @returns {() => void} unsubscribe function
   */
  onLeakDetected(cb) {
    _perfLeakCallbacks.push(cb);
    return function unsubscribe() {
      const idx = _perfLeakCallbacks.indexOf(cb);
      if (idx !== -1) _perfLeakCallbacks.splice(idx, 1);
    };
  },
};
