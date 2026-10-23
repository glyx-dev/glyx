import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { shell } from './shell.js';
import { streamLines } from './streams.js';

const g = globalThis as any;
const enc = (s: string) => new TextEncoder().encode(s);

// A stand-in for the runner. Each stream id has a queue of chunks; `glyx_stream.spawn` answers the ids it was set up with.
let calls: Array<{ command: string; arg: any }>;
let queues: Record<number, Uint8Array[]>;
let spawnAnswer: any;
let waitAnswer: any;
let failSpawn: string | null;

beforeEach(() => {
  calls = [];
  queues = { 11: [], 12: [] };
  failSpawn = null;
  waitAnswer = { exitCode: 0, timedOut: false };
  spawnAnswer = { process: 10, pid: 4321, stdout: 11, stderr: 12, stdin: null };
  g.__glyx_backend_call2 = (command: string, arg: any) => {
    calls.push({ command, arg });
    switch (command) {
      case 'glyx_stream.spawn':
        return failSpawn ? Promise.reject(new Error(failSpawn)) : Promise.resolve(JSON.stringify(spawnAnswer));
      case 'glyx_stream.read': {
        const id = new DataView(arg.buffer, arg.byteOffset).getUint32(0, true);
        const next = (queues[id] ?? []).shift();
        const out = new Uint8Array(1 + (next ? next.length : 0));
        out[0] = next ? 0 : 1;
        if (next) out.set(next, 1);
        return Promise.resolve(out.buffer);
      }
      case 'glyx_stream.write':
        return Promise.resolve(new ArrayBuffer(0));
      case 'glyx_stream.wait':
        return Promise.resolve(JSON.stringify(waitAnswer));
      default:
        return Promise.resolve('{}');
    }
  };
});

afterEach(() => {
  delete g.__glyx_backend_call2;
});

const names = () => calls.map((c) => c.command);

describe('shell.spawn', () => {
  test('sends the binary, arguments and options, and gives back the process', async () => {
    const p = await shell.spawn('git', ['log', '--oneline'], { stdin: false, stderr: 'ignore', timeoutMs: 5000 });
    expect(calls[0]).toEqual({
      command: 'glyx_stream.spawn',
      arg: { bin: 'git', args: ['log', '--oneline'], stdin: false, stdout: undefined, stderr: 'ignore', timeoutMs: 5000 },
    });
    expect(p.pid).toBe(4321);
    expect(p.stdout).not.toBeNull();
    expect(p.stderr).not.toBeNull();
    expect(p.stdin).toBeNull();
  });

  test('a pipe that was not opened is null, and asking for its lines says why', async () => {
    spawnAnswer = { process: 10, pid: null, stdout: 11, stderr: null, stdin: 13 };
    const p = await shell.spawn('tool', [], { stderr: 'ignore', stdin: true });
    expect(p.stderr).toBeNull();
    expect(p.stdin).not.toBeNull();
    expect(p.pid).toBeNull();
    expect(() => p.lines('stderr')).toThrow("started as 'ignore'");
  });

  test('stdout arrives as lines while the process runs', async () => {
    queues[11] = [enc('first\nsec'), enc('ond\r\nthird'), enc(' no newline')];
    const p = await shell.spawn('tool');
    const got: string[] = [];
    for await (const line of p.lines()) got.push(line);
    expect(got).toEqual(['first', 'second', 'third no newline']);
  });

  test('stderr lines are separate from stdout lines', async () => {
    queues[11] = [enc('out\n')];
    queues[12] = [enc('warn\n')];
    const p = await shell.spawn('tool');
    const err: string[] = [];
    for await (const line of p.lines('stderr')) err.push(line);
    expect(err).toEqual(['warn']);
    expect((await p.stdout!.read())![0]).toBe('o'.charCodeAt(0));
  });

  test('stdin is a write stream: write, then close to end the input', async () => {
    spawnAnswer = { process: 10, pid: 1, stdout: 11, stderr: 12, stdin: 13 };
    const p = await shell.spawn('tool', [], { stdin: true });
    await p.stdin!.write('hello\n');
    await p.stdin!.close();
    const write = calls.find((c) => c.command === 'glyx_stream.write')!;
    expect(new DataView(write.arg.buffer).getUint32(0, true)).toBe(13);
    expect(names()).toContain('glyx_stream.close');
    expect(calls.find((c) => c.command === 'glyx_stream.close')!.arg).toEqual({ id: 13 });
  });

  test('wait resolves with the exit code and whether the timeout ended it', async () => {
    waitAnswer = { exitCode: 3, timedOut: true };
    const p = await shell.spawn('tool');
    expect(await p.wait()).toEqual({ exitCode: 3, timedOut: true });
    expect(calls.find((c) => c.command === 'glyx_stream.wait')!.arg).toEqual({ id: 10 });
  });

  test('kill asks the runtime and never throws, even if the process is gone', async () => {
    const p = await shell.spawn('tool');
    await p.kill();
    expect(calls.find((c) => c.command === 'glyx_stream.kill')!.arg).toEqual({ id: 10 });
    g.__glyx_backend_call2 = () => Promise.reject(new Error('stream 10 is not open'));
    await p.kill();
  });

  test('a refused spawn rejects with the runtime\'s reason', async () => {
    failSpawn = 'shellExec.allow["rm"] — add to glyx.config.json';
    await expect(shell.spawn('rm', ['-rf'])).rejects.toThrow('shellExec.allow');
  });

  test('without the runner support it says so instead of throwing a TypeError', async () => {
    delete g.__glyx_backend_call2;
    await expect(shell.spawn('tool')).rejects.toThrow('binding not available');
  });
});

