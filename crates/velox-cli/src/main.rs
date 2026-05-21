//! velox — CLI for the Velox desktop app framework.
//!
//! Commands:
//!   velox create <name> [--native]       Scaffold a new project
//!   velox dev                            Start dev server with hot reload
//!   velox build [--target <os>]          Production build (bun → runner/cargo)
//!   velox package [--target <os>]        Create distributable installer/archive
//!   velox runtime list|build|install     Manage cached velox-runner binaries

use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Parser)]
#[command(
    name    = "velox",
    about   = "Build desktop apps with React + Rust",
    version,
    propagate_version = true,
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Scaffold a new Velox project.
    /// Default: JS-only project (no Rust toolchain required).
    /// Use --native to generate a full Rust workspace for custom native extensions.
    Create {
        name: String,
        /// Generate a full Rust workspace with Cargo.toml and src/main.rs.
        /// Required if you want to add custom VeloxExtension implementations.
        #[arg(long)]
        native: bool,
    },
    /// Start dev server with hot reload and optional CDP inspector.
    Dev {
        /// Enable Chrome DevTools Protocol inspector.
        /// Optionally specify a port (default 9229).
        /// Open chrome://inspect in Chrome and add 127.0.0.1:<port>.
        #[arg(long, value_name = "PORT", num_args = 0..=1, default_missing_value = "9229")]
        inspect: Option<u16>,
    },
    Build {
        /// Target OS (windows, macos, linux)
        target: Option<String>,
        /// Build mode: snapshot (default), bundle, portable
        ///
        /// snapshot  — embeds V8 snapshot in binary; self-contained exe, fastest startup (~50ms)
        /// bundle    — minified JS bundle shipped alongside binary; smaller binary, easy JS updates
        /// portable  — development-style JS alongside binary; readable, largest, easiest to patch
        #[arg(long, default_value = "snapshot")]
        mode: String,
        /// After building, launch the app and check that it meets the frame-time budget.
        #[arg(long)]
        check_performance: bool,
        /// Frame-time budget in milliseconds for --check-performance. Default: 16.667 (60 fps).
        #[arg(long, default_value = "16.667")]
        perf_budget: f64,
        /// How many seconds to run the app when --check-performance is used. Default: 10.
        #[arg(long, default_value = "10")]
        perf_duration: u64,
    },
    /// Create a distributable package or installer.
    ///
    /// Default: zip (Windows), tar.gz (Linux), .app (macOS).
    /// With --installer: Inno Setup .exe (Windows, requires iscc),
    ///                   AppImage (Linux, requires appimagetool),
    ///                   DMG (macOS, requires hdiutil — built-in).
    Package {
        /// Target OS (windows, macos, linux). Defaults to host OS.
        target: Option<String>,
        /// Build a native installer instead of a zip/tarball.
        #[arg(long)]
        installer: bool,
    },
    /// Manage cached velox-runner binaries.
    Runtime {
        #[command(subcommand)]
        cmd: RuntimeCommands,
    },
    /// Generate boilerplate for Velox features.
    Generate {
        #[command(subcommand)]
        cmd: GenerateCommands,
    },
}

#[derive(Subcommand)]
enum GenerateCommands {
    /// Scaffold a new native backend command (requires --native project).
    ///
    /// Creates `src-velox/commands/<name>.rs` with a typed async handler and
    /// prints the JS usage so you can call `await backend.<name>(args)` from
    /// any React component.
    Command {
        /// Command name in camelCase (e.g. `fetchUser`). Snake-case is also accepted.
        name: String,
    },
}

#[derive(Subcommand)]
enum RuntimeCommands {
    /// List cached velox-runner binaries.
    List,
    /// Build velox-runner from source and cache locally.
    Build,
    /// Install a specific velox-runner version (builds from source if not cached).
    Install { version: Option<String> },
}

fn main() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp(None)
        .format_module_path(false)
        .init();

    if let Err(e) = run() {
        eprintln!("error: {:#}", e);
        std::process::exit(1);
    }
}

fn run() -> Result<()> {
    let cli = Cli::parse();
    match cli.command {
        Commands::Create { name, native } => cmd_create(&name, native),
        Commands::Dev { inspect }         => cmd_dev(inspect),
        Commands::Build { target, mode, check_performance, perf_budget, perf_duration } =>
            cmd_build(target.as_deref(), &mode, check_performance, perf_budget, perf_duration),
        Commands::Package { target, installer } => cmd_package(target.as_deref(), installer),
        Commands::Runtime { cmd }         => cmd_runtime(cmd),
        Commands::Generate { cmd }        => cmd_generate(cmd),
    }
}

// ── velox create ─────────────────────────────────────────────────────────────

fn cmd_create(name: &str, native: bool) -> Result<()> {
    let dest = PathBuf::from(name);
    if dest.exists() { bail!("directory '{}' already exists", name); }
    let velox_home = velox_home()?;

    if native {
        println!("Creating Velox project (native): {name}/");
        println!("  Includes Cargo.toml + src/main.rs for custom VeloxExtension support.");
        cmd_create_native(name, &dest, &velox_home)?;
    } else {
        println!("Creating Velox project: {name}/");
        println!("  JS-only mode — no Rust toolchain required.");
        cmd_create_js(name, &dest, &velox_home)?;
    }

    println!();
    println!("✓ Created project: {name}/");
    println!();
    println!("Next steps:");
    println!("  cd {name}");
    println!("  bun install");
    if native {
        println!("  velox dev      # hot-reload dev server (requires Rust toolchain)");
    } else {
        println!("  velox dev      # hot-reload dev server (no Rust required)");
    }
    Ok(())
}

fn cmd_create_js(name: &str, dest: &Path, velox_home: &Path) -> Result<()> {
    std::fs::create_dir_all(dest.join("js"))?;

    let react_path  = relpath(dest, &velox_home.join("js/packages/@velox/react"));
    let router_path = relpath(dest, &velox_home.join("js/packages/@velox/router"));
    let config_path = relpath(dest, &velox_home.join("js/packages/@velox/config"));

    write_file(dest.join("js/polyfills.js"), POLYFILLS_JS)?;
    write_file(dest.join("js/app.jsx"), &app_jsx_template(name))?;
    write_file(dest.join("velox.config.ts"), &velox_config_ts_template(name))?;
    write_file(dest.join("package.json"), &format!(
        r#"{{
  "name": "{name}",
  "version": "0.1.0",
  "private": true,
  "dependencies": {{
    "react":         "^18",
    "@velox/react":  "file:{react_path}",
    "@velox/router": "file:{router_path}"
  }},
  "devDependencies": {{
    "@velox/config": "file:{config_path}"
  }}
}}
"#))?;
    write_file(dest.join(".gitignore"), "/node_modules\n/js/app.js\n/target/velox/velox.config.resolved.json\n")?;
    Ok(())
}

