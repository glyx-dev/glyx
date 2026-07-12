// @glyx-dev/react — native API bindings and frame poll state.
import { addKeyListener, registerSystemWatch, unregisterSystemWatch } from './events.js';

// ── WebSocket inbox polling ───────────────────────────────────────────────────
//
// Open sockets: id (number) → { onmessage, onclose, onerror }
export const _wsOpenSockets = new Map();

// ── IPC inbox polling ─────────────────────────────────────────────────────────
//
// Callbacks registered via ipc.on('message', cb).
export const _ipcListeners = [];

// ── Deep link polling ─────────────────────────────────────────────────────────
//
// Forwarded URLs arrive each frame via __glyx_deeplink_poll().
// The initial launch URL is retrieved once on startup via __glyx_deeplink_getInitialUrl().

export const _deeplinkCallbacks = [];
export let   _deeplinkInitialFired = false;

export function _pollDeeplinks() {
  // Fire initial URL once (the URL that launched this instance of the app).
  if (!_deeplinkInitialFired && _deeplinkCallbacks.length > 0) {
    _deeplinkInitialFired = true;
    if (typeof __glyx_deeplink_getInitialUrl !== 'undefined') {
      try {
        const url = __glyx_deeplink_getInitialUrl();
        if (url) {
          for (const cb of _deeplinkCallbacks) {
            try { cb(url); } catch (e) { __glyx_log('[deeplink] callback error: ' + e); }
          }
        }
      } catch {}
    }
  }

  // Drain forwarded URLs from the single-instance listener queue.
  if (typeof __glyx_deeplink_poll === 'undefined') return;
  let raw;
  try { raw = __glyx_deeplink_poll(); } catch { return; }
  if (!raw || raw === '[]') return;
  let urls;
  try { urls = JSON.parse(raw); } catch { return; }
  for (const url of urls) {
    for (const cb of _deeplinkCallbacks) {
      try { cb(url); } catch (e) { __glyx_log('[deeplink] callback error: ' + e); }
    }
  }
}

// ── Global shortcut polling ───────────────────────────────────────────────────
//
// Callbacks registered via input.globalShortcut.register(acc, cb).
export const _globalShortcutCallbacks = new Map();  // id (number) → cb

export function _pollGlobalShortcuts() {
  if (typeof __glyx_shortcut_poll === 'undefined') return;
  if (_globalShortcutCallbacks.size === 0) return;
  let raw;
  try { raw = __glyx_shortcut_poll(); } catch { return; }
  if (!raw || raw === '[]') return;
  let ids;
  try { ids = JSON.parse(raw); } catch { return; }
  for (const id of ids) {
    const cb = _globalShortcutCallbacks.get(id);
    if (cb) try { cb(); } catch (e) { __glyx_log('[shortcut] callback error: ' + e); }
  }
}

export function _pollGamepads() {
  if (typeof __glyx_gamepad_poll === 'undefined') return;
  if (!globalThis._gamepadCallbacks || globalThis._gamepadCallbacks.length === 0) return;
  let raw;
  try { raw = __glyx_gamepad_poll(); } catch { return; }
  if (!raw || raw === '[]') return;
  let evs;
  try { evs = JSON.parse(raw); } catch { return; }
  for (const ev of evs) {
    for (const cb of globalThis._gamepadCallbacks) {
      try { cb(ev); } catch (e) { __glyx_log('[gamepad] callback error: ' + e); }
    }
  }
}

// ── App-focused shortcut registry ─────────────────────────────────────────────
//
// Keyed by id; entries are { mods: {ctrl,shift,alt,meta}, key: string, cb }.
// Dispatched via addKeyListener registered below.
export const _localShortcuts = new Map();  // id → { mods, key, cb }
export let   _localShortcutNextId = 1;

// Normalize a winit physical key name to the shortcut token a user would type.
// winit sends KeyCode::Debug names: 'KeyG' → 'g', 'Digit1' → '1', 'Space' → 'space'.
function _normalizeKey(winitKey) {
  if (/^Key[A-Z]$/.test(winitKey))   return winitKey[3].toLowerCase();  // KeyG → g
  if (/^Digit\d$/.test(winitKey))    return winitKey[5];                 // Digit1 → 1
  return winitKey.toLowerCase();                                          // Space → space, F1 → f1
}

// Listen to every key event from events.js and check local shortcuts.
addKeyListener(function _dispatchLocalShortcuts({ key, ctrl, shift, pressed }) {
  if (!pressed || _localShortcuts.size === 0) return;
  const norm = _normalizeKey(key);
  for (const { mods, key: sKey, cb } of _localShortcuts.values()) {
    if (sKey === norm && mods.ctrl === ctrl && mods.shift === shift) {
      try { cb(); } catch (e) { __glyx_log('[shortcut] local callback error: ' + e); }
    }
  }
});

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

// ── Audio event polling ───────────────────────────────────────────────────────
//
// Drains `__glyx_audio_poll()` each frame and fires registered onEnded callbacks.
// Map: handle (string) → array of { onEnded } objects.

export const _audioCallbacks = new Map();

export function _pollAudio() {
  if (typeof __glyx_audio_poll === 'undefined') return;
  let raw;
  try { raw = __glyx_audio_poll(); } catch { return; }
  if (!raw || raw === '[]') return;
  let events;
  try { events = JSON.parse(raw); } catch { return; }
  for (const ev of events) {
    const key = String(ev.handle);
    const cbs = _audioCallbacks.get(key);
    if (cbs) {
      for (const cb of cbs) {
        if (ev.event === 'ended' && cb.onEnded) {
          try { cb.onEnded(); } catch (e) { __glyx_log('[audio] onEnded error: ' + e); }
        }
      }
      if (ev.event === 'ended') _audioCallbacks.delete(key);
    }
  }
}

// ── File system API ───────────────────────────────────────────────────────────
//
// All methods return Promises. Requires `fs.read` / `fs.write` capabilities
// declared in `glyx.config.json`. Attempting to call without the capability
// rejects the Promise with a descriptive error.
//
// Usage:
//   import { fs } from '@glyx-dev/react';
//   await fs.writeFile('data/notes.txt', 'hello');
//   const entries = await fs.listDir('data/');  // [{ name, isDir }, ...]

const _noBinding = (name) => Promise.reject(new Error(`${name}: binding not available`));

export const fs = {
  /** Read the entire file as a UTF-8 string. Requires `fs.read`. */
  readFile:   (path)          => typeof __glyx_readFile      !== 'undefined' ? __glyx_readFile(path)          : _noBinding('readFile'),
  /**
   * Read the entire file as raw bytes, returned as a base64-encoded string.
   * Use this for binary files (images, PDFs, etc.) before uploading via fetch multipart.
   * Requires `fs.read`.
   */
  readFileBytes: (path)       => typeof __glyx_readFileBytes !== 'undefined' ? __glyx_readFileBytes(path)     : _noBinding('readFileBytes'),
  /** Write (overwrite) a file with the given string content. Requires `fs.write`. */
  writeFile:  (path, content) => typeof __glyx_writeFile  !== 'undefined' ? __glyx_writeFile(path, content) : _noBinding('writeFile'),
  /** Append string content to a file (creates it if missing). Requires `fs.write`. */
  appendFile: (path, content) => typeof __glyx_appendFile !== 'undefined' ? __glyx_appendFile(path, content): _noBinding('appendFile'),
  /** List directory entries. Resolves with `[{ name: string, isDir: boolean }]`. Requires `fs.read`. */
  listDir:    (path)          => typeof __glyx_listDir    !== 'undefined' ? __glyx_listDir(path).then(JSON.parse)   : _noBinding('listDir'),
  /** Delete a file. Requires `fs.write`. */
  deleteFile: (path)          => typeof __glyx_deleteFile !== 'undefined' ? __glyx_deleteFile(path)         : _noBinding('deleteFile'),
  /** Create a directory and all missing parents. Requires `fs.write`. */
  mkdirp:     (path)          => typeof __glyx_mkdirp     !== 'undefined' ? __glyx_mkdirp(path)             : _noBinding('mkdirp'),
  /** Stat a file or directory. Resolves with `{ size, mtime, isDir, isFile }`. Requires `fs.read`. */
  stat:       (path)          => typeof __glyx_stat       !== 'undefined' ? __glyx_stat(path).then(JSON.parse)   : _noBinding('stat'),
  /** Rename (move) a file. Requires `fs.read` on src and `fs.write` on dst. */
  rename:     (src, dst)      => typeof __glyx_rename     !== 'undefined' ? __glyx_rename(src, dst)         : _noBinding('rename'),
  /** Copy a file. Requires `fs.read` on src and `fs.write` on dst. */
  copy:       (src, dst)      => typeof __glyx_copyFile   !== 'undefined' ? __glyx_copyFile(src, dst)       : _noBinding('copy'),
  /** Read a file as UTF-8 and parse as JSON. Requires `fs.read`. */
  readJSON:   async (path)          => JSON.parse(await fs.readFile(path)),
  /** Serialize `value` to JSON and write to a file. Requires `fs.write`. */
  writeJSON:  async (path, val, indent = 2) => fs.writeFile(path, JSON.stringify(val, null, indent)),
  /**
   * Watch `path` for changes. `callback` is called with `{ path, type }` on each event.
   * `type` is one of `"modified"`, `"created"`, `"removed"`, `"accessed"`, `"other"`.
   * Returns a Promise<watchId> — pass the id to `fs.unwatch()` to stop watching.
   * Requires `fs.read` capability.
   */
  watch: async (path, callback) => {
    if (typeof __glyx_fs_watch === 'undefined') return _noBinding('fs.watch');
    const id = await __glyx_fs_watch(path);
    _fsWatchCallbacks.set(id, callback);
    return id;
  },
  /** Stop watching the given watchId (returned from `fs.watch`). */
  unwatch: (id) => {
    _fsWatchCallbacks.delete(id);
    if (typeof __glyx_fs_unwatch !== 'undefined') __glyx_fs_unwatch(id);
  },
};

