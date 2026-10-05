//! `__glyx_menubar_*` logic shared by the V8 and QuickJS bindings: the
//! capability check, the window handle, and JSON in/out. The bindings only
//! convert arguments.

use crate::bindings::{EventQueue, InputEvent, RedrawRequest};

/// Where a menu click goes: the window's JS event queue, then a redraw request
/// so the frame loop wakes and JS drains it. The click needs no polling.
pub(crate) fn sink(events: EventQueue, redraw: Option<RedrawRequest>) -> glyx_tray::MenuBarSink {
    std::sync::Arc::new(move |ev| {
        events.lock().push_back(InputEvent::MenuBar { id: ev.id, checked: ev.checked });
        if let Some(r) = &redraw { r(); }
    })
}

/// Reply for `set`: empty on success, otherwise a message for the JS caller to throw.
pub(crate) fn set(hwnd: Option<isize>, items_json: &str, sink: glyx_tray::MenuBarSink) -> String {
    if !glyx_security::get().menubar {
        return "the `menubar` capability is not enabled: add `menubar: true` to the capabilities in glyx.config".into();
    }
    // macOS has one app menu and no HWND, so any key will do there.
    let Some(hwnd) = hwnd.or(if cfg!(target_os = "macos") { Some(0) } else { None }) else {
        return "this window has no native handle to attach a menu bar to".into();
    };
    let items: Vec<glyx_tray::MenuBarItem> = match serde_json::from_str(items_json) {
        Ok(items) => items,
        Err(e) => return format!("the menu description is not valid: {e}"),
    };
    glyx_tray::set_menu_bar_sink(Some(sink));
    match glyx_tray::set_menu_bar(hwnd, &items) {
        Ok(()) => String::new(),
        Err(e) => e,
    }
}

pub(crate) fn clear(hwnd: Option<isize>) -> bool {
    glyx_security::get().menubar
        && hwnd.or(if cfg!(target_os = "macos") { Some(0) } else { None }).is_some_and(glyx_tray::clear_menu_bar)
}

pub(crate) fn set_enabled(id: &str, enabled: bool) -> bool {
    glyx_security::get().menubar && glyx_tray::set_menu_item_enabled(id, enabled)
}

pub(crate) fn set_checked(id: &str, checked: bool) -> bool {
    glyx_security::get().menubar && glyx_tray::set_menu_item_checked(id, checked)
}

/// Whether this platform can attach a native menu bar at all.
pub(crate) fn supported() -> bool {
    glyx_tray::supported()
}

/// `__glyx_tray_listen(on)`: push tray events into the window's JS queue (and wake
/// the frame loop) instead of leaving them for `tray.pollEvents`. False without the capability.
pub(crate) fn tray_listen(on: bool, events: EventQueue, redraw: Option<RedrawRequest>) -> bool {
    if !glyx_security::get().tray { return false; }
    if !on {
        glyx_tray::set_tray_sink(None);
        return true;
    }
    glyx_tray::set_tray_sink(Some(std::sync::Arc::new(move |ev| {
        let json = serde_json::to_string(&ev).unwrap_or_default();
        events.lock().push_back(InputEvent::Tray { json });
        if let Some(r) = &redraw { r(); }
    })));
    true
}
