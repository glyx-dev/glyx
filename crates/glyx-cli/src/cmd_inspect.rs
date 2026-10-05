//! `glyx inspect` and `glyx dev --devtools --open`: the Glyx DevTools UI.
//!
//! Starts the DevTools relay (glyx-devtools `relay`): it serves the UI
//! (embedded at build time, see build.rs), finds running dev apps from their
//! discovery files, and relays the UI to the chosen app's GDP server.

use std::path::{Path, PathBuf};
use std::sync::Arc;

use anyhow::{Context, Result};
use glyx_devtools::{Relay, RelayConfig};

use super::cmd_dev::DEVTOOLS_FILE;

mod embedded {
    include!(concat!(env!("OUT_DIR"), "/devtools_ui.rs"));
}

/// The relay's usual port (next to GDP's 9228); another is picked when busy.
pub(super) const DEFAULT_PORT: u16 = 9227;

const PLACEHOLDER: &str = r#"<!doctype html><meta charset="utf-8"><title>Glyx DevTools</title>
<body style="font:14px system-ui;background:#0A0A0E;color:#ECECF2;padding:48px">
<h1 style="color:#F59E0B;font-weight:600">Glyx DevTools isn't built into this CLI</h1>
<p>Build the UI, then rebuild the CLI:</p>
<pre style="background:#141419;padding:16px;border-radius:6px">cd tools/glyx-devtools-ui &amp;&amp; bun run build
cargo build -p glyx-cli</pre></body>"#;

/// Embedded UI file by path; `index.html` falls back to the placeholder.
fn asset(name: &str) -> Option<Vec<u8>> {
    if let Some((_, bytes)) = embedded::FILES.iter().find(|(n, _)| *n == name) {
        return Some(bytes.to_vec());
    }
    (name == "index.html").then(|| PLACEHOLDER.as_bytes().to_vec())
}

/// Where running dev apps announce themselves: this project, its
/// subprojects one or two levels down (a monorepo's `examples/*`), and the
/// temp-dir files of apps started without `glyx dev`.
pub(super) fn discovery_paths(root: &Path) -> Vec<PathBuf> {
    let mut out = vec![root.join(DEVTOOLS_FILE)];
    let skip = |p: &Path| p.file_name().is_some_and(|n| {
        let n = n.to_string_lossy();
        n.starts_with('.') || n == "node_modules" || n == "target"
    });
    let subdirs = |dir: &Path| -> Vec<PathBuf> {
        std::fs::read_dir(dir).map(|rd| rd.flatten().map(|e| e.path())
            .filter(|p| p.is_dir() && !skip(p)).collect()).unwrap_or_default()
    };
    for d1 in subdirs(root) {
        out.push(d1.join(DEVTOOLS_FILE));
        for d2 in subdirs(&d1) {
            out.push(d2.join(DEVTOOLS_FILE));
        }
    }
    out.push(std::env::temp_dir().join("glyx-devtools"));
    out
}

/// A running DevTools relay; stops when dropped.
pub(super) struct DevtoolsUi {
    _runtime: tokio::runtime::Runtime,
    relay: Relay,
}

impl DevtoolsUi {
    pub(super) fn start(port: Option<u16>) -> Result<Self> {
        let runtime = tokio::runtime::Builder::new_multi_thread()
            .worker_threads(2).enable_all().thread_name("glyx-devtools-ui").build()
            .context("could not start the DevTools server")?;
        let root = std::env::current_dir().unwrap_or_else(|_| PathBuf::from("."));
        let config = |port| RelayConfig { port, assets: Arc::new(asset), discovery: discovery_paths(&root) };
        let wanted = port.unwrap_or(DEFAULT_PORT);
        let relay = match Relay::start(runtime.handle(), config(wanted)) {
            Ok(r) => r,
            // Busy (another DevTools already open): take any free port.
            Err(_) if port.is_none() => Relay::start(runtime.handle(), config(0))
                .context("could not start the DevTools server")?,
            Err(e) => return Err(e).context(format!("could not listen on 127.0.0.1:{wanted}")),
        };
        Ok(Self { _runtime: runtime, relay })
    }

    /// The page to open; `app` preselects an app by its discovery file.
    pub(super) fn url(&self, app: Option<&Path>) -> String {
        let mut url = self.relay.url();
        if let Some(app) = app {
            url.push_str("&app=");
            url.push_str(&encode(&app.to_string_lossy()));
        }
        url
    }
}

/// Percent-encode for a URL fragment value.
fn encode(s: &str) -> String {
    s.bytes().map(|b| match b {
        b'A'..=b'Z' | b'a'..=b'z' | b'0'..=b'9' | b'-' | b'_' | b'.' | b'~' | b'/' => (b as char).to_string(),
        _ => format!("%{b:02X}"),
    }).collect()
}

/// Open `url` in the default browser.
pub(super) fn open_url(url: &str) {
    #[cfg(target_os = "windows")]
    let r = std::process::Command::new("rundll32").args(["url.dll,FileProtocolHandler", url]).spawn();
    #[cfg(target_os = "macos")]
    let r = std::process::Command::new("open").arg(url).spawn();
    #[cfg(all(unix, not(target_os = "macos")))]
    let r = std::process::Command::new("xdg-open").arg(url).spawn();
    if let Err(e) = r {
        eprintln!("[glyx] could not open a browser ({e}); open {url}");
    }
}

pub(super) fn cmd_inspect(port: Option<u16>, no_open: bool) -> Result<()> {
    let ui = DevtoolsUi::start(port)?;
    let url = ui.url(None);
    if embedded::FILES.is_empty() {
        eprintln!("[glyx] note: this CLI was built without the DevTools UI (tools/glyx-devtools-ui); the page explains how to add it.");
    }
    println!("Glyx DevTools: {url}");
    println!("Showing apps started with `glyx dev --devtools` here or in subfolders. Ctrl+C to stop.");
    if !no_open { open_url(&url); }
    loop { std::thread::park(); }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fragment_values_are_encoded() {
        assert_eq!(encode("C:\\a b/devtools.json"), "C%3A%5Ca%20b/devtools.json");
        assert_eq!(encode("plain-name_1.json"), "plain-name_1.json");
    }

    #[test]
    fn the_placeholder_stands_in_for_a_missing_ui() {
        let index = String::from_utf8(asset("index.html").unwrap()).unwrap();
        assert!(index.contains("Glyx DevTools"));
        assert!(asset("definitely-missing.js").is_none());
    }

    #[test]
    fn discovery_looks_here_in_subprojects_and_in_temp() {
        let root = std::env::temp_dir().join(format!("glyx-inspect-test-{}", std::process::id()));
        std::fs::create_dir_all(root.join("examples").join("calc")).unwrap();
        std::fs::create_dir_all(root.join("node_modules").join("x")).unwrap();
        let paths = discovery_paths(&root);
        assert!(paths.contains(&root.join(DEVTOOLS_FILE)));
        assert!(paths.contains(&root.join("examples").join("calc").join(DEVTOOLS_FILE)));
        assert!(!paths.iter().any(|p| p.to_string_lossy().contains("node_modules")));
        assert!(paths.contains(&std::env::temp_dir().join("glyx-devtools")));
        let _ = std::fs::remove_dir_all(&root);
    }
}
