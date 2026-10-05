//! `glyx mcp`: a Model Context Protocol server over stdio, so an AI agent
//! can find, inspect and drive running Glyx dev apps with one line of config:
//!
//! ```json
//! { "mcpServers": { "glyx": { "command": "glyx", "args": ["mcp"] } } }
//! ```
//!
//! It wraps GDP: finds apps started with `glyx dev --devtools` (the same
//! discovery files as `glyx inspect`), does the token handshake, and exposes
//! the useful methods as tools. Stdout carries only protocol messages; logs
//! go to stderr.

use std::path::PathBuf;
use std::time::Duration;

use anyhow::Result;
use glyx_devtools::{live_apps, GdpClient};
use serde_json::{json, Value};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};

/// MCP revisions this server speaks, newest first.
const PROTOCOL_VERSIONS: &[&str] = &["2025-06-18", "2025-03-26", "2024-11-05"];

const INSTRUCTIONS: &str = "Drive running Glyx apps (desktop apps built with React). \
Start the app with `glyx dev --devtools` first. Typical loop: get_tree (or find) to see the UI, \
click / type / press to act, wait_for to let the UI settle, screenshot to look. \
Elements are named by `id` (a stable element ID like \"App#0 › Toolbar#0 › Button#2\", from get_tree or find), \
`testID`, or `text`. Use evaluate for anything else, and console for logs.";

pub(super) fn cmd_mcp() -> Result<()> {
    let root = std::env::current_dir()?;
    let rt = tokio::runtime::Builder::new_current_thread().enable_all().build()?;
    rt.block_on(serve(root))
}

struct Server {
    discovery: Vec<PathBuf>,
    client: Option<GdpClient>,
    /// App chosen with select_app (its key, i.e. discovery file path).
    wanted: Option<String>,
}

async fn serve(root: PathBuf) -> Result<()> {
    let mut server = Server { discovery: super::cmd_inspect::discovery_paths(&root), client: None, wanted: None };
    let mut lines = BufReader::new(tokio::io::stdin()).lines();
    let mut out = tokio::io::stdout();
    while let Some(line) = lines.next_line().await? {
        if line.trim().is_empty() { continue; }
        let msg: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(e) => { write(&mut out, &rpc_error(Value::Null, -32700, &format!("parse error: {e}"))).await?; continue; }
        };
        // Notifications (no id) get no reply.
        let Some(id) = msg.get("id").cloned() else { continue };
        let method = msg.get("method").and_then(Value::as_str).unwrap_or("");
        let params = msg.get("params").cloned().unwrap_or(Value::Null);
        let reply = match method {
            "initialize" => {
                let asked = params.get("protocolVersion").and_then(Value::as_str).unwrap_or(PROTOCOL_VERSIONS[0]);
                let version = PROTOCOL_VERSIONS.iter().find(|v| **v == asked).copied().unwrap_or(PROTOCOL_VERSIONS[0]);
                rpc_ok(id, json!({
                    "protocolVersion": version,
                    "capabilities": { "tools": {} },
                    "serverInfo": { "name": "glyx", "title": "Glyx apps", "version": env!("CARGO_PKG_VERSION") },
                    "instructions": INSTRUCTIONS,
                }))
            }
            "ping" => rpc_ok(id, json!({})),
            "tools/list" => rpc_ok(id, json!({ "tools": tools() })),
            "tools/call" => {
                let name = params.get("name").and_then(Value::as_str).unwrap_or("");
                let args = params.get("arguments").cloned().unwrap_or(json!({}));
                let result = match server.call_tool(name, &args).await {
                    Ok(content) => json!({ "content": content, "isError": false }),
                    Err(message) => json!({ "content": [text(message)], "isError": true }),
                };
                rpc_ok(id, result)
            }
            _ => rpc_error(id, -32601, &format!("method not found: {method}")),
        };
        write(&mut out, &reply).await?;
    }
    Ok(())
}

async fn write(out: &mut tokio::io::Stdout, v: &Value) -> Result<()> {
    out.write_all(v.to_string().as_bytes()).await?;
    out.write_all(b"\n").await?;
    out.flush().await?;
    Ok(())
}

fn rpc_ok(id: Value, result: Value) -> Value { json!({ "jsonrpc": "2.0", "id": id, "result": result }) }
fn rpc_error(id: Value, code: i32, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id, "error": { "code": code, "message": message } })
}
fn text(s: impl Into<String>) -> Value { json!({ "type": "text", "text": s.into() }) }

