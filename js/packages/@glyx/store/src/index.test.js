import { test, expect } from 'bun:test';
import { db } from '@glyx-dev/react';
import { initStore, createStore } from './index.js';

test('createStore rejects an invalid namespace', () => {
  expect(() => createStore('', {})).toThrow('namespace');
  expect(() => createStore(null, {})).toThrow('namespace');
});

test('createStore returns the same hook for a duplicate namespace', () => {
  const a = createStore('settings-test', { theme: 'dark' });
  const b = createStore('settings-test', { theme: 'light' });
  expect(b).toBe(a);
});

test('initStore resolves once a db handle is open, and is idempotent', async () => {
  // db.run needs a default handle — same requirement as a real app.
  await db.open(':memory:');
  await initStore();
  // Second call reuses the same promise.
  await initStore();
});
