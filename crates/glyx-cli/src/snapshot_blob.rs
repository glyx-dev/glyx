//! The prebuilt base V8 snapshot: what lets `glyx build` (snapshot mode, the default) work without a Rust toolchain.
//!
//! A snapshot holds only the runtime's stub bindings (plus the project's own `js/polyfills.js`, which
//! almost no project has): the app is always evaluated at runtime. So for a project without polyfills
//! the blob is the same for every app, and the release publishes one per platform, made by
//! `glyx-snapshot --base` with the same V8 that the runner of that release was built with (a V8
//! snapshot only loads in the exact V8 build that made it).
//!
//! The release signs each blob with the capability key. It is verified here, before it is cached or
//! used: a snapshot is restored straight into V8's heap, so an unverified one is as dangerous as an
//! unverified native module.
//!
//! Two kinds of failure, which `glyx build` treats differently:
//!   * [`FetchError::Unavailable`] (offline, no blob published for this platform or version): fall back
//!     to bundle mode with a warning.
//!   * [`FetchError::Rejected`] (the signature does not verify, the size is absurd): stop. Never fall
//!     back silently from a bad signature.

use std::fmt;
use std::io::Read;
use std::path::{Path, PathBuf};

/// Far more than a base snapshot (a few MB); a limit so a bad mirror cannot fill the disk.
const MAX_BLOB_BYTES: u64 = 64 * 1024 * 1024;
/// An Ed25519 signature is 64 bytes.
const MAX_SIG_BYTES: u64 = 4096;

/// Substring `glyx build` looks for to fall back to bundle mode.
pub(crate) const UNAVAILABLE_MARKER: &str = "V8 snapshot unavailable";

#[derive(Debug, PartialEq)]
pub(crate) enum FetchError {
    /// Could not get a blob (offline, 404): the build may fall back to bundle mode.
    Unavailable(String),
    /// Got one, and it is not acceptable: the build must stop.
    Rejected(String),
}

impl fmt::Display for FetchError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            FetchError::Unavailable(m) => write!(f, "{UNAVAILABLE_MARKER}: {m}"),
            FetchError::Rejected(m) => write!(f, "the prebuilt V8 snapshot was rejected: {m}"),
        }
    }
}

impl std::error::Error for FetchError {}

/// `glyx-snapshot-0.2.0-x86_64-apple-darwin.snapshot` — the release asset (and, with `.sig`, its signature).
pub(crate) fn asset_name(version: &str, target: &str) -> String {
    format!("glyx-snapshot-{version}-{target}.snapshot")
}

/// Download URL for an asset of this CLI version's release, or under a self-hosted mirror
/// (`$GLYX_TOOLS_BASE/snapshots/<asset>`).
pub(crate) fn asset_url(asset: &str, version: &str, mirror_base: Option<&str>) -> String {
    match mirror_base {
        Some(base) => format!("{}/{}", base.trim_end_matches('/'), super::tools::snapshot_mirror_path(asset)),
        None => format!("https://github.com/glyx-dev/glyx/releases/download/v{version}/{asset}"),
    }
}

/// Where a verified blob is kept: `<root>/snapshots/<asset>` (the version is in the asset name).
pub(crate) fn cache_path(root: &Path, version: &str, target: &str) -> PathBuf {
    root.join("snapshots").join(asset_name(version, target))
}

fn sig_path(blob: &Path) -> PathBuf {
    let mut s = blob.as_os_str().to_owned();
    s.push(".sig");
    PathBuf::from(s)
}

/// GET `url`, refusing a body larger than `max` bytes. Any failure to fetch is `Unavailable`.
pub(crate) fn http_get(url: &str, max: u64) -> Result<Vec<u8>, FetchError> {
    // ureq's own message already names the URL ("<url>: status code 404").
    let resp = ureq::get(url)
        .call()
        .map_err(|e| FetchError::Unavailable(e.to_string()))?;
    let mut body = Vec::new();
    resp.into_reader()
        .take(max + 1)
        .read_to_end(&mut body)
        .map_err(|e| FetchError::Unavailable(format!("{url}: {e}")))?;
    if body.len() as u64 > max {
        return Err(FetchError::Rejected(format!("{url} is larger than {max} bytes")));
    }
    Ok(body)
}

