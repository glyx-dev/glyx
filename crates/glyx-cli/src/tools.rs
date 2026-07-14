//! Central registry of external tools/assets the CLI downloads at build time.
//!
//! Every asset has an upstream *default* URL (kept as-is today) plus a
//! `mirror_path` used when the user self-hosts everything behind a single base
//! URL via the `$GLYX_TOOLS_BASE` environment variable.
//!
//! When `$GLYX_TOOLS_BASE` is set, an asset is fetched from
//! `{GLYX_TOOLS_BASE}/{mirror_path}` instead of its upstream default. When it is
//! unset, the original URLs are used — so self-hosting is purely opt-in.

use std::env;

/// The base URL for a self-hosted tools mirror, or `None` to use upstream defaults.
/// Trailing slashes are trimmed so `{base}/{mirror_path}` joins cleanly.
pub(crate) fn tools_base() -> Option<String> {
    let v = env::var("GLYX_TOOLS_BASE").ok()?.trim().to_string();
    if v.is_empty() {
        None
    } else {
        Some(v.trim_end_matches('/').to_string())
    }
}

/// Resolve the final download URL for an asset.
///
/// * `default_url` — upstream URL used when no mirror is configured.
/// * `mirror_path` — path appended to `$GLYX_TOOLS_BASE` when a mirror is set.
pub(crate) fn resolve_tool_url(default_url: &str, mirror_path: &str) -> String {
    match tools_base() {
        Some(base) => format!("{base}/{mirror_path}"),
        None => default_url.to_string(),
    }
}

/// Relative mirror paths for every fetchable asset. These are appended to
/// `$GLYX_TOOLS_BASE` when self-hosting. Kept in one place so the mirror layout
/// is obvious and version bumps only touch the constants below.
pub(crate) mod paths {
    /// NSIS 3.10 installer builder (Windows).
    pub const NSIS: &str = "nsis-3.10.zip";
    /// rcedit icon/version patcher (Windows).
    #[allow(non_upper_case_globals)]
    pub const RCEdit: &str = "rcedit-x64.exe";
    /// icupkg (ICU 77 data trimmer) — Windows x64.
    pub const ICUPKG_WIN_X64: &str = "icu/icu4c-77_1-Win64-MSVC2022.zip";
    /// icupkg (ICU 77 data trimmer) — Windows arm64.
    pub const ICUPKG_WIN_ARM64: &str = "icu/icu4c-77_1-WinARM64-MSVC2022.zip";
    /// icupkg (ICU 77 data trimmer) — Linux x64 (Ubuntu 22.04).
    pub const ICUPKG_LINUX_X64: &str = "icu/icu4c-77_1-Ubuntu22.04-x64.tgz";
    /// Full ICU data file (mirror of the one embedded in glyx-runtime).
    /// Reserved for when `icudtl.dat` is fetched from the mirror instead of
    /// being embedded; not yet consumed by any download path.
    #[allow(dead_code)]
    pub const ICU_DATA: &str = "icudtl.dat";
}

/// Mirror path for a prebuilt glyx-runner artifact (versioned).
/// `artifact` already encodes the target + profile (e.g.
/// `glyx-runner-x86_64-pc-windows-msvc.exe`), so the mirror layout is just
/// `runners/{artifact}`.
pub(crate) fn runner_mirror_path(artifact: &str) -> String {
    format!("runners/{artifact}")
}
