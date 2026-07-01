/// V8 Snapshot creation and restoration utilities.
///
/// This module handles the critical stub binding pattern:
/// - During snapshot creation: register JS stubs for all __glyx_* bindings
/// - Snapshot the V8 heap to a binary blob
/// - At runtime: restore from blob and re-register real Rust implementations

/// Create the JavaScript stub bindings code.
/// These stubs are registered during snapshot creation and will be overridden
/// at runtime by real Rust implementations.
pub fn create_stub_bindings_script() -> &'static str {
    r#"
// V8 Snapshot stub bindings
// Real implementations are registered at runtime via re_register_all()

let __glyx_nextNodeId = 1;
let __glyx_nextImageId = 1;
let __glyx_nextDbHandle = 1;
let __glyx_nextVectorHandle = 1;

const stub = function() {};
const stubPromise = function(value) { return Promise.resolve(value); };

// Time binding (polyfill will provide Date.now())
globalThis.__glyx_getTime = function() { return Date.now(); };
globalThis.__glyx_request_frame = function() {};
globalThis.__glyx_log = function() {};

// console — routes to __glyx_log so app code can use console.log() normally.
// The real __glyx_log implementation also forwards to the CDP inspector when connected.
(function() {
  function _fmt(args) {
    return Array.prototype.map.call(args, function(x) {
      return typeof x === 'object' ? JSON.stringify(x) : String(x);
    }).join(' ');
  }
  globalThis.console = {
    log:   function() { __glyx_log(_fmt(arguments)); },
    info:  function() { __glyx_log(_fmt(arguments)); },
    warn:  function() { __glyx_log('[warn] ' + _fmt(arguments)); },
    error: function() { __glyx_log('[error] ' + _fmt(arguments)); },
    debug: function() { __glyx_log('[debug] ' + _fmt(arguments)); },
  };
})();

// File system bindings
globalThis.__glyx_readFile      = function() { return stubPromise(''); };
globalThis.__glyx_readFileBytes = function() { return stubPromise(''); };
globalThis.__glyx_writeFile = function() { return stubPromise(undefined); };
globalThis.__glyx_appendFile = function() { return stubPromise(undefined); };
globalThis.__glyx_listDir = function() { return stubPromise('[]'); };
globalThis.__glyx_deleteFile = function() { return stubPromise(undefined); };
globalThis.__glyx_mkdirp = function() { return stubPromise(undefined); };

// Scene graph bindings
globalThis.__glyx_createNode = function() { return __glyx_nextNodeId++; };
globalThis.__glyx_appendChild = function() {};
globalThis.__glyx_updateNode = function() {};
globalThis.__glyx_removeNode = function() {};
globalThis.__glyx_setRoot = function() {};
globalThis.__glyx_pollEvents = function() { return []; };
globalThis.__glyx_getLayout = function() { return null; };
globalThis.__glyx_measure_text = function() { return { width: 0, height: 0 }; };

// Image binding
globalThis.__glyx_createImage = function() { return __glyx_nextImageId++; };

// Database bindings
globalThis.__glyx_db_open = function() { return stubPromise(String(__glyx_nextDbHandle++)); };
globalThis.__glyx_db_query = function() { return stubPromise('[]'); };
globalThis.__glyx_db_run = function() { return stubPromise('{\"rowsAffected\":0,\"lastInsertId\":0}'); };
globalThis.__glyx_db_close = function() { return stubPromise(undefined); };
globalThis.__glyx_db_transaction = function() { return stubPromise(undefined); };

// Vector database bindings
globalThis.__glyx_vectorDb_open = function() { return stubPromise(String(__glyx_nextVectorHandle++)); };
globalThis.__glyx_vectorDb_upsert = function() { return stubPromise(undefined); };
globalThis.__glyx_vectorDb_search = function() { return stubPromise('[]'); };
globalThis.__glyx_vectorDb_close = function() { return stubPromise(undefined); };

