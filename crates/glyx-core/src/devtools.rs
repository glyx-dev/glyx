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
use crate::devtools_perf as perf;
use crate::devtools_inspect::{Condition, Query};
use crate::state::{PerWindowState, Present};

/// Every method answered here, as listed in the handshake.
pub(crate) const METHODS: &[&str] = &[
    "Runtime.handshake", "Runtime.ping", "Runtime.version", "Runtime.windows", "Runtime.evaluate",
    "Runtime.getCapabilities",
    "Console.enable", "Console.disable", "Console.getMessages", "Console.clear",
    "Inspector.getTree", "Inspector.getNode", "Inspector.getLayout", "Inspector.selectElement",
    "Inspector.getAccessibilityTree", "Inspector.highlightNode", "Inspector.setNodeProp",
    "Inspector.enableDamage", "Inspector.disableDamage",
    "Inspector.setInspectMode", "Inspector.enableTreeEvents", "Inspector.disableTreeEvents",
    "Inspector.auditAccessibility", "Inspector.setOverlay", "Inspector.getLayoutDetails",
    "Automation.findNodes", "Automation.click", "Automation.type", "Automation.press",
    "Automation.scroll", "Automation.dispatchInput", "Automation.screenshot", "Automation.waitFor",
    "Performance.snapshot", "Performance.getBudget", "Performance.setBudget",
    "Performance.getViolations", "Performance.getLeakWarnings",
    "Performance.enableFrames", "Performance.disableFrames", "Performance.getFrameDetail",
    "Animation.list", "Animation.enable", "Animation.disable", "Animation.waitForSettled",
    "Animation.setPlaybackRate", "Animation.seek", "Animation.getPlayback",
    "Memory.sample", "Memory.collectGarbage", "Memory.snapshot",
    "Network.enable", "Network.disable", "Network.getRequests", "Network.getRequest", "Network.clear",
    "Profiler.getStatus", "Profiler.start", "Profiler.stop",
];
pub(crate) const EVENTS: &[&str] = &[
    "Console.messageAdded", "Inspector.frameDamage", "Performance.frame",
    "Inspector.nodePicked", "Inspector.inspectModeChanged", "Inspector.treeChanged",
    "Animation.started", "Animation.ended", "Animation.settled",
    "Network.requestUpdated",
];

/// Responses that name nodes get each node's React component added.
const NAMED: &[&str] = &["Inspector.getLayoutDetails", "Inspector.getTree", "Inspector.getNode", "Inspector.selectElement", "Automation.findNodes", "Inspector.auditAccessibility", "Animation.list"];

pub(crate) const ENGINE: &str = if cfg!(feature = "v8") { "V8" } else { "QuickJS" };

/// Console messages kept for `Console.getMessages`.
const CONSOLE_BACKLOG: usize = 1000;

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
    /// `Animation.waitForSettled`: done when nothing animates (query unused).
    settle: bool,
    deadline: Instant,
}

/// The name the app bundle is evaluated under while devtools is on, so
/// profiles can tell its frames from console snippets.
pub(crate) const BUNDLE_URL: &str = "glyx://app/bundle.js";

/// The current bundle's inline source map (base64 JSON), for mapping
/// profile frames back to source files.
static BUNDLE_SOURCE_MAP: Mutex<Option<Arc<str>>> = Mutex::new(None);

/// With devtools on: remember `js`'s inline source map and name the script.
/// Otherwise `js` is evaluated as is.
pub(crate) fn prepare_bundle(js: &str) -> std::borrow::Cow<'_, str> {
    if std::env::var_os("GLYX_DEVTOOLS_PORT").is_none() { return js.into(); }
    const MARK: &str = "//# sourceMappingURL=data:application/json;base64,";
    let map = js.rfind(MARK).map(|i| Arc::<str>::from(js[i + MARK.len()..].trim_end()));
    *BUNDLE_SOURCE_MAP.lock() = map;
    format!("{js}
//# sourceURL={BUNDLE_URL}
").into()
}

/// The app bundle's original files `(path, content)`, from its source map.
fn bundle_sources() -> Vec<(String, String)> {
    let Some(b64) = BUNDLE_SOURCE_MAP.lock().clone() else { return Vec::new() };
    let Ok(bytes) = base64::engine::general_purpose::STANDARD.decode(b64.as_bytes()) else { return Vec::new() };
    let Ok(map) = serde_json::from_slice::<Value>(&bytes) else { return Vec::new() };
    let (Some(sources), Some(contents)) = (map["sources"].as_array(), map["sourcesContent"].as_array()) else { return Vec::new() };
    sources.iter().zip(contents)
        .filter_map(|(s, c)| Some((s.as_str()?.to_string(), c.as_str()?.to_string())))
        .collect()
}

/// `Runtime.getCapabilities`: granted, possibly missing, and refused.
fn capability_report() -> Value {
    let caps = glyx_security::get();
    let configured = serde_json::to_value(caps).unwrap_or(Value::Null);
    let sources = bundle_sources();
    let app_files = sources.iter().filter(|(p, _)| crate::devtools_caps::is_app_source(p)).count();
    let findings = crate::devtools_caps::findings(&sources, &configured, |h| caps.would_allow_network(h));
    json!({
        "configured": configured,
        "mayBreak": findings,
        "denied": glyx_security::denials(),
        "scanned": { "available": !sources.is_empty(), "appFiles": app_files },
    })
}

