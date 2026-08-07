//! `__glyx_window_create`/`__glyx_ipc_send`/`__glyx_ipc_poll`/`__glyx_backend_call`
//! bindings, ported from `bind_net.rs`'s "Multi-window + IPC bindings" section
//! and `bind_updater.rs`'s `backend_call_callback`.
//!
//! This is the structural piece that was deferred through the rest of the
//! binding-port sweep: it needs `QuickJsRuntime` to actually carry
//! `ipc_bus`/`my_handle`/`next_window_id`/`backend_commands` state (wired up
//! in `QuickJsRuntime::new_with_ipc`), not just a binding function.
//!
//! `backend_call`'s sync JS-registered-handler path (`js_backend_commands`) IS
//! now ported — `eval_js_plugins` below mirrors V8's identical pass in
//! `bindings/mod.rs`'s `register_all`: eval each plugin's bundled IIFE, walk
//! its exports object's own function properties into a
//! `cmd_name -> (global_name, export_key)` map. Dev-mode hot-reload (`reload_js_plugin`,
//! mirroring V8's `reload_plugin`) is ported too — editing a plugin during
//! `glyx dev` picks up live on QuickJS the same as V8.
//!
//! Deliberately NOT storing `Persistent<Function>` handles here: an earlier
//! version did, and crashed on runtime teardown
//! (`Assertion failed: list_empty(&rt->gc_obj_list)`) — a `Persistent`
//! captured inside a Rust closure that itself becomes a QuickJS-native
//! function value (the registered `__glyx_backend_call` binding) creates a
//! reference cycle between the Rust heap and the QuickJS heap that neither
//! GC can see through. Storing plain owned Strings and re-resolving the
//! function fresh from `globalThis` on every call sidesteps the cycle
//! entirely, at the cost of a cheap property lookup per call instead of a
//! pre-resolved handle. This also makes hot-reload simpler than V8's: since
//! nothing is pre-resolved, reloading a plugin only needs to re-eval its
//! IIFE and refresh the command-name map for any added/removed exports —
//! unchanged exports need no bookkeeping at all, the next call just
//! resolves the (already-updated-by-eval) function fresh as usual.

use std::cell::RefCell;
use std::collections::HashMap;
use std::rc::Rc;

use rquickjs::{Ctx, Object, Value};
use tokio::runtime::Handle;

use crate::bindings::{CompletionQueue, IpcBus, RedrawRequest, WindowController};
use crate::quickjs_runtime::QuickJsRuntime;
use crate::BackendRegistry;

/// `cmd_name -> (global_name, export_key)` for every exported function across
/// all loaded JS plugins, prefixed per `JsPlugin::prefix` (e.g. `"db.getAll"`
/// -> `("__glyx_plugin_db", "getAll")`). No JS values held in Rust — see the
/// module doc for why. `RefCell`-wrapped so `reload_js_plugin` can mutate it
/// in place after startup (single-threaded, same as everything else on
/// `QuickJsRuntime`).
pub(crate) type JsBackendCommands = Rc<RefCell<HashMap<String, (String, String)>>>;

/// Eval one plugin's bundled IIFE and walk its exports object's own function
/// properties into `out`, prefixed per `JsPlugin::prefix`. Shared by initial
/// registration (`eval_js_plugins`, all plugins at once) and hot-reload
/// (`reload_js_plugin`, one plugin).
fn collect_plugin_exports<'js>(ctx: &Ctx<'js>, plugin: &crate::JsPlugin, out: &mut HashMap<String, (String, String)>) {
    let globals = ctx.globals();
    let exports_val: Value = match globals.get(plugin.global_name.as_str()) {
        Ok(v) => v,
        Err(_) => return,
    };
    let Some(exports) = exports_val.into_object() else {
        log::warn!("[plugins] plugin {:?} did not set global '{}'", plugin.prefix, plugin.global_name);
        return;
    };
    for result in exports.props::<String, Value>() {
        let Ok((key, val)) = result else { continue };
        if key.is_empty() || !val.is_function() { continue; }
        let cmd_name = match &plugin.prefix {
            Some(ns) => format!("{ns}.{key}"),
            None     => key.clone(),
        };
        out.insert(cmd_name, (plugin.global_name.clone(), key.clone()));
        log::info!("[plugins] registered JS command '{}' from plugin {:?}", key, plugin.prefix);
    }
}

