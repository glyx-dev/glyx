use super::*;
use std::net::IpAddr;

// ── H3: Network SSRF hardening ────────────────────────────────────────────────

/// Extract just the hostname (no port, no userinfo, no path) from a URL string.
///
/// Uses `reqwest::Url` (which re-exports the `url` crate) for correct parsing,
/// matching what reqwest itself connects to.  Falls back to an empty string for
/// URLs that don't parse (non-http schemes, malformed).
pub fn extract_host(url: &str) -> String {
    #[cfg(feature = "fetch")]
    {
        reqwest::Url::parse(url)
            .ok()
            .and_then(|u| u.host_str().map(|h| h.to_lowercase()))
            .unwrap_or_default()
    }
    #[cfg(not(feature = "fetch"))]
    {
        // Minimal fallback when reqwest is not compiled in.
        let after_scheme = url.find("://").map(|i| &url[i + 3..]).unwrap_or(url);
        let authority = after_scheme.find('@').map(|i| &after_scheme[i + 1..]).unwrap_or(after_scheme);
        let host_port = authority.split(['/', '?', '#']).next().unwrap_or(authority);
        let host = if host_port.starts_with('[') {
            host_port.split(']').next().unwrap_or("").trim_start_matches('[')
        } else {
            host_port.split(':').next().unwrap_or(host_port)
        };
        host.to_lowercase()
    }
}

/// Returns `true` if `host` is a private, loopback, or link-local address that
/// should never be reachable from JS fetch/WebSocket (SSRF guard).
///
/// Checked ranges:
/// - `127.0.0.0/8`   -- IPv4 loopback
/// - `10.0.0.0/8`    -- private class A
/// - `172.16.0.0/12` -- private class B
/// - `192.168.0.0/16`-- private class C
/// - `169.254.0.0/16`-- link-local / AWS IMDS
/// - `0.0.0.0`        -- unspecified
/// - `::1/128`        -- IPv6 loopback
/// - `fc00::/7`       -- IPv6 unique-local
/// - `fe80::/10`      -- IPv6 link-local
/// - `"localhost"`, `"*.local"`, `"*.internal"`, `"*.localhost"` hostnames
#[allow(dead_code)]
fn is_private_host(host: &str) -> bool {
    if let Ok(ip) = host.parse::<IpAddr>() {
        return match ip {
            IpAddr::V4(v4) => {
                v4.is_loopback()
                    || v4.is_private()
                    || v4.is_link_local()
                    || v4.is_unspecified()
                    || v4.octets()[0] == 0
            }
            IpAddr::V6(v6) => {
                v6.is_loopback() || v6.is_unspecified() || {
                    let s = v6.segments();
                    (s[0] & 0xfe00) == 0xfc00   // fc00::/7 unique-local
                        || (s[0] & 0xffc0) == 0xfe80  // fe80::/10 link-local
                }
            }
        };
    }
    // Hostname heuristics.
    host == "localhost"
        || host.ends_with(".local")
        || host.ends_with(".internal")
        || host.ends_with(".localhost")
}

/// Scheme allowlist for fetch -- only `http://` and `https://`.
#[allow(dead_code)]
fn check_fetch_scheme(url: &str) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if lower.starts_with("https://") || lower.starts_with("http://") {
        Ok(())
    } else {
        let scheme = url.split("://").next().unwrap_or(url);
        Err(format!("fetch: scheme {scheme:?} not allowed; only http/https"))
    }
}

/// Scheme allowlist for WebSocket -- only `ws://` and `wss://`.
#[allow(dead_code)]
fn check_ws_scheme(url: &str) -> Result<(), String> {
    let lower = url.to_ascii_lowercase();
    if lower.starts_with("wss://") || lower.starts_with("ws://") {
        Ok(())
    } else {
        let scheme = url.split("://").next().unwrap_or(url);
        Err(format!("ws.connect: scheme {scheme:?} not allowed; only ws/wss"))
    }
}

