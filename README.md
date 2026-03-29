# Velox

A next-generation desktop, mobile, and web application framework for React and
TypeScript developers — powered by Rust and wgpu. No browser engine. No
Electron. Direct GPU rendering, V8 snapshots, a capability-based security
model, and a developer experience built around React and Next.js.

---

## What it is

Velox lets web developers build near-native applications using the React and
TypeScript they already know, without writing a single line of Rust.

Under the hood:

- **winit** manages the OS window and input events
- **wgpu** renders directly to Metal / Vulkan / DirectX 12 — no browser layer
- **Vello** handles 2D vector rendering and text via compute shaders
- **Taffy** computes Flexbox layout
- **Parley + Swash** shape and render text natively
- **rusty_v8** embeds the V8 JavaScript engine
- **react-reconciler** bridges React's tree into Velox's scene graph

The result is a framework that starts in under 150 ms, installs under 15 MB,
and idles at under 40 MB of RAM.

---

## Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Rust (stable) | 1.77+ | `rustup install stable` |
| Cargo | comes with Rust | — |
| Node.js | 18+ | nodejs.org |
| Bun | 1.3+ | `npm install -g bun` |

Verify:

```
rustc --version
cargo --version
node --version
bun --version
```

---

## Project structure

```
velox/
├── Cargo.toml                    # Cargo workspace root
├── package.json                  # Bun workspace root (React deps + @velox/react)
│
├── crates/
│   ├── velox-core/               # App lifecycle, event loop, subsystem wiring
│   ├── velox-shell/              # winit window + input events + StartupMode
│   ├── velox-gpu/                # wgpu device + surface management
│   ├── velox-renderer/           # Vello 2D rendering (shapes, text draw calls)
│   ├── velox-layout/             # Taffy Flexbox integration + measure function
│   ├── velox-text/               # Parley + Swash text shaping pipeline
│   ├── velox-runtime/            # V8 embedding + native JS bindings
│   ├── velox-security/           # Capability enforcer — OnceLock, fs/network/env gates
│   ├── velox-db/                 # SQLite + vector store via sqlx (Phase 7 ✅)
│   ├── velox-3d/                 # wgpu 3D scene graph (stub — Phase 17)
│   ├── velox-ai/                 # Candle ML inference (stub — Phase 18)
│   ├── velox-sysapi/             # OS APIs: battery, network, hardware (stub — Phase 15)
│   ├── velox-perf/               # Performance monitoring (stub — Phase 14)
│   └── velox-cli/                # CLI: create, dev, build (stub — Phase 10)
│
├── js/
│   └── packages/
│       ├── @velox/react/
│       │   └── src/
│       │       ├── hostConfig.js # react-reconciler HostConfig (25 methods)
│       │       ├── events.js     # Hit-testing, pressable/input/scroll registry
│       │       ├── index.js      # Reconciler + all components + hooks + getEnv
│       │       └── index.d.ts    # TypeScript declarations
│       └── @velox/router/
│           └── src/
│               ├── index.js      # Router, Route, useNavigate, useRoute
│               └── index.d.ts    # TypeScript declarations
│
└── examples/
    └── hello-world/
        ├── src/main.rs           # Entry point — passes AppConfig to velox_core::run()
        ├── velox.config.json     # Window settings + capability declarations
        └── js/
            ├── app.jsx           # React source (edit this)
            ├── app.js            # Bun build output — loaded by Rust via include_str!
            └── polyfills.js      # V8 globals: performance, setTimeout, MessageChannel
```

---

## Building and running

### First time setup

Install JS dependencies (run once from the project root):

```
bun install
```

### JS build

Compile the React source into a single V8-compatible script:

```
bun build examples/hello-world/js/app.jsx \
  --outfile examples/hello-world/js/app.js \
  --target browser \
  --format iife \
  --define "process.env.NODE_ENV='production'"
```

This step must be run whenever `app.jsx`, `polyfills.js`, or any file in
`js/packages/@velox/react/` changes.

