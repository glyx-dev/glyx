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

use anyhow::{bail, Context, Result};

use super::cmd_package::{ensure_icupkg, icupkg_command};
use super::signed_asset;

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
    //
    // `icupkg -l` validates internal dependencies and exits non-zero when the
    // data is internally inconsistent (e.g. `brkitr/ko.res` references a
    // `brkitr/line_cj.brk` that isn't present). It still prints the full item
    // list to stdout first, so we use the listing and only bail when it's
    // actually empty — the dependency warning is non-fatal for trimming
    // because the remove step runs with `--ignore-deps`.
    let out = icupkg_command(&icupkg)
        .args(["-l", "--auto_toc_prefix", in_dat.to_str().unwrap()])
        .output()
        .with_context(|| format!("failed to run icupkg -l on {}", in_dat.display()))?;
    let listing = String::from_utf8_lossy(&out.stdout);
    if listing.lines().filter(|l| !l.trim().is_empty()).count() == 0 {
        bail!(
            "icupkg -l produced no listing: {}",
            String::from_utf8_lossy(&out.stderr)
        );
    }

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

    let status = icupkg_command(&icupkg)
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

/// The full ICU data that is trimmed to the app's locales.
///
/// In the glyx source checkout it is the `icudtl.dat` in the glyx-runtime crate. Everywhere else (a
/// JS developer who installed the CLI) it is the release's `glyx-icudtl-<version>.dat`, signed with
/// the capability key: downloaded once into `~/.glyx/icu/`, verified before use. V8 reads this
/// file straight into memory, so an unverified one is as dangerous as an unverified native module.
fn full_icu_path() -> Result<PathBuf> {
    if let Some(ws) = super::find_workspace_root()? {
        let p = ws.join("crates").join("glyx-runtime").join("icudtl.dat");
        if p.exists() {
            return Ok(p);
        }
    }
    let version = env!("CARGO_PKG_VERSION");
    let path = signed_asset::fetch_verified(
        &ICU_KIND,
        &super::glyx_dir(),
        &icu_asset_name(version),
        version,
        super::tools::tools_base().as_deref(),
        &glyx_verify::CAP_PUBKEY,
        &|url, max| signed_asset::http_get(url, max),
    )?;
    Ok(path)
}

/// Far more than the 10 MB ICU 77 data; a limit so a bad mirror cannot fill the disk.
const ICU_KIND: signed_asset::Kind = signed_asset::Kind {
    what:       "ICU data",
    cache_dir:  "icu",
    mirror_dir: "icu",
    max_bytes:  64 * 1024 * 1024,
};

/// `glyx-icudtl-0.2.0.dat` — the release asset (and, with `.sig`, its signature).
fn icu_asset_name(version: &str) -> String {
    format!("glyx-icudtl-{version}.dat")
}

/// Trim `icudtl.dat` to the app's locales and place the result at
/// `bin_dir/icudtl.dat`. Returns the destination path. Safe to call repeatedly.
/// `icupkg` is an optional override path (from `--icupkg` / `$GLYX_ICUPKG`).
///
/// Returns `None` for the QuickJS engine, which has no ICU (`Intl` is a V8 feature here): nothing is
/// downloaded, trimmed or shipped.
pub(super) fn trim_icu_for_app(project_name: &str, bin_dir: &Path, icupkg: Option<PathBuf>) -> Result<Option<PathBuf>> {
    if !engine_uses_icu(&super::read_engine_from_config()) {
        return Ok(None);
    }
    let locales = read_app_locales();
    let full = full_icu_path()?;
    std::fs::create_dir_all(bin_dir)?;
    let out = bin_dir.join("icudtl.dat");

    let orig = std::fs::metadata(&full).map(|m| m.len()).unwrap_or(0);
    // Trimming is only a size optimisation. If it cannot be done (no `icupkg` for this platform, the
    // download failed, the tool did not run), ship the full data rather than none: without ICU data
    // the app has no `Intl` at all.
    let removed = match trim_icu_data(&locales, &full, &out, icupkg) {
        Ok(n) => n,
        Err(e) => {
            log::warn!("ICU trim skipped ({e:#}); shipping the full ICU data instead");
            std::fs::copy(&full, &out)
                .with_context(|| format!("copy {} → {}", full.display(), out.display()))?;
            println!("✓ ICU data: full ({:.1} MB; could not trim to [{}])", orig as f64 / 1_048_576.0, locales.join(","));
            return Ok(Some(out));
        }
    };
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
    Ok(Some(out))
}

/// Only the V8 engine loads ICU data; the QuickJS runtime does not use it.
fn engine_uses_icu(engine: &str) -> bool {
    engine != "quickjs"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_the_v8_engine_uses_icu_data() {
        assert!(engine_uses_icu("v8"));
        assert!(!engine_uses_icu("quickjs"));
    }

    #[test]
    fn the_icu_asset_is_named_per_version_and_lives_under_icu() {
        assert_eq!(icu_asset_name("0.2.0"), "glyx-icudtl-0.2.0.dat");
        let a = icu_asset_name("0.2.0");
        assert_eq!(
            signed_asset::asset_url(&ICU_KIND, &a, "0.2.0", None),
            "https://github.com/glyx-dev/glyx/releases/download/v0.2.0/glyx-icudtl-0.2.0.dat",
        );
        assert_eq!(
            signed_asset::asset_url(&ICU_KIND, &a, "0.2.0", Some("https://mirror.example")),
            "https://mirror.example/icu/glyx-icudtl-0.2.0.dat",
        );
        let root = std::path::Path::new("/home/u/.glyx");
        assert_eq!(
            signed_asset::cache_path(&ICU_KIND, root, &a),
            root.join("icu").join("glyx-icudtl-0.2.0.dat"),
        );
    }
}
