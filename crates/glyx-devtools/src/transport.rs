//! The GDP WebSocket server.
//!
//! Threading: a tokio task accepts connections and runs one reader + one
//! writer per client. Authenticated requests land in a shared inbox that the
//! app's event-loop thread drains each frame ([`DevtoolsServer::poll`]), so
//! domain code touches window state without locks. Replies and events go
//! out through a bounded per-client queue: when a slow client lets it fill,
//! messages are dropped, never waited on, so the frame loop can't block.
//!
//! Security (a connected client can run arbitrary JS via `Runtime.evaluate`):
//! - binds to 127.0.0.1 only;
//! - the WebSocket upgrade is refused (403) when an `Origin` header names
//!   anything but a loopback host, which stops a web page reaching the port
//!   (including through DNS rebinding);
//! - nothing but `Runtime.handshake` is answered until the handshake carries
//!   the per-session token; a wrong token closes the connection.

use std::collections::{HashMap, VecDeque};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;

use futures_util::{SinkExt, StreamExt};
use parking_lot::Mutex;
use serde_json::Value;
use tokio::sync::mpsc;
use tokio_tungstenite::tungstenite::handshake::server::{ErrorResponse, Request as HttpRequest, Response as HttpResponse};
use tokio_tungstenite::tungstenite::http::StatusCode;
use tokio_tungstenite::tungstenite::Message;

use crate::protocol::{self, codes, ErrorBody, Request};

/// One connected client.
pub type ConnId = u64;

/// Per-client outgoing queue length. Past this, messages are dropped.
const OUTBOX_LEN: usize = 1024;

/// An authenticated request, waiting for the event loop.
#[derive(Debug, Clone)]
pub struct Incoming {
    pub conn: ConnId,
    pub request: Request,
}

type Wake = Arc<dyn Fn() + Send + Sync>;

struct Shared {
    token: String,
    inbox: Mutex<VecDeque<Incoming>>,
    conns: Mutex<HashMap<ConnId, mpsc::Sender<String>>>,
    closed: Mutex<Vec<ConnId>>,
    next_conn: AtomicU64,
    wake: Wake,
}

/// Handle to a running server. Dropping it doesn't stop the server task;
/// the process exiting does.
pub struct DevtoolsServer {
    port: u16,
    shared: Arc<Shared>,
}

impl DevtoolsServer {
    /// Bind `127.0.0.1:port` (0 = any free port) and serve on `handle`.
    /// `wake` is called whenever a request arrives, so an idle app can
    /// process it without waiting for its next frame.
    pub fn start(handle: &tokio::runtime::Handle, port: u16, token: String, wake: Wake) -> std::io::Result<Self> {
        let std_listener = std::net::TcpListener::bind(("127.0.0.1", port))?;
        std_listener.set_nonblocking(true)?;
        let port = std_listener.local_addr()?.port();
        let listener = {
            let _guard = handle.enter();
            tokio::net::TcpListener::from_std(std_listener)?
        };
        let shared = Arc::new(Shared {
            token,
            inbox: Mutex::new(VecDeque::new()),
            conns: Mutex::new(HashMap::new()),
            closed: Mutex::new(Vec::new()),
            next_conn: AtomicU64::new(1),
            wake,
        });
        handle.spawn(accept_loop(listener, Arc::clone(&shared)));
        Ok(Self { port, shared })
    }

    pub fn port(&self) -> u16 { self.port }

    /// Authenticated requests received since the last call, oldest first.
    pub fn poll(&self) -> Vec<Incoming> {
        self.shared.inbox.lock().drain(..).collect()
    }

    /// Clients that disconnected since the last call (drop their subscriptions).
    pub fn take_closed(&self) -> Vec<ConnId> {
        std::mem::take(&mut *self.shared.closed.lock())
    }

    pub fn is_connected(&self, conn: ConnId) -> bool {
        self.shared.conns.lock().contains_key(&conn)
    }

    /// Answer a request.
    pub fn respond(&self, conn: ConnId, id: &Value, result: Result<Value, ErrorBody>) {
        self.send_raw(conn, protocol::response(id, result));
    }

