//! The DevTools relay: the local server behind the Glyx DevTools UI (`glyx
//! inspect`).
//!
//! It serves the UI's files over plain HTTP and, on `/relay`, a WebSocket to
//! the UI. It finds running dev apps from their discovery files, connects to
//! the chosen app's GDP server (doing the token handshake itself, so the
//! browser never holds the token), then passes messages through both ways.
//! When the app goes away it keeps the UI connected and reattaches when the
//! app comes back.
//!
//! UI ⇄ relay messages (besides GDP requests, responses and events, which pass
//! through unchanged once attached):
//!
//! - UI → relay: `{type:"hello", secret}` (first, required),
//!   `{type:"attach", key}`, `{type:"detach"}`, `{type:"apps"}`
//! - relay → UI: `{type:"apps", apps:[{key, name, engine, pid, port}]}`,
//!   `{type:"status", state:"connected"|"reconnecting"|"detached"|"error", key?, handshake?, message?}`
//!
//! Security matches GDP: loopback only, web pages from other origins refused,
//! and a per-session secret (in the page URL's fragment) required before
//! anything else.

use std::collections::HashMap;
use std::net::SocketAddr;
use std::path::{Path, PathBuf};
use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::{TcpListener, TcpStream};
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::handshake::derive_accept_key;
use tokio_tungstenite::tungstenite::protocol::Role;
use tokio_tungstenite::tungstenite::Message;
use tokio_tungstenite::WebSocketStream;

use crate::transport::{new_token, origin_allowed};

/// Serves the UI's files: path without the leading `/` (`"index.html"`,
/// `"assets/app.js"`) → body. `None` = 404.
pub type Assets = Arc<dyn Fn(&str) -> Option<Vec<u8>> + Send + Sync>;

pub struct RelayConfig {
    /// `0` picks a free port.
    pub port: u16,
    pub assets: Assets,
    /// Discovery files (`devtools.json`) or directories holding them
    /// (`<temp>/glyx-devtools/`).
    pub discovery: Vec<PathBuf>,
}

pub struct Relay {
    port: u16,
    secret: String,
}

struct Shared {
    assets: Assets,
    discovery: Vec<PathBuf>,
    secret: String,
    /// Identity checks per discovery file: (port, token, pid) → (is that
    /// app, when checked). See `live_apps`.
    verified: parking_lot::Mutex<HashMap<String, (Signature, bool, std::time::Instant)>>,
}

type Signature = (u16, String, u64);

/// How long an identity check stands before it's redone.
const REVERIFY: Duration = Duration::from_secs(10);

/// How often the relay re-reads discovery files and retries a lost app.
const RESCAN: Duration = Duration::from_millis(750);
/// The app's reply to the relay's own handshake.
const HANDSHAKE_ID: &str = "__relay_handshake";

impl Relay {
    pub fn start(handle: &tokio::runtime::Handle, config: RelayConfig) -> std::io::Result<Self> {
        let listener = std::net::TcpListener::bind(("127.0.0.1", config.port))?;
        listener.set_nonblocking(true)?;
        let port = listener.local_addr()?.port();
        let secret = new_token();
        let shared = Arc::new(Shared {
            assets: config.assets, discovery: config.discovery, secret: secret.clone(),
            verified: parking_lot::Mutex::new(HashMap::new()),
        });
        handle.spawn(async move {
            let listener = match TcpListener::from_std(listener) {
                Ok(l) => l,
                Err(e) => { log::error!("[relay] listener: {e}"); return; }
            };
            loop {
                let Ok((stream, peer)) = listener.accept().await else { continue };
                // See transport.rs: no Nagle delay on small frames.
                let _ = stream.set_nodelay(true);
                let shared = Arc::clone(&shared);
                tokio::spawn(async move { serve(stream, peer, shared).await });
            }
        });
        Ok(Self { port, secret })
    }

    pub fn port(&self) -> u16 { self.port }

    /// The page to open: the session secret travels in the fragment, which
    /// browsers never send to the server or put in `Referer`.
    pub fn url(&self) -> String {
        format!("http://127.0.0.1:{}/#s={}", self.port, self.secret)
    }
}

// ── HTTP ────────────────────────────────────────────────────────────────────

pub(crate) struct HttpRequest {
    pub method: String,
    pub path: String,
    pub headers: HashMap<String, String>,
}

