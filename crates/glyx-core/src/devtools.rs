//! Glyx DevTools Protocol (GDP) domains, served from the event-loop thread.
//!
//! `glyx-devtools` owns the socket; this module answers requests against the
//! live windows. Requests are drained by [`Devtools::pump`], called from the
//! redraw handler and on `ShellEvent::Wake` (sent by the transport when a
//! request arrives), so domain code reads window state without locks.
//!
//! Enabled by `GLYX_DEVTOOLS_PORT` (`glyx dev --devtools [port]`), `dev`
//! builds only.

use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc::Receiver;
use std::sync::Arc;
use std::time::{Duration, Instant};

use base64::Engine as _;
use glyx_devtools::{codes, ConnId, DevtoolsServer, ErrorBody, Handshake, Incoming, Request, WindowInfo, PROTOCOL_VERSION};
use glyx_runtime::log_bus::{self, LogEntry};
use glyx_shell::{EventLoopProxy, GlyxUserEvent, ShellEvent};
use parking_lot::Mutex;
use serde_json::{json, Value};

use crate::devtools_inspect as inspect;
use crate::devtools_inspect::{Condition, Query};
use crate::state::{PerWindowState, Present};

/// Every method answered here, as listed in the handshake.
pub(crate) const METHODS: &[&str] = &[
    "Runtime.handshake", "Runtime.ping", "Runtime.version", "Runtime.windows", "Runtime.evaluate",
    "Console.enable", "Console.disable",
    "Inspector.getTree", "Inspector.getNode", "Inspector.getLayout", "Inspector.selectElement",
    "Inspector.getAccessibilityTree", "Inspector.highlightNode", "Inspector.setNodeProp",
    "Inspector.enableDamage", "Inspector.disableDamage",
    "Automation.findNodes", "Automation.click", "Automation.type", "Automation.press",
    "Automation.scroll", "Automation.dispatchInput", "Automation.screenshot", "Automation.waitFor",
];
pub(crate) const EVENTS: &[&str] = &["Console.messageAdded", "Inspector.frameDamage"];

/// Responses that name nodes get each node's React component added.
const NAMED: &[&str] = &["Inspector.getTree", "Inspector.getNode", "Inspector.selectElement", "Automation.findNodes"];

pub(crate) const ENGINE: &str = if cfg!(feature = "v8") { "V8" } else { "QuickJS" };

/// Node count above which element IDs are cached between requests.
const DEFAULT_AUTO_ID_CACHE_THRESHOLD: usize = 2000;

/// `waitFor` without `timeoutMs`, and the ceiling for it.
const DEFAULT_WAIT: Duration = Duration::from_secs(5);
const MAX_WAIT: Duration = Duration::from_secs(60);
/// How often pending `waitFor`s are re-checked while the app is idle.
const WAIT_POLL: Duration = Duration::from_millis(30);

/// A `waitFor` that hasn't been satisfied yet.
struct Wait {
    conn: ConnId,
    id: Value,
    window: u32,
    query: Query,
    condition: Condition,
    deadline: Instant,
}

/// A handler's answer: now, or later (a `waitFor` that isn't met yet).
enum Reply {
    Now(Result<Value, ErrorBody>),
    Later,
}

impl From<Result<Value, ErrorBody>> for Reply {
    fn from(r: Result<Value, ErrorBody>) -> Self { Reply::Now(r) }
}

pub(crate) struct Devtools {
    server: DevtoolsServer,
    /// Clients that sent `Console.enable`.
    console: HashSet<ConnId>,
    /// Open only while at least one client listens, so an unwatched app
    /// pays nothing for console forwarding.
    logs: Option<Receiver<LogEntry>>,
    /// Delivers synthetic input through the event loop, the same path real
    /// input takes.
    proxy: Mutex<EventLoopProxy<GlyxUserEvent>>,
    waits: Vec<Wait>,
    /// Clients that sent `Inspector.enableDamage`.
    damage: HashSet<ConnId>,
    /// Windows with more nodes than this use the cached element IDs
    /// (`devtools.autoIdCacheThreshold` in glyx.config.json, via
    /// `GLYX_DEVTOOLS_AUTOID_CACHE_THRESHOLD`).
    auto_id_cache_threshold: usize,
    /// A wake-up for pending waits is already scheduled.
    tick_scheduled: Arc<AtomicBool>,
    tokio: tokio::runtime::Handle,
}

