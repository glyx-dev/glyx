//! Remaining `bind_sys.rs` bindings: window control (setAlwaysOnTop/
//! setTitle/setCursor), dialogs, clipboard, notifications, system info/
//! watch, power, gamepad, shortcuts, storage, credentials, deeplink, perf,
//! quit/restart/platform/open_external. Same shape as the other
//! quickjs_* modules.

use std::sync::Arc;
use std::sync::atomic::Ordering;
use rquickjs::Ctx;
use tokio::runtime::Handle;

use crate::bindings::{validate_external_url, CompletionQueue, RedrawRequest, WindowController};
use crate::quickjs_runtime::QuickJsRuntime;

fn cap_denied<'js>(ctx: &Ctx<'js>, cap: &str) -> rquickjs::Result<rquickjs::Promise<'js>> {
    QuickJsRuntime::reject_now(ctx, format!(
        "Capability required: {cap} — add it to glyx.config.json under \"capabilities\""
    ))
}

// ── Dialogs ──────────────────────────────────────────────────────────────

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

pub(crate) fn dialog_open_file<'js>(
    ctx: Ctx<'js>, filters_json: String, multiple: bool,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().dialog { return cap_denied(&ctx, "dialog"); }
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        let filters = parse_dialog_filters(&filters_json);
        let mut dialog = rfd::AsyncFileDialog::new();
        for (name, exts) in &filters {
            let refs: Vec<&str> = exts.iter().map(String::as_str).collect();
            dialog = dialog.add_filter(name, &refs);
        }
        if multiple {
            let handles = dialog.pick_files().await;
            let paths: Vec<String> = handles.unwrap_or_default().iter()
                .map(|h| h.path().to_string_lossy().into_owned()).collect();
            serde_json::to_string(&paths).map_err(|e| e.to_string())
        } else {
            let handle = dialog.pick_file().await;
            let path = handle.as_ref().map(|h| h.path().to_string_lossy().into_owned());
            serde_json::to_string(&path).map_err(|e| e.to_string())
        }
    })
}

pub(crate) fn dialog_save_file<'js>(
    ctx: Ctx<'js>, default_name: String, filters_json: String,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().dialog { return cap_denied(&ctx, "dialog"); }
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        let filters = parse_dialog_filters(&filters_json);
        let mut dialog = rfd::AsyncFileDialog::new().set_file_name(&default_name);
        for (name, exts) in &filters {
            let refs: Vec<&str> = exts.iter().map(String::as_str).collect();
            dialog = dialog.add_filter(name, &refs);
        }
        let handle = dialog.save_file().await;
        let path = handle.as_ref().map(|h| h.path().to_string_lossy().into_owned());
        serde_json::to_string(&path).map_err(|e| e.to_string())
    })
}

pub(crate) fn dialog_open_folder<'js>(
    ctx: Ctx<'js>, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().dialog { return cap_denied(&ctx, "dialog"); }
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        let handle = rfd::AsyncFileDialog::new().pick_folder().await;
        let path = handle.as_ref().map(|h| h.path().to_string_lossy().into_owned());
        serde_json::to_string(&path).map_err(|e| e.to_string())
    })
}

// ── Clipboard ────────────────────────────────────────────────────────────
//
// V8's clipboard bindings are internally synchronous (Win32 clipboard needs
// the main/message-pump thread, so `spawn_blocking` would silently fail —
// see bind_sys.rs's comment) but still resolve/reject a real Promise for API
// consistency. Same shape here: `Self::make_promise` + `Self::settle`
// immediately, no `tokio.spawn` needed since there's no cross-thread work.

pub(crate) fn clipboard_read_text<'js>(ctx: Ctx<'js>) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().clipboard { return cap_denied(&ctx, "clipboard"); }
    let (handle, promise) = QuickJsRuntime::make_promise(&ctx)?;
    let text = crate::bindings::read_clipboard_text();
    QuickJsRuntime::settle(&ctx, handle, Ok(text));
    Ok(promise)
}

pub(crate) fn clipboard_write_text<'js>(ctx: Ctx<'js>, text: String) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().clipboard { return cap_denied(&ctx, "clipboard"); }
    let (handle, promise) = QuickJsRuntime::make_promise(&ctx)?;
    crate::bindings::write_clipboard_text(&text);
    QuickJsRuntime::settle(&ctx, handle, Ok(String::new()));
    Ok(promise)
}

