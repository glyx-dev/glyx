# @glyx-dev/keychain

Typed namespace-scoped OS keychain for Glyx apps — wraps the credentials API.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/keychain
# or npm install @glyx-dev/keychain
```

## Usage

```js
import { createKeychain, createTypedKeychain } from '@glyx-dev/keychain';

// Simple, untyped
const chain = createKeychain('myapp');
await chain.set('authToken', 'Bearer abc123');
const token = await chain.get('authToken'); // 'Bearer abc123'
await chain.delete('authToken');

// Typed with schema + defaults
const secrets = createTypedKeychain('auth', {
  accessToken: null,
  refreshToken: null,
  userId: null,
});
await secrets.set('accessToken', 'Bearer xyz');
const tok = await secrets.get('accessToken'); // 'Bearer xyz' | null
const all = await secrets.getAll();
```

Requires `credentials: true` in `glyx.config.json`. Values are JSON-serialized automatically; all keys are namespaced as `namespace:key` in the OS keychain to avoid collisions between stores.

## API

- `createKeychain(namespace, { service = 'glyx' })` — creates a namespaced keychain. Returns `{ set(key, value), get(key), delete(key), clear(keys) }`. `get` returns `null` if the key is not found. `clear` requires an explicit key list (there's no native key-enumeration API).
- `createTypedKeychain(namespace, schema, opts)` — wraps `createKeychain` with a fixed set of keys and default values. Returns `{ set(key, value), get(key), getAll(), delete(key), clear() }`. `set`/`get`/`delete` throw on keys not present in `schema`; `get` falls back to the schema default when a key hasn't been stored yet; `clear()` resets all schema keys with no arguments needed.
