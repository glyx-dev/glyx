//! GDP message shapes.
//!
//! Request:  `{ "ver"?, "id", "windowId"?, "domain", "method", "params"? }`
//! Response: `{ "id", "result" }` or `{ "id", "error": { "code", "message" } }`
//! Event:    `{ "event": "Domain.name", "windowId"?, "params" }`
//!
//! `id` is echoed back untouched (any JSON value), so clients can use numbers
//! or strings. `windowId` picks the window a request is about; when it's
//! missing, domains fall back to the main window.

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

/// Bumped on breaking changes to the envelope or an existing method.
pub const PROTOCOL_VERSION: u32 = 1;

/// Default port (CDP keeps 9229).
pub const DEFAULT_PORT: u16 = 9228;

#[derive(Debug, Clone, Deserialize)]
pub struct Request {
    #[serde(default)]
    pub ver: Option<u32>,
    pub id: Value,
    #[serde(rename = "windowId", default)]
    pub window_id: Option<u32>,
    pub domain: String,
    pub method: String,
    #[serde(default)]
    pub params: Value,
}

impl Request {
    /// `"Domain.method"`, for matching and messages.
    pub fn name(&self) -> String {
        format!("{}.{}", self.domain, self.method)
    }
}

/// JSON-RPC-style error codes, plus GDP-specific ones below -32000.
pub mod codes {
    pub const PARSE_ERROR:      i32 = -32700;
    pub const INVALID_REQUEST:  i32 = -32600;
    pub const METHOD_NOT_FOUND: i32 = -32601;
    pub const INVALID_PARAMS:   i32 = -32602;
    pub const INTERNAL:         i32 = -32603;
    /// No handshake yet, or the handshake token was wrong.
    pub const UNAUTHORIZED:     i32 = -32001;
    /// `windowId` names no open window.
    pub const NO_SUCH_WINDOW:   i32 = -32002;
    /// `Runtime.evaluate` threw or failed to compile.
    pub const EVAL_FAILED:      i32 = -32003;
    /// `nodeId` names no node in that window.
    pub const NO_SUCH_NODE:     i32 = -32004;
    /// `Automation.waitFor` ran out of time.
    pub const TIMEOUT:          i32 = -32005;
    /// Not available in this build or on this renderer (e.g. screenshots
    /// on a GPU renderer).
    pub const UNSUPPORTED:      i32 = -32006;
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct ErrorBody {
    pub code: i32,
    pub message: String,
}

impl ErrorBody {
    pub fn new(code: i32, message: impl Into<String>) -> Self {
        Self { code, message: message.into() }
    }
    pub fn method_not_found(req: &Request) -> Self {
        Self::new(codes::METHOD_NOT_FOUND, format!("unknown method {}", req.name()))
    }
    pub fn invalid_params(message: impl Into<String>) -> Self {
        Self::new(codes::INVALID_PARAMS, message)
    }
}

pub fn response(id: &Value, result: Result<Value, ErrorBody>) -> String {
    match result {
        Ok(r)  => json!({ "id": id, "result": r }).to_string(),
        Err(e) => json!({ "id": id, "error": e }).to_string(),
    }
}

pub fn event(name: &str, window_id: Option<u32>, params: Value) -> String {
    match window_id {
        Some(w) => json!({ "event": name, "windowId": w, "params": params }).to_string(),
        None    => json!({ "event": name, "params": params }).to_string(),
    }
}

/// A window, as listed by the handshake and `Runtime.windows`.
#[derive(Debug, Clone, Serialize)]
pub struct WindowInfo {
    #[serde(rename = "windowId")]
    pub window_id: u32,
    pub title: String,
    pub width: u32,
    pub height: u32,
    /// The first window the app opened.
    pub main: bool,
}

/// `Runtime.handshake` result.
#[derive(Debug, Clone, Serialize)]
pub struct Handshake {
    #[serde(rename = "protocolVersion")]
    pub protocol_version: u32,
    /// `"V8"` or `"QuickJS"`.
    pub engine: String,
    pub pid: u32,
    pub windows: Vec<WindowInfo>,
    /// Every `"Domain.method"` this process answers. Clients check this
    /// instead of assuming (QuickJS has no Debugger, GPU renderers no
    /// screenshots, and so on).
    pub methods: Vec<String>,
    /// Every event this process can send.
    pub events: Vec<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requests_parse_with_optional_fields() {
        let r: Request = serde_json::from_str(
            r#"{"id":7,"domain":"Runtime","method":"ping"}"#).unwrap();
        assert_eq!(r.name(), "Runtime.ping");
        assert_eq!(r.window_id, None);
        assert!(r.params.is_null());

        let r: Request = serde_json::from_str(
            r#"{"ver":1,"id":"a","windowId":2,"domain":"Runtime","method":"evaluate","params":{"expression":"1+1"}}"#).unwrap();
        assert_eq!(r.window_id, Some(2));
        assert_eq!(r.params["expression"], "1+1");
    }

    #[test]
    fn responses_and_events_have_the_documented_shape() {
        let ok: Value = serde_json::from_str(&response(&json!(3), Ok(json!({"pong": true})))).unwrap();
        assert_eq!(ok, json!({ "id": 3, "result": { "pong": true } }));

        let err: Value = serde_json::from_str(&response(&json!("x"),
            Err(ErrorBody::new(codes::UNAUTHORIZED, "no")))).unwrap();
        assert_eq!(err, json!({ "id": "x", "error": { "code": -32001, "message": "no" } }));

        let ev: Value = serde_json::from_str(&event("Console.messageAdded", Some(1), json!({"text": "hi"}))).unwrap();
        assert_eq!(ev, json!({ "event": "Console.messageAdded", "windowId": 1, "params": { "text": "hi" } }));
    }
}
