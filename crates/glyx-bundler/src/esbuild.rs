//! The esbuild backend: finding a binary, building its command line, forcing
//! the JSX mode, and running a TypeScript config.

use std::path::{Path, PathBuf};

use crate::{process, work_dir, BundleSpec, Format, ReactMode, ResolveOptions, Result, SourceMap};

/// The release downloaded when the machine has none. Bump it together with the
/// checksums in `download.rs`.
pub(crate) const ESBUILD_VERSION: &str = "0.28.2";

/// Start of the error for a missing Node.js, so the caller can try Bun instead.
pub(crate) const NO_NODE: &str = "Node.js is needed";

/// esbuild's name for this machine's platform package (`@esbuild/<key>`), or
/// `None` where it publishes no binary.
pub(crate) fn platform_key() -> Option<&'static str> {
    match (std::env::consts::OS, std::env::consts::ARCH) {
        ("windows", "x86_64") => Some("win32-x64"),
        ("windows", "aarch64") => Some("win32-arm64"),
        ("macos", "x86_64") => Some("darwin-x64"),
        ("macos", "aarch64") => Some("darwin-arm64"),
        ("linux", "x86_64") => Some("linux-x64"),
        ("linux", "aarch64") => Some("linux-arm64"),
        _ => None,
    }
}

/// The binary's path inside an `@esbuild/<platform>` package.
fn binary_in_package() -> &'static str {
    if cfg!(windows) { "esbuild.exe" } else { "bin/esbuild" }
}

/// Where a project that depends on `esbuild` has the real binary: the platform
/// package itself (not the `.bin` shim, which needs a shell), looking in
/// `project_dir` and the folders above it (monorepos hoist `node_modules`).
pub(crate) fn local_candidates(project_dir: &Path, platform: &str) -> Vec<PathBuf> {
    project_dir.ancestors().take(8)
        .map(|dir| dir.join("node_modules").join("@esbuild").join(platform).join(binary_in_package()))
        .collect()
}

/// Where the downloaded, pinned esbuild lives.
pub(crate) fn cached_binary(cache_dir: &Path) -> PathBuf {
    cache_dir.join(format!("esbuild-{ESBUILD_VERSION}")).join(if cfg!(windows) { "esbuild.exe" } else { "esbuild" })
}

fn no_esbuild_message(platform: Option<&str>) -> String {
    let why = match platform {
        Some(_) => "it is not installed in this project and could not be downloaded",
        None => "esbuild publishes no binary for this operating system",
    };
    format!(
        "esbuild is needed to bundle your app, but {why}. Install it with \
         `npm install --save-dev esbuild`, or point GLYX_ESBUILD at an esbuild binary, \
         or install Bun (https://bun.sh) and Glyx will use that."
    )
}

/// An esbuild to use: `GLYX_ESBUILD`, the project's own, the cached download,
/// or (when allowed) a fresh download.
pub(crate) fn resolve_binary(opts: &ResolveOptions) -> Result<PathBuf> {
    if let Some(path) = &opts.esbuild_path {
        return if path.is_file() { Ok(path.clone()) } else { Err(format!("GLYX_ESBUILD={}: no such file", path.display())) };
    }
    let platform = platform_key();
    if let Some(platform) = platform {
        if let Some(found) = local_candidates(&opts.project_dir, platform).into_iter().find(|p| p.is_file()) {
            return Ok(found);
        }
        let cached = cached_binary(&opts.cache_dir);
        if cached.is_file() {
            return Ok(cached);
        }
        #[cfg(feature = "download")]
        if opts.allow_download {
            return crate::download::fetch(&opts.cache_dir, platform);
        }
    }
    Err(no_esbuild_message(platform))
}

/// The command line for one bundle.
pub(crate) fn args(spec: &BundleSpec, tsconfig: &Path) -> Vec<String> {
    let mut a = vec![
        spec.entry.clone(),
        "--bundle".to_string(),
        format!("--outfile={}", spec.output),
        format!("--format={}", match spec.format { Format::Iife => "iife", Format::Cjs => "cjs" }),
        "--platform=browser".to_string(),
        // Apps keep JSX in plain `.js` files too, as Bun's bundler allows.
        "--loader:.js=jsx".to_string(),
        "--log-level=warning".to_string(),
        format!("--tsconfig={}", tsconfig.display()),
        format!("--define:process.env.NODE_ENV=\"{}\"", spec.react.node_env()),
    ];
    if spec.minify {
        a.push("--minify".to_string());
    }
    match spec.source_map {
        SourceMap::None => {}
        SourceMap::Inline => a.push("--sourcemap=inline".to_string()),
        // `external`: `<output>.map`, and no reference to it in the bundle.
        SourceMap::External => a.push("--sourcemap=external".to_string()),
    }
    if spec.strip_test_ids {
        a.push("--define:__GLYX_STRIP_TEST_IDS__=true".to_string());
    }
    a
}

