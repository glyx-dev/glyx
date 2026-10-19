//! glyx-runner — prebuilt runtime binary for Glyx apps.
//!
//! Loads `glyx.config.ts` / `glyx.config.json` from the current directory,
//! then starts the Glyx engine.  App developers run this binary directly via
//! `glyx dev` or `glyx build` — no Rust toolchain required on their machine.
//!
//! Compiled with `dev` feature (default): includes hot-reload + dev overlay.
//! Compiled without `dev` (--no-default-features): lean production binary.
//!
//! ## Binary trailer (snapshot mode, JS-only projects)
//!
//! `glyx build --mode snapshot` appends a payload to this binary instead of
//! recompiling it.  The footer (last 72 bytes) layout:
//!
//!   Offset  Size  Field
//!    0       8    snap_offset  u64 LE
//!    8       8    snap_len     u64 LE
//!   16       8    js_offset    u64 LE
//!   24       8    js_len       u64 LE
//!   32       8    cfg_offset   u64 LE
//!   40       8    cfg_len      u64 LE
//!   48       4    version      u32 LE  = 1
//!   52       4    flags        u32 LE  = 0
//!   56       4    crc32        u32 LE  CRC32 of snap+js+cfg bytes
//!   60       4    reserved     u32 LE  = 0
//!   64       8    magic        u64 LE  = b"GLYXTRL"
#![cfg_attr(all(target_os = "windows", not(debug_assertions)), windows_subsystem = "windows")]

use std::io::{Read, Seek, SeekFrom};

/// Magic marker: b"GLYXTRL" interpreted as little-endian u64.
const TRAILER_MAGIC: u64 = 0x4C52_5458_4F4C_4556;
/// Footer size in bytes (v1): 6×u64 + 4×u32 + 1×u64 = 72.
const FOOTER_SIZE: i64 = 72;

/// Footer `flags` bit 0: the JS section is `[u32 LE n][n bytes of the app compiled by this runner's engine][the source]`, not just the
/// source. The compiled part is QuickJS bytecode; the runtime falls back to the source if it rejects it.
const FLAG_PRECOMPILED_JS: u32 = 1;

struct TrailerPayload {
    snapshot:    Vec<u8>,
    js_src:      String,
    /// The app compiled for this engine, when the trailer carries it (see `FLAG_PRECOMPILED_JS`).
    js_compiled: Option<Vec<u8>>,
    config_json: String,
}