// ── Tools ───────────────────────────────────────────────────────────────────

/// Element selector properties, shared by several tools.
fn element_props() -> Value {
    json!({
        "id": { "type": "string", "description": "Stable element ID from get_tree / find, e.g. \"App#0 › Form#0 › Button#1\"." },
        "testID": { "type": "string", "description": "The element's testID prop, if the app set one." },
        "nodeId": { "type": "integer", "description": "Numeric node id (valid until the app restarts)." },
        "text": { "type": "string", "description": "Exact visible text; the first visible match is used." },
    })
}

fn with_props(extra: Value) -> Value {
    let mut p = element_props();
    if let (Some(o), Some(e)) = (p.as_object_mut(), extra.as_object()) {
        for (k, v) in e { o.insert(k.clone(), v.clone()); }
    }
    p
}

fn tools() -> Value {
    let window = json!({ "type": "integer", "description": "Window id (default: the main window)." });
    json!([
        { "name": "list_apps", "description": "Running Glyx apps started with `glyx dev --devtools` (in this folder or below), and which one the other tools use.",
          "inputSchema": { "type": "object", "properties": {} } },
        { "name": "select_app", "description": "Choose which running app the other tools act on (needed only when several are running).",
          "inputSchema": { "type": "object", "properties": { "app": { "type": "string", "description": "App name, key or pid from list_apps." } }, "required": ["app"] } },
        { "name": "get_tree", "description": "The UI as an indented outline: each element's type, component, text, element ID and position. Start here to see what's on screen.",
          "inputSchema": { "type": "object", "properties": with_props(json!({ "depth": { "type": "integer", "description": "Levels to include (default 12)." }, "windowId": window })) } },
        { "name": "find", "description": "Find elements by text, testID, role, label or type. Returns their element IDs, whether they're visible, and positions.",
          "inputSchema": { "type": "object", "properties": {
              "text": { "type": "string" }, "textContains": { "type": "string" }, "testID": { "type": "string" },
              "id": { "type": "string" }, "role": { "type": "string" }, "label": { "type": "string" },
              "type": { "type": "string", "description": "View, Text, Pressable, TextInput, Image…" }, "windowId": window } } },
        { "name": "click", "description": "Click an element (by id, testID, nodeId or text) or a point (x, y).",
          "inputSchema": { "type": "object", "properties": with_props(json!({ "x": { "type": "number" }, "y": { "type": "number" }, "windowId": window })) } },
        { "name": "type", "description": "Type text into the focused element, or into the given element (clicked first). \\n is Enter.",
          "inputSchema": { "type": "object", "properties": with_props(json!({ "value": { "type": "string", "description": "The text to type." }, "windowId": window })), "required": ["value"] } },
        { "name": "press", "description": "Press a key, optionally with modifiers: Enter, Escape, Tab, Backspace, ArrowDown, KeyS…",
          "inputSchema": { "type": "object", "properties": { "key": { "type": "string" }, "modifiers": { "type": "array", "items": { "type": "string", "enum": ["Control", "Shift", "Alt", "Super"] } }, "windowId": window }, "required": ["key"] } },
        { "name": "scroll", "description": "Scroll (negative deltaY scrolls down), over an element or point if given.",
          "inputSchema": { "type": "object", "properties": with_props(json!({ "deltaY": { "type": "number" }, "x": { "type": "number" }, "y": { "type": "number" }, "windowId": window })), "required": ["deltaY"] } },
        { "name": "wait_for", "description": "Wait until an element exists, is visible, or is gone (default: exists). Use after actions that change the UI.",
          "inputSchema": { "type": "object", "properties": with_props(json!({
              "textContains": { "type": "string" },
              "condition": { "type": "string", "enum": ["exists", "visible", "gone"] },
              "timeoutMs": { "type": "integer", "description": "Default 5000, max 60000." }, "windowId": window })) } },
        { "name": "screenshot", "description": "A PNG of the window, or of one element. Needs the app on the CPU renderer (GLYX_CPU_RENDER=1); the error says how otherwise.",
          "inputSchema": { "type": "object", "properties": with_props(json!({ "windowId": window })) } },
        { "name": "evaluate", "description": "Run JavaScript in the app and return the value. `$0` is the element last selected in DevTools.",
          "inputSchema": { "type": "object", "properties": { "expression": { "type": "string" }, "windowId": window }, "required": ["expression"] } },
        { "name": "console", "description": "Recent console output from the app (log, warn, error), oldest first.",
          "inputSchema": { "type": "object", "properties": { "limit": { "type": "integer", "description": "Most recent N (default 50)." }, "level": { "type": "string", "enum": ["log", "warn", "error", "debug"] } } } },
        { "name": "capabilities", "description": "What the app's glyx.config.json grants, code that uses ungranted capabilities, and what was refused at runtime.",
          "inputSchema": { "type": "object", "properties": {} } },
        { "name": "gdp", "description": "Call any Glyx DevTools Protocol method directly (see docs/DEVTOOLS.md), e.g. Inspector.getNode or Performance.snapshot.",
          "inputSchema": { "type": "object", "properties": { "method": { "type": "string", "description": "\"Domain.method\"" }, "params": { "type": "object" }, "windowId": window }, "required": ["method"] } },
    ])
}

