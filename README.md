# VeloxKit

A desktop application framework for React and TypeScript developers — powered by Rust and wgpu. No browser engine. No Electron. Direct GPU rendering, V8 snapshots, a capability-based security model, and a developer experience built around React.

**Documentation:** [veloxkit.dev](https://veloxkit.dev)

---

## What it is

VeloxKit lets web developers build near-native desktop applications using the React and TypeScript they already know, without writing any Rust.

Under the hood:

- **winit** manages the OS window and input events
- **wgpu** renders directly to Metal / Vulkan / DirectX 12
- **TinySkia / FemtoVG / Vello** handle 2D rendering — selected automatically based on GPU
- **Taffy** computes Flexbox layout
- **Parley** shapes and renders text
- **rusty_v8** embeds the V8 JavaScript engine with snapshot startup
- **react-reconciler** bridges React's tree into VeloxKit's native scene graph

---

## Prerequisites

| Tool | Version |
|------|---------|
| Rust (stable) | 1.77+ |
| Node.js | 18+ |
| Bun | 1.3+ |

---

## Quick start

```bash
npx veloxkit-cli create my-app
cd my-app
veloxkit dev
```

That starts the dev server with hot reload. Edit `js/app.jsx` and changes appear instantly.

To build for distribution:

```bash
veloxkit build
```

---

## Project structure

```
velox_project/
├── Cargo.toml                    Cargo workspace
├── package.json                  Bun workspace
│
├── crates/
│   ├── velox-core/               App lifecycle, event loop, subsystem wiring
│   ├── velox-shell/              winit window, input events, title bar
│   ├── velox-gpu/                wgpu device, surface, GPU tier detection
│   ├── velox-renderer/           2D rendering (TinySkia / FemtoVG / Vello)
│   ├── velox-layout/             Taffy Flexbox + grid layout
│   ├── velox-text/               Parley text shaping pipeline
│   ├── velox-runtime/            V8 embedding, native bindings, async bridge
│   ├── velox-security/           Capability enforcer — fs / network / env gates
│   ├── velox-db/                 SQLite + vector store (sqlx)
│   ├── velox-ai/                 Local ML inference (Candle — embed, generate, transcribe)
│   ├── velox-media/              Audio/video playback and camera capture
│   ├── velox-3d/                 wgpu 3D scene graph + GLTF loader
│   ├── velox-sysapi/             OS APIs: battery, network info, hardware
│   ├── velox-snapshot/           V8 snapshot builder (startup < 50 ms)
│   ├── velox-runner/             App runner / process entrypoint
│   ├── velox-perf/               Performance monitoring
│   └── velox-cli/                CLI: create, dev, build
│
├── js/packages/@velox/
│   ├── react/                    React reconciler, all components, hooks, APIs
│   ├── router/                   Named-route history stack
│   ├── store/                    Global state (zustand-compatible)
│   ├── design/                   Design system — tokens, ThemeProvider, base components
│   ├── keychain/                 OS keychain integration
│   ├── testing/                  Headless test utilities (Bun test compatible)
│   ├── three/                    @velox/three — Three.js-style 3D API over Canvas3D
│   ├── config/                   veloxkit.config.ts schema + types
│   └── drizzle/                  Drizzle ORM adapter for velox-db
│
├── tools/
│   └── vscode-velox/             VS Code extension (commands, snippets, problem matchers)
│
└── examples/
    ├── hello-world/
    ├── notes-app/                Full-featured reference app
    ├── design-regular/           @velox/design showcase
    ├── calculator/
    └── ...
```

---

## Renderer selection

VeloxKit picks a renderer automatically based on the GPU:

| Hardware | Renderer | ~RAM |
|----------|----------|------|
| No GPU / software / CI | TinySkia | ~97 MB |
| Integrated GPU | TinySkia | ~97 MB |
| Intel Arc dGPU | FemtoVG | ~103 MB |
| NVIDIA / AMD dGPU | Vello | ~285 MB |

Override via `veloxkit.config.ts`: `renderMode: 'skia' | 'femtovg' | 'vello' | 'auto'`

---

## Contributing

`cargo check --workspace` must produce zero warnings before any milestone is considered done.

Full API reference, component docs, guides, and the capability system reference are at [veloxkit.dev](https://veloxkit.dev).
