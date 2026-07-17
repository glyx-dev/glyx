use super::*;

// ── System watchers ───────────────────────────────────────────────────────────
//
// "Don't poll; subscribe."  `__glyx_system_watch(kind, intervalMs) → id` spawns
// a Rust-side poller that reads the requested metric on a timer and pushes a
// `systemWatch` event ONLY when the value changes (delta-gated) — V8 stays
// completely idle between changes.  `__glyx_system_unwatch(id)` stops it.
//
// Kinds: "battery" | "memory" | "darkMode" | "batterySaver"

static WATCHERS: std::sync::OnceLock<Mutex<HashMap<u32, Arc<std::sync::atomic::AtomicBool>>>> =
    std::sync::OnceLock::new();
static NEXT_WATCH_ID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(1);

fn watchers() -> &'static Mutex<HashMap<u32, Arc<std::sync::atomic::AtomicBool>>> {
    WATCHERS.get_or_init(|| Mutex::new(HashMap::new()))
}

fn watch_payload(kind: &str, mem_sys: &mut Option<sysinfo::System>) -> String {
    match kind {
        "battery" => match glyx_sysapi::battery_status() {
            Some(b) => format!(
                r#"{{"level":{:.3},"charging":{},"timeRemainingSecs":{}}}"#,
                b.level, b.charging,
                b.time_remaining_secs.map_or("null".into(), |t| t.to_string()),
            ),
            None => "null".into(),
        },
        "memory" => {
            use sysinfo::{MemoryRefreshKind, RefreshKind};
            let sys = mem_sys.get_or_insert_with(|| {
                sysinfo::System::new_with_specifics(
                    RefreshKind::nothing().with_memory(MemoryRefreshKind::everything()),
                )
            });
            sys.refresh_memory();
            format!(
                r#"{{"usedMb":{},"totalMb":{}}}"#,
                sys.used_memory() / (1024 * 1024),
                sys.total_memory() / (1024 * 1024),
            )
        }
        "darkMode"     => format!(r#""{}""#, glyx_sysapi::dark_mode()),
        "batterySaver" => glyx_sysapi::battery_saver_active().to_string(),
        _ => "null".into(),
    }
}

/// `__glyx_system_watch(kind: string, intervalMs: number) → id`
pub fn system_watch_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let kind = v8_arg_to_string(scope, &args, 0);
    let interval_ms = args.get(1).number_value(scope).unwrap_or(0.0);
    // Clamp: darkMode/batterySaver are registry reads (cheap, 2s default);
    // battery/memory default 10s.  Floor 1s so apps can't spin the poller.
    let default_ms = match kind.as_str() {
        "darkMode" | "batterySaver" => 2_000.0,
        _ => 10_000.0,
    };
    let interval = std::time::Duration::from_millis(
        if interval_ms >= 1000.0 { interval_ms } else { default_ms } as u64,
    );

    let id = NEXT_WATCH_ID.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let alive = Arc::new(std::sync::atomic::AtomicBool::new(true));
    watchers().lock().insert(id, Arc::clone(&alive));

    let events = Arc::clone(&state.events);
    let redraw = state.request_redraw.as_ref().map(Arc::clone);
    state.tokio.spawn(async move {
        let mut last: Option<String> = None;
        let mut mem_sys: Option<sysinfo::System> = None;
        loop {
            if !alive.load(std::sync::atomic::Ordering::Relaxed) { break; }
            let payload = watch_payload(&kind, &mut mem_sys);
            if last.as_deref() != Some(payload.as_str()) {
                last = Some(payload.clone());
                events.lock().push_back(InputEvent::SystemWatch { id, payload });
                // Wake the frame loop so JS drains the event promptly.
                if let Some(r) = &redraw { r(); }
            }
            tokio::time::sleep(interval).await;
        }
    });

    rv.set(v8::Number::new(scope, id as f64).into());
}

/// `__glyx_system_unwatch(id: number) → void`
pub fn system_unwatch_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let id = args.get(0).number_value(scope).unwrap_or_default() as u32;
    if let Some(alive) = watchers().lock().remove(&id) {
        alive.store(false, std::sync::atomic::Ordering::Relaxed);
    }
}

pub fn set_fullscreen_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let enable = args.get(0).boolean_value(scope);
    if let Some(ctrl) = &state.window {
        (ctrl.set_fullscreen)(enable);
    }
}

