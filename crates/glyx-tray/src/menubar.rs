//! Native menu bar: the File / Edit / View row under a window's title bar on
//! Windows, and the app menu at the top of the screen on macOS. `muda` cannot
//! attach one to Glyx's winit windows on Linux, so there `supported()` is false
//! and an app uses the in-app `<MenuBar>` instead.
//!
//! The macOS path compiles and follows `muda`'s documented use, but has not run
//! on a Mac. It adds the conventional application menu (About, Services, Hide,
//! Quit) in front of the app's own menus, and lets AppKit fire accelerators.
//!
//! The description is the same JSON shape the tray menu uses, with two
//! differences: the top level must be submenus (`children` is required there),
//! and `checked` is optional (`checked: false` is an unchecked check item, an
//! absent `checked` is a plain item).
//!
//! Item ids are one namespace for the whole process. A click is handed to the
//! sink registered with `set_menu_bar_sink`, which the runtime points at the
//! window's JS event queue, so JS hears it without polling.
//! Accelerators are shown in the menu but not triggered by it: Win32 would need
//! `TranslateAcceleratorW` in the event loop, which winit owns. The JS side
//! matches the key chords itself.

use std::collections::{HashMap, HashSet};
use std::sync::{Arc, LazyLock, Mutex};

use muda::accelerator::Accelerator;

fn default_true() -> bool { true }

#[derive(Debug, Clone, serde::Deserialize)]
pub struct MenuBarItem {
    #[serde(default)]
    pub id: String,
    #[serde(default)]
    pub label: String,
    #[serde(default = "default_true")]
    pub enabled: bool,
    /// Present (true or false) makes this a checkable item.
    #[serde(default)]
    pub checked: Option<bool>,
    #[serde(default)]
    pub separator: bool,
    #[serde(default)]
    pub accelerator: Option<String>,
    #[serde(default)]
    pub children: Vec<MenuBarItem>,
}

#[derive(Debug, Clone, serde::Serialize)]
pub struct MenuBarEvent {
    pub id: String,
    /// New state, for a checkable item.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checked: Option<bool>,
}

/// Where clicks go. Called on the window's thread, from inside its message handling.
pub type MenuBarSink = Arc<dyn Fn(MenuBarEvent) + Send + Sync>;
static SINK: LazyLock<Mutex<Option<MenuBarSink>>> = LazyLock::new(|| Mutex::new(None));

/// Point menu-bar clicks at `sink` (or nowhere, with `None`).
pub fn set_menu_bar_sink(sink: Option<MenuBarSink>) {
    *SINK.lock().unwrap() = sink;
}
/// The checked state of every checkable item. `muda` flips a check item itself
/// and sends the click while still holding a borrow of it, so reading the item
/// from the click handler panics: the state is tracked here instead.
static CHECKED: LazyLock<Mutex<HashMap<String, bool>>> = LazyLock::new(|| Mutex::new(HashMap::new()));
/// Every id currently in an installed menu bar, so the shared `muda` event
/// handler can tell a menu-bar click from a tray click.
static IDS: LazyLock<Mutex<HashSet<String>>> = LazyLock::new(|| Mutex::new(HashSet::new()));

/// True where a native menu bar can be attached.
pub fn supported() -> bool { cfg!(any(target_os = "windows", target_os = "macos")) }

// Only the native menu bar (Windows, macOS) and the tests read this.
#[cfg(any(target_os = "windows", target_os = "macos", test))]
fn collect_checked(items: &[MenuBarItem], out: &mut HashMap<String, bool>) {
    for item in items {
        if !item.children.is_empty() {
            collect_checked(&item.children, out);
        } else if let (false, Some(state)) = (item.separator, item.checked) {
            out.insert(item.id.clone(), state);
        }
    }
}

/// Check a description before building it, with errors that name the item.
pub fn validate(items: &[MenuBarItem]) -> Result<(), String> {
    if items.is_empty() {
        return Err("a menu bar needs at least one menu".into());
    }
    let mut seen = HashSet::new();
    for (i, top) in items.iter().enumerate() {
        if top.separator || top.label.trim().is_empty() {
            return Err(format!("menu {i}: top-level entries need a label"));
        }
        if top.children.is_empty() {
            return Err(format!("menu {:?}: top-level entries must be menus with `children`", top.label));
        }
        validate_children(&top.label, &top.children, &mut seen)?;
    }
    Ok(())
}

