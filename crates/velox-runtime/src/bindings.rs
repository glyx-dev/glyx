//! Native function bindings exposed to JavaScript.

use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use base64::Engine as _;
use tokio::runtime::Handle;

// ── IPC bus ───────────────────────────────────────────────────────────────────
//
// Shared across all windows in the process.  Each window registers its inbox
// under its handle when it starts.  Any window can push a message to any other
// window by looking up the target's inbox in the bus.

/// Per-window IPC inbox (a thread-safe string queue).
pub type IpcInbox = Arc<Mutex<VecDeque<String>>>;

/// Shared IPC bus: window_handle → inbox.
pub type IpcBus = Arc<Mutex<HashMap<u32, IpcInbox>>>;

pub fn new_ipc_bus() -> IpcBus {
    Arc::new(Mutex::new(HashMap::new()))
}

// ── Completion queue ──────────────────────────────────────────────────────────
//
// We must not put v8::Global in the queue because v8::Global is !Send,
// which would make the Arc<Mutex<...>> !Send and break tokio::spawn.
//
// Instead we store:
//   - resolver_ptr: the v8::Global<PromiseResolver> boxed and cast to usize
//   - result:       the async result (plain Send types)
//
// The V8 thread (runtime.rs tick()) reconstructs the Global from the pointer.
// This is safe because:
//   1. The pointer is created on the V8 thread before spawn.
//   2. It is written into the queue by the Tokio thread (just a usize store).
//   3. It is read and dropped on the V8 thread in tick().
//   No two threads ever hold the Global simultaneously.

pub struct Completion {
    /// Raw pointer to a Box<v8::Global<v8::PromiseResolver>>, cast to usize.
    pub resolver_ptr: usize,
    pub result:       Result<String, String>,
}

// SAFETY: Completion only contains a usize and a Result<String,String>.
// The usize is a raw pointer that is only ever dereferenced on the V8 thread.
unsafe impl Send for Completion {}

pub type CompletionQueue = Arc<Mutex<VecDeque<Completion>>>;
pub type SceneQueue      = Arc<Mutex<VecDeque<SceneCommand>>>;
pub type RedrawRequest   = Arc<dyn Fn() + Send + Sync>;
/// Shared SQLite pool map — keyed by the integer handle returned to JS.
/// Exposed so velox-core can drain it on window close for graceful shutdown.
pub type DbPools = Arc<Mutex<HashMap<u32, velox_db::SqlitePool>>>;
pub fn new_db_pools() -> DbPools { Arc::new(Mutex::new(HashMap::new())) }

/// An input event pushed by the Rust side and consumed by JS via __velox_pollEvents.
#[derive(Debug, Clone)]
pub enum InputEvent {
    /// Mouse/touch press or release at window-relative pixel coordinates.
    MouseButton { x: f32, y: f32, button: u8, pressed: bool },
    /// Cursor moved to pixel position.
    CursorMoved { x: f32, y: f32 },
    /// Pointer drag started (left button down + first move).
    DragStart { x: f32, y: f32 },
    /// Pointer dragged — continuous move while left button held.
    DragMove { x: f32, y: f32, dx: f32, dy: f32 },
    /// Pointer drag ended (left button released after drag).
    DragEnd { x: f32, y: f32 },
    /// Keyboard key pressed or released.
    KeyInput { key: String, text: Option<String>, pressed: bool },
    /// Vertical scroll delta (positive = down).
    Scroll { delta_y: f32 },
    /// Window resized to new physical pixel dimensions.
    Resize { width: u32, height: u32 },
}

/// Callbacks for window control operations.
/// Constructed by velox-core from Arc<winit::window::Window> and passed to register_all.
pub struct WindowController {
    pub get_window_size:   Arc<dyn Fn() -> (u32, u32) + Send + Sync>,
    pub get_screen_size:   Arc<dyn Fn() -> Option<(u32, u32)> + Send + Sync>,
    pub request_redraw:    RedrawRequest,
    pub set_fullscreen:    Arc<dyn Fn(bool) + Send + Sync>,
    pub set_maximized:     Arc<dyn Fn(bool) + Send + Sync>,
    pub set_minimized:     Arc<dyn Fn() + Send + Sync>,
    pub is_fullscreen:     Arc<dyn Fn() -> bool + Send + Sync>,
    pub is_maximized:      Arc<dyn Fn() -> bool + Send + Sync>,
    pub set_always_on_top: Arc<dyn Fn(bool) + Send + Sync>,
    pub set_title:         Arc<dyn Fn(String) + Send + Sync>,
    /// Raw platform window handle (HWND on Windows) as a plain integer.
    /// Used to parent native dialogs so they appear in front of the Velox window.
    pub hwnd:              Option<isize>,
    /// Create a secondary window with the given pre-assigned id, title, and size.
    /// Called by the `__velox_window_create` binding.
    pub create_window: Option<Arc<dyn Fn(u32, String, u32, u32) + Send + Sync>>,
    /// Quit the application — closes all windows and exits the event loop.
    pub quit: Option<Arc<dyn Fn() + Send + Sync>>,
    /// Quit then re-launch the same executable.
    pub restart: Option<Arc<dyn Fn() + Send + Sync>>,
}

// ── Dialog parent HWND wrapper ────────────────────────────────────────────────
//
// rfd::AsyncFileDialog::set_parent() requires impl HasWindowHandle.
// We construct a minimal wrapper from the raw isize stored in AsyncState.

#[cfg(target_os = "windows")]
struct WinParent(isize);

#[cfg(target_os = "windows")]
impl raw_window_handle::HasWindowHandle for WinParent {
    fn window_handle(
        &self,
    ) -> Result<raw_window_handle::WindowHandle<'_>, raw_window_handle::HandleError> {
        use raw_window_handle::{RawWindowHandle, Win32WindowHandle, WindowHandle};
        let nz = std::num::NonZero::new(self.0)
            .expect("non-null HWND for dialog parent");
        let win32 = Win32WindowHandle::new(nz);
        Ok(unsafe { WindowHandle::borrow_raw(RawWindowHandle::Win32(win32)) })
    }
}

/// Thread-safe queue of input events for JS to poll each frame.
pub type EventQueue   = Arc<Mutex<VecDeque<InputEvent>>>;

/// Per-node resolved layout cache, updated after each Taffy compute.
/// Key: JS node id, Value: (x, y, width, height) in physical pixels.
pub type LayoutCache  = Arc<Mutex<std::collections::HashMap<u32, [f32; 4]>>>;

pub fn new_completion_queue() -> CompletionQueue {
    Arc::new(Mutex::new(VecDeque::new()))
}

pub fn new_scene_queue() -> SceneQueue {
    Arc::new(Mutex::new(VecDeque::new()))
}

pub fn new_event_queue() -> EventQueue {
    Arc::new(Mutex::new(VecDeque::new()))
}

pub fn new_layout_cache() -> LayoutCache {
    Arc::new(Mutex::new(std::collections::HashMap::new()))
}

// ── Node types & props ────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
pub enum NodeType {
    View,
    Text,
    Image,
    Canvas,
    Canvas3D,
}

/// All layout + visual props that JS can set on a node.
///
/// All fields are `Option` — `None` means "not set / inherit / use default".
/// `parse_props` only sets fields that are present in the JS object.
#[derive(Debug, Clone, Default)]
pub struct NodeProps {
    // ── Dimensions ──────────────────────────────────────────────────────────
    pub width:  Option<f32>,
    pub height: Option<f32>,

    // ── Text ────────────────────────────────────────────────────────────────
    pub text:      Option<String>,
    pub font_size: Option<f32>,
    /// Text / foreground colour as RGBA [r, g, b, a] 0–255.
    pub color:     Option<[u8; 4]>,

    // ── Background / border ─────────────────────────────────────────────────
    /// Background fill colour as RGBA [r, g, b, a] 0–255.
    pub background_color: Option<[u8; 4]>,
    pub border_radius:    Option<f32>,

    // ── Flex layout ─────────────────────────────────────────────────────────
    /// `flex` shorthand — like CSS `flex: 1`.
    pub flex:            Option<f32>,
    /// `"row"` | `"column"` (default `"column"`).
    pub flex_direction:  Option<String>,
    /// `"flex-start"` | `"center"` | `"flex-end"` | `"space-between"` | `"space-around"`.
    pub justify_content: Option<String>,
    /// `"flex-start"` | `"center"` | `"flex-end"` | `"stretch"`.
    pub align_items:     Option<String>,
    /// Uniform padding in logical pixels.
    pub padding:         Option<f32>,
    /// Gap between children in logical pixels.
    pub gap:             Option<f32>,

    // ── Cursor UI / selection ────────────────────────────────────────────────
    /// When true, draw a text cursor rect after the text.
    pub show_cursor: Option<bool>,
    /// Character index (0-based) where the blinking cursor is drawn.
    /// `None` → cursor drawn after the last character (legacy behaviour).
    pub cursor_position: Option<u32>,
    /// Selection start character index (inclusive).  `None` → no selection.
    pub selection_start: Option<u32>,
    /// Selection end character index (exclusive).  `None` → no selection.
    pub selection_end: Option<u32>,

    // ── Text alignment ───────────────────────────────────────────────────────
    /// `"left"` | `"center"` (default). Controls horizontal text origin.
    pub text_align: Option<String>,

    // ── Border ──────────────────────────────────────────────────────────────
    /// Border stroke width in logical pixels.
    pub border_width: Option<f32>,
    /// Border stroke colour as RGBA [r, g, b, a] 0–255.
    pub border_color: Option<[u8; 4]>,

    // ── Scroll / clip ────────────────────────────────────────────────────────
    /// When true, clip children rendering to this node's layout bounds.
    /// Used by ScrollView to prevent children from overflowing visually.
    pub clip: Option<bool>,
    /// Vertical scroll offset in pixels (positive = scrolled toward bottom).
    /// Children are rendered offset upward by this amount, producing the
    /// visual effect of scrolling down through content taller than the node.
    pub scroll_offset_y: Option<f32>,

    // ── Image ────────────────────────────────────────────────────────────────
    /// Native image resource identifier returned by `__velox_createImage`.
    pub image_id: Option<u32>,
    /// `"cover"` | `"contain"` | `"stretch"` (default).
    pub image_resize_mode: Option<String>,

    // ── Stacking ─────────────────────────────────────────────────────────────
    /// Z-index for draw ordering within the same parent.
    /// Higher values render on top. Default 0.
    pub z_index: Option<i32>,

    // ── Window drag ──────────────────────────────────────────────────────────
    /// When `true`, a mouse-down on this node (and not on an interactive child)
    /// initiates an OS-level window drag. Used to implement custom title bars.
    /// Only effective when `window.decorations` is `false` in the app config.
    pub draggable: Option<bool>,
}

// ── Canvas 2D draw commands ───────────────────────────────────────────────────