const _fsWatchCallbacks = new Map();

export function _pollFsWatch() {
  if (typeof __glyx_fs_watch_poll === 'undefined') return;
  const raw = __glyx_fs_watch_poll();
  if (!raw || raw === '[]') return;
  let events;
  try { events = JSON.parse(raw); } catch { return; }
  for (const ev of events) {
    const cb = _fsWatchCallbacks.get(ev.id);
    if (cb) cb({ path: ev.path, type: ev.type });
  }
}

// ── SQLite database API ───────────────────────────────────────────────────────
//
// Thin async wrapper over the Rust `sqlx` bindings. Requires `db: true` in
// `glyx.config.json`.
//
// Usage:
//   import { db } from '@glyx-dev/react';
//   const handle = await db.open('app.db');
//   await db.run(handle, 'CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT)');
//   await db.run(handle, 'INSERT INTO items (name) VALUES (?)', ['hello']);
//   const rows = await db.query(handle, 'SELECT * FROM items');  // [{ id, name }, ...]

// ── SQLite default-handle state ───────────────────────────────────────────────
//
// `_defaultHandle` is set automatically when the first db.open() resolves.
// This lets single-db apps skip passing the handle on every call:
//
//   Single-DB (simple):
//     await db.open('app.db');
//     await db.run('INSERT INTO items (name) VALUES (?)', ['hello']);
//     const rows = await db.query('SELECT * FROM items');
//
//   Multi-DB (explicit handle):
//     const h1 = await db.open('users.db');
//     const h2 = await db.open('logs.db');
//     db.setDefault(h2);
//     await db.run(h1, 'INSERT INTO users ...', []);   // explicit
//     await db.run('INSERT INTO logs ...', []);         // uses default (h2)

let _defaultHandle = null;
const _dbBackupTimers = new Map(); // handle → intervalId

function _parseInterval(s) {
  const map = { '1h': 3600000, '6h': 21600000, '12h': 43200000, '24h': 86400000, 'daily': 86400000 };
  if (map[s]) return map[s];
  const m = String(s).match(/^(\d+)(ms|s|m|h|d)$/);
  if (!m) return null;
  const n = Number(m[1]);
  const unit = { ms: 1, s: 1000, m: 60000, h: 3600000, d: 86400000 }[m[2]];
  return n * unit;
}

async function _runBackup(handle, dir, keep) {
  // Build a filename like: app-2026-07-09T14-00-00.sqlite
  const now = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const destPath = `${dir}/backup-${now}.sqlite`;
  await db.backup(handle, destPath);
  console.log(`[db] backup written to "${destPath}"`);

  // Prune old backups: list dir, filter backup-*.sqlite, delete oldest.
  if (typeof __glyx_listDir !== 'undefined' && keep > 0) {
    try {
      const entries = JSON.parse(await __glyx_listDir(dir));
      const backups = entries
        .filter(e => /^backup-\d{4}-\d{2}-\d{2}T[\d-]+\.sqlite$/.test(e.name ?? e))
        .map(e => e.name ?? e)
        .sort();
      const toDelete = backups.slice(0, Math.max(0, backups.length - keep));
      for (const name of toDelete) {
        await __glyx_deleteFile(`${dir}/${name}`);
        console.log(`[db] pruned old backup "${name}"`);
      }
    } catch (_) {}
  }
}

/** Resolve the handle: explicit number > default > error. */
function _dbHandle(h) {
  if (typeof h === 'number') return h;
  if (_defaultHandle !== null) return _defaultHandle;
  throw new Error('db: no handle provided and no default set (call db.open() first)');
}

