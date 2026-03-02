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
pub type SceneQueue = Arc<Mutex<VecDeque<SceneCommand>>>;

pub fn new_completion_queue() -> CompletionQueue {
    Arc::new(Mutex::new(VecDeque::new()))
}

pub fn new_scene_queue() -> SceneQueue {
    Arc::new(Mutex::new(VecDeque::new()))
}

#[derive(Debug, Clone)]
pub enum NodeType {
    View,
    Text,
}

#[derive(Debug, Clone, Default)]
pub struct NodeProps {
    pub width:  Option<f32>,
    pub height: Option<f32>,
    pub text:   Option<String>,
    pub font_size: Option<f32>,
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
    scope:  &mut v8::HandleScope,
    global: v8::Local<v8::Object>,
    queue:  CompletionQueue,
    tokio:  Handle,
    scene:  SceneQueue,
) {
    set_func(scope, global, "__velox_getTime", get_time);
    set_func(scope, global, "__velox_log",     js_log);

    // Store queue + tokio handle in a heap-allocated struct, hand the raw
    // pointer to V8 via External so the callback can recover it.
    let state = Box::new(AsyncState {
        queue,
        tokio,
        scene,
        next_id: std::sync::atomic::AtomicU32::new(1),
    });
    let ptr   = Box::into_raw(state) as *mut std::ffi::c_void;
    // Safety: ptr is valid for the lifetime of the isolate.
    let ext   = v8::External::new(scope, ptr);
    let tmpl  = v8::FunctionTemplate::builder(read_file_callback)
        .data(ext.into())
        .build(scope);
    let func  = tmpl.get_function(scope).unwrap();
    let key   = v8::String::new(scope, "__velox_readFile").unwrap();
    global.set(scope, key.into(), func.into());

    let tmpl  = v8::FunctionTemplate::builder(create_node_callback)
        .data(ext.into())
        .build(scope);
    let func  = tmpl.get_function(scope).unwrap();
    let key   = v8::String::new(scope, "__velox_createNode").unwrap();
    global.set(scope, key.into(), func.into());

    let tmpl  = v8::FunctionTemplate::builder(append_child_callback)
        .data(ext.into())
        .build(scope);
    let func  = tmpl.get_function(scope).unwrap();
    let key   = v8::String::new(scope, "__velox_appendChild").unwrap();
    global.set(scope, key.into(), func.into());

    let tmpl  = v8::FunctionTemplate::builder(update_node_callback)
        .data(ext.into())
        .build(scope);
    let func  = tmpl.get_function(scope).unwrap();
    let key   = v8::String::new(scope, "__velox_updateNode").unwrap();
    global.set(scope, key.into(), func.into());

    let tmpl  = v8::FunctionTemplate::builder(remove_node_callback)
        .data(ext.into())
        .build(scope);
    let func  = tmpl.get_function(scope).unwrap();
    let key   = v8::String::new(scope, "__velox_removeNode").unwrap();
    global.set(scope, key.into(), func.into());

    let tmpl  = v8::FunctionTemplate::builder(set_root_callback)
        .data(ext.into())
        .build(scope);
    let func  = tmpl.get_function(scope).unwrap();
    let key   = v8::String::new(scope, "__velox_setRoot").unwrap();
    global.set(scope, key.into(), func.into());
}

struct AsyncState {
    queue: CompletionQueue,
    tokio: Handle,
    scene: SceneQueue,
    next_id: std::sync::atomic::AtomicU32,
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

fn parse_props(
    scope: &mut v8::HandleScope,
    value: v8::Local<v8::Value>,
) -> NodeProps {
    let mut props = NodeProps::default();
    let Some(obj) = value.to_object(scope) else { return props };
    let width_key = v8::String::new(scope, "width").unwrap();
    if let Some(v) = obj.get(scope, width_key.into()) {
        if v.is_number() {
            props.width = Some(v.number_value(scope).unwrap_or_default() as f32);
        }
    }
    let height_key = v8::String::new(scope, "height").unwrap();
    if let Some(v) = obj.get(scope, height_key.into()) {
        if v.is_number() {
            props.height = Some(v.number_value(scope).unwrap_or_default() as f32);
        }
    }
    let text_key = v8::String::new(scope, "text").unwrap();
    if let Some(v) = obj.get(scope, text_key.into()) {
        if v.is_string() {
            props.text = v
                .to_string(scope)
                .map(|s| s.to_rust_string_lossy(scope));
        }
    }
    let font_key = v8::String::new(scope, "fontSize").unwrap();
    if let Some(v) = obj.get(scope, font_key.into()) {
        if v.is_number() {
            props.font_size = Some(v.number_value(scope).unwrap_or_default() as f32);
        }
    }
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

// ── Async binding: __velox_readFile ───────────────────────────────────────────

fn read_file_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    // Recover AsyncState from the External data slot.
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    // Safety: pointer was set in register_all, isolate still alive.
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let path = args
        .get(0)
        .to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope))
        .unwrap_or_default();

    // Create Promise + resolver; hand the Promise back to JS.
    let resolver = v8::PromiseResolver::new(scope).unwrap();
    let promise  = resolver.get_promise(scope);
    rv.set(promise.into());

    // Box the Global, turn it into a raw usize — the only Send-safe way
    // to get a v8::Global across a thread boundary.
    let global_resolver  = v8::Global::new(scope, resolver);
    let resolver_ptr     = Box::into_raw(Box::new(global_resolver)) as usize;
    let queue_clone      = Arc::clone(&state.queue);

    state.tokio.spawn(async move {
        let result = tokio::fs::read_to_string(&path)
            .await
            .map_err(|e| e.to_string());

        // Push only plain data into the queue.
        // The usize is reconstructed into a Global in tick() on the V8 thread.
        queue_clone
            .lock()
            .unwrap()
            .push_back(Completion { resolver_ptr, result });
    });
}

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

    state
        .scene
        .lock()
        .unwrap()
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
    let child_id = args.get(1).number_value(scope).unwrap_or_default() as u32;

    state
        .scene
        .lock()
        .unwrap()
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