pub fn set_maximized_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let enable = args.get(0).boolean_value(scope);
    if let Some(ctrl) = &state.window {
        (ctrl.set_maximized)(enable);
    }
}

pub fn set_minimized_callback(
    _scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    if let Some(ctrl) = &state.window {
        (ctrl.set_minimized)();
    }
}

pub fn is_fullscreen_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let result = state.window.as_ref().map(|ctrl| (ctrl.is_fullscreen)()).unwrap_or(false);
    rv.set(v8::Boolean::new(scope, result).into());
}

pub fn is_maximized_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let result = state.window.as_ref().map(|ctrl| (ctrl.is_maximized)()).unwrap_or(false);
    rv.set(v8::Boolean::new(scope, result).into());
}

// â"€â"€ File system bindings â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
//
// All async, all return Promise<string> (empty string for void operations).
// fs.write capability is required for all mutation operations.
// fs.read  capability is required for listing / reading.

/// `__glyx_writeFile(path, content) -> Promise<void>`
pub fn set_always_on_top_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let on    = args.get(0).boolean_value(scope);
    if let Some(ctrl) = &state.window {
        (ctrl.set_always_on_top)(on);
    }
}

/// `__glyx_setTitle(title: string) -> void`
pub fn set_title_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let title = v8_arg_to_string(scope, &args, 0);
    if let Some(ctrl) = &state.window {
        (ctrl.set_title)(title);
    }
}

/// `__glyx_setCursor(name: string) -> void` — set the mouse cursor icon.
pub fn set_cursor_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let name  = v8_arg_to_string(scope, &args, 0);
    if let Some(ctrl) = &state.window {
        (ctrl.set_cursor)(name);
    }
}

// â"€â"€ File dialog callbacks â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
//
// All async. Gated by `dialog: true` capability.
// `dialog_openFile`   â†' Promise<string>   â€" JSON array of paths, or JSON null.
// `dialog_saveFile`   â†' Promise<string>   â€" JSON path string, or JSON null.
// `dialog_openFolder` â†' Promise<string>   â€" JSON path string, or JSON null.
//
// Filter format: JSON array of `{ name: string, extensions: string[] }`.

/// Build filter list from a JSON string `[{ name, extensions: string[] }]`.
pub fn parse_dialog_filters(json: &str) -> Vec<(String, Vec<String>)> {
    let parsed: Vec<serde_json::Value> = serde_json::from_str(json).unwrap_or_default();
    parsed.into_iter().map(|f| {
        let name = f["name"].as_str().unwrap_or("All Files").to_string();
        let exts: Vec<String> = f["extensions"].as_array()
            .map(|a| a.iter().filter_map(|v| v.as_str().map(str::to_string)).collect())
            .unwrap_or_default();
        (name, exts)
    }).collect()
}

/// `__glyx_dialog_openFile(filtersJson, multiple) -> Promise<string>` â€" JSON path[].
pub fn dialog_open_file_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    if !glyx_security::get().dialog {
        rv.set(reject_cap_promise(scope, "dialog").into());
        return;
    }
    let data  = args.data();
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

/// `__glyx_dialog_saveFile(defaultName, filtersJson) -> Promise<string>` â€" JSON path | null.
pub fn dialog_save_file_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    if !glyx_security::get().dialog {
        rv.set(reject_cap_promise(scope, "dialog").into());
        return;
    }
    let data  = args.data();
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

/// `__glyx_dialog_openFolder() -> Promise<string>` â€" JSON path | null.
pub fn dialog_open_folder_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    if !glyx_security::get().dialog {
        rv.set(reject_cap_promise(scope, "dialog").into());
        return;
    }
    let data  = args.data();
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

// â"€â"€ Clipboard callbacks â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
//
// Gated by `clipboard: true` capability.

/// `__glyx_clipboard_readText() -> Promise<string>` â€" clipboard text content.
pub fn clipboard_read_text_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    _args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    if !glyx_security::get().clipboard {
        rv.set(reject_cap_promise(scope, "clipboard").into());
        return;
    }
    // Read synchronously on the V8 thread. clipboard_win calls Win32 OpenClipboard/
    // GetClipboardData which require a thread with a message pump â€" the main thread
    // qualifies, but spawn_blocking worker threads do not (causes silent failures when
    // pasting from external apps). The clipboard read is ~0ms so blocking is fine.
    let text = clipboard_win::get_clipboard::<String, _>(clipboard_win::formats::Unicode)
        .unwrap_or_else(|e| { log::warn!("[clipboard] read failed: {e}"); String::new() });
    let resolver = v8::PromiseResolver::new(scope).unwrap();
    let promise  = resolver.get_promise(scope);
    let v8_str   = v8::String::new(scope, &text)
        .unwrap_or_else(|| v8::String::new(scope, "").unwrap());
    resolver.resolve(scope, v8_str.into());
    rv.set(promise.into());
}

