//! Download and cache the glyx-media library and its FFmpeg libraries from the
//! GitHub Release of the matching Glyx version.
//!
//! Release layout (see `.github/workflows/glyx-media-build.yml`), under
//! `https://github.com/glyx-dev/glyx/releases/download/v{version}/`:
//!   glyx-media-{version}-{platform}-{arch}.{ext}
//!   glyx-media-{version}-{platform}-{arch}.manifest.json
//!   glyx-media-{version}-{platform}-{arch}.manifest.sig
//!   glyx-ffmpeg-libs-{version}-{platform}-{arch}.tar.gz
//!
//! The manifest is signed. It carries the SHA-256 of the library, of the
//! archive, and of each FFmpeg library inside it, so everything that gets
//! loaded is covered by the signature.
//!
//! Local cache (the libraries are extracted loose, next to the DLL):
//!   ~/.glyx/cache/media/glyx-media-{version}-{platform}-{arch}.{ext}
//!   ~/.glyx/cache/media/glyx-media-{version}-{platform}-{arch}.manifest.{json,sig}
//!   ~/.glyx/cache/media/avcodec-63.dll, libavcodec.63.dylib, ...

use std::collections::BTreeMap;
use std::io::Read;
use std::path::{Component, Path, PathBuf};
use std::time::Duration;

use crate::verify::{is_plain_file_name, sha256_hex, verify_cached_dll, verify_libs, verify_manifest};

/// The glyx-media version: always the version of the Glyx release it belongs
/// to (every crate and package is versioned in lockstep), so updating Glyx
/// updates the media library with it.
pub const GLYX_MEDIA_VERSION: &str = env!("CARGO_PKG_VERSION");

const RELEASE_BASE: &str = "https://github.com/glyx-dev/glyx/releases/download";

const MAX_REDIRECTS: usize = 5;
/// Manifests and signatures are tiny.
const MAX_META_BYTES: u64 = 1024 * 1024;
const MAX_DLL_BYTES: u64 = 64 * 1024 * 1024;
const MAX_ARCHIVE_BYTES: u64 = 512 * 1024 * 1024;
const MAX_LIB_BYTES: u64 = 300 * 1024 * 1024;

// ── Names and locations ──────────────────────────────────────────────────────

pub fn platform() -> &'static str {
    if cfg!(target_os = "windows") { "windows" }
    else if cfg!(target_os = "macos") { "macos" }
    else { "linux" }
}

pub fn arch() -> &'static str {
    if cfg!(target_arch = "aarch64") { "arm64" } else { "x64" }
}

/// Platform-specific library file extension.
pub fn dll_ext() -> &'static str {
    if cfg!(target_os = "windows") { "dll" }
    else if cfg!(target_os = "macos") { "dylib" }
    else { "so" }
}

/// The library's file name without its extension, e.g. `glyx-media-0.2.0-windows-x64`.
pub fn dll_stem() -> String {
    format!("glyx-media-{}-{}-{}", GLYX_MEDIA_VERSION, platform(), arch())
}

/// The local cache directory, created if needed.
pub fn cache_dir() -> Result<PathBuf, String> {
    let home = dirs_or_fallback();
    let dir  = home.join(".glyx").join("cache").join("media");
    std::fs::create_dir_all(&dir)
        .map_err(|e| format!("glyx-media: cannot create cache dir: {e}"))?;
    Ok(dir)
}

fn dirs_or_fallback() -> PathBuf {
    std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
}

/// A self-hosted mirror (`$GLYX_TOOLS_BASE`, the same variable the CLI uses
/// for its other downloads), without a trailing slash.
fn mirror_base() -> Option<String> {
    let v = std::env::var("GLYX_TOOLS_BASE").ok()?.trim().trim_end_matches('/').to_string();
    (!v.is_empty()).then_some(v)
}

/// Where a release asset of this version comes from.
fn asset_url(name: &str) -> String {
    match mirror_base() {
        Some(base) => format!("{base}/media/{name}"),
        None => format!("{RELEASE_BASE}/v{GLYX_MEDIA_VERSION}/{name}"),
    }
}

// ── Finding a cached library ─────────────────────────────────────────────────

