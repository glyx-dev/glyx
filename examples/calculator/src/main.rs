#![cfg_attr(all(target_os = "windows", not(debug_assertions)), windows_subsystem = "windows")]

fn main() {
    // Must run before `AppConfig::from_config()` below — that call logs
    // config/plugin/capability parsing results, and those log calls silently
    // no-op if no logger is registered yet. `glyx_core::run()` also installs
    // a fallback logger, but only after its `config` argument has already
    // been evaluated, which is too late for from_config()'s own logging.
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp(None)
        .format_module_path(false)
        .init();
    glyx_core::run(glyx_core::AppConfig::from_config());
}
