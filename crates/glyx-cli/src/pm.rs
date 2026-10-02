//! Package manager abstraction — detect and invoke npm / pnpm / yarn / bun.
//!
//! Detection order (first match wins):
//!   1. `--pm` CLI flag (passed in by the caller)
//!   2. `packageManager` field in glyx.config.json / glyx.config.ts output
//!   3. Lockfile sniff in the current directory
//!   4. `package.json` `"packageManager"` field (corepack standard)
//!   5. `which` probe: bun → pnpm → npm (yarn requires explicit opt-in)
//!   6. Hard error listing what to install

use anyhow::{bail, Result};
use std::path::Path;
use std::process::Command;

// ── Enum ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Pm {
    Bun,
    Npm,
    Pnpm,
    /// yarn classic (v1) and berry (v3/v4) share the same binary; the version
    /// affects which dlx command to use.
    Yarn,
}

impl Pm {
    pub fn name(self) -> &'static str {
        match self {
            Pm::Bun  => "bun",
            Pm::Npm  => "npm",
            Pm::Pnpm => "pnpm",
            Pm::Yarn => "yarn",
        }
    }

    /// Parse from a string (config field or --pm flag value).
    pub fn from_str(s: &str) -> Option<Self> {
        match s.trim().to_ascii_lowercase().as_str() {
            "bun"  => Some(Pm::Bun),
            "npm"  => Some(Pm::Npm),
            "pnpm" => Some(Pm::Pnpm),
            "yarn" => Some(Pm::Yarn),
            _      => None,
        }
    }
}

// ── Detection ─────────────────────────────────────────────────────────────────

/// Detect the package manager to use for the current project.
///
/// `flag_override` comes from the `--pm` CLI arg (already parsed).
/// `config_json`   is the resolved glyx.config JSON string (may be empty).
pub fn detect(flag_override: Option<&str>, config_json: &str) -> Result<Pm> {
    // 1. --pm flag
    if let Some(s) = flag_override {
        return Pm::from_str(s)
            .ok_or_else(|| anyhow::anyhow!("Unknown package manager '{s}'. Use: bun, npm, pnpm, yarn"));
    }

    // 2. glyx.config packageManager field
    if let Ok(v) = serde_json::from_str::<serde_json::Value>(config_json) {
        if let Some(pm) = v.get("packageManager").and_then(|v| v.as_str()) {
            if let Some(p) = Pm::from_str(pm) {
                return Ok(p);
            }
        }
    }

    // 3. Lockfile sniff (most reliable when present)
    if Path::new("bun.lock").exists() || Path::new("bun.lockb").exists() {
        return Ok(Pm::Bun);
    }
    if Path::new("pnpm-lock.yaml").exists() {
        return Ok(Pm::Pnpm);
    }
    if Path::new("package-lock.json").exists() {
        return Ok(Pm::Npm);
    }
    if Path::new("yarn.lock").exists() {
        return Ok(Pm::Yarn);
    }

    // 4. package.json "packageManager" field (corepack)
    if let Ok(src) = std::fs::read_to_string("package.json") {
        if let Ok(v) = serde_json::from_str::<serde_json::Value>(&src) {
            if let Some(pm_field) = v.get("packageManager").and_then(|v| v.as_str()) {
                // Field is like "bun@1.2.3" or "npm@10.0.0"
                let name = pm_field.split('@').next().unwrap_or("");
                if let Some(p) = Pm::from_str(name) {
                    return Ok(p);
                }
            }
        }
    }

    // 5. which probe — bun preferred (fastest), then pnpm, then npm
    for pm in [Pm::Bun, Pm::Pnpm, Pm::Npm] {
        if which(pm.name()) {
            return Ok(pm);
        }
    }

    // 6. Nothing found
    bail!(
        "No package manager found in PATH.\n\
         Install one of:\n\
         bun  - https://bun.sh\n\
         npm  - bundled with Node.js (https://nodejs.org)\n\
         pnpm - https://pnpm.io\n\
         yarn - https://yarnpkg.com\n\
         Or set packageManager in glyx.config.ts to skip detection."
    )
}

fn which(bin: &str) -> bool {
    let check = if cfg!(target_os = "windows") {
        Command::new("cmd").args(["/C", "where", bin]).output()
    } else {
        Command::new("which").arg(bin).output()
    };
    check.map(|o| o.status.success()).unwrap_or(false)
}

// ── Command builders ──────────────────────────────────────────────────────────

