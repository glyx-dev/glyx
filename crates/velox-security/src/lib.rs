//! velox-security — Capability enforcement for Velox apps.
//!
//! Capabilities are declared in `velox.config.json` and locked into a
//! process-wide `OnceLock` at startup before any JS bindings execute.
//!
//! Every guarded binding calls `velox_security::get()` and checks the relevant
//! helper — if the capability is absent it throws a JS Error explaining exactly
//! which capability to add to the config.
//!
//! ## Security model
//!
//! Velox apps bundle developer-owned JS (not arbitrary web content), so the
//! right model is Android/iOS-style capability declaration rather than Electron-
//! style process isolation.  The Rust binding layer is the enforcement point —
//! JS cannot bypass it regardless of what npm packages are installed.

use std::sync::OnceLock;

use serde::Deserialize;

// ── Capability definitions ────────────────────────────────────────────────────

/// File-system access declarations.
#[derive(Debug, Deserialize, Clone, Default)]
pub struct FsCapability {
    /// Glob patterns the app may read. `None` = no read access.
    pub read:  Option<Vec<String>>,
    /// Glob patterns the app may write. `None` = no write access.
    pub write: Option<Vec<String>>,
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

/// The full capability set for one Velox application.
///
/// Deserialises from the `"capabilities"` key in `velox.config.json`.
#[derive(Debug, Deserialize, Clone, Default)]
pub struct Capabilities {
    pub fs:      Option<FsCapability>,
    pub network: Option<NetworkCapability>,
    pub env:     Option<EnvCapability>,
    #[serde(default)]
    pub db:      bool,
    #[serde(default)]
    pub battery: bool,
    #[serde(default)]
    pub usb:     bool,
    #[serde(default)]
    pub shell:   bool,
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

    /// True if `host` is in the network allowlist, or `"*"` is listed.
    pub fn can_network(&self, host: &str) -> bool {
        self.network
            .as_ref()
            .map(|n| n.allow.iter().any(|h| h == "*" || h == host))
            .unwrap_or(false)
    }

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

/// Lock in the capability set from the parsed config.
///
/// Must be called once during startup before any JS bindings execute.
/// Subsequent calls (e.g. accidental double-init) are silently ignored.
pub fn init(caps: Capabilities) {
    if CAPS.set(caps).is_err() {
        log::warn!("velox-security: init() called more than once — ignored");
    }
}

/// Returns the active capability set for this process.
///
/// If `init()` has not been called, returns a zero-permission default so
/// that unconfigured apps fail closed rather than open.
pub fn get() -> &'static Capabilities {
    CAPS.get_or_init(Capabilities::default)
}
