//! glyx-sysapi — system / OS API helpers for Glyx.
//!
//! Provides stateless query functions for battery status, system info,
//! storage drives, a sleep-prevention guard, and OS credential store access.
//!
//! Gamepad and global-shortcut state (which require long-lived objects) live
//! directly in `glyx-runtime`'s `AsyncState` for simplicity.

pub mod credentials;
pub use credentials::{credentials_set, credentials_get, credentials_delete};

pub mod camera;
pub mod microphone;

// ── Battery ───────────────────────────────────────────────────────────────────

pub struct BatteryStatus {
    /// Charge level 0.0–1.0.
    pub level:               f32,
    pub charging:            bool,
    /// Estimated seconds until empty/full. `None` if unknown.
    pub time_remaining_secs: Option<u64>,
}

/// Query the primary battery status.  Returns `None` if no battery is detected
/// or the platform driver fails.
pub fn battery_status() -> Option<BatteryStatus> {
    let manager  = battery::Manager::new().ok()?;
    let battery  = manager.batteries().ok()?.next()?.ok()?;
    let level    = battery.state_of_charge().value;
    let charging = battery.state() == battery::State::Charging;
    let time_remaining_secs = if charging {
        battery.time_to_full().map(|t| t.value as u64)
    } else {
        battery.time_to_empty().map(|t| t.value as u64)
    };
    Some(BatteryStatus { level, charging, time_remaining_secs })
}

// ── System info ───────────────────────────────────────────────────────────────

pub struct SystemInfo {
    pub cpu_name:        String,
    pub cpu_cores:       usize,
    pub memory_total_mb: u64,
    pub memory_used_mb:  u64,
    pub os_name:         String,
    pub os_version:      String,
}

pub fn system_info() -> SystemInfo {
    use sysinfo::System;
    let mut sys = System::new_all();
    sys.refresh_all();
    SystemInfo {
        cpu_name:        sys.cpus().first().map(|c| c.brand().to_string()).unwrap_or_default(),
        cpu_cores:       sys.cpus().len(),
        memory_total_mb: sys.total_memory() / (1024 * 1024),
        memory_used_mb:  sys.used_memory()  / (1024 * 1024),
        os_name:         System::name().unwrap_or_else(|| "Unknown".into()),
        os_version:      System::os_version().unwrap_or_else(|| "Unknown".into()),
    }
}

// ── Storage ───────────────────────────────────────────────────────────────────

pub struct DriveInfo {
    pub name:            String,
    pub mount_point:     String,
    pub total_bytes:     u64,
    pub available_bytes: u64,
}

pub fn storage_drives() -> Vec<DriveInfo> {
    use sysinfo::Disks;
    Disks::new_with_refreshed_list()
        .iter()
        .map(|d| DriveInfo {
            name:            d.name().to_string_lossy().into_owned(),
            mount_point:     d.mount_point().to_string_lossy().into_owned(),
            total_bytes:     d.total_space(),
            available_bytes: d.available_space(),
        })
        .collect()
}

// ── Appearance (dark / light mode) ────────────────────────────────────────────

/// Returns `"dark"`, `"light"`, or `"unknown"`.
///
/// Reads the OS-level preference synchronously:
/// - Windows: `HKCU\...\Themes\Personalize\AppsUseLightTheme` registry value.
/// - macOS:   `NSUserDefaults` via `CFPreferences`.
/// - Linux:   `gsettings org.gnome.desktop.interface color-scheme` (GNOME) or
///            XDG portals when `dark-light` detects another DE.
pub fn dark_mode() -> &'static str {
    match dark_light::detect() {
        dark_light::Mode::Dark    => "dark",
        dark_light::Mode::Light   => "light",
        dark_light::Mode::Default => "unknown",
    }
}

// ── Battery saver ─────────────────────────────────────────────────────────────

/// Returns `true` if the OS battery-saver / power-saver mode is active.
///
/// - Windows: `GetSystemPowerStatus().SystemStatusFlag & 1` (no extra crate —
///   raw Win32 FFI; one kernel call, ~1 µs).
/// - macOS/Linux: returns `false` until native support is added.
pub fn battery_saver_active() -> bool {
    #[cfg(target_os = "windows")]
    {
        use std::mem;
        // SYSTEM_POWER_STATUS layout (winbase.h)
        #[repr(C)]
        struct SystemPowerStatus {
            ac_line_status:       u8,
            battery_flag:         u8,
            battery_life_percent: u8,
            system_status_flag:   u8,  // bit 0 = battery saver active
            battery_life_time:    u32,
            battery_full_life_time: u32,
        }
        extern "system" {
            fn GetSystemPowerStatus(lp_system_power_status: *mut SystemPowerStatus) -> i32;
        }
        let mut status: SystemPowerStatus = unsafe { mem::zeroed() };
        unsafe { GetSystemPowerStatus(&mut status) != 0 && status.system_status_flag & 1 != 0 }
    }
    #[cfg(not(target_os = "windows"))]
    { false }
}

// ── Sleep prevention ──────────────────────────────────────────────────────────

/// Opaque handle that keeps system sleep prevention active.
/// Dropping it releases the lock.
pub struct SleepGuard(pub keepawake::KeepAwake);

/// Prevent the system from sleeping while the returned `SleepGuard` is alive.
/// Returns `None` if the platform does not support sleep prevention or it fails.
pub fn prevent_sleep(reason: &str) -> Option<SleepGuard> {
    keepawake::Builder::default()
        .display(false)
        .idle(true)
        .sleep(true)
        .reason(reason)
        .create()
        .ok()
        .map(SleepGuard)
}
