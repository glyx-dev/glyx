//! Bundling for Glyx apps: turn `src/app.jsx` / `src/app.tsx` (and whatever it
//! imports) into the single `dist/app.js` the runner loads, and run the
//! project's `glyx.config.ts`.
//!
//! Two backends, picked automatically:
//!
//! * **esbuild** (the default, so Bun is not required). Used from the
//!   project's `node_modules` if it is there, else a pinned release that is
//!   downloaded once, checked against a hash and cached in `~/.glyx/tools/`.
//! * **Bun**, if esbuild can't be had (offline, locked-down machines) and Bun is
//!   installed, or when `GLYX_BUNDLER=bun` asks for it.
//!
//! Both are told which React build the bundle is for, and the JSX transform is
//! forced to match: a project's own `tsconfig.json` can say `react-jsx` (which
//! makes the bundler emit the *development* JSX calls) while the bundle is
//! built against React's *production* package, which has no such calls, and the
//! app crashes with `jsxDEV is not a function`. For esbuild the project's
//! tsconfig is extended by a generated one that sets only `jsx`, so path
//! aliases and strictness are kept and no file of the user's is edited.

mod bun;
#[cfg(feature = "download")]
mod download;
mod esbuild;
mod process;

use std::path::{Path, PathBuf};

pub type Result<T> = std::result::Result<T, String>;

/// Which React build a bundle is made for.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum ReactMode {
    /// Fast, no dev checks. Every build except `glyx dev --devtools`.
    Production,
    /// React's development build: its warnings, and the render timings the
    /// DevTools CPU profiler needs. `glyx dev --devtools`.
    Development,
}

impl ReactMode {
    pub fn node_env(self) -> &'static str {
        match self {
            ReactMode::Production => "production",
            ReactMode::Development => "development",
        }
    }

    /// The tsconfig `jsx` value that matches this React build.
    pub(crate) fn jsx_setting(self) -> &'static str {
        match self {
            ReactMode::Production => "react-jsx",
            ReactMode::Development => "react-jsxdev",
        }
    }
}

/// Where a bundle's source map goes.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum SourceMap {
    None,
    /// Inside the bundle (dev only: it carries the app's source text).
    Inline,
    /// A separate `<output>.map` file, with no reference to it in the bundle.
    External,
}

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Format {
    /// One self-contained script: the app bundle.
    Iife,
    /// `module.exports = …`: a plugin the runner wraps itself.
    Cjs,
}

/// One bundle to make. Paths are relative to the working directory (the
/// project root) unless absolute.
#[derive(Clone, Debug)]
pub struct BundleSpec {
    pub entry: String,
    pub output: String,
    pub minify: bool,
    pub source_map: SourceMap,
    pub react: ReactMode,
    pub format: Format,
    /// Release builds: drop `testID` props before they reach native.
    pub strip_test_ids: bool,
}

impl BundleSpec {
    /// An app bundle: not minified, no source map, production React.
    pub fn app(entry: impl Into<String>, output: impl Into<String>) -> Self {
        BundleSpec {
            entry: entry.into(),
            output: output.into(),
            minify: false,
            source_map: SourceMap::None,
            react: ReactMode::Production,
            format: Format::Iife,
            strip_test_ids: false,
        }
    }
}

/// The tool that does the bundling.
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Backend {
    Esbuild(PathBuf),
    Bun(PathBuf),
}

/// Everything backend selection looks at, so it can be tested without
/// touching the environment.
#[derive(Clone, Debug)]
pub struct ResolveOptions {
    /// `GLYX_BUNDLER`: `esbuild`, `bun`, or unset for automatic.
    pub forced: Option<String>,
    /// `GLYX_ESBUILD`: a specific esbuild binary.
    pub esbuild_path: Option<PathBuf>,
    /// Where `node_modules` is looked for (walking up from here).
    pub project_dir: PathBuf,
    /// Where a downloaded esbuild is cached (`~/.glyx/tools`).
    pub cache_dir: PathBuf,
    /// False with `GLYX_BUNDLER_NO_DOWNLOAD=1`, or without the `download` feature.
    pub allow_download: bool,
    /// Bun, if it is on the PATH.
    pub bun: Option<PathBuf>,
}

