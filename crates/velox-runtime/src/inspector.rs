//! Chrome DevTools Protocol (CDP) inspector integration for dev mode.
//!
//! When `velox dev --inspect` is set (via `VELOX_INSPECT_PORT` env var), this
//! module starts a WebSocket server on `ws://localhost:<port>` that Chrome
//! DevTools can attach to.
//!
//! Threading model
//! ───────────────
//! • The tokio task runs the WebSocket server and forwards raw CDP JSON between
//!   the client (Chrome) and a pair of channels:
//!     inbox:  Arc<Mutex<VecDeque<String>>>   WS → V8 thread
//!     outbox: tokio::sync::mpsc::UnboundedSender<String>  V8 thread → WS
//!
//! • Each frame, `VeloxInspector::pump_messages()` drains the inbox and
//!   dispatches messages to the V8 inspector session.  Responses flow back
//!   through the `VeloxChannel` → outbox → WebSocket.
//!
//! • `runMessageLoopOnPause` is implemented as a busy-wait that pumps the inbox
//!   until `quitMessageLoopOnPause` is called.  This blocks the V8 thread (and
//!   thus the render loop) while a breakpoint is active — the window will freeze
//!   but the debugger will be fully interactive.

use std::{
    collections::VecDeque,
    sync::Arc,
};
use parking_lot::Mutex;

use tokio::sync::mpsc;

// ── Channel — forwards CDP responses from V8 to the WebSocket ─────────────────

pub struct VeloxChannel {
    base:   v8::inspector::ChannelBase,
    outbox: mpsc::UnboundedSender<String>,
}

impl VeloxChannel {
    fn new(outbox: mpsc::UnboundedSender<String>) -> Self {
        Self { base: v8::inspector::ChannelBase::new::<Self>(), outbox }
    }
}

impl v8::inspector::ChannelImpl for VeloxChannel {
    fn base(&self)     -> &v8::inspector::ChannelBase     { &self.base }
    fn base_mut(&mut self) -> &mut v8::inspector::ChannelBase { &mut self.base }

    fn send_response(&mut self, _call_id: i32, message: v8::UniquePtr<v8::inspector::StringBuffer>) {
        if let Some(buf) = message.as_ref() {
            if let Some(chars) = buf.string().characters16() {
                let _ = self.outbox.send(String::from_utf16_lossy(chars));
            }
        }
    }

    fn send_notification(&mut self, message: v8::UniquePtr<v8::inspector::StringBuffer>) {
        if let Some(buf) = message.as_ref() {
            if let Some(chars) = buf.string().characters16() {
                let _ = self.outbox.send(String::from_utf16_lossy(chars));
            }
        }
    }

    fn flush_protocol_notifications(&mut self) {}
}

// ── Client — handles V8 inspector client callbacks ────────────────────────────

pub struct VeloxInspectorClient {
    base:   v8::inspector::V8InspectorClientBase,
    inbox:  Arc<Mutex<VecDeque<String>>>,
    paused: bool,
}

impl VeloxInspectorClient {
    fn new(inbox: Arc<Mutex<VecDeque<String>>>) -> Self {
        Self {
            base:   v8::inspector::V8InspectorClientBase::new::<Self>(),
            inbox,
            paused: false,
        }
    }
}

impl v8::inspector::V8InspectorClientImpl for VeloxInspectorClient {
    fn base(&self)     -> &v8::inspector::V8InspectorClientBase     { &self.base }
    fn base_mut(&mut self) -> &mut v8::inspector::V8InspectorClientBase { &mut self.base }

    /// Called by V8 when execution pauses (breakpoint / debugger statement).
    /// We spin-wait, draining the inbox, until `quit_message_loop_on_pause` is called.
    /// This blocks the render thread — the window freezes but the debugger is live.
    fn run_message_loop_on_pause(&mut self, _context_group_id: i32) {
        self.paused = true;
        while self.paused {
            std::thread::sleep(std::time::Duration::from_millis(5));
        }
    }

