//! The FFmpeg licence notice a packaged app carries.
//!
//! An app that uses video, camera or microphone ships FFmpeg's shared libraries next
//! to its executable. FFmpeg is licensed under the (L)GPL, which asks whoever passes
//! those libraries on to say so, to include the licence texts, and to point to the
//! source. `glyx package` therefore writes `LICENSES/ffmpeg/` beside the Glyx and app
//! licences whenever FFmpeg libraries go into a package.
//!
//! It does not assume which licence applies. Each FFmpeg library reports its own
//! (`libavutil license: LGPL version 3 or later`) and its git version, and the notice
//! is written from that. A GPL build is reported loudly, because it puts GPL terms on
//! the app that ships it.
//!
//! Not legal advice: this writes the notice, the texts and the source pointer; whether
//! that satisfies your distribution is yours to check.

use anyhow::{Context, Result};
use std::path::{Path, PathBuf};

const LGPL_21: &str = include_str!("../assets/ffmpeg/LGPL-2.1.txt");
const LGPL_30: &str = include_str!("../assets/ffmpeg/LGPL-3.0.txt");
const GPL_20: &str = include_str!("../assets/ffmpeg/GPL-2.0.txt");
const GPL_30: &str = include_str!("../assets/ffmpeg/GPL-3.0.txt");

/// The licence an FFmpeg build says it is under.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Licence {
    Lgpl21,
    Lgpl3,
    Gpl2,
    Gpl3,
    /// Something this doesn't recognise (for example a non-free build); the text is
    /// what the library reported.
    Other(String),
}

impl Licence {
    pub(crate) fn is_gpl(&self) -> bool {
        matches!(self, Licence::Gpl2 | Licence::Gpl3)
    }

    fn label(&self) -> String {
        match self {
            Licence::Lgpl21 => "GNU Lesser General Public License, version 2.1 or later".into(),
            Licence::Lgpl3 => "GNU Lesser General Public License, version 3 or later".into(),
            Licence::Gpl2 => "GNU General Public License, version 2 or later".into(),
            Licence::Gpl3 => "GNU General Public License, version 3 or later".into(),
            Licence::Other(s) => format!("a licence this tool does not recognise ({s})"),
        }
    }

    /// How restrictive it is, to pick the licence of a set of libraries that disagree.
    fn strictness(&self) -> u8 {
        match self {
            Licence::Lgpl21 => 1,
            Licence::Lgpl3 => 2,
            Licence::Gpl2 => 3,
            Licence::Gpl3 => 4,
            Licence::Other(_) => 5,
        }
    }
}

/// What an FFmpeg library says about itself.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct Detected {
    pub licence: Licence,
    /// The exact line the library reported (`libavutil license: ...`), if it had one.
    pub reported: Option<String>,
    /// A git-style build version (`N-126905-gb87602a63a-20260927`), if it carries one.
    pub version: Option<String>,
}

fn find(hay: &[u8], needle: &[u8], from: usize) -> Option<usize> {
    if needle.is_empty() || hay.len() < needle.len() || from > hay.len() - needle.len() {
        return None;
    }
    hay[from..].windows(needle.len()).position(|w| w == needle).map(|i| i + from)
}

/// The `lib<name> license: ...` string FFmpeg compiles into each library.
fn reported_licence(bytes: &[u8]) -> Option<String> {
    let mut from = 0;
    while let Some(at) = find(bytes, b" license: ", from) {
        from = at + 1;
        // The library name directly before: `libavutil`, `libswscale`... (lowercase letters, starting `lib`).
        let start = bytes[..at].iter().rposition(|b| !b.is_ascii_lowercase()).map_or(0, |i| i + 1);
        let name = &bytes[start..at];
        if name.len() > 3 && name.starts_with(b"lib") {
            let end = bytes[at..].iter().position(|&b| b == 0 || b == b'\n' || b == b'\r').map_or(bytes.len(), |i| at + i);
            if end - start < 120 {
                return Some(String::from_utf8_lossy(&bytes[start..end]).into_owned());
            }
        }
    }
    None
}

