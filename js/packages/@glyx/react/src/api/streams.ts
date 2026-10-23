// @glyx-dev/react — file streams.

// ── File streams ─────────────────────────────────────────────────────────────
//
// `fs.readFile` and `fs.readFileBytes` hold the whole file (the second as a base64 string, a third larger again), so a big file costs several
// times its size in memory. A stream keeps the file on the Rust side and hands you one chunk at a time:
//
//   for await (const chunk of await fs.openRead('video.mp4')) { hash.update(chunk); }   // chunk: Uint8Array
//
//   const out = await fs.openWrite('copy.bin');
//   await out.write(bytes);          // waits when the writer is behind (backpressure)
//   await out.close();               // flushes; a disk error surfaces here or on a write
//
// `fs.walk` is the same machinery for a directory tree: the native side lists the tree on one thread and hands over entries in batches, so
// walking 100,000 files is a few hundred calls, not one per directory. See `WalkOptions` and `WalkEntry`.
//
// A stream belongs to the window that opened it: if that window closes, or its JavaScript is reloaded in development, the runtime closes
// what was left open (and logs it). Close what you open all the same.
//
// Memory is bounded: the reader reads ahead only a few chunks (`streams.queueChunks` of `streams.chunkKb` KiB, about 512 KiB by default), and
// a slow consumer slows the disk read instead of growing memory. A stream is closed by reaching its end, by `break` or an error in a
// `for await`, or by `close()`/`cancel()`; at most `streams.maxOpen` (64) may be open at once. Requires the `fs` capability, and the path
// must be inside the app's `fs.read` (to read) or `fs.write` (to write) grant.
//
// The protocol with the runtime (the `glyx_stream.*` backend commands) is documented in `streams.rs`: JSON for open, close and cancel, and
// the binary lane for the data, so a chunk crosses once as an ArrayBuffer and never as text.
//
// A call between JavaScript and the runtime takes about a millisecond to come back, more than the disk takes to read a chunk, so a reader
// that asked for one chunk and waited would be idle most of the time. It keeps one request in flight ahead of the one it is waiting for
// (requests are numbered, and the runtime answers them in order), and one answer carries every chunk that was already queued. Chunk
// sizes are therefore not fixed: a chunk is between one read and `chunkKb * queueChunks` KiB.

export interface OpenReadOptions {
  /** Chunk size in KiB, 4 to 4096. Default: the `streams.chunkKb` setting (256). */
  chunkKb?: number;
}

export interface OpenWriteOptions {
  /** Add to the end of an existing file instead of replacing it. */
  append?: boolean;
}

/** A file being read in chunks. Iterate it with `for await`, or call `read()` yourself. */
export interface FileReadStream extends AsyncIterable<Uint8Array> {
  /** The next chunk, or `null` at the end of the file (the stream is closed then). */
  read(): Promise<Uint8Array | null>;
  /** Stop and release the file. Safe to call more than once, and after the end. */
  cancel(): Promise<void>;
  /** Same as `cancel()` for a reader. */
  close(): Promise<void>;
}

export interface WalkOptions {
  /** How deep to go: 1 is the root's children only. Default: all the way down. */
  maxDepth?: number;
  /**
   * Globs to leave out. One without a `/` matches a name at any depth (`'node_modules'`, `'*.log'`) and the directory is not entered; one
   * with a `/` matches the path below the root (`'build/cache'`, `'**\/*.tmp'`).
   */
  ignore?: string[];
  /** Report only files or only directories. Default: both (and links). */
  type?: 'file' | 'dir';
  /** Enter links to directories whose target the app may read (each target once). Default false: a link is reported and not entered. */
  followLinks?: boolean;
}

export interface WalkEntry {
  /** The full path, with the separators the operating system uses. */
  path: string;
  name: string;
  /** `symlink` covers links (and Windows junctions); `other` is a device, a socket and the like. */
  type: 'file' | 'dir' | 'symlink' | 'other';
  /** Bytes for a file; 0 for a directory. */
  size: number;
  /** Modified time, milliseconds since the epoch. */
  mtime: number;
  /** 1 for the root's children, 2 for theirs, ... */
  depth: number;
}

export interface WalkProblem {
  path: string;
  error: string;
}