export const db = {
  /**
   * Open (or create) a SQLite database at the given path.
   * `":memory:"` opens an in-memory database.
   * The first call auto-sets the default handle; use `db.setDefault(h)` to change it.
   * @returns {Promise<number>} Opaque integer handle for subsequent calls.
   */
  open: (path) =>
    typeof __glyx_db_open !== 'undefined'
      ? __glyx_db_open(path).then((s) => {
          const h = Number(s);
          if (_defaultHandle === null) _defaultHandle = h;
          return h;
        })
      : _noBinding('db.open'),

  /** Manually set the default handle used when no handle is passed to run/query/transaction. */
  setDefault: (handle) => { _defaultHandle = handle; },

  /**
   * Close a database and release its connections.
   * Idempotent — closing an already-closed handle is a no-op.
   * @param {number} [handle] - Defaults to the current default handle.
   * @returns {Promise<void>}
   */
  close: (handle) => {
    const h = handle ?? _defaultHandle;
    if (h === null || h === undefined) return Promise.resolve();
    if (_defaultHandle === h) _defaultHandle = null;
    return typeof __glyx_db_close !== 'undefined'
      ? __glyx_db_close(h)
      : _noBinding('db.close');
  },

  /**
   * Execute a SELECT statement and return all rows as plain objects.
   *
   * Overloaded — handle is optional when a default is set:
   *   db.query('SELECT * FROM items')             // uses default handle
   *   db.query('SELECT * FROM items WHERE id=?', [1])
   *   db.query(handle, 'SELECT * FROM items')     // explicit handle
   *   db.query(handle, 'SELECT * FROM items WHERE id=?', [1])
   *
   * @returns {Promise<Object[]>}
   */
  query: (handleOrSql, sqlOrParams = [], paramsOrUndef = []) => {
    const isExplicit = typeof handleOrSql === 'number';
    const handle = isExplicit ? handleOrSql        : _dbHandle(null);
    const sql    = isExplicit ? sqlOrParams         : handleOrSql;
    const params = isExplicit ? paramsOrUndef       : sqlOrParams;
    return typeof __glyx_db_query !== 'undefined'
      ? __glyx_db_query(handle, sql, JSON.stringify(params)).then(JSON.parse)
      : _noBinding('db.query');
  },

  /**
   * Execute an INSERT / UPDATE / DELETE / DDL statement.
   *
   * Overloaded — handle is optional when a default is set:
   *   db.run('CREATE TABLE IF NOT EXISTS ...')
   *   db.run('INSERT INTO items (name) VALUES (?)', ['hello'])
   *   db.run(handle, 'INSERT INTO items (name) VALUES (?)', ['hello'])
   *
   * @returns {Promise<{ rowsAffected: number, lastInsertId: number }>}
   */
  run: (handleOrSql, sqlOrParams = [], paramsOrUndef = []) => {
    const isExplicit = typeof handleOrSql === 'number';
    const handle = isExplicit ? handleOrSql  : _dbHandle(null);
    const sql    = isExplicit ? sqlOrParams   : handleOrSql;
    const params = isExplicit ? paramsOrUndef : sqlOrParams;
    return typeof __glyx_db_run !== 'undefined'
      ? __glyx_db_run(handle, sql, JSON.stringify(params)).then(JSON.parse)
      : _noBinding('db.run');
  },

  /**
   * Execute multiple SQL statements atomically in a single transaction.
   * Any failure rolls back all statements.
   *
   * Overloaded — handle is optional when a default is set:
   *   db.transaction([
   *     { sql: 'INSERT INTO a (x) VALUES (?)', params: [1] },
   *     { sql: 'UPDATE b SET n = n + 1 WHERE id = ?', params: [42] },
   *   ])
   *   db.transaction(handle, [...stmts])
   *
   * @returns {Promise<void>}
   */
  transaction: (handleOrStmts, stmtsOrUndef) => {
    const isExplicit = typeof handleOrStmts === 'number';
    const handle = isExplicit ? handleOrStmts : _dbHandle(null);
    const stmts  = isExplicit ? stmtsOrUndef  : handleOrStmts;
    return typeof __glyx_db_transaction !== 'undefined'
      ? __glyx_db_transaction(handle, JSON.stringify(stmts))
      : _noBinding('db.transaction');
  },

  /**
   * Run versioned schema migrations against an open database.
   *
   * Applied versions are tracked in the `_glyx_migrations` table so only
   * pending migrations run. Each migration is committed atomically together
   * with its tracking record — a partial failure leaves the database clean.
   *
   * Overloaded — handle is optional when a default is set:
   *   await db.migrate([{ version: 1, up: 'CREATE TABLE ...' }])
   *   await db.migrate(handle, [{ version: 1, up: '...' }])
   *
   * `up` can be a string (single statement) or array of strings (multiple).
   * An optional `name` field is stored for human-readable history.
   *
   * @returns {Promise<number>} Number of migrations applied this run.
   *
   * @example
   * await db.migrate([
   *   { version: 1, name: 'create_users',
   *     up: 'CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL)' },
   *   { version: 2, name: 'add_email',
   *     up: 'ALTER TABLE users ADD COLUMN email TEXT' },
   *   { version: 3, name: 'create_indexes',
   *     up: ['CREATE INDEX idx_users_email ON users(email)',
   *          'CREATE INDEX idx_users_name  ON users(name)'] },
   * ]);
   */
  migrate: async (handleOrMigrations, migrationsOrUndef) => {
    const isExplicit = typeof handleOrMigrations === 'number';
    const handle     = isExplicit ? handleOrMigrations : _dbHandle(null);
    const migrations = isExplicit ? migrationsOrUndef  : handleOrMigrations;

    if (!Array.isArray(migrations) || migrations.length === 0) return 0;

    const sorted = [...migrations].sort((a, b) => a.version - b.version);

    // Ensure tracking table exists.
    await db.run(handle,
      'CREATE TABLE IF NOT EXISTS _glyx_migrations ' +
      '(version INTEGER PRIMARY KEY, name TEXT, applied_at INTEGER DEFAULT (unixepoch()))'
    );

    const applied    = await db.query(handle, 'SELECT version FROM _glyx_migrations');
    const appliedSet = new Set(applied.map(r => r.version));
    const pending    = sorted.filter(m => !appliedSet.has(m.version));

    for (const m of pending) {
      const upSqls = Array.isArray(m.up) ? m.up : [m.up];
      // Run all up statements + tracking insert in a single transaction.
      await db.transaction(handle, [
        ...upSqls.map(sql => ({ sql })),
        {
          sql:    'INSERT INTO _glyx_migrations (version, name) VALUES (?, ?)',
          params: [m.version, m.name ?? 'migration_' + m.version],
        },
      ]);
    }

    if (pending.length > 0) {
      console.log(
        '[db] applied ' + pending.length + ' migration(s): ' +
        pending.map(m => 'v' + m.version + (m.name ? '(' + m.name + ')' : '')).join(', ')
      );
    }
    return pending.length;
  },

  /**
   * Run a seed function, optionally tracked so it only executes once per name.
   *
   * **Untracked** (no name): always runs — use when the function is already
   * idempotent (e.g. `INSERT OR IGNORE`).
   *
   * **Tracked** (with name): runs once and records in `_glyx_seeds`. On
   * subsequent starts the seed is skipped. Useful for dev fixtures or
   * default-settings rows.
   *
   * Overloaded — handle is optional when a default is set:
   *   db.seed(fn)                     // untracked, default handle
   *   db.seed('initial_data', fn)     // tracked by name, default handle
   *   db.seed(handle, fn)             // untracked, explicit handle
   *   db.seed(handle, 'initial', fn)  // tracked, explicit handle
   *
   * @example
   * // Always run (idempotent SQL):
   * await db.seed(async () => {
   *   await db.run('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)',
   *                ['theme','dark']);
   * });
   *
   * // Run once (dev fixtures):
   * await db.seed('sample_notes', async () => {
   *   await db.run('INSERT INTO notes (title,body) VALUES (?,?)',
   *                ['Welcome','Hello from Glyx!']);
   * });
   */
  /**
   * Create an atomic online backup of the database.
   * Uses SQLite's `VACUUM INTO` — works with WAL mode, does not block reads/writes.
   *
   * Overloaded — handle is optional when a default is set:
   *   await db.backup('./backups/app-2026-07-09.sqlite')
   *   await db.backup(handle, './backups/app.sqlite')
   *
   * The destination directory is created automatically.
   * Any existing file at destPath is overwritten atomically.
   *
   * @returns {Promise<void>}
   */
  backup: (handleOrPath, pathOrUndef) => {
    const isExplicit = typeof handleOrPath === 'number';
    const handle = isExplicit ? handleOrPath : _dbHandle(null);
    const path   = isExplicit ? pathOrUndef  : handleOrPath;
    if (!path) throw new Error('db.backup: destination path is required');
    return typeof __glyx_db_backup !== 'undefined'
      ? __glyx_db_backup(handle, path)
      : _noBinding('db.backup');
  },

  /**
   * Configure automatic backups for an open database.
   *
   * Options:
   *   dir      — backup directory (relative to app data dir, or absolute)
   *   interval — schedule: '1h', '6h', '12h', '24h', or milliseconds
   *   keep     — number of backup files to retain (oldest pruned, default 5)
   *   compress — not yet supported (reserved)
   *
   * Backups are named: `<basename>-<ISO8601>.sqlite`
   *   e.g. `app-2026-07-09T02-00-00.sqlite`
   *
   * Overloaded — handle is optional when a default is set:
   *   db.config({ backup: { dir: './backups', interval: '1h', keep: 5 } })
   *   db.config(handle, { backup: { dir: './backups', interval: '24h' } })
   *
   * Call `db.config()` with the same handle to cancel the existing schedule.
   */
  config: (handleOrOpts, optsOrUndef) => {
    const isExplicit = typeof handleOrOpts === 'number';
    const handle = isExplicit ? handleOrOpts : _dbHandle(null);
    const opts   = isExplicit ? optsOrUndef  : handleOrOpts;

    // Cancel any previous auto-backup timer for this handle.
    if (_dbBackupTimers.has(handle)) {
      clearInterval(_dbBackupTimers.get(handle));
      _dbBackupTimers.delete(handle);
    }

    if (!opts?.backup) return;
    const { dir = './backups', interval = '24h', keep = 5 } = opts.backup;

    const ms = typeof interval === 'number' ? interval : _parseInterval(interval);
    if (!ms || ms <= 0) throw new Error(`db.config: invalid interval "${interval}"`);

    const timer = setInterval(async () => {
      try {
        await _runBackup(handle, dir, keep);
      } catch (e) {
        console.warn('[db] auto-backup failed:', e?.message ?? e);
      }
    }, ms);

    _dbBackupTimers.set(handle, timer);
    console.log(`[db] auto-backup scheduled every ${interval}, dir="${dir}", keep=${keep}`);
  },

  seed: async (handleOrNameOrFn, nameOrFnOrUndef, fnOrUndef) => {
    let handle, name, fn;

    if (typeof handleOrNameOrFn === 'number') {
      handle = handleOrNameOrFn;
      if (typeof nameOrFnOrUndef === 'string') { name = nameOrFnOrUndef; fn = fnOrUndef; }
      else                                      { fn   = nameOrFnOrUndef; }
    } else if (typeof handleOrNameOrFn === 'string') {
      handle = _dbHandle(null);
      name   = handleOrNameOrFn;
      fn     = nameOrFnOrUndef;
    } else {
      handle = _dbHandle(null);
      fn     = handleOrNameOrFn;
    }

    if (typeof fn !== 'function') throw new Error('db.seed: expected a function');

    if (name !== undefined) {
      // Tracked — runs once per name.
      await db.run(handle,
        'CREATE TABLE IF NOT EXISTS _glyx_seeds ' +
        '(name TEXT PRIMARY KEY, seeded_at INTEGER DEFAULT (unixepoch()))'
      );
      const existing = await db.query(
        handle, 'SELECT name FROM _glyx_seeds WHERE name = ?', [name]
      );
      if (existing.length > 0) return;
      await fn();
      await db.run(handle, 'INSERT INTO _glyx_seeds (name) VALUES (?)', [name]);
      console.log('[db] seed applied: ' + name);
    } else {
      await fn();
    }
  },
};

// ── Vector Database ────────────────────────────────────────────────────────────
//
// vectorDb.open(path) → Promise<VectorDbHandle>
//
// VectorDbHandle:
//   .upsert(table, id, vector, metadata?) → Promise<void>
//   .search(table, queryVector, limit?)   → Promise<{id,score,metadata}[]>
//   .close()                             → Promise<void>

export const vectorDb = {
  /**
   * Open (or create) a vector store at the given path.
   * `":memory:"` opens an in-process ephemeral store (lost on close).
   * @param {string} path
   * @returns {Promise<VectorDbHandle>}
   */
  open: (path) => {
    if (typeof __glyx_vectorDb_open === 'undefined') return _noBinding('vectorDb.open');
    return __glyx_vectorDb_open(path).then((s) => {
      const handle = Number(s);
      return {
        /**
         * Insert or replace a vector record.
         * @param {string}   table    — collection name
         * @param {string}   id       — unique record key
         * @param {number[]} vector   — embedding (array of floats)
         * @param {any}      [meta]   — optional metadata (JSON-serialisable)
         * @returns {Promise<void>}
         */
        upsert(table, id, vector, meta) {
          const metaStr = meta !== undefined ? JSON.stringify(meta) : '';
          return __glyx_vectorDb_upsert(handle, table, id, JSON.stringify(vector), metaStr);
        },

        /**
         * Find the nearest vectors by cosine similarity.
         * @param {string}   table       — collection name
         * @param {number[]} queryVector — query embedding
         * @param {number}   [limit=10]  — max results
         * @returns {Promise<{id:string, score:number, metadata:any}[]>}
         */
        search(table, queryVector, limit = 10) {
          return __glyx_vectorDb_search(handle, table, JSON.stringify(queryVector), limit)
            .then(JSON.parse);
        },

        /**
         * Close the vector store and release its resources.
         * @returns {Promise<void>}
         */
        close() {
          return __glyx_vectorDb_close(handle);
        },
      };
    });
  },
};

