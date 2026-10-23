// @glyx-dev/react — file system API.
import { _noBinding } from './_shared.js';
import { _openRead, _openWrite, _walk } from './streams.js';
import type { FileReadStream, FileWriteStream, FileWalk, OpenReadOptions, OpenWriteOptions, WalkOptions } from './streams.js';

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
  readFile:   (path: any)          => typeof __glyx_readFile      !== 'undefined' ? __glyx_readFile(path)          : _noBinding('readFile'),
  /**
   * Read the entire file as raw bytes, returned as a base64-encoded string.
   * Use this for binary files (images, PDFs, etc.) before uploading via fetch multipart.
   * Requires `fs.read`.
   */
  readFileBytes: (path: any)       => typeof __glyx_readFileBytes !== 'undefined' ? __glyx_readFileBytes(path)     : _noBinding('readFileBytes'),
  /** Write (overwrite) a file with the given string content. Requires `fs.write`. */
  writeFile:  (path: any, content: any) => typeof __glyx_writeFile  !== 'undefined' ? __glyx_writeFile(path, content) : _noBinding('writeFile'),
  /** Append string content to a file (creates it if missing). Requires `fs.write`. */
  appendFile: (path: any, content: any) => typeof __glyx_appendFile !== 'undefined' ? __glyx_appendFile(path, content): _noBinding('appendFile'),
  /** List directory entries. Resolves with `[{ name: string, isDir: boolean }]`. Requires `fs.read`. */
  listDir:    (path: any)          => typeof __glyx_listDir    !== 'undefined' ? __glyx_listDir(path).then(JSON.parse)   : _noBinding('listDir'),
  /** Delete a file. Requires `fs.write`. */
  deleteFile: (path: any)          => typeof __glyx_deleteFile !== 'undefined' ? __glyx_deleteFile(path)         : _noBinding('deleteFile'),
  /** Create a directory and all missing parents. Requires `fs.write`. */
  mkdirp:     (path: any)          => typeof __glyx_mkdirp     !== 'undefined' ? __glyx_mkdirp(path)             : _noBinding('mkdirp'),
  /** Stat a file or directory. Resolves with `{ size, mtime, isDir, isFile }`. Requires `fs.read`. */
  stat:       (path: any)          => typeof __glyx_stat       !== 'undefined' ? __glyx_stat(path).then(JSON.parse)   : _noBinding('stat'),
  /** Rename (move) a file. Requires `fs.read` on src and `fs.write` on dst. */
  rename:     (src: any, dst: any)      => typeof __glyx_rename     !== 'undefined' ? __glyx_rename(src, dst)         : _noBinding('rename'),
  /** Copy a file. Requires `fs.read` on src and `fs.write` on dst. */
  copy:       (src: any, dst: any)      => typeof __glyx_copyFile   !== 'undefined' ? __glyx_copyFile(src, dst)       : _noBinding('copy'),
  /** Read a file as UTF-8 and parse as JSON. Requires `fs.read`. */
  readJSON:   async (path: any)          => JSON.parse(await fs.readFile(path)),
  /** Serialize `value` to JSON and write to a file. Requires `fs.write`. */
  writeJSON:  async (path: any, val: any, indent = 2) => fs.writeFile(path, JSON.stringify(val, null, indent)),
  /**
   * Open a file for reading in chunks, with flat memory: `for await (const chunk of await fs.openRead(path)) { ... }` gives `Uint8Array`
   * chunks and stops reading ahead when you are slow. Use it for files too big to hold (`readFile` and `readFileBytes` hold the whole
   * file). Requires the `fs` capability and `fs.read` for the path. See `FileReadStream`.
   */
  openRead: (path: string, opts?: OpenReadOptions): Promise<FileReadStream> => _openRead(path, opts),
  /**
   * Open a file for writing in chunks: `write(chunk)` waits when the writer is behind, and `close()` flushes. Creates the file and replaces
   * its content unless `{ append: true }`. Requires the `fs` capability and `fs.write` for the path. See `FileWriteStream`.
   */
  openWrite: (path: string, opts?: OpenWriteOptions): Promise<FileWriteStream> => _openWrite(path, opts),
  /**
   * Walk a directory tree: `for await (const entry of await fs.walk(root, { ignore: ['node_modules', '.git'] }))` gives `{ path, name, type,
   * size, mtime, depth }` for every file, directory and link below `root` (not `root` itself), directories before their contents, in the order
   * the operating system lists them. The listing runs on one native thread and arrives in batches, so a big tree costs a few hundred calls
   * instead of one per directory, and memory stays flat. Options: `maxDepth`, `ignore` (globs), `type` (`'file'` or `'dir'`), `followLinks`.
   * Directories that cannot be read are skipped and counted (`walk.skipped`, `walk.errors`, known at the end). `break` or an error stops it.
   * Requires the `fs` capability and `fs.read` for `root`, like `listDir`. See `FileWalk`.
   */
  walk: (root: string, opts?: WalkOptions): Promise<FileWalk> => _walk(root, opts),
  /**
   * Watch `path` for changes. `callback` is called with `{ path, type }` on each event.
   * `type` is one of `"modified"`, `"created"`, `"removed"`, `"accessed"`, `"other"`.
   * Returns a Promise<watchId> — pass the id to `fs.unwatch()` to stop watching.
   * Requires `fs.read` capability.
   */
  watch: async (path: any, callback: any) => {
    if (typeof __glyx_fs_watch === 'undefined') return _noBinding('fs.watch');
    const id = await __glyx_fs_watch(path);
    _fsWatchCallbacks.set(id, callback);
    return id;
  },
  /** Stop watching the given watchId (returned from `fs.watch`). */
  unwatch: (id: any) => {
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