/// Return the DLL path to use, searching in order:
/// 1. Next to the running executable (installed apps -- DLL copied by `glyx package`)
/// 2. The user cache at `~/.glyx/cache/media/` (dev / downloaded)
///
/// Integrity is verified for all paths: Ed25519 manifest signature + SHA-256
/// of the DLL and of its FFmpeg libraries. Installer-distributed DLLs must
/// ship a manifest sidecar; the manifest is the trust anchor (not the install
/// location).
pub fn find_cached_media() -> Option<PathBuf> {
    let stem = dll_stem();
    let ext  = dll_ext();

    // 1. Beside the running exe (production install)
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            let dll = exe_dir.join(format!("{stem}.{ext}"));
            if dll.exists() {
                match verify_cached_dll(&dll) {
                    Ok(_) => {
                        log::debug!("[glyx-media] using DLL next to exe: {}", dll.display());
                        return Some(dll);
                    }
                    Err(e) => {
                        log::warn!("[glyx-media] exe-adjacent DLL failed verification: {e}");
                    }
                }
            }
        }
    }

    // 2. User cache (~/.glyx/cache/media/)
    let dir = cache_dir().ok()?;
    let dll = dir.join(format!("{stem}.{ext}"));
    if !dll.exists() {
        return None;
    }
    match verify_cached_dll(&dll) {
        Ok(_handle) => {
            // _handle dropped here; GlyxMedia::load will re-verify and hold
            // its own handle across dlopen (see lib.rs).
            log::debug!("[glyx-media] using cached DLL: {}", dll.display());
            Some(dll)
        }
        Err(e) => {
            log::warn!("[glyx-media] cached DLL failed verification: {e}");
            None
        }
    }
}

// ── Downloading ──────────────────────────────────────────────────────────────

/// Whether `url` may be fetched: HTTPS on GitHub (release assets redirect to
/// `*.githubusercontent.com`), or under the self-hosted mirror when one is set.
/// Integrity does not depend on this (the signature and hashes do); it only
/// keeps a redirect from sending the request somewhere unexpected.
fn url_allowed(url: &str, mirror: Option<&str>) -> bool {
    if let Some(base) = mirror {
        if url == base || url.strip_prefix(base).is_some_and(|r| r.starts_with('/')) {
            return true;
        }
    }
    let Some(rest) = url.strip_prefix("https://") else { return false };
    let authority = rest.split(['/', '?', '#']).next().unwrap_or("");
    if authority.contains('@') { return false; }
    let host = authority.split(':').next().unwrap_or(authority).to_ascii_lowercase();
    host == "github.com" || host.ends_with(".github.com") || host.ends_with(".githubusercontent.com")
}

/// Resolve a `Location` header against the URL that produced it.
fn resolve_location(current: &str, location: &str) -> Result<String, String> {
    if location.starts_with("https://") || location.starts_with("http://") {
        return Ok(location.to_string());
    }
    if location.starts_with('/') {
        let after_scheme = current.find("://").map(|i| i + 3)
            .ok_or_else(|| format!("glyx-media: bad URL {current:?}"))?;
        let host_end = current[after_scheme..].find('/').map_or(current.len(), |i| after_scheme + i);
        return Ok(format!("{}{location}", &current[..host_end]));
    }
    Err(format!("glyx-media: unsupported redirect to {location:?}"))
}

/// GET `url`, following redirects only to allowed hosts, refusing a body over `max_bytes`.
fn get(url: &str, max_bytes: u64) -> Result<Vec<u8>, String> {
    let mirror = mirror_base();
    let agent = ureq::AgentBuilder::new()
        .redirects(0)
        .timeout_connect(Duration::from_secs(30))
        .timeout_read(Duration::from_secs(120))
        .build();
    let mut current = url.to_string();
    for _ in 0..=MAX_REDIRECTS {
        if !url_allowed(&current, mirror.as_deref()) {
            return Err(format!("glyx-media: refusing to download from {current}"));
        }
        let resp = match agent.get(&current).call() {
            Ok(r) => r,
            Err(ureq::Error::Status(code, _)) => return Err(format!("glyx-media: {current} returned HTTP {code}")),
            Err(e) => return Err(format!("glyx-media: fetching {current} failed: {e}")),
        };
        if matches!(resp.status(), 301 | 302 | 303 | 307 | 308) {
            let location = resp.header("location")
                .ok_or_else(|| format!("glyx-media: redirect from {current} without a Location"))?;
            current = resolve_location(&current, location)?;
            continue;
        }
        let mut body = Vec::new();
        resp.into_reader().take(max_bytes + 1).read_to_end(&mut body)
            .map_err(|e| format!("glyx-media: reading {current} failed: {e}"))?;
        if body.len() as u64 > max_bytes {
            return Err(format!("glyx-media: {current} is larger than the {max_bytes}-byte limit"));
        }
        return Ok(body);
    }
    Err(format!("glyx-media: too many redirects fetching {url}"))
}

