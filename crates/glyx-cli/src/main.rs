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
mod cmd_inspect;
mod cmd_mcp;
mod cmd_build;
mod cmd_package;
mod icu_trim;
mod cmd_check;
mod cmd_test;
mod cmd_generate;
mod cmd_runtime;
mod tools;
mod updates;
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
static DEFAULT_ICON_PNG: &[u8] = include_bytes!("../../../assets/glyx.png");

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
        glyx dev --devtools                   Serve the Glyx DevTools Protocol (port 9228)\n  \
        glyx dev --devtools --open            …and open Glyx DevTools on it\n  \
        glyx inspect                          Open Glyx DevTools for running apps\n  \
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

    /// Path to a local `icupkg` (ICU data trimmer) binary to use instead of the
    /// one glyx downloads/caches automatically. Useful behind a firewall or when
    /// you want a specific ICU 77 build. Overrides the `GLYX_ICUPKG` env var.
    #[arg(long, global = true, value_name = "PATH")]
    icupkg: Option<PathBuf>,

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
        /// Serve the Glyx DevTools Protocol (GDP) for inspection and
        /// automation, on both JS engines. Optionally pass a port (default
        /// 9228). The address and session token are written to
        /// target/glyx/devtools.json.
        #[arg(long, value_name = "PORT", num_args = 0..=1, default_missing_value = "9228")]
        devtools: Option<u16>,
        /// With --devtools: open Glyx DevTools in the browser, attached to
        /// this app.
        #[arg(long, requires = "devtools")]
        open: bool,
    },
    /// Open Glyx DevTools: inspect, profile and drive running dev apps
    ///
    /// Serves the DevTools UI on 127.0.0.1 and lists the apps started with
    /// `glyx dev --devtools` in this project, its subfolders, or anywhere
    /// with GLYX_DEVTOOLS_PORT set.
    /// Serve running dev apps to AI agents over MCP (stdio)
    ///
    /// Add to your agent's MCP config:
    ///   { "mcpServers": { "glyx": { "command": "glyx", "args": ["mcp"] } } }
    /// Then start apps with `glyx dev --devtools` in this folder (or below):
    /// the agent can list them, read the UI, click, type, wait and take
    /// screenshots.
    #[command(verbatim_doc_comment)]
    Mcp,
    Inspect {
        /// Port for the DevTools page (default 9227, or any free one).
        #[arg(long)]
        port: Option<u16>,
        /// Print the address without opening a browser.
        #[arg(long)]
        no_open: bool,
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
    /// Generate a new Ed25519 keypair for signing capability DLLs.
    ///
    /// Writes a raw 32-byte private key to `out` and prints the matching
    /// 44-byte DER SubjectPublicKeyInfo public key as hex — paste that into
    /// `crates/glyx-verify/keys/cap.pub` (as raw bytes, not hex) to make it
    /// the runtime's trusted verification key. Keep the private key file out
    /// of the repo; store it as a CI secret for real releases.
    Keygen {
        /// Path to write the raw 32-byte private key
        #[arg(long, default_value = "cap-signing-key.bin")]
        out: std::path::PathBuf,
    },
    /// Sign a capability DLL with a private key from `caps keygen`.
    ///
    /// Writes `<dll>.sig` (64 raw bytes) next to the DLL — this is the
    /// sidecar `glyx-runtime::cap_loader` looks for at load time. The key
    /// must be the raw 32-byte private key file `caps keygen` produces.
    Sign {
        /// Path to the capability DLL to sign
        dll: std::path::PathBuf,
        /// Path to the raw 32-byte private key
        #[arg(long)]
        key: std::path::PathBuf,
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

    // MCP speaks JSON-RPC on stdout: nothing else may print there, so it
    // skips the update notice and config detection below.
    if matches!(cli.command, Commands::Mcp) { return cmd_mcp::cmd_mcp(); }

    // "A newer glyx is available" — instant (reads the last cached result);
    // any network refresh happens in the background.
    updates::run(&glyx_dir(), env!("CARGO_PKG_VERSION"), glyx_source_checkout().is_some());

    // Detect package manager once; all subcommands use this value.
    let config_json = resolve_config_json().unwrap_or_default();
    let pm = pm::detect(cli.pm.as_deref(), &config_json)?;

    match cli.command {
        Commands::Create { name, native, template } => cmd_create(&name, native, &template, pm),
        Commands::Dev { inspect, devtools, open } => cmd_dev(inspect, devtools, open, pm, cli.icupkg.clone()),
        Commands::Inspect { port, no_open } => cmd_inspect::cmd_inspect(port, no_open),
        Commands::Mcp => unreachable!("handled above"),
        Commands::Build { target, snapshot: _, bundle, portable, check_performance, perf_budget, perf_duration } => {
            let mode = if bundle { "bundle" } else if portable { "portable" } else { "snapshot" };
            cmd_build(target.as_deref(), mode, check_performance, perf_budget, perf_duration, pm, cli.icupkg.clone())
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
                println!("Staging {} capability module(s): {}", caps.len(), caps.join(", "));
                cmd_build::stage_cap_dlls(&caps, target.as_deref(), &dest)
                    .context("capability module staging failed")?;
                write_caps_lock(&dest).context("failed to write glyx-caps.lock")?;
                println!("Done. DLLs and glyx-caps.lock written to {}", dest.display());
                Ok(())
            }
            CapsCommands::Keygen { out } => cmd_caps_keygen(&out),
            CapsCommands::Sign { dll, key } => cmd_caps_sign(&dll, &key),
        },
    }
}

