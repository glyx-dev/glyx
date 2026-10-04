mod menubar;
pub use menubar::*;

use std::collections::{HashMap, VecDeque};
use std::sync::{atomic::AtomicBool, atomic::Ordering, LazyLock, Mutex};

use muda::accelerator::Accelerator;
use muda::{CheckMenuItem, ContextMenu, Menu, MenuItem, PredefinedMenuItem, Submenu};
use tray_icon::{menu::MenuEvent, Icon, TrayIconBuilder, TrayIconEvent, TrayIconId};

static HANDLER_SET: AtomicBool = AtomicBool::new(false);

/// Where tray events go when something is listening. With no sink they queue
/// for `poll_events`, as before.
pub type TraySink = std::sync::Arc<dyn Fn(TrayEvent) + Send + Sync>;
static TRAY_SINK: LazyLock<Mutex<Option<TraySink>>> = LazyLock::new(|| Mutex::new(None));

/// Point tray events at `sink`, or back to the polled queue with `None`.
pub fn set_tray_sink(sink: Option<TraySink>) {
    *TRAY_SINK.lock().unwrap() = sink;
}

fn emit(ev: TrayEvent) {
    let sink = TRAY_SINK.lock().unwrap().clone();
    match sink {
        Some(sink) => sink(ev),
        None => EVENT_QUEUE.lock().unwrap().push_back(ev),
    }
}
/// The app's own icon (the window icon), registered at startup, used when a
/// tray icon is created without pixels of its own.
static APP_ICON: std::sync::OnceLock<(Vec<u8>, u32, u32)> = std::sync::OnceLock::new();

/// Register the app icon as raw RGBA pixels. Only the first call counts.
pub fn set_app_icon(rgba: Vec<u8>, width: u32, height: u32) {
    let _ = APP_ICON.set((rgba, width, height));
}
static EVENT_QUEUE: LazyLock<Mutex<VecDeque<TrayEvent>>> =
    LazyLock::new(|| Mutex::new(VecDeque::new()));
static TRAY_MAP: LazyLock<Mutex<HashMap<u32, TrayIconId>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));
static MENU_ITEM_TO_TRAY: LazyLock<Mutex<HashMap<String, u32>>> =
    LazyLock::new(|| Mutex::new(HashMap::new()));

fn default_true() -> bool { true }

