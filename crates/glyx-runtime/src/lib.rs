//! glyx-runtime — V8 JavaScript engine embedding.
//!
//! # Architecture
//!
//! ```text
//! GlyxRuntime
//!   ├─ v8::OwnedIsolate          (one per app, owns the V8 heap)
//!   ├─ v8::Global<v8::Context>   (JS global scope, persisted across calls)
//!   └─ tokio::runtime::Handle    (for dispatching async work off the V8 thread)
//! ```
//!
//! ## Thread model
//!
//! V8 must only be called from the thread that created the isolate.
//! Tokio tasks run on a separate thread pool.  The bridge between them uses
//! `isolate.request_interrupt()` — the only V8-safe cross-thread call —
//! to schedule Promise resolution back onto the V8 thread.
//!
//! ## Bindings exposed to JS
//!
//! Sync:
//!   - `__glyx_getTime()` → number (Unix timestamp ms)
//!   - `__glyx_log(msg)`  → undefined (routes to Rust log::info!)
//!
//! Async:
//!   - `__glyx_readFile(path)` → Promise<string>

// V8 and QuickJS are mutually exclusive JsRuntime backends — see
// memory/backend-droppability-goals.md: picking one is meant to actually
// drop the other's dependency from the binary, not just leave it unused.
// A build enabling both would silently link V8's ~17-21 MB static lib into
// what's supposed to be a QuickJS-only (e.g. mobile) binary.
#[cfg(all(feature = "v8", feature = "quickjs"))]
compile_error!(
    "glyx-runtime: the `v8` and `quickjs` features are mutually exclusive — \
     enable exactly one JsRuntime backend, not both. Use \
     `default-features = false, features = [\"quickjs\", ...]` to build \
     without V8."
);

// The prebuilt V8 static library is compiled with mimalloc support and
// references `mi_collect`.  Force-linking the mimalloc native lib ensures any
// binary that embeds V8 (e.g. glyx-snapshot) resolves that symbol.  The search
// path is provided by libmimalloc-sys via `mimalloc` (declared in Cargo.toml).
//
// When the `glyx-v8` feature is enabled, V8 is supplied by a glyx-v8 build
// where mimalloc is already merged into the V8 archive, so this force-link is
// unnecessary and is disabled (flip back by dropping the feature). Not
// needed at all in a `quickjs`-only (V8-free) build.
#[cfg(all(feature = "v8", not(feature = "glyx-v8")))]
#[link(name = "mimalloc", kind = "static")]
extern "C" {}

pub use glyx_macros::{glyx_plugin, glyx_command};

#[cfg(feature = "v8")]
use std::sync::Once;
use thiserror::Error;

// ── Window registry (duplicate-window prevention) ────────────────────────────
//
// Process-wide map of open windows: handle → (dedupe key, focus closure).
// Populated by the `__glyx_window_create` binding (key reservation, closes the
// create→WindowReady race) and by glyx-core on WindowReady (focus closure);
// entries are removed on window close.
//
// Dedupe fires only when a create call resolves to a non-empty key:
// an explicit `key` in the create opts, or — when the app-level
// `preventDuplicateWindows` config is on — the window title.  Calls with
// `allowDuplicate: true`, and apps without the flag, are never deduped, so
// ordinary multi-window / child-window use is unaffected.

use std::collections::HashMap as WinRegMap;
use std::sync::{Arc as WinRegArc, Mutex as WinRegMutex, OnceLock as WinRegOnce,
                atomic::{AtomicBool, Ordering as WinRegOrdering}};

struct WindowRegEntry {
    key:   String,
    focus: Option<WinRegArc<dyn Fn() + Send + Sync>>,
}

static WINDOW_REGISTRY: WinRegOnce<WinRegMutex<WinRegMap<u32, WindowRegEntry>>> = WinRegOnce::new();
static PREVENT_DUPLICATE_WINDOWS: AtomicBool = AtomicBool::new(false);

fn window_registry() -> &'static WinRegMutex<WinRegMap<u32, WindowRegEntry>> {
    WINDOW_REGISTRY.get_or_init(|| WinRegMutex::new(WinRegMap::new()))
}

/// Enable/disable title-based dedupe app-wide (from `window.preventDuplicateWindows`).
pub fn set_prevent_duplicate_windows(on: bool) {
    PREVENT_DUPLICATE_WINDOWS.store(on, WinRegOrdering::Relaxed);
}

/// Whether title-based dedupe is enabled app-wide.
pub fn prevent_duplicate_windows() -> bool {
    PREVENT_DUPLICATE_WINDOWS.load(WinRegOrdering::Relaxed)
}

