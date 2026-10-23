import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { ai } from './ai.js';

const g = globalThis as any;
const enc = (s: string) => new TextEncoder().encode(s);

// A stand-in for the runner: `glyx_stream.generate` opens stream 7, whose reads give the queued chunks and then the end.
let calls: Array<{ command: string; arg: any }>;
let chunks: Uint8Array[];
let failOpen: string | null;
let failRead: string | null;

beforeEach(() => {
  calls = [];
  chunks = [];
  failOpen = null;
  failRead = null;
  g.__glyx_backend_call2 = (command: string, arg: any) => {
    calls.push({ command, arg });
    switch (command) {
      case 'glyx_stream.generate':
        return failOpen ? Promise.reject(new Error(failOpen)) : Promise.resolve(JSON.stringify({ id: 7 }));
      case 'glyx_stream.read': {
        if (failRead && chunks.length === 0) return Promise.reject(new Error(failRead));
        const next = chunks.shift();
        const out = new Uint8Array(1 + (next ? next.length : 0));
        out[0] = next ? 0 : 1;
        if (next) out.set(next, 1);
        return Promise.resolve(out.buffer);
      }
      default:
        return Promise.resolve('{}');
    }
  };
});

afterEach(() => {
  delete g.__glyx_backend_call2;
});

const collect = async (it: AsyncIterable<string>) => {
  const out: string[] = [];
  for await (const piece of it) out.push(piece);
  return out;
};

describe('ai.generateStream', () => {
  test('sends the prompt and options (with the defaults) and yields the text as it arrives', async () => {
    chunks = [enc('Paris'), enc(' is the'), enc(' capital.')];
    const out = await collect(ai.generateStream('Capital of France?', { maxTokens: 30, temperature: 0 }));
    expect(out).toEqual(['Paris', ' is the', ' capital.']);
    expect(calls[0]).toEqual({ command: 'glyx_stream.generate', arg: { prompt: 'Capital of France?', maxTokens: 30, temperature: 0 } });
    await collect(ai.generateStream(42));
    expect(calls.find((c, i) => i > 0 && c.command === 'glyx_stream.generate')!.arg).toEqual({ prompt: '42', maxTokens: 200, temperature: 0.7 });
  });

  test('multi-byte characters come out whole', async () => {
    chunks = [enc('w\u00f6rld '), enc('\u{1f600}'), enc(' \u65e5\u672c')];
    expect((await collect(ai.generateStream('x'))).join('')).toBe('w\u00f6rld \u{1f600} \u65e5\u672c');
  });

  test('a stream that ran to its end is already closed by the runtime; leaving the loop early cancels it, once', async () => {
    chunks = [enc('a')];
    await collect(ai.generateStream('x'));
    expect(calls.filter((c) => c.command === 'glyx_stream.cancel').length).toBe(0);

    calls.length = 0;
    chunks = [enc('one'), enc('two'), enc('three')];
    for await (const piece of ai.generateStream('x')) {
      expect(piece).toBe('one');
      break;
    }
    const cancel = calls.filter((c) => c.command === 'glyx_stream.cancel');
    expect(cancel.length).toBe(1);
    expect(cancel[0].arg).toEqual({ id: 7 });
  });

  test('a refusal to start rejects with the runtime\'s reason, and nothing is left open', async () => {
    failOpen = 'missing capability "ai" -- add it to glyx.config.json';
    await expect(collect(ai.generateStream('x'))).rejects.toThrow('missing capability "ai"');
    expect(calls.some((c) => c.command === 'glyx_stream.cancel')).toBe(false);
  });

  test('an error from the model ends the loop with that error, after the text that was made', async () => {
    chunks = [enc('partial')];
    failRead = 'ai.generate: the model ran out of memory';
    const seen: string[] = [];
    await expect((async () => { for await (const p of ai.generateStream('x')) seen.push(p); })()).rejects.toThrow('ran out of memory');
    expect(seen).toEqual(['partial']);
  });

  test('without the runner support it says so instead of throwing a TypeError', async () => {
    delete g.__glyx_backend_call2;
    await expect(collect(ai.generateStream('x'))).rejects.toThrow('binding not available');
  });
});
