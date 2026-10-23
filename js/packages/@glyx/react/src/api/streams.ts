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
// The body of an HTTP response is a stream too (`fetch(url, { stream: true })`, in `fetch.ts`), and `fs.pipe(from, to)` copies one stream into
// another inside the runtime with no JavaScript per chunk, which is how a download goes to disk without passing through the app.
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
// A call between JavaScript and the runtime takes 0.15 ms to come back in a release build (about 1.2 ms under `glyx dev`), about as long as the
// disk takes to read a chunk, so a reader that asked for one chunk and waited would be idle much of the time. It keeps one request in flight
// ahead of the one it is waiting for
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

/** A string as UTF-8 bytes. Uses `TextEncoder` where the runtime has one; the runtime does not always, so there is a plain version. */
export function utf8Encode(text: string): Uint8Array {
  if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(text);
  const bytes: number[] = [];
  for (let i = 0; i < text.length; i++) {
    let c = text.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < text.length) {
      const next = text.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        c = 0x10000 + ((c - 0xd800) << 10) + (next - 0xdc00);
        i++;
      }
    }
    if (c >= 0xd800 && c <= 0xdfff) c = 0xfffd; // a lone surrogate is not text
    if (c < 0x80) bytes.push(c);
    else if (c < 0x800) bytes.push(0xc0 | (c >> 6), 0x80 | (c & 63));
    else if (c < 0x10000) bytes.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
    else bytes.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63));
  }
  return Uint8Array.from(bytes);
}

/** UTF-8 bytes as a string (invalid sequences become U+FFFD, as the WHATWG decoder does). Uses `TextDecoder` where there is one. */
export function utf8Decode(bytes: Uint8Array): string {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
  const parts: string[] = [];
  let units: number[] = [];
  const flush = () => {
    if (units.length) parts.push(String.fromCharCode.apply(null, units as any));
    units = [];
  };
  const emit = (cp: number) => {
    if (cp >= 0x10000) {
      cp -= 0x10000;
      units.push(0xd800 + (cp >> 10), 0xdc00 + (cp & 0x3ff));
    } else {
      units.push(cp);
    }
    if (units.length >= 4096) flush();
  };
  // The decoder of the Encoding Standard: how many continuation bytes are still needed, and the range the next one may be in.
  let needed = 0;
  let seen = 0;
  let cp = 0;
  let lower = 0x80;
  let upper = 0xbf;
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (needed === 0) {
      if (b <= 0x7f) emit(b);
      else if (b >= 0xc2 && b <= 0xdf) { needed = 1; cp = b & 0x1f; }
      else if (b >= 0xe0 && b <= 0xef) {
        if (b === 0xe0) lower = 0xa0;
        if (b === 0xed) upper = 0x9f;
        needed = 2;
        cp = b & 0x0f;
      } else if (b >= 0xf0 && b <= 0xf4) {
        if (b === 0xf0) lower = 0x90;
        if (b === 0xf4) upper = 0x8f;
        needed = 3;
        cp = b & 0x07;
      } else emit(0xfffd);
      continue;
    }
    if (b < lower || b > upper) {
      // The sequence is broken: one replacement character for what was read, and this byte starts over.
      cp = needed = seen = 0;
      lower = 0x80;
      upper = 0xbf;
      emit(0xfffd);
      i--;
      continue;
    }
    lower = 0x80;
    upper = 0xbf;
    cp = (cp << 6) | (b & 0x3f);
    if (++seen === needed) {
      emit(cp);
      cp = needed = seen = 0;
    }
  }
  if (needed !== 0) emit(0xfffd);
  flush();
  return parts.join('');
}

function toBytes(chunk: Uint8Array | ArrayBuffer | string): Uint8Array {
  if (typeof chunk === 'string') return utf8Encode(chunk);
  if (chunk instanceof Uint8Array) return chunk;
  if (chunk instanceof ArrayBuffer) return new Uint8Array(chunk);
  throw new TypeError('write(chunk): a Uint8Array, an ArrayBuffer or a string is required');
}

/** Stream ids, kept out of the public objects. */
const streamIds = new WeakMap<object, number>();

class ReadStream implements FileReadStream {
  /** Once the end or an error was reached the runtime has already closed the stream, so there is nothing left to cancel. */
  private done = false;
  /** The number of the next request to send. */
  private seq = 0;
  /** The request already made for the next `read()`. */
  private ahead: Promise<Uint8Array | null> | null = null;
  constructor(private readonly id: number) {
    streamIds.set(this, id);
  }

  /** Hand the stream to `fs.pipe`: it must be untouched (nothing read, so no request is in flight), and is finished for this object afterwards. */
  _giveToPipe(): number {
    if (this.done) throw new Error('fs.pipe: the read stream is already finished');
    if (this.seq !== 0) throw new Error('fs.pipe needs a read stream nobody has read from yet');
    this.finish();
    return this.id;
  }

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
  constructor(private readonly id: number) {
    streamIds.set(this, id);
  }

