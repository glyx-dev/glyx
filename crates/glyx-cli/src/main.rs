//! glyx — CLI for the Glyx desktop app framework.
//!
//! Commands:
//!   glyx create <name> [--native]       Scaffold a new project
//!   glyx dev                            Start dev server with hot reload
//!   glyx build [--target <os>]          Production build (bun → runner/cargo)
//!   glyx package [--target <os>]        Create distributable installer/archive
//!   glyx runtime list|build|install     Manage cached glyx-runner binaries

use anyhow::{bail, Context, Result};
use clap::{Parser, Subcommand};
use std::path::{Path, PathBuf};
use std::process::Command;

mod cmd_create;
mod cmd_dev;
mod cmd_build;
mod cmd_package;
mod cmd_check;
mod cmd_test;
mod cmd_generate;
mod cmd_runtime;
pub mod pm;

use self::cmd_create::*;
use self::cmd_dev::*;
use self::cmd_build::*;
use self::cmd_package::*;
use self::cmd_check::*;
use self::cmd_test::*;
use self::cmd_generate::*;
use self::cmd_runtime::*;

/// Default Glyx logo embedded so `glyx package` always produces an icon even
/// when the app doesn't configure one in `glyx.config.json`.
static DEFAULT_ICON_PNG: &[u8] = include_bytes!("../../../glyx.png");

