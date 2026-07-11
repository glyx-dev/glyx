use anyhow::{bail, Context, Result};
use std::path::{Path, PathBuf};
use std::process::Command;

use super::{
    read_project_name, read_dev_config, is_native_project,
    build_app_bundle, resolve_config_json, platform_to_rust_target,
    ensure_rust_target, binary_name, find_or_build_runner,
    glyx_home, pm,
};

pub(super) fn cmd_build(
    target: Option<&str>,
    mode: &str,
    check_performance: bool,
    perf_budget: f64,
    perf_duration: u64,
    p: pm::Pm,
) -> Result<()> {
    let project_name = read_project_name()
        .context("Run `glyx build` from the project root (where glyx.config.ts or package.json lives)")?;

    let bin_path = match mode {
        "snapshot" => build_snapshot_mode(target, &project_name, p)?,
        "bundle"   => build_bundle_mode(target, &project_name, p)?,
        "portable" => build_portable_mode(target, &project_name, p)?,
        other => bail!("Unknown build mode '{other}'. Use: snapshot, bundle, portable"),
    };

    if check_performance {
        if let Some(bin) = &bin_path {
            run_perf_check(bin, perf_budget, perf_duration)?;
        } else {
            log::warn!("--check-performance: no binary path available, skipping");
        }
    }

    Ok(())
}

/// Launch the built binary with GLYX_PERF_CHECK, capture stdout, and report results.
pub(super) fn run_perf_check(bin: &Path, budget_ms: f64, duration_secs: u64) -> Result<()> {
    println!();
    println!("Running performance check ({duration_secs}s at {budget_ms}ms budget)...");
    let config_json = super::resolve_config_json().unwrap_or_default();
    let output = Command::new(bin)
        .env("GLYX_PERF_CHECK", format!("{duration_secs}:{budget_ms}"))
        .env("GLYX_CONFIG_JSON", &config_json)
        .output()
        .with_context(|| format!("Failed to launch {}", bin.display()))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let result_line = stdout.lines()
        .find(|l| l.starts_with("GLYX_PERF_RESULT:"))
        .map(|l| l.trim_start_matches("GLYX_PERF_RESULT:").trim());

    if let Some(json) = result_line {
        let v: serde_json::Value = serde_json::from_str(json).unwrap_or_default();
        let violations  = v["violations"].as_u64().unwrap_or(0);
        let avg_ms      = v["avgFrameMs"].as_f64().unwrap_or(0.0);
        let p99_ms      = v["p99FrameMs"].as_f64().unwrap_or(0.0);
        let fps         = v["fps"].as_f64().unwrap_or(0.0);
        println!("  FPS: {fps:.0}  avg: {avg_ms:.1}ms  P99: {p99_ms:.1}ms  violations: {violations}");
        if violations > 0 || !output.status.success() {
            println!("✗ Performance check FAILED — {violations} budget violation(s)");
            std::process::exit(1);
        } else {
            println!("✓ Performance check PASSED");
        }
    } else if !output.status.success() {
        println!("✗ Performance check: app exited with error");
        std::process::exit(1);
    } else {
        println!("⚠ Performance check: no result data (app did not emit GLYX_PERF_RESULT)");
    }
    Ok(())
}

