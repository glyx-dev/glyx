// @glyx-dev/react — SQLite database + vector database API.
import { _noBinding } from './_shared.js';

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
