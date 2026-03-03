//! Native function bindings exposed to JavaScript.

use std::{
    collections::VecDeque,
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
    /// When true, draw a blinking-cursor rect after the text.
    pub show_cursor: Option<bool>,
}

#[derive(Debug, Clone)]
pub enum SceneCommand {
    CreateNode  { id: u32, node_type: NodeType, props: NodeProps },
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
) {
    set_func(scope, global, "__velox_getTime", get_time);
    set_func(scope, global, "__velox_log",     js_log);

    // Store all shared state in a heap-allocated struct, hand the raw
    // pointer to V8 via External so callbacks can recover it.
    let state = Box::new(AsyncState {
        queue,
        tokio,
        scene,
        events,
        layout_cache,
        next_id: std::sync::atomic::AtomicU32::new(1),
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

    register!("__velox_readFile",    read_file_callback);
    register!("__velox_createNode",  create_node_callback);
    register!("__velox_appendChild", append_child_callback);
    register!("__velox_updateNode",  update_node_callback);
    register!("__velox_removeNode",  remove_node_callback);
    register!("__velox_setRoot",     set_root_callback);
    register!("__velox_pollEvents",  poll_events_callback);
    register!("__velox_getLayout",   get_layout_callback);
}

struct AsyncState {
    queue:        CompletionQueue,
    tokio:        Handle,
    scene:        SceneQueue,
    events:       EventQueue,
    layout_cache: LayoutCache,
    next_id:      std::sync::atomic::AtomicU32,
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

    props.show_cursor = get_bool_prop(scope, obj, "showCursor");

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

// ── Async binding: __velox_readFile ───────────────────────────────────────────

fn read_file_callback(
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

    let resolver = v8::PromiseResolver::new(scope).unwrap();
    let promise  = resolver.get_promise(scope);
    rv.set(promise.into());

    let global_resolver  = v8::Global::new(scope, resolver);
    let resolver_ptr     = Box::into_raw(Box::new(global_resolver)) as usize;
    let queue_clone      = Arc::clone(&state.queue);

    state.tokio.spawn(async move {
        let result = tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| e.to_string());
        queue_clone
            .lock()
            .unwrap()
            .push_back(Completion { resolver_ptr, result });
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