/// snapshot mode — self-contained exe with embedded V8 snapshot + embedded app JS.
///
/// For native projects: `cargo build --release -p <project_name>`
/// For JS-only projects: `cargo build --release --no-default-features -p glyx-runner`
///                        then rename the output binary to <project_name>[.exe]
pub(super) fn build_snapshot_mode(target: Option<&str>, project_name: &str, p: pm::Pm) -> Result<Option<PathBuf>> {
    println!("[snapshot mode] JS bundle → V8 snapshot + embedded app.js → self-contained binary");

    let Some((entry, output)) = read_dev_config() else {
        println!("⚠ No dev.entry in glyx config — falling back to portable mode");
        return build_portable_mode(target, project_name, p);
    };

    // 1. Build the app bundle (embedded in binary, eval'd at runtime)
    println!("Bundling JS: {} → {}", entry, output);
    pm::js_bundle(p, &entry, &output, /*minify=*/false, /*source_map=*/true)
        .context("JS build failed")?;
    println!("✓ JS bundled (dev output)");
    let bundle = build_app_bundle(project_name, &entry, p).context("app bundle build failed")?;
    println!("✓ App bundle: {} ({} KB)", bundle.display(), std::fs::metadata(&bundle)?.len() / 1024);

    // 2. Create V8 snapshot (stubs + polyfills ONLY — app is eval'd separately at runtime)
    let snap = create_snapshot_for_build(project_name).context("V8 snapshot creation failed")?;

    // 3. Resolve config to JSON and embed it
    let abs_bundle = std::env::current_dir()?.join(&bundle);
    let config_json = resolve_config_json().context("failed to resolve glyx config")?;
    std::fs::create_dir_all("target/glyx")?;
    let resolved_cfg = PathBuf::from("target/glyx/glyx.config.resolved.json");
    std::fs::write(&resolved_cfg, &config_json)?;
    let abs_config = std::env::current_dir()?.join(&resolved_cfg);

    let bin_path = if is_native_project() {
        // Native: build the app's own binary (compile-time embedding via build.rs)
        cargo_build_release(target, project_name, Some(&snap), Some(&abs_bundle), Some(&abs_config))?
    } else {
        // JS-only: copy cached prod runner and append payload as binary trailer — no cargo needed
        append_trailer_snapshot(target, project_name, &snap, &abs_bundle, &abs_config)?
    };

    // Build cap DLLs declared in glyx.config and place them next to the binary.
    let caps = super::read_capabilities_from_config();
    if !caps.is_empty() {
        let bin_dir = bin_path.parent().unwrap_or(Path::new("target/release"));
        build_cap_dlls(&caps, target, bin_dir).context("cap DLL build failed")?;
        super::write_caps_lock(bin_dir).context("failed to write glyx-caps.lock")?;
    }

    let _ = std::fs::write("target/glyx/build-mode", "snapshot");

    println!();
    println!("✓ Build complete [snapshot]: {}", bin_path.display());
    println!("  Binary is self-contained — no external JS files required");
    println!("  Startup: V8 restore ~50ms + app eval ~200ms ≈ 2-5× faster than dev mode");
    Ok(Some(bin_path))
}

/// bundle mode — minified bundle alongside binary (easy JS updates, no recompile)
pub(super) fn build_bundle_mode(target: Option<&str>, project_name: &str, p: pm::Pm) -> Result<Option<PathBuf>> {
    println!("[bundle mode] JS bundle → minified JS shipped alongside binary");

    if let Some((entry, _output)) = read_dev_config() {
        let bundle_src = build_app_bundle(project_name, &entry, p).context("app bundle build failed")?;
        let output_js = read_dev_config().map(|(_, o)| o).unwrap_or_else(|| "js/app.js".into());
        std::fs::copy(&bundle_src, &output_js).with_context(|| format!("copy bundle to {output_js}"))?;
        println!("✓ Bundle → {} ({} KB)", output_js, std::fs::metadata(&output_js)?.len() / 1024);
    } else {
        println!("⚠ No dev.entry in glyx config — skipping JS bundle");
    }

    let bin_path = if is_native_project() {
        cargo_build_release(target, project_name, None, None, None)?
    } else {
        copy_prod_runner_as(target, project_name)?
    };

    // Build cap DLLs and place them next to the binary.
    let caps = super::read_capabilities_from_config();
    if !caps.is_empty() {
        let bin_dir = bin_path.parent().unwrap_or(Path::new("target/release"));
        build_cap_dlls(&caps, target, bin_dir).context("cap DLL build failed")?;
        super::write_caps_lock(bin_dir).context("failed to write glyx-caps.lock")?;
    }

    let _ = std::fs::create_dir_all("target/glyx");
    let _ = std::fs::write("target/glyx/build-mode", "bundle");
    println!();
    println!("✓ Build complete [bundle]: {}", bin_path.display());
    println!("  Ship: {} + js/ + glyx config", bin_path.display());
    println!("  To update JS: replace js/app.js without recompiling Rust");
    Ok(Some(bin_path))
}