/// Parse a request head (`GET /x HTTP/1.1\r\nHeader: v\r\n\r\n`).
pub(crate) fn parse_request(head: &str) -> Option<HttpRequest> {
    let mut lines = head.split("\r\n");
    let mut first = lines.next()?.split_whitespace();
    let method = first.next()?.to_string();
    let path = first.next()?.to_string();
    let headers = lines.filter_map(|l| {
        let (k, v) = l.split_once(':')?;
        Some((k.trim().to_ascii_lowercase(), v.trim().to_string()))
    }).collect();
    Some(HttpRequest { method, path, headers })
}

/// Request path → asset name, or `None` for anything that could escape the
/// asset root.
pub(crate) fn asset_name(path: &str) -> Option<String> {
    let path = path.split(['?', '#']).next().unwrap_or("");
    let name = path.trim_start_matches('/');
    let name = if name.is_empty() { "index.html" } else { name };
    if name.split('/').any(|seg| seg == ".." || seg == "." || seg.contains('\\')) { return None; }
    Some(name.to_string())
}

pub(crate) fn content_type(name: &str) -> &'static str {
    match Path::new(name).extension().and_then(|e| e.to_str()).unwrap_or("") {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json",
        "svg" => "image/svg+xml",
        "png" => "image/png",
        "ico" => "image/x-icon",
        "woff2" => "font/woff2",
        "map" => "application/json",
        _ => "application/octet-stream",
    }
}

async fn serve(mut stream: TcpStream, _peer: SocketAddr, shared: Arc<Shared>) {
    // Read the request head (headers only; UI requests have no body).
    let mut buf = Vec::with_capacity(1024);
    let head = loop {
        let mut chunk = [0u8; 1024];
        let n = match tokio::time::timeout(Duration::from_secs(5), stream.read(&mut chunk)).await {
            Ok(Ok(n)) if n > 0 => n,
            _ => return,
        };
        buf.extend_from_slice(&chunk[..n]);
        if let Some(end) = buf.windows(4).position(|w| w == b"\r\n\r\n") {
            break String::from_utf8_lossy(&buf[..end]).to_string();
        }
        if buf.len() > 16 * 1024 { return; }
    };
    let Some(req) = parse_request(&head) else { return };

    let upgrade = req.headers.get("upgrade").is_some_and(|u| u.eq_ignore_ascii_case("websocket"));
    if upgrade && req.path.split('?').next() == Some("/relay") {
        if !origin_allowed(req.headers.get("origin").map(String::as_str)) {
            log::warn!("[relay] refused connection from origin {:?}", req.headers.get("origin"));
            let _ = stream.write_all(b"HTTP/1.1 403 Forbidden\r\nContent-Length: 0\r\nConnection: close\r\n\r\n").await;
            return;
        }
        let Some(key) = req.headers.get("sec-websocket-key") else { return };
        let accept = derive_accept_key(key.as_bytes());
        let resp = format!("HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: {accept}\r\n\r\n");
        if stream.write_all(resp.as_bytes()).await.is_err() { return; }
        let ws = WebSocketStream::from_raw_socket(stream, Role::Server, None).await;
        session(ws, shared).await;
        return;
    }

    let found = (req.method == "GET" || req.method == "HEAD")
        .then(|| asset_name(&req.path)).flatten()
        .and_then(|name| (shared.assets)(&name).map(|body| (name, body)));
    let resp = match found {
        Some((name, body)) => {
            let mut r = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n",
                content_type(&name), body.len()).into_bytes();
            if req.method == "GET" { r.extend_from_slice(&body); }
            r
        }
        None => b"HTTP/1.1 404 Not Found\r\nContent-Length: 9\r\nConnection: close\r\n\r\nnot found".to_vec(),
    };
    let _ = stream.write_all(&resp).await;
}

// ── Discovery ───────────────────────────────────────────────────────────────

/// A running (or stale) dev app, from its discovery file.
#[derive(Debug, Clone, PartialEq)]
pub struct AppInfo {
    /// The discovery file's path: stable across restarts for `glyx dev`
    /// (`target/glyx/devtools.json`), so the relay reattaches by it.
    pub key: String,
    /// Project folder name, else `pid <n>`.
    pub name: String,
    pub url: String,
    pub port: u16,
    pub token: String,
    pub pid: u64,
    pub engine: String,
}

