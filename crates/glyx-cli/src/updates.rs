//! "A newer glyx is available" notice.
//!
//! Never delays a command: the notice comes from the result cached by an
//! earlier run, and the cache is refreshed at most once a day on a
//! background thread (a slow or offline network just means no notice).
//! Skipped inside the glyx source checkout, in CI, when self-hosting through
//! `$GLYX_TOOLS_BASE`, and when `GLYX_NO_UPDATE_CHECK=1`.

use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// How often the latest release is looked up.
pub(crate) const CHECK_INTERVAL: Duration = Duration::from_secs(24 * 60 * 60);

const LATEST_RELEASE_API: &str = "https://api.github.com/repos/glyx-dev/glyx/releases/latest";

/// `"v1.2.3"` / `"1.2.3"` / `"1.2.3-beta.1"` → `(1, 2, 3, prerelease)`.
pub(crate) fn parse_version(s: &str) -> Option<(u64, u64, u64, bool)> {
    let s = s.trim().trim_start_matches('v');
    let (core, pre) = match s.split_once('-') {
        Some((c, _)) => (c, true),
        None => (s, false),
    };
    let mut parts = core.split('.').map(|p| p.parse::<u64>().ok());
    let v = (parts.next()??, parts.next()??, parts.next()??, pre);
    if parts.next().is_some() { return None; }
    Some(v)
}

/// Whether `latest` is a newer stable release than `current`. Prereleases
/// are never announced; unparseable versions never are either.
pub(crate) fn is_newer(latest: &str, current: &str) -> bool {
    match (parse_version(latest), parse_version(current)) {
        // `!pre` last: at equal numbers a stable release outranks its own
        // prerelease (0.2.0 is newer than 0.2.0-rc.1).
        (Some((a, b, c, false)), Some((x, y, z, pre))) => (a, b, c, true) > (x, y, z, !pre),
        _ => false,
    }
}

/// Whether to check at all, given the environment.
pub(crate) fn should_check(env: impl Fn(&str) -> Option<String>, in_source_checkout: bool) -> bool {
    if in_source_checkout { return false; }
    if env("GLYX_NO_UPDATE_CHECK").as_deref() == Some("1") { return false; }
    if env("CI").is_some_and(|v| !v.is_empty() && v != "false") { return false; }
    if env("GLYX_TOOLS_BASE").is_some_and(|v| !v.trim().is_empty()) { return false; }
    true
}

/// What the last check found, persisted between runs.
#[derive(Debug, Default, PartialEq, serde::Serialize, serde::Deserialize)]
pub(crate) struct State {
    /// Seconds since the Unix epoch.
    pub checked_at: u64,
    pub latest: Option<String>,
}

/// Whether the cached result is old enough to look again.
pub(crate) fn is_stale(state: &State, now: u64) -> bool {
    now.saturating_sub(state.checked_at) >= CHECK_INTERVAL.as_secs()
}

/// The notice to print, if the cached latest release is newer than `current`.
pub(crate) fn notice(state: &State, current: &str) -> Option<String> {
    let latest = state.latest.as_deref()?;
    is_newer(latest, current).then(|| {
        format!(
            "A new version of glyx is available: {current} → {}\n  \
             Update with `npm install -g glyx-cli@latest`, or re-run the installer from \
             https://github.com/glyx-dev/glyx/releases/latest",
            latest.trim_start_matches('v'),
        )
    })
}

fn state_path(glyx_dir: &Path) -> PathBuf { glyx_dir.join("update-check.json") }

pub(crate) fn read_state(glyx_dir: &Path) -> State {
    std::fs::read_to_string(state_path(glyx_dir))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default()
}

fn write_state(glyx_dir: &Path, state: &State) {
    let Ok(json) = serde_json::to_string(state) else { return };
    let _ = std::fs::create_dir_all(glyx_dir);
    // tmp + rename: a process that exits mid-write never leaves a torn file.
    let tmp = glyx_dir.join("update-check.json.part");
    if std::fs::write(&tmp, json).is_ok() {
        let _ = std::fs::rename(&tmp, state_path(glyx_dir));
    }
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_secs()).unwrap_or(0)
}