/// A tsconfig that extends the project's (when there is one) and sets only the
/// JSX mode. esbuild lets a tsconfig's `jsx` win over its own flags, so this is
/// how the mode is forced without editing the user's file.
pub(crate) fn tsconfig_json(extends: Option<&str>, react: ReactMode) -> String {
    let mut root = serde_json::Map::new();
    if let Some(path) = extends {
        root.insert("extends".to_string(), path.into());
    }
    root.insert("compilerOptions".to_string(), serde_json::json!({ "jsx": react.jsx_setting() }));
    serde_json::to_string_pretty(&serde_json::Value::Object(root)).unwrap_or_default()
}

fn write_override_tsconfig(react: ReactMode) -> Result<PathBuf> {
    let cwd = std::env::current_dir().map_err(|e| format!("cannot read the working directory: {e}"))?;
    let user = cwd.join("tsconfig.json");
    // Forward slashes: valid in JSON on every platform, esbuild reads them everywhere.
    let extends = user.is_file().then(|| user.to_string_lossy().replace('\\', "/"));
    let json = tsconfig_json(extends.as_deref(), react);
    let path = work_dir()?.join(format!("tsconfig.{}.json", react.node_env()));
    if std::fs::read_to_string(&path).ok().as_deref() != Some(json.as_str()) {
        std::fs::write(&path, &json).map_err(|e| format!("cannot write {}: {e}", path.display()))?;
    }
    Ok(path)
}

pub(crate) fn bundle(bin: &Path, spec: &BundleSpec) -> Result<()> {
    let tsconfig = write_override_tsconfig(spec.react)?;
    let out = process::command(bin)
        .args(args(spec, &tsconfig))
        .output()
        .map_err(|e| format!("failed to run esbuild ({}): {e}", bin.display()))?;
    let stderr = String::from_utf8_lossy(&out.stderr);
    if !out.status.success() {
        return Err(format!("esbuild failed:\n{}", stderr.trim()));
    }
    if !stderr.trim().is_empty() {
        log::warn!("[bundler] esbuild: {}", stderr.trim());
    }
    if !Path::new(&spec.output).exists() {
        return Err(format!("esbuild finished but wrote no {}", spec.output));
    }
    Ok(())
}

/// Bundle `file` to a temporary Node script, run it, return what it prints.
pub(crate) fn eval_config(bin: &Path, file: &str) -> Result<String> {
    let node = process::find_on_path("node").ok_or_else(|| {
        format!("{NO_NODE} to read {file} (install it from https://nodejs.org, or install Bun, or write glyx.config.json instead)")
    })?;
    let script = work_dir()?.join(format!("glyx.config.{}.cjs", std::process::id()));
    let bundled = process::command(bin)
        .args([
            file.to_string(),
            "--bundle".to_string(),
            "--platform=node".to_string(),
            "--format=cjs".to_string(),
            "--target=node18".to_string(),
            format!("--outfile={}", script.display()),
            "--log-level=error".to_string(),
        ])
        .output()
        .map_err(|e| format!("failed to run esbuild ({}): {e}", bin.display()))?;
    if !bundled.status.success() {
        return Err(format!("esbuild could not bundle {file}:\n{}", String::from_utf8_lossy(&bundled.stderr).trim()));
    }
    let run = process::command(&node).arg(&script).output();
    let _ = std::fs::remove_file(&script);
    let out = run.map_err(|e| format!("failed to run node: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    // `defineConfig` prints the JSON and exits; a config that prints and then
    // fails is still read, as with Bun.
    if out.status.success() || !stdout.is_empty() {
        Ok(stdout)
    } else {
        Err(format!("{file} failed:\n{}", String::from_utf8_lossy(&out.stderr).trim()))
    }
}
