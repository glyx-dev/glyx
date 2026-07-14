use anyhow::{Context, Result};
use std::path::PathBuf;
use std::process::Command;

use super::{
    read_project_name, read_dev_config, read_dev_inspect_port,
    is_native_project, find_or_build_runner, resolve_config_json, pm,
};

pub(super) fn cmd_dev(inspect: Option<u16>, p: pm::Pm, icupkg: Option<PathBuf>) -> Result<()> {
    let project_name = read_project_name()
        .context("Run `glyx dev` from the project root (where glyx.config.ts or package.json lives)")?;

    // Resolve config once in the CLI (with full PM detection) and pass it to
    // the runner via env var so the runner never needs to re-run bun/npm itself.
    let config_json = match resolve_config_json() {
        Ok(json) => json,
        Err(e) => {
            eprintln!("[glyx] warning: could not resolve glyx.config.ts: {e}");
            eprintln!("[glyx] hint: make sure dependencies are installed and glyx.config.ts is valid.");
            String::new()
        }
    };

    let cfg = read_dev_config();
    if let Some((entry, output)) = &cfg {
        println!("Building JS: {} → {}", entry, output);
        pm::js_bundle(p, entry, output, /*minify=*/false, /*source_map=*/true)
            .context("Initial JS build failed")?;
        println!("✓ JS built");
    } else if config_json.is_empty() {
        eprintln!("[glyx] warning: no dev.entry found — JS bundle will not be built.");
        eprintln!("[glyx] hint: check that glyx.config.ts has a `dev` section with `entry` and `output`.");
    }

    // --inspect flag takes priority; fall back to dev.inspect from config.
    let inspect = inspect.or_else(read_dev_inspect_port);

    if let Some(port) = inspect {
        println!("Starting dev server for '{project_name}' (hot reload + CDP inspector on :{port})...");
        println!("  Open chrome://inspect and add 127.0.0.1:{port} under Discover network targets.");
    } else {
        println!("Starting dev server for '{project_name}' (hot reload active)...");
    }

    if is_native_project() {
        // Native project: custom Rust extensions compiled in — use cargo run
        // Place a trimmed icudtl.dat next to the debug binary so the app
        // (which builds without the embedded ICU data) can load it.
        let dbg_dir = std::path::PathBuf::from("target/debug");
        if let Err(e) = super::icu_trim::trim_icu_for_app(&project_name, &dbg_dir, icupkg.clone()) {
            log::warn!("ICU trim skipped: {e}");
        }

        // Native project: custom Rust extensions compiled in — use cargo run
        let mut cmd = Command::new("cargo");
        cmd.args(["run", "-p", &project_name])
            .env("RUST_LOG", std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
            .env("GLYX_CONFIG_JSON", &config_json)
            .env("GLYX_MEDIA_SKIP_VERIFY", "1");
        if let Some(port) = inspect {
            cmd.env("GLYX_INSPECT_PORT", port.to_string());
        }
        let status = cmd.status().context("Failed to run `cargo run`; is Rust installed?")?;
        std::process::exit(status.code().unwrap_or(1));
    } else {
        // JS-only project: spawn the prebuilt glyx-runner (dev build with hot-reload)
        let runner = find_or_build_runner(true)
            .context("Could not find or build glyx-runner. Run `glyx runtime build`.")?;
        log::info!("Using runner: {}", runner.display());
        let mut cmd = Command::new(&runner);
        // Point the (shared) runner at this app's trimmed ICU data.
        let icu_dir = std::path::PathBuf::from("target/glyx/icu");
        match super::icu_trim::trim_icu_for_app(&project_name, &icu_dir, icupkg.clone()) {
            Ok(dat) => { cmd.env("GLYX_ICU_DATA", &dat); }
            Err(e)  => log::warn!("ICU trim skipped: {e}"),
        }
        // Suppress noisy symphonia probe warnings (emitted when probing MKV/other
        // containers if the matching demuxer feature isn't compiled in).
        let rust_log = std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into());
        let rust_log = if rust_log.contains("symphonia") { rust_log }
                       else { format!("{rust_log},symphonia_bundle_mp3=off,symphonia_codec_aac=off") };
        cmd.env("RUST_LOG", rust_log)
           .env("GLYX_CONFIG_JSON", &config_json)
           .env("GLYX_MEDIA_SKIP_VERIFY", "1");
        if let Some(port) = inspect {
            cmd.env("GLYX_INSPECT_PORT", port.to_string());
        }
        let status = cmd.status()
            .with_context(|| format!("Failed to launch {}", runner.display()))?;
        std::process::exit(status.code().unwrap_or(1));
    }
}