impl Devtools {
    /// Start when `GLYX_DEVTOOLS_PORT` is set. Logs the address and writes a
    /// discovery file (port + token) for `glyx inspect` and editors.
    pub(crate) fn start_from_env(handle: &tokio::runtime::Handle, proxy: EventLoopProxy<GlyxUserEvent>) -> Option<Self> {
        let port: u16 = match std::env::var("GLYX_DEVTOOLS_PORT").ok()?.trim().parse() {
            Ok(p) => p,
            Err(_) => { log::warn!("[GDP] GLYX_DEVTOOLS_PORT is not a port number; devtools off"); return None; }
        };
        let token = std::env::var("GLYX_DEVTOOLS_TOKEN").ok()
            .filter(|t| t.len() >= 16)
            .unwrap_or_else(glyx_devtools::new_token);
        let wake_proxy = Mutex::new(proxy.clone());
        let wake = Arc::new(move || { let _ = wake_proxy.lock().send_event(GlyxUserEvent::Wake); });
        let server = match DevtoolsServer::start(handle, port, token.clone(), wake) {
            Ok(s) => s,
            Err(e) => { log::error!("[GDP] could not listen on 127.0.0.1:{port}: {e}"); return None; }
        };
        let port = server.port();
        let file = discovery_path();
        let info = json!({
            "protocolVersion": PROTOCOL_VERSION,
            "url": format!("ws://127.0.0.1:{port}/"),
            "port": port,
            "token": token,
            "pid": std::process::id(),
            "engine": ENGINE,
        });
        match std::fs::create_dir_all(file.parent().unwrap_or(std::path::Path::new(".")))
            .and_then(|_| std::fs::write(&file, serde_json::to_string_pretty(&info).unwrap_or_default()))
        {
            Ok(()) => log::info!("[GDP] devtools on ws://127.0.0.1:{port}/ (token in {})", file.display()),
            Err(e) => log::warn!("[GDP] devtools on ws://127.0.0.1:{port}/; could not write {}: {e}", file.display()),
        }
        Some(Self {
            server, console: HashSet::new(), logs: None,
            proxy: Mutex::new(proxy), waits: Vec::new(), damage: HashSet::new(),
            auto_id_cache_threshold: std::env::var("GLYX_DEVTOOLS_AUTOID_CACHE_THRESHOLD").ok()
                .and_then(|v| v.trim().parse().ok()).unwrap_or(DEFAULT_AUTO_ID_CACHE_THRESHOLD),
            tick_scheduled: Arc::new(AtomicBool::new(false)), tokio: handle.clone(),
        })
    }

    /// Answer queued requests, settle waits, and forward console output.
    pub(crate) fn pump(&mut self, windows: &mut HashMap<u32, PerWindowState>) {
        for conn in self.server.take_closed() {
            self.console.remove(&conn);
            self.damage.remove(&conn);
            self.waits.retain(|w| w.conn != conn);
        }
        for Incoming { conn, mut request } in self.server.poll() {
            // `{ id: "…" }` selects by element ID: resolve it to the node now,
            // so every method accepts it. waitFor resolves on each check
            // instead (the element may not exist yet).
            let name = format!("{}.{}", request.domain, request.method);
            if name != "Automation.waitFor" && request.domain != "Runtime" {
                if let Some(auto_id) = request.params.get("id").and_then(Value::as_str).map(str::to_string) {
                    let resolved = target_window(request.window_id, windows).and_then(|win| {
                        let s = windows.get_mut(&win).expect("target_window checked it");
                        resolve_auto_id(s, &auto_id, self.auto_id_cache_threshold)
                            .ok_or_else(|| ErrorBody::new(codes::NO_SUCH_NODE, format!("no element with id {auto_id:?}")))
                    });
                    match resolved {
                        Ok(node) => {
                            if let Some(obj) = request.params.as_object_mut() {
                                obj.remove("id");
                                obj.insert("nodeId".into(), json!(node));
                            }
                        }
                        Err(e) => { self.server.respond(conn, &request.id, Err(e)); continue; }
                    }
                }
            }
            if let Reply::Now(mut result) = self.handle(conn, &request, windows) {
                if let (Ok(v), true) = (&mut result, NAMED.contains(&name.as_str())) {
                    if let Ok(win) = target_window(request.window_id, windows) {
                        add_node_info(windows.get_mut(&win).expect("target_window checked it"), v, self.auto_id_cache_threshold);
                    }
                }
                self.server.respond(conn, &request.id, result);
            }
        }
        self.settle_waits(windows);
        self.forward_damage(windows);
        if self.console.is_empty() {
            self.logs = None;
        } else if let Some(rx) = &self.logs {
            for e in rx.try_iter() {
                let params = json!({ "level": e.level, "text": e.text, "timestamp": e.timestamp_ms });
                for &c in &self.console {
                    self.server.send_event(c, "Console.messageAdded", e.window_id, params.clone());
                }
            }
        }
    }