### Rust build and run

```
$env:RUST_LOG="info"; cargo run -p hello-world
RUST_LOG=info cargo run -p hello-world
```

Cargo automatically recompiles when `app.js` changes because it is embedded
via `include_str!`. So the workflow for iterating on the JS side is:

1. Edit `app.jsx`
2. Run the `bun build` command above
3. Run `cargo run -p hello-world`

### Cargo check (fast type-check, no binary produced)

```
cargo check -p velox-core -p hello-world
```

---

## Native JS bindings

All bindings are registered on V8's global object at startup. They are
available in any JS evaluated by the runtime.

### Synchronous

| Binding | Signature | Description |
|---------|-----------|-------------|
| `__velox_log` | `(msg: string) => void` | Routes to Rust `log::info!` |
| `__velox_getTime` | `() => number` | Unix timestamp in milliseconds |
| `__velox_createNode` | `(type: string, props: object) => number` | Creates a scene graph node, returns its id |
| `__velox_appendChild` | `(parentId: number, childId: number) => true` | Appends child to parent |
| `__velox_updateNode` | `(id: number, props: object) => true` | Updates props on an existing node |
| `__velox_removeNode` | `(id: number) => true` | Removes a node from the scene graph |
| `__velox_setRoot` | `(id: number) => true` | Explicitly sets the scene root node |
| `__velox_getLayout` | `(id: number) => { x, y, width, height }` | Returns the resolved layout position for hit-testing |
| `__velox_pollEvents` | `() => InputEvent[]` | Drains the pending input event queue (mouse, keyboard, scroll, resize) |
| `__velox_createImage` | `(path: string) => number` | Decodes an image file and returns a texture id |
| `__velox_getWindowSize` | `() => { width, height }` | Current window inner size in logical pixels |
| `__velox_getScreenSize` | `() => { width, height }` | Current display dimensions in logical pixels |
| `__velox_setFullscreen` | `(on: boolean) => void` | Enter / exit borderless fullscreen |
| `__velox_setMaximized` | `(on: boolean) => void` | Maximize / restore window |
| `__velox_setMinimized` | `() => void` | Iconify the window |
| `__velox_isFullscreen` | `() => boolean` | Whether the window is currently fullscreen |
| `__velox_isMaximized` | `() => boolean` | Whether the window is currently maximized |
| `__velox_getEnv` | `(name: string) => string \| null` | Reads a process env var — only names declared in `capabilities.env.allow` return a value |

### Asynchronous (return a Promise)

| Binding | Signature | Description |
|---------|-----------|-------------|
| `__velox_readFile` | `(path: string) => Promise<string>` | Read file as UTF-8 — requires `fs.read` capability |
| `__velox_writeFile` | `(path, content) => Promise<void>` | Write/overwrite a file — requires `fs.write` |
| `__velox_appendFile` | `(path, content) => Promise<void>` | Append to a file — requires `fs.write` |
| `__velox_listDir` | `(path) => Promise<string>` | JSON array of `{name, isDir}` entries — requires `fs.read` |
| `__velox_deleteFile` | `(path) => Promise<void>` | Delete a file — requires `fs.write` |
| `__velox_mkdirp` | `(path) => Promise<void>` | Create directory (and parents) — requires `fs.write` |
| `__velox_db_open` | `(path) => Promise<string>` | Open/create SQLite DB; returns handle number — requires `db: true` |
| `__velox_db_query` | `(handle, sql, paramsJson) => Promise<string>` | SELECT → JSON rows array |
| `__velox_db_run` | `(handle, sql, paramsJson) => Promise<string>` | INSERT/UPDATE/DELETE → JSON `{rowsAffected, lastInsertId}` |
| `__velox_db_close` | `(handle) => Promise<void>` | Close pool gracefully |
| `__velox_db_transaction` | `(handle, stmtsJson) => Promise<void>` | Atomic batch of SQL statements |
| `__velox_vectorDb_open` | `(path) => Promise<string>` | Open/create vector store; returns handle — requires `db: true` |
| `__velox_vectorDb_upsert` | `(handle, table, id, vectorJson, metaJson) => Promise<void>` | Insert or replace a vector record |
| `__velox_vectorDb_search` | `(handle, table, queryJson, limit) => Promise<string>` | Cosine similarity search → JSON `{id, score, metadata}[]` |
| `__velox_vectorDb_close` | `(handle) => Promise<void>` | Close vector store |
| `__velox_dialog_openFile` | `(filtersJson, multiple) => Promise<string>` | Native open-file dialog — requires `dialog: true` |
| `__velox_dialog_saveFile` | `(defaultName, filtersJson) => Promise<string>` | Native save-file dialog |
| `__velox_dialog_openFolder` | `() => Promise<string>` | Native folder picker |
| `__velox_clipboard_readText` | `() => Promise<string>` | Read clipboard text — requires `clipboard: true` |
| `__velox_clipboard_writeText` | `(text) => Promise<void>` | Write clipboard text |
| `__velox_notification_send` | `(title, body) => Promise<void>` | Desktop notification — requires `notification: true` |

