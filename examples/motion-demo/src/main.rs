#![cfg_attr(all(target_os = "windows", not(debug_assertions)), windows_subsystem = "windows")]

fn main() {
    // Must run before `AppConfig::from_config()` below — see the identical
    // comment in examples/calculator/src/main.rs for why.
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp(None)
        .format_module_path(false)
        .init();
    glyx_core::run(glyx_core::AppConfig::from_config());
}
