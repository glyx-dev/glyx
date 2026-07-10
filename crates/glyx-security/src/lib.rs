//! glyx-security — Capability enforcement for Glyx apps.
//!
//! Capabilities are declared in `glyx.config.json` and locked into a
//! process-wide `OnceLock` at startup before any JS bindings execute.
//!
//! Every guarded binding calls `glyx_security::get()` and checks the relevant
//! helper — if the capability is absent it throws a JS Error explaining exactly
//! which capability to add to the config.
//!
//! ## Security model
//!
//! Glyx apps bundle developer-owned JS (not arbitrary web content), so the
//! right model is Android/iOS-style capability declaration rather than Electron-
//! style process isolation.  The Rust binding layer is the enforcement point —
//! JS cannot bypass it regardless of what npm packages are installed.

use std::sync::OnceLock;
use std::path::{Path, PathBuf};

use serde::Deserialize;

// ── Path safety helpers (0.1) ─────────────────────────────────────────────────

/// Why a path was denied by `resolve_and_check_*`.
#[derive(Debug)]
pub enum DenyReason {
    /// The OS refused to canonicalize the path (does not exist or I/O error).
    Canonicalize(std::io::Error),
    /// The capability for this operation is not declared at all.
    CapabilityMissing,
    /// The canonical path does not match any declared glob.
    NotAllowed,
    /// The path is absolute but no absolute grant covers it.
    AbsolutePathDenied,
}

impl std::fmt::Display for DenyReason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Canonicalize(e)    => write!(f, "cannot canonicalize path: {e}"),
            Self::CapabilityMissing  => write!(f, "capability not declared"),
            Self::NotAllowed         => write!(f, "path not covered by any declared glob"),
            Self::AbsolutePathDenied => write!(f, "absolute path requires an explicit grant"),
        }
    }
}

/// Canonicalize `path` (resolving symlinks), then verify the result against
/// the declared `fs.read` globs.  Returns the canonical `PathBuf` on success
/// so callers open **that** path — closing the TOCTOU window between check
/// and open.
///
/// Fails with [`DenyReason::Canonicalize`] if the path does not exist (the
/// file must already exist for a read check to make sense).
pub fn resolve_and_check_read(path: &Path) -> Result<PathBuf, DenyReason> {
    let canonical = path.canonicalize().map_err(DenyReason::Canonicalize)?;
    let caps = get();
    let path_str = canonical.to_string_lossy();
    if caps.can_read_path(&path_str) {
        Ok(canonical)
    } else if caps.fs.is_none() {
        Err(DenyReason::CapabilityMissing)
    } else {
        Err(DenyReason::NotAllowed)
    }
}

/// Canonicalize the **parent directory** of `path` (the file need not exist
/// yet for writes), then verify the resolved path against `fs.write` globs.
/// Returns the resolved `PathBuf` on success.
///
/// Uses the parent-canonicalize strategy so new files can be created: if
/// `path` itself doesn't exist, its parent must exist and be within the grant.
pub fn resolve_and_check_write(path: &Path) -> Result<PathBuf, DenyReason> {
    // For writes the target file may not exist yet — canonicalize the parent.
    let canonical = if path.exists() {
        path.canonicalize().map_err(DenyReason::Canonicalize)?
    } else {
        let parent = path.parent().unwrap_or(Path::new("."));
        let canon_parent = parent.canonicalize().map_err(DenyReason::Canonicalize)?;
        let file_name = path.file_name().unwrap_or_default();
        canon_parent.join(file_name)
    };
    let caps = get();
    let path_str = canonical.to_string_lossy();
    if caps.can_write_path(&path_str) {
        Ok(canonical)
    } else if caps.fs.is_none() {
        Err(DenyReason::CapabilityMissing)
    } else {
        Err(DenyReason::NotAllowed)
    }
}

// ── Capability definitions ────────────────────────────────────────────────────

