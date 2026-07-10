//! Static gilrs-backed GamepadCap implementation.

use glyx_cap_abi::{GamepadCap, ABI_VERSION};
use parking_lot::Mutex;

static GILRS: Mutex<Option<gilrs::Gilrs>> = Mutex::new(None);

unsafe extern "C" fn gamepad_init() -> i32 {
    let mut g = GILRS.lock();
    if g.is_none() {
        match gilrs::Gilrs::new() {
            Ok(gilrs) => { *g = Some(gilrs); 0 }
            Err(e)    => { log::warn!("[glyx-cap-gamepad] init: {e}"); -1 }
        }
    } else {
        0
    }
}

unsafe extern "C" fn gamepad_poll(
    out_buf: *mut u8,
    out_len: *mut usize,
    buf_cap: usize,
) {
    let json = {
        let mut g = GILRS.lock();
        if g.is_none() {
            match gilrs::Gilrs::new() { Ok(gilrs) => { *g = Some(gilrs); } Err(_) => {} }
        }
        match g.as_mut() {
            None => "[]".to_string(),
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
                        gilrs::EventType::Connected    => r#"{"type":"connected"}"#.to_string(),
                        gilrs::EventType::Disconnected => r#"{"type":"disconnected"}"#.to_string(),
                        _ => r#"{"type":"other"}"#.to_string(),
                    };
                    let name = gp.name();
                    let name_json = format!("{:?}", name);
                    events.push(format!(
                        r#"{{"id":{},"name":{},"event":{}}}"#,
                        usize::from(ev.id), name_json, ev_json
                    ));
                }
                if events.is_empty() { "[]".to_string() }
                else { format!("[{}]", events.join(",")) }
            }
        }
    };

    let bytes = json.as_bytes();
    let write = bytes.len().min(buf_cap);
    std::ptr::copy_nonoverlapping(bytes.as_ptr(), out_buf, write);
    *out_len = write;
}

unsafe extern "C" fn gamepad_shutdown() {
    *GILRS.lock() = None;
}

static GAMEPAD_CAP: GamepadCap = GamepadCap {
    version:  ABI_VERSION,
    init:     gamepad_init,
    poll:     gamepad_poll,
    shutdown: gamepad_shutdown,
};

pub fn static_cap() -> &'static GamepadCap {
    &GAMEPAD_CAP
}

#[no_mangle]
pub extern "C" fn glyx_cap_gamepad() -> *const GamepadCap {
    &GAMEPAD_CAP
}