// ── File Dialogs ───────────────────────────────────────────────────────────────
//
// Requires `dialog: true` capability in glyx.config.json.
//
// dialog.openFile({ filters?, multiple? }) → Promise<string[] | null>
// dialog.saveFile({ defaultName?, filters? }) → Promise<string | null>
// dialog.openFolder()                         → Promise<string | null>
//
// Filter shape: [{ name: string, extensions: string[] }]

export const dialog = {
  /**
   * Show a native open-file dialog.
   * @param {{ filters?: {name:string,extensions:string[]}[], multiple?: boolean }} [opts]
   * @returns {Promise<string[] | null>} Selected path(s), or null if cancelled.
   */
  openFile({ filters = [], multiple = false } = {}) {
    if (typeof __glyx_dialog_openFile === 'undefined') return _noBinding('dialog.openFile');
    return __glyx_dialog_openFile(JSON.stringify(filters), multiple).then(raw => {
      const result = JSON.parse(raw);
      if (result === null) return null;
      // multiple=false returns a bare JSON string; multiple=true returns a JSON array.
      // Always normalise to string[] so callers can use result[0] uniformly.
      return Array.isArray(result) ? result : [result];
    });
  },

  /**
   * Show a native save-file dialog.
   * @param {{ defaultName?: string, filters?: {name:string,extensions:string[]}[] }} [opts]
   * @returns {Promise<string | null>} Chosen save path, or null if cancelled.
   */
  saveFile({ defaultName = '', filters = [] } = {}) {
    if (typeof __glyx_dialog_saveFile === 'undefined') return _noBinding('dialog.saveFile');
    return __glyx_dialog_saveFile(defaultName, JSON.stringify(filters)).then(JSON.parse);
  },

  /**
   * Show a native open-folder dialog.
   * @returns {Promise<string | null>} Selected folder path, or null if cancelled.
   */
  openFolder() {
    if (typeof __glyx_dialog_openFolder === 'undefined') return _noBinding('dialog.openFolder');
    return __glyx_dialog_openFolder().then(JSON.parse);
  },
};

// ── Clipboard ─────────────────────────────────────────────────────────────────
//
// Requires `clipboard: true` capability in glyx.config.json.

export const clipboard = {
  /**
   * Read plain text from the system clipboard.
   * @returns {Promise<string>}
   */
  readText() {
    if (typeof __glyx_clipboard_readText === 'undefined') return _noBinding('clipboard.readText');
    return __glyx_clipboard_readText();
  },

  /**
   * Write plain text to the system clipboard.
   * @param {string} text
   * @returns {Promise<void>}
   */
  writeText(text) {
    if (typeof __glyx_clipboard_writeText === 'undefined') return _noBinding('clipboard.writeText');
    return __glyx_clipboard_writeText(text);
  },
};

// ── Notifications ─────────────────────────────────────────────────────────────
//
// Requires `notification: true` capability in glyx.config.json.

export const notification = {
  /**
   * Send a native desktop notification. Fire-and-forget; never rejects.
   * @param {{ title: string, body?: string }} opts
   * @returns {Promise<void>}
   */
  send({ title, body = '' }) {
    if (typeof __glyx_notification_send === 'undefined') return _noBinding('notification.send');
    return __glyx_notification_send(title, body);
  },
};

// ── fetch ─────────────────────────────────────────────────────────────────────
//
// Browser-compatible fetch API backed by the Rust reqwest HTTP client.
// Requires `network.allow` capability in glyx.config.json:
//   { "capabilities": { "network": { "allow": ["api.example.com"] } } }
// Use ["*"] to allow all outbound requests.
//
// Response shape mirrors the browser Fetch API (subset):
//   res.status      → number
//   res.ok          → boolean (true when 200-299)
//   res.statusText  → string
//   res.headers     → plain object  { "content-type": "..." }
//   res.text()      → Promise<string>
//   res.json()      → Promise<any>

/**
 * Make an HTTP request.
 *
 * Supports plain string bodies and multipart/form-data uploads:
 * ```js
 * // JSON POST
 * fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'},
 *              body: JSON.stringify(payload) });
 *
 * // Multipart upload (text field + binary file)
 * const bytes = await fs.readFileBytes(filePath);          // base64 string
 * fetch(url, { method: 'POST', multipart: [
 *   { name: 'description', value: 'my upload' },
 *   { name: 'file', filename: 'photo.jpg', base64: bytes, contentType: 'image/jpeg' },
 * ]});
 * ```
 *
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string,string>,
 *           body?: string,
 *           multipart?: Array<{name:string, value?:string, filename?:string,
 *                              base64?:string, contentType?:string}> }} [options]
 * @returns {Promise<{ status: number, ok: boolean, statusText: string,
 *                     headers: Record<string,string>,
 *                     text: () => Promise<string>, json: () => Promise<any> }>}
 */
// Case-insensitive, spec-compatible Headers (the runtime has no platform one).
class GlyxHeaders {
  constructor(init) {
    this._m = new Map();
    if (!init) return;
    if (init instanceof GlyxHeaders) { init.forEach((v, k) => this.set(k, v)); }
    else if (Array.isArray(init))     { for (const [k, v] of init) this.append(k, v); }
    else if (typeof init.forEach === 'function') { init.forEach((v, k) => this.set(k, v)); }
    else { for (const k of Object.keys(init)) this.set(k, init[k]); }
  }
  set(k, v)     { this._m.set(String(k).toLowerCase(), String(v)); }
  append(k, v)  { const lk = String(k).toLowerCase(); this._m.set(lk, this._m.has(lk) ? `${this._m.get(lk)}, ${v}` : String(v)); }
  get(k)        { const v = this._m.get(String(k).toLowerCase()); return v == null ? null : v; }
  has(k)        { return this._m.has(String(k).toLowerCase()); }
  delete(k)     { this._m.delete(String(k).toLowerCase()); }
  forEach(cb, t){ this._m.forEach((v, k) => cb.call(t, v, k, this)); }
  keys()        { return this._m.keys(); }
  values()      { return this._m.values(); }
  entries()     { return this._m.entries(); }
  [Symbol.iterator]() { return this._m.entries(); }
  toObject()    { const o = {}; this._m.forEach((v, k) => { o[k] = v; }); return o; }
}
export { GlyxHeaders as Headers };

// Build a Response-like object from the native fetch result. `clone()` re-derives
// a fresh, independently-consumable body from the same captured data.
function _makeResponse(data, url) {
  const headers  = new GlyxHeaders(data.headers || {});
  const bodyText = data.body ?? '';
  let used = false;
  const consume = () => { if (used) throw new TypeError('Body has already been consumed.'); used = true; };
  const toBytes = () => {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(bodyText);
    const u8 = new Uint8Array(bodyText.length);
    for (let i = 0; i < bodyText.length; i++) u8[i] = bodyText.charCodeAt(i) & 0xff;
    return u8;
  };
  return {
    url: data.url || url, status: data.status, ok: data.ok, statusText: data.statusText,
    headers, redirected: false, type: 'basic',
    get bodyUsed() { return used; },
    text:        () => { consume(); return Promise.resolve(bodyText); },
    json:        () => { consume(); return Promise.resolve(JSON.parse(bodyText)); },
    arrayBuffer: () => { consume(); return Promise.resolve(toBytes().buffer); },
    blob:        () => {
      consume();
      const u8 = toBytes();
      return Promise.resolve({
        size: u8.length, type: headers.get('content-type') || '',
        arrayBuffer: () => Promise.resolve(u8.buffer),
        text:        () => Promise.resolve(bodyText),
      });
    },
    clone: () => _makeResponse(data, url),
  };
}

export async function fetch(url, options = {}) {
  if (typeof __glyx_fetch === 'undefined') {
    throw new Error('fetch: __glyx_fetch binding is not available');
  }
  // Normalize request init to what the native binding expects (string body +
  // plain header object), while accepting the spec shapes libraries use.
  const init = { ...options };
  const hdrs = new GlyxHeaders(init.headers);
  if (init.body != null && typeof init.body !== 'string' && !init.multipart) {
    const b = init.body;
    const isBinary = b instanceof ArrayBuffer || ArrayBuffer.isView(b);
    if (!isBinary && typeof b === 'object') {
      // Convenience: plain object body → JSON.
      init.body = JSON.stringify(b);
      if (!hdrs.has('content-type')) hdrs.set('Content-Type', 'application/json');
    } else if (!isBinary) {
      init.body = String(b);
    }
    // (Binary request bodies aren't supported over the text channel — use the
    //  `multipart` option with base64 parts for file uploads.)
  }
  init.headers = hdrs.toObject();

  const raw = await __glyx_fetch(url, JSON.stringify(init));
  return _makeResponse(JSON.parse(raw), url);
}