fn cmd_create_native(name: &str, dest: &Path, velox_home: &Path) -> Result<()> {
    std::fs::create_dir_all(dest.join("src"))?;
    std::fs::create_dir_all(dest.join("js"))?;

    let core_path  = relpath(dest, &velox_home.join("crates/velox-core"));
    let shell_path = relpath(dest, &velox_home.join("crates/velox-shell"));
    let react_path  = relpath(dest, &velox_home.join("js/packages/@velox/react"));
    let router_path = relpath(dest, &velox_home.join("js/packages/@velox/router"));
    let config_path = relpath(dest, &velox_home.join("js/packages/@velox/config"));

    write_file(dest.join("Cargo.toml"), &format!(
        r#"[package]
name    = "{name}"
version = "0.1.0"
edition = "2021"

[features]
# "dev" gates hot-reload, bun watcher, and dev overlay in velox-core.
# Production builds (velox build) use --no-default-features to exclude them.
default = ["dev"]
dev     = ["velox-core/dev"]

[dependencies]
velox-core  = {{ path = "{core_path}", default-features = false }}
velox-shell = {{ path = "{shell_path}" }}
env_logger  = "0.11"
"#))?;
    write_file(dest.join("src/main.rs"), "#![cfg_attr(all(target_os = \"windows\", not(debug_assertions)), windows_subsystem = \"windows\")]\n\nfn main() {\n    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or(\"info\"))\n        .format_timestamp(None)\n        .format_module_path(false)\n        .init();\n    velox_core::run(velox_core::AppConfig::from_config());\n}\n")?;
    write_file(dest.join("js/polyfills.js"), POLYFILLS_JS)?;
    write_file(dest.join("js/app.jsx"), &app_jsx_template(name))?;
    write_file(dest.join("velox.config.ts"), &velox_config_ts_template(name))?;
    write_file(dest.join("package.json"), &format!(
        r#"{{
  "name": "{name}",
  "version": "0.1.0",
  "private": true,
  "dependencies": {{
    "react":         "^18",
    "@velox/react":  "file:{react_path}",
    "@velox/router": "file:{router_path}"
  }},
  "devDependencies": {{
    "@velox/config": "file:{config_path}"
  }}
}}
"#))?;
    write_file(dest.join(".gitignore"), "/target\n/node_modules\n/js/app.js\n/target/velox/velox.config.resolved.json\n")?;
    Ok(())
}

fn app_jsx_template(name: &str) -> String {
    format!(r#"import './polyfills.js';
import React, {{ useState }} from 'react';
import {{ View, Text, Pressable, render, useWindowSize }} from '@velox/react';

function App() {{
  const {{ width, height }} = useWindowSize();
  const [count, setCount] = useState(0);

  return (
    <View
      width={{width}}
      height={{height}}
      style={{{{ backgroundColor: '#1e1e2e', justifyContent: 'center', alignItems: 'center', gap: 16 }}}}
    >
      <Text fontSize={{32}} style={{{{ color: '#cdd6f4' }}}}>
        {name}
      </Text>
      <Text fontSize={{18}} style={{{{ color: '#a6adc8' }}}}>
        count: {{count}}
      </Text>
      <Pressable
        onPress={{() => setCount(c => c + 1)}}
        style={{{{ backgroundColor: '#89b4fa', padding: 12, borderRadius: 8 }}}}
      >
        <Text fontSize={{16}} style={{{{ color: '#1e1e2e' }}}}>increment</Text>
      </Pressable>
    </View>
  );
}}

render(<App />);
"#)
}

fn velox_config_ts_template(name: &str) -> String {
    format!(r#"import {{ defineConfig }} from '@velox/config';

export default defineConfig({{
  app: {{
    version:     '1.0.0',
    publisher:   '',        // Company or author name (used in installer)
    description: '',        // Short app description
    website:     '',        // https://yoursite.com
  }},
  window: {{
    title:       '{name}',
    width:       1280,
    height:      800,
    startupMode: 'windowed',
  }},
  capabilities: {{
    fs:           {{ read: [], write: [] }},
    db:           false,
    dialog:       false,
    clipboard:    false,
    notification: false,
  }},
  dev: {{
    entry: 'js/app.jsx',
    output: 'js/app.js',
    watch: ['js'],
  }},
}});
"#)
}

// ── velox dev ─────────────────────────────────────────────────────────────────

fn cmd_dev(inspect: Option<u16>) -> Result<()> {
    let project_name = read_project_name()
        .context("Run `velox dev` from the project root (where velox.config.ts or package.json lives)")?;
    let cfg = read_dev_config();
    if let Some((entry, output)) = &cfg {
        println!("Building JS: {} → {}", entry, output);
        bun_build(entry, output).context("Initial bun build failed")?;
        println!("✓ JS built");
    }

    if let Some(port) = inspect {
        println!("Starting dev server for '{project_name}' (hot reload + CDP inspector on :{port})...");
        println!("  Open chrome://inspect and add 127.0.0.1:{port} under Discover network targets.");
    } else {
        println!("Starting dev server for '{project_name}' (hot reload active)...");
    }

    if is_native_project() {
        // Native project: custom Rust extensions compiled in — use cargo run
        let mut cmd = Command::new("cargo");
        cmd.args(["run", "-p", &project_name])
            .env("RUST_LOG", std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
            // Allow locally-built media DLLs with stub signatures in dev mode.
            .env("VELOX_MEDIA_SKIP_VERIFY", "1");
        if let Some(port) = inspect {
            cmd.env("VELOX_INSPECT_PORT", port.to_string());
        }
        let status = cmd.status().context("Failed to run `cargo run`; is Rust installed?")?;
        std::process::exit(status.code().unwrap_or(1));
    } else {
        // JS-only project: spawn the prebuilt velox-runner (dev build with hot-reload)
        let runner = find_or_build_runner(true)
            .context("Could not find or build velox-runner. Run `velox runtime build`.")?;
        log::info!("Using runner: {}", runner.display());
        let mut cmd = Command::new(&runner);
        // Suppress noisy symphonia probe warnings (emitted when probing MKV/other
        // containers if the matching demuxer feature isn't compiled in).
        let rust_log = std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into());
        let rust_log = if rust_log.contains("symphonia") { rust_log }
                       else { format!("{rust_log},symphonia_bundle_mp3=off,symphonia_codec_aac=off") };
        cmd.env("RUST_LOG", rust_log);
        // In dev mode, allow locally-built media DLLs with stub signatures.
        // Production runners verify the Ed25519 signature; dev runners skip it.
        cmd.env("VELOX_MEDIA_SKIP_VERIFY", "1");
        if let Some(port) = inspect {
            cmd.env("VELOX_INSPECT_PORT", port.to_string());
        }
        let status = cmd.status()
            .with_context(|| format!("Failed to launch {}", runner.display()))?;
        std::process::exit(status.code().unwrap_or(1));
    }
}

// ── velox build ───────────────────────────────────────────────────────────────

fn cmd_build(
    target: Option<&str>,
    mode: &str,
    check_performance: bool,
    perf_budget: f64,
    perf_duration: u64,
) -> Result<()> {
    let project_name = read_project_name()
        .context("Run `velox build` from the project root (where velox.config.ts or package.json lives)")?;

    let bin_path = match mode {
        "snapshot" => build_snapshot_mode(target, &project_name)?,
        "bundle"   => build_bundle_mode(target, &project_name)?,
        "portable" => build_portable_mode(target, &project_name)?,
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

/// Launch the built binary with VELOX_PERF_CHECK, capture stdout, and report results.
fn run_perf_check(bin: &Path, budget_ms: f64, duration_secs: u64) -> Result<()> {
    println!();
    println!("Running performance check ({duration_secs}s at {budget_ms}ms budget)...");
    let output = Command::new(bin)
        .env("VELOX_PERF_CHECK", format!("{duration_secs}:{budget_ms}"))
        .output()
        .with_context(|| format!("Failed to launch {}", bin.display()))?;

    let stdout = String::from_utf8_lossy(&output.stdout);
    let result_line = stdout.lines()
        .find(|l| l.starts_with("VELOX_PERF_RESULT:"))
        .map(|l| l.trim_start_matches("VELOX_PERF_RESULT:").trim());

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
        println!("⚠ Performance check: no result data (app did not emit VELOX_PERF_RESULT)");
    }
    Ok(())
}

/// snapshot mode — self-contained exe with embedded V8 snapshot + embedded app JS.
///
/// For native projects: `cargo build --release -p <project_name>`
/// For JS-only projects: `cargo build --release --no-default-features -p velox-runner`
///                        then rename the output binary to <project_name>[.exe]
fn build_snapshot_mode(target: Option<&str>, project_name: &str) -> Result<Option<PathBuf>> {
    println!("[snapshot mode] bun bundle → V8 snapshot + embedded app.js → self-contained binary");

    let Some((entry, output)) = read_dev_config() else {
        println!("⚠ No dev.entry in velox config — falling back to portable mode");
        return build_portable_mode(target, project_name);
    };

    // 1. Build the app bundle (embedded in binary, eval'd at runtime)
    println!("Bundling JS: {} → {}", entry, output);
    bun_build(&entry, &output).context("bun build failed")?;
    println!("✓ JS bundled (dev output)");
    let bundle = build_app_bundle(project_name, &entry).context("app bundle build failed")?;
    println!("✓ App bundle: {} ({} KB)", bundle.display(), std::fs::metadata(&bundle)?.len() / 1024);

    // 2. Create V8 snapshot (stubs + polyfills ONLY — app is eval'd separately at runtime)
    let snap = create_snapshot_for_build(project_name).context("V8 snapshot creation failed")?;

    // 3. Resolve config to JSON and embed it
    let abs_bundle = std::env::current_dir()?.join(&bundle);
    let config_json = resolve_config_json().context("failed to resolve velox config")?;
    std::fs::create_dir_all("target/velox")?;
    let resolved_cfg = PathBuf::from("target/velox/velox.config.resolved.json");
    std::fs::write(&resolved_cfg, &config_json)?;
    let abs_config = std::env::current_dir()?.join(&resolved_cfg);

    let bin_path = if is_native_project() {
        // Native: build the app's own binary (compile-time embedding via build.rs)
        cargo_build_release(target, project_name, Some(&snap), Some(&abs_bundle), Some(&abs_config))?
    } else {
        // JS-only: copy cached prod runner and append payload as binary trailer — no cargo needed
        append_trailer_snapshot(target, project_name, &snap, &abs_bundle, &abs_config)?
    };

    let _ = std::fs::write("target/velox/build-mode", "snapshot");

    println!();
    println!("✓ Build complete [snapshot]: {}", bin_path.display());
    println!("  Binary is self-contained — no external JS files required");
    println!("  Startup: V8 restore ~50ms + app eval ~200ms ≈ 2-5× faster than dev mode");
    Ok(Some(bin_path))
}

/// bundle mode — bun build → minified bundle alongside binary (easy JS updates, no recompile)
fn build_bundle_mode(target: Option<&str>, project_name: &str) -> Result<Option<PathBuf>> {
    println!("[bundle mode] bun bundle → minified JS shipped alongside binary");

    if let Some((entry, _output)) = read_dev_config() {
        let bundle_src = build_app_bundle(project_name, &entry).context("app bundle build failed")?;
        let output_js = read_dev_config().map(|(_, o)| o).unwrap_or_else(|| "js/app.js".into());
        std::fs::copy(&bundle_src, &output_js).with_context(|| format!("copy bundle to {output_js}"))?;
        println!("✓ Bundle → {} ({} KB)", output_js, std::fs::metadata(&output_js)?.len() / 1024);
    } else {
        println!("⚠ No dev.entry in velox config — skipping JS bundle");
    }

    let bin_path = if is_native_project() {
        cargo_build_release(target, project_name, None, None, None)?
    } else {
        copy_prod_runner_as(target, project_name)?
    };

    let _ = std::fs::create_dir_all("target/velox");
    let _ = std::fs::write("target/velox/build-mode", "bundle");
    println!();
    println!("✓ Build complete [bundle]: {}", bin_path.display());
    println!("  Ship: {} + js/ + velox config", bin_path.display());
    println!("  To update JS: replace js/app.js without recompiling Rust");
    Ok(Some(bin_path))
}

/// portable mode — bun build → JS alongside binary (readable, easiest to patch)
fn build_portable_mode(target: Option<&str>, project_name: &str) -> Result<Option<PathBuf>> {
    println!("[portable mode] bun build → JS files shipped alongside binary");

    if let Some((entry, output)) = read_dev_config() {
        println!("Bundling JS: {} → {}", entry, output);
        bun_build(&entry, &output).context("bun build failed")?;
        println!("✓ JS built: {}", output);
    } else {
        println!("⚠ No dev.entry in velox config — skipping JS build");
    }

    let bin_path = if is_native_project() {
        cargo_build_release(target, project_name, None, None, None)?
    } else {
        copy_prod_runner_as(target, project_name)?
    };

    let _ = std::fs::create_dir_all("target/velox");
    let _ = std::fs::write("target/velox/build-mode", "portable");
    println!();
    println!("✓ Build complete [portable]: {}", bin_path.display());
    println!("  Ship: {} + js/ + velox config", bin_path.display());
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
///   64       8    magic        u64 LE  = b"VELOXTRL"
///
/// Cross-compilation note: the runner binary must match the target OS/arch.
/// For cross-targets, run `velox runtime build` on the target machine first,
/// then copy the runner to `~/.velox/runners/prod/` on the build machine.
fn append_trailer_snapshot(
    target:       Option<&str>,
    project_name: &str,
    snapshot:     &Path,
    app_js:       &Path,
    app_config:   &Path,
) -> Result<PathBuf> {
    use std::io::Write;

    const MAGIC:   u64 = 0x4C52_5458_4F4C_4556; // b"VELOXTRL" little-endian
    const VERSION: u32 = 1;
    const FLAGS:   u32 = 0; // reserved for future feature bits

    if target.is_some() {
        println!("⚠ Cross-compilation for JS-only snapshot: the cached runner must be built for the target platform.");
        println!("  On the target machine: run `velox runtime build` then copy the prod runner to");
        println!("  ~/.velox/runners/prod/velox-runner on your build machine.");
    }

    let runner = find_or_build_runner(false)
        .context("Could not find or build prod velox-runner. Run `velox runtime build`.")?;

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
fn copy_prod_runner_as(target: Option<&str>, project_name: &str) -> Result<PathBuf> {
    if target.is_some() {
        println!("⚠ Cross-compilation for JS-only projects uses velox-runner from velox workspace.");
        println!("  Run `velox runtime build` first to build the runner for the host platform,");
        println!("  then use `velox build --mode snapshot` for embedded cross-target binaries.");
    }

    let runner = find_or_build_runner(false)
        .context("Could not find or build prod velox-runner. Run `velox runtime build`.")?;

    std::fs::create_dir_all("target/release")?;
    let dest = PathBuf::from("target/release").join(binary_name(project_name));
    std::fs::copy(&runner, &dest)
        .with_context(|| format!("copy runner → {}", dest.display()))?;

    println!("✓ Runtime: {} → {}", runner.display(), dest.display());
    Ok(std::env::current_dir()?.join(dest))
}

/// Shared cargo build --release helper. Returns the path to the produced binary.
fn cargo_build_release(
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
        cmd.env("VELOX_APP_SNAPSHOT", snap);
        println!("Embedding snapshot: {}", snap.display());
    }
    if let Some(js) = app_js {
        cmd.env("VELOX_APP_JS", js);
        println!("Embedding app JS:   {}", js.display());
    }
    if let Some(cfg) = app_config {
        cmd.env("VELOX_APP_CONFIG", cfg);
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

/// Create a V8 snapshot containing ONLY stubs + polyfills.
fn create_snapshot_for_build(project_name: &str) -> Result<PathBuf> {
    std::fs::create_dir_all("target/velox")?;

    let polyfills_path = PathBuf::from("js/polyfills.js");
    let polyfills_arg = if polyfills_path.exists() {
        polyfills_path
    } else {
        let empty = PathBuf::from("target/velox/empty.js");
        std::fs::write(&empty, "// no polyfills\n")?;
        empty
    };

    let empty_js = PathBuf::from("target/velox/empty.js");
    std::fs::write(&empty_js, "// not snapshotted — eval'd at runtime\n")?;

    let snapshot_out = std::env::current_dir()?
        .join(format!("target/velox/{project_name}.snapshot"));

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
        .context("Failed to run velox-snapshot")?;

    if !status.success() { bail!("velox-snapshot failed"); }

    if let Ok(meta) = std::fs::metadata(&snapshot_out) {
        println!("✓ V8 snapshot: {} ({} KB)", snapshot_out.display(), meta.len() / 1024);
    }
    Ok(snapshot_out)
}

fn find_or_build_snapshot_binary() -> Result<PathBuf> {
    let velox_home = velox_home()?;
    let bin_name = if cfg!(target_os = "windows") { "velox-snapshot.exe" } else { "velox-snapshot" };

    for profile in &["release", "debug"] {
        let path = velox_home.join("target").join(profile).join(bin_name);
        if path.exists() { return Ok(path); }
    }

    println!("Building velox-snapshot (first run only)...");
    let status = Command::new("cargo")
        .args(["build", "-p", "velox-snapshot", "--release"])
        .current_dir(&velox_home)
        .status()
        .context("Failed to build velox-snapshot")?;

    if !status.success() {
        bail!("Failed to build velox-snapshot; run `cargo build -p velox-snapshot --release` manually");
    }

    let path = velox_home.join("target/release").join(bin_name);
    if path.exists() { return Ok(path); }
    bail!("velox-snapshot binary not found after build at {}", path.display())
}

// ── velox runtime ─────────────────────────────────────────────────────────────

fn cmd_runtime(cmd: RuntimeCommands) -> Result<()> {
    match cmd {
        RuntimeCommands::List => {
            let dir = velox_runners_dir();
            println!("Cached velox-runner binaries:");
            let mut found = false;
            for profile in ["dev", "prod"] {
                let path = dir.join(profile).join(runner_bin_name());
                if path.exists() {
                    let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                    println!("  [{profile}] {} ({:.1} MB)", path.display(), size as f64 / (1024.0 * 1024.0));
                    found = true;
                }
            }
            // Also show workspace target/ if present
            if let Ok(home) = velox_home() {
                for profile in ["debug", "release"] {
                    let path = home.join("target").join(profile).join(runner_bin_name());
                    if path.exists() {
                        let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                        println!("  [workspace/{profile}] {} ({:.1} MB)", path.display(), size as f64 / (1024.0 * 1024.0));
                        found = true;
                    }
                }
            }
            if !found {
                println!("  (none cached — run `velox runtime build` to build from source)");
            }
            Ok(())
        }
        RuntimeCommands::Build => {
            println!("Building velox-runner from source...");
            let dev  = find_or_build_runner(true)?;
            let prod = find_or_build_runner(false)?;
            println!();
            println!("✓ Dev runner (hot-reload):  {}", dev.display());
            println!("✓ Prod runner (lean):       {}", prod.display());
            Ok(())
        }
        RuntimeCommands::Install { version } => {
            // Future: download prebuilt binary from GitHub releases
            // For now: build from source (same as `velox runtime build`)
            let v = version.as_deref().unwrap_or("local");
            println!("Installing velox-runner v{v} (building from source)...");
            println!("  (Prebuilt binary download is planned for a future release)");
            let dev  = find_or_build_runner(true)?;
            let prod = find_or_build_runner(false)?;
            println!();
            println!("✓ Dev runner:  {}", dev.display());
            println!("✓ Prod runner: {}", prod.display());
            Ok(())
        }
    }
}

// ── velox package ─────────────────────────────────────────────────────────────

fn cmd_package(target: Option<&str>, installer: bool) -> Result<()> {
    let project_name = read_project_name()
        .context("Run `velox package` from the project root")?;
    let os = target.unwrap_or(host_os());
    let rust_target = platform_to_rust_target(os)?;
    let bin_src = resolve_packaged_binary(&project_name, &rust_target, target.is_some())?;
    std::fs::create_dir_all("target/velox/dist")?;
    if installer {
        match os {
            "windows" => installer_windows(&project_name, &bin_src)?,
            "macos"   => installer_macos(&project_name, &bin_src)?,
            "linux"   => installer_linux(&project_name, &bin_src)?,
            other     => bail!("Unknown target OS: {other}. Use: windows, macos, linux"),
        }
    } else {
        match os {
            "windows" => package_windows(&project_name, &bin_src)?,
            "macos"   => package_macos(&project_name, &bin_src)?,
            "linux"   => package_linux(&project_name, &bin_src)?,
            other     => bail!("Unknown target OS: {other}. Use: windows, macos, linux"),
        }
    }
    Ok(())
}

fn resolve_packaged_binary(project_name: &str, rust_target: &str, cross_target: bool) -> Result<PathBuf> {
    let rel = if cross_target {
        PathBuf::from(format!("target/{rust_target}/release/{}", binary_name(project_name)))
    } else {
        PathBuf::from(format!("target/release/{}", binary_name(project_name)))
    };
    let mut candidates = vec![std::env::current_dir()?.join(&rel)];
    if let Some(ws_root) = find_workspace_root()? {
        let ws_candidate = ws_root.join(&rel);
        if !candidates.iter().any(|p| p == &ws_candidate) {
            candidates.push(ws_candidate);
        }
    }
    for candidate in &candidates {
        if candidate.exists() { return Ok(candidate.clone()); }
    }
    let searched = candidates.iter().map(|p| p.display().to_string()).collect::<Vec<_>>().join(", ");
    bail!("Binary not found. Run `velox build` first. Searched: {searched}");
}

fn package_windows(name: &str, bin: &Path) -> Result<()> {
    let dist_root = PathBuf::from("target/velox/dist");
    let app_dir = dist_root.join(format!("{name}-windows"));
    if app_dir.exists() { std::fs::remove_dir_all(&app_dir).with_context(|| format!("remove {}", app_dir.display()))?; }
    std::fs::create_dir_all(&app_dir)?;
    let exe_name = binary_name(name);
    let exe_dest = app_dir.join(&exe_name);
    std::fs::copy(bin, &exe_dest).with_context(|| format!("copy {}", bin.display()))?;
    copy_runtime_files(&app_dir)?;
    copy_media_dll_if_needed(&app_dir)?;
    let win_meta = read_app_metadata();
    install_license_files(&app_dir.join("LICENSES"), win_meta.license.as_deref())?;

    // Generate icon.ico from app icon PNG if declared in velox.config.json.
    if let Some(icon_png) = read_icon_path() {
        let ico_dest = app_dir.join("icon.ico");
        match png_to_ico(&icon_png, &ico_dest) {
            Ok(()) => println!("  Icon: {}", ico_dest.display()),
            Err(e) => println!("  Warning: icon.ico not generated: {e}"),
        }
    }

    if let Some(scheme) = read_deeplink_scheme() {
        let exe_abs = exe_dest.canonicalize()
            .unwrap_or(exe_dest.clone())
            .to_string_lossy()
            .replace('/', "\\");
        let reg_key = format!("HKCU\\Software\\Classes\\{scheme}");
        let open_key = format!("{reg_key}\\shell\\open\\command");
        let reg_content = format!(
            "Windows Registry Editor Version 5.00\r\n\r\n\
             [{reg_key}]\r\n\
             @=\"URL:{scheme} Protocol\"\r\n\
             \"URL Protocol\"=\"\"\r\n\r\n\
             [{open_key}]\r\n\
             @=\"\\\"{exe_abs}\\\" \\\"%1\\\"\"\r\n"
        );
        let reg_path = app_dir.join("register-scheme.reg");
        std::fs::write(&reg_path, reg_content)?;
        println!("  Deep-link scheme '{scheme}://' → register-scheme.reg (run once to activate)");
    }

    let zip_path = format!("target/velox/dist/{name}-windows.zip");
    println!("Packaging for Windows: {zip_path}");
    let status = Command::new("powershell")
        .args(["-Command", &format!("Compress-Archive -Path '{}/*' -DestinationPath '{}' -Force", app_dir.display(), zip_path)])
        .status();
    match status {
        Ok(s) if s.success() => {
            println!("✓ Package: {zip_path}");
            println!("  Unzip and run {exe_name} from the extracted folder");
        }
        _ => { println!("✓ Folder: {}", app_dir.display()); }
    }
    Ok(())
}

fn package_macos(name: &str, bin: &Path) -> Result<()> {
    let bundle_root = PathBuf::from(format!("target/velox/dist/{name}.app"));
    let app_dir = bundle_root.join("Contents/MacOS");
    let res_dir = bundle_root.join("Contents/Resources");
    std::fs::create_dir_all(&app_dir)?;
    std::fs::create_dir_all(&res_dir)?;
    std::fs::copy(bin, app_dir.join(name))?;

    let scheme_xml = if let Some(scheme) = read_deeplink_scheme() {
        println!("  Deep-link scheme '{scheme}://' → CFBundleURLTypes in Info.plist");
        format!(r#"
    <key>CFBundleURLTypes</key>
    <array>
        <dict>
            <key>CFBundleURLName</key><string>com.velox.{name}.{scheme}</string>
            <key>CFBundleURLSchemes</key>
            <array><string>{scheme}</string></array>
        </dict>
    </array>"#)
    } else {
        String::new()
    };

    // Generate icon.icns from app icon PNG if on macOS.
    let icon_xml = if let Some(icon_png) = read_icon_path() {
        match png_to_icns(&icon_png, &res_dir) {
            Ok(icns_path) => {
                println!("  Icon: {}", icns_path.display());
                "\n    <key>CFBundleIconFile</key><string>icon</string>".to_string()
            }
            Err(e) => {
                println!("  Warning: icon.icns not generated: {e}");
                String::new()
            }
        }
    } else {
        String::new()
    };

    let plist = format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key><string>{name}</string>
    <key>CFBundleIdentifier</key><string>com.velox.{name}</string>
    <key>CFBundleName</key><string>{name}</string>
    <key>CFBundleVersion</key><string>1.0</string>{icon_xml}{scheme_xml}
</dict>
</plist>"#);
    write_file(bundle_root.join("Contents/Info.plist"), &plist)?;
    copy_media_dll_if_needed(&app_dir)?;
    let macos_meta = read_app_metadata();
    install_license_files(&res_dir.join("LICENSES"), macos_meta.license.as_deref())?;
    println!("✓ Package: {}", bundle_root.display());
    Ok(())
}

fn package_linux(name: &str, bin: &Path) -> Result<()> {
    std::fs::create_dir_all("target/velox/dist")?;

    // Copy icon PNG alongside binary so xdg-icon-resource / AppImage can use it.
    let icon_field = if let Some(icon_png) = read_icon_path() {
        let icon_dest = format!("target/velox/dist/{name}.png");
        if let Err(e) = std::fs::copy(&icon_png, &icon_dest) {
            println!("  Warning: could not copy icon: {e}");
            name.to_string()
        } else {
            println!("  Icon: {icon_dest}");
            format!("target/velox/dist/{name}")
        }
    } else {
        name.to_string()
    };

    if let Some(scheme) = read_deeplink_scheme() {
        let mime_type = format!("x-scheme-handler/{scheme}");
        let desktop = format!(
            "[Desktop Entry]\nType=Application\nName={name}\n\
             Exec={name} %u\nIcon={icon_field}\nMimeType={mime_type};\n\
             NoDisplay=false\nCategories=Application;\n"
        );
        let desktop_path = format!("target/velox/dist/{name}.desktop");
        std::fs::write(&desktop_path, desktop)?;
        println!("  Deep-link scheme '{scheme}://' → {desktop_path}");
        println!("  To activate: xdg-desktop-menu install --novendor {name}.desktop");
    }

    let archive = format!("target/velox/dist/{name}-linux.tar.gz");
    println!("Packaging for Linux: {archive}");
    let status = Command::new("tar")
        .args(["-czf", &archive, "-C", bin.parent().unwrap().to_str().unwrap(), &binary_name(name)])
        .status();
    match status {
        Ok(s) if s.success() => { println!("✓ Package: {archive}"); }
        _ => {
            let dest = format!("target/velox/dist/{name}");
            std::fs::copy(bin, &dest)?;
            println!("✓ Binary: {dest}");
        }
    }
    copy_media_dll_if_needed(&PathBuf::from("target/velox/dist"))?;
    let linux_meta = read_app_metadata();
    install_license_files(&PathBuf::from("target/velox/dist/LICENSES"), linux_meta.license.as_deref())?;
    Ok(())
}

// ── Installer builders ────────────────────────────────────────────────────────

/// Windows installer via Inno Setup (`iscc` must be in PATH).
/// Falls back to printing setup instructions if iscc is not found.
fn installer_windows(name: &str, bin: &Path) -> Result<()> {
    // First build the portable folder so Inno has something to package.
    package_windows(name, bin)?;

    let meta       = read_app_metadata();
    let app_dir    = PathBuf::from(format!("target/velox/dist/{name}-windows"));
    let exe_name   = binary_name(name);
    let out_dir    = PathBuf::from("target/velox/dist");
    let iss_path   = out_dir.join(format!("{name}.iss"));
    let output_exe = out_dir.join(format!("{name}-Setup.exe"));

    // If icon.ico was generated by package_windows, reference it in the installer.
    let ico_path = app_dir.join("icon.ico");
    let setup_icon_line = if ico_path.exists() {
        format!("SetupIconFile={}\n", ico_path.display())
    } else {
        String::new()
    };
    let publisher_line = if meta.publisher.is_empty() {
        String::new()
    } else {
        format!("AppPublisher={}\n", meta.publisher)
    };
    let website_line = if meta.website.is_empty() {
        String::new()
    } else {
        format!("AppPublisherURL={}\nAppSupportURL={}\nAppUpdatesURL={}\n",
            meta.website, meta.website, meta.website)
    };
    // License file for Inno Setup EULA screen (app license takes priority if present).
    let license_line = {
        let app_lic   = app_dir.join("LICENSES/app.txt");
        let velox_lic = app_dir.join("LICENSES/velox.txt");
        let lic = if app_lic.exists() { app_lic } else { velox_lic };
        if lic.exists() { format!("LicenseFile={}\n", lic.display()) } else { String::new() }
    };

    let iss = format!(
r#"[Setup]
AppName={name}
AppVersion={version}
{publisher_line}{website_line}DefaultDirName={{autopf}}\{name}
DefaultGroupName={name}
OutputDir={out_dir}
OutputBaseFilename={name}-Setup
Compression=lzma
SolidCompression=yes
DisableProgramGroupPage=yes
{setup_icon_line}{license_line}
[Files]
Source: "{app_dir}\{exe_name}"; DestDir: "{{app}}"; Flags: ignoreversion
Source: "{app_dir}\*"; DestDir: "{{app}}"; Flags: ignoreversion recursesubdirs createallsubdirs; Excludes: "{exe_name}"

[Icons]
Name: "{{autoprograms}}\{name}"; Filename: "{{app}}\{exe_name}"
Name: "{{autodesktop}}\{name}";  Filename: "{{app}}\{exe_name}"; Tasks: desktopicon

[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Additional icons:"

[Run]
Filename: "{{app}}\{exe_name}"; Description: "Launch {name}"; Flags: nowait postinstall skipifsilent
"#,
        name            = name,
        version         = meta.version,
        publisher_line  = publisher_line,
        website_line    = website_line,
        exe_name        = exe_name,
        app_dir         = app_dir.display(),
        out_dir         = out_dir.display(),
        setup_icon_line = setup_icon_line,
        license_line    = license_line,
    );

    std::fs::write(&iss_path, &iss)?;
    println!("  Generated: {}", iss_path.display());

    // Try to find iscc (Inno Setup Compiler)
    let iscc_candidates = [
        "iscc".to_string(),
        r"C:\Program Files (x86)\Inno Setup 6\iscc.exe".to_string(),
        r"C:\Program Files\Inno Setup 6\iscc.exe".to_string(),
    ];
    let iscc = iscc_candidates.iter().find(|c| {
        Command::new(c).arg("/?").output().is_ok()
    });

    match iscc {
        Some(compiler) => {
            println!("Compiling installer with Inno Setup…");
            let status = Command::new(compiler).arg(iss_path.to_str().unwrap()).status()?;
            if status.success() {
                println!("✓ Installer: {}", output_exe.display());
            } else {
                bail!("iscc exited with non-zero status. Check the .iss file.");
            }
        }
        None => {
            println!();
            println!("Inno Setup (iscc) not found. Install it from https://jrsoftware.org/isinfo.php");
            println!("Then run manually:");
            println!("  iscc \"{}\"", iss_path.display());
            println!();
            println!("✓ Script generated: {}", iss_path.display());
        }
    }
    Ok(())
}

/// macOS DMG via hdiutil (built-in on macOS).
fn installer_macos(name: &str, bin: &Path) -> Result<()> {
    // Build the .app first.
    package_macos(name, bin)?;

    let app_path = format!("target/velox/dist/{name}.app");
    let dmg_path = format!("target/velox/dist/{name}.dmg");

    println!("Creating DMG: {dmg_path}");
    let status = Command::new("hdiutil")
        .args([
            "create",
            "-volname", name,
            "-srcfolder", &app_path,
            "-ov",
            "-format", "UDZO",
            &dmg_path,
        ])
        .status();

    match status {
        Ok(s) if s.success() => println!("✓ Installer: {dmg_path}"),
        Ok(_)  => bail!("hdiutil create failed"),
        Err(e) => bail!("hdiutil not found ({e}). This command must run on macOS."),
    }
    Ok(())
}

/// Linux AppImage via appimagetool.
/// Falls back to tar.gz with instructions if appimagetool is not in PATH.
fn installer_linux(name: &str, bin: &Path) -> Result<()> {
    let meta     = read_app_metadata();
    let dist     = PathBuf::from("target/velox/dist");
    let app_dir  = dist.join(format!("{name}.AppDir"));
    let usr_bin  = app_dir.join("usr/bin");
    std::fs::create_dir_all(&usr_bin)?;

    // Copy binary
    let bin_dest = usr_bin.join(name);
    std::fs::copy(bin, &bin_dest)?;

    // AppRun script
    let apprun = format!("#!/bin/sh\nexec \"$(dirname \"$0\")/usr/bin/{name}\" \"$@\"\n");
    let apprun_path = app_dir.join("AppRun");
    std::fs::write(&apprun_path, apprun)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&apprun_path, std::fs::Permissions::from_mode(0o755))?;
    }

    // .desktop file (required by appimagetool)
    let comment_line = if meta.description.is_empty() {
        String::new()
    } else {
        format!("Comment={}\n", meta.description)
    };
    let desktop = format!(
        "[Desktop Entry]\nType=Application\nName={name}\nExec={name}\nIcon={name}\n\
         {comment_line}Categories=Utility;\n",
        name = name, comment_line = comment_line,
    );
    std::fs::write(app_dir.join(format!("{name}.desktop")), desktop)?;

    // Copy app icon PNG into AppDir (required by appimagetool).
    let icon_dest = app_dir.join(format!("{name}.png"));
    if let Some(icon_png) = read_icon_path() {
        if let Err(e) = std::fs::copy(&icon_png, &icon_dest) {
            println!("  Warning: could not copy icon: {e}");
        } else {
            println!("  Icon: {}", icon_dest.display());
        }
    } else {
        // Placeholder 1×1 transparent PNG so appimagetool doesn't abort.
        let tiny_png: &[u8] = &[
            0x89,0x50,0x4E,0x47,0x0D,0x0A,0x1A,0x0A,
            0x00,0x00,0x00,0x0D,0x49,0x48,0x44,0x52,
            0x00,0x00,0x00,0x01,0x00,0x00,0x00,0x01,
            0x08,0x02,0x00,0x00,0x00,0x90,0x77,0x53,
            0xDE,0x00,0x00,0x00,0x0C,0x49,0x44,0x41,
            0x54,0x08,0xD7,0x63,0xF8,0xFF,0xFF,0x3F,
            0x00,0x05,0xFE,0x02,0xFE,0xDC,0xCC,0x59,
            0xE7,0x00,0x00,0x00,0x00,0x49,0x45,0x4E,
            0x44,0xAE,0x42,0x60,0x82,
        ];
        if let Err(e) = std::fs::write(&icon_dest, tiny_png) {
            println!("  Warning: could not write placeholder icon: {e}");
        }
    }

    let output_ai = dist.join(format!("{name}-x86_64.AppImage"));
    println!("Building AppImage: {}", output_ai.display());

    let status = Command::new("appimagetool")
        .arg(app_dir.to_str().unwrap())
        .arg(output_ai.to_str().unwrap())
        .status();

    match status {
        Ok(s) if s.success() => println!("✓ Installer: {}", output_ai.display()),
        Ok(_) => bail!("appimagetool exited with non-zero status"),
        Err(_) => {
            println!();
            println!("appimagetool not found. Download it from https://appimage.github.io/appimagetool/");
            println!("Then run manually:");
            println!("  appimagetool \"{}\" \"{}\"", app_dir.display(), output_ai.display());
            println!();
            println!("AppDir prepared: {}", app_dir.display());
            // Fall back to tar.gz
            installer_linux_fallback(name, bin)?;
        }
    }
    Ok(())
}

fn installer_linux_fallback(name: &str, bin: &Path) -> Result<()> {
    package_linux(name, bin)
}

// ── Runner management ─────────────────────────────────────────────────────────

/// Find or build the velox-runner binary.
///
/// `dev_mode = true`  → runner with "dev" feature (hot-reload + overlay); debug build
/// `dev_mode = false` → runner without "dev" feature (lean production binary); release build
///
/// Search order:
///   1. ~/.velox/runners/{dev|prod}/velox-runner[.exe]  (cached)
///   2. velox_home/target/{debug|release}/velox-runner[.exe]  (workspace)
///   3. Build from source → copy to cache
fn find_or_build_runner(dev_mode: bool) -> Result<PathBuf> {
    let profile = if dev_mode { "dev" } else { "prod" };
    let bin_name = runner_bin_name();

    // 1. Check user cache
    let cache_dir = velox_runners_dir().join(profile);
    let cached    = cache_dir.join(bin_name);
    if cached.exists() { return Ok(cached); }

    // 2. Check velox workspace target/ (fastest for developers inside the workspace)
    if let Ok(home) = velox_home() {
        let ws_profile = if dev_mode { "debug" } else { "release" };
        let ws_bin = home.join("target").join(ws_profile).join(bin_name);
        if ws_bin.exists() { return Ok(ws_bin); }
    }

    // 3. Build from source
    let home = velox_home().context("Cannot locate velox workspace — needed to build velox-runner")?;
    let label = if dev_mode { "dev (with hot-reload)" } else { "prod (lean)" };
    println!("Building velox-runner [{label}] from source (first-run, one-time cost)...");

    let mut args = vec!["build", "-p", "velox-runner"];
    if !dev_mode { args.push("--release"); args.push("--no-default-features"); }

    let status = Command::new("cargo")
        .args(&args)
        .current_dir(&home)
        .status()
        .context("Failed to run `cargo build -p velox-runner`")?;
    if !status.success() { bail!("Failed to build velox-runner"); }

    let built = if dev_mode {
        home.join("target/debug").join(bin_name)
    } else {
        home.join("target/release").join(bin_name)
    };

    if !built.exists() {
        bail!("velox-runner binary not found at {} after build", built.display());
    }

    // Cache it for future use
    std::fs::create_dir_all(&cache_dir)
        .with_context(|| format!("create cache dir {}", cache_dir.display()))?;
    std::fs::copy(&built, &cached)
        .with_context(|| format!("cache runner to {}", cached.display()))?;

    println!("✓ velox-runner [{profile}] cached at {}", cached.display());
    Ok(cached)
}

fn velox_runners_dir() -> PathBuf {
    // Cross-platform home directory
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    home.join(".velox").join("runners")
}

fn runner_bin_name() -> &'static str {
    if cfg!(target_os = "windows") { "velox-runner.exe" } else { "velox-runner" }
}

// ── Build helpers ─────────────────────────────────────────────────────────────

fn build_app_bundle(project_name: &str, entry: &str) -> Result<PathBuf> {
    let bundle_out = format!("target/velox/{project_name}.js");
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd"); c.args(["/C", "bun", "build"]); c
    } else {
        let mut c = Command::new("bun"); c.arg("build"); c
    };
    let status = cmd
        .arg(entry)
        .args([
            "--outfile", &bundle_out,
            "--target", "browser",
            "--format", "iife",
            "--minify",
            "--define", "process.env.NODE_ENV='production'",
        ])
        .status()
        .context("Failed to run `bun build`")?;
    if !status.success() { bail!("bun build failed"); }
    Ok(PathBuf::from(bundle_out))
}

// ── velox generate ────────────────────────────────────────────────────────────

fn cmd_generate(cmd: GenerateCommands) -> Result<()> {
    match cmd {
        GenerateCommands::Command { name } => cmd_generate_command(&name),
    }
}

fn cmd_generate_command(name: &str) -> Result<()> {
    // Accept both camelCase and snake_case inputs.
    let snake = camel_to_snake(name);
    let camel = snake_to_camel(&snake);

    if !is_native_project() {
        bail!(
            "velox generate command requires a native project (Cargo.toml not found).\n\
             Run `velox create --native <name>` to create one, or run this command from \
             the project root."
        );
    }

    let dir = PathBuf::from("src-velox").join("commands");
    std::fs::create_dir_all(&dir)?;

    let file_path = dir.join(format!("{snake}.rs"));
    if file_path.exists() {
        bail!("'{}' already exists", file_path.display());
    }

    let content = format!(
        r#"//! Backend command: `{camel}`
//!
//! Called from JS as:
//!   const result = await backend.{camel}({{ /* args */ }});
//!
//! Register this command in your VeloxExtension:
//!   fn register_commands(&self, cmds: &mut velox_runtime::BackendRegistryBuilder) {{
//!       cmds.add("{camel}", {snake});
//!   }}

use velox_runtime::BackendRegistryBuilder;

/// Register this command with the backend registry.
pub fn register(cmds: &mut BackendRegistryBuilder) {{
    cmds.add("{camel}", handler);
}}

/// Handler for the `{camel}` command.
///
/// `args_json` is the JSON-serialised object passed from JS.
/// Return a JSON string to resolve the Promise, or an Err string to reject it.
async fn handler(args_json: String) -> Result<String, String> {{
    let _args: serde_json::Value = serde_json::from_str(&args_json)
        .map_err(|e| e.to_string())?;

    // TODO: implement {camel}
    Ok("null".to_string())
}}
"#
    );

    std::fs::write(&file_path, content)?;

    println!("Created {}", file_path.display());
    println!();
    println!("Next steps:");
    println!("  1. Implement the handler in {}", file_path.display());
    println!("  2. In your VeloxExtension impl, add:");
    println!("       fn register_commands(&self, cmds: &mut BackendRegistryBuilder) {{");
    println!("           crate::commands::{snake}::register(cmds);");
    println!("       }}");
    println!("  3. Call from JS:");
    println!("       import {{ backend }} from '@velox/react';");
    println!("       const result = await backend.{camel}({{ /* args */ }});");

    Ok(())
}

/// Convert camelCase / PascalCase → snake_case.
fn camel_to_snake(s: &str) -> String {
    let mut out = String::new();
    for (i, ch) in s.char_indices() {
        if ch.is_uppercase() && i > 0 { out.push('_'); }
        out.push(ch.to_ascii_lowercase());
    }
    out
}

/// Convert snake_case → camelCase.
fn snake_to_camel(s: &str) -> String {
    let mut out = String::new();
    let mut cap_next = false;
    for ch in s.chars() {
        if ch == '_' {
            cap_next = true;
        } else if cap_next {
            out.push(ch.to_ascii_uppercase());
            cap_next = false;
        } else {
            out.push(ch);
        }
    }
    out
}

// ── Project detection ─────────────────────────────────────────────────────────

/// Returns true if the current directory is a native Velox project (has Cargo.toml).
fn is_native_project() -> bool {
    Path::new("Cargo.toml").exists()
}

// ── Helper utilities ──────────────────────────────────────────────────────────

fn velox_home() -> Result<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if let Some(workspace) = manifest_dir.parent().and_then(|p| p.parent()) {
        let cargo_toml = workspace.join("Cargo.toml");
        if cargo_toml.exists() {
            let content = std::fs::read_to_string(&cargo_toml).unwrap_or_default();
            if content.contains("[workspace]") && content.contains("velox-core") {
                return Ok(workspace.to_path_buf());
            }
        }
    }

    let exe = std::env::current_exe().context("Cannot determine executable path")?;
    let mut dir = exe.as_path();
    loop {
        dir = dir.parent().context("Could not find velox home directory")?;
        let cargo_toml = dir.join("Cargo.toml");
        if cargo_toml.exists() {
            let content = std::fs::read_to_string(&cargo_toml).unwrap_or_default();
            if content.contains("[workspace]") && content.contains("velox-core") {
                return Ok(dir.to_path_buf());
            }
        }
        if dir.parent().is_none() { break; }
    }
    Ok(std::env::current_dir()?)
}

fn relpath(from_dir: &Path, to: &Path) -> String {
    let from = from_dir.canonicalize().unwrap_or_else(|_| from_dir.to_path_buf());
    let to   = to.canonicalize().unwrap_or_else(|_| to.to_path_buf());
    let from_components: Vec<_> = from.components().collect();
    let to_components:   Vec<_> = to.components().collect();
    let common = from_components.iter().zip(to_components.iter())
        .take_while(|(a, b)| a == b)
        .count();
    let up = from_components.len() - common;
    let mut rel = PathBuf::new();
    for _ in 0..up { rel.push(".."); }
    for c in &to_components[common..] { rel.push(c); }
    rel.to_string_lossy().replace('\\', "/")
}

/// Read the project name.
/// Tries Cargo.toml first (native projects), then package.json (JS-only projects).
fn read_project_name() -> Option<String> {
    // 1. Cargo.toml (native projects)
    if let Ok(src) = std::fs::read_to_string("Cargo.toml") {
        for line in src.lines() {
            let line = line.trim();
            if line.starts_with("name") {
                if let Some(val) = line.splitn(2, '=').nth(1) {
                    let name = val.trim().trim_matches('"').to_string();
                    if !name.is_empty() { return Some(name); }
                }
            }
        }
    }
    // 2. package.json (JS-only projects)
    if let Ok(src) = std::fs::read_to_string("package.json") {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&src) {
            if let Some(name) = v["name"].as_str() {
                if !name.is_empty() { return Some(name.to_string()); }
            }
        }
    }
    None
}

/// Resolve the project config to a JSON string.
fn resolve_config_json() -> Result<String> {
    if Path::new("velox.config.ts").exists() {
        let mut cmd = if cfg!(target_os = "windows") {
            let mut c = Command::new("cmd"); c.args(["/C", "bun", "run", "velox.config.ts"]); c
        } else {
            let mut c = Command::new("bun"); c.args(["run", "velox.config.ts"]); c
        };
        let out = cmd.output().context("failed to run `bun run velox.config.ts`")?;
        if !out.status.success() {
            bail!("velox.config.ts execution failed:\n{}", String::from_utf8_lossy(&out.stderr));
        }
        let json = String::from_utf8(out.stdout)
            .context("velox.config.ts output is not valid UTF-8")?;
        return Ok(json.trim().to_string());
    }
    std::fs::read_to_string("velox.config.json")
        .context("neither velox.config.ts nor velox.config.json found")
}

// ── Icon helpers ──────────────────────────────────────────────────────────────

/// Read the `icon` field from velox.config.json, if declared.
fn read_icon_path() -> Option<String> {
    #[derive(serde::Deserialize)]
    struct Cfg { icon: Option<String> }
    let src = resolve_config_json().ok()?;
    let cfg: Cfg = serde_json::from_str(&src).ok()?;
    cfg.icon
}

/// Publisher / product metadata read from the `app` section of velox.config.
#[derive(Default)]
struct AppMeta {
    version:     String,
    publisher:   String,
    description: String,
    website:     String,
    /// Path to the app's own license file (relative to project root), e.g. "LICENSE.txt".
    license:     Option<String>,
}

fn read_app_metadata() -> AppMeta {
    #[derive(serde::Deserialize, Default)]
    struct AppSection {
        version:     Option<String>,
        publisher:   Option<String>,
        description: Option<String>,
        website:     Option<String>,
        license:     Option<String>,
    }
    #[derive(serde::Deserialize, Default)]
    struct Cfg { app: Option<AppSection> }

    let src  = resolve_config_json().unwrap_or_default();
    let cfg: Cfg = serde_json::from_str(&src).unwrap_or_default();
    let a = cfg.app.unwrap_or_default();
    AppMeta {
        version:     a.version.unwrap_or_else(|| "1.0.0".into()),
        publisher:   a.publisher.unwrap_or_default(),
        description: a.description.unwrap_or_default(),
        website:     a.website.unwrap_or_default(),
        license:     a.license,
    }
}

/// The Velox framework MIT license — always included in the installation folder.
const VELOX_LICENSE_TEXT: &str = "\
MIT License

Copyright (c) 2024 Velox Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the \"Software\"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED \"AS IS\", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
";

/// Write license files into `licenses_dir` (created if needed).
/// Always writes `velox.txt`. Copies the app license as `app.txt` if specified.
/// Returns the path to the primary license file to show in the installer EULA screen
/// (app license takes priority over the Velox license).
fn install_license_files(licenses_dir: &Path, app_license: Option<&str>) -> Result<PathBuf> {
    std::fs::create_dir_all(licenses_dir)?;

    // Velox framework license — always present
    let velox_lic = licenses_dir.join("velox.txt");
    std::fs::write(&velox_lic, VELOX_LICENSE_TEXT)?;
    println!("  License (Velox): {}", velox_lic.display());

    // App license — optional
    if let Some(src) = app_license {
        let src_path = Path::new(src);
        if src_path.exists() {
            let app_lic = licenses_dir.join("app.txt");
            std::fs::copy(src_path, &app_lic)?;
            println!("  License (App):   {}", app_lic.display());
            return Ok(app_lic);  // App license is shown as EULA
        } else {
            println!("  Warning: app.license '{src}' not found — only Velox license included");
        }
    }

    Ok(velox_lic)  // Fall back to Velox license for EULA screen
}

/// Convert a PNG file to a multi-size `.ico` file (16, 32, 48, 256 px).
/// Returns the path to the generated `.ico`, or `None` if the source PNG is missing.
fn png_to_ico(png_path: &str, out_path: &Path) -> Result<()> {
    let img = image::open(png_path)
        .with_context(|| format!("Cannot open icon: {png_path}"))?;

    let mut icon_dir = ico::IconDir::new(ico::ResourceType::Icon);
    for size in [256u32, 48, 32, 16] {
        let resized  = img.resize_exact(size, size, image::imageops::FilterType::Lanczos3);
        let rgba     = resized.into_rgba8();
        let (w, h)   = rgba.dimensions();
        let icon_img = ico::IconImage::from_rgba_data(w, h, rgba.into_raw());
        let entry    = ico::IconDirEntry::encode(&icon_img)
            .map_err(|e| anyhow::anyhow!("ico entry {size}px: {e}"))?;
        icon_dir.add_entry(entry);
    }
    let f = std::fs::File::create(out_path)
        .with_context(|| format!("Cannot create {}", out_path.display()))?;
    icon_dir.write(f).map_err(|e| anyhow::anyhow!("ico write: {e}"))?;
    Ok(())
}

/// Build `icon.icns` from a PNG using macOS built-in tools (sips + iconutil).
/// No-ops silently if not running on macOS.
#[cfg(target_os = "macos")]
fn png_to_icns(png_path: &str, out_dir: &Path) -> Result<PathBuf> {
    let iconset = out_dir.join("icon.iconset");
    std::fs::create_dir_all(&iconset)?;
    // sips produces the required resolution set
    let sizes: &[(u32, &str)] = &[
        (16,  "icon_16x16"),   (32,  "icon_16x16@2x"),
        (32,  "icon_32x32"),   (64,  "icon_32x32@2x"),
        (128, "icon_128x128"), (256, "icon_128x128@2x"),
        (256, "icon_256x256"), (512, "icon_256x256@2x"),
        (512, "icon_512x512"), (1024,"icon_512x512@2x"),
    ];
    for (px, name) in sizes {
        let dest = iconset.join(format!("{name}.png"));
        Command::new("sips")
            .args(["-z", &px.to_string(), &px.to_string(), png_path,
                   "--out", dest.to_str().unwrap()])
            .output()
            .context("sips failed — are you on macOS?")?;
    }
    let icns = out_dir.join("icon.icns");
    let status = Command::new("iconutil")
        .args(["-c", "icns", iconset.to_str().unwrap(),
               "-o", icns.to_str().unwrap()])
        .status()?;
    if !status.success() { bail!("iconutil failed"); }
    std::fs::remove_dir_all(&iconset)?;
    Ok(icns)
}

#[cfg(not(target_os = "macos"))]
fn png_to_icns(_png_path: &str, _out_dir: &Path) -> Result<PathBuf> {
    bail!("icns generation requires macOS (sips + iconutil)")
}

/// Read the deep-link scheme from velox config, if declared.
fn read_deeplink_scheme() -> Option<String> {
    #[derive(serde::Deserialize)]
    struct Cfg { capabilities: Option<Caps> }
    #[derive(serde::Deserialize)]
    struct Caps { deeplink: Option<Dl> }
    #[derive(serde::Deserialize)]
    struct Dl { scheme: Option<String> }
    let src = resolve_config_json().ok()?;
    let cfg: Cfg = serde_json::from_str(&src).ok()?;
    cfg.capabilities?.deeplink?.scheme
}

fn read_dev_config() -> Option<(String, String)> {
    #[derive(serde::Deserialize)]
    struct Cfg { dev: Option<DevSection> }
    #[derive(serde::Deserialize)]
    struct DevSection { entry: Option<String>, output: Option<String> }
    let src = resolve_config_json().ok()?;
    let cfg: Cfg = serde_json::from_str(&src).ok()?;
    let dev = cfg.dev?;
    Some((dev.entry?, dev.output?))
}

fn bun_build(entry: &str, output: &str) -> Result<()> {
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd"); c.args(["/C", "bun", "build"]); c
    } else {
        let mut c = Command::new("bun"); c.arg("build"); c
    };
    let status = cmd
        .arg(entry)
        .args(["--outfile", output, "--target", "browser", "--format", "iife",
               "--define", "process.env.NODE_ENV='production'"])
        .status()
        .context("Failed to run `bun`; is Bun installed? https://bun.sh")?;
    if !status.success() { bail!("bun build failed"); }
    Ok(())
}

fn platform_to_rust_target(os: &str) -> Result<String> {
    Ok(match os {
        "windows"     => "x86_64-pc-windows-msvc".into(),
        "windows-arm" => "aarch64-pc-windows-msvc".into(),
        "macos"       => "aarch64-apple-darwin".into(),
        "macos-x64"   => "x86_64-apple-darwin".into(),
        "linux"       => "x86_64-unknown-linux-gnu".into(),
        "linux-arm"   => "aarch64-unknown-linux-gnu".into(),
        other         => bail!("Unknown target: '{other}'. Use: windows, macos, linux, linux-arm, macos-x64"),
    })
}

fn ensure_rust_target(target: &str) -> Result<()> {
    let out = Command::new("rustup")
        .args(["target", "list", "--installed"])
        .output()
        .context("Failed to run rustup")?;
    let installed = String::from_utf8_lossy(&out.stdout);
    if !installed.contains(target) {
        println!("Target '{target}' is not installed. Installing via rustup...");
        let status = Command::new("rustup")
            .args(["target", "add", target])
            .status()
            .context("Failed to run rustup target add")?;
        if !status.success() { bail!("Failed to install target '{target}'. Run: rustup target add {target}"); }
    }
    Ok(())
}

fn binary_name(name: &str) -> String {
    if cfg!(target_os = "windows") { format!("{name}.exe") } else { name.to_string() }
}

fn host_os() -> &'static str {
    if cfg!(target_os = "windows")      { "windows" }
    else if cfg!(target_os = "macos")   { "macos" }
    else                                 { "linux" }
}

fn find_workspace_root() -> Result<Option<PathBuf>> {
    let mut dir = std::env::current_dir()?;
    loop {
        let cargo_toml = dir.join("Cargo.toml");
        if cargo_toml.exists() {
            let content = std::fs::read_to_string(&cargo_toml).unwrap_or_default();
            if content.contains("[workspace]") { return Ok(Some(dir)); }
        }
        match dir.parent() { Some(parent) => dir = parent.to_path_buf(), None => return Ok(None), }
    }
}

fn copy_runtime_files(dest_root: &Path) -> Result<()> {
    let build_mode = std::fs::read_to_string("target/velox/build-mode")
        .unwrap_or_else(|_| "portable".into());
    let is_snapshot = build_mode.trim() == "snapshot";

    if !is_snapshot {
        let config = PathBuf::from("velox.config.json");
        if config.exists() {
            std::fs::copy(&config, dest_root.join("velox.config.json"))
                .with_context(|| format!("copy {}", config.display()))?;
        }
        let js_dir = PathBuf::from("js");
        if js_dir.exists() { copy_dir_all(&js_dir, &dest_root.join("js"))?; }
    }
    let assets_dir = PathBuf::from("assets");
    if assets_dir.exists() { copy_dir_all(&assets_dir, &dest_root.join("assets"))?; }
    let migrations_dir = PathBuf::from("migrations");
    if migrations_dir.exists() { copy_dir_all(&migrations_dir, &dest_root.join("migrations"))?; }
    Ok(())
}

/// Copy the cached velox-media DLL into `dest_root` when `video: true` is declared
/// in velox.config.json. Logs a warning if the DLL has not been downloaded yet.
fn copy_media_dll_if_needed(dest_root: &Path) -> Result<()> {
    // Check if video capability is declared.
    let config_str = std::fs::read_to_string("velox.config.json").unwrap_or_default();
    let video_enabled: bool = serde_json::from_str::<serde_json::Value>(&config_str)
        .ok()
        .and_then(|v| v.get("video").and_then(|b| b.as_bool()))
        .unwrap_or(false);
    if !video_enabled { return Ok(()); }

    // Locate the cached DLL at ~/.velox/cache/media/velox-media-{version}-{platform}-{arch}.{ext}
    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    let version = "1.0.0";
    let platform = if cfg!(target_os = "windows") { "windows" }
                   else if cfg!(target_os = "macos") { "macos" }
                   else { "linux" };
    let arch = if cfg!(target_arch = "aarch64") { "arm64" } else { "x64" };
    let ext  = if cfg!(target_os = "windows") { "dll" }
               else if cfg!(target_os = "macos") { "dylib" }
               else { "so" };
    let stem = format!("velox-media-{version}-{platform}-{arch}");
    let dll_path = PathBuf::from(&home)
        .join(".velox").join("cache").join("media")
        .join(format!("{stem}.{ext}"));

    if !dll_path.exists() {
        println!("  ⚠ velox-media DLL not found at {}", dll_path.display());
        println!("    Video features require the DLL. Run: velox runtime install-media");
        return Ok(());
    }

    let dest = dest_root.join(format!("{stem}.{ext}"));
    std::fs::copy(&dll_path, &dest)
        .with_context(|| format!("copy velox-media DLL → {}", dest.display()))?;
    println!("  Media DLL: {}", dest.display());
    Ok(())
}

fn copy_dir_all(src: &Path, dst: &Path) -> Result<()> {
    std::fs::create_dir_all(dst).with_context(|| format!("create {}", dst.display()))?;
    for entry in std::fs::read_dir(src).with_context(|| format!("read {}", src.display()))? {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dest_path = dst.join(entry.file_name());
        if ty.is_dir() { copy_dir_all(&entry.path(), &dest_path)?; }
        else { std::fs::copy(entry.path(), &dest_path).with_context(|| format!("copy {}", entry.path().display()))?; }
    }
    Ok(())
}

fn write_file(path: impl AsRef<Path>, content: &str) -> Result<()> {
    let path = path.as_ref();
    if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }
    std::fs::write(path, content).with_context(|| format!("write {}", path.display()))
}

const POLYFILLS_JS: &str = r#"// V8 environment polyfills
if (typeof performance === 'undefined') {
  globalThis.performance = { now: () => Number(__velox_getTime()) };
}
if (typeof setTimeout === 'undefined') {
  let _nextId = 1;
  globalThis.setTimeout  = (fn, _ms) => { fn(); return _nextId++; };
  globalThis.clearTimeout = (_id) => {};
}
if (typeof queueMicrotask === 'undefined') {
  globalThis.queueMicrotask = (fn) => Promise.resolve().then(fn);
}
if (typeof MessageChannel === 'undefined') {
  globalThis.MessageChannel = class MessageChannel {
    constructor() {
      const ch = this;
      ch.port1 = { onmessage: null, postMessage(msg) { ch.port2.onmessage?.({ data: msg }); } };
      ch.port2 = { onmessage: null, postMessage(msg) { ch.port1.onmessage?.({ data: msg }); } };
    }
  };
}
"#;
