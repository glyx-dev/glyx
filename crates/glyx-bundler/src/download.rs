//! Fetching the pinned esbuild release when the machine has none.
//!
//! esbuild publishes each platform's binary as an npm package; the tarball is
//! downloaded straight from the registry (no Node or npm involved), checked
//! against the SHA-512 pinned below, and cached in `~/.glyx/tools/`, so this
//! happens once per machine. `GLYX_TOOLS_BASE` (the CLI's self-hosting
//! variable) points it at a mirror serving `<base>/esbuild/<platform>-<version>.tgz`;
//! the pinned hash still decides whether the file is accepted.

use std::io::Read;
use std::path::{Path, PathBuf};

use sha2::{Digest, Sha512};

use crate::esbuild::{cached_binary, ESBUILD_VERSION};
use crate::{process, Result};

/// SHA-512 of each platform package's tarball for [`ESBUILD_VERSION`], as the
/// npm registry publishes them (`dist.integrity`), in hex.
const PINS: &[(&str, &str)] = &[
    ("win32-x64", "e5e6e9c6bde758cceb2ffae7508ef9e4992e79ed1b1cbfc6ab459317d96f729bfbdf0029e5ebbc31f0548162bd6e15af6638fbc97f1eb5fffcb48f0d7b2ebde6"),
    ("win32-arm64", "3c886112413db8f06579106b404269527ecc06789b6736c6cd858f998df1f98a1583ff79cdb8c1e02c4f3ce43c979b5860ce2631a0ad845f3fd4321f05043259"),
    ("darwin-x64", "baaeacb885983f7eeacc675d04a3f0e501103e2e8788b1ac3bb5269297f2698350dc3fab37ac3a59fc07fa7baa7065d6bdac06c31384ae83b86069c587de5acf"),
    ("darwin-arm64", "9f82aa90e42badac4725c82333546fc1b8a07d028828956933bc69f8ab318b2512ad17485e7b7bdd586b3c0c747d5e388607e62152a3c4c37d275b798f249593"),
    ("linux-x64", "e314d9af5154992a105b85c85a68addedcd0ad44d933e3773f45d5f3144e298179d177c8ef178ef74fb56d9bcdc3122e7d0f610d0551247e588603d517c03f1d"),
    ("linux-arm64", "a56e000b43f78adf1cedda3d315338a79d45cc7cdd33f4d9adeaeeae045c1c9d964dad55435088ab5f319dc7e9049c38a23922659aca5b6c8805604ff768fa52"),
];

const MAX_TARBALL_BYTES: u64 = 64 * 1024 * 1024;

pub(crate) fn pin_for(platform: &str) -> Option<&'static str> {
    PINS.iter().find(|(p, _)| *p == platform).map(|(_, h)| *h)
}

fn mirror_base() -> Option<String> {
    let v = std::env::var("GLYX_TOOLS_BASE").ok()?.trim().trim_end_matches('/').to_string();
    (!v.is_empty()).then_some(v)
}

pub(crate) fn tarball_url(platform: &str, mirror: Option<&str>) -> String {
    match mirror {
        Some(base) => format!("{base}/esbuild/{platform}-{ESBUILD_VERSION}.tgz"),
        None => format!("https://registry.npmjs.org/@esbuild/{platform}/-/{platform}-{ESBUILD_VERSION}.tgz"),
    }
}

/// The binary's path inside the tarball.
fn member_name() -> &'static str {
    if cfg!(windows) { "package/esbuild.exe" } else { "package/bin/esbuild" }
}

pub(crate) fn sha512_hex(bytes: &[u8]) -> String {
    format!("{:x}", Sha512::digest(bytes))
}

/// Check `bytes` against the pinned hash.
pub(crate) fn verify(bytes: &[u8], expected_hex: &str) -> Result<()> {
    let got = sha512_hex(bytes);
    if got.eq_ignore_ascii_case(expected_hex) {
        Ok(())
    } else {
        Err(format!("the esbuild download does not match its pinned checksum (expected {expected_hex}, got {got}); refusing to use it"))
    }
}

/// The file called `member` inside a `.tgz`.
pub(crate) fn extract_member(tgz: &[u8], member: &str) -> Result<Vec<u8>> {
    let mut archive = tar::Archive::new(flate2::read::GzDecoder::new(tgz));
    for entry in archive.entries().map_err(|e| format!("cannot read the esbuild archive: {e}"))? {
        let mut entry = entry.map_err(|e| format!("bad entry in the esbuild archive: {e}"))?;
        let is_it = entry.path().map(|p| p.to_string_lossy().replace('\\', "/") == member).unwrap_or(false);
        if is_it {
            let mut out = Vec::new();
            entry.read_to_end(&mut out).map_err(|e| format!("cannot read {member}: {e}"))?;
            return Ok(out);
        }
    }
    Err(format!("the esbuild archive has no {member}"))
}

fn fetch_bytes(url: &str) -> Result<Vec<u8>> {
    let agent = ureq::AgentBuilder::new()
        .timeout_connect(std::time::Duration::from_secs(30))
        .timeout_read(std::time::Duration::from_secs(120))
        .build();
    let resp = agent.get(url).call().map_err(|e| format!("could not download {url}: {e}"))?;
    let mut body = Vec::new();
    resp.into_reader().take(MAX_TARBALL_BYTES + 1).read_to_end(&mut body)
        .map_err(|e| format!("could not read {url}: {e}"))?;
    if body.len() as u64 > MAX_TARBALL_BYTES {
        return Err(format!("{url} is larger than the {MAX_TARBALL_BYTES}-byte limit"));
    }
    Ok(body)
}

/// Download, verify and cache esbuild for `platform`; returns the binary.
pub(crate) fn fetch(cache_dir: &Path, platform: &str) -> Result<PathBuf> {
    let bin = cached_binary(cache_dir);
    if bin.is_file() {
        return Ok(bin);
    }
    let pin = pin_for(platform).ok_or_else(|| format!("no pinned esbuild for {platform}"))?;
    let url = tarball_url(platform, mirror_base().as_deref());
    eprintln!("Downloading esbuild {ESBUILD_VERSION} (one time; cached in {})…", cache_dir.display());
    let tgz = fetch_bytes(&url)?;
    verify(&tgz, pin)?;
    let binary = extract_member(&tgz, member_name())?;

    let dir = bin.parent().ok_or("bad cache path")?;
    std::fs::create_dir_all(dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
    let mut part = bin.as_os_str().to_owned();
    part.push(".part");
    let part = PathBuf::from(part);
    std::fs::write(&part, &binary).map_err(|e| format!("cannot write {}: {e}", part.display()))?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let _ = std::fs::set_permissions(&part, std::fs::Permissions::from_mode(0o755));
    }
    std::fs::rename(&part, &bin).map_err(|e| {
        let _ = std::fs::remove_file(&part);
        format!("cannot install {}: {e}", bin.display())
    })?;

    // It must run, and be the release that was pinned.
    let version = process::command(&bin).arg("--version").output()
        .map_err(|e| format!("the downloaded esbuild does not run: {e}"))?;
    let version = String::from_utf8_lossy(&version.stdout).trim().to_string();
    if version != ESBUILD_VERSION {
        let _ = std::fs::remove_file(&bin);
        return Err(format!("the downloaded esbuild reports version {version:?}, not {ESBUILD_VERSION}"));
    }
    Ok(bin)
}