/// `__glyx_clipboard_writeText(text) -> Promise<void>`
pub fn clipboard_write_text_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    if !glyx_security::get().clipboard {
        rv.set(reject_cap_promise(scope, "clipboard").into());
        return;
    }
    let text     = v8_arg_to_string(scope, &args, 0);
    let resolver = v8::PromiseResolver::new(scope).unwrap();
    let promise  = resolver.get_promise(scope);
    // Write synchronously â€" same reason as readText (Win32 clipboard needs message pump thread).
    if let Err(e) = clipboard_win::set_clipboard(clipboard_win::formats::Unicode, &text) {
        log::warn!("[clipboard] write failed: {e}");
    }
    let undef = v8::undefined(scope);
    resolver.resolve(scope, undef.into());
    rv.set(promise.into());
}

// â"€â"€ Notification callback â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

/// `__glyx_notification_send(title, body) -> Promise<void>`
///
/// Sends a native desktop notification. Fire-and-forget; errors are logged but
/// do not reject the Promise (notifications are best-effort).
pub fn notification_send_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    if !glyx_security::get().notification {
        rv.set(reject_cap_promise(scope, "notification").into());
        return;
    }
    let data  = args.data();
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

// â"€â"€ Vector database callbacks â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
//
// All async. Gated by `db: true` capability (vector stores are local DB storage).
// `vectorDb_open`   â†' Promise<string>  â€" resolves with handle number as a string.
// `vectorDb_upsert` â†' Promise<string>  â€" resolves with "" on success.
// `vectorDb_search` â†' Promise<string>  â€" resolves with JSON array of {id,score,metadata}.
// `vectorDb_close`  â†' Promise<string>  â€" resolves with "" on success.

/// `__glyx_vectorDb_open(path) -> Promise<string>` â€" handle number.
pub fn battery_get_status_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().battery {
        rv.set(reject_cap_promise(scope, "battery").into()); return;
    }
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);
    state.tokio.spawn(async move {
        let json = tokio::task::spawn_blocking(|| {
            match glyx_sysapi::battery_status() {
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

/// `__glyx_system_getInfo()` â†' Promise<JSON>
pub fn system_get_info_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().system {
        rv.set(reject_cap_promise(scope, "system").into()); return;
    }
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);
    state.tokio.spawn(async move {
        let json = tokio::task::spawn_blocking(|| {
            let i = glyx_sysapi::system_info();
            format!(
                "{{\"cpuName\":{:?},\"cpuCores\":{},\"memoryTotalMb\":{},\"memoryUsedMb\":{},\"osName\":{:?},\"osVersion\":{:?}}}",
                i.cpu_name, i.cpu_cores, i.memory_total_mb, i.memory_used_mb, i.os_name, i.os_version
            )
        }).await.unwrap_or_else(|_| "{}".into());
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr, result: Ok(json) });
    });
    rv.set(promise.into());
}

/// `__glyx_system_getDarkMode()` â†' `"dark" | "light" | "unknown"` (sync, ~1 Âµs)
///
/// Reads the OS appearance preference directly â€" Windows registry key, macOS
/// NSUserDefaults, Linux gsettings.  No blocking I/O; safe to call every frame
/// if needed (though polling once per second is sufficient for most apps).
pub fn system_get_dark_mode_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    _args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    if !glyx_security::get().system {
        let s = v8::String::new(scope, "unknown").unwrap();
        rv.set(s.into());
        return;
    }
    let mode = glyx_sysapi::dark_mode();
    let s = v8::String::new(scope, mode).unwrap();
    rv.set(s.into());
}

/// `__glyx_system_getBatterySaver()` â†' boolean (sync, ~1 Âµs on Windows)
///
/// Returns `true` if battery-saver / power-saver mode is active.
/// Uses `GetSystemPowerStatus()` on Windows (one kernel call, no extra crate).
/// Returns `false` on macOS/Linux until native support lands.
pub fn system_get_battery_saver_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    _args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    if !glyx_security::get().system {
        rv.set(v8::Boolean::new(scope, false).into());
        return;
    }
    let active = glyx_sysapi::battery_saver_active();
    rv.set(v8::Boolean::new(scope, active).into());
}