/// Build a reqwest client with a redirect policy that re-checks `can_network`
/// and blocks private IPs on every redirect hop.
#[cfg(feature = "fetch")]
fn safe_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .redirect(reqwest::redirect::Policy::custom(|attempt| {
            if attempt.previous().len() >= 10 {
                return attempt.error("too many redirects");
            }
            let next_host = extract_host(attempt.url().as_str());
            if is_private_host(&next_host) {
                return attempt.error(format!(
                    "redirect to private/loopback host {next_host:?} denied (SSRF)"
                ));
            }
            if !glyx_security::get().can_network(&next_host) {
                return attempt.error(format!(
                    "redirect to host {next_host:?} not in network.allow"
                ));
            }
            attempt.follow()
        }))
        .build()
        .map_err(|e| e.to_string())
}

/// `__glyx_fetch(url, optionsJson) -> Promise<string>`
///
/// Makes an HTTP request and resolves with a JSON-serialised response object:
/// ```json
/// { "status": 200, "ok": true, "statusText": "OK",
///   "headers": { "content-type": "application/json" },
///   "body": "..." }
/// ```
///
/// `optionsJson` (all fields optional):
/// ```json
/// { "method": "POST",
///   "headers": { "Authorization": "Bearer ..." },
///   "body": "plain string body",
///   "multipart": [
///     { "name": "field", "value": "text value" },
///     { "name": "file", "filename": "photo.jpg",
///       "base64": "<base64 bytes>", "contentType": "image/jpeg" }
///   ] }
/// ```
///
/// Requires `network.allow` capability in `glyx.config.json`:
/// ```json
/// { "capabilities": { "network": { "allow": ["api.example.com"] } } }
/// ```
/// Use `"*"` to allow all outbound requests.
#[cfg(feature = "fetch")]
pub fn fetch_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let url  = v8_arg_to_string(scope, &args, 0);

    // ── H3 checks (scheme → private-IP → capability) ─────────────────────────
    if let Err(e) = check_fetch_scheme(&url) {
        rv.set(reject_promise_with_error(scope, &e).into());
        return;
    }
    let host = extract_host(&url);
    if is_private_host(&host) {
        rv.set(reject_promise_with_error(scope, &format!(
            "fetch: host {host:?} is a private/loopback address (SSRF denied)"
        )).into());
        return;
    }
    if !glyx_security::get().can_network(&host) {
        rv.set(reject_promise_with_error(scope, &format!(
            "network.allow[\"{host}\"] -- add to glyx.config.json \
             under \"capabilities\": {{ \"network\": {{ \"allow\": [\"{host}\"] }} }}"
        )).into());
        return;
    }

    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let options_json = v8_arg_to_string(scope, &args, 1);
    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            // Parse options (tolerates missing / undefined / null).
            let opts: serde_json::Value = serde_json::from_str(&options_json)
                .unwrap_or(serde_json::Value::Null);

            let method = opts.get("method")
                .and_then(|m| m.as_str())
                .unwrap_or("GET")
                .to_ascii_uppercase();

            let client = safe_http_client()?;

            let mut builder = match method.as_str() {
                "POST"   => client.post(&url),
                "PUT"    => client.put(&url),
                "PATCH"  => client.patch(&url),
                "DELETE" => client.delete(&url),
                "HEAD"   => client.head(&url),
                _        => client.get(&url),
            };

            // Request headers.
            if let Some(hdrs) = opts.get("headers").and_then(|h| h.as_object()) {
                for (k, v) in hdrs {
                    if let Some(val) = v.as_str() {
                        builder = builder.header(k.as_str(), val);
                    }
                }
            }

            // â"€â"€ Multipart body â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€
            // `multipart` option: array of part descriptors.
            // Each part: { name, value?, filename?, base64?, contentType? }
            //   - text part:   { name: "field", value: "hello" }
            //   - binary part: { name: "file", filename: "photo.jpg",
            //                    base64: "<b64>", contentType: "image/jpeg" }
            if let Some(parts) = opts.get("multipart").and_then(|m| m.as_array()) {
                let mut form = reqwest::multipart::Form::new();
                for part_val in parts {
                    let name = part_val.get("name")
                        .and_then(|n| n.as_str())
                        .unwrap_or("field")
                        .to_owned();

                    if let Some(b64) = part_val.get("base64").and_then(|b| b.as_str()) {
                        // Binary part â€" decode from base64.
                        let bytes = base64::engine::general_purpose::STANDARD
                            .decode(b64)
                            .map_err(|e| format!("multipart base64 decode: {e}"))?;
                        let mime = part_val.get("contentType")
                            .and_then(|c| c.as_str())
                            .unwrap_or("application/octet-stream")
                            .to_owned();
                        let filename = part_val.get("filename")
                            .and_then(|f| f.as_str())
                            .unwrap_or("file")
                            .to_owned();
                        let mut part = reqwest::multipart::Part::bytes(bytes)
                            .file_name(filename);
                        part = part.mime_str(&mime).map_err(|e| e.to_string())?;
                        form = form.part(name, part);
                    } else {
                        // Text part.
                        let value = part_val.get("value")
                            .and_then(|v| v.as_str())
                            .unwrap_or("")
                            .to_owned();
                        let mut part = reqwest::multipart::Part::text(value);
                        if let Some(fname) = part_val.get("filename").and_then(|f| f.as_str()) {
                            part = part.file_name(fname.to_owned());
                        }
                        if let Some(ct) = part_val.get("contentType").and_then(|c| c.as_str()) {
                            part = part.mime_str(ct).map_err(|e| e.to_string())?;
                        }
                        form = form.part(name, part);
                    }
                }
                builder = builder.multipart(form);
            } else if let Some(body) = opts.get("body").and_then(|b| b.as_str()) {
                // Plain string body (JSON, form-urlencoded, etc.).
                builder = builder.body(body.to_owned());
            }

            let response = builder.send().await.map_err(|e| e.to_string())?;

            let status      = response.status().as_u16();
            let ok          = (200u16..300).contains(&status);
            let status_text = response.status()
                .canonical_reason()
                .unwrap_or("")
                .to_owned();

            // Collect response headers as a plain object.
            let mut resp_headers = serde_json::Map::new();
            for (k, v) in response.headers() {
                if let Ok(val) = v.to_str() {
                    resp_headers.insert(k.to_string(), serde_json::Value::String(val.to_owned()));
                }
            }

            let body = response.text().await.map_err(|e| e.to_string())?;

            serde_json::to_string(&serde_json::json!({
                "status":     status,
                "ok":         ok,
                "statusText": status_text,
                "headers":    resp_headers,
                "body":       body,
            }))
            .map_err(|e| e.to_string())
        }
        .await;

        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

