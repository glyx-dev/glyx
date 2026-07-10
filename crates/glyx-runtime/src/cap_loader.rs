//! Capability module loader.
//!
//! Resolves the five optional capabilities (audio, AI, camera, gamepad, HID)
//! in priority order:
//!
//! 1. **Static** -- compiled in via Cargo feature flags (e.g. `--features audio`).
//!    The static implementations are plain Rust structs that satisfy the same
//!    `glyx_cap_abi::*Cap` vtable shapes, so the dispatch path is identical.
//!
//! 2. **Dynamic** -- a `glyx_cap_<name>.dll`/`.so`/`.dylib` present next to the
//!    executable at runtime.  Loaded via `libloading`.  The DLL must export the
//!    well-known symbol defined in `glyx_cap_abi::SYM_*` and return a pointer to
//!    a vtable whose `version` field is within `[ABI_VERSION_MIN, ABI_VERSION]`.
//!
//! 3. **Absent** -- `CapSet` field is `None`; bindings return safe stub responses.
//!
//! The loader runs once at startup (called from `GlyxRuntime::new`).  The
//! resulting `CapSet` is immutable for the lifetime of the process.

#[allow(unused_imports)]
use glyx_cap_abi::{
    ABI_VERSION, ABI_VERSION_MIN,
    AudioCap, AiCap, CameraCap, GamepadCap, HidCap,
    SYM_AUDIO, SYM_AI, SYM_CAMERA, SYM_GAMEPAD, SYM_HID,
    CapSet,
};

// ── 0.4: Windows safe DLL load hardening ─────────────────────────────────────

/// Call once at process startup before any `Library::new`.
///
/// On Windows:
/// - `SetDllDirectoryW("")` removes the current working directory from the
///   DLL search path, preventing CWD-based DLL planting.
/// - Subsequent `load_dll` calls use `LOAD_LIBRARY_SEARCH_APPLICATION_DIR |
///   LOAD_LIBRARY_SEARCH_SYSTEM32` so only the exe directory and System32
///   are searched -- not CWD, PATH, or user-writable locations.
///
/// No-op on non-Windows platforms (system linker controls search paths).
pub fn harden_dll_search() {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::LibraryLoader::SetDllDirectoryW;
        // Passing an empty string (not NULL) removes CWD from the search path
        // without clearing the entire set.
        let empty: Vec<u16> = vec![0u16]; // null-terminated empty string
        unsafe { SetDllDirectoryW(empty.as_ptr()); }
        log::debug!("[cap] DLL search path hardened (CWD removed)");
    }
}

/// Load a DLL using safe search flags so only the application directory
/// and System32 are searched.  Falls back to standard `Library::new` on
/// non-Windows where the linker controls search order.
#[allow(dead_code)]
unsafe fn load_dll(path: &std::path::Path) -> Result<libloading::Library, libloading::Error> {
    #[cfg(target_os = "windows")]
    {
        use windows_sys::Win32::System::LibraryLoader::{
            LoadLibraryExW, LOAD_LIBRARY_SEARCH_APPLICATION_DIR,
            LOAD_LIBRARY_SEARCH_SYSTEM32,
        };
        use std::os::windows::ffi::OsStrExt;

        let wide: Vec<u16> = path.as_os_str()
            .encode_wide()
            .chain(std::iter::once(0))
            .collect();
        let flags = LOAD_LIBRARY_SEARCH_APPLICATION_DIR | LOAD_LIBRARY_SEARCH_SYSTEM32;
        let handle = LoadLibraryExW(wide.as_ptr(), std::ptr::null_mut(), flags);
        if handle.is_null() {
            // LoadLibraryExW failed -- let libloading surface the OS error.
            return libloading::Library::new(path);
        }
        // Wrap the HMODULE in a libloading::os::windows::Library then convert.
        let os_lib = libloading::os::windows::Library::from_raw(handle as _);
        Ok(libloading::Library::from(os_lib))
    }
    #[cfg(not(target_os = "windows"))]
    {
        libloading::Library::new(path)
    }
}

// ── H5: Ed25519 cap DLL verification ─────────────────────────────────────────

/// Returns `true` if DLL signature verification should be skipped.
///
/// Only possible in debug builds and only when `GLYX_UNSAFE_SKIP_CAP_VERIFY=1`
/// is set.  The env-var branch is compiled out entirely in release so the
/// escape hatch cannot be triggered by an attacker at runtime.
fn skip_cap_verify() -> bool {
    #[cfg(debug_assertions)]
    {
        if std::env::var("GLYX_UNSAFE_SKIP_CAP_VERIFY").as_deref() == Ok("1") {
            log::warn!("[cap] GLYX_UNSAFE_SKIP_CAP_VERIFY=1 -- Ed25519 check bypassed (dev only)");
            return true;
        }
    }
    false
}