fn write_atomic(dest: &Path, bytes: &[u8]) -> std::io::Result<()> {
    if let Some(parent) = dest.parent() {
        std::fs::create_dir_all(parent)?;
    }
    let tmp = dest.with_extension("part");
    std::fs::write(&tmp, bytes)?;
    std::fs::rename(&tmp, dest)
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
    let blob_path = cache_path(root, version, target);
    let sig_file = sig_path(&blob_path);

    // 1. A cached copy is trusted only after it verifies again; a bad one is dropped and re-fetched.
    if let (Ok(blob), Ok(sig)) = (std::fs::read(&blob_path), std::fs::read(&sig_file)) {
        if glyx_verify::verify_ed25519(pubkey, &blob, &sig).is_ok() {
            return Ok(blob_path);
        }
        let _ = std::fs::remove_file(&blob_path);
        let _ = std::fs::remove_file(&sig_file);
    }

    // 2. Download, verify in memory, and only then write anything.
    let asset = asset_name(version, target);
    println!("Downloading the prebuilt V8 snapshot for {target} ({version})…");
    let blob = get(&asset_url(&asset, version, mirror_base), MAX_BLOB_BYTES)?;
    let sig = get(&asset_url(&format!("{asset}.sig"), version, mirror_base), MAX_SIG_BYTES)?;
    glyx_verify::verify_ed25519(pubkey, &blob, &sig)
        .map_err(|e| FetchError::Rejected(format!("{asset}: {e}")))?;
    write_atomic(&blob_path, &blob).map_err(|e| FetchError::Unavailable(format!("cache {}: {e}", blob_path.display())))?;
    write_atomic(&sig_file, &sig).map_err(|e| FetchError::Unavailable(format!("cache {}: {e}", sig_file.display())))?;
    println!("  ✓ verified and cached at {}", blob_path.display());
    Ok(blob_path)
}

#[cfg(test)]
mod tests {
    use super::*;
    use ed25519_dalek::SigningKey;
    use std::cell::RefCell;
    use std::collections::HashMap;

    fn keypair() -> ([u8; 32], [u8; 32]) {
        let secret = [7u8; 32];
        (secret, SigningKey::from_bytes(&secret).verifying_key().to_bytes())
    }

