// @glyx-dev/auth — OAuth flows via system browser + deep-link callback, with
// tokens stored in the OS keychain.
//
// The app must be registered as the handler for its deep-link scheme (see
// `deeplink` in glyx.config.json) and provide a token-exchange endpoint.
//
//   import { createAuth } from '@glyx-dev/auth';
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

import { glyxWindow, deeplink } from '@glyx-dev/react';
import { createKeychain } from '@glyx-dev/keychain';

/** The tokens an OAuth provider's `exchange` returns (any other fields the provider sends are kept). */
export interface OAuthTokens {
  access_token?: string;
  refresh_token?: string;
  [field: string]: unknown;
}

/** One OAuth provider. */
export interface AuthProvider {
  /** The provider's authorization URL (opened in the system browser). */
  authUrl: string;
  clientId: string;
  scope?: string;
  /** Trade the authorization code for tokens (call your token endpoint; keep the client secret off the device). */
  exchange(code: string): Promise<OAuthTokens>;
}

/** Where tokens are kept: the OS keychain by default. */
export interface TokenStorage {
  get(key: string): unknown | Promise<unknown>;
  set(key: string, value: unknown): unknown | Promise<unknown>;
}

export interface AuthOptions {
  /** The app's deep-link URL the provider redirects back to, e.g. `myapp://auth`. */
  redirect: string;
  providers?: Record<string, AuthProvider>;
  storage?: TokenStorage;
}

export interface Auth {
  /** Open the provider's sign-in page and resolve with the tokens once the user has signed in. */
  signIn(name: string): Promise<OAuthTokens>;
  signOut(name: string): Promise<void>;
  getTokens(name: string): Promise<OAuthTokens | null | undefined>;
  getAccessToken(name: string): Promise<string | null>;
  isSignedIn(name: string): Promise<boolean>;
}

/**
 * The URL that starts a sign-in: the provider's authorization URL with the OAuth query.
 * (Built by hand: the Glyx runtime has no `URLSearchParams`.)
 */
export function buildAuthorizationUrl(provider: AuthProvider, redirect: string, state: string): string {
  const query = Object.entries({
    client_id:     provider.clientId,
    redirect_uri:  redirect,
    response_type: 'code',
    scope:         provider.scope || '',
    state,
  }).map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return `${provider.authUrl}?${query}`;
}

function randomState(): string {
  const a = new Uint8Array(16);
  if (globalThis.crypto?.getRandomValues) {
    globalThis.crypto.getRandomValues(a);
  } else {
    for (let i = 0; i < a.length; i++) a[i] = (Math.random() * 256) | 0;
  }
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

function parseCallback(url: string): Record<string, string> {
  const q = url.includes('?') ? url.slice(url.indexOf('?') + 1) : '';
  const params: Record<string, string> = {};
  for (const kv of q.split('&')) {
    const [k, v] = kv.split('=');
    if (k) params[decodeURIComponent(k)] = decodeURIComponent(v || '');
  }
  return params;
}

// Resolve with the next deep-link URL that starts with `prefix`.
function waitForDeepLink(prefix: string, timeoutMs = 180000): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let done = false;
    const timer = setTimeout(() => { if (!done) { done = true; reject(new Error('auth: timed out')); } }, timeoutMs);
    deeplink.onOpen((url: string) => {
      if (done || !url || !url.startsWith(prefix)) return;
      done = true; clearTimeout(timer); resolve(url);
    });
  });
}

export function createAuth({ redirect, providers = {}, storage }: AuthOptions): Auth {
  const store: TokenStorage = storage || createKeychain('auth');
  let _signInFlight: Promise<OAuthTokens> | null = null;

  function signIn(name: string): Promise<OAuthTokens> {
    if (_signInFlight) return _signInFlight;

    _signInFlight = (async () => {
      const p = providers[name];
      if (!p) throw new Error(`auth: unknown provider "${name}"`);

      const state = randomState();
      glyxWindow.openExternal(buildAuthorizationUrl(p, redirect, state));

      const url = await waitForDeepLink(redirect);
      const cb  = parseCallback(url);
      if (cb.state !== state) throw new Error('auth: state mismatch (possible CSRF)');
      if (cb.error) throw new Error(`auth: ${cb.error}`);
      if (!cb.code) throw new Error('auth: no authorization code returned');

      const tokens = await p.exchange(cb.code);
      await store.set(`${name}.tokens`, tokens);
      return tokens;
    })();

    // Clear the in-flight guard on settle.  The .catch() is REQUIRED: the
    // .finally()-derived promise is a side-chain nobody awaits — without it,
    // a failed sign-in raises an unhandled rejection alongside the one the
    // caller actually handles.
    _signInFlight.finally(() => { _signInFlight = null; }).catch(() => {});
    return _signInFlight;
  }

  async function getTokens(name: string) { return store.get(`${name}.tokens`) as Promise<OAuthTokens | null | undefined>; }
  async function getAccessToken(name: string) { return (await getTokens(name))?.access_token ?? null; }
  async function signOut(name: string) { await store.set(`${name}.tokens`, null); }
  async function isSignedIn(name: string) { return !!(await getAccessToken(name)); }

  return { signIn, signOut, getTokens, getAccessToken, isSignedIn };
}