/// A plain file name from a tar member path (`./libavcodec.63.dylib` →
/// `libavcodec.63.dylib`); `None` for anything in a directory or with `..`.
fn plain_member_name(path: &Path) -> Option<String> {
    let mut parts = path.components().filter(|c| !matches!(c, Component::CurDir));
    let first = parts.next()?;
    if parts.next().is_some() { return None; }
    match first {
        Component::Normal(n) => n.to_str().filter(|s| is_plain_file_name(s)).map(String::from),
        _ => None,
    }
}

/// Pull the libraries in `wanted` (name → SHA-256) out of a `.tar.gz`,
/// checking each against its hash. Members not listed are ignored (licence
/// texts and so on); a listed one that is missing or wrong is an error.
fn extract_libs(archive_gz: &[u8], wanted: &BTreeMap<String, String>) -> Result<Vec<(String, Vec<u8>)>, String> {
    let mut archive = tar::Archive::new(flate2::read::GzDecoder::new(archive_gz));
    let mut out: Vec<(String, Vec<u8>)> = Vec::new();
    for entry in archive.entries().map_err(|e| format!("glyx-media: cannot read the FFmpeg archive: {e}"))? {
        let mut entry = entry.map_err(|e| format!("glyx-media: bad entry in the FFmpeg archive: {e}"))?;
        if !entry.header().entry_type().is_file() { continue; }
        let path = entry.path().map_err(|e| format!("glyx-media: bad path in the FFmpeg archive: {e}"))?.into_owned();
        let Some(name) = plain_member_name(&path) else { continue };
        let Some(want) = wanted.get(&name) else { continue };
        let mut data = Vec::new();
        entry.by_ref().take(MAX_LIB_BYTES + 1).read_to_end(&mut data)
            .map_err(|e| format!("glyx-media: cannot read {name} from the archive: {e}"))?;
        if data.len() as u64 > MAX_LIB_BYTES {
            return Err(format!("glyx-media: {name} in the archive is larger than the {MAX_LIB_BYTES}-byte limit"));
        }
        let got = sha256_hex(&data);
        if !got.eq_ignore_ascii_case(want) {
            return Err(format!("glyx-media: {name} in the archive does not match the signed manifest (expected {want}, got {got})"));
        }
        out.push((name, data));
    }
    if let Some(missing) = wanted.keys().find(|n| !out.iter().any(|(o, _)| &o == n)) {
        return Err(format!("glyx-media: the FFmpeg archive does not contain {missing}"));
    }
    Ok(out)
}

/// Write `bytes` to `path` through a temporary file, so an interrupted
/// download never leaves a half-written library behind.
fn write_atomic(path: &Path, bytes: &[u8]) -> Result<(), String> {
    let mut tmp = path.as_os_str().to_owned();
    tmp.push(".part");
    let tmp = PathBuf::from(tmp);
    std::fs::write(&tmp, bytes).map_err(|e| format!("glyx-media: cannot write {}: {e}", tmp.display()))?;
    std::fs::rename(&tmp, path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("glyx-media: cannot replace {} (is an app using it?): {e}", path.display())
    })
}

/// Download the glyx-media library for this platform and cache it.
pub fn download_and_cache_media() -> Result<PathBuf, String> {
    download_and_cache_media_to(&cache_dir()?)
}