// ── Notifications ────────────────────────────────────────────────────────

pub(crate) fn notification_send<'js>(
    ctx: Ctx<'js>, title: String, body: String,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().notification { return cap_denied(&ctx, "notification"); }
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || {
            let mut notif = notify_rust::Notification::new();
            notif.summary(&title);
            notif.body(&body);
            #[cfg(target_os = "windows")]
            notif.app_id("{1AC14E77-02E7-4E5D-B744-2EB1AE5198B7}\\WindowsPowerShell\\v1.0\\powershell.exe");
            if let Err(e) = notif.show() { log::error!("[notification_send] show() failed: {e}"); }
            Ok::<String, String>(String::new())
        }).await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

// ── System info / storage ────────────────────────────────────────────────

pub(crate) fn system_get_info<'js>(
    ctx: Ctx<'js>, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().system { return cap_denied(&ctx, "system"); }
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(|| {
            let i = glyx_sysapi::system_info();
            format!(
                "{{\"cpuName\":{:?},\"cpuCores\":{},\"memoryTotalMb\":{},\"memoryUsedMb\":{},\"osName\":{:?},\"osVersion\":{:?}}}",
                i.cpu_name, i.cpu_cores, i.memory_total_mb, i.memory_used_mb, i.os_name, i.os_version
            )
        }).await.map_err(|e| e.to_string())
    })
}

pub(crate) fn system_get_dark_mode() -> &'static str {
    if !glyx_security::get().system { return "unknown"; }
    glyx_sysapi::dark_mode()
}

pub(crate) fn system_get_battery_saver() -> bool {
    if !glyx_security::get().system { return false; }
    glyx_sysapi::battery_saver_active()
}

pub(crate) fn storage_get_drives<'js>(
    ctx: Ctx<'js>, queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().storage { return cap_denied(&ctx, "storage"); }
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(|| {
            let drives = glyx_sysapi::storage_drives();
            let entries: Vec<String> = drives.iter().map(|d| format!(
                "{{\"name\":{:?},\"mountPoint\":{:?},\"totalBytes\":{},\"availableBytes\":{}}}",
                d.name, d.mount_point, d.total_bytes, d.available_bytes
            )).collect();
            format!("[{}]", entries.join(","))
        }).await.map_err(|e| e.to_string())
    })
}

// ── Credentials (OS keychain) ────────────────────────────────────────────

fn credential_app_prefix() -> String {
    std::env::current_exe().ok()
        .and_then(|p| p.file_stem().map(|s| s.to_string_lossy().into_owned()))
        .unwrap_or_else(|| "glyx".to_string())
}

pub(crate) fn credentials_set<'js>(
    ctx: Ctx<'js>, service: String, key: String, value: String,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().credentials { return cap_denied(&ctx, "credentials"); }
    let service = format!("{}::{}", credential_app_prefix(), service);
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || glyx_sysapi::credentials_set(&service, &key, &value).map(|_| "null".to_string()))
            .await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

pub(crate) fn credentials_get<'js>(
    ctx: Ctx<'js>, service: String, key: String,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().credentials { return cap_denied(&ctx, "credentials"); }
    let service = format!("{}::{}", credential_app_prefix(), service);
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || {
            glyx_sysapi::credentials_get(&service, &key).map(|opt| match opt {
                Some(val) => serde_json::to_string(&val).unwrap_or_else(|_| "null".into()),
                None => "null".to_string(),
            })
        }).await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

pub(crate) fn credentials_delete<'js>(
    ctx: Ctx<'js>, service: String, key: String,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().credentials { return cap_denied(&ctx, "credentials"); }
    let service = format!("{}::{}", credential_app_prefix(), service);
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || glyx_sysapi::credentials_delete(&service, &key).map(|_| "null".to_string()))
            .await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}

// ── Deep links / perf (reuse QuickJsRuntime's existing fields) ─────────────

pub(crate) fn deeplink_get_initial_url() -> String {
    std::env::var("GLYX_LAUNCH_URL").unwrap_or_default()
}