fn validate_children(path: &str, items: &[MenuBarItem], seen: &mut HashSet<String>) -> Result<(), String> {
    for item in items {
        if item.separator { continue; }
        if item.label.trim().is_empty() {
            return Err(format!("{path}: an item has no label"));
        }
        let here = format!("{path} > {}", item.label);
        if !item.children.is_empty() {
            validate_children(&here, &item.children, seen)?;
            continue;
        }
        if item.id.is_empty() {
            return Err(format!("{here}: an item needs an `id` so its clicks can be told apart"));
        }
        if !seen.insert(item.id.clone()) {
            return Err(format!("{here}: id {:?} is used more than once", item.id));
        }
        if let Some(a) = item.accelerator.as_deref() {
            if a.parse::<Accelerator>().is_err() {
                return Err(format!("{here}: {a:?} is not a valid accelerator (try \"Ctrl+N\" or \"CmdOrCtrl+Shift+S\")"));
            }
        }
    }
    Ok(())
}

/// Called by the shared `muda` event handler. True when the click belonged to
/// a menu bar (and was queued), false when it is the tray's.
pub(crate) fn dispatch(id: &str) -> bool {
    if !IDS.lock().unwrap().contains(id) { return false; }
    // The click on a check item already flipped it inside `muda`; mirror that.
    let checked = CHECKED.lock().unwrap().get_mut(id).map(|state| { *state = !*state; *state });
    let sink = SINK.lock().unwrap().clone();
    if let Some(sink) = sink {
        sink(MenuBarEvent { id: id.to_string(), checked });
    }
    true
}

#[cfg(any(target_os = "windows", target_os = "macos"))]
mod imp {
    use super::*;
    use std::cell::RefCell;
    use muda::{CheckMenuItem, Menu, MenuItem, PredefinedMenuItem, Submenu};

    pub(super) enum Entry {
        Normal(MenuItem),
        Check(CheckMenuItem),
    }

    struct Installed {
        menu: Menu,
        entries: HashMap<String, Entry>,
    }

    // `Menu` is not `Send`: it lives on the window's thread, which is also the
    // thread JS runs on.
    thread_local! {
        static INSTALLED: RefCell<HashMap<isize, Installed>> = RefCell::new(HashMap::new());
    }

    pub(super) fn build(items: &[MenuBarItem]) -> Result<(Menu, HashMap<String, Entry>), String> {
        let menu = Menu::new();
        let mut entries = HashMap::new();
        for top in items {
            let sub = Submenu::new(&top.label, top.enabled);
            append(&sub, &top.children, &mut entries)?;
            menu.append(&sub).map_err(|e| e.to_string())?;
        }
        Ok((menu, entries))
    }

    fn accel(item: &MenuBarItem) -> Option<Accelerator> {
        item.accelerator.as_deref().and_then(|a| a.parse().ok())
    }

    fn append(parent: &Submenu, items: &[MenuBarItem], entries: &mut HashMap<String, Entry>) -> Result<(), String> {
        for item in items {
            if item.separator {
                parent.append(&PredefinedMenuItem::separator()).map_err(|e| e.to_string())?;
            } else if !item.children.is_empty() {
                let sub = Submenu::new(&item.label, item.enabled);
                append(&sub, &item.children, entries)?;
                parent.append(&sub).map_err(|e| e.to_string())?;
            } else if let Some(checked) = item.checked {
                let mi = CheckMenuItem::with_id(item.id.as_str(), &item.label, item.enabled, checked, accel(item));
                parent.append(&mi).map_err(|e| e.to_string())?;
                entries.insert(item.id.clone(), Entry::Check(mi));
            } else {
                let mi = MenuItem::with_id(item.id.as_str(), &item.label, item.enabled, accel(item));
                parent.append(&mi).map_err(|e| e.to_string())?;
                entries.insert(item.id.clone(), Entry::Normal(mi));
            }
        }
        Ok(())
    }

    /// Windows: the menu belongs to one window. macOS: there is one app menu, so the key is always 0.
    pub(super) fn install(key: isize, items: &[MenuBarItem]) -> Result<(), String> {
        crate::ensure_event_handler();
        let (menu, entries) = build(items)?;
        #[cfg(target_os = "macos")]
        add_app_menu(&menu)?;
        INSTALLED.with(|all| {
            let mut all = all.borrow_mut();
            if let Some(old) = all.remove(&key) {
                forget(&old);
                detach(&old.menu, key);
            }
            attach(&menu, key)?;
            IDS.lock().unwrap().extend(entries.keys().cloned());
            collect_checked(items, &mut CHECKED.lock().unwrap());
            all.insert(key, Installed { menu, entries });
            Ok(())
        })
    }

    #[cfg(target_os = "windows")]
    fn attach(menu: &Menu, hwnd: isize) -> Result<(), String> {
        // SAFETY: the caller passes the window's own HWND, on the window's thread.
        unsafe { menu.init_for_hwnd(hwnd) }.map_err(|e| format!("could not attach the menu bar: {e}"))
    }

