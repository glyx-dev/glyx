//! GDP capability report (`Runtime.getCapabilities`): what the app's
//! `glyx.config.json` grants, what its code uses that isn't granted, and what
//! was refused at runtime.
//!
//! The "uses" check reads the app's own source files (from the bundle's
//! source map; dependencies and Glyx's packages are skipped): which Glyx APIs
//! each file imports from `@glyx-dev/react` and actually calls, plus literal
//! `fetch` / `ws.connect` URLs, whose hosts are checked one by one. It's a
//! hint ("may break"), not proof: dynamic URLs and aliased calls can't be
//! resolved statically. Runtime denials are the proof.

use serde_json::{json, Value};

/// Glyx API (as imported from `@glyx-dev/react`) → the capability it needs.
/// Hooks and components count as calls when used.
const APIS: &[(&str, &str)] = &[
    ("fs", "fs"), ("db", "db"), ("vectorDb", "db"), ("dialog", "dialog"),
    ("clipboard", "clipboard"), ("tray", "tray"), ("notification", "notification"),
    ("shell", "shellExec"), ("mdns", "mdns"), ("ws", "network"), ("fetch", "network"),
    ("battery", "battery"), ("system", "system"), ("power", "power"), ("storage", "storage"),
    ("credentials", "credentials"), ("audio", "audio"), ("ai", "ai"), ("camera", "camera"),
    ("microphone", "microphone"), ("hid", "hid"), ("updater", "updater"), ("video", "video"),
    ("Video", "video"), ("webview", "webview"), ("WebView", "webview"), ("deeplink", "deeplink"),
    ("crash", "crash"), ("autostart", "autostart"),
    ("useGamepad", "gamepads"), ("useGamepads", "gamepads"),
    ("useGlobalShortcut", "globalShortcuts"), ("globalShortcut", "globalShortcuts"),
];

/// A capability counts as granted when the config has it at all: `true`, or
/// an object / list that isn't empty (`network: { allow: [] }` grants nothing).
pub(crate) fn granted(caps: &Value, key: &str) -> bool {
    match caps.get(key) {
        None | Some(Value::Null) | Some(Value::Bool(false)) => false,
        Some(Value::Object(o)) if key == "network" => o.get("allow").and_then(Value::as_array).is_some_and(|a| !a.is_empty()),
        Some(Value::Object(o)) => !o.is_empty() && o.values().any(|v| !v.is_null()),
        Some(_) => true,
    }
}

/// Source files that belong to the app (not dependencies or Glyx itself).
pub(crate) fn is_app_source(path: &str) -> bool {
    let p = path.replace('\\', "/");
    !(p.contains("node_modules/") || p.contains("packages/@glyx/") || p.contains("@glyx-dev/") || p.starts_with("glyx:"))
}

/// Local names imported from Glyx's React package in one file:
/// `import { db, fs as files } from '@glyx-dev/react'` → [("db","db"), ("fs","files")].
pub(crate) fn glyx_imports(src: &str) -> Vec<(String, String)> {
    let mut out = Vec::new();
    let mut from = 0;
    while let Some(i) = src[from..].find("import") {
        let at = from + i;
        from = at + 6;
        // A statement start, not `reimport` or `x.import`.
        if src[..at].chars().next_back().is_some_and(|c| is_ident(c) || c == '.') { continue; }
        // The clause runs to `from '<module>'`, within one statement.
        let rest = &src[from..];
        let Some(f) = rest.find("from") else { break };
        let clause = &rest[..f];
        if clause.contains(';') || clause.contains("import") { continue; }
        let module = rest[f + 4..].trim_start();
        let Some(q) = module.chars().next().filter(|c| matches!(c, '\'' | '"')) else { continue };
        let module = &module[1..];
        let module = &module[..module.find(q).unwrap_or(0)];
        if !(module == "@glyx-dev/react" || module == "@glyx/react") { continue; }
        let (Some(open), Some(close)) = (clause.find('{'), clause.rfind('}')) else { continue };
        for part in clause[open + 1..close].split(',') {
            let part = part.trim();
            if part.is_empty() || part.starts_with("type ") { continue; }
            let (orig, local) = part.split_once(" as ").map_or((part, part), |(a, b)| (a.trim(), b.trim()));
            out.push((orig.to_string(), local.to_string()));
        }
    }
    out
}

fn is_ident(c: char) -> bool { c.is_ascii_alphanumeric() || c == '_' || c == '$' }

/// 1-based line of the first real use of `name`: `name.`, `name(`, `<name`,
/// not part of a longer identifier and not the import itself.
fn first_use(src: &str, name: &str) -> Option<usize> {
    let mut from = 0;
    while let Some(i) = src[from..].find(name) {
        let at = from + i;
        from = at + name.len();
        let before = src[..at].chars().next_back();
        let after = src[from..].chars().next();
        if before.is_some_and(|c| is_ident(c) || c == '.') { continue; }
        let used = match after {
            Some('.') | Some('(') => before != Some('{') && !src[..at].trim_end().ends_with(','),
            Some(' ') | Some('/') | Some('>') | Some('\n') => before == Some('<'),
            _ => false,
        };
        // Skip the import line itself.
        let line_start = src[..at].rfind('\n').map_or(0, |n| n + 1);
        if src[line_start..].trim_start().starts_with("import") { continue; }
        if used { return Some(src[..at].matches('\n').count() + 1); }
    }
    None
}