#[derive(Parser)]
#[command(
    name    = "glyx",
    // --pm is a global flag accepted before any subcommand.
    about   = "Build desktop apps with React + Rust",
    long_about = "Glyx — build fast, native desktop apps with React + Rust.\n\
                  GPU-rendered (wgpu), no WebView, no Electron.\n\n\
                  Docs: https://glyx.dev/docs",
    version,
    propagate_version = true,
    after_help = "EXAMPLES:\n  \
        glyx create my-app                    Scaffold a JS-only project\n  \
        glyx create my-app --template notes   Start from the notes template\n  \
        glyx dev                              Run with hot reload\n  \
        glyx dev --inspect                    Attach Chrome DevTools (port 9229)\n  \
        glyx build                            Self-contained release binary\n  \
        glyx build --check-performance        Build + enforce 60fps frame budget\n  \
        glyx package --installer              Native installer for this OS\n\n\
        Run 'glyx <command> --help' for details on a command.",
)]
struct Cli {
    /// Package manager to use: bun, npm, pnpm, yarn.
    /// Overrides auto-detection (lockfile sniff → which probe).
    #[arg(long, global = true, value_name = "PM")]
    pm: Option<String>,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Scaffold a new Glyx project
    ///
    /// Creates a ready-to-run project: src/app.jsx entry, glyx.config.ts,
    /// package.json wired to the Glyx packages, and .gitignore.
    ///
    /// By default the project is JS-only — it runs on a prebuilt glyx-runner
    /// binary, so no Rust toolchain is required. Use --native to generate a
    /// full Rust workspace instead (needed for custom native extensions).
    ///
    /// After creating: cd <name> && <pm> install && glyx dev
    Create {
        /// Project name (also used as the directory name)
        name: String,
        /// Generate a full Rust workspace with Cargo.toml and src/main.rs.
        /// Required if you want to add custom GlyxExtension implementations
        /// or native backend commands (glyx generate command). Needs Rust.
        #[arg(long)]
        native: bool,
        /// Starter template
        ///
        /// blank     — minimal counter app with the Glyx logo (default)
        /// notes     — sidebar + content layout with navigation
        /// dashboard — stat cards, sidebar nav, data display
        /// settings  — preferences panel with sections and toggles
        #[arg(long, default_value = "blank", value_name = "TEMPLATE",
              value_parser = ["blank", "notes", "dashboard", "settings"],
              verbatim_doc_comment)]
        template: String,
    },
    /// Start the dev server with hot reload
    ///
    /// Builds the JS bundle, opens the native window, and reloads on every
    /// file save (typically <100ms). JS-only projects launch the cached dev
    /// runner; --native projects compile and run via cargo.
    ///
    /// Run from the project root (where glyx.config.ts lives).
    Dev {
        /// Enable the Chrome DevTools Protocol inspector for JS debugging.
        /// Optionally pass a port (default 9229). Then open chrome://inspect
        /// in Chrome and add 127.0.0.1:<port> under "Discover network targets"
        /// to set breakpoints and profile.
        #[arg(long, value_name = "PORT", num_args = 0..=1, default_missing_value = "9229")]
        inspect: Option<u16>,
    },
    /// Produce a production build
    ///
    /// Three modes (pick at most one):
    ///   (default) snapshot — one self-contained exe: V8 snapshot + app JS +
    ///             config embedded. Fastest startup, no external files.
    ///   --bundle   binary + minified js/app.js alongside. Update the JS by
    ///             replacing one file — no recompile.
    ///   --portable binary + readable JS files alongside. Easiest to patch.
    ///
    /// Output lands in target/release/. Pass a target OS to cross-compile.
    #[command(verbatim_doc_comment)]
    Build {
        /// Target OS to cross-compile for (windows, macos, linux).
        /// Defaults to the host platform.
        target: Option<String>,
        /// Embed V8 snapshot in the binary — self-contained exe, fastest
        /// startup. This is the default mode; the flag exists for symmetry.
        #[arg(long, conflicts_with_all = ["bundle", "portable"])]
        snapshot: bool,
        /// Ship a minified JS bundle alongside the binary — update JS without
        /// recompiling Rust
        #[arg(long, conflicts_with = "portable")]
        bundle: bool,
        /// Ship readable JS files alongside the binary — easiest to inspect
        /// and patch in the field
        #[arg(long)]
        portable: bool,
        /// After building, launch the app and fail (exit 1) if any frame
        /// exceeds the frame-time budget. Useful as a CI performance gate.
        #[arg(long)]
        check_performance: bool,
        /// Frame-time budget in milliseconds for --check-performance
        /// (16.667 = 60fps, 8.333 = 120fps)
        #[arg(long, default_value = "16.667", value_name = "MS")]
        perf_budget: f64,
        /// How many seconds to run the app during --check-performance
        #[arg(long, default_value = "10", value_name = "SECONDS")]
        perf_duration: u64,
    },
    /// Create a distributable package or installer
    ///
    /// Run 'glyx build' first. Wraps the release binary with its runtime
    /// files, icon, and licenses into a shippable artifact in target/glyx/dist/.
    ///
    /// Default artifacts: .zip (Windows), .tar.gz (Linux), .app (macOS).
    ///
    /// With --installer: NSIS Setup .exe on Windows (NSIS and rcedit are
    /// downloaded and cached automatically on first use — nothing to install),
    /// AppImage on Linux (requires appimagetool), DMG on macOS (built-in
    /// hdiutil).
    ///
    /// Also handles: embedding the app icon into the exe, deep-link URL scheme
    /// registration, Start Menu / Desktop shortcuts, and Add/Remove Programs
    /// entries (Windows installer).
    Package {
        /// Target OS (windows, macos, linux). Defaults to the host OS.
        target: Option<String>,
        /// Build a native installer instead of a zip/tarball
        #[arg(long)]
        installer: bool,
    },
    /// Manage cached glyx-runner binaries
    ///
    /// JS-only projects run on prebuilt glyx-runner binaries cached in
    /// ~/.glyx/runners/ (dev = hot reload + overlay, prod = lean).
    Runtime {
        #[command(subcommand)]
        cmd: RuntimeCommands,
    },
    /// Generate boilerplate for Glyx features
    Generate {
        #[command(subcommand)]
        cmd: GenerateCommands,
    },
    /// Check the project for errors without building
    ///
    /// Runs fast type-checking and config validation:
    ///   - Validates glyx.config.ts (resolves + checks required fields)
    ///   - TypeScript type check via `<pm> tsc --noEmit` (if tsconfig.json exists)
    ///   - `cargo check` for native projects (type-checks Rust without linking)
    ///
    /// Much faster than `glyx build` — use this in CI or as a pre-commit check.
    Check {
        /// Only validate glyx.config.ts — skip TS and Rust checks
        #[arg(long)]
        config_only: bool,
    },
    /// Run tests
    ///
    /// For JS projects:   `<pm> test` (uses @glyx-dev/testing stubs)
    /// For native projects: `cargo test` + `<pm> test`
    ///
    /// Pass --js or --rust to run only one side.
    Test {
        /// Run only the JS test suite
        #[arg(long, conflicts_with = "rust")]
        js: bool,
        /// Run only the Rust test suite (cargo test)
        #[arg(long, conflicts_with = "js")]
        rust: bool,
        /// Extra args passed through to the JS test runner
        #[arg(trailing_var_arg = true, allow_hyphen_values = true)]
        args: Vec<String>,
    },
    /// Build capability DLLs declared in glyx.config
    ///
    /// Reads `capabilities` from glyx.config, builds the matching
    /// `glyx-cap-<name>` crate as a shared library, copies it to `dest`
    /// (default: current directory), and regenerates glyx-caps.lock.
    ///
    /// Use this after first clone or whenever you update a cap crate without
    /// doing a full `glyx build`.  The DLLs must live next to the glyx-runner
    /// binary at runtime.
    ///
    /// Example:
    ///   glyx caps build              # builds all declared caps → ./
    ///   glyx caps build --dest dist  # put DLLs in ./dist/
    Caps {
        #[command(subcommand)]
        cmd: CapsCommands,
    },
}

