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

use glyx_cap_abi::{
    ABI_VERSION, ABI_VERSION_MIN,
    AudioCap, AiCap, CameraCap, GamepadCap, HidCap,
    SYM_AUDIO, SYM_AI, SYM_CAMERA, SYM_GAMEPAD, SYM_HID,
    CapSet,
};

// ── Loader ────────────────────────────────────────────────────────────────────

/// Try to load a capability DLL next to the running executable.
///
/// Returns `Some(&'static Cap)` if the DLL is present and its ABI version is
/// compatible; logs a warning and returns `None` otherwise.
///
/// # Safety
/// The loaded library is intentionally leaked so the vtable pointer is
/// `'static`.  Safe because capability DLLs are never unloaded.
#[allow(dead_code)]
unsafe fn try_load_dynamic<Cap>(lib_stem: &str, symbol: &[u8]) -> Option<&'static Cap> {
    let exe = std::env::current_exe().ok()?;
    let dir = exe.parent()?;

    let ext = if cfg!(target_os = "windows") { ".dll" }
              else if cfg!(target_os = "macos") { ".dylib" }
              else { ".so" };

    let path = dir.join(format!("{lib_stem}{ext}"));
    if !path.exists() { return None; }

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
        // Copy the fn pointer out of the Symbol (fn ptrs are Copy).
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

    log::info!("[cap] Loaded dynamic capability from {:?}", path);
    Some(&*cap_ptr)
}

/// Resolve all capabilities and return a `CapSet`.
///
/// Called once at process startup.  For each capability the static
/// implementation (if compiled in) takes precedence over the dynamic DLL.
pub fn load_caps() -> CapSet {
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
    // Static implementation lives in bindings.rs (#[cfg(feature="audio")]).
    // When not compiled in, try to load a dynamic module.
    #[cfg(feature = "audio")]
    { return None; } // static path active; no vtable routing yet (Phase 2)
    #[cfg(not(feature = "audio"))]
    unsafe { try_load_dynamic::<AudioCap>("glyx_cap_audio", SYM_AUDIO) }
}

fn load_ai() -> Option<&'static AiCap> {
    #[cfg(feature = "ai")]
    { return None; }
    #[cfg(not(feature = "ai"))]
    unsafe { try_load_dynamic::<AiCap>("glyx_cap_ai", SYM_AI) }
}

fn load_camera() -> Option<&'static CameraCap> {
    // No static camera feature yet — always try dynamic.
    unsafe { try_load_dynamic::<CameraCap>("glyx_cap_camera", SYM_CAMERA) }
}

fn load_gamepad() -> Option<&'static GamepadCap> {
    #[cfg(feature = "gamepad")]
    { return None; }
    #[cfg(not(feature = "gamepad"))]
    unsafe { try_load_dynamic::<GamepadCap>("glyx_cap_gamepad", SYM_GAMEPAD) }
}

fn load_hid() -> Option<&'static HidCap> {
    #[cfg(feature = "hid")]
    { return None; }
    #[cfg(not(feature = "hid"))]
    unsafe { try_load_dynamic::<HidCap>("glyx_cap_hid", SYM_HID) }
}