    fn temp_root(name: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("glyx-snapshot-blob-{name}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    /// A fake release: url -> bytes, and a log of what was asked for.
    struct Fake {
        files: HashMap<String, Vec<u8>>,
        asked: RefCell<Vec<String>>,
    }
    impl Fake {
        fn get(&self, url: &str, _max: u64) -> Result<Vec<u8>, FetchError> {
            self.asked.borrow_mut().push(url.to_string());
            self.files.get(url).cloned().ok_or_else(|| FetchError::Unavailable(format!("{url}: 404")))
        }
    }

    fn release(target: &str, blob: &[u8], secret: &[u8; 32]) -> Fake {
        let asset = asset_name("0.2.0", target);
        let mut files = HashMap::new();
        files.insert(asset_url(&asset, "0.2.0", None), blob.to_vec());
        files.insert(asset_url(&format!("{asset}.sig"), "0.2.0", None), glyx_verify::sign_ed25519(secret, blob).to_vec());
        Fake { files, asked: RefCell::new(vec![]) }
    }

    #[test]
    fn names_and_urls_follow_the_release_layout() {
        assert_eq!(asset_name("0.2.0", "x86_64-apple-darwin"), "glyx-snapshot-0.2.0-x86_64-apple-darwin.snapshot");
        assert_eq!(
            asset_url("glyx-snapshot-0.2.0-x86_64-pc-windows-msvc.snapshot", "0.2.0", None),
            "https://github.com/glyx-dev/glyx/releases/download/v0.2.0/glyx-snapshot-0.2.0-x86_64-pc-windows-msvc.snapshot",
        );
        assert_eq!(
            asset_url("a.snapshot", "0.2.0", Some("https://mirror.example/glyx/")),
            "https://mirror.example/glyx/snapshots/a.snapshot",
        );
    }

    #[test]
    fn a_signed_blob_is_downloaded_verified_and_cached() {
        let (secret, public) = keypair();
        let root = temp_root("ok");
        let fake = release("aarch64-apple-darwin", b"snapshot-bytes", &secret);
        let p = fetch_base_snapshot(&root, "0.2.0", "aarch64-apple-darwin", None, &public, &|u, m| fake.get(u, m)).unwrap();
        assert_eq!(std::fs::read(&p).unwrap(), b"snapshot-bytes");
        assert!(sig_path(&p).is_file());

        // Second call: served from the cache, nothing fetched.
        let again = Fake { files: HashMap::new(), asked: RefCell::new(vec![]) };
        let p2 = fetch_base_snapshot(&root, "0.2.0", "aarch64-apple-darwin", None, &public, &|u, m| again.get(u, m)).unwrap();
        assert_eq!(p, p2);
        assert!(again.asked.borrow().is_empty());
    }

    #[test]
    fn a_blob_signed_by_another_key_is_rejected_and_not_cached() {
        let (_, public) = keypair();
        let root = temp_root("badsig");
        let fake = release("x86_64-unknown-linux-gnu", b"evil", &[9u8; 32]);
        let err = fetch_base_snapshot(&root, "0.2.0", "x86_64-unknown-linux-gnu", None, &public, &|u, m| fake.get(u, m)).unwrap_err();
        assert!(matches!(err, FetchError::Rejected(_)), "{err}");
        assert!(!err.to_string().contains(UNAVAILABLE_MARKER), "a bad signature must not look like 'unavailable'");
        assert!(!cache_path(&root, "0.2.0", "x86_64-unknown-linux-gnu").exists(), "nothing unverified is written");
    }

    #[test]
    fn a_tampered_cached_blob_is_dropped_and_fetched_again() {
        let (secret, public) = keypair();
        let root = temp_root("tamper");
        let fake = release("aarch64-apple-darwin", b"good", &secret);
        let p = fetch_base_snapshot(&root, "0.2.0", "aarch64-apple-darwin", None, &public, &|u, m| fake.get(u, m)).unwrap();
        std::fs::write(&p, b"tampered").unwrap();
        let p2 = fetch_base_snapshot(&root, "0.2.0", "aarch64-apple-darwin", None, &public, &|u, m| fake.get(u, m)).unwrap();
        assert_eq!(std::fs::read(&p2).unwrap(), b"good");
    }

    #[test]
    fn a_missing_release_is_unavailable_so_the_build_can_fall_back() {
        let (_, public) = keypair();
        let root = temp_root("404");
        let none = Fake { files: HashMap::new(), asked: RefCell::new(vec![]) };
        let err = fetch_base_snapshot(&root, "0.2.0", "x86_64-apple-darwin", None, &public, &|u, m| none.get(u, m)).unwrap_err();
        assert!(matches!(err, FetchError::Unavailable(_)));
        assert!(err.to_string().contains(UNAVAILABLE_MARKER));
    }

    /// A one-shot local HTTP server answering each request with `status` and `body`.
    fn serve(status: &str, body: Vec<u8>, requests: usize) -> String {
        use std::io::{Read, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let addr = listener.local_addr().unwrap();
        let status = status.to_string();
        std::thread::spawn(move || {
            for _ in 0..requests {
                let (mut conn, _) = listener.accept().unwrap();
                let mut buf = [0u8; 2048];
                let _ = conn.read(&mut buf);
                let head = format!("HTTP/1.1 {status}
Content-Length: {}
Connection: close

", body.len());
                let _ = conn.write_all(head.as_bytes());
                let _ = conn.write_all(&body);
            }
        });
        format!("http://{addr}")
    }

    #[test]
    fn http_get_reads_a_body_and_enforces_the_size_limit() {
        let base = serve("200 OK", vec![5u8; 100], 2);
        assert_eq!(http_get(&format!("{base}/a"), 1000).unwrap(), vec![5u8; 100]);
        let err = http_get(&format!("{base}/b"), 50).unwrap_err();
        assert!(matches!(err, FetchError::Rejected(_)), "{err}");
    }

    #[test]
    fn http_get_treats_a_404_as_unavailable() {
        let base = serve("404 Not Found", b"nope".to_vec(), 1);
        let err = http_get(&format!("{base}/missing"), 1000).unwrap_err();
        assert!(matches!(err, FetchError::Unavailable(_)), "{err}");
    }

    #[test]
    fn a_mirror_is_asked_instead_of_github() {
        let (secret, public) = keypair();
        let root = temp_root("mirror");
        let asset = asset_name("0.2.0", "aarch64-apple-darwin");
        let mut files = HashMap::new();
        files.insert(format!("https://m.example/snapshots/{asset}"), b"b".to_vec());
        files.insert(format!("https://m.example/snapshots/{asset}.sig"), glyx_verify::sign_ed25519(&secret, b"b").to_vec());
        let fake = Fake { files, asked: RefCell::new(vec![]) };
        fetch_base_snapshot(&root, "0.2.0", "aarch64-apple-darwin", Some("https://m.example"), &public, &|u, m| fake.get(u, m)).unwrap();
        assert!(fake.asked.borrow().iter().all(|u| u.starts_with("https://m.example/")));
    }
}