/// Generate a new Ed25519 keypair for `caps sign`. See `CapsCommands::Keygen` doc.
fn cmd_caps_keygen(out: &std::path::Path) -> Result<()> {
    use ed25519_dalek::SigningKey;
    use ed25519_dalek::pkcs8::EncodePublicKey;
    use rand_core::OsRng;

    let signing_key = SigningKey::generate(&mut OsRng);
    std::fs::write(out, signing_key.to_bytes())
        .with_context(|| format!("failed to write private key to {}", out.display()))?;

    let pub_der = signing_key.verifying_key().to_public_key_der()
        .context("failed to DER-encode public key")?;
    println!("Private key written to: {}", out.display());
    println!("Keep this file out of the repo — store it as a CI secret for real releases.");
    println!();
    println!("Public key (44-byte DER SPKI, hex):");
    println!("{}", pub_der.as_bytes().iter().map(|b| format!("{b:02x}")).collect::<String>());
    println!();
    println!("To make this the runtime's trusted key, write these 44 bytes (not the hex text)");
    println!("to crates/glyx-verify/keys/cap.pub, replacing the existing file.");
    Ok(())
}

/// Sign a capability DLL, writing `<dll>.sig` next to it. See `CapsCommands::Sign` doc.
fn cmd_caps_sign(dll: &std::path::Path, key: &std::path::Path) -> Result<()> {
    let key_bytes = std::fs::read(key)
        .with_context(|| format!("failed to read private key {}", key.display()))?;
    let secret: [u8; 32] = key_bytes.as_slice().try_into()
        .map_err(|_| anyhow::anyhow!(
            "private key must be exactly 32 raw bytes (got {}) — use `glyx caps keygen`'s output",
            key_bytes.len()
        ))?;

    let dll_bytes = std::fs::read(dll)
        .with_context(|| format!("failed to read DLL {}", dll.display()))?;
    let sig = glyx_verify::sign_ed25519(&secret, &dll_bytes);

    let sig_path = dll.with_extension({
        let ext = dll.extension()
            .map(|e| format!("{}.sig", e.to_string_lossy()))
            .unwrap_or_else(|| "sig".to_string());
        ext
    });
    std::fs::write(&sig_path, sig)
        .with_context(|| format!("failed to write signature to {}", sig_path.display()))?;
    println!("Signed: {}", sig_path.display());
    Ok(())
}

// ── Runner management ─────────────────────────────────────────────────────────