    /// Answer every wait whose condition now holds or whose time is up;
    /// keep the app waking up while any remain.
    fn settle_waits(&mut self, windows: &mut HashMap<u32, PerWindowState>) {
        if self.waits.is_empty() { return; }
        let now = Instant::now();
        let server = &self.server;
        let threshold = self.auto_id_cache_threshold;
        self.waits.retain(|w| {
            let Some(s) = windows.get_mut(&w.window) else {
                server.respond(w.conn, &w.id, Err(ErrorBody::new(codes::NO_SUCH_WINDOW, "the window closed")));
                return false;
            };
            // An element ID resolves to whichever node carries it right now
            // (none yet → matches nothing, so "gone" holds and "exists" waits).
            let mut query = w.query.clone();
            if let Some(auto_id) = query.auto_id.take() {
                query.node_id = Some(resolve_auto_id(s, &auto_id, threshold).unwrap_or(u32::MAX));
            }
            if let Some(ids) = inspect::check(s, &query, w.condition) {
                server.respond(w.conn, &w.id, Ok(json!({ "nodeIds": ids })));
                return false;
            }
            if now >= w.deadline {
                server.respond(w.conn, &w.id, Err(ErrorBody::new(codes::TIMEOUT, "condition not met in time")));
                return false;
            }
            true
        });
        if !self.waits.is_empty() && !self.tick_scheduled.swap(true, Ordering::AcqRel) {
            let flag = Arc::clone(&self.tick_scheduled);
            let proxy = self.proxy.lock().clone();
            self.tokio.spawn(async move {
                tokio::time::sleep(WAIT_POLL).await;
                flag.store(false, Ordering::Release);
                let _ = proxy.send_event(GlyxUserEvent::Wake);
            });
        }
    }

    /// Keep damage logs on while anyone listens, and stream what they hold.
    fn forward_damage(&mut self, windows: &mut HashMap<u32, PerWindowState>) {
        for (&win, s) in windows.iter_mut() {
            if self.damage.is_empty() {
                s.damage_log = None;
                continue;
            }
            let Some(log) = s.damage_log.as_mut() else {
                s.damage_log = Some(Vec::new());
                continue;
            };
            for r in log.drain(..) {
                let params = json!({
                    "partial": r.rect.is_some(),
                    "rect": r.rect,
                    "dirtyCount": r.dirty_nodes,
                    "timestamp": r.timestamp_ms,
                });
                for &c in &self.damage {
                    self.server.send_event(c, "Inspector.frameDamage", Some(win), params.clone());
                }
            }
        }
    }

    fn inject(&self, events: Vec<ShellEvent>) {
        let proxy = self.proxy.lock();
        for e in events {
            let _ = proxy.send_event(GlyxUserEvent::Inject(e));
        }
    }

