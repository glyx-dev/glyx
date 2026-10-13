//! The Bun backend, used when esbuild can't be had or `GLYX_BUNDLER=bun`.
//!
//! Bun is driven through its JavaScript API (`Bun.build`), not `bun build`:
//! the CLI has no way to pick the production JSX runtime without also
//! minifying, so a project whose tsconfig says `react-jsx` got the development
//! JSX calls (`jsxDEV`) against React's production package and crashed. The
//! API takes `jsx: { development }` directly.
//!
//! One thing Bun can't do: a project tsconfig with the classic `"jsx": "react"`
//! wins over the API, and components without `import React` then fail. That is
//! warned about; esbuild (the default) has no such limit.

use std::path::Path;

use crate::{process, work_dir, BundleSpec, Format, ReactMode, Result, SourceMap};

const SCRIPT: &str = r#"// Written by glyx-bundler: builds the bundle described by the JSON file in argv[2].
const opts = JSON.parse(await Bun.file(process.argv[2]).text());
const result = await Bun.build({
  entrypoints: [opts.entry],
  target: 'browser',
  format: opts.format,
  minify: opts.minify,
  sourcemap: opts.sourceMap,
  define: opts.define,
  jsx: { runtime: 'automatic', development: opts.development },
});
if (!result.success) {
  for (const log of result.logs) console.error(String(log));
  process.exit(1);
}
for (const out of result.outputs) {
  if (out.kind === 'entry-point') await Bun.write(opts.output, out);
  else if (out.kind === 'sourcemap') await Bun.write(opts.output + '.map', out);
}
"#;

/// The options file the script reads.
pub(crate) fn options_json(spec: &BundleSpec) -> String {
    let mut define = serde_json::Map::new();
    define.insert("process.env.NODE_ENV".to_string(), format!("\"{}\"", spec.react.node_env()).into());
    if spec.strip_test_ids {
        define.insert("__GLYX_STRIP_TEST_IDS__".to_string(), "true".into());
    }
    serde_json::json!({
        "entry": spec.entry,
        "output": spec.output,
        "format": match spec.format { Format::Iife => "iife", Format::Cjs => "cjs" },
        "minify": spec.minify,
        "sourceMap": match spec.source_map { SourceMap::None => "none", SourceMap::Inline => "inline", SourceMap::External => "external" },
        "development": spec.react == ReactMode::Development,
        "define": define,
    }).to_string()
}

/// True if a tsconfig's text sets the classic JSX transform (`"jsx": "react"`).
pub(crate) fn classic_jsx(tsconfig: &str) -> bool {
    let mut rest = tsconfig;
    while let Some(at) = rest.find("\"jsx\"") {
        rest = &rest[at + 5..];
        let after = rest.trim_start();
        if let Some(value) = after.strip_prefix(':') {
            let value = value.trim_start();
            if let Some(quoted) = value.strip_prefix('"') {
                if let Some(end) = quoted.find('"') {
                    if quoted[..end].eq_ignore_ascii_case("react") {
                        return true;
                    }
                }
            }
        }
    }
    false
}

pub(crate) fn bundle(bun: &Path, spec: &BundleSpec) -> Result<()> {
    if let Ok(text) = std::fs::read_to_string("tsconfig.json") {
        if classic_jsx(&text) {
            log::warn!(
                "[bundler] tsconfig.json sets \"jsx\": \"react\" (the classic transform), which Bun applies over Glyx's \
                 setting: components without `import React` will fail. Use \"jsx\": \"react-jsx\", or esbuild \
                 (npm install --save-dev esbuild, and unset GLYX_BUNDLER)."
            );
        }
    }
    let dir = work_dir()?;
    let script = dir.join("bun-build.mjs");
    if std::fs::read_to_string(&script).ok().as_deref() != Some(SCRIPT) {
        std::fs::write(&script, SCRIPT).map_err(|e| format!("cannot write {}: {e}", script.display()))?;
    }
    let opts = dir.join(format!("bun-build.{}.json", std::process::id()));
    std::fs::write(&opts, options_json(spec)).map_err(|e| format!("cannot write {}: {e}", opts.display()))?;
    let run = process::command(bun).arg(&script).arg(&opts).output();
    let _ = std::fs::remove_file(&opts);
    let out = run.map_err(|e| format!("failed to run bun ({}): {e}", bun.display()))?;
    if !out.status.success() {
        return Err(format!("bun build failed:\n{}", String::from_utf8_lossy(&out.stderr).trim()));
    }
    Ok(())
}

pub(crate) fn eval_config(bun: &Path, file: &str) -> Result<String> {
    // `bun <file>`, not `bun run <file>`: `run` treats a default-exported object as a server.
    let out = process::command(bun).arg(file).output().map_err(|e| format!("failed to run bun: {e}"))?;
    let stdout = String::from_utf8_lossy(&out.stdout).trim().to_string();
    if out.status.success() || !stdout.is_empty() {
        Ok(stdout)
    } else {
        Err(format!("{file} failed:\n{}", String::from_utf8_lossy(&out.stderr).trim()))
    }
}
