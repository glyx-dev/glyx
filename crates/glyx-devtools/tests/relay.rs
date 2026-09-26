//! End-to-end relay tests: a real relay, a fake GDP app, a real UI client.

use std::path::PathBuf;
use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use glyx_devtools::{Relay, RelayConfig};
use serde_json::{json, Value};
use tokio::io::{AsyncReadExt, AsyncWriteExt};
use tokio::net::TcpListener;
use tokio_tungstenite::tungstenite::Message;

type Ws = tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

/// A fake app: answers the handshake (right token only) and `Runtime.ping`.
/// Dropping / stopping it closes every connection, like a real app exiting.
struct FakeApp { tasks: Arc<parking_lot::Mutex<Vec<tokio::task::JoinHandle<()>>>> }

impl FakeApp {
    fn stop(&self) { for t in self.tasks.lock().drain(..) { t.abort(); } }
}

async fn fake_app(token: &'static str) -> (u16, FakeApp) {
    let listener = TcpListener::bind("127.0.0.1:0").await.unwrap();
    let port = listener.local_addr().unwrap().port();
    let tasks = Arc::new(parking_lot::Mutex::new(Vec::new()));
    let conns = Arc::clone(&tasks);
    let accept = tokio::spawn(async move {
        while let Ok((stream, _)) = listener.accept().await {
            let conn = tokio::spawn(async move {
                let Ok(mut ws) = tokio_tungstenite::accept_async(stream).await else { return };
                while let Some(Ok(Message::Text(t))) = ws.next().await {
                    let v: Value = serde_json::from_str(&t).unwrap();
                    let reply = match (v["method"].as_str(), v["params"]["token"].as_str()) {
                        (Some("handshake"), Some(t)) if t == token =>
                            json!({ "id": v["id"], "result": { "engine": "Fake", "pid": 1, "methods": ["Runtime.ping"] } }),
                        (Some("handshake"), _) => json!({ "id": v["id"], "error": { "code": -32001, "message": "wrong token" } }),
                        (Some("ping"), _) => json!({ "id": v["id"], "result": { "pong": true } }),
                        _ => json!({ "id": v["id"], "error": { "code": -32601, "message": "nope" } }),
                    };
                    if ws.send(Message::Text(reply.to_string())).await.is_err() { return; }
                }
            });
            conns.lock().push(conn);
        }
    });
    tasks.lock().push(accept);
    (port, FakeApp { tasks })
}

fn write_discovery(file: &PathBuf, port: u16, token: &str) {
    std::fs::create_dir_all(file.parent().unwrap()).unwrap();
    std::fs::write(file, json!({ "url": format!("ws://127.0.0.1:{port}/"), "port": port, "token": token, "pid": 1, "engine": "Fake" }).to_string()).unwrap();
}

fn start_relay(discovery: Vec<PathBuf>) -> Relay {
    let assets: glyx_devtools::Assets = Arc::new(|name: &str| match name {
        "index.html" => Some(b"<!doctype html><title>DevTools</title>".to_vec()),
        "assets/app.js" => Some(b"console.log(1)".to_vec()),
        _ => None,
    });
    Relay::start(&tokio::runtime::Handle::current(), RelayConfig { port: 0, assets, discovery }).expect("bind")
}

fn secret(relay: &Relay) -> String { relay.url().split("#s=").nth(1).unwrap().to_string() }

async fn ui(relay: &Relay) -> Ws {
    tokio_tungstenite::connect_async(format!("ws://127.0.0.1:{}/relay", relay.port())).await.unwrap().0
}

async fn recv(ws: &mut Ws) -> Value {
    match tokio::time::timeout(Duration::from_secs(5), ws.next()).await {
        Ok(Some(Ok(Message::Text(t)))) => serde_json::from_str(&t).unwrap(),
        other => panic!("no message: {other:?}"),
    }
}

/// Next message of `type` (skipping periodic app lists etc.).
async fn recv_type(ws: &mut Ws, ty: &str) -> Value {
    for _ in 0..20 {
        let v = recv(ws).await;
        if v["type"] == ty { return v; }
    }
    panic!("no {ty} message");
}

async fn http_get(port: u16, path: &str) -> String {
    let mut s = tokio::net::TcpStream::connect(("127.0.0.1", port)).await.unwrap();
    s.write_all(format!("GET {path} HTTP/1.1\r\nHost: x\r\n\r\n").as_bytes()).await.unwrap();
    let mut out = String::new();
    s.read_to_string(&mut out).await.unwrap();
    out
}

fn temp_dir(name: &str) -> PathBuf {
    let d = std::env::temp_dir().join(format!("glyx-relay-e2e-{name}-{}", std::process::id()));
    let _ = std::fs::remove_dir_all(&d);
    d
}

