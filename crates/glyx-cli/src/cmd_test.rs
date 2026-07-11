use anyhow::{bail, Context, Result};
use std::process::Command;

use super::{is_native_project, read_project_name, pm};

pub(super) fn cmd_test(js_only: bool, rust_only: bool, extra_args: &[String], p: pm::Pm) -> Result<()> {
    let native = is_native_project();
    let run_js   = !rust_only;
    let run_rust = !js_only && native;

    if !run_js && !run_rust {
        println!("Nothing to test (--rust requires a native project with Cargo.toml).");
        return Ok(());
    }

    let mut any_failed = false;

    // ── JS tests ─────────────────────────────────────────────────────────────
    if run_js {
        println!("Running JS tests ({} test)...", p.name());
        println!();

        // Look for a test directory — prefer js/src, then js, then src, then current dir.
        let test_root = ["js/src", "js", "src"]
            .into_iter()
            .find(|d| std::path::Path::new(d).exists())
            .unwrap_or(".");

        let mut cmd = pm::test_cmd(p, test_root);
        for arg in extra_args { cmd.arg(arg); }

        let pm_name = p.name();
        let status = cmd.status()
            .with_context(|| format!("Failed to run JS tests via {pm_name}; is it installed?"))?;
        if !status.success() {
            any_failed = true;
            if run_rust {
                eprintln!();
                eprintln!("JS tests failed — continuing to Rust tests...");
                eprintln!();
            }
        } else {
            println!();
            println!("✓ JS tests passed");
        }
    }

    // ── Rust tests ────────────────────────────────────────────────────────────
    if run_rust {
        let project_name = read_project_name().unwrap_or_else(|| "app".into());
        println!("Running Rust tests (cargo test -p {project_name})...");
        println!();

        let mut cmd = Command::new("cargo");
        cmd.args(["test", "-p", &project_name])
            .env("RUST_LOG", std::env::var("RUST_LOG").unwrap_or_else(|_| "warn".into()));
        // Pass extra args after the `--` separator only when running Rust-only
        // (mixing extra_args into cargo test when also running bun test is ambiguous).
        if js_only == false && run_js == false {
            if !extra_args.is_empty() {
                cmd.arg("--");
                for arg in extra_args { cmd.arg(arg); }
            }
        }

        let status = cmd.status().context("Failed to run `cargo test`")?;
        if !status.success() {
            any_failed = true;
        } else {
            println!();
            println!("✓ Rust tests passed");
        }
    }

    println!();
    if any_failed {
        bail!("Some tests failed");
    }
    println!("All tests passed.");
    Ok(())
}