/// Parse one discovery file.
pub fn read_app(path: &Path) -> Option<AppInfo> {
    let v: Value = serde_json::from_str(&std::fs::read_to_string(path).ok()?).ok()?;
    let port = v.get("port")?.as_u64()? as u16;
    let pid = v.get("pid").and_then(Value::as_u64).unwrap_or(0);
    // <project>/target/glyx/devtools.json → "<project>"
    let project = path.parent().and_then(Path::parent)
        .filter(|p| p.file_name().is_some_and(|n| n == "target"))
        .and_then(Path::parent).and_then(Path::file_name)
        .map(|n| n.to_string_lossy().to_string());
    Some(AppInfo {
        key: path.to_string_lossy().to_string(),
        name: project.unwrap_or_else(|| format!("pid {pid}")),
        url: v.get("url").and_then(Value::as_str).map(str::to_string)
            .unwrap_or_else(|| format!("ws://127.0.0.1:{port}/")),
        port,
        token: v.get("token")?.as_str()?.to_string(),
        pid,
        engine: v.get("engine").and_then(Value::as_str).unwrap_or("").to_string(),
    })
}

/// Every app listed under `paths`, alive or not.
pub fn scan(paths: &[PathBuf]) -> Vec<AppInfo> {
    let mut out = Vec::new();
    for p in paths {
        if p.is_dir() {
            let Ok(dir) = std::fs::read_dir(p) else { continue };
            for e in dir.flatten() {
                let f = e.path();
                if f.extension().is_some_and(|x| x == "json") {
                    out.extend(read_app(&f));
                }
            }
        } else {
            out.extend(read_app(p));
        }
    }
    out.sort_by(|a, b| a.name.cmp(&b.name).then(a.key.cmp(&b.key)));
    out.dedup_by(|a, b| a.key == b.key);
    out
}

/// The apps really running. A discovery file outlives a crashed app, and
/// its port may since belong to a different app, so "the port answers" isn't
/// enough: the app must accept the file's token and report the file's pid.
/// That check is cached per file contents and redone every `REVERIFY`; in
/// between, only the port is probed.
async fn live_apps(shared: &Shared) -> Vec<AppInfo> {
    let mut out: Vec<AppInfo> = Vec::new();
    for app in scan(&shared.discovery) {
        let sig: Signature = (app.port, app.token.clone(), app.pid);
        let cached = shared.verified.lock().get(&app.key).cloned()
            .filter(|(s, _, at)| *s == sig && at.elapsed() < REVERIFY);
        let ok = match cached {
            Some((_, false, _)) => false,
            Some((_, true, _)) => port_answers(app.port).await,
            None => {
                let ok = is_that_app(&app).await;
                shared.verified.lock().insert(app.key.clone(), (sig, ok, std::time::Instant::now()));
                ok
            }
        };
        // Two files for one process (e.g. a copied project): list it once.
        if ok && !out.iter().any(|a| a.port == app.port && a.pid == app.pid) {
            out.push(app);
        }
    }
    out
}

async fn port_answers(port: u16) -> bool {
    let probe = TcpStream::connect(("127.0.0.1", port));
    matches!(tokio::time::timeout(Duration::from_millis(200), probe).await, Ok(Ok(_)))
}

/// Handshake with the file's token; the reported pid must match the file's.
async fn is_that_app(app: &AppInfo) -> bool {
    if !port_answers(app.port).await { return false; }
    match connect_app(app).await {
        Ok((mut ws, hs)) => {
            let _ = ws.close(None).await;
            app.pid == 0 || hs.get("pid").and_then(Value::as_u64) == Some(app.pid)
        }
        Err(_) => false,
    }
}

fn apps_json(apps: &[AppInfo]) -> Value {
    json!({
        "type": "apps",
        "apps": apps.iter().map(|a| json!({
            "key": a.key, "name": a.name, "engine": a.engine, "pid": a.pid, "port": a.port,
        })).collect::<Vec<_>>(),
    })
}

// ── Sessions ────────────────────────────────────────────────────────────────

type UiSocket = WebSocketStream<TcpStream>;
type AppSocket = WebSocketStream<tokio_tungstenite::MaybeTlsStream<TcpStream>>;