### Node types

| Type string | Taffy style | Vello output |
|-------------|-------------|--------------|
| `"view"` | Flex container (column default) | Rounded rectangle fill + optional border |
| `"text"` | Measure-based auto size | Parley-shaped multi-line glyph run |
| `"image"` | Fixed or flex size | Decoded texture — contain / cover / stretch resize modes |
| `"pressable"` | Flex container | Rounded rectangle with hover/press border feedback |
| `"textInput"` | Fixed or flex size | Editable text field with cursor and focus state |
| `"scrollView"` | Clip container | Clipped children shifted by scroll offset |

### Node props

| Prop | Type | Applies to |
|------|------|------------|
| `width` | `number` (px) | all |
| `height` | `number` (px) | all |
| `flex` | `number` | all |
| `flexDirection` | `"row" \| "column"` | view, pressable, scrollView |
| `justifyContent` | `"flex-start" \| "center" \| "flex-end" \| "space-between"` | view, pressable |
| `alignItems` | `"flex-start" \| "center" \| "flex-end" \| "stretch"` | view, pressable |
| `padding` | `number` (px) | view, pressable, scrollView |
| `gap` | `number` (px) | view, pressable |
| `backgroundColor` | `string` (hex or rgba) | all |
| `borderRadius` | `number` (px) | view, pressable, image |
| `borderWidth` | `number` (px) | view, pressable |
| `borderColor` | `string` (hex or rgba) | view, pressable |
| `color` | `string` (hex or rgba) | text, textInput |
| `fontSize` | `number` (px) | text, textInput |
| `text` | `string` | text |
| `clip` | `boolean` | scrollView |
| `scrollOffsetY` | `number` (px) | scrollView |
| `imageId` | `number` | image (id from `__velox_createImage`) |
| `imageResizeMode` | `"contain" \| "cover" \| "stretch"` | image |

---

## React API (`@velox/react`)

```jsx
import {
  View, Text, Pressable, TextInput, ScrollView, Image,
  render, getEnv,
  useWindowSize, useScreenSize, useMediaQuery,
  veloxWindow,
  fs, db, vectorDb,
} from '@velox/react';

render(<App />);
```

### Components

| Component | Description |
|-----------|-------------|
| `<View>` | Flex container — the primary layout primitive |
| `<Text>` | Multi-line text label; auto-sizes via Taffy measure |
| `<Pressable>` | Tappable container with `onPress`, `onHoverIn`, `onHoverOut` |
| `<TextInput>` | Editable single-line text field with `onChangeText`, `value` |
| `<ScrollView>` | Vertically scrollable clipping container with `onScroll` |
| `<Image>` | Renders a decoded image; `resizeMode` = `"contain"` / `"cover"` / `"stretch"` |