// Expose `fetch` + `Headers` as globals (the embedded V8 runtime has no platform
// equivalents, so this is purely additive — nothing standard is shadowed). Lets
// web-oriented libraries (Supabase, Stripe, …) work unmodified; both remain
// importable from @glyx-dev/react.
//
// NOTE: response bodies cross the bridge as UTF-8 text, so `arrayBuffer()`/`blob()`
// are correct for text/JSON but lossy for true binary downloads (images). Fetch
// binary via a dedicated download/fs API instead.
if (typeof globalThis.fetch === 'undefined')   globalThis.fetch = fetch;
if (typeof globalThis.Headers === 'undefined') globalThis.Headers = GlyxHeaders;

// ── WebSocket ─────────────────────────────────────────────────────────────────
//
// Drains each open socket's inbox once per frame and fires registered handlers.
// Called from __glyx_frameCallback (defined above) inside flushSync so that
// onmessage callbacks that call setState are batched with the rest of the frame.
export function _pollWebSockets() {
  for (const [id, handlers] of _wsOpenSockets) {
    let raw;
    try { raw = __glyx_ws_poll(id); } catch { continue; }
    if (!raw) continue;
    let msgs;
    try { msgs = JSON.parse(raw); } catch { continue; }
    for (const m of msgs) {
      if (m === '__GLYX_WS_CLOSED__') {
        handlers.onclose?.();
        _wsOpenSockets.delete(id);
        break;
      } else {
        handlers.onmessage?.({ data: m });
      }
    }
  }
}

/**
 * WebSocket API.
 *
 * @example
 * const socket = await ws.connect('wss://echo.websocket.org', {
 *   onmessage: (ev) => console.log('received:', ev.data),
 *   onclose:   ()   => console.log('closed'),
 * });
 * socket.send('Hello!');
 * // later:
 * socket.close();
 */
// ── mDNS service discovery ────────────────────────────────────────────────────
//
// Requires `mdns: true` capability in glyx.config.json.
//
// Usage:
//   import { mdns } from '@glyx-dev/react';
//   const services = await mdns.discover('_http._tcp.local.', { timeout: 4000 });
//   // [{ name, hostname, port, addresses: string[] }, ...]

export const mdns = {
  /**
   * Browse for mDNS/Bonjour services of the given type.
   * @param {string} serviceType  e.g. "_http._tcp.local."
   * @param {{ timeout?: number }} [opts]  timeout in ms (default 5000)
   * @returns {Promise<{name:string, hostname:string, port:number, addresses:string[]}[]>}
   */
  discover(serviceType, { timeout = 5000 } = {}) {
    if (typeof __glyx_mdns_discover === 'undefined') return _noBinding('mdns.discover');
    return __glyx_mdns_discover(serviceType, timeout).then(JSON.parse);
  },
};

export const ws = {
  /**
   * Open a WebSocket connection.
   *
   * @param {string} url  ws:// or wss:// URL
   * @param {{ onmessage?: (ev: {data:string}) => void,
   *            onclose?:  () => void,
   *            onerror?:  (err: string) => void }} [handlers]
   * @returns {Promise<{ send: (msg:string)=>void, close: ()=>void, id: number }>}
   */
  connect(url, handlers = {}) {
    return __glyx_ws_connect(url).then(idStr => {
      const id = Number(idStr);
      _wsOpenSockets.set(id, handlers);
      return {
        get id() { return id; },
        send(msg)  { __glyx_ws_send(id, String(msg)); },
        close()    {
          __glyx_ws_close(id);
          _wsOpenSockets.delete(id);
          handlers.onclose?.();
        },
      };
    });
  },
};

// ── IPC (inter-window messaging) ──────────────────────────────────────────────
//
// Drain this window's IPC inbox each frame and fire registered listeners.
export function _pollIpc() {
  if (typeof __glyx_ipc_poll === 'undefined') return;
  let raw;
  try { raw = __glyx_ipc_poll(); } catch { return; }
  if (!raw) return;
  let msgs;
  try { msgs = JSON.parse(raw); } catch { return; }
  for (const msg of msgs) {
    for (const cb of _ipcListeners) {
      try { cb(msg); } catch {}
    }
  }
}

/**
 * Inter-window process communication.
 *
 * @example
 * // In window 0 (main):
 * const child = await glyxWindow.create({ title: 'Inspector', width: 400, height: 600 });
 * ipc.send(child.id, JSON.stringify({ type: 'init', data: 42 }));
 *
 * // In window N (secondary):
 * ipc.on('message', (msg) => console.log('received:', msg));
 */
export const ipc = {
  /**
   * Send a string message to another window by its handle.
   * @param {number} targetHandle
   * @param {string} message
   */
  send(targetHandle, message) {
    if (typeof __glyx_ipc_send !== 'undefined') {
      __glyx_ipc_send(targetHandle, String(message));
    }
  },

  /**
   * Register a callback for messages received by this window.
   * @param {'message'} event  — currently only 'message' is supported
   * @param {(msg: string) => void} callback
   * @returns {() => void}  unsubscribe function
   */
  on(event, callback) {
    if (event !== 'message') return () => {};
    _ipcListeners.push(callback);
    return () => {
      const idx = _ipcListeners.indexOf(callback);
      if (idx !== -1) _ipcListeners.splice(idx, 1);
    };
  },
};

// ── Multi-window ──────────────────────────────────────────────────────────────
//
// Extends glyxWindow with a create() method for opening secondary windows.
// This export adds to the existing glyxWindow object (defined earlier in the
// file) — import glyxWindow to use all window control methods.

/**
 * Open a secondary window running an independent instance of the app.
 * Returns a handle object usable with the `ipc` API.
 *
 * @param {{ title?: string, width?: number, height?: number }} opts
 * @returns {Promise<{ id: number, send: (msg: string) => void }>}
 *
 * @example
 * const win = await glyxWindow.create({ title: 'Inspector', width: 400, height: 600 });
 * win.send(JSON.stringify({ type: 'hello' }));
 */
export const glyxWindow = {
  setFullscreen:   (full)  => typeof __glyx_setFullscreen   !== 'undefined' && __glyx_setFullscreen(full),
  setMaximized:    (max)   => typeof __glyx_setMaximized    !== 'undefined' && __glyx_setMaximized(max),
  setMinimized:    ()      => typeof __glyx_setMinimized    !== 'undefined' && __glyx_setMinimized(),
  isFullscreen:    ()      => typeof __glyx_isFullscreen    !== 'undefined' ? __glyx_isFullscreen()    : false,
  isMaximized:     ()      => typeof __glyx_isMaximized     !== 'undefined' ? __glyx_isMaximized()     : false,
  getWindowSize:   ()      => typeof __glyx_getWindowSize   !== 'undefined' ? __glyx_getWindowSize()   : { width: 0, height: 0 },
  getScreenSize:   ()      => typeof __glyx_getScreenSize   !== 'undefined' ? __glyx_getScreenSize()   : { width: 0, height: 0 },
  setAlwaysOnTop:  (on)    => typeof __glyx_setAlwaysOnTop  !== 'undefined' && __glyx_setAlwaysOnTop(on),
  setTitle:        (title) => typeof __glyx_setTitle        !== 'undefined' && __glyx_setTitle(title),
  /** Set the mouse cursor icon: 'default' | 'pointer' | 'text' | 'move' |
   *  'grab' | 'grabbing' | 'col-resize' | 'row-resize' | 'ew-resize' |
   *  'ns-resize' | 'crosshair' | 'not-allowed' | 'wait'. */
  setCursor:       (name)  => typeof __glyx_setCursor       !== 'undefined' && __glyx_setCursor(name),
  /** Immediately run V8 GC + mimalloc segment decommit. The framework does
   *  this automatically on focus loss; call manually at level transitions or
   *  loading screens for faster memory recovery. */
  collectMemory:   ()      => typeof __glyx_collect_memory  !== 'undefined' && __glyx_collect_memory(),
  /** Open an http(s)/mailto URL in the OS default app (browser). */
  openExternal:    (url)   => typeof __glyx_open_external   !== 'undefined' && __glyx_open_external(url),
};

glyxWindow.create = function create(opts = {}) {
  if (typeof __glyx_window_create === 'undefined') return _noBinding('glyxWindow.create');
  return __glyx_window_create(JSON.stringify(opts)).then(idStr => {
    const id = Number(idStr);
    return {
      get id() { return id; },
      send(msg) { ipc.send(id, msg); },
    };
  });
};

/**
 * Quit the application — closes all windows and exits the event loop.
 * Safe to call from any window.
 */
glyxWindow.quit = function quit() {
  if (typeof __glyx_quit !== 'undefined') __glyx_quit();
};

/**
 * Restart the application — quits cleanly then re-launches the same executable.
 * Useful after applying an update or settings that require a full reload.
 */
glyxWindow.restart = function restart() {
  if (typeof __glyx_restart !== 'undefined') __glyx_restart();
};

/**
 * Close the window (main window: exits the app; secondary windows: closes that window).
 * In the current implementation this is equivalent to `glyxWindow.quit()`.
 */
glyxWindow.close = function close() {
  if (typeof __glyx_window_close !== 'undefined') __glyx_window_close();
};

