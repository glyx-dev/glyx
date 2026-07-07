import { test, expect } from 'bun:test';
import { installStubs, mockBinding, waitFor } from './index.js';

// setup.js (bunfig preload) already ran installStubs; these tests assert the
// harness contract that every other package's tests rely on.

test('installStubs provides the core scene-graph bindings', () => {
  expect(typeof globalThis.__glyx_createNode).toBe('function');
  expect(typeof globalThis.__glyx_pollEvents).toBe('function');
  expect(globalThis.__glyx_pollEvents()).toEqual([]);
  expect(globalThis.__glyx_getLayout()).toEqual({ x: 0, y: 0, width: 0, height: 0 });
  expect(globalThis.__glyx_getWindowSize()).toEqual({ width: 1280, height: 800 });
});

test('createNode ids are unique and increasing', () => {
  const a = globalThis.__glyx_createNode();
  const b = globalThis.__glyx_createNode();
  expect(b).toBeGreaterThan(a);
});

test('async bindings resolve to sensible defaults', async () => {
  await expect(globalThis.__glyx_readFile()).resolves.toBe('');
  await expect(globalThis.__glyx_db_query()).resolves.toBe('[]');
  const fetched = JSON.parse(await globalThis.__glyx_fetch());
  expect(fetched.ok).toBe(true);
});

test('mockBinding overrides a stub for custom behavior', async () => {
  mockBinding('__glyx_readFile', () => Promise.resolve('hello'));
  await expect(globalThis.__glyx_readFile()).resolves.toBe('hello');
  installStubs(); // restore defaults for later tests
});

test('waitFor polls until the assertion passes', async () => {
  let flag = false;
  setTimeout(() => { flag = true; }, 60);
  await waitFor(() => { if (!flag) throw new Error('not yet'); }, { timeout: 1000 });
  expect(flag).toBe(true);
});

test('waitFor throws the last error on timeout', async () => {
  await expect(
    waitFor(() => { throw new Error('never passes'); }, { timeout: 120, interval: 30 })
  ).rejects.toThrow('never passes');
});
