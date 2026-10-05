// @glyx-dev/react — crash reporter (JS errors + unhandled rejections).

// ── Crash reporter ────────────────────────────────────────────────────────────

/**
 * Crash reporter API.
 *
 * Requires `crash: true` in glyx.config.json.
 *
 * JS errors are captured automatically via `globalThis.onerror` and
 * `globalThis.onunhandledrejection`. Use `crash.getReports()` on next
 * launch to detect prior crashes and offer diagnostic options.
 */
export const crash = {
  /** @private — configurable endpoint URL for report upload */
  _endpoint: null,

  /**
   * Retrieve all stored crash reports.
   * @returns {Promise<{file:string, content:string}[]>}
   */
  async getReports() {
    return JSON.parse(await __glyx_crash_get_reports());
  },

  /** Delete all stored crash reports from disk. */
  clearReports() {
    if (typeof __glyx_crash_clear_reports !== 'undefined') {
      __glyx_crash_clear_reports();
    }
  },

  /**
   * Configure an endpoint URL that crash reports are POSTed to on next launch.
   * The upload itself is performed by the app — this only stores the URL.
   * @param {string|null} url  Full URL (HTTPS recommended). Pass null to disable.
   */
  setEndpoint(url) {
    crash._endpoint = url;
  },
};

// Automatically capture JS errors and unhandled promise rejections.
// These are stored on disk so they survive the current process.
// Requires `crash: true` in glyx.config.json (the binding throws if not set).
(function _installCrashHandlers() {
  function _report(data) {
    try {
      if (typeof __glyx_crash_report_js !== 'undefined') {
        __glyx_crash_report_js(JSON.stringify(data));
      }
    } catch (_) {}
  }

  const prevOnerror = globalThis.onerror;
  globalThis.onerror = function(msg, src, line, col, err) {
    _report({
      type:    'js_error',
      timestamp: Date.now(),
      message: String(msg || ''),
      source:  String(src || ''),
      line:    line || 0,
      col:     col  || 0,
      stack:   err && err.stack ? String(err.stack) : '',
    });
    if (typeof prevOnerror === 'function') prevOnerror(msg, src, line, col, err);
  };

  const prevUnhandled = globalThis.onunhandledrejection;
  globalThis.onunhandledrejection = function(event) {
    const reason = event && event.reason;
    _report({
      type:    'unhandled_rejection',
      timestamp: Date.now(),
      message: reason instanceof Error ? reason.message : String(reason || ''),
      stack:   reason instanceof Error && reason.stack ? String(reason.stack) : '',
    });
    if (typeof prevUnhandled === 'function') prevUnhandled(event);
  };
})();
