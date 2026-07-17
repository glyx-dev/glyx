//! `__glyx_fetch`/`ws_*`/`mdns_discover` — network bindings, ported from
//! `bind_net.rs`'s V8 implementations. Same shape as the other quickjs_*
//! modules; reuses the SSRF-hardening helpers (`extract_host`,
//! `is_private_host`, `check_fetch_scheme`, `check_ws_scheme`,
//! `safe_http_client`) moved to `bindings/mod.rs`'s shared section.

use std::collections::{HashMap, VecDeque};
use std::sync::Arc;
use std::sync::atomic::{AtomicU32, Ordering};
use parking_lot::Mutex;
use rquickjs::Ctx;
use tokio::runtime::Handle;

use crate::bindings::{
    check_fetch_scheme, extract_host, is_private_host, CompletionQueue, RedrawRequest,
};
use crate::quickjs_runtime::QuickJsRuntime;

#[cfg(feature = "websocket")]
use crate::bindings::{check_ws_scheme, WsHandle};

#[cfg(feature = "websocket")]
pub(crate) type WsHandles = Arc<Mutex<HashMap<u32, WsHandle>>>;

/// Checks common to fetch and ws.connect: scheme → private-IP → capability.
/// Returns `Some(rejected promise)` if any check fails, `None` to proceed.
fn network_precheck<'js>(
    ctx: &Ctx<'js>, url: &str, scheme_ok: Result<(), String>, action: &str,
) -> Option<rquickjs::Result<rquickjs::Promise<'js>>> {
    if let Err(e) = scheme_ok {
        return Some(QuickJsRuntime::reject_now(ctx, e));
    }
    let host = extract_host(url);
    if is_private_host(&host) {
        return Some(QuickJsRuntime::reject_now(ctx, format!(
            "{action}: host {host:?} is a private/loopback address (SSRF denied)"
        )));
    }
    if !glyx_security::get().can_network(&host) {
        return Some(QuickJsRuntime::reject_now(ctx, format!(
            "network.allow[\"{host}\"] — add to glyx.config.json under \"capabilities\": \
             {{ \"network\": {{ \"allow\": [\"{host}\"] }} }}"
        )));
    }
    None
}

#[cfg(feature = "fetch")]
pub(crate) fn fetch<'js>(
    ctx: Ctx<'js>, url: String, options_json: String,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if let Some(rejected) = network_precheck(&ctx, &url, check_fetch_scheme(&url), "fetch") {
        return rejected;
    }
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        use base64::Engine;
        let opts: serde_json::Value = serde_json::from_str(&options_json).unwrap_or(serde_json::Value::Null);
        let method = opts.get("method").and_then(|m| m.as_str()).unwrap_or("GET").to_ascii_uppercase();
        let client = crate::bindings::safe_http_client()?;
        let mut builder = match method.as_str() {
            "POST" => client.post(&url), "PUT" => client.put(&url), "PATCH" => client.patch(&url),
            "DELETE" => client.delete(&url), "HEAD" => client.head(&url), _ => client.get(&url),
        };
        if let Some(hdrs) = opts.get("headers").and_then(|h| h.as_object()) {
            for (k, v) in hdrs {
                if let Some(val) = v.as_str() { builder = builder.header(k.as_str(), val); }
            }
        }
        if let Some(parts) = opts.get("multipart").and_then(|m| m.as_array()) {
            let mut form = reqwest::multipart::Form::new();
            for part_val in parts {
                let name = part_val.get("name").and_then(|n| n.as_str()).unwrap_or("field").to_owned();
                if let Some(b64) = part_val.get("base64").and_then(|b| b.as_str()) {
                    let bytes = base64::engine::general_purpose::STANDARD.decode(b64)
                        .map_err(|e| format!("multipart base64 decode: {e}"))?;
                    let mime = part_val.get("contentType").and_then(|c| c.as_str()).unwrap_or("application/octet-stream").to_owned();
                    let filename = part_val.get("filename").and_then(|f| f.as_str()).unwrap_or("file").to_owned();
                    let mut part = reqwest::multipart::Part::bytes(bytes).file_name(filename);
                    part = part.mime_str(&mime).map_err(|e| e.to_string())?;
                    form = form.part(name, part);
                } else {
                    let value = part_val.get("value").and_then(|v| v.as_str()).unwrap_or("").to_owned();
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
            builder = builder.body(body.to_owned());
        }
        let response = builder.send().await.map_err(|e| e.to_string())?;
        let status = response.status().as_u16();
        let ok = (200u16..300).contains(&status);
        let status_text = response.status().canonical_reason().unwrap_or("").to_owned();
        let mut resp_headers = serde_json::Map::new();
        for (k, v) in response.headers() {
            if let Ok(val) = v.to_str() { resp_headers.insert(k.to_string(), serde_json::Value::String(val.to_owned())); }
        }
        let body = response.text().await.map_err(|e| e.to_string())?;
        serde_json::to_string(&serde_json::json!({
            "status": status, "ok": ok, "statusText": status_text, "headers": resp_headers, "body": body,
        })).map_err(|e| e.to_string())
    })
}