/// Try to read an embedded payload appended to this executable.
///
/// Returns `None` if no trailer is present (dev/bundle/portable mode),
/// or if the footer is corrupt / checksum fails.
fn read_trailer() -> Option<TrailerPayload> {
    let exe   = std::env::current_exe().ok()?;
    let mut f = std::fs::File::open(&exe).ok()?;
    let flen  = f.metadata().ok()?.len();

    if flen < FOOTER_SIZE as u64 { return None; }

    // Read only the footer — no need to load the entire binary into memory.
    f.seek(SeekFrom::End(-FOOTER_SIZE)).ok()?;
    let mut footer = [0u8; 72];
    f.read_exact(&mut footer).ok()?;

    // Validate magic (last 8 bytes of footer).
    let magic = u64::from_le_bytes(footer[64..72].try_into().ok()?);
    if magic != TRAILER_MAGIC { return None; }

    // Parse footer fields.
    let snap_off  = u64::from_le_bytes(footer[ 0.. 8].try_into().ok()?);
    let snap_len  = u64::from_le_bytes(footer[ 8..16].try_into().ok()?) as usize;
    let js_off    = u64::from_le_bytes(footer[16..24].try_into().ok()?);
    let js_len    = u64::from_le_bytes(footer[24..32].try_into().ok()?) as usize;
    let cfg_off   = u64::from_le_bytes(footer[32..40].try_into().ok()?);
    let cfg_len   = u64::from_le_bytes(footer[40..48].try_into().ok()?) as usize;
    let version   = u32::from_le_bytes(footer[48..52].try_into().ok()?);
    let flags      = u32::from_le_bytes(footer[52..56].try_into().ok()?);
    let stored_crc = u32::from_le_bytes(footer[56..60].try_into().ok()?);
    // reserved = footer[60..64] — ignored

    // Sanity: only version 1 understood.
    if version != 1 {
        eprintln!("[glyx] Unknown trailer version {version}; ignoring.");
        return None;
    }

    // Validate offsets don't exceed file size.
    let total_payload = snap_len.checked_add(js_len)?.checked_add(cfg_len)?;
    let expected_file_end = snap_off.checked_add(total_payload as u64)?
        .checked_add(FOOTER_SIZE as u64)?;
    if expected_file_end != flen { return None; }

    // Read payload sections by seeking to each offset.
    let mut snapshot = vec![0u8; snap_len];
    f.seek(SeekFrom::Start(snap_off)).ok()?;
    f.read_exact(&mut snapshot).ok()?;

    let mut js_bytes = vec![0u8; js_len];
    f.seek(SeekFrom::Start(js_off)).ok()?;
    f.read_exact(&mut js_bytes).ok()?;

    let mut cfg_bytes = vec![0u8; cfg_len];
    f.seek(SeekFrom::Start(cfg_off)).ok()?;
    f.read_exact(&mut cfg_bytes).ok()?;

    // Verify CRC32 of the entire payload.
    let mut digest = crc32fast::Hasher::new();
    digest.update(&snapshot);
    digest.update(&js_bytes);
    digest.update(&cfg_bytes);
    let computed_crc = digest.finalize();

    if computed_crc != stored_crc {
        eprintln!(
            "[glyx] Trailer CRC32 mismatch (stored={:#010x} computed={:#010x}); \
             the binary may be corrupt.",
            stored_crc, computed_crc
        );
        return None;
    }

    // With the precompiled flag the JS section is `[u32 n][compiled][source]`; a section that does not add up is as bad as a bad CRC.
    let (js_compiled, js_bytes) = if flags & FLAG_PRECOMPILED_JS != 0 {
        let n = u32::from_le_bytes(js_bytes.get(..4)?.try_into().ok()?) as usize;
        let compiled = js_bytes.get(4..4usize.checked_add(n)?)?.to_vec();
        (Some(compiled), js_bytes[4 + n..].to_vec())
    } else {
        (None, js_bytes)
    };

    let js_src      = String::from_utf8(js_bytes) .ok()?;
    let config_json = String::from_utf8(cfg_bytes).ok()?;

    Some(TrailerPayload { snapshot, js_src, js_compiled, config_json })
}

/// `~/.glyx/updates/<exe_stem>/pending.js`
fn pending_js_staging_path() -> Option<std::path::PathBuf> {
    let exe  = std::env::current_exe().ok()?;
    let stem = exe.file_stem()?.to_string_lossy().into_owned();
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME")).ok()?;
    Some(std::path::PathBuf::from(home)
        .join(".glyx").join("updates").join(stem).join("pending.js"))
}

/// Load and verify a staged JS update.
///
/// Reads `pending.js` and its `.sig` sidecar, verifies the Ed25519 signature
/// against the embedded `UPDATE_PUBKEY`, and returns the JS source on success.
///
/// On any failure (missing sig, bad sig, I/O error) both files are deleted
/// and `None` is returned so the normal embedded bundle is used instead.
/// A tampered or unsigned `pending.js` is never executed.
fn load_verified_pending_js() -> Option<String> {
    let js_path  = pending_js_staging_path()?;
    if !js_path.exists() { return None; }

    // Derive sig path: pending.js → pending.js.sig
    let mut sig_path = js_path.clone();
    sig_path.set_extension("js.sig");

    let cleanup = |reason: &str| {
        eprintln!("[glyx] pending.js rejected ({reason}) — deleting staged update.");
        let _ = std::fs::remove_file(&js_path);
        let _ = std::fs::remove_file(&sig_path);
    };

    // Sig file must exist.
    if !sig_path.exists() {
        cleanup("no .sig sidecar");
        return None;
    }

    // F3: verify_signed_file_bytes reads, verifies, and returns the same bytes
    // in one step — no second read, so there is no verify→execute TOCTOU window.
    match glyx_verify::verify_signed_file_bytes(&js_path, &sig_path, &glyx_verify::UPDATE_PUBKEY) {
        Ok(bytes) => {
            match String::from_utf8(bytes) {
                Ok(src) => {
                    eprintln!("[glyx] Applying verified pending JS update.");
                    Some(src)
                }
                Err(e) => {
                    cleanup(&format!("invalid UTF-8 in pending.js: {e}"));
                    None
                }
            }
        }
        Err(e) => {
            cleanup(&format!("signature invalid: {e}"));
            None
        }
    }
}

