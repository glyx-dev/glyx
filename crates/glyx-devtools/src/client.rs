//! A GDP client for tools (the `glyx mcp` server, scripts): find running
//! apps from their discovery files, connect with the token handshake, and
//! call methods.

use std::path::PathBuf;
use std::time::Duration;

use futures_util::{SinkExt, StreamExt};
use serde_json::{json, Value};
use tokio_tungstenite::tungstenite::Message;

use crate::protocol::ErrorBody;
use crate::relay::{self, AppInfo, AppSocket};

/// Apps really running, from discovery files or folders (checked with a
/// handshake, like the relay does).
pub async fn live_apps(paths: &[PathBuf]) -> Vec<AppInfo> {
    let mut out: Vec<AppInfo> = Vec::new();
    for app in relay::scan(paths) {
        if out.iter().any(|a| a.port == app.port && a.pid == app.pid) { continue; }
        if relay::is_that_app(&app).await { out.push(app); }
    }
    out
}

/// One authenticated connection to an app.
pub struct GdpClient {
    ws: AppSocket,
    next_id: u64,
    pub app: AppInfo,
    /// The handshake reply: `engine`, `pid`, `windows`, `methods`, `events`.
    pub handshake: Value,
}

impl GdpClient {
    pub async fn connect(app: AppInfo) -> Result<Self, String> {
        let (ws, handshake) = relay::connect_app(&app).await?;
        Ok(Self { ws, next_id: 0, app, handshake })
    }

    /// Call `"Domain.method"`. The outer error is the connection (lost,
    /// timed out); the inner one is the app's answer.
    pub async fn call(&mut self, name: &str, params: Value, window_id: Option<u32>, timeout: Duration)
        -> Result<Result<Value, ErrorBody>, String>
    {
        let (domain, method) = name.split_once('.').ok_or_else(|| format!("{name:?} isn't \"Domain.method\""))?;
        self.next_id += 1;
        let id = self.next_id;
        let mut req = json!({ "id": id, "domain": domain, "method": method, "params": params });
        if let Some(w) = window_id { req["windowId"] = json!(w); }
        self.ws.send(Message::Text(req.to_string())).await.map_err(|e| format!("connection lost: {e}"))?;
        let reply = tokio::time::timeout(timeout, async {
            while let Some(msg) = self.ws.next().await {
                let Ok(Message::Text(t)) = msg else {
                    if msg.is_err() { return Err("connection lost".to_string()); }
                    continue;
                };
                let Ok(v) = serde_json::from_str::<Value>(&t) else { continue };
                if v.get("id").and_then(Value::as_u64) != Some(id) { continue; } // events, other replies
                return Ok(v);
            }
            Err("connection closed".to_string())
        }).await.map_err(|_| format!("{name} timed out"))??;
        if let Some(e) = reply.get("error") {
            return Ok(Err(serde_json::from_value(e.clone()).unwrap_or_else(|_| ErrorBody::new(-1, e.to_string()))));
        }
        Ok(Ok(reply.get("result").cloned().unwrap_or(Value::Null)))
    }
}