/// Literal URLs passed to `fetch(` / `ws.connect(` / `new WebSocket(`: (line, url).
fn literal_urls(src: &str) -> Vec<(usize, String)> {
    let mut out = Vec::new();
    for call in ["fetch(", ".connect(", "WebSocket("] {
        let mut from = 0;
        while let Some(i) = src[from..].find(call) {
            let at = from + i + call.len();
            from = at;
            let arg = src[at..].trim_start();
            let Some(q) = arg.chars().next().filter(|c| matches!(c, '\'' | '"' | '`')) else { continue };
            let body = &arg[1..];
            let Some(end) = body.find(q) else { continue };
            let url = &body[..end];
            if url.contains("${") || !url.contains("://") { continue; }
            out.push((src[..at].matches('\n').count() + 1, url.to_string()));
        }
    }
    out
}

fn host_of(url: &str) -> String {
    let rest = url.split_once("://").map_or(url, |(_, r)| r);
    let hostport = rest.split(['/', '?', '#']).next().unwrap_or("");
    hostport.rsplit_once(':').filter(|(_, p)| p.chars().all(|c| c.is_ascii_digit())).map_or(hostport, |(h, _)| h).to_ascii_lowercase()
}

/// Uses in `sources` (path, content) that need a capability `caps` lacks.
pub(crate) fn findings(sources: &[(String, String)], caps: &Value, can_network: impl Fn(&str) -> bool) -> Vec<Value> {
    let mut out = Vec::new();
    for (path, src) in sources.iter().filter(|(p, _)| is_app_source(p)) {
        let file = path.replace('\\', "/").trim_start_matches("../").to_string();
        let imports = glyx_imports(src);
        let mut uses: Vec<(&str, String)> = imports.iter()
            .filter_map(|(orig, local)| APIS.iter().find(|(api, _)| api == orig).map(|(_, cap)| (*cap, local.clone())))
            .collect();
        // Global fetch / WebSocket need no import.
        if src.contains("fetch(") && !uses.iter().any(|(_, l)| l == "fetch") { uses.push(("network", "fetch".into())); }
        for (cap, local) in uses {
            if granted(caps, cap) { continue; }
            let Some(line) = first_use(src, &local) else { continue };
            out.push(json!({ "capability": cap, "api": local, "file": file, "line": line, "reason": "missing" }));
        }
        if granted(caps, "network") {
            for (line, url) in literal_urls(src) {
                let host = host_of(&url);
                if !host.is_empty() && !can_network(&host) {
                    out.push(json!({ "capability": "network", "api": url, "host": host, "file": file, "line": line, "reason": "hostNotAllowed" }));
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    const APP: &str = "import React from 'react';\nimport { View, db, clipboard as cb, Video } from '@glyx-dev/react';\nimport { fs } from './my-fs';\n\nexport function App() {\n  db.query('select 1');\n  cb.write('x');\n  fetch('https://api.example.com/items');\n  fetch(`https://${host}/x`);\n  fs.readFile('a');\n  return <Video src=\"a.mp4\" />;\n}\n";

    #[test]
    fn imports_from_glyx_only() {
        assert_eq!(glyx_imports(APP), vec![
            ("View".into(), "View".into()), ("db".into(), "db".into()),
            ("clipboard".into(), "cb".into()), ("Video".into(), "Video".into()),
        ]);
    }

    #[test]
    fn flags_ungranted_uses_with_their_lines() {
        let caps = json!({ "db": true, "network": { "allow": ["other.example"] } });
        let f = findings(&[("../../js/app.jsx".into(), APP.into()), ("../node_modules/x/index.js".into(), APP.into())], &caps, |h| h == "other.example");
        let got: Vec<(String, String, u64)> = f.iter().map(|v| (v["capability"].as_str().unwrap().into(), v["api"].as_str().unwrap().into(), v["line"].as_u64().unwrap())).collect();
        assert_eq!(got, vec![
            ("clipboard".into(), "cb".into(), 7),
            ("video".into(), "Video".into(), 11),
            ("network".into(), "https://api.example.com/items".into(), 8),
        ], "db is granted, fs isn't Glyx's, the template URL can't be checked, node_modules is skipped");
        assert_eq!(f[2]["host"], "api.example.com");
        assert_eq!(f[0]["file"], "js/app.jsx");
    }

    #[test]
    fn missing_network_flags_fetch_itself() {
        let f = findings(&[("app.jsx".into(), "fetch('https://a.example/x')\n".into())], &json!({}), |_| false);
        assert_eq!((f.len(), f[0]["capability"].as_str(), f[0]["reason"].as_str()), (1, Some("network"), Some("missing")));
        assert!(!granted(&json!({ "network": { "allow": [] } }), "network"));
        assert!(granted(&json!({ "fs": { "read": ["**"] } }), "fs"));
        assert!(!granted(&json!({ "fs": { "read": null, "write": null } }), "fs"));
    }
}
