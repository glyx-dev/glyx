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

// ── CLI definition ────────────────────────────────────────────────────────────

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
    /// Scaffold a new Velox project in a new directory
    Create {
        /// Name of the project (also the directory name)
        name: String,
    },

    /// Start the development server with hot reload
    Dev,

    /// Build a production binary
    Build {
        /// Target OS: windows, macos, linux (defaults to current host)
        #[arg(long)]
        target: Option<String>,
    },

    /// Create a distributable package for the built binary
    Package {
        /// Target OS: windows, macos, linux (defaults to current host)
        #[arg(long)]
        target: Option<String>,
    },
}

// ── Entry point ───────────────────────────────────────────────────────────────

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
        Commands::Build { target }  => cmd_build(target.as_deref()),
        Commands::Package { target } => cmd_package(target.as_deref()),
    }
}

// ── velox create ─────────────────────────────────────────────────────────────

fn cmd_create(name: &str) -> Result<()> {
    let dest = PathBuf::from(name);
    if dest.exists() {
        bail!("directory '{}' already exists", name);
    }

    // Determine where velox crates live (sibling `crates/` next to the binary)
    let velox_home = velox_home()?;

    println!("Creating Velox project: {name}");

    // Directory structure
    std::fs::create_dir_all(dest.join("src"))?;
    std::fs::create_dir_all(dest.join("js"))?;

    // velox-core / velox-shell deps are path-relative from new project dir
    let core_path  = relpath(&dest, &velox_home.join("crates/velox-core"));
    let shell_path = relpath(&dest, &velox_home.join("crates/velox-shell"));

    // ── Cargo.toml ─────────────────────────────────────────────────────────
    write_file(dest.join("Cargo.toml"), &format!(
        r#"[package]
name    = "{name}"
version = "0.1.0"
edition = "2021"

[dependencies]
velox-core  = {{ path = "{core_path}" }}
velox-shell = {{ path = "{shell_path}" }}
env_logger  = "0.11"
"#
    ))?;

    // ── src/main.rs ────────────────────────────────────────────────────────
    write_file(dest.join("src/main.rs"), &format!(
        r#"#![cfg_attr(target_os = "windows", windows_subsystem = "windows")]

fn main() {{
    velox_core::run(velox_core::AppConfig::from_config());
}}
"#
    ))?;

    // ── js/polyfills.js ────────────────────────────────────────────────────
    write_file(dest.join("js/polyfills.js"), POLYFILLS_JS)?;

    // ── js/app.jsx ─────────────────────────────────────────────────────────
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
"#
    ))?;

    // ── velox.config.json ──────────────────────────────────────────────────
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
"#
    ))?;

    // ── package.json (bun workspace) ───────────────────────────────────────
    let react_path   = relpath(&dest, &velox_home.join("js/packages/@velox/react"));
    let router_path  = relpath(&dest, &velox_home.join("js/packages/@velox/router"));
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
"#
    ))?;

    // ── .gitignore ─────────────────────────────────────────────────────────
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

// ── velox dev ─────────────────────────────────────────────────────────────────

fn cmd_dev() -> Result<()> {
    // Read project name from Cargo.toml
    let project_name = read_project_name()
        .context("Run `velox dev` from the project root (where Cargo.toml lives)")?;

    // Run an initial bun build so app.js exists before cargo starts watching
    let cfg = read_dev_config();
    if let Some((entry, output)) = &cfg {
        println!("Building JS: {} → {}", entry, output);
        bun_build(entry, output).context("Initial bun build failed")?;
        println!("✓ JS built");
    }

    println!("Starting dev server for '{project_name}' (hot reload active)...");
    println!("  Press Ctrl+Shift+D inside the window to toggle the dev overlay");

    // velox-core's built-in dev mode handles the watcher; we just spawn cargo run
    let status = Command::new("cargo")
        .args(["run", "-p", &project_name])
        .env("RUST_LOG", std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
        .status()
        .context("Failed to run `cargo run`; is Rust installed?")?;

    std::process::exit(status.code().unwrap_or(1));
}

// ── velox build ───────────────────────────────────────────────────────────────

fn cmd_build(target: Option<&str>) -> Result<()> {
    let project_name = read_project_name()
        .context("Run `velox build` from the project root (where Cargo.toml lives)")?;

    // Step 1: bun bundle
    let cfg = read_dev_config();
    if let Some((entry, output)) = &cfg {
        println!("Bundling JS: {} → {}", entry, output);
        bun_build(entry, output).context("bun build failed")?;
        println!("✓ JS bundled");
    } else {
        println!("⚠ No dev.entry/dev.output in velox.config.json — skipping JS bundle");
    }

    // Step 2: cargo build --release [--target <triple>]
    let rust_target = target.map(platform_to_rust_target).transpose()?;

    let mut args = vec!["build", "--release", "-p", &project_name];
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

    let status = Command::new("cargo")
        .args(&args)
        .env("RUST_LOG", "warn")
        .status()
        .context("Failed to run `cargo build`")?;

    if !status.success() {
        bail!("cargo build failed");
    }

    let bin_path = if let Some(ref t) = rust_target {
        PathBuf::from(format!("target/{}/release/{}", t, binary_name(&project_name)))
    } else {
        PathBuf::from(format!("target/release/{}", binary_name(&project_name)))
    };

    println!();
    println!("✓ Build complete: {}", bin_path.display());
    Ok(())
}

// ── velox package ─────────────────────────────────────────────────────────────

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

    if let Some(workspace_root) = find_workspace_root()? {
        let workspace_candidate = workspace_root.join(&rel);
        if !candidates.iter().any(|p| p == &workspace_candidate) {
            candidates.push(workspace_candidate);
        }
    }

    for candidate in &candidates {
        if candidate.exists() {
            return Ok(candidate.clone());
        }
    }

    let searched = candidates
        .iter()
        .map(|p| p.display().to_string())
        .collect::<Vec<_>>()
        .join(", ");
    bail!("Binary not found. Run `velox build` first. Searched: {searched}");
}