fn fetch_latest_tag() -> Option<String> {
    let resp = ureq::get(LATEST_RELEASE_API)
        .set("User-Agent", "glyx-cli")
        .set("Accept", "application/vnd.github+json")
        .timeout(Duration::from_secs(4))
        .call()
        .ok()?;
    let v: serde_json::Value = serde_json::from_reader(resp.into_reader()).ok()?;
    v.get("tag_name")?.as_str().map(str::to_owned)
}

/// Print the notice (to stderr, so command output stays machine-readable)
/// and, if due, refresh the cached result in the background.
pub(crate) fn run(glyx_dir: &Path, current: &str, in_source_checkout: bool) {
    if !should_check(|k| std::env::var(k).ok(), in_source_checkout) { return; }
    let state = read_state(glyx_dir);
    if let Some(msg) = notice(&state, current) {
        eprintln!("\n{msg}\n");
    }
    if is_stale(&state, now_secs()) {
        let dir = glyx_dir.to_path_buf();
        std::thread::spawn(move || {
            // Record the attempt even when offline, so an unreachable network
            // costs one try a day, not one per command.
            let latest = fetch_latest_tag().or(state.latest);
            write_state(&dir, &State { checked_at: now_secs(), latest });
        });
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn versions_parse_with_or_without_v_and_prerelease() {
        assert_eq!(parse_version("v1.2.3"), Some((1, 2, 3, false)));
        assert_eq!(parse_version("0.10.0"), Some((0, 10, 0, false)));
        assert_eq!(parse_version("1.0.0-beta.2"), Some((1, 0, 0, true)));
        assert_eq!(parse_version("1.2"), None);
        assert_eq!(parse_version("1.2.3.4"), None);
        assert_eq!(parse_version("latest"), None);
    }

    #[test]
    fn only_newer_stable_releases_are_announced() {
        assert!(is_newer("v0.2.0", "0.1.0"));
        assert!(is_newer("0.10.0", "0.9.9"), "numeric, not string, comparison");
        assert!(!is_newer("0.1.0", "0.1.0"));
        assert!(!is_newer("0.0.9", "0.1.0"));
        assert!(!is_newer("0.2.0-rc.1", "0.1.0"), "prereleases aren't announced");
        assert!(is_newer("0.2.0", "0.2.0-rc.1"), "a stable release beats its prerelease");
        assert!(!is_newer("garbage", "0.1.0"));
    }

    #[test]
    fn checks_are_skipped_for_source_checkouts_ci_mirrors_and_opt_out() {
        let none = |_: &str| None;
        assert!(should_check(none, false));
        assert!(!should_check(none, true), "working on glyx itself");
        let env = |k: &'static str, v: &'static str| move |q: &str| (q == k).then(|| v.to_string());
        assert!(!should_check(env("GLYX_NO_UPDATE_CHECK", "1"), false));
        assert!(should_check(env("GLYX_NO_UPDATE_CHECK", "0"), false));
        assert!(!should_check(env("CI", "true"), false));
        assert!(should_check(env("CI", "false"), false));
        assert!(!should_check(env("GLYX_TOOLS_BASE", "https://mirror.example"), false));
    }

    #[test]
    fn looks_again_at_most_once_a_day() {
        let day = CHECK_INTERVAL.as_secs();
        assert!(is_stale(&State::default(), 1_000_000), "never checked");
        let s = State { checked_at: 1_000_000, latest: None };
        assert!(!is_stale(&s, 1_000_000 + day - 1));
        assert!(is_stale(&s, 1_000_000 + day));
    }

    #[test]
    fn notice_names_both_versions_and_how_to_update() {
        let s = State { checked_at: 0, latest: Some("v0.3.0".into()) };
        let msg = notice(&s, "0.1.0").unwrap();
        assert!(msg.contains("0.1.0 → 0.3.0"));
        assert!(msg.contains("npm install -g glyx-cli@latest"));
        assert!(notice(&s, "0.3.0").is_none());
        assert!(notice(&State::default(), "0.1.0").is_none());
    }

    #[test]
    fn state_round_trips_and_tolerates_a_missing_or_corrupt_file() {
        let dir = std::env::temp_dir().join(format!("glyx-update-test-{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        assert_eq!(read_state(&dir), State::default(), "missing file");
        let s = State { checked_at: 42, latest: Some("v9.9.9".into()) };
        write_state(&dir, &s);
        assert_eq!(read_state(&dir), s);
        std::fs::write(dir.join("update-check.json"), "{not json").unwrap();
        assert_eq!(read_state(&dir), State::default(), "corrupt file");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
