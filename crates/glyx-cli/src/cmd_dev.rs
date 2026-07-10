use anyhow::{Context, Result};
use std::process::Command;

use super::{
    read_project_name, read_dev_config, read_dev_inspect_port,
    bun_build, is_native_project, find_or_build_runner,
};

pub(super) fn cmd_dev(inspect: Option<u16>) -> Result<()> {
    let project_name = read_project_name()
        .context("Run `glyx dev` from the project root (where glyx.config.ts or package.json lives)")?;
    let cfg = read_dev_config();
    if let Some((entry, output)) = &cfg {
        println!("Building JS: {} → {}", entry, output);
        bun_build(entry, output).context("Initial bun build failed")?;
        println!("✓ JS built");
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
        let mut cmd = Command::new("cargo");
        cmd.args(["run", "-p", &project_name])
            .env("RUST_LOG", std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into()))
            // Allow locally-built media DLLs with stub signatures in dev mode.
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
        // Suppress noisy symphonia probe warnings (emitted when probing MKV/other
        // containers if the matching demuxer feature isn't compiled in).
        let rust_log = std::env::var("RUST_LOG").unwrap_or_else(|_| "info".into());
        let rust_log = if rust_log.contains("symphonia") { rust_log }
                       else { format!("{rust_log},symphonia_bundle_mp3=off,symphonia_codec_aac=off") };
        cmd.env("RUST_LOG", rust_log);
        // In dev mode, allow locally-built media DLLs with stub signatures.
        // Production runners verify the Ed25519 signature; dev runners skip it.
        cmd.env("GLYX_MEDIA_SKIP_VERIFY", "1");
        if let Some(port) = inspect {
            cmd.env("GLYX_INSPECT_PORT", port.to_string());
        }
        let status = cmd.status()
            .with_context(|| format!("Failed to launch {}", runner.display()))?;
        std::process::exit(status.code().unwrap_or(1));
    }
}