    fn handle(&mut self, conn: ConnId, req: &Request, windows: &mut HashMap<u32, PerWindowState>) -> Reply {
        let p = &req.params;
        match (req.domain.as_str(), req.method.as_str()) {
            ("Runtime", "handshake") => Ok(serde_json::to_value(Handshake {
                protocol_version: PROTOCOL_VERSION,
                engine: ENGINE.into(),
                pid: std::process::id(),
                windows: window_list(windows),
                methods: METHODS.iter().map(|s| s.to_string()).collect(),
                events: EVENTS.iter().map(|s| s.to_string()).collect(),
            }).unwrap_or(Value::Null)).into(),
            ("Runtime", "ping") => Ok(json!({ "pong": true })).into(),
            ("Runtime", "version") => Ok(json!({
                "protocolVersion": PROTOCOL_VERSION,
                "glyx": env!("CARGO_PKG_VERSION"),
                "engine": ENGINE,
            })).into(),
            ("Runtime", "windows") => Ok(json!({ "windows": window_list(windows) })).into(),
            ("Runtime", "evaluate") => (|| {
                let expr = p.get("expression").and_then(Value::as_str)
                    .ok_or_else(|| ErrorBody::invalid_params("expression (string) is required"))?;
                let id = target_window(req.window_id, windows)?;
                let s = windows.get_mut(&id).expect("target_window checked it");
                let out = s.runtime.eval(&evaluate_source(expr))
                    .map_err(|e| ErrorBody::new(codes::EVAL_FAILED, e.to_string()))?;
                // Promise continuations and React commits scheduled by the
                // snippet run now; a redraw applies any UI change it made.
                s.runtime.flush_microtasks();
                s.window.request_redraw();
                parse_evaluate_result(&out)
            })().into(),
            ("Console", "enable") => {
                if self.logs.is_none() { self.logs = Some(log_bus::subscribe()); }
                self.console.insert(conn);
                Ok(json!({})).into()
            }
            ("Console", "disable") => {
                self.console.remove(&conn);
                Ok(json!({})).into()
            }

            // ── Inspector ──────────────────────────────────────────────────
            ("Inspector", "getTree") => (|| {
                let s = window(req, windows)?;
                let depth = p.get("depth").and_then(Value::as_u64).map(|d| d as u32);
                let root = match p.get("nodeId").and_then(Value::as_u64) {
                    Some(n) => Some(existing_node(s, n as u32)?),
                    None => s.js_root,
                };
                Ok(json!({
                    "root": root.map(|r| inspect::subtree(s, r, depth)),
                    "nodeCount": inspect::attached(&s.js_nodes, s.js_root).len(),
                }))
            })().into(),
            ("Inspector", "getNode") => (|| {
                let s = window(req, windows)?;
                let id = node_param(p)?;
                let mut v = inspect::node_detail(s, existing_node(s, id)?).unwrap_or(Value::Null);
                v["path"] = json!(inspect::path_to(&s.js_nodes, id));
                Ok(v)
            })().into(),
            ("Inspector", "getLayout") => (|| {
                let s = window(req, windows)?;
                let id = existing_node(s, node_param(p)?)?;
                Ok(inspect::layout_detail(s, id).unwrap_or(Value::Null))
            })().into(),
            ("Inspector", "getAccessibilityTree") => (|| {
                let win = target_window(req.window_id, windows)?;
                #[cfg(feature = "a11y")]
                {
                    let s = windows.get_mut(&win).expect("target_window checked it");
                    return Ok(inspect::a11y_tree(s).unwrap_or(Value::Null));
                }
                #[cfg(not(feature = "a11y"))]
                {
                    let _ = win;
                    Err(ErrorBody::new(codes::UNSUPPORTED,
                        "this app was built without the a11y feature; add it to glyx-core's features to inspect the accessibility tree"))
                }
            })().into(),
            ("Inspector", "highlightNode") => (|| {
                let win = target_window(req.window_id, windows)?;
                let s = windows.get_mut(&win).expect("target_window checked it");
                // nodeId: null (or absent) clears the highlight.
                let id = match p.get("nodeId").and_then(Value::as_u64) {
                    Some(n) => Some(existing_node(s, n as u32)?),
                    None => None,
                };
                s.devtools_highlight = id;
                s.window.request_redraw();
                Ok(json!({ "nodeId": id }))
            })().into(),
            ("Inspector", "setNodeProp") => (|| {
                let win = target_window(req.window_id, windows)?;
                let s = windows.get_mut(&win).expect("target_window checked it");
                let id = existing_node(s, node_param(p)?)?;
                let name = p.get("name").and_then(Value::as_str)
                    .ok_or_else(|| ErrorBody::invalid_params("name (prop name, e.g. \"backgroundColor\") is required"))?;
                let value = p.get("value").cloned().unwrap_or(Value::Null);
                let mut props = s.js_nodes[&id].props.clone();
                inspect::set_prop(&mut props, name, &value).map_err(ErrorBody::invalid_params)?;
                // The same path React's own updates take, so layout, damage
                // and the a11y tree all follow.
                crate::scene::apply_scene_commands(s, vec![glyx_runtime::SceneCommand::UpdateNode { id, props }]);
                s.window.request_redraw();
                Ok(json!({ "nodeId": id, "name": name, "value": value }))
            })().into(),
            ("Inspector", "enableDamage") => {
                self.damage.insert(conn);
                for s in windows.values_mut() {
                    if s.damage_log.is_none() { s.damage_log = Some(Vec::new()); }
                    s.window.request_redraw();
                }
                Ok(json!({})).into()
            }
            ("Inspector", "disableDamage") => {
                self.damage.remove(&conn);
                Ok(json!({})).into()
            }
            ("Inspector", "selectElement") => (|| {
                let s = window(req, windows)?;
                let (x, y) = point_param(p)?;
                let hit = crate::scene::hit_test_solid(s, x as f32, y as f32);
                Ok(json!({
                    "nodeId": hit,
                    "path": hit.map(|h| inspect::path_to(&s.js_nodes, h)),
                    "node": hit.map(|h| inspect::node_summary(s, h)),
                }))
            })().into(),

            // ── Automation ─────────────────────────────────────────────────
            ("Automation", "findNodes") => (|| {
                let s = window(req, windows)?;
                let q = Query::from_params(p);
                if q.is_empty() { return Err(ErrorBody::invalid_params("give at least one of id, nodeId, testID, text, textContains, role, label, type")); }
                let nodes: Vec<Value> = inspect::find(s, &q).into_iter().map(|id| {
                    let mut v = inspect::node_summary(s, id);
                    v["visible"] = json!(inspect::visible(s, id));
                    v
                }).collect();
                Ok(json!({ "nodes": nodes }))
            })().into(),
            ("Automation", "click") => (|| {
                let win = target_window(req.window_id, windows)?;
                let s = &windows[&win];
                let button = p.get("button").and_then(Value::as_str).map_or(Ok(0), button_code)?;
                let (x, y) = match (p.get("x"), p.get("nodeId").or(p.get("testID"))) {
                    (Some(_), _) => point_param(p)?,
                    (None, Some(_)) => {
                        let id = resolve_target(s, p)?;
                        let r = inspect::rect(s, id).filter(|_| inspect::visible(s, id))
                            .ok_or_else(|| ErrorBody::invalid_params(format!("node {id} is not on screen")))?;
                        inspect::center(r)
                    }
                    _ => return Err(ErrorBody::invalid_params("give nodeId, testID, or x and y")),
                };
                self.inject(inspect::click_events(win, x, y, button));
                Ok(json!({ "x": x, "y": y }))
            })().into(),
            ("Automation", "type") => (|| {
                let win = target_window(req.window_id, windows)?;
                let text = p.get("text").and_then(Value::as_str)
                    .ok_or_else(|| ErrorBody::invalid_params("text (string) is required"))?;
                self.inject(inspect::type_events(win, text));
                Ok(json!({ "characters": text.chars().count() }))
            })().into(),
            ("Automation", "press") => (|| {
                let win = target_window(req.window_id, windows)?;
                let key = p.get("key").and_then(Value::as_str)
                    .ok_or_else(|| ErrorBody::invalid_params("key (string) is required, e.g. \"Enter\" or \"KeyS\""))?;
                let mods: Vec<String> = p.get("modifiers").and_then(Value::as_array)
                    .map(|a| a.iter().filter_map(|m| m.as_str().map(str::to_string)).collect()).unwrap_or_default();
                self.inject(inspect::press_events(win, key, &mods));
                Ok(json!({}))
            })().into(),
            ("Automation", "scroll") => (|| {
                let win = target_window(req.window_id, windows)?;
                let s = &windows[&win];
                let dy = p.get("deltaY").and_then(Value::as_f64)
                    .ok_or_else(|| ErrorBody::invalid_params("deltaY (number, negative scrolls down) is required"))?;
                let mut events = Vec::new();
                // Scroll goes to what's under the pointer: move there first.
                if p.get("x").is_some() || p.get("nodeId").is_some() || p.get("testID").is_some() {
                    let (x, y) = if p.get("x").is_some() { point_param(p)? } else {
                        let id = resolve_target(s, p)?;
                        inspect::center(inspect::rect(s, id).ok_or_else(|| ErrorBody::invalid_params("node has no rect"))?)
                    };
                    events.push(ShellEvent::CursorMoved { window_handle: win, x, y });
                }
                events.push(ShellEvent::Scroll { window_handle: win, delta_y: dy as f32 });
                self.inject(events);
                Ok(json!({}))
            })().into(),
            ("Automation", "dispatchInput") => (|| {
                let win = target_window(req.window_id, windows)?;
                let ev = raw_input(win, p)?;
                self.inject(vec![ev]);
                Ok(json!({}))
            })().into(),
            ("Automation", "screenshot") => (|| {
                let s = window(req, windows)?;
                let crop = match p.get("nodeId").or(p.get("testID")) {
                    Some(_) => Some(inspect::rect(s, resolve_target(s, p)?)
                        .ok_or_else(|| ErrorBody::invalid_params("node has no rect"))?),
                    None => None,
                };
                let Present::Soft(sp) = &s.gpu else {
                    return Err(ErrorBody::new(codes::UNSUPPORTED,
                        "screenshots need the CPU renderer for now; start the app with GLYX_CPU_RENDER=1"));
                };
                let (w, h, px) = sp.last_frame()
                    .ok_or_else(|| ErrorBody::new(codes::UNSUPPORTED, "no frame presented yet"))?;
                let (cw, ch, png) = inspect::png(w, h, px, crop).map_err(ErrorBody::invalid_params)?;
                Ok(json!({
                    "format": "png",
                    "width": cw,
                    "height": ch,
                    "data": base64::engine::general_purpose::STANDARD.encode(png),
                }))
            })().into(),
            ("Automation", "waitFor") => {
                let prepared = (|| {
                    let win = target_window(req.window_id, windows)?;
                    let q = Query::from_params(p);
                    if q.is_empty() { return Err(ErrorBody::invalid_params("give at least one of id, nodeId, testID, text, textContains, role, label, type")); }
                    let c = Condition::parse(p.get("condition").and_then(Value::as_str))
                        .ok_or_else(|| ErrorBody::invalid_params("condition is \"exists\", \"visible\" or \"gone\""))?;
                    let timeout = p.get("timeoutMs").and_then(Value::as_u64)
                        .map(Duration::from_millis).unwrap_or(DEFAULT_WAIT).min(MAX_WAIT);
                    Ok((win, q, c, timeout))
                })();
                match prepared {
                    Err(e) => Reply::Now(Err(e)),
                    Ok((win, query, condition, timeout)) => {
                        self.waits.push(Wait { conn, id: req.id.clone(), window: win, query, condition, deadline: Instant::now() + timeout });
                        Reply::Later
                    }
                }
            }
            _ => Reply::Now(Err(ErrorBody::method_not_found(req))),
        }
    }
}