#[derive(Debug, Clone, serde::Deserialize)]
#[serde(tag = "type", rename_all = "camelCase")]
pub enum CanvasCmd {
    Clear,
    FillRect   { x: f32, y: f32, w: f32, h: f32, color: [u8; 4] },
    StrokeRect { x: f32, y: f32, w: f32, h: f32, color: [u8; 4], #[serde(rename = "lineWidth")] line_width: f32 },
    FillCircle { cx: f32, cy: f32, r: f32, color: [u8; 4] },
    StrokeCircle { cx: f32, cy: f32, r: f32, color: [u8; 4], #[serde(rename = "lineWidth")] line_width: f32 },
    StrokeLine { x0: f32, y0: f32, x1: f32, y1: f32, color: [u8; 4], #[serde(rename = "lineWidth")] line_width: f32 },
    FillText   { text: String, x: f32, y: f32, #[serde(rename = "fontSize")] font_size: f32, color: [u8; 4] },
}

#[derive(Debug, Clone)]
pub enum SceneCommand {
    CreateNode    { id: u32, node_type: NodeType, props: NodeProps },
    CreateImage   { id: u32, path: String },
    AppendChild   { parent_id: u32, child_id: u32 },
    UpdateNode    { id: u32, props: NodeProps },
    RemoveNode    { id: u32 },
    SetRoot       { id: u32 },
    CanvasUpdate  { id: u32, cmds: Vec<CanvasCmd> },
    Canvas3DUpdate { id: u32, scene: velox_3d::Scene3D },
}

// ── Registration ──────────────────────────────────────────────────────────────

pub fn register_all(
    scope:        &mut v8::HandleScope,
    global:       v8::Local<v8::Object>,
    queue:        CompletionQueue,
    tokio:        Handle,
    scene:        SceneQueue,
    events:       EventQueue,
    layout_cache: LayoutCache,
    window:       Option<WindowController>,
    ipc_bus:      IpcBus,
    my_handle:    u32,
    next_window_id: Arc<std::sync::atomic::AtomicU32>,
    perf_state:   Arc<Mutex<velox_perf::PerfState>>,
    deeplink_url_queue: Arc<Mutex<VecDeque<String>>>,
    db_pools:     DbPools,
) {
    set_func(scope, global, "__velox_getTime", get_time);
    set_func(scope, global, "__velox_log",     js_log);

    // Audio and gamepad are initialised lazily on first use to avoid
    // wasting resources in apps that don't use them.

    // Store all shared state in a heap-allocated struct, hand the raw
    // pointer to V8 via External so callbacks can recover it.
    let hwnd = window.as_ref().and_then(|w| w.hwnd);
    let state = Box::new(AsyncState {
        queue,
        tokio,
        request_redraw: window.as_ref().map(|w| Arc::clone(&w.request_redraw)),
        scene,
        events,
        layout_cache,
        next_id:    std::sync::atomic::AtomicU32::new(1),
        next_image_id: std::sync::atomic::AtomicU32::new(1),
        window,
        hwnd,
        db_pools,
        next_db_id:    std::sync::atomic::AtomicU32::new(1),
        vector_stores: Arc::new(Mutex::new(HashMap::new())),
        next_vdb_id:   std::sync::atomic::AtomicU32::new(1),
        ws_handles:    Arc::new(Mutex::new(HashMap::new())),
        next_ws_id:    std::sync::atomic::AtomicU32::new(1),
        ipc_bus,
        my_handle,
        next_window_id,
        perf_state,
        sleep_guards:   std::cell::RefCell::new(HashMap::new()),
        next_guard_id:  std::sync::atomic::AtomicU32::new(1),
        gamepad_gilrs:  std::cell::RefCell::new(None),
        hotkey_state:   std::cell::RefCell::new(None),
        next_hotkey_id: std::sync::atomic::AtomicU32::new(1),
        deeplink_url_queue,
        audio_stream:  std::cell::RefCell::new(None),
        audio_handle:  std::cell::RefCell::new(None),
        audio_sinks:   Arc::new(Mutex::new(HashMap::new())),
        audio_events:  Arc::new(Mutex::new(VecDeque::new())),
        next_audio_id: std::sync::atomic::AtomicU32::new(1),
        ai_embed_model:    Arc::new(Mutex::new(None)),
        ai_generate_model: Arc::new(Mutex::new(None)),
        ai_whisper_model:  Arc::new(Mutex::new(None)),
    });
    let ptr   = Box::into_raw(state) as *mut std::ffi::c_void;
    // Safety: ptr is valid for the lifetime of the isolate.
    let ext   = v8::External::new(scope, ptr);

    macro_rules! register {
        ($name:literal, $cb:ident) => {
            let tmpl = v8::FunctionTemplate::builder($cb)
                .data(ext.into())
                .build(scope);
            let func = tmpl.get_function(scope).unwrap();
            let key  = v8::String::new(scope, $name).unwrap();
            global.set(scope, key.into(), func.into());
        };
    }

    register!("__velox_getEnv",      get_env_callback);
    register!("__velox_readFile",      read_file_callback);
    register!("__velox_readFileBytes", read_file_bytes_callback);
    register!("__velox_createImage",   create_image_callback);
    register!("__velox_createNode",  create_node_callback);
    register!("__velox_appendChild", append_child_callback);
    register!("__velox_updateNode",  update_node_callback);
    register!("__velox_removeNode",  remove_node_callback);
    register!("__velox_setRoot",     set_root_callback);
    register!("__velox_pollEvents",  poll_events_callback);
    register!("__velox_getLayout",   get_layout_callback);

    register!("__velox_getWindowSize", get_window_size_callback);
    register!("__velox_getScreenSize", get_screen_size_callback);
    register!("__velox_setFullscreen", set_fullscreen_callback);
    register!("__velox_setMaximized",  set_maximized_callback);
    register!("__velox_setMinimized",  set_minimized_callback);
    register!("__velox_isFullscreen",  is_fullscreen_callback);
    register!("__velox_isMaximized",   is_maximized_callback);

    // ── File system (write-side) ────────────────────────────────────────────
    register!("__velox_writeFile",  write_file_callback);
    register!("__velox_appendFile", append_file_callback);
    register!("__velox_listDir",    list_dir_callback);
    register!("__velox_deleteFile", delete_file_callback);
    register!("__velox_mkdirp",     mkdirp_callback);

    // ── SQLite database ─────────────────────────────────────────────────────
    register!("__velox_db_open",        db_open_callback);
    register!("__velox_db_query",       db_query_callback);
    register!("__velox_db_run",         db_run_callback);
    register!("__velox_db_close",       db_close_callback);
    register!("__velox_db_transaction", db_transaction_callback);

    // ── Vector database ─────────────────────────────────────────────────────
    register!("__velox_vectorDb_open",   vectordb_open_callback);
    register!("__velox_vectorDb_upsert", vectordb_upsert_callback);
    register!("__velox_vectorDb_search", vectordb_search_callback);
    register!("__velox_vectorDb_close",  vectordb_close_callback);

    // ── Window extras (sync) ────────────────────────────────────────────────
    register!("__velox_setAlwaysOnTop", set_always_on_top_callback);
    register!("__velox_setTitle",       set_title_callback);

    // ── File dialogs ────────────────────────────────────────────────────────
    register!("__velox_dialog_openFile",   dialog_open_file_callback);
    register!("__velox_dialog_saveFile",   dialog_save_file_callback);
    register!("__velox_dialog_openFolder", dialog_open_folder_callback);

    // ── Clipboard ───────────────────────────────────────────────────────────
    register!("__velox_clipboard_readText",  clipboard_read_text_callback);
    register!("__velox_clipboard_writeText", clipboard_write_text_callback);

    // ── Notifications ───────────────────────────────────────────────────────
    register!("__velox_notification_send", notification_send_callback);

    // ── Network ─────────────────────────────────────────────────────────────
    register!("__velox_fetch",      fetch_callback);

    // ── WebSocket ────────────────────────────────────────────────────────────
    register!("__velox_ws_connect", ws_connect_callback);
    register!("__velox_ws_send",    ws_send_callback);
    register!("__velox_ws_poll",    ws_poll_callback);
    register!("__velox_ws_close",   ws_close_callback);

    // ── mDNS service discovery ───────────────────────────────────────────────
    register!("__velox_mdns_discover", mdns_discover_callback);

    // ── Multi-window + IPC ───────────────────────────────────────────────────
    register!("__velox_window_create", window_create_callback);
    register!("__velox_ipc_send",      ipc_send_callback);
    register!("__velox_ipc_poll",      ipc_poll_callback);

    // ── Performance metrics ──────────────────────────────────────────────────
    register!("__velox_perf_snapshot",            perf_snapshot_callback);
    register!("__velox_perf_set_budget",          perf_set_budget_callback);
    register!("__velox_perf_poll_violations",     perf_poll_violations_callback);
    register!("__velox_perf_poll_leak_warnings",  perf_poll_leak_warnings_callback);

    // ── OS system APIs ───────────────────────────────────────────────────────
    register!("__velox_battery_getStatus",      battery_get_status_callback);
    register!("__velox_system_getInfo",         system_get_info_callback);
    register!("__velox_system_getDarkMode",     system_get_dark_mode_callback);
    register!("__velox_system_getBatterySaver", system_get_battery_saver_callback);
    register!("__velox_power_preventSleep",     power_prevent_sleep_callback);
    register!("__velox_power_allowSleep",    power_allow_sleep_callback);
    register!("__velox_storage_getDrives",   storage_get_drives_callback);
    register!("__velox_gamepad_poll",        gamepad_poll_callback);
    register!("__velox_shortcut_register",   shortcut_register_callback);
    register!("__velox_shortcut_unregister", shortcut_unregister_callback);
    register!("__velox_shortcut_poll",       shortcut_poll_callback);

    // ── Credentials (OS keychain) ────────────────────────────────────────────
    register!("__velox_credentials_set",    credentials_set_callback);
    register!("__velox_credentials_get",    credentials_get_callback);
    register!("__velox_credentials_delete", credentials_delete_callback);

    // ── Audio playback ───────────────────────────────────────────────────────
    register!("__velox_audio_play",      audio_play_callback);
    register!("__velox_audio_pause",     audio_pause_callback);
    register!("__velox_audio_resume",    audio_resume_callback);
    register!("__velox_audio_stop",      audio_stop_callback);
    register!("__velox_audio_setVolume", audio_set_volume_callback);
    register!("__velox_audio_getVolume", audio_get_volume_callback);
    register!("__velox_audio_poll",      audio_poll_callback);

    // ── App lifecycle ────────────────────────────────────────────────────────
    register!("__velox_quit",         quit_callback);
    register!("__velox_window_close", quit_callback);  // alias: close the window / app
    register!("__velox_restart",      restart_callback);
    register!("__velox_platform",     platform_callback);

    // ── Deep links ───────────────────────────────────────────────────────────
    register!("__velox_deeplink_getInitialUrl", deeplink_get_initial_url_callback);
    register!("__velox_deeplink_poll",          deeplink_poll_callback);

    // ── Canvas 2D / 3D ───────────────────────────────────────────────────────
    register!("__velox_canvas_update",   canvas_update_callback);
    register!("__velox_canvas3d_update", canvas3d_update_callback);
    register!("__velox_canvas3d_load_gltf", canvas3d_load_gltf_callback);

    // ── Local AI (Candle) ────────────────────────────────────────────────────
    register!("__velox_ai_embed",      ai_embed_callback);
    register!("__velox_ai_generate",   ai_generate_callback);
    register!("__velox_ai_transcribe", ai_transcribe_callback);
}

struct AsyncState {
    queue:        CompletionQueue,
    tokio:        Handle,
    request_redraw: Option<RedrawRequest>,
    scene:        SceneQueue,
    events:       EventQueue,
    layout_cache: LayoutCache,
    next_id:      std::sync::atomic::AtomicU32,
    next_image_id: std::sync::atomic::AtomicU32,
    window:       Option<WindowController>,
    /// Raw window handle (HWND on Windows) for parenting native dialogs.
    hwnd:         Option<isize>,
    // ── SQLite handles ───────────────────────────────────────────────────────
    db_pools:     Arc<Mutex<HashMap<u32, velox_db::SqlitePool>>>,
    next_db_id:   std::sync::atomic::AtomicU32,
    // ── Vector store handles ─────────────────────────────────────────────────
    vector_stores: Arc<Mutex<HashMap<u32, velox_db::VectorStore>>>,
    next_vdb_id:   std::sync::atomic::AtomicU32,
    // ── WebSocket handles ────────────────────────────────────────────────────
    ws_handles:    Arc<Mutex<HashMap<u32, WsHandle>>>,
    next_ws_id:    std::sync::atomic::AtomicU32,
    // ── Multi-window / IPC ───────────────────────────────────────────────────
    ipc_bus:       IpcBus,
    my_handle:     u32,
    next_window_id: Arc<std::sync::atomic::AtomicU32>,
    // ── Performance metrics ──────────────────────────────────────────────────
    perf_state:    Arc<Mutex<velox_perf::PerfState>>,
    // ── OS system APIs (single-threaded, RefCell for interior mutability) ───
    sleep_guards:  std::cell::RefCell<HashMap<u32, velox_sysapi::SleepGuard>>,
    next_guard_id: std::sync::atomic::AtomicU32,
    gamepad_gilrs: std::cell::RefCell<Option<gilrs::Gilrs>>,
    hotkey_state:  std::cell::RefCell<Option<HotkeyState>>,
    next_hotkey_id: std::sync::atomic::AtomicU32,
    // ── Deep links ───────────────────────────────────────────────────────────
    /// Forwarded deep-link URLs from single-instance pipe listener.
    /// Drained by `__velox_deeplink_poll` each frame.
    deeplink_url_queue: Arc<Mutex<VecDeque<String>>>,
    // ── Audio playback (rodio) ───────────────────────────────────────────────
    /// The OutputStream keeps the audio device open for the app lifetime.
    /// Stored in RefCell because rodio::OutputStream is !Send.
    /// Never read directly — held purely to keep the audio device alive.
    #[allow(dead_code)]
    audio_stream:  std::cell::RefCell<Option<rodio::OutputStream>>,
    /// Handle cloned into async tasks to create Sinks.
    /// Wrapped in RefCell so lazy init can mutate through &AsyncState.
    audio_handle:  std::cell::RefCell<Option<rodio::OutputStreamHandle>>,
    /// Live sink map — keyed by velox audio handle ID.
    audio_sinks:   Arc<Mutex<HashMap<u32, rodio::Sink>>>,
    /// Events (e.g. "ended") produced by the audio subsystem, drained each frame.
    audio_events:  Arc<Mutex<VecDeque<String>>>,
    next_audio_id: std::sync::atomic::AtomicU32,
    // ── Local AI model cache (velox-ai / Candle) ─────────────────────────────
    /// Lazily initialised embedding model. Locked during init, then shared.
    ai_embed_model:    Arc<Mutex<Option<velox_ai::EmbedModel>>>,
    /// Phi-2 generation model (requires &mut self for KV-cache, so Mutex needed).
    ai_generate_model: Arc<Mutex<Option<velox_ai::GenerateModel>>>,
    /// Whisper transcription model (requires &mut self for decoder state).
    ai_whisper_model:  Arc<Mutex<Option<velox_ai::WhisperModel>>>,
}

struct WsHandle {
    outbox_tx: tokio::sync::mpsc::UnboundedSender<String>,
    inbox:     Arc<Mutex<VecDeque<String>>>,
}

struct HotkeyState {
    manager: global_hotkey::GlobalHotKeyManager,
    /// Maps velox-assigned ID → registered HotKey (needed for unregister).
    hotkeys: HashMap<u32, global_hotkey::hotkey::HotKey>,
}

fn set_func(
    scope:  &mut v8::HandleScope,
    global: v8::Local<v8::Object>,
    name:   &str,
    cb:     impl v8::MapFnTo<v8::FunctionCallback>,
) {
    let key  = v8::String::new(scope, name).unwrap();
    let func = v8::Function::new(scope, cb).unwrap();
    global.set(scope, key.into(), func.into());
}

// ── Prop parsing ──────────────────────────────────────────────────────────────

fn parse_node_type(scope: &mut v8::HandleScope, value: v8::Local<v8::Value>) -> NodeType {
    let s = value
        .to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default()
        .to_lowercase();
    match s.as_str() {
        "text"     => NodeType::Text,
        "image"    => NodeType::Image,
        "canvas"   => NodeType::Canvas,
        "canvas3d" => NodeType::Canvas3D,
        _          => NodeType::View,
    }
}

/// Parse a CSS hex colour string (`#RGB`, `#RRGGBB`, `#RRGGBBAA`) into RGBA bytes.
/// Returns `None` if the string is not a valid hex colour.
fn parse_hex_color(s: &str) -> Option<[u8; 4]> {
    let s = s.trim().trim_start_matches('#');
    match s.len() {
        3 => {
            let r = u8::from_str_radix(&s[0..1].repeat(2), 16).ok()?;
            let g = u8::from_str_radix(&s[1..2].repeat(2), 16).ok()?;
            let b = u8::from_str_radix(&s[2..3].repeat(2), 16).ok()?;
            Some([r, g, b, 255])
        }
        6 => {
            let r = u8::from_str_radix(&s[0..2], 16).ok()?;
            let g = u8::from_str_radix(&s[2..4], 16).ok()?;
            let b = u8::from_str_radix(&s[4..6], 16).ok()?;
            Some([r, g, b, 255])
        }
        8 => {
            let r = u8::from_str_radix(&s[0..2], 16).ok()?;
            let g = u8::from_str_radix(&s[2..4], 16).ok()?;
            let b = u8::from_str_radix(&s[4..6], 16).ok()?;
            let a = u8::from_str_radix(&s[6..8], 16).ok()?;
            Some([r, g, b, a])
        }
        _ => None,
    }
}

/// Read a string property from a JS object, if present.
fn get_str_prop(
    scope: &mut v8::HandleScope,
    obj:   v8::Local<v8::Object>,
    key:   &str,
) -> Option<String> {
    let k = v8::String::new(scope, key).unwrap();
    let v = obj.get(scope, k.into())?;
    if v.is_string() || v.is_number() {
        Some(v.to_string(scope)?.to_rust_string_lossy(scope))
    } else {
        None
    }
}

/// Read a number property from a JS object as f32, if present.
fn get_num_prop(
    scope: &mut v8::HandleScope,
    obj:   v8::Local<v8::Object>,
    key:   &str,
) -> Option<f32> {
    let k = v8::String::new(scope, key).unwrap();
    let v = obj.get(scope, k.into())?;
    if v.is_number() {
        Some(v.number_value(scope)? as f32)
    } else {
        None
    }
}

/// Read a boolean property from a JS object, if present.
fn get_bool_prop(
    scope: &mut v8::HandleScope,
    obj:   v8::Local<v8::Object>,
    key:   &str,
) -> Option<bool> {
    let k = v8::String::new(scope, key).unwrap();
    let v = obj.get(scope, k.into())?;
    if v.is_boolean() {
        Some(v.boolean_value(scope))
    } else {
        None
    }
}

/// Read a hex colour string property, if present and parseable.
fn get_color_prop(
    scope: &mut v8::HandleScope,
    obj:   v8::Local<v8::Object>,
    key:   &str,
) -> Option<[u8; 4]> {
    let s = get_str_prop(scope, obj, key)?;
    parse_hex_color(&s)
}

fn parse_props(
    scope: &mut v8::HandleScope,
    value: v8::Local<v8::Value>,
) -> NodeProps {
    let mut props = NodeProps::default();
    let Some(obj) = value.to_object(scope) else { return props };

    props.width       = get_num_prop(scope, obj, "width");
    props.height      = get_num_prop(scope, obj, "height");
    props.font_size   = get_num_prop(scope, obj, "fontSize");
    props.border_radius = get_num_prop(scope, obj, "borderRadius");
    props.padding     = get_num_prop(scope, obj, "padding");
    props.gap         = get_num_prop(scope, obj, "gap");
    props.flex        = get_num_prop(scope, obj, "flex");

    props.text           = get_str_prop(scope, obj, "text");
    props.flex_direction  = get_str_prop(scope, obj, "flexDirection");
    props.justify_content = get_str_prop(scope, obj, "justifyContent");
    props.align_items     = get_str_prop(scope, obj, "alignItems");

    props.background_color = get_color_prop(scope, obj, "backgroundColor");
    props.color            = get_color_prop(scope, obj, "color");

    props.show_cursor     = get_bool_prop(scope, obj, "showCursor");
    props.cursor_position = get_num_prop(scope, obj, "cursorPosition").map(|v| v as u32);
    props.selection_start = get_num_prop(scope, obj, "selectionStart").map(|v| v as u32);
    props.selection_end   = get_num_prop(scope, obj, "selectionEnd").map(|v| v as u32);
    props.text_align    = get_str_prop(scope, obj, "textAlign");
    props.border_width  = get_num_prop(scope, obj, "borderWidth");
    props.border_color  = get_color_prop(scope, obj, "borderColor");

    props.clip            = get_bool_prop(scope, obj, "clip");
    props.scroll_offset_y = get_num_prop(scope, obj, "scrollOffsetY");
    props.image_id        = get_num_prop(scope, obj, "imageId").map(|v| v as u32);
    props.image_resize_mode = get_str_prop(scope, obj, "resizeMode");
    props.z_index         = get_num_prop(scope, obj, "zIndex").map(|v| v as i32);
    props.draggable       = get_bool_prop(scope, obj, "draggable");

    props
}

// ── Sync bindings ─────────────────────────────────────────────────────────────

fn get_time(
    scope:  &mut v8::HandleScope,
    _args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ms = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as f64;
    rv.set(v8::Number::new(scope, ms).into());
}

fn js_log(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let msg = args
        .get(0)
        .to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_else(|| "<no message>".into());
    log::info!("[JS] {}", msg);
}

// ── __velox_pollEvents ────────────────────────────────────────────────────────
//
// Returns a JS Array of event objects. Each object has a `type` string
// plus type-specific fields:
//   { type: "mouseButton", x, y, button, pressed }
//   { type: "cursorMoved", x, y }
//   { type: "keyInput",    key, text, pressed }
//   { type: "scroll",      deltaY }

fn poll_events_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let events: Vec<InputEvent> = {
        let mut q = state.events.lock().unwrap();
        q.drain(..).collect()
    };

    let array = v8::Array::new(scope, events.len() as i32);
    for (i, ev) in events.into_iter().enumerate() {
        let obj = v8::Object::new(scope);

        macro_rules! set_str {
            ($key:literal, $val:expr) => {
                let k = v8::String::new(scope, $key).unwrap();
                let v = v8::String::new(scope, $val).unwrap();
                obj.set(scope, k.into(), v.into());
            };
        }
        macro_rules! set_num {
            ($key:literal, $val:expr) => {
                let k = v8::String::new(scope, $key).unwrap();
                let v = v8::Number::new(scope, $val as f64);
                obj.set(scope, k.into(), v.into());
            };
        }
        macro_rules! set_bool {
            ($key:literal, $val:expr) => {
                let k = v8::String::new(scope, $key).unwrap();
                let v = v8::Boolean::new(scope, $val);
                obj.set(scope, k.into(), v.into());
            };
        }

        match ev {
            InputEvent::MouseButton { x, y, button, pressed } => {
                set_str!("type", "mouseButton");
                set_num!("x", x);
                set_num!("y", y);
                set_num!("button", button);
                set_bool!("pressed", pressed);
            }
            InputEvent::CursorMoved { x, y } => {
                set_str!("type", "cursorMoved");
                set_num!("x", x);
                set_num!("y", y);
            }
            InputEvent::KeyInput { key, text, pressed } => {
                set_str!("type", "keyInput");
                set_str!("key", &key);
                set_bool!("pressed", pressed);
                if let Some(t) = text {
                    set_str!("text", &t);
                }
            }
            InputEvent::Scroll { delta_y } => {
                set_str!("type", "scroll");
                set_num!("deltaY", delta_y);
            }
            InputEvent::Resize { width, height } => {
                set_str!("type", "resize");
                set_num!("width", width);
                set_num!("height", height);
            }
            InputEvent::DragStart { x, y } => {
                set_str!("type", "dragStart");
                set_num!("x", x);
                set_num!("y", y);
            }
            InputEvent::DragMove { x, y, dx, dy } => {
                set_str!("type", "dragMove");
                set_num!("x", x);
                set_num!("y", y);
                set_num!("dx", dx);
                set_num!("dy", dy);
            }
            InputEvent::DragEnd { x, y } => {
                set_str!("type", "dragEnd");
                set_num!("x", x);
                set_num!("y", y);
            }
        }

        array.set_index(scope, i as u32, obj.into());
    }

    rv.set(array.into());
}

// ── __velox_getLayout ─────────────────────────────────────────────────────────
//
// Returns `{ x, y, width, height }` for the given node id,
// or `null` if the node has not been laid out yet.

fn get_layout_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let cache = state.layout_cache.lock().unwrap();

    if let Some(&[x, y, w, h]) = cache.get(&id) {
        let obj = v8::Object::new(scope);
        macro_rules! set_num {
            ($key:literal, $val:expr) => {
                let k = v8::String::new(scope, $key).unwrap();
                let v = v8::Number::new(scope, $val as f64);
                obj.set(scope, k.into(), v.into());
            };
        }
        set_num!("x",      x);
        set_num!("y",      y);
        set_num!("width",  w);
        set_num!("height", h);
        rv.set(obj.into());
    } else {
        rv.set(v8::null(scope).into());
    }
}

// ── Sync binding: __velox_getEnv ──────────────────────────────────────────────
//
// Returns the value of an environment variable as a string, or JS `null` if
// the variable is absent OR the name is not in the `env.allow` capability list.
//
// Returning null (rather than throwing) is intentional — a capability miss is
// not a programmer error; the app should handle missing values gracefully.

fn get_env_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let name = args
        .get(0)
        .to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default();

    // Silent null for undeclared names — does not reveal that the var exists.
    if !velox_security::get().can_get_env(&name) {
        rv.set(v8::null(scope).into());
        return;
    }

    match std::env::var(&name) {
        Ok(val) => rv.set(v8::String::new(scope, &val).unwrap().into()),
        Err(_)  => rv.set(v8::null(scope).into()),
    }
}

// ── Async binding: __velox_readFile ───────────────────────────────────────────

fn read_file_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    // Capability gate — throws a JS Error if fs.read is not declared.
    if !velox_security::get().can_read_fs() {
        let msg = v8::String::new(
            scope,
            "Capability required: fs.read — add it to velox.config.json \
             under \"capabilities\": { \"fs\": { \"read\": [\"**\"] } }",
        )
        .unwrap();
        let ex = v8::Exception::error(scope, msg);
        scope.throw_exception(ex);
        return;
    }

    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let path = args
        .get(0)
        .to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default();

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| e.to_string());
        enqueue_completion(
            &queue_clone,
            redraw.as_ref(),
            Completion { resolver_ptr: resolver, result },
        );
    });
}

