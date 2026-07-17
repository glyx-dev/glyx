//! `__glyx_window_create`/`__glyx_ipc_send`/`__glyx_ipc_poll`/`__glyx_backend_call`
//! bindings, ported from `bind_net.rs`'s "Multi-window + IPC bindings" section
//! and `bind_updater.rs`'s `backend_call_callback`.
//!
//! This is the structural piece that was deferred through the rest of the
//! binding-port sweep: it needs `QuickJsRuntime` to actually carry
//! `ipc_bus`/`my_handle`/`next_window_id`/`backend_commands` state (wired up
//! in `QuickJsRuntime::new_with_ipc`), not just a binding function.
//!
//! `backend_call`'s sync JS-registered-handler path (`js_backend_commands`,
//! populated by dev-mode plugin hot-reload / `GlyxExtension::register()`,
//! which is V8-scope-only) is NOT ported — only the async Rust-command path
//! (`backend_commands` / `GlyxExtension::register_commands`, already
//! engine-neutral) is. `register_extensions` already documents this split.

use rquickjs::Ctx;
use tokio::runtime::Handle;

use crate::bindings::{CompletionQueue, IpcBus, RedrawRequest, WindowController};
use crate::quickjs_runtime::QuickJsRuntime;
use crate::BackendRegistry;

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

/// `__glyx_backend_call(name, argsJson) -> Promise<string>` — async Rust
/// command path only (see module doc for the sync-JS-handler path that's
/// NOT ported).
pub(crate) fn backend_call<'js>(
    ctx: Ctx<'js>, name: String, args_json: String, commands: BackendRegistry,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    let Some(handler) = commands.get(&name).cloned() else {
        return QuickJsRuntime::reject_now(&ctx, format!("backend.{name}: no such command registered"));
    };
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move { handler(args_json).await })
}