/// Download the library, its manifest and the FFmpeg libraries into `dir`.
///
/// Everything is verified before anything is written: the manifest's Ed25519
/// signature first, then the SHA-256 of the library, of the FFmpeg archive and
/// of each library in it, all taken from the signed manifest. The library
/// itself is written last, so a failed download never leaves a library
/// without its FFmpeg.
pub fn download_and_cache_media_to(dir: &Path) -> Result<PathBuf, String> {
    std::fs::create_dir_all(dir).map_err(|e| format!("glyx-media: cannot create {}: {e}", dir.display()))?;
    let stem = dll_stem();
    let ext  = dll_ext();
    let dll_name = format!("{stem}.{ext}");

    let manifest_name = format!("{stem}.manifest.json");
    let sig_name      = format!("{stem}.manifest.sig");
    log::info!("[glyx-media] downloading {manifest_name}");
    let manifest_bytes = get(&asset_url(&manifest_name), MAX_META_BYTES)?;
    let sig_bytes      = get(&asset_url(&sig_name), MAX_META_BYTES)?;

    // 1. The signature on the manifest, before trusting anything it says.
    let manifest = verify_manifest(&manifest_bytes, &sig_bytes)?;
    if manifest.version != GLYX_MEDIA_VERSION {
        return Err(format!(
            "glyx-media: the manifest is for version {}, this is {GLYX_MEDIA_VERSION}",
            manifest.version
        ));
    }

    // 2. The library.
    log::info!("[glyx-media] manifest verified, downloading {dll_name}");
    let dll_bytes = get(&asset_url(&dll_name), MAX_DLL_BYTES)?;
    let actual = sha256_hex(&dll_bytes);
    if !actual.eq_ignore_ascii_case(&manifest.sha256) {
        return Err(format!(
            "glyx-media: SHA-256 mismatch (expected {}, got {actual}) — download may be corrupted",
            manifest.sha256
        ));
    }

    // 3. The FFmpeg libraries it loads, unless the cache already has them.
    let missing: BTreeMap<String, String> = manifest.libs.iter()
        .filter(|(name, want)| {
            is_plain_file_name(name)
                && !crate::verify::sha256_file(&dir.join(name)).is_ok_and(|got| got.eq_ignore_ascii_case(want))
        })
        .map(|(n, h)| (n.clone(), h.clone()))
        .collect();
    let mut libs: Vec<(String, Vec<u8>)> = Vec::new();
    if !missing.is_empty() {
        let archive = manifest.ffmpeg_archive.as_ref().ok_or_else(|| {
            "glyx-media: the manifest lists FFmpeg libraries but not the archive that holds them".to_string()
        })?;
        if !is_plain_file_name(&archive.name) {
            return Err(format!("glyx-media: the manifest names an unsafe archive {:?}", archive.name));
        }
        log::info!("[glyx-media] downloading {} ({} libraries)", archive.name, missing.len());
        let bytes = get(&asset_url(&archive.name), MAX_ARCHIVE_BYTES)?;
        let got = sha256_hex(&bytes);
        if !got.eq_ignore_ascii_case(&archive.sha256) {
            return Err(format!(
                "glyx-media: SHA-256 mismatch on {} (expected {}, got {got})",
                archive.name, archive.sha256
            ));
        }
        libs = extract_libs(&bytes, &missing)?;
    }

    // 4. Write: libraries first, then the manifest, then the library.
    for (name, data) in &libs {
        write_atomic(&dir.join(name), data)?;
    }
    let dll_path = dir.join(&dll_name);
    write_atomic(&dir.join(&manifest_name), &manifest_bytes)?;
    write_atomic(&dir.join(&sig_name), &sig_bytes)?;
    write_atomic(&dll_path, &dll_bytes)?;

    // End to end, the way the loader will check it.
    verify_libs(dir, &manifest.libs)?;
    log::info!("[glyx-media] cached at {}", dll_path.display());
    Ok(dll_path)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tar_gz(files: &[(&str, &[u8])]) -> Vec<u8> {
        let mut builder = tar::Builder::new(flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast()));
        for (name, data) in files {
            let mut h = tar::Header::new_gnu();
            h.set_size(data.len() as u64);
            h.set_mode(0o644);
            h.set_cksum();
            builder.append_data(&mut h, name, *data).unwrap();
        }
        builder.into_inner().unwrap().finish().unwrap()
    }

    #[test]
    fn the_version_follows_the_crate() {
        assert_eq!(GLYX_MEDIA_VERSION, env!("CARGO_PKG_VERSION"));
        assert!(dll_stem().starts_with(&format!("glyx-media-{GLYX_MEDIA_VERSION}-")));
    }

    #[test]
    fn only_github_and_the_mirror_are_allowed() {
        for ok in [
            "https://github.com/glyx-dev/glyx/releases/download/v0.2.0/x",
            "https://objects.githubusercontent.com/github-production-release-asset/abc",
            "https://release-assets.githubusercontent.com/x?y=1",
        ] { assert!(url_allowed(ok, None), "{ok}"); }
        for bad in [
            "http://github.com/x",                       // not https
            "https://evil.com/github.com/x",             // host is evil.com
            "https://github.com.evil.com/x",             // lookalike
            "https://user@github.com/x",                 // userinfo
            "https://notgithubusercontent.com/x",        // not a subdomain
            "ftp://github.com/x",
        ] { assert!(!url_allowed(bad, None), "{bad}"); }
        // a mirror, matched on a path boundary
        let m = Some("https://mirror.example/glyx");
        assert!(url_allowed("https://mirror.example/glyx/media/a", m));
        assert!(!url_allowed("https://mirror.example/glyx-evil/a", m));
        assert!(!url_allowed("https://mirror.example/other", m));
    }

    #[test]
    fn locations_resolve_against_the_request() {
        assert_eq!(resolve_location("https://github.com/a/b", "https://objects.githubusercontent.com/x").unwrap(),
                   "https://objects.githubusercontent.com/x");
        assert_eq!(resolve_location("https://github.com/a/b", "/c/d").unwrap(), "https://github.com/c/d");
        assert!(resolve_location("https://github.com/a/b", "relative/path").is_err());
    }

    #[test]
    fn member_names_must_be_plain() {
        assert_eq!(plain_member_name(Path::new("./libavcodec.63.dylib")).as_deref(), Some("libavcodec.63.dylib"));
        assert_eq!(plain_member_name(Path::new("avcodec-63.dll")).as_deref(), Some("avcodec-63.dll"));
        for bad in ["sub/avcodec-63.dll", "../avcodec-63.dll", "/avcodec-63.dll", "./", ""] {
            assert!(plain_member_name(Path::new(bad)).is_none(), "{bad:?}");
        }
    }

    #[test]
    fn libraries_are_extracted_and_checked_against_the_manifest() {
        let archive = tar_gz(&[
            ("./avcodec-63.dll", b"codec"),
            ("./LICENSE.txt", b"not a listed library"),
            ("./avutil-61.dll", b"util"),
        ]);
        let wanted = BTreeMap::from([
            ("avcodec-63.dll".to_string(), sha256_hex(b"codec")),
            ("avutil-61.dll".to_string(), sha256_hex(b"util")),
        ]);
        let got = extract_libs(&archive, &wanted).unwrap();
        assert_eq!(got.len(), 2);
        assert!(got.iter().any(|(n, d)| n == "avcodec-63.dll" && d == b"codec"));

        // a library that isn't what the signed manifest says
        let tampered = BTreeMap::from([("avcodec-63.dll".to_string(), sha256_hex(b"other"))]);
        assert!(extract_libs(&archive, &tampered).unwrap_err().contains("does not match"));

        // a listed library that isn't in the archive
        let absent = BTreeMap::from([("swscale-10.dll".to_string(), sha256_hex(b"x"))]);
        assert!(extract_libs(&archive, &absent).unwrap_err().contains("does not contain swscale-10.dll"));
    }

    /// Serve `files` (by name, under `/media/`) from 127.0.0.1 on a background
    /// thread for exactly `requests` requests; returns the base URL.
    fn serve(files: Vec<(String, Vec<u8>)>, requests: usize) -> String {
        use std::io::{BufRead, BufReader, Write};
        let listener = std::net::TcpListener::bind("127.0.0.1:0").unwrap();
        let base = format!("http://{}", listener.local_addr().unwrap());
        std::thread::spawn(move || {
            for _ in 0..requests {
                let Ok((mut conn, _)) = listener.accept() else { return };
                let mut line = String::new();
                BufReader::new(conn.try_clone().unwrap()).read_line(&mut line).unwrap();
                let path = line.split_whitespace().nth(1).unwrap_or("").to_string();
                let name = path.strip_prefix("/media/").unwrap_or("");
                // `redirect-<name>` answers with a redirect to `<name>`, like a release asset does.
                if let Some(target) = name.strip_prefix("redirect-") {
                    let _ = write!(conn, "HTTP/1.1 302 Found
Location: /media/{target}
Content-Length: 0
Connection: close

");
                    continue;
                }
                match files.iter().find(|(n, _)| n == name) {
                    Some((_, body)) => {
                        let _ = write!(conn, "HTTP/1.1 200 OK\r\nContent-Length: {}\r\nConnection: close\r\n\r\n", body.len());
                        let _ = conn.write_all(body);
                    }
                    None => { let _ = write!(conn, "HTTP/1.1 404 Not Found\r\nContent-Length: 0\r\nConnection: close\r\n\r\n"); }
                }
            }
        });
        base
    }

    /// The whole download against a fake release: manifest, library, FFmpeg
    /// archive. (Tests are debug builds, which skip the Ed25519 check; the
    /// hashes in the manifest are still enforced.)
    #[test]
    fn a_release_is_downloaded_verified_and_cached() {
        let stem = dll_stem();
        let dll_name = format!("{stem}.{}", dll_ext());
        let archive_name = "glyx-ffmpeg-libs-test.tar.gz".to_string();
        let archive = tar_gz(&[("./avcodec-63.dll", b"codec"), ("./LICENSE.txt", b"licence")]);
        let manifest = |archive_sha: &str| {
            format!(r#"{{"version":"{GLYX_MEDIA_VERSION}","url":"u","sha256":"{}",
                "libs":{{"avcodec-63.dll":"{}"}},
                "ffmpeg_archive":{{"name":"{archive_name}","sha256":"{archive_sha}"}}}}"#,
                sha256_hex(b"the library"), sha256_hex(b"codec")).into_bytes()
        };
        let release = |archive_sha: &str| vec![
            (format!("{stem}.manifest.json"), manifest(archive_sha)),
            (format!("{stem}.manifest.sig"), vec![0u8; 64]),
            (dll_name.clone(), b"the library".to_vec()),
            (archive_name.clone(), archive.clone()),
        ];

        let dir = std::env::temp_dir().join(format!("glyx-media-dl-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);

        // This test is the only one that sets the mirror variable.
        std::env::set_var("GLYX_TOOLS_BASE", serve(release(&sha256_hex(&archive)), 4));
        let dll = download_and_cache_media_to(&dir).unwrap();
        assert_eq!(std::fs::read(&dll).unwrap(), b"the library");
        assert_eq!(std::fs::read(dir.join("avcodec-63.dll")).unwrap(), b"codec");
        assert!(dir.join(format!("{stem}.manifest.json")).exists() && dir.join(format!("{stem}.manifest.sig")).exists());
        assert!(!dir.join("LICENSE.txt").exists(), "only the listed libraries are extracted");
        assert!(verify_cached_dll(&dll).is_ok());

        // Libraries already in the cache are not downloaded again (3 requests: no archive).
        std::env::set_var("GLYX_TOOLS_BASE", serve(release(&sha256_hex(&archive)), 3));
        download_and_cache_media_to(&dir).unwrap();

        // An archive that isn't what the signed manifest says: refused, nothing written.
        let _ = std::fs::remove_dir_all(&dir);
        std::env::set_var("GLYX_TOOLS_BASE", serve(release(&sha256_hex(b"something else")), 4));
        let err = download_and_cache_media_to(&dir).unwrap_err();
        assert!(err.contains("SHA-256 mismatch"), "{err}");
        assert!(!dir.join(&dll_name).exists() && !dir.join("avcodec-63.dll").exists(), "nothing written on failure");

        // A manifest for another version is refused.
        let wrong = vec![
            (format!("{stem}.manifest.json"), br#"{"version":"9.9.9","url":"u","sha256":"x"}"#.to_vec()),
            (format!("{stem}.manifest.sig"), vec![0u8; 64]),
        ];
        std::env::set_var("GLYX_TOOLS_BASE", serve(wrong, 2));
        assert!(download_and_cache_media_to(&dir).unwrap_err().contains("9.9.9"));

        // Redirects are followed (release assets are served via a redirect).
        let base = serve(vec![("hello".to_string(), b"world".to_vec())], 2);
        std::env::set_var("GLYX_TOOLS_BASE", &base);
        assert_eq!(get(&format!("{base}/media/redirect-hello"), 100).unwrap(), b"world");

        // ...but a body over the limit is refused.
        let base = serve(vec![("big".to_string(), vec![0u8; 50])], 1);
        std::env::set_var("GLYX_TOOLS_BASE", &base);
        assert!(get(&format!("{base}/media/big"), 10).unwrap_err().contains("larger than"));

        std::env::remove_var("GLYX_TOOLS_BASE");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn members_in_directories_are_never_extracted() {
        let archive = tar_gz(&[("evil/avcodec-63.dll", b"codec")]);
        let wanted = BTreeMap::from([("avcodec-63.dll".to_string(), sha256_hex(b"codec"))]);
        assert!(extract_libs(&archive, &wanted).is_err());
    }
}
