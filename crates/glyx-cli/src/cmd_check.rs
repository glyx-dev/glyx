use anyhow::{bail, Result};
use std::process::Command;

use super::{resolve_config_json, is_native_project, read_project_name, pm};

pub(super) fn cmd_check(config_only: bool, p: pm::Pm) -> Result<()> {
    let mut errors: Vec<String> = Vec::new();
    let mut ok_count = 0;

    // ── 1. glyx.config validation ────────────────────────────────────────────
    println!("Checking glyx config...");
    match resolve_config_json() {
        Err(e) => {
            errors.push(format!("glyx.config: {e}"));
        }
        Ok(json) => {
            match serde_json::from_str::<serde_json::Value>(&json) {
                Err(e) => {
                    errors.push(format!("glyx.config: invalid JSON — {e}"));
                }
                Ok(cfg) => {
                    let mut cfg_ok = true;
                    // Check required dev.entry exists on disk
                    if let Some(entry) = cfg.pointer("/dev/entry").and_then(|v| v.as_str()) {
                        if !std::path::Path::new(entry).exists() {
                            errors.push(format!("glyx.config: dev.entry '{entry}' not found"));
                            cfg_ok = false;
                        }
                    } else {
                        errors.push("glyx.config: missing dev.entry".to_string());
                        cfg_ok = false;
                    }
                    if cfg_ok {
                        println!("  ✓ glyx.config valid");
                        ok_count += 1;
                    }
                }
            }
        }
    }

    if config_only {
        return finish_check(ok_count, &errors);
    }

    // ── 2. TypeScript check ───────────────────────────────────────────────────
    if std::path::Path::new("tsconfig.json").exists() {
        println!("Type-checking TypeScript...");
        let status = pm::dlx_cmd(p, "tsc")
            .arg("--noEmit")
            .status();
        match status {
            Ok(s) if s.success() => {
                println!("  ✓ TypeScript OK");
                ok_count += 1;
            }
            Ok(_) => errors.push("TypeScript: type errors found (see above)".to_string()),
            Err(e) => errors.push(format!("TypeScript: could not run tsc via {} — {e}", p.name())),
        }
    } else {
        println!("  (no tsconfig.json — skipping TS check)");
    }

    // ── 3. Rust check (native projects only) ─────────────────────────────────
    if is_native_project() {
        let project_name = read_project_name().unwrap_or_else(|| "app".into());
        println!("Checking Rust ({project_name})...");
        let status = Command::new("cargo")
            .args(["check", "-p", &project_name, "--message-format=short"])
            .env("RUST_LOG", "off")
            .status();
        match status {
            Ok(s) if s.success() => {
                println!("  ✓ Rust OK");
                ok_count += 1;
            }
            Ok(_) => errors.push("Rust: cargo check failed (see above)".to_string()),
            Err(e) => errors.push(format!("Rust: could not run cargo — {e}")),
        }
    }

    finish_check(ok_count, &errors)
}

pub(super) fn finish_check(ok_count: usize, errors: &[String]) -> Result<()> {
    println!();
    if errors.is_empty() {
        println!("✓ All checks passed ({ok_count} check{s})", s = if ok_count == 1 { "" } else { "s" });
        Ok(())
    } else {
        for e in errors {
            eprintln!("✗ {e}");
        }
        println!();
        bail!("{} check{s} failed", errors.len(), s = if errors.len() == 1 { "" } else { "s" });
    }
}