    #[cfg(target_os = "windows")]
    fn detach(menu: &Menu, hwnd: isize) {
        // SAFETY: `hwnd` was valid when it was installed and the menu is still ours.
        let _ = unsafe { menu.remove_for_hwnd(hwnd) };
    }

    #[cfg(target_os = "macos")]
    fn attach(menu: &Menu, _key: isize) -> Result<(), String> {
        menu.init_for_nsapp();
        Ok(())
    }

    #[cfg(target_os = "macos")]
    fn detach(menu: &Menu, _key: isize) {
        menu.remove_for_nsapp();
    }

    /// The menu macOS puts first, named after the app: About, Services, Hide, Quit.
    #[cfg(target_os = "macos")]
    fn add_app_menu(menu: &Menu) -> Result<(), String> {
        let app = Submenu::new("App", true);
        app.append_items(&[
            &PredefinedMenuItem::about(None, None),
            &PredefinedMenuItem::separator(),
            &PredefinedMenuItem::services(None),
            &PredefinedMenuItem::separator(),
            &PredefinedMenuItem::hide(None),
            &PredefinedMenuItem::hide_others(None),
            &PredefinedMenuItem::show_all(None),
            &PredefinedMenuItem::separator(),
            &PredefinedMenuItem::quit(None),
        ]).map_err(|e| e.to_string())?;
        menu.insert(&app, 0).map_err(|e| e.to_string())
    }

    fn forget(old: &Installed) {
        let mut ids = IDS.lock().unwrap();
        let mut checked = CHECKED.lock().unwrap();
        for id in old.entries.keys() { ids.remove(id); checked.remove(id); }
    }

    pub(super) fn remove(key: isize) -> bool {
        INSTALLED.with(|all| match all.borrow_mut().remove(&key) {
            Some(old) => {
                forget(&old);
                detach(&old.menu, key);
                true
            }
            None => false,
        })
    }

    pub(super) fn set_enabled(id: &str, enabled: bool) -> bool {
        INSTALLED.with(|all| {
            for inst in all.borrow().values() {
                match inst.entries.get(id) {
                    Some(Entry::Normal(m)) => { m.set_enabled(enabled); return true; }
                    Some(Entry::Check(m)) => { m.set_enabled(enabled); return true; }
                    None => {}
                }
            }
            false
        })
    }

    pub(super) fn set_checked(id: &str, checked: bool) -> bool {
        INSTALLED.with(|all| {
            for inst in all.borrow().values() {
                if let Some(Entry::Check(m)) = inst.entries.get(id) {
                    m.set_checked(checked);
                    CHECKED.lock().unwrap().insert(id.to_string(), checked);
                    return true;
                }
            }
            false
        })
    }
}

#[cfg(not(any(target_os = "windows", target_os = "macos")))]
mod imp {
    use super::*;
    const NOT_YET: &str = "a native menu bar is only available on Windows and macOS: use <MenuBar> here";
    pub(super) fn install(_hwnd: isize, _items: &[MenuBarItem]) -> Result<(), String> { Err(NOT_YET.into()) }
    pub(super) fn remove(_hwnd: isize) -> bool { false }
    pub(super) fn set_enabled(_id: &str, _enabled: bool) -> bool { false }
    pub(super) fn set_checked(_id: &str, _checked: bool) -> bool { false }
}

/// Replace the menu bar of the window with this native handle (HWND on Windows).
pub fn set_menu_bar(hwnd: isize, items: &[MenuBarItem]) -> Result<(), String> {
    validate(items)?;
    imp::install(hwnd, items)
}

/// Remove a window's menu bar. False when it had none.
pub fn clear_menu_bar(hwnd: isize) -> bool { imp::remove(hwnd) }

/// Enable or disable an item by id. False when no such item.
pub fn set_menu_item_enabled(id: &str, enabled: bool) -> bool { imp::set_enabled(id, enabled) }

/// Check or uncheck a checkable item by id. False when no such checkable item.
pub fn set_menu_item_checked(id: &str, checked: bool) -> bool { imp::set_checked(id, checked) }