#[tokio::test(flavor = "multi_thread")]
async fn the_ui_files_are_served_and_nothing_outside_them() {
    let relay = start_relay(vec![]);
    let index = http_get(relay.port(), "/").await;
    assert!(index.starts_with("HTTP/1.1 200") && index.contains("text/html") && index.contains("<title>DevTools"));
    let js = http_get(relay.port(), "/assets/app.js").await;
    assert!(js.contains("text/javascript") && js.contains("no-store"));
    assert!(http_get(relay.port(), "/missing.js").await.starts_with("HTTP/1.1 404"));
    assert!(http_get(relay.port(), "/../Cargo.toml").await.starts_with("HTTP/1.1 404"));
}

#[tokio::test(flavor = "multi_thread")]
async fn a_wrong_secret_is_refused() {
    let relay = start_relay(vec![]);
    let mut ws = ui(&relay).await;
    ws.send(Message::Text(json!({ "type": "hello", "secret": "nope" }).to_string())).await.unwrap();
    let v = recv(&mut ws).await;
    assert_eq!(v["state"], "error");
    // …and the connection ends.
    let next = tokio::time::timeout(Duration::from_secs(3), ws.next()).await.unwrap();
    assert!(!matches!(next, Some(Ok(Message::Text(_)))));
}

#[tokio::test(flavor = "multi_thread")]
async fn web_pages_from_other_origins_are_refused() {
    use tokio_tungstenite::tungstenite::client::IntoClientRequest;
    let relay = start_relay(vec![]);
    let mut req = format!("ws://127.0.0.1:{}/relay", relay.port()).into_client_request().unwrap();
    req.headers_mut().insert("origin", "https://evil.example".parse().unwrap());
    assert!(tokio_tungstenite::connect_async(req).await.is_err());
}

#[tokio::test(flavor = "multi_thread")]
async fn lists_apps_attaches_relays_and_reattaches_after_a_restart() {
    let dir = temp_dir("attach");
    let file = dir.join("myapp").join("target").join("glyx").join("devtools.json");
    let (port, app) = fake_app("token-one-0123456").await;
    write_discovery(&file, port, "token-one-0123456");
    // A stale file (nothing listening) must not be listed.
    write_discovery(&dir.join("stale.json"), 1, "x");
    // Nor one whose port now belongs to another app: it answers, but the
    // file's token is refused (the bug that listed crashed apps' files).
    write_discovery(&dir.join("impostor.json"), port, "old-token-0123456");

    let relay = start_relay(vec![file.clone(), dir.clone()]);
    let mut ws = ui(&relay).await;
    ws.send(Message::Text(json!({ "type": "hello", "secret": secret(&relay) }).to_string())).await.unwrap();

    let apps = recv_type(&mut ws, "apps").await;
    let list = apps["apps"].as_array().unwrap();
    assert_eq!(list.len(), 1, "only the live app: {apps}");
    assert_eq!(list[0]["name"], "myapp");
    let key = list[0]["key"].as_str().unwrap().to_string();

    // Before attaching, GDP requests are refused.
    ws.send(Message::Text(json!({ "id": 1, "domain": "Runtime", "method": "ping" }).to_string())).await.unwrap();
    assert!(recv(&mut ws).await["error"]["message"].as_str().unwrap().contains("not attached"));

    ws.send(Message::Text(json!({ "type": "attach", "key": key }).to_string())).await.unwrap();
    let st = recv_type(&mut ws, "status").await;
    assert_eq!(st["state"], "connected", "{st}");
    assert_eq!(st["handshake"]["engine"], "Fake", "the relay did the handshake with the app's token");

    ws.send(Message::Text(json!({ "id": 2, "domain": "Runtime", "method": "ping" }).to_string())).await.unwrap();
    let pong = recv(&mut ws).await;
    assert_eq!((pong["id"].clone(), pong["result"]["pong"].clone()), (json!(2), json!(true)));

    // The app goes away: the UI hears "reconnecting".
    app.stop();
    let st = recv_type(&mut ws, "status").await;
    assert_eq!(st["state"], "reconnecting", "{st}");

    // It comes back on a new port with a new token, same discovery file:
    // the relay reattaches by itself.
    let (port2, _app2) = fake_app("token-two-0123456").await;
    write_discovery(&file, port2, "token-two-0123456");
    let st = recv_type(&mut ws, "status").await;
    assert_eq!(st["state"], "connected", "{st}");
    ws.send(Message::Text(json!({ "id": 3, "domain": "Runtime", "method": "ping" }).to_string())).await.unwrap();
    assert_eq!(recv(&mut ws).await["result"]["pong"], true);

    let _ = std::fs::remove_dir_all(&dir);
}
