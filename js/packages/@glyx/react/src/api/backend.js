// @glyx-dev/react — native/plugin backend command dispatch.
import { netStart, netResponse, netFailed } from '../devNet.js';

// ── Backend command dispatch ──────────────────────────────────────────────────
//
// Calls native Rust commands registered via GlyxExtension::register_commands().
//
// Usage (JS):
//   const result = await backend.greet({ name: 'Alice' });
//
// The Rust side:
//   cmds.add("greet", |args_json| async move {
//     let v: serde_json::Value = serde_json::from_str(&args_json)?;
//     Ok(format!("\"Hello, {}!\"", v["name"].as_str().unwrap_or("world")))
//   });
//
// `backend` is a Proxy so any property access returns an async function.
// The resolved value is JSON-parsed — return a JSON string from Rust/JS plugin.
//
// Two call styles are supported:
//   backend.myCommand(args)        — flat Rust command
//   backend.db.getUsers(args)      — namespaced JS plugin command ("db.getUsers")
//
// `backend.db` returns a namespace Proxy; calling it directly also works
// (backend.db(args) dispatches "db") for backward compatibility.

function _backendCall(cmd, args) {
  var json = args === undefined ? '{}' : JSON.stringify(args);
  var netId = netStart('command', cmd, { method: 'CALL', body: json });
  return __glyx_backend_call(cmd, json).then(function(raw) {
    netResponse(netId, { statusText: 'Returned', body: raw });
    try { return JSON.parse(raw); } catch (_) { return raw; }
  }, function(e) { netFailed(netId, e); throw e; });
}

function _backendNs(prefix) {
  // A Proxy over a function so it's both callable (backend.cmd(args)) and
  // has properties (backend.ns.fn(args)).
  return new Proxy(function() {}, {
    get: function(_, fn) {
      if (typeof fn !== 'string') return undefined;
      return function(args) { return _backendCall(prefix + '.' + fn, args); };
    },
    apply: function(_, __, a) { return _backendCall(prefix, a[0]); },
  });
}

export const backend = new Proxy(Object.create(null), {
  get: function(_, name) {
    if (typeof name !== 'string') return undefined;
    return _backendNs(name);
  },
});
