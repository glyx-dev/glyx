//! GDP Network domain: the request list behind the DevTools Network panel.
//!
//! The JS networking layer reports each step (see `@glyx/react`'s
//! `devNet.js`) through `glyx_runtime::net_bus`. Here those steps become one
//! record per fetch, WebSocket, IPC channel or backend command, kept in a
//! bounded list. Bodies are the costly part, so they share a byte budget:
//! past it, the oldest records lose their bodies (their timing and headers
//! stay).

use std::collections::{HashMap, VecDeque};

use serde_json::{json, Value};

/// Records kept.
const MAX_RECORDS: usize = 1000;
/// Messages kept per socket / IPC channel (the newest).
const MAX_FRAMES: usize = 500;
/// Body and message bytes kept across all records.
const BODY_BUDGET: usize = 32 * 1024 * 1024;

struct Frame {
    dir: String,
    data: String,
    size: u64,
    ts: u64,
}

struct Record {
    key: String,
    window: Option<u32>,
    /// Bumped on every change, for `getRequests { since }`.
    seq: u64,
    kind: String,
    method: Option<String>,
    url: String,
    state: &'static str,
    start: u64,
    end: Option<u64>,
    status: Option<u64>,
    status_text: Option<String>,
    error: Option<String>,
    req_headers: Value,
    req_body: Option<String>,
    req_size: u64,
    res_headers: Value,
    res_body: Option<String>,
    res_size: u64,
    frames: VecDeque<Frame>,
    frames_total: u64,
    frame_bytes: u64,
    bodies_dropped: bool,
}

impl Record {
    fn body_bytes(&self) -> usize {
        self.req_body.as_ref().map_or(0, String::len)
            + self.res_body.as_ref().map_or(0, String::len)
            + self.frames.iter().map(|f| f.data.len()).sum::<usize>()
    }

    fn summary(&self) -> Value {
        json!({
            "key": self.key, "windowId": self.window, "seq": self.seq,
            "kind": self.kind, "method": self.method, "url": self.url, "state": self.state,
            "start": self.start, "end": self.end,
            "duration": self.end.map(|e| e.saturating_sub(self.start)),
            "status": self.status, "statusText": self.status_text, "error": self.error,
            "requestSize": self.req_size, "responseSize": self.res_size,
            "messages": self.frames_total, "messageBytes": self.frame_bytes,
            "contentType": content_type(&self.res_headers),
        })
    }

    fn detail(&self) -> Value {
        let mut v = self.summary();
        let o = v.as_object_mut().expect("summary is an object");
        o.insert("requestHeaders".into(), self.req_headers.clone());
        o.insert("requestBody".into(), json!(self.req_body));
        o.insert("responseHeaders".into(), self.res_headers.clone());
        o.insert("responseBody".into(), json!(self.res_body));
        o.insert("bodiesDropped".into(), json!(self.bodies_dropped));
        o.insert("frames".into(), self.frames.iter()
            .map(|f| json!({ "dir": f.dir, "data": f.data, "size": f.size, "ts": f.ts }))
            .collect::<Vec<_>>().into());
        v
    }
}

fn content_type(headers: &Value) -> Option<String> {
    headers.as_object()?.iter()
        .find(|(k, _)| k.eq_ignore_ascii_case("content-type"))
        .and_then(|(_, v)| v.as_str()).map(str::to_string)
}

#[derive(Default)]
pub(crate) struct NetLog {
    records: HashMap<String, Record>,
    /// Keys, oldest first.
    order: VecDeque<String>,
    seq: u64,
    body_bytes: usize,
}

impl NetLog {
    pub(crate) fn last_seq(&self) -> u64 { self.seq }