impl Server {
    async fn apps(&self) -> Vec<glyx_devtools::AppInfo> { live_apps(&self.discovery).await }

    /// The connected app, connecting (or reconnecting after a restart) as needed.
    async fn client(&mut self) -> Result<&mut GdpClient, String> {
        if self.client.is_none() {
            let apps = self.apps().await;
            let app = match (&self.wanted, apps.len()) {
                (Some(key), _) => apps.iter().find(|a| &a.key == key).cloned()
                    .ok_or_else(|| "the selected app isn't running any more; start it with `glyx dev --devtools`, or pick another with select_app".to_string())?,
                (None, 0) => return Err("no running Glyx app found. Start one with `glyx dev --devtools` in its folder (or a folder below where this server runs).".into()),
                (None, 1) => apps[0].clone(),
                (None, _) => return Err(format!("several apps are running: {}. Choose one with select_app.",
                    apps.iter().map(|a| format!("{} (pid {})", a.name, a.pid)).collect::<Vec<_>>().join(", "))),
            };
            self.client = Some(GdpClient::connect(app).await?);
        }
        Ok(self.client.as_mut().expect("just set"))
    }

    /// One GDP call; on a lost connection, reconnect once (the app may have restarted).
    async fn gdp(&mut self, name: &str, params: Value, window: Option<u32>) -> Result<Value, String> {
        let timeout = Duration::from_secs(70);
        for attempt in 0..2 {
            let c = self.client().await?;
            match c.call(name, params.clone(), window, timeout).await {
                Ok(Ok(v)) => return Ok(v),
                Ok(Err(e)) => return Err(match e.data {
                    Some(d) => format!("{} ({})", e.message, d),
                    None => e.message,
                }),
                Err(lost) if attempt == 0 => { self.client = None; let _ = lost; }
                Err(lost) => return Err(lost),
            }
        }
        unreachable!()
    }

    /// `{ id | testID | nodeId }` from the arguments; `text` is looked up first.
    async fn element(&mut self, a: &Value, window: Option<u32>) -> Result<Option<Value>, String> {
        for k in ["id", "testID", "nodeId"] {
            if let Some(v) = a.get(k) { return Ok(Some(json!({ k: v }))); }
        }
        let Some(t) = a.get("text").and_then(Value::as_str) else { return Ok(None) };
        let found = self.gdp("Automation.findNodes", json!({ "text": t }), window).await?;
        let nodes = found["nodes"].as_array().cloned().unwrap_or_default();
        let hit = nodes.iter().find(|n| n["visible"] == true).or(nodes.first())
            .ok_or_else(|| format!("no element with text {t:?}"))?;
        Ok(Some(json!({ "nodeId": hit["nodeId"] })))
    }