fn licence_from(reported: &str) -> Licence {
    let r = reported.to_ascii_lowercase();
    let text = r.split(" license: ").nth(1).unwrap_or(&r).trim().to_string();
    let v3 = text.contains("version 3");
    let v21 = text.contains("version 2.1");
    let v2 = text.contains("version 2");
    if text.contains("nonfree") || text.contains("unredistributable") {
        Licence::Other(text)
    } else if text.starts_with("lgpl") && v3 {
        Licence::Lgpl3
    } else if text.starts_with("lgpl") && (v21 || v2) {
        Licence::Lgpl21
    } else if text.starts_with("gpl") && v3 {
        Licence::Gpl3
    } else if text.starts_with("gpl") && v2 {
        Licence::Gpl2
    } else {
        Licence::Other(text)
    }
}

/// A git-style FFmpeg version (`N-<count>-g<hash>[-<yyyymmdd>]`) anywhere in `bytes`.
fn build_version(bytes: &[u8]) -> Option<String> {
    let mut from = 0;
    while let Some(at) = find(bytes, b"N-", from) {
        from = at + 2;
        let mut i = at + 2;
        let digits = bytes[i..].iter().take_while(|b| b.is_ascii_digit()).count();
        if digits == 0 { continue; }
        i += digits;
        if bytes.get(i..i + 2) != Some(b"-g") { continue; }
        i += 2;
        let hex = bytes[i..].iter().take_while(|b| b.is_ascii_hexdigit() && !b.is_ascii_uppercase()).count();
        if hex < 7 { continue; }
        i += hex;
        // An optional `-yyyymmdd` date.
        if bytes.get(i) == Some(&b'-') {
            let d = bytes[i + 1..].iter().take_while(|b| b.is_ascii_digit()).count();
            if d == 8 { i += 1 + d; }
        }
        return Some(String::from_utf8_lossy(&bytes[at..i]).into_owned());
    }
    None
}

pub(crate) fn detect(lib: &[u8]) -> Detected {
    let reported = reported_licence(lib);
    let licence = reported.as_deref().map_or_else(|| Licence::Other("the library does not say".into()), licence_from);
    Detected { licence, reported, version: build_version(lib) }
}

/// What was written, for the caller to report.
#[derive(Debug)]
pub(crate) struct Summary {
    pub dir: PathBuf,
    pub licence: Licence,
    pub version: Option<String>,
    // Not printed in the report; the tests check what was written.
    #[cfg_attr(not(test), allow(dead_code))]
    pub libraries: Vec<String>,
    #[cfg_attr(not(test), allow(dead_code))]
    pub files: Vec<String>,
}

fn notice(libs: &[String], licence: &Licence, reported: &[String], version: Option<&str>) -> String {
    let mut s = String::new();
    s.push_str("FFmpeg\n======\n\n");
    s.push_str("This application includes libraries from the FFmpeg project (https://ffmpeg.org):\n\n");
    for l in libs { s.push_str(&format!("  {l}\n")); }
    s.push_str("\nThey are used to decode and encode video and audio, and for camera and microphone capture.\n\n");

    s.push_str("Licence\n-------\n");
    if !reported.is_empty() {
        s.push_str("The libraries report their licence as:\n\n");
        for r in reported { s.push_str(&format!("  {r}\n")); }
        s.push('\n');
    }
    s.push_str(&format!("That is the {}.\n", licence.label()));
    match licence {
        Licence::Lgpl3 => s.push_str("The full text is in LGPL-3.0.txt. The LGPL version 3 is a set of additional permissions on top of the GNU General Public License version 3, whose text is in GPL-3.0.txt.\n\n"),
        Licence::Lgpl21 => s.push_str("The full text is in LGPL-2.1.txt.\n\n"),
        Licence::Gpl2 => s.push_str("The full text is in GPL-2.0.txt.\n\nThese libraries were built with GPL-licensed components. GPL terms apply to them and to a program that combines with them, and the publisher of this application is responsible for meeting them.\n\n"),
        Licence::Gpl3 => s.push_str("The full text is in GPL-3.0.txt.\n\nThese libraries were built with GPL-licensed components. GPL terms apply to them and to a program that combines with them, and the publisher of this application is responsible for meeting them.\n\n"),
        Licence::Other(_) => s.push_str("No licence text is included here: check the licence of the libraries listed above before distributing this application.\n\n"),
    }
    if matches!(licence, Licence::Lgpl3 | Licence::Lgpl21) {
        s.push_str("The FFmpeg libraries are separate files that the application loads when it runs; they are not compiled into the application's own executable. You can replace them with another build of the same library versions (the file names above carry the library major versions).\n\n");
    }

    s.push_str("Source code\n-----------\n");
    s.push_str("The FFmpeg source code is available from https://ffmpeg.org/download.html and https://git.ffmpeg.org/ffmpeg.git.\n");
    if let Some(v) = version {
        s.push_str(&format!("These libraries report the build version {v}"));
        if let Some(hash) = v.split("-g").nth(1).map(|h| h.split('-').next().unwrap_or(h)) {
            s.push_str(&format!(" (git commit {hash})"));
        }
        s.push_str(".\n");
    }
    s.push_str("\nFFmpeg is a trademark of Fabrice Bellard, originator of the FFmpeg project.\n");
    s
}

