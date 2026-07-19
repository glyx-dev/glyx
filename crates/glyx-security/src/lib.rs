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
    /// Windows NTFS Alternate Data Stream (`:stream`) in the path component.
    AlternateDataStream,
}

impl std::fmt::Display for DenyReason {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Canonicalize(e)      => write!(f, "cannot canonicalize path: {e}"),
            Self::CapabilityMissing    => write!(f, "capability not declared"),
            Self::NotAllowed           => write!(f, "path not covered by any declared glob"),
            Self::AbsolutePathDenied   => write!(f, "absolute path requires an explicit grant"),
            Self::AlternateDataStream  => write!(f, "NTFS Alternate Data Streams are not permitted"),
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
/// True when any normal path component contains a ':' — an NTFS Alternate
/// Data Stream (e.g. "file.txt:hidden").  The drive prefix (`C:`) of an
/// absolute Windows path is NOT a stream and is skipped.
fn has_ads_component(path: &Path) -> bool {
    path.components().any(|c| {
        !matches!(c, std::path::Component::Prefix(_))
            && c.as_os_str().to_string_lossy().contains(':')
    })
}

pub fn resolve_and_check_read(path: &Path) -> Result<PathBuf, DenyReason> {
    // Reject NTFS Alternate Data Streams (e.g. "file.txt:hidden") — they
    // can hide payloads in the same inode and bypass content checks on Windows.
    if has_ads_component(path) {
        #[cfg(target_os = "windows")]
        return Err(DenyReason::AlternateDataStream);
    }
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
    // Reject NTFS Alternate Data Streams on Windows.
    if has_ads_component(path) {
        #[cfg(target_os = "windows")]
        return Err(DenyReason::AlternateDataStream);
    }
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

/// Canonicalize `requested` and verify it lies within `shellAgent.scopeDir`
/// (also canonicalized). Used to hard-scope a spawned agent-shell process's
/// cwd — `..`/absolute-path escapes are rejected here, not just discouraged.
pub fn resolve_shell_agent_cwd(requested: &Path) -> Result<PathBuf, DenyReason> {
    let caps = get();
    let Some(scope) = caps.shell_agent_scope() else { return Err(DenyReason::CapabilityMissing) };
    let scope_canonical = Path::new(scope).canonicalize().map_err(DenyReason::Canonicalize)?;
    let requested_canonical = requested.canonicalize().map_err(DenyReason::Canonicalize)?;
    if requested_canonical.starts_with(&scope_canonical) {
        Ok(requested_canonical)
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

/// Scoped shell access — an explicit allowlist of exact binary names.
///
/// Binaries are matched by exact name (never glob/prefix, to avoid PATH
/// tricks) and resolved to an explicit path before spawning. Arguments are
/// always passed as a real argv array via `std::process::Command` — never
/// through a shell interpreter (`sh -c`/`cmd /c`) — so this capability
/// cannot be used for shell-metacharacter injection regardless of what a
/// caller passes as arguments; that's a structural property of how the
/// process is spawned, not a filter applied on top of it.
#[derive(Debug, Deserialize, Clone, Default)]
pub struct ShellCapability {
    /// Exact binary names (or absolute paths) the app may spawn, e.g.
    /// `["git", "ffmpeg"]`.
    pub allow: Vec<String>,
}

/// Open-ended shell access for agent-style apps (e.g. an AI coding
/// assistant) that can't enumerate which binaries they'll need ahead of
/// time. No binary allowlist — any command runs — but every spawned
/// process is hard-scoped to `scope_dir` (canonicalized; `..`/absolute-path
/// escapes are rejected before spawn, not just discouraged) and every
/// invocation must be shown via the native (JS-independent) activity
/// overlay — see `crates/glyx-core/src/lib.rs`'s `shell_agent_log`. This is
/// deliberately a much higher trust level than `ShellCapability` and is
/// meant to require an explicit, loud opt-in, not a boolean flip.
#[derive(Debug, Deserialize, Clone)]
pub struct ShellAgentCapability {
    /// The only filesystem root spawned processes' cwd may resolve within.
    #[serde(rename = "scopeDir")]
    pub scope_dir: String,
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
    /// Grant arbitrary DB paths — required for `:memory:` or absolute paths.
    /// Without this, `db.open()` is scoped to the app data dir only.
    #[serde(rename = "dbPath", default)]
    pub db_path:      bool,
    #[serde(default)]
    pub dialog:       bool,
    #[serde(default)]
    pub clipboard:    bool,
    #[serde(default)]
    pub notification: bool,
    /// System tray icon and menu.
    #[serde(default)]
    pub tray: bool,
    #[serde(default)]
    pub battery:          bool,
    #[serde(default)]
    pub usb:              bool,
    /// `open_external()` — opens a URL/file via the OS (rundll32/open/
    /// xdg-open), no shell interpreter involved. NOT the same capability as
    /// `shellExec`/`shellAgent` below — this one predates them and only
    /// permits handing a URL to the OS's default handler.
    #[serde(default)]
    pub shell:            bool,
    /// Scoped shell access (Tier 1) — explicit binary allowlist. Distinct
    /// from `shell` above — this permits spawning arbitrary declared
    /// binaries with arbitrary args, `shell` only opens URLs.
    #[serde(rename = "shellExec")]
    pub shell_exec:       Option<ShellCapability>,
    /// Agent-style shell access (Tier 2) — no allowlist, cwd-scoped, requires
    /// the native activity overlay. See `ShellAgentCapability`'s docs.
    #[serde(rename = "shellAgent")]
    pub shell_agent:      Option<ShellAgentCapability>,
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
    /// Enables the AI APIs but does NOT permit model downloads by itself.
    #[serde(default)]
    pub ai: bool,
    /// Permit automatic model weight downloads from HuggingFace Hub on first use.
    /// Downloads range from ~22 MB (embed) to ~1.7 GB (generate).
    /// Without this flag, AI APIs return an error if the model is not already cached.
    #[serde(default, rename = "aiModelDownload")]
    pub ai_model_download: bool,
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

    /// True if `bin` (exact name) is in the `shellExec.allow` list.
    pub fn can_shell_run(&self, bin: &str) -> bool {
        self.shell_exec.as_ref().is_some_and(|s| s.allow.iter().any(|b| b == bin))
    }

    /// The declared `shellAgent.scopeDir`, if the capability is present.
    pub fn shell_agent_scope(&self) -> Option<&str> {
        self.shell_agent.as_ref().map(|s| s.scope_dir.as_str())
    }

    /// True if the app declared `aiModelDownload: true`.
    /// Without this, AI model downloads are blocked; APIs only succeed if the
    /// model weights are already present in the HuggingFace cache.
    pub fn can_ai_download(&self) -> bool { self.ai_model_download }

    /// True if `name` matches any pattern in the `env.allow` list.
    /// Returns `false` (silently) when no `env` capability is declared or name is empty.
    pub fn can_get_env(&self, name: &str) -> bool {
        if name.is_empty() { return false; }
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

// ── Update origin store ───────────────────────────────────────────────────────
//
// The GitHub owner/repo/binName the auto-updater checks against. Read from
// `glyx.config.json`'s `updater` block at startup — NOT from a build-time
// `option_env!`, since the real build pipeline (`glyx build`) mostly ships a
// shared, cached `glyx-runner` binary plus embedded/runtime-supplied config
// (see `glyx-core::config::read_config_json`'s three sources: embedded
// payload, `GLYX_CONFIG_JSON` env var, or the config file itself) rather than
// a full per-app `cargo build` with unique compile-time constants baked in.
// This mirrors `init_version`/`app_version` above exactly.

/// GitHub owner/repo + release asset binary-name prefix for the auto-updater.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct UpdateOrigin {
    pub owner:    String,
    pub repo:     String,
    pub bin_name: String,
}

static UPDATE_ORIGIN: OnceLock<UpdateOrigin> = OnceLock::new();

/// Store the update origin declared in `glyx.config.json`'s `updater` block.
/// Must be called once during startup. Subsequent calls are silently ignored.
pub fn init_update_origin(origin: UpdateOrigin) {
    let _ = UPDATE_ORIGIN.set(origin);
}

/// Returns the configured update origin, or `None` if `glyx.config.json` has
/// no `updater` block (or `init_update_origin` was never called).
pub fn update_origin() -> Option<&'static UpdateOrigin> {
    UPDATE_ORIGIN.get()
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
        assert!(caps.shell_exec.is_none());
        assert!(!caps.can_shell_run("git"));
        assert!(caps.shell_agent.is_none());
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
        // Empty name is never allowed, even under *.
        assert!(!caps.can_get_env(""));
    }

    #[test]
    fn env_wildcard_only_at_end() {
        // '*' anywhere but the end is treated as a literal character.
        let caps = parse(r#"{ "env": { "allow": ["MY_*_TOKEN"] } }"#);
        assert!(!caps.can_get_env("MY_APP_TOKEN"));
        assert!(caps.can_get_env("MY_*_TOKEN"));
    }

    // ── R6: Regression tests for security remediation ────────────────────────

    /// R6.1 — Symlink escape: a path that resolves outside the declared glob
    /// must be denied even if the original path string matched.
    #[test]
    fn symlink_escape_denied() {
        // We can't create real symlinks in a unit test portably, but we CAN
        // verify that a path which doesn't canonicalize (doesn't exist) is
        // rejected with a Canonicalize error, not silently allowed.
        //
        // Real symlink-escape tests live in tests/security_integration.rs
        // where we can create temp dirs and symlinks.
        let caps = parse(r#"{ "fs": { "read": ["/tmp/**"] } }"#);
        // Path that cannot be canonicalized (does not exist) → Canonicalize error.
        let result = resolve_and_check_read_with(
            std::path::Path::new("/tmp/nonexistent_glyx_test_path_xyzzy"),
            &caps,
        );
        assert!(result.is_err(), "non-existent path should be denied");
    }

    /// R6.2 — DB absolute path blocked without dbPath capability.
    #[test]
    fn db_absolute_path_blocked_without_cap() {
        let caps = parse(r#"{ "db": true }"#);
        assert!(!caps.db_path, "dbPath must require explicit opt-in");
    }

    /// R6.3 — per-app keychain namespace: can_ai_download false by default.
    #[test]
    fn ai_model_download_off_by_default() {
        let caps = parse(r#"{ "ai": true }"#);
        assert!(!caps.can_ai_download(), "aiModelDownload must default to false");
    }

    /// R6.4 — aiModelDownload opt-in works.
    #[test]
    fn ai_model_download_opt_in() {
        let caps = parse(r#"{ "ai": true, "aiModelDownload": true }"#);
        assert!(caps.can_ai_download());
    }

    /// R6.5 — NTFS ADS rejection (Windows only at runtime, but the variant
    /// exists on all platforms so we can test the match arm).
    #[test]
    fn ads_path_rejected_on_windows() {
        let caps = parse(r#"{ "fs": { "read": ["C:/Users/**"] } }"#);
        // On Windows this exercises the real guard; on other platforms the
        // cfg(target_os = "windows") block is a no-op but the test still runs.
        let result = resolve_and_check_read_with(
            std::path::Path::new("C:/Users/foo/file.txt:hidden"),
            &caps,
        );
        #[cfg(target_os = "windows")]
        assert!(matches!(result, Err(DenyReason::AlternateDataStream)),
            "ADS path must be denied on Windows");
        #[cfg(not(target_os = "windows"))]
        let _ = result; // no-op on non-Windows
    }

    /// R6.6 — empty env name always denied.
    #[test]
    fn empty_env_name_denied() {
        let caps = parse(r#"{ "env": { "allow": ["*"] } }"#);
        assert!(!caps.can_get_env(""), "empty env name must be denied even under '*'");
    }

    // ── Update origin ─────────────────────────────────────────────────────────

    #[test]
    fn update_origin_round_trips_through_init() {
        assert!(update_origin().is_none(), "should be unset before init in this test binary");
        init_update_origin(UpdateOrigin {
            owner: "acme-inc".into(), repo: "my-app".into(), bin_name: "my-app".into(),
        });
        let o = update_origin().expect("should be set after init");
        assert_eq!(o.owner, "acme-inc");
        assert_eq!(o.repo, "my-app");
        assert_eq!(o.bin_name, "my-app");
    }
}

// ── Test helpers (used by R6 tests, not exposed publicly) ────────────────────

/// Like `resolve_and_check_read` but accepts an explicit `Capabilities` value
/// rather than reading from the global store (which isn't set in unit tests).
#[cfg(test)]
fn resolve_and_check_read_with(path: &std::path::Path, caps: &Capabilities) -> Result<std::path::PathBuf, DenyReason> {
    if has_ads_component(path) {
        #[cfg(target_os = "windows")]
        return Err(DenyReason::AlternateDataStream);
    }
    let canonical = path.canonicalize().map_err(DenyReason::Canonicalize)?;
    let path_str = canonical.to_string_lossy();
    if caps.can_read_path(&path_str) {
        Ok(canonical)
    } else if caps.fs.is_none() {
        Err(DenyReason::CapabilityMissing)
    } else {
        Err(DenyReason::NotAllowed)
    }
}
