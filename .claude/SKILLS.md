# Glyx Framework — Claude Code Skills

These skills help contributors work with the Glyx source code.
Run with `/add-binding`, `/add-capability-gate`, etc.

---

## /add-binding

Add a new JS-to-Rust binding.

**Steps:**
1. Add the binding function to `crates/glyx-runtime/src/bindings.rs`
   - Follow the pattern of nearby bindings: receive a `FunctionCallbackInfo`, extract args with `get_args!`, call into runtime state via `scope.get_slot::<Arc<Mutex<AsyncState>>>()`, enqueue an async task
   - Name it `__glyx_<name>` (snake_case)
2. Register it in `bind_all()` (same file) with `set_binding!(scope, "__glyx_<name>", <fn>)`
3. Add a snapshot stub in `crates/glyx-runtime/src/snapshot.rs` — return the correct type shape (snapshot runs JS at build time without a native window)
4. Expose a JS wrapper in `js/packages/@glyx/react/src/index.js`
5. If the binding needs a capability gate, see `/add-capability-gate`

**Files:** `crates/glyx-runtime/src/bindings.rs`, `crates/glyx-runtime/src/snapshot.rs`, `js/packages/@glyx/react/src/index.js`

---

## /add-capability-gate

Gate an existing binding behind a capability declaration.

**Steps:**
1. Add the capability field to `crates/glyx-security/src/lib.rs` in the `Capabilities` struct (use `Option<bool>` for simple flags, or a nested struct for scoped capabilities)
2. Add a check method like `can_use_<name>(&self) -> bool` on `Capabilities`
3. In the binding function in `bindings.rs`, call `caps.can_use_<name>()` early and return a JS `Error` if denied
4. Add the field to the JSON schema at `tools/vscode-glyx/schemas/glyx.config.schema.json`
5. Document it in `pages/docs/config/capabilities.mdx` (veloxkit-docs repo)

**Files:** `crates/glyx-security/src/lib.rs`, `crates/glyx-runtime/src/bindings.rs`, `tools/vscode-glyx/schemas/glyx.config.schema.json`

---

## /run-tests

Run the full Glyx test suite.

```bash
# Rust tests (security, decoder, backend, config)
cargo test --workspace

# JS tests (all 18 @glyx packages)
cd js && bun test

# Single crate
cargo test -p glyx-security

# Single package
cd js/packages/@glyx/react && bun test
```

CI runs both via `.github/workflows/ci.yml`. Fix Rust warnings before opening a PR — CI is `--deny warnings`.

---

## /add-snapshot-stub

Add a stub so a new `__glyx_*` binding works inside V8 snapshots (build-time JS execution, no native window).

**Location:** `crates/glyx-runtime/src/snapshot.rs`

**Pattern:** Find the `install_stubs` function. Add a JS string that sets `globalThis.__glyx_<name>` to a function returning a resolved promise (or synchronous value) of the correct shape.

```js
// Example stub shape for a binding that returns { path: string }
globalThis.__glyx_my_binding = () => Promise.resolve({ path: '' });
```

**Rule:** The stub must return the same shape as the real binding. If the real binding returns `string`, the stub returns `''`. If it returns `{width, height}`, the stub returns `{width:0, height:0}`. Wrong shapes cause snapshot deserialization errors at startup.

---

## /explain-error

Common Glyx build and runtime errors:

**`LNK2038` (MSVC CRT mismatch)**
The project uses `/MT` (static CRT) throughout. A new dependency defaulting to `/MD` will cause this. Fix: vendor the crate and add `.static_crt(true)` to its build.rs MSVC branch. See `vendor/libmimalloc-sys/`.

**`CapabilityDenied` at runtime**
The JS code called a gated API but the capability is absent from `glyx.config.ts`. Add it to the `capabilities` block.

**`snapshot deserialization failed`**
A `__glyx_*` binding was added without a matching stub in `snapshot.rs`. The V8 snapshot was built without it. Add the stub and rebuild (`glyx build` or `cargo run -p glyx-cli -- build`).

**`path not allowed by capability`**
An `fs.*` call used a path that doesn't match the declared `read`/`write`/`delete` globs. Widen the globs in `glyx.config.ts`, or use a `dialog` API to let the user pick a path (dialog results are pre-authorized).

**`plugin capability not granted`**
A plugin's `capabilities` array lists a capability not present in the app's top-level `capabilities`. Either grant it to the app or remove it from the plugin.