/// Add each node's React component (`"component": "Btn@app.jsx:104"`) to a
/// response, from the host config's devtools-only map. One JS call per
/// response; nothing is added if the app's React layer doesn't provide it.
/// Whether this window is big enough to use the cached element IDs.
fn use_id_cache(s: &PerWindowState, threshold: usize) -> bool {
    s.js_nodes.len() > threshold
}

fn add_node_info(s: &mut PerWindowState, v: &mut Value, threshold: usize) {
    let mut ids = Vec::new();
    inspect::node_ids(v, &mut ids);
    ids.sort_unstable();
    ids.dedup();
    if ids.is_empty() { return; }
    // Names and element IDs in one call into JS.
    let script = format!("({{ names: {}, ids: {} }})",
        inspect::names_script(&ids), inspect::ids_script(Some(&ids), use_id_cache(s, threshold)));
    let Ok(out) = s.runtime.eval(&evaluate_source(&script)) else { return };
    if let Ok(r) = parse_evaluate_result(&out) {
        if let Some(obj) = r.get("value") {
            inspect::annotate(v, &inspect::parse_names(&obj["names"]));
            inspect::annotate_ids(v, &inspect::parse_ids(&obj["ids"]));
        }
    }
}

/// The node carrying element ID `auto_id` (automatic or pinned testID).
pub(crate) fn resolve_auto_id(s: &mut PerWindowState, auto_id: &str, threshold: usize) -> Option<u32> {
    // Looked up inside JS, so only one node id crosses back (not every ID).
    let script = format!("(typeof __glyx_devFindId === 'function') ? __glyx_devFindId({}, {}) : null",
        serde_json::to_string(auto_id).ok()?, use_id_cache(s, threshold));
    let out = s.runtime.eval(&evaluate_source(&script)).ok()?;
    let r = parse_evaluate_result(&out).ok()?;
    r.get("value")?.as_u64().map(|n| n as u32)
}