// â"€â"€ WebSocket bindings â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

/// `__glyx_ws_connect(url) -> Promise<string>` (resolves with handle id).
///
/// Connects via tokio-tungstenite.  Spawns two tasks:
///   - read task: pushes incoming Text messages into `WsHandle::inbox`.
///   - write task: forwards messages from `outbox_tx` to the socket sink.
#[cfg(feature = "websocket")]
pub fn ws_connect_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let url  = v8_arg_to_string(scope, &args, 0);

    // ── H3 checks (scheme → private-IP → capability) ─────────────────────────
    if let Err(e) = check_ws_scheme(&url) {
        rv.set(reject_promise_with_error(scope, &e).into());
        return;
    }
    let host = extract_host(&url);
    if is_private_host(&host) {
        rv.set(reject_promise_with_error(scope, &format!(
            "ws.connect: host {host:?} is a private/loopback address (SSRF denied)"
        )).into());
        return;
    }
    if !glyx_security::get().can_network(&host) {
        rv.set(reject_promise_with_error(scope, &format!(
            "network.allow[\"{host}\"] -- add to glyx.config.json \
             under \"capabilities\": {{ \"network\": {{ \"allow\": [\"{host}\"] }} }}"
        )).into());
        return;
    }

    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle      = state.next_ws_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);
    let ws_handles  = Arc::clone(&state.ws_handles);
    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = async {
            use futures_util::{SinkExt, StreamExt};
            use tokio_tungstenite::tungstenite::Message as WsMessage;

            let (ws_stream, _) = tokio_tungstenite::connect_async(&url)
                .await
                .map_err(|e| format!("WebSocket connect failed: {e}"))?;

            let (mut sink, mut stream) = ws_stream.split();

            let inbox = Arc::new(Mutex::new(VecDeque::<String>::new()));
            let (outbox_tx, mut outbox_rx) = tokio::sync::mpsc::unbounded_channel::<String>();

            // Read task: push incoming messages into inbox.
            let inbox_read = Arc::clone(&inbox);
            tokio::spawn(async move {
                while let Some(msg) = stream.next().await {
                    match msg {
                        Ok(WsMessage::Text(text)) => {
                            inbox_read.lock().push_back(text.to_string());
                        }
                        Ok(WsMessage::Close(_)) | Err(_) => {
                            inbox_read.lock().push_back("__GLYX_WS_CLOSED__".to_string());
                            break;
                        }
                        _ => {} // ping/pong/binary: ignored
                    }
                }
                // Ensure a close sentinel is always pushed (handles clean server closes).
                inbox_read.lock().push_back("__GLYX_WS_CLOSED__".to_string());
            });

            // Write task: forward outbox messages to the socket.
            tokio::spawn(async move {
                while let Some(msg) = outbox_rx.recv().await {
                    if sink.send(WsMessage::Text(msg)).await.is_err() {
                        break;
                    }
                }
                let _ = sink.close().await;
            });

            ws_handles.lock().insert(handle, WsHandle { outbox_tx, inbox });
            Ok(handle.to_string())
        }
        .await;

        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