/// Reserve a registry slot for a window being created (before it exists).
/// An empty `key` means the window never participates in dedupe.
pub fn window_registry_reserve(id: u32, key: String) {
    window_registry().lock().unwrap().insert(id, WindowRegEntry { key, focus: None });
}

/// Attach the focus closure once the real window exists (WindowReady).
/// Creates the entry if the window wasn't reserved (e.g. the main window);
/// `key_if_new` is used only in that case.
pub fn window_registry_attach(id: u32, key_if_new: String,
                              focus: WinRegArc<dyn Fn() + Send + Sync>) {
    let mut reg = window_registry().lock().unwrap();
    match reg.get_mut(&id) {
        Some(e) => e.focus = Some(focus),
        None => { reg.insert(id, WindowRegEntry { key: key_if_new, focus: Some(focus) }); }
    }
}

/// Remove a window from the registry (window closed).
pub fn window_registry_remove(id: u32) {
    window_registry().lock().unwrap().remove(&id);
}

/// Find an open window by dedupe key and focus it.  Returns its handle.
pub fn window_registry_find_and_focus(key: &str) -> Option<u32> {
    if key.is_empty() { return None; }
    let reg = window_registry().lock().unwrap();
    for (&id, e) in reg.iter() {
        if e.key == key {
            if let Some(f) = &e.focus { f(); }
            return Some(id);
        }
    }
    None
}

// `bindings` always compiles — it holds both the shared, engine-neutral data
// model (InputEvent, SceneCommand, NodeProps, NodeType, CanvasCmd, ...) and,
// gated internally behind `#[cfg(feature = "v8")]`, the V8-specific
// binding-registration glue (register_all, the bind_*.rs submodules,
// make_promise, etc.). See PromiseHandle's doc comment for why the queue
// types are already engine-neutral; a QuickJS backend will need its own
// registration glue but reuses the same data model unchanged.
pub mod autostart;
mod menubar_api;
pub use glyx_tray::set_app_icon;
pub mod bindings;
pub mod print;
mod streams;
mod walk;

// ── Which window is calling a backend command ─────────────────────────────────
//
// A backend command is a plain `Fn(String) -> Future` with no idea who called it. Anything a command opens that belongs to a window
// (a file stream, say) has to be closed when that window closes, so the dispatchers run each command's future inside
// `as_window(window, ..)` and the command asks `current_window()`.

tokio::task_local! {
    static CURRENT_WINDOW: u32;
}

/// Run `fut` as work done for window `window`: inside it, [`current_window`] is `Some(window)`.
pub(crate) fn as_window<F: std::future::Future>(window: u32, fut: F) -> impl std::future::Future<Output = F::Output> {
    CURRENT_WINDOW.scope(window, fut)
}

/// The window whose call this backend command is serving, if it was dispatched through [`as_window`].
pub(crate) fn current_window() -> Option<u32> {
    CURRENT_WINDOW.try_with(|w| *w).ok()
}

#[cfg(feature = "quickjs")]
thread_local! {
    /// The window of the QuickJS runtime that is making a backend call right now (QuickJS runs on the window's own thread, and the call is
    /// synchronous up to the point where the command's future is spawned, so a thread-local is enough to carry it there).
    static CALLER_WINDOW: std::cell::Cell<u32> = const { std::cell::Cell::new(0) };
}

/// Run `f` (a synchronous backend call from window `window`'s QuickJS runtime) with [`caller_window`] set.
#[cfg(feature = "quickjs")]
pub(crate) fn with_caller_window<R>(window: u32, f: impl FnOnce() -> R) -> R {
    struct Restore(u32);
    impl Drop for Restore {
        fn drop(&mut self) {
            CALLER_WINDOW.with(|c| c.set(self.0));
        }
    }
    let _restore = Restore(CALLER_WINDOW.with(|c| c.replace(window)));
    f()
}

#[cfg(feature = "quickjs")]
pub(crate) fn caller_window() -> u32 {
    CALLER_WINDOW.with(|c| c.get())
}