fn window<'a>(req: &Request, windows: &'a HashMap<u32, PerWindowState>) -> Result<&'a PerWindowState, ErrorBody> {
    Ok(&windows[&target_window(req.window_id, windows)?])
}

fn existing_node(s: &PerWindowState, id: u32) -> Result<u32, ErrorBody> {
    if s.js_nodes.contains_key(&id) { Ok(id) } else { Err(ErrorBody::new(codes::NO_SUCH_NODE, format!("no node {id}"))) }
}

fn node_param(p: &Value) -> Result<u32, ErrorBody> {
    p.get("nodeId").and_then(Value::as_u64).map(|n| n as u32)
        .ok_or_else(|| ErrorBody::invalid_params("nodeId (number) is required"))
}

fn point_param(p: &Value) -> Result<(f64, f64), ErrorBody> {
    match (p.get("x").and_then(Value::as_f64), p.get("y").and_then(Value::as_f64)) {
        (Some(x), Some(y)) => Ok((x, y)),
        _ => Err(ErrorBody::invalid_params("x and y (numbers, window pixels) are required")),
    }
}

/// `nodeId`, or the first visible node with `testID` (else the first one).
fn resolve_target(s: &PerWindowState, p: &Value) -> Result<u32, ErrorBody> {
    if let Some(n) = p.get("nodeId").and_then(Value::as_u64) { return existing_node(s, n as u32); }
    let tid = p.get("testID").and_then(Value::as_str)
        .ok_or_else(|| ErrorBody::invalid_params("nodeId or testID is required"))?;
    let found = inspect::find(s, &Query { test_id: Some(tid.into()), ..Default::default() });
    found.iter().copied().find(|&id| inspect::visible(s, id)).or(found.first().copied())
        .ok_or_else(|| ErrorBody::new(codes::NO_SUCH_NODE, format!("no node with testID {tid:?}")))
}