#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: &str, label: &str) -> MenuBarItem {
        MenuBarItem { id: id.into(), label: label.into(), enabled: true, checked: None, separator: false, accelerator: None, children: vec![] }
    }
    fn menu(label: &str, children: Vec<MenuBarItem>) -> MenuBarItem {
        MenuBarItem { children, ..item("", label) }
    }
    fn sep() -> MenuBarItem { MenuBarItem { separator: true, ..item("", "") } }

    #[test]
    fn a_normal_menu_validates() {
        let bar = vec![menu("&File", vec![item("new", "New"), sep(), item("quit", "Quit")]), menu("Edit", vec![item("undo", "Undo")])];
        assert_eq!(validate(&bar), Ok(()));
    }

    #[test]
    fn the_top_level_must_be_menus() {
        assert!(validate(&[]).unwrap_err().contains("at least one"));
        assert!(validate(&[item("x", "Loose item")]).unwrap_err().contains("children"));
        assert!(validate(&[menu("", vec![item("a", "A")])]).unwrap_err().contains("label"));
    }

    #[test]
    fn items_need_unique_ids_and_labels() {
        let missing = vec![menu("File", vec![item("", "New")])];
        assert!(validate(&missing).unwrap_err().contains("File > New"));
        let dup = vec![menu("File", vec![item("a", "One")]), menu("Edit", vec![item("a", "Two")])];
        assert!(validate(&dup).unwrap_err().contains("more than once"));
        let blank = vec![menu("File", vec![item("a", " ")])];
        assert!(validate(&blank).unwrap_err().contains("no label"));
    }

    #[test]
    fn submenus_are_checked_and_named_by_their_path() {
        let nested = vec![menu("View", vec![menu("Zoom", vec![item("", "In")])])];
        assert!(validate(&nested).unwrap_err().contains("View > Zoom > In"));
    }

    #[test]
    fn a_bad_accelerator_is_reported_not_dropped() {
        let mut bad = item("a", "New");
        bad.accelerator = Some("Ctrl+Nope".into());
        assert!(validate(&[menu("File", vec![bad])]).unwrap_err().contains("not a valid accelerator"));
        let mut good = item("a", "New");
        good.accelerator = Some("CmdOrCtrl+Shift+N".into());
        assert_eq!(validate(&[menu("File", vec![good])]), Ok(()));
    }

    #[test]
    fn json_from_javascript_parses() {
        let json = r#"[{"label":"File","children":[{"id":"open","label":"Open","accelerator":"Ctrl+O"},{"separator":true},{"id":"auto","label":"Autosave","checked":false}]}]"#;
        let bar: Vec<MenuBarItem> = serde_json::from_str(json).unwrap();
        assert_eq!(validate(&bar), Ok(()));
        assert_eq!(bar[0].children[2].checked, Some(false));
        assert!(bar[0].children[0].enabled);
    }

    #[test]
    fn clicks_that_are_not_ours_are_left_for_the_tray() {
        assert!(!dispatch("no-such-menu-bar-id"));
    }

    #[test]
    fn a_click_on_a_check_item_reports_the_flipped_state() {
        let seen: Arc<Mutex<Vec<MenuBarEvent>>> = Arc::new(Mutex::new(Vec::new()));
        let sink_seen = Arc::clone(&seen);
        set_menu_bar_sink(Some(Arc::new(move |e| sink_seen.lock().unwrap().push(e))));
        IDS.lock().unwrap().insert("test.flip".into());
        CHECKED.lock().unwrap().insert("test.flip".into(), false);
        assert!(dispatch("test.flip"));
        assert!(dispatch("test.flip"));
        set_menu_bar_sink(None);
        let events: Vec<_> = seen.lock().unwrap().iter().filter(|e| e.id == "test.flip").cloned().collect();
        IDS.lock().unwrap().remove("test.flip");
        CHECKED.lock().unwrap().remove("test.flip");
        assert_eq!(events.iter().map(|e| e.checked).collect::<Vec<_>>(), vec![Some(true), Some(false)]);
    }

    #[test]
    fn initial_checked_states_are_collected_through_submenus() {
        let mut on = item("a", "A"); on.checked = Some(true);
        let mut off = item("b", "B"); off.checked = Some(false);
        let plain = item("c", "C");
        let bar = vec![menu("View", vec![on, menu("More", vec![off, plain])])];
        let mut got = HashMap::new();
        collect_checked(&bar, &mut got);
        assert_eq!(got.get("a"), Some(&true));
        assert_eq!(got.get("b"), Some(&false));
        assert_eq!(got.get("c"), None);
    }

    #[cfg(target_os = "windows")]
    #[test]
    fn a_menu_builds_with_every_kind_of_item() {
        let mut check = item("auto", "Autosave");
        check.checked = Some(true);
        let mut acc = item("new", "New");
        acc.accelerator = Some("Ctrl+N".into());
        let bar = vec![menu("&File", vec![acc, sep(), check, menu("Recent", vec![item("r1", "One")])])];
        let (menu, entries) = imp::build(&bar).expect("builds");
        assert_eq!(menu.items().len(), 1);
        assert_eq!(entries.len(), 3);
    }
}