impl ResolveOptions {
    pub fn from_env() -> Self {
        let var = |k: &str| std::env::var(k).ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty());
        ResolveOptions {
            forced: var("GLYX_BUNDLER").map(|v| v.to_ascii_lowercase()),
            esbuild_path: var("GLYX_ESBUILD").map(PathBuf::from),
            project_dir: std::env::current_dir().unwrap_or_else(|_| PathBuf::from(".")),
            cache_dir: process::glyx_home().join("tools"),
            allow_download: cfg!(feature = "download") && var("GLYX_BUNDLER_NO_DOWNLOAD").as_deref() != Some("1"),
            bun: process::find_on_path("bun"),
        }
    }
}

/// Pick the backend: esbuild (local, cached, or downloaded), else Bun.
pub fn resolve(opts: &ResolveOptions) -> Result<Backend> {
    match opts.forced.as_deref() {
        Some("bun") => {
            return opts.bun.clone().map(Backend::Bun)
                .ok_or_else(|| "GLYX_BUNDLER=bun, but `bun` is not on the PATH (https://bun.sh)".to_string());
        }
        Some("esbuild") | None => {}
        Some(other) => return Err(format!("GLYX_BUNDLER={other}: use `esbuild` or `bun`")),
    }

    match esbuild::resolve_binary(opts) {
        Ok(path) => Ok(Backend::Esbuild(path)),
        Err(esbuild_err) => match &opts.bun {
            // esbuild isn't available (offline?) but Bun is: that still works.
            Some(bun) if opts.forced.is_none() => {
                log::warn!("[bundler] {esbuild_err}; using Bun instead");
                Ok(Backend::Bun(bun.clone()))
            }
            _ => Err(esbuild_err),
        },
    }
}

/// A resolved backend, ready to bundle.
#[derive(Clone, Debug)]
pub struct Bundler {
    backend: Backend,
}

impl Bundler {
    /// The backend for this machine and project (see [`resolve`]).
    pub fn auto() -> Result<Self> {
        let backend = resolve(&ResolveOptions::from_env())?;
        log::debug!("[bundler] using {}", Bundler { backend: backend.clone() }.name());
        Ok(Bundler { backend })
    }

    pub fn new(backend: Backend) -> Self {
        Bundler { backend }
    }

    pub fn backend(&self) -> &Backend {
        &self.backend
    }

    pub fn name(&self) -> String {
        match &self.backend {
            Backend::Esbuild(p) => format!("esbuild ({})", p.display()),
            Backend::Bun(p) => format!("bun ({})", p.display()),
        }
    }

    /// Make the bundle described by `spec`.
    pub fn bundle(&self, spec: &BundleSpec) -> Result<()> {
        if let Some(dir) = Path::new(&spec.output).parent().filter(|d| !d.as_os_str().is_empty()) {
            std::fs::create_dir_all(dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
        }
        match &self.backend {
            Backend::Esbuild(bin) => esbuild::bundle(bin, spec),
            Backend::Bun(bin) => bun::bundle(bin, spec),
        }
    }

    /// Run a TypeScript (or JavaScript) config file and return what it prints,
    /// which is `glyx.config.ts`'s JSON (`defineConfig` prints it and exits).
    ///
    /// With esbuild the file is bundled to a temporary script and run with
    /// Node; with Bun, Bun runs it directly. If Node is missing but Bun isn't,
    /// Bun is used.
    pub fn eval_config(&self, file: &str) -> Result<String> {
        match &self.backend {
            Backend::Bun(bin) => bun::eval_config(bin, file),
            Backend::Esbuild(bin) => match esbuild::eval_config(bin, file) {
                Err(e) if e.starts_with(esbuild::NO_NODE) => match process::find_on_path("bun") {
                    Some(bun) => bun::eval_config(&bun, file),
                    None => Err(e),
                },
                other => other,
            },
        }
    }
}

/// Where the bundler keeps its generated files (`target/glyx/bundler`).
pub(crate) fn work_dir() -> Result<PathBuf> {
    let dir = std::env::current_dir()
        .map_err(|e| format!("cannot read the working directory: {e}"))?
        .join("target").join("glyx").join("bundler");
    std::fs::create_dir_all(&dir).map_err(|e| format!("cannot create {}: {e}", dir.display()))?;
    Ok(dir)
}

#[cfg(test)]
mod tests;
