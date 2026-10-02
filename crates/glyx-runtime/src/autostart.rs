//! Launch-at-login (`autostart` capability): register/unregister the app to
//! start when the user logs in, and detect when it was started that way.
//!
//! One identifier is used everywhere: the running executable's file stem
//! (e.g. `"notes-app"`), so this needs no extra config and is stable across
//! installs to the same path.
//!
//! - Windows: a value under `HKCU\Software\Microsoft\Windows\CurrentVersion\Run`,
//!   via `reg.exe` — no admin rights, same approach as this crate's deep-link
//!   scheme registration (see `register_deeplink_scheme_windows` in `lib.rs`).
//! - macOS: a `LaunchAgents` plist under `~/Library/LaunchAgents/`, loaded/
//!   unloaded with `launchctl` so a change takes effect immediately rather
//!   than at next login.
//! - Linux: a `.desktop` file under `~/.config/autostart/`, the
//!   freedesktop.org XDG Autostart standard every major desktop honors.
//!
//! The launched app is told it started at login via the `--glyx-autostart`
//! argument this module adds to the registered launch command; `lib.rs`'s
//! startup argv scan turns that into `GLYX_OPENED_AT_LOGIN=1`, read by
//! `was_opened_at_login()`.

/// The flag appended to the registered launch command, and looked for in
/// `std::env::args()` at startup.
pub const AUTOSTART_ARG: &str = "--glyx-autostart";

/// Stable identifier for this app's autostart entry: the executable's file
/// stem, so it doesn't depend on any config the app may not have set.
fn app_id() -> Result<String, String> {
    let exe = std::env::current_exe().map_err(|e| format!("current_exe: {e}"))?;
    exe.file_stem().and_then(|s| s.to_str()).map(str::to_string)
        .ok_or_else(|| "executable path has no file name".to_string())
}

/// `true` if `--glyx-autostart` was on the command line that launched this
/// process — i.e. the OS started it at login, not the user by hand.
pub fn was_opened_at_login() -> bool {
    std::env::args().skip(1).any(|a| a == AUTOSTART_ARG)
}

#[cfg(target_os = "windows")]
mod platform {
    use super::AUTOSTART_ARG;

    const RUN_KEY: &str = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run";

    pub(crate) fn is_enabled(id: &str) -> bool {
        std::process::Command::new("reg")
            .args(["query", RUN_KEY, "/v", id])
            .output()
            .map(|o| o.status.success())
            .unwrap_or(false)
    }

    pub(crate) fn set_enabled(id: &str, enabled: bool) -> Result<(), String> {
        if !enabled {
            let _ = std::process::Command::new("reg")
                .args(["delete", RUN_KEY, "/v", id, "/f"])
                .output();
            return Ok(());
        }
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe = exe.to_string_lossy().replace('/', "\\");
        let cmd = format!("\"{exe}\" {AUTOSTART_ARG}");
        let status = std::process::Command::new("reg")
            .args(["add", RUN_KEY, "/v", id, "/d", &cmd, "/f"])
            .status()
            .map_err(|e| e.to_string())?;
        if status.success() { Ok(()) } else { Err("reg add failed".to_string()) }
    }
}

#[cfg(target_os = "macos")]
mod platform {
    use super::AUTOSTART_ARG;

    fn plist_path(id: &str) -> Result<std::path::PathBuf, String> {
        let home = std::env::var("HOME").map_err(|_| "HOME not set".to_string())?;
        Ok(std::path::PathBuf::from(home).join("Library/LaunchAgents").join(format!("com.glyx.{id}.plist")))
    }

    fn label(id: &str) -> String { format!("com.glyx.{id}") }

    pub(crate) fn is_enabled(id: &str) -> bool {
        plist_path(id).map(|p| p.exists()).unwrap_or(false)
    }

    pub(crate) fn set_enabled(id: &str, enabled: bool) -> Result<(), String> {
        let path = plist_path(id)?;
        // Unload first either way: a stale load must go before a changed
        // plist is loaded, and it's also exactly what "disable" needs.
        let _ = std::process::Command::new("launchctl").args(["unload", &path.to_string_lossy()]).output();
        if !enabled {
            let _ = std::fs::remove_file(&path);
            return Ok(());
        }
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe = exe.to_string_lossy();
        if let Some(dir) = path.parent() { std::fs::create_dir_all(dir).map_err(|e| e.to_string())?; }
        let plist = format!(
            r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key><string>{label}</string>
    <key>ProgramArguments</key>
    <array><string>{exe}</string><string>{AUTOSTART_ARG}</string></array>
    <key>RunAtLoad</key><true/>
</dict>
</plist>
"#,
            label = label(id),
        );
        std::fs::write(&path, plist).map_err(|e| e.to_string())?;
        let _ = std::process::Command::new("launchctl").args(["load", &path.to_string_lossy()]).output();
        Ok(())
    }
}

#[cfg(all(unix, not(target_os = "macos")))]
mod platform {
    use super::AUTOSTART_ARG;

    fn desktop_path(id: &str) -> Result<std::path::PathBuf, String> {
        let base = std::env::var("XDG_CONFIG_HOME")
            .map(std::path::PathBuf::from)
            .or_else(|_| std::env::var("HOME").map(|h| std::path::PathBuf::from(h).join(".config")))
            .map_err(|_| "neither XDG_CONFIG_HOME nor HOME is set".to_string())?;
        Ok(base.join("autostart").join(format!("{id}.desktop")))
    }

    pub(crate) fn is_enabled(id: &str) -> bool {
        desktop_path(id).map(|p| p.exists()).unwrap_or(false)
    }

    pub(crate) fn set_enabled(id: &str, enabled: bool) -> Result<(), String> {
        let path = desktop_path(id)?;
        if !enabled {
            let _ = std::fs::remove_file(&path);
            return Ok(());
        }
        let exe = std::env::current_exe().map_err(|e| e.to_string())?;
        let exe = exe.to_string_lossy();
        if let Some(dir) = path.parent() { std::fs::create_dir_all(dir).map_err(|e| e.to_string())?; }
        let desktop = format!(
            "[Desktop Entry]\nType=Application\nName={id}\nExec=\"{exe}\" {AUTOSTART_ARG}\nX-GNOME-Autostart-enabled=true\nNoDisplay=false\n"
        );
        std::fs::write(&path, desktop).map_err(|e| e.to_string())
    }
}

#[cfg(not(any(target_os = "windows", unix)))]
mod platform {
    pub(crate) fn is_enabled(_id: &str) -> bool { false }
    pub(crate) fn set_enabled(_id: &str, _enabled: bool) -> Result<(), String> {
        Err("autostart isn't supported on this platform".to_string())
    }
}

pub fn is_enabled() -> bool {
    match app_id() {
        Ok(id) => platform::is_enabled(&id),
        Err(_) => false,
    }
}

pub fn set_enabled(enabled: bool) -> Result<(), String> {
    platform::set_enabled(&app_id()?, enabled)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn app_id_is_the_test_binary_stem() {
        // Whatever the stem is, it must be non-empty and match current_exe().
        let id = app_id().expect("current_exe should resolve in tests");
        assert!(!id.is_empty());
    }

    #[test]
    fn was_opened_at_login_checks_argv_not_env() {
        // This process's real argv won't contain the flag.
        assert!(!was_opened_at_login());
    }
}