/// Write `LICENSES/ffmpeg/` into `licenses_dir` if `libs_dir` holds FFmpeg's runtime
/// libraries. Returns `None` (and writes nothing) when it holds none.
pub(crate) fn install(licenses_dir: &Path, libs_dir: &Path) -> Result<Option<Summary>> {
    let mut libs: Vec<(String, Detected)> = Vec::new();
    let Ok(entries) = std::fs::read_dir(libs_dir) else { return Ok(None) };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if !crate::is_ffmpeg_runtime_lib(&name) { continue; }
        let bytes = std::fs::read(entry.path()).with_context(|| format!("read {}", entry.path().display()))?;
        libs.push((name, detect(&bytes)));
    }
    if libs.is_empty() { return Ok(None); }
    libs.sort_by(|a, b| a.0.cmp(&b.0));

    // The set's licence is the strictest any library reports; its version, the first one found.
    let licence = libs.iter().map(|(_, d)| d.licence.clone()).max_by_key(Licence::strictness).unwrap();
    let version = libs.iter().find_map(|(_, d)| d.version.clone());
    let mut reported: Vec<String> = libs.iter().filter_map(|(_, d)| d.reported.clone()).collect();
    reported.sort();
    reported.dedup();
    let names: Vec<String> = libs.iter().map(|(n, _)| n.clone()).collect();

    let dir = licenses_dir.join("ffmpeg");
    std::fs::create_dir_all(&dir).with_context(|| format!("create {}", dir.display()))?;
    let mut files = vec!["NOTICE.txt".to_string()];
    std::fs::write(dir.join("NOTICE.txt"), notice(&names, &licence, &reported, version.as_deref()))
        .context("write FFmpeg NOTICE.txt")?;
    let texts: &[(&str, &str)] = match licence {
        Licence::Lgpl21 => &[("LGPL-2.1.txt", LGPL_21)],
        // The LGPL v3 builds on the GPL v3 and asks that both accompany the work.
        Licence::Lgpl3 => &[("LGPL-3.0.txt", LGPL_30), ("GPL-3.0.txt", GPL_30)],
        Licence::Gpl2 => &[("GPL-2.0.txt", GPL_20)],
        Licence::Gpl3 => &[("GPL-3.0.txt", GPL_30)],
        Licence::Other(_) => &[],
    };
    for (file, text) in texts {
        std::fs::write(dir.join(file), text).with_context(|| format!("write FFmpeg {file}"))?;
        files.push((*file).to_string());
    }
    Ok(Some(Summary { dir, licence, version, libraries: names, files }))
}

