//! End-to-end transport tests: a real server on a free port, a real client.

use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use glyx_devtools::{codes, DevtoolsServer};
use serde_json::{json, Value};
use tokio_tungstenite::tungstenite::client::IntoClientRequest;
use tokio_tungstenite::tungstenite::Message;

type Ws = tokio_tungstenite::WebSocketStream<tokio_tungstenite::MaybeTlsStream<tokio::net::TcpStream>>;

const TOKEN: &str = "0123456789abcdef0123456789abcdef";

fn start() -> (DevtoolsServer, Arc<AtomicUsize>) {
    let wakes = Arc::new(AtomicUsize::new(0));
    let w = Arc::clone(&wakes);
    let server = DevtoolsServer::start(&tokio::runtime::Handle::current(), 0, TOKEN.into(),
        Arc::new(move || { w.fetch_add(1, Ordering::SeqCst); })).expect("bind");
    (server, wakes)
}

async fn connect(port: u16, origin: Option<&str>) -> Result<Ws, tokio_tungstenite::tungstenite::Error> {
    let mut req = format!("ws://127.0.0.1:{port}/").into_client_request().unwrap();
    if let Some(o) = origin {
        req.headers_mut().insert("origin", o.parse().unwrap());
    }
    tokio_tungstenite::connect_async(req).await.map(|(ws, _)| ws)
}

async fn send(ws: &mut Ws, v: Value) {
    ws.send(Message::Text(v.to_string())).await.unwrap();
}

async fn recv(ws: &mut Ws) -> Option<Value> {
    match tokio::time::timeout(Duration::from_secs(5), ws.next()).await.ok()?? {
        Ok(Message::Text(t)) => serde_json::from_str(&t).ok(),
        _ => None,
    }
}

/// The server's inbox is drained by the app's frame loop; tests poll it.
async fn next_incoming(server: &DevtoolsServer) -> glyx_devtools::Incoming {
    for _ in 0..500 {
        if let Some(i) = server.poll().into_iter().next() { return i; }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    panic!("no request reached the inbox");
}

fn handshake(token: &str) -> Value {
    json!({ "id": 1, "domain": "Runtime", "method": "handshake", "params": { "token": token } })
}

#[tokio::test(flavor = "multi_thread")]
async fn a_valid_handshake_reaches_the_app_and_the_reply_reaches_the_client() {
    let (server, wakes) = start();
    let mut ws = connect(server.port(), Some("http://localhost:5173")).await.expect("loopback origin is allowed");

    send(&mut ws, handshake(TOKEN)).await;
    let inc = next_incoming(&server).await;
    assert_eq!(inc.request.name(), "Runtime.handshake");
    assert!(wakes.load(Ordering::SeqCst) >= 1, "an idle app is woken");

    server.respond(inc.conn, &inc.request.id, Ok(json!({ "protocolVersion": 1 })));
    assert_eq!(recv(&mut ws).await.unwrap(), json!({ "id": 1, "result": { "protocolVersion": 1 } }));

    // After the handshake, other methods pass through too, and events arrive.
    send(&mut ws, json!({ "id": 2, "domain": "Runtime", "method": "ping" })).await;
    let inc = next_incoming(&server).await;
    assert_eq!(inc.request.name(), "Runtime.ping");
    assert!(server.send_event(inc.conn, "Console.messageAdded", Some(1), json!({ "text": "hi" })));
    assert_eq!(recv(&mut ws).await.unwrap()["event"], "Console.messageAdded");
}

#[tokio::test(flavor = "multi_thread")]
async fn a_wrong_or_missing_token_is_refused_and_the_connection_closed() {
    let (server, _) = start();
    for bad in [handshake("not-the-token"), json!({ "id": 1, "domain": "Runtime", "method": "handshake" })] {
        let mut ws = connect(server.port(), None).await.unwrap();
        send(&mut ws, bad).await;
        let reply = recv(&mut ws).await.unwrap();
        assert_eq!(reply["error"]["code"], codes::UNAUTHORIZED);
        assert!(recv(&mut ws).await.is_none(), "connection closed after a bad token");
    }
    tokio::time::sleep(Duration::from_millis(100)).await;
    assert!(server.poll().is_empty(), "nothing unauthenticated reaches the app");
}

#[tokio::test(flavor = "multi_thread")]
async fn methods_before_the_handshake_are_refused() {
    let (server, _) = start();
    let mut ws = connect(server.port(), None).await.unwrap();
    send(&mut ws, json!({ "id": 9, "domain": "Runtime", "method": "evaluate", "params": { "expression": "1" } })).await;
    let reply = recv(&mut ws).await.unwrap();
    assert_eq!(reply["id"], 9);
    assert_eq!(reply["error"]["code"], codes::UNAUTHORIZED);
    // Still open: a correct handshake can follow.
    send(&mut ws, handshake(TOKEN)).await;
    assert_eq!(next_incoming(&server).await.request.name(), "Runtime.handshake");
}

#[tokio::test(flavor = "multi_thread")]
async fn a_web_page_origin_cannot_connect() {
    let (server, _) = start();
    let err = connect(server.port(), Some("https://evil.example")).await.err().expect("refused");
    assert!(err.to_string().contains("403"), "{err}");
}

#[tokio::test(flavor = "multi_thread")]
async fn a_malformed_message_gets_an_error_not_a_disconnect() {
    let (server, _) = start();
    let mut ws = connect(server.port(), None).await.unwrap();
    ws.send(Message::Text("{\"id\":4,\"nope\":true}".into())).await.unwrap();
    let reply = recv(&mut ws).await.unwrap();
    assert_eq!(reply["id"], 4);
    assert_eq!(reply["error"]["code"], codes::INVALID_REQUEST);
    send(&mut ws, handshake(TOKEN)).await;
    assert_eq!(next_incoming(&server).await.request.name(), "Runtime.handshake");
}

#[tokio::test(flavor = "multi_thread")]
async fn disconnects_are_reported_so_subscriptions_can_be_dropped() {
    let (server, _) = start();
    let mut ws = connect(server.port(), None).await.unwrap();
    send(&mut ws, handshake(TOKEN)).await;
    let conn = next_incoming(&server).await.conn;
    assert!(server.is_connected(conn));
    ws.close(None).await.unwrap();
    for _ in 0..200 {
        if server.take_closed().contains(&conn) { assert!(!server.is_connected(conn)); return; }
        tokio::time::sleep(Duration::from_millis(10)).await;
    }
    panic!("disconnect not reported");
}