/// portable mode — JS alongside binary (readable, easiest to patch)
pub(super) fn build_portable_mode(target: Option<&str>, project_name: &str, p: pm::Pm) -> Result<Option<PathBuf>> {
    println!("[portable mode] JS files shipped alongside binary");

    if let Some((entry, output)) = read_dev_config() {
        println!("Bundling JS: {} → {}", entry, output);
        pm::js_bundle(p, &entry, &output, /*minify=*/false, /*source_map=*/true)
            .context("JS build failed")?;
        println!("✓ JS built: {}", output);
    } else {
        println!("⚠ No dev.entry in glyx config — skipping JS build");
    }

    let bin_path = if is_native_project() {
        cargo_build_release(target, project_name, None, None, None)?
    } else {
        copy_prod_runner_as(target, project_name)?
    };

    // Build cap DLLs and place them next to the binary.
    let caps = super::read_capabilities_from_config();
    if !caps.is_empty() {
        let bin_dir = bin_path.parent().unwrap_or(Path::new("target/release"));
        build_cap_dlls(&caps, target, bin_dir).context("cap DLL build failed")?;
        super::write_caps_lock(bin_dir).context("failed to write glyx-caps.lock")?;
    }

    let _ = std::fs::create_dir_all("target/glyx");
    let _ = std::fs::write("target/glyx/build-mode", "portable");
    println!();
    println!("✓ Build complete [portable]: {}", bin_path.display());
    println!("  Ship: {} + js/ + glyx config", bin_path.display());
    Ok(Some(bin_path))
}

/// For JS-only snapshot builds: copy the cached prod runner and append the payload
/// (snapshot blob + app JS + config) as a binary trailer.  No cargo invocation needed.
///
/// Footer v1 layout (last 72 bytes):
///   Offset  Size  Field
///    0       8    snap_offset  u64 LE
///    8       8    snap_len     u64 LE
///   16       8    js_offset    u64 LE
///   24       8    js_len       u64 LE
///   32       8    cfg_offset   u64 LE
///   40       8    cfg_len      u64 LE
///   48       4    version      u32 LE  = 1
///   52       4    flags        u32 LE  = 0  (reserved: compression, encryption…)
///   56       4    crc32        u32 LE  CRC32 of snap+js+cfg payload bytes
///   60       4    reserved     u32 LE  = 0
///   64       8    magic        u64 LE  = b"GLYXTRL"
///
/// Cross-compilation note: the runner binary must match the target OS/arch.
/// For cross-targets, run `glyx runtime build` on the target machine first,
/// then copy the runner to `~/.glyx/runners/prod/` on the build machine.
pub(super) fn append_trailer_snapshot(
    target:       Option<&str>,
    project_name: &str,
    snapshot:     &Path,
    app_js:       &Path,
    app_config:   &Path,
) -> Result<PathBuf> {
    use std::io::Write;

    const MAGIC:   u64 = 0x4C52_5458_4F4C_4556; // b"GLYXTRL" little-endian
    const VERSION: u32 = 1;
    const FLAGS:   u32 = 0; // reserved for future feature bits

    if target.is_some() {
        println!("⚠ Cross-compilation for JS-only snapshot: the cached runner must be built for the target platform.");
        println!("  On the target machine: run `glyx runtime build` then copy the prod runner to");
        println!("  ~/.glyx/runners/prod/glyx-runner on your build machine.");
    }

    let runner = find_or_build_runner(false)
        .context("Could not find or build prod glyx-runner. Run `glyx runtime build`.")?;

    std::fs::create_dir_all("target/release")?;
    let dest = PathBuf::from("target/release").join(binary_name(project_name));
    std::fs::copy(&runner, &dest)
        .with_context(|| format!("copy runner → {}", dest.display()))?;

    let snap_bytes   = std::fs::read(snapshot) .with_context(|| format!("read {}", snapshot.display()))?;
    let js_bytes     = std::fs::read(app_js)   .with_context(|| format!("read {}", app_js.display()))?;
    let config_bytes = std::fs::read(app_config).with_context(|| format!("read {}", app_config.display()))?;

    // CRC32 over the entire payload for integrity checking at runtime.
    let mut digest = crc32fast::Hasher::new();
    digest.update(&snap_bytes);
    digest.update(&js_bytes);
    digest.update(&config_bytes);
    let crc32 = digest.finalize();

    let runner_len  = std::fs::metadata(&dest)?.len();
    let snap_offset = runner_len;
    let js_offset   = snap_offset + snap_bytes.len()   as u64;
    let cfg_offset  = js_offset   + js_bytes.len()     as u64;

    let mut file = std::fs::OpenOptions::new()
        .append(true)
        .open(&dest)
        .with_context(|| format!("open {} for append", dest.display()))?;

    file.write_all(&snap_bytes)  .context("write snapshot")?;
    file.write_all(&js_bytes)    .context("write app JS")?;
    file.write_all(&config_bytes).context("write config")?;

    // Footer v1 (72 bytes): 6 × u64 offsets/lengths, 4 × u32 metadata, 1 × u64 magic.
    file.write_all(&snap_offset.to_le_bytes())               .context("write footer")?;
    file.write_all(&(snap_bytes.len() as u64).to_le_bytes()) .context("write footer")?;
    file.write_all(&js_offset.to_le_bytes())                 .context("write footer")?;
    file.write_all(&(js_bytes.len() as u64).to_le_bytes())   .context("write footer")?;
    file.write_all(&cfg_offset.to_le_bytes())                .context("write footer")?;
    file.write_all(&(config_bytes.len() as u64).to_le_bytes()).context("write footer")?;
    file.write_all(&VERSION.to_le_bytes())                   .context("write footer")?;
    file.write_all(&FLAGS.to_le_bytes())                     .context("write footer")?;
    file.write_all(&crc32.to_le_bytes())                     .context("write footer")?;
    file.write_all(&0u32.to_le_bytes())                      .context("write footer")?; // reserved
    file.write_all(&MAGIC.to_le_bytes())                     .context("write footer")?;

    println!("✓ Trailer: snapshot={} KB  js={} KB  config={} B  crc32={:#010x}",
        snap_bytes.len() / 1024, js_bytes.len() / 1024, config_bytes.len(), crc32);
    println!("✓ Binary: {} (no cargo recompile)", dest.display());

    Ok(std::env::current_dir()?.join(dest))
}

