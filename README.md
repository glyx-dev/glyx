# Glyx

A desktop application framework for React and TypeScript developers — powered by Rust and wgpu. No browser engine. No Electron. Direct GPU rendering, V8 snapshots, a capability-based security model, and a developer experience built around React.

**Documentation:** [glyx.dev](https://glyx.dev)

---

## What it is

Glyx lets web developers build near-native desktop applications using the React and TypeScript they already know, without writing any Rust.

Under the hood:

- **winit** manages the OS window and input events
- **wgpu** renders directly to Metal / Vulkan / DirectX 12
- **TinySkia / FemtoVG / Vello** handle 2D rendering — selected automatically based on GPU
- **Taffy** computes Flexbox layout
- **Parley** shapes and renders text
- **rusty_v8** embeds the V8 JavaScript engine with snapshot startup
- **react-reconciler** bridges React's tree into Glyx's native scene graph

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
npx glyx-cli create my-app
cd my-app
glyx dev
```

That starts the dev server with hot reload. Edit `js/app.jsx` and changes appear instantly.

To build for distribution:

```bash
glyx build
```

---

## Project structure

```
glyx_project/
├── Cargo.toml                    Cargo workspace
├── package.json                  Bun workspace
│
├── crates/
│   ├── glyx-core/               App lifecycle, event loop, subsystem wiring
│   ├── glyx-shell/              winit window, input events, title bar
│   ├── glyx-gpu/                wgpu device, surface, GPU tier detection
│   ├── glyx-renderer/           2D rendering (TinySkia / FemtoVG / Vello)
│   ├── glyx-layout/             Taffy Flexbox + grid layout
│   ├── glyx-text/               Parley text shaping pipeline
│   ├── glyx-runtime/            V8 embedding, native bindings, async bridge
│   ├── glyx-security/           Capability enforcer — fs / network / env gates
│   ├── glyx-db/                 SQLite + vector store (sqlx)
│   ├── glyx-ai/                 Local ML inference (Candle — embed, generate, transcribe)
│   ├── glyx-media/              Audio/video playback and camera capture
│   ├── glyx-3d/                 wgpu 3D scene graph + GLTF loader
│   ├── glyx-sysapi/             OS APIs: battery, network info, hardware
│   ├── glyx-snapshot/           V8 snapshot builder (startup < 50 ms)
│   ├── glyx-runner/             App runner / process entrypoint
│   ├── glyx-perf/               Performance monitoring
│   └── glyx-cli/                CLI: create, dev, build
│
├── js/packages/@glyx/
│   ├── react/                    React reconciler, all components, hooks, APIs
│   ├── router/                   Named-route history stack
│   ├── store/                    Global state (zustand-compatible)
│   ├── design/                   Design system — tokens, ThemeProvider, base components
│   ├── keychain/                 OS keychain integration
│   ├── testing/                  Headless test utilities (Bun test compatible)
│   ├── three/                    @glyx/three — Three.js-style 3D API over Canvas3D
│   ├── config/                   glyx.config.ts schema + types
│   └── drizzle/                  Drizzle ORM adapter for glyx-db
│
├── tools/
│   └── vscode-glyx/             VS Code extension (commands, snippets, problem matchers)
│
└── examples/
    ├── hello-world/
    ├── notes-app/                Full-featured reference app
    ├── design-regular/           @glyx/design showcase
    ├── calculator/
    └── ...
```

---

## Renderer selection

Glyx picks a renderer automatically based on the GPU:

| Hardware | Renderer | ~RAM |
|----------|----------|------|
| No GPU / software / CI | TinySkia | ~97 MB |
| Integrated GPU | TinySkia | ~97 MB |
| Intel Arc dGPU | FemtoVG | ~103 MB |
| NVIDIA / AMD dGPU | Vello | ~285 MB |

Override via `glyx.config.ts`: `renderMode: 'skia' | 'femtovg' | 'vello' | 'auto'`

---

## Contributing

`cargo check --workspace` must produce zero warnings before any milestone is considered done.

Full API reference, component docs, guides, and the capability system reference are at [glyx.dev](https://glyx.dev).