/// Connect to an app's GDP server and complete the token handshake.
/// Returns the socket and the handshake result (engine, windows, methods…).
async fn connect_app(app: &AppInfo) -> Result<(AppSocket, Value), String> {
    let (mut ws, _) = tokio::time::timeout(Duration::from_secs(3),
        tokio_tungstenite::connect_async_with_config(&app.url, None, /* disable_nagle */ true)).await
        .map_err(|_| "timed out connecting".to_string())?
        .map_err(|e| format!("could not connect: {e}"))?;
    let hs = json!({ "id": HANDSHAKE_ID, "domain": "Runtime", "method": "handshake", "params": { "token": app.token } });
    ws.send(Message::Text(hs.to_string())).await.map_err(|e| e.to_string())?;
    let reply = tokio::time::timeout(Duration::from_secs(3), async {
        while let Some(Ok(msg)) = ws.next().await {
            if let Message::Text(t) = msg {
                let v: Value = serde_json::from_str(&t).unwrap_or(Value::Null);
                if v.get("id").and_then(Value::as_str) == Some(HANDSHAKE_ID) { return Some(v); }
            }
        }
        None
    }).await.map_err(|_| "no handshake reply".to_string())?
        .ok_or_else(|| "the app closed the connection".to_string())?;
    match (reply.get("result"), reply.get("error")) {
        (Some(r), _) => Ok((ws, r.clone())),
        (_, Some(e)) => Err(format!("handshake refused: {}", e.get("message").and_then(Value::as_str).unwrap_or("?"))),
        _ => Err("malformed handshake reply".into()),
    }
}

/// From the app's socket: a message, or the socket closing.
enum FromApp { Text(String), Closed }