/// Find or build the glyx-runner binary.
///
/// `dev_mode = true`  → runner with "dev" feature (hot-reload + overlay); debug build
/// `dev_mode = false` → runner without "dev" feature (lean production binary); release build
///
/// Search order:
///   1. ~/.glyx/runners/{dev|prod}/glyx-runner[.exe]  (cached)
///   2. Download the prebuilt runner from GitHub Releases → cache
///   3. Build from source (isolated `-p glyx-runner`) → copy to cache
///
/// NOTE: deliberately does NOT reuse glyx_home/target/{debug|release}/glyx-runner —
/// a plain workspace-wide `cargo build --release` (e.g. run while hacking on
/// glyx-cli or an example) unifies Cargo features across every workspace member
/// that depends on glyx-core (model-viewer enables `canvas3d`, etc.), so any
/// glyx-runner binary sitting in the shared target/ dir may have been fattened
/// by features it never asked for. Always going through the isolated `-p
/// glyx-runner --no-default-features` build guarantees a lean prod binary;
/// cargo no-ops when the fingerprint already matches, so repeat calls are fast.
fn find_or_build_runner(dev_mode: bool, engine: &str) -> Result<PathBuf> {
    let profile = if dev_mode { "dev" } else { "prod" };
    let bin_name = runner_bin_name();

    // 1. Check user cache — namespaced by engine so switching a project's
    //    configured engine (glyx.config "engine") doesn't silently reuse a
    //    stale wrong-engine binary cached under the same path.
    let cache_dir = glyx_runners_dir().join(engine).join(profile);
    let cached    = cache_dir.join(bin_name);

    // 0. Inside the glyx source workspace: always build from source. The
    //    cache only knows the CLI version, not the source it was built from,
    //    so after a native change it silently kept serving an old runner
    //    (a whole day of native fixes never reached `glyx dev` examples).
    //    Cargo is incremental — a no-op build takes about a second.
    if let Some(home) = glyx_source_checkout() {
        let built = build_runner_from_source(&home, dev_mode, engine)?;
        return Ok(refresh_cache(&built, &cache_dir, &cached));
    }

    let stamp = std::fs::read_to_string(cache_dir.join(".version")).ok();
    match cached_runner_action(cached.exists(), stamp.as_deref(), env!("CARGO_PKG_VERSION")) {
        CachedRunner::Use => return Ok(cached),
        CachedRunner::Replace => {
            // The CLI was upgraded (or the cache predates version stamps):
            // the runner is built together with the CLI, so fetch the one
            // that matches — only this engine/profile, not all four.
            println!("glyx {} needs a matching runner [{profile}, {engine}] — updating the cached one…",
                     env!("CARGO_PKG_VERSION"));
            match download_runner(profile, engine, &cached) {
                Ok(true) => {
                    write_version_stamp(&cache_dir);
                    return Ok(cached);
                }
                // Offline, or an old instance still has the file open: keep
                // working with what's there and say so.
                _ => {
                    check_cache_freshness(&cache_dir, engine, profile);
                    return Ok(cached);
                }
            }
        }
        CachedRunner::Missing => {}
    }

    // 2. Download the prebuilt runner for this CLI version from GitHub
    //    Releases — the NORMAL path for users who installed the CLI binary
    //    and don't have the glyx source workspace.  Falls through to a
    //    source build (workspace devs) if unavailable.
    if download_runner(profile, engine, &cached).unwrap_or(false) {
        write_version_stamp(&cache_dir);
        return Ok(cached);
    }

    // 3. Build from source
    let home = glyx_home().context("Cannot locate glyx workspace — needed to build glyx-runner")?;
    let built = build_runner_from_source(&home, dev_mode, engine)?;

    // Cache it for future use
    std::fs::create_dir_all(&cache_dir)
        .with_context(|| format!("create cache dir {}", cache_dir.display()))?;
    std::fs::copy(&built, &cached)
        .with_context(|| format!("cache runner to {}", cached.display()))?;
    write_version_stamp(&cache_dir);

    println!("✓ glyx-runner [{profile}, {engine}] cached at {}", cached.display());
    Ok(cached)
}

/// `cargo build -p glyx-runner` with exactly the requested engine/profile
/// features, returning the built binary's path.
fn build_runner_from_source(home: &Path, dev_mode: bool, engine: &str) -> Result<PathBuf> {
    let bin_name = runner_bin_name();
    let label = if dev_mode { "dev (with hot-reload)" } else { "prod (lean)" };
    println!("Building glyx-runner [{label}, {engine}] from source (no-op if up to date)...");

    // Always pass explicit features (both modes) so `engine` is honored
    // regardless of glyx-runner/Cargo.toml's own default feature set —
    // relying on defaults here previously meant a dev-mode build always got
    // v8 no matter what the project's glyx.config asked for.
    let feat = if dev_mode { format!("dev,{engine}") } else { engine.to_string() };
    let mut args = vec!["build", "-p", "glyx-runner", "--no-default-features", "--features", feat.as_str()];
    if !dev_mode { args.push("--release"); }

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
    Ok(built)
}

/// Make the cached runner match a fresh source build, and return the path
/// to run. The cache dir is preferred because capability DLLs live beside
/// the cached runner. If the cached file is locked (an instance is still
/// running — Windows locks running executables), run the fresh build
/// directly rather than an out-of-date copy.
fn refresh_cache(built: &Path, cache_dir: &Path, cached: &Path) -> PathBuf {
    if !cache_needs_refresh(built, cached) {
        return cached.to_path_buf();
    }
    let copied = std::fs::create_dir_all(cache_dir)
        .and_then(|_| std::fs::copy(built, cached));
    match copied {
        Ok(_) => {
            write_version_stamp(cache_dir);
            cached.to_path_buf()
        }
        Err(e) => {
            println!(
                "Note: couldn't update the cached runner ({e}) — is an older instance still                  running? Using the fresh build at {} instead.",
                built.display()
            );
            built.to_path_buf()
        }
    }
}

/// The cache is stale when it's missing or differs in size or is older than
/// the build — cheap metadata checks, no 70 MB byte comparison per launch.
fn cache_needs_refresh(built: &Path, cached: &Path) -> bool {
    let (Ok(b), Ok(c)) = (std::fs::metadata(built), std::fs::metadata(cached)) else { return true };
    if b.len() != c.len() { return true; }
    match (b.modified(), c.modified()) {
        (Ok(bm), Ok(cm)) => bm > cm,
        _ => true,
    }
}

/// What to do with the cached runner for this CLI.
#[derive(Debug, PartialEq)]
enum CachedRunner {
    /// Present and produced by this CLI version.
    Use,
    /// Present but from another CLI version (or unstamped): replace it.
    Replace,
    /// Not cached yet.
    Missing,
}