/// `glyx-runner --glyx-compile-js <app.js> <out> [<snapshot>]`: what `glyx build` runs to compile the app with the engine of the very runner it is
/// about to embed it in (QuickJS bytecode only loads into the build that wrote it). Exits 0 with `<out>` written; 2 when this engine
/// has no precompiled form; 1 on a compile error.
fn compile_js_mode() -> Option<i32> {
    let args: Vec<String> = std::env::args().collect();
    if args.get(1).map(String::as_str) != Some("--glyx-compile-js") { return None; }
    let (Some(input), Some(output)) = (args.get(2), args.get(3)) else {
        eprintln!("usage: glyx-runner --glyx-compile-js <app.js> <out>");
        return Some(1);
    };
    let source = match std::fs::read_to_string(input) {
        Ok(s) => s,
        Err(e) => { eprintln!("cannot read {input}: {e}"); return Some(1); }
    };
    // V8 compiles against the snapshot the app will run on (QuickJS has none).
    let snapshot = args.get(4).and_then(|p| std::fs::read(p).ok());
    Some(match glyx_core::compile_app_js(&source, snapshot.as_deref()) {
        None => 2,
        Some(Err(e)) => { eprintln!("{e}"); 1 }
        Some(Ok(bytes)) => match std::fs::write(output, bytes) {
            Ok(()) => 0,
            Err(e) => { eprintln!("cannot write {output}: {e}"); 1 }
        },
    })
}

fn main() {
    if let Some(code) = compile_js_mode() { std::process::exit(code); }
    glyx_core::startup_mark("runner: main");
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp(None)
        .format_module_path(false)
        .filter_module("wgpu_core", log::LevelFilter::Warn)
        .filter_module("wgpu_hal",  log::LevelFilter::Warn)
        .filter_module("naga",      log::LevelFilter::Warn)
        .init();

    // Check for a staged JS-only update before loading the normal bundle.
    // The update is only applied if its Ed25519 signature (written alongside
    // by updater_download_js) verifies against the embedded UPDATE_PUBKEY.
    // A missing or invalid sig deletes both files and falls back to the
    // embedded bundle — a tampered pending.js is never executed.
    glyx_core::startup_mark("runner: logger ready");
    let pending_js = load_verified_pending_js();
    glyx_core::startup_mark("runner: pending update checked");

    let mut config = if let Some(payload) = read_trailer() {
        glyx_core::startup_mark("runner: trailer read");
        eprintln!("[glyx] Loading app from embedded binary trailer.");
        glyx_core::AppConfig::from_trailer(payload.snapshot, payload.js_src, payload.js_compiled, &payload.config_json)
    } else {
        glyx_core::AppConfig::from_config()
    };

    if let Some(js) = pending_js {
        eprintln!("[glyx] Applying pending JS update.");
        config.js_src = Some(js);
    }

    glyx_core::startup_mark("runner: config ready");
    let restart = glyx_core::run(config);

    if restart {
        // Re-launch this executable with the same arguments.
        // The current process exits immediately after spawning the child.
        match std::env::current_exe() {
            Ok(exe) => {
                let args: Vec<String> = std::env::args().skip(1).collect();
                if let Err(e) = std::process::Command::new(&exe).args(&args).spawn() {
                    eprintln!("[glyx] restart failed: {e}");
                }
            }
            Err(e) => eprintln!("[glyx] restart: could not get current exe: {e}"),
        }
    }
}