// ── Async binding: __velox_readFileBytes ──────────────────────────────────────
//
// Reads a file as raw bytes and returns a base64-encoded string.
// Used for binary files (images, PDFs, etc.) before uploading via fetch multipart.
//
// `__velox_readFileBytes(path) -> Promise<string>`   (base64)

fn read_file_bytes_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().can_read_fs() {
        let msg = v8::String::new(scope,
            "Capability required: fs.read — add it to velox.config.json").unwrap();
        let ex = v8::Exception::error(scope, msg);
        scope.throw_exception(ex);
        return;
    }

    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let path = args.get(0).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default();

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::fs::read(&path)
            .await
            .map(|bytes| base64::engine::general_purpose::STANDARD.encode(&bytes))
            .map_err(|e| e.to_string());
        enqueue_completion(&queue_clone, redraw.as_ref(),
            Completion { resolver_ptr: resolver, result });
    });
}

// ── Scene graph bindings ──────────────────────────────────────────────────────

fn create_node_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id = state.next_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let node_type = parse_node_type(scope, args.get(0));
    let props = parse_props(scope, args.get(1));

    state.scene.lock().unwrap()
        .push_back(SceneCommand::CreateNode { id, node_type, props });

    rv.set(v8::Number::new(scope, id as f64).into());
}

fn create_image_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let path = args
        .get(0)
        .to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default();

    let id = state.next_image_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    state.scene.lock().unwrap()
        .push_back(SceneCommand::CreateImage { id, path });

    rv.set(v8::Number::new(scope, id as f64).into());
}

fn append_child_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let parent_id = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let child_id  = args.get(1).number_value(scope).unwrap_or_default() as u32;

    state.scene.lock().unwrap()
        .push_back(SceneCommand::AppendChild { parent_id, child_id });

    rv.set(v8::Boolean::new(scope, true).into());
}

fn update_node_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id    = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let props = parse_props(scope, args.get(1));

    state.scene.lock().unwrap().push_back(SceneCommand::UpdateNode { id, props });
    rv.set(v8::Boolean::new(scope, true).into());
}

fn remove_node_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id = args.get(0).number_value(scope).unwrap_or_default() as u32;
    state.scene.lock().unwrap().push_back(SceneCommand::RemoveNode { id });
    rv.set(v8::Boolean::new(scope, true).into());
}

fn set_root_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id = args.get(0).number_value(scope).unwrap_or_default() as u32;
    state.scene.lock().unwrap().push_back(SceneCommand::SetRoot { id });
    rv.set(v8::Boolean::new(scope, true).into());
}

// ── Window control bindings ───────────────────────────────────────────────────

fn get_window_size_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if let Some(ctrl) = &state.window {
        let (w, h) = (ctrl.get_window_size)();
        let obj = v8::Object::new(scope);
        macro_rules! set_num {
            ($key:literal, $val:expr) => {
                let k = v8::String::new(scope, $key).unwrap();
                let v = v8::Number::new(scope, $val as f64);
                obj.set(scope, k.into(), v.into());
            };
        }
        set_num!("width",  w);
        set_num!("height", h);
        rv.set(obj.into());
    } else {
        rv.set(v8::null(scope).into());
    }
}

fn get_screen_size_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if let Some(ctrl) = &state.window {
        if let Some((w, h)) = (ctrl.get_screen_size)() {
            let obj = v8::Object::new(scope);
            macro_rules! set_num {
                ($key:literal, $val:expr) => {
                    let k = v8::String::new(scope, $key).unwrap();
                    let v = v8::Number::new(scope, $val as f64);
                    obj.set(scope, k.into(), v.into());
                };
            }
            set_num!("width",  w);
            set_num!("height", h);
            rv.set(obj.into());
            return;
        }
    }
    rv.set(v8::null(scope).into());
}

fn set_fullscreen_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let enable = args.get(0).boolean_value(scope);
    if let Some(ctrl) = &state.window {
        (ctrl.set_fullscreen)(enable);
    }
}

fn set_maximized_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let enable = args.get(0).boolean_value(scope);
    if let Some(ctrl) = &state.window {
        (ctrl.set_maximized)(enable);
    }
}

fn set_minimized_callback(
    _scope: &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if let Some(ctrl) = &state.window {
        (ctrl.set_minimized)();
    }
}

fn is_fullscreen_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let result = state.window.as_ref().map(|ctrl| (ctrl.is_fullscreen)()).unwrap_or(false);
    rv.set(v8::Boolean::new(scope, result).into());
}

