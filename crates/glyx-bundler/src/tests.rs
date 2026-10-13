use std::path::{Path, PathBuf};

use crate::bun;
use crate::esbuild::{self, cached_binary, local_candidates, ESBUILD_VERSION};
use crate::process::find_in;
use crate::*;

fn temp_dir(tag: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("glyx-bundler-{tag}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    std::fs::create_dir_all(&d).unwrap();
    d
}

fn touch(path: &Path) {
    std::fs::create_dir_all(path.parent().unwrap()).unwrap();
    std::fs::write(path, b"x").unwrap();
}

fn opts(project: &Path, cache: &Path) -> ResolveOptions {
    ResolveOptions {
        forced: None,
        esbuild_path: None,
        project_dir: project.to_path_buf(),
        cache_dir: cache.to_path_buf(),
        allow_download: false,
        bun: None,
    }
}

fn spec() -> BundleSpec {
    BundleSpec::app("src/app.tsx", "dist/app.js")
}

// ── command lines ───────────────────────────────────────────────────────────

#[test]
fn esbuild_is_told_the_react_build_and_the_output() {
    let a = esbuild::args(&spec(), Path::new("t/tsconfig.production.json"));
    assert_eq!(a[0], "src/app.tsx");
    for want in ["--bundle", "--outfile=dist/app.js", "--format=iife", "--platform=browser", "--loader:.js=jsx",
                 "--tsconfig=t/tsconfig.production.json", "--define:process.env.NODE_ENV=\"production\""] {
        assert!(a.iter().any(|x| x == want), "missing {want}: {a:?}");
    }
    assert!(!a.iter().any(|x| x.starts_with("--minify") || x.starts_with("--sourcemap")));
}

#[test]
fn esbuild_options_follow_the_spec() {
    let mut s = spec();
    s.react = ReactMode::Development;
    s.minify = true;
    s.source_map = SourceMap::External;
    s.format = Format::Cjs;
    s.strip_test_ids = true;
    let a = esbuild::args(&s, Path::new("t.json"));
    for want in ["--define:process.env.NODE_ENV=\"development\"", "--minify", "--sourcemap=external",
                 "--format=cjs", "--define:__GLYX_STRIP_TEST_IDS__=true"] {
        assert!(a.iter().any(|x| x == want), "missing {want}: {a:?}");
    }
    s.source_map = SourceMap::Inline;
    assert!(esbuild::args(&s, Path::new("t.json")).iter().any(|x| x == "--sourcemap=inline"));
}

#[test]
fn the_jsx_mode_follows_the_react_build() {
    let prod: serde_json::Value = serde_json::from_str(&esbuild::tsconfig_json(None, ReactMode::Production)).unwrap();
    assert_eq!(prod["compilerOptions"]["jsx"], "react-jsx");
    assert!(prod.get("extends").is_none());
    let dev: serde_json::Value = serde_json::from_str(&esbuild::tsconfig_json(Some("C:/app/tsconfig.json"), ReactMode::Development)).unwrap();
    assert_eq!(dev["compilerOptions"]["jsx"], "react-jsxdev");
    assert_eq!(dev["extends"], "C:/app/tsconfig.json", "the project's own settings are kept");
}

#[test]
fn bun_gets_the_jsx_mode_through_its_api() {
    let mut s = spec();
    s.strip_test_ids = true;
    let v: serde_json::Value = serde_json::from_str(&bun::options_json(&s)).unwrap();
    assert_eq!(v["development"], false);
    assert_eq!(v["format"], "iife");
    assert_eq!(v["sourceMap"], "none");
    assert_eq!(v["define"]["process.env.NODE_ENV"], "\"production\"");
    assert_eq!(v["define"]["__GLYX_STRIP_TEST_IDS__"], "true");
    s.react = ReactMode::Development;
    let v: serde_json::Value = serde_json::from_str(&bun::options_json(&s)).unwrap();
    assert_eq!(v["development"], true);
    assert_eq!(v["define"]["process.env.NODE_ENV"], "\"development\"");
}

#[test]
fn a_classic_jsx_tsconfig_is_recognised() {
    assert!(bun::classic_jsx(r#"{"compilerOptions":{"jsx":"react"}}"#));
    assert!(bun::classic_jsx("{\n  \"compilerOptions\": {\n    \"jsx\" :  \"React\",\n  }\n}"));
    assert!(!bun::classic_jsx(r#"{"compilerOptions":{"jsx":"react-jsx"}}"#));
    assert!(!bun::classic_jsx(r#"{"compilerOptions":{"jsx":"react-jsxdev"}}"#));
    assert!(!bun::classic_jsx(r#"{"compilerOptions":{"strict":true}}"#));
}

// ── choosing a backend ──────────────────────────────────────────────────────

#[test]
fn a_projects_own_esbuild_is_preferred() {
    let Some(platform) = esbuild::platform_key() else { return };
    let root = temp_dir("local");
    let project = root.join("app");
    let local = local_candidates(&project, platform).remove(0);
    touch(&local);
    touch(&cached_binary(&root.join("cache"))); // present too, but the project's wins
    assert_eq!(resolve(&opts(&project, &root.join("cache"))).unwrap(), Backend::Esbuild(local));
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn a_hoisted_esbuild_in_a_parent_folder_is_found() {
    let Some(platform) = esbuild::platform_key() else { return };
    let root = temp_dir("hoisted");
    let project = root.join("packages").join("app");
    std::fs::create_dir_all(&project).unwrap();
    let hoisted = root.join("node_modules").join("@esbuild").join(platform)
        .join(if cfg!(windows) { "esbuild.exe" } else { "bin/esbuild" });
    touch(&hoisted);
    assert_eq!(resolve(&opts(&project, &root.join("cache"))).unwrap(), Backend::Esbuild(hoisted));
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn a_cached_download_is_used_without_the_network() {
    let root = temp_dir("cached");
    let cached = cached_binary(&root.join("cache"));
    touch(&cached);
    assert_eq!(resolve(&opts(&root.join("app"), &root.join("cache"))).unwrap(), Backend::Esbuild(cached));
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn bun_is_the_fallback_when_esbuild_is_unavailable() {
    let root = temp_dir("fallback");
    let bun_bin = root.join(if cfg!(windows) { "bun.exe" } else { "bun" });
    touch(&bun_bin);
    let mut o = opts(&root.join("app"), &root.join("cache"));
    o.bun = Some(bun_bin.clone());
    assert_eq!(resolve(&o).unwrap(), Backend::Bun(bun_bin.clone()));
    // ...but not when esbuild was asked for by name
    o.forced = Some("esbuild".into());
    assert!(resolve(&o).is_err());
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn nothing_available_says_how_to_fix_it() {
    let root = temp_dir("none");
    let err = resolve(&opts(&root.join("app"), &root.join("cache"))).unwrap_err();
    assert!(err.contains("npm install --save-dev esbuild") && err.contains("GLYX_ESBUILD") && err.contains("bun.sh"), "{err}");
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn the_backend_can_be_forced() {
    let root = temp_dir("forced");
    let cached = cached_binary(&root.join("cache"));
    touch(&cached);
    let bun_bin = root.join(if cfg!(windows) { "bun.exe" } else { "bun" });
    touch(&bun_bin);
    let mut o = opts(&root.join("app"), &root.join("cache"));
    o.bun = Some(bun_bin.clone());
    o.forced = Some("bun".into());
    assert_eq!(resolve(&o).unwrap(), Backend::Bun(bun_bin), "GLYX_BUNDLER=bun beats a cached esbuild");
    o.bun = None;
    assert!(resolve(&o).unwrap_err().contains("not on the PATH"));
    o.forced = Some("webpack".into());
    assert!(resolve(&o).unwrap_err().contains("webpack"));
    // an explicit binary
    o.forced = None;
    o.esbuild_path = Some(root.join("missing"));
    assert!(resolve(&o).unwrap_err().contains("GLYX_ESBUILD"));
    o.esbuild_path = Some(cached.clone());
    assert_eq!(resolve(&o).unwrap(), Backend::Esbuild(cached));
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn programs_are_found_on_a_path_list() {
    let root = temp_dir("path");
    let (a, b) = (root.join("a"), root.join("b"));
    std::fs::create_dir_all(&a).unwrap();
    let tool = b.join(if cfg!(windows) { "tool.exe" } else { "tool" });
    touch(&tool);
    assert_eq!(find_in([a.clone(), b.clone()], "tool"), Some(tool));
    assert_eq!(find_in([a, b], "other"), None);
    let _ = std::fs::remove_dir_all(&root);
}

#[test]
fn the_pinned_version_has_a_binary_for_every_platform_we_ship() {
    assert!(!ESBUILD_VERSION.is_empty());
    #[cfg(feature = "download")]
    for platform in ["win32-x64", "win32-arm64", "darwin-x64", "darwin-arm64", "linux-x64", "linux-arm64"] {
        let pin = crate::download::pin_for(platform).unwrap_or_else(|| panic!("no pin for {platform}"));
        assert_eq!(pin.len(), 128, "{platform}: a SHA-512 in hex");
        assert!(pin.bytes().all(|b| b.is_ascii_hexdigit()));
        assert!(crate::download::tarball_url(platform, None).ends_with(&format!("{platform}-{ESBUILD_VERSION}.tgz")));
    }
}

// ── the download ────────────────────────────────────────────────────────────

#[cfg(feature = "download")]
mod download_tests {
    use crate::download::*;

    fn tgz(files: &[(&str, &[u8])]) -> Vec<u8> {
        let mut builder = tar::Builder::new(flate2::write::GzEncoder::new(Vec::new(), flate2::Compression::fast()));
        for (name, data) in files {
            let mut h = tar::Header::new_gnu();
            h.set_size(data.len() as u64);
            h.set_mode(0o755);
            h.set_cksum();
            builder.append_data(&mut h, name, *data).unwrap();
        }
        builder.into_inner().unwrap().finish().unwrap()
    }

    #[test]
    fn the_binary_is_pulled_out_of_the_package() {
        let archive = tgz(&[("package/package.json", b"{}"), ("package/esbuild.exe", b"EXE"), ("package/bin/esbuild", b"ELF")]);
        assert_eq!(extract_member(&archive, "package/esbuild.exe").unwrap(), b"EXE");
        assert_eq!(extract_member(&archive, "package/bin/esbuild").unwrap(), b"ELF");
        assert!(extract_member(&archive, "package/nope").unwrap_err().contains("no package/nope"));
    }

    #[test]
    fn a_download_that_does_not_match_its_pin_is_refused() {
        let bytes = b"not esbuild";
        assert!(verify(bytes, &sha512_hex(bytes)).is_ok());
        let err = verify(bytes, &sha512_hex(b"something else")).unwrap_err();
        assert!(err.contains("pinned checksum") && err.contains("refusing"), "{err}");
    }

    #[test]
    fn a_mirror_changes_the_url_not_the_trust() {
        let direct = tarball_url("linux-x64", None);
        assert!(direct.starts_with("https://registry.npmjs.org/@esbuild/linux-x64/-/"));
        assert_eq!(tarball_url("linux-x64", Some("https://mirror.example/glyx")),
                   format!("https://mirror.example/glyx/esbuild/linux-x64-{}.tgz", crate::esbuild::ESBUILD_VERSION));
    }
}
