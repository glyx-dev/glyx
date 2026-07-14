//! Trim `icudtl.dat` to an app's declared locales so packaged apps stay light.
//!
//! icupkg (from ICU 77.1) removes named items from the ICU common-data
//! package. We keep the `root` bundle plus every requested locale and its
//! parent prefixes, and remove all *other top-level locale `.res` bundles*
//! (e.g. `fr.res`, `ja.res`, `ar_EG.res`). Subtrees such as `coll/`, `brkitr/`,
//! `cnv`, `nrm`, `curr/`, `unit/` are left intact so `Intl` core keeps working;
//! locale-scoped data inside those subtrees is small and safe to keep.

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::process::Command;

use anyhow::{bail, Context, Result};

use super::cmd_package::ensure_icupkg;

/// Locales we always retain: `root` is required for ICU fallback, and we add
/// every requested locale together with all of its parent prefixes
/// (`de_DE` → `de_DE`, `de`).
fn keep_set(locales: &[String]) -> HashSet<String> {
    let mut keep: HashSet<String> = HashSet::new();
    keep.insert("root".to_string());
    for loc in locales {
        let loc = loc.trim();
        if loc.is_empty() {
            continue;
        }
        let mut prefix = String::new();
        for part in loc.split('_') {
            if !prefix.is_empty() {
                prefix.push('_');
            }
            prefix.push_str(part);
            keep.insert(prefix.clone());
        }
    }
    keep
}

/// Trim `in_dat` to `locales`, writing the result to `out_dat`.
///
/// Conservative trim: only top-level locale `.res` bundles are removed. Returns
/// the number of items removed (for reporting). On empty trim it just copies.
/// `icupkg` is an optional override path (from `--icupkg` / `$GLYX_ICUPKG`).
pub(super) fn trim_icu_data(
    locales: &[String],
    in_dat: &Path,
    out_dat: &Path,
    icupkg: Option<PathBuf>,
) -> Result<usize> {
    let icupkg = ensure_icupkg(icupkg)?;

    // 1. List the package items (prefix auto-stripped to `af.res`, etc.).
    let out = Command::new(&icupkg)
        .args(["-l", "--auto_toc_prefix", in_dat.to_str().unwrap()])
        .output()
        .with_context(|| format!("failed to run icupkg -l on {}", in_dat.display()))?;
    if !out.status.success() {
        bail!("icupkg -l failed: {}", String::from_utf8_lossy(&out.stderr));
    }
    let listing = String::from_utf8_lossy(&out.stdout);

    let keep = keep_set(locales);
    let remove: Vec<String> = listing
        .lines()
        .map(|l| l.trim())
        .filter(|l| !l.is_empty())
        // Top-level locale bundles only (no subtree like curr/de.res).
        .filter(|l| l.ends_with(".res") && !l.contains('/'))
        .filter(|l| !keep.contains(&l.replace(".res", "")))
        .map(|l| l.to_string())
        .collect();

    if remove.is_empty() {
        std::fs::copy(in_dat, out_dat)
            .with_context(|| format!("copy {} → {}", in_dat.display(), out_dat.display()))?;
        return Ok(0);
    }

    // 2. Write the remove list and run icupkg -r.
    let list_path = out_dat.with_extension("remove.txt");
    std::fs::write(&list_path, remove.join("\n"))
        .with_context(|| format!("write remove list {}", list_path.display()))?;

    let status = Command::new(&icupkg)
        .args([
            "-r",
            list_path.to_str().unwrap(),
            "--auto_toc_prefix",
            "--ignore-deps",
            "-tl",
            in_dat.to_str().unwrap(),
            out_dat.to_str().unwrap(),
        ])
        .status()
        .with_context(|| "failed to run icupkg -r")?;
    if !status.success() {
        bail!("icupkg -r failed to trim {}", in_dat.display());
    }
    let _ = std::fs::remove_file(&list_path);
    Ok(remove.len())
}

/// Resolve the app's declared locales from its resolved glyx config.
/// Defaults to `["en"]` when unset or unreadable.
pub(super) fn read_app_locales() -> Vec<String> {
    match super::resolve_config_json() {
        Ok(json) => {
            let v: serde_json::Value = serde_json::from_str(&json).unwrap_or_default();
            let locales = v
                .get("locales")
                .and_then(|a| a.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|x| x.as_str().map(|s| s.to_string()))
                        .filter(|s| !s.is_empty())
                        .collect::<Vec<String>>()
                })
                .filter(|v: &Vec<String>| !v.is_empty());
            locales.unwrap_or_else(|| vec!["en".to_string()])
        }
        Err(_) => vec!["en".to_string()],
    }
}

/// Locate the full `icudtl.dat` shipped in the glyx-runtime crate.
fn full_icu_path() -> Result<PathBuf> {
    let ws = super::find_workspace_root()?
        .context("could not locate workspace root to find icudtl.dat")?;
    let p = ws.join("crates").join("glyx-runtime").join("icudtl.dat");
    if !p.exists() {
        bail!("ICU source data not found at {}", p.display());
    }
    Ok(p)
}

/// Trim `icudtl.dat` to the app's locales and place the result at
/// `bin_dir/icudtl.dat`. Returns the destination path. Safe to call repeatedly.
/// `icupkg` is an optional override path (from `--icupkg` / `$GLYX_ICUPKG`).
pub(super) fn trim_icu_for_app(project_name: &str, bin_dir: &Path, icupkg: Option<PathBuf>) -> Result<PathBuf> {
    let locales = read_app_locales();
    let full = full_icu_path()?;
    std::fs::create_dir_all(bin_dir)?;
    let out = bin_dir.join("icudtl.dat");

    let orig = std::fs::metadata(&full).map(|m| m.len()).unwrap_or(0);
    let removed = trim_icu_data(&locales, &full, &out, icupkg)?;
    let trimmed = std::fs::metadata(&out).map(|m| m.len()).unwrap_or(0);
    let pct = if orig > 0 {
        (100 * (orig - trimmed) / orig) as u32
    } else {
        0
    };
    println!(
        "✓ ICU data: {} locales [{}] — removed {} items, {:.1} MB → {:.1} MB (-{}%)",
        project_name,
        locales.join(","),
        removed,
        orig as f64 / 1_048_576.0,
        trimmed as f64 / 1_048_576.0,
        pct,
    );
    Ok(out)
}