fn cached_runner_action(exists: bool, stamp: Option<&str>, current: &str) -> CachedRunner {
    if !exists { return CachedRunner::Missing; }
    if stamp_is_stale(stamp, current) { CachedRunner::Replace } else { CachedRunner::Use }
}

/// Records which CLI version produced a cached runner, so a later
/// `find_or_build_runner` call can tell a user their cache predates the CLI
/// they're now running — see `check_cache_freshness`. Best-effort: a failure
/// to write this is not worth failing the whole command over.
fn write_version_stamp(cache_dir: &Path) {
    let _ = std::fs::write(cache_dir.join(".version"), env!("CARGO_PKG_VERSION"));
}

/// Prints a notice when the cached runner is from another CLI version and
/// replacing it just failed (offline, or the file is locked by a running
/// instance). A successful replace — the normal path after an upgrade — is
/// handled by `find_or_build_runner` via `cached_runner_action`.
fn check_cache_freshness(cache_dir: &Path, engine: &str, profile: &str) {
    let current = env!("CARGO_PKG_VERSION");
    let stamped = std::fs::read_to_string(cache_dir.join(".version")).ok();
    if stamp_is_stale(stamped.as_deref(), current) {
        let from = stamped.as_deref().map(str::trim).unwrap_or("an unknown (pre-versioning) build");
        println!(
            "Note: cached glyx-runner [{engine}/{profile}] was built by glyx-cli {from}, \
             this is glyx-cli {current}, and updating it failed (offline?). It will be \
             retried on the next run; `glyx runtime build --force` forces it."
        );
    }
}