fn button_code(b: &str) -> Result<u8, ErrorBody> {
    match b {
        "left" => Ok(0),
        "right" => Ok(1),
        "middle" => Ok(2),
        _ => Err(ErrorBody::invalid_params("button is \"left\", \"right\" or \"middle\"")),
    }
}

/// `Automation.dispatchInput`: one low-level event.
/// `{ type: "pointerMove", x, y }`, `{ type: "pointerDown" | "pointerUp", button? }`,
/// `{ type: "scroll", deltaY }`, `{ type: "keyDown" | "keyUp", key, text? }`.
pub(crate) fn raw_input(win: u32, p: &Value) -> Result<ShellEvent, ErrorBody> {
    let s = |k: &str| p.get(k).and_then(Value::as_str);
    let button = || s("button").map_or(Ok(0), button_code);
    match s("type") {
        Some("pointerMove") => { let (x, y) = point_param(p)?; Ok(ShellEvent::CursorMoved { window_handle: win, x, y }) }
        Some("pointerDown") => Ok(ShellEvent::MouseInput { window_handle: win, button: button()?, pressed: true }),
        Some("pointerUp") => Ok(ShellEvent::MouseInput { window_handle: win, button: button()?, pressed: false }),
        Some("scroll") => {
            let dy = p.get("deltaY").and_then(Value::as_f64).ok_or_else(|| ErrorBody::invalid_params("deltaY is required"))?;
            Ok(ShellEvent::Scroll { window_handle: win, delta_y: dy as f32 })
        }
        Some(t @ ("keyDown" | "keyUp")) => {
            let key = s("key").ok_or_else(|| ErrorBody::invalid_params("key is required"))?;
            let pressed = t == "keyDown";
            Ok(ShellEvent::KeyInput {
                window_handle: win, key: key.into(), pressed,
                text: if pressed { s("text").map(str::to_string) } else { None },
            })
        }
        _ => Err(ErrorBody::invalid_params("type is pointerMove, pointerDown, pointerUp, scroll, keyDown or keyUp")),
    }
}

/// `$GLYX_DEVTOOLS_FILE`, else `<temp>/glyx-devtools/<pid>.json`.
fn discovery_path() -> std::path::PathBuf {
    if let Ok(p) = std::env::var("GLYX_DEVTOOLS_FILE") {
        if !p.trim().is_empty() { return p.into(); }
    }
    std::env::temp_dir().join("glyx-devtools").join(format!("{}.json", std::process::id()))
}

fn window_list(windows: &HashMap<u32, PerWindowState>) -> Vec<WindowInfo> {
    let main = windows.keys().min().copied();
    let mut list: Vec<WindowInfo> = windows.iter().map(|(&id, s)| {
        let size = s.window.inner_size();
        WindowInfo { window_id: id, title: s.window.title(), width: size.width, height: size.height, main: Some(id) == main }
    }).collect();
    list.sort_by_key(|w| w.window_id);
    list
}

/// The requested window, or the main (first-opened) one.
fn target_window(requested: Option<u32>, windows: &HashMap<u32, PerWindowState>) -> Result<u32, ErrorBody> {
    pick_window(requested, windows.keys().copied())
}

