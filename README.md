<div align="center">

# glyx

**Native desktop apps with React and GPU rendering.**

No Electron. No WebView. No Rust required.

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
renders your UI directly to the GPU and runs your JS in an embedded V8
runtime, but none of that is code you write. You write components, hooks,
and state, same as any React app.

```tsx
import { View, Text, Pressable, db } from 'glyx'
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
| **~20MB** binary size | No bundled Chromium. A purpose-built V8 runtime and wgpu renderer fit in a fraction of what a browser-engine-based app ships. |
| **120fps** GPU rendering | wgpu + Vello renders your UI directly to the GPU. The same pipeline handles 2D components and 3D Canvas. |

<sub>Measured on Apple M2, macOS 14.5. See [full comparison](https://glyx.dev/comparison) for methodology and how this stacks up against other frameworks.</sub>

## How it works

Four layers, each replaceable/inspectable on its own:

1. **React layer** — your application code. JSX components, hooks, `@glyx/router`.
2. **Runtime** — V8 with snapshot startup, the JS↔Rust bridge, and capability gating.
3. **GPU pipeline** — wgpu + Vello render the 2D scene graph and Canvas 3D.
4. **Shell** — native OS integration: window management, system APIs, auto-updater.

Glyx also ships **three rendering backends** and selects automatically based
on the GPU it detects, so the same app runs well from CI containers to
discrete GPUs:

| Hardware | Renderer | ~RAM |
|---|---|---|
| No GPU / software / CI | TinySkia | ~97 MB |
| Integrated GPU | TinySkia | ~97 MB |
| Intel Arc dGPU | FemtoVG | ~103 MB |
| NVIDIA / AMD dGPU | Vello | ~285 MB |

Override via `glyx.config.ts`: `renderMode: 'skia' | 'femtovg' | 'vello' | 'auto'`

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
- **Cross-platform** — Windows, macOS, Linux from one codebase

## Project structure

Cargo + Bun workspace:

```
crates/
  glyx-core/           App lifecycle, event loop, subsystem wiring
  glyx-shell/          winit window, input events, title bar
  glyx-gpu/            wgpu device, surface, GPU tier detection
  glyx-renderer/       2D rendering (TinySkia / FemtoVG / Vello), auto-selected
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

tools/
  vscode-glyx/         VS Code extension

examples/
  hello-world/
  notes-app/           Full-featured reference app
  design-regular/      @glyx/design showcase
  calculator/
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