// Window bindings
globalThis.__glyx_getWindowSize = function() { return { width: 1280, height: 800 }; };
globalThis.__glyx_getScreenSize = function() { return { width: 1920, height: 1080 }; };
globalThis.__glyx_setFullscreen = function() {};
globalThis.__glyx_setMaximized = function() {};
globalThis.__glyx_setMinimized = function() {};
globalThis.__glyx_isFullscreen = function() { return false; };
globalThis.__glyx_isMaximized = function() { return false; };
globalThis.__glyx_setAlwaysOnTop = function() {};
globalThis.__glyx_setTitle = function() {};

// Dialog bindings
globalThis.__glyx_dialog_openFile = function() { return stubPromise('null'); };
globalThis.__glyx_dialog_saveFile = function() { return stubPromise('null'); };
globalThis.__glyx_dialog_openFolder = function() { return stubPromise('null'); };

// Clipboard bindings
globalThis.__glyx_clipboard_readText = function() { return stubPromise(''); };
globalThis.__glyx_clipboard_writeText = function() { return stubPromise(undefined); };

// Notification binding
globalThis.__glyx_notification_send = function() { return stubPromise(undefined); };

// Environment binding
globalThis.__glyx_getEnv = function() { return null; };

// Network / WebSocket bindings
globalThis.__glyx_fetch = function() { return stubPromise('{"status":0,"ok":false,"body":"","headers":{}}'); };
globalThis.__glyx_ws_connect = function() { return stubPromise('0'); };
globalThis.__glyx_ws_send = function() {};
globalThis.__glyx_ws_poll = function() { return '[]'; };
globalThis.__glyx_ws_close = function() {};

// mDNS binding
globalThis.__glyx_mdns_discover = function() { return stubPromise('[]'); };

// Performance monitoring bindings
globalThis.__glyx_perf_snapshot = function() { return '{"fps":0,"frameTime":0,"frameTimeP99":0,"jsTime":0,"layoutTime":0,"gpuTime":0,"memoryJS":0,"memoryTotal":0,"nodeCount":0}'; };
globalThis.__glyx_perf_set_budget = function() {};
globalThis.__glyx_perf_poll_violations = function() { return '[]'; };
globalThis.__glyx_perf_poll_leak_warnings = function() { return '[]'; };

// Multi-window + IPC bindings
let __glyx_nextWindowId = 1;
globalThis.__glyx_window_create = function() { return stubPromise(String(__glyx_nextWindowId++)); };
globalThis.__glyx_ipc_send = function() {};
globalThis.__glyx_ipc_poll = function() { return '[]'; };
globalThis.__glyx_quit             = function() {};
globalThis.__glyx_window_close     = function() {};
globalThis.__glyx_restart          = function() {};
globalThis.__glyx_platform         = function() { return ''; };
globalThis.__glyx_collect_memory   = function() {};
globalThis.__glyx_open_external    = function() {};

// Deep link bindings
globalThis.__glyx_deeplink_getInitialUrl = function() { return ''; };
globalThis.__glyx_deeplink_poll          = function() { return '[]'; };

// OS system API bindings
globalThis.__glyx_battery_getStatus      = function() { return stubPromise('null'); };
globalThis.__glyx_system_getInfo         = function() { return stubPromise('{}'); };
globalThis.__glyx_system_getDarkMode     = function() { return 'unknown'; };
globalThis.__glyx_system_getBatterySaver = function() { return false; };
globalThis.__glyx_power_preventSleep     = function() { return '0'; };
globalThis.__glyx_power_allowSleep    = function() {};
globalThis.__glyx_storage_getDrives   = function() { return stubPromise('[]'); };
globalThis.__glyx_gamepad_poll        = function() { return '[]'; };
globalThis.__glyx_shortcut_register   = function() { return '0'; };
globalThis.__glyx_shortcut_unregister = function() {};
globalThis.__glyx_shortcut_poll       = function() { return '[]'; };
globalThis.__glyx_credentials_set    = function() { return stubPromise('null'); };
globalThis.__glyx_credentials_get    = function() { return stubPromise('null'); };
globalThis.__glyx_credentials_delete = function() { return stubPromise('null'); };

