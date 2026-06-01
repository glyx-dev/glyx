//! velox-runtime — V8 JavaScript engine embedding.
//!
//! # Architecture
//!
//! ```text
//! VeloxRuntime
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
//!   - `__velox_getTime()` → number (Unix timestamp ms)
//!   - `__velox_log(msg)`  → undefined (routes to Rust log::info!)
//!
//! Async:
//!   - `__velox_readFile(path)` → Promise<string>

use std::sync::Once;
use thiserror::Error;

pub mod bindings;
pub mod runtime;
pub mod runtime_trait;
pub mod snapshot;
#[cfg(feature = "dev")]
pub mod inspector;

pub use runtime::{V8Runtime, HeapStats};
pub use runtime_trait::JsRuntime;

/// Backward-compatible alias — all existing call sites in velox-core continue
/// to compile unchanged. Switch to `Box<dyn JsRuntime>` when adding a second backend.
pub type VeloxRuntime = V8Runtime;
pub use bindings::{
    LengthValue, NodeProps, NodeType, CanvasCmd, SceneCommand, InputEvent, WindowController,
    IpcBus, IpcInbox, new_ipc_bus,
};
pub use snapshot::{SnapshotBlob, create_stub_bindings_script};

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

/// Builder used by `VeloxExtension::register_commands` to accumulate commands.
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
pub fn build_backend_registry(extensions: &[Box<dyn VeloxExtension>]) -> BackendRegistry {
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
/// use velox_runtime::{VeloxExtension, BackendRegistryBuilder};
///
/// struct MyExtension;
/// impl VeloxExtension for MyExtension {
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
pub trait VeloxExtension: Send + Sync {
    /// Unique name for logging/debugging.
    fn name(&self) -> &str;

    /// Register native V8 bindings directly. Called once after the isolate is created.
    /// Default: no-op.
    fn register(&self, _scope: &mut v8::HandleScope, _global: v8::Local<v8::Object>) {}

    /// Register named async backend commands callable from JS as `backend.<name>(args)`.
    /// Default: no commands.
    fn register_commands(&self, _cmds: &mut BackendRegistryBuilder) {}
}

// ── V8 platform init ──────────────────────────────────────────────────────────

static V8_INIT: Once = Once::new();

/// Initialise the V8 platform.
///
/// Must be called exactly once before any `VeloxRuntime` is created.
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
        v8::V8::set_flags_from_string(
            "--lite-mode --optimize-for-size --no-expose-wasm"
        );

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