/// `__glyx_power_preventSleep(reason)` â†' string guard-id (sync)
pub fn power_prevent_sleep_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().power {
        throw_cap_error(scope, "power"); return;
    }
    let reason = {
        let s = v8_arg_to_string(scope, &args, 0);
        if s.is_empty() { "Glyx app".into() } else { s }
    };
    match glyx_sysapi::prevent_sleep(&reason) {
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

/// `__glyx_power_allowSleep(id)` â€" sync, drops the guard
pub fn power_allow_sleep_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let id_str = v8_arg_to_string(scope, &args, 0);
    if let Ok(id) = id_str.parse::<u32>() {
        state.sleep_guards.borrow_mut().remove(&id);
    }
}

/// `__glyx_storage_getDrives()` â†' Promise<JSON>
pub fn storage_get_drives_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().storage {
        rv.set(reject_cap_promise(scope, "storage").into()); return;
    }
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);
    state.tokio.spawn(async move {
        let json = tokio::task::spawn_blocking(|| {
            let drives = glyx_sysapi::storage_drives();
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

/// `__glyx_gamepad_poll()` â†' JSON string (sync, drain gilrs events)
#[cfg(feature = "gamepad")]
pub fn gamepad_poll_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().gamepads {
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

#[cfg(not(feature = "gamepad"))]
pub fn gamepad_poll_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let _ = args;
    let json = if let Some(cap) = state.caps.gamepad {
        let mut buf = vec![0u8; 8192];
        let mut out_len: usize = 0;
        unsafe { (cap.poll)(buf.as_mut_ptr(), &mut out_len, buf.len()) };
        if out_len > 0 {
            String::from_utf8_lossy(&buf[..out_len]).into_owned()
        } else {
            "[]".to_string()
        }
    } else {
        "[]".to_string()
    };
    let s = v8::String::new(scope, &json).unwrap_or_else(|| v8::String::empty(scope));
    rv.set(s.into());
}

/// `__glyx_shortcut_register(accelerator)` â†' string id (sync)
pub fn shortcut_register_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().global_shortcuts {
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

/// `__glyx_shortcut_unregister(id)` â€" sync
pub fn shortcut_unregister_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
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

/// `__glyx_shortcut_poll()` â†' JSON string array of fired glyx IDs (sync)
pub fn shortcut_poll_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
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
                    if let Some((&glyx_id, _)) = hs.hotkeys.iter().find(|(_, hk)| hk.id() == ev.id) {
                        ids.push(glyx_id.to_string());
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

fn credential_app_prefix() -> String {
    std::env::current_exe()
        .ok()
        .and_then(|p| p.file_stem().map(|s| s.to_string_lossy().into_owned()))
        .unwrap_or_else(|| "glyx".to_string())
}

// â"€â"€ Credentials (OS keychain) â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

/// `__glyx_credentials_set(service, key, value)` â†' Promise<void>
///
/// Stores `value` in the OS credential store under `service`+`key`.
/// Encrypted by the OS, tied to the logged-in user account.
pub fn credentials_set_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().credentials {
        rv.set(reject_cap_promise(scope, "credentials").into()); return;
    }
    let service = args.get(0).to_string(scope).map(|s| s.to_rust_string_lossy(scope.as_ref())).unwrap_or_default();
    let service = format!("{}::{}", credential_app_prefix(), service);
    let key     = args.get(1).to_string(scope).map(|s| s.to_rust_string_lossy(scope.as_ref())).unwrap_or_default();
    let value   = args.get(2).to_string(scope).map(|s| s.to_rust_string_lossy(scope.as_ref())).unwrap_or_default();
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);
    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            glyx_sysapi::credentials_set(&service, &key, &value)
                .map(|_| "null".into())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr, result });
    });
    rv.set(promise.into());
}