async fn session(ws: UiSocket, shared: Arc<Shared>) {
    let (mut ui_tx, mut ui_rx) = ws.split();

    // The secret first, within 10 s.
    let hello = tokio::time::timeout(Duration::from_secs(10), ui_rx.next()).await;
    let ok = match hello {
        Ok(Some(Ok(Message::Text(t)))) => serde_json::from_str::<Value>(&t).ok()
            .filter(|v| v.get("type").and_then(Value::as_str) == Some("hello"))
            .and_then(|v| v.get("secret").and_then(Value::as_str).map(|s| s == shared.secret))
            .unwrap_or(false),
        _ => false,
    };
    if !ok {
        let _ = ui_tx.send(Message::Text(json!({ "type": "status", "state": "error", "message": "wrong or missing session secret" }).to_string())).await;
        let _ = ui_tx.close().await;
        return;
    }

    let send = |v: Value| Message::Text(v.to_string());
    let mut apps = live_apps(&shared).await;
    if ui_tx.send(send(apps_json(&apps))).await.is_err() { return; }

    // The attached app: its key, a sender to its socket, and whether it's up.
    let mut attached: Option<String> = None;
    let mut to_app: Option<mpsc::UnboundedSender<String>> = None;
    let (from_app_tx, mut from_app) = mpsc::unbounded_channel::<FromApp>();
    let mut rescan = tokio::time::interval(RESCAN);

    // Attach to `app`: connect, spawn its pump, tell the UI.
    macro_rules! attach {
        ($app:expr) => {{
            match connect_app($app).await {
                Ok((app_ws, handshake)) => {
                    let (mut app_tx, mut app_rx) = app_ws.split();
                    let (tx, mut rx) = mpsc::unbounded_channel::<String>();
                    let back = from_app_tx.clone();
                    tokio::spawn(async move {
                        loop {
                            tokio::select! {
                                out = rx.recv() => match out {
                                    Some(text) => { if app_tx.send(Message::Text(text)).await.is_err() { break; } }
                                    None => { let _ = app_tx.close().await; return; } // detached on purpose
                                },
                                inc = app_rx.next() => match inc {
                                    Some(Ok(Message::Text(t))) => { let _ = back.send(FromApp::Text(t)); }
                                    Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                                    _ => {}
                                },
                            }
                        }
                        let _ = back.send(FromApp::Closed);
                    });
                    to_app = Some(tx);
                    json!({ "type": "status", "state": "connected", "key": $app.key, "handshake": handshake })
                }
                Err(message) => json!({ "type": "status", "state": "error", "key": $app.key, "message": message }),
            }
        }};
    }

    loop {
        tokio::select! {
            msg = ui_rx.next() => {
                let text = match msg {
                    Some(Ok(Message::Text(t))) => t,
                    Some(Ok(Message::Close(_))) | None | Some(Err(_)) => break,
                    _ => continue,
                };
                let v: Value = match serde_json::from_str(&text) { Ok(v) => v, Err(_) => continue };
                match v.get("type").and_then(Value::as_str) {
                    Some("attach") => {
                        to_app = None; // drops the old app's socket
                        let key = v.get("key").and_then(Value::as_str).unwrap_or("").to_string();
                        apps = live_apps(&shared).await;
                        let status = match apps.iter().find(|a| a.key == key) {
                            Some(app) => {
                                let s = attach!(app);
                                // Only a successful attach is remembered for
                                // reattaching; a refused one isn't retried.
                                attached = (s["state"] == "connected").then_some(key);
                                s
                            }
                            None => { attached = None; json!({ "type": "status", "state": "error", "key": key, "message": "no running app with that key" }) }
                        };
                        if ui_tx.send(send(status)).await.is_err() { break; }
                    }
                    Some("detach") => {
                        to_app = None;
                        attached = None;
                        if ui_tx.send(send(json!({ "type": "status", "state": "detached" }))).await.is_err() { break; }
                    }
                    Some("apps") => {
                        apps = live_apps(&shared).await;
                        if ui_tx.send(send(apps_json(&apps))).await.is_err() { break; }
                    }
                    // Anything else is a GDP request for the attached app.
                    _ => match &to_app {
                        Some(tx) => { let _ = tx.send(text); }
                        None => {
                            let reply = json!({ "id": v.get("id").cloned().unwrap_or(Value::Null),
                                "error": { "code": crate::protocol::codes::NO_SUCH_WINDOW, "message": "not attached to an app" } });
                            if ui_tx.send(send(reply)).await.is_err() { break; }
                        }
                    },
                }
            }
            Some(from) = from_app.recv() => match from {
                FromApp::Text(t) => { if ui_tx.send(Message::Text(t)).await.is_err() { break; } }
                FromApp::Closed => {
                    // Lost the app (quit, crash, restart, reload of the runner).
                    if to_app.take().is_some() && attached.is_some() {
                        let status = json!({ "type": "status", "state": "reconnecting", "key": attached });
                        if ui_tx.send(send(status)).await.is_err() { break; }
                    }
                }
            },
            _ = rescan.tick() => {
                let now = live_apps(&shared).await;
                if now != apps {
                    apps = now;
                    if ui_tx.send(send(apps_json(&apps))).await.is_err() { break; }
                }
                // Reattach when the lost app is back (same discovery file,
                // possibly a new port and token).
                if to_app.is_none() {
                    if let Some(key) = attached.clone() {
                        if let Some(app) = apps.iter().find(|a| a.key == key).cloned() {
                            let status = attach!(&app);
                            if ui_tx.send(send(status)).await.is_err() { break; }
                        }
                    }
                }
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn request_heads_parse_with_lowercase_headers() {
        let r = parse_request("GET /assets/app.js?v=1 HTTP/1.1\r\nHost: x\r\nUpgrade: WebSocket\r\nSec-WebSocket-Key: abc").unwrap();
        assert_eq!((r.method.as_str(), r.path.as_str()), ("GET", "/assets/app.js?v=1"));
        assert_eq!(r.headers["upgrade"], "WebSocket");
        assert_eq!(r.headers["sec-websocket-key"], "abc");
        assert!(parse_request("").is_none());
    }

    #[test]
    fn asset_names_never_escape_the_root() {
        assert_eq!(asset_name("/").as_deref(), Some("index.html"));
        assert_eq!(asset_name("/#s=abc").as_deref(), Some("index.html"));
        assert_eq!(asset_name("/assets/app.js?x=1").as_deref(), Some("assets/app.js"));
        for bad in ["/../secret", "/assets/../../x", "/./x", "/a\\b"] {
            assert_eq!(asset_name(bad), None, "{bad}");
        }
        assert_eq!(content_type("index.html"), "text/html; charset=utf-8");
        assert_eq!(content_type("a/b.css"), "text/css; charset=utf-8");
        assert_eq!(content_type("x.bin"), "application/octet-stream");
    }

    #[test]
    fn discovery_files_name_the_project() {
        let dir = std::env::temp_dir().join(format!("glyx-relay-test-{}", std::process::id()));
        let file = dir.join("calculator").join("target").join("glyx").join("devtools.json");
        std::fs::create_dir_all(file.parent().unwrap()).unwrap();
        std::fs::write(&file, r#"{"url":"ws://127.0.0.1:9300/","port":9300,"token":"t0k3n","pid":42,"engine":"QuickJS"}"#).unwrap();
        let app = read_app(&file).unwrap();
        assert_eq!((app.name.as_str(), app.port, app.pid, app.engine.as_str()), ("calculator", 9300, 42, "QuickJS"));
        let loose = dir.join("7.json");
        std::fs::write(&loose, r#"{"port":9301,"token":"x","pid":7}"#).unwrap();
        assert_eq!(read_app(&loose).unwrap().name, "pid 7");
        std::fs::write(dir.join("junk.json"), "not json").unwrap();
        let all = scan(&[dir.clone(), file.clone()]);
        assert_eq!(all.len(), 2, "junk skipped, duplicates merged: {all:?}");
        let _ = std::fs::remove_dir_all(&dir);
    }
}