    /// Apply one event from JS; returns the changed record's summary.
    pub(crate) fn apply(&mut self, window: Option<u32>, raw: &str) -> Option<Value> {
        let e: Value = serde_json::from_str(raw).ok()?;
        let id = e.get("id")?.as_u64()?;
        let key = format!("{}:{id}", window.map_or_else(|| "?".to_string(), |w| w.to_string()));
        let ts = e.get("ts").and_then(Value::as_u64).unwrap_or(0);
        let s = |k: &str| e.get(k).and_then(Value::as_str).map(str::to_string);
        let size = e.get("size").and_then(Value::as_u64).unwrap_or(0);

        if e.get("t")?.as_str()? == "request" {
            self.remove(&key);
            if self.order.len() == MAX_RECORDS {
                if let Some(old) = self.order.front().cloned() { self.remove(&old); }
            }
            let kind = s("kind").unwrap_or_else(|| "fetch".into());
            let body = s("body");
            self.body_bytes += body.as_ref().map_or(0, String::len);
            self.records.insert(key.clone(), Record {
                key: key.clone(), window, seq: 0,
                state: if kind == "ipc" { "open" } else { "pending" },
                kind, method: s("method"), url: s("url").unwrap_or_default(),
                start: ts, end: None, status: None, status_text: None, error: None,
                req_headers: e.get("headers").cloned().unwrap_or(Value::Null),
                req_body: body, req_size: size,
                res_headers: Value::Null, res_body: None, res_size: 0,
                frames: VecDeque::new(), frames_total: 0, frame_bytes: 0, bodies_dropped: false,
            });
            self.order.push_back(key.clone());
        } else {
            // A socket or IPC channel whose record was cleared: its events
            // name it, so start a fresh record from here.
            if !self.records.contains_key(&key) {
                let (Some(kind), Some(url)) = (s("kind"), s("url")) else { return None };
                if self.order.len() == MAX_RECORDS {
                    if let Some(old) = self.order.front().cloned() { self.remove(&old); }
                }
                self.records.insert(key.clone(), Record {
                    key: key.clone(), window, seq: 0, state: "open", kind, method: None, url,
                    start: ts, end: None, status: None, status_text: None, error: None,
                    req_headers: Value::Null, req_body: None, req_size: 0,
                    res_headers: Value::Null, res_body: None, res_size: 0,
                    frames: VecDeque::new(), frames_total: 0, frame_bytes: 0, bodies_dropped: false,
                });
                self.order.push_back(key.clone());
            }
            let r = self.records.get_mut(&key)?;
            let before = r.body_bytes();
            match e.get("t")?.as_str()? {
                "response" => {
                    r.state = "done";
                    r.end = Some(ts);
                    r.status = e.get("status").and_then(Value::as_u64);
                    r.status_text = s("statusText");
                    r.res_headers = e.get("headers").cloned().unwrap_or(Value::Null);
                    r.res_body = s("body");
                    r.res_size = size;
                }
                "open" => { r.state = "open"; r.status_text = Some("Connected".into()); }
                "frame" => {
                    r.frames_total += 1;
                    r.frame_bytes += size;
                    if r.frames.len() == MAX_FRAMES { r.frames.pop_front(); }
                    r.frames.push_back(Frame { dir: s("dir").unwrap_or_default(), data: s("data").unwrap_or_default(), size, ts });
                }
                "closed" => { r.state = "closed"; r.end = Some(ts); }
                "failed" => { r.state = "failed"; r.end = Some(ts); r.error = s("error"); }
                _ => return None,
            }
            let after = r.body_bytes();
            self.body_bytes = (self.body_bytes + after).saturating_sub(before);
        }
        self.seq += 1;
        let r = self.records.get_mut(&key)?;
        r.seq = self.seq;
        let summary = r.summary();
        self.enforce_budget(&key);
        Some(summary)
    }

    fn remove(&mut self, key: &str) {
        if let Some(r) = self.records.remove(key) {
            self.body_bytes = self.body_bytes.saturating_sub(r.body_bytes());
            self.order.retain(|k| k != key);
        }
    }

    /// Drop the oldest bodies until under budget (never the record just changed).
    fn enforce_budget(&mut self, keep: &str) {
        let mut i = 0;
        while self.body_bytes > BODY_BUDGET && i < self.order.len() {
            let k = &self.order[i];
            i += 1;
            if k == keep { continue; }
            let Some(r) = self.records.get_mut(k) else { continue };
            let freed = r.body_bytes();
            if freed == 0 { continue; }
            r.req_body = None;
            r.res_body = None;
            for f in &mut r.frames { f.data.clear(); }
            r.bodies_dropped = true;
            self.body_bytes = self.body_bytes.saturating_sub(freed);
        }
    }