/// The bundle's source map as JSON, if it has one.
fn bundle_source_map() -> Option<Value> {
    let b64 = BUNDLE_SOURCE_MAP.lock().clone()?;
    let bytes = base64::engine::general_purpose::STANDARD.decode(b64.as_bytes()).ok()?;
    let mut map: Value = serde_json::from_slice(&bytes).ok()?;
    // Only positions matter to the profiler; the sources can be large.
    if let Some(o) = map.as_object_mut() { o.remove("sourcesContent"); }
    Some(map)
}

/// `Automation.screenshot` on a GPU renderer: say exactly how to get one.
/// (Reading frames back from the GPU is planned; today only the CPU
/// renderer keeps the last frame in memory.)
fn screenshot_unsupported(present: &Present) -> ErrorBody {
    screenshot_error(match present {
        Present::Gpu(_) => "gpu",
        #[cfg(target_os = "windows")]
        Present::Direct2D(_) => "direct2d",
        Present::Soft(_) => "cpu",
    })
}

fn screenshot_error(renderer: &str) -> ErrorBody {
    ErrorBody::new(codes::UNSUPPORTED, format!(
        "Screenshots need the CPU renderer, and this app is running on the {renderer} renderer.          Restart it with GLYX_CPU_RENDER=1 set: `GLYX_CPU_RENDER=1 glyx dev --devtools`          (PowerShell: `$env:GLYX_CPU_RENDER=1; glyx dev --devtools`). Everything else works on any renderer."
    )).with_data(json!({
        "reason": "rendererNotSupported",
        "renderer": renderer,
        "fix": {
            "env": { "GLYX_CPU_RENDER": "1" },
            "restart": true,
            "command": "GLYX_CPU_RENDER=1 glyx dev --devtools",
            "powershell": "$env:GLYX_CPU_RENDER=1; glyx dev --devtools",
        },
    }))
}

/// A CPU profile being recorded.
struct Profiling {
    owner: ConnId,
    window: u32,
    started: Instant,
    /// Whether the engine's JS sampler is running (V8); why not, if not.
    sampling: Result<(), String>,
}