/// `__glyx_ws_send(handle, message)` â€" sync fire-and-forget.
#[cfg(feature = "websocket")]
pub fn ws_send_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let msg    = v8_arg_to_string(scope, &args, 1);

    if let Some(h) = state.ws_handles.lock().get(&handle) {
        let _ = h.outbox_tx.send(msg);
    }
}

/// `__glyx_ws_poll(handle) -> string` â€" sync, drains inbox, returns JSON array.
///
/// Returns `"[]"` if no messages or unknown handle.
/// Returns `["__GLYX_WS_CLOSED__"]` when the server has closed the connection.
#[cfg(feature = "websocket")]
pub fn ws_poll_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let msgs: Vec<String> = {
        let guard = state.ws_handles.lock();
        guard
            .get(&handle)
            .map(|h| h.inbox.lock().drain(..).collect())
            .unwrap_or_default()
    };

    let json   = serde_json::to_string(&msgs).unwrap_or_else(|_| "[]".to_string());
    let v8_str = v8::String::new(scope, &json).unwrap();
    rv.set(v8_str.into());
}

/// `__glyx_ws_close(handle)` â€" sync, removes handle (drops outbox tx â†' write task exits).
#[cfg(feature = "websocket")]
pub fn ws_close_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let handle = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    // Dropping WsHandle drops outbox_tx â†' write task's recv() returns None â†' exits.
    state.ws_handles.lock().remove(&handle);
}

// â"€â"€ Multi-window + IPC bindings â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