#[cfg(feature = "websocket")]
pub(crate) fn ws_connect<'js>(
    ctx: Ctx<'js>, url: String, handles: WsHandles, next_id: Arc<AtomicU32>,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if let Some(rejected) = network_precheck(&ctx, &url, check_ws_scheme(&url), "ws.connect") {
        return rejected;
    }
    let handle = next_id.fetch_add(1, Ordering::Relaxed);
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        use futures_util::{SinkExt, StreamExt};
        use tokio_tungstenite::tungstenite::Message as WsMessage;
        let (ws_stream, _) = tokio_tungstenite::connect_async(&url).await
            .map_err(|e| format!("WebSocket connect failed: {e}"))?;
        let (mut sink, mut stream) = ws_stream.split();
        let inbox = Arc::new(Mutex::new(VecDeque::<String>::new()));
        let (outbox_tx, mut outbox_rx) = tokio::sync::mpsc::unbounded_channel::<String>();
        let inbox_read = Arc::clone(&inbox);
        tokio::spawn(async move {
            while let Some(msg) = stream.next().await {
                match msg {
                    Ok(WsMessage::Text(text)) => inbox_read.lock().push_back(text.to_string()),
                    Ok(WsMessage::Close(_)) | Err(_) => {
                        inbox_read.lock().push_back("__GLYX_WS_CLOSED__".to_string());
                        break;
                    }
                    _ => {}
                }
            }
            inbox_read.lock().push_back("__GLYX_WS_CLOSED__".to_string());
        });
        tokio::spawn(async move {
            while let Some(msg) = outbox_rx.recv().await {
                if sink.send(WsMessage::Text(msg)).await.is_err() { break; }
            }
            let _ = sink.close().await;
        });
        handles.lock().insert(handle, WsHandle { outbox_tx, inbox });
        Ok(handle.to_string())
    })
}

pub(crate) fn mdns_discover<'js>(
    ctx: Ctx<'js>, service_type: String, timeout_ms: u64,
    queue: CompletionQueue, tokio: Handle, redraw: Option<RedrawRequest>,
) -> rquickjs::Result<rquickjs::Promise<'js>> {
    if !glyx_security::get().can_mdns() {
        return QuickJsRuntime::reject_now(&ctx,
            "Capability required: mdns — add it to glyx.config.json under \"capabilities\"".to_string());
    }
    QuickJsRuntime::spawn_async(&ctx, queue, &tokio, redraw, async move {
        tokio::task::spawn_blocking(move || {
            use mdns_sd::{ServiceDaemon, ServiceEvent};
            use std::time::{Duration, Instant};
            let daemon = ServiceDaemon::new().map_err(|e| e.to_string())?;
            let receiver = daemon.browse(&service_type).map_err(|e| e.to_string())?;
            let deadline = Instant::now() + Duration::from_millis(timeout_ms);
            let poll_step = Duration::from_millis(250);
            let mut results: Vec<serde_json::Value> = Vec::new();
            loop {
                let now = Instant::now();
                if now >= deadline { break; }
                let remaining = deadline - now;
                match receiver.recv_timeout(remaining.min(poll_step)) {
                    Ok(ServiceEvent::ServiceResolved(info)) => {
                        let addresses: Vec<String> = info.get_addresses().iter().map(|a| a.to_string()).collect();
                        results.push(serde_json::json!({
                            "name": info.get_fullname(), "hostname": info.get_hostname(),
                            "port": info.get_port(), "addresses": addresses,
                        }));
                    }
                    Ok(ServiceEvent::SearchStopped(_)) => break,
                    Ok(_) => {}
                    Err(_) => {}
                }
            }
            let _ = daemon.stop_browse(&service_type);
            let _ = daemon.shutdown();
            serde_json::to_string(&results).map_err(|e| e.to_string())
        }).await.map_err(|e| e.to_string()).and_then(|r| r)
    })
}
