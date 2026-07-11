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

pub use glyx_macros::{glyx_plugin, glyx_command};

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

pub mod bindings;
pub mod cap_loader;
pub mod runtime;
pub mod runtime_trait;
pub mod snapshot;
#[cfg(feature = "dev")]
pub mod inspector;


pub use runtime::{V8Runtime, HeapStats};
pub use runtime_trait::JsRuntime;

/// Backward-compatible alias — all existing call sites in glyx-core continue
/// to compile unchanged. Switch to `Box<dyn JsRuntime>` when adding a second backend.
pub type GlyxRuntime = V8Runtime;
pub use bindings::{
    LengthValue, NodeProps, NodeType, CanvasCmd, SceneCommand, InputEvent, WindowController,
    IpcBus, IpcInbox, new_ipc_bus, StatePtrUsize, reload_plugin_in_scope,
};
pub use snapshot::{SnapshotBlob, create_stub_bindings_script};
pub use cap_loader::load_caps;
pub use glyx_cap_abi::CapSet;

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

/// Immutable registry of named backend commands. Built once at startup from the
/// list of extensions and then shared read-only across all async invocations.
pub type BackendRegistry = std::sync::Arc<std::collections::HashMap<String, BackendCommandFn>>;

/// Builder used by `GlyxExtension::register_commands` to accumulate commands.
pub struct BackendRegistryBuilder {
    commands: std::collections::HashMap<String, BackendCommandFn>,
}

impl BackendRegistryBuilder {
    pub fn new() -> Self { Self { commands: std::collections::HashMap::new() } }

    /// Register an async command handler.
    pub fn add<F, Fut>(&mut self, name: impl Into<String>, f: F)
    where
        F:   Fn(String) -> Fut + Send + Sync + 'static,
        Fut: std::future::Future<Output = Result<String, String>> + Send + 'static,
    {
        self.commands.insert(name.into(), std::sync::Arc::new(move |args| Box::pin(f(args))));
    }

    pub fn build(self) -> BackendRegistry {
        std::sync::Arc::new(self.commands)
    }
}

/// Collect commands from all extensions and build a single shared registry.
pub fn build_backend_registry(extensions: &[Box<dyn GlyxExtension>]) -> BackendRegistry {
    let mut builder = BackendRegistryBuilder::new();
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
    /// Default: no-op.
    fn register(&self, _scope: &mut v8::HandleScope, _global: v8::Local<v8::Object>) {}

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

static V8_INIT: Once = Once::new();

/// Initialise the V8 platform.
///
/// Must be called exactly once before any `GlyxRuntime` is created.
/// Safe to call multiple times — subsequent calls are no-ops.
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
        // --no-expose-wasm:
        //   Disable WebAssembly (unused; saves the Wasm engine's own structures).
        // In release, also pass --disallow-code-generation-from-strings so
        // eval() and new Function() throw at the V8 flag level (applies to
        // every context in this process, including any created by extensions).
        // Debug builds leave this off so hot-reload and devtools work normally.
        #[cfg(not(debug_assertions))]
        v8::V8::set_flags_from_string(
            "--lite-mode --optimize-for-size --no-expose-wasm --expose-gc \
             --disallow-code-generation-from-strings"
        );
        #[cfg(debug_assertions)]
        v8::V8::set_flags_from_string(
            "--lite-mode --optimize-for-size --no-expose-wasm --expose-gc"
        );
        // Source-map position translation in stack traces is handled via the
        // ScriptOrigin source_map_url set on each eval() call (runtime.rs).
        // The --enable_source_maps V8 flag was removed in V8 9.x.

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