/// Close the file streams a window opened and left open (when the window closes, or its JavaScript is reloaded). A reader's file is
/// released; a writer's queued chunks are still written, in the background. Returns how many were open.
pub fn close_window_streams(window: u32) -> usize {
    streams::close_window_global(window)
}
pub mod cap_loader;
#[cfg(feature = "v8")]
pub mod runtime;
pub mod runtime_trait;
pub mod log_bus;
pub mod net_bus;
pub mod console_js;
pub mod text_props;
// V8-only: QuickJS has no equivalent to V8 heap snapshots (see
// memory/quickjs-plan-status.md) — a quickjs-only build has no use for this.
#[cfg(feature = "v8")]
pub mod snapshot;
#[cfg(all(feature = "dev", feature = "v8"))]
pub mod inspector;
#[cfg(all(feature = "dev", feature = "v8"))]
pub mod profiler;
#[cfg(feature = "v8")]
pub mod icu;
#[cfg(feature = "quickjs")]
pub mod quickjs_runtime;
#[cfg(feature = "quickjs")]
mod quickjs_json;
#[cfg(feature = "quickjs")]
mod quickjs_props;
#[cfg(feature = "quickjs")]
mod quickjs_fs;
#[cfg(feature = "quickjs")]
mod quickjs_db;
#[cfg(feature = "quickjs")]
mod quickjs_net;
#[cfg(feature = "quickjs")]
mod quickjs_sys;
#[cfg(all(feature = "quickjs", feature = "audio"))]
mod quickjs_media;
#[cfg(feature = "quickjs")]
mod quickjs_canvas;
#[cfg(feature = "quickjs")]
mod quickjs_ai;
#[cfg(feature = "quickjs")]
mod quickjs_updater;
#[cfg(feature = "quickjs")]
mod quickjs_tray;
#[cfg(feature = "quickjs")]
mod quickjs_ipc;
#[cfg(feature = "quickjs")]
mod quickjs_video;
#[cfg(all(feature = "quickjs", feature = "shell"))]
mod quickjs_shell;


#[cfg(feature = "v8")]
pub use runtime::V8Runtime;
#[cfg(feature = "quickjs")]
pub use quickjs_runtime::QuickJsRuntime;
pub use runtime_trait::{JsRuntime, HeapStats};

/// Backward-compatible alias — existing V8-only call sites keep compiling
/// unchanged. Only meaningful when the `v8` feature is enabled; glyx-core
/// now goes through `Box<dyn JsRuntime>` (see runtime_trait.rs) rather than
/// this concrete type, so a `quickjs`-only build doesn't need this alias.
#[cfg(feature = "v8")]
pub type GlyxRuntime = V8Runtime;
pub use bindings::{
    LengthValue, NodeProps, NodeType, CanvasCmd, SceneCommand, InputEvent, WindowController,
    IpcBus, IpcInbox, new_ipc_bus,
};
#[cfg(feature = "v8")]
pub use bindings::{StatePtrUsize, reload_plugin_in_scope};
#[cfg(feature = "v8")]
pub use snapshot::{SnapshotBlob, create_stub_bindings_script};
pub use cap_loader::load_caps;
pub use glyx_cap_abi::CapSet;

/// Pinned V8 scope accepted by all V8-specific internal helper functions.
/// Only meaningful under the `v8` feature — a QuickJS backend has its own
/// (differently-shaped) scope/context type, not this alias.
///
/// The `()` context type param lets this type coerce (via `Deref`) from any of
/// the three scope flavours we use: a plain `HandleScope`, a `ContextScope`, and
/// a callback `CallbackScope`.  Functions that need to *create* handles take
/// `&mut Scope<'s, 'i>`; the returned `Local`s are tied to the `'s` lifetime.
#[cfg(feature = "v8")]
pub(crate) type Scope<'s, 'i> = v8::PinScope<'s, 'i, v8::Context>;

// ── Benchmark of the two backend-call paths (run by hand, see the tests that use it) ──────────────

/// The plugin used by the backend-call benchmarks: it returns its argument.
#[cfg(test)]
pub(crate) const BENCH_PLUGIN_JS: &str =
    "globalThis.__glyx_plugin_bench = { echo: async function(a) { return a; } };";

/// Calls the plugin `n` times through the old path (stringify, call, parse the result, as the JS
/// wrapper did before `__glyx_backend_call2`) or the new one (the value itself), with `mk(i)` as the
/// argument. `globalThis.__done` counts the calls that have finished.
#[cfg(test)]
pub(crate) fn bench_script(new_path: bool, n: u32, large: bool, command: &str, rust: bool) -> String {
    let call = if new_path && rust {
        // what the wrapper's `_parseRaw` does: QuickJS hands an object / array result over already parsed
        "(name, a) => __glyx_backend_call2(name, a).then(raw => typeof raw === 'string' ? JSON.parse(raw) : raw)"
    } else if new_path {
        "(name, a) => __glyx_backend_call2(name, a)"
    } else {
        "(name, a) => __glyx_backend_call(name, JSON.stringify(a)).then(raw => { try { return JSON.parse(raw); } catch (e) { return raw; } })"
    };
    let mk = if large {
        "(i) => Array.from({ length: 1000 }, (_, k) => ({ id: k + i, name: 'item ' + k, tags: ['a', 'b'], ok: true }))"
    } else {
        "(i) => ({ id: i, title: 'hello', done: false })"
    };
    format!(
        "globalThis.__done = 0; (() => {{ const call = {call}; const mk = {mk}; \
         for (let i = 0; i < {n}; i++) {{ call('{command}', mk(i)).then(() => {{ __done++; }}); }} }})();"
    )
}

