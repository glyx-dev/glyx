import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { fs } from './fs.js';
import { utf8Decode, utf8Encode } from './streams.js';

const g = globalThis as any;

// A stand-in for the runner's `glyx_stream.*` commands: JSON commands answer a JSON string (or, on QuickJS, a parsed value), the binary ones an
// ArrayBuffer whose first byte is the status. `chunks` is what a reader hands out, in order.
let calls: Array<{ command: string; arg: any }>;
let chunks: Uint8Array[];
let failRead: string | null;
let failWrite: string | null;
let parsedJson: boolean;
let written: Uint8Array[];
/** The number of the read request that got the end; reads after it are refused like the runner does. */
let endedAt: number | null;

function answerJson(value: unknown) {
  return Promise.resolve(parsedJson ? value : JSON.stringify(value));
}

beforeEach(() => {
  calls = [];
  chunks = [];
  failRead = null;
  failWrite = null;
  parsedJson = false;
  written = [];
  endedAt = null;
  g.__glyx_backend_call2 = (command: string, arg: any) => {
    calls.push({ command, arg });
    switch (command) {
      case 'glyx_stream.open':
        return arg.path === 'missing' ? Promise.reject(new Error('cannot open missing')) : answerJson({ id: 7 });
      case 'glyx_stream.read': {
        if (failRead) return Promise.reject(new Error(failRead));
        // The runner answers a read after the end with "not open".
        if (endedAt !== null && calls.filter((c) => c.command === 'glyx_stream.read').length > endedAt + 1) {
          return Promise.reject(new Error('stream 7 is not open (it ended, failed or was closed)'));
        }
        const next = chunks.shift();
        const out = new Uint8Array(1 + (next ? next.length : 0));
        out[0] = next ? 0 : 1;
        if (!next && endedAt === null) endedAt = calls.filter((c) => c.command === 'glyx_stream.read').length;
        if (next) out.set(next, 1);
        return Promise.resolve(out.buffer);
      }
      case 'glyx_stream.write':
        if (failWrite) return Promise.reject(new Error(failWrite));
        written.push(new Uint8Array(arg).slice(4));
        return Promise.resolve(new ArrayBuffer(0));
      default:
        return answerJson({});
    }
  };
});

afterEach(() => {
  delete g.__glyx_backend_call2;
});

const names = () => calls.map((c) => c.command);

