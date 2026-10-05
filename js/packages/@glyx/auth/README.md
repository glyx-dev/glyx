# @glyx-dev/auth

OAuth flows via deep links + OS keychain token storage.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/auth
# or npm install @glyx-dev/auth
```

## Usage

```js
import { createAuth } from '@glyx-dev/auth';

const auth = createAuth({
  redirect: 'myapp://auth',
  providers: {
    github: {
      authUrl: 'https://github.com/login/oauth/authorize',
      clientId: '…',
      scope: 'read:user',
      exchange: async (code) =>
        (await fetch('/oauth/github', { method: 'POST', body: code })).json(),
    },
  },
});

const tokens = await auth.signIn('github');
const token = await auth.getAccessToken('github');
```

The app must be registered as the handler for its deep-link scheme (see `deeplink` in `glyx.config.json`) and the provider must expose a token-exchange endpoint/function.

## API

- `createAuth({ redirect, providers, storage? })` — creates an auth client. `storage` defaults to a `@glyx-dev/keychain` instance namespaced `'auth'`. Returns:
  - `signIn(providerName)` — opens the provider's auth URL in the system browser, waits for the deep-link callback, exchanges the code for tokens, and persists them. Concurrent calls for the same in-flight sign-in return the same promise.
  - `signOut(providerName)` — clears stored tokens for a provider.
  - `getTokens(providerName)` — returns the stored token object (or `null`).
  - `getAccessToken(providerName)` — returns just the `access_token` field (or `null`).
  - `isSignedIn(providerName)` — returns `true` if an access token is stored.