/// `__glyx_credentials_get(service, key)` â†' Promise<string | null>
///
/// Returns the stored secret, or JSON `null` if no entry exists.
pub fn credentials_get_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().credentials {
        rv.set(reject_cap_promise(scope, "credentials").into()); return;
    }
    let service = args.get(0).to_string(scope).map(|s| s.to_rust_string_lossy(scope.as_ref())).unwrap_or_default();
    let service = format!("{}::{}", credential_app_prefix(), service);
    let key     = args.get(1).to_string(scope).map(|s| s.to_rust_string_lossy(scope.as_ref())).unwrap_or_default();
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);
    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            glyx_sysapi::credentials_get(&service, &key).map(|opt| match opt {
                Some(val) => serde_json::to_string(&val).unwrap_or_else(|_| "null".into()),
                None      => "null".into(),
            })
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr, result });
    });
    rv.set(promise.into());
}

/// `__glyx_credentials_delete(service, key)` â†' Promise<void>
pub fn credentials_delete_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if !glyx_security::get().credentials {
        rv.set(reject_cap_promise(scope, "credentials").into()); return;
    }
    let service = args.get(0).to_string(scope).map(|s| s.to_rust_string_lossy(scope.as_ref())).unwrap_or_default();
    let service = format!("{}::{}", credential_app_prefix(), service);
    let key     = args.get(1).to_string(scope).map(|s| s.to_rust_string_lossy(scope.as_ref())).unwrap_or_default();
    let (resolver_ptr, promise, queue, redraw) = make_promise(scope, state);
    state.tokio.spawn(async move {
        let result = tokio::task::spawn_blocking(move || {
            glyx_sysapi::credentials_delete(&service, &key)
                .map(|_| "null".into())
        }).await.map_err(|e| e.to_string()).and_then(|r| r);
        enqueue_completion(&queue, redraw.as_ref(), Completion { resolver_ptr, result });
    });
    rv.set(promise.into());
}

// â"€â"€ Audio playback bindings â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

// parse_accelerator/str_to_code moved to bindings/mod.rs's always-compiled
// shared section (engine-neutral, needed by quickjs_sys.rs's shortcut_register too).

// â"€â"€ Performance metrics â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

/// `__glyx_perf_snapshot()` â†' JSON string with current perf metrics.
pub fn perf_snapshot_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let perf  = state.perf_state.lock();
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

/// `__glyx_perf_set_budget(ms)` â€" sync, sets the frame-budget threshold.
pub fn perf_set_budget_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    if args.length() < 1 { return; }
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let ms = args.get(0).number_value(scope).unwrap_or(16.667);
    state.perf_state.lock().budget_ms = ms;
}

/// `__glyx_perf_poll_leak_warnings()` â†' JSON array string; drains leak warnings (dev mode).
pub fn perf_poll_leak_warnings_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let warnings: Vec<String> = {
        let mut perf = state.perf_state.lock();
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

/// `__glyx_perf_poll_violations()` â†' JSON array string; drains the violation queue.
pub fn perf_poll_violations_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    let violations: Vec<String> = {
        let mut perf = state.perf_state.lock();
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

/// `__glyx_quit()` â€" sync, requests application exit.
///
/// Calls the quit closure stored in `WindowController`, which sends
/// `GlyxUserEvent::Quit` to the winit event loop causing it to exit.
pub fn quit_callback(
    _scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if let Some(ref ctrl) = state.window {
        if let Some(ref quit_fn) = ctrl.quit {
            (quit_fn)();
        }
    }
}

/// `__glyx_collect_memory()` â€" sync, immediately runs V8 GC + mimalloc segment decommit.
/// The framework calls this automatically on focus loss; developers can call it manually
/// at natural pause points (level transitions, loading screens, menu opens).
pub fn collect_memory_callback(
    _scope: &mut v8::PinScope<'_, '_, v8::Context>,
    _args:  v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    extern "C" { fn mi_collect(force: bool); }
    unsafe { mi_collect(true); }
}

/// `__glyx_open_external(url)` - sync, opens a URL in the OS default browser.
/// Used for OAuth flows, "open in browser" links, mailto: composition, etc.
///
/// Requires `capabilities.shell: true` in glyx.config.
/// Validates scheme (http/https/mailto only) and rejects control chars and
/// shell metacharacters before dispatch.  Never passes through `cmd /C` or
/// any other shell - each platform uses the direct OS API/binary.
pub fn open_external_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    _rv:   v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    // ── Capability gate ──────────────────────────────────────────────────────
    if !glyx_security::get().shell {
        throw_js_error(scope, "open_external requires capabilities.shell: true");
        return;
    }

    let url = args.get(0).to_string(scope)
        .map(|s| s.to_rust_string_lossy(scope.as_ref()))
        .unwrap_or_default();

    // ── URL validation ───────────────────────────────────────────────────────
    if let Err(reason) = validate_external_url(&url) {
        log::warn!("[open_external] denied {:?}: {reason}", url);
        throw_js_error(scope, &format!("open_external: {reason}"));
        return;
    }

    // ── OS dispatch - no shell involved ──────────────────────────────────────
    // Windows: ShellExecuteW via rundll32 url.dll,FileProtocolHandler
    //   (avoids cmd.exe re-parse; rundll32 is argv-separated)
    // macOS/Linux: `open` / `xdg-open` take a single argument - no shell.
    #[cfg(target_os = "windows")]
    let r = std::process::Command::new("rundll32")
        .args(["url.dll,FileProtocolHandler", &url])
        .spawn();
    #[cfg(target_os = "macos")]
    let r = std::process::Command::new("open").arg(&url).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let r = std::process::Command::new("xdg-open").arg(&url).spawn();

    if let Err(e) = r {
        log::warn!("[open_external] OS dispatch failed: {e}");
        throw_js_error(scope, &format!("open_external: OS error: {e}"));
    }

    let _ = state;
}

/// `__glyx_restart()` â€" sync, requests app restart (quit + re-launch).
pub fn restart_callback(
    _scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };
    if let Some(ref ctrl) = state.window {
        if let Some(ref restart_fn) = ctrl.restart {
            (restart_fn)();
        }
    }
}