// ── Binary command results ─────────────────────────────────────────────────────
//
// A promise is settled from a completion queue whose entries carry `Result<String, String>`. A binary
// command's result is bytes, so its completion carries a marker plus an id instead, the bytes wait in
// this table, and the engine's settle step swaps them for an `ArrayBuffer`.

/// Starts the `Ok` string of a completion whose value is bytes in the side table (a NUL first, so no
/// ordinary command result can start with it by accident).
pub(crate) const BINARY_RESULT_MARKER: &str = "\u{0}glyx:bytes:";

fn binary_results() -> &'static parking_lot::Mutex<std::collections::HashMap<u64, Vec<u8>>> {
    static TABLE: std::sync::OnceLock<parking_lot::Mutex<std::collections::HashMap<u64, Vec<u8>>>> = std::sync::OnceLock::new();
    TABLE.get_or_init(|| parking_lot::Mutex::new(std::collections::HashMap::new()))
}

/// Run a binary command and turn its answer into a completion value: the marker and the id of the
/// bytes it parked in the side table, or the error message.
pub(crate) async fn run_binary_command(f: BinaryCommandFn, input: Vec<u8>) -> Result<String, String> {
    static NEXT: std::sync::atomic::AtomicU64 = std::sync::atomic::AtomicU64::new(1);
    let bytes = f(input).await?;
    let id = NEXT.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    binary_results().lock().insert(id, bytes);
    Ok(format!("{BINARY_RESULT_MARKER}{id}"))
}

/// If `completion` is a binary marker, the bytes it stands for (taken out of the side table).
pub(crate) fn take_binary_result(completion: &str) -> Option<Option<Vec<u8>>> {
    let id: u64 = completion.strip_prefix(BINARY_RESULT_MARKER)?.parse().ok()?;
    Some(binary_results().lock().remove(&id))
}

#[cfg(test)]
mod binary_result_tests {
    use super::*;

    #[test]
    fn a_binary_result_goes_through_the_side_table_exactly_once() {
        let rt = tokio::runtime::Builder::new_current_thread().build().unwrap();
        let f: BinaryCommandFn = std::sync::Arc::new(|v| Box::pin(async move { Ok(v.into_iter().rev().collect()) }));
        let completion = rt.block_on(run_binary_command(f, vec![1, 2, 3])).unwrap();
        assert!(completion.starts_with(BINARY_RESULT_MARKER));
        assert_eq!(take_binary_result(&completion), Some(Some(vec![3, 2, 1])));
        assert_eq!(take_binary_result(&completion), Some(None), "taken: a second look finds nothing");
    }

    #[test]
    fn an_ordinary_result_is_not_mistaken_for_bytes() {
        assert_eq!(take_binary_result("{\"a\":1}"), None);
        assert_eq!(take_binary_result(""), None);
    }

    #[test]
    fn a_failing_binary_command_returns_its_error() {
        let rt = tokio::runtime::Builder::new_current_thread().build().unwrap();
        let f: BinaryCommandFn = std::sync::Arc::new(|_| Box::pin(async { Err("no good".to_string()) }));
        assert_eq!(rt.block_on(run_binary_command(f, vec![])), Err("no good".to_string()));
    }

    #[test]
    fn add_bytes_registers_a_binary_command_whose_json_handler_only_rejects() {
        let mut b = BackendRegistryBuilder::new();
        b.add_bytes("rev", |v| async move { Ok(v) });
        b.add("plain", |a| async move { Ok(a) });
        let reg = b.build();
        assert!(reg["rev"].binary.is_some());
        assert!(reg["plain"].binary.is_none());
        let rt = tokio::runtime::Builder::new_current_thread().build().unwrap();
        let err = rt.block_on((reg["rev"].handler)("{}".to_string())).unwrap_err();
        assert!(err.contains("binary command"), "{err}");
    }
}

// ── fs.watch events ───────────────────────────────────────────────────────────