    /// Send an event to one client. Returns false if it's gone.
    pub fn send_event(&self, conn: ConnId, name: &str, window_id: Option<u32>, params: Value) -> bool {
        self.send_raw(conn, protocol::event(name, window_id, params))
    }

    fn send_raw(&self, conn: ConnId, text: String) -> bool {
        let conns = self.shared.conns.lock();
        match conns.get(&conn) {
            // Full queue: drop rather than block the frame loop.
            Some(tx) => { let _ = tx.try_send(text); true }
            None => false,
        }
    }
}

/// A fresh 128-bit hex token for one session.
pub fn new_token() -> String {
    let mut b = [0u8; 16];
    getrandom::getrandom(&mut b).expect("OS random source");
    b.iter().map(|x| format!("{x:02x}")).collect()
}

/// `Origin` is fine when absent (non-browser clients) or a loopback host.
pub fn origin_allowed(origin: Option<&str>) -> bool {
    let Some(o) = origin else { return true };
    // scheme://host[:port][/...]
    let Some(rest) = o.split_once("://").map(|(_, r)| r) else { return false };
    let hostport = rest.split('/').next().unwrap_or("");
    let host = if let Some(h) = hostport.strip_prefix('[') {
        h.split(']').next().unwrap_or("")                     // [::1]:port
    } else {
        hostport.split(':').next().unwrap_or("")
    };
    matches!(host.to_ascii_lowercase().as_str(), "127.0.0.1" | "localhost" | "::1")
}

/// `Host` must name loopback (`127.0.0.1`, `localhost`, `[::1]`, any port).
/// Loopback binding plus the `Origin` check still leave DNS rebinding open:
/// a page on `evil.example` whose name now resolves to 127.0.0.1 sends
/// `Host: evil.example`, which this refuses. Absent is fine (non-HTTP/1.1
/// clients); browsers always send it.
pub fn host_allowed(host: Option<&str>) -> bool {
    let Some(h) = host else { return true };
    let h = h.trim();
    let name = if let Some(v6) = h.strip_prefix('[') {
        v6.split(']').next().unwrap_or("")
    } else {
        h.rsplit_once(':').map_or(h, |(n, port)| if port.chars().all(|c| c.is_ascii_digit()) { n } else { h })
    };
    matches!(name.to_ascii_lowercase().as_str(), "127.0.0.1" | "localhost" | "::1")
}

/// Token comparison without an early exit on the first differing byte.
fn token_eq(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() { return false; }
    a.iter().zip(b).fold(0u8, |acc, (x, y)| acc | (x ^ y)) == 0
}

async fn accept_loop(listener: tokio::net::TcpListener, shared: Arc<Shared>) {
    loop {
        let (stream, _) = match listener.accept().await {
            Ok(s) => s,
            Err(e) => { log::warn!("[GDP] accept error: {e}"); continue; }
        };
        // Small request/response frames: without this, Nagle + delayed ACK
        // add ~40 ms to many round trips.
        let _ = stream.set_nodelay(true);
        tokio::spawn(serve(stream, Arc::clone(&shared)));
    }
}