/** Cache so platform() never calls the binding twice. */
let _platformCache = null;

/**
 * Returns the host OS: `"windows"` | `"macos"` | `"linux"`.
 * Value is determined at compile time and never changes at runtime.
 */
glyxWindow.platform = function platform() {
  if (_platformCache !== null) return _platformCache;
  _platformCache = typeof __glyx_platform !== 'undefined' ? __glyx_platform() : 'unknown';
  return _platformCache;
};

/**
 * Hide the splash screen overlay programmatically.
 *
 * Call this once your app has loaded its initial data and is ready to show
 * the main UI. If `minimumMs` is configured in glyx.config.json, the splash
 * stays visible for at least that duration even after this call.
 */
glyxWindow.hideSplash = function hideSplash() {
  if (typeof __glyx_splash_hide !== 'undefined') __glyx_splash_hide();
};

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

// ── Backend command dispatch ──────────────────────────────────────────────────
//
// Calls native Rust commands registered via GlyxExtension::register_commands().
//
// Usage (JS):
//   const result = await backend.greet({ name: 'Alice' });
//
// The Rust side:
//   cmds.add("greet", |args_json| async move {
//     let v: serde_json::Value = serde_json::from_str(&args_json)?;
//     Ok(format!("\"Hello, {}!\"", v["name"].as_str().unwrap_or("world")))
//   });
//
// `backend` is a Proxy so any property access returns an async function.
// The resolved value is JSON-parsed — return a JSON string from Rust/JS plugin.
//
// Two call styles are supported:
//   backend.myCommand(args)        — flat Rust command
//   backend.db.getUsers(args)      — namespaced JS plugin command ("db.getUsers")
//
// `backend.db` returns a namespace Proxy; calling it directly also works
// (backend.db(args) dispatches "db") for backward compatibility.

function _backendCall(cmd, args) {
  var json = args === undefined ? '{}' : JSON.stringify(args);
  return __glyx_backend_call(cmd, json).then(function(raw) {
    try { return JSON.parse(raw); } catch (_) { return raw; }
  });
}

function _backendNs(prefix) {
  // A Proxy over a function so it's both callable (backend.cmd(args)) and
  // has properties (backend.ns.fn(args)).
  return new Proxy(function() {}, {
    get: function(_, fn) {
      if (typeof fn !== 'string') return undefined;
      return function(args) { return _backendCall(prefix + '.' + fn, args); };
    },
    apply: function(_, __, a) { return _backendCall(prefix, a[0]); },
  });
}

export const backend = new Proxy(Object.create(null), {
  get: function(_, name) {
    if (typeof name !== 'string') return undefined;
    return _backendNs(name);
  },
});

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

// ── OS system APIs ────────────────────────────────────────────────────────────

export const battery = {
  /** @returns {Promise<{level:number, charging:boolean, timeRemainingSecs:number|null}|null>} */
  async getStatus() {
    if (typeof __glyx_battery_getStatus === 'undefined') return null;
    const raw = await __glyx_battery_getStatus();
    return raw === 'null' ? null : JSON.parse(raw);
  },
};

export const system = {
  /**
   * Subscribe to a system metric — "don't poll; subscribe."
   *
   * A RUST-side poller reads the metric on a timer and fires `cb` ONLY when
   * the value changes; V8 stays completely idle between changes.  Use this
   * instead of setInterval + getInfo()/getStatus() for live displays.
   *
   * Kinds and payloads:
   *   'battery'      → { level, charging, timeRemainingSecs } | null
   *   'memory'       → { usedMb, totalMb }
   *   'darkMode'     → 'dark' | 'light' | 'unknown'
   *   'batterySaver' → boolean
   *
   * @param {'battery'|'memory'|'darkMode'|'batterySaver'} kind
   * @param {(value: any) => void} cb
   * @param {{ intervalMs?: number }} [opts]  Poll cadence (floor 1000ms;
   *   defaults: 2s for darkMode/batterySaver, 10s for battery/memory).
   * @returns {number} watch id — pass to `system.unwatch(id)`.
   */
  watch(kind, cb, opts) {
    if (typeof __glyx_system_watch === 'undefined') return 0;
    const id = __glyx_system_watch(kind, (opts && opts.intervalMs) || 0);
    if (id > 0) registerSystemWatch(id, cb);
    return id;
  },
  /** Stop a `system.watch` subscription. */
  unwatch(id) {
    if (!id) return;
    unregisterSystemWatch(id);
    if (typeof __glyx_system_unwatch !== 'undefined') __glyx_system_unwatch(id);
  },
  /** @returns {Promise<{cpuName,cpuCores,memoryTotalMb,memoryUsedMb,osName,osVersion}>} */
  async getInfo() {
    if (typeof __glyx_system_getInfo === 'undefined') return null;
    return JSON.parse(await __glyx_system_getInfo());
  },
  /**
   * Returns the OS-level color scheme preference synchronously (~1 µs).
   * @returns {"dark"|"light"|"unknown"}
   */
  getDarkMode() {
    if (typeof __glyx_system_getDarkMode === 'undefined') return 'unknown';
    return __glyx_system_getDarkMode();
  },
  /**
   * Returns whether battery-saver / power-saver mode is active synchronously (~1 µs).
   * Windows: reads GetSystemPowerStatus(). macOS/Linux: always false until native support lands.
   * @returns {boolean}
   */
  isBatterySaverActive() {
    if (typeof __glyx_system_getBatterySaver === 'undefined') return false;
    return __glyx_system_getBatterySaver();
  },
};

export const power = {
  /** Prevent system sleep. Returns a guard handle string. */
  preventSleep(reason = 'Glyx app running') {
    if (typeof __glyx_power_preventSleep === 'undefined') return null;
    return __glyx_power_preventSleep(reason);
  },
  /** Release sleep prevention guard by handle string. */
  allowSleep(handle) {
    if (typeof __glyx_power_allowSleep !== 'undefined') __glyx_power_allowSleep(handle);
  },
};

export const storage = {
  /** @returns {Promise<Array<{name,mountPoint,totalBytes,availableBytes}>>} */
  async getDrives() {
    if (typeof __glyx_storage_getDrives === 'undefined') return [];
    return JSON.parse(await __glyx_storage_getDrives());
  },
};

/**
 * OS credential store — Windows Credential Manager, macOS Keychain, Linux Secret Service.
 * Data is encrypted by the OS and tied to the logged-in user account.
 * Never stored as plaintext on disk. Survives app restarts.
 *
 * Use for: auth tokens, session IDs, API keys the user provides at runtime.
 * Do NOT embed build-time secrets in the binary — use a backend proxy instead.
 *
 * Requires `credentials: true` in glyx.config.ts capabilities.
 */
export const credentials = {
  /**
   * Store a secret. Replaces any existing value for the same key.
   * @param {string} key
   * @param {string} value
   * @param {{ service?: string }} [options]  service defaults to 'glyx'
   * @returns {Promise<void>}
   */
  async set(key, value, { service = 'glyx' } = {}) {
    await __glyx_credentials_set(service, key, value);
  },
  /**
   * Retrieve a secret. Returns null if no entry exists.
   * @param {string} key
   * @param {{ service?: string }} [options]
   * @returns {Promise<string|null>}
   */
  async get(key, { service = 'glyx' } = {}) {
    const raw = await __glyx_credentials_get(service, key);
    return raw === 'null' ? null : JSON.parse(raw);
  },
  /**
   * Delete a secret. No-op if it does not exist.
   * @param {string} key
   * @param {{ service?: string }} [options]
   * @returns {Promise<void>}
   */
  async delete(key, { service = 'glyx' } = {}) {
    await __glyx_credentials_delete(service, key);
  },
};

// ── Audio playback ────────────────────────────────────────────────────────────

/**
 * Audio playback API.
 *
 * Capability: `audio: true` in glyx.config.json.
 *
 * @example
 * const player = await audio.play('/path/to/file.mp3');
 * player.pause();
 * player.setVolume(0.5);
 * player.stop();
 */
export const audio = {
  /**
   * Play an audio file. Returns a player handle.
   * @param {string} src  Absolute path to the audio file (mp3, flac, ogg, wav).
   * @param {{ volume?: number, onEnded?: function }} [opts]
   * @returns {Promise<{ id: string, pause, resume, stop, setVolume, getVolume }>}
   */
  async play(src, { volume = 1.0, onEnded } = {}) {
    if (typeof __glyx_audio_play === 'undefined')
      throw new Error('audio binding unavailable');
    const rawId = await __glyx_audio_play(src, JSON.stringify({ volume }));
    const id = String(JSON.parse(rawId));
    if (onEnded) {
      if (!_audioCallbacks.has(id)) _audioCallbacks.set(id, []);
      _audioCallbacks.get(id).push({ onEnded });
    }
    return {
      id,
      pause()           { if (typeof __glyx_audio_pause     !== 'undefined') __glyx_audio_pause(id); },
      resume()          { if (typeof __glyx_audio_resume    !== 'undefined') __glyx_audio_resume(id); },
      play()            { if (typeof __glyx_audio_resume    !== 'undefined') __glyx_audio_resume(id); },
      stop()            { if (typeof __glyx_audio_stop      !== 'undefined') __glyx_audio_stop(id); _audioCallbacks.delete(id); },
      setVolume(v)      { if (typeof __glyx_audio_setVolume !== 'undefined') __glyx_audio_setVolume(id, v); },
      getVolume()       { return typeof __glyx_audio_getVolume !== 'undefined' ? __glyx_audio_getVolume(id) : 1.0; },
      getTime()         { return typeof __glyx_audio_get_time !== 'undefined' ? __glyx_audio_get_time(id) : 0.0; },
      async getDuration() { return typeof __glyx_audio_duration !== 'undefined' ? parseFloat(await __glyx_audio_duration(id)) : -1; },
      async seek(secs)  { if (typeof __glyx_audio_seek !== 'undefined') await __glyx_audio_seek(id, secs); },
      onEnded(cb)       {
        if (!_audioCallbacks.has(id)) _audioCallbacks.set(id, []);
        _audioCallbacks.get(id).push({ onEnded: cb });
      },
    };
  },
};

