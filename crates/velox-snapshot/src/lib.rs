//! velox-snapshot — V8 snapshot creation tool
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
    let stubs = velox_runtime::create_stub_bindings_script();
    let combined_source = format!("{}\n{}\n{}\n{}", stubs, polyfills, framework, app_js);

    // Create a SnapshotCreator to capture V8 heap state
    let mut snapshot_creator = v8::SnapshotCreator::new(None);

    {
        // Get the isolate from the snapshot creator's default context (unsafe)
        let mut isolate = unsafe { snapshot_creator.get_owned_isolate() };

        {
            let scope = &mut v8::HandleScope::new(&mut isolate);
            let context = v8::Context::new(scope);
            let scope = &mut v8::ContextScope::new(scope, context);

            // Compile and run the combined script
            let source = v8::String::new(scope, &combined_source)
                .ok_or_else(|| SnapshotError::ExecutionFailed("Failed to create source string".into()))?;

            let script = v8::Script::compile(scope, source, None)
                .ok_or_else(|| SnapshotError::ExecutionFailed("Failed to compile snapshot".into()))?;

            script.run(scope)
                .ok_or_else(|| SnapshotError::ExecutionFailed("Failed to execute snapshot".into()))?;

            // Flush pending microtasks
            scope.perform_microtask_checkpoint();
        }
    }

    // Serialize the heap snapshot
    let startup_data = snapshot_creator.create_blob(v8::FunctionCodeHandling::Clear)
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
