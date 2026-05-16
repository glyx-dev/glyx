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
globalThis.__velox_readFile      = function() { return stubPromise(''); };
globalThis.__velox_readFileBytes = function() { return stubPromise(''); };
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

// Network / WebSocket bindings
globalThis.__velox_fetch = function() { return stubPromise('{"status":0,"ok":false,"body":"","headers":{}}'); };
globalThis.__velox_ws_connect = function() { return stubPromise('0'); };
globalThis.__velox_ws_send = function() {};
globalThis.__velox_ws_poll = function() { return '[]'; };
globalThis.__velox_ws_close = function() {};

// mDNS binding
globalThis.__velox_mdns_discover = function() { return stubPromise('[]'); };

// Performance monitoring bindings
globalThis.__velox_perf_snapshot = function() { return '{"fps":0,"frameTime":0,"frameTimeP99":0,"jsTime":0,"layoutTime":0,"gpuTime":0,"memoryJS":0,"memoryTotal":0,"nodeCount":0}'; };
globalThis.__velox_perf_set_budget = function() {};
globalThis.__velox_perf_poll_violations = function() { return '[]'; };
globalThis.__velox_perf_poll_leak_warnings = function() { return '[]'; };

// Multi-window + IPC bindings
let __velox_nextWindowId = 1;
globalThis.__velox_window_create = function() { return stubPromise(String(__velox_nextWindowId++)); };
globalThis.__velox_ipc_send = function() {};
globalThis.__velox_ipc_poll = function() { return '[]'; };
globalThis.__velox_quit = function() {};

// Deep link bindings
globalThis.__velox_deeplink_getInitialUrl = function() { return ''; };
globalThis.__velox_deeplink_poll          = function() { return '[]'; };

// OS system API bindings
globalThis.__velox_battery_getStatus      = function() { return stubPromise('null'); };
globalThis.__velox_system_getInfo         = function() { return stubPromise('{}'); };
globalThis.__velox_system_getDarkMode     = function() { return 'unknown'; };
globalThis.__velox_system_getBatterySaver = function() { return false; };
globalThis.__velox_power_preventSleep     = function() { return '0'; };
globalThis.__velox_power_allowSleep    = function() {};
globalThis.__velox_storage_getDrives   = function() { return stubPromise('[]'); };
globalThis.__velox_gamepad_poll        = function() { return '[]'; };
globalThis.__velox_shortcut_register   = function() { return '0'; };
globalThis.__velox_shortcut_unregister = function() {};
globalThis.__velox_shortcut_poll       = function() { return '[]'; };
globalThis.__velox_credentials_set    = function() { return stubPromise('null'); };
globalThis.__velox_credentials_get    = function() { return stubPromise('null'); };
globalThis.__velox_credentials_delete = function() { return stubPromise('null'); };

// Audio playback bindings
let __velox_nextAudioId = 1;
globalThis.__velox_audio_play      = function() { return stubPromise(String(__velox_nextAudioId++)); };
globalThis.__velox_audio_pause     = function() {};
globalThis.__velox_audio_resume    = function() {};
globalThis.__velox_audio_stop      = function() {};
globalThis.__velox_audio_setVolume = function() {};
globalThis.__velox_audio_getVolume = function() { return 1.0; };
globalThis.__velox_audio_poll      = function() { return '[]'; };

// Canvas 2D / 3D bindings
globalThis.__velox_canvas_update      = function() {};
globalThis.__velox_canvas3d_update    = function() {};
globalThis.__velox_canvas3d_load_gltf = function() {};
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