/// `__glyx_window_create(optsJson) -> Promise<string>` â€" handle as string.
///
/// Creates a secondary window.  `optsJson` is a JSON object:
///   `{ title?: string, width?: number, height?: number }`
///
/// The promise resolves immediately with the pre-assigned window handle.
/// The window itself appears asynchronously once the event loop processes the
/// create request.  JS can begin sending IPC messages before the window is
/// fully initialised â€" they queue in the inbox and are consumed once the
/// secondary runtime starts polling.
pub fn window_create_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    // Cap total open windows (main + all secondaries) to prevent runaway creation.
    const MAX_WINDOWS: usize = 10;
    let open_count = state.ipc_bus.lock().len();
    if open_count >= MAX_WINDOWS {
        throw_js_error(scope, &format!(
            "glyxWindow.create: window limit reached ({} open, max {})",
            open_count, MAX_WINDOWS,
        ));
        return;
    }

    let opts_str = v8_arg_to_string(scope, &args, 0);
    let opts: serde_json::Value = serde_json::from_str(&opts_str).unwrap_or_default();
    let title  = opts.get("title") .and_then(|v| v.as_str()).unwrap_or("Window").to_string();
    let width  = opts.get("width") .and_then(|v| v.as_u64()).unwrap_or(800) as u32;
    let height = opts.get("height").and_then(|v| v.as_u64()).unwrap_or(600) as u32;

    // Allocate a globally-unique handle (shared across all windows' runtimes).
    let new_id = state.next_window_id.fetch_add(1, std::sync::atomic::Ordering::Relaxed);

    // Pre-register an inbox in the IPC bus so messages can be queued before
    // the secondary window's runtime starts polling.
    state.ipc_bus.lock()
        .entry(new_id)
        .or_insert_with(|| Arc::new(Mutex::new(VecDeque::new())));

    // Ask the event loop to create the window.
    if let Some(ref ctrl) = state.window {
        if let Some(ref create_fn) = ctrl.create_window {
            (create_fn)(new_id, title, width, height);
        }
    }

    // Resolve the promise immediately with the handle â€" window appears async.
    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());
    enqueue_completion(&queue_clone, redraw.as_ref(), Completion {
        resolver_ptr: resolver,
        result:       Ok(new_id.to_string()),
    });
}

/// `__glyx_ipc_send(targetHandle, message)` â€" sync, fire-and-forget.
///
/// Pushes a string message into the target window's IPC inbox.
/// The target window drains its inbox each frame via `__glyx_ipc_poll`.
pub fn ipc_send_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    _rv:    v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let target = args.get(0).number_value(scope).unwrap_or(0.0) as u32;
    let msg    = v8_arg_to_string(scope, &args, 1);

    let guard = state.ipc_bus.lock();
    if let Some(inbox) = guard.get(&target) {
        inbox.lock().push_back(msg);
    }
}

/// `__glyx_ipc_poll() -> string` â€" sync, returns JSON array of pending messages.
///
/// Drains this window's own IPC inbox.  Returns `"[]"` when empty.
/// Called each frame from the JS frame callback alongside WS polling.
pub fn ipc_poll_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let msgs: Vec<String> = {
        let guard = state.ipc_bus.lock();
        guard
            .get(&state.my_handle)
            .map(|inbox| inbox.lock().drain(..).collect())
            .unwrap_or_default()
    };

    let json   = serde_json::to_string(&msgs).unwrap_or_else(|_| "[]".to_string());
    let v8_str = v8::String::new(scope, &json).unwrap();
    rv.set(v8_str.into());
}

// â"€â"€ mDNS service discovery binding â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€â"€