pub(crate) fn pick_window(requested: Option<u32>, open: impl Iterator<Item = u32>) -> Result<u32, ErrorBody> {
    let open: Vec<u32> = open.collect();
    match requested {
        Some(id) if open.contains(&id) => Ok(id),
        Some(id) => Err(ErrorBody::new(codes::NO_SUCH_WINDOW, format!("no window {id}"))),
        None => open.into_iter().min().ok_or_else(|| ErrorBody::new(codes::NO_SUCH_WINDOW, "no windows open")),
    }
}

/// Wrap a snippet so its completion value comes back as JSON on both
/// engines: indirect `eval` runs it at global scope (statements allowed,
/// like a console), then the value is described as `{ type, value?,
/// description }`. Values JSON can't hold (functions, cycles, `undefined`)
/// get only the description.
pub(crate) fn evaluate_source(expr: &str) -> String {
    let src = serde_json::to_string(expr).unwrap_or_else(|_| "\"\"".into());
    format!(
        "(function(){{var r=(0,eval)({src});var o={{type:r===null?'null':Array.isArray(r)?'array':typeof r}};\
         try{{var j=JSON.stringify(r);if(j!==undefined)o.value=JSON.parse(j);}}catch(e){{}}\
         try{{o.description=String(r);}}catch(e){{o.description=o.type;}}return JSON.stringify(o);}})()"
    )
}

pub(crate) fn parse_evaluate_result(out: &str) -> Result<Value, ErrorBody> {
    serde_json::from_str(out).map_err(|e| ErrorBody::new(codes::INTERNAL, format!("unreadable evaluate result: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requests_go_to_the_named_window_or_the_main_one() {
        assert_eq!(pick_window(None, [3, 1, 2].into_iter()), Ok(1));
        assert_eq!(pick_window(Some(2), [3, 1, 2].into_iter()), Ok(2));
        assert_eq!(pick_window(Some(9), [1].into_iter()).unwrap_err().code, codes::NO_SUCH_WINDOW);
        assert_eq!(pick_window(None, std::iter::empty()).unwrap_err().code, codes::NO_SUCH_WINDOW);
    }

    #[test]
    fn the_evaluate_wrapper_embeds_the_snippet_as_a_string_literal() {
        let src = evaluate_source("\"quoted\" + '\\n' </script>");
        assert!(src.contains(r#"(0,eval)("\"quoted\" + '\\n' </script>")"#), "{src}");
        let v = parse_evaluate_result(r#"{"type":"number","value":2,"description":"2"}"#).unwrap();
        assert_eq!(v["value"], 2);
        assert_eq!(parse_evaluate_result("nope").unwrap_err().code, codes::INTERNAL);
    }

    #[test]
    fn raw_input_builds_each_event_type_and_rejects_bad_ones() {
        assert!(matches!(raw_input(1, &json!({"type": "pointerMove", "x": 3, "y": 4})),
            Ok(ShellEvent::CursorMoved { window_handle: 1, x, y }) if x == 3.0 && y == 4.0));
        assert!(matches!(raw_input(1, &json!({"type": "pointerDown", "button": "right"})),
            Ok(ShellEvent::MouseInput { button: 1, pressed: true, .. })));
        assert!(matches!(raw_input(1, &json!({"type": "keyDown", "key": "KeyA", "text": "a"})),
            Ok(ShellEvent::KeyInput { pressed: true, ref text, .. }) if text.as_deref() == Some("a")));
        assert!(matches!(raw_input(1, &json!({"type": "keyUp", "key": "KeyA", "text": "a"})),
            Ok(ShellEvent::KeyInput { pressed: false, text: None, .. })));
        for bad in [json!({}), json!({"type": "pointerMove"}), json!({"type": "pointerDown", "button": "side"}), json!({"type": "keyDown"})] {
            assert_eq!(raw_input(1, &bad).unwrap_err().code, codes::INVALID_PARAMS, "{bad}");
        }
    }

    #[test]
    fn the_handshake_lists_every_method_this_module_answers() {
        for m in ["Runtime.handshake", "Runtime.evaluate", "Console.enable", "Inspector.getTree",
                  "Automation.click", "Automation.screenshot", "Automation.waitFor",
                  "Inspector.getAccessibilityTree", "Inspector.highlightNode", "Inspector.setNodeProp",
                  "Inspector.getLayout", "Inspector.enableDamage"] {
            assert!(METHODS.contains(&m), "{m}");
        }
        assert_eq!(EVENTS, ["Console.messageAdded", "Inspector.frameDamage"]);
    }
}
