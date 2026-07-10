//! Static hidapi-backed HidCap implementation.

use glyx_cap_abi::{HidCap, ABI_VERSION};
use parking_lot::Mutex;
use std::collections::HashMap;

struct HidState {
    api:      Option<hidapi::HidApi>,
    devices:  HashMap<u32, hidapi::HidDevice>,
    next_id:  u32,
}

static STATE: Mutex<Option<HidState>> = Mutex::new(None);

fn with_state<R>(f: impl FnOnce(&mut HidState) -> R) -> R {
    let mut g = STATE.lock();
    if g.is_none() {
        *g = Some(HidState { api: None, devices: HashMap::new(), next_id: 1 });
    }
    f(g.as_mut().unwrap())
}

fn ensure_api(s: &mut HidState) -> Result<(), String> {
    if s.api.is_none() {
        s.api = Some(hidapi::HidApi::new().map_err(|e| e.to_string())?);
    }
    Ok(())
}

unsafe fn write_result(s: &str, out_buf: *mut u8, out_len: *mut usize, buf_cap: usize) {
    let bytes = s.as_bytes();
    let write = bytes.len().min(buf_cap);
    std::ptr::copy_nonoverlapping(bytes.as_ptr(), out_buf, write);
    *out_len = write;
}

unsafe extern "C" fn hid_enumerate(
    out_buf: *mut u8,
    out_len: *mut usize,
    buf_cap: usize,
) -> i32 {
    let result = with_state(|s| -> Result<String, String> {
        ensure_api(s)?;
        let api = s.api.as_ref().unwrap();
        let devices: Vec<serde_json::Value> = api.device_list()
            .map(|info| serde_json::json!({
                "vendorId":        info.vendor_id(),
                "productId":       info.product_id(),
                "manufacturer":    info.manufacturer_string().unwrap_or(""),
                "product":         info.product_string().unwrap_or(""),
                "serialNumber":    info.serial_number().unwrap_or(""),
                "interfaceNumber": info.interface_number(),
                "path":            info.path().to_str().unwrap_or(""),
            }))
            .collect();
        serde_json::to_string(&devices).map_err(|e| e.to_string())
    });
    match result {
        Ok(s)  => { write_result(&s, out_buf, out_len, buf_cap); 0 }
        Err(e) => { log::error!("[glyx-cap-hid] enumerate: {e}"); *out_len = 0; -1 }
    }
}

unsafe extern "C" fn hid_open(vendor_id: u16, product_id: u16) -> u32 {
    with_state(|s| {
        if ensure_api(s).is_err() { return 0; }
        let api = s.api.as_ref().unwrap();
        match api.open(vendor_id, product_id) {
            Ok(device) => {
                let id = s.next_id;
                s.next_id += 1;
                s.devices.insert(id, device);
                id
            }
            Err(e) => { log::warn!("[glyx-cap-hid] open {:04x}:{:04x}: {e}", vendor_id, product_id); 0 }
        }
    })
}

unsafe extern "C" fn hid_read(
    handle:  u32,
    out_buf: *mut u8,
    buf_cap: usize,
) -> usize {
    with_state(|s| {
        let Some(device) = s.devices.get(&handle) else { return 0 };
        let mut buf = vec![0u8; buf_cap.min(256)];
        match device.read_timeout(&mut buf, 100) {
            Ok(n) => {
                let write = n.min(buf_cap);
                std::ptr::copy_nonoverlapping(buf.as_ptr(), out_buf, write);
                write
            }
            Err(e) => { log::warn!("[glyx-cap-hid] read: {e}"); 0 }
        }
    })
}

unsafe extern "C" fn hid_write(
    handle:   u32,
    data:     *const u8,
    data_len: usize,
) -> usize {
    let bytes = std::slice::from_raw_parts(data, data_len);
    with_state(|s| {
        let Some(device) = s.devices.get(&handle) else { return 0 };
        match device.write(bytes) {
            Ok(n) => n,
            Err(e) => { log::warn!("[glyx-cap-hid] write: {e}"); 0 }
        }
    })
}

unsafe extern "C" fn hid_close(handle: u32) {
    with_state(|s| { s.devices.remove(&handle); });
}

unsafe extern "C" fn hid_shutdown() {
    let mut g = STATE.lock();
    *g = None;
}

static HID_CAP: HidCap = HidCap {
    version:   ABI_VERSION,
    enumerate: hid_enumerate,
    open:      hid_open,
    read:      hid_read,
    write:     hid_write,
    close:     hid_close,
    shutdown:  hid_shutdown,
};

pub fn static_cap() -> &'static HidCap {
    &HID_CAP
}

#[no_mangle]
pub extern "C" fn glyx_cap_hid() -> *const HidCap {
    &HID_CAP
}