// ── Local AI (Candle) ─────────────────────────────────────────────────────────
//
// Capability gate: `ai: true` in glyx.config.json.
//
// Models are downloaded from HuggingFace Hub on first call and cached in
// ~/.cache/huggingface/. Subsequent calls reuse cached weights.
//
// WARNING: first calls block until download completes:
//   - ai.embed()      — ~22 MB (MiniLM-L6-v2), loads in ~1s after download
//   - ai.generate()   — ~1.7 GB (Phi-2 Q4_K_M), CPU inference ~10-30s/200 tokens
//   - ai.transcribe() — ~75 MB (Whisper-tiny), ~5s for a 30s clip

export const ai = {
  /**
   * Embed text into a 384-dimensional unit-normalised vector.
   *
   * Uses sentence-transformers/all-MiniLM-L6-v2. Suitable for cosine-similarity
   * search with the `vectorDb` API — replaces keyword-bag fake embeddings.
   *
   * @param {string} text
   * @returns {Promise<number[]>}  384-element float32 array
   */
  async embed(text) {
    if (typeof __glyx_ai_embed === 'undefined')
      throw new Error('ai.embed: binding unavailable — add ai:true to glyx.config.json');
    const raw = await __glyx_ai_embed(String(text));
    return JSON.parse(raw);
  },

  /**
   * Generate text from a prompt using Phi-2 (quantized Q4_K_M, CPU).
   *
   * Resolves with the full generated string when done.
   * Long-running — expect 10-30 seconds per 200 tokens on CPU.
   *
   * @param {string} prompt
   * @param {{ maxTokens?: number, temperature?: number }} [opts]
   * @returns {Promise<string>}
   */
  async generate(prompt, { maxTokens = 200, temperature = 0.7 } = {}) {
    if (typeof __glyx_ai_generate === 'undefined')
      throw new Error('ai.generate: binding unavailable — add ai:true to glyx.config.json');
    return __glyx_ai_generate(String(prompt), JSON.stringify({ maxTokens, temperature }));
  },

  /**
   * Transcribe an audio file to text using Whisper-tiny (CPU).
   *
   * Supports WAV (16 kHz mono preferred), MP3, FLAC, OGG.
   *
   * @param {string} audioPath  Absolute path to the audio file
   * @param {{ language?: string }} [opts]  ISO 639-1 code, e.g. 'en'; empty = auto-detect
   * @returns {Promise<string>}  Plain text transcript
   */
  async transcribe(audioPath, { language = '' } = {}) {
    if (typeof __glyx_ai_transcribe === 'undefined')
      throw new Error('ai.transcribe: binding unavailable — add ai:true to glyx.config.json');
    return __glyx_ai_transcribe(String(audioPath), JSON.stringify({ language }));
  },

  /** Unload API — free model RAM immediately without restarting the app. */
  unload: {
    embed()      { if (typeof __glyx_ai_unload_embed      !== 'undefined') __glyx_ai_unload_embed(); },
    generate()   { if (typeof __glyx_ai_unload_generate   !== 'undefined') __glyx_ai_unload_generate(); },
    transcribe() { if (typeof __glyx_ai_unload_transcribe !== 'undefined') __glyx_ai_unload_transcribe(); },
  },
};

// ── Camera API ────────────────────────────────────────────────────────────────

export const camera = {
  /** List connected camera devices. @returns {Promise<{index:number,name:string}[]>} */
  async listDevices() {
    return JSON.parse(await __glyx_camera_list());
  },
  /** Open camera by device index. @returns {Promise<number>} handle ID */
  async open(deviceIndex = 0) {
    return parseInt(await __glyx_camera_open(deviceIndex));
  },
  /** Close a previously opened camera. @param {number} handle */
  close(handle) {
    __glyx_camera_close(String(handle));
  },
  /**
   * Capture the current frame as a PNG file.
   * @param {number} handle  Handle returned by open() or Camera.start().
   * @returns {Promise<string>}  Absolute path to the saved PNG.
   */
  async capture(handle) {
    return __glyx_camera_capture(String(handle));
  },
  /**
   * Start recording to an MP4 file via ffmpeg (must be in PATH).
   * @param {number} handle
   * @param {string} outputPath  Absolute path for the output MP4.
   */
  startRecord(handle, outputPath) {
    __glyx_camera_record_start(String(handle), outputPath);
  },
  /**
   * Stop recording and flush the MP4.
   * @param {number} handle
   * @returns {Promise<string>}  Absolute path to the finished MP4.
   */
  async stopRecord(handle) {
    return __glyx_camera_record_stop(String(handle));
  },
};

// ── Microphone API ────────────────────────────────────────────────────────────

export const microphone = {
  /** List connected input devices. @returns {Promise<{name:string}[]>} */
  async listDevices() {
    return JSON.parse(await __glyx_microphone_list());
  },
  /**
   * Record from the microphone to a WAV file.
   * @param {number} [durationMs=3000] Recording duration in milliseconds.
   * @param {string|null} [deviceName=null] Device name, or null for default.
   * @returns {Promise<string>} Absolute path to the recorded WAV file.
   */
  async record(durationMs = 3000, deviceName = null) {
    return __glyx_microphone_record(deviceName || '', durationMs);
  },
};

// ── HID API ───────────────────────────────────────────────────────────────────

/**
 * Human Interface Device (HID) API — USB gamepads, custom hardware, etc.
 *
 * Requires `hid: true` in glyx.config.json.
 */
export const hid = {
  /**
   * List all connected HID devices.
   * @returns {Promise<{vendorId,productId,manufacturer,product,serialNumber,interfaceNumber,path}[]>}
   */
  async enumerate() {
    return JSON.parse(await __glyx_hid_enumerate());
  },
  /**
   * Open a HID device by vendor + product ID.
   * @param {number} vendorId
   * @param {number} productId
   * @returns {Promise<number>} Handle ID.
   */
  async open(vendorId, productId) {
    return parseInt(await __glyx_hid_open(vendorId, productId));
  },
  /**
   * Read bytes from an open HID device.
   * @param {number} handle   Handle returned by open().
   * @param {number} [timeoutMs=100]
   * @returns {Promise<number[]>} Array of byte values (up to 64).
   */
  async read(handle, timeoutMs = 100) {
    return JSON.parse(await __glyx_hid_read(handle, timeoutMs));
  },
  /**
   * Write bytes to an open HID device.
   * @param {number} handle   Handle returned by open().
   * @param {number[]} data   Array of byte values.
   * @returns {Promise<number>} Number of bytes written.
   */
  async write(handle, data) {
    return parseInt(await __glyx_hid_write(handle, JSON.stringify(data)));
  },
  /**
   * Close a HID device handle.
   * @param {number} handle
   */
  close(handle) {
    __glyx_hid_close(handle);
  },
};

// ── Auto-updater API ──────────────────────────────────────────────────────────

/**
 * Auto-updater — check for and apply updates.
 *
 * Requires `updater: true` in glyx.config.json.
 *
 * ## Manifest-based flow (recommended)
 *
 * Host a `latest.json` on any static server:
 * ```json
 * {
 *   "version":     "2.1.0",
 *   "update_type": "js_only",   // "js_only" | "runner" | "full"
 *   "notes":       "Bug fixes",
 *   "js_url":      "https://cdn.example.com/2.1.0/app.js",
 *   "js_sha256":   "abc123..."
 * }
 * ```
 *
 * Then in your app:
 * ```js
 * const manifest = await updater.checkManifest('https://cdn.example.com/latest.json');
 * if (manifest) {
 *   if (manifest.update_type === 'js_only') {
 *     await updater.downloadJs(manifest.js_url, manifest.js_sha256);
 *     glyxWindow.restart();   // applies on next launch automatically
 *   } else {
 *     // runner/full: use updater.update() for GitHub releases, or direct download
 *   }
 * }
 * ```
 *
 * ## GitHub-release flow (binary updates)
 *
 * ```js
 * const info = await updater.check('myorg', 'myapp', '1.0.0');
 * if (info.hasUpdate) {
 *   const result = await updater.update('myorg', 'myapp', 'myapp', '1.0.0');
 *   if (result.updated) { // show "restart required" dialog }
 * }
 * ```
 */