/// `install`, then say what happened (and warn when the libraries are not LGPL).
pub(crate) fn install_and_report(licenses_dir: &Path, libs_dir: &Path) -> Result<()> {
    let Some(s) = install(licenses_dir, libs_dir)? else { return Ok(()) };
    let version = s.version.as_deref().map(|v| format!(", FFmpeg {v}")).unwrap_or_default();
    println!("  FFmpeg notice: {} ({}{version})", s.dir.display(), s.licence.label());
    if s.licence.is_gpl() {
        println!("  ⚠ These FFmpeg libraries are GPL-licensed, not LGPL: shipping them puts GPL terms on your app.");
        println!("    Use an LGPL build of FFmpeg (see glyx-media-c/build-windows.ps1) unless that is what you want.");
    } else if let Licence::Other(why) = &s.licence {
        println!("  ⚠ Could not tell which licence these FFmpeg libraries are under ({why}); no licence text was written.");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn lib_bytes(licence: &str, version: Option<&str>) -> Vec<u8> {
        let mut b = b"MZ\x90\0\x03\0\0\0 junk before \0".to_vec();
        b.extend_from_slice(licence.as_bytes());
        b.push(0);
        b.extend_from_slice(b"more bytes in between\0");
        if let Some(v) = version { b.extend_from_slice(v.as_bytes()); b.push(0); }
        b.extend_from_slice(&[0xff; 32]);
        b
    }

    #[test]
    fn it_reads_the_licence_and_version_a_build_reports() {
        let d = detect(&lib_bytes("libavutil license: LGPL version 3 or later", Some("N-126905-gb87602a63a-20260927")));
        assert_eq!(d.licence, Licence::Lgpl3);
        assert_eq!(d.reported.as_deref(), Some("libavutil license: LGPL version 3 or later"));
        assert_eq!(d.version.as_deref(), Some("N-126905-gb87602a63a-20260927"));
    }

    #[test]
    fn every_licence_wording_is_told_apart_and_gpl_is_not_mistaken_for_lgpl() {
        let t = |s: &str| detect(&lib_bytes(s, None)).licence;
        assert_eq!(t("libavcodec license: LGPL version 2.1 or later"), Licence::Lgpl21);
        assert_eq!(t("libavcodec license: LGPL version 3 or later"), Licence::Lgpl3);
        assert_eq!(t("libavcodec license: GPL version 2 or later"), Licence::Gpl2);
        assert_eq!(t("libavcodec license: GPL version 3 or later"), Licence::Gpl3);
        assert!(matches!(t("libavcodec license: nonfree and unredistributable"), Licence::Other(_)));
        assert!(Licence::Gpl3.is_gpl() && !Licence::Lgpl3.is_gpl());
    }

    #[test]
    fn a_library_that_says_nothing_is_unknown_not_assumed_lgpl() {
        let d = detect(b"nothing about licences in here");
        assert!(matches!(d.licence, Licence::Other(_)));
        assert!(d.reported.is_none() && d.version.is_none());
    }

    #[test]
    fn the_version_must_look_like_a_git_build() {
        assert_eq!(build_version(b"..N-126905-gb87602a63a-20260927..").as_deref(), Some("N-126905-gb87602a63a-20260927"));
        assert_eq!(build_version(b"x N-77-gabcdef0 y").as_deref(), Some("N-77-gabcdef0"), "the date is optional");
        assert_eq!(build_version(b"N-12-gabc"), None, "a hash under 7 characters is not one");
        assert_eq!(build_version(b"No-version-here N-x N-"), None);
    }

    fn scratch(tag: &str) -> PathBuf {
        let d = std::env::temp_dir().join(format!("glyx-ffmpeg-notice-{tag}-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&d);
        std::fs::create_dir_all(&d).unwrap();
        d
    }

    #[test]
    fn an_lgpl3_package_gets_a_notice_both_texts_and_the_source_pointer() {
        let (libs, lic) = (scratch("lgpl-libs"), scratch("lgpl-out"));
        for n in ["avcodec-63.dll", "avutil-61.dll", "swscale-10.dll"] {
            std::fs::write(libs.join(n), lib_bytes("libavutil license: LGPL version 3 or later", Some("N-126905-gb87602a63a-20260927"))).unwrap();
        }
        std::fs::write(libs.join("glyx-media-1.0.0-windows-x64.dll"), b"not ffmpeg").unwrap();
        let s = install(&lic, &libs).unwrap().expect("FFmpeg libraries are present");
        assert_eq!(s.licence, Licence::Lgpl3);
        assert_eq!(s.libraries, ["avcodec-63.dll", "avutil-61.dll", "swscale-10.dll"], "only FFmpeg's own libraries are listed");
        assert_eq!(s.files, ["NOTICE.txt", "LGPL-3.0.txt", "GPL-3.0.txt"]);
        let dir = lic.join("ffmpeg");
        let notice = std::fs::read_to_string(dir.join("NOTICE.txt")).unwrap();
        for must in ["avcodec-63.dll", "LGPL-3.0.txt", "GPL-3.0.txt", "https://ffmpeg.org", "git.ffmpeg.org", "N-126905-gb87602a63a-20260927", "git commit b87602a63a", "separate files", "trademark"] {
            assert!(notice.contains(must), "the notice should mention {must:?}:\n{notice}");
        }
        assert!(!notice.contains("glyx-media"), "the glyx-media library is not part of FFmpeg");
        assert_eq!(std::fs::read_to_string(dir.join("LGPL-3.0.txt")).unwrap(), LGPL_30);
        assert_eq!(std::fs::read_to_string(dir.join("GPL-3.0.txt")).unwrap(), GPL_30);
        let _ = std::fs::remove_dir_all(&libs);
        let _ = std::fs::remove_dir_all(&lic);
    }

    #[test]
    fn a_package_without_ffmpeg_gets_nothing() {
        let (libs, lic) = (scratch("none-libs"), scratch("none-out"));
        std::fs::write(libs.join("app.exe"), b"x").unwrap();
        std::fs::write(libs.join("glyx-media-1.0.0-windows-x64.dll"), b"x").unwrap();
        assert!(install(&lic, &libs).unwrap().is_none());
        assert!(!lic.join("ffmpeg").exists(), "no folder is created for a package that has no FFmpeg");
        assert!(install(&lic, &libs.join("missing")).unwrap().is_none(), "a missing folder is not an error");
        let _ = std::fs::remove_dir_all(&libs);
        let _ = std::fs::remove_dir_all(&lic);
    }

    #[test]
    fn a_gpl_build_is_reported_as_gpl_with_its_own_text_and_no_lgpl_claim() {
        let (libs, lic) = (scratch("gpl-libs"), scratch("gpl-out"));
        std::fs::write(libs.join("avutil-61.dll"), lib_bytes("libavutil license: LGPL version 3 or later", None)).unwrap();
        std::fs::write(libs.join("avcodec-63.dll"), lib_bytes("libavcodec license: GPL version 3 or later", None)).unwrap();
        let s = install(&lic, &libs).unwrap().unwrap();
        assert_eq!(s.licence, Licence::Gpl3, "a set is as strict as its strictest library");
        assert!(s.licence.is_gpl());
        assert_eq!(s.files, ["NOTICE.txt", "GPL-3.0.txt"]);
        let notice = std::fs::read_to_string(lic.join("ffmpeg/NOTICE.txt")).unwrap();
        assert!(notice.contains("GPL-licensed components") && !notice.contains("You can replace them"));
        assert!(!lic.join("ffmpeg/LGPL-3.0.txt").exists());
        let _ = std::fs::remove_dir_all(&libs);
        let _ = std::fs::remove_dir_all(&lic);
    }

    #[test]
    fn an_unrecognised_build_gets_a_warning_notice_and_no_licence_text() {
        let (libs, lic) = (scratch("other-libs"), scratch("other-out"));
        std::fs::write(libs.join("avutil-61.dll"), b"no licence string at all").unwrap();
        let s = install(&lic, &libs).unwrap().unwrap();
        assert!(matches!(s.licence, Licence::Other(_)));
        assert_eq!(s.files, ["NOTICE.txt"]);
        assert!(std::fs::read_to_string(lic.join("ffmpeg/NOTICE.txt")).unwrap().contains("check the licence"));
        let _ = std::fs::remove_dir_all(&libs);
        let _ = std::fs::remove_dir_all(&lic);
    }

    #[test]
    fn the_embedded_texts_are_the_licences_they_are_named_for() {
        assert!(LGPL_21.contains("GNU LESSER GENERAL PUBLIC LICENSE") && LGPL_21.contains("Version 2.1"));
        assert!(LGPL_30.contains("GNU LESSER GENERAL PUBLIC LICENSE") && LGPL_30.contains("Version 3, 29 June 2007"));
        assert!(GPL_20.contains("GNU GENERAL PUBLIC LICENSE") && GPL_20.contains("Version 2, June 1991"));
        assert!(GPL_30.contains("GNU GENERAL PUBLIC LICENSE") && GPL_30.contains("Version 3, 29 June 2007"));
    }

    /// The real libraries a developer's media cache holds, when it has them.
    #[test]
    fn the_real_cached_ffmpeg_libraries_are_recognised() {
        let Some(home) = std::env::var_os("USERPROFILE").or_else(|| std::env::var_os("HOME")) else { return };
        let cache = PathBuf::from(home).join(".glyx").join("cache").join("media");
        if !cache.join("avutil-61.dll").exists() { return; }
        let lic = scratch("real-out");
        let s = install(&lic, &cache).unwrap().expect("the cache has FFmpeg libraries");
        eprintln!("real cache: {:?}, version {:?}, files {:?}", s.licence, s.version, s.files);
        assert!(matches!(s.licence, Licence::Lgpl21 | Licence::Lgpl3), "the media cache should hold LGPL builds, found {:?}", s.licence);
        assert!(s.version.is_some(), "the cached build should carry a git version");
        let _ = std::fs::remove_dir_all(&lic);
    }
}