#[derive(Subcommand)]
enum CapsCommands {
    /// Build all cap DLLs declared in glyx.config and copy them to dest
    Build {
        /// Directory to copy DLLs into (default: current directory)
        #[arg(long, default_value = ".")]
        dest: std::path::PathBuf,
        /// Target OS to cross-compile for (windows, macos, linux)
        target: Option<String>,
    },
}

#[derive(Subcommand)]
enum GenerateCommands {
    /// Scaffold a new native backend command (requires --native project).
    ///
    /// Creates `src-glyx/commands/<name>.rs` with a typed async handler and
    /// prints the JS usage so you can call `await backend.<name>(args)` from
    /// any React component.
    Command {
        /// Command name in camelCase (e.g. `fetchUser`). Snake-case is also accepted.
        name: String,
    },
    /// Scaffold a new JS plugin for the `plugins` array in glyx.config.json.
    ///
    /// Creates `src/plugins/<name>.plugin.js` with example async exports and
    /// prints the config snippet to add to glyx.config.json.
    Plugin {
        /// Plugin name used as the namespace (e.g. `db`, `api`, `auth`).
        name: String,
    },
}

#[derive(Subcommand)]
enum RuntimeCommands {
    /// List cached glyx-runner binaries with their sizes and locations
    List,
    /// Build both runners (dev + prod) from source and cache them in ~/.glyx/runners/
    Build {
        /// Delete any cached runner binaries before building, forcing a clean rebuild.
        #[arg(long)]
        force: bool,
    },
    /// Install a specific glyx-runner version.
    /// Currently builds from source; prebuilt downloads are planned.
    Install {
        /// Version to install (defaults to the local workspace version)
        version: Option<String>,
    },
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

    // Detect package manager once; all subcommands use this value.
    let config_json = resolve_config_json().unwrap_or_default();
    let pm = pm::detect(cli.pm.as_deref(), &config_json)?;

    match cli.command {
        Commands::Create { name, native, template } => cmd_create(&name, native, &template, pm),
        Commands::Dev { inspect }         => cmd_dev(inspect, pm),
        Commands::Build { target, snapshot: _, bundle, portable, check_performance, perf_budget, perf_duration } => {
            let mode = if bundle { "bundle" } else if portable { "portable" } else { "snapshot" };
            cmd_build(target.as_deref(), mode, check_performance, perf_budget, perf_duration, pm)
        }
        Commands::Package { target, installer } => cmd_package(target.as_deref(), installer),
        Commands::Runtime { cmd }         => cmd_runtime(cmd),
        Commands::Generate { cmd }        => cmd_generate(cmd),
        Commands::Check { config_only }   => cmd_check(config_only, pm),
        Commands::Test { js, rust, args } => cmd_test(js, rust, &args, pm),
        Commands::Caps { cmd } => match cmd {
            CapsCommands::Build { dest, target } => {
                let caps = read_capabilities_from_config();
                if caps.is_empty() {
                    println!("No capabilities declared in glyx.config — nothing to build.");
                    return Ok(());
                }
                println!("Building {} cap DLL(s): {}", caps.len(), caps.join(", "));
                cmd_build::build_cap_dlls(&caps, target.as_deref(), &dest)
                    .context("cap DLL build failed")?;
                write_caps_lock(&dest).context("failed to write glyx-caps.lock")?;
                println!("Done. DLLs and glyx-caps.lock written to {}", dest.display());
                Ok(())
            }
        },
    }
}

// ── Runner management ─────────────────────────────────────────────────────────

