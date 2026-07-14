//! glyx-snapshot — V8 snapshot creation tool
//!
//! Creates a V8 snapshot blob from JavaScript source code (polyfills + framework + app).
//! The snapshot is pre-executed at build time and embedded in the final binary,
//! enabling fast startup by restoring the heap instead of parsing JS.

use std::sync::Once;

static V8_INIT: Once = Once::new();

/// Create a V8 snapshot blob from JavaScript source.
///
/// Combines stubs + polyfills + framework + app into a single script,
/// executes it in V8, and captures the resulting heap as a binary blob.
pub fn create_snapshot(
    polyfills: &str,
    framework: &str,
    app_js: &str,
) -> Result<Vec<u8>, SnapshotError> {
    // Initialize V8 platform (once per process)
    V8_INIT.call_once(|| {
        let platform = v8::new_default_platform(0, false).make_shared();
        v8::V8::initialize_platform(platform);
        v8::V8::initialize();
    });

    // Get stub bindings from runtime
    let stubs = glyx_runtime::create_stub_bindings_script();
    let combined_source = format!("{}\n{}\n{}\n{}", stubs, polyfills, framework, app_js);

    // v8 150: `SnapshotCreator::new` returns the `OwnedIsolate` directly — the
    // isolate is created and registered with the snapshot creator internally.
    // We no longer call `get_owned_isolate()` / `std::mem::forget()`.
    let mut isolate = v8::SnapshotCreator::new(None, None);

    {
        v8::scope!(let scope, &mut isolate);
        let context = v8::Context::new(&scope);
        let ctx_global = v8::Global::new(&scope, context);

        // Re-enter the context for script execution.
        v8::scope_with_context!(let scope, &mut isolate, &ctx_global);

        // Compile and run the combined script
        let source = v8::String::new(&scope, &combined_source)
            .ok_or_else(|| SnapshotError::ExecutionFailed("Failed to create source string".into()))?;

        let script = v8::Script::compile(&scope, source, None)
            .ok_or_else(|| SnapshotError::ExecutionFailed("Failed to compile snapshot".into()))?;

        script.run(&scope)
            .ok_or_else(|| SnapshotError::ExecutionFailed("Failed to execute snapshot".into()))?;

        // Register the context as the snapshot's default context.  `context` is
        // a `Local` valid within this scope block.
        let context = v8::Local::new(&scope, &ctx_global);
        isolate.set_default_context(context);
    }

    // `create_blob` consumes the isolate (it internally forgets it so the
    // SnapshotCreator owns its lifetime) and returns the serialized heap.
    let startup_data = isolate.create_blob(v8::FunctionCodeHandling::Clear)
        .ok_or_else(|| SnapshotError::ExecutionFailed("Failed to create snapshot blob".into()))?;

    Ok(startup_data.to_vec())
}

#[derive(Debug)]
pub enum SnapshotError {
    ExecutionFailed(String),
    Io(std::io::Error),
}

impl std::fmt::Display for SnapshotError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::ExecutionFailed(msg) => write!(f, "Snapshot execution failed: {}", msg),
            Self::Io(e) => write!(f, "IO error: {}", e),
        }
    }
}

impl std::error::Error for SnapshotError {}

impl From<std::io::Error> for SnapshotError {
    fn from(e: std::io::Error) -> Self {
        Self::Io(e)
    }
}
