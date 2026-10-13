//! End-to-end checks against a real esbuild (downloaded and verified on first
//! use) and a real Node. They need the network and change the working
//! directory, so they are ignored by default; run them with:
//!
//!   cargo test -p glyx-bundler --test e2e -- --ignored --test-threads=1

use std::path::{Path, PathBuf};

use glyx_bundler::{BundleSpec, Bundler, Format, ReactMode, SourceMap};

fn project(tag: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("glyx-bundler-e2e-{tag}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(d.join("src/lib")).unwrap();
    d
}

fn write(path: PathBuf, text: &str) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, text).unwrap();
}

/// A stand-in `react` with the two JSX runtimes, enough to tell which one a
/// bundle was built against.
fn stub_react(dir: &Path) {
    let r = dir.join("node_modules/react");
    write(r.join("package.json"), r#"{"name":"react","version":"18.0.0","main":"index.js"}"#);
    write(r.join("index.js"), "exports.createElement = function (t, p) { return { t: t, p: p, via: 'createElement' }; };");
    write(r.join("jsx-runtime.js"), "exports.Fragment = 'F'; exports.jsx = exports.jsxs = function (t, p) { return { t: t, p: p, via: 'jsx' }; };");
    write(r.join("jsx-dev-runtime.js"), "exports.Fragment = 'F'; exports.jsxDEV = function (t, p) { return { t: t, p: p, via: 'jsxDEV' }; };");
}

fn app_files(dir: &Path, tsconfig_jsx: &str) {
    stub_react(dir);
    write(dir.join("tsconfig.json"), &format!(
        r#"{{ "compilerOptions": {{ "jsx": "{tsconfig_jsx}", "baseUrl": ".", "paths": {{ "@app/*": ["src/lib/*"] }} }} }}"#));
    // a component with no `import React`, TypeScript, JSX inside a plain .js file, and a path alias
    write(dir.join("src/Card.tsx"), "export function Card(p: { title: string }): unknown { return <div>{p.title}</div>; }\n");
    write(dir.join("src/legacy.js"), "export function Legacy() { return <span>js</span>; }\n");
    write(dir.join("src/lib/hello.ts"), "export const hello: string = 'aliased';\n");
    write(dir.join("src/app.tsx"),
        "import { Card } from './Card';\nimport { Legacy } from './legacy.js';\nimport { hello } from '@app/hello';\n\
         (globalThis as any).out = [Card({ title: hello }), Legacy()];\n");
}

fn bundle_in(dir: &Path, react: ReactMode, minify: bool) -> String {
    std::env::set_current_dir(dir).unwrap();
    let bundler = Bundler::auto().expect("a bundler (esbuild downloads on first use)");
    let mut spec = BundleSpec::app("src/app.tsx", "dist/app.js");
    spec.react = react;
    spec.minify = minify;
    bundler.bundle(&spec).unwrap_or_else(|e| panic!("bundle failed: {e}"));
    std::fs::read_to_string(dir.join("dist/app.js")).unwrap()
}

/// What the bundle produces when run (stdout of node).
fn run_in_node(dir: &Path) -> String {
    let script = "globalThis.process = process; require('./dist/app.js'); console.log(JSON.stringify(globalThis.out));";
    write(dir.join("run.cjs"), script);
    let out = std::process::Command::new("node").arg("run.cjs").current_dir(dir).output().expect("node");
    assert!(out.status.success(), "the bundle failed to run:\n{}", String::from_utf8_lossy(&out.stderr));
    String::from_utf8_lossy(&out.stdout).trim().to_string()
}

#[test]
#[ignore]
fn production_bundles_use_the_production_jsx_whatever_the_tsconfig_says() {
    // `react-jsx` is what an old scaffold wrote (and every Vite/Next template ships): it made Bun
    // emit the dev JSX calls. `react-jsxdev` and the classic transform are the other ways to break it.
    for user_setting in ["react-jsx", "react-jsxdev", "react"] {
        let dir = project(&format!("prod-{user_setting}"));
        app_files(&dir, user_setting);
        let js = bundle_in(&dir, ReactMode::Production, false);
        assert!(!js.contains("jsxDEV"), "tsconfig jsx={user_setting}: the bundle calls jsxDEV");
        assert!(!js.contains("createElement("), "tsconfig jsx={user_setting}: the bundle uses the classic transform");
        let out = run_in_node(&dir);
        assert!(out.contains(r#""via":"jsx""#) && out.contains("aliased"), "tsconfig jsx={user_setting}: {out}");
    }
}

#[test]
#[ignore]
fn development_bundles_use_the_dev_jsx() {
    let dir = project("dev");
    app_files(&dir, "react-jsx");
    let js = bundle_in(&dir, ReactMode::Development, false);
    assert!(js.contains("jsxDEV"), "a dev bundle should call jsxDEV");
    let out = run_in_node(&dir);
    assert!(out.contains(r#""via":"jsxDEV""#), "{out}");
}

#[test]
#[ignore]
fn minified_bundles_with_an_external_source_map() {
    let dir = project("map");
    app_files(&dir, "react-jsx");
    std::env::set_current_dir(&dir).unwrap();
    let mut spec = BundleSpec::app("src/app.tsx", "dist/app.js");
    spec.minify = true;
    spec.source_map = SourceMap::External;
    Bundler::auto().unwrap().bundle(&spec).unwrap();
    let js = std::fs::read_to_string(dir.join("dist/app.js")).unwrap();
    assert!(dir.join("dist/app.js.map").exists(), "the map is written next to the bundle");
    assert!(!js.contains("sourceMappingURL"), "and the bundle does not point at it");
    assert!(js.lines().count() < 20, "minified");
    let _ = run_in_node(&dir);
}

#[test]
#[ignore]
fn plugins_bundle_as_commonjs() {
    let dir = project("plugin");
    app_files(&dir, "react-jsx");
    write(dir.join("src/plugin.ts"), "export const answer: number = 42;\n");
    std::env::set_current_dir(&dir).unwrap();
    let mut spec = BundleSpec::app("src/plugin.ts", "dist/plugin.js");
    spec.format = Format::Cjs;
    Bundler::auto().unwrap().bundle(&spec).unwrap();
    write(dir.join("run.cjs"), "console.log(require('./dist/plugin.js').answer);");
    let out = std::process::Command::new("node").arg("run.cjs").current_dir(&dir).output().unwrap();
    assert_eq!(String::from_utf8_lossy(&out.stdout).trim(), "42");
}

#[test]
#[ignore]
fn a_typescript_config_is_run_with_the_real_define_config() {
    let dir = project("config");
    // the real @glyx-dev/config source, installed the way npm would (main = src/index.ts)
    let pkg = dir.join("node_modules/@glyx-dev/config");
    write(pkg.join("package.json"), r#"{"name":"@glyx-dev/config","main":"src/index.ts","types":"src/index.ts"}"#);
    write(pkg.join("src/index.ts"), include_str!("../../../js/packages/@glyx/config/src/index.ts"));
    write(dir.join("glyx.config.ts"),
        "import { defineConfig } from '@glyx-dev/config';\n\
         export default defineConfig({ name: 'demo', version: '1.2.3', window: { title: 'Demo', width: 640, height: 480 } });\n");
    std::env::set_current_dir(&dir).unwrap();
    let json = Bundler::auto().unwrap().eval_config("glyx.config.ts").expect("the config runs");
    let v: serde_json::Value = serde_json::from_str(&json).unwrap_or_else(|e| panic!("not JSON ({e}): {json}"));
    assert_eq!(v["name"], "demo");
    assert_eq!(v["window"]["width"], 640);
}

/// The real download, checked against the pinned hash, then actually run.
#[test]
#[ignore]
fn esbuild_is_downloaded_verified_and_cached() {
    let cache = std::env::temp_dir().join(format!("glyx-bundler-cache-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&cache);
    let opts = glyx_bundler::ResolveOptions {
        forced: None,
        esbuild_path: None,
        project_dir: std::env::temp_dir().join("no-node-modules-here"),
        cache_dir: cache.clone(),
        allow_download: true,
        bun: None,
    };
    let backend = glyx_bundler::resolve(&opts).expect("the pinned esbuild downloads and verifies");
    let glyx_bundler::Backend::Esbuild(path) = backend else { panic!("expected esbuild") };
    assert!(path.starts_with(&cache));
    let version = std::process::Command::new(&path).arg("--version").output().unwrap();
    assert_eq!(String::from_utf8_lossy(&version.stdout).trim(), "0.28.2");
    // a second resolve uses the cache (no network needed)
    let mut offline = opts.clone();
    offline.allow_download = false;
    assert_eq!(glyx_bundler::resolve(&offline).unwrap(), glyx_bundler::Backend::Esbuild(path));
    let _ = std::fs::remove_dir_all(&cache);
}

/// Bundle a project made by `glyx create` (real React, real @glyx-dev packages,
/// installed with npm): `GLYX_E2E_PROJECT` is its folder, `GLYX_E2E_ENTRY` its entry
/// (default `src/app.tsx`). Skipped when the folder isn't given.
#[test]
#[ignore]
fn a_scaffolded_project_bundles_in_both_react_modes_and_its_config_runs() {
    let Ok(dir) = std::env::var("GLYX_E2E_PROJECT") else {
        eprintln!("GLYX_E2E_PROJECT is not set; skipping");
        return;
    };
    let entry = std::env::var("GLYX_E2E_ENTRY").unwrap_or_else(|_| "src/app.tsx".to_string());
    let dir = PathBuf::from(dir);
    std::env::set_current_dir(&dir).unwrap();
    let bundler = Bundler::auto().unwrap();

    for react in [ReactMode::Production, ReactMode::Development] {
        let mut spec = BundleSpec::app(entry.clone(), "dist/app.js");
        spec.react = react;
        bundler.bundle(&spec).unwrap_or_else(|e| panic!("{react:?} bundle failed: {e}"));
        let js = std::fs::read_to_string(dir.join("dist/app.js")).unwrap();
        assert!(js.len() > 10_000, "{react:?}: a real app bundle, got {} bytes", js.len());
        match react {
            ReactMode::Production => assert!(!js.contains("jsx_dev_runtime"), "production bundle has the dev JSX runtime"),
            ReactMode::Development => assert!(js.contains("jsx_dev_runtime"), "dev bundle should use the dev JSX runtime"),
        }
        println!("{react:?}: {} KB", js.len() / 1024);
    }

    let json = bundler.eval_config("glyx.config.ts").expect("glyx.config.ts runs");
    let v: serde_json::Value = serde_json::from_str(&json).unwrap_or_else(|e| panic!("not JSON ({e}): {json}"));
    assert_eq!(v["dev"]["entry"], entry.as_str(), "the config points at the entry the scaffold wrote");
}