/// Find or build the glyx-runner binary.
///
/// `dev_mode = true`  → runner with "dev" feature (hot-reload + overlay); debug build
/// `dev_mode = false` → runner without "dev" feature (lean production binary); release build
///
/// Search order:
///   1. ~/.glyx/runners/{dev|prod}/glyx-runner[.exe]  (cached)
///   2. glyx_home/target/{debug|release}/glyx-runner[.exe]  (workspace)
///   3. Download the prebuilt runner from GitHub Releases → cache
///   4. Build from source → copy to cache
fn find_or_build_runner(dev_mode: bool) -> Result<PathBuf> {
    let profile = if dev_mode { "dev" } else { "prod" };
    let bin_name = runner_bin_name();

    // 1. Check user cache
    let cache_dir = glyx_runners_dir().join(profile);
    let cached    = cache_dir.join(bin_name);
    if cached.exists() { return Ok(cached); }

    // 2. Check glyx workspace target/ (fastest for developers inside the workspace)
    if let Ok(home) = glyx_home() {
        let ws_profile = if dev_mode { "debug" } else { "release" };
        let ws_bin = home.join("target").join(ws_profile).join(bin_name);
        if ws_bin.exists() { return Ok(ws_bin); }
    }

    // 3. Download the prebuilt runner for this CLI version from GitHub
    //    Releases — the NORMAL path for users who installed the CLI binary
    //    and don't have the glyx source workspace.  Falls through to a
    //    source build (workspace devs) if unavailable.
    if download_runner(profile, &cached).unwrap_or(false) {
        return Ok(cached);
    }

    // 4. Build from source
    let home = glyx_home().context("Cannot locate glyx workspace — needed to build glyx-runner")?;
    let label = if dev_mode { "dev (with hot-reload)" } else { "prod (lean)" };
    println!("Building glyx-runner [{label}] from source (first-run, one-time cost)...");

    let mut args = vec!["build", "-p", "glyx-runner"];
    if !dev_mode { args.push("--release"); args.push("--no-default-features"); }

    let status = Command::new("cargo")
        .args(&args)
        .current_dir(&home)
        .status()
        .context("Failed to run `cargo build -p glyx-runner`")?;
    if !status.success() { bail!("Failed to build glyx-runner"); }

    let built = if dev_mode {
        home.join("target/debug").join(bin_name)
    } else {
        home.join("target/release").join(bin_name)
    };

    if !built.exists() {
        bail!("glyx-runner binary not found at {} after build", built.display());
    }

    // Cache it for future use
    std::fs::create_dir_all(&cache_dir)
        .with_context(|| format!("create cache dir {}", cache_dir.display()))?;
    std::fs::copy(&built, &cached)
        .with_context(|| format!("cache runner to {}", cached.display()))?;

    println!("✓ glyx-runner [{profile}] cached at {}", cached.display());
    Ok(cached)
}

/// The release-artifact target triple for the running CLI, or None on
/// platforms we don't publish binaries for (falls back to source build).
fn release_target() -> Option<&'static str> {
    if cfg!(all(target_os = "windows", target_arch = "x86_64")) {
        Some("x86_64-pc-windows-msvc")
    } else if cfg!(all(target_os = "macos", target_arch = "aarch64")) {
        Some("aarch64-apple-darwin")
    } else if cfg!(all(target_os = "macos", target_arch = "x86_64")) {
        Some("x86_64-apple-darwin")
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        Some("x86_64-unknown-linux-gnu")
    } else {
        None
    }
}

/// Download the prebuilt glyx-runner artifact matching this CLI's version
/// from GitHub Releases into `dest`.  Returns Ok(true) on success, Ok(false)
/// when the artifact isn't available (offline, unsupported platform, 404) —
/// the caller then falls through to building from source.
fn download_runner(profile: &str, dest: &std::path::Path) -> Result<bool> {
    let Some(target) = release_target() else { return Ok(false) };
    let suffix = if cfg!(windows) { ".exe" } else { "" };
    // Release ships two runner flavors: lean prod and dev (hot-reload + overlay).
    let artifact = if profile == "dev" {
        format!("glyx-runner-dev-{target}{suffix}")
    } else {
        format!("glyx-runner-{target}{suffix}")
    };
    let version = env!("CARGO_PKG_VERSION");
    let urls = [
        format!("https://github.com/glyx-dev/glyx/releases/download/v{version}/{artifact}"),
        format!("https://github.com/glyx-dev/glyx/releases/latest/download/{artifact}"),
    ];

    for url in &urls {
        println!("Downloading prebuilt glyx-runner [{profile}]…");
        log::info!("  {url}");
        let resp = match ureq::get(url).call() {
            Ok(r) => r,
            Err(e) => { log::info!("  unavailable: {e}"); continue; }
        };
        if let Some(parent) = dest.parent() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("create cache dir {}", parent.display()))?;
        }
        // Write to a temp file then rename — never leave a half-written binary.
        let tmp = dest.with_extension("part");
        let mut file = std::fs::File::create(&tmp)
            .with_context(|| format!("create {}", tmp.display()))?;
        std::io::copy(&mut resp.into_reader(), &mut file)
            .with_context(|| format!("download {url}"))?;
        drop(file);
        #[cfg(unix)]
        {
            use std::os::unix::fs::PermissionsExt;
            std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(0o755))?;
        }
        std::fs::rename(&tmp, dest)?;
        println!("✓ glyx-runner [{profile}] cached at {}", dest.display());
        return Ok(true);
    }
    Ok(false)
}