export const updater = {
  /**
   * Returns the app version declared in `glyx.config.json` (`version` field),
   * or `"0.0.0"` if not set.
   * @returns {string}
   */
  getVersion() {
    return __glyx_updater_get_version();
  },

  /**
   * Returns the current platform identifier: `"windows"`, `"macos"`, or `"linux"`.
   * Matches the `_platform` field injected into manifests by `checkManifest`.
   * @returns {string}
   */
  getPlatform() {
    return __glyx_platform();
  },

  /**
   * Fetch a JSON manifest from `url` and compare its `version` field against
   * `currentVersion` (defaults to `updater.getVersion()` when omitted).
   *
   * Returns `null` when already up to date **or** when the manifest's optional
   * `platforms` array does not include the current OS.
   *
   * The returned manifest includes a `_platform` key (e.g. `"windows"`) so you
   * can read platform-specific asset URLs:
   * ```js
   * const m = await updater.checkManifest('https://cdn.example.com/latest.json');
   * if (m && m.update_type === 'runner') {
   *   const { runner_url, runner_sha256 } = m[m._platform] ?? {};
   * }
   * ```
   * @param {string}  url            URL of the JSON manifest.
   * @param {string=} currentVersion Semver string to compare against. Defaults to app version.
   * @returns {Promise<object|null>}  Manifest object if a newer version exists, otherwise null.
   */
  async checkManifest(url, currentVersion) {
    const current = currentVersion ?? updater.getVersion();
    const raw = await __glyx_updater_check_manifest(url, current);
    return raw === 'null' ? null : JSON.parse(raw);
  },

  /**
   * Download a JS bundle from `url`, verify its SHA-256 digest, and stage it
   * for the next restart. On next launch the runner loads the staged JS
   * instead of the trailer bundle — completing a JS-only update with zero downtime.
   * @param {string}  url    Direct download URL of the new `app.js`.
   * @param {string=} sha256 Expected SHA-256 hex digest. Pass `""` to skip verification.
   * @returns {Promise<void>}
   */
  async downloadJs(url, sha256 = '') {
    await __glyx_updater_download_js(url, sha256);
  },

  /**
   * Check GitHub releases for a newer version.
   * @param {string} owner          GitHub owner (user or org).
   * @param {string} repo           Repository name.
   * @param {string} currentVersion Current semver string (e.g. "1.0.0").
   * @returns {Promise<{hasUpdate:boolean, latestVersion:string, body:string}>}
   */
  async check(owner, repo, currentVersion) {
    return JSON.parse(await __glyx_updater_check(owner, repo, currentVersion));
  },

  /**
   * Download the latest GitHub release and replace the running binary.
   * The caller should prompt the user to restart the app after this resolves.
   * @param {string} owner          GitHub owner.
   * @param {string} repo           Repository name.
   * @param {string} binName        Binary asset name (without .exe — added on Windows).
   * @param {string} currentVersion Current semver string.
   * @returns {Promise<{updated:boolean, latestVersion:string}>}
   */
  async update(owner, repo, binName, currentVersion) {
    return JSON.parse(await __glyx_updater_update(owner, repo, binName, currentVersion));
  },
};

// ── Video API ─────────────────────────────────────────────────────────────────
//
// Low-level bindings for the glyx-media DLL decoder.
// Requires `video: true` in glyx.config.json.
// For a ready-made component, use the `<Video>` component (Phase 16H v3).
//
// Usage:
//   const handleId = await video.open('/path/to/movie.mp4');
//   // pass handleId as `videoHandle` prop to a <View nodeType="video"> node
//   video.seek(handleId, 30.0);  // jump to 30 seconds
//   video.close(handleId);

// Internal: video event listeners
// handleId → { onEnded, onMetadata, onTimeUpdate, onError }
export const _videoCallbacks = new Map();
export function _pollVideo() {
  if (typeof __glyx_video_poll === 'undefined') return;
  const events = JSON.parse(__glyx_video_poll());
  for (const ev of events) {
    const cbs = _videoCallbacks.get(ev.id);
    if (!cbs) continue;
    if      (ev.type === 'ended'      && cbs.onEnded)      cbs.onEnded();
    else if (ev.type === 'metadata'   && cbs.onMetadata)   cbs.onMetadata(ev);
    else if (ev.type === 'timeupdate' && cbs.onTimeUpdate) cbs.onTimeUpdate(ev.currentTime);
    else if (ev.type === 'error'      && cbs.onError)      cbs.onError(ev.message);
  }
}

export const video = {
  /**
   * Open a video file or URL for playback.
   * @param {string} url
   * @param {{ onEnded?, onMetadata?, onTimeUpdate?, onError? }} opts
   * @returns {Promise<number>} Resolves with the video handle ID.
   */
  async open(url, { onEnded, onMetadata, onTimeUpdate, onError } = {}) {
    const handleId = parseInt(await __glyx_video_open(url));
    _videoCallbacks.set(handleId, { onEnded, onMetadata, onTimeUpdate, onError });
    return handleId;
  },
  /** Seek to `seconds`. */
  seek(handleId, seconds) {
    __glyx_video_seek(String(handleId), Math.max(0, seconds));
  },
  /** Set playback volume (0.0 = mute, 1.0 = normal, up to 2.0). */
  setVolume(handleId, volume) {
    __glyx_video_set_volume(String(handleId), volume);
  },
  /** Pause decode and audio threads. */
  pause(handleId) {
    __glyx_video_pause(String(handleId));
  },
  /** Resume after pause. */
  play(handleId) {
    __glyx_video_play(String(handleId));
  },
  /** Close and release the video handle. */
  close(handleId) {
    __glyx_video_close(String(handleId));
    _videoCallbacks.delete(handleId);
  },
};

export const input = {
  gamepads: {
    /**
     * Register a callback fired for every gamepad event polled each frame.
     * @param {function} cb  Called with `{id, name, event: {type, ...}}`
     * @returns {function} Unsubscribe
     */
    onInput(cb) {
      const key = Symbol();
      // poll gamepads each frame and fire cb
      const prev = globalThis.__glyx_gamepadCb;
      if (!globalThis._gamepadCallbacks) globalThis._gamepadCallbacks = [];
      globalThis._gamepadCallbacks.push(cb);
      return function unsubscribe() {
        const arr = globalThis._gamepadCallbacks;
        if (arr) {
          const i = arr.indexOf(cb);
          if (i !== -1) arr.splice(i, 1);
        }
      };
    },
  },

  /** System-wide shortcuts — fires even when the app is backgrounded. */
  globalShortcut: {
    /**
     * @param {string} accelerator  e.g. "ctrl+shift+v"
     * @param {function} cb
     * @returns {string} id — pass to unregister()
     */
    register(accelerator, cb) {
      if (typeof __glyx_shortcut_register === 'undefined') return null;
      try {
        const id = Number(__glyx_shortcut_register(accelerator));
        _globalShortcutCallbacks.set(id, cb);
        return String(id);
      } catch (e) {
        __glyx_log('[shortcut] register error: ' + e);
        return null;
      }
    },
    unregister(id) {
      const numId = Number(id);
      _globalShortcutCallbacks.delete(numId);
      if (typeof __glyx_shortcut_unregister !== 'undefined') __glyx_shortcut_unregister(String(numId));
    },
  },

  /** App-focused shortcuts — fires when the app window is focused (no OS registration). */
  shortcut: {
    /**
     * @param {string} accelerator  e.g. "ctrl+k"
     * @param {function} cb
     * @returns {number} id — pass to unregister()
     */
    register(accelerator, cb) {
      const parts = accelerator.toLowerCase().split('+').map(s => s.trim());
      const mods = { ctrl: false, shift: false, alt: false, meta: false };
      let key = null;
      for (const p of parts) {
        if (p === 'ctrl' || p === 'control') mods.ctrl = true;
        else if (p === 'shift') mods.shift = true;
        else if (p === 'alt') mods.alt = true;
        else if (p === 'meta' || p === 'cmd' || p === 'win') mods.meta = true;
        else key = p;
      }
      const id = _localShortcutNextId++;
      _localShortcuts.set(id, { mods, key, cb });
      return id;
    },
    unregister(id) { _localShortcuts.delete(id); },
  },
};

// ── Deep links ────────────────────────────────────────────────────────────────

/**
 * Deep-link URL handling.
 *
 * Fires for both the initial launch URL (the URL that opened the app) and
 * any URLs forwarded by a second instance (when `singleInstance: true`).
 *
 * @example
 * import { deeplink } from '@glyx-dev/react';
 * deeplink.onOpen((url) => {
 *   // url = "notes://note/42"
 *   navigate('noteDetail', { id: url.split('/').pop() });
 * });
 */
export const deeplink = {
  /**
   * Register a callback fired for every deep-link URL, including the initial launch URL.
   * @param {function(string): void} cb  Called with the full URL string.
   * @returns {function} Unsubscribe function.
   */
  onOpen(cb) {
    _deeplinkCallbacks.push(cb);
    return function unsubscribe() {
      const i = _deeplinkCallbacks.indexOf(cb);
      if (i !== -1) _deeplinkCallbacks.splice(i, 1);
    };
  },
};