/// For JS-only bundle/portable builds: find the cached prod runner and copy it
/// to target/release/<project_name>[.exe], simulating a cargo build output.
pub(super) fn copy_prod_runner_as(target: Option<&str>, project_name: &str) -> Result<PathBuf> {
    if target.is_some() {
        println!("⚠ Cross-compilation for JS-only projects uses glyx-runner from glyx workspace.");
        println!("  Run `glyx runtime build` first to build the runner for the host platform,");
        println!("  then use `glyx build --mode snapshot` for embedded cross-target binaries.");
    }

    let runner = find_or_build_runner(false)
        .context("Could not find or build prod glyx-runner. Run `glyx runtime build`.")?;

    std::fs::create_dir_all("target/release")?;
    let dest = PathBuf::from("target/release").join(binary_name(project_name));
    std::fs::copy(&runner, &dest)
        .with_context(|| format!("copy runner → {}", dest.display()))?;

    println!("✓ Runtime: {} → {}", runner.display(), dest.display());
    Ok(std::env::current_dir()?.join(dest))
}

/// Shared cargo build --release helper. Returns the path to the produced binary.
pub(super) fn cargo_build_release(
    target: Option<&str>,
    project_name: &str,
    snapshot: Option<&Path>,
    app_js: Option<&Path>,
    app_config: Option<&Path>,
) -> Result<PathBuf> {
    let rust_target = target.map(platform_to_rust_target).transpose()?;
    let mut args = vec!["build", "--release", "--no-default-features", "-p", project_name];
    let target_str;
    if let Some(ref t) = rust_target {
        target_str = t.to_string();
        args.push("--target");
        args.push(&target_str);
        println!("Building for target: {}", t);
        ensure_rust_target(t)?;
    } else {
        println!("Building for host platform");
    }

    let mut cmd = Command::new("cargo");
    cmd.args(&args).env("RUST_LOG", "warn");
    if let Some(snap) = snapshot {
        cmd.env("GLYX_APP_SNAPSHOT", snap);
        println!("Embedding snapshot: {}", snap.display());
    }
    if let Some(js) = app_js {
        cmd.env("GLYX_APP_JS", js);
        println!("Embedding app JS:   {}", js.display());
    }
    if let Some(cfg) = app_config {
        cmd.env("GLYX_APP_CONFIG", cfg);
        println!("Embedding config:   {}", cfg.display());
    }
    let status = cmd.status().context("Failed to run `cargo build`")?;
    if !status.success() { bail!("cargo build failed"); }

    Ok(if let Some(ref t) = rust_target {
        PathBuf::from(format!("target/{}/release/{}", t, binary_name(project_name)))
    } else {
        PathBuf::from(format!("target/release/{}", binary_name(project_name)))
    })
}