/// `__glyx_mdns_discover(serviceType, timeoutMs) -> Promise<string>`
///
/// Browses for mDNS services of the given type (e.g. `"_http._tcp.local."`)
/// for up to `timeoutMs` milliseconds.  Resolves with a JSON array of:
///   `[{ name, hostname, port, addresses }]`
///
/// Requires `mdns: true` in glyx.config.json capabilities.
pub fn mdns_discover_callback(
    scope:  &mut v8::HandleScope,
    args:   v8::FunctionCallbackArguments,
    mut rv: v8::ReturnValue,
) {
    if !glyx_security::get().can_mdns() {
        rv.set(reject_cap_promise(scope, "mdns").into());
        return;
    }
    let data  = args.data().unwrap();
    let ext   = v8::Local::<v8::External>::try_from(data).unwrap();
    let state = unsafe { &*(ext.value() as *const AsyncState) };

    let service_type = v8_arg_to_string(scope, &args, 0);
    let timeout_ms   = args.get(1).number_value(scope).unwrap_or(5000.0) as u64;

    let (resolver, promise, queue_clone, redraw) = make_promise(scope, state);
    rv.set(promise.into());

    state.tokio.spawn(async move {
        let result: Result<String, String> = tokio::task::spawn_blocking(move || {
            use mdns_sd::{ServiceDaemon, ServiceEvent};
            use std::time::{Duration, Instant};

            let daemon = ServiceDaemon::new().map_err(|e| e.to_string())?;
            let receiver = daemon.browse(&service_type).map_err(|e| e.to_string())?;

            let deadline  = Instant::now() + Duration::from_millis(timeout_ms);
            let poll_step = Duration::from_millis(250);
            let mut results: Vec<serde_json::Value> = Vec::new();

            loop {
                let now = Instant::now();
                if now >= deadline { break; }
                let remaining = deadline - now;
                match receiver.recv_timeout(remaining.min(poll_step)) {
                    Ok(ServiceEvent::ServiceResolved(info)) => {
                        let addresses: Vec<String> =
                            info.get_addresses().iter().map(|a| a.to_string()).collect();
                        results.push(serde_json::json!({
                            "name":      info.get_fullname(),
                            "hostname":  info.get_hostname(),
                            "port":      info.get_port(),
                            "addresses": addresses,
                        }));
                    }
                    Ok(ServiceEvent::SearchStopped(_)) => break,
                    Ok(_) => {}
                    Err(_)  => {} // recv_timeout expired â€" check deadline at top of loop
                }
            }

            let _ = daemon.stop_browse(&service_type);
            let _ = daemon.shutdown();

            serde_json::to_string(&results).map_err(|e| e.to_string())
        })
        .await
        .map_err(|e| e.to_string())
        .and_then(|r| r);

        enqueue_completion(&queue_clone, redraw.as_ref(), Completion { resolver_ptr: resolver, result });
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    // R6: SSRF denial regression tests.

    #[test]
    fn private_ipv4_loopback_blocked() {
        assert!(is_private_host("127.0.0.1"));
        assert!(is_private_host("127.255.255.255"));
    }

    #[test]
    fn private_ipv4_rfc1918_blocked() {
        assert!(is_private_host("10.0.0.1"));
        assert!(is_private_host("172.16.0.1"));
        assert!(is_private_host("172.31.255.255"));
        assert!(is_private_host("192.168.1.100"));
    }

    #[test]
    fn private_link_local_blocked() {
        assert!(is_private_host("169.254.169.254")); // AWS IMDS
        assert!(is_private_host("169.254.0.1"));
    }

    #[test]
    fn private_ipv6_blocked() {
        assert!(is_private_host("::1"));
        assert!(is_private_host("fc00::1"));
        assert!(is_private_host("fe80::1"));
    }

    #[test]
    fn private_hostname_blocked() {
        assert!(is_private_host("localhost"));
        assert!(is_private_host("myservice.local"));
        assert!(is_private_host("db.internal"));
        assert!(is_private_host("thing.localhost"));
    }

    #[test]
    fn public_hosts_allowed() {
        assert!(!is_private_host("example.com"));
        assert!(!is_private_host("8.8.8.8"));
        assert!(!is_private_host("2001:4860:4860::8888"));
    }

    #[test]
    fn extract_host_parses_correctly() {
        assert_eq!(extract_host("https://example.com/path?q=1"), "example.com");
        assert_eq!(extract_host("https://[::1]/"), "::1");
        // reqwest::Url cases only available when fetch feature is compiled in.
        #[cfg(feature = "fetch")]
        {
            assert_eq!(extract_host("http://user:pass@example.com:8080/"), "example.com");
            assert_eq!(extract_host("not-a-url"), "");
        }
    }

    #[test]
    fn fetch_scheme_rejects_non_http() {
        assert!(check_fetch_scheme("file:///etc/passwd").is_err());
        assert!(check_fetch_scheme("ftp://example.com").is_err());
        assert!(check_fetch_scheme("javascript:alert(1)").is_err());
        assert!(check_fetch_scheme("https://example.com").is_ok());
        assert!(check_fetch_scheme("http://example.com").is_ok());
    }
}