fn package_windows(name: &str, bin: &Path) -> Result<()> {
    let dist_root = PathBuf::from("target/velox/dist");
    let app_dir = dist_root.join(format!("{name}-windows"));
    if app_dir.exists() {
        std::fs::remove_dir_all(&app_dir)
            .with_context(|| format!("remove {}", app_dir.display()))?;
    }
    std::fs::create_dir_all(&app_dir)?;

    let exe_name = binary_name(name);
    std::fs::copy(bin, app_dir.join(&exe_name))
        .with_context(|| format!("copy {}", bin.display()))?;
    copy_runtime_files(&app_dir)?;

    // Create a simple ZIP archive containing the packaged app folder
    let zip_path = format!("target/velox/dist/{name}-windows.zip");
    println!("Packaging for Windows: {zip_path}");

    let status = Command::new("powershell")
        .args([
            "-Command",
            &format!(
                "Compress-Archive -Path '{}\\*' -DestinationPath '{}' -Force",
                app_dir.display(), zip_path
            ),
        ])
        .status();

    match status {
        Ok(s) if s.success() => {
            println!("✓ Package: {zip_path}");
            println!("  Unzip and run {exe_name} from the extracted folder");
            println!("  (Full NSIS/WiX installer coming in a future release)");
        }
        _ => {
            println!("✓ Folder: {}", app_dir.display());
        }
    }
    Ok(())
}

fn package_macos(name: &str, bin: &Path) -> Result<()> {
    // Create a minimal .app bundle
    let app_dir = format!("target/velox/dist/{name}.app/Contents/MacOS");
    std::fs::create_dir_all(&app_dir)?;
    let dest = format!("{app_dir}/{name}");
    std::fs::copy(bin, &dest)?;

    // Minimal Info.plist
    let plist = format!(
        r#"<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key><string>{name}</string>
    <key>CFBundleIdentifier</key><string>com.velox.{name}</string>
    <key>CFBundleName</key><string>{name}</string>
    <key>CFBundleVersion</key><string>1.0</string>
</dict>
</plist>"#
    );
    write_file(
        format!("target/velox/dist/{name}.app/Contents/Info.plist"),
        &plist,
    )?;

    println!("✓ Package: target/velox/dist/{name}.app");
    println!("  (DMG creation coming in a future release)");
    Ok(())
}

fn package_linux(name: &str, bin: &Path) -> Result<()> {
    // Create a .tar.gz archive
    let archive = format!("target/velox/dist/{name}-linux.tar.gz");
    println!("Packaging for Linux: {archive}");

    let status = Command::new("tar")
        .args(["-czf", &archive, "-C", bin.parent().unwrap().to_str().unwrap(), &binary_name(name)])
        .status();

    match status {
        Ok(s) if s.success() => {
            println!("✓ Package: {archive}");
            println!("  (deb/rpm packages coming in a future release)");
        }
        _ => {
            let dest = format!("target/velox/dist/{name}");
            std::fs::copy(bin, &dest)?;
            println!("✓ Binary: {dest}");
        }
    }
    Ok(())
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/// Find the velox project root from the CLI binary's location.
/// Expects: <velox_home>/target/[debug|release]/velox(.exe)
/// Returns: <velox_home>
fn velox_home() -> Result<PathBuf> {
    // Walk up from the binary until we find a Cargo.toml with workspace members
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
        if dir.parent().is_none() {
            break;
        }
    }
    // Fallback: use cwd
    Ok(std::env::current_dir()?)
}