/// One `fs.watch` event as JSON: `{"id":1,"path":"...","type":"modify"}`. The path goes through a real
/// JSON encoder: a file name can hold quotes, backslashes, newlines and other control characters, and
/// escaping only `\` and `"` produced invalid JSON for those (the JS side then dropped the event).
pub(crate) fn fs_watch_event_json(id: u32, path: &str, kind: &str) -> String {
    let path = serde_json::to_string(path).unwrap_or_else(|_| "\"\"".to_string());
    let kind = serde_json::to_string(kind).unwrap_or_else(|_| "\"\"".to_string());
    format!(r#"{{"id":{id},"path":{path},"type":{kind}}}"#)
}

#[cfg(test)]
mod fs_watch_event_tests {
    use super::fs_watch_event_json;

    #[test]
    fn an_event_is_valid_json_whatever_the_file_name_holds() {
        for path in [
            "C:\\Users\\me\\notes.txt",
            "say \"hi\".txt",
            "line one\nline two",
            "tab\there",
            "bell\u{7}and\u{1b}escape",
            "ünïcode — 日本語.md",
            "",
        ] {
            let json = fs_watch_event_json(7, path, "modify");
            let v: serde_json::Value = serde_json::from_str(&json).unwrap_or_else(|e| panic!("{path:?}: {e}: {json}"));
            assert_eq!(v["id"], 7);
            assert_eq!(v["path"], path);
            assert_eq!(v["type"], "modify");
        }
    }
}

// ── JS plugin type ────────────────────────────────────────────────────────────

/// A bundled JS plugin ready to be evaluated in the V8 context.
///
/// Defined here (in glyx-runtime) so it can be passed into `new_with_ipc` without
/// a circular dependency. glyx-core re-exports this as `glyx_core::JsPlugin`.
#[derive(Clone)]
pub struct JsPlugin {
    /// Command prefix — `Some("db")` → commands named `"db.<fn>"`, `None` → `"<fn>"`.
    pub prefix: Option<String>,
    /// Bundled IIFE source. After eval, `globalThis.<global_name>` holds the exports.
    pub bundled_js: String,
    /// The global variable name set by the IIFE (e.g. `"__glyx_plugin_db"`).
    pub global_name: String,
    /// Capability names declared by the plugin in `glyx.config.json`.
    /// Validated at load time to be a subset of the app's declared capabilities.
    /// Logged at startup so operators can audit what each plugin claims.
    pub capabilities: Vec<String>,
    /// Original source entry path (e.g. `"./src/plugins/db.ts"`).
    /// Used by dev-mode HMR to watch the source file and rebundle on change.
    pub entry: Option<String>,
}

/// Shared list of bundled JS plugins passed to every V8 runtime instance.
pub type JsPlugins = std::sync::Arc<Vec<JsPlugin>>;

// ── Backend command registry ──────────────────────────────────────────────────

/// A single async Rust command callable from JS via `backend.<name>(args)`.
///
/// Receives the raw JSON string of the args object and must return a JSON string
/// (or an error message). Keep IO-bound work on Tokio; avoid blocking.
pub type BackendCommandFn = std::sync::Arc<
    dyn Fn(String) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<String, String>> + Send>>
        + Send
        + Sync,
>;

/// The handler of a binary command (`add_bytes`): the argument bytes in, the result bytes out, with
/// no JSON on either side. Reaches JS as an `ArrayBuffer`.
pub type BinaryCommandFn = std::sync::Arc<
    dyn Fn(Vec<u8>) -> std::pin::Pin<Box<dyn std::future::Future<Output = Result<Vec<u8>, String>> + Send>>
        + Send
        + Sync,
>;

/// A registered command's handler plus the capability names (if any) a
/// caller's app must have declared in `glyx.config.json` to invoke it.
/// Native `GlyxExtension` commands have no capability enforcement built in
/// otherwise — unlike JS plugins, which get a load-time capability-subset
/// check — so `add_gated` exists specifically to let an extension opt a
/// command into the same named-capability model.
///
/// `binary` is set for a command registered with `add_bytes`/`add_bytes_gated`, which takes and
/// returns raw bytes instead of JSON; its `handler` is then only a stub that rejects.
pub struct RegisteredCommand {
    pub capabilities: Vec<String>,
    pub handler: BackendCommandFn,
    /// Set for a command registered with `add_bytes`: it takes and returns raw bytes, and `handler`
    /// is a stub that only rejects (a JSON caller reached a binary command).
    pub binary: Option<BinaryCommandFn>,
}

/// Immutable registry of named backend commands. Built once at startup from the
/// list of extensions and then shared read-only across all async invocations.
pub type BackendRegistry = std::sync::Arc<std::collections::HashMap<String, RegisteredCommand>>;

/// Builder used by `GlyxExtension::register_commands` to accumulate commands.
pub struct BackendRegistryBuilder {
    commands: std::collections::HashMap<String, RegisteredCommand>,
}

impl BackendRegistryBuilder {
    pub fn new() -> Self { Self { commands: std::collections::HashMap::new() } }

    /// Register an async command handler with no capability requirement —
    /// the common case for most native commands.
    pub fn add<F, Fut>(&mut self, name: impl Into<String>, f: F)
    where
        F:   Fn(String) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = Result<String, String>> + Send + 'static,
    {
        self.add_gated(name, &[], f);
    }

    /// Register an async command handler that requires the caller's app to
    /// have every named capability enabled in `glyx.config.json` (checked
    /// via `glyx_security::Capabilities::has_named` on every call, not just
    /// at load time). A call missing any required capability rejects with
    /// a message naming it, without ever running `f`.
    pub fn add_gated<F, Fut>(&mut self, name: impl Into<String>, capabilities: &[&str], f: F)
    where
        F:   Fn(String) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = Result<String, String>> + Send + 'static,
    {
        self.commands.insert(name.into(), RegisteredCommand {
            capabilities: capabilities.iter().map(|s| s.to_string()).collect(),
            handler: std::sync::Arc::new(move |args| Box::pin(f(args))),
            binary: None,
        });
    }

    /// Register a **binary** command: it receives the bytes of an `ArrayBuffer` or typed array and
    /// returns bytes, which reach JS as an `ArrayBuffer`. No JSON on either side, so bulk data (pixels,
    /// audio, tables of numbers) crosses as a copy instead of as text.
    ///
    /// ```ignore
    /// cmds.add_bytes("invert", |mut pixels: Vec<u8>| async move {
    ///     for p in pixels.iter_mut() { *p = 255 - *p; }
    ///     Ok(pixels)
    /// });
    /// // JS: const out = await backend.invert(new Uint8Array(pixels));   // out is an ArrayBuffer
    /// ```
    ///
    /// Call it from JS with an `ArrayBuffer` or any typed array / `DataView` (only the bytes the view
    /// covers are sent); anything else rejects. Only the `__glyx_backend_call2` path can reach it.
    pub fn add_bytes<F, Fut>(&mut self, name: impl Into<String>, f: F)
    where
        F:   Fn(Vec<u8>) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = Result<Vec<u8>, String>> + Send + 'static,
    {
        self.add_bytes_gated(name, &[], f);
    }

    /// `add_bytes` that also requires the named capabilities, like `add_gated`.
    pub fn add_bytes_gated<F, Fut>(&mut self, name: impl Into<String>, capabilities: &[&str], f: F)
    where
        F:   Fn(Vec<u8>) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = Result<Vec<u8>, String>> + Send + 'static,
    {
        let name = name.into();
        let stub_name = name.clone();
        self.commands.insert(name, RegisteredCommand {
            capabilities: capabilities.iter().map(|s| s.to_string()).collect(),
            handler: std::sync::Arc::new(move |_| {
                let n = stub_name.clone();
                Box::pin(async move { Err(format!("backend.{n} is a binary command: call it with an ArrayBuffer or a typed array")) })
            }),
            binary: Some(std::sync::Arc::new(move |bytes| Box::pin(f(bytes)))),
        });
    }

    pub fn build(self) -> BackendRegistry {
        std::sync::Arc::new(self.commands)
    }
}

/// True if `caps` has every capability `cmd` requires. Empty requirements
/// (the common case, via plain `add()`) always pass. Shared by both
/// engines' `backend_call` dispatch.
pub fn command_capabilities_ok(cmd: &RegisteredCommand, caps: &glyx_security::Capabilities) -> Result<(), String> {
    for cap in &cmd.capabilities {
        if !caps.has_named(cap) {
            return Err(format!(
                "missing capability \"{cap}\" — add it to glyx.config.json's \"capabilities\" to call this command"
            ));
        }
    }
    Ok(())
}

#[cfg(test)]
mod backend_registry_tests {
    use super::*;
    use glyx_security::Capabilities;

    fn app_caps_with(json: &str) -> Capabilities {
        serde_json::from_str(json).expect("test capabilities JSON should parse")
    }

    fn gated_cmd(capabilities: &[&str]) -> RegisteredCommand {
        let mut builder = BackendRegistryBuilder::new();
        builder.add_gated("test", capabilities, |_| async { Ok("null".to_string()) });
        builder.build().get("test").map(|c| RegisteredCommand {
            capabilities: c.capabilities.clone(),
            handler: c.handler.clone(),
            binary: c.binary.clone(),
        }).unwrap()
    }

    #[test]
    fn ungated_command_always_passes() {
        let cmd = gated_cmd(&[]);
        assert!(command_capabilities_ok(&cmd, &app_caps_with("{}")).is_ok());
    }

    #[test]
    fn gated_command_rejects_when_app_lacks_capability() {
        let cmd = gated_cmd(&["fs"]);
        let caps = app_caps_with(r#"{"dialog":true}"#);
        let err = command_capabilities_ok(&cmd, &caps).unwrap_err();
        assert!(err.contains("fs"), "got: {err}");
    }

    #[test]
    fn gated_command_succeeds_when_app_has_capability() {
        let cmd = gated_cmd(&["fs"]);
        let caps = app_caps_with(r#"{"fs":{"read":["**"]}}"#);
        assert!(command_capabilities_ok(&cmd, &caps).is_ok());
    }

    #[test]
    fn gated_command_with_multiple_capabilities_requires_all_of_them() {
        let cmd = gated_cmd(&["fs", "network"]);
        // Only "fs" granted — "network" missing — must still reject.
        let caps = app_caps_with(r#"{"fs":{"read":["**"]}}"#);
        assert!(command_capabilities_ok(&cmd, &caps).is_err());
    }
}

/// Collect commands from all extensions and build a single shared registry.
pub fn build_backend_registry(extensions: &[Box<dyn GlyxExtension>]) -> BackendRegistry {
    let mut builder = BackendRegistryBuilder::new();
    // Built in: file streams (`glyx_stream.*`), which the `fs` stream API in JavaScript calls.
    streams::register(&mut builder);
    for ext in extensions {
        ext.register_commands(&mut builder);
    }
    builder.build()
}

// ── Extension trait ───────────────────────────────────────────────────────────

/// Trait for registering custom native (Rust) bindings from app code.
///
/// Implement this trait to expose your own `__myapp_*` functions to JavaScript
/// without modifying the framework. Extensions are called once at startup,
/// after all built-in bindings are registered.
///
/// ## Two integration points
///
/// 1. **`register()`** — low-level: directly install V8 callback functions under
///    any global name you choose.  Use this for synchronous bindings or when you
///    need full control of the V8 API.
///
/// 2. **`register_commands()`** — high-level: declare named async commands that
///    are callable from JS as `await backend.myCommand({ ...args })`.  The
///    framework handles the Promise plumbing; you only write the Rust async fn.
///
/// You can implement either, both, or neither (for config-only extensions).
///
/// # Example
/// ```no_run
/// use glyx_runtime::{GlyxExtension, BackendRegistryBuilder};
///
/// struct MyExtension;
/// impl GlyxExtension for MyExtension {
///     fn name(&self) -> &str { "my_extension" }
///
///     fn register_commands(&self, cmds: &mut BackendRegistryBuilder) {
///         cmds.add("greet", |args_json| async move {
///             let args: serde_json::Value = serde_json::from_str(&args_json)
///                 .unwrap_or_default();
///             let name = args["name"].as_str().unwrap_or("world");
///             Ok(format!("\"Hello, {name}!\""))
///         });
///     }
/// }
/// ```
pub trait GlyxExtension: Send + Sync {
    /// Unique name for logging/debugging.
    fn name(&self) -> &str;

    /// Register native V8 bindings directly. Called once after the isolate is created.
    /// Default: no-op. Only meaningful under the `v8` feature — a QuickJS
    /// build has no isolate/scope to register against this way; extensions
    /// wanting QuickJS support use `register_commands` instead, which is
    /// engine-neutral.
    #[cfg(feature = "v8")]
    fn register(&self, _scope: &mut Scope, _global: v8::Local<v8::Object>) {}

    /// Register named async backend commands callable from JS as `backend.<name>(args)`.
    /// Default: no commands.
    fn register_commands(&self, _cmds: &mut BackendRegistryBuilder) {}
}

// ── Cancellable async task ────────────────────────────────────────────────────

/// A handle to a background Tokio task that is **automatically aborted when dropped**.
///
/// Store this in component state. When the component unmounts (React reconciler
/// calls `detachDeletedInstance`), the handle is dropped and the in-flight work
/// is cancelled immediately — no wasted DB queries, network fetches, or AI calls
/// for screens the user already navigated away from.
///
/// Call [`CancellableTask::detach`] to let the task run to completion even if
/// the handle is dropped (equivalent to `tokio::spawn` with no handle).
///
/// # Example
/// ```ignore
/// // Illustrative — `do_heavy_work` stands in for your own async fn.
/// // In a JS plugin or Rust extension:
/// fn start_work(tokio: &tokio::runtime::Handle) -> CancellableTask {
///     CancellableTask::spawn(tokio, async {
///         let result = do_heavy_work().await;
///         // post result to completion queue...
///     })
/// }
/// // Dropping the returned CancellableTask aborts `do_heavy_work` immediately.
/// ```
pub struct CancellableTask {
    handle: Option<tokio::task::JoinHandle<()>>,
}

impl CancellableTask {
    /// Spawn a task on `rt`. Dropping the returned handle aborts the task.
    pub fn spawn<F>(rt: &tokio::runtime::Handle, fut: F) -> Self
    where
        F: std::future::Future<Output = ()> + Send + 'static,
    {
        Self { handle: Some(rt.spawn(fut)) }
    }

    /// Detach: the task continues running even after this handle is dropped.
    /// Tokio's `JoinHandle` detaches (not aborts) on normal drop, so we just
    /// take the inner handle out before our `Drop` impl can abort it.
    pub fn detach(mut self) {
        drop(self.handle.take()); // JoinHandle drop = detach, not abort
    }
}

impl Drop for CancellableTask {
    fn drop(&mut self) {
        if let Some(h) = self.handle.take() {
            h.abort();
        }
    }
}

// ── V8 platform init ──────────────────────────────────────────────────────────

#[cfg(feature = "v8")]
static V8_INIT: Once = Once::new();

/// Initialise the V8 platform.
///
/// Must be called exactly once before any `GlyxRuntime` is created.
/// Safe to call multiple times — subsequent calls are no-ops.
#[cfg(feature = "v8")]
pub fn init_v8() {
    V8_INIT.call_once(|| {
        // Set flags BEFORE platform init — V8 ignores flags set afterwards.
        //
        // --lite-mode:
        //   Skips Turbofan (the expensive optimising JIT) and uses Sparkplug
        //   (a fast single-pass baseline compiler) instead.  Cuts JIT code-space
        //   by ~60-80 %.  JS still runs compiled — not interpreted — so the CPU
        //   cost is modest (~10-20 % slower hot paths).
        //
        // --optimize-for-size:
        //   Tells every tier (parser, bytecode, JIT) to prefer smaller output
        //   over maximum throughput.  Works in tandem with --lite-mode.
        //
        // (--no-expose-wasm / --expose-gc were removed in V8 15.x.)
        // In release, also pass --disallow-code-generation-from-strings so
        // eval() and new Function() throw at the V8 flag level (applies to
        // every context in this process, including any created by extensions).
        // Debug builds leave this off so hot-reload and devtools work normally.
        #[cfg(not(debug_assertions))]
        v8::V8::set_flags_from_string(
            "--lite-mode --optimize-for-size \
             --disallow-code-generation-from-strings"
        );
        #[cfg(debug_assertions)]
        v8::V8::set_flags_from_string(
            "--lite-mode --optimize-for-size"
        );
        // Source-map position translation in stack traces is handled via the
        // ScriptOrigin source_map_url set on each eval() call (runtime.rs).
        // The --enable_source_maps V8 flag was removed in V8 9.x.

        // Load ICU locale data BEFORE V8::initialize() so Intl.* / toLocaleString
        // work. Must happen exactly once.
        crate::icu::init();

        let platform = v8::new_default_platform(0, false).make_shared();
        v8::V8::initialize_platform(platform);
        v8::V8::initialize();
        log::info!("V8 platform initialised ({})", v8::V8::get_version());
    });
}

#[derive(Debug, Error)]
pub enum RuntimeError {
    #[error("JS exception: {0}")]
    JsException(String),
    #[error("Script compilation failed: {0}")]
    CompileError(String),
    #[error("No Tokio runtime available for async bindings")]
    NoTokioRuntime,
    #[error("IO error in async binding: {0}")]
    Io(#[from] std::io::Error),
}

#[cfg(all(test, feature = "v8"))]
mod icu_tests {
    use super::*;

    /// Evaluate a JS expression in a throwaway isolate. ICU data is loaded by
    /// `init_v8()`, which must run first.
    fn eval_expr(expr: &str) -> String {
        let mut isolate = v8::Isolate::new(v8::Isolate::create_params());

        // Build the context and keep it as a Global so it survives the scope.
        let ctx_global = {
            v8::scope!(let scope, &mut isolate);
            v8::Global::new(&scope, v8::Context::new(&scope, Default::default()))
        };

        // Re-enter the context reusing the same handle scope (no second
        // `&mut isolate` borrow — see runtime.rs §13).
        v8::scope!(let scope, &mut isolate);
        let context_local = v8::Local::new(&scope, &ctx_global);
        let scope = &mut v8::ContextScope::new(scope, context_local);

        let code = v8::String::new(scope, expr).unwrap();
        let script = v8::Script::compile(scope, code, None).unwrap();
        let result = script.run(scope).unwrap();
        result.to_rust_string_lossy(scope)
    }

    #[test]
    fn intl_locale_formatting_works() {
        init_v8();

        // ICU data loaded → locale-specific formatting actually works.
        assert_eq!(
            eval_expr("new Intl.NumberFormat('de-DE').format(1234.5)"),
            "1.234,5"
        );
        assert_eq!(
            eval_expr("(1234.5).toLocaleString('en-US')"),
            "1,234.5"
        );
        assert!(
            eval_expr("new Intl.DateTimeFormat('ja-JP').format(new Date(0))").len() > 0,
            "DateTimeFormat should produce a non-empty localized string"
        );

        // Setting the default locale changes unqualified formatting.
        v8::icu::set_default_locale("de-DE");
        assert_eq!(eval_expr("(1234.5).toLocaleString()"), "1.234,5");
    }
}