    /// Summaries of records changed after `since`, oldest first.
    pub(crate) fn list(&self, since: u64) -> Vec<Value> {
        self.order.iter().filter_map(|k| self.records.get(k)).filter(|r| r.seq > since).map(Record::summary).collect()
    }

    pub(crate) fn detail(&self, key: &str) -> Option<Value> {
        self.records.get(key).map(Record::detail)
    }

    pub(crate) fn clear(&mut self) {
        self.records.clear();
        self.order.clear();
        self.body_bytes = 0;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_fetch_becomes_one_record_with_timing_and_bodies() {
        let mut log = NetLog::default();
        log.apply(Some(1), r#"{"t":"request","id":1,"kind":"fetch","method":"POST","url":"https://api.example.com/x","headers":{"a":"b"},"body":"hi","size":2,"ts":1000}"#).unwrap();
        let s = log.apply(Some(1), r#"{"t":"response","id":1,"status":201,"statusText":"Created","headers":{"Content-Type":"application/json"},"body":"{}","size":2,"ts":1045}"#).unwrap();
        assert_eq!(s["state"], "done");
        assert_eq!(s["duration"], 45);
        assert_eq!(s["contentType"], "application/json");
        let d = log.detail("1:1").unwrap();
        assert_eq!(d["requestBody"], "hi");
        assert_eq!(d["responseBody"], "{}");
        assert_eq!(log.list(0).len(), 1);
        assert!(log.list(log.last_seq()).is_empty());
    }

    #[test]
    fn sockets_collect_messages_and_close() {
        let mut log = NetLog::default();
        log.apply(Some(1), r#"{"t":"request","id":2,"kind":"websocket","url":"wss://x","ts":1}"#);
        log.apply(Some(1), r#"{"t":"open","id":2,"ts":2}"#);
        log.apply(Some(1), r#"{"t":"frame","id":2,"dir":"out","data":"ping","size":4,"ts":3}"#);
        log.apply(Some(1), r#"{"t":"frame","id":2,"dir":"in","data":"pong","size":4,"ts":4}"#);
        let s = log.apply(Some(1), r#"{"t":"closed","id":2,"ts":9}"#).unwrap();
        assert_eq!((s["state"].as_str(), s["messages"].as_u64(), s["messageBytes"].as_u64()), (Some("closed"), Some(2), Some(8)));
        assert_eq!(log.detail("1:2").unwrap()["frames"][1]["data"], "pong");
        // Same id from another window is a different record; unknown ids are ignored…
        assert!(log.apply(Some(2), r#"{"t":"open","id":2,"ts":2}"#).is_none());
        // …unless the event names its channel (a socket or IPC record that was cleared).
        log.clear();
        let s = log.apply(Some(1), r#"{"t":"frame","id":7,"dir":"in","data":"x","size":1,"kind":"ipc","url":"received","ts":5}"#).unwrap();
        assert_eq!((s["kind"].as_str(), s["url"].as_str(), s["messages"].as_u64()), (Some("ipc"), Some("received"), Some(1)));
        assert!(log.apply(Some(1), "not json").is_none());
    }

    #[test]
    fn old_bodies_are_dropped_past_the_budget() {
        let mut log = NetLog::default();
        let big = "x".repeat(BODY_BUDGET / 2 + 1);
        for id in 1..=3 {
            log.apply(Some(1), &json!({ "t": "request", "id": id, "url": "u", "ts": 0 }).to_string());
            log.apply(Some(1), &json!({ "t": "response", "id": id, "status": 200, "body": big, "size": big.len(), "ts": 1 }).to_string());
        }
        assert!(log.body_bytes <= BODY_BUDGET);
        assert_eq!(log.detail("1:1").unwrap()["bodiesDropped"], true);
        assert_eq!(log.detail("1:3").unwrap()["responseBody"].as_str().map(str::len), Some(big.len()));
        assert_eq!(log.detail("1:1").unwrap()["status"], 200); // timing and status stay
    }
}