describe('fs.openRead', () => {
  test('opens in read mode, with the chunk size if one is asked for', async () => {
    await fs.openRead('a.bin');
    await fs.openRead('b.bin', { chunkKb: 64 });
    expect(calls[0]).toEqual({ command: 'glyx_stream.open', arg: { path: 'a.bin', mode: 'read', chunkKb: undefined } });
    expect(calls[1].arg).toEqual({ path: 'b.bin', mode: 'read', chunkKb: 64 });
  });

  test('works whether the runner answers JSON text or an already parsed value', async () => {
    chunks = [new Uint8Array([1])];
    parsedJson = true;
    const s = await fs.openRead('a.bin');
    expect((await s.read())![0]).toBe(1);
  });

  test('for await yields each chunk, then ends without a call to cancel', async () => {
    chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5])];
    const got: number[][] = [];
    for await (const chunk of await fs.openRead('a.bin')) got.push(Array.from(chunk));
    expect(got).toEqual([[1, 2, 3], [4, 5]]);
    // open, then reads (each one asks for the next ahead, so one more than the chunks and the end) and nothing else: the runner closes
    // a stream that ended.
    expect(names()[0]).toBe('glyx_stream.open');
    expect(names().slice(1).every((n) => n === 'glyx_stream.read')).toBe(true);
    expect(names()).not.toContain('glyx_stream.cancel');
  });

  test('a read request is the stream id then a request number, each four bytes little-endian, and one request is kept in flight ahead', async () => {
    chunks = [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])];
    const s = await fs.openRead('a.bin');
    await s.read();
    // The first read sent request 0 and, ahead of its answer, request 1.
    const reads = () => calls.filter((c) => c.command === 'glyx_stream.read').map((c) => Array.from(new Uint8Array(c.arg)));
    expect(reads()).toEqual([[7, 0, 0, 0, 0, 0, 0, 0], [7, 0, 0, 0, 1, 0, 0, 0]]);
    await s.read();
    expect(reads().length).toBe(3);
    expect(reads()[2]).toEqual([7, 0, 0, 0, 2, 0, 0, 0]);
    await s.cancel();
  });

  test('chunks come back in order even though two requests are in flight', async () => {
    chunks = [1, 2, 3, 4, 5, 6].map((n) => new Uint8Array([n]));
    const got: number[] = [];
    for await (const c of await fs.openRead('a.bin')) got.push(c[0]);
    expect(got).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('the request made ahead that the runner refuses after the end is not an unhandled rejection', async () => {
    chunks = [new Uint8Array([1])];
    const seen: unknown[] = [];
    const onRejection = (e: unknown) => seen.push(e);
    process.on('unhandledRejection', onRejection);
    try {
      for await (const _ of await fs.openRead('a.bin')) { /* read to the end */ }
      await new Promise((r) => setTimeout(r, 20));
    } finally {
      process.off('unhandledRejection', onRejection);
    }
    expect(seen).toEqual([]);
  });

  test('a cancel while a read is waiting ends it with null, not an error', async () => {
    const s = await fs.openRead('a.bin');
    g.__glyx_backend_call2 = (command: string) => {
      if (command === 'glyx_stream.read') return Promise.reject(new Error('stream 7 is not open (it ended, failed or was closed)'));
      return Promise.resolve('{}');
    };
    const waiting = s.read();
    await s.cancel();
    expect(await waiting).toBeNull();
  });

  test('a chunk is a view past the status byte, not a copy', async () => {
    chunks = [new Uint8Array([9, 8, 7])];
    const chunk = (await (await fs.openRead('a.bin')).read())!;
    expect(Array.from(chunk)).toEqual([9, 8, 7]);
    expect(chunk.byteOffset).toBe(1);
  });

  test('break releases the file once', async () => {
    chunks = [new Uint8Array([1]), new Uint8Array([2]), new Uint8Array([3])];
    for await (const _ of await fs.openRead('a.bin')) break;
    expect(names().filter((n) => n === 'glyx_stream.cancel').length).toBe(1);
    expect(calls.find((c) => c.command === 'glyx_stream.cancel')!.arg).toEqual({ id: 7 });
  });

  test('an exception in the loop body releases the file', async () => {
    chunks = [new Uint8Array([1]), new Uint8Array([2])];
    await expect((async () => { for await (const _ of await fs.openRead('a.bin')) throw new Error('boom'); })()).rejects.toThrow('boom');
    expect(names()).toContain('glyx_stream.cancel');
  });

  test('a failed read rejects, and the stream is then finished: no cancel, and read() is null', async () => {
    const s = await fs.openRead('a.bin');
    failRead = 'disk error';
    await expect(s.read()).rejects.toThrow('disk error');
    expect(await s.read()).toBeNull();
    await s.cancel();
    expect(names()).not.toContain('glyx_stream.cancel');
  });

  test('cancel is idempotent and read() after it is null, with no request sent', async () => {
    chunks = [new Uint8Array([1])];
    const s = await fs.openRead('a.bin');
    await s.cancel();
    await s.close();
    expect(names().filter((n) => n === 'glyx_stream.cancel').length).toBe(1);
    expect(await s.read()).toBeNull();
    expect(names()).not.toContain('glyx_stream.read');
  });

  test('a failing open rejects with the runner\'s reason', async () => {
    await expect(fs.openRead('missing')).rejects.toThrow('cannot open missing');
  });
});

describe('fs.openWrite', () => {
  test('opens for writing, or appending', async () => {
    await fs.openWrite('a.bin');
    await fs.openWrite('b.bin', { append: true });
    expect(calls[0].arg).toEqual({ path: 'a.bin', mode: 'write' });
    expect(calls[1].arg).toEqual({ path: 'b.bin', mode: 'append' });
  });

  test('a write request is the stream id, then the bytes; strings and ArrayBuffers are accepted', async () => {
    const w = await fs.openWrite('a.bin');
    await w.write(new Uint8Array([1, 2, 3]));
    await w.write(new Uint8Array([9]).buffer);
    await w.write('hé');
    expect(Array.from(new Uint8Array(calls[1].arg).slice(0, 4))).toEqual([7, 0, 0, 0]);
    expect(written.map((b) => Array.from(b))).toEqual([[1, 2, 3], [9], [0x68, 0xc3, 0xa9]]);
  });

  test('a chunk that is a view of a bigger buffer sends only its own bytes', async () => {
    const w = await fs.openWrite('a.bin');
    const big = new Uint8Array([0, 0, 5, 6, 0]);
    await w.write(big.subarray(2, 4));
    expect(Array.from(written[0])).toEqual([5, 6]);
  });

  test('anything else is refused before it is sent', async () => {
    const w = await fs.openWrite('a.bin');
    await expect(w.write(42 as any)).rejects.toThrow('a Uint8Array');
    expect(names()).not.toContain('glyx_stream.write');
  });

  test('close flushes once, and writing after it is an error', async () => {
    const w = await fs.openWrite('a.bin');
    await w.write('x');
    await w.close();
    await w.close();
    expect(names().filter((n) => n === 'glyx_stream.close').length).toBe(1);
    await expect(w.write('y')).rejects.toThrow('write after close');
  });

  test('a failed write rejects and ends the stream: the runner has closed it, so no cancel or close follows', async () => {
    const w = await fs.openWrite('a.bin');
    failWrite = 'disk full';
    await expect(w.write('x')).rejects.toThrow('disk full');
    await w.close();
    await w.cancel();
    expect(names()).not.toContain('glyx_stream.close');
    expect(names()).not.toContain('glyx_stream.cancel');
  });

  test('cancel stops without a flush', async () => {
    const w = await fs.openWrite('a.bin');
    await w.cancel();
    expect(names()).toContain('glyx_stream.cancel');
    expect(names()).not.toContain('glyx_stream.close');
  });
});

