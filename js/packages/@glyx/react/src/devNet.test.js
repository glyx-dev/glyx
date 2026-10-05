import { test, expect, afterEach } from 'bun:test';
import { fetch } from './api.js';
import { BODY_LIMIT, netIpc } from './devNet.js';

const saved = { fetch: globalThis.__glyx_fetch, net: globalThis.__glyx_devNet };
afterEach(() => {
  delete globalThis.__glyx_devtools;
  globalThis.__glyx_fetch = saved.fetch;
  globalThis.__glyx_devNet = saved.net;
});

function record() {
  const events = [];
  globalThis.__glyx_devtools = true;
  globalThis.__glyx_devNet = (json) => events.push(JSON.parse(json));
  return events;
}

test('nothing is recorded without devtools', async () => {
  const events = [];
  globalThis.__glyx_devNet = (json) => events.push(json);
  globalThis.__glyx_fetch = async () => JSON.stringify({ status: 200, ok: true, headers: {}, body: 'x' });
  await fetch('https://api.example.com/a');
  expect(events).toHaveLength(0);
});

test('a fetch reports its request and response', async () => {
  const events = record();
  globalThis.__glyx_fetch = async () => JSON.stringify({ status: 201, ok: true, statusText: 'Created', headers: { 'content-type': 'application/json' }, body: '{"ok":1}' });
  const res = await fetch('https://api.example.com/items', { method: 'post', body: { name: 'a' } });
  expect(await res.json()).toEqual({ ok: 1 });
  const [req, done] = events;
  expect(req).toMatchObject({ t: 'request', kind: 'fetch', method: 'POST', url: 'https://api.example.com/items', body: '{"name":"a"}', size: 12 });
  expect(req.headers['content-type']).toBe('application/json');
  expect(done).toMatchObject({ t: 'response', id: req.id, status: 201, statusText: 'Created', body: '{"ok":1}' });
  expect(typeof done.ts).toBe('number');
});

test('a failed fetch is reported and still throws', async () => {
  const events = record();
  globalThis.__glyx_fetch = async () => { throw new Error('network.allow["x"]'); };
  await expect(fetch('https://x/')).rejects.toThrow('network.allow');
  expect(events.map((e) => e.t)).toEqual(['request', 'failed']);
  expect(events[1].error).toBe('network.allow["x"]');
});

test('large bodies are clipped but keep their real size', async () => {
  const events = record();
  const big = 'y'.repeat(BODY_LIMIT + 10);
  globalThis.__glyx_fetch = async () => JSON.stringify({ status: 200, ok: true, headers: {}, body: big });
  const res = await fetch('https://api.example.com/big');
  expect((await res.text()).length).toBe(big.length); // the app still gets everything
  expect(events[1].body.length).toBe(BODY_LIMIT);
  expect(events[1].size).toBe(big.length);
});

test('IPC messages group per peer window', () => {
  const events = record();
  netIpc('out', 2, 'a');
  netIpc('out', 2, 'b');
  netIpc('in', null, 'c');
  const starts = events.filter((e) => e.t === 'request');
  expect(starts.map((e) => e.url)).toEqual(['to window 2', 'received']);
  expect(events.filter((e) => e.t === 'frame').map((e) => [e.dir, e.data])).toEqual([['out', 'a'], ['out', 'b'], ['in', 'c']]);
  // Messages name their channel, so a cleared record can be recreated.
  expect(events.find((e) => e.t === 'frame')).toMatchObject({ kind: 'ipc', url: 'to window 2' });
});
