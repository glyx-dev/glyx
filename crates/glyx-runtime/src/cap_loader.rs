//! Capability module loader.
//!
//! Resolves the five optional capabilities (audio, AI, camera, gamepad, HID)
//! in priority order:
//!
//! 1. **Static** — compiled in via Cargo feature flags (e.g. `--features audio`).
//!    The static implementations are plain Rust structs that satisfy the same
//!    `glyx_cap_abi::*Cap` vtable shapes, so the dispatch path is identical.
//!
//! 2. **Dynamic** — a `glyx_cap_<name>.dll`/`.so`/`.dylib` present next to the
//!    executable at runtime.  Loaded via `libloading`.  The DLL must export the
//!    well-known symbol defined in `glyx_cap_abi::SYM_*` and return a pointer to
//!    a vtable whose `version` field is within `[ABI_VERSION_MIN, ABI_VERSION]`.
//!
//! 3. **Absent** — `CapSet` field is `None`; bindings return safe stub responses.
//!
//! The loader runs once at startup (called from `GlyxRuntime::new`).  The
//! resulting `CapSet` is immutable for the lifetime of the process.

use std::collections::HashMap;
use sha2::{Sha256, Digest};
use serde_json::Value;
use glyx_cap_abi::{
    ABI_VERSION, ABI_VERSION_MIN,
    AudioCap, AiCap, CameraCap, GamepadCap, HidCap,
    SYM_AUDIO, SYM_AI, SYM_CAMERA, SYM_GAMEPAD, SYM_HID,
    CapSet,
};

// ── Hash verification ─────────────────────────────────────────────────────────

/// Compute the lowercase hex SHA-256 of a file.
fn sha256_file(path: &std::path::Path) -> Option<String> {
    let bytes = std::fs::read(path).ok()?;
    let hash = Sha256::digest(&bytes);
    Some(format!("{hash:x}"))
}

/// Verify the file at `path` against `expected` (lowercase hex).
/// Returns `true` if the hashes match, `false` with a warning otherwise.
fn verify_hash(path: &std::path::Path, cap_name: &str, expected: &str) -> bool {
    match sha256_file(path) {
        None => {
            log::warn!("[cap] Could not read {:?} for hash verification", path);
            false
        }
        Some(actual) if actual != expected.to_lowercase() => {
            log::error!(
                "[cap] SHA-256 mismatch for capability '{cap_name}' — \
                 expected {expected}, got {actual}. Refusing to load."
            );
            false
        }
        Some(_) => true,
    }
}

// ── Loader ────────────────────────────────────────────────────────────────────

/// Try to load a capability DLL next to the running executable.
///
/// - If `expected_hash` is `Some`, the file's SHA-256 must match before loading.
/// - If `expected_hash` is `None`, the file loads unchecked (a warning is
///   logged in non-debug builds so developers know to pin the hash).
///
/// Returns `Some(&'static Cap)` if the DLL is present and its ABI version is
/// compatible; logs a warning and returns `None` otherwise.
///
/// # Safety
/// The loaded library is intentionally leaked so the vtable pointer is
/// `'static`.  Safe because capability DLLs are never unloaded.
#[allow(dead_code)]
unsafe fn try_load_dynamic<Cap>(
    cap_name: &str,
    lib_stem: &str,
    symbol: &[u8],
    expected_hash: Option<&str>,
) -> Option<&'static Cap> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;

    let ext = if cfg!(target_os = "windows") { ".dll" }
              else if cfg!(target_os = "macos") { ".dylib" }
              else { ".so" };

    let path = dir.join(format!("{lib_stem}{ext}"));
    if !path.exists() { return None; }

    // ── Hash verification ────────────────────────────────────────────────────
    match expected_hash {
        Some(hash) => {
            if !verify_hash(&path, cap_name, hash) {
                return None;
            }
        }
        None => {
            // No hash declared — allow but warn in release builds so
            // developers are reminded to pin the hash before shipping.
            #[cfg(not(debug_assertions))]
            log::warn!(
                "[cap] No SHA-256 hash declared for capability '{cap_name}'. \
                 Set cap_hashes[\"{cap_name}\"] in glyx.config.json before shipping."
            );
        }
    }

    let lib = match libloading::Library::new(&path) {
        Ok(l)  => l,
        Err(e) => { log::warn!("[cap] Failed to load {:?}: {e}", path); return None; }
    };

    // Resolve the init symbol as a raw function pointer (Copy) so we can
    // drop the Symbol before forgetting the Library — the borrow ends here.
    type InitFn<T> = unsafe extern "C" fn() -> *const T;
    let init_fn: InitFn<Cap> = {
        let sym: libloading::Symbol<InitFn<Cap>> = match lib.get(symbol) {
            Ok(s)  => s,
            Err(e) => { log::warn!("[cap] Symbol missing in {:?}: {e}", path); return None; }
        };
        *sym
    }; // Symbol dropped here — borrow on `lib` ends.

    // Forget the Library to keep the DLL loaded for the process lifetime.
    std::mem::forget(lib);

    let cap_ptr: *const Cap = init_fn();
    if cap_ptr.is_null() {
        log::warn!("[cap] {:?} init returned null", path);
        return None;
    }

    // Read version field (always first u32 in every vtable).
    let version = *(cap_ptr as *const u32);
    if version < ABI_VERSION_MIN || version > ABI_VERSION {
        log::warn!(
            "[cap] {:?} ABI version {version} outside [{ABI_VERSION_MIN}, {ABI_VERSION}]",
            path
        );
        return None;
    }

    log::info!("[cap] Loaded dynamic capability '{cap_name}' from {:?}", path);
    Some(&*cap_ptr)
}

