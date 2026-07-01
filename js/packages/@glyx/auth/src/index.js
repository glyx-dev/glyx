// @glyx/auth — OAuth flows via system browser + deep-link callback, with
// tokens stored in the OS keychain.
//
// The app must be registered as the handler for its deep-link scheme (see
// `deeplink` in glyx.config.json) and provide a token-exchange endpoint.
//
//   import { createAuth } from '@glyx/auth';
//   const auth = createAuth({
//     redirect: 'myapp://auth',
//     providers: {
//       github: {
//         authUrl: 'https://github.com/login/oauth/authorize',
//         clientId: '…',
//         scope: 'read:user',
//         exchange: async (code) => (await fetch('/oauth/github', {method:'POST',body:code})).json(),
//       },
//     },
//   });
//   const tokens = await auth.signIn('github');

import { glyxWindow, deeplink } from '@glyx/react';
import { createKeychain } from '@glyx/keychain';

function randomState() {
  const a = new Uint8Array(16);
  (globalThis.crypto?.getRandomValues || ((x) => x.map(() => (Math.random() * 256) | 0)))(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

function parseCallback(url) {
  const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  const params = {};
  for (const kv of q.split('&')) {
    const [k, v] = kv.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return params;
}

// Resolve with the next deep-link URL that starts with `prefix`.
function waitForDeepLink(prefix, timeoutMs = 180000) {
  return new Promise((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; reject(new Error('auth: timed out')); } }, timeoutMs);
    deeplink.onOpen((url) => {
      if (done || !url || !url.startsWith(prefix)) return;
      done = true; clearTimeout(timer); resolve(url);
    });
  });
}

export function createAuth({ redirect, providers = {}, storage } = {}) {
  const store = storage || createKeychain('auth');

  async function signIn(name) {
    const p = providers[name];
    if (!p) throw new Error(`auth: unknown provider "${name}"`);

    const state = randomState();
    const params = new URLSearchParams({
      client_id:     p.clientId,
      redirect_uri:  redirect,
      response_type: 'code',
      scope:         p.scope || '',
      state,
    });
    glyxWindow.openExternal(`${p.authUrl}?${params.toString()}`);

    const url = await waitForDeepLink(redirect);
    const cb  = parseCallback(url);
    if (cb.state !== state) throw new Error('auth: state mismatch (possible CSRF)');
    if (cb.error) throw new Error(`auth: ${cb.error}`);
    if (!cb.code) throw new Error('auth: no authorization code returned');

    const tokens = await p.exchange(cb.code);
    await store.set(`${name}.tokens`, tokens);
    return tokens;
  }

  async function getTokens(name)  { return store.get(`${name}.tokens`); }
  async function getAccessToken(name) { return (await getTokens(name))?.access_token ?? null; }
  async function signOut(name)    { await store.set(`${name}.tokens`, null); }
  async function isSignedIn(name) { return !!(await getAccessToken(name)); }

  return { signIn, signOut, getTokens, getAccessToken, isSignedIn };
}
