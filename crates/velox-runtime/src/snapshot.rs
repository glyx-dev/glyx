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

let __velox_nextNodeId = 1;
let __velox_nextImageId = 1;
let __velox_nextDbHandle = 1;
let __velox_nextVectorHandle = 1;

const stub = function() {};
const stubPromise = function(value) { return Promise.resolve(value); };

// Time binding (polyfill will provide Date.now())
globalThis.__velox_getTime = function() { return Date.now(); };
globalThis.__velox_log = function() {};

// File system bindings
globalThis.__velox_readFile = function() { return stubPromise(''); };
globalThis.__velox_writeFile = function() { return stubPromise(undefined); };
globalThis.__velox_appendFile = function() { return stubPromise(undefined); };
globalThis.__velox_listDir = function() { return stubPromise('[]'); };
globalThis.__velox_deleteFile = function() { return stubPromise(undefined); };
globalThis.__velox_mkdirp = function() { return stubPromise(undefined); };

// Scene graph bindings
globalThis.__velox_createNode = function() { return __velox_nextNodeId++; };
globalThis.__velox_appendChild = function() {};
globalThis.__velox_updateNode = function() {};
globalThis.__velox_removeNode = function() {};
globalThis.__velox_setRoot = function() {};
globalThis.__velox_pollEvents = function() { return []; };
globalThis.__velox_getLayout = function() { return null; };

// Image binding
globalThis.__velox_createImage = function() { return __velox_nextImageId++; };

// Database bindings
globalThis.__velox_db_open = function() { return stubPromise(String(__velox_nextDbHandle++)); };
globalThis.__velox_db_query = function() { return stubPromise('[]'); };
globalThis.__velox_db_run = function() { return stubPromise('{\"rowsAffected\":0,\"lastInsertId\":0}'); };
globalThis.__velox_db_close = function() { return stubPromise(undefined); };
globalThis.__velox_db_transaction = function() { return stubPromise(undefined); };

// Vector database bindings
globalThis.__velox_vectorDb_open = function() { return stubPromise(String(__velox_nextVectorHandle++)); };
globalThis.__velox_vectorDb_upsert = function() { return stubPromise(undefined); };
globalThis.__velox_vectorDb_search = function() { return stubPromise('[]'); };
globalThis.__velox_vectorDb_close = function() { return stubPromise(undefined); };

// Window bindings
globalThis.__velox_getWindowSize = function() { return { width: 1280, height: 800 }; };
globalThis.__velox_getScreenSize = function() { return { width: 1920, height: 1080 }; };
globalThis.__velox_setFullscreen = function() {};
globalThis.__velox_setMaximized = function() {};
globalThis.__velox_setMinimized = function() {};
globalThis.__velox_isFullscreen = function() { return false; };
globalThis.__velox_isMaximized = function() { return false; };
globalThis.__velox_setAlwaysOnTop = function() {};
globalThis.__velox_setTitle = function() {};

// Dialog bindings
globalThis.__velox_dialog_openFile = function() { return stubPromise('null'); };
globalThis.__velox_dialog_saveFile = function() { return stubPromise('null'); };
globalThis.__velox_dialog_openFolder = function() { return stubPromise('null'); };

// Clipboard bindings
globalThis.__velox_clipboard_readText = function() { return stubPromise(''); };
globalThis.__velox_clipboard_writeText = function() { return stubPromise(undefined); };

// Notification binding
globalThis.__velox_notification_send = function() { return stubPromise(undefined); };

// Environment binding
globalThis.__velox_getEnv = function() { return null; };
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
