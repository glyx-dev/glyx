import { test, expect } from 'bun:test';
import { createAuth } from './index.js';

test('createAuth returns a client with a signIn method', () => {
  const auth = createAuth({ redirect: 'myapp://auth', providers: {} });
  expect(typeof auth.signIn).toBe('function');
});

test('signIn rejects for an unknown provider', async () => {
  const auth = createAuth({ redirect: 'myapp://auth', providers: {} });
  await expect(auth.signIn('github')).rejects.toThrow('unknown provider');
});