describe('without the runner support', () => {
  test('opening says what is missing instead of throwing a TypeError', async () => {
    delete g.__glyx_backend_call2;
    await expect(fs.openRead('a.bin')).rejects.toThrow('newer runner');
    await expect(fs.openWrite('a.bin')).rejects.toThrow('newer runner');
  });
});

describe('fs.walk', () => {
  // The runner answers `glyx_stream.next` with `{ items }` (the last batch ends with a summary item) and then `{ items: [], done: true }`.
  let batches: any[][];
  let nextCalls: any[];
  let walkOpen: any;

  const entry = (name: string, depth = 1) => ({ path: 'C:\\root\\' + name, name, type: 'file', size: 1, mtime: 0, depth });

  beforeEach(() => {
    batches = [];
    nextCalls = [];
    walkOpen = null;
    const base = g.__glyx_backend_call2;
    g.__glyx_backend_call2 = (command: string, arg: any) => {
      if (command === 'glyx_stream.walk') {
        walkOpen = arg;
        return answerJson({ id: 9 });
      }
      if (command === 'glyx_stream.next') {
        nextCalls.push(arg);
        const items = batches.shift();
        if (!items) {
          // Reads after the end are refused, as the runner does once the walk has ended.
          return nextCalls.length > batchesSent + 1 ? Promise.reject(new Error('stream 9 is not open (it ended, failed or was closed)')) : answerJson({ items: [], done: true });
        }
        batchesSent++;
        return answerJson({ items });
      }
      return base(command, arg);
    };
    batchesSent = 0;
  });
  let batchesSent = 0;

  test('sends the root and the options, and the next requests are numbered with one ahead', async () => {
    batches = [[entry('a'), entry('b')], [entry('c'), { $summary: { skipped: 0, errors: [] } }]];
    const walk = await fs.walk('C:\\root', { maxDepth: 2, ignore: ['node_modules'], type: 'file', followLinks: true });
    expect(walkOpen).toEqual({ path: 'C:\\root', maxDepth: 2, ignore: ['node_modules'], type: 'file', followLinks: true });
    const first = await walk.next();
    expect(first!.name).toBe('a');
    // The first read sent request 0 and, ahead of its answer, request 1.
    expect(nextCalls).toEqual([{ id: 9, seq: 0 }, { id: 9, seq: 1 }]);
    await walk.cancel();
  });

  test('for await yields every entry in order and ends after the summary, which is not an entry', async () => {
    batches = [[entry('a'), entry('b')], [entry('c'), { $summary: { skipped: 2, errors: [{ path: 'x', error: 'denied' }] } }]];
    const names: string[] = [];
    const walk = await fs.walk('C:\\root');
    for await (const e of walk) names.push(e.name);
    expect(names).toEqual(['a', 'b', 'c']);
    expect(walk.skipped).toBe(2);
    expect(walk.errors).toEqual([{ path: 'x', error: 'denied' }]);
    // Nothing was cancelled: the runner closes a walk that ended.
    expect(names.length).toBe(3);
    expect(calls.some((c) => c.command === 'glyx_stream.cancel')).toBe(false);
  });

  test('an end with no summary also finishes, and an empty directory yields nothing', async () => {
    const walk = await fs.walk('C:\\root');
    expect(await walk.next()).toBeNull();
    expect(await walk.next()).toBeNull();
    expect(walk.skipped).toBe(0);
  });

  test('the request made ahead that the runner refuses after the end is not an unhandled rejection', async () => {
    batches = [[entry('a'), { $summary: { skipped: 0, errors: [] } }]];
    const seen: unknown[] = [];
    const onRejection = (e: unknown) => seen.push(e);
    process.on('unhandledRejection', onRejection);
    try {
      for await (const _ of await fs.walk('C:\\root')) { /* to the end */ }
      await new Promise((r) => setTimeout(r, 20));
    } finally {
      process.off('unhandledRejection', onRejection);
    }
    expect(seen).toEqual([]);
  });

  test('break stops the walk once', async () => {
    batches = [[entry('a'), entry('b'), entry('c')], [entry('d')]];
    for await (const _ of await fs.walk('C:\\root')) break;
    expect(calls.filter((c) => c.command === 'glyx_stream.cancel').length).toBe(1);
    expect(calls.find((c) => c.command === 'glyx_stream.cancel')!.arg).toEqual({ id: 9 });
  });

  test('cancel is idempotent and next() after it is null', async () => {
    batches = [[entry('a')]];
    const walk = await fs.walk('C:\\root');
    await walk.cancel();
    await walk.cancel();
    expect(calls.filter((c) => c.command === 'glyx_stream.cancel').length).toBe(1);
    expect(await walk.next()).toBeNull();
    expect(nextCalls.length).toBe(0);
  });

  test('a failing walk rejects, and the walk is then over', async () => {
    const walk = await fs.walk('C:\\root');
    g.__glyx_backend_call2 = (command: string) => (command === 'glyx_stream.next' ? Promise.reject(new Error('disk error')) : Promise.resolve('{}'));
    await expect(walk.next()).rejects.toThrow('disk error');
    expect(await walk.next()).toBeNull();
  });

  test('opening a walk the runner refuses rejects with its reason', async () => {
    g.__glyx_backend_call2 = () => Promise.reject(new Error('fs.read denied: not allowed'));
    await expect(fs.walk('C:\\elsewhere')).rejects.toThrow('fs.read denied');
  });
});