    async fn call_tool(&mut self, name: &str, a: &Value) -> Result<Vec<Value>, String> {
        let window = a.get("windowId").and_then(Value::as_u64).map(|w| w as u32);
        match name {
            "list_apps" => {
                let apps = self.apps().await;
                if apps.is_empty() {
                    return Ok(vec![text("No running Glyx apps. Start one with `glyx dev --devtools`.")]);
                }
                let current = self.client.as_ref().map(|c| c.app.key.clone()).or(self.wanted.clone());
                Ok(vec![text(apps.iter().map(|a| format!("{}{} · {} · pid {} · key {}",
                    if Some(&a.key) == current.as_ref() { "* " } else { "  " }, a.name, a.engine, a.pid, a.key)).collect::<Vec<_>>().join("\n"))])
            }
            "select_app" => {
                let want = a.get("app").and_then(Value::as_str).ok_or("app is required")?;
                let apps = self.apps().await;
                let app = apps.iter().find(|x| x.key == want || x.name == want || x.pid.to_string() == want)
                    .ok_or_else(|| format!("no running app {want:?}; see list_apps"))?;
                self.wanted = Some(app.key.clone());
                self.client = None;
                let c = self.client().await?;
                Ok(vec![text(format!("Using {} ({}, pid {}).", c.app.name, c.handshake["engine"].as_str().unwrap_or("?"), c.app.pid))])
            }
            "get_tree" => {
                let mut p = json!({ "depth": a.get("depth").cloned().unwrap_or(json!(12)) });
                if let Some(el) = self.element(a, window).await? { merge(&mut p, el); }
                let r = self.gdp("Inspector.getTree", p, window).await?;
                let mut out = String::new();
                outline(&r["root"], 0, &mut out);
                Ok(vec![text(format!("{} elements\n{out}", r["nodeCount"]))])
            }
            "find" => {
                let mut p = a.clone();
                if let Some(o) = p.as_object_mut() { o.remove("windowId"); }
                let r = self.gdp("Automation.findNodes", p, window).await?;
                let nodes = r["nodes"].as_array().cloned().unwrap_or_default();
                if nodes.is_empty() { return Ok(vec![text("No matching elements.")]); }
                Ok(vec![text(nodes.iter().map(|n| format!("{}{}", line(n), if n["visible"] == false { "  (not visible)" } else { "" })).collect::<Vec<_>>().join("\n"))])
            }
            "click" => {
                let p = match self.element(a, window).await? {
                    Some(el) => el,
                    None => json!({ "x": a.get("x").ok_or("give an element (id, testID, nodeId or text) or x and y")?, "y": a.get("y").ok_or("y is required with x")? }),
                };
                let r = self.gdp("Automation.click", p, window).await?;
                Ok(vec![text(format!("Clicked at ({}, {}).", r["x"], r["y"]))])
            }
            "type" => {
                let value = a.get("value").and_then(Value::as_str).ok_or("value is required")?;
                if let Some(el) = self.element(a, window).await? { self.gdp("Automation.click", el, window).await?; }
                self.gdp("Automation.type", json!({ "text": value }), window).await?;
                Ok(vec![text(format!("Typed {} characters.", value.chars().count()))])
            }
            "press" => {
                let mut p = json!({ "key": a.get("key").ok_or("key is required")? });
                if let Some(m) = a.get("modifiers") { p["modifiers"] = m.clone(); }
                self.gdp("Automation.press", p, window).await?;
                Ok(vec![text("Pressed.")])
            }
            "scroll" => {
                let mut p = json!({ "deltaY": a.get("deltaY").ok_or("deltaY is required")? });
                if let Some(el) = self.element(a, window).await? { merge(&mut p, el); }
                else if let (Some(x), Some(y)) = (a.get("x"), a.get("y")) { p["x"] = x.clone(); p["y"] = y.clone(); }
                self.gdp("Automation.scroll", p, window).await?;
                Ok(vec![text("Scrolled.")])
            }
            "wait_for" => {
                let mut p = json!({});
                for k in ["id", "testID", "nodeId", "text", "textContains", "condition", "timeoutMs"] {
                    if let Some(v) = a.get(k) { p[k] = v.clone(); }
                }
                let r = self.gdp("Automation.waitFor", p, window).await?;
                Ok(vec![text(format!("Done: {} matching element(s).", r["nodeIds"].as_array().map_or(0, |v| v.len())))])
            }
            "screenshot" => {
                let p = self.element(a, window).await?.unwrap_or(json!({}));
                let r = self.gdp("Automation.screenshot", p, window).await?;
                Ok(vec![
                    json!({ "type": "image", "data": r["data"], "mimeType": "image/png" }),
                    text(format!("{} × {} px", r["width"], r["height"])),
                ])
            }
            "evaluate" => {
                let expr = a.get("expression").and_then(Value::as_str).ok_or("expression is required")?;
                let r = self.gdp("Runtime.evaluate", json!({ "expression": expr }), window).await?;
                let shown = match r.get("value") {
                    Some(v) if !v.is_null() => serde_json::to_string_pretty(v).unwrap_or_default(),
                    _ => r["description"].as_str().unwrap_or("undefined").to_string(),
                };
                Ok(vec![text(shown)])
            }
            "console" => {
                let r = self.gdp("Console.getMessages", json!({}), None).await?;
                let level = a.get("level").and_then(Value::as_str);
                let limit = a.get("limit").and_then(Value::as_u64).unwrap_or(50) as usize;
                let msgs: Vec<&Value> = r["messages"].as_array().map(|m| m.iter().filter(|x| level.is_none_or(|l| x["level"] == l)).collect()).unwrap_or_default();
                let start = msgs.len().saturating_sub(limit);
                if msgs.is_empty() { return Ok(vec![text("No console messages.")]); }
                Ok(vec![text(msgs[start..].iter().map(|m| format!("[{}] {}", m["level"].as_str().unwrap_or("log"), m["text"].as_str().unwrap_or(""))).collect::<Vec<_>>().join("\n"))])
            }
            "capabilities" => {
                let r = self.gdp("Runtime.getCapabilities", json!({}), None).await?;
                Ok(vec![text(serde_json::to_string_pretty(&r).unwrap_or_default())])
            }
            "gdp" => {
                let method = a.get("method").and_then(Value::as_str).ok_or("method is required")?;
                let r = self.gdp(method, a.get("params").cloned().unwrap_or(json!({})), window).await?;
                Ok(vec![text(serde_json::to_string_pretty(&r).unwrap_or_default())])
            }
            _ => Err(format!("unknown tool {name:?}")),
        }
    }
}

