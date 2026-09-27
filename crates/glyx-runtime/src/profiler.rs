//! JavaScript CPU profiling for Glyx DevTools (V8, dev builds).
//!
//! rusty_v8 has no direct CPU-profiler API, but the V8 inspector does: its
//! `Profiler` domain samples the JS stack and returns a standard
//! `cpuProfile` (the format Chrome DevTools reads). This opens a private
//! inspector session on the window's isolate, used only to start and stop
//! profiles. Calls are synchronous: V8 answers during `dispatch`.

use std::sync::Arc;

use parking_lot::Mutex;

/// Captures the session's replies (notifications are ignored).
struct Replies(Arc<Mutex<Vec<String>>>);

impl v8::inspector::ChannelImpl for Replies {
    fn send_response(&self, _call_id: i32, message: v8::UniquePtr<v8::inspector::StringBuffer>) {
        if let Some(chars) = message.as_ref().and_then(|b| b.string().characters16().map(String::from_utf16_lossy)) {
            self.0.lock().push(chars);
        } else if let Some(buf) = message.as_ref() {
            // 8-bit strings (ASCII-only replies).
            if let Some(bytes) = buf.string().characters8() {
                self.0.lock().push(String::from_utf8_lossy(bytes).into_owned());
            }
        }
    }
    fn send_notification(&self, _message: v8::UniquePtr<v8::inspector::StringBuffer>) {}
    fn flush_protocol_notifications(&self) {}
}

/// Never pauses: this session doesn't debug.
struct Client;
impl v8::inspector::V8InspectorClientImpl for Client {}

/// Fields in drop order: the session borrows from the inspector.
pub struct JsProfiler {
    session: v8::inspector::V8InspectorSession,
    #[allow(dead_code)]
    inspector: v8::inspector::V8Inspector,
    replies: Arc<Mutex<Vec<String>>>,
    next_id: i32,
    pub recording: bool,
}

impl JsProfiler {
    pub fn new(isolate: &mut v8::OwnedIsolate, context: &v8::Global<v8::Context>) -> Self {
        let replies = Arc::new(Mutex::new(Vec::new()));
        let channel = v8::inspector::Channel::new(Box::new(Replies(Arc::clone(&replies))));
        let client = v8::inspector::V8InspectorClient::new(Box::new(Client));
        let (inspector, session) = {
            v8::scope!(let scope, isolate);
            let ctx = v8::Local::new(scope, context);
            let inspector = v8::inspector::V8Inspector::create(scope, client);
            inspector.context_created(ctx, 1, v8::inspector::StringView::from("glyx".as_bytes()), v8::inspector::StringView::empty());
            let session = inspector.connect(
                1, channel, v8::inspector::StringView::from("{}".as_bytes()),
                v8::inspector::V8InspectorClientTrustLevel::FullyTrusted,
            );
            (inspector, session)
        };
        Self { session, inspector, replies, next_id: 0, recording: false }
    }

    /// Send one `Profiler.*` command; returns its `result`, or the error.
    fn call(
        &mut self, isolate: &mut v8::OwnedIsolate, context: &v8::Global<v8::Context>,
        method: &str, params: serde_json::Value,
    ) -> Result<serde_json::Value, String> {
        self.next_id += 1;
        let id = self.next_id;
        let msg = serde_json::json!({ "id": id, "method": method, "params": params }).to_string();
        {
            v8::scope_with_context!(let _scope, isolate, context);
            self.session.dispatch_protocol_message(v8::inspector::StringView::from(msg.as_bytes()));
        }
        let replies = std::mem::take(&mut *self.replies.lock());
        for r in replies {
            let v: serde_json::Value = serde_json::from_str(&r).map_err(|e| e.to_string())?;
            if v.get("id").and_then(|x| x.as_i64()) != Some(id as i64) { continue; }
            if let Some(err) = v.get("error") {
                return Err(err.get("message").and_then(|m| m.as_str()).unwrap_or("profiler error").to_string());
            }
            return Ok(v.get("result").cloned().unwrap_or(serde_json::Value::Null));
        }
        Err(format!("{method}: no reply"))
    }

    /// Start sampling every `interval_us` microseconds.
    pub fn start(&mut self, isolate: &mut v8::OwnedIsolate, context: &v8::Global<v8::Context>, interval_us: u32) -> Result<(), String> {
        if self.recording { return Err("already recording".into()); }
        self.call(isolate, context, "Profiler.enable", serde_json::json!({}))?;
        self.call(isolate, context, "Profiler.setSamplingInterval", serde_json::json!({ "interval": interval_us.max(50) }))?;
        self.call(isolate, context, "Profiler.start", serde_json::json!({}))?;
        self.recording = true;
        Ok(())
    }

    /// Stop and return the `cpuProfile` (nodes, startTime, endTime, samples, timeDeltas).
    pub fn stop(&mut self, isolate: &mut v8::OwnedIsolate, context: &v8::Global<v8::Context>) -> Result<serde_json::Value, String> {
        if !self.recording { return Err("not recording".into()); }
        self.recording = false;
        let result = self.call(isolate, context, "Profiler.stop", serde_json::json!({}))?;
        let _ = self.call(isolate, context, "Profiler.disable", serde_json::json!({}));
        result.get("profile").cloned().ok_or_else(|| "Profiler.stop returned no profile".into())
    }
}
