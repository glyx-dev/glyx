//! The prebuilt base V8 snapshot: what lets `glyx build` (snapshot mode, the default) work without a Rust toolchain.
//!
//! A snapshot holds only the runtime's stub bindings (plus the project's own `js/polyfills.js`, which
//! almost no project has): the app is always evaluated at runtime. So for a project without polyfills
//! the blob is the same for every app, and the release publishes one per platform, made by
//! `glyx-snapshot --base` with the same V8 that the runner of that release was built with (a V8
//! snapshot only loads in the exact V8 build that made it).
//!
//! The release signs each blob with the capability key; downloading, verifying and caching it is
//! shared with the ICU data (`signed_asset.rs`). A snapshot is restored straight into V8's heap, so
//! an unverified one is as dangerous as an unverified native module.
//!
//! `glyx build` treats the two failures differently: [`FetchError::Unavailable`] (offline, no blob
//! published for this platform or version) falls back to bundle mode with a warning;
//! [`FetchError::Rejected`] (the signature does not verify) stops the build.

use std::path::{Path, PathBuf};

pub(crate) use super::signed_asset::{http_get, FetchError};
use super::signed_asset::{fetch_verified, Kind};

/// Far more than a base snapshot (a few MB); a limit so a bad mirror cannot fill the disk.
const MAX_BLOB_BYTES: u64 = 64 * 1024 * 1024;

const KIND: Kind = Kind {
    what:       "V8 snapshot",
    cache_dir:  "snapshots",
    mirror_dir: "snapshots",
    max_bytes:  MAX_BLOB_BYTES,
};

/// Substring `glyx build` looks for to fall back to bundle mode.
pub(crate) const UNAVAILABLE_MARKER: &str = "V8 snapshot unavailable";

/// `glyx-snapshot-0.2.0-x86_64-apple-darwin.snapshot` — the release asset (and, with `.sig`, its signature).
pub(crate) fn asset_name(version: &str, target: &str) -> String {
    format!("glyx-snapshot-{version}-{target}.snapshot")
}

/// The verified base snapshot for `target` at `version`, from the cache under `root` or downloaded.
/// `get(url, max_bytes)` fetches a file (injected so the tests need no network).
pub(crate) fn fetch_base_snapshot(
    root: &Path,
    version: &str,
    target: &str,
    mirror_base: Option<&str>,
    pubkey: &[u8; 32],
    get: &dyn Fn(&str, u64) -> Result<Vec<u8>, FetchError>,
) -> Result<PathBuf, FetchError> {
    fetch_verified(&KIND, root, &asset_name(version, target), version, mirror_base, pubkey, get)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn the_asset_is_named_per_version_and_target() {
        assert_eq!(asset_name("0.2.0", "x86_64-apple-darwin"), "glyx-snapshot-0.2.0-x86_64-apple-darwin.snapshot");
    }

    #[test]
    fn snapshots_live_under_snapshots_on_github_and_on_a_mirror() {
        use super::super::signed_asset::asset_url;
        let a = asset_name("0.2.0", "x86_64-pc-windows-msvc");
        assert_eq!(
            asset_url(&KIND, &a, "0.2.0", None),
            "https://github.com/glyx-dev/glyx/releases/download/v0.2.0/glyx-snapshot-0.2.0-x86_64-pc-windows-msvc.snapshot",
        );
        assert_eq!(
            asset_url(&KIND, &a, "0.2.0", Some("https://mirror.example/")),
            "https://mirror.example/snapshots/glyx-snapshot-0.2.0-x86_64-pc-windows-msvc.snapshot",
        );
    }

    #[test]
    fn a_missing_snapshot_is_unavailable_with_the_marker_the_build_falls_back_on() {
        let root = std::env::temp_dir().join(format!("glyx-snapshot-blob-404-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let public = [1u8; 32];
        let err = fetch_base_snapshot(&root, "0.2.0", "x86_64-apple-darwin", None, &public, &|u, _| {
            Err(FetchError::Unavailable(format!("{u}: 404")))
        })
        .unwrap_err();
        assert!(matches!(err, FetchError::Unavailable(_)));
        assert!(err.to_string().contains(UNAVAILABLE_MARKER), "{err}");
    }

    #[test]
    fn a_rejected_snapshot_does_not_carry_the_fallback_marker() {
        let root = std::env::temp_dir().join(format!("glyx-snapshot-blob-bad-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let public = [1u8; 32];
        let err = fetch_base_snapshot(&root, "0.2.0", "x86_64-apple-darwin", None, &public, &|_, _| Ok(vec![0u8; 64]))
            .unwrap_err();
        assert!(matches!(err, FetchError::Rejected(_)), "{err}");
        assert!(!err.to_string().contains(UNAVAILABLE_MARKER), "{err}");
        assert!(err.to_string().contains("V8 snapshot"), "{err}");
    }
}
