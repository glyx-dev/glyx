#![cfg_attr(all(target_os = "windows", not(debug_assertions)), windows_subsystem = "windows")]

fn main() {
    glyx_core::run(glyx_core::AppConfig::from_config());
}
