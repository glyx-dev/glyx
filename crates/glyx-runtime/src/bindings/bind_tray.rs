use super::*;

use std::cell::RefCell;
use std::collections::HashMap;

thread_local! {
    static TRAY_HANDLES: RefCell<HashMap<u32, glyx_tray::TrayHandle>> =
        RefCell::new(HashMap::new());
}

/// `__glyx_tray_create(rgba_buf: ArrayBuffer, width: u32, height: u32, tooltip: string, menu_json?: string) -> u32`
pub fn tray_create_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);

    if !glyx_security::get().tray {
        rv.set_uint32(0);
        return;
    }

    let width = args.get(1).uint32_value(scope).unwrap_or(0);
    let height = args.get(2).uint32_value(scope).unwrap_or(0);
    let tooltip = v8_arg_to_string(scope, &args, 3);
    let menu_json = v8_arg_to_string(scope, &args, 4);

    let rgba = {
        let v = args.get(0);
        if v.is_array_buffer() {
            let ab = v8::Local::<v8::ArrayBuffer>::try_from(v).unwrap();
            let store = ab.get_backing_store();
            let raw = store.data().unwrap();
            let data = unsafe { std::slice::from_raw_parts(raw.as_ptr() as *const u8, store.byte_length()) };
            data.to_vec()
        } else {
            vec![]
        }
    };

    if rgba.is_empty() || width == 0 || height == 0 {
        rv.set_uint32(0);
        return;
    }

    let menu_items: Vec<glyx_tray::TrayMenuItem> = if menu_json.is_empty() {
        vec![]
    } else {
        serde_json::from_str(&menu_json).unwrap_or_default()
    };

    match glyx_tray::create_tray(&rgba, width, height, &tooltip, &menu_items) {
        Ok(handle) => {
            let id = handle.id;
            TRAY_HANDLES.with(|h| h.borrow_mut().insert(id, handle));
            rv.set_uint32(id);
        }
        Err(e) => {
            log::error!("tray_create: {e}");
            rv.set_uint32(0);
        }
    }
}

/// `__glyx_tray_destroy(tray_id: u32) -> bool`
pub fn tray_destroy_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let tray_id = args.get(0).uint32_value(scope).unwrap_or(0);

    let removed = TRAY_HANDLES.with(|h| {
        let mut handles = h.borrow_mut();
        if let Some(handle) = handles.remove(&tray_id) {
            glyx_tray::destroy_tray(handle);
            true
        } else {
            false
        }
    });
    rv.set_bool(removed);
}

/// `__glyx_tray_update_menu(tray_id: u32, menu_json: string) -> bool`
pub fn tray_update_menu_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let tray_id = args.get(0).uint32_value(scope).unwrap_or(0);
    let menu_json = v8_arg_to_string(scope, &args, 1);

    let menu_items: Vec<glyx_tray::TrayMenuItem> = serde_json::from_str(&menu_json).unwrap_or_default();

    let ok = TRAY_HANDLES.with(|h| {
        let handles = h.borrow();
        if let Some(handle) = handles.get(&tray_id) {
            glyx_tray::update_menu(handle, &menu_items).is_ok()
        } else {
            false
        }
    });
    rv.set_bool(ok);
}

/// `__glyx_tray_set_tooltip(tray_id: u32, tooltip: string)`
pub fn tray_set_tooltip_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    args: v8::FunctionCallbackArguments,
    _rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);
    let tray_id = args.get(0).uint32_value(scope).unwrap_or(0);
    let tooltip = v8_arg_to_string(scope, &args, 1);

    TRAY_HANDLES.with(|h| {
        let handles = h.borrow();
        if let Some(handle) = handles.get(&tray_id) {
            glyx_tray::set_tooltip(handle, &tooltip);
        }
    });
}

/// `__glyx_tray_poll_events() -> string` (JSON array)
pub fn tray_poll_events_callback(
    scope: &mut v8::PinScope<'_, '_, v8::Context>,
    _args: v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let ctx = scope.get_current_context();
    let scope = &mut v8::ContextScope::new(scope, ctx);

    let events = glyx_tray::poll_events();
    if events.is_empty() {
        rv.set_empty_string();
        return;
    }
    let json = serde_json::to_string(&events).unwrap_or_default();
    let s = v8::String::new(scope, &json).unwrap();
    rv.set(s.into());
}
