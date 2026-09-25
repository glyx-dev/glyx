import { test, expect } from 'bun:test';
import { installStubs, mockBinding } from '@glyx-dev/testing';
import { createKeychain } from './index.js';

test('createKeychain rejects an invalid namespace', () => {
  expect(() => createKeychain('')).toThrow('namespace');
  expect(() => createKeychain(null)).toThrow('namespace');
});

test('get returns null when nothing is stored (stub default)', async () => {
  installStubs();
  const chain = createKeychain('test');
  expect(await chain.get('missing')).toBe(null);
});

test('set/get round-trips JSON values with namespaced keys', async () => {
  const stored = new Map();
  // Native binding signature: (service, key, value).
  mockBinding('__glyx_credentials_set', (service, key, value) => {
    stored.set(`${service}/${key}`, value);
    return Promise.resolve(null);
  });
  // Mirrors the REAL native binding: the stored string comes back wrapped in a
  // JSON envelope (`serde_json::to_string(&stored)` in bind_sys.rs), and
  // `'null'` when absent. The previous mock returned the stored value bare,
  // which let this test pass while real keychain.get() returned JSON text.
  mockBinding('__glyx_credentials_get', (service, key) => {
    const v = stored.get(`${service}/${key}`);
    return Promise.resolve(v === undefined ? 'null' : JSON.stringify(v));
  });

  const chain = createKeychain('auth');
  await chain.set('token', { bearer: 'abc', exp: 42 });
  await chain.set('name', 'abc');

  // Keys are namespaced as "namespace:key" to prevent collisions.
  expect([...stored.keys()]).toEqual(['glyx/auth:token', 'glyx/auth:name']);
  expect(await chain.get('token')).toEqual({ bearer: 'abc', exp: 42 });
  // A string comes back as the string — not its JSON text ('"abc"').
  expect(await chain.get('name')).toBe('abc');
  expect(await chain.get('missing')).toBe(null);

  installStubs(); // restore defaults
});

test('get returns a value stored by other code (not JSON) as-is', async () => {
  mockBinding('__glyx_credentials_get', () => Promise.resolve(JSON.stringify('plain token')));
  expect(await createKeychain('auth').get('legacy')).toBe('plain token');
  installStubs();
});