/// Eval every JS plugin's bundled IIFE and populate `commands` with their
/// exported function locations — mirrors `bindings::mod::register_all`'s V8
/// pass (same combined-eval + walk-own-properties approach), just via
/// rquickjs. Populates the given (already-constructed) shared cell in place
/// rather than returning a new one, so the exact same `Rc<RefCell<...>>` is
/// shared between the registered `backend_call` closure and `reload_plugin`.
pub(crate) fn eval_js_plugins<'js>(ctx: &Ctx<'js>, plugins: &crate::JsPlugins, commands: &JsBackendCommands) {
    if plugins.is_empty() {
        return;
    }

    let combined: String = plugins.iter()
        .map(|p| p.bundled_js.as_str())
        .collect::<Vec<_>>()
        .join(";\n");
    if let Err(e) = ctx.eval::<(), _>(combined) {
        log::error!("[plugins] eval error: {e}");
    }

    let mut map = commands.borrow_mut();
    for plugin in plugins.iter() {
        collect_plugin_exports(ctx, plugin, &mut map);
    }
}

/// Re-eval one plugin's bundled IIFE (a fresh rebundle after a dev-mode file
/// edit) and refresh `commands` for its exports — mirrors V8's
/// `reload_plugin_in_scope` exactly (remove old entries for this plugin's
/// prefix, re-eval, re-collect), just without any `Persistent<Function>`
/// bookkeeping since nothing is pre-resolved here.
pub(crate) fn reload_js_plugin<'js>(
    ctx: &Ctx<'js>, commands: &JsBackendCommands,
    global_name: &str, prefix: Option<&str>, bundled_js: &str,
) {
    {
        let mut map = commands.borrow_mut();
        match prefix {
            Some(ns) => {
                let pfx = format!("{ns}.");
                map.retain(|k, _| !k.starts_with(&pfx));
            }
            None => {
                // Flat prefix: remove keys that don't contain '.' — same
                // convention as V8's reload_plugin_in_scope.
                map.retain(|k, _| k.contains('.'));
            }
        }
    }

    if let Err(e) = ctx.eval::<(), _>(bundled_js.to_string()) {
        log::error!("[plugin HMR] eval error for '{global_name}': {e}");
        return;
    }

    let plugin = crate::JsPlugin {
        prefix: prefix.map(String::from),
        bundled_js: String::new(), // already eval'd above, unused by collect_plugin_exports
        global_name: global_name.to_string(),
        capabilities: vec![],
        entry: None,
    };
    let mut map = commands.borrow_mut();
    collect_plugin_exports(ctx, &plugin, &mut map);
}

/// Look up a registered JS command's function fresh from `globalThis` — see
/// the module doc for why this isn't a pre-resolved `Persistent<Function>`.
fn resolve_js_command<'js>(ctx: &Ctx<'js>, global_name: &str, key: &str) -> rquickjs::Result<rquickjs::Function<'js>> {
    let globals = ctx.globals();
    let exports: Object<'js> = globals.get(global_name)?;
    exports.get(key)
}