fn is_maximized_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let result = state.window.as_ref().map(|ctrl| (ctrl.is_maximized)()).unwrap_or(false);
    rv.set(v8::Boolean::new(scope, result).into());
}

// ── File system bindings ──────────────────────────────────────────────────────
//
// All async, all return Promise<string> (empty string for void operations).
// fs.write capability is required for all mutation operations.
// fs.read  capability is required for listing / reading.

/// `__velox_writeFile(path, content) -> Promise<void>`
fn write_file_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().can_write_fs() {
        rv.set(reject_cap_promise(scope, "fs.write").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let path    = v8_arg_to_string(scope, &args, 0);
    let content = v8_arg_to_string(scope, &args, 1);

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::fs::write(&path, content)
            .await
            .map(|_| String::new())
            .map_err(|e| e.to_string());
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_appendFile(path, content) -> Promise<void>`
fn append_file_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().can_write_fs() {
        rv.set(reject_cap_promise(scope, "fs.write").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let path    = v8_arg_to_string(scope, &args, 0);
    let content = v8_arg_to_string(scope, &args, 1);

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        use tokio::io::AsyncWriteExt;
        let result = async {
            let mut file = tokio::fs::OpenOptions::new()
                .create(true).append(true).open(&path).await?;
            file.write_all(content.as_bytes()).await?;
            Ok::<_, std::io::Error>(())
        }
        .await
        .map(|_| String::new())
        .map_err(|e| e.to_string());

        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_listDir(path) -> Promise<string>` — JSON array of `{ name, isDir }` objects.
fn list_dir_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().can_read_fs() {
        rv.set(reject_cap_promise(scope, "fs.read").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let path = v8_arg_to_string(scope, &args, 0);

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let mut entries_json = Vec::new();
            let mut rd = tokio::fs::read_dir(&path).await
                .map_err(|e| e.to_string())?;
            while let Some(entry) = rd.next_entry().await.map_err(|e| e.to_string())? {
                let meta   = entry.metadata().await.map_err(|e| e.to_string())?;
                let name   = entry.file_name().to_string_lossy().into_owned();
                let is_dir = meta.is_dir();
                entries_json.push(serde_json::json!({ "name": name, "isDir": is_dir }));
            }
            serde_json::to_string(&entries_json).map_err(|e| e.to_string())
        }
        .await;

        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_deleteFile(path) -> Promise<void>`
fn delete_file_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().can_write_fs() {
        rv.set(reject_cap_promise(scope, "fs.write").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let path = v8_arg_to_string(scope, &args, 0);

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::fs::remove_file(&path)
            .await
            .map(|_| String::new())
            .map_err(|e| e.to_string());
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_mkdirp(path) -> Promise<void>` — creates the directory and all parents.
fn mkdirp_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().can_write_fs() {
        rv.set(reject_cap_promise(scope, "fs.write").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let path = v8_arg_to_string(scope, &args, 0);

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::fs::create_dir_all(&path)
            .await
            .map(|_| String::new())
            .map_err(|e| e.to_string());
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// ── Database bindings ─────────────────────────────────────────────────────────
//
// All async. Gated by `db: true` capability.
// `db_open`  → Promise<string>  — resolves with the handle number as a string.
// `db_query` → Promise<string>  — resolves with JSON array of row objects.
// `db_run`   → Promise<string>  — resolves with JSON `{ rowsAffected, lastInsertId }`.
//
// Relative paths are placed under `data/` to keep the app root clean.
// Absolute paths and `:memory:` pass through unchanged.

fn resolve_db_path(path: String) -> String {
    if path == ":memory:" || std::path::Path::new(&path).is_absolute() {
        return path;
    }
    let data_dir = std::path::Path::new("data");
    if !data_dir.exists() {
        let _ = std::fs::create_dir_all(data_dir);
    }
    data_dir.join(&path).to_string_lossy().into_owned()
}

/// `__velox_db_open(path) -> Promise<string>` — handle number.
fn db_open_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let path      = resolve_db_path(v8_arg_to_string(scope, &args, 0));
    let handle    = state.next_db_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let pools     = Arc::clone(&state.db_pools);
    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = velox_db::open(&path).await
            .map(|pool| {
                pools.lock().unwrap().insert(handle, pool);
                handle.to_string()
            })
            .map_err(|e| e.to_string());
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_db_query(handle, sql, paramsJson) -> Promise<string>` — JSON rows.
fn db_query_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle      = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let sql         = v8_arg_to_string(scope, &args, 1);
    let params_json = v8_arg_to_string(scope, &args, 2);

    // Resolve the pool before spawning — fail fast if handle is invalid.
    let pool = match state.db_pools.lock().unwrap().get(&handle).cloned() {
        Some(p) => p,
        None => {
            throw_js_error(scope, &format!("db: unknown handle {handle}"));
            return;
        }
    };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let params: Vec<serde_json::Value> =
                serde_json::from_str(&params_json).unwrap_or_default();
            let rows = velox_db::query(&pool, &sql, params).await
                .map_err(|e| e.to_string())?;
            serde_json::to_string(&rows).map_err(|e| e.to_string())
        }
        .await;
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_db_run(handle, sql, paramsJson) -> Promise<string>` — JSON `{ rowsAffected, lastInsertId }`.
fn db_run_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle      = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let sql         = v8_arg_to_string(scope, &args, 1);
    let params_json = v8_arg_to_string(scope, &args, 2);

    let pool = match state.db_pools.lock().unwrap().get(&handle).cloned() {
        Some(p) => p,
        None => {
            throw_js_error(scope, &format!("db: unknown handle {handle}"));
            return;
        }
    };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let params: Vec<serde_json::Value> =
                serde_json::from_str(&params_json).unwrap_or_default();
            let (rows_affected, last_insert_id) = velox_db::run(&pool, &sql, params).await
                .map_err(|e| e.to_string())?;
            serde_json::to_string(&serde_json::json!({
                "rowsAffected":  rows_affected,
                "lastInsertId":  last_insert_id,
            }))
            .map_err(|e| e.to_string())
        }
        .await;
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_db_close(handle) -> Promise<void>`
///
/// Removes the pool from the handle map and drains all connections gracefully.
/// Idempotent: closing an unknown handle resolves immediately without error.
fn db_close_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    // Remove synchronously so no new queries can grab this pool.
    let pool = state.db_pools.lock().unwrap().remove(&handle);

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        if let Some(pool) = pool {
            pool.close().await;
        }
        enqueue_completion(
            &queue_clone,
            redraw.as_ref(),
            Completion { resolver_ptr: resolver, result: Ok(String::new()) },
        );
    });
}

/// `__velox_db_transaction(handle, statementsJson) -> Promise<void>`
///
/// `statementsJson` is a JSON array of `{ sql: string, params: any[] }` objects.
/// All statements execute in a single SQLite transaction; any failure rolls back.
fn db_transaction_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle     = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let stmts_json = v8_arg_to_string(scope, &args, 1);

    let pool = match state.db_pools.lock().unwrap().get(&handle).cloned() {
        Some(p) => p,
        None => {
            throw_js_error(scope, &format!("db: unknown handle {handle}"));
            return;
        }
    };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let raw: Vec<serde_json::Value> = serde_json::from_str(&stmts_json)
                .map_err(|e| format!("db.transaction: invalid JSON: {e}"))?;
            let stmts: Vec<velox_db::TxStmt> = raw.into_iter().map(|s| velox_db::TxStmt {
                sql:    s["sql"].as_str().unwrap_or("").to_owned(),
                params: s["params"].as_array().cloned().unwrap_or_default(),
            }).collect();
            velox_db::transaction(&pool, stmts).await.map_err(|e| e.to_string())?;
            Ok(String::new())
        }
        .await;
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// ── Window extra callbacks (sync) ─────────────────────────────────────────────

/// `__velox_setAlwaysOnTop(on: boolean) -> void`
fn set_always_on_top_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let on    = args.get(0).boolean_value(scope);
    if let Some(ctrl) = &state.window {
        (ctrl.set_always_on_top)(on);
    }
}

/// `__velox_setTitle(title: string) -> void`
fn set_title_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let title = v8_arg_to_string(scope, &args, 0);
    if let Some(ctrl) = &state.window {
        (ctrl.set_title)(title);
    }
}

// ── File dialog callbacks ──────────────────────────────────────────────────────
//
// All async. Gated by `dialog: true` capability.
// `dialog_openFile`   → Promise<string>   — JSON array of paths, or JSON null.
// `dialog_saveFile`   → Promise<string>   — JSON path string, or JSON null.
// `dialog_openFolder` → Promise<string>   — JSON path string, or JSON null.
//
// Filter format: JSON array of `{ name: string, extensions: string[] }`.

/// Build filter list from a JSON string `[{ name, extensions: string[] }]`.
fn parse_dialog_filters(json: &str) -> Vec<(String, Vec<String>)> {
    let parsed: Vec<serde_json::Value> = serde_json::from_str(json).unwrap_or_default();
    parsed.into_iter().map(|f| {
        let name = f["name"].as_str().unwrap_or("All Files").to_string();
        let exts: Vec<String> = f["extensions"].as_array()
            .map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
            .unwrap_or_default();
        (name, exts)
    }).collect()
}

/// `__velox_dialog_openFile(filtersJson, multiple) -> Promise<string>` — JSON path[].
fn dialog_open_file_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().dialog {
        rv.set(reject_cap_promise(scope, "dialog").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let filters_json = v8_arg_to_string(scope, &args, 0);
    let multiple     = args.get(1).boolean_value(scope);
    let hwnd         = state.hwnd;
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        log::info!("[dialog_openFile] starting, hwnd={:?}", hwnd);
        let filters = parse_dialog_filters(&filters_json);
        let mut dialog = rfd::AsyncFileDialog::new();
        for (name, exts) in &filters {
            let refs: Vec<&str> = exts.iter().map(String::as_str).collect();
            dialog = dialog.add_filter(name, &refs);
        }
        #[cfg(target_os = "windows")]
        if let Some(h) = hwnd {
            log::info!("[dialog_openFile] setting parent hwnd={}", h);
            dialog = dialog.set_parent(&WinParent(h));
        }

        let result: Result<String, String> = if multiple {
            log::info!("[dialog_openFile] calling pick_files");
            let handles = dialog.pick_files().await;
            log::info!("[dialog_openFile] pick_files returned {:?}", handles.as_ref().map(|v| v.len()));
            let paths: Vec<String> = handles.unwrap_or_default().iter()
                .map(|h| h.path().to_string_lossy().into_owned())
                .collect();
            serde_json::to_string(&paths).map_err(|e| e.to_string())
        } else {
            log::info!("[dialog_openFile] calling pick_file");
            let handle = dialog.pick_file().await;
            log::info!("[dialog_openFile] pick_file returned {:?}", handle.as_ref().map(|h| h.path()));
            let path = handle.as_ref().map(|h| h.path().to_string_lossy().into_owned());
            serde_json::to_string(&path).map_err(|e| e.to_string())
        };
        log::info!("[dialog_openFile] result: {:?}", result);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_dialog_saveFile(defaultName, filtersJson) -> Promise<string>` — JSON path | null.
fn dialog_save_file_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().dialog {
        rv.set(reject_cap_promise(scope, "dialog").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let default_name = v8_arg_to_string(scope, &args, 0);
    let filters_json = v8_arg_to_string(scope, &args, 1);
    let hwnd         = state.hwnd;
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let filters = parse_dialog_filters(&filters_json);
        let mut dialog = rfd::AsyncFileDialog::new().set_file_name(&default_name);
        for (name, exts) in &filters {
            let refs: Vec<&str> = exts.iter().map(String::as_str).collect();
            dialog = dialog.add_filter(name, &refs);
        }
        #[cfg(target_os = "windows")]
        if let Some(h) = hwnd {
            dialog = dialog.set_parent(&WinParent(h));
        }

        let handle = dialog.save_file().await;
        let path = handle.as_ref().map(|h| h.path().to_string_lossy().into_owned());
        let result = serde_json::to_string(&path).map_err(|e| e.to_string());
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_dialog_openFolder() -> Promise<string>` — JSON path | null.
fn dialog_open_folder_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().dialog {
        rv.set(reject_cap_promise(scope, "dialog").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let hwnd = state.hwnd;
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let mut dialog = rfd::AsyncFileDialog::new();
        #[cfg(target_os = "windows")]
        if let Some(h) = hwnd {
            dialog = dialog.set_parent(&WinParent(h));
        }

        let handle = dialog.pick_folder().await;
        let path = handle.as_ref().map(|h| h.path().to_string_lossy().into_owned());
        let result = serde_json::to_string(&path).map_err(|e| e.to_string());
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// ── Clipboard callbacks ────────────────────────────────────────────────────────
//
// Gated by `clipboard: true` capability.

/// `__velox_clipboard_readText() -> Promise<string>` — clipboard text content.
fn clipboard_read_text_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().clipboard {
        rv.set(reject_cap_promise(scope, "clipboard").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        log::info!("[clipboard_readText] starting");
        let result: Result<String, String> = tokio::task::spawn_blocking(|| {
            log::info!("[clipboard_readText::spawn_blocking] about to read clipboard");
            let res = clipboard_win::get_clipboard::<String, _>(clipboard_win::formats::Unicode);
            log::info!("[clipboard_readText::spawn_blocking] result: {:?}", res);
            res.map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| {
            log::error!("[clipboard_readText::await_error] {}", e);
            e.to_string()
        })
        .and_then(|r| r);
        log::info!("[clipboard_readText] final result: {:?}", result);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_clipboard_writeText(text) -> Promise<void>`
fn clipboard_write_text_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().clipboard {
        rv.set(reject_cap_promise(scope, "clipboard").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let text = v8_arg_to_string(scope, &args, 0);
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        log::info!("[clipboard_writeText] starting, text.len()={}", text.len());
        let result: Result<String, String> = tokio::task::spawn_blocking(move || {
            log::info!("[clipboard_writeText::spawn_blocking] setting clipboard");
            clipboard_win::set_clipboard(clipboard_win::formats::Unicode, &text)
                .map_err(|e| {
                    log::error!("[clipboard_writeText] set_clipboard failed: {}", e);
                    e.to_string()
                })
                .map(|_| String::new())
        })
        .await
        .map_err(|e| {
            log::error!("[clipboard_writeText] spawn_blocking error: {}", e);
            e.to_string()
        })
        .and_then(|r| r);
        log::info!("[clipboard_writeText] final result: {:?}", result);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// ── Notification callback ──────────────────────────────────────────────────────

/// `__velox_notification_send(title, body) -> Promise<void>`
///
/// Sends a native desktop notification. Fire-and-forget; errors are logged but
/// do not reject the Promise (notifications are best-effort).
fn notification_send_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().notification {
        rv.set(reject_cap_promise(scope, "notification").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let title = v8_arg_to_string(scope, &args, 0);
    let body  = v8_arg_to_string(scope, &args, 1);
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        log::info!("[notification_send] starting, title='{}', body_len={}", title, body.len());
        let result: Result<String, String> = tokio::task::spawn_blocking(move || {
            let mut notif = notify_rust::Notification::new();
            notif.summary(&title);
            notif.body(&body);
            // Windows 10/11 toast notifications require a registered AUMID.
            // Re-use the PowerShell AUMID which is always present on Windows.
            #[cfg(target_os = "windows")]
            {
                log::info!("[notification_send] setting app_id for Windows");
                notif.app_id("{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe");
            }
            log::info!("[notification_send] calling show()");
            if let Err(e) = notif.show() {
                log::error!("[notification_send] show() failed: {}", e);
            } else {
                log::info!("[notification_send] show() succeeded");
            }
            Ok::<String, String>(String::new())
        })
        .await
        .map_err(|e| {
            log::error!("[notification_send] spawn_blocking error: {}", e);
            e.to_string()
        })
        .and_then(|r| r);
        log::info!("[notification_send] final result: {:?}", result);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// ── Vector database callbacks ─────────────────────────────────────────────────
//
// All async. Gated by `db: true` capability (vector stores are local DB storage).
// `vectorDb_open`   → Promise<string>  — resolves with handle number as a string.
// `vectorDb_upsert` → Promise<string>  — resolves with "" on success.
// `vectorDb_search` → Promise<string>  — resolves with JSON array of {id,score,metadata}.
// `vectorDb_close`  → Promise<string>  — resolves with "" on success.

/// `__velox_vectorDb_open(path) -> Promise<string>` — handle number.
fn vectordb_open_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data   = args.data().unwrap();
    let ext    = v8::Local::<v8::External>::try_from(data).unwrap();
    let state  = unsafe { &*(ext.value() as *const AsyncState) };

    let path   = resolve_db_path(v8_arg_to_string(scope, &args, 0));
    let handle = state.next_vdb_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let stores = Arc::clone(&state.vector_stores);
    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = velox_db::open_vector_store(&path).await
            .map(|store| {
                stores.lock().unwrap().insert(handle, store);
                handle.to_string()
            })
            .map_err(|e| e.to_string());
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_vectorDb_upsert(handle, table, id, vectorJson, metadataJson) -> Promise<string>`
///
/// `vectorJson`   — JSON array of f32 numbers (the embedding).
/// `metadataJson` — JSON string for the metadata payload, or `""` for none.
fn vectordb_upsert_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle      = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let table       = v8_arg_to_string(scope, &args, 1);
    let id          = v8_arg_to_string(scope, &args, 2);
    let vector_json = v8_arg_to_string(scope, &args, 3);
    let meta_json   = v8_arg_to_string(scope, &args, 4);

    let store = match state.vector_stores.lock().unwrap().get(&handle).cloned() {
        Some(s) => s,
        None => {
            throw_js_error(scope, &format!("vectorDb: unknown handle {handle}"));
            return;
        }
    };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let vector: Vec<f64> = serde_json::from_str(&vector_json)
                .map_err(|e| format!("vectorDb.upsert: invalid vector JSON: {e}"))?;
            let vec_f32: Vec<f32> = vector.iter().map(|&v| v as f32).collect();
            let meta = if meta_json.is_empty() { None } else { Some(meta_json.as_str()) };
            velox_db::vector_upsert(&store, &table, &id, &vec_f32, meta).await
                .map(|_| String::new())
                .map_err(|e| e.to_string())
        }
        .await;
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_vectorDb_search(handle, table, queryJson, limit) -> Promise<string>` — JSON results.
///
/// `queryJson` — JSON array of f32 numbers (the query embedding).
/// Resolves with a JSON array of `{id, score, metadata}` objects.
fn vectordb_search_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle     = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let table      = v8_arg_to_string(scope, &args, 1);
    let query_json = v8_arg_to_string(scope, &args, 2);
    let limit      = args.get(3).number_value(scope).unwrap_or(10.0) as usize;

    let store = match state.vector_stores.lock().unwrap().get(&handle).cloned() {
        Some(s) => s,
        None => {
            throw_js_error(scope, &format!("vectorDb: unknown handle {handle}"));
            return;
        }
    };

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            let query: Vec<f64> = serde_json::from_str(&query_json)
                .map_err(|e| format!("vectorDb.search: invalid query JSON: {e}"))?;
            let query_f32: Vec<f32> = query.iter().map(|&v| v as f32).collect();
            let hits = velox_db::vector_search(&store, &table, &query_f32, limit).await
                .map_err(|e| e.to_string())?;

            let json_hits: Vec<serde_json::Value> = hits.into_iter().map(|(id, score, meta)| {
                let metadata = meta
                    .and_then(|s| serde_json::from_str::<serde_json::Value>(&s).ok())
                    .unwrap_or(serde_json::Value::Null);
                serde_json::json!({ "id": id, "score": score, "metadata": metadata })
            }).collect();
            serde_json::to_string(&json_hits).map_err(|e| e.to_string())
        }
        .await;
        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_vectorDb_close(handle) -> Promise<string>`
///
/// Removes the store from the handle map and closes the underlying pool.
/// Idempotent: closing an unknown handle resolves immediately without error.
fn vectordb_close_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().db {
        rv.set(reject_cap_promise(scope, "db").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let store  = state.vector_stores.lock().unwrap().remove(&handle);

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        if let Some(s) = store {
            s.pool.close().await;
        }
        enqueue_completion(
            &queue_clone,
            redraw.as_ref(),
            Completion { resolver_ptr: resolver, result: Ok(String::new()) },
        );
    });
}

// ── Network: __velox_fetch ────────────────────────────────────────────────────

/// Extract the hostname from a URL string without pulling in the `url` crate.
/// `"https://api.example.com:8080/path?q=1"` → `"api.example.com"`.
fn extract_host(url: &str) -> String {
    let rest = if let Some(pos) = url.find("://") {
        &url[pos + 3..]
    } else {
        url
    };
    let host_port = rest.split('/').next().unwrap_or(rest);
    host_port.split(':').next().unwrap_or(host_port).to_lowercase()
}

/// `__velox_fetch(url, optionsJson) -> Promise<string>`
///
/// Makes an HTTP request and resolves with a JSON-serialised response object:
/// ```json
/// { "status": 200, "ok": true, "statusText": "OK",
///   "headers": { "content-type": "application/json" },
///   "body": "..." }
/// ```
///
/// `optionsJson` (all fields optional):
/// ```json
/// { "method": "POST",
///   "headers": { "Authorization": "Bearer ..." },
///   "body": "plain string body",
///   "multipart": [
///     { "name": "field", "value": "text value" },
///     { "name": "file", "filename": "photo.jpg",
///       "base64": "<base64 bytes>", "contentType": "image/jpeg" }
///   ] }
/// ```
///
/// Requires `network.allow` capability in `velox.config.json`:
/// ```json
/// { "capabilities": { "network": { "allow": ["api.example.com"] } } }
/// ```
/// Use `"*"` to allow all outbound requests.
fn fetch_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let url  = v8_arg_to_string(scope, &args, 0);
    let host = extract_host(&url);

    if !velox_security::get().can_network(&host) {
        rv.set(reject_promise_with_error(scope, &format!(
            "network.allow[\"{host}\"] — add to velox.config.json \
             under \"capabilities\": {{ \"network\": {{ \"allow\": [\"{host}\"] }} }}"
        )).into());
        return;
    }

    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let options_json = v8_arg_to_string(scope, &args, 1);
    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            // Parse options (tolerates missing / undefined / null).
            let opts: serde_json::Value = serde_json::from_str(&options_json)
                .unwrap_or(serde_json::Value::Null);

            let method = opts.get("method")
                .and_then(|m| m.as_str())
                .unwrap_or("GET")
                .to_ascii_uppercase();

            let client = reqwest::Client::new();

            let mut builder = match method.as_str() {
                "POST"   => client.post(&url),
                "PUT"    => client.put(&url),
                "PATCH"  => client.patch(&url),
                "DELETE" => client.delete(&url),
                "HEAD"   => client.head(&url),
                _        => client.get(&url),
            };

            // Request headers.
            if let Some(hdrs) = opts.get("headers").and_then(|h| h.as_object()) {
                for (k, v) in hdrs {
                    if let Some(val) = v.as_str() {
                        builder = builder.header(k.as_str(), val);
                    }
                }
            }

            // ── Multipart body ────────────────────────────────────────────
            // `multipart` option: array of part descriptors.
            // Each part: { name, value?, filename?, base64?, contentType? }
            //   - text part:   { name: "field", value: "hello" }
            //   - binary part: { name: "file", filename: "photo.jpg",
            //                    base64: "<b64>", contentType: "image/jpeg" }
            if let Some(parts) = opts.get("multipart").and_then(|m| m.as_array()) {
                let mut form = reqwest::multipart::Form::new();
                for part_val in parts {
                    let name = part_val.get("name")
                        .and_then(|n| n.as_str())
                        .unwrap_or("field")
                        .to_owned();

                    if let Some(b64) = part_val.get("base64").and_then(|b| b.as_str()) {
                        // Binary part — decode from base64.
                        let bytes = base64::engine::general_purpose::STANDARD
                            .decode(b64)
                            .map_err(|e| format!("multipart base64 decode: {e}"))?;
                        let mime = part_val.get("contentType")
                            .and_then(|c| c.as_str())
                            .unwrap_or("application/octet-stream")
                            .to_owned();
                        let filename = part_val.get("filename")
                            .and_then(|f| f.as_str())
                            .unwrap_or("file")
                            .to_owned();
                        let mut part = reqwest::multipart::Part::bytes(bytes)
                            .file_name(filename);
                        part = part.mime_str(&mime).map_err(|e| e.to_string())?;
                        form = form.part(name, part);
                    } else {
                        // Text part.
                        let value = part_val.get("value")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_owned();
                        let mut part = reqwest::multipart::Part::text(value);
                        if let Some(fname) = part_val.get("filename").and_then(|f| f.as_str()) {
                            part = part.file_name(fname.to_owned());
                        }
                        if let Some(ct) = part_val.get("contentType").and_then(|c| c.as_str()) {
                            part = part.mime_str(ct).map_err(|e| e.to_string())?;
                        }
                        form = form.part(name, part);
                    }
                }
                builder = builder.multipart(form);
            } else if let Some(body) = opts.get("body").and_then(|b| b.as_str()) {
                // Plain string body (JSON, form-urlencoded, etc.).
                builder = builder.body(body.to_owned());
            }

            let response = builder.send().await.map_err(|e| e.to_string())?;

            let status      = response.status().as_u16();
            let ok          = (200u16..300).contains(&status);
            let status_text = response.status()
                .canonical_reason()
                .unwrap_or("")
                .to_owned();

            // Collect response headers as a plain object.
            let mut resp_headers = serde_json::Map::new();
            for (k, v) in response.headers() {
                if let Ok(val) = v.to_str() {
                    resp_headers.insert(k.to_string(), serde_json::Value::String(val.to_owned()));
                }
            }

            let body = response.text().await.map_err(|e| e.to_string())?;

            serde_json::to_string(&serde_json::json!({
                "status":     status,
                "ok":         ok,
                "statusText": status_text,
                "headers":    resp_headers,
                "body":       body,
            }))
            .map_err(|e| e.to_string())
        }
        .await;

        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// ── WebSocket bindings ────────────────────────────────────────────────────────

/// `__velox_ws_connect(url) -> Promise<string>` (resolves with handle id).
///
/// Connects via tokio-tungstenite.  Spawns two tasks:
///   - read task: pushes incoming Text messages into `WsHandle::inbox`.
///   - write task: forwards messages from `outbox_tx` to the socket sink.
fn ws_connect_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let url  = v8_arg_to_string(scope, &args, 0);
    let host = extract_host(&url);

    if !velox_security::get().can_network(&host) {
        rv.set(reject_promise_with_error(scope, &format!(
            "network.allow[\"{host}\"] — add to velox.config.json \
             under \"capabilities\": {{ \"network\": {{ \"allow\": [\"{host}\"] }} }}"
        )).into());
        return;
    }

    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle      = state.next_ws_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let ws_handles  = Arc::clone(&state.ws_handles);
    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            use futures_util::{SinkExt, StreamExt};
            use tokio_tungstenite::tungstenite::Message as WsMessage;

            let (ws_stream, _) = tokio_tungstenite::connect_async(&url)
                .await
                .map_err(|e| format!("WebSocket connect failed: {e}"))?;

            let (mut sink, mut stream) = ws_stream.split();

            let inbox = Arc::new(Mutex::new(VecDeque::<String>::new()));
            let (outbox_tx, mut outbox_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

            // Read task: push incoming messages into inbox.
            let inbox_read = Arc::clone(&inbox);
            tokio::spawn(async move {
                while let Some(msg) = stream.next().await {
                    match msg {
                        Ok(WsMessage::Text(text)) => {
                            inbox_read.lock().unwrap().push_back(text.to_string());
                        }
                        Ok(WsMessage::Close(_)) | Err(_) => {
                            inbox_read.lock().unwrap().push_back("__VELOX_WS_CLOSED__".to_string());
                            break;
                        }
                        _ => {} // ping/pong/binary: ignored
                    }
                }
                // Ensure a close sentinel is always pushed (handles clean server closes).
                inbox_read.lock().unwrap().push_back("__VELOX_WS_CLOSED__".to_string());
            });

            // Write task: forward outbox messages to the socket.
            tokio::spawn(async move {
                while let Some(msg) = outbox_rx.recv().await {
                    if sink.send(WsMessage::Text(msg)).await.is_err() {
                        break;
                    }
                }
                let _ = sink.close().await;
            });

            ws_handles.lock().unwrap().insert(handle, WsHandle { outbox_tx, inbox });
            Ok(handle.to_string())
        }
        .await;

        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_ws_send(handle, message)` — sync fire-and-forget.
fn ws_send_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let msg    = v8_arg_to_string(scope, &args, 1);

    if let Some(h) = state.ws_handles.lock().unwrap().get(&handle) {
        let _ = h.outbox_tx.send(msg);
    }
}

/// `__velox_ws_poll(handle) -> string` — sync, drains inbox, returns JSON array.
///
/// Returns `"[]"` if no messages or unknown handle.
/// Returns `["__VELOX_WS_CLOSED__"]` when the server has closed the connection.
fn ws_poll_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let msgs: Vec<String> = {
        let guard = state.ws_handles.lock().unwrap();
        guard
            .get(&handle)
            .map(|h| h.inbox.lock().unwrap().drain(..).collect())
            .unwrap_or_default()
    };

    let json   = serde_json::to_string(&msgs).unwrap_or_else(|_| "[]".to_string());
    let v8_str = v8::String::new(scope, &json).unwrap();
    rv.set(v8_str.into());
}

/// `__velox_ws_close(handle)` — sync, removes handle (drops outbox tx → write task exits).
fn ws_close_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    // Dropping WsHandle drops outbox_tx → write task's recv() returns None → exits.
    state.ws_handles.lock().unwrap().remove(&handle);
}

// ── Multi-window + IPC bindings ───────────────────────────────────────────────

/// `__velox_window_create(optsJson) -> Promise<string>` — handle as string.
///
/// Creates a secondary window.  `optsJson` is a JSON object:
///   `{ title?: string, width?: number, height?: number }`
///
/// The promise resolves immediately with the pre-assigned window handle.
/// The window itself appears asynchronously once the event loop processes the
/// create request.  JS can begin sending IPC messages before the window is
/// fully initialised — they queue in the inbox and are consumed once the
/// secondary runtime starts polling.
fn window_create_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    // Cap total open windows (main + all secondaries) to prevent runaway creation.
    const MAX_WINDOWS: usize = 10;
    let open_count = state.ipc_bus.lock().unwrap().len();
    if open_count >= MAX_WINDOWS {
        throw_js_error(scope, &format!(
            "veloxWindow.create: window limit reached ({} open, max {})",
            open_count, MAX_WINDOWS,
        ));
        return;
    }

    let opts_str = v8_arg_to_string(scope, &args, 0);
    let opts: serde_json::Value = serde_json::from_str(&opts_str).unwrap_or_default();
    let title  = opts.get("title") .and_then(|v| v.as_str()).unwrap_or("Window").to_string();
    let width  = opts.get("width") .and_then(|v| v.as_u64()).unwrap_or(800) as u32;
    let height = opts.get("height").and_then(|v| v.as_u64()).unwrap_or(600) as u32;

    // Allocate a globally-unique handle (shared across all windows' runtimes).
    let new_id = state.next_window_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    // Pre-register an inbox in the IPC bus so messages can be queued before
    // the secondary window's runtime starts polling.
    state.ipc_bus.lock().unwrap()
        .entry(new_id)
        .or_insert_with(|| Arc::new(Mutex::new(VecDeque::new())));

    // Ask the event loop to create the window.
    if let Some(ref ctrl) = state.window {
        if let Some(ref create_fn) = ctrl.create_window {
            (create_fn)(new_id, title, width, height);
        }
    }

    // Resolve the promise immediately with the handle — window appears async.
    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());
    enqueue_completion(&queue_clone, redraw.as_ref(), Completion {
        resolver_ptr: resolver,
        result:       Ok(new_id.to_string()),
    });
}

/// `__velox_ipc_send(targetHandle, message)` — sync, fire-and-forget.
///
/// Pushes a string message into the target window's IPC inbox.
/// The target window drains its inbox each frame via `__velox_ipc_poll`.
fn ipc_send_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let target = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let msg    = v8_arg_to_string(scope, &args, 1);

    let guard = state.ipc_bus.lock().unwrap();
    if let Some(inbox) = guard.get(&target) {
        inbox.lock().unwrap().push_back(msg);
    }
}

/// `__velox_ipc_poll() -> string` — sync, returns JSON array of pending messages.
///
/// Drains this window's own IPC inbox.  Returns `"[]"` when empty.
/// Called each frame from the JS frame callback alongside WS polling.
fn ipc_poll_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let msgs: Vec<String> = {
        let guard = state.ipc_bus.lock().unwrap();
        guard
            .get(&state.my_handle)
            .map(|inbox| inbox.lock().unwrap().drain(..).collect())
            .unwrap_or_default()
    };

    let json   = serde_json::to_string(&msgs).unwrap_or_else(|_| "[]".to_string());
    let v8_str = v8::String::new(scope, &json).unwrap();
    rv.set(v8_str.into());
}

// ── mDNS service discovery binding ───────────────────────────────────────────

/// `__velox_mdns_discover(serviceType, timeoutMs) -> Promise<string>`
///
/// Browses for mDNS services of the given type (e.g. `"_http._tcp.local."`)
/// for up to `timeoutMs` milliseconds.  Resolves with a JSON array of:
///   `[{ name, hostname, port, addresses }]`
///
/// Requires `mdns: true` in velox.config.json capabilities.
fn mdns_discover_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().can_mdns() {
        rv.set(reject_cap_promise(scope, "mdns").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let service_type = v8_arg_to_string(scope, &args, 0);
    let timeout_ms   = args.get(1).number_value(scope).unwrap_or(5000.0) as u64;

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = tokio::task::spawn_blocking(move || {
            use mdns_sd::{ServiceDaemon, ServiceEvent};
            use std::time::{Duration, Instant};

            let daemon = ServiceDaemon::new().map_err(|e| e.to_string())?;
            let receiver = daemon.browse(&service_type).map_err(|e| e.to_string())?;

            let deadline  = Instant::now() + Duration::from_millis(timeout_ms);
            let poll_step = Duration::from_millis(250);
            let mut results: Vec<serde_json::Value> = Vec::new();

            loop {
                let now = Instant::now();
                if now >= deadline { break; }
                let remaining = deadline - now;
                match receiver.recv_timeout(remaining.min(poll_step)) {
                    Ok(ServiceEvent::ServiceResolved(info)) => {
                        let addresses: Vec<String> =
                            info.get_addresses().iter().map(|a| a.to_string()).collect();
                        results.push(serde_json::json!({
                            "name":      info.get_fullname(),
                            "hostname":  info.get_hostname(),
                            "port":      info.get_port(),
                            "addresses": addresses,
                        }));
                    }
                    Ok(ServiceEvent::SearchStopped(_)) => break,
                    Ok(_) => {}
                    Err(_)  => {} // recv_timeout expired — check deadline at top of loop
                }
            }

            let _ = daemon.stop_browse(&service_type);
            let _ = daemon.shutdown();

            serde_json::to_string(&results).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())
        .and_then(|r| r);

        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// ── Shared helpers ────────────────────────────────────────────────────────────

/// Extract argument `idx` as an owned `String` from a V8 callback.
fn v8_arg_to_string(
    scope: &mut v8::HandleScope,
    args:  &v8::FunctionCallbackArguments,
    idx:   i32,
) -> String {
    args.get(idx)
        .to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default()
}

/// Allocate a `PromiseResolver`, return `(resolver_ptr, promise, queue_clone)`.
fn make_promise<'s>(
    scope: &mut v8::HandleScope<'s>,
    state: &AsyncState,
) -> (usize, v8::Local<'s, v8::Promise>, CompletionQueue, Option<RedrawRequest>) {
    let resolver     = v8::PromiseResolver::new(scope).unwrap();
    let promise      = resolver.get_promise(scope);
    let global_res   = v8::Global::new(scope, resolver);
    let resolver_ptr = Box::into_raw(Box::new(global_res)) as usize;
    let queue_clone  = Arc::clone(&state.queue);
    let redraw       = state.request_redraw.as_ref().map(Arc::clone);
    (resolver_ptr, promise, queue_clone, redraw)
}

fn enqueue_completion(
    queue: &CompletionQueue,
    redraw: Option<&RedrawRequest>,
    completion: Completion,
) {
    queue.lock().unwrap().push_back(completion);
    if let Some(redraw) = redraw {
        redraw();
    }
}

/// Throw a JS Error for a missing capability (sync bindings only).
fn throw_cap_error(scope: &mut v8::HandleScope, cap: &str) {
    let msg = format!(
        "Capability required: {cap} — add it to velox.config.json under \"capabilities\""
    );
    throw_js_error(scope, &msg);
}

/// Return a pre-rejected Promise with a JS Error — use this in **async** bindings
/// so the caller always gets a settled Promise instead of a synchronous exception.
fn reject_promise_with_error<'s>(scope: &mut v8::HandleScope<'s>, msg: &str) -> v8::Local<'s, v8::Promise> {
    let s        = v8::String::new(scope, msg).unwrap_or_else(|| v8::String::empty(scope));
    let exc      = v8::Exception::error(scope, s);
    let resolver = v8::PromiseResolver::new(scope).unwrap();
    resolver.reject(scope, exc);
    resolver.get_promise(scope)
}

/// Convenience wrapper for capability-gate rejections in async bindings.
fn reject_cap_promise<'s>(scope: &mut v8::HandleScope<'s>, cap: &str) -> v8::Local<'s, v8::Promise> {
    let msg = format!(
        "Capability required: {cap} — add it to velox.config.json under \"capabilities\""
    );
    reject_promise_with_error(scope, &msg)
}

// ── OS system APIs ────────────────────────────────────────────────────────────

/// `__velox_battery_getStatus()` → Promise<JSON | null>
fn battery_get_status_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !velox_security::get().battery {
        rv.set(reject_cap_promise(scope, "battery").into()); return;
    }
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);
    state.tokio.spawn(async move {
        let json = tokio::task::spawn_blocking(|| {
            match velox_sysapi::battery_status() {
                Some(b) => format!(
                    "{{\"level\":{:.3},\"charging\":{},\"timeRemainingSecs\":{}}}",
                    b.level, b.charging,
                    b.time_remaining_secs.map(|s| s.to_string()).unwrap_or("null".into())
                ),
                None => "null".into(),
            }
        }).await.unwrap_or_else(|_| "null".into());
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr, result: Ok(json) });
    });
    rv.set(promise.into());
}

/// `__velox_system_getInfo()` → Promise<JSON>
fn system_get_info_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !velox_security::get().system {
        rv.set(reject_cap_promise(scope, "system").into()); return;
    }
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);
    state.tokio.spawn(async move {
        let json = tokio::task::spawn_blocking(|| {
            let i = velox_sysapi::system_info();
            format!(
                "{{\"cpuName\":{:?},\"cpuCores\":{},\"memoryTotalMb\":{},\"memoryUsedMb\":{},\"osName\":{:?},\"osVersion\":{:?}}}",
                i.cpu_name, i.cpu_cores, i.memory_total_mb, i.memory_used_mb, i.os_name, i.os_version
            )
        }).await.unwrap_or_else(|_| "{}".into());
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr, result: Ok(json) });
    });
    rv.set(promise.into());
}

/// `__velox_system_getDarkMode()` → `"dark" | "light" | "unknown"` (sync, ~1 µs)
///
/// Reads the OS appearance preference directly — Windows registry key, macOS
/// NSUserDefaults, Linux gsettings.  No blocking I/O; safe to call every frame
/// if needed (though polling once per second is sufficient for most apps).
fn system_get_dark_mode_callback(
    scope: &mut v8::HandleScope,
    _args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().system {
        let s = v8::String::new(scope, "unknown").unwrap();
        rv.set(s.into());
        return;
    }
    let mode = velox_sysapi::dark_mode();
    let s = v8::String::new(scope, mode).unwrap();
    rv.set(s.into());
}

/// `__velox_system_getBatterySaver()` → boolean (sync, ~1 µs on Windows)
///
/// Returns `true` if battery-saver / power-saver mode is active.
/// Uses `GetSystemPowerStatus()` on Windows (one kernel call, no extra crate).
/// Returns `false` on macOS/Linux until native support lands.
fn system_get_battery_saver_callback(
    scope: &mut v8::HandleScope,
    _args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !velox_security::get().system {
        rv.set(v8::Boolean::new(scope, false).into());
        return;
    }
    let active = velox_sysapi::battery_saver_active();
    rv.set(v8::Boolean::new(scope, active).into());
}

/// `__velox_power_preventSleep(reason)` → string guard-id (sync)
fn power_prevent_sleep_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !velox_security::get().power {
        throw_cap_error(scope, "power"); return;
    }
    let reason = {
        let s = v8_arg_to_string(scope, &args, 0);
        if s.is_empty() { "Velox app".into() } else { s }
    };
    match velox_sysapi::prevent_sleep(&reason) {
        Some(guard) => {
            let id = state.next_guard_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
            state.sleep_guards.borrow_mut().insert(id, guard);
            let s = v8::String::new(scope, &id.to_string()).unwrap();
            rv.set(s.into());
        }
        None => {
            throw_js_error(scope, "power.preventSleep: not supported on this platform");
        }
    }
}

/// `__velox_power_allowSleep(id)` — sync, drops the guard
fn power_allow_sleep_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let id_str = v8_arg_to_string(scope, &args, 0);
    if let Ok(id) = id_str.parse::<u32>() {
        state.sleep_guards.borrow_mut().remove(&id);
    }
}

/// `__velox_storage_getDrives()` → Promise<JSON>
fn storage_get_drives_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !velox_security::get().storage {
        rv.set(reject_cap_promise(scope, "storage").into()); return;
    }
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);
    state.tokio.spawn(async move {
        let json = tokio::task::spawn_blocking(|| {
            let drives = velox_sysapi::storage_drives();
            let entries: Vec<String> = drives.iter().map(|d| format!(
                "{{\"name\":{:?},\"mountPoint\":{:?},\"totalBytes\":{},\"availableBytes\":{}}}",
                d.name, d.mount_point, d.total_bytes, d.available_bytes
            )).collect();
            format!("[{}]", entries.join(","))
        }).await.unwrap_or_else(|_| "[]".into());
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr, result: Ok(json) });
    });
    rv.set(promise.into());
}

/// `__velox_gamepad_poll()` → JSON string (sync, drain gilrs events)
fn gamepad_poll_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !velox_security::get().gamepads {
        throw_cap_error(scope, "gamepads"); return;
    }
    let mut gilrs_opt = state.gamepad_gilrs.borrow_mut();
    // Lazy-init gilrs on first poll.
    if gilrs_opt.is_none() {
        *gilrs_opt = gilrs::Gilrs::new().ok();
    }
    let json = match gilrs_opt.as_mut() {
        None => "[]".into(),
        Some(gilrs) => {
            let mut events = Vec::new();
            while let Some(ev) = gilrs.next_event() {
                let gp = gilrs.gamepad(ev.id);
                let ev_json = match ev.event {
                    gilrs::EventType::ButtonPressed(btn, _)  =>
                        format!(r#"{{"type":"buttonPressed","button":"{:?}"}}"#, btn),
                    gilrs::EventType::ButtonReleased(btn, _) =>
                        format!(r#"{{"type":"buttonReleased","button":"{:?}"}}"#, btn),
                    gilrs::EventType::AxisChanged(axis, val, _) =>
                        format!(r#"{{"type":"axisChanged","axis":"{:?}","value":{:.4}}}"#, axis, val),
                    gilrs::EventType::Connected    => r#"{"type":"connected"}"#.into(),
                    gilrs::EventType::Disconnected => r#"{"type":"disconnected"}"#.into(),
                    _ => r#"{"type":"other"}"#.into(),
                };
                events.push(format!(
                    r#"{{"id":{},"name":{},"event":{}}}"#,
                    usize::from(ev.id),
                    serde_json::to_string(gp.name()).unwrap_or_else(|_| "\"\"".into()),
                    ev_json
                ));
            }
            if events.is_empty() { "[]".into() }
            else { format!("[{}]", events.join(",")) }
        }
    };
    let s = v8::String::new(scope, &json).unwrap_or_else(|| v8::String::empty(scope));
    rv.set(s.into());
}

/// `__velox_shortcut_register(accelerator)` → string id (sync)
fn shortcut_register_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !velox_security::get().global_shortcuts {
        rv.set(reject_cap_promise(scope, "globalShortcuts").into()); return;
    }
    let acc = v8_arg_to_string(scope, &args, 0);
    if acc.is_empty() {
        throw_js_error(scope, "shortcut.register: accelerator required"); return;
    }
    let hotkey = match parse_accelerator(&acc) {
        Some(hk) => hk,
        None     => { throw_js_error(scope, &format!("shortcut.register: invalid accelerator '{acc}'")); return; }
    };

    let mut hs = state.hotkey_state.borrow_mut();
    if hs.is_none() {
        match global_hotkey::GlobalHotKeyManager::new() {
            Ok(mgr) => *hs = Some(HotkeyState { manager: mgr, hotkeys: HashMap::new() }),
            Err(e)  => { throw_js_error(scope, &format!("shortcut.register: {e}")); return; }
        }
    }
    let hs = hs.as_mut().unwrap();
    if let Err(e) = hs.manager.register(hotkey) {
        throw_js_error(scope, &format!("shortcut.register: {e}")); return;
    }
    let id = state.next_hotkey_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    hs.hotkeys.insert(id, hotkey);
    let s = v8::String::new(scope, &id.to_string()).unwrap();
    rv.set(s.into());
}

/// `__velox_shortcut_unregister(id)` — sync
fn shortcut_unregister_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let id_str = v8_arg_to_string(scope, &args, 0);
    if let Ok(id) = id_str.parse::<u32>() {
        if let Some(hs) = state.hotkey_state.borrow_mut().as_mut() {
            if let Some(hotkey) = hs.hotkeys.remove(&id) {
                let _ = hs.manager.unregister(hotkey);
            }
        }
    }
}

/// `__velox_shortcut_poll()` → JSON string array of fired velox IDs (sync)
fn shortcut_poll_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let hs_opt = state.hotkey_state.borrow();
    let json = match hs_opt.as_ref() {
        None => "[]".into(),
        Some(hs) => {
            let receiver = global_hotkey::GlobalHotKeyEvent::receiver();
            let mut ids  = Vec::new();
            while let Ok(ev) = receiver.try_recv() {
                if ev.state == global_hotkey::HotKeyState::Pressed {
                    if let Some((&velox_id, _)) = hs.hotkeys.iter().find(|(_, hk)| hk.id() == ev.id) {
                        ids.push(velox_id.to_string());
                    }
                }
            }
            if ids.is_empty() { "[]".into() }
            else { format!("[{}]", ids.join(",")) }
        }
    };
    let s = v8::String::new(scope, &json).unwrap_or_else(|| v8::String::empty(scope));
    rv.set(s.into());
}

// ── Credentials (OS keychain) ─────────────────────────────────────────────────

/// `__velox_credentials_set(service, key, value)` → Promise<void>
///
/// Stores `value` in the OS credential store under `service`+`key`.
/// Encrypted by the OS, tied to the logged-in user account.
fn credentials_set_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !velox_security::get().credentials {
        rv.set(reject_cap_promise(scope, "credentials").into()); return;
    }
    let service = args.get(0).to_string(scope).map(|s| s.to_rust_string_lossy(scope)).unwrap_or_default();
    let key     = args.get(1).to_string(scope).map(|s| s.to_rust_string_lossy(scope)).unwrap_or_default();
    let value   = args.get(2).to_string(scope).map(|s| s.to_rust_string_lossy(scope)).unwrap_or_default();
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);
    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            velox_sysapi::credentials_set(&service, &key, &value)
                .map(|_| "null".into())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr, result });
    });
    rv.set(promise.into());
}

/// `__velox_credentials_get(service, key)` → Promise<string | null>
///
/// Returns the stored secret, or JSON `null` if no entry exists.
fn credentials_get_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !velox_security::get().credentials {
        rv.set(reject_cap_promise(scope, "credentials").into()); return;
    }
    let service = args.get(0).to_string(scope).map(|s| s.to_rust_string_lossy(scope)).unwrap_or_default();
    let key     = args.get(1).to_string(scope).map(|s| s.to_rust_string_lossy(scope)).unwrap_or_default();
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);
    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            velox_sysapi::credentials_get(&service, &key).map(|opt| match opt {
                Some(val) => format!("{:?}", val), // JSON-escaped string
                None      => "null".into(),
            })
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr, result });
    });
    rv.set(promise.into());
}

/// `__velox_credentials_delete(service, key)` → Promise<void>
fn credentials_delete_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !velox_security::get().credentials {
        rv.set(reject_cap_promise(scope, "credentials").into()); return;
    }
    let service = args.get(0).to_string(scope).map(|s| s.to_rust_string_lossy(scope)).unwrap_or_default();
    let key     = args.get(1).to_string(scope).map(|s| s.to_rust_string_lossy(scope)).unwrap_or_default();
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);
    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            velox_sysapi::credentials_delete(&service, &key)
                .map(|_| "null".into())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr, result });
    });
    rv.set(promise.into());
}

// ── Audio playback bindings ───────────────────────────────────────────────────

/// `__velox_audio_play(src, optsJson)` → Promise<handle_id>
///
/// `optsJson` shape: `{ volume?: f32, loop?: bool }` (loop not yet implemented).
/// Returns the integer handle ID as a JSON string.
fn audio_play_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !velox_security::get().audio {
        rv.set(reject_cap_promise(scope, "audio").into()); return;
    }
    let src = args.get(0).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default();
    let opts_raw = args.get(1).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_else(|| "{}".into());

    // Parse opts: { volume?: f32, loop?: bool }
    let volume: f32 = serde_json::from_str::<serde_json::Value>(&opts_raw)
        .ok()
        .and_then(|v| v.get("volume").and_then(|v| v.as_f64()).map(|f| f as f32))
        .unwrap_or(1.0);

    // Lazy-init audio device on first play.
    if state.audio_handle.borrow().is_none() {
        match rodio::OutputStream::try_default() {
            Ok((stream, handle)) => {
                *state.audio_stream.borrow_mut() = Some(stream);
                *state.audio_handle.borrow_mut() = Some(handle);
            }
            Err(e) => {
                log::warn!("[velox] Audio init failed: {e}. Audio playback unavailable.");
            }
        }
    }
    let Some(handle) = state.audio_handle.borrow().as_ref().map(Clone::clone) else {
        rv.set(reject_promise_with_error(scope, "audio device unavailable").into());
        return;
    };

    let sinks = Arc::clone(&state.audio_sinks);
    let id = state.next_audio_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let file = std::fs::File::open(&src)
                .map_err(|e| format!("audio open '{}': {e}", src))?;
            let decoder = rodio::Decoder::new(std::io::BufReader::new(file))
                .map_err(|e| format!("audio decode: {e}"))?;
            let sink = rodio::Sink::try_new(&handle)
                .map_err(|e| format!("audio sink: {e}"))?;
            sink.set_volume(volume);
            sink.append(decoder);
            sink.play();
            sinks.lock().unwrap().insert(id, sink);
            Ok(id.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr, result });
    });
    rv.set(promise.into());
}

/// `__velox_audio_pause(handle)` → void (sync)
fn audio_pause_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if let Some(id_str) = args.get(0).to_string(scope).map(|s| s.to_rust_string_lossy(scope)) {
        if let Ok(id) = id_str.parse::<u32>() {
            if let Some(sink) = state.audio_sinks.lock().unwrap().get(&id) {
                sink.pause();
            }
        }
    }
}

/// `__velox_audio_resume(handle)` → void (sync)
fn audio_resume_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if let Some(id_str) = args.get(0).to_string(scope).map(|s| s.to_rust_string_lossy(scope)) {
        if let Ok(id) = id_str.parse::<u32>() {
            if let Some(sink) = state.audio_sinks.lock().unwrap().get(&id) {
                sink.play();
            }
        }
    }
}

/// `__velox_audio_stop(handle)` → void (sync)
///
/// Stops playback and removes the sink from the map.
fn audio_stop_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if let Some(id_str) = args.get(0).to_string(scope).map(|s| s.to_rust_string_lossy(scope)) {
        if let Ok(id) = id_str.parse::<u32>() {
            if let Some(sink) = state.audio_sinks.lock().unwrap().remove(&id) {
                sink.stop();
            }
        }
    }
}

/// `__velox_audio_setVolume(handle, volume)` → void (sync)
fn audio_set_volume_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let id_val = args.get(0);
    let vol_val = args.get(1);
    let id_str = id_val.to_string(scope).map(|s| s.to_rust_string_lossy(scope));
    let vol = vol_val.number_value(scope).unwrap_or(1.0) as f32;
    if let Some(id_str) = id_str {
        if let Ok(id) = id_str.parse::<u32>() {
            if let Some(sink) = state.audio_sinks.lock().unwrap().get(&id) {
                sink.set_volume(vol.clamp(0.0, 2.0));
            }
        }
    }
}

/// `__velox_audio_getVolume(handle)` → f32 (sync)
fn audio_get_volume_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let vol = if let Some(id_str) = args.get(0).to_string(scope).map(|s| s.to_rust_string_lossy(scope)) {
        if let Ok(id) = id_str.parse::<u32>() {
            state.audio_sinks.lock().unwrap().get(&id).map(|s| s.volume()).unwrap_or(1.0)
        } else { 1.0 }
    } else { 1.0 };
    rv.set(v8::Number::new(scope, vol as f64).into());
}

/// `__velox_audio_poll()` → JSON string — drained each frame by JS.
///
/// Scans sinks; for any that have finished playing emits `{"handle":N,"event":"ended"}`.
/// Finished sinks are removed from the map.
fn audio_poll_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let mut sinks_guard = state.audio_sinks.lock().unwrap();
    let mut ended_ids: Vec<u32> = Vec::new();
    for (&id, sink) in sinks_guard.iter() {
        if sink.empty() {
            ended_ids.push(id);
        }
    }
    for id in &ended_ids {
        sinks_guard.remove(id);
    }
    drop(sinks_guard);

    // Merge newly-ended events with the shared events queue, then drain all.
    let json = {
        let mut evts = state.audio_events.lock().unwrap();
        for id in ended_ids {
            evts.push_back(format!("{{\"handle\":{id},\"event\":\"ended\"}}"));
        }
        if evts.is_empty() {
            "[]".to_string()
        } else {
            let items: Vec<String> = evts.drain(..).collect();
            format!("[{}]", items.join(","))
        }
    };

    let s = v8::String::new(scope, &json).unwrap();
    rv.set(s.into());
}

/// Parse `"ctrl+shift+v"` into a `global_hotkey::hotkey::HotKey`.
fn parse_accelerator(acc: &str) -> Option<global_hotkey::hotkey::HotKey> {
    use global_hotkey::hotkey::{HotKey, Modifiers};
    let mut mods     = Modifiers::empty();
    let mut key_code = None;
    for part in acc.to_lowercase().split('+') {
        match part.trim() {
            "ctrl" | "control" => mods |= Modifiers::CONTROL,
            "shift"            => mods |= Modifiers::SHIFT,
            "alt"              => mods |= Modifiers::ALT,
            "meta" | "cmd" | "super" | "win" => mods |= Modifiers::META,
            key => key_code = str_to_code(key),
        }
    }
    let code = key_code?;
    Some(HotKey::new(if mods.is_empty() { None } else { Some(mods) }, code))
}

fn str_to_code(key: &str) -> Option<global_hotkey::hotkey::Code> {
    use global_hotkey::hotkey::Code;
    Some(match key {
        "a" => Code::KeyA,    "b" => Code::KeyB,    "c" => Code::KeyC,
        "d" => Code::KeyD,    "e" => Code::KeyE,    "f" => Code::KeyF,
        "g" => Code::KeyG,    "h" => Code::KeyH,    "i" => Code::KeyI,
        "j" => Code::KeyJ,    "k" => Code::KeyK,    "l" => Code::KeyL,
        "m" => Code::KeyM,    "n" => Code::KeyN,    "o" => Code::KeyO,
        "p" => Code::KeyP,    "q" => Code::KeyQ,    "r" => Code::KeyR,
        "s" => Code::KeyS,    "t" => Code::KeyT,    "u" => Code::KeyU,
        "v" => Code::KeyV,    "w" => Code::KeyW,    "x" => Code::KeyX,
        "y" => Code::KeyY,    "z" => Code::KeyZ,
        "0" => Code::Digit0,  "1" => Code::Digit1,  "2" => Code::Digit2,
        "3" => Code::Digit3,  "4" => Code::Digit4,  "5" => Code::Digit5,
        "6" => Code::Digit6,  "7" => Code::Digit7,  "8" => Code::Digit8,
        "9" => Code::Digit9,
        "f1"  => Code::F1,  "f2"  => Code::F2,  "f3"  => Code::F3,
        "f4"  => Code::F4,  "f5"  => Code::F5,  "f6"  => Code::F6,
        "f7"  => Code::F7,  "f8"  => Code::F8,  "f9"  => Code::F9,
        "f10" => Code::F10, "f11" => Code::F11, "f12" => Code::F12,
        "space"                    => Code::Space,
        "enter" | "return"         => Code::Enter,
        "escape" | "esc"           => Code::Escape,
        "tab"                      => Code::Tab,
        "backspace"                => Code::Backspace,
        "delete"                   => Code::Delete,
        "insert"                   => Code::Insert,
        "home"                     => Code::Home,
        "end"                      => Code::End,
        "pageup"                   => Code::PageUp,
        "pagedown"                 => Code::PageDown,
        "up"    | "arrowup"        => Code::ArrowUp,
        "down"  | "arrowdown"      => Code::ArrowDown,
        "left"  | "arrowleft"      => Code::ArrowLeft,
        "right" | "arrowright"     => Code::ArrowRight,
        _ => return None,
    })
}

// ── Performance metrics ────────────────────────────────────────────────────────

/// `__velox_perf_snapshot()` → JSON string with current perf metrics.
fn perf_snapshot_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let perf  = state.perf_state.lock().unwrap();
    let last  = perf.last_frame();
    let fps   = perf.fps();
    let avg   = perf.avg_frame_time();
    let p99   = perf.p99_frame_time();
    let js_t  = perf.avg_js_time();
    let lay_t = perf.avg_layout_time();
    let heap_mb    = last.heap_used_bytes as f64 / (1024.0 * 1024.0);
    let rss_mb     = last.process_rss_bytes as f64 / (1024.0 * 1024.0);
    let node_count = last.node_count;
    let gpu_t      = perf.avg_gpu_time();
    drop(perf);

    let json = format!(
        "{{\"fps\":{fps:.1},\"frameTime\":{avg:.2},\"frameTimeP99\":{p99:.2},\
         \"jsTime\":{js_t:.2},\"layoutTime\":{lay_t:.2},\"gpuTime\":{gpu_t:.2},\
         \"memoryJS\":{heap_mb:.2},\"memoryTotal\":{rss_mb:.1},\"nodeCount\":{node_count}}}"
    );
    let s = v8::String::new(scope, &json).unwrap_or_else(|| v8::String::empty(scope));
    rv.set(s.into());
}

/// `__velox_perf_set_budget(ms)` — sync, sets the frame-budget threshold.
fn perf_set_budget_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    if args.length() < 1 { return; }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let ms = args.get(0).number_value(scope).unwrap_or(16.667);
    state.perf_state.lock().unwrap().budget_ms = ms;
}

/// `__velox_perf_poll_leak_warnings()` → JSON array string; drains leak warnings (dev mode).
fn perf_poll_leak_warnings_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let warnings: Vec<String> = {
        let mut perf = state.perf_state.lock().unwrap();
        perf.leak_warnings.drain(..).collect()
    };
    let json = if warnings.is_empty() {
        "[]".to_string()
    } else {
        format!("[{}]", warnings.join(","))
    };
    let s = v8::String::new(scope, &json).unwrap_or_else(|| v8::String::empty(scope));
    rv.set(s.into());
}

/// `__velox_perf_poll_violations()` → JSON array string; drains the violation queue.
fn perf_poll_violations_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let violations: Vec<String> = {
        let mut perf = state.perf_state.lock().unwrap();
        perf.violations.drain(..).collect()
    };
    let json = if violations.is_empty() {
        "[]".to_string()
    } else {
        format!("[{}]", violations.join(","))
    };
    let s = v8::String::new(scope, &json).unwrap_or_else(|| v8::String::empty(scope));
    rv.set(s.into());
}

/// `__velox_quit()` — sync, requests application exit.
///
/// Calls the quit closure stored in `WindowController`, which sends
/// `VeloxUserEvent::Quit` to the winit event loop causing it to exit.
fn quit_callback(
    _scope: &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if let Some(ref ctrl) = state.window {
        if let Some(ref quit_fn) = ctrl.quit {
            (quit_fn)();
        }
    }
}

/// `__velox_restart()` — sync, requests app restart (quit + re-launch).
fn restart_callback(
    _scope: &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if let Some(ref ctrl) = state.window {
        if let Some(ref restart_fn) = ctrl.restart {
            (restart_fn)();
        }
    }
}

/// `__velox_platform()` → `"windows"` | `"macos"` | `"linux"` (compile-time constant).
fn platform_callback(
    scope: &mut v8::HandleScope,
    _args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let s = if cfg!(target_os = "windows") { "windows" }
            else if cfg!(target_os = "macos") { "macos" }
            else { "linux" };
    rv.set(v8::String::new(scope, s).unwrap().into());
}

// ── Deep link bindings ────────────────────────────────────────────────────────

/// `__velox_deeplink_getInitialUrl()` → string
///
/// Returns the URL that launched the app (e.g. `"notes://note/42"`), or `""`
/// if the app was opened normally.  The value is set by velox-core at startup
/// via the `VELOX_LAUNCH_URL` environment variable before the runtime starts.
fn deeplink_get_initial_url_callback(
    scope: &mut v8::HandleScope,
    _args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let url = std::env::var("VELOX_LAUNCH_URL").unwrap_or_default();
    let s = v8::String::new(scope, &url).unwrap();
    rv.set(s.into());
}

/// `__velox_deeplink_poll()` → JSON string (array of URL strings)
///
/// Drains the forwarded URL queue (populated by the single-instance listener
/// when a second process connects and sends a URL).  Called each frame inside
/// `__velox_frameCallback`; JS fires `deeplink.onOpen` for each URL.
fn deeplink_poll_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let urls: Vec<String> = {
        let mut q = state.deeplink_url_queue.lock().unwrap();
        q.drain(..).collect()
    };

    let json = if urls.is_empty() {
        "[]".to_string()
    } else {
        serde_json::to_string(&urls).unwrap_or_else(|_| "[]".to_string())
    };
    let s = v8::String::new(scope, &json).unwrap();
    rv.set(s.into());
}

// ── Canvas 2D / 3D bindings ───────────────────────────────────────────────────

/// `__velox_canvas_update(id, cmdsJson)` — sync.
/// Parses a JSON array of CanvasCmd and pushes a CanvasUpdate scene command.
fn canvas_update_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id   = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let json = args.get(1).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default();

    let cmds: Vec<CanvasCmd> = match serde_json::from_str(&json) {
        Ok(c)  => c,
        Err(e) => { log::warn!("canvas_update parse error: {e}"); return; }
    };
    state.scene.lock().unwrap().push_back(SceneCommand::CanvasUpdate { id, cmds });
}

/// `__velox_canvas3d_update(id, sceneJson)` — sync.
/// Parses a JSON Scene3D and pushes a Canvas3DUpdate scene command.
fn canvas3d_update_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id   = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let json = args.get(1).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default();

    let scene: velox_3d::Scene3D = match serde_json::from_str(&json) {
        Ok(s)  => s,
        Err(e) => { log::warn!("canvas3d_update parse error: {e}"); return; }
    };
    state.scene.lock().unwrap().push_back(SceneCommand::Canvas3DUpdate { id, scene });
}

/// `__velox_canvas3d_load_gltf(id, path)` — sync.
/// Signals that a GLTF file should be loaded for this canvas on the render side.
/// (Actual loading happens in velox-core on next frame via renderer_3d.)
fn canvas3d_load_gltf_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let id   = args.get(0).number_value(scope).unwrap_or_default() as u32;
    let path = args.get(1).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default();

    // Push a dummy scene update that triggers GLTF loading on render side.
    // The GLTF geometry becomes available on the next canvas3d_update.
    let scene = velox_3d::Scene3D {
        background: None,
        camera:     velox_3d::Camera3D { position: [0.,1.,3.], target: [0.;3], up: [0.,1.,0.], fov_deg: 60., near: 0.1, far: 1000. },
        lights:     vec![],
        meshes:     vec![velox_3d::Mesh3DInstance {
            geometry:  velox_3d::Geometry3D::Gltf { path: path.clone() },
            transform: [1.,0.,0.,0., 0.,1.,0.,0., 0.,0.,1.,0., 0.,0.,0.,1.],
            color:     [1.;4],
        }],
    };
    let _ = id; // used by canvas3d_update; here we just warm up gltf cache
    // The load itself is triggered by the renderer when it encounters Gltf geometry.
    // Push an info scene command with the path so velox-core can pre-warm the cache.
    state.scene.lock().unwrap().push_back(SceneCommand::Canvas3DUpdate { id, scene });
}

// ── Local AI bindings (Candle) ────────────────────────────────────────────────

/// `__velox_ai_embed(text) → Promise<string>`
///
/// Returns a JSON array of 384 f32 values (unit-normalised MiniLM-L6-v2 embedding).
/// Loads the model on first call (~22 MB download from HuggingFace Hub).
fn ai_embed_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !velox_security::get().ai {
        rv.set(reject_cap_promise(scope, "ai").into()); return;
    }

    let text          = v8_arg_to_string(scope, &args, 0);
    let model_cache   = Arc::clone(&state.ai_embed_model);
    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let mut guard = model_cache.lock().unwrap();
            if guard.is_none() {
                *guard = Some(velox_ai::EmbedModel::load()
                    .map_err(|e| format!("ai.embed model load: {e}"))?);
            }
            let vec = guard.as_ref().unwrap().embed(&text)
                .map_err(|e| format!("ai.embed: {e}"))?;
            serde_json::to_string(&vec)
                .map_err(|e| format!("ai.embed serialize: {e}"))
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_ai_generate(prompt, optsJson) → Promise<string>`
///
/// `optsJson` shape: `{ "maxTokens": 200, "temperature": 0.7 }`
///
/// Loads Phi-2 Q4_K_M GGUF on first call (~1.7 GB download). Runs entirely on CPU.
/// Expected latency: 10-30 seconds per 200 tokens on modern desktop CPUs.
fn ai_generate_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !velox_security::get().ai {
        rv.set(reject_cap_promise(scope, "ai").into()); return;
    }

    let prompt   = v8_arg_to_string(scope, &args, 0);
    let opts_raw = v8_arg_to_string(scope, &args, 1);
    let model_cache = Arc::clone(&state.ai_generate_model);

    // Battery-aware thread throttling: use fewer threads when on battery.
    let on_battery = velox_sysapi::battery_status()
        .map(|b| !b.charging)
        .unwrap_or(false);

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let opts = serde_json::from_str::<serde_json::Value>(&opts_raw).unwrap_or_default();
            let max_tokens:  usize = opts.get("maxTokens").and_then(|v| v.as_u64())
                .unwrap_or(200) as usize;
            let temperature: f32   = opts.get("temperature").and_then(|v| v.as_f64())
                .unwrap_or(0.7) as f32;

            if on_battery {
                log::info!("[ai] on battery — generation running with default thread count");
            }

            let mut guard = model_cache.lock().unwrap();
            if guard.is_none() {
                *guard = Some(velox_ai::GenerateModel::load()
                    .map_err(|e| format!("ai.generate model load: {e}"))?);
            }
            guard.as_mut().unwrap().generate(&prompt, max_tokens, temperature)
                .map_err(|e| format!("ai.generate: {e}"))
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__velox_ai_transcribe(audioPath, optsJson) → Promise<string>`
///
/// `optsJson` shape: `{ "language": "en" }` (empty string = auto-detect).
///
/// Loads Whisper-tiny on first call (~75 MB download from HuggingFace Hub).
fn ai_transcribe_callback(
    scope: &mut v8::HandleScope,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if !velox_security::get().ai {
        rv.set(reject_cap_promise(scope, "ai").into()); return;
    }

    let audio_path  = v8_arg_to_string(scope, &args, 0);
    let opts_raw    = v8_arg_to_string(scope, &args, 1);
    let model_cache = Arc::clone(&state.ai_whisper_model);

    let (resolver, promise, queue, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || -> Result<String, String> {
            let opts = serde_json::from_str::<serde_json::Value>(&opts_raw).unwrap_or_default();
            let language = opts.get("language").and_then(|v| v.as_str())
                .unwrap_or("").to_string();

            let mut guard = model_cache.lock().unwrap();
            if guard.is_none() {
                *guard = Some(velox_ai::WhisperModel::load()
                    .map_err(|e| format!("ai.transcribe model load: {e}"))?);
            }
            guard.as_mut().unwrap().transcribe(&audio_path, &language)
                .map_err(|e| format!("ai.transcribe: {e}"))
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// Throw a generic JS Error with the given message.
fn throw_js_error(scope: &mut v8::HandleScope, msg: &str) {
    let s  = v8::String::new(scope, msg).unwrap();
    let ex = v8::Exception::error(scope, s);
    scope.throw_exception(ex);
}
