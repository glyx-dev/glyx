// @glyx-dev/react — scoped subprocess execution (Tier 1).
import { _noBinding } from './_shared.js';

// ── Shell (Tier 1: scoped exec) ─────────────────────────────────────────────
//
// Requires `shellExec: { allow: [...] }` capability in glyx.config.json —
// `bin` must exact-match an allowlist entry. Args are always passed as a
// real argv array (never through a shell interpreter), which is what
// actually prevents injection — not a string filter on top of it.
export const shell = {
  /**
   * Run `bin` with `args`, wait for completion, and return the buffered
   * output. For long-running commands where you need progress as it
   * happens rather than a single result at the end, a streaming
   * `shell.spawn()`/`shell.poll()` pair is planned but not yet implemented.
   * @param {string} bin - exact binary name, must be in `shellExec.allow`.
   * @param {string[]} [args]
   * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
   */
  run(bin, args = []) {
    if (typeof __glyx_shell_run === 'undefined') return _noBinding('shell.run');
    return __glyx_shell_run(bin, JSON.stringify(args)).then(JSON.parse);
  },
};