describe('fs.pipe', () => {
  let pipeArgs: any;
  let pipeResult: Promise<any>;
  let progress: number[];

  beforeEach(() => {
    pipeArgs = null;
    progress = [];
    pipeResult = Promise.resolve({ bytes: 1234 });
    const base = g.__glyx_backend_call2;
    g.__glyx_backend_call2 = (command: string, arg: any) => {
      if (command === 'glyx_stream.pipe') {
        pipeArgs = arg;
        return pipeResult.then((r) => JSON.stringify(r));
      }
      if (command === 'glyx_stream.progress') {
        // The list in order, then the last value again (progress never goes backwards).
        const bytes = progress.length > 1 ? progress.shift()! : (progress[0] ?? 0);
        return Promise.resolve(JSON.stringify({ bytes }));
      }
      return base(command, arg);
    };
  });

  test('copies one stream into another by id and resolves with the bytes', async () => {
    const from = await fs.openRead('a.bin');
    const to = await fs.openWrite('b.bin');
    expect(await fs.pipe(from, to)).toBe(1234);
    expect(pipeArgs).toEqual({ from: 7, to: 7 });
    // No bytes passed through JavaScript: no read or write request was made.
    expect(names().filter((n) => n === 'glyx_stream.read' || n === 'glyx_stream.write')).toEqual([]);
  });

  test('both streams are finished for their objects afterwards: no further native calls from close or read', async () => {
    const from = await fs.openRead('a.bin');
    const to = await fs.openWrite('b.bin');
    await fs.pipe(from, to);
    const before = calls.length;
    expect(await from.read()).toBeNull();
    await from.cancel();
    await to.close();
    await to.cancel();
    await expect(to.write('x')).rejects.toThrow('write after close');
    expect(calls.length).toBe(before);
  });

  test('a read stream that was already read from is refused before anything is sent', async () => {
    chunks = [new Uint8Array([1]), new Uint8Array([2])];
    const from = await fs.openRead('a.bin');
    await from.read();
    const to = await fs.openWrite('b.bin');
    await expect(fs.pipe(from, to)).rejects.toThrow('nobody has read from');
    expect(pipeArgs).toBeNull();
    await from.cancel();
  });

  test('a closed writer is refused, and the reader it was meant for is cancelled', async () => {
    const from = await fs.openRead('a.bin');
    const to = await fs.openWrite('b.bin');
    await to.close();
    await expect(fs.pipe(from, to)).rejects.toThrow('already closed');
    expect(names()).toContain('glyx_stream.cancel');
    expect(pipeArgs).toBeNull();
  });

  test('anything that is not one of our streams is a TypeError', async () => {
    const to = await fs.openWrite('b.bin');
    await expect(fs.pipe({} as any, to)).rejects.toBeInstanceOf(TypeError);
    await expect(fs.pipe(await fs.openRead('a.bin'), {} as any)).rejects.toBeInstanceOf(TypeError);
  });

  test('a failed copy rejects with the runtime\'s reason', async () => {
    pipeResult = Promise.reject(new Error('write failed: disk full'));
    const from = await fs.openRead('a.bin');
    const to = await fs.openWrite('b.bin');
    await expect(fs.pipe(from, to)).rejects.toThrow('disk full');
  });

  test('onProgress hears the bytes so far while it runs, and the final count', async () => {
    progress = [100, 400, 900];
    pipeResult = new Promise((resolve) => setTimeout(() => resolve({ bytes: 1234 }), 120));
    const heard: number[] = [];
    const from = await fs.openRead('a.bin');
    const to = await fs.openWrite('b.bin');
    expect(await fs.pipe(from, to, { onProgress: (b) => heard.push(b), progressEveryMs: 15 })).toBe(1234);
    expect(heard.length).toBeGreaterThanOrEqual(2);
    expect(heard[heard.length - 1]).toBe(1234);
    expect(heard.slice(0, -1).every((b, i, all) => i === 0 || b >= all[i - 1])).toBe(true);
    // Polling stops with the pipe.
    const polls = names().filter((n) => n === 'glyx_stream.progress').length;
    await new Promise((r) => setTimeout(r, 60));
    expect(names().filter((n) => n === 'glyx_stream.progress').length).toBe(polls);
  });

  test('a progress callback that throws does not stop the copy', async () => {
    const from = await fs.openRead('a.bin');
    const to = await fs.openWrite('b.bin');
    expect(await fs.pipe(from, to, { onProgress: () => { throw new Error('ui bug'); } })).toBe(1234);
  });
});

