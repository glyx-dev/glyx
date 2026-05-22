//! Download and cache the velox-media DLL from the CDN.
//!
//! CDN layout:
//!   https://cdn.velox.dev/media/{version}/velox-media-{platform}-{arch}.{ext}
//!   https://cdn.velox.dev/media/{version}/velox-media-{platform}-{arch}.manifest.json
//!   https://cdn.velox.dev/media/{version}/velox-media-{platform}-{arch}.manifest.sig
//!
//! Local cache:
//!   ~/.velox/cache/media/velox-media-{version}-{platform}-{arch}.{ext}
//!   ~/.velox/cache/media/velox-media-{version}-{platform}-{arch}.manifest.json
//!   ~/.velox/cache/media/velox-media-{version}-{platform}-{arch}.manifest.sig

use std::path::PathBuf;
use crate::verify::{sha256_hex, verify_manifest};

/// Minimum velox-media version this runner accepts.
/// Bump when the C ABI changes (major version) or new features are required.
pub const VELOX_MEDIA_VERSION: &str = "1.0.0";

const CDN_BASE: &str = "https://cdn.velox.dev/media";

/// Return the platform-specific DLL filename stem (without extension).
fn dll_stem() -> String {
    let platform = if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "macos") {
        "macos"
    } else {
        "linux"
    };

    let arch = if cfg!(target_arch = "aarch64") { "arm64" } else { "x64" };

    format!("velox-media-{}-{}-{}", VELOX_MEDIA_VERSION, platform, arch)
}

/// Platform-specific DLL file extension.
fn dll_ext() -> &'static str {
    if cfg!(target_os = "windows") { "dll" }
    else if cfg!(target_os = "macos") { "dylib" }
    else { "so" }
}

/// Return the local cache directory, creating it if needed.
fn cache_dir() -> Result<PathBuf, String> {
    let home = dirs_or_fallback();
    let dir  = home.join(".velox").join("cache").join("media");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("velox-media: cannot create cache dir: {e}"))?;
    Ok(dir)
}

fn dirs_or_fallback() -> PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
}

/// Return the DLL path to use, searching in order:
/// 1. Next to the running executable (installed apps — DLL copied by `velox package`)
/// 2. The user cache at `~/.velox/cache/media/` (dev / auto-downloaded)
///
/// Integrity verification is skipped for the exe-relative path because the
/// manifest files are not distributed with the installer; we trust installed files.
pub fn find_cached_media() -> Option<PathBuf> {
    let stem = dll_stem();
    let ext  = dll_ext();

    // 1. Beside the running exe (production install)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            let dll = exe_dir.join(format!("{stem}.{ext}"));
            if dll.exists() {
                log::debug!("[velox-media] using DLL next to exe: {}", dll.display());
                return Some(dll);
            }
        }
    }

    // 2. User cache (~/.velox/cache/media/)
    let dir = cache_dir().ok()?;
    let dll = dir.join(format!("{stem}.{ext}"));
    if !dll.exists() {
        return None;
    }
    match crate::verify::verify_cached_dll(&dll) {
        Ok(()) => {
            log::debug!("[velox-media] using cached DLL: {}", dll.display());
            Some(dll)
        }
        Err(e) => {
            log::warn!("[velox-media] cached DLL failed verification: {e}");
            None
        }
    }
}

/// Download the velox-media DLL for this platform and cache it.
/// Verifies Ed25519 manifest signature + SHA-256 hash before writing.
pub async fn download_and_cache_media() -> Result<PathBuf, String> {
    let stem    = dll_stem();
    let ext     = dll_ext();
    let version = VELOX_MEDIA_VERSION;
    let base    = format!("{CDN_BASE}/{version}");

    let manifest_url = format!("{base}/{stem}.manifest.json");
    let sig_url      = format!("{base}/{stem}.manifest.sig");
    let dll_url      = format!("{base}/{stem}.{ext}");

    log::info!("[velox-media] downloading manifest from {manifest_url}");

    let client = reqwest::Client::new();

    let manifest_bytes = client.get(&manifest_url).send().await
        .map_err(|e| format!("velox-media: manifest fetch failed: {e}"))?
        .bytes().await
        .map_err(|e| format!("velox-media: manifest read failed: {e}"))?
        .to_vec();

    let sig_bytes = client.get(&sig_url).send().await
        .map_err(|e| format!("velox-media: sig fetch failed: {e}"))?
        .bytes().await
        .map_err(|e| format!("velox-media: sig read failed: {e}"))?
        .to_vec();

    // 1. Verify signature on manifest before downloading the DLL.
    let manifest = verify_manifest(&manifest_bytes, &sig_bytes)?;

    log::info!("[velox-media] manifest verified, downloading DLL ({dll_url})");

    let dll_bytes = client.get(&dll_url).send().await
        .map_err(|e| format!("velox-media: DLL fetch failed: {e}"))?
        .bytes().await
        .map_err(|e| format!("velox-media: DLL read failed: {e}"))?
        .to_vec();

    // 2. Verify SHA-256 hash of downloaded DLL.
    let actual_hash = sha256_hex(&dll_bytes);
    if actual_hash != manifest.sha256 {
        return Err(format!(
            "velox-media: SHA-256 mismatch (expected {}, got {}) — download may be corrupted",
            manifest.sha256, actual_hash
        ));
    }

    // 3. Write to cache (only after both checks pass).
    let dir = cache_dir()?;
    let dll_path = dir.join(format!("{stem}.{ext}"));
    std::fs::write(&dll_path, &dll_bytes)
        .map_err(|e| format!("velox-media: cannot write DLL to cache: {e}"))?;
    std::fs::write(dll_path.with_extension("manifest.json"), &manifest_bytes)
        .map_err(|e| format!("velox-media: cannot write manifest: {e}"))?;
    std::fs::write(dll_path.with_extension("manifest.sig"), &sig_bytes)
        .map_err(|e| format!("velox-media: cannot write sig: {e}"))?;

    log::info!("[velox-media] DLL cached at {}", dll_path.display());
    Ok(dll_path)
}