// Audio playback bindings
let __glyx_nextAudioId = 1;
globalThis.__glyx_audio_play      = function() { return stubPromise(String(__glyx_nextAudioId++)); };
globalThis.__glyx_audio_pause     = function() {};
globalThis.__glyx_audio_resume    = function() {};
globalThis.__glyx_audio_stop      = function() {};
globalThis.__glyx_audio_setVolume = function() {};
globalThis.__glyx_audio_getVolume = function() { return 1.0; };
globalThis.__glyx_audio_poll      = function() { return '[]'; };
globalThis.__glyx_audio_get_time  = function() { return 0.0; };
globalThis.__glyx_audio_duration  = function() { return stubPromise('-1'); };
globalThis.__glyx_audio_seek      = function() { return stubPromise('null'); };

// Canvas 2D / 3D bindings
globalThis.__glyx_canvas_update      = function() {};
globalThis.__glyx_canvas_flush       = function() {};
globalThis.__glyx_canvas_protocol    = 'json';
globalThis.__glyx_canvas3d_update    = function() {};
globalThis.__glyx_canvas3d_load_gltf = function() {};

// Local AI bindings (Candle — embed, generate, transcribe)
globalThis.__glyx_ai_embed      = function() { return stubPromise('[]'); };
globalThis.__glyx_ai_generate   = function() { return stubPromise(''); };
globalThis.__glyx_ai_transcribe = function() { return stubPromise(''); };

// Camera + Microphone bindings
globalThis.__glyx_camera_list         = function() { return stubPromise('[]'); };
globalThis.__glyx_camera_open         = function() { return stubPromise('0'); };
globalThis.__glyx_camera_close        = function() {};
globalThis.__glyx_camera_capture      = function() { return stubPromise(''); };
globalThis.__glyx_camera_record_start = function() {};
globalThis.__glyx_camera_record_stop  = function() { return stubPromise(''); };
globalThis.__glyx_microphone_list     = function() { return stubPromise('[]'); };
globalThis.__glyx_microphone_record   = function() { return stubPromise(''); };
globalThis.__glyx_hid_enumerate       = function() { return stubPromise('[]'); };
globalThis.__glyx_hid_open            = function() { return stubPromise('0'); };
globalThis.__glyx_hid_read            = function() { return stubPromise('[]'); };
globalThis.__glyx_hid_write           = function() { return stubPromise('0'); };
globalThis.__glyx_hid_close           = function() {};
globalThis.__glyx_updater_check       = function() { return stubPromise('{"hasUpdate":false,"latestVersion":"","body":""}'); };
globalThis.__glyx_updater_update      = function() { return stubPromise('{"updated":false,"latestVersion":""}'); };
globalThis.__glyx_video_open          = function() { return stubPromise('0'); };
globalThis.__glyx_video_seek          = function() {};
globalThis.__glyx_video_set_volume    = function() {};
globalThis.__glyx_video_pause         = function() {};
globalThis.__glyx_video_play          = function() {};
globalThis.__glyx_video_close         = function() {};
globalThis.__glyx_video_poll          = function() { return '[]'; };

// Crash reporter bindings
globalThis.__glyx_crash_report_js    = function() {};
globalThis.__glyx_crash_get_reports  = function() { return stubPromise('[]'); };
globalThis.__glyx_crash_clear_reports = function() {};

// Splash screen binding
globalThis.__glyx_splash_hide = function() {};

// Backend command dispatch
globalThis.__glyx_backend_call = function() { return stubPromise('null'); };
"#
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
        assert!(stubs.contains("__glyx_readFile"));
        assert!(stubs.contains("__glyx_createNode"));
        assert!(stubs.contains("__glyx_db_open"));
        assert!(stubs.contains("stub = function()"));
    }
}