/// Return a relative path string from `from_dir` to `to`.
fn relpath(from_dir: &Path, to: &Path) -> String {
    // Simple approach: canonicalize or use relative traversal
    let from = from_dir.canonicalize().unwrap_or_else(|_| from_dir.to_path_buf());
    let to   = to.canonicalize().unwrap_or_else(|_| to.to_path_buf());

    // Count how many levels up we need to go
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

/// Read the [package] name from the Cargo.toml in cwd.
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

/// Read dev.entry + dev.output from velox.config.json.
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

/// Run `bun build` to bundle jsx → js.
/// On Windows, bun is a .cmd shim and requires cmd.exe to resolve.
fn bun_build(entry: &str, output: &str) -> Result<()> {
    let mut cmd = if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.args(["/C", "bun", "build"]);
        c
    } else {
        let mut c = Command::new("bun");
        c.arg("build");
        c
    };

    let status = cmd
        .arg(entry)
        .args(["--outfile", output, "--target", "browser", "--format", "iife",
               "--define", "process.env.NODE_ENV='production'"])
        .status()
        .context("Failed to run `bun`; is Bun installed? https://bun.sh")?;

    if !status.success() {
        bail!("bun build failed");
    }
    Ok(())
}

/// Map a human-readable OS name to a Rust target triple.
fn platform_to_rust_target(os: &str) -> Result<String> {
    Ok(match os {
        "windows"     => "x86_64-pc-windows-msvc".into(),
        "windows-arm" => "aarch64-pc-windows-msvc".into(),
        "macos"       => "aarch64-apple-darwin".into(),
        "macos-x64"   => "x86_64-apple-darwin".into(),
        "linux"       => "x86_64-unknown-linux-gnu".into(),
        "linux-arm"   => "aarch64-unknown-linux-gnu".into(),
        other         => bail!(
            "Unknown target: '{other}'. Use: windows, macos, linux, linux-arm, macos-x64"
        ),
    })
}

/// Check that the required Rust target is installed, and offer to install it.
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
        if !status.success() {
            bail!("Failed to install target '{target}'. Run: rustup target add {target}");
        }
    }
    Ok(())
}

/// Return the platform binary name (adds .exe on Windows).
fn binary_name(name: &str) -> String {
    if cfg!(target_os = "windows") { format!("{name}.exe") } else { name.to_string() }
}

/// Return the host OS string matching our target names.
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
            if content.contains("[workspace]") {
                return Ok(Some(dir));
            }
        }
        match dir.parent() {
            Some(parent) => dir = parent.to_path_buf(),
            None => return Ok(None),
        }
    }
}

fn copy_runtime_files(dest_root: &Path) -> Result<()> {
    let config = PathBuf::from("velox.config.json");
    if config.exists() {
        let dest = dest_root.join("velox.config.json");
        std::fs::copy(&config, &dest)
            .with_context(|| format!("copy {}", config.display()))?;
    }

    let js_dir = PathBuf::from("js");
    if js_dir.exists() {
        copy_dir_all(&js_dir, &dest_root.join("js"))?;
    }

    let assets_dir = PathBuf::from("assets");
    if assets_dir.exists() {
        copy_dir_all(&assets_dir, &dest_root.join("assets"))?;
    }

    let migrations_dir = PathBuf::from("migrations");
    if migrations_dir.exists() {
        copy_dir_all(&migrations_dir, &dest_root.join("migrations"))?;
    }

    Ok(())
}

fn copy_dir_all(src: &Path, dst: &Path) -> Result<()> {
    std::fs::create_dir_all(dst)
        .with_context(|| format!("create {}", dst.display()))?;

    for entry in std::fs::read_dir(src)
        .with_context(|| format!("read {}", src.display()))?
    {
        let entry = entry?;
        let ty = entry.file_type()?;
        let dest_path = dst.join(entry.file_name());
        if ty.is_dir() {
            copy_dir_all(&entry.path(), &dest_path)?;
        } else {
            std::fs::copy(entry.path(), &dest_path)
                .with_context(|| format!("copy {}", entry.path().display()))?;
        }
    }
    Ok(())
}

fn write_file(path: impl AsRef<Path>, content: &str) -> Result<()> {
    let path = path.as_ref();
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent)?;
    }
    std::fs::write(path, content).with_context(|| format!("write {}", path.display()))
}

// ── Polyfills (embedded in the CLI, written into new projects) ────────────────

const POLYFILLS_JS: &str = r#"// V8 environment polyfills
//
// rusty_v8 runs a bare V8 isolate — no browser or Node globals.
// React's scheduler needs performance.now(), setTimeout, clearTimeout,
// and MessageChannel. We provide minimal stubs here.
//
// This file is imported FIRST in app.jsx so these globals exist before
// react-reconciler initialises its scheduler.

if (typeof performance === 'undefined') {
  globalThis.performance = {
    now: () => Number(__velox_getTime()),
  };
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
      ch.port1 = {
        onmessage: null,
        postMessage(msg) { ch.port2.onmessage?.({ data: msg }); },
      };
      ch.port2 = {
        onmessage: null,
        postMessage(msg) { ch.port1.onmessage?.({ data: msg }); },
      };
    }
  };
}
"#;
