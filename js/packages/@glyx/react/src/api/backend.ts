// @glyx-dev/react — native/plugin backend command dispatch.
import { netActive, netStart, netResponse, netFailed } from '../devNet.js';

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
//
// What goes in and what comes out depends on where the command lives:
//   * A Rust command takes and returns JSON. The arguments are stringified for it, and the
//     JSON string it returns is parsed back into a value.
//   * A JS plugin command (`backend.ns.fn`) runs in this same JavaScript heap, so nothing is
//     serialized: it gets exactly the value you passed (an object stays the same object; a
//     Uint8Array, Date or undefined survive) and what it returns comes back as it is (a string
//     result stays a string, even one like "123" or "true").
//   A call with no argument passes `{}`.
//
// Two call styles are supported:
//   backend.myCommand(args)        — flat Rust command
//   backend.db.getUsers(args)      — namespaced JS plugin command ("db.getUsers")
//
// `backend.db` returns a namespace Proxy; calling it directly also works
// (backend.db(args) dispatches "db") for backward compatibility.

/** JSON for DevTools' request log; never throws (a cyclic argument just isn't shown). */
function _safeJson(v: unknown): string | undefined {
  try { return JSON.stringify(v); } catch (_) { return undefined; }
}

function _parseRaw(raw: unknown) {
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch (_) { return raw; }
}

function _backendCall(cmd: string, args: any) {
  var arg = args === undefined ? {} : args;
  var netId = netActive() ? netStart('command', cmd, { method: 'CALL', body: _safeJson(arg) }) : 0;

  var result: Promise<any>;
  if (typeof __glyx_backend_call2 === 'function') {
    // The runner can pass values straight through (no JSON round trip for JS plugins).
    var ret: any;
    try { ret = __glyx_backend_call2(cmd, arg); }
    catch (e) { netFailed(netId, e); return Promise.reject(e); }
    // The runner marks the promise of a Rust command: it resolves with that command's JSON string.
    result = ret && ret.__glyxRaw ? ret.then(_parseRaw) : Promise.resolve(ret);
  } else {
    // A runner from before __glyx_backend_call2: everything goes through JSON, and any string
    // result that happens to be JSON is parsed.
    result = __glyx_backend_call(cmd, JSON.stringify(arg)).then(_parseRaw);
  }

  return result.then(function(value: any) {
    if (netId) netResponse(netId, { statusText: 'Returned', body: _safeJson(value) });
    return value;
  }, function(e: unknown) { netFailed(netId, e); throw e; });
}

function _backendNs(prefix: string) {
  // A Proxy over a function so it's both callable (backend.cmd(args)) and
  // has properties (backend.ns.fn(args)).
  return new Proxy(function() {}, {
    get: function(_, fn) {
      if (typeof fn !== 'string') return undefined;
      return function(args: any) { return _backendCall(prefix + '.' + fn, args); };
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