    fn quit_message_loop_on_pause(&mut self) {
        self.paused = false;
    }
}

// ── Inspector — owns the V8Inspector + session, drives message dispatch ───────

/// Owns the V8 inspector infrastructure for one isolate.
/// Must be created and used exclusively on the V8 thread.
///
/// Fields are declared in drop order: session is dropped before inspector,
/// and both are dropped before _channel / _client (which they reference).
pub struct VeloxInspector {
    /// Active inspector session — dropped first (depends on inspector).
    session:   v8::UniqueRef<v8::inspector::V8InspectorSession>,
    /// V8Inspector — dropped after session.
    inspector: v8::UniqueRef<v8::inspector::V8Inspector>,
    /// Channel that routes V8 CDP responses out to the WebSocket.
    _channel:  Box<VeloxChannel>,
    /// Inspector client (callbacks from V8).
    _client:   Box<VeloxInspectorClient>,
    /// Messages arriving from Chrome DevTools, waiting to be dispatched to V8.
    inbox:     Arc<Mutex<VecDeque<String>>>,
    /// Port the WS server is listening on.
    pub port:  u16,
}

// SAFETY: VeloxInspector is only ever used on the V8 thread.
unsafe impl Send for VeloxInspector {}

impl VeloxInspector {
    /// Create a new inspector attached to `isolate` and `context`, and start
    /// the WebSocket server on `port` using the provided tokio `Handle`.
    /// `cdp_log_tx` is set so that `__velox_log` can forward console messages
    /// as `Runtime.consoleAPICalled` CDP events.
    pub fn new(
        isolate:      &mut v8::OwnedIsolate,
        context:      &v8::Global<v8::Context>,
        port:         u16,
        tokio_handle: &tokio::runtime::Handle,
        cdp_log_tx:   Arc<Mutex<Option<mpsc::UnboundedSender<String>>>>,
    ) -> Self {
        let inbox  = Arc::new(Mutex::new(VecDeque::<String>::new()));
        let (outbox_tx, outbox_rx) = mpsc::unbounded_channel::<String>();

        // Wire the log binding to this session's outbox so console.log → CDP.
        *cdp_log_tx.lock() = Some(outbox_tx.clone());

        // Start the WebSocket server on a tokio task.
        let inbox_clone = Arc::clone(&inbox);
        tokio_handle.spawn(run_ws_server(port, inbox_clone, outbox_rx));

        // Create the channel and client (both pinned on the heap).
        let mut channel = Box::new(VeloxChannel::new(outbox_tx));
        let mut client  = Box::new(VeloxInspectorClient::new(Arc::clone(&inbox)));

        // Build V8Inspector + session inside a HandleScope.
        let (inspector, session) = {
            let scope = &mut v8::HandleScope::new(isolate);
            let ctx   = v8::Local::new(scope, context);

            let mut inspector = v8::inspector::V8Inspector::create(scope, &mut *client);

            let name = v8::inspector::StringView::from("velox".as_bytes());
            inspector.context_created(ctx, 1, name);

            let state = v8::inspector::StringView::from("{}".as_bytes());
            let session = inspector.connect(1, &mut *channel, state);

            (inspector, session)
        };

        log::info!("[velox] CDP inspector listening on ws://127.0.0.1:{port}");
        log::info!("[velox] Open chrome://inspect in Chrome and click 'Configure...' to add 127.0.0.1:{port}");

        Self { session, inspector, _channel: channel, _client: client, inbox, port }
    }

