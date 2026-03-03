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

pub use runtime::VeloxRuntime;
pub use bindings::{NodeProps, NodeType, SceneCommand, InputEvent};

// ── V8 platform init ──────────────────────────────────────────────────────────

static V8_INIT: Once = Once::new();

/// Initialise the V8 platform.
///
/// Must be called exactly once before any `VeloxRuntime` is created.
/// Safe to call multiple times — subsequent calls are no-ops.
pub fn init_v8() {
    V8_INIT.call_once(|| {
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