/// Exact-match comparison, not semver-range — the runner and the CLI are
/// built together from the same workspace (not an independently-versioned
/// dependency), so "produced by literally this CLI build" is the right
/// question, matching how `download_runner` already keys release URLs off
/// `CARGO_PKG_VERSION` verbatim. `None` (no stamp at all) is always stale —
/// covers caches from before this check existed.
fn stamp_is_stale(stamped: Option<&str>, current: &str) -> bool {
    stamped.map(str::trim) != Some(current)
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
fn download_runner(profile: &str, engine: &str, dest: &std::path::Path) -> Result<bool> {
    let Some(target) = release_target() else { return Ok(false) };
    let suffix = if cfg!(windows) { ".exe" } else { "" };
    // Release ships two runner flavors (lean prod, dev hot-reload) per
    // engine. v8 keeps the original unprefixed names (existing releases,
    // unchanged); quickjs gets an explicit "quickjs-" segment.
    let engine_prefix = if engine == "quickjs" { "quickjs-" } else { "" };
    let artifact = if profile == "dev" {
        format!("glyx-runner-{engine_prefix}dev-{target}{suffix}")
    } else {
        format!("glyx-runner-{engine_prefix}{target}{suffix}")
    };
    let version = env!("CARGO_PKG_VERSION");
    // Only this CLI's own release: the runner is built together with the
    // CLI, and a `latest` fallback could pair it with a newer, mismatched
    // runner (then stamped as matching).
    let upstream = [
        format!("https://github.com/glyx-dev/glyx/releases/download/v{version}/{artifact}"),
    ];
    // When self-hosting, every runner comes from the mirror base; otherwise
    // fall back to the upstream GitHub release URLs.
    let urls: Vec<String> = match tools::tools_base() {
        Some(base) => vec![format!("{}/{}", base, tools::runner_mirror_path(&artifact))],
        None => upstream.to_vec(),
    };

    for url in &urls {
        println!("Downloading prebuilt glyx-runner [{profile}, {engine}]…");
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

/// `~/.glyx` — runners, capability modules and the update-check cache.
fn glyx_dir() -> PathBuf {
    let home = std::env::var("HOME")
        .or_else(|_| std::env::var("USERPROFILE"))
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."));
    home.join(".glyx")
}

fn glyx_runners_dir() -> PathBuf {
    glyx_dir().join("runners")
}

fn runner_bin_name() -> &'static str {
    if cfg!(target_os = "windows") { "glyx-runner.exe" } else { "glyx-runner" }
}

// ── Build helpers ─────────────────────────────────────────────────────────────

fn build_app_bundle(project_name: &str, entry: &str, p: pm::Pm) -> Result<PathBuf> {
    let bundle_out = format!("target/glyx/{project_name}.js");
    pm::js_bundle(p, entry, &bundle_out, /*minify=*/true, pm::SourceMap::Kept, !read_keep_test_ids())?;
    Ok(PathBuf::from(bundle_out))
}

// ── Project detection ─────────────────────────────────────────────────────────

/// Returns true if the current directory is a native Glyx project (has Cargo.toml).
fn is_native_project() -> bool {
    Path::new("Cargo.toml").exists()
}

// ── Helper utilities ──────────────────────────────────────────────────────────

/// The glyx SOURCE checkout this CLI runs from, if any — stricter than
/// `glyx_home()`. That one accepts any `[workspace]` Cargo.toml mentioning
/// `glyx-core`, which a user's own app workspace (depending on glyx-core,
/// with the CLI installed under node_modules) also matches. Only a tree
/// that actually contains the runner's source can build it, so only that
/// switches `find_or_build_runner` to always-build-from-source; everyone
/// else keeps the cache → download path.
fn glyx_source_checkout() -> Option<PathBuf> {
    glyx_home().ok().filter(|home| is_glyx_source_checkout(home))
}

fn is_glyx_source_checkout(dir: &Path) -> bool {
    dir.join("crates").join("glyx-runner").join("Cargo.toml").is_file()
}

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
    anyhow::bail!(
        "Not running from inside the glyx source workspace — this is expected \
         for a published glyx-cli install and isn't an error by itself."
    )
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

const GLYX_FIRST_YEAR: i32 = 2025;

/// The Glyx framework MIT license — always included in the installation folder.
/// The copyright year is computed at packaging time (not hardcoded) so an app
/// packaged years from now doesn't ship a stale "Copyright (c) 2024" notice.
fn glyx_license_text() -> String {
    let year = time::OffsetDateTime::now_utc().year();
    let copyright_years = if year > GLYX_FIRST_YEAR {
        format!("{GLYX_FIRST_YEAR}-{year}")
    } else {
        GLYX_FIRST_YEAR.to_string()
    };
    format!("\
MIT License

Copyright (c) {copyright_years} Glyx Contributors

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
")
}

/// Write license files into `licenses_dir` (created if needed).
/// Always writes `glyx.txt`. Copies the app license as `app.txt` if specified.
/// Returns the path to the primary license file to show in the installer EULA screen
/// (app license takes priority over the Glyx license).
fn install_license_files(licenses_dir: &Path, app_license: Option<&str>) -> Result<PathBuf> {
    std::fs::create_dir_all(licenses_dir)?;

    // Glyx framework license — always present
    let glyx_lic = licenses_dir.join("glyx.txt");
    std::fs::write(&glyx_lic, glyx_license_text())?;
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

/// `keepTestIds` from glyx.config: keep `testID` props in release builds (for
/// end-to-end tests against the release binary). Default false: stripped.
fn read_keep_test_ids() -> bool {
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Cfg { keep_test_ids: Option<bool> }
    resolve_config_json().ok()
        .and_then(|src| serde_json::from_str::<Cfg>(&src).ok())
        .and_then(|c| c.keep_test_ids)
        .unwrap_or(false)
}

/// `devtools.autoIdCacheThreshold` from glyx.config: node count above which
/// devtools caches element IDs between requests.
fn read_devtools_auto_id_cache_threshold() -> Option<usize> {
    #[derive(serde::Deserialize)]
    struct Cfg { devtools: Option<Devtools> }
    #[derive(serde::Deserialize)]
    #[serde(rename_all = "camelCase")]
    struct Devtools { auto_id_cache_threshold: Option<usize> }
    let src = resolve_config_json().ok()?;
    serde_json::from_str::<Cfg>(&src).ok()?.devtools?.auto_id_cache_threshold
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
        // Only the bundle the app loads (`dev.output`), at the same relative
        // path: not the whole js/ folder, which holds the app's sources.
        let output = read_dev_config().map(|(_, o)| o).unwrap_or_else(|| "js/dist/app.js".to_string());
        let src = PathBuf::from(&output);
        if src.exists() {
            let dst = dest_root.join(&output);
            if let Some(parent) = dst.parent() { std::fs::create_dir_all(parent)?; }
            std::fs::copy(&src, &dst).with_context(|| format!("copy {output}"))?;
            println!("  JS bundle: {output}");
        } else {
            println!("  ⚠ JS bundle {output} not found: run `glyx build` first");
        }
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

/// Read the `engine` field from glyx.config (`"v8"` | `"quickjs"`). Defaults
/// to `"v8"` (the desktop default, matching every example's own Cargo.toml)
/// when absent or unrecognized.
fn read_engine_from_config() -> String {
    let src = resolve_config_json().unwrap_or_default();
    parse_engine_from_json(&src)
}

fn parse_engine_from_json(src: &str) -> String {
    let v: serde_json::Value = serde_json::from_str(src).unwrap_or_default();
    match v.get("engine").and_then(|e| e.as_str()) {
        Some("quickjs") => "quickjs".to_string(),
        Some("v8") | None => "v8".to_string(),
        Some(other) => {
            eprintln!("warning: glyx.config \"engine\": {other:?} not recognized (use \"v8\" or \"quickjs\") — defaulting to v8");
            "v8".to_string()
        }
    }
}

/// Read the `capabilities` object from glyx.config (e.g. `{ "audio": true, "camera": false }`).
/// Returns the full known set when the config has no capabilities key.
fn read_capabilities_from_config() -> Vec<String> {
    let known = ["audio", "ai", "camera", "gamepad", "hid", "webview"];
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

    // `glyx build` places cap DLLs in target/release/ (see cmd_build.rs's
    // build_cap_dlls), not the project root — search both so this also
    // works for a developer who's manually copied a DLL into cwd (e.g. via
    // `glyx caps build --dest .`).
    // `dest_root` first: that's where `glyx build` just staged the fresh
    // modules. (Searching `target/release` relative to the app folder first
    // could hash, and copy over the fresh one, a stale module from an
    // earlier build.)
    let search_dirs: &[&Path] = &[dest_root, Path::new("target/release"), Path::new(".")];

    for cap in &cap_names {
        let stem = format!("glyx_cap_{cap}");
        'found: for ext in extensions {
            // On macOS/Linux the lib prefix is optional depending on how the
            // developer built their module; check both.
            for prefix in &["", "lib"] {
                let filename = format!("{prefix}{stem}.{ext}");
                for dir in search_dirs {
                    let path = dir.join(&filename);
                    if !path.exists() { continue; }
                    let bytes = std::fs::read(&path)
                        .with_context(|| format!("read {}", path.display()))?;
                    let hex = format!("{:x}", Sha256::digest(&bytes));
                    hashes.insert(cap.to_string(), serde_json::Value::String(hex));
                    // Copy the module into the dist dir alongside the binary
                    // (unless it's already the one there).
                    let dest = dest_root.join(&filename);
                    let same = std::fs::canonicalize(&path).ok().zip(std::fs::canonicalize(&dest).ok()).is_some_and(|(a, b)| a == b);
                    if !same {
                        std::fs::copy(&path, &dest)
                            .with_context(|| format!("copy {filename} to dist"))?;
                    }
                    println!("Capability module: {filename} (hash pinned in glyx-caps.lock)");
                    // Also copy the Ed25519 .sig sidecar cap_loader requires
                    // in release builds — silently missing this left every
                    // packaged app with a capability that refuses to load.
                    let sig_path = path.with_extension(format!("{ext}.sig"));
                    if sig_path.exists() && !same {
                        std::fs::copy(&sig_path, dest_root.join(format!("{filename}.sig")))
                            .with_context(|| format!("copy {filename}.sig to dist"))?;
                        println!("  + {filename}.sig");
                    } else {
                        println!("  Warning: no {filename}.sig found next to it — this capability will refuse to load in a release build. Sign it with `glyx caps sign`.");
                    }
                    break 'found;
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

/// Everything a packaged app needs next to its executable: config and JS
/// bundle (unless embedded), assets, capability lock, the trimmed ICU data
/// `glyx build` left next to `bin`, and the media libraries.
fn copy_app_payload(dest_root: &Path, bin: &Path) -> Result<()> {
    copy_runtime_files(dest_root)?;
    // Without icudtl.dat, Intl.* and toLocaleString() don't work.
    if let Some(icu) = bin.parent().map(|d| d.join("icudtl.dat")).filter(|p| p.exists()) {
        std::fs::copy(&icu, dest_root.join("icudtl.dat")).context("copy icudtl.dat")?;
        println!("  ICU data: icudtl.dat ({} KB)", std::fs::metadata(&icu)?.len() / 1024);
    } else {
        println!("  ⚠ no icudtl.dat next to {}: Intl.* and toLocaleString() won't work (run `glyx build`)", bin.display());
    }
    copy_media_dll_if_needed(dest_root)
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

    // Copy the glyx-media DLL and its signed manifest. A release build only
    // loads the DLL when `<stem>.manifest.json` + `.manifest.sig` sit next to
    // it and the signature checks out (see glyx-media's verify.rs).
    std::fs::copy(&media_dll, dest_root.join(format!("{media_stem}.{ext}")))
        .with_context(|| format!("copy glyx-media DLL → {}", dest_root.display()))?;
    println!("  Media DLL: {media_stem}.{ext}");
    for side in ["manifest.json", "manifest.sig"] {
        let src = cache_dir.join(format!("{media_stem}.{side}"));
        if !src.exists() {
            println!("  ⚠ {} is missing: the packaged app will refuse to load the media DLL (video, camera and microphone won't work).", src.display());
            continue;
        }
        std::fs::copy(&src, dest_root.join(format!("{media_stem}.{side}")))
            .with_context(|| format!("copy {} → {}", src.display(), dest_root.display()))?;
    }
    if is_dev_signature(&cache_dir.join(format!("{media_stem}.manifest.sig"))) {
        println!("  ⚠ This glyx-media DLL is a local build with a dev (unsigned) manifest.");
        println!("    A packaged app refuses it: video, camera and microphone won't work for users.");
        println!("    Package with a signed release build instead: put the glyx-media-build workflow's");
        println!("    artifact (DLL, manifest, signature and FFmpeg libraries) in {}.", cache_dir.display());
    }

    // FFmpeg's runtime libraries the wrapper links to: only those, not
    // whatever else is in the cache (older FFmpeg versions, avfilter…).
    if let Ok(entries) = std::fs::read_dir(&cache_dir) {
        for entry in entries.flatten() {
            let name = entry.file_name().to_string_lossy().into_owned();
            if !is_ffmpeg_runtime_lib(&name) { continue; }
            let dest = dest_root.join(entry.file_name());
            std::fs::copy(entry.path(), &dest)
                .with_context(|| format!("copy {} → {}", entry.path().display(), dest.display()))?;
            println!("  FFmpeg library: {name}");
        }
    }
    Ok(())
}

/// The FFmpeg libraries glyx-media links to (`avcodec-63.dll`,
/// `libavformat.62.dylib`, `libswscale.so.9`…); not avfilter / avdevice /
/// postproc, which it doesn't use.
fn is_ffmpeg_runtime_lib(name: &str) -> bool {
    let n = name.to_ascii_lowercase();
    let n = n.strip_prefix("lib").unwrap_or(&n);
    let is_lib = n.ends_with(".dll") || n.contains(".dylib") || n.contains(".so");
    is_lib && ["avcodec", "avformat", "avutil", "swresample", "swscale"].iter()
        .any(|l| n.starts_with(l) && n[l.len()..].starts_with(['-', '.']))
}

/// A dev manifest from `generate-dev-manifest` has an all-zero signature.
fn is_dev_signature(sig: &Path) -> bool {
    std::fs::read(sig).is_ok_and(|b| !b.is_empty() && b.iter().all(|&x| x == 0))
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

#[cfg(test)]
mod cli_tests {
    /// The real bundling step against this machine's media cache, for an app
    /// that declares video (changes the working directory: run it alone).
    ///   GLYX_PKG_APP=examples/notes-app cargo test -p glyx-cli media_bundle -- --ignored --nocapture
    #[test]
    #[ignore]
    fn media_bundle_against_the_real_cache() {
        let app = std::env::var("GLYX_PKG_APP").expect("GLYX_PKG_APP");
        let dest = std::env::temp_dir().join(format!("glyx-pkg-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dest);
        std::fs::create_dir_all(&dest).unwrap();
        std::env::set_current_dir(&app).unwrap();
        super::copy_media_dll_if_needed(&dest).unwrap();
        let mut names: Vec<String> = std::fs::read_dir(&dest).unwrap().flatten().map(|e| e.file_name().to_string_lossy().into_owned()).collect();
        names.sort();
        println!("bundled: {names:?}");
        assert!(names.iter().any(|n| n.ends_with(".manifest.json")) && names.iter().any(|n| n.ends_with(".manifest.sig")));
        assert!(names.iter().all(|n| !n.starts_with("avfilter") && !n.starts_with("avdevice")));
        let _ = std::fs::remove_dir_all(&dest);
    }

    #[test]
    fn packaging_ships_only_the_ffmpeg_libraries_glyx_media_uses() {
        for yes in ["avcodec-63.dll", "avformat-62.dll", "AVUTIL-61.DLL", "swresample-7.dll", "swscale-10.dll",
                    "libavcodec.62.dylib", "libswscale.so.9", "libavutil.so"] {
            assert!(super::is_ffmpeg_runtime_lib(yes), "{yes}");
        }
        for no in ["avfilter-11.dll", "avdevice-62.dll", "postproc-58.dll", "glyx-media-1.0.0-windows-x64.dll",
                   "glyx-media-1.0.0-windows-x64.manifest.json", "avcodecs-1.dll", "notes.txt"] {
            assert!(!super::is_ffmpeg_runtime_lib(no), "{no}");
        }
    }

    use super::*;

    #[test]
    fn parse_engine_from_json_reads_quickjs() {
        assert_eq!(parse_engine_from_json(r#"{"engine":"quickjs"}"#), "quickjs");
    }

    #[test]
    fn parse_engine_from_json_defaults_to_v8_when_absent() {
        assert_eq!(parse_engine_from_json("{}"), "v8");
        assert_eq!(parse_engine_from_json(""), "v8");
    }

    #[test]
    fn parse_engine_from_json_falls_back_to_v8_on_unknown_value() {
        assert_eq!(parse_engine_from_json(r#"{"engine":"nashorn"}"#), "v8");
    }

    #[test]
    fn platform_to_rust_target_maps_known_platforms() {
        assert_eq!(platform_to_rust_target("windows").unwrap(), "x86_64-pc-windows-msvc");
        assert_eq!(platform_to_rust_target("macos").unwrap(), "aarch64-apple-darwin");
        assert_eq!(platform_to_rust_target("linux-arm").unwrap(), "aarch64-unknown-linux-gnu");
    }

    #[test]
    fn platform_to_rust_target_rejects_unknown_platform() {
        assert!(platform_to_rust_target("plan9").is_err());
    }

    #[test]
    fn a_runner_cached_by_another_cli_version_is_replaced() {
        assert_eq!(cached_runner_action(false, None, "0.2.0"), CachedRunner::Missing);
        assert_eq!(cached_runner_action(true, Some("0.2.0"), "0.2.0"), CachedRunner::Use);
        assert_eq!(cached_runner_action(true, Some("0.2.0\n"), "0.2.0"), CachedRunner::Use);
        // The regression: an upgraded CLI used to keep running the old runner.
        assert_eq!(cached_runner_action(true, Some("0.1.0"), "0.2.0"), CachedRunner::Replace);
        assert_eq!(cached_runner_action(true, None, "0.2.0"), CachedRunner::Replace, "unstamped cache");
    }

    #[test]
    fn only_a_tree_with_the_runner_source_counts_as_a_source_checkout() {
        let dir = std::env::temp_dir().join(format!("glyx-checkout-test-{}", std::process::id()));
        // A user's own app workspace that depends on glyx-core.
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join("Cargo.toml"), "[workspace]
[dependencies]
glyx-core = \"0.1\"
").unwrap();
        assert!(!is_glyx_source_checkout(&dir));
        // The real source tree has the runner crate.
        std::fs::create_dir_all(dir.join("crates/glyx-runner")).unwrap();
        std::fs::write(dir.join("crates/glyx-runner/Cargo.toml"), "[package]
name = \"glyx-runner\"
").unwrap();
        assert!(is_glyx_source_checkout(&dir));
        let _ = std::fs::remove_dir_all(&dir);
        // This repo itself is one.
        assert!(glyx_source_checkout().is_some());
    }

    #[test]
    fn cached_runner_is_refreshed_when_missing_resized_or_older_than_the_build() {
        let dir = std::env::temp_dir().join(format!("glyx-cache-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let (built, cached) = (dir.join("built.exe"), dir.join("cached.exe"));
        std::fs::write(&built, b"new runner").unwrap();
        assert!(cache_needs_refresh(&built, &cached), "missing cache");

        std::fs::write(&cached, b"old").unwrap();
        assert!(cache_needs_refresh(&built, &cached), "different size");

        // Same size, cache written after the build: up to date.
        std::fs::write(&cached, b"new runner").unwrap();
        let now = std::time::SystemTime::now();
        std::fs::File::options().write(true).open(&built).unwrap()
            .set_modified(now - std::time::Duration::from_secs(60)).unwrap();
        std::fs::File::options().write(true).open(&cached).unwrap().set_modified(now).unwrap();
        assert!(!cache_needs_refresh(&built, &cached));

        // A newer build than the cache (a native change was rebuilt): refresh.
        std::fs::File::options().write(true).open(&built).unwrap()
            .set_modified(now + std::time::Duration::from_secs(60)).unwrap();
        assert!(cache_needs_refresh(&built, &cached));

        // refresh_cache copies it over and then serves the cache path.
        let served = refresh_cache(&built, &dir, &cached);
        assert_eq!(served, cached);
        assert_eq!(std::fs::read(&cached).unwrap(), b"new runner");
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn stamp_is_stale_matches_exact_current_version() {
        assert!(!stamp_is_stale(Some("0.1.0"), "0.1.0"));
    }

    #[test]
    fn stamp_is_stale_flags_a_different_version() {
        assert!(stamp_is_stale(Some("0.0.9"), "0.1.0"));
        // Not semver-range logic — even a "newer-looking" stamp than current
        // still counts as stale (mismatch, not "compatible enough").
        assert!(stamp_is_stale(Some("0.2.0"), "0.1.0"));
    }

    #[test]
    fn stamp_is_stale_flags_a_missing_stamp() {
        // No stamp at all — a cache from before this check existed.
        assert!(stamp_is_stale(None, "0.1.0"));
    }

    #[test]
    fn stamp_is_stale_tolerates_trailing_whitespace_from_the_stamp_file() {
        // `write_version_stamp` writes without a trailing newline, but a
        // stamp edited or written by another tool might have one.
        assert!(!stamp_is_stale(Some("0.1.0\n"), "0.1.0"));
    }

    #[test]
    fn write_and_check_version_stamp_round_trip() {
        let dir = std::env::temp_dir().join(format!("glyx-cli-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();

        // No stamp yet — freshness check must not panic, and (indirectly,
        // since it only prints) must treat this as stale via stamp_is_stale.
        let before = std::fs::read_to_string(dir.join(".version")).ok();
        assert!(stamp_is_stale(before.as_deref(), env!("CARGO_PKG_VERSION")));

        write_version_stamp(&dir);
        let after = std::fs::read_to_string(dir.join(".version")).unwrap();
        assert_eq!(after.trim(), env!("CARGO_PKG_VERSION"));
        assert!(!stamp_is_stale(Some(&after), env!("CARGO_PKG_VERSION")));

        let _ = std::fs::remove_dir_all(&dir);
    }
}
