//! JSON at the edges: what `glyx.settings` (both JavaScript engines), DevTools and the generated docs exchange with the registry. Behind the `json`
//! feature so the registry itself stays free of dependencies.

use crate::{Caller, Info, Kind, Safety, Scope, SetError, Settings, Source, Value};
use serde_json::{json, Value as Json};
use std::sync::{Mutex, OnceLock};

impl Value {
    pub fn to_json(&self) -> Json {
        match self {
            Value::Bool(b) => json!(b),
            Value::Int(i) => json!(i),
            Value::Str(s) => json!(s),
        }
    }

    /// A JSON boolean, whole number or string; anything else is not a setting value.
    pub fn from_json(v: &Json) -> Option<Value> {
        match v {
            Json::Bool(b) => Some(Value::Bool(*b)),
            Json::Number(n) => n.as_i64().map(Value::Int),
            Json::String(s) => Some(Value::Str(s.clone())),
            _ => None,
        }
    }
}

fn source_word(s: Source) -> &'static str {
    match s {
        Source::Env => "env",
        Source::Runtime => "runtime",
        Source::Config => "config",
        Source::Default => "default",
    }
}

impl Info {
    pub fn to_json(&self) -> Json {
        let mut o = json!({
            "name": self.name,
            "value": self.value.to_json(),
            "source": source_word(self.source),
            "default": self.default.to_json(),
            "scope": match self.scope { Scope::Startup => "startup", Scope::Live => "live" },
            "safety": match self.safety { Safety::Config => "config", Safety::Developer => "developer", Safety::App => "app" },
            "locked": self.locked,
            "appCanSet": self.app_can_set,
            "doc": self.doc,
        });
        let map = o.as_object_mut().unwrap();
        match self.kind {
            Kind::Bool => {
                map.insert("type".into(), json!("boolean"));
            }
            Kind::Int { min, max } => {
                map.insert("type".into(), json!("integer"));
                map.insert("min".into(), json!(min));
                map.insert("max".into(), json!(max));
            }
            Kind::Choice(words) => {
                map.insert("type".into(), json!("choice"));
                map.insert("choices".into(), json!(words));
            }
        }
        o
    }
}

/// Every setting as a JSON array.
pub fn list(s: &Settings) -> Json {
    Json::Array(s.list().iter().map(Info::to_json).collect())
}

fn outcome(s: &Settings, name: &str, result: Result<Value, SetError>) -> Json {
    match result {
        Ok(value) => json!({ "ok": true, "name": name, "value": value.to_json(), "source": s.source(name).map(source_word) }),
        Err(e) => json!({ "ok": false, "name": name, "error": e.to_string() }),
    }
}

/// `set` for a value given as JSON text (what the bindings receive); the answer is the JSON `{ ok, name, value, source }` or `{ ok: false, error }`.
pub fn set(s: &Settings, name: &str, value_json: &str, caller: Caller) -> Json {
    let value = serde_json::from_str::<Json>(value_json).ok().and_then(|v| Value::from_json(&v));
    match value {
        Some(v) => outcome(s, name, s.set(name, v, caller)),
        None => json!({ "ok": false, "name": name, "error": "the value must be a boolean, a whole number or a string" }),
    }
}

pub fn reset(s: &Settings, name: &str, caller: Caller) -> Json {
    outcome(s, name, s.reset(name, caller))
}

/// Changes of the global settings since the last call, as a JSON array of `{ name, value }`. The first call starts collecting, so an app that
/// never asks costs nothing; the queue is bounded.
pub fn poll_changes() -> Json {
    const MAX: usize = 256;
    static QUEUE: OnceLock<std::sync::Arc<Mutex<Vec<(String, Value)>>>> = OnceLock::new();
    let queue = QUEUE.get_or_init(|| {
        let q = std::sync::Arc::new(Mutex::new(Vec::new()));
        let writer = q.clone();
        crate::global().on_change(move |name, value| {
            let mut q = writer.lock().unwrap();
            if q.len() < MAX {
                q.push((name.to_string(), value.clone()));
            }
        });
        q
    });
    let changes = std::mem::take(&mut *queue.lock().unwrap());
    Json::Array(changes.into_iter().map(|(name, value)| json!({ "name": name, "value": value.to_json() })).collect())
}