pub(crate) fn deeplink_poll(queue: Arc<parking_lot::Mutex<std::collections::VecDeque<String>>>) -> String {
    let urls: Vec<String> = queue.lock().drain(..).collect();
    if urls.is_empty() { "[]".to_string() } else { serde_json::to_string(&urls).unwrap_or_else(|_| "[]".to_string()) }
}

pub(crate) fn perf_snapshot(perf_state: &Arc<parking_lot::Mutex<glyx_perf::PerfState>>) -> String {
    let perf = perf_state.lock();
    let last = perf.last_frame();
    format!(
        "{{\"fps\":{:.1},\"frameTime\":{:.2},\"frameTimeP99\":{:.2},\"jsTime\":{:.2},\"layoutTime\":{:.2},\"gpuTime\":{:.2},\"memoryJS\":{:.2},\"memoryTotal\":{:.1},\"nodeCount\":{}}}",
        perf.fps(), perf.avg_frame_time(), perf.p99_frame_time(), perf.avg_js_time(), perf.avg_layout_time(),
        perf.avg_gpu_time(), last.heap_used_bytes as f64 / (1024.0*1024.0), last.process_rss_bytes as f64 / (1024.0*1024.0),
        last.node_count,
    )
}

pub(crate) fn perf_set_budget(perf_state: &Arc<parking_lot::Mutex<glyx_perf::PerfState>>, ms: f64) {
    perf_state.lock().budget_ms = ms;
}

pub(crate) fn perf_poll_violations(perf_state: &Arc<parking_lot::Mutex<glyx_perf::PerfState>>) -> String {
    let violations: Vec<String> = perf_state.lock().violations.drain(..).collect();
    if violations.is_empty() { "[]".to_string() } else { format!("[{}]", violations.join(",")) }
}

pub(crate) fn perf_poll_leak_warnings(perf_state: &Arc<parking_lot::Mutex<glyx_perf::PerfState>>) -> String {
    let warnings: Vec<String> = perf_state.lock().leak_warnings.drain(..).collect();
    if warnings.is_empty() { "[]".to_string() } else { format!("[{}]", warnings.join(",")) }
}

// ── Misc sync (quit/restart/platform/collect_memory/open_external) ─────────

pub(crate) fn quit(window: &Option<WindowController>) {
    if let Some(ctrl) = window { if let Some(f) = &ctrl.quit { f(); } }
}

pub(crate) fn restart(window: &Option<WindowController>) {
    if let Some(ctrl) = window { if let Some(f) = &ctrl.restart { f(); } }
}

pub(crate) fn platform() -> &'static str {
    if cfg!(target_os = "windows") { "windows" } else if cfg!(target_os = "macos") { "macos" } else { "linux" }
}

pub(crate) fn collect_memory() {
    // No mimalloc/V8 GC hook applicable here — QuickJsRuntime::gc_hint (via
    // rt.run_gc()) is the QuickJS-appropriate equivalent; JS-side code
    // should call that path. This binding exists so __glyx_collect_memory
    // is at least callable without throwing under QuickJS.
}

pub(crate) fn open_external(url: String) -> Result<(), String> {
    if !glyx_security::get().shell {
        return Err("open_external requires capabilities.shell: true".to_string());
    }
    if let Err(reason) = validate_external_url(&url) {
        log::warn!("[open_external] denied {:?}: {reason}", url);
        return Err(format!("open_external: {reason}"));
    }
    #[cfg(target_os = "windows")]
    let r = std::process::Command::new("rundll32").args(["url.dll,FileProtocolHandler", &url]).spawn();
    #[cfg(target_os = "macos")]
    let r = std::process::Command::new("open").arg(&url).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let r = std::process::Command::new("xdg-open").arg(&url).spawn();
    r.map(|_| ()).map_err(|e| format!("open_external: OS error: {e}"))
}

// ── System watch (module-level static, mirrors bind_sys.rs's own pattern
//    of a process-wide watcher registry rather than per-runtime state) ─────

static WATCHERS: std::sync::OnceLock<parking_lot::Mutex<std::collections::HashMap<u32, Arc<std::sync::atomic::AtomicBool>>>> =
    std::sync::OnceLock::new();
static NEXT_WATCH_ID: std::sync::atomic::AtomicU32 = std::sync::atomic::AtomicU32::new(1);

