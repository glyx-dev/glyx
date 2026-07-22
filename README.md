<div align="center">

# glyx

**Native desktop apps with React and GPU rendering.**

No Electron. No browser engine for your UI. No Rust required.

[glyx.dev](https://glyx.dev) · [Docs](https://glyx.dev/docs/getting-started) · [Examples](https://glyx.dev/examples) · [Discussions](https://github.com/glyx-dev/glyx/discussions)

</div>

---

> **Status: pre-release.** Glyx is under active development and the API is
> not yet stable. We're sharing it now to get real feedback from developers
> before things settle. Expect breaking changes between releases. See
> [Feedback](#feedback) below — this is exactly what we're looking for.

## What it is

Glyx lets you build native desktop applications with the React and
TypeScript you already know — no Rust required. Under the hood, a Rust core
renders your UI directly (CPU by default on most laptops, GPU-accelerated
where it counts) and runs your JS in an embedded V8 runtime, but none of
that is code you write. You write components, hooks, and state, same as any
React app.

```tsx
import { View, Text, Pressable, db } from '@glyx-dev/react'
import { useState } from 'react'

export default function App() {
  const notes = db.query('SELECT * FROM notes ORDER BY updated_at DESC')
  const [active, setActive] = useState(notes[0]?.id)

  return (
    <View style={{ flex: 1, flexDirection: 'row' }}>
      <View style={{ width: 240, borderRight: '1px solid #2A2A3A' }}>
        {notes.map(note => (
          <Pressable key={note.id} onPress={() => setActive(note.id)}>
            <Text style={{ padding: 16 }}>{note.title}</Text>
          </Pressable>
        ))}
      </View>
      <NoteEditor id={active} />
    </View>
  )
}
```

## Why the numbers matter

| | |
|---|---|
| **~50ms** cold startup | A V8 snapshot ships inside the binary with a pre-warmed heap — no cold JIT on first launch. |
| **As low as ~20MB** binary size | No bundled Chromium either way — see [Choosing a JS engine](#choosing-a-js-engine) below for what drives the range. |
| **Flat, low idle memory** | TinySkia (CPU rasterizer, no GPU at all) is the default on integrated/no-GPU hardware — the common case. Vello (wgpu compute) is available for GPU-throughput-bound 2D scenes; Canvas 3D is always GPU-accelerated via wgpu regardless of the 2D backend. |

<sub>Startup/idle-memory figures measured on Apple M2, macOS 14.5. See [full comparison](https://glyx.dev/comparison) for methodology and how this stacks up against other frameworks.</sub>

## Choosing a JS engine

Glyx runs your JS on either **V8** or **QuickJS** — pick per-project via `engine` in `glyx.config.ts`. Same React/TS code either way; the trade-off is binary size vs. V8's more complete JS engine internals:

| | V8 (default) | QuickJS |
|---|---|---|
| Binary size (`hello-world`, Windows x64, release) | ~57 MB | ~18 MB |
| Idle working set (same build) | ~49 MB | ~41 MB |

<sub>Measured this session, Windows 11, lean/prod builds (no dev-mode HMR tooling). Not yet measured on macOS/Linux — treat as directional until cross-platform numbers land. QuickJS is newer in Glyx and covers the same public API surface, but has seen less production mileage than V8.</sub>

## How it works

Four layers, each replaceable/inspectable on its own:

1. **React layer** — your application code. JSX components, hooks, `@glyx-dev/router`.
2. **Runtime** — V8 with snapshot startup, the JS↔Rust bridge, and capability gating.
3. **Render pipeline** — TinySkia (CPU) or Vello (wgpu compute) for the 2D scene graph; Canvas 3D always renders via wgpu directly.
4. **Shell** — native OS integration: window management, system APIs, auto-updater.

Glyx ships multiple 2D rendering backends and selects automatically based on
the GPU it detects, so the same app runs well from CI containers to discrete
GPUs. Real measured numbers (idle, and under a sustained interaction
stress-test — see [Renderer Selection](https://glyx.dev/docs/guides/renderer-selection)
for methodology):

| Hardware | Renderer | RSS |
|---|---|---|
| No GPU / integrated GPU / CI | TinySkia (default) | **~27–40 MB, flat under load** |
| Discrete GPU | Vello | ~350–430 MB idle, **spikes to 600–700 MB** under interaction |
| Windows, opt-in (`renderMode: 'direct2d'`, experimental) | Direct2D | ~77–114 MB, flat under load |

Vello's GPU-parallel throughput is real and worth it for genuinely
GPU-bound 2D scenes (dense paths/text, large canvases) — but it carries a
real, structural memory cost most app UIs never need to pay. TinySkia is the
right default for typical apps, not a fallback for weak hardware.

Override via `glyx.config.ts`: `renderMode: 'auto' | 'skia' | 'gpu' | 'cpu' | 'direct2d'`

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | 18+ |
| Bun | 1.3+ |
| Rust (stable) | 1.77+ — only needed if building the runner from source |

## Quick start

```bash
npx glyx-cli create my-app
cd my-app
glyx dev
```

That starts the dev server with hot reload — sub-100ms refresh on save,
state preserved across reloads. Edit `js/app.jsx` and changes appear
instantly.

To build for distribution:

```bash
glyx build
```

See [glyx.dev/docs/getting-started](https://glyx.dev/docs/getting-started)
for the full walkthrough.

## Everything built in

- **Local AI** — embed, generate, transcribe on-device, no API key
- **SQLite built-in** — `db.query()` from any component; migrations, FTS, vector search
- **Capability system** — apps declare what they can access, nothing more
- **Custom title bar** — full native window control (macOS traffic lights, Windows chrome)
- **CDP debugger** — Chrome DevTools (breakpoints, console, network) via the built-in inspector
- **Canvas 2D + 3D** — GPU drawing, textured GLTF models, dynamic lights, one wgpu pipeline
- **Embedded WebView** — opt-in native OS webview (WebView2/WKWebView/WebKitGTK) for real web content — OAuth, embeds — with a two-way postMessage bridge; separate from the GPU-rendered UI everything else uses
- **Cross-platform** — Windows, macOS, Linux from one codebase

## Project structure

Cargo + Bun workspace:

```
crates/
  glyx-core/           App lifecycle, event loop, subsystem wiring
  glyx-shell/          winit window, input events, title bar
  glyx-gpu/            wgpu device, surface, GPU tier detection
  glyx-renderer/       2D rendering (TinySkia / Vello / Direct2D[Windows, experimental]), auto-selected
  glyx-layout/         Taffy Flexbox + grid layout
  glyx-text/           Parley text shaping
  glyx-runtime/        V8 embedding, native bindings, async bridge
  glyx-security/       Capability enforcer — fs / network / env gates
  glyx-db/             SQLite + vector store (sqlx)
  glyx-ai/             Local ML inference (Candle)
  glyx-media/          Audio/video playback, camera capture
  glyx-3d/             wgpu 3D scene graph + GLTF loader
  glyx-sysapi/         OS APIs: battery, network info, hardware
  glyx-snapshot/       V8 snapshot builder
  glyx-runner/         App runner / process entrypoint
  glyx-perf/           Performance monitoring
  glyx-cli/            CLI: create, dev, build
  glyx-tray/           System tray icons + menus
  glyx-verify/         Ed25519 signature verification for capability DLLs
  glyx-macros/         Shared proc macros
  glyx-cap-abi/        Stable C ABI for optional capability DLLs
  glyx-cap-audio/      Audio capability (static or DLL)
  glyx-cap-ai/         Local AI capability (static or DLL)
  glyx-cap-camera/     Camera capability (static or DLL)
  glyx-cap-gamepad/    Gamepad capability (static or DLL)
  glyx-cap-hid/        HID device capability (static or DLL)
  glyx-cap-webview/    Native embedded webview capability (wry; static or DLL)

js/packages/@glyx/
  react/               React reconciler, components, hooks, APIs
  router/              Named-route history stack
  store/               Global state (zustand-compatible)
  design/              Design system — tokens, ThemeProvider, base components
  keychain/            OS keychain integration
  testing/             Headless test utilities (Bun test compatible)
  three/               Three.js-style 3D API over Canvas3D
  config/              glyx.config.ts schema + types
  drizzle/             Drizzle ORM adapter for glyx-db
  charts/              Line/Area/Bar/Pie charts on Canvas
  table/               Sortable, resizable, virtualized data table
  command/             Cmd+K command palette
  markdown/            Markdown renderer
  form/                Form validation orchestration (Zod-compatible)
  drag-drop/           Draggable + drop zone
  split-pane/          Draggable-divider split layout
  context-menu/        Right-click context menus
  auth/                Auth flow helpers
  icons/               Icon set
  rich-text/           Rich text (in progress)

tools/
  vscode-glyx/         VS Code extension (snippets, glyx.config.json JSON schema)

glyx-media-c/          Standalone C library wrapping FFmpeg — the only interface
                        between glyx-runner and the media codec DLL. Not a Cargo
                        crate (no Cargo.toml), so it lives outside crates/; built
                        via its own platform scripts (build-{windows,macos,linux}).

examples/
  hello-world/         Minimal starting point
  notes-app/           Full-featured reference app (SQLite, vector search, multi-window)
  calculator/
  dashboard/           Stat cards + nav layout
  files/               File system / dialog demo
  log-viewer/          Streaming log viewer
  media-player/        Audio/video playback demo
  model-viewer/        Canvas3D + GLTF viewer
  tasks/               Todo list demo
  webview-demo/        Native embedded WebView + two-way postMessage bridge
```

## Feedback

Glyx is at the stage where developer feedback shapes real decisions — not
just polish. If you try it, we'd genuinely like to hear what broke,
confused you, or didn't feel like idiomatic React; whether the API feels
right for the kind of app you're building; and where the docs left you
guessing.

Open an [issue](https://github.com/glyx-dev/glyx/issues) for bugs, or start
a [discussion](https://github.com/glyx-dev/glyx/discussions) for questions
and ideas. See [CONTRIBUTING.md](./CONTRIBUTING.md) if you'd like to
contribute code — `cargo check --workspace` must produce zero warnings
before any change is considered done.

## License

Licensed under either of

- Apache License, Version 2.0 ([LICENSE-APACHE](./LICENSE-APACHE))
- MIT license ([LICENSE-MIT](./LICENSE-MIT))

at your option.
