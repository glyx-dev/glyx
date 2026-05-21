// @velox/store — Persistent reactive state store for Velox apps.
//
// Architecture:
//   • In-memory JS object = reactive truth (instant reads, React subscriptions)
//   • SQLite via @velox/react db = persistence layer (async writes/reads)
//   • One shared table: velox_store (namespace TEXT, key TEXT, value TEXT)
//
// Usage:
//   // app startup (after db is open):
//   import { initStore } from '@velox/store';
//   await initStore();
//
//   // define a store (module-level singleton):
//   import { createStore } from '@velox/store';
//   const useSettings = createStore('settings', {
//     theme: 'dark',
//     fontSize: 14,
//     notifications: true,
//   });
//
//   // in a component:
//   function SettingsScreen() {
//     const { state, set } = useSettings();
//     return (
//       <Switch value={state.notifications}
//               onValueChange={v => set('notifications', v)} />
//     );
//   }
//
// Notes:
//   • `set` updates in-memory state synchronously → UI re-renders at frame rate.
//   • SQLite writes are async fire-and-forget; values survive app restarts.
//   • Requires `db: true` in velox.config.json.

import React from 'react';
import { db } from '@velox/react';

const TABLE = 'velox_store';
let _initPromise = null;

/**
 * Initialize the store system. Call once at app startup, before any components
 * that use `createStore` hooks are rendered.
 *
 * Idempotent — safe to call multiple times; only runs once.
 * @returns {Promise<void>}
 */
export async function initStore() {
  if (_initPromise) return _initPromise;
  _initPromise = db.run(
    `CREATE TABLE IF NOT EXISTS ${TABLE} ` +
    `(namespace TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, ` +
    `PRIMARY KEY (namespace, key))`
  );
  return _initPromise;
}

// Registry: namespace → store instance (prevents duplicate stores)
const _registry = new Map();

/**
 * Create (or retrieve) a persistent reactive store for the given namespace.
 *
 * @template {Record<string, *>} D
 * @param {string} namespace  Unique name; used as SQLite partition key
 * @param {D} defaults        Default state — also determines valid keys
 * @returns {function(): { state: D, set: function, setMany: function, reset: function, hydrated: boolean }}
 */
export function createStore(namespace, defaults) {
  if (!namespace || typeof namespace !== 'string') {
    throw new Error('@velox/store: namespace must be a non-empty string');
  }
  if (_registry.has(namespace)) return _registry.get(namespace).hook;

  // ── In-memory state ──────────────────────────────────────────────────────
  let _state    = { ...defaults };
  let _hydrated = false;
  const _subs   = new Set();   // Set<() => void>

  function _notify() {
    for (const sub of _subs) sub();
  }

  // ── Hydration ─────────────────────────────────────────────────────────────
  let _hydratePromise = null;

  async function _hydrate() {
    if (_hydratePromise) return _hydratePromise;
    _hydratePromise = (async () => {
      await (_initPromise ?? initStore());
      const rows = await db.query(
        `SELECT key, value FROM ${TABLE} WHERE namespace = ?`,
        [namespace]
      );
      const next = { ...defaults };
      for (const row of rows) {
        if (row.key in next) {
          try { next[row.key] = JSON.parse(row.value); }
          catch { next[row.key] = row.value; }
        }
      }
      _state    = next;
      _hydrated = true;
      _notify();
    })();
    return _hydratePromise;
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  async function _persist(key, value) {
    try {
      await db.run(
        `INSERT INTO ${TABLE} (namespace, key, value) VALUES (?,?,?) ` +
        `ON CONFLICT(namespace, key) DO UPDATE SET value=excluded.value`,
        [namespace, key, JSON.stringify(value)]
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      if (typeof __velox_log !== 'undefined') __velox_log('[store] persist: ' + e);
    }
  }

  // ── Public store API ──────────────────────────────────────────────────────
  const api = {
    set(key, value) {
      if (!(key in defaults)) return;
      _state = { ..._state, [key]: value };
      _notify();
      _persist(key, value);
    },

    setMany(patch) {
      const next = { ..._state };
      const writes = [];
      for (const [k, v] of Object.entries(patch)) {
        if (k in defaults) { next[k] = v; writes.push(_persist(k, v)); }
      }
      _state = next;
      _notify();
      Promise.all(writes).catch(() => {});
    },

    async reset() {
      _state = { ...defaults };
      _notify();
      await db.run(
        `DELETE FROM ${TABLE} WHERE namespace = ?`,
        [namespace]
      );
    },
  };

  // ── React hook ────────────────────────────────────────────────────────────
  function useStore() {
    const [, forceRender] = React.useState(0);

    React.useEffect(() => {
      let mounted = true;
      const sub = () => { if (mounted) forceRender((n) => n + 1); };
      _subs.add(sub);
      _hydrate().catch(() => {});
      return () => { mounted = false; _subs.delete(sub); };
    }, []);

    return {
      state:    _state,
      hydrated: _hydrated,
      set:      api.set,
      setMany:  api.setMany,
      reset:    api.reset,
    };
  }

  _registry.set(namespace, { hook: useStore });
  return useStore;
}