  /** Hand the stream to `fs.pipe`; it is closed by the pipe. */
  _giveToPipe(): number {
    if (this.closed) throw new Error('fs.pipe: the write stream is already closed');
    this.closed = true;
    return this.id;
  }

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

/** A read stream over the id the runtime gave (for `fetch`'s streaming response and a process's output). */
export function _readStreamOf(id: number): FileReadStream {
  return new ReadStream(id);
}

/** A write stream over the id the runtime gave (a process's input). */
export function _writeStreamOf(id: number): FileWriteStream {
  return new WriteStream(id);
}

/** One call to a `glyx_stream.*` command, for the modules built on streams (`shell.ts`). */
export const _streamCall = (command: string, arg: unknown): Promise<any> => call(command, arg);

/**
 * The lines of a byte stream, as strings, without the line ends (`\n` or `\r\n`): `for await (const line of streamLines(process.stdout))`.
 * A line can arrive split across chunks, and a multi-byte character across a chunk boundary: the bytes are kept until the line is complete.
 * What follows the last line end is a last line if it is not empty. The stream is read to its end; breaking out of the loop cancels it.
 */
export function streamLines(stream: FileReadStream): AsyncIterable<string> {
  return {
    async *[Symbol.asyncIterator]() {
      let pending = new Uint8Array(0);
      try {
        for (let chunk = await stream.read(); chunk !== null; chunk = await stream.read()) {
          let bytes = chunk;
          if (pending.length) {
            const joined = new Uint8Array(pending.length + chunk.length);
            joined.set(pending, 0);
            joined.set(chunk, pending.length);
            bytes = joined;
          }
          let start = 0;
          for (let i = 0; i < bytes.length; i++) {
            if (bytes[i] === 0x0a) {
              const end = i > start && bytes[i - 1] === 0x0d ? i - 1 : i;
              yield utf8Decode(bytes.subarray(start, end));
              start = i + 1;
            }
          }
          pending = bytes.slice(start);
        }
        if (pending.length) yield utf8Decode(pending[pending.length - 1] === 0x0d ? pending.subarray(0, -1) : pending);
      } finally {
        await stream.cancel(); // harmless after the end; releases the stream if the loop was left early
      }
    },
  };
}

export interface PipeOptions {
  /** Called now and then with the bytes copied so far. */
  onProgress?: (bytes: number) => void;
  /** How often to ask for progress, in milliseconds. Default 100. */
  progressEveryMs?: number;
}

/**
 * Copy a read stream into a write stream inside the runtime, with no JavaScript per chunk, then flush and close the writer. Both streams
 * belong to the pipe until it ends (do not read or write them yourself, and the read stream must be untouched). Resolves with the bytes
 * copied. On an error both are closed and it rejects.
 */
export async function _pipe(from: FileReadStream, to: FileWriteStream, opts: PipeOptions = {}): Promise<number> {
  if (!(from instanceof ReadStream) || !(to instanceof WriteStream)) {
    throw new TypeError('fs.pipe(from, to): from is a stream from fs.openRead (or a fetch body), to is a stream from fs.openWrite');
  }
  const fromId = from._giveToPipe();
  let toId: number;
  try {
    toId = to._giveToPipe();
  } catch (e) {
    await call('glyx_stream.cancel', { id: fromId });
    throw e;
  }
  let running = true;
  let timer: any = null;
  const onProgress = opts.onProgress;
  if (onProgress && typeof setTimeout === 'function') {
    const every = opts.progressEveryMs ?? 100;
    const poll = () => {
      if (!running) return;
      call('glyx_stream.progress', { id: toId }).then(
        (r) => { if (running && r && typeof r.bytes === 'number') { try { onProgress(r.bytes); } catch { /* a progress callback must not stop the copy */ } } },
        () => {}
      ).then(() => { if (running) timer = setTimeout(poll, every); });
    };
    timer = setTimeout(poll, every);
  }
  try {
    const r = await call('glyx_stream.pipe', { from: fromId, to: toId });
    if (onProgress) { try { onProgress(r.bytes); } catch { /* as above */ } }
    return r.bytes;
  } finally {
    running = false;
    if (timer !== null && typeof clearTimeout === 'function') clearTimeout(timer);
  }
}

export async function _openRead(path: string, opts: OpenReadOptions = {}): Promise<FileReadStream> {
  const r = await call('glyx_stream.open', { path, mode: 'read', chunkKb: opts.chunkKb });
  return new ReadStream(r.id);
}

export async function _openWrite(path: string, opts: OpenWriteOptions = {}): Promise<FileWriteStream> {
  const r = await call('glyx_stream.open', { path, mode: opts.append ? 'append' : 'write' });
  return new WriteStream(r.id);
}
