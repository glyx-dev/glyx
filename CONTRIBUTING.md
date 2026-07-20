# Contributing to Glyx

Thanks for your interest in contributing! Glyx is pre-release and moving
fast, so the most valuable contributions right now are bug reports with
reproductions, docs fixes, and focused code changes. For anything large,
open a [discussion](https://github.com/glyx-dev/glyx/discussions) first so
we can agree on the approach before you invest time.

## Development setup

You need the full toolchain to work on the framework itself (unlike app
developers, who don't need Rust):

| Tool | Version |
|---|---|
| Rust (stable) | 1.77+ |
| Node.js | 18+ |
| Bun | 1.3+ |

```bash
git clone https://github.com/glyx-dev/glyx.git
cd glyx
bun install
cargo check --workspace
```

> **Windows note:** the workspace links against pre-built V8 libraries that
> use the static CRT (`/MT`). Everything is already configured — just don't
> change CRT-related flags in `Cargo.toml` or `.cargo/config.toml`.

### Running an example

```bash
cargo run -p glyx-cli -- dev examples/hello-world
```

`examples/notes-app` is the full-featured reference app and exercises most
of the framework — use it to sanity-check renderer, layout, and input
changes.

### Repository layout

- `crates/` — the Rust workspace. Start at `glyx-core` (event loop, scene,
  layout, render) and `glyx-runtime` (V8 bindings). See the
  [README](./README.md#project-structure) for the full map.
- `js/packages/@glyx/` — the JS/TS packages. `@glyx-dev/react` is the
  reconciler and component layer; most JS-visible behavior lives there.
- `vendor/` — patched third-party crates (`vello`,
  `libmimalloc-sys`). Changes here need a comment explaining the deviation
  from upstream.
- `examples/` — runnable apps, also used for manual regression testing.

## Quality bar

- **`cargo check --workspace` must produce zero warnings** before any
  change is considered done. This is enforced culture, not a suggestion.
- Run `bun test` in `js/` for JS-side changes (`@glyx-dev/testing` provides the
  headless harness).
- New native bindings (`__glyx_*`) need: the binding in
  `glyx-runtime/src/bindings.rs`, a snapshot stub so snapshot builds don't
  break, and a JS wrapper in `@glyx-dev/react`.
- Renderer changes must be checked against every backend the change applies
  to (TinySkia, Vello, and Direct2D on Windows) — behavior that only works
  on one is a bug. Note that WGSL shaders validate at pipeline creation
  (runtime), not at `cargo build`, so shader changes need a real render
  smoke test.
- Match the style of surrounding code. Comments explain *why*, not *what*.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat(core): add svg image support
fix(renderer): bound skia glyph cache
chore(assets): update app icon
docs: rewrite image component guide
```

Scope is the crate or package short name (`core`, `cli`, `renderer`,
`react`, …). Keep each commit buildable.

## Pull requests

1. Fork and branch from `dev` (not `main`).
2. Keep PRs focused — one logical change per PR.
3. Fill in the PR template: what changed, why, and how you verified it.
4. Make sure `cargo check --workspace` is warning-free and tests pass.
5. A maintainer will review; pre-1.0, API-shape feedback is common — don't
   take rework requests as rejection.

## Reporting bugs

Use the [bug report template](https://github.com/glyx-dev/glyx/issues/new?template=bug_report.md).
The single most useful thing you can include is a minimal reproduction —
ideally a `glyx create` app plus the smallest `app.jsx` that shows the
problem. Include your OS, GPU, and the renderer backend in use (printed at
startup, or set `renderMode` explicitly to isolate).

## Security issues

Please do not open public issues for security vulnerabilities. See
[SECURITY.md](./SECURITY.md).

## License

By contributing, you agree that your contributions will be dual-licensed
under [Apache-2.0](./LICENSE-APACHE) and [MIT](./LICENSE-MIT), as per the
project license.