fn watchers() -> &'static parking_lot::Mutex<std::collections::HashMap<u32, Arc<std::sync::atomic::AtomicBool>>> {
    WATCHERS.get_or_init(|| parking_lot::Mutex::new(std::collections::HashMap::new()))
}

fn watch_payload(kind: &str, mem_sys: &mut Option<sysinfo::System>) -> String {
    match kind {
        "battery" => match glyx_sysapi::battery_status() {
            Some(b) => format!(
                r#"{{"level":{:.3},"charging":{},"timeRemainingSecs":{}}}"#,
                b.level, b.charging, b.time_remaining_secs.map_or("null".into(), |t| t.to_string()),
            ),
            None => "null".into(),
        },
        "memory" => {
            use sysinfo::{MemoryRefreshKind, RefreshKind};
            let sys = mem_sys.get_or_insert_with(|| {
                sysinfo::System::new_with_specifics(RefreshKind::nothing().with_memory(MemoryRefreshKind::everything()))
            });
            sys.refresh_memory();
            format!(r#"{{"usedMb":{},"totalMb":{}}}"#, sys.used_memory() / (1024*1024), sys.total_memory() / (1024*1024))
        }
        "darkMode" => format!(r#""{}""#, glyx_sysapi::dark_mode()),
        "batterySaver" => glyx_sysapi::battery_saver_active().to_string(),
        _ => "null".into(),
    }
}

pub(crate) fn system_watch<'js>(
    ctx: Ctx<'js>, kind: String, interval_ms: f64,
    events: crate::bindings::EventQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<u32> {
    if !glyx_security::get().system {
        return Err(rquickjs::Exception::throw_message(&ctx, "Capability required: system"));
    }
    let default_ms = match kind.as_str() { "darkMode" | "batterySaver" => 2_000.0, _ => 10_000.0 };
    let interval = std::time::Duration::from_millis(if interval_ms >= 1000.0 { interval_ms } else { default_ms } as u64);
    let id = NEXT_WATCH_ID.fetch_add(1, Ordering::Relaxed);
    let alive = Arc::new(std::sync::atomic::AtomicBool::new(true));
    watchers().lock().insert(id, Arc::clone(&alive));
    tokio.spawn(async move {
        let mut last: Option<String> = None;
        let mut mem_sys: Option<sysinfo::System> = None;
        loop {
            if !alive.load(Ordering::Relaxed) { break; }
            let payload = watch_payload(&kind, &mut mem_sys);
            if last.as_deref() != Some(payload.as_str()) {
                last = Some(payload.clone());
                events.lock().push_back(crate::bindings::InputEvent::SystemWatch { id, payload });
                if let Some(r) = &redraw { r(); }
            }
            tokio::time::sleep(interval).await;
        }
    });
    Ok(id)
}

pub(crate) fn system_unwatch(id: u32) {
    if let Some(alive) = watchers().lock().remove(&id) {
        alive.store(false, Ordering::Relaxed);
    }
}

pub(crate) type SleepGuards = Arc<std::cell::RefCell<std::collections::HashMap<u32, glyx_sysapi::SleepGuard>>>;
#[cfg(feature = "gamepad")]
pub(crate) type GamepadGilrs = Arc<std::cell::RefCell<Option<gilrs::Gilrs>>>;
pub(crate) type HotkeyStateCell = Arc<std::cell::RefCell<Option<crate::bindings::HotkeyState>>>;

pub(crate) fn power_prevent_sleep<'js>(
    ctx: Ctx<'js>, reason: String, guards: SleepGuards, next_id: Arc<std::sync::atomic::AtomicU32>,
) -> rquickjs::Result<String> {
    if !glyx_security::get().power {
        return Err(rquickjs::Exception::throw_message(&ctx, "Capability required: power"));
    }
    let reason = if reason.is_empty() { "Glyx app".to_string() } else { reason };
    match glyx_sysapi::prevent_sleep(&reason) {
        Some(guard) => {
            let id = next_id.fetch_add(1, Ordering::Relaxed);
            guards.borrow_mut().insert(id, guard);
            Ok(id.to_string())
        }
        None => Err(rquickjs::Exception::throw_message(&ctx, "power.preventSleep: not supported on this platform")),
    }
}

pub(crate) fn power_allow_sleep(guards: &SleepGuards, id_str: String) {
    if let Ok(id) = id_str.parse::<u32>() { guards.borrow_mut().remove(&id); }
}

#[cfg(feature = "gamepad")]
pub(crate) fn gamepad_poll(ctx: Ctx<'_>, gilrs: GamepadGilrs) -> rquickjs::Result<String> {
    if !glyx_security::get().gamepads {
        return Err(rquickjs::Exception::throw_message(&ctx, "Capability required: gamepads"));
    }
    let mut gilrs_opt = gilrs.borrow_mut();
    if gilrs_opt.is_none() { *gilrs_opt = gilrs::Gilrs::new().ok(); }
    let json = match gilrs_opt.as_mut() {
        None => "[]".to_string(),
        Some(g) => {
            let mut events = Vec::new();
            while let Some(ev) = g.next_event() {
                let gp = g.gamepad(ev.id);
                let ev_json = match ev.event {
                    gilrs::EventType::ButtonPressed(btn, _)  => format!(r#"{{"type":"buttonPressed","button":"{:?}"}}"#, btn),
                    gilrs::EventType::ButtonReleased(btn, _) => format!(r#"{{"type":"buttonReleased","button":"{:?}"}}"#, btn),
                    gilrs::EventType::AxisChanged(axis, val, _) => format!(r#"{{"type":"axisChanged","axis":"{:?}","value":{:.4}}}"#, axis, val),
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
            if events.is_empty() { "[]".to_string() } else { format!("[{}]", events.join(",")) }
        }
    };
    Ok(json)
}

pub(crate) fn shortcut_register<'js>(
    ctx: Ctx<'js>, accelerator: String, hotkey_state: HotkeyStateCell, next_id: Arc<std::sync::atomic::AtomicU32>,
) -> rquickjs::Result<String> {
    if !glyx_security::get().global_shortcuts {
        return Err(rquickjs::Exception::throw_message(&ctx, "Capability required: globalShortcuts"));
    }
    if accelerator.is_empty() {
        return Err(rquickjs::Exception::throw_message(&ctx, "shortcut.register: accelerator required"));
    }
    let hotkey = match crate::bindings::parse_accelerator(&accelerator) {
        Some(hk) => hk,
        None => return Err(rquickjs::Exception::throw_message(&ctx, &format!("shortcut.register: invalid accelerator '{accelerator}'"))),
    };

    let mut hs = hotkey_state.borrow_mut();
    if hs.is_none() {
        match global_hotkey::GlobalHotKeyManager::new() {
            Ok(mgr) => *hs = Some(crate::bindings::HotkeyState { manager: mgr, hotkeys: std::collections::HashMap::new() }),
            Err(e)  => return Err(rquickjs::Exception::throw_message(&ctx, &format!("shortcut.register: {e}"))),
        }
    }
    let hs = hs.as_mut().unwrap();
    if let Err(e) = hs.manager.register(hotkey) {
        return Err(rquickjs::Exception::throw_message(&ctx, &format!("shortcut.register: {e}")));
    }
    let id = next_id.fetch_add(1, Ordering::Relaxed);
    hs.hotkeys.insert(id, hotkey);
    Ok(id.to_string())
}

pub(crate) fn shortcut_unregister(hotkey_state: &HotkeyStateCell, id_str: String) {
    if let Ok(id) = id_str.parse::<u32>() {
        if let Some(hs) = hotkey_state.borrow_mut().as_mut() {
            if let Some(hotkey) = hs.hotkeys.remove(&id) {
                let _ = hs.manager.unregister(hotkey);
            }
        }
    }
}

pub(crate) fn shortcut_poll(hotkey_state: &HotkeyStateCell) -> String {
    let hs_opt = hotkey_state.borrow();
    match hs_opt.as_ref() {
        None => "[]".to_string(),
        Some(hs) => {
            let receiver = global_hotkey::GlobalHotKeyEvent::receiver();
            let mut ids = Vec::new();
            while let Ok(ev) = receiver.try_recv() {
                if ev.state == global_hotkey::HotKeyState::Pressed {
                    if let Some((&glyx_id, _)) = hs.hotkeys.iter().find(|(_, hk)| hk.id() == ev.id) {
                        ids.push(glyx_id.to_string());
                    }
                }
            }
            if ids.is_empty() { "[]".to_string() } else { format!("[{}]", ids.join(",")) }
        }
    }
}