describe('UTF-8 without TextEncoder and TextDecoder', () => {
  const samples = ['', 'plain ascii', 'héllo wörld', 'ひらがな 漢字', 'emoji 😀 and 👨\u200d👩\u200d👧', '\u0000 nul and \u007f del', 'edge \u07ff \u0800 \uffff', 'astral \u{10000} \u{10ffff}'];

  const without = <T>(run: () => T): T => {
    const enc = g.TextEncoder;
    const dec = g.TextDecoder;
    g.TextEncoder = undefined;
    g.TextDecoder = undefined;
    try {
      return run();
    } finally {
      g.TextEncoder = enc;
      g.TextDecoder = dec;
    }
  };

  test('the plain encoder gives the bytes TextEncoder gives, and the decoder round trips them', () => {
    for (const text of samples) {
      const want = new TextEncoder().encode(text);
      const got = without(() => utf8Encode(text));
      expect(Array.from(got)).toEqual(Array.from(want));
      expect(without(() => utf8Decode(want))).toBe(text);
    }
  });

  test('a lone surrogate becomes U+FFFD, as TextEncoder does', () => {
    const text = 'a\ud800b\udc00c';
    expect(Array.from(without(() => utf8Encode(text)))).toEqual(Array.from(new TextEncoder().encode(text)));
  });

  test('invalid UTF-8 becomes U+FFFD in the same places TextDecoder puts it', () => {
    const bad = [
      [0x61, 0xff, 0x62],                  // a byte that is never valid
      [0xc3],                              // a sequence cut short at the end
      [0xe2, 0x82],                        // another one
      [0xc0, 0x80],                        // an overlong encoding
      [0xed, 0xa0, 0x80],                  // an encoded surrogate
      [0xf4, 0x90, 0x80, 0x80],            // above U+10FFFF
      [0x80, 0x80, 0x41],                  // continuation bytes with no start
      [0xe2, 0x28, 0xa1],                  // a start byte followed by a non-continuation
    ];
    for (const bytes of bad) {
      const u8 = Uint8Array.from(bytes);
      expect(without(() => utf8Decode(u8))).toBe(new TextDecoder().decode(u8));
    }
  });

  test('a long text decodes without running out of arguments', () => {
    const text = 'x'.repeat(200_000) + 'é😀';
    const bytes = new TextEncoder().encode(text);
    expect(without(() => utf8Decode(bytes))).toBe(text);
  });

  test('write() accepts a string even where the runtime has no TextEncoder', async () => {
    const w = await fs.openWrite('a.bin');
    await without(async () => { await w.write('hé'); });
    expect(Array.from(written[0])).toEqual([0x68, 0xc3, 0xa9]);
  });
});