#[derive(Debug, Clone, serde::Deserialize, serde::Serialize)]
pub struct TrayMenuItem {
    pub id: String,
    pub label: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub checked: bool,
    #[serde(default)]
    pub separator: bool,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub accelerator: Option<String>,
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub children: Vec<TrayMenuItem>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub enum TrayEvent {
    Click { tray_id: u32 },
    DoubleClick { tray_id: u32 },
    MenuItemClick { tray_id: u32, item_id: String },
}

pub struct TrayHandle {
    pub id: u32,
    #[allow(dead_code)]
    icon: tray_icon::TrayIcon,
}

fn ensure_event_handler() {
    if HANDLER_SET.swap(true, Ordering::SeqCst) {
        return;
    }

    TrayIconEvent::set_event_handler(Some(|event: TrayIconEvent| {
        let icon_id = event.id().clone();
        let map = TRAY_MAP.lock().unwrap();
        let tray_id = find_tray_id(&map, icon_id);
        drop(map);

        let ev = match event {
            TrayIconEvent::Click { .. } => {
                tray_id.map(|id| TrayEvent::Click { tray_id: id })
            }
            TrayIconEvent::DoubleClick { .. } => {
                tray_id.map(|id| TrayEvent::DoubleClick { tray_id: id })
            }
            _ => None,
        };

        if let Some(ev) = ev {
            emit(ev);
        }
    }));

    MenuEvent::set_event_handler(Some(|event: MenuEvent| {
        let item_id = event.id.0.clone();
        // One handler serves both: window menu bar clicks first, the rest are the tray's.
        // The handler runs inside the window procedure, where a panic cannot unwind
        // and would abort the app, so nothing here may be allowed to panic outward.
        let ours = std::panic::catch_unwind(|| menubar::dispatch(&item_id)).unwrap_or(true);
        if ours {
            return;
        }
        let map = MENU_ITEM_TO_TRAY.lock().unwrap();
        let tray_id = map.get(&item_id).copied();

        if let Some(id) = tray_id {
            emit(TrayEvent::MenuItemClick { tray_id: id, item_id });
        }
    }));
}

fn find_tray_id(map: &HashMap<u32, TrayIconId>, icon_id: TrayIconId) -> Option<u32> {
    map.iter()
        .find(|(_, v)| **v == icon_id)
        .map(|(k, _)| *k)
}

fn register_menu_items(tray_id: u32, items: &[TrayMenuItem]) {
    let mut map = MENU_ITEM_TO_TRAY.lock().unwrap();
    for item in items {
        if !item.separator && !item.id.is_empty() {
            map.insert(item.id.clone(), tray_id);
        }
        if !item.children.is_empty() {
            register_menu_items(tray_id, &item.children);
        }
    }
}

fn build_menu(tray_id: u32, items: &[TrayMenuItem]) -> Result<Menu, String> {
    let menu = Menu::new();
    register_menu_items(tray_id, items);
    append_menu_items(&menu, tray_id, items)?;
    Ok(menu)
}

fn build_submenu(
    tray_id: u32,
    label: &str,
    items: &[TrayMenuItem],
) -> Result<Submenu, String> {
    let sub = Submenu::new(label, true);
    append_submenu_items(&sub, tray_id, items)?;
    Ok(sub)
}

macro_rules! append_loop_body {
    ($parent:expr, $tray_id:ident, $item:ident) => {
        if $item.separator {
            $parent
                .append(&PredefinedMenuItem::separator())
                .map_err(|e| e.to_string())?;
        } else if $item.children.is_empty() {
            if $item.checked {
                let cmi = CheckMenuItem::with_id(
                    &$item.id,
                    &$item.label,
                    $item.enabled,
                    true,
                    $item.accelerator
                        .as_deref()
                        .and_then(|a| a.parse::<Accelerator>().ok()),
                );
                $parent.append(&cmi).map_err(|e| e.to_string())?;
            } else {
                let mi = MenuItem::with_id(
                    &$item.id,
                    &$item.label,
                    $item.enabled,
                    $item.accelerator
                        .as_deref()
                        .and_then(|a| a.parse::<Accelerator>().ok()),
                );
                $parent.append(&mi).map_err(|e| e.to_string())?;
            }
        } else {
            let sub = build_submenu($tray_id, &$item.label, &$item.children)?;
            $parent.append(&sub).map_err(|e| e.to_string())?;
        }
    };
}

fn append_menu_items(menu: &Menu, tray_id: u32, items: &[TrayMenuItem]) -> Result<(), String> {
    for item in items {
        append_loop_body!(menu, tray_id, item);
    }
    Ok(())
}

fn append_submenu_items(
    submenu: &Submenu,
    tray_id: u32,
    items: &[TrayMenuItem],
) -> Result<(), String> {
    for item in items {
        append_loop_body!(submenu, tray_id, item);
    }
    Ok(())
}

// Remove the old MenuParent trait and append_items function

// Handles start at 1: 0 is what `tray.create` returns for a failure.
static NEXT_ID: Mutex<u32> = Mutex::new(1);

fn next_id() -> u32 {
    let mut id = NEXT_ID.lock().unwrap();
    let val = *id;
    *id = val.wrapping_add(1);
    val
}

pub fn create_tray(
    icon_rgba: &[u8],
    width: u32,
    height: u32,
    tooltip: &str,
    menu_items: &[TrayMenuItem],
) -> Result<TrayHandle, String> {
    ensure_event_handler();

    // No pixels given: use the app's own icon.
    let (icon_rgba, width, height) = if icon_rgba.is_empty() {
        match APP_ICON.get() {
            Some((rgba, w, h)) => (rgba.as_slice(), *w, *h),
            None => return Err("this app has no icon to use: pass pixels to tray.create".to_string()),
        }
    } else {
        (icon_rgba, width, height)
    };
    let icon = Icon::from_rgba(icon_rgba.to_vec(), width, height)
        .map_err(|e| format!("bad icon data: {e:?}"))?;

    let id = next_id();

    let mut builder = TrayIconBuilder::new()
        .with_tooltip(tooltip)
        .with_icon(icon);

    if !menu_items.is_empty() {
        let menu = build_menu(id, menu_items)?;
        builder = builder.with_menu(Box::new(menu) as Box<dyn ContextMenu>);
    }

    let tray_icon = builder
        .build()
        .map_err(|e| format!("failed to create tray: {e}"))?;
    let icon_id = tray_icon.id().clone();

    TRAY_MAP.lock().unwrap().insert(id, icon_id);

    log::info!("tray icon created: id={id}, tooltip={tooltip:?}");

    Ok(TrayHandle {
        id,
        icon: tray_icon,
    })
}

pub fn update_menu(handle: &TrayHandle, menu_items: &[TrayMenuItem]) -> Result<(), String> {
    let id = handle.id;

    if menu_items.is_empty() {
        handle.icon.set_menu(None::<Box<dyn muda::ContextMenu>>);
    } else {
        let menu = build_menu(id, menu_items)?;
        handle.icon.set_menu(Some(Box::new(menu) as Box<dyn muda::ContextMenu>));
    }
    Ok(())
}

pub fn set_tooltip(handle: &TrayHandle, tooltip: &str) {
    let _ = handle.icon.set_tooltip(Some(tooltip));
}

pub fn destroy_tray(handle: TrayHandle) {
    let id = handle.id;
    TRAY_MAP.lock().unwrap().remove(&id);
    drop(handle);
    log::info!("tray icon destroyed: id={id}");
}

pub fn poll_events() -> Vec<TrayEvent> {
    let mut q = EVENT_QUEUE.lock().unwrap();
    q.drain(..).collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_tray_without_pixels_or_an_app_icon_says_why() {
        // Nothing registers an app icon in this test binary, so there is nothing to fall back to.
        let err = create_tray(&[], 0, 0, "x", &[]).err().expect("no icon available");
        assert!(err.contains("no icon"), "{err}");
    }

    #[test]
    fn events_go_to_a_sink_when_one_is_set_and_to_the_queue_otherwise() {
        let seen: std::sync::Arc<Mutex<Vec<String>>> = std::sync::Arc::new(Mutex::new(Vec::new()));
        let sink_seen = std::sync::Arc::clone(&seen);
        set_tray_sink(Some(std::sync::Arc::new(move |e| sink_seen.lock().unwrap().push(format!("{e:?}")))));
        emit(TrayEvent::Click { tray_id: 9001 });
        set_tray_sink(None);
        emit(TrayEvent::DoubleClick { tray_id: 9002 });
        assert!(seen.lock().unwrap().iter().any(|e| e.contains("9001")));
        let queued: Vec<String> = poll_events().into_iter().map(|e| format!("{e:?}")).collect();
        assert!(queued.iter().any(|e| e.contains("9002")));
        assert!(!queued.iter().any(|e| e.contains("9001")), "a sunk event must not also queue");
    }

    #[test]
    fn handles_never_collide_with_the_failure_value() {
        assert_ne!(next_id(), 0);
    }
}
