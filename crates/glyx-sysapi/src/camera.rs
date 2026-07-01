//! Camera device enumeration for glyx-sysapi.
//!
//! Capture loop and wgpu texture management live in glyx-core (where the GPU context is).
//! This module only provides the device list for `__glyx_camera_list`.

pub struct CameraDevice {
    pub index: u32,
    pub name:  String,
}

/// Enumerate available camera devices.
pub fn list_cameras() -> Vec<CameraDevice> {
    use nokhwa::utils::ApiBackend;
    nokhwa::query(ApiBackend::Auto)
        .unwrap_or_default()
        .into_iter()
        .enumerate()
        .map(|(i, info)| CameraDevice {
            index: i as u32,
            name:  info.human_name().to_string(),
        })
        .collect()
}