/// Build all capability DLLs declared in glyx.config and copy them next to `dest`.
///
/// Each cap crate (`glyx-cap-audio`, `glyx-cap-camera`, etc.) is built as a
/// `cdylib` via `cargo build --release -p glyx-cap-<name>`.  The resulting
/// shared library is copied into `dest` so the runner can find it at startup.
pub fn build_cap_dlls(caps: &[String], target: Option<&str>, dest: &Path) -> Result<()> {
    if caps.is_empty() { return Ok(()); }

    let rust_target = target.map(super::platform_to_rust_target).transpose()?;
    let (dll_prefix, dll_ext) = if cfg!(target_os = "windows") {
        ("", "dll")
    } else if cfg!(target_os = "macos") {
        ("lib", "dylib")
    } else {
        ("lib", "so")
    };

    for cap in caps {
        let pkg = format!("glyx-cap-{cap}");
        // cdylib stem: glyx_cap_<name>  (hyphens → underscores)
        let stem = pkg.replace('-', "_");

        let mut args = vec!["build", "--release", "-p", pkg.as_str()];
        let target_str;
        if let Some(ref t) = rust_target {
            target_str = t.to_string();
            args.push("--target");
            args.push(&target_str);
        }

        println!("Building cap DLL: {pkg}...");
        let status = Command::new("cargo")
            .args(&args)
            .env("RUST_LOG", "warn")
            .status()
            .with_context(|| format!("Failed to run cargo build for {pkg}"))?;
        if !status.success() { bail!("cargo build for {pkg} failed"); }

        let lib_name = format!("{dll_prefix}{stem}.{dll_ext}");
        let src = if let Some(ref t) = rust_target {
            PathBuf::from(format!("target/{t}/release/{lib_name}"))
        } else {
            PathBuf::from(format!("target/release/{lib_name}"))
        };

        if !src.exists() {
            bail!("Expected DLL at {} but not found after build", src.display());
        }

        std::fs::create_dir_all(dest)?;
        let dst = dest.join(&lib_name);
        std::fs::copy(&src, &dst)
            .with_context(|| format!("copy {} → {}", src.display(), dst.display()))?;
        println!("  ✓ {} → {}", src.display(), dst.display());
    }
    Ok(())
}

/// Create a V8 snapshot containing ONLY stubs + polyfills.
pub(super) fn create_snapshot_for_build(project_name: &str) -> Result<PathBuf> {
    std::fs::create_dir_all("target/glyx")?;

    let polyfills_path = PathBuf::from("js/polyfills.js");
    let polyfills_arg = if polyfills_path.exists() {
        polyfills_path
    } else {
        let empty = PathBuf::from("target/glyx/empty.js");
        std::fs::write(&empty, "// no polyfills\n")?;
        empty
    };

    let empty_js = PathBuf::from("target/glyx/empty.js");
    std::fs::write(&empty_js, "// not snapshotted — eval'd at runtime\n")?;

    let snapshot_out = std::env::current_dir()?
        .join(format!("target/glyx/{project_name}.snapshot"));

    let snapshot_bin = find_or_build_snapshot_binary()?;

    println!("Creating V8 snapshot (stubs + polyfills)...");
    let status = Command::new(&snapshot_bin)
        .args([
            polyfills_arg.as_os_str(),
            empty_js.as_os_str(),
            empty_js.as_os_str(),
            snapshot_out.as_os_str(),
        ])
        .status()
        .context("Failed to run glyx-snapshot")?;

    if !status.success() { bail!("glyx-snapshot failed"); }

    if let Ok(meta) = std::fs::metadata(&snapshot_out) {
        println!("✓ V8 snapshot: {} ({} KB)", snapshot_out.display(), meta.len() / 1024);
    }
    Ok(snapshot_out)
}

pub(super) fn find_or_build_snapshot_binary() -> Result<PathBuf> {
    let glyx_home = glyx_home()?;
    let bin_name = if cfg!(target_os = "windows") { "glyx-snapshot.exe" } else { "glyx-snapshot" };

    for profile in &["release", "debug"] {
        let path = glyx_home.join("target").join(profile).join(bin_name);
        if path.exists() { return Ok(path); }
    }

    println!("Building glyx-snapshot (first run only)...");
    let status = Command::new("cargo")
        .args(["build", "-p", "glyx-snapshot", "--release"])
        .current_dir(&glyx_home)
        .status()
        .context("Failed to build glyx-snapshot")?;

    if !status.success() {
        bail!("Failed to build glyx-snapshot; run `cargo build -p glyx-snapshot --release` manually");
    }

    let path = glyx_home.join("target/release").join(bin_name);
    if path.exists() { return Ok(path); }
    bail!("glyx-snapshot binary not found after build at {}", path.display())
}
