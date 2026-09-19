# @glyx-dev/config

Type-safe configuration helper for Glyx apps.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/config
# or npm install @glyx-dev/config
```

## Usage

```ts
// glyx.config.ts
import { defineConfig } from '@glyx-dev/config';

export default defineConfig({
  name: 'my-notes',
  window: { title: 'My App', width: 1280, height: 800 },
  capabilities: { fs: { read: ['**'] }, db: true },
  dev: { entry: 'js/app.tsx', output: 'js/app.js' },
});
```

When the Glyx CLI runs this file (`bun run glyx.config.ts`), `defineConfig` prints the resolved config as JSON to stdout and exits — the CLI reads that JSON for building, embedding, and runtime capability checks.

## API

- `defineConfig(config: GlyxConfig)` — validates/echoes a Glyx app config at build time. Never returns (it prints JSON and exits the process).
- Exported TypeScript types for the full config shape: `GlyxConfig`, `WindowConfig`, `Capabilities`, `FsCapability`, `NetworkCapability`, `EnvCapability`, `DeeplinkCapability`, `ShellExecCapability`, `ShellAgentCapability`, `SplashConfig`, `UpdaterConfig`, `PluginConfig`, `DevConfig`, `AppConfig`.

See the doc comments in `src/index.ts` for the full set of fields each interface supports (window sizing/decorations/render backend, capability toggles for fs/network/db/clipboard/audio/video/camera/etc., splash screen, auto-updater target, JS plugins, and dev-server options).
