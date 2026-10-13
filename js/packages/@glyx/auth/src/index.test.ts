import { test, expect } from 'bun:test';
import { createAuth, buildAuthorizationUrl } from './index.js';

test('createAuth returns a client with a signIn method', () => {
  const auth = createAuth({ redirect: 'myapp://auth', providers: {} });
  expect(typeof auth.signIn).toBe('function');
});

test('signIn rejects for an unknown provider', async () => {
  const auth = createAuth({ redirect: 'myapp://auth', providers: {} });
  await expect(auth.signIn('github')).rejects.toThrow('unknown provider');
});

test('the authorization URL carries the OAuth query, encoded', () => {
  const url = buildAuthorizationUrl(
    { authUrl: 'https://github.com/login/oauth/authorize', clientId: 'abc 123', scope: 'read:user user:email', exchange: async () => ({}) },
    'myapp://auth',
    'st4te',
  );
  expect(url.startsWith('https://github.com/login/oauth/authorize?')).toBe(true);
  expect(url).toContain('client_id=abc%20123');
  expect(url).toContain('redirect_uri=myapp%3A%2F%2Fauth');
  expect(url).toContain('response_type=code');
  expect(url).toContain('scope=read%3Auser%20user%3Aemail');
  expect(url).toContain('state=st4te');
});

test('no scope is an empty scope, not "undefined"', () => {
  const url = buildAuthorizationUrl({ authUrl: 'https://x/auth', clientId: 'c', exchange: async () => ({}) }, 'app://cb', 's');
  expect(url).toContain('scope=&');
});