async fn serve(stream: tokio::net::TcpStream, shared: Arc<Shared>) {
    #[allow(clippy::result_large_err)]
    let check_origin = |req: &HttpRequest, resp: HttpResponse| -> Result<HttpResponse, ErrorResponse> {
        let origin = req.headers().get("origin").and_then(|v| v.to_str().ok());
        let host = req.headers().get("host").and_then(|v| v.to_str().ok());
        if !host_allowed(host) {
            log::warn!("[GDP] refused connection for host {host:?} (not loopback)");
            let mut r = ErrorResponse::new(Some("host not allowed".into()));
            *r.status_mut() = StatusCode::FORBIDDEN;
            return Err(r);
        }
        if origin_allowed(origin) {
            Ok(resp)
        } else {
            log::warn!("[GDP] refused connection from origin {origin:?}");
            let mut r = ErrorResponse::new(Some("origin not allowed".into()));
            *r.status_mut() = StatusCode::FORBIDDEN;
            Err(r)
        }
    };
    let ws = match tokio_tungstenite::accept_hdr_async(stream, check_origin).await {
        Ok(ws) => ws,
        Err(e) => { log::debug!("[GDP] handshake failed: {e}"); return; }
    };

    let conn = shared.next_conn.fetch_add(1, Ordering::Relaxed);
    let (tx, mut rx) = mpsc::channel::<String>(OUTBOX_LEN);
    shared.conns.lock().insert(conn, tx.clone());
    let (mut sink, mut source) = ws.split();

    let writer = tokio::spawn(async move {
        while let Some(text) = rx.recv().await {
            if sink.send(Message::Text(text)).await.is_err() { break; }
        }
        let _ = sink.close().await;
    });

    let mut authed = false;
    while let Some(Ok(msg)) = source.next().await {
        let text = match msg {
            Message::Text(t) => t,
            Message::Close(_) => break,
            _ => continue,
        };
        let request: Request = match serde_json::from_str(&text) {
            Ok(r) => r,
            Err(e) => {
                let id = serde_json::from_str::<Value>(&text).ok()
                    .and_then(|v| v.get("id").cloned()).unwrap_or(Value::Null);
                let _ = tx.try_send(protocol::response(&id,
                    Err(ErrorBody::new(codes::INVALID_REQUEST, format!("bad request: {e}")))));
                continue;
            }
        };
        let is_handshake = request.domain == "Runtime" && request.method == "handshake";
        if !authed {
            if !is_handshake {
                let _ = tx.try_send(protocol::response(&request.id, Err(ErrorBody::new(
                    codes::UNAUTHORIZED, "send Runtime.handshake with the session token first"))));
                continue;
            }
            let given = request.params.get("token").and_then(Value::as_str).unwrap_or("");
            if !token_eq(given, &shared.token) {
                log::warn!("[GDP] handshake with a wrong or missing token; closing");
                let _ = tx.try_send(protocol::response(&request.id, Err(ErrorBody::new(
                    codes::UNAUTHORIZED, "wrong or missing token"))));
                break;
            }
            authed = true;
        }
        shared.inbox.lock().push_back(Incoming { conn, request });
        (shared.wake)();
    }

    shared.conns.lock().remove(&conn);
    shared.closed.lock().push(conn);
    drop(tx);
    // Let queued replies (e.g. the "wrong token" error) flush, then stop.
    let _ = tokio::time::timeout(std::time::Duration::from_secs(1), writer).await;
    (shared.wake)();
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_loopback_hosts_are_allowed() {
        assert!(host_allowed(None));
        for ok in ["127.0.0.1:9228", "localhost:9227", "LOCALHOST", "[::1]:9228", "127.0.0.1"] {
            assert!(host_allowed(Some(ok)), "{ok}");
        }
        for bad in ["evil.example:9228", "evil.example", "127.0.0.1.evil.example:9228", "192.168.1.5:9228", "[::2]:1", ""] {
            assert!(!host_allowed(Some(bad)), "{bad}");
        }
    }

    #[test]
    fn only_loopback_origins_are_allowed() {
        assert!(origin_allowed(None));
        for ok in ["http://localhost:3000", "http://127.0.0.1", "https://LOCALHOST/x", "vscode-webview://localhost", "http://[::1]:8080"] {
            assert!(origin_allowed(Some(ok)), "{ok}");
        }
        for bad in ["https://evil.example", "http://localhost.evil.example", "http://127.0.0.1.nip.io", "null", "file://", "http://[::2]"] {
            assert!(!origin_allowed(Some(bad)), "{bad}");
        }
    }

    #[test]
    fn tokens_are_random_hex_and_compared_exactly() {
        let (a, b) = (new_token(), new_token());
        assert_eq!(a.len(), 32);
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
        assert_ne!(a, b);
        assert!(token_eq(&a, &a.clone()));
        assert!(!token_eq(&a, &b));
        assert!(!token_eq(&a, &a[..31]));
        assert!(!token_eq(&a, ""));
    }
}
