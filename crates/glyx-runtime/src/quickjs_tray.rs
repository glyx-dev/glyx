//! `__glyx_tray_*` bindings, ported from `bind_tray.rs`'s V8 implementation.
//! All sync. `TRAY_HANDLES` mirrors V8's own `thread_local!` design (a
//! system tray icon is inherently single-window/single-thread state) —
//! same rationale as `quickjs_sys.rs`'s `system_watch`/`system_unwatch`.

use std::cell::RefCell;
use std::collections::HashMap;
use rquickjs::{Ctx, TypedArray};

thread_local! {
    static TRAY_HANDLES: RefCell<HashMap<u32, glyx_tray::TrayHandle>> = RefCell::new(HashMap::new());
}

pub(crate) fn tray_create(ctx: Ctx<'_>, rgba: TypedArray<'_, u8>, width: u32, height: u32, tooltip: String, menu_json: String) -> u32 {
    let _ = &ctx;
    let rgba = rgba.as_bytes().unwrap_or(&[]);
    if rgba.is_empty() || width == 0 || height == 0 { return 0; }
    if !glyx_security::get().tray { return 0; }

    let menu_items: Vec<glyx_tray::TrayMenuItem> = if menu_json.is_empty() {
        vec![]
    } else {
        serde_json::from_str(&menu_json).unwrap_or_default()
    };

    match glyx_tray::create_tray(rgba, width, height, &tooltip, &menu_items) {
        Ok(handle) => {
            let id = handle.id;
            TRAY_HANDLES.with(|h| h.borrow_mut().insert(id, handle));
            id
        }
        Err(e) => { log::error!("tray_create: {e}"); 0 }
    }
}

pub(crate) fn tray_destroy(tray_id: u32) -> bool {
    TRAY_HANDLES.with(|h| {
        let mut handles = h.borrow_mut();
        if let Some(handle) = handles.remove(&tray_id) {
            glyx_tray::destroy_tray(handle);
            true
        } else {
            false
        }
    })
}

pub(crate) fn tray_update_menu(tray_id: u32, menu_json: String) -> bool {
    let menu_items: Vec<glyx_tray::TrayMenuItem> = serde_json::from_str(&menu_json).unwrap_or_default();
    TRAY_HANDLES.with(|h| {
        let handles = h.borrow();
        handles.get(&tray_id).map(|handle| glyx_tray::update_menu(handle, &menu_items).is_ok()).unwrap_or(false)
    })
}

pub(crate) fn tray_set_tooltip(tray_id: u32, tooltip: String) {
    TRAY_HANDLES.with(|h| {
        let handles = h.borrow();
        if let Some(handle) = handles.get(&tray_id) { glyx_tray::set_tooltip(handle, &tooltip); }
    });
}

pub(crate) fn tray_poll_events() -> String {
    let events = glyx_tray::poll_events();
    if events.is_empty() { String::new() } else { serde_json::to_string(&events).unwrap_or_default() }
}
