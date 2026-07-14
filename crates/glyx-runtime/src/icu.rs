//! ICU integration for v8 150 (ICU 77).
//!
//! v8 needs ICU data loaded **once, before `v8::V8::initialize()`**. We call
//! [`init`] from [`crate::init_v8`].
//!
//! Data source precedence:
//!   1. External file — `$GLYX_ICU_DATA`, else `icudtl.dat` next to the exe.
//!      This lets `glyx build` / `glyx package` ship a *trimmed* dataset
//!      (only the app's declared locales) so packaged apps stay light.
//!   2. Embedded `icudtl.dat` — only when the `embed-icu` feature is on
//!      (default for tests/dev; OFF for app builds via `glyx-core`).
//!
//! See `glyx-icu-integration.md` for the trimming design.

use std::sync::Once;

#[cfg(feature = "embed-icu")]
const ICU_DATA: &[u8] = include_bytes!("../icudtl.dat");

/// Load ICU data from an external file if present.
///
/// Returns owned bytes that the caller must keep alive for the whole process
/// (v8 keeps a pointer into them), so we `.leak()` them.
fn load_external_icu() -> Option<&'static [u8]> {
    let mut candidates: Vec<std::path::PathBuf> = Vec::new();
    if let Ok(p) = std::env::var("GLYX_ICU_DATA") {
        candidates.push(std::path::PathBuf::from(p));
    }
    if let Ok(exe) = std::env::current_exe() {
        if let Some(dir) = exe.parent() {
            candidates.push(dir.join("icudtl.dat"));
        }
    }

    for p in &candidates {
        match std::fs::read(p) {
            Ok(bytes) => {
                log::debug!("ICU: loaded external data from {}", p.display());
                // Leak: v8 reads this for the process lifetime.
                return Some(bytes.leak());
            }
            Err(ref e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => log::warn!("ICU: could not read {}: {e}", p.display()),
        }
    }
    None
}

/// Initialize ICU data. Safe to call multiple times — runs at most once.
pub fn init() {
    static ONCE: Once = Once::new();
    ONCE.call_once(|| {
        if let Some(bytes) = load_external_icu() {
            if v8::icu::set_common_data_77(bytes).is_ok() {
                return;
            }
            log::warn!("ICU: external data rejected by v8; falling back");
        }

        #[cfg(feature = "embed-icu")]
        {
            if v8::icu::set_common_data_77(ICU_DATA).is_ok() {
                return;
            }
        }

        log::warn!(
            "ICU data not loaded — Intl.* / toLocaleString() will be unavailable. \
             Ship icudtl.dat next to the executable or enable the `embed-icu` feature."
        );
    });
}

/// Set the default ICU locale used by `Intl.*` / `toLocaleString()` when no
/// locale is given explicitly. Driven by the app config's `locales` list.
pub fn set_default_locale(locale: &str) {
    if !locale.is_empty() {
        v8::icu::set_default_locale(locale);
    }
}