    /// Drain the inbox and dispatch all pending CDP messages to V8.
    /// Must be called from the V8 thread each frame.
    pub fn pump_messages(&mut self, isolate: &mut v8::OwnedIsolate, context: &v8::Global<v8::Context>) {
        let msgs: Vec<String> = {
            let mut q = self.inbox.lock();
            q.drain(..).collect()
        };
        if msgs.is_empty() { return; }

        let scope = &mut v8::HandleScope::new(isolate);
        let ctx   = v8::Local::new(scope, context);
        let _scope = &mut v8::ContextScope::new(scope, ctx);

        for msg in msgs {
            let view = v8::inspector::StringView::from(msg.as_bytes());
            self.session.dispatch_protocol_message(view);
        }
    }
}

// ── WebSocket server (tokio task) ─────────────────────────────────────────────

/// Serves a minimal CDP-compatible WebSocket endpoint.
///
/// Chrome DevTools expects to find:
///   GET /json            → list of debuggable targets
///   GET /json/version    → browser version metadata
///   WS /                 → CDP session
async fn run_ws_server(
    port: u16,
    inbox: Arc<Mutex<VecDeque<String>>>,
    mut outbox: mpsc::UnboundedReceiver<String>,
) {
    use tokio::net::TcpListener;
    use tokio_tungstenite::tungstenite::Message;
    use futures_util::{SinkExt, StreamExt};

    let addr = format!("127.0.0.1:{port}");
    let listener = match TcpListener::bind(&addr).await {
        Ok(l) => l,
        Err(e) => { log::error!("[CDP] Failed to bind {addr}: {e}"); return; }
    };

    // Chrome polls /json to discover targets; we accept only one connection at a time.
    loop {
        let (stream, peer) = match listener.accept().await {
            Ok(pair) => pair,
            Err(e)   => { log::warn!("[CDP] accept error: {e}"); continue; }
        };
        log::debug!("[CDP] connection from {peer}");

        // Peek enough bytes to read the request line WITHOUT consuming them.
        // This lets tokio-tungstenite see the full HTTP headers for WS upgrade.
        let mut peek_buf = vec![0u8; 256];
        let n = match stream.peek(&mut peek_buf).await {
            Ok(n) => n,
            Err(_) => continue,
        };
        let peek_str = String::from_utf8_lossy(&peek_buf[..n]);

        if !peek_str.starts_with("GET") {
            continue;
        }

        if peek_str.contains("GET /json") {
            // HTTP discovery endpoint — consume the request and respond.
            let mut req_buf = vec![0u8; 512];
            let _ = stream.try_read(&mut req_buf);
            let body = format!(
                r#"[{{"type":"node","id":"velox-1","title":"Velox Dev","url":"file://velox","webSocketDebuggerUrl":"ws://127.0.0.1:{port}/"}}]"#
            );
            let response = format!(
                "HTTP/1.1 200 OK\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                body.len(), body
            );
            use tokio::io::AsyncWriteExt;
            let mut stream = stream;
            let _ = stream.write_all(response.as_bytes()).await;
            continue;
        }

        // WebSocket upgrade — stream is intact (we only peeked above),
        // so tokio-tungstenite can complete the handshake normally.
        let ws_stream = match tokio_tungstenite::accept_async(stream).await {
            Ok(ws) => ws,
            Err(e) => { log::warn!("[CDP] WS handshake failed: {e}"); continue; }
        };

        log::info!("[CDP] DevTools connected.");
        let (mut ws_sink, mut ws_src) = ws_stream.split();
        let inbox_clone = Arc::clone(&inbox);

        // Forward DevTools → inbox (V8 thread will drain each frame).
        let read_task = tokio::spawn(async move {
            while let Some(msg) = ws_src.next().await {
                if let Ok(Message::Text(txt)) = msg {
                    inbox_clone.lock().push_back(txt.to_string());
                }
            }
        });

        // Forward outbox (V8 thread) → DevTools.
        while let Some(msg) = outbox.recv().await {
            if ws_sink.send(Message::Text(msg.into())).await.is_err() {
                break;
            }
        }

        read_task.abort();
        log::info!("[CDP] DevTools disconnected.");
    }
}