describe('streamLines', () => {
  // A read stream over fixed chunks, with the bits of the stream interface streamLines uses.
  const fake = (chunks: Uint8Array[], onCancel?: () => void) => ({
    chunks: chunks.slice(),
    read: async function (this: any) { return this.chunks.shift() ?? null; },
    cancel: async () => { onCancel?.(); },
    close: async () => {},
    [Symbol.asyncIterator]() { throw new Error('not used'); },
  }) as any;

  const collect = async (chunks: Uint8Array[]) => {
    const out: string[] = [];
    for await (const line of streamLines(fake(chunks))) out.push(line);
    return out;
  };

  test('splits on \\n and \\r\\n, keeps empty lines, and ends without a phantom last line', async () => {
    expect(await collect([enc('a\nb\r\n\nc\n')])).toEqual(['a', 'b', '', 'c']);
    expect(await collect([enc('')])).toEqual([]);
    expect(await collect([])).toEqual([]);
    expect(await collect([enc('\n')])).toEqual(['']);
  });

  test('a line split across chunks, at any byte, comes out whole', async () => {
    const text = 'alpha\nbeta\r\ngamma\n';
    const bytes = enc(text);
    for (let cut = 1; cut < bytes.length; cut++) {
      expect(await collect([bytes.slice(0, cut), bytes.slice(cut)])).toEqual(['alpha', 'beta', 'gamma']);
    }
    // One byte at a time, including a \r at the end of a chunk and its \n at the start of the next.
    expect(await collect(Array.from(bytes, (b) => Uint8Array.of(b)))).toEqual(['alpha', 'beta', 'gamma']);
  });

  test('a multi-byte character split across chunks is not damaged', async () => {
    const bytes = enc('héllo 😀 wörld\nnext\n');
    for (let cut = 1; cut < bytes.length; cut++) {
      expect(await collect([bytes.slice(0, cut), bytes.slice(cut)])).toEqual(['héllo 😀 wörld', 'next']);
    }
  });

  test('a last line without a line end is still a line, and a lone final \\r is dropped', async () => {
    expect(await collect([enc('a\nb')])).toEqual(['a', 'b']);
    expect(await collect([enc('a\nb\r')])).toEqual(['a', 'b']);
  });

  test('leaving the loop early cancels the stream once; reading to the end cancels harmlessly too', async () => {
    let cancels = 0;
    for await (const _ of streamLines(fake([enc('1\n2\n3\n')], () => cancels++))) break;
    expect(cancels).toBe(1);
    cancels = 0;
    for await (const _ of streamLines(fake([enc('1\n')], () => cancels++))) { /* to the end */ }
    expect(cancels).toBe(1);
  });

  test('a read error ends the loop with that error, and the stream is released', async () => {
    let cancels = 0;
    const failing: any = {
      read: async () => { throw new Error('pipe broke'); },
      cancel: async () => { cancels++; },
    };
    await expect((async () => { for await (const _ of streamLines(failing)) { /* nothing */ } })()).rejects.toThrow('pipe broke');
    expect(cancels).toBe(1);
  });

  test('works on a file stream too (log tailing from the start)', async () => {
    const { fs } = await import('./fs.js');
    g.__glyx_backend_call2 = (command: string, arg: any) => {
      if (command === 'glyx_stream.open') return Promise.resolve(JSON.stringify({ id: 5 }));
      if (command === 'glyx_stream.read') {
        const seq = new DataView(arg.buffer, arg.byteOffset).getUint32(4, true);
        const out = seq === 0 ? Uint8Array.from([0, ...enc('line one\nline two\n')]) : Uint8Array.of(1);
        return Promise.resolve(out.buffer);
      }
      return Promise.resolve('{}');
    };
    const lines: string[] = [];
    for await (const line of streamLines(await fs.openRead('app.log'))) lines.push(line);
    expect(lines).toEqual(['line one', 'line two']);
  });
});