/// `__glyx_platform()` â†' `"windows"` | `"macos"` | `"linux"` (compile-time constant).
pub fn platform_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    _args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let s = if cfg!(target_os = "windows") { "windows" }
            else if cfg!(target_os = "macos") { "macos" }
            else { "linux" };
    rv.set(v8::String::new(scope, s).unwrap().into());
}

// â"€â"€ Deep link bindings â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

/// `__glyx_deeplink_getInitialUrl()` â†' string
///
/// Returns the URL that launched the app (e.g. `"notes://note/42"`), or `""`
/// if the app was opened normally.  The value is set by glyx-core at startup
/// via the `GLYX_LAUNCH_URL` environment variable before the runtime starts.
pub fn deeplink_get_initial_url_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    _args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let url = std::env::var("GLYX_LAUNCH_URL").unwrap_or_default();
    let s = v8::String::new(scope, &url).unwrap();
    rv.set(s.into());
}

/// `__glyx_deeplink_poll()` â†' JSON string (array of URL strings)
///
/// Drains the forwarded URL queue (populated by the single-instance listener
/// when a second process connects and sends a URL).  Called each frame inside
/// `__glyx_frameCallback`; JS fires `deeplink.onOpen` for each URL.
pub fn deeplink_poll_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args:  v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let data  = args.data();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let urls: Vec<String> = {
        let mut q = state.deeplink_url_queue.lock();
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

#[cfg(test)]
mod tests {
    use super::validate_external_url;

    // F5: open_external metacharacter rejection regression tests.

    #[test]
    fn open_external_allows_safe_urls() {
        assert!(validate_external_url("https://example.com").is_ok());
        assert!(validate_external_url("http://example.com/path?q=1&r=2").is_ok());
        assert!(validate_external_url("mailto:user@example.com").is_ok());
    }

    #[test]
    fn open_external_rejects_bad_schemes() {
        assert!(validate_external_url("file:///etc/passwd").is_err());
        assert!(validate_external_url("javascript:alert(1)").is_err());
        assert!(validate_external_url("ftp://files.example.com").is_err());
        assert!(validate_external_url("data:text/html,<h1>x</h1>").is_err());
    }

    #[test]
    fn open_external_rejects_shell_metacharacters() {
        assert!(validate_external_url("https://example.com|whoami").is_err());
        assert!(validate_external_url("https://example.com;rm -rf /").is_err());
        assert!(validate_external_url("https://example.com$(id)").is_err());
        assert!(validate_external_url("https://example.com`id`").is_err());
        assert!(validate_external_url("https://example.com&&evil").is_err());
    }

    #[test]
    fn open_external_rejects_control_characters() {
        assert!(validate_external_url("https://example.com/\x00path").is_err());
        assert!(validate_external_url("https://example.com/\x0apath").is_err());
        assert!(validate_external_url("https://example.com/\x7fpath").is_err());
    }
}