fn merge(into: &mut Value, from: Value) {
    if let (Some(a), Some(b)) = (into.as_object_mut(), from.as_object()) {
        for (k, v) in b { a.insert(k.clone(), v.clone()); }
    }
}

/// One element on one line: `Pressable "Save" · id App#0 › Btn#2 · (10, 20, 80×32)`.
fn line(n: &Value) -> String {
    let mut s = n["type"].as_str().unwrap_or("?").to_string();
    if let Some(c) = n["component"].as_str() { s = format!("{c} {s}"); }
    if let Some(t) = n["text"].as_str() { s.push_str(&format!(" {:?}", truncate(t, 60))); }
    if let Some(l) = n["label"].as_str() { s.push_str(&format!(" [label {l:?}]")); }
    if let Some(t) = n["testID"].as_str() { s.push_str(&format!(" [testID {t}]")); }
    if let Some(id) = n["id"].as_str() { s.push_str(&format!(" · id {id}")); }
    let r = &n["rect"];
    if r.is_object() {
        s.push_str(&format!(" · ({}, {}, {}×{})", num(&r["x"]), num(&r["y"]), num(&r["width"]), num(&r["height"])));
    }
    s
}

fn outline(n: &Value, depth: usize, out: &mut String) {
    if n.is_null() { return; }
    out.push_str(&"  ".repeat(depth));
    out.push_str(&line(n));
    let kids = n["children"].as_array();
    if kids.is_none() && n["childCount"].as_u64().unwrap_or(0) > 0 {
        out.push_str(&format!("  (+{} children, ask with a deeper depth or this id)", n["childCount"]));
    }
    out.push('\n');
    for c in kids.into_iter().flatten() { outline(c, depth + 1, out); }
}

fn num(v: &Value) -> String { v.as_f64().map(|f| format!("{}", f.round() as i64)).unwrap_or_default() }

fn truncate(s: &str, n: usize) -> String {
    if s.chars().count() > n { format!("{}…", s.chars().take(n - 1).collect::<String>()) } else { s.to_string() }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tools_have_valid_schemas() {
        for t in tools().as_array().unwrap() {
            assert!(t["name"].is_string() && t["description"].is_string(), "{t}");
            assert_eq!(t["inputSchema"]["type"], "object", "{}", t["name"]);
        }
    }

    #[test]
    fn outline_reads_well() {
        let tree = json!({ "type": "View", "component": "App", "id": "App#0", "rect": { "x": 0, "y": 0, "width": 800, "height": 600 }, "children": [
            { "type": "Text", "text": "Save", "id": "App#0 › Text#0", "rect": { "x": 10.4, "y": 20, "width": 40, "height": 16 } },
            { "type": "View", "id": "App#0 › View#1", "childCount": 3 },
        ] });
        let mut s = String::new();
        outline(&tree, 0, &mut s);
        assert_eq!(s, "App View · id App#0 · (0, 0, 800×600)\n  Text \"Save\" · id App#0 › Text#0 · (10, 20, 40×16)\n  View · id App#0 › View#1  (+3 children, ask with a deeper depth or this id)\n");
    }
}
