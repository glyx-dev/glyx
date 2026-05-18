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
pub mod snapshot;
#[cfg(feature = "dev")]
pub mod inspector;

pub use runtime::{VeloxRuntime, HeapStats};
pub use bindings::{
    NodeProps, NodeType, CanvasCmd, SceneCommand, InputEvent, WindowController,
    IpcBus, IpcInbox, new_ipc_bus,
};
pub use snapshot::{SnapshotBlob, create_stub_bindings_script};

/// Trait for registering custom native (Rust) bindings from app code.
///
/// Implement this trait to expose your own `__myapp_*` functions to JavaScript
/// without modifying the framework. Extensions are called once at startup,
/// after all built-in bindings are registered.
///
/// # Example
/// ```no_run
/// use velox_runtime::VeloxExtension;
///
/// struct MyBinding;
/// impl VeloxExtension for MyBinding {
///     fn name(&self) -> &str { "my_binding" }
///     fn register(&self, scope: &mut v8::HandleScope, global: v8::Local<v8::Object>) {
///         let key = v8::String::new(scope, "__myapp_hello").unwrap();
///         let func = v8::Function::new(scope, |_scope: &mut v8::HandleScope,
///             _args: v8::FunctionCallbackArguments,
///             mut rv: v8::ReturnValue| {
///             rv.set_undefined();
///         }).unwrap();
///         global.set(scope, key.into(), func.into());
///     }
/// }
/// ```
pub trait VeloxExtension: Send + Sync {
    /// Unique name for logging/debugging.
    fn name(&self) -> &str;
    /// Register native V8 bindings. Called once after the isolate is created.
    fn register(&self, scope: &mut v8::HandleScope, global: v8::Local<v8::Object>);
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
