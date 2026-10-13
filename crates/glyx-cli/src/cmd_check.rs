use anyhow::{bail, Result};
use std::process::Command;

use super::{resolve_config_json, is_native_project, read_project_name, pm};

pub(super) fn cmd_check(config_only: bool, _p: pm::Pm) -> Result<()> {
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
        match run_tsc() {
            Ok(true) => {
                println!("  ✓ TypeScript OK");
                ok_count += 1;
            }
            Ok(false) => errors.push("TypeScript: type errors found (see above)".to_string()),
            Err(e) => errors.push(format!("TypeScript: {e}")),
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

/// The project's own TypeScript compiler (`node_modules/typescript/bin/tsc`, in
/// this folder or one above it: monorepos hoist `node_modules`).
fn find_local_tsc(from: &std::path::Path) -> Option<std::path::PathBuf> {
    from.ancestors().take(8)
        .map(|d| d.join("node_modules").join("typescript").join("bin").join("tsc"))
        .find(|p| p.is_file())
}

/// Type-check with the project's TypeScript, run by Node. Returns whether it passed.
/// It never fetches a compiler: a project without one is told how to add it.
fn run_tsc() -> Result<bool, String> {
    let cwd = std::env::current_dir().map_err(|e| format!("cannot read the working directory: {e}"))?;
    let tsc = find_local_tsc(&cwd).ok_or_else(|| {
        "TypeScript is not installed in this project. Add it with `npm install --save-dev typescript` (projects made with `glyx create --typescript` already list it: run your package manager's install)".to_string()
    })?;
    let node = std::env::var_os("PATH")
        .and_then(|p| std::env::split_paths(&p).map(|d| d.join(if cfg!(windows) { "node.exe" } else { "node" })).find(|n| n.is_file()))
        .ok_or_else(|| "Node.js is needed to run TypeScript (https://nodejs.org)".to_string())?;
    let status = Command::new(node)
        .arg(&tsc)
        .args(["--noEmit", "-p", "tsconfig.json"])
        .status()
        .map_err(|e| format!("could not run tsc: {e}"))?;
    Ok(status.success())
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

#[cfg(test)]
mod tests {
    use super::find_local_tsc;

    #[test]
    fn the_projects_own_typescript_is_found_here_or_in_a_parent_folder() {
        let root = std::env::temp_dir().join(format!("glyx-check-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&root);
        let project = root.join("packages").join("app");
        std::fs::create_dir_all(&project).unwrap();
        assert!(find_local_tsc(&project).is_none(), "nothing installed yet");

        let tsc = root.join("node_modules").join("typescript").join("bin").join("tsc");
        std::fs::create_dir_all(tsc.parent().unwrap()).unwrap();
        std::fs::write(&tsc, "").unwrap();
        assert_eq!(find_local_tsc(&project), Some(tsc.clone()), "a hoisted install is found");

        let own = project.join("node_modules").join("typescript").join("bin").join("tsc");
        std::fs::create_dir_all(own.parent().unwrap()).unwrap();
        std::fs::write(&own, "").unwrap();
        assert_eq!(find_local_tsc(&project), Some(own), "the project's own wins");
        let _ = std::fs::remove_dir_all(&root);
    }
}