/// File-system access declarations.
///
/// Patterns are globs (`*`, `**`, `?`), matched per path at every fs binding:
/// - Relative patterns (`"assets/**"`, `"data/*.json"`) anchor at the app's
///   working directory (the project root in dev, the install dir packaged).
/// - Absolute patterns match absolute paths.
/// - `"**"` alone matches everything, including paths outside the app root
///   (needed for OS file-picker results).
///
/// Requested paths are lexically normalized before matching, so
/// `assets/../secrets.txt` is checked as `secrets.txt` — `..` cannot escape
/// a granted glob.
#[derive(Debug, Deserialize, Clone, Default)]
pub struct FsCapability {
    /// Glob patterns the app may read. `None` = no read access.
    pub read:   Option<Vec<String>>,
    /// Glob patterns the app may write (create/overwrite/append). `None` = no write access.
    pub write:  Option<Vec<String>>,
    /// Glob patterns the app may delete. `None` = falls back to `write` globs.
    /// Set to `[]` to allow write but deny delete entirely.
    pub delete: Option<Vec<String>>,
    /// Compiled matcher for `read`, built lazily on first check.
    #[serde(skip)]
    read_set:   OnceLock<Option<globset::GlobSet>>,
    /// Compiled matcher for `write`, built lazily on first check.
    #[serde(skip)]
    write_set:  OnceLock<Option<globset::GlobSet>>,
    /// Compiled matcher for `delete`, built lazily on first check.
    #[serde(skip)]
    delete_set: OnceLock<Option<globset::GlobSet>>,
}

impl FsCapability {
    fn set_for<'a>(&self, patterns: &Option<Vec<String>>, cache: &'a OnceLock<Option<globset::GlobSet>>) -> Option<&'a globset::GlobSet> {
        cache.get_or_init(|| {
            let pats = patterns.as_ref()?;
            let mut b = globset::GlobSetBuilder::new();
            for p in pats {
                // Normalize config separators so "assets\\icons\\**" works too.
                let p = p.replace('\\', "/");
                match globset::GlobBuilder::new(&p)
                    .literal_separator(true)   // `*` stays within one segment; use `**` to recurse
                    .case_insensitive(cfg!(windows))
                    .build()
                {
                    Ok(g)  => { b.add(g); }
                    Err(e) => log::error!("[security] invalid fs glob {p:?} ignored: {e}"),
                }
            }
            b.build().map_err(|e| log::error!("[security] fs glob set failed: {e}")).ok()
        }).as_ref()
    }

    fn allows(&self, patterns: &Option<Vec<String>>, cache: &OnceLock<Option<globset::GlobSet>>, path: &str) -> bool {
        let Some(set) = self.set_for(patterns, cache) else { return false };
        for candidate in match_candidates(path) {
            if set.is_match(candidate.as_str()) {
                return true;
            }
        }
        false
    }
}

/// Lexically resolve `.` and `..` (no filesystem access — works for paths
/// that don't exist yet, and never follows symlinks during the *check*).
fn normalize_lexical(path: &std::path::Path) -> std::path::PathBuf {
    let mut out = std::path::PathBuf::new();
    for comp in path.components() {
        match comp {
            std::path::Component::CurDir => {}
            std::path::Component::ParentDir => { out.pop(); }
            other => out.push(other.as_os_str()),
        }
    }
    out
}

/// Candidate strings a path is matched under (forward-slash form):
/// 1. the absolute normalized path, and
/// 2. its app-root-relative form when it lives under the working directory —
///    this is what relative config patterns like `"assets/**"` anchor to.
fn match_candidates(path: &str) -> Vec<String> {
    let p = std::path::Path::new(path);
    let abs = if p.is_absolute() {
        normalize_lexical(p)
    } else {
        let cwd = std::env::current_dir().unwrap_or_default();
        normalize_lexical(&cwd.join(p))
    };
    let mut out = vec![abs.to_string_lossy().replace('\\', "/")];
    if let Ok(cwd) = std::env::current_dir() {
        if let Ok(rel) = abs.strip_prefix(normalize_lexical(&cwd)) {
            out.push(rel.to_string_lossy().replace('\\', "/"));
        }
    }
    out
}

/// Network access declarations.
#[derive(Debug, Deserialize, Clone, Default)]
pub struct NetworkCapability {
    /// Whitelisted hostnames. Use `["*"]` to allow all outbound.
    pub allow: Vec<String>,
}

