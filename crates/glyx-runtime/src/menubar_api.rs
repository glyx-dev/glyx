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
    let Some(hwnd) = hwnd else {
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
    glyx_security::get().menubar && hwnd.is_some_and(glyx_tray::clear_menu_bar)
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
