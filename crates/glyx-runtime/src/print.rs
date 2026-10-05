//! Printing (`print` capability): list printers, find the default, and send
//! a file to one. Engine-neutral — both `bind_print.rs` (V8) and
//! `quickjs_sys.rs`'s print functions call straight into this.
//!
//! No new dependency: every platform already ships a CLI for this.
//! - Windows: PowerShell's `Get-Printer`/`Get-CimInstance` for listing, and
//!   `Start-Process -Verb Print` (i.e. the OS's own "Print" shell verb) to
//!   print — whatever app is associated with the file type handles it, the
//!   same thing right-click → Print does. No way to target a specific
//!   printer through this verb, so `printer` is accepted but only honored
//!   on macOS/Linux; see `print_file`'s doc.
//! - macOS / Linux: CUPS's `lpstat` (list/default) and `lp` (print) — CUPS
//!   is the printing system on both, so the same commands work on either.

use tokio::process::Command;

/// Run `cmd` and return trimmed stdout, or `Err` with a message including
/// stderr when it exits non-zero or fails to spawn.
async fn run(mut cmd: Command) -> Result<String, String> {
    let out = cmd.output().await.map_err(|e| format!("{e}"))?;
    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        return Err(format!("exit {}: {}", out.status, stderr.trim()));
    }
    Ok(String::from_utf8_lossy(&out.stdout).trim().to_string())
}

/// `print` capability guard, shared by every function below — both engines
/// get identical enforcement (same reasoning as `shell_run_core`'s check).
fn require_cap() -> Result<(), String> {
    if !glyx_security::get().print {
        return Err("Capability required: print — add it to glyx.config.json under \"capabilities\"".to_string());
    }
    Ok(())
}

pub async fn list_printers() -> Result<Vec<String>, String> {
    require_cap()?;
    list_printers_impl().await
}

pub async fn default_printer() -> Result<Option<String>, String> {
    require_cap()?;
    default_printer_impl().await
}

pub async fn print_file(path: &str, printer: Option<&str>) -> Result<(), String> {
    require_cap()?;
    print_file_impl(path, printer).await
}

#[cfg(target_os = "windows")]
async fn list_printers_impl() -> Result<Vec<String>, String> {
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command",
        "(Get-Printer | Select-Object -ExpandProperty Name) -join \"`n\""]);
    let out = run(cmd).await?;
    Ok(out.lines().map(str::trim).filter(|l| !l.is_empty()).map(str::to_string).collect())
}

#[cfg(target_os = "windows")]
async fn default_printer_impl() -> Result<Option<String>, String> {
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command",
        "(Get-CimInstance -ClassName Win32_Printer -Filter 'Default=true').Name"]);
    let out = run(cmd).await?;
    Ok(if out.is_empty() { None } else { Some(out) })
}

#[cfg(target_os = "windows")]
async fn print_file_impl(path: &str, printer: Option<&str>) -> Result<(), String> {
    if printer.is_some() {
        log::warn!("print.file: a specific printer was requested, but Windows' \
            print-verb has no way to target one — printing to the default printer instead.");
    }
    // PowerShell quoting: the path is passed as a -Command argument string,
    // so single-quote it and escape embedded single quotes the PowerShell way.
    let escaped = path.replace('\'', "''");
    let mut cmd = Command::new("powershell");
    cmd.args(["-NoProfile", "-NonInteractive", "-Command",
        &format!("Start-Process -FilePath '{escaped}' -Verb Print")]);
    run(cmd).await.map(|_| ())
}

#[cfg(not(target_os = "windows"))]
async fn list_printers_impl() -> Result<Vec<String>, String> {
    let mut cmd = Command::new("lpstat");
    cmd.arg("-p");
    let out = match run(cmd).await {
        Ok(o) => o,
        // No printers configured: lpstat exits non-zero with "no destinations added".
        Err(e) if e.contains("no destinations") => return Ok(Vec::new()),
        Err(e) => return Err(e),
    };
    // Each line: "printer <name> is idle.  enabled since ..."
    Ok(out.lines().filter_map(|l| {
        let rest = l.strip_prefix("printer ")?;
        rest.split_whitespace().next().map(str::to_string)
    }).collect())
}

#[cfg(not(target_os = "windows"))]
async fn default_printer_impl() -> Result<Option<String>, String> {
    let mut cmd = Command::new("lpstat");
    cmd.arg("-d");
    let out = match run(cmd).await {
        Ok(o) => o,
        Err(e) if e.contains("no destinations") || e.contains("no system default") => return Ok(None),
        Err(e) => return Err(e),
    };
    // "system default destination: <name>", or "no system default destination".
    Ok(out.split(':').nth(1).map(|s| s.trim().to_string()).filter(|s| !s.is_empty()))
}

#[cfg(not(target_os = "windows"))]
async fn print_file_impl(path: &str, printer: Option<&str>) -> Result<(), String> {
    let mut cmd = Command::new("lp");
    if let Some(p) = printer { cmd.args(["-d", p]); }
    cmd.arg(path);
    run(cmd).await.map(|_| ())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_printers_does_not_panic_without_a_print_system() {
        // Exercises the platform command directly (not the capability-gated
        // `list_printers()`, which needs `glyx_security::init()` first and
        // would just assert the capability check, not the actual command).
        // No assertion on content — this just proves it doesn't panic and
        // surfaces either a real list or a clean error on a CI box with no
        // printers/no CUPS/no PowerShell reachable.
        let rt = tokio::runtime::Runtime::new().unwrap();
        let _ = rt.block_on(list_printers_impl());
    }

    #[test]
    fn without_the_capability_every_call_is_refused() {
        // Default Capabilities (no glyx_security::init() call) has `print: false`.
        let rt = tokio::runtime::Runtime::new().unwrap();
        assert!(rt.block_on(list_printers()).unwrap_err().contains("Capability required"));
        assert!(rt.block_on(default_printer()).unwrap_err().contains("Capability required"));
        assert!(rt.block_on(print_file("x", None)).unwrap_err().contains("Capability required"));
    }
}