/** A directory walk in progress. Iterate it with `for await`. */
export interface FileWalk extends AsyncIterable<WalkEntry> {
  /** The next entry, or `null` when the walk is over. */
  next(): Promise<WalkEntry | null>;
  /** Stop the walk and release it. Safe to call more than once, and after the end. */
  cancel(): Promise<void>;
  /** How many directories or entries could not be read (permission denied, vanished, a link the app may not follow). Known once the walk is over. */
  readonly skipped: number;
  /** The first 20 reasons. Known once the walk is over. */
  readonly errors: WalkProblem[];
}

/** A file being written in chunks. */
export interface FileWriteStream {
  /**
   * Queue a chunk. Resolves when the chunk is accepted (not when it is on disk); waits while the writer is `streams.queueChunks` behind.
   * A string is written as UTF-8.
   */
  write(chunk: Uint8Array | ArrayBuffer | string): Promise<void>;
  /** Write everything queued, flush, and close. Rejects if a write failed (disk full, permission). */
  close(): Promise<void>;
  /** Stop now and drop what is queued. */
  cancel(): Promise<void>;
}

const STATUS_END = 1;

function parseJson(raw: unknown): any {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return raw; }
}

/**
 * One call to a `glyx_stream.*` command. Not routed through `backend`, so a stream does not put a thousand rows in the DevTools request log.
 * A binary command takes an ArrayBuffer or typed array and answers with an ArrayBuffer; a JSON command takes a value and answers JSON.
 */
function call(command: string, arg: unknown): Promise<any> {
  const f = (globalThis as any).__glyx_backend_call2;
  if (typeof f !== 'function') return Promise.reject(new Error('fs streams need a newer runner (__glyx_backend_call2 is missing)'));
  let ret: any;
  try { ret = f(command, arg); } catch (e) { return Promise.reject(e); }
  return Promise.resolve(ret).then(parseJson);
}

/** The request of a binary command: the stream id (4 bytes, little-endian), then `rest`. A read has the request number instead. */
function withId(id: number, rest?: Uint8Array): Uint8Array {
  const out = new Uint8Array(4 + (rest ? rest.length : 0));
  new DataView(out.buffer).setUint32(0, id, true);
  if (rest) out.set(rest, 4);
  return out;
}

function toBytes(chunk: Uint8Array | ArrayBuffer | string): Uint8Array {
  if (typeof chunk === 'string') {
    if (typeof TextEncoder === 'undefined') throw new Error('write(string) needs TextEncoder; pass a Uint8Array');
    return new TextEncoder().encode(chunk);
  }
  if (chunk instanceof Uint8Array) return chunk;
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
  throw new TypeError('write(chunk): a Uint8Array, an ArrayBuffer or a string is required');
}

class ReadStream implements FileReadStream {
  /** Once the end or an error was reached the runtime has already closed the stream, so there is nothing left to cancel. */
  private done = false;
  /** The number of the next request to send. */
  private seq = 0;
  /** The request already made for the next `read()`. */
  private ahead: Promise<Uint8Array | null> | null = null;
  constructor(private readonly id: number) {}

  private request(): Promise<Uint8Array | null> {
    const req = new Uint8Array(8);
    const view = new DataView(req.buffer);
    view.setUint32(0, this.id, true);
    view.setUint32(4, this.seq++ >>> 0, true);
    const p = call('glyx_stream.read', req).then((answer) => {
      const bytes = new Uint8Array(answer);
      if (bytes.length === 0 || bytes[0] === STATUS_END) return null;
      // A view past the status byte: no second copy.
      return bytes.subarray(1);
    });
    // The request made ahead can fail after the end, or after a cancel, with "not open": nobody is waiting for it then.
    p.catch(() => {});
    return p;
  }

  async read(): Promise<Uint8Array | null> {
    if (this.done) return null;
    const current = this.ahead ?? this.request();
    this.ahead = this.request();
    try {
      const chunk = await current;
      if (chunk === null) this.finish();
      return chunk;
    } catch (e) {
      // A cancel while this was waiting makes the runtime reject it: that is the end, not a failure.
      if (this.done) return null;
      this.finish(); // the runtime closes a stream that failed
      throw e;
    }
  }

  private finish() {
    this.done = true;
    this.ahead = null;
  }

