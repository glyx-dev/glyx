# glyx-cli

The command-line tool for [Glyx](https://glyx.dev): build native desktop apps with React and
TypeScript or JavaScript. No Chromium, no Electron.

```bash
npx glyx-cli create my-app
cd my-app
npm install
npx glyx-cli dev
```

`glyx dev` opens a native window and reloads on every save. (With `glyx-cli` installed globally,
the command is just `glyx`; `npx` needs the package name.)

## Install

```bash
npm install -g glyx-cli     # or: pnpm add -g glyx-cli / yarn global add glyx-cli
glyx --help
```

This package is a thin launcher. On install it downloads the prebuilt `glyx` binary for your
platform from the [GitHub release](https://github.com/glyx-dev/glyx/releases) that matches its
version (Windows x64, macOS Apple Silicon, Linux x64; Intel Macs build from source). Set `GLYX_SKIP_DOWNLOAD=1` to skip that,
for example in CI that only needs the JavaScript packages.

**Requirements:** Node.js 18 or newer. Bun is **not** required.

## What you can do

| Command | |
|---|---|
| `glyx create <name>` | New project. `--typescript` for TypeScript, `--template notes\|dashboard\|settings`, `--native` for a project with Rust extensions |
| `glyx dev` | Dev server with hot reload (`--devtools` opens the DevTools protocol) |
| `glyx check` | Validate `glyx.config.ts` and type-check a TypeScript project |
| `glyx build` | Production build |
| `glyx package` | Installer / app bundle for your platform |
| `glyx inspect` | The DevTools UI for a running dev app |
| `glyx mcp` | Let an AI agent drive a running dev app over MCP |

Run `glyx <command> --help` for the options.

## How it bundles your app

Your app's JavaScript or TypeScript is bundled with [esbuild](https://esbuild.github.io). Glyx uses
the one in your project's `node_modules` if there is one; otherwise it downloads a pinned release
once, checks it against a built-in SHA-512 hash, and caches it in `~/.glyx/tools`. If esbuild can't
be fetched and Bun is installed, Bun is used instead. `GLYX_BUNDLER=esbuild|bun` forces one.

## TypeScript

```bash
glyx create my-app --typescript
```

writes `src/app.tsx` and a `tsconfig.json`. `glyx check` type-checks with your project's own
TypeScript. Every `@glyx-dev/*` package ships type declarations.

## Links

- Documentation: https://glyx.dev/docs
- Source and issues: https://github.com/glyx-dev/glyx
- Releases: https://github.com/glyx-dev/glyx/releases

## License

MIT OR Apache-2.0