### Hooks

| Hook | Returns | Description |
|------|---------|-------------|
| `useWindowSize()` | `{ width, height }` | Reactive window dimensions — re-renders on resize |
| `useScreenSize()` | `{ width, height }` | Display dimensions (updates on fullscreen toggle) |
| `useMediaQuery(minWidth)` | `boolean` | True when window width ≥ minWidth |

### `veloxWindow` (imperative API)

```js
veloxWindow.maximize()          // fill screen minus taskbar
veloxWindow.unmaximize()        // restore previous size
veloxWindow.minimize()          // iconify
veloxWindow.setFullscreen(true) // borderless fullscreen
veloxWindow.setFullscreen(false)
veloxWindow.isFullscreen()      // → boolean
veloxWindow.isMaximized()       // → boolean
veloxWindow.getSize()           // → { width, height }
```

### `fs` — file system

Requires `fs.read` / `fs.write` capabilities in `velox.config.json`.

```js
import { fs } from '@velox/react';

await fs.writeFile('notes.txt', 'hello');          // create / overwrite
await fs.appendFile('notes.txt', '\nworld');       // append
const text    = await fs.readFile('notes.txt');    // → string
const entries = await fs.listDir('.');             // → [{name, isDir}]
await fs.deleteFile('notes.txt');
await fs.mkdirp('data/cache/images');
```

### `db` — SQLite

Requires `db: true` capability. The first `db.open()` call auto-sets a default
handle so subsequent calls omit the handle argument.

```js
import { db } from '@velox/react';

await db.open('app.db');                           // sets default handle
await db.run('CREATE TABLE IF NOT EXISTS items (id INTEGER PRIMARY KEY, name TEXT)');
await db.run('INSERT INTO items (name) VALUES (?)', ['hello']);
const rows = await db.query('SELECT * FROM items ORDER BY id DESC');
await db.transaction([
  { sql: 'INSERT INTO a (x) VALUES (?)', params: [1] },
  { sql: 'UPDATE b SET n = n + 1',       params: [] },
]);
await db.close();
```

### `vectorDb` — vector database

Requires `db: true` capability. Vectors stored as f32 BLOB in SQLite; search
uses brute-force cosine similarity (O(n) — fast for < 100 k vectors).

```js
import { vectorDb } from '@velox/react';

const store = await vectorDb.open(':memory:');     // or a file path

await store.upsert('embeddings', 'doc-1', [0.1, 0.9, 0.4], { title: 'Hello' });
await store.upsert('embeddings', 'doc-2', [0.8, 0.2, 0.6], { title: 'World' });

const hits = await store.search('embeddings', [0.15, 0.85, 0.45], 5);
// → [{ id: 'doc-1', score: 0.998, metadata: { title: 'Hello' } }, …]

await store.close();
```

### `getEnv(name)`

```js
import { getEnv } from '@velox/react';
const key = getEnv('API_KEY'); // string | null
```

Reads a process environment variable. Only names listed in `capabilities.env.allow`
in `velox.config.json` return a value — all others return `null`.

**Use for non-secret config only** — feature flags, base URLs, theme names, app IDs.
Real secrets (API keys, OAuth credentials) should never pass through `getEnv()`.
If your network call happens in Rust, keep the key in Rust (OS keychain via
`velox-sysapi`) and expose only the response to JS.

Velox loads a `.env` file automatically at startup (via `dotenvy`) for local
development. **Do not ship a `.env` file in a production installer.**
Production non-secret config uses OS-level env vars (set by the launch script,
service manager, or installer).

---

## Compatible npm packages

Velox runs React 18 inside V8 with no DOM. Any package that talks only to
React internals (hooks, context, state) works without wrappers or polyfills.
Packages that touch `window`, `document`, or browser APIs will not work.