fn glyx_runners_dir() -> PathBuf {
    // Cross-platform home directory
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    home.join(".glyx").join("runners")
}

fn runner_bin_name() -> &'static str {
    if cfg!(target_os = "windows") { "glyx-runner.exe" } else { "glyx-runner" }
}

// ── Build helpers ─────────────────────────────────────────────────────────────

fn build_app_bundle(project_name: &str, entry: &str, p: pm::Pm) -> Result<PathBuf> {
    let bundle_out = format!("target/glyx/{project_name}.js");
    pm::js_bundle(p, entry, &bundle_out, /*minify=*/true, /*source_map=*/false)?;
    Ok(PathBuf::from(bundle_out))
}

// ── Project detection ─────────────────────────────────────────────────────────

/// Returns true if the current directory is a native Glyx project (has Cargo.toml).
fn is_native_project() -> bool {
    Path::new("Cargo.toml").exists()
}

// ── Helper utilities ──────────────────────────────────────────────────────────

fn glyx_home() -> Result<PathBuf> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    if let Some(workspace) = manifest_dir.parent().and_then(|p| p.parent()) {
        let cargo_toml = workspace.join("Cargo.toml");
        if cargo_toml.exists() {
            let content = std::fs::read_to_string(&cargo_toml).unwrap_or_default();
            if content.contains("[workspace]") && content.contains("glyx-core") {
                return Ok(workspace.to_path_buf());
            }
        }
    }

    let exe = std::env::current_exe().context("Cannot determine executable path")?;
    let mut dir = exe.as_path();
    loop {
        dir = dir.parent().context("Could not find glyx home directory")?;
        let cargo_toml = dir.join("Cargo.toml");
        if cargo_toml.exists() {
            let content = std::fs::read_to_string(&cargo_toml).unwrap_or_default();
            if content.contains("[workspace]") && content.contains("glyx-core") {
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
/// Priority: glyx.config.ts `name` → Cargo.toml `name` → package.json `name`.
/// glyx.config.ts is the canonical source; the others are fallbacks so existing
/// projects without a config `name` continue to work.
fn read_project_name() -> Option<String> {
    // 1. glyx.config.ts `name` field (canonical)
    if let Ok(src) = resolve_config_json() {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&src) {
            if let Some(name) = v["name"].as_str() {
                let name = name.trim();
                if !name.is_empty() { return Some(name.to_string()); }
            }
        }
    }
    // 2. Cargo.toml (native projects — fallback)
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
    // 3. package.json (JS-only projects — fallback)
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
    if Path::new("glyx.config.ts").exists() {
        // Execute glyx.config.ts directly — NOT via `bun run` (which triggers
        // bun's server-detection heuristic on default-exported objects).
        let out = exec_config_ts("glyx.config.ts")?;
        if !out.status.success() {
            bail!("glyx.config.ts execution failed:\n{}", String::from_utf8_lossy(&out.stderr));
        }
        let json = String::from_utf8(out.stdout)
            .context("glyx.config.ts output is not valid UTF-8")?;
        return Ok(json.trim().to_string());
    }
    std::fs::read_to_string("glyx.config.json")
        .context("neither glyx.config.ts nor glyx.config.json found")
}

/// Execute a TypeScript config file and return its output.
/// Uses `bun <file>` (direct execution, no server detection) with `node --import tsx`
/// as a fallback for non-bun environments.
fn exec_config_ts(file: &str) -> std::io::Result<std::process::Output> {
    // Try bun first (native TS support, direct file execution)
    let bun_result = if cfg!(target_os = "windows") {
        std::process::Command::new("cmd").args(["/C", "bun", file]).output()
    } else {
        std::process::Command::new("bun").arg(file).output()
    };
    if let Ok(out) = bun_result {
        if out.status.success() || !out.stdout.is_empty() {
            return Ok(out);
        }
    }
    // Fallback: tsx (works with npm/pnpm/yarn projects that have tsx installed)
    if cfg!(target_os = "windows") {
        std::process::Command::new("cmd").args(["/C", "npx", "tsx", file]).output()
    } else {
        std::process::Command::new("npx").args(["tsx", file]).output()
    }
}

// ── Icon helpers ──────────────────────────────────────────────────────────────

/// Read the `icon` field from glyx.config.json, if declared.
fn read_icon_path() -> Option<String> {
    #[derive(serde::Deserialize)]
    struct Cfg { icon: Option<String> }
    let src = resolve_config_json().ok()?;
    let cfg: Cfg = serde_json::from_str(&src).ok()?;
    cfg.icon
}

/// Publisher / product metadata read from the `app` section of glyx.config.
#[derive(Default)]
struct AppMeta {
    version:     String,
    publisher:   String,
    description: String,
    /// Parsed for config parity; not yet embedded in installer metadata.
    #[allow(dead_code)]
    website:     String,
    /// Path to the app's own license file (relative to project root), e.g. "LICENSE.txt".
    license:     Option<String>,
}

fn read_app_metadata() -> AppMeta {
    #[derive(serde::Deserialize, Default)]
    struct AppSection {
        publisher:   Option<String>,
        description: Option<String>,
        website:     Option<String>,
        license:     Option<String>,
    }
    #[derive(serde::Deserialize, Default)]
    struct Cfg {
        version: Option<String>,
        app:     Option<AppSection>,
    }

    let src = resolve_config_json().unwrap_or_default();
    let cfg: Cfg = serde_json::from_str(&src).unwrap_or_default();
    let a = cfg.app.unwrap_or_default();
    AppMeta {
        version:     cfg.version.unwrap_or_else(|| "1.0.0".into()),
        publisher:   a.publisher.unwrap_or_default(),
        description: a.description.unwrap_or_default(),
        website:     a.website.unwrap_or_default(),
        license:     a.license,
    }
}

/// The Glyx framework MIT license — always included in the installation folder.
const GLYX_LICENSE_TEXT: &str = "\
MIT License

Copyright (c) 2024 Glyx Contributors

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
/// Always writes `glyx.txt`. Copies the app license as `app.txt` if specified.
/// Returns the path to the primary license file to show in the installer EULA screen
/// (app license takes priority over the Glyx license).
fn install_license_files(licenses_dir: &Path, app_license: Option<&str>) -> Result<PathBuf> {
    std::fs::create_dir_all(licenses_dir)?;

    // Glyx framework license — always present
    let glyx_lic = licenses_dir.join("glyx.txt");
    std::fs::write(&glyx_lic, GLYX_LICENSE_TEXT)?;
    println!("  License (Glyx): {}", glyx_lic.display());

    // App license — optional
    if let Some(src) = app_license {
        let src_path = Path::new(src);
        if src_path.exists() {
            let app_lic = licenses_dir.join("app.txt");
            std::fs::copy(src_path, &app_lic)?;
            println!("  License (App):   {}", app_lic.display());
            return Ok(app_lic);  // App license is shown as EULA
        } else {
            println!("  Warning: app.license '{src}' not found — only Glyx license included");
        }
    }

    Ok(glyx_lic)  // Fall back to Glyx license for EULA screen
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

/// Read the deep-link scheme from glyx config, if declared.
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

/// Read `dev.inspect` from glyx.config.ts/.json.
/// Returns `Some(port)` if inspect is enabled, `None` otherwise.
fn read_dev_inspect_port() -> Option<u16> {
    #[derive(serde::Deserialize)]
    struct Cfg { dev: Option<DevSection> }
    #[derive(serde::Deserialize)]
    struct DevSection { inspect: Option<serde_json::Value> }
    let src = resolve_config_json().ok()?;
    let cfg: Cfg = serde_json::from_str(&src).ok()?;
    let inspect = cfg.dev?.inspect?;
    match inspect {
        serde_json::Value::Bool(true)    => Some(9229),
        serde_json::Value::Bool(false)   => None,
        serde_json::Value::Number(n)     => n.as_u64().map(|p| p as u16),
        _                                => None,
    }
}

/// Quick lockfile-only PM sniff used before full detection is available
/// (e.g. when resolving glyx.config.ts, which happens before PM detection).
fn detect_pm_fast() -> pm::Pm {
    if Path::new("bun.lock").exists() || Path::new("bun.lockb").exists() { return pm::Pm::Bun; }
    if Path::new("pnpm-lock.yaml").exists()  { return pm::Pm::Pnpm; }
    if Path::new("package-lock.json").exists() { return pm::Pm::Npm; }
    if Path::new("yarn.lock").exists()       { return pm::Pm::Yarn; }
    pm::Pm::Bun  // safe default — most glyx projects use bun
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
    let build_mode = std::fs::read_to_string("target/glyx/build-mode")
        .unwrap_or_else(|_| "portable".into());
    let is_snapshot = build_mode.trim() == "snapshot";

    if !is_snapshot {
        let config = PathBuf::from("glyx.config.json");
        if config.exists() {
            std::fs::copy(&config, dest_root.join("glyx.config.json"))
                .with_context(|| format!("copy {}", config.display()))?;
        }
        let js_dir = PathBuf::from("js");
        if js_dir.exists() { copy_dir_all(&js_dir, &dest_root.join("js"))?; }
    }
    let assets_dir = PathBuf::from("assets");
    if assets_dir.exists() { copy_dir_all(&assets_dir, &dest_root.join("assets"))?; }
    let migrations_dir = PathBuf::from("migrations");
    if migrations_dir.exists() { copy_dir_all(&migrations_dir, &dest_root.join("migrations"))?; }

    // Hash any capability modules present in the project root and write
    // glyx-caps.lock next to the exe so the runtime can verify them at startup.
    write_caps_lock(dest_root)?;

    Ok(())
}

/// Read the `capabilities` object from glyx.config (e.g. `{ "audio": true, "camera": false }`).
/// Returns the full known set when the config has no capabilities key.
fn read_capabilities_from_config() -> Vec<String> {
    let known = ["audio", "ai", "camera", "gamepad", "hid"];
    let src = resolve_config_json().unwrap_or_default();
    let v: serde_json::Value = serde_json::from_str(&src).unwrap_or_default();
    match v.get("capabilities").and_then(|c| c.as_object()) {
        Some(obj) => known.iter()
            .filter(|k| obj.get(**k).and_then(|v| v.as_bool()).unwrap_or(false))
            .map(|k| k.to_string())
            .collect(),
        None => known.iter().map(|s| s.to_string()).collect(),
    }
}

/// For each capability declared in glyx.config `capabilities[]`, look for the
/// matching `glyx_cap_<name>.{dll,so,dylib}` in the current directory, compute
/// SHA-256, and write `glyx-caps.lock` into `dest_root` (next to the binary).
fn write_caps_lock(dest_root: &Path) -> Result<()> {
    use sha2::{Sha256, Digest};

    let extensions: &[&str] = if cfg!(target_os = "windows") { &["dll"] }
        else if cfg!(target_os = "macos") { &["dylib"] }
        else { &["so"] };

    let cap_names = read_capabilities_from_config();
    let mut hashes = serde_json::Map::new();

    for cap in &cap_names {
        let stem = format!("glyx_cap_{cap}");
        for ext in extensions {
            // On macOS/Linux the lib prefix is optional depending on how the
            // developer built their module; check both.
            for prefix in &["", "lib"] {
                let filename = format!("{prefix}{stem}.{ext}");
                let path = PathBuf::from(&filename);
                if path.exists() {
                    let bytes = std::fs::read(&path)
                        .with_context(|| format!("read {filename}"))?;
                    let hex = format!("{:x}", Sha256::digest(&bytes));
                    hashes.insert(cap.to_string(), serde_json::Value::String(hex));
                    // Copy the module into the dist dir alongside the binary.
                    std::fs::copy(&path, dest_root.join(&filename))
                        .with_context(|| format!("copy {filename} to dist"))?;
                    println!("Capability module: {filename} (hash pinned in glyx-caps.lock)");
                    break;
                }
            }
        }
    }

    if !hashes.is_empty() {
        let count = hashes.len();
        let lock = serde_json::to_string_pretty(&serde_json::Value::Object(hashes))?;
        std::fs::write(dest_root.join("glyx-caps.lock"), lock)
            .context("write glyx-caps.lock")?;
        println!("glyx-caps.lock written ({count} module(s) pinned)");
    }

    Ok(())
}

/// Copy the cached glyx-media DLL **and all FFmpeg runtime DLLs** into `dest_root`
/// when `capabilities.video: true` is declared in glyx.config.json.
fn copy_media_dll_if_needed(dest_root: &Path) -> Result<()> {
    // Capability lives at capabilities.video (or capabilities.camera/microphone),
    // not at the top level.
    let config_str = std::fs::read_to_string("glyx.config.json").unwrap_or_default();
    let media_enabled: bool = serde_json::from_str::<serde_json::Value>(&config_str)
        .ok()
        .and_then(|v| {
            let caps = v.get("capabilities")?;
            // Any of video / camera / microphone requires the media DLL.
            let video = caps.get("video").and_then(|b| b.as_bool()).unwrap_or(false);
            let cam   = caps.get("camera").and_then(|b| b.as_bool()).unwrap_or(false);
            let mic   = caps.get("microphone").and_then(|b| b.as_bool()).unwrap_or(false);
            Some(video || cam || mic)
        })
        .unwrap_or(false);
    if !media_enabled { return Ok(()); }

    let home = std::env::var("USERPROFILE")
        .or_else(|_| std::env::var("HOME"))
        .unwrap_or_else(|_| ".".to_string());
    let cache_dir = PathBuf::from(&home).join(".glyx").join("cache").join("media");

    let version  = "1.0.0";
    let platform = if cfg!(target_os = "windows") { "windows" }
                   else if cfg!(target_os = "macos") { "macos" }
                   else { "linux" };
    let arch = if cfg!(target_arch = "aarch64") { "arm64" } else { "x64" };
    let ext  = if cfg!(target_os = "windows") { "dll" }
               else if cfg!(target_os = "macos") { "dylib" }
               else { "so" };
    let media_stem = format!("glyx-media-{version}-{platform}-{arch}");
    let media_dll  = cache_dir.join(format!("{media_stem}.{ext}"));

    if !media_dll.exists() {
        println!("  ⚠ glyx-media DLL not found at {}", media_dll.display());
        println!("    Run: cd glyx-media-c && .\\build-windows.ps1");
        return Ok(());
    }

    // Copy the glyx-media DLL itself.
    std::fs::copy(&media_dll, dest_root.join(format!("{media_stem}.{ext}")))
        .with_context(|| format!("copy glyx-media DLL → {}", dest_root.display()))?;
    println!("  Media DLL: {media_stem}.{ext}");

    // Copy every other DLL in the cache dir (FFmpeg runtime: avcodec, avformat, etc.).
    if let Ok(entries) = std::fs::read_dir(&cache_dir) {
        for entry in entries.flatten() {
            let p = entry.path();
            let is_dll = p.extension().and_then(|e| e.to_str())
                .map(|e| e.eq_ignore_ascii_case("dll") || e.eq_ignore_ascii_case("dylib") || e == "so")
                .unwrap_or(false);
            let name = p.file_name().unwrap_or_default().to_string_lossy();
            // Skip the glyx-media DLL itself (already copied above).
            if is_dll && !name.starts_with("glyx-media-") {
                let dest = dest_root.join(entry.file_name());
                std::fs::copy(&p, &dest)
                    .with_context(|| format!("copy {} → {}", p.display(), dest.display()))?;
                println!("  FFmpeg DLL: {name}");
            }
        }
    }
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

fn copy_glyx_mark_to(glyx_home: Option<&Path>, dest: &Path, subfolder: &str) {
    let dst = dest.join(subfolder).join("glyx-mark.svg");
    // Workspace checkout: copy the asset.  Standalone CLI: write the
    // embedded copy (the binary carries it — 404 bytes).
    if let Some(home) = glyx_home {
        let src = home.join("assets/glyx-mark.svg");
        if std::fs::copy(&src, &dst).is_ok() { return; }
    }
    const MARK_SVG: &str = include_str!("../../../assets/glyx-mark.svg");
    if let Err(e) = std::fs::write(&dst, MARK_SVG) {
        log::warn!("[create] could not write glyx-mark.svg: {e}");
    }
}

fn write_file(path: impl AsRef<Path>, content: &str) -> Result<()> {
    let path = path.as_ref();
    if let Some(parent) = path.parent() { std::fs::create_dir_all(parent)?; }
    std::fs::write(path, content).with_context(|| format!("write {}", path.display()))
}

// Superseded by the snapshot stubs in glyx-runtime; retained as reference for
// projects that opt out of snapshots.
#[allow(dead_code)]
const POLYFILLS_JS: &str = r#"// V8 environment polyfills
if (typeof performance === 'undefined') {
  globalThis.performance = { now: () => Number(__glyx_getTime()) };
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
