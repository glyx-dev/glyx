use anyhow::Result;

use super::{RuntimeCommands, find_or_build_runner, glyx_runners_dir, runner_bin_name, glyx_home};

fn evict_cached_runners() {
    let dir = glyx_runners_dir();
    let bin = runner_bin_name();
    // Remove user-cache copies (~/.glyx/runners/...)
    for profile in ["dev", "prod"] {
        let path = dir.join(profile).join(&bin);
        if path.exists() {
            if let Err(e) = std::fs::remove_file(&path) {
                eprintln!("warning: could not remove {}: {e}", path.display());
            } else {
                println!("  removed cached {profile} runner");
            }
        }
    }
    // Also remove workspace target/ binaries so find_or_build_runner can't
    // short-circuit to a stale binary on step 2.
    if let Ok(home) = glyx_home() {
        for ws_profile in ["debug", "release"] {
            let path = home.join("target").join(ws_profile).join(&bin);
            if path.exists() {
                if let Err(e) = std::fs::remove_file(&path) {
                    eprintln!("warning: could not remove workspace binary {}: {e}", path.display());
                } else {
                    println!("  removed workspace {ws_profile} runner");
                }
            }
        }
    }
}

pub(super) fn cmd_runtime(cmd: RuntimeCommands) -> Result<()> {
    match cmd {
        RuntimeCommands::List => {
            let dir = glyx_runners_dir();
            println!("Cached glyx-runner binaries:");
            let mut found = false;
            for profile in ["dev", "prod"] {
                let path = dir.join(profile).join(runner_bin_name());
                if path.exists() {
                    let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                    println!("  [{profile}] {} ({:.1} MB)", path.display(), size as f64 / (1024.0 * 1024.0));
                    found = true;
                }
            }
            // Also show workspace target/ if present
            if let Ok(home) = glyx_home() {
                for profile in ["debug", "release"] {
                    let path = home.join("target").join(profile).join(runner_bin_name());
                    if path.exists() {
                        let size = std::fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
                        println!("  [workspace/{profile}] {} ({:.1} MB)", path.display(), size as f64 / (1024.0 * 1024.0));
                        found = true;
                    }
                }
            }
            if !found {
                println!("  (none cached — run `glyx runtime build` to build from source)");
            }
            Ok(())
        }
        RuntimeCommands::Build { force } => {
            if force {
                println!("Evicting cached runners...");
                evict_cached_runners();
            }
            println!("Building glyx-runner from source...");
            let dev  = find_or_build_runner(true)?;
            let prod = find_or_build_runner(false)?;
            println!();
            println!("✓ Dev runner (hot-reload):  {}", dev.display());
            println!("✓ Prod runner (lean):       {}", prod.display());
            Ok(())
        }
        RuntimeCommands::Install { version } => {
            // Future: download prebuilt binary from GitHub releases
            // For now: build from source (same as `glyx runtime build`)
            let v = version.as_deref().unwrap_or("local");
            println!("Installing glyx-runner v{v} (building from source)...");
            println!("  (Prebuilt binary download is planned for a future release)");
            evict_cached_runners();
            let dev  = find_or_build_runner(true)?;
            let prod = find_or_build_runner(false)?;
            println!();
            println!("✓ Dev runner:  {}", dev.display());
            println!("✓ Prod runner: {}", prod.display());
            Ok(())
        }
    }
}
