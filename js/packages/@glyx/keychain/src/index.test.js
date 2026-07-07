import { test, expect } from 'bun:test';
import { installStubs, mockBinding } from '@glyx/testing';
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
  mockBinding('__glyx_credentials_get', (service, key) =>
    Promise.resolve(stored.get(`${service}/${key}`) ?? 'null'));

  const chain = createKeychain('auth');
  await chain.set('token', { bearer: 'abc', exp: 42 });

  // Keys are namespaced as "namespace:key" to prevent collisions.
  expect([...stored.keys()]).toEqual(['glyx/auth:token']);
  expect(await chain.get('token')).toEqual({ bearer: 'abc', exp: 42 });

  installStubs(); // restore defaults
});