/// JS for the component-render recorder (see `@glyx/react`'s devProfile.js).
const PROFILE_START_JS: &str = "(typeof __glyx_devProfileStart === 'function') ? __glyx_devProfileStart() : false";
const PROFILE_STOP_JS: &str = "(typeof __glyx_devProfileStop === 'function') ? __glyx_devProfileStop() : null";

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
    /// The console feed. Subscribed for the whole devtools session (dev
    /// builds with devtools on only), so the Console can show what was logged
    /// before it opened.
    logs: Option<Receiver<LogEntry>>,
    /// The last `CONSOLE_BACKLOG` messages, numbered.
    backlog: std::collections::VecDeque<(u64, LogEntry)>,
    log_seq: u64,
    /// Clients that sent `Network.enable`.
    network: HashSet<ConnId>,
    /// The network feed, subscribed for the whole session like the console,
    /// and the requests it has reported.
    net_rx: Option<Receiver<glyx_runtime::net_bus::NetEvent>>,
    net: crate::devtools_net::NetLog,
    /// The recording in progress, if any (one at a time).
    profiling: Option<Profiling>,
    /// Delivers synthetic input through the event loop, the same path real
    /// input takes.
    proxy: Mutex<EventLoopProxy<GlyxUserEvent>>,
    waits: Vec<Wait>,
    /// Clients that sent `Inspector.enableDamage`.
    damage: HashSet<ConnId>,
    /// Clients that sent `Performance.enableFrames`, and the last frame
    /// streamed per window.
    frames: HashSet<ConnId>,
    frames_sent: HashMap<u32, u64>,
    /// Clients that sent `Animation.enable`, and each window's running
    /// motion at the last look.
    anim: HashSet<ConnId>,
    anim_prev: HashMap<u32, HashSet<perf::MotionKey>>,
    /// Clients that turned select mode on (they get its events; when the
    /// last one leaves, select mode is switched off so the app gets its
    /// clicks back).
    inspecting: HashSet<ConnId>,
    /// Who set the current highlight; cleared if they disconnect.
    highlight_owner: Option<ConnId>,
    /// Clients that sent `Inspector.enableTreeEvents`, and the tree version
    /// last announced per window.
    tree_subs: HashSet<ConnId>,
    tree_sent: HashMap<u32, u64>,
    /// Handed to windows while any stream is subscribed; wakes the loop.
    notify: Arc<dyn Fn() + Send + Sync>,
    /// Clients that turned paint flashing on (off when the last leaves).
    overlay_conns: HashSet<ConnId>,
    /// Clients streaming frames with detail (frame details kept meanwhile).
    frame_detail_conns: HashSet<ConnId>,
    /// Who changed the motion clock's rate; back to 1x when they leave.
    playback_owner: Option<ConnId>,
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
        let notify_proxy = Mutex::new(proxy.clone());
        let notify: Arc<dyn Fn() + Send + Sync> = Arc::new(move || { let _ = notify_proxy.lock().send_event(GlyxUserEvent::Wake); });
        // The port is only a preference: the discovery file carries the real
        // one, so a second app (the default port taken) takes any free port.
        let server = match DevtoolsServer::start(handle, port, token.clone(), wake.clone())
            .or_else(|e| if port != 0 && e.kind() == std::io::ErrorKind::AddrInUse {
                let s = DevtoolsServer::start(handle, 0, token.clone(), wake)?;
                log::info!("[GDP] port {port} is taken (another app?); using {} instead", s.port());
                Ok(s)
            } else { Err(e) })
        {
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
        // Owner-only: the token is full control of the app.
        match glyx_devtools::write_private(&file, &serde_json::to_string_pretty(&info).unwrap_or_default()) {
            Ok(()) => log::info!("[GDP] devtools on ws://127.0.0.1:{port}/ (token in {})", file.display()),
            Err(e) => log::warn!("[GDP] devtools on ws://127.0.0.1:{port}/; could not write {}: {e}", file.display()),
        }
        Some(Self {
            server, console: HashSet::new(), logs: Some(log_bus::subscribe()),
            backlog: std::collections::VecDeque::new(), log_seq: 0,
            network: HashSet::new(), net_rx: Some(glyx_runtime::net_bus::subscribe()), net: Default::default(),
            profiling: None,
            proxy: Mutex::new(proxy), waits: Vec::new(), damage: HashSet::new(),
            frames: HashSet::new(), frames_sent: HashMap::new(),
            anim: HashSet::new(), anim_prev: HashMap::new(),
            inspecting: HashSet::new(), highlight_owner: None,
            tree_subs: HashSet::new(), tree_sent: HashMap::new(), notify: { glyx_runtime::net_bus::set_waker(Arc::clone(&notify)); notify },
            overlay_conns: HashSet::new(), frame_detail_conns: HashSet::new(), playback_owner: None,
            auto_id_cache_threshold: std::env::var("GLYX_DEVTOOLS_AUTOID_CACHE_THRESHOLD").ok()
                .and_then(|v| v.trim().parse().ok()).unwrap_or(DEFAULT_AUTO_ID_CACHE_THRESHOLD),
            tick_scheduled: Arc::new(AtomicBool::new(false)), tokio: handle.clone(),
        })
    }

    /// Answer queued requests, settle waits, and forward console output.
    pub(crate) fn pump(&mut self, windows: &mut HashMap<u32, PerWindowState>) {
        for conn in self.server.take_closed() {
            self.console.remove(&conn);
            self.network.remove(&conn);
            // Don't leave the app sampling for a client that's gone.
            if self.profiling.as_ref().is_some_and(|p| p.owner == conn) {
                if let Some(p) = self.profiling.take() {
                    if let Some(s) = windows.get_mut(&p.window) {
                        if p.sampling.is_ok() { let _ = s.runtime.profile_stop(); }
                        let _ = s.runtime.eval(PROFILE_STOP_JS);
                    }
                }
            }
            self.damage.remove(&conn);
            self.frames.remove(&conn);
            self.anim.remove(&conn);
            self.tree_subs.remove(&conn);
            self.waits.retain(|w| w.conn != conn);
            if self.inspecting.remove(&conn) && self.inspecting.is_empty() {
                set_inspect_mode(windows, false);
            }
            if self.overlay_conns.remove(&conn) && self.overlay_conns.is_empty() {
                for s in windows.values_mut() { s.paint_flash = false; }
            }
            if self.frame_detail_conns.remove(&conn) && self.frame_detail_conns.is_empty() {
                for s in windows.values_mut() { s.frame_details = None; }
            }
            // Never leave the app in slow motion or paused.
            if self.playback_owner == Some(conn) {
                self.playback_owner = None;
                for s in windows.values_mut() { s.motion_clock.set_rate(1.0); s.window.request_redraw(); }
            }
            if self.highlight_owner == Some(conn) {
                self.highlight_owner = None;
                for s in windows.values_mut() {
                    if s.devtools_highlight.take().is_some() { s.window.request_redraw(); }
                }
            }
        }
        // Before answering, so `Network.getRequests` sees everything the app
        // has sent so far.
        self.drain_network();
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
        self.forward_frames(windows);
        self.forward_motion(windows);
        self.forward_inspect(windows);
        self.forward_tree(windows);
        // Streams need a wake-up after changes that happen mid-redraw.
        let streaming = !(self.tree_subs.is_empty() && self.frames.is_empty() && self.anim.is_empty() && self.damage.is_empty());
        for s in windows.values_mut() {
            if streaming != s.devtools_notify.is_some() {
                s.devtools_notify = streaming.then(|| Arc::clone(&self.notify));
            }
        }
        if let Some(rx) = &self.logs {
            for e in rx.try_iter() {
                self.log_seq += 1;
                let params = json!({ "seq": self.log_seq, "level": e.level, "text": e.text, "timestamp": e.timestamp_ms });
                for &c in &self.console {
                    self.server.send_event(c, "Console.messageAdded", e.window_id, params.clone());
                }
                if self.backlog.len() == CONSOLE_BACKLOG { self.backlog.pop_front(); }
                self.backlog.push_back((self.log_seq, e));
            }
        }
        self.drain_network();
    }

    /// Fold new network events into the request list and stream the changes.
    fn drain_network(&mut self) {
        let Some(rx) = &self.net_rx else { return };
        glyx_runtime::net_bus::drained();
        for e in rx.try_iter() {
            let Some(summary) = self.net.apply(e.window_id, &e.json) else { continue };
            for &c in &self.network {
                self.server.send_event(c, "Network.requestUpdated", e.window_id, summary.clone());
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
            if w.settle {
                if perf::running_motion(s).is_empty() {
                    server.respond(w.conn, &w.id, Ok(json!({ "settled": true })));
                    return false;
                }
                if now >= w.deadline {
                    server.respond(w.conn, &w.id, Err(ErrorBody::new(codes::TIMEOUT, "still animating")));
                    return false;
                }
                return true;
            }
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

    /// Select-mode picks and cancels → `Inspector.nodePicked` /
    /// `inspectModeChanged` to the clients inspecting. A pick ends select
    /// mode (like browser devtools); the picked element stays outlined.
    fn forward_inspect(&mut self, windows: &mut HashMap<u32, PerWindowState>) {
        // (window, picked element or None for a cancel)
        let mut ends: Vec<(u32, Option<u32>)> = Vec::new();
        for (&win, s) in windows.iter_mut() {
            for e in std::mem::take(&mut s.inspect_events) {
                match e {
                    crate::state::InspectEvent::Picked(id) => {
                        let mut node = inspect::node_summary(s, id);
                        node["path"] = json!(inspect::path_to(&s.js_nodes, id));
                        add_node_info(s, &mut node, self.auto_id_cache_threshold);
                        for &c in &self.inspecting { self.server.send_event(c, "Inspector.nodePicked", Some(win), node.clone()); }
                        ends.push((win, Some(id)));
                    }
                    crate::state::InspectEvent::Cancelled => ends.push((win, None)),
                }
            }
        }
        let Some(&(win, picked)) = ends.last() else { return };
        let params = json!({ "enabled": false, "reason": if picked.is_some() { "picked" } else { "cancelled" } });
        for &c in &self.inspecting { self.server.send_event(c, "Inspector.inspectModeChanged", Some(win), params.clone()); }
        // Select mode is over for everyone: forget who asked, or a later
        // request + disconnect by someone else would leave it on (the app
        // would keep swallowing clicks).
        self.inspecting.clear();
        set_inspect_mode(windows, false);
        // Keep the picked element outlined, as browser devtools do.
        if let (Some(id), Some(s)) = (picked, windows.get_mut(&win)) {
            s.devtools_highlight = Some(id);
            s.window.request_redraw();
        }
    }

    /// `Inspector.treeChanged` when a window's element tree changed since the
    /// last announcement (at most once per pump, so once per frame).
    fn forward_tree(&mut self, windows: &HashMap<u32, PerWindowState>) {
        if self.tree_subs.is_empty() { self.tree_sent.clear(); return; }
        for (&win, s) in windows {
            let sent = self.tree_sent.entry(win).or_insert(s.tree_version);
            if *sent != s.tree_version {
                *sent = s.tree_version;
                let params = json!({ "version": s.tree_version });
                for &c in &self.tree_subs { self.server.send_event(c, "Inspector.treeChanged", Some(win), params.clone()); }
            }
        }
    }

    /// `Performance.frame` for every frame recorded since the last pump.
    fn forward_frames(&mut self, windows: &HashMap<u32, PerWindowState>) {
        if self.frames.is_empty() { self.frames_sent.clear(); return; }
        for (&win, s) in windows {
            let p = s.perf.lock();
            let sent = self.frames_sent.entry(win).or_insert(p.frame_seq);
            let new = (p.frame_seq - *sent).min(p.ring.len() as u64) as usize;
            let skip = p.ring.len() - new;
            for (i, f) in p.ring.iter().skip(skip).enumerate() {
                let mut params = perf::frame_json(f);
                params["seq"] = json!(*sent + 1 + i as u64);
                for &c in &self.frames {
                    self.server.send_event(c, "Performance.frame", Some(win), params.clone());
                }
            }
            *sent = p.frame_seq;
        }
    }

    /// Animation.started / ended / settled from the running-motion diff.
    fn forward_motion(&mut self, windows: &HashMap<u32, PerWindowState>) {
        if self.anim.is_empty() { self.anim_prev.clear(); return; }
        for (&win, s) in windows {
            let now = perf::running_motion(s);
            let prev = self.anim_prev.entry(win).or_default();
            let changes = perf::diff_motion(prev, &now);
            let send = |name: &str, params: Value| {
                for &c in &self.anim { self.server.send_event(c, name, Some(win), params.clone()); }
            };
            for (k, info) in &changes.started { send("Animation.started", perf::motion_json(k, info)); }
            for k in &changes.ended { send("Animation.ended", json!({ "nodeId": k.node, "kind": k.kind })); }
            if changes.settled { send("Animation.settled", json!({})); }
            *prev = now.into_keys().collect();
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
            ("Runtime", "getCapabilities") => Ok(capability_report()).into(),
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
                // `$0` = the element selected in the DevTools Inspector (its
                // live React side: props, component), like browser devtools.
                if let Some(node) = p.get("selectedNodeId").and_then(Value::as_u64) {
                    let _ = s.runtime.eval(&format!(
                        "globalThis.$0 = (typeof __glyx_devNode === 'function') ? __glyx_devNode({node}) : undefined;"));
                }
                let out = s.runtime.eval(&evaluate_source_with_preview(expr))
                    .map_err(|e| ErrorBody::new(codes::EVAL_FAILED, e.to_string()))?;
                // Promise continuations and React commits scheduled by the
                // snippet run now; a redraw applies any UI change it made.
                s.runtime.flush_microtasks();
                s.window.request_redraw();
                parse_evaluate_result(&out)
            })().into(),
            ("Console", "enable") => {
                self.console.insert(conn);
                Ok(json!({})).into()
            }
            ("Console", "getMessages") => {
                let since = p.get("since").and_then(Value::as_u64).unwrap_or(0);
                let messages: Vec<Value> = self.backlog.iter().filter(|(n, _)| *n > since).map(|(n, e)| json!({
                    "seq": n, "level": e.level, "text": e.text, "timestamp": e.timestamp_ms, "windowId": e.window_id,
                })).collect();
                Ok(json!({ "messages": messages, "lastSeq": self.log_seq })).into()
            }
            ("Console", "clear") => {
                self.backlog.clear();
                Ok(json!({ "lastSeq": self.log_seq })).into()
            }
            ("Profiler", "getStatus") => Ok(json!({
                "engine": ENGINE,
                "jsSampling": cfg!(feature = "v8"),
                "recording": self.profiling.as_ref().map(|p| json!({ "windowId": p.window, "elapsedMs": p.started.elapsed().as_millis() as u64 })),
            })).into(),
            ("Profiler", "start") => (|| {
                if self.profiling.is_some() {
                    return Err(ErrorBody::new(codes::INVALID_PARAMS, "already recording (stop it first)"));
                }
                let win = target_window(req.window_id, windows)?;
                let s = windows.get_mut(&win).expect("target_window checked it");
                let interval = p.get("intervalUs").and_then(Value::as_u64).unwrap_or(250).clamp(50, 100_000) as u32;
                let sampling = s.runtime.profile_start(interval);
                let components = s.runtime.eval(&evaluate_source(PROFILE_START_JS)).ok()
                    .and_then(|o| parse_evaluate_result(&o).ok())
                    .and_then(|v| v.get("value").and_then(Value::as_bool)).unwrap_or(false);
                let out = json!({
                    "jsSampling": sampling.is_ok(), "jsSamplingError": sampling.as_ref().err(),
                    "components": components, "engine": ENGINE,
                });
                self.profiling = Some(Profiling { owner: conn, window: win, started: Instant::now(), sampling });
                Ok(out)
            })().into(),
            ("Profiler", "stop") => (|| {
                let Some(prof) = self.profiling.take() else {
                    return Err(ErrorBody::new(codes::INVALID_PARAMS, "not recording"));
                };
                let s = windows.get_mut(&prof.window)
                    .ok_or_else(|| ErrorBody::new(codes::NO_SUCH_WINDOW, "the window closed"))?;
                let cpu = match &prof.sampling {
                    Ok(()) => s.runtime.profile_stop().map_err(|e| e.to_string()),
                    Err(e) => Err(e.clone()),
                };
                let components = s.runtime.eval(&evaluate_source(PROFILE_STOP_JS)).ok()
                    .and_then(|o| parse_evaluate_result(&o).ok())
                    .and_then(|v| v.get("value").and_then(Value::as_str).map(str::to_string))
                    .and_then(|j| serde_json::from_str::<Value>(&j).ok())
                    .unwrap_or(Value::Null);
                Ok(json!({
                    "engine": ENGINE, "windowId": prof.window,
                    "durationMs": prof.started.elapsed().as_secs_f64() * 1000.0,
                    "cpuProfile": cpu.as_ref().ok(), "jsSamplingError": cpu.as_ref().err(),
                    "components": components,
                    // For mapping bundle frames to source files (V8 profiles).
                    "bundleUrl": BUNDLE_URL,
                    "sourceMap": if cpu.is_ok() { bundle_source_map() } else { None },
                }))
            })().into(),
            ("Network", "enable") => {
                self.network.insert(conn);
                Ok(json!({})).into()
            }
            ("Network", "disable") => {
                self.network.remove(&conn);
                Ok(json!({})).into()
            }
            ("Network", "getRequests") => {
                let since = p.get("since").and_then(Value::as_u64).unwrap_or(0);
                Ok(json!({ "requests": self.net.list(since), "lastSeq": self.net.last_seq() })).into()
            }
            ("Network", "getRequest") => match p.get("key").and_then(Value::as_str) {
                Some(key) => self.net.detail(key)
                    .ok_or_else(|| ErrorBody::new(codes::INVALID_PARAMS, format!("no request {key:?} (cleared, or too old)"))),
                None => Err(ErrorBody::new(codes::INVALID_PARAMS, "key is required")),
            }.into(),
            ("Network", "clear") => {
                self.net.clear();
                Ok(json!({ "lastSeq": self.net.last_seq() })).into()
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
                self.highlight_owner = id.map(|_| conn);
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
            ("Inspector", "setInspectMode") => {
                let enabled = p.get("enabled").and_then(Value::as_bool).unwrap_or(true);
                if enabled { self.inspecting.insert(conn); } else { self.inspecting.remove(&conn); }
                let on = !self.inspecting.is_empty();
                set_inspect_mode(windows, on);
                Ok(json!({ "enabled": on })).into()
            }
            ("Inspector", "getLayoutDetails") => (|| {
                let s = window(req, windows)?;
                let id = existing_node(s, node_param(p)?)?;
                crate::devtools_layout::layout_details(s, id)
                    .ok_or_else(|| ErrorBody::new(codes::NO_SUCH_NODE, format!("node {id} has no layout")))
            })().into(),
            ("Inspector", "setOverlay") => {
                let on = p.get("paintFlashing").and_then(Value::as_bool).unwrap_or(false);
                if on { self.overlay_conns.insert(conn); } else { self.overlay_conns.remove(&conn); }
                let any = !self.overlay_conns.is_empty();
                for s in windows.values_mut() {
                    s.paint_flash = any;
                    if !any { s.flashes.clear(); }
                    s.window.request_redraw();
                }
                Ok(json!({ "paintFlashing": any })).into()
            }
            ("Inspector", "enableTreeEvents") => {
                self.tree_subs.insert(conn);
                Ok(json!({})).into()
            }
            ("Inspector", "disableTreeEvents") => {
                self.tree_subs.remove(&conn);
                Ok(json!({})).into()
            }
            ("Inspector", "auditAccessibility") => (|| {
                let s = window(req, windows)?;
                let issues = inspect::audit(&s.js_nodes, s.js_root);
                let count = |sev: &str| issues.iter().filter(|i| i.severity == sev).count();
                Ok(json!({
                    "issues": issues.iter().map(inspect::Issue::json).collect::<Vec<_>>(),
                    "errors": count("error"),
                    "warnings": count("warning"),
                }))
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
            // ── Performance ────────────────────────────────────────────────
            ("Performance", "snapshot") => (|| {
                let s = window(req, windows)?;
                Ok(perf::snapshot_json(&s.perf.lock()))
            })().into(),
            ("Performance", "getBudget") => (|| {
                let s = window(req, windows)?;
                Ok(json!({ "budgetMs": s.perf.lock().budget_ms }))
            })().into(),
            ("Performance", "setBudget") => (|| {
                let ms = p.get("ms").and_then(Value::as_f64).filter(|m| *m > 0.0 && m.is_finite())
                    .ok_or_else(|| ErrorBody::invalid_params("ms (positive number, e.g. 16.667) is required"))?;
                let s = window(req, windows)?;
                s.perf.lock().budget_ms = ms;
                Ok(json!({ "budgetMs": ms }))
            })().into(),
            ("Performance", "getViolations") | ("Performance", "getLeakWarnings") => (|| {
                let s = window(req, windows)?;
                let since = p.get("since").and_then(Value::as_u64).unwrap_or(0);
                let kind = if req.method == "getViolations" { "violation" } else { "leak" };
                Ok(perf::history_json(&s.perf.lock(), kind, since))
            })().into(),
            ("Performance", "enableFrames") => {
                self.frames.insert(conn);
                if p.get("detail").and_then(Value::as_bool).unwrap_or(false) {
                    self.frame_detail_conns.insert(conn);
                    for s in windows.values_mut() {
                        if s.frame_details.is_none() { s.frame_details = Some(std::collections::VecDeque::new()); }
                    }
                }
                for s in windows.values() { s.window.request_redraw(); }
                Ok(json!({})).into()
            }
            ("Performance", "disableFrames") => {
                self.frames.remove(&conn);
                if self.frame_detail_conns.remove(&conn) && self.frame_detail_conns.is_empty() {
                    for s in windows.values_mut() { s.frame_details = None; }
                }
                Ok(json!({})).into()
            }
            ("Performance", "getFrameDetail") => (|| {
                let win = target_window(req.window_id, windows)?;
                let seq = p.get("seq").and_then(Value::as_u64)
                    .ok_or_else(|| ErrorBody::invalid_params("seq (a Performance.frame seq) is required"))?;
                let s = windows.get_mut(&win).expect("target_window checked it");
                let Some(details) = s.frame_details.as_ref() else {
                    return Err(ErrorBody::new(codes::UNSUPPORTED, "frame detail is off: call Performance.enableFrames { detail: true }"));
                };
                let Some(d) = details.iter().find(|d| d.seq == seq).cloned() else {
                    return Ok(json!({ "seq": seq, "found": false }));
                };
                let mut dirty: Vec<Value> = d.dirty.iter()
                    .filter(|id| s.js_nodes.contains_key(id))
                    .map(|&id| inspect::node_summary(s, id)).collect();
                let gone = d.dirty.len() - dirty.len();
                let mut v = json!({ "nodes": dirty.split_off(0) });
                add_node_info(s, &mut v, self.auto_id_cache_threshold);
                Ok(json!({
                    "seq": seq, "found": true, "damage": d.damage,
                    "dirty": v["nodes"], "dirtyCount": d.dirty_total, "removedSince": gone,
                }))
            })().into(),

            // ── Animation ──────────────────────────────────────────────────
            ("Animation", "list") => (|| {
                let s = window(req, windows)?;
                Ok(json!({ "running": perf::motion_list(s), "rate": s.motion_clock.rate() }))
            })().into(),
            // ── Memory ─────────────────────────────────────────────────────
            ("Memory", "sample") => (|| {
                let win = target_window(req.window_id, windows)?;
                Ok(memory_sample(windows.get_mut(&win).expect("target_window checked it")))
            })().into(),
            ("Memory", "collectGarbage") => (|| {
                let win = target_window(req.window_id, windows)?;
                let s = windows.get_mut(&win).expect("target_window checked it");
                let before = s.runtime.heap_stats().used_heap_size;
                let t0 = Instant::now();
                s.runtime.gc_hint();
                let ms = t0.elapsed().as_secs_f64() * 1000.0;
                let mut after = memory_sample(s);
                after["heapBefore"] = json!(before);
                after["gcMs"] = json!((ms * 1000.0).round() / 1000.0);
                Ok(after)
            })().into(),
            ("Memory", "snapshot") => (|| {
                let win = target_window(req.window_id, windows)?;
                let s = windows.get_mut(&win).expect("target_window checked it");
                let attached = inspect::attached(&s.js_nodes, s.js_root);
                let mut by_type: std::collections::BTreeMap<&str, usize> = std::collections::BTreeMap::new();
                for id in &attached {
                    if let Some(n) = s.js_nodes.get(id) { *by_type.entry(inspect::type_name(&n.node_type)).or_default() += 1; }
                }
                // Per component, from the React tree (devtools-only JS helper).
                let by_component = s.runtime.eval(&evaluate_source(
                    "(typeof __glyx_devComponentCounts === 'function') ? __glyx_devComponentCounts() : null"))
                    .ok().and_then(|o| parse_evaluate_result(&o).ok()).and_then(|v| v.get("value").cloned())
                    .unwrap_or(Value::Null);
                let mut out = memory_sample(s);
                out["elements"] = json!(attached.len());
                out["detached"] = json!(s.js_nodes.len().saturating_sub(attached.len()));
                out["byType"] = json!(by_type);
                out["byComponent"] = by_component;
                Ok(out)
            })().into(),
            ("Animation", "getPlayback") => (|| {
                let s = window(req, windows)?;
                Ok(json!({ "rate": s.motion_clock.rate(), "paused": s.motion_clock.paused() }))
            })().into(),
            ("Animation", "setPlaybackRate") => (|| {
                let rate = p.get("rate").and_then(Value::as_f64).filter(|r| (0.0..=4.0).contains(r))
                    .ok_or_else(|| ErrorBody::invalid_params("rate is a number from 0 (paused) to 4"))?;
                for s in windows.values_mut() {
                    s.motion_clock.set_rate(rate);
                    s.window.request_redraw();
                }
                self.playback_owner = (rate != 1.0).then_some(conn);
                Ok(json!({ "rate": rate }))
            })().into(),
            ("Animation", "seek") => (|| {
                let by = p.get("byMs").and_then(Value::as_f64).filter(|v| v.is_finite())
                    .ok_or_else(|| ErrorBody::invalid_params("byMs (milliseconds; negative goes back) is required"))?;
                for s in windows.values_mut() {
                    s.motion_clock.seek_by(by);
                    // Paused animations don't request frames: draw the new moment.
                    for id in s.transitions.keys().chain(s.animations.keys()).copied().collect::<Vec<_>>() { s.dirty_nodes.insert(id); }
                    s.window.request_redraw();
                }
                Ok(json!({ "byMs": by }))
            })().into(),
            ("Animation", "enable") => {
                self.anim.insert(conn);
                Ok(json!({})).into()
            }
            ("Animation", "disable") => {
                self.anim.remove(&conn);
                Ok(json!({})).into()
            }
            ("Animation", "waitForSettled") => {
                match target_window(req.window_id, windows) {
                    Err(e) => Reply::Now(Err(e)),
                    Ok(win) => {
                        let timeout = p.get("timeoutMs").and_then(Value::as_u64)
                            .map(Duration::from_millis).unwrap_or(DEFAULT_WAIT).min(MAX_WAIT);
                        self.waits.push(Wait {
                            conn, id: req.id.clone(), window: win, query: Query::default(),
                            condition: Condition::Exists, settle: true, deadline: Instant::now() + timeout,
                        });
                        Reply::Later
                    }
                }
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
                    return Err(screenshot_unsupported(&s.gpu));
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
                        self.waits.push(Wait { conn, id: req.id.clone(), window: win, query, condition, settle: false, deadline: Instant::now() + timeout });
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
/// A live memory reading (doesn't wait for a frame).
fn memory_sample(s: &mut PerWindowState) -> Value {
    let heap = s.runtime.heap_stats();
    let (gpu_buf, gpu_tex, gpu_reserved, _, _) = s.gpu.memory_counters();
    json!({
        "timestamp": std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|d| d.as_millis() as u64).unwrap_or(0),
        "heapUsed": heap.used_heap_size,
        "heapTotal": heap.total_heap_size,
        "rss": s.rss_bytes.load(std::sync::atomic::Ordering::Relaxed),
        "privateBytes": private_working_set(),
        "gpuBuffers": gpu_buf,
        "gpuTextures": gpu_tex,
        "gpuReserved": gpu_reserved,
        "nodes": s.js_nodes.len(),
    })
}

/// Memory only this process uses (Task Manager's "Memory" column): the
/// private working set, without shared DLL / font / mapped-file pages that
/// `rss` (the full working set) includes. None where the OS can't say.
#[cfg(windows)]
fn private_working_set() -> Option<u64> {
    use windows_sys::Win32::System::{ProcessStatus::{K32GetProcessMemoryInfo, PROCESS_MEMORY_COUNTERS}, Threading::GetCurrentProcess};
    // PROCESS_MEMORY_COUNTERS_EX2 (Windows 10 1809+); not in windows-sys 0.59.
    #[repr(C)]
    #[derive(Default)]
    struct CountersEx2 {
        cb: u32, page_fault_count: u32,
        peak_working_set: usize, working_set: usize,
        quota_peak_paged: usize, quota_paged: usize, quota_peak_non_paged: usize, quota_non_paged: usize,
        pagefile: usize, peak_pagefile: usize, private_usage: usize,
        private_working_set: usize, shared_commit: usize,
    }
    let mut c = CountersEx2 { cb: std::mem::size_of::<CountersEx2>() as u32, ..Default::default() };
    // SAFETY: c is a valid, correctly sized EX2 buffer; the pseudo-handle needs no closing.
    let ok = unsafe { K32GetProcessMemoryInfo(GetCurrentProcess(), &mut c as *mut _ as *mut PROCESS_MEMORY_COUNTERS, c.cb) };
    (ok != 0 && c.private_working_set > 0).then_some(c.private_working_set as u64)
}

#[cfg(not(windows))]
fn private_working_set() -> Option<u64> { None }

/// Select mode on or off in every window. Off also clears the hover
/// outline, so the app looks normal again.
fn set_inspect_mode(windows: &mut HashMap<u32, PerWindowState>, on: bool) {
    for s in windows.values_mut() {
        if s.inspect_mode != on {
            s.inspect_mode = on;
            if !on { s.devtools_highlight = None; }
            s.inspect_events.clear();
            s.window.request_redraw();
        }
    }
}

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

/// Structured preview of any JS value, for the DevTools Console: depth- and
/// size-limited, safe with cycles, getters that throw, functions, Maps,
/// Sets, Dates and Errors. Inlined into the evaluated snippet so it works on
/// both engines without the app's JS.
const PREVIEW_JS: &str = r#"function __p(v,d,seen){
 var t=typeof v;
 if(v===null)return{t:'null',v:'null'};
 if(t==='undefined')return{t:'undefined',v:'undefined'};
 if(t==='number'||t==='boolean'||t==='bigint')return{t:t,v:String(v)};
 if(t==='string')return{t:'string',v:v.length>2000?v.slice(0,2000)+'…':v};
 if(t==='symbol')return{t:'symbol',v:String(v)};
 if(t==='function'){var s='';try{s=Function.prototype.toString.call(v).slice(0,120)}catch(e){}return{t:'function',v:'ƒ '+(v.name||'anonymous')+'()',src:s};}
 if(seen.indexOf(v)>=0)return{t:'circular',v:'[Circular]'};
 if(v instanceof Error)return{t:'error',v:String(v.stack||v)};
 if(v instanceof Date)return{t:'date',v:isNaN(v)?'Invalid Date':v.toISOString()};
 var ctor='Object';try{ctor=(v.constructor&&v.constructor.name)||'Object'}catch(e){}
 if(d>=3){var n0=0;try{n0=Array.isArray(v)?v.length:Object.keys(v).length}catch(e){}return{t:Array.isArray(v)?'array':'object',ctor:ctor,n:n0,collapsed:true};}
 seen=seen.concat([v]);
 var MAX=50,out;
 if(Array.isArray(v)){out=[];for(var i=0;i<Math.min(v.length,MAX);i++)out.push(__p(v[i],d+1,seen));return{t:'array',n:v.length,items:out,more:v.length>MAX};}
 if(typeof Map!=='undefined'&&v instanceof Map){out=[];var k=0;v.forEach(function(val,key){if(k++<MAX)out.push([__p(key,d+1,seen),__p(val,d+1,seen)])});return{t:'map',n:v.size,entries:out,more:v.size>MAX};}
 if(typeof Set!=='undefined'&&v instanceof Set){out=[];var k2=0;v.forEach(function(val){if(k2++<MAX)out.push(__p(val,d+1,seen))});return{t:'set',n:v.size,items:out,more:v.size>MAX};}
 var keys=[];try{keys=Object.keys(v)}catch(e){}
 out=[];for(var j=0;j<Math.min(keys.length,MAX);j++){var val;try{val=__p(v[keys[j]],d+1,seen)}catch(e){val={t:'error',v:'<'+e+'>'}}out.push([keys[j],val]);}
 return{t:'object',ctor:ctor,n:keys.length,entries:out,more:keys.length>MAX};
}"#;

/// `Runtime.evaluate` for people: like `evaluate_source`, plus a structured
/// `preview` of the result (see `PREVIEW_JS`).
pub(crate) fn evaluate_source_with_preview(expr: &str) -> String {
    let src = serde_json::to_string(expr).unwrap_or_else(|_| "\"\"".into());
    format!(
        "(function(){{{PREVIEW_JS}var r=(0,eval)({src});var o={{type:r===null?'null':Array.isArray(r)?'array':typeof r}};\
         try{{var j=JSON.stringify(r);if(j!==undefined)o.value=JSON.parse(j);}}catch(e){{}}\
         try{{o.description=String(r);}}catch(e){{o.description=o.type;}}\
         try{{o.preview=__p(r,0,[]);}}catch(e){{}}return JSON.stringify(o);}})()"
    )
}

pub(crate) fn parse_evaluate_result(out: &str) -> Result<Value, ErrorBody> {
    serde_json::from_str(out).map_err(|e| ErrorBody::new(codes::INTERNAL, format!("unreadable evaluate result: {e}")))
}

#[cfg(test)]
mod tests {
    #[test]
    fn gpu_screenshot_error_says_how_to_fix_it() {
        let e = screenshot_error("gpu");
        assert_eq!(e.code, codes::UNSUPPORTED);
        assert!(e.message.contains("gpu renderer") && e.message.contains("GLYX_CPU_RENDER=1 glyx dev --devtools"), "{}", e.message);
        let d = e.data.expect("machine-readable fix");
        assert_eq!(d["reason"], "rendererNotSupported");
        assert_eq!(d["fix"]["env"]["GLYX_CPU_RENDER"], "1");
    }

    use super::*;

    #[test]
    fn requests_go_to_the_named_window_or_the_main_one() {
        assert_eq!(pick_window(None, [3, 1, 2].into_iter()), Ok(1));
        assert_eq!(pick_window(Some(2), [3, 1, 2].into_iter()), Ok(2));
        assert_eq!(pick_window(Some(9), [1].into_iter()).unwrap_err().code, codes::NO_SUCH_WINDOW);
        assert_eq!(pick_window(None, std::iter::empty()).unwrap_err().code, codes::NO_SUCH_WINDOW);
    }

    #[test]
    fn the_repl_wrapper_adds_a_preview() {
        let src = evaluate_source_with_preview("({ a: 1 })");
        assert!(src.contains("function __p(") && src.contains("o.preview=__p(r,0,[])"), "{src}");
        assert!(src.contains(r#"(0,eval)("({ a: 1 })")"#));
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
        for m in ["Inspector.setInspectMode", "Inspector.auditAccessibility", "Inspector.enableTreeEvents",
                  "Inspector.setOverlay", "Performance.getFrameDetail",
                  "Memory.sample", "Memory.collectGarbage", "Memory.snapshot", "Animation.setPlaybackRate", "Animation.seek", "Animation.getPlayback",
                  "Performance.snapshot", "Performance.setBudget", "Performance.getViolations",
                  "Performance.enableFrames", "Animation.list", "Animation.waitForSettled"] {
            assert!(METHODS.contains(&m), "{m}");
        }
        for e in ["Console.messageAdded", "Inspector.frameDamage", "Performance.frame",
                  "Animation.started", "Animation.ended", "Animation.settled"] {
            assert!(EVENTS.contains(&e), "{e}");
        }
    }
}