/// Environment variable access declarations.
///
/// Only variables whose names match an entry in `allow` are readable from JS.
/// Patterns support a trailing `*` wildcard: `"MY_APP_*"` allows all vars
/// with that prefix.  JS cannot enumerate or dump the process environment —
/// it can only read names it explicitly requests that are in the allowlist.
#[derive(Debug, Deserialize, Clone, Default)]
pub struct EnvCapability {
    /// Allowed env var name patterns. Supports trailing `*` wildcard.
    pub allow: Vec<String>,
}

/// Matches an env var name against a single pattern.
/// Supports exact match and trailing `*` wildcard only.
fn env_pattern_matches(pattern: &str, name: &str) -> bool {
    if let Some(prefix) = pattern.strip_suffix('*') {
        name.starts_with(prefix)
    } else {
        pattern == name
    }
}

/// Deep-link capability declaration.
///
/// Enables custom URL scheme handling so the OS can launch or focus the app
/// when a link like `myapp://note/42` is activated from a browser or another app.
#[derive(Debug, Deserialize, Clone)]
pub struct DeeplinkCapability {
    /// The URL scheme to register (without `://`), e.g. `"notes"`.
    pub scheme: String,
    /// If `true`, only one instance of the app may run at a time.
    /// A second launch with a URL forwards the URL to the first instance and exits.
    #[serde(rename = "singleInstance", default)]
    pub single_instance: bool,
}

/// The full capability set for one Glyx application.
///
/// Deserialises from the `"capabilities"` key in `glyx.config.json`.
#[derive(Debug, Deserialize, Clone, Default)]
pub struct Capabilities {
    pub fs:      Option<FsCapability>,
    pub network: Option<NetworkCapability>,
    pub env:     Option<EnvCapability>,
    #[serde(default)]
    pub db:           bool,
    #[serde(default)]
    pub dialog:       bool,
    #[serde(default)]
    pub clipboard:    bool,
    #[serde(default)]
    pub notification: bool,
    #[serde(default)]
    pub battery:          bool,
    #[serde(default)]
    pub usb:              bool,
    #[serde(default)]
    pub shell:            bool,
    #[serde(default)]
    pub mdns:             bool,
    #[serde(default)]
    pub system:           bool,
    #[serde(default)]
    pub power:            bool,
    #[serde(default)]
    pub storage:          bool,
    #[serde(default)]
    pub gamepads:         bool,
    #[serde(rename = "globalShortcuts")]
    #[serde(default)]
    pub global_shortcuts: bool,
    /// OS credential store (Windows Credential Manager, macOS Keychain, Linux Secret Service).
    /// Allows storing/retrieving secrets encrypted by the OS, tied to the logged-in user.
    #[serde(default)]
    pub credentials: bool,
    /// Audio playback (local files via rodio + Symphonia decoders).
    #[serde(default)]
    pub audio: bool,
    /// Local AI inference (Candle — embeddings, text generation, speech-to-text).
    /// Downloads model weights from HuggingFace Hub on first use (~22 MB – 1.7 GB).
    #[serde(default)]
    pub ai: bool,
    /// Camera capture access. Enables `camera.listDevices()`, `camera.open()`, `<Camera>` component.
    #[serde(default)]
    pub camera: bool,
    /// Microphone recording access. Enables `microphone.listDevices()`, `microphone.record()`.
    #[serde(default)]
    pub microphone: bool,
    /// HID (Human Interface Device) access. Enables `hid.enumerate()`, `hid.open()`.
    /// Required for gamepads, custom USB HID devices, MIDI controllers, etc.
    #[serde(default)]
    pub hid: bool,
    /// Auto-updater — check for and apply GitHub release updates.
    /// Enables `updater.check()` and `updater.update()`.
    #[serde(default)]
    pub updater: bool,
    /// Video playback via the glyx-media DLL (ffmpeg-backed decoder/encoder).
    /// Enables `video.open()`, `<Video>` component.
    /// Gracefully degrades to "not available" if the DLL has not been downloaded.
    #[serde(default)]
    pub video: bool,
    /// Crash reporter — capture and persist JS/Rust crash reports to disk.
    /// Enables `crash.getReports()`, `crash.clearReports()`, and automatic
    /// `unhandledrejection`/`onerror` capture from JS.
    /// Rust panics are always written to `~/.glyx/crashes/` regardless of this flag.
    #[serde(default)]
    pub crash: bool,
    /// Deep-link URL scheme registration.  `None` = no deep-link support.
    pub deeplink: Option<DeeplinkCapability>,
}

