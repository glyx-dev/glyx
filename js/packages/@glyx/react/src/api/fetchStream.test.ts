import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { fetch } from './fetch.js';
import { fs } from './fs.js';

const g = globalThis as any;

// A stand-in for the runner: `glyx_stream.fetch` answers the response head, `glyx_stream.read` hands out the body chunks.
let calls: Array<{ command: string; arg: any }>;
let body: Uint8Array[];
let head: any;
let parsedJson: boolean;
let plainFetchCalls: number;

beforeEach(() => {
  calls = [];
  body = [];
  parsedJson = false;
  plainFetchCalls = 0;
  head = { id: 3, status: 200, ok: true, statusText: 'OK', headers: { 'Content-Type': 'application/octet-stream', 'X-Test': 'one, two' }, url: 'https://example.com/final' };
  g.__glyx_fetch = () => {
    plainFetchCalls++;
    return Promise.resolve(JSON.stringify({ status: 200, ok: true, statusText: 'OK', headers: {}, body: 'plain', url: 'https://example.com/' }));
  };
  g.__glyx_backend_call2 = (command: string, arg: any) => {
    calls.push({ command, arg });
    if (command === 'glyx_stream.fetch') return arg.url.includes('fail') ? Promise.reject(new Error('fetch: host is a private/loopback address (SSRF denied)')) : Promise.resolve(parsedJson ? head : JSON.stringify(head));
    if (command === 'glyx_stream.read') {
      const next = body.shift();
      const out = new Uint8Array(1 + (next ? next.length : 0));
      out[0] = next ? 0 : 1;
      if (next) out.set(next, 1);
      return Promise.resolve(out.buffer);
    }
    return Promise.resolve('{}');
  };
});

afterEach(() => {
  delete g.__glyx_backend_call2;
  delete g.__glyx_fetch;
});

describe('fetch(url, { stream: true })', () => {
  test('asks the runtime with the method, headers and string body, and describes the response', async () => {
    const res = await fetch('https://example.com/file', { stream: true, method: 'post', headers: { Authorization: 'Bearer x' }, body: 'hi' });
    expect(calls[0].command).toBe('glyx_stream.fetch');
    expect(calls[0].arg).toEqual({ url: 'https://example.com/file', method: 'post', headers: { authorization: 'Bearer x' }, body: 'hi' });
    expect([res.status, res.ok, res.statusText, res.url]).toEqual([200, true, 'OK', 'https://example.com/final']);
    expect(res.headers.get('content-type')).toBe('application/octet-stream');
    expect(res.headers.get('X-TEST')).toBe('one, two');
    expect(res.bodyUsed).toBe(false);
    await res.cancel();
  });

  test('works whether the runner answers JSON text or an already parsed value', async () => {
    parsedJson = true;
    const res = await fetch('https://example.com/file', { stream: true });
    expect(res.status).toBe(200);
    await res.cancel();
  });

  test('the body is a stream of bytes, in order, and reading it uses the body', async () => {
    body = [new Uint8Array([1, 2, 3]), new Uint8Array([4])];
    const res = await fetch('https://example.com/file', { stream: true });
    const got: number[] = [];
    for await (const chunk of res.body) got.push(...chunk);
    expect(got).toEqual([1, 2, 3, 4]);
    expect(res.bodyUsed).toBe(true);
    await expect(res.text()).rejects.toThrow('already been consumed');
  });

  test('text() joins the chunks and decodes UTF-8 across a chunk boundary', async () => {
    const bytes = new TextEncoder().encode('héllo 😀 wörld');
    // Cut in the middle of the two-byte é and of the four-byte emoji.
    body = [bytes.slice(0, 2), bytes.slice(2, 9), bytes.slice(9)];
    const res = await fetch('https://example.com/file', { stream: true });
    expect(await res.text()).toBe('héllo 😀 wörld');
  });

  test('json() parses the body', async () => {
    body = [new TextEncoder().encode('{"a":'), new TextEncoder().encode('[1,2,3]}')];
    expect(await (await fetch('https://example.com/file', { stream: true })).json()).toEqual({ a: [1, 2, 3] });
  });

  test('arrayBuffer() gives the exact bytes of a binary body (the text path would mangle them)', async () => {
    const binary = Uint8Array.from([0, 255, 128, 10, 13, 0xc3, 0x28, 254]);
    body = [binary.slice(0, 3), binary.slice(3)];
    const buf = await (await fetch('https://example.com/file', { stream: true })).arrayBuffer();
    expect(buf.byteLength).toBe(binary.length);
    expect(Array.from(new Uint8Array(buf))).toEqual(Array.from(binary));
  });

  test('an error status still gives a response with ok false and a readable body', async () => {
    head = { ...head, status: 404, ok: false, statusText: 'Not Found' };
    body = [new TextEncoder().encode('no such thing')];
    const res = await fetch('https://example.com/file', { stream: true });
    expect([res.status, res.ok]).toEqual([404, false]);
    expect(await res.text()).toBe('no such thing');
  });

  test('cancel() closes the connection once', async () => {
    const res = await fetch('https://example.com/file', { stream: true });
    await res.cancel();
    await res.cancel();
    expect(calls.filter((c) => c.command === 'glyx_stream.cancel').length).toBe(1);
    expect(calls.find((c) => c.command === 'glyx_stream.cancel')!.arg).toEqual({ id: 3 });
  });

  test('a refused request rejects with the runtime\'s reason, and nothing is left open', async () => {
    await expect(fetch('https://example.com/fail', { stream: true })).rejects.toThrow('SSRF denied');
  });

  test('multipart is refused with a pointer to the non-streaming call, before anything is sent', async () => {
    await expect(fetch('https://example.com/file', { stream: true, multipart: [{ name: 'a', value: 'b' }] })).rejects.toThrow('not multipart');
    expect(calls.length).toBe(0);
  });

  test('without stream: true nothing changed: the text path is used', async () => {
    const res = await fetch('https://example.com/file');
    expect(plainFetchCalls).toBe(1);
    expect(await res.text()).toBe('plain');
    expect(calls.length).toBe(0);
  });

  test('the body can be piped to a file by fs.pipe', async () => {
    let pipeArgs: any;
    const base = g.__glyx_backend_call2;
    g.__glyx_backend_call2 = (command: string, arg: any) => {
      if (command === 'glyx_stream.open') return Promise.resolve(JSON.stringify({ id: 11 }));
      if (command === 'glyx_stream.pipe') { pipeArgs = arg; return Promise.resolve(JSON.stringify({ bytes: 5 })); }
      return base(command, arg);
    };
    const res = await fetch('https://example.com/file', { stream: true });
    const out = await fs.openWrite('download.bin');
    expect(await fs.pipe(res.body, out)).toBe(5);
    expect(pipeArgs).toEqual({ from: 3, to: 11 });
  });
});
