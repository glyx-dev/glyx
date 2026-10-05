# @glyx-dev/store

Persistent reactive Zustand-style store for Glyx apps — backed by SQLite.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/store
# or npm install @glyx-dev/store
```

## Usage

```jsx
// app startup (after db is open)
import { initStore, createStore } from '@glyx-dev/store';
await initStore();

// define a store (module-level singleton)
const useSettings = createStore('settings', {
  theme: 'dark',
  fontSize: 14,
  notifications: true,
});

// in a component
function SettingsScreen() {
  const { state, set } = useSettings();
  return (
    <Switch value={state.notifications} onValueChange={(v) => set('notifications', v)} />
  );
}
```

Architecture: an in-memory JS object is the reactive source of truth (instant reads, React subscriptions), backed by SQLite (via `@glyx-dev/react`'s `db`) for persistence, in one shared table (`glyx_store`). `set` updates state synchronously so the UI re-renders immediately; the SQLite write is async fire-and-forget, so values survive app restarts. Requires `db: true` in `glyx.config.json`.

## API

- `initStore()` — creates the underlying `glyx_store` table if it doesn't exist. Call once at startup before any `createStore` hook is used. Idempotent.
- `createStore(namespace, defaults)` — creates (or retrieves, if already registered) a persistent store for `namespace`. `defaults` also defines the set of valid keys. Returns a hook function; calling it returns `{ state, hydrated, set(key, value), setMany(patch), reset() }`. `hydrated` becomes `true` once the initial SQLite read has completed and `state` reflects persisted values.