/// Build a `Command` for installing dependencies (equivalent of `bun install`).
pub fn install_cmd(pm: Pm) -> Command {
    pm_cmd(pm, &[pm_install_args(pm)])
}

fn pm_install_args(pm: Pm) -> &'static str {
    match pm {
        Pm::Bun  => "install",
        Pm::Npm  => "install",
        Pm::Pnpm => "install",
        Pm::Yarn => "install",
    }
}

/// Build a `Command` for running a script (equivalent of `bun run <script>`).
pub fn run_cmd(pm: Pm, script: &str) -> Command {
    let mut cmd = match pm {
        Pm::Bun  => pm_cmd(pm, &["run"]),
        Pm::Npm  => pm_cmd(pm, &["run"]),
        Pm::Pnpm => pm_cmd(pm, &["run"]),
        Pm::Yarn => pm_cmd(pm, &["run"]),
    };
    cmd.arg(script);
    cmd
}

/// Build a `Command` for running a one-off binary (npx / bunx / pnpm dlx / yarn dlx).
///
/// Returns a `Command` with the dlx binary set; caller adds the binary name and its args.
pub fn dlx_cmd(pm: Pm, bin: &str) -> Command {
    match pm {
        Pm::Bun  => { let mut c = pm_cmd(pm, &["x"]);      c.arg(bin); c }
        Pm::Npm  => { let mut c = raw_cmd("npx"); c.arg(bin); c }
        Pm::Pnpm => { let mut c = pm_cmd(pm, &["dlx"]);    c.arg(bin); c }
        Pm::Yarn => { let mut c = pm_cmd(pm, &["dlx"]);    c.arg(bin); c }
    }
}

/// Build a `Command` for running tests (equivalent of `bun test <dir>`).
pub fn test_cmd(pm: Pm, test_root: &str) -> Command {
    match pm {
        // bun has a built-in test runner.
        Pm::Bun  => { let mut c = pm_cmd(pm, &["test"]); c.arg(test_root); c }
        // All others delegate to the project's "test" script.
        _        => pm_cmd(pm, &["test"]),
    }
}

// ── Internal helpers ──────────────────────────────────────────────────────────

/// Construct a platform-appropriate Command for the given PM binary.
fn pm_cmd(pm: Pm, args: &[&str]) -> Command {
    raw_cmd_with_args(pm.name(), args)
}

fn raw_cmd(bin: &str) -> Command {
    raw_cmd_with_args(bin, &[])
}

fn raw_cmd_with_args(bin: &str, args: &[&str]) -> Command {
    if cfg!(target_os = "windows") {
        let mut c = Command::new("cmd");
        c.arg("/C").arg(bin);
        for a in args { c.arg(a); }
        c
    } else {
        let mut c = Command::new(bin);
        for a in args { c.arg(a); }
        c
    }
}

// ── Bundling ──────────────────────────────────────────────────────────────────

/// Bundle JS via `bun build` — Bun's own built-in bundler, not a separate
/// `esbuild` package.
///
/// Previously this shelled out to `esbuild` via the configured PM's dlx/npx
/// mechanism, on the assumption that "esbuild is a peer dep of
/// @glyx-dev/react so it is always in node_modules after install" — that
/// assumption doesn't hold (no such peer dep exists, `esbuild` is not
/// actually installed), so dlx fell back to fetching a fresh copy over the
/// network on every call, which fails in restricted/offline environments
/// with a `Cannot find module '...esbuild/bin/esbuild'` error. `dev_mode.rs`
/// already bundles this way for incremental HMR rebuilds and it works
/// reliably with no external dependency — this unifies both bundling paths
/// onto that same, already-proven mechanism. `pm` is accepted for call-site
/// compatibility (this always used bun regardless of the configured PM
/// before too, dlx_cmd's fallback path already assumed bun) but unused now
/// that there's no PM-specific dlx invocation to build.
///
/// `minify`     — set to true for production bundles
/// `source_map` — where the source map goes (see [`SourceMap`])
pub fn js_bundle(
    pm:         Pm,
    entry:      &str,
    output:     &str,
    minify:     bool,
    source_map: SourceMap,
    strip_test_ids: bool,
) -> Result<()> {
    js_bundle_with_react(pm, entry, output, minify, source_map, strip_test_ids, ReactBuild::Production)
}

