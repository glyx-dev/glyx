//! Glyx DevTools Protocol (GDP) domains, served from the event-loop thread.
//!
//! `glyx-devtools` owns the socket; this module answers requests against the
//! live windows. Requests are drained by [`Devtools::pump`], called from the
//! redraw handler and on `ShellEvent::Wake` (sent by the transport when a
//! request arrives), so domain code reads window state without locks.
//!
//! Enabled by `GLYX_DEVTOOLS_PORT` (`glyx dev --devtools [port]`), `dev`
//! builds only.

use std::collections::{HashMap, HashSet};
use std::sync::mpsc::Receiver;
use std::sync::Arc;

use glyx_devtools::{codes, ConnId, DevtoolsServer, ErrorBody, Handshake, Incoming, WindowInfo, PROTOCOL_VERSION};
use glyx_runtime::log_bus::{self, LogEntry};
use serde_json::{json, Value};

use crate::state::PerWindowState;

/// Every method answered here, as listed in the handshake.
pub(crate) const METHODS: &[&str] = &[
    "Runtime.handshake", "Runtime.ping", "Runtime.version", "Runtime.windows", "Runtime.evaluate",
    "Console.enable", "Console.disable",
];
pub(crate) const EVENTS: &[&str] = &["Console.messageAdded"];

pub(crate) const ENGINE: &str = if cfg!(feature = "v8") { "V8" } else { "QuickJS" };

pub(crate) struct Devtools {
    server: DevtoolsServer,
    /// Clients that sent `Console.enable`.
    console: HashSet<ConnId>,
    /// Open only while at least one client listens, so an unwatched app
    /// pays nothing for console forwarding.
    logs: Option<Receiver<LogEntry>>,
}

impl Devtools {
    /// Start when `GLYX_DEVTOOLS_PORT` is set. Logs the address and writes a
    /// discovery file (port + token) for `glyx inspect` and editors.
    pub(crate) fn start_from_env(handle: &tokio::runtime::Handle, wake: Arc<dyn Fn() + Send + Sync>) -> Option<Self> {
        let port: u16 = match std::env::var("GLYX_DEVTOOLS_PORT").ok()?.trim().parse() {
            Ok(p) => p,
            Err(_) => { log::warn!("[GDP] GLYX_DEVTOOLS_PORT is not a port number; devtools off"); return None; }
        };
        let token = std::env::var("GLYX_DEVTOOLS_TOKEN").ok()
            .filter(|t| t.len() >= 16)
            .unwrap_or_else(glyx_devtools::new_token);
        let server = match DevtoolsServer::start(handle, port, token.clone(), wake) {
            Ok(s) => s,
            Err(e) => { log::error!("[GDP] could not listen on 127.0.0.1:{port}: {e}"); return None; }
        };
        let port = server.port();
        let file = discovery_path();
        let info = json!({
            "protocolVersion": PROTOCOL_VERSION,
            "url": format!("ws://127.0.0.1:{port}/"),
            "port": port,
            "token": token,
            "pid": std::process::id(),
            "engine": ENGINE,
        });
        match std::fs::create_dir_all(file.parent().unwrap_or(std::path::Path::new(".")))
            .and_then(|_| std::fs::write(&file, serde_json::to_string_pretty(&info).unwrap_or_default()))
        {
            Ok(()) => log::info!("[GDP] devtools on ws://127.0.0.1:{port}/ (token in {})", file.display()),
            Err(e) => log::warn!("[GDP] devtools on ws://127.0.0.1:{port}/; could not write {}: {e}", file.display()),
        }
        Some(Self { server, console: HashSet::new(), logs: None })
    }

    /// Answer queued requests and forward console output.
    pub(crate) fn pump(&mut self, windows: &mut HashMap<u32, PerWindowState>) {
        for conn in self.server.take_closed() {
            self.console.remove(&conn);
        }
        for Incoming { conn, request } in self.server.poll() {
            let result = self.handle(conn, &request, windows);
            self.server.respond(conn, &request.id, result);
        }
        if self.console.is_empty() {
            self.logs = None;
        } else if let Some(rx) = &self.logs {
            for e in rx.try_iter() {
                let params = json!({ "level": e.level, "text": e.text, "timestamp": e.timestamp_ms });
                for &c in &self.console {
                    self.server.send_event(c, "Console.messageAdded", e.window_id, params.clone());
                }
            }
        }
    }