/// Load pinned hashes from `glyx-caps.lock` next to the executable.
///
/// The lock file is generated automatically by `glyx package`. Its absence is
/// fine in dev mode; in release builds the loader warns per-module if a hash
/// is missing.
fn load_lock_file() -> HashMap<String, String> {
    let Ok(exe) = std::env::current_exe() else { return HashMap::new() };
    let Some(dir) = exe.parent() else { return HashMap::new() };
    let lock_path = dir.join("glyx-caps.lock");
    let Ok(contents) = std::fs::read_to_string(&lock_path) else { return HashMap::new() };
    let Ok(Value::Object(map)) = serde_json::from_str::<Value>(&contents) else {
        log::warn!("[cap] glyx-caps.lock is malformed — ignoring");
        return HashMap::new();
    };
    map.into_iter()
        .filter_map(|(k, v)| v.as_str().map(|s| (k, s.to_string())))
        .collect()
}

/// Resolve all capabilities and return a `CapSet`.
///
/// Hashes are read automatically from `glyx-caps.lock` (generated by
/// `glyx package`) — no manual configuration required.
///
/// Called once at process startup.  The static implementation (if compiled in)
/// takes precedence over any dynamic DLL for the same capability.
pub fn load_caps() -> CapSet {
    let hashes = load_lock_file();
    CapSet {
        audio:   load_audio(hashes.get("audio").map(String::as_str)),
        ai:      load_ai(hashes.get("ai").map(String::as_str)),
        camera:  load_camera(hashes.get("camera").map(String::as_str)),
        gamepad: load_gamepad(hashes.get("gamepad").map(String::as_str)),
        hid:     load_hid(hashes.get("hid").map(String::as_str)),
    }
}

// ── Per-capability loaders ────────────────────────────────────────────────────

fn load_audio(hash: Option<&str>) -> Option<&'static AudioCap> {
    #[cfg(feature = "audio")]
    { let _ = hash; return None; } // static path active
    #[cfg(not(feature = "audio"))]
    unsafe { try_load_dynamic::<AudioCap>("audio", "glyx_cap_audio", SYM_AUDIO, hash) }
}

fn load_ai(hash: Option<&str>) -> Option<&'static AiCap> {
    #[cfg(feature = "ai")]
    { let _ = hash; return None; }
    #[cfg(not(feature = "ai"))]
    unsafe { try_load_dynamic::<AiCap>("ai", "glyx_cap_ai", SYM_AI, hash) }
}

fn load_camera(hash: Option<&str>) -> Option<&'static CameraCap> {
    unsafe { try_load_dynamic::<CameraCap>("camera", "glyx_cap_camera", SYM_CAMERA, hash) }
}

fn load_gamepad(hash: Option<&str>) -> Option<&'static GamepadCap> {
    #[cfg(feature = "gamepad")]
    { let _ = hash; return None; }
    #[cfg(not(feature = "gamepad"))]
    unsafe { try_load_dynamic::<GamepadCap>("gamepad", "glyx_cap_gamepad", SYM_GAMEPAD, hash) }
}

fn load_hid(hash: Option<&str>) -> Option<&'static HidCap> {
    #[cfg(feature = "hid")]
    { let _ = hash; return None; }
    #[cfg(not(feature = "hid"))]
    unsafe { try_load_dynamic::<HidCap>("hid", "glyx_cap_hid", SYM_HID, hash) }
}