/// Where a bundle's source map goes.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SourceMap {
    None,
    /// Inside the bundle. Dev only: a source map carries the app's full
    /// source text, so anything shipped with one ships the source.
    Inline,
    /// Release builds: a separate file in `target/glyx/sourcemaps/`, kept on
    /// the developer's machine (never packaged) to decode crash stack traces.
    Kept,
}

/// Folder `SourceMap::Kept` maps are written to.
pub const SOURCEMAP_DIR: &str = "target/glyx/sourcemaps";

/// Which React build a bundle gets.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ReactBuild {
    /// Fast, no dev checks. Every build except `glyx dev --devtools`.
    Production,
    /// React's development build: its warnings, and the render timings the
    /// DevTools CPU profiler's Components view needs. `glyx dev --devtools`.
    Development,
}

impl ReactBuild {
    pub fn node_env_define(self) -> &'static str {
        match self {
            ReactBuild::Production => "process.env.NODE_ENV='production'",
            ReactBuild::Development => "process.env.NODE_ENV='development'",
        }
    }
}

pub fn js_bundle_with_react(
    _pm:        Pm,
    entry:      &str,
    output:     &str,
    minify:     bool,
    source_map: SourceMap,
    strip_test_ids: bool,
    react:      ReactBuild,
) -> Result<()> {
    // Bun writes a separate map only with --outdir: then the output is named
    // by --entry-naming (a literal file name here) inside that folder.
    let out_path = std::path::Path::new(output);
    let out_target: Vec<String> = if source_map == SourceMap::Kept {
        let dir = out_path.parent().filter(|d| !d.as_os_str().is_empty()).unwrap_or(std::path::Path::new("."));
        let name = out_path.file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "app.js".into());
        vec!["--outdir".into(), dir.to_string_lossy().into_owned(), format!("--entry-naming={name}")]
    } else {
        vec!["--outfile".into(), output.to_string()]
    };
    let mut args = vec!["build".to_string(), entry.to_string()];
    args.extend(out_target);
    args.extend([
        "--target".to_string(), "browser".to_string(),
        "--format".to_string(), "iife".to_string(),
        "--define".to_string(), react.node_env_define().to_string(),
    ]);
    if minify     { args.push("--minify".to_string()); }
    // Release builds: the React host config drops `testID` props before they
    // reach native (see @glyx-dev/react hostConfig.js).
    if strip_test_ids {
        args.push("--define".to_string());
        args.push("__GLYX_STRIP_TEST_IDS__=true".to_string());
    }
    match source_map {
        SourceMap::None => {}
        SourceMap::Inline => args.push("--sourcemap=inline".to_string()),
        // `external`: `<output>.map`, and no reference to it in the bundle.
        SourceMap::Kept => args.push("--sourcemap=external".to_string()),
    }

    let run = || -> std::io::Result<std::process::Output> {
        #[cfg(target_os = "windows")]
        {
            match Command::new("bun").args(&args).output() {
                Ok(o) => Ok(o),
                Err(_) => {
                    let mut cmd_args = vec!["/C".to_string(), "bun".to_string()];
                    cmd_args.extend(args.iter().cloned());
                    Command::new("cmd").args(&cmd_args).output()
                }
            }
        }
        #[cfg(not(target_os = "windows"))]
        Command::new("bun").args(&args).output()
    };

    let out = run().map_err(|e| anyhow::anyhow!(
        "Failed to run `bun build`: {e}\nMake sure bun is installed and on PATH."
    ))?;

    if !out.status.success() {
        let stderr = String::from_utf8_lossy(&out.stderr);
        bail!("bun build failed:\n{stderr}");
    }
    if source_map == SourceMap::Kept { keep_source_map(output)?; }
    Ok(())
}

/// Move `<output>.map` out of the app's files into [`SOURCEMAP_DIR`], so it
/// can never be packaged. Returns where it went.
fn keep_source_map(output: &str) -> Result<Option<std::path::PathBuf>> {
    let map = std::path::PathBuf::from(format!("{output}.map"));
    if !map.exists() { return Ok(None); }
    let name = std::path::Path::new(output).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_else(|| "app.js".into());
    let dir = std::path::Path::new(SOURCEMAP_DIR);
    std::fs::create_dir_all(dir)?;
    let dest = dir.join(format!("{name}.map"));
    let _ = std::fs::remove_file(&dest);
    if std::fs::rename(&map, &dest).is_err() {
        std::fs::copy(&map, &dest)?;
        std::fs::remove_file(&map)?;
    }
    println!("  Source map kept at {} (not packaged; use it to read crash stack traces)", dest.display());
    Ok(Some(dest))
}