/// Verify the Ed25519 `.sig` sidecar for a cap DLL.
///
/// The sidecar must be at `{dll_path}.sig` (64 raw bytes).
/// The signature is over the raw DLL bytes, signed with the cap private key
/// whose public counterpart is compiled into `glyx-verify::CAP_PUBKEY`.
///
/// In release builds a missing or invalid sidecar is a hard failure.
/// In debug builds with `GLYX_UNSAFE_SKIP_CAP_VERIFY=1` the check is skipped.
fn verify_cap_sig(dll_path: &std::path::Path, cap_name: &str) -> bool {
    if skip_cap_verify() {
        return true;
    }
    let sig_path = dll_path.with_extension({
        let ext = dll_path.extension()
            .map(|e| format!("{}.sig", e.to_string_lossy()))
            .unwrap_or_else(|| "sig".to_string());
        ext
    });
    if !sig_path.exists() {
        log::error!(
            "[cap] No Ed25519 signature for capability '{cap_name}' at {:?}. \
             Run `glyx caps sign` in CI to generate {}.sig -- refusing to load.",
            dll_path, dll_path.display()
        );
        return false;
    }
    match glyx_verify::verify_signed_file(dll_path, &sig_path, &glyx_verify::CAP_PUBKEY) {
        Ok(()) => {
            log::debug!("[cap] Ed25519 OK for '{cap_name}'");
            true
        }
        Err(e) => {
            log::error!(
                "[cap] Ed25519 verification FAILED for capability '{cap_name}': {e}. \
                 Refusing to load {:?}.",
                dll_path
            );
            false
        }
    }
}

// ── Loader ────────────────────────────────────────────────────────────────────

/// Try to load a capability DLL next to the running executable.
///
/// Before loading, the DLL must have a valid Ed25519 `.sig` sidecar signed
/// with the cap private key (embedded public key in `glyx-verify::CAP_PUBKEY`).
/// In release builds a missing or invalid signature is a hard failure.
///
/// Returns `Some(&'static Cap)` if the DLL is present, verified, and its ABI
/// version is compatible; logs a warning and returns `None` otherwise.
///
/// # Safety
/// The loaded library is intentionally leaked so the vtable pointer is
/// `'static`.  Safe because capability DLLs are never unloaded.
#[allow(dead_code)]
unsafe fn try_load_dynamic<Cap>(
    cap_name: &str,
    lib_stem: &str,
    symbol: &[u8],
) -> Option<&'static Cap> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;

    let ext = if cfg!(target_os = "windows") { ".dll" }
              else if cfg!(target_os = "macos") { ".dylib" }
              else { ".so" };

    let path = dir.join(format!("{lib_stem}{ext}"));
    if !path.exists() { return None; }

    // ── H5: Ed25519 signature verification ──────────────────────────────────
    if !verify_cap_sig(&path, cap_name) {
        return None;
    }

    let lib = match load_dll(&path) {
        Ok(l)  => l,
        Err(e) => { log::warn!("[cap] Failed to load {:?}: {e}", path); return None; }
    };

    // Resolve the init symbol as a raw function pointer (Copy) so we can
    // drop the Symbol before forgetting the Library -- the borrow ends here.
    type InitFn<T> = unsafe extern "C" fn() -> *const T;
    let init_fn: InitFn<Cap> = {
        let sym: libloading::Symbol<InitFn<Cap>> = match lib.get(symbol) {
            Ok(s)  => s,
            Err(e) => { log::warn!("[cap] Symbol missing in {:?}: {e}", path); return None; }
        };
        *sym
    }; // Symbol dropped here -- borrow on `lib` ends.

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

/// Resolve all capabilities and return a `CapSet`.
///
/// Each dynamic DLL is verified via Ed25519 `.sig` sidecar before loading.
/// Called once at process startup.  Static (compiled-in) capabilities skip
/// the DLL load and signature check entirely.
pub fn load_caps() -> CapSet {
    harden_dll_search();
    CapSet {
        audio:   load_audio(),
        ai:      load_ai(),
        camera:  load_camera(),
        gamepad: load_gamepad(),
        hid:     load_hid(),
    }
}

// ── Per-capability loaders ────────────────────────────────────────────────────

fn load_audio() -> Option<&'static AudioCap> {
    #[cfg(feature = "audio")]
    { return Some(glyx_cap_audio::static_cap()); }
    #[cfg(not(feature = "audio"))]
    unsafe { try_load_dynamic::<AudioCap>("audio", "glyx_cap_audio", SYM_AUDIO) }
}

fn load_ai() -> Option<&'static AiCap> {
    #[cfg(feature = "ai")]
    { return Some(glyx_cap_ai::static_cap()); }
    #[cfg(not(feature = "ai"))]
    unsafe { try_load_dynamic::<AiCap>("ai", "glyx_cap_ai", SYM_AI) }
}

fn load_camera() -> Option<&'static CameraCap> {
    #[cfg(feature = "camera")]
    { return Some(glyx_cap_camera::static_cap()); }
    #[cfg(not(feature = "camera"))]
    unsafe { try_load_dynamic::<CameraCap>("camera", "glyx_cap_camera", SYM_CAMERA) }
}

fn load_gamepad() -> Option<&'static GamepadCap> {
    #[cfg(feature = "gamepad")]
    { return Some(glyx_cap_gamepad::static_cap()); }
    #[cfg(not(feature = "gamepad"))]
    unsafe { try_load_dynamic::<GamepadCap>("gamepad", "glyx_cap_gamepad", SYM_GAMEPAD) }
}

fn load_hid() -> Option<&'static HidCap> {
    #[cfg(feature = "hid")]
    { return Some(glyx_cap_hid::static_cap()); }
    #[cfg(not(feature = "hid"))]
    unsafe { try_load_dynamic::<HidCap>("hid", "glyx_cap_hid", SYM_HID) }
}