/// `__glyx_window_create(optsJson) -> Promise<string>` — handle as string.
pub(crate) fn window_create<'js>(
    ctx: Ctx<'js>, opts_json: String, ipc_bus: IpcBus, next_window_id: std::sync::Arc<std::sync::atomic::AtomicU32>,
    window: Option<WindowController>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    const MAX_WINDOWS: usize = 10;
    let open_count = ipc_bus.lock().len();
    if open_count >= MAX_WINDOWS {
        return Err(rquickjs::Exception::throw_message(&ctx, &format!(
            "glyxWindow.create: window limit reached ({open_count} open, max {MAX_WINDOWS})"
        )));
    }

    let opts: serde_json::Value = serde_json::from_str(&opts_json).unwrap_or_default();
    let title  = opts.get("title").and_then(|v| v.as_str()).unwrap_or("Window").to_string();
    let width  = opts.get("width").and_then(|v| v.as_u64()).unwrap_or(800) as u32;
    let height = opts.get("height").and_then(|v| v.as_u64()).unwrap_or(600) as u32;

    let allow_dup = opts.get("allowDuplicate").and_then(|v| v.as_bool()).unwrap_or(false);
    let dedupe_key = match opts.get("key").and_then(|v| v.as_str()) {
        Some(k) if !k.is_empty() => k.to_string(),
        _ if crate::prevent_duplicate_windows() && !allow_dup => title.clone(),
        _ => String::new(),
    };
    if let Some(existing) = crate::window_registry_find_and_focus(&dedupe_key) {
        log::info!("glyxWindow.create: '{dedupe_key}' already open (handle {existing}) — focusing it.");
        let (handle, promise) = QuickJsRuntime::make_promise(&ctx)?;
        QuickJsRuntime::settle(&ctx, handle, Ok(existing.to_string()));
        return Ok(promise);
    }

    let new_id = next_window_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    crate::window_registry_reserve(new_id, dedupe_key);
    ipc_bus.lock().entry(new_id).or_insert_with(|| std::sync::Arc::new(parking_lot::Mutex::new(std::collections::VecDeque::new())));

    if let Some(ref ctrl) = window {
        if let Some(ref create_fn) = ctrl.create_window {
            (create_fn)(new_id, title, width, height);
        }
    }

    let (handle, promise) = QuickJsRuntime::make_promise(&ctx)?;
    QuickJsRuntime::settle(&ctx, handle, Ok(new_id.to_string()));
    Ok(promise)
}

/// `__glyx_ipc_send(targetHandle, message)` — sync, fire-and-forget.
pub(crate) fn ipc_send(ipc_bus: &IpcBus, target: u32, msg: String) {
    let guard = ipc_bus.lock();
    if let Some(inbox) = guard.get(&target) {
        inbox.lock().push_back(msg);
    }
}

/// `__glyx_ipc_poll() -> string` — sync, JSON array of pending messages.
pub(crate) fn ipc_poll(ipc_bus: &IpcBus, my_handle: u32) -> String {
    let msgs: Vec<String> = {
        let guard = ipc_bus.lock();
        guard.get(&my_handle).map(|inbox| inbox.lock().drain(..).collect()).unwrap_or_default()
    };
    if msgs.is_empty() { return "[]".to_string(); }
    let items: Vec<String> = msgs.iter().map(|m| serde_json::to_string(m).unwrap_or_else(|_| "\"\"".into())).collect();
    format!("[{}]", items.join(","))
}

/// `__glyx_backend_call(name, argsJson) -> Promise<string>` — checks the
/// JS-plugin command map first (sync call, the plugin's own `async fn`
/// returns the Promise directly), then falls back to the async Rust-command
/// registry, matching V8's `backend_call_callback` precedence exactly.
pub(crate) fn backend_call<'js>(
    ctx: Ctx<'js>, name: String, args_json: String, commands: BackendRegistry,
    js_commands: crate::quickjs_ipc::JsBackendCommands,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    let found = js_commands.borrow().get(&name).cloned();
    if let Some((global_name, key)) = found {
        let f = resolve_js_command(&ctx, &global_name, &key)?;
        let parsed_args: Value<'js> = ctx.json_parse(args_json)?;
        return f.call((parsed_args,));
    }

    let Some(cmd) = commands.get(&name) else {
        return QuickJsRuntime::reject_now(&ctx, format!("backend.{name}: no such command registered"));
    };
    if let Err(e) = crate::command_capabilities_ok(cmd, glyx_security::get()) {
        return QuickJsRuntime::reject_now(&ctx, format!("backend.{name}: {e}"));
    }
    let handler = cmd.handler.clone();
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move { handler(args_json).await })
}