impl Capabilities {
    /// True if the app has declared at least some `fs.read` access.
    pub fn can_read_fs(&self) -> bool {
        self.fs.as_ref().and_then(|f| f.read.as_ref()).is_some()
    }

    /// True if the app has declared at least some `fs.write` access.
    pub fn can_write_fs(&self) -> bool {
        self.fs.as_ref().and_then(|f| f.write.as_ref()).is_some()
    }

    /// True if `path` matches one of the declared `fs.read` globs.
    /// The path is lexically normalized first, so `..` cannot escape a glob.
    pub fn can_read_path(&self, path: &str) -> bool {
        self.fs.as_ref().is_some_and(|f| f.allows(&f.read, &f.read_set, path))
    }

    /// True if `path` matches one of the declared `fs.write` globs.
    pub fn can_write_path(&self, path: &str) -> bool {
        self.fs.as_ref().is_some_and(|f| f.allows(&f.write, &f.write_set, path))
    }

    /// True if `path` may be deleted.
    ///
    /// If `fs.delete` is declared, matches against those globs.
    /// If `fs.delete` is absent (`None`), falls back to `fs.write` globs.
    /// If `fs.delete` is an empty array (`[]`), deletion is denied everywhere.
    pub fn can_delete_path(&self, path: &str) -> bool {
        let Some(fs) = self.fs.as_ref() else { return false };
        match &fs.delete {
            Some(_) => fs.allows(&fs.delete, &fs.delete_set, path),
            None    => fs.allows(&fs.write,  &fs.write_set,  path),
        }
    }

    /// True if `host` is in the network allowlist, or `"*"` is listed.
    pub fn can_network(&self, host: &str) -> bool {
        self.network
            .as_ref()
            .map(|n| n.allow.iter().any(|h| h == "*" || h == host))
            .unwrap_or(false)
    }

    /// True if the app declared `mdns: true`.
    pub fn can_mdns(&self) -> bool { self.mdns }

    /// True if `name` matches any pattern in the `env.allow` list.
    /// Returns `false` (silently) when no `env` capability is declared.
    pub fn can_get_env(&self, name: &str) -> bool {
        self.env
            .as_ref()
            .map(|e| e.allow.iter().any(|p| env_pattern_matches(p, name)))
            .unwrap_or(false)
    }
}

// ── Global capability store ───────────────────────────────────────────────────

static CAPS: OnceLock<Capabilities> = OnceLock::new();

// ── App version store ─────────────────────────────────────────────────────────

static APP_VERSION: OnceLock<String> = OnceLock::new();

/// Store the app version declared in `glyx.config.json`.
/// Must be called once during startup. Subsequent calls are silently ignored.
pub fn init_version(version: String) {
    let _ = APP_VERSION.set(version);
}

/// Returns the app version string, or `"0.0.0"` if not set.
pub fn app_version() -> &'static str {
    APP_VERSION.get().map(|s| s.as_str()).unwrap_or("0.0.0")
}

/// Lock in the capability set from the parsed config.
///
/// Must be called once during startup before any JS bindings execute.
/// Subsequent calls (e.g. accidental double-init) are silently ignored.
pub fn init(caps: Capabilities) {
    if CAPS.set(caps).is_err() {
        log::warn!("glyx-security: init() called more than once — ignored");
    }
}

/// Returns `true` if `init()` has already been called for this process.
pub fn is_initialized() -> bool {
    CAPS.get().is_some()
}