    fn handle(&mut self, conn: ConnId, req: &glyx_devtools::Request, windows: &mut HashMap<u32, PerWindowState>)
        -> Result<Value, ErrorBody>
    {
        match (req.domain.as_str(), req.method.as_str()) {
            ("Runtime", "handshake") => Ok(serde_json::to_value(Handshake {
                protocol_version: PROTOCOL_VERSION,
                engine: ENGINE.into(),
                pid: std::process::id(),
                windows: window_list(windows),
                methods: METHODS.iter().map(|s| s.to_string()).collect(),
                events: EVENTS.iter().map(|s| s.to_string()).collect(),
            }).unwrap_or(Value::Null)),
            ("Runtime", "ping") => Ok(json!({ "pong": true })),
            ("Runtime", "version") => Ok(json!({
                "protocolVersion": PROTOCOL_VERSION,
                "glyx": env!("CARGO_PKG_VERSION"),
                "engine": ENGINE,
            })),
            ("Runtime", "windows") => Ok(json!({ "windows": window_list(windows) })),
            ("Runtime", "evaluate") => {
                let expr = req.params.get("expression").and_then(Value::as_str)
                    .ok_or_else(|| ErrorBody::invalid_params("expression (string) is required"))?;
                let id = target_window(req.window_id, windows)?;
                let s = windows.get_mut(&id).expect("target_window checked it");
                let out = s.runtime.eval(&evaluate_source(expr))
                    .map_err(|e| ErrorBody::new(codes::EVAL_FAILED, e.to_string()))?;
                // Promise continuations and React commits scheduled by the
                // snippet run now; a redraw applies any UI change it made.
                s.runtime.flush_microtasks();
                s.window.request_redraw();
                parse_evaluate_result(&out)
            }
            ("Console", "enable") => {
                if self.logs.is_none() { self.logs = Some(log_bus::subscribe()); }
                self.console.insert(conn);
                Ok(json!({}))
            }
            ("Console", "disable") => {
                self.console.remove(&conn);
                Ok(json!({}))
            }
            _ => Err(ErrorBody::method_not_found(req)),
        }
    }
}

/// `$GLYX_DEVTOOLS_FILE`, else `<temp>/glyx-devtools/<pid>.json`.
fn discovery_path() -> std::path::PathBuf {
    if let Ok(p) = std::env::var("GLYX_DEVTOOLS_FILE") {
        if !p.trim().is_empty() { return p.into(); }
    }
    std::env::temp_dir().join("glyx-devtools").join(format!("{}.json", std::process::id()))
}

fn window_list(windows: &HashMap<u32, PerWindowState>) -> Vec<WindowInfo> {
    let main = windows.keys().min().copied();
    let mut list: Vec<WindowInfo> = windows.iter().map(|(&id, s)| {
        let size = s.window.inner_size();
        WindowInfo { window_id: id, title: s.window.title(), width: size.width, height: size.height, main: Some(id) == main }
    }).collect();
    list.sort_by_key(|w| w.window_id);
    list
}

/// The requested window, or the main (first-opened) one.
fn target_window(requested: Option<u32>, windows: &HashMap<u32, PerWindowState>) -> Result<u32, ErrorBody> {
    pick_window(requested, windows.keys().copied())
}

pub(crate) fn pick_window(requested: Option<u32>, open: impl Iterator<Item = u32>) -> Result<u32, ErrorBody> {
    let open: Vec<u32> = open.collect();
    match requested {
        Some(id) if open.contains(&id) => Ok(id),
        Some(id) => Err(ErrorBody::new(codes::NO_SUCH_WINDOW, format!("no window {id}"))),
        None => open.into_iter().min().ok_or_else(|| ErrorBody::new(codes::NO_SUCH_WINDOW, "no windows open")),
    }
}

/// Wrap a snippet so its completion value comes back as JSON on both
/// engines: indirect `eval` runs it at global scope (statements allowed,
/// like a console), then the value is described as `{ type, value?,
/// description }`. Values JSON can't hold (functions, cycles, `undefined`)
/// get only the description.
pub(crate) fn evaluate_source(expr: &str) -> String {
    let src = serde_json::to_string(expr).unwrap_or_else(|_| "\"\"".into());
    format!(
        "(function(){{var r=(0,eval)({src});var o={{type:r===null?'null':Array.isArray(r)?'array':typeof r}};\
         try{{var j=JSON.stringify(r);if(j!==undefined)o.value=JSON.parse(j);}}catch(e){{}}\
         try{{o.description=String(r);}}catch(e){{o.description=o.type;}}return JSON.stringify(o);}})()"
    )
}

pub(crate) fn parse_evaluate_result(out: &str) -> Result<Value, ErrorBody> {
    serde_json::from_str(out).map_err(|e| ErrorBody::new(codes::INTERNAL, format!("unreadable evaluate result: {e}")))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn requests_go_to_the_named_window_or_the_main_one() {
        assert_eq!(pick_window(None, [3, 1, 2].into_iter()), Ok(1));
        assert_eq!(pick_window(Some(2), [3, 1, 2].into_iter()), Ok(2));
        assert_eq!(pick_window(Some(9), [1].into_iter()).unwrap_err().code, codes::NO_SUCH_WINDOW);
        assert_eq!(pick_window(None, std::iter::empty()).unwrap_err().code, codes::NO_SUCH_WINDOW);
    }

    #[test]
    fn the_evaluate_wrapper_embeds_the_snippet_as_a_string_literal() {
        let src = evaluate_source("\"quoted\" + '\\n' </script>");
        assert!(src.contains(r#"(0,eval)("\"quoted\" + '\\n' </script>")"#), "{src}");
        let v = parse_evaluate_result(r#"{"type":"number","value":2,"description":"2"}"#).unwrap();
        assert_eq!(v["value"], 2);
        assert_eq!(parse_evaluate_result("nope").unwrap_err().code, codes::INTERNAL);
    }

    #[test]
    fn the_handshake_lists_every_method_this_module_answers() {
        for m in ["Runtime.handshake", "Runtime.evaluate", "Console.enable"] {
            assert!(METHODS.contains(&m), "{m}");
        }
        assert_eq!(EVENTS, ["Console.messageAdded"]);
    }
}
