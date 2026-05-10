#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

fn main() {
    velox_core::run(velox_core::AppConfig::from_config());
}
