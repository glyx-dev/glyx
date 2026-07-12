// @glyx-dev/keychain — Typed namespace-scoped OS keychain for Glyx apps.
//
// Wraps @glyx-dev/react's `credentials` API with:
//   • Namespace scoping (prevents key collisions between logical stores)
//   • Automatic JSON serialization / deserialization for any value type
//   • Optional typed schema with default values
//
// Requires `credentials: true` in glyx.config.json.
//
// Usage (simple):
//   import { createKeychain } from '@glyx-dev/keychain';
//   const chain = createKeychain('myapp');
//   await chain.set('authToken', 'Bearer abc123');
//   const token = await chain.get('authToken');   // 'Bearer abc123'
//   await chain.delete('authToken');
//
// Usage (typed schema):
//   import { createTypedKeychain } from '@glyx-dev/keychain';
//   const secrets = createTypedKeychain('auth', {
//     accessToken:  null,
//     refreshToken: null,
//     userId:       null,
//   });
//   await secrets.set('accessToken', 'Bearer xyz');
//   const tok = await secrets.get('accessToken');   // 'Bearer xyz' | null

import { credentials } from '@glyx-dev/react';

/**
 * Create a namespaced keychain. All keys are stored as `namespace:key` to
 * prevent collisions between different logical stores.
 *
 * @param {string} namespace          e.g. 'auth', 'payments', 'prefs'
 * @param {{ service?: string }} opts  OS keychain service name (default 'glyx')
 * @returns {{ set, get, delete, clear }}
 */
export function createKeychain(namespace, { service = 'glyx' } = {}) {
  if (!namespace || typeof namespace !== 'string') {
    throw new Error('@glyx-dev/keychain: namespace must be a non-empty string');
  }

  const _key = (k) => `${namespace}:${k}`;

  return {
    /**
     * Store any JSON-serializable value under `key`.
     * @param {string} key
     * @param {*} value
     * @returns {Promise<void>}
     */
    async set(key, value) {
      await credentials.set(_key(key), JSON.stringify(value), { service });
    },

    /**
     * Retrieve a stored value. Returns `null` if not found.
     * The value is deserialized from the JSON that `set` stored.
     * @param {string} key
     * @returns {Promise<*>}
     */
    async get(key) {
      // credentials.get already does one JSON.parse (unwrapping the Rust JSON envelope).
      // Since set() stored JSON.stringify(value), credentials.get returns the original value.
      const raw = await credentials.get(_key(key), { service });
      return raw;
    },

    /**
     * Delete the value for `key`. No-op if absent.
     * @param {string} key
     * @returns {Promise<void>}
     */
    async delete(key) {
      await credentials.delete(_key(key), { service });
    },

    /**
     * Delete all keys in this namespace.
     * There is no OS-level key iteration API, so you must supply the list.
     * @param {string[]} keys
     * @returns {Promise<void>}
     */
    async clear(keys) {
      await Promise.all(keys.map((k) => credentials.delete(_key(k), { service })));
    },
  };
}

/**
 * Create a schema-typed keychain. The schema defines all valid keys and their
 * default values (returned when a key is not yet stored in the OS keychain).
 *
 * @template {Record<string, *>} S
 * @param {string} namespace
 * @param {S} schema  { key: defaultValue }
 * @param {{ service?: string }} opts
 * @returns {{ set, get, getAll, delete, clear }}
 */
export function createTypedKeychain(namespace, schema, opts = {}) {
  const chain = createKeychain(namespace, opts);
  const _keys = Object.keys(schema);

  return {
    /**
     * Set a key. Only keys declared in the schema are accepted.
     * @param {keyof S} key
     * @param {S[typeof key]} value
     * @returns {Promise<void>}
     */
    async set(key, value) {
      if (!(key in schema)) throw new Error(
        `@glyx-dev/keychain: unknown key "${key}" in namespace "${namespace}"`
      );
      await chain.set(key, value);
    },

    /**
     * Get a key. Returns the schema default if not yet stored.
     * @param {keyof S} key
     * @returns {Promise<S[typeof key]>}
     */
    async get(key) {
      if (!(key in schema)) throw new Error(
        `@glyx-dev/keychain: unknown key "${key}" in namespace "${namespace}"`
      );
      const val = await chain.get(key);
      return val !== null ? val : schema[key];
    },

    /**
     * Resolve all schema keys at once.
     * @returns {Promise<S>}
     */
    async getAll() {
      const entries = await Promise.all(
        _keys.map(async (k) => [k, await this.get(k)])
      );
      return Object.fromEntries(entries);
    },

    /**
     * Delete a single key (resets to schema default on next `get`).
     * @param {keyof S} key
     */
    async delete(key) {
      await chain.delete(key);
    },

    /** Delete all schema keys. */
    async clear() {
      await chain.clear(_keys);
    },
  };
}