/// Returns the active capability set for this process.
///
/// If `init()` has not been called, returns a zero-permission default so
/// that unconfigured apps fail closed rather than open.
pub fn get() -> &'static Capabilities {
    CAPS.get_or_init(Capabilities::default)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn parse(json: &str) -> Capabilities {
        serde_json::from_str(json).expect("capabilities should parse")
    }

    // ── Deserialization ───────────────────────────────────────────────────────

    #[test]
    fn empty_config_denies_everything() {
        let caps = parse("{}");
        assert!(!caps.can_read_fs());
        assert!(!caps.can_write_fs());
        assert!(!caps.can_network("api.example.com"));
        assert!(!caps.can_get_env("PATH"));
        assert!(!caps.db);
        assert!(!caps.shell);
        assert!(!caps.credentials);
        assert!(!caps.ai);
        assert!(caps.deeplink.is_none());
    }

    #[test]
    fn default_struct_matches_empty_config() {
        // `get()` before `init()` hands out Capabilities::default() — it must
        // deny exactly like a config with no "capabilities" key.
        let caps = Capabilities::default();
        assert!(!caps.can_read_fs());
        assert!(!caps.can_write_fs());
        assert!(!caps.can_network("anything"));
        assert!(!caps.can_get_env("ANYTHING"));
    }

    #[test]
    fn full_config_parses_with_renamed_fields() {
        let caps = parse(r#"{
            "fs": { "read": ["assets/**"], "write": ["data/**"] },
            "network": { "allow": ["api.example.com"] },
            "env": { "allow": ["MY_APP_*"] },
            "db": true,
            "globalShortcuts": true,
            "deeplink": { "scheme": "notes", "singleInstance": true }
        }"#);
        assert!(caps.can_read_fs());
        assert!(caps.can_write_fs());
        assert!(caps.db);
        assert!(caps.global_shortcuts);
        let dl = caps.deeplink.as_ref().unwrap();
        assert_eq!(dl.scheme, "notes");
        assert!(dl.single_instance);
    }

    #[test]
    fn deeplink_single_instance_defaults_false() {
        let caps = parse(r#"{ "deeplink": { "scheme": "x" } }"#);
        assert!(!caps.deeplink.unwrap().single_instance);
    }

    // ── fs ────────────────────────────────────────────────────────────────────

    #[test]
    fn fs_read_and_write_are_independent() {
        let read_only = parse(r#"{ "fs": { "read": ["**"] } }"#);
        assert!(read_only.can_read_fs());
        assert!(!read_only.can_write_fs());

        let write_only = parse(r#"{ "fs": { "write": ["**"] } }"#);
        assert!(!write_only.can_read_fs());
        assert!(write_only.can_write_fs());
    }

    #[test]
    fn fs_block_without_lists_grants_nothing() {
        let caps = parse(r#"{ "fs": {} }"#);
        assert!(!caps.can_read_fs());
        assert!(!caps.can_write_fs());
    }

    // ── fs per-path scoping ───────────────────────────────────────────────────

    #[test]
    fn fs_relative_glob_scopes_to_matching_paths() {
        let caps = parse(r#"{ "fs": { "read": ["assets/**"] } }"#);
        assert!(caps.can_read_path("assets/logo.png"));
        assert!(caps.can_read_path("assets/deep/nested/file.bin"));
        assert!(caps.can_read_path("./assets/logo.png"));
        assert!(!caps.can_read_path("secrets.txt"));
        assert!(!caps.can_read_path("data/assets/logo.png"));
    }

    #[test]
    fn fs_traversal_cannot_escape_a_glob() {
        let caps = parse(r#"{ "fs": { "read": ["assets/**"] } }"#);
        assert!(!caps.can_read_path("assets/../Cargo.toml"));
        assert!(!caps.can_read_path("assets/../../etc/passwd"));
        assert!(!caps.can_read_path("assets/./../secrets.txt"));
        // Traversal that stays inside the granted tree is fine.
        assert!(caps.can_read_path("assets/a/../b.png"));
    }

    #[test]
    fn fs_double_star_alone_matches_everything() {
        // "**" is the documented allow-all — including absolute paths outside
        // the app root (OS file-picker results).
        let caps = parse(r#"{ "fs": { "read": ["**"] } }"#);
        assert!(caps.can_read_path("anything.txt"));
        assert!(caps.can_read_path("deep/nested/file"));
        #[cfg(windows)]
        assert!(caps.can_read_path("C:\\Users\\someone\\Pictures\\photo.jpg"));
        #[cfg(not(windows))]
        assert!(caps.can_read_path("/home/someone/photo.jpg"));
    }

    #[test]
    fn fs_single_star_stays_within_one_segment() {
        let caps = parse(r#"{ "fs": { "read": ["data/*.json"] } }"#);
        assert!(caps.can_read_path("data/config.json"));
        assert!(!caps.can_read_path("data/sub/config.json"));
        assert!(!caps.can_read_path("data/config.yaml"));
    }

    #[test]
    fn fs_read_and_write_scopes_are_independent_per_path() {
        let caps = parse(r#"{ "fs": { "read": ["**"], "write": ["out/**"] } }"#);
        assert!(caps.can_read_path("anywhere/file.txt"));
        assert!(caps.can_write_path("out/report.pdf"));
        assert!(!caps.can_write_path("anywhere/file.txt"));
    }

    #[test]
    fn fs_absolute_pattern_matches_absolute_path() {
        let cwd = std::env::current_dir().unwrap();
        let pattern = format!("{}/data/**", cwd.to_string_lossy().replace('\\', "/"));
        let caps = parse(&format!(r#"{{ "fs": {{ "read": [{:?}] }} }}"#, pattern));
        // Both the relative and the absolute spelling of the same file match.
        assert!(caps.can_read_path("data/file.txt"));
        let abs = format!("{}/data/file.txt", cwd.to_string_lossy());
        assert!(caps.can_read_path(&abs));
    }

    #[test]
    fn fs_no_capability_denies_every_path() {
        let caps = parse("{}");
        assert!(!caps.can_read_path("anything"));
        assert!(!caps.can_write_path("anything"));
        let caps = parse(r#"{ "fs": {} }"#);
        assert!(!caps.can_read_path("anything"));
    }

    // ── network ───────────────────────────────────────────────────────────────

    #[test]
    fn network_allows_exact_host_only() {
        let caps = parse(r#"{ "network": { "allow": ["api.example.com"] } }"#);
        assert!(caps.can_network("api.example.com"));
        assert!(!caps.can_network("example.com"));
        assert!(!caps.can_network("evil-api.example.com"));
        // Subdomains are NOT implicitly allowed.
        assert!(!caps.can_network("sub.api.example.com"));
    }

    #[test]
    fn network_wildcard_allows_all() {
        let caps = parse(r#"{ "network": { "allow": ["*"] } }"#);
        assert!(caps.can_network("anything.example.com"));
        assert!(caps.can_network("127.0.0.1"));
    }

    #[test]
    fn network_empty_allowlist_denies_all() {
        let caps = parse(r#"{ "network": { "allow": [] } }"#);
        assert!(!caps.can_network("api.example.com"));
    }

    #[test]
    fn network_match_is_case_sensitive_expecting_lowercase() {
        // Binding-side extract_host() lowercases before checking, so config
        // entries must be lowercase. An uppercase config entry never matches.
        let caps = parse(r#"{ "network": { "allow": ["API.EXAMPLE.COM"] } }"#);
        assert!(!caps.can_network("api.example.com"));
    }

    // ── env ───────────────────────────────────────────────────────────────────

    #[test]
    fn env_exact_match() {
        let caps = parse(r#"{ "env": { "allow": ["HOME"] } }"#);
        assert!(caps.can_get_env("HOME"));
        assert!(!caps.can_get_env("HOMEDRIVE"));
        assert!(!caps.can_get_env("PATH"));
    }

    #[test]
    fn env_trailing_wildcard_matches_prefix() {
        let caps = parse(r#"{ "env": { "allow": ["MY_APP_*"] } }"#);
        assert!(caps.can_get_env("MY_APP_TOKEN"));
        assert!(caps.can_get_env("MY_APP_"));
        assert!(!caps.can_get_env("MY_APP"));   // prefix itself, without the underscore run
        assert!(!caps.can_get_env("OTHER_MY_APP_X"));
    }

    #[test]
    fn env_bare_star_matches_everything() {
        let caps = parse(r#"{ "env": { "allow": ["*"] } }"#);
        assert!(caps.can_get_env("PATH"));
        assert!(caps.can_get_env(""));
    }

    #[test]
    fn env_wildcard_only_at_end() {
        // '*' anywhere but the end is treated as a literal character.
        let caps = parse(r#"{ "env": { "allow": ["MY_*_TOKEN"] } }"#);
        assert!(!caps.can_get_env("MY_APP_TOKEN"));
        assert!(caps.can_get_env("MY_*_TOKEN"));
    }
}
