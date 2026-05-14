//! velox — CLI for the Velox desktop app framework.
//!
//! Commands:
//!   velox create <name>              Scaffold a new project
//!   velox dev                        Start dev server with hot reload
//!   velox build [--target <os>]      Production build (bun → cargo)
//!   velox package [--target <os>]    Create distributable installer/archive

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
    Create { name: String },
    Dev,
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
    },
    Package { target: Option<String> },
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
        Commands::Create { name }   => cmd_create(&name),
        Commands::Dev               => cmd_dev(),
        Commands::Build { target, mode } => cmd_build(target.as_deref(), &mode),
        Commands::Package { target } => cmd_package(target.as_deref()),
    }
}

fn cmd_create(name: &str) -> Result<()> {
    let dest = PathBuf::from(name);
    if dest.exists() { bail!("directory '{}' already exists", name); }
    let velox_home = velox_home()?;
    println!("Creating Velox project: {name}");
    std::fs::create_dir_all(dest.join("src"))?;
    std::fs::create_dir_all(dest.join("js"))?;
    let core_path  = relpath(&dest, &velox_home.join("crates/velox-core"));
    let shell_path = relpath(&dest, &velox_home.join("crates/velox-shell"));
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
    write_file(dest.join("src/main.rs"), "#![cfg_attr(all(target_os = \"windows\", not(debug_assertions)), windows_subsystem = \"windows\")]\n\nfn main() {\n    velox_core::run(velox_core::AppConfig::from_config());\n}\n")?;
    write_file(dest.join("js/polyfills.js"), POLYFILLS_JS)?;
    write_file(dest.join("js/app.jsx"), &format!(
        r#"import './polyfills.js';
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
"#))?;
    write_file(dest.join("velox.config.json"), &format!(
        r#"{{
  "window": {{
    "title":       "{name}",
    "width":       1280,
    "height":      800,
    "startupMode": "windowed"
  }},
  "capabilities": {{
    "fs":           {{ "read": [], "write": [] }},
    "db":           false,
    "dialog":       false,
    "clipboard":    false,
    "notification": false
  }},
  "dev": {{
    "entry": "js/app.jsx",
    "output": "js/app.js",
    "watch": ["js"]
  }}
}}
"#))?;
    let react_path  = relpath(&dest, &velox_home.join("js/packages/@velox/react"));
    let router_path = relpath(&dest, &velox_home.join("js/packages/@velox/router"));
    write_file(dest.join("package.json"), &format!(
        r#"{{
  "name": "{name}",
  "version": "0.1.0",
  "private": true,
  "dependencies": {{
    "react":       "^18",
    "@velox/react": "file:{react_path}",
    "@velox/router": "file:{router_path}"
  }}
}}
"#))?;
    write_file(dest.join(".gitignore"), "/target\n/node_modules\n/js/app.js\n")?;
    println!();
    println!("✓ Created project: {name}/");
    println!();
    println!("Next steps:");
    println!("  cd {name}");
    println!("  bun install");
    println!("  velox dev");
    Ok(())
}

fn cmd_dev() -> Result<()> {
    let project_name = read_project_name()
        .context("Run `velox dev` from the project root (where Cargo.toml lives)")?;
    let cfg = read_dev_config();
    if let Some((entry, output)) = &cfg {
        println!("Building JS: {} → {}", entry, output);
        bun_build(entry, output).context("Initial bun build failed")?;
        println!("✓ JS built");
    }
    println!("Starting dev server for '{project_name}' (hot reload active)...");
    let status = Command::new("cargo")
        .args(["run", "-p", &project_name])
        .env("RUST_LOG", std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .status()
        .context("Failed to run `cargo run`; is Rust installed?")?;
    std::process::exit(status.code().unwrap_or(1));
}

fn cmd_build(target: Option<&str>, mode: &str) -> Result<()> {
    let project_name = read_project_name()
        .context("Run `velox build` from the project root (where Cargo.toml lives)")?;

    match mode {
        "snapshot" => build_snapshot_mode(target, &project_name),
        "bundle"   => build_bundle_mode(target, &project_name),
        "portable" => build_portable_mode(target, &project_name),
        other => bail!("Unknown build mode '{other}'. Use: snapshot, bundle, portable"),
    }
}

/// snapshot mode — self-contained exe with embedded V8 snapshot + embedded app JS
///
/// What's embedded:
///   - V8 snapshot: stubs + polyfills pre-executed (fast V8 init, ~50ms)
///   - App bundle: minified JS embedded as bytes (no external files needed)
///
/// At runtime:
///   1. Restore V8 from snapshot (stubs+polyfills already done)
///   2. Re-register real Rust bindings
///   3. Eval embedded app.js → render(<App />) with real bindings → correct scene
fn build_snapshot_mode(target: Option<&str>, project_name: &str) -> Result<()> {
    println!("[snapshot mode] bun bundle → V8 snapshot + embedded app.js → self-contained binary");

    let Some((entry, output)) = read_dev_config() else {
        println!("⚠ No dev.entry in velox.config.json — falling back to portable mode");
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

    // 3. Cargo build: embed snapshot, app bundle, and config (all baked in — no external files)
    let abs_bundle = std::env::current_dir()?.join(&bundle);
    let abs_config = std::env::current_dir()?.join("velox.config.json");
    let bin_path = cargo_build_release(target, project_name, Some(&snap), Some(&abs_bundle), Some(&abs_config))?;

    // Write build-mode marker so `velox package` knows to skip JS files
    let _ = std::fs::create_dir_all("target/velox");
    let _ = std::fs::write("target/velox/build-mode", "snapshot");

    println!();
    println!("✓ Build complete [snapshot]: {}", bin_path.display());
    println!("  Binary is self-contained — no external JS files required");
    println!("  Startup: V8 restore ~50ms + app eval ~200ms ≈ 2-5× faster than dev mode");
    Ok(())
}

/// bundle mode — bun build → minified bundle alongside binary (easy JS updates, no recompile)
fn build_bundle_mode(target: Option<&str>, project_name: &str) -> Result<()> {
    println!("[bundle mode] bun bundle → minified JS shipped alongside binary");

    if let Some((entry, _output)) = read_dev_config() {
        let bundle_src = build_app_bundle(project_name, &entry).context("app bundle build failed")?;
        // Copy minified bundle to the output path so the binary loads it at runtime
        let output_js = read_dev_config().map(|(_, o)| o).unwrap_or_else(|| "js/app.js".into());
        std::fs::copy(&bundle_src, &output_js).with_context(|| format!("copy bundle to {output_js}"))?;
        println!("✓ Bundle → {} ({} KB)", output_js, std::fs::metadata(&output_js)?.len() / 1024);
    } else {
        println!("⚠ No dev.entry in velox.config.json — skipping JS bundle");
    }

    let bin_path = cargo_build_release(target, project_name, None, None, None)?;
    let _ = std::fs::create_dir_all("target/velox");
    let _ = std::fs::write("target/velox/build-mode", "bundle");
    println!();
    println!("✓ Build complete [bundle]: {}", bin_path.display());
    println!("  Ship: {} + js/ + velox.config.json", bin_path.display());
    println!("  To update JS: replace js/app.js without recompiling Rust");
    Ok(())
}

/// portable mode — bun build → JS alongside binary (readable, easiest to patch)
fn build_portable_mode(target: Option<&str>, project_name: &str) -> Result<()> {
    println!("[portable mode] bun build → JS files shipped alongside binary");

    if let Some((entry, output)) = read_dev_config() {
        println!("Bundling JS: {} → {}", entry, output);
        bun_build(&entry, &output).context("bun build failed")?;
        println!("✓ JS built: {}", output);
    } else {
        println!("⚠ No dev.entry in velox.config.json — skipping JS build");
    }

    let bin_path = cargo_build_release(target, project_name, None, None, None)?;
    let _ = std::fs::create_dir_all("target/velox");
    let _ = std::fs::write("target/velox/build-mode", "portable");
    println!();
    println!("✓ Build complete [portable]: {}", bin_path.display());
    println!("  Ship: {} + js/ + velox.config.json", bin_path.display());
    Ok(())
}

/// Shared cargo build --release helper. Returns the path to the produced binary.
///
/// `snapshot`   — path to the `.snapshot` blob embedded via `VELOX_APP_SNAPSHOT`
/// `app_js`     — path to the minified app bundle embedded via `VELOX_APP_JS`
/// `app_config` — path to `velox.config.json` embedded via `VELOX_APP_CONFIG`
fn cargo_build_release(
    target: Option<&str>,
    project_name: &str,
    snapshot: Option<&Path>,
    app_js: Option<&Path>,
    app_config: Option<&Path>,
) -> Result<PathBuf> {
    let rust_target = target.map(platform_to_rust_target).transpose()?;
    // --no-default-features disables the app's "dev" feature (and transitively
    // velox-core/dev), excluding notify, hot-reload worker, and dev overlay from
    // the production binary.  The user's Cargo.toml must follow the pattern:
    //   [features]
    //   default = ["dev"]
    //   dev     = ["velox-core/dev"]
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
///
/// The app bundle is NOT included in the snapshot — it is embedded separately
/// (via VELOX_APP_JS) and eval'd at runtime after real bindings are registered.
/// This ensures render(<App />) runs with real Rust bindings, not stubs.
///
/// Snapshot content:
///   stubs     — __velox_* no-op placeholders (overridden at runtime)
///   polyfills — setTimeout, performance.now, etc. (pre-initialised)
///   framework — empty (React is bundled into the app, not snapshotted separately)
///   app       — empty (eval'd at runtime, after real bindings are available)
fn create_snapshot_for_build(project_name: &str) -> Result<PathBuf> {
    std::fs::create_dir_all("target/velox")?;

    // Use project's polyfills.js if it exists; otherwise a no-op placeholder
    let polyfills_path = PathBuf::from("js/polyfills.js");
    let polyfills_arg = if polyfills_path.exists() {
        polyfills_path
    } else {
        let empty = PathBuf::from("target/velox/empty.js");
        std::fs::write(&empty, "// no polyfills\n")?;
        empty
    };

    // Framework and app: empty — app is eval'd at runtime via VELOX_APP_JS
    let empty_js = PathBuf::from("target/velox/empty.js");
    std::fs::write(&empty_js, "// not snapshotted — eval'd at runtime\n")?;

    // Absolute path so VELOX_APP_SNAPSHOT works from any build.rs working directory
    let snapshot_out = std::env::current_dir()?
        .join(format!("target/velox/{project_name}.snapshot"));

    let snapshot_bin = find_or_build_snapshot_binary()?;

    println!("Creating V8 snapshot (stubs + polyfills)...");
    let status = Command::new(&snapshot_bin)
        .args([
            polyfills_arg.as_os_str(),
            empty_js.as_os_str(),   // framework: empty
            empty_js.as_os_str(),   // app: empty (eval'd at runtime)
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

/// Locate the `velox-snapshot` binary, building it from source if necessary.
fn find_or_build_snapshot_binary() -> Result<PathBuf> {
    let velox_home = velox_home()?;
    let bin_name = if cfg!(target_os = "windows") { "velox-snapshot.exe" } else { "velox-snapshot" };

    // Prefer release, fall back to debug
    for profile in &["release", "debug"] {
        let path = velox_home.join("target").join(profile).join(bin_name);
        if path.exists() { return Ok(path); }
    }

    // Not found — build it (one-time cost)
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

fn cmd_package(target: Option<&str>) -> Result<()> {
    let project_name = read_project_name()
        .context("Run `velox package` from the project root")?;
    let os = target.unwrap_or(host_os());
    let rust_target = platform_to_rust_target(os)?;
    let bin_src = resolve_packaged_binary(&project_name, &rust_target, target.is_some())?;
    std::fs::create_dir_all("target/velox/dist")?;
    match os {
        "windows" => package_windows(&project_name, &bin_src)?,
        "macos"   => package_macos(&project_name, &bin_src)?,
        "linux"   => package_linux(&project_name, &bin_src)?,
        other     => bail!("Unknown target OS: {other}. Use: windows, macos, linux"),
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
    std::fs::copy(bin, app_dir.join(&exe_name)).with_context(|| format!("copy {}", bin.display()))?;
    copy_runtime_files(&app_dir)?;
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
    let app_dir = format!("target/velox/dist/{name}.app/Contents/MacOS");
    std::fs::create_dir_all(&app_dir)?;
    let dest = format!("{app_dir}/{name}");
    std::fs::copy(bin, &dest)?;
    let plist = format!(r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key><string>{name}</string>
    <key>CFBundleIdentifier</key><string>com.velox.{name}</string>
    <key>CFBundleName</key><string>{name}</string>
    <key>CFBundleVersion</key><string>1.0</string>
</dict>
</plist>"#);
    write_file(format!("target/velox/dist/{name}.app/Contents/Info.plist"), &plist)?;
    println!("✓ Package: target/velox/dist/{name}.app");
    Ok(())
}

fn package_linux(name: &str, bin: &Path) -> Result<()> {
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
    Ok(())
}

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
            "--minify",                                   // dead-code elim + name mangling
            "--define", "process.env.NODE_ENV='production'", // React prod build (no dev warnings)
        ])
        .status()
        .context("Failed to run `bun build`")?;
    if !status.success() { bail!("bun build failed"); }
    Ok(PathBuf::from(bundle_out))
}

fn velox_home() -> Result<PathBuf> {
    // Primary: use the path baked in at compile time.
    // CARGO_MANIFEST_DIR = crates/velox-cli/ → parent = crates/ → parent = workspace root.
    // This is the only reliable path when the binary is installed via `cargo install`
    // to ~/.cargo/bin/ (traversing up from there will never find the velox workspace).
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

    // Fallback: traverse up from the executable (works when running from workspace target/).
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

fn read_project_name() -> Option<String> {
    let src = std::fs::read_to_string("Cargo.toml").ok()?;
    for line in src.lines() {
        let line = line.trim();
        if line.starts_with("name") {
            if let Some(val) = line.splitn(2, '=').nth(1) {
                return Some(val.trim().trim_matches('"').to_string());
            }
        }
    }
    None
}

fn read_dev_config() -> Option<(String, String)> {
    #[derive(serde::Deserialize)]
    struct Cfg { dev: Option<DevSection> }
    #[derive(serde::Deserialize)]
    struct DevSection { entry: Option<String>, output: Option<String> }
    let src = std::fs::read_to_string("velox.config.json").ok()?;
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
    // Read build mode written by `velox build` to decide what to ship
    let build_mode = std::fs::read_to_string("target/velox/build-mode")
        .unwrap_or_else(|_| "portable".into());
    let is_snapshot = build_mode.trim() == "snapshot";

    // Snapshot mode: config + JS are baked into the binary — ship nothing external
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