//! Native function bindings exposed to JavaScript.

use std::{
    collections::{HashMap, VecDeque},
    sync::{Arc, Mutex},
    time::{SystemTime, UNIX_EPOCH},
};

use tokio::runtime::Handle;

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

/// An input event pushed by the Rust side and consumed by JS via __velox_pollEvents.
#[derive(Debug, Clone)]
pub enum InputEvent {
    /// Mouse/touch press or release at window-relative pixel coordinates.
    MouseButton { x: f32, y: f32, button: u8, pressed: bool },
    /// Cursor moved to pixel position.
    CursorMoved { x: f32, y: f32 },
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

    // ── Cursor UI ───────────────────────────────────────────────────────────
    /// When true, draw a text cursor rect after the text.
    pub show_cursor: Option<bool>,

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
}

#[derive(Debug, Clone)]
pub enum SceneCommand {
    CreateNode  { id: u32, node_type: NodeType, props: NodeProps },
    CreateImage { id: u32, path: String },
    AppendChild { parent_id: u32, child_id: u32 },
    UpdateNode  { id: u32, props: NodeProps },
    RemoveNode  { id: u32 },
    SetRoot     { id: u32 },
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
) {
    set_func(scope, global, "__velox_getTime", get_time);
    set_func(scope, global, "__velox_log",     js_log);

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
        db_pools:      Arc::new(Mutex::new(HashMap::new())),
        next_db_id:    std::sync::atomic::AtomicU32::new(1),
        vector_stores: Arc::new(Mutex::new(HashMap::new())),
        next_vdb_id:   std::sync::atomic::AtomicU32::new(1),
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
    register!("__velox_readFile",    read_file_callback);
    register!("__velox_createImage", create_image_callback);
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
        "text" => NodeType::Text,
        "image" => NodeType::Image,
        _ => NodeType::View,
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

    props.show_cursor   = get_bool_prop(scope, obj, "showCursor");
    props.text_align    = get_str_prop(scope, obj, "textAlign");
    props.border_width  = get_num_prop(scope, obj, "borderWidth");
    props.border_color  = get_color_prop(scope, obj, "borderColor");

    props.clip            = get_bool_prop(scope, obj, "clip");
    props.scroll_offset_y = get_num_prop(scope, obj, "scrollOffsetY");
    props.image_id        = get_num_prop(scope, obj, "imageId").map(|v| v as u32);
    props.image_resize_mode = get_str_prop(scope, obj, "resizeMode");

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
        throw_cap_error(scope, "fs.write");
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
        throw_cap_error(scope, "fs.write");
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
        throw_cap_error(scope, "fs.read");
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
        throw_cap_error(scope, "fs.write");
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
        throw_cap_error(scope, "fs.write");
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
        throw_cap_error(scope, "db");
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
        throw_cap_error(scope, "db");
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
        throw_cap_error(scope, "db");
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
        throw_cap_error(scope, "db");
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
        throw_cap_error(scope, "db");
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
        throw_cap_error(scope, "dialog");
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
        throw_cap_error(scope, "dialog");
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
        throw_cap_error(scope, "dialog");
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
        throw_cap_error(scope, "clipboard");
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
        throw_cap_error(scope, "clipboard");
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
        throw_cap_error(scope, "notification");
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
        throw_cap_error(scope, "db");
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
        throw_cap_error(scope, "db");
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
        throw_cap_error(scope, "db");
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
        throw_cap_error(scope, "db");
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

/// Throw a JS Error for a missing capability.
fn throw_cap_error(scope: &mut v8::HandleScope, cap: &str) {
    let msg = format!(
        "Capability required: {cap} — add it to velox.config.json under \"capabilities\""
    );
    throw_js_error(scope, &msg);
}

/// Throw a generic JS Error with the given message.
fn throw_js_error(scope: &mut v8::HandleScope, msg: &str) {
    let s  = v8::String::new(scope, msg).unwrap();
    let ex = v8::Exception::error(scope, s);
    scope.throw_exception(ex);
}