  async cancel(): Promise<void> {
    if (this.done) return;
    this.finish();
    await call('glyx_stream.cancel', { id: this.id });
  }

  close(): Promise<void> {
    return this.cancel();
  }

  [Symbol.asyncIterator](): AsyncIterator<Uint8Array> {
    return {
      next: async () => {
        const chunk = await this.read();
        return chunk ? { value: chunk, done: false } : { value: undefined, done: true };
      },
      // `break` and an exception in the loop body end up here: release the file.
      return: async () => {
        await this.cancel();
        return { value: undefined, done: true };
      },
    };
  }
}

class WriteStream implements FileWriteStream {
  private closed = false;
  constructor(private readonly id: number) {}

  async write(chunk: Uint8Array | ArrayBuffer | string): Promise<void> {
    if (this.closed) throw new Error('write after close');
    try {
      await call('glyx_stream.write', withId(this.id, toBytes(chunk)));
    } catch (e) {
      this.closed = true; // the runtime closes a writer that failed
      throw e;
    }
  }

  async close(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await call('glyx_stream.close', { id: this.id });
  }

  async cancel(): Promise<void> {
    if (this.closed) return;
    this.closed = true;
    await call('glyx_stream.cancel', { id: this.id });
  }
}

class Walk implements FileWalk {
  skipped = 0;
  errors: WalkProblem[] = [];
  private done = false;
  private seq = 0;
  private ahead: Promise<any> | null = null;
  private buffer: WalkEntry[] = [];
  private pos = 0;
  constructor(private readonly id: number) {}

  private request(): Promise<any> {
    const p = call('glyx_stream.next', { id: this.id, seq: this.seq++ });
    // The request made ahead can fail after the end, or after a cancel, with "not open": nobody is waiting for it then.
    p.catch(() => {});
    return p;
  }

  async next(): Promise<WalkEntry | null> {
    for (;;) {
      if (this.pos < this.buffer.length) return this.buffer[this.pos++];
      this.buffer = [];
      this.pos = 0;
      if (this.done) return null;
      const current = this.ahead ?? this.request();
      this.ahead = this.request();
      let answer: any;
      try {
        answer = await current;
      } catch (e) {
        // A cancel while this was waiting makes the runtime reject it: that is the end, not a failure.
        if (this.done) return null;
        this.finish();
        throw e;
      }
      if (!answer || answer.done) {
        this.finish();
        return null;
      }
      const items: any[] = answer.items ?? [];
      const last = items[items.length - 1];
      if (last && last.$summary) {
        items.pop();
        this.skipped = last.$summary.skipped ?? 0;
        this.errors = last.$summary.errors ?? [];
        // The summary is the last thing a walk sends: what is buffered is the end, and the request made ahead closes the stream.
        this.done = true;
        this.ahead = null;
      }
      this.buffer = items;
    }
  }

  private finish() {
    this.done = true;
    this.ahead = null;
  }

  async cancel(): Promise<void> {
    if (this.done) return;
    this.finish();
    await call('glyx_stream.cancel', { id: this.id });
  }

  [Symbol.asyncIterator](): AsyncIterator<WalkEntry> {
    return {
      next: async () => {
        const entry = await this.next();
        return entry ? { value: entry, done: false } : { value: undefined, done: true };
      },
      // `break` and an exception in the loop body end up here: stop the walk.
      return: async () => {
        await this.cancel();
        return { value: undefined, done: true };
      },
    };
  }
}

export async function _walk(root: string, opts: WalkOptions = {}): Promise<FileWalk> {
  const r = await call('glyx_stream.walk', {
    path: root,
    maxDepth: opts.maxDepth,
    ignore: opts.ignore,
    type: opts.type,
    followLinks: opts.followLinks,
  });
  return new Walk(r.id);
}

export async function _openRead(path: string, opts: OpenReadOptions = {}): Promise<FileReadStream> {
  const r = await call('glyx_stream.open', { path, mode: 'read', chunkKb: opts.chunkKb });
  return new ReadStream(r.id);
}

export async function _openWrite(path: string, opts: OpenWriteOptions = {}): Promise<FileWriteStream> {
  const r = await call('glyx_stream.open', { path, mode: opts.append ? 'append' : 'write' });
  return new WriteStream(r.id);
}
