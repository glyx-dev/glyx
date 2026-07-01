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

struct TrailerPayload {
    snapshot:    Vec<u8>,
    js_src:      String,
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
    // flags   = u32::from_le_bytes(footer[52..56]) — reserved, ignored for now
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

    let js_src      = String::from_utf8(js_bytes) .ok()?;
    let config_json = String::from_utf8(cfg_bytes).ok()?;

    Some(TrailerPayload { snapshot, js_src, config_json })
}

/// Returns the path where a pending JS-only update is staged.
/// Mirrors the helper in `glyx-runtime` — must stay in sync.
fn pending_js_staging_path() -> Option<std::path::PathBuf> {
    let exe  = std::env::current_exe().ok()?;
    let stem = exe.file_stem()?.to_string_lossy().into_owned();
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME")).ok()?;
    Some(std::path::PathBuf::from(home)
        .join(".glyx").join("updates").join(stem).join("pending.js"))
}

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp(None)
        .format_module_path(false)
        .init();

    // Check for a staged JS-only update before loading the normal bundle.
    let pending_js = pending_js_staging_path()
        .filter(|p| p.exists())
        .and_then(|p| std::fs::read_to_string(&p).ok());

    let mut config = if let Some(payload) = read_trailer() {
        eprintln!("[glyx] Loading app from embedded binary trailer.");
        glyx_core::AppConfig::from_trailer(payload.snapshot, payload.js_src, &payload.config_json)
    } else {
        glyx_core::AppConfig::from_config()
    };

    if let Some(js) = pending_js {
        eprintln!("[glyx] Applying pending JS update.");
        config.js_src = Some(js);
    }

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
