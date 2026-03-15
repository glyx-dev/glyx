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
│   ├── velox-shell/              # winit window + input events
│   ├── velox-gpu/                # wgpu device + surface management
│   ├── velox-renderer/           # Vello 2D rendering (shapes, text draw calls)
│   ├── velox-layout/             # Taffy Flexbox integration
│   ├── velox-text/               # Parley + Swash text shaping pipeline
│   ├── velox-runtime/            # V8 embedding + native JS bindings
│   ├── velox-security/           # Capability enforcer (stub — Week 14)
│   ├── velox-db/                 # SQLite via sqlx (stub — Week 16)
│   ├── velox-3d/                 # wgpu 3D scene graph (stub — Week 18)
│   ├── velox-ai/                 # Candle ML inference (stub — Week 19)
│   ├── velox-sysapi/             # OS APIs: battery, network, hardware (stub — Week 17)
│   ├── velox-perf/               # Performance monitoring (stub — Week 15)
│   └── velox-cli/                # CLI: create, dev, build (stub — Week 20)
│
├── js/
│   └── packages/
│       ├── @velox/react/
│       │   └── src/
│       │       ├── hostConfig.js # react-reconciler HostConfig (25 methods)
│       │       ├── events.js     # Hit-testing, pressable/input/scroll registry
│       │       ├── index.js      # Reconciler, View, Text, Pressable, ScrollView, TextInput, hooks
│       │       └── index.d.ts    # TypeScript declarations
│       └── @velox/router/
│           └── src/
│               ├── index.js      # Router, Route, useNavigate, useRoute
│               └── index.d.ts    # TypeScript declarations
│
└── examples/
    └── hello-world/
        ├── src/main.rs           # Entry point — passes AppConfig to velox_core::run()
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

### Asynchronous (return a Promise)

| Binding | Signature | Description |
|---------|-----------|-------------|
| `__velox_readFile` | `(path: string) => Promise<string>` | Reads a file from disk via tokio |

### Node types

| Type string | Taffy style | Vello output |
|-------------|-------------|--------------|
| `"view"` | Flex column, centred | Rounded rectangle |
| `"text"` | Auto size | Parley-shaped glyph run |

### Node props

| Prop | Type | Applies to |
|------|------|------------|
| `width` | `number` (px) | view, text |
| `height` | `number` (px) | view, text |
| `text` | `string` | text |
| `fontSize` | `number` (px) | text |

---

## React API (`@velox/react`)

```jsx
import { View, Text, render } from '@velox/react';

render(
  <View width={360} height={180}>
    <Text fontSize={20} width={200} height={28}>Hello Velox</Text>
  </View>
);
```

### `render(element)`

Mounts a React element tree into the Velox scene graph. Call once at startup.
State updates re-render automatically through the reconciler.

### `<View>`

A rectangular flex container. Maps to the `"view"` scene graph node type.

Props: `width`, `height`

### `<Text>`

A text label. `children` becomes the `text` prop on the native node.
Maps to the `"text"` scene graph node type.

Props: `fontSize`, `width`, `height`

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
| 17B | `@velox/router` — named-route history stack; 3-screen demo |

---

## Roadmap (upcoming)

| Week | Goal |
|------|------|
| 17 | `velox.config.ts` parsing; capability system enforced in Rust |
| 18 | 3D — wgpu 3D pass, `@velox/three` minimal API |
| 19 | Local AI — Candle, model loading, text completion |
| 20 | CLI — `velox create`, `velox dev`, `velox build` |
| 21 | Plugin API — V8 isolate sandbox for untrusted third-party plugins |
| 22 | TanStack Router adapter (`@velox/router/tanstack`) for web-targeting apps |
| 23–26 | Reference application built entirely on Velox |

---

## Architecture — crate responsibilities

| Crate | Single responsibility |
|-------|-----------------------|
| `velox-shell` | OS window, winit event loop, input delivery |
| `velox-gpu` | wgpu device, queue, surface, swapchain |
| `velox-renderer` | Vello scene construction, frame begin/end, render pass |
| `velox-layout` | Taffy tree ownership, style helpers, layout compute |
| `velox-text` | Parley shaping, Swash rasterisation, label caching |
| `velox-runtime` | V8 isolate, context, native bindings, async Promise bridge |
| `velox-core` | Wires all crates together, owns the event loop and AppState |

---

## Contributing

This project follows the build roadmap above. Each week's work should leave
the previous milestone clean and passing before moving on. No milestone is
considered done until `cargo check` produces zero warnings.
