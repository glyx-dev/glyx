/// V8 Snapshot creation and restoration utilities.
///
/// This module handles the critical stub binding pattern:
/// - During snapshot creation: register JS stubs for all __velox_* bindings
/// - Snapshot the V8 heap to a binary blob
/// - At runtime: restore from blob and re-register real Rust implementations

/// Create the JavaScript stub bindings code.
/// These stubs are registered during snapshot creation and will be overridden
/// at runtime by real Rust implementations.
pub fn create_stub_bindings_script() -> String {
    r#"
// V8 Snapshot stub bindings
// Real implementations are registered at runtime via re_register_all()

const stub = function() { throw new Error('Binding not initialised'); };

// Time binding (polyfill will provide Date.now())
globalThis.__velox_getTime = function() { return Date.now(); };
globalThis.__velox_log = stub;

// File system bindings
globalThis.__velox_readFile = stub;
globalThis.__velox_writeFile = stub;
globalThis.__velox_appendFile = stub;
globalThis.__velox_listDir = stub;
globalThis.__velox_deleteFile = stub;
globalThis.__velox_mkdirp = stub;

// Scene graph bindings
globalThis.__velox_createNode = stub;
globalThis.__velox_appendChild = stub;
globalThis.__velox_updateNode = stub;
globalThis.__velox_removeNode = stub;
globalThis.__velox_setRoot = stub;
globalThis.__velox_pollEvents = stub;
globalThis.__velox_getLayout = stub;

// Image binding
globalThis.__velox_createImage = stub;

// Database bindings
globalThis.__velox_db_open = stub;
globalThis.__velox_db_query = stub;
globalThis.__velox_db_run = stub;
globalThis.__velox_db_close = stub;
globalThis.__velox_db_transaction = stub;

// Vector database bindings
globalThis.__velox_vectorDb_open = stub;
globalThis.__velox_vectorDb_upsert = stub;
globalThis.__velox_vectorDb_search = stub;
globalThis.__velox_vectorDb_close = stub;

// Window bindings
globalThis.__velox_getWindowSize = stub;
globalThis.__velox_getScreenSize = stub;
globalThis.__velox_setFullscreen = stub;
globalThis.__velox_setMaximized = stub;
globalThis.__velox_setMinimized = stub;
globalThis.__velox_isFullscreen = stub;
globalThis.__velox_isMaximized = stub;
globalThis.__velox_setAlwaysOnTop = stub;
globalThis.__velox_setTitle = stub;

// Dialog bindings
globalThis.__velox_dialog_openFile = stub;
globalThis.__velox_dialog_saveFile = stub;
globalThis.__velox_dialog_openFolder = stub;

// Clipboard bindings
globalThis.__velox_clipboard_readText = stub;
globalThis.__velox_clipboard_writeText = stub;

// Notification binding
globalThis.__velox_notification_send = stub;

// Environment binding
globalThis.__velox_getEnv = stub;
"#
    .to_string()
}

/// Snapshot blob wrapper
#[derive(Clone)]
pub struct SnapshotBlob {
    pub data: Vec<u8>,
}

impl SnapshotBlob {
    pub fn new(data: Vec<u8>) -> Self {
        Self { data }
    }

    pub fn as_slice(&self) -> &[u8] {
        &self.data
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_stub_bindings_contains_key_bindings() {
        let stubs = create_stub_bindings_script();
        assert!(stubs.contains("__velox_readFile"));
        assert!(stubs.contains("__velox_createNode"));
        assert!(stubs.contains("__velox_db_open"));
        assert!(stubs.contains("stub = function()"));
    }
}