| Package | Version | Notes |
|---------|---------|-------|
| [zustand](https://github.com/pmndrs/zustand) | `^5` | Global state management. Uses `useSyncExternalStore` — fully compatible. `bun add zustand` and import directly. |

More packages will be listed here as they are verified against the runtime.

---

## `velox.config.json`

Every Velox app ships a `velox.config.json` in its directory. It is read by
`velox-core` before V8 starts and controls the window and the capability set.

```json
{
  "window": {
    "title":       "My App",
    "width":       1280,
    "height":      800,
    "startupMode": "windowed"
  },
  "capabilities": {
    "fs":      { "read": ["**"], "write": ["$APP_DATA/**"] },
    "network": { "allow": ["api.myservice.com"] },
    "env":     { "allow": ["API_KEY", "DATABASE_URL", "MY_APP_*"] },
    "db":      false,
    "battery": false,
    "usb":     false,
    "shell":   false
  }
}
```

### `window`

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `title` | `string` | `"Velox App"` | Title bar text |
| `width` | `number` | 1280 | Initial window width in logical pixels |
| `height` | `number` | 800 | Initial window height in logical pixels |
| `startupMode` | `"windowed" \| "maximized" \| "fullscreen"` | `"windowed"` | Window state at launch. Omitting `width`/`height` implies `"maximized"` |

### `capabilities`

Capabilities are enforced in Rust — JS cannot bypass them regardless of what
npm packages are installed.

| Key | Value | Description |
|-----|-------|-------------|
| `fs.read` | `string[]` (glob patterns) | Paths the app may read. `["**"]` = all. |
| `fs.write` | `string[]` (glob patterns) | Paths the app may write. |
| `network.allow` | `string[]` (hostnames) | Outbound HTTP/WS hostnames. `["*"]` = all. |
| `env.allow` | `string[]` (name patterns) | Env var names readable via `getEnv()`. Supports trailing `*` wildcard. |
| `db` | `boolean` | Enables SQLite (`db.*`) and vector database (`vectorDb.*`) APIs. |
| `dialog` | `boolean` | Enables native file dialogs (`dialog.*`). |
| `clipboard` | `boolean` | Enables clipboard read/write (`clipboard.*`). |
| `notification` | `boolean` | Enables desktop notifications (`notification.send`). |
| `battery` | `boolean` | Enables battery status API (Phase 15). |
| `usb` | `boolean` | Enables USB/HID API (Phase 15). |
| `shell` | `boolean` | Enables shell command execution (reserved, not yet implemented). |

---

## How a frame renders

```
app.jsx  (JSX)
  → react-reconciler (HostConfig)
    → __velox_createNode / __velox_appendChild / __velox_setRoot
      → SceneCommand queue (Rust Mutex<VecDeque>)
        → drain_scene_commands() on each frame tick
          → rebuild_layout_from_scene() → Taffy compute()
            → ResolvedLayout (x, y, width, height per node)
              → Vello scene (fill_rounded_rect, draw_text)
                → wgpu render pass → screen
```

The event loop uses `ControlFlow::Wait` — the process sleeps when nothing
changes, keeping idle CPU near zero.

---

## Frame loop responsibilities

| Step | What happens |
|------|--------------|
| `tick()` | Drains async Promise completions (readFile etc.) |
| `drain_scene_commands()` | Processes CreateNode / AppendChild / SetRoot / RemoveNode / UpdateNode from JS |
| Layout | Rebuilds Taffy tree and recomputes only when `layout_dirty` is true |
| Render | Walks render order, emits Vello draw calls for each node |
| Present | Submits wgpu command buffer, presents swapchain texture |

---

## Milestones completed

| Week | Milestone |
|------|-----------|
| 5 | winit window + wgpu color clear |
| 6 | Vello rounded rects + Parley text on screen |
| 7 | Taffy Flexbox — three boxes that reflow on resize |
| 8 | rusty_v8 embedded + first native binding (`__velox_getTime`) |
| 9 | Async bridge — `__velox_readFile` resolves a JS Promise via tokio |
| 10 | JS-driven scene graph — `createNode` / `appendChild` / `updateNode` |
| 11 | React renders through the full pipeline via react-reconciler HostConfig |
| 12 | Pressable, TextInput, ScrollView; hit-test event system; style prop |
| 13 | Text shaping cache; hover/press states; border rendering |
| 14 | Incremental layout; ScrollView clip + scroll; nested hit-test fix |
| 15A | Multi-line text via Taffy measure function; scroll hit-test correction |
| 15B | Image component (cover / contain / stretch); rounded clip layer |
| 16 | Dev overlay (FPS/heap/nodes, Ctrl+Shift+D); hot reload; `useWindowSize` / `useMediaQuery`; `veloxWindow` imperative API |
| 17 | `velox.config.json` parsing; `velox-security` capability enforcer; `fs.read` gate on `readFile`; `StartupMode` enum (windowed / maximized / fullscreen) |
| 17B | `@velox/router` — named-route history stack; 3-screen demo |
| 17C | `getEnv()` binding + `env.allow` capability; build-time vs runtime vs keychain secret guidance |
| 18 | File system bindings (`writeFile`, `appendFile`, `listDir`, `deleteFile`, `mkdirp`); SQLite via `sqlx` (`db.open`, `db.query`, `db.run`, `db.transaction`) |
| 19 | Vector database — SQLite-backed brute-force cosine similarity; `vectorDb.open`, `.upsert`, `.search`, `.close`; RGB nearest-colour demo |
| 20 | OS integration — native file dialogs (`rfd`), clipboard (`arboard`), desktop notifications (`notify-rust`); `veloxWindow.setAlwaysOnTop` / `setTitle` |

---

## Roadmap (upcoming)

| Phase | Goal |
|-------|------|
| 7 (Weeks 18–19) | ✅ File system, SQLite, vector database |
| 8 (Week 20) | ✅ File dialogs, clipboard, notifications, `setAlwaysOnTop`, `setTitle` |
| 9 (Week 21) | V8 snapshots — startup drops from ~1000 ms to ~50 ms; source code not in binary |
| 10 (Week 22) | CLI — `velox create`, `velox dev`, `velox build`, cross-platform targets |
| 11 (Weeks 23–28) | Reference application (SQLite notes app) built entirely on Velox |
| 12 (Week 29) | Network — `fetch`, WebSocket, mDNS device discovery |
| 15 (Week 33) | Extended OS APIs — battery, camera, microphone, gamepads, OS keychain |
| 16 (Week 34) | Full dev mode — Vite HMR, React Fast Refresh, Chrome DevTools Protocol |
| 17 (Weeks 35–37) | 3D — wgpu 3D pass, `@velox/three`, physics (rapier3d) |
| 18 (Weeks 38–39) | Local AI — Candle inference, Whisper transcription, LanceDB semantic search |
| 19 (Weeks 40–44) | Mobile targets — iOS (Metal) and Android (Vulkan) |

---

## Architecture — crate responsibilities

| Crate | Single responsibility |
|-------|-----------------------|
| `velox-shell` | OS window, winit event loop, input delivery, `StartupMode` |
| `velox-gpu` | wgpu device, queue, surface, swapchain |
| `velox-renderer` | Vello scene construction, frame begin/end, render pass |
| `velox-layout` | Taffy tree ownership, style helpers, layout compute, measure function |
| `velox-text` | Parley shaping, Swash rasterisation, label caching |
| `velox-runtime` | V8 isolate, context, native bindings, async Promise bridge |
| `velox-security` | `Capabilities` OnceLock, capability helpers, all binding gates |
| `velox-db` | SQLite pool management (`open`, `query`, `run`, `transaction`); `VectorStore` (cosine similarity over f32 BLOB) |
| `velox-core` | Wires all crates together, owns the event loop and AppState |

---

## Contributing

This project follows the build roadmap above. Each week's work should leave
the previous milestone clean and passing before moving on. No milestone is
considered done until `cargo check` produces zero warnings.
