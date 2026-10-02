// @glyx-dev/react — file system API.
import { _noBinding } from './_shared.js';

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
