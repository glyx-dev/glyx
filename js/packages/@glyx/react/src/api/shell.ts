// @glyx-dev/react — scoped subprocess execution (Tier 1).
import { _noBinding } from './_shared.js';
import { _readStreamOf, _streamCall, _writeStreamOf, streamLines } from './streams.js';
import type { FileReadStream, FileWriteStream } from './streams.js';

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
   * happens rather than a single result at the end, use `shell.spawn()`.
   * @param {string} bin - exact binary name, must be in `shellExec.allow`.
   * @param {string[]} [args]
   * @returns {Promise<{stdout: string, stderr: string, exitCode: number}>}
   */
  run(bin: any, args: any[] = []) {
    if (typeof __glyx_shell_run === 'undefined') return _noBinding('shell.run');
    return __glyx_shell_run(bin, JSON.stringify(args)).then(JSON.parse);
  },
  /**
   * Start `bin` with `args` and get its output as it is produced, instead of all at the end (`run`). `bin` must be in `shellExec.allow`, and
   * arguments are never given to a shell, exactly as for `run`. Returns at once with the running process:
   *
   * ```ts
   * const p = await shell.spawn('git', ['log', '--oneline'])
   * for await (const line of p.lines()) console.log(line)     // each line as it arrives
   * const { exitCode } = await p.wait()
   * ```
   *
   * Output is held back, not buffered: a reader nobody drains stops the child when the pipe fills, so read `stdout` and `stderr` (or start
   * with `stderr: 'ignore'`), or `kill()` it. `p.stdin` is there if you pass `stdin: true`: `await p.stdin.write(...)`, then `close()` to end
   * the child's input. A process belongs to the window that started it and is killed with it. Needs the `shellExec` capability and a runner
   * built with the `shell` feature.
   *
   * @param {string} bin - exact binary name, must be in `shellExec.allow`.
   * @param {string[]} [args]
   * @param {{ stdin?: boolean, stdout?: 'pipe' | 'ignore', stderr?: 'pipe' | 'ignore', timeoutMs?: number }} [opts]
   */
  async spawn(bin: string, args: string[] = [], opts: SpawnOptions = {}): Promise<ShellProcess> {
    if (typeof (globalThis as any).__glyx_backend_call2 !== 'function') return _noBinding('shell.spawn');
    const r = await _streamCall('glyx_stream.spawn', {
      bin, args, stdin: opts.stdin, stdout: opts.stdout, stderr: opts.stderr, timeoutMs: opts.timeoutMs,
    });
    const stdout = r.stdout == null ? null : _readStreamOf(r.stdout);
    const stderr = r.stderr == null ? null : _readStreamOf(r.stderr);
    const stdin = r.stdin == null ? null : _writeStreamOf(r.stdin);
    return {
      pid: r.pid ?? null,
      stdout,
      stderr,
      stdin,
      wait: async () => {
        const done = await _streamCall('glyx_stream.wait', { id: r.process });
        return { exitCode: done.exitCode, timedOut: done.timedOut };
      },
      kill: async () => { await _streamCall('glyx_stream.kill', { id: r.process }).catch(() => {}); },
      lines: (which = 'stdout') => {
        const stream = which === 'stderr' ? stderr : stdout;
        if (!stream) throw new Error(`shell.spawn: ${which} was started as 'ignore', so there are no lines to read`);
        return streamLines(stream);
      },
    };
  },
};

export interface SpawnOptions {
  /** Open the child's stdin as `process.stdin` (a write stream; close it to end the input). Default false: the child gets no input. */
  stdin?: boolean;
  /** `'ignore'` discards the child's stdout (there is no `process.stdout`). Default `'pipe'`. */
  stdout?: 'pipe' | 'ignore';
  stderr?: 'pipe' | 'ignore';
  /** Kill the child if it is still running after this long; `wait()` then says `timedOut`. Default: no limit. */
  timeoutMs?: number;
}

/** A process started by `shell.spawn`. */
export interface ShellProcess {
  readonly pid: number | null;
  readonly stdout: FileReadStream | null;
  readonly stderr: FileReadStream | null;
  readonly stdin: FileWriteStream | null;
  /** Resolves when the process has ended: its exit code (`-1` if it was killed or has none) and whether its `timeoutMs` ended it. Call it once. */
  wait(): Promise<{ exitCode: number; timedOut: boolean }>;
  /** Stop the process now. Harmless after it has ended. */
  kill(): Promise<void>;
  /** The lines of stdout (or stderr), as strings, as they arrive. */
  lines(which?: 'stdout' | 'stderr'): AsyncIterable<string>;
}

