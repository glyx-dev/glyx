// @glyx-dev/store — Persistent reactive state store for Glyx apps.
//
// Architecture:
//   • In-memory JS object = reactive truth (instant reads, React subscriptions)
//   • SQLite via @glyx-dev/react db = persistence layer (async writes/reads)
//   • One shared table: glyx_store (namespace TEXT, key TEXT, value TEXT)
//
// Usage:
//   // app startup (after db is open):
//   import { initStore } from '@glyx-dev/store';
//   await initStore();
//
//   // define a store (module-level singleton):
//   import { createStore } from '@glyx-dev/store';
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
//   • Requires `db: true` in glyx.config.json.

import React from 'react';
import { db } from '@glyx-dev/react';

const TABLE = 'glyx_store';
let _initPromise: Promise<unknown> | null = null;

/** The shape of a store's state: a flat object, one key per setting. */
export type StoreState = Record<string, unknown>;

/** What a store hook returns. */
export interface StoreApi<D extends StoreState> {
  /** The current state. */
  state: D;
  /** True once the saved values have been read from the database. */
  hydrated: boolean;
  /** Set one key. A key that isn't in the defaults is ignored. */
  set<K extends keyof D & string>(key: K, value: D[K]): void;
  /** Set several keys at once (keys that aren't in the defaults are ignored). */
  setMany(patch: Partial<D>): void;
  /** Back to the defaults, and delete the saved values. */
  reset(): Promise<void>;
}

/**
 * Initialize the store system. Call once at app startup, before any components
 * that use `createStore` hooks are rendered.
 *
 * Idempotent — safe to call multiple times; only runs once.
 */
export async function initStore(): Promise<void> {
  if (_initPromise) return _initPromise as Promise<void>;
  _initPromise = db.run(
    `CREATE TABLE IF NOT EXISTS ${TABLE} ` +
    `(namespace TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, ` +
    `PRIMARY KEY (namespace, key))`
  );
  return _initPromise as Promise<void>;
}

// Registry: namespace → store instance (prevents duplicate stores)
const _registry = new Map<string, { hook: () => StoreApi<any> }>();

/**
 * Create (or retrieve) a persistent reactive store for the given namespace.
 *
 * @param namespace  Unique name; used as SQLite partition key
 * @param defaults   Default state — also determines valid keys
 * @returns A React hook that returns the store's state and setters.
 */
export function createStore<D extends StoreState>(namespace: string, defaults: D): () => StoreApi<D> {
  if (!namespace || typeof namespace !== 'string') {
    throw new Error('@glyx-dev/store: namespace must be a non-empty string');
  }
  if (_registry.has(namespace)) return _registry.get(namespace)!.hook as () => StoreApi<D>;

  // ── In-memory state ──────────────────────────────────────────────────────
  let _state: D = { ...defaults };
  let _hydrated = false;
  const _subs   = new Set<() => void>();

  function _notify() {
    for (const sub of _subs) sub();
  }

  // ── Hydration ─────────────────────────────────────────────────────────────
  let _hydratePromise: Promise<void> | null = null;

  async function _hydrate(): Promise<void> {
    if (_hydratePromise) return _hydratePromise;
    _hydratePromise = (async () => {
      await (_initPromise ?? initStore());
      const rows: Array<{ key: string; value: string }> = await db.query(
        `SELECT key, value FROM ${TABLE} WHERE namespace = ?`,
        [namespace]
      );
      const next: StoreState = { ...defaults };
      for (const row of rows) {
        if (row.key in next) {
          try { next[row.key] = JSON.parse(row.value); }
          catch { next[row.key] = row.value; }
        }
      }
      _state    = next as D;
      _hydrated = true;
      _notify();
    })();
    return _hydratePromise;
  }

  // ── Persistence ───────────────────────────────────────────────────────────
  async function _persist(key: string, value: unknown): Promise<void> {
    try {
      await db.run(
        `INSERT INTO ${TABLE} (namespace, key, value) VALUES (?,?,?) ` +
        `ON CONFLICT(namespace, key) DO UPDATE SET value=excluded.value`,
        [namespace, key, JSON.stringify(value)]
      );
    } catch (e) {
      // eslint-disable-next-line no-console
      if (typeof __glyx_log !== 'undefined') __glyx_log('[store] persist: ' + e);
    }
  }

  // ── Public store API ──────────────────────────────────────────────────────
  const api: Pick<StoreApi<D>, 'set' | 'setMany' | 'reset'> = {
    set(key, value) {
      if (!(key in defaults)) return;
      _state = { ..._state, [key]: value } as D;
      _notify();
      _persist(key, value);
    },

    setMany(patch) {
      const next: StoreState = { ..._state };
      const writes: Promise<void>[] = [];
      for (const [k, v] of Object.entries(patch)) {
        if (k in defaults) { next[k] = v; writes.push(_persist(k, v)); }
      }
      _state = next as D;
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
  function useStore(): StoreApi<D> {
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
