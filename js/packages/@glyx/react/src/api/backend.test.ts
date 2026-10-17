import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { backend } from './backend.js';

const g = globalThis as any;

// The runner answers a Rust command with a promise marked `__glyxRaw` that resolves with the command's
// JSON string; a JS plugin's own return value comes back untouched.
function rustCommand(json: string | Promise<string>) {
  const p: any = Promise.resolve(json);
  p.__glyxRaw = true;
  return p;
}

describe('backend calls with __glyx_backend_call2', () => {
  let calls: Array<[string, unknown]>;
  beforeEach(() => {
    calls = [];
  });
  afterEach(() => {
    delete g.__glyx_backend_call2;
    delete g.__glyx_backend_call;
    delete g.__glyx_devtools;
    delete g.__glyx_devNet;
  });

  test('a JS plugin gets the very value it was given, and its result comes back untouched', async () => {
    const arg = { n: 1, bytes: new Uint8Array([1, 2, 3]), when: new Date(0) };
    g.__glyx_backend_call2 = (cmd: string, a: unknown) => { calls.push([cmd, a]); return Promise.resolve(a); };
    const result = await backend.notes.touch(arg);
    expect(calls).toEqual([['notes.touch', arg]]);
    expect(calls[0][1]).toBe(arg);              // not a copy
    expect(result).toBe(arg);
    expect(result.bytes).toBeInstanceOf(Uint8Array);
    expect(result.when).toBeInstanceOf(Date);   // JSON would have made these a plain object and a string
  });

  test('a string a plugin returns stays a string, even one that looks like JSON', async () => {
    g.__glyx_backend_call2 = (cmd: string) => Promise.resolve(cmd === 'notes.digits' ? '123' : 'true');
    expect(await backend.notes.digits()).toBe('123');
    expect(await backend.notes.truth()).toBe('true');
  });

  test('a plugin function that is not async works too', async () => {
    g.__glyx_backend_call2 = () => 42;
    expect(await backend.notes.plain()).toBe(42);
  });

  test('a call with no argument passes {}', async () => {
    g.__glyx_backend_call2 = (cmd: string, a: unknown) => { calls.push([cmd, a]); return Promise.resolve(null); };
    await backend.notes.list();
    await backend.notes.list(undefined);
    expect(calls).toEqual([['notes.list', {}], ['notes.list', {}]]);
  });

  test('a Rust command resolves to its parsed JSON; text that is not JSON stays text', async () => {
    g.__glyx_backend_call2 = (cmd: string) => rustCommand(cmd === 'greet' ? '{"hello":"Alice","n":[1,2]}' : 'plain words');
    expect(await backend.greet({ name: 'Alice' })).toEqual({ hello: 'Alice', n: [1, 2] });
    expect(await backend.say()).toBe('plain words');
  });

  test('rejections pass through, and a plugin that throws synchronously rejects the call', async () => {
    g.__glyx_backend_call2 = (cmd: string) => {
      if (cmd === 'notes.boom') throw new Error('sync failure');
      const p: any = Promise.reject(new Error('nope'));
      p.__glyxRaw = true;
      return p;
    };
    await expect(backend.notes.boom()).rejects.toThrow('sync failure');
    await expect(backend.fails()).rejects.toThrow('nope');
  });

  test('without __glyx_backend_call2 (an older runner) it still works through JSON', async () => {
    g.__glyx_backend_call = (cmd: string, json: string) => {
      calls.push([cmd, JSON.parse(json)]);
      return Promise.resolve('{"ok":true}');
    };
    expect(await backend.ping({ a: 1 })).toEqual({ ok: true });
    expect(calls).toEqual([['ping', { a: 1 }]]);
  });

  test('DevTools gets the request and the response only while recording', async () => {
    const events: any[] = [];
    g.__glyx_backend_call2 = () => Promise.resolve({ answer: 42 });
    await backend.notes.get({ id: 1 });
    expect(events).toEqual([]);                       // not recording: nothing is built or sent

    g.__glyx_devtools = true;
    g.__glyx_devNet = (e: string) => events.push(JSON.parse(e));
    await backend.notes.get({ id: 1 });
    expect(events.map((e) => e.t)).toEqual(['request', 'response']);
    expect(events[0].url).toBe('notes.get');
    expect(JSON.parse(events[0].body)).toEqual({ id: 1 });
    expect(JSON.parse(events[1].body)).toEqual({ answer: 42 });
  });

  test('a cyclic argument does not break the call when DevTools is recording', async () => {
    g.__glyx_devtools = true;
    g.__glyx_devNet = () => {};
    g.__glyx_backend_call2 = (_cmd: string, a: any) => Promise.resolve(a);
    const cyclic: any = {};
    cyclic.self = cyclic;
    expect(await backend.notes.keep(cyclic)).toBe(cyclic);
  });
});
