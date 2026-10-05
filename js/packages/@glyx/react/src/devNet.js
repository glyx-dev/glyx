// Network activity for Glyx DevTools (the Network panel).
//
// Only active when the app runs with devtools on (`__glyx_devtools` is set
// before this bundle loads) and the native `__glyx_devNet` sink exists. Off,
// every hook below is a single null check.
//
// Each event is one JSON string handed to the native side, which keeps the
// request list and streams changes to DevTools:
//   request  { id, kind, method?, url, headers?, body? }   a request started / socket opening
//   response { id, status, statusText, headers, body }     a fetch or command finished
//   open     { id }                                          a socket connected
//   frame    { id, dir: 'out' | 'in', data }                 a socket / IPC message
//   closed   { id }                                          a socket closed
//   failed   { id, error }                                   the request or connect failed

/** Longest body or message kept, in characters. */
export const BODY_LIMIT = 256 * 1024;

// Looked up per call rather than once, so a bundle evaluated before the
// devtools flag (e.g. into a startup snapshot) still records later.
function sink() {
  const g = globalThis;
  return g.__glyx_devtools && typeof g.__glyx_devNet === 'function' ? g.__glyx_devNet : null;
}

let seq = 0;
// Long-lived records (sockets, IPC channels): id → { kind, url }. Their
// later events carry these so DevTools can recreate a record it cleared.
const channels = new Map();

function clip(v) {
  if (v == null) return v;
  const s = typeof v === 'string' ? v : String(v);
  return s.length > BODY_LIMIT ? s.slice(0, BODY_LIMIT) : s;
}

function emit(e) {
  if (e.body != null) { e.size = String(e.body).length; e.body = clip(e.body); }
  if (e.data != null) { e.size = String(e.data).length; e.data = clip(e.data); }
  e.ts = Date.now();
  try { sink()?.(JSON.stringify(e)); } catch { /* never break the app for DevTools */ }
}

/** Start a record; returns its id, or 0 when not recording. */
export function netStart(kind, url, init = {}) {
  if (!sink()) return 0;
  const id = ++seq;
  emit({ t: 'request', id, kind, url: String(url), method: init.method, headers: init.headers, body: init.body });
  if (kind === 'websocket' || kind === 'ipc') channels.set(id, { kind, url: String(url) });
  return id;
}

export function netResponse(id, data) {
  if (!id) return;
  emit({ t: 'response', id, status: data.status, statusText: data.statusText, headers: data.headers, body: data.body });
}

export function netOpen(id) { if (id) emit({ t: 'open', id, ...channels.get(id) }); }
export function netFrame(id, dir, data) { if (id) emit({ t: 'frame', id, dir, data: String(data), ...channels.get(id) }); }
export function netClosed(id) {
  if (!id) return;
  emit({ t: 'closed', id, ...channels.get(id) });
  channels.delete(id);
}
export function netFailed(id, err) {
  if (!id) return;
  emit({ t: 'failed', id, error: String(err?.message ?? err) });
  channels.delete(id);
}

// IPC has no connection to hang messages on: one record per peer window
// (outgoing) plus one for this window's inbox.
const ipcIds = new Map();
export function netIpc(dir, peer, data) {
  if (!sink()) return;
  const key = dir === 'out' ? `to ${peer}` : 'inbox';
  let id = ipcIds.get(key);
  if (!id) {
    id = netStart('ipc', dir === 'out' ? `to window ${peer}` : 'received');
    ipcIds.set(key, id);
  }
  netFrame(id, dir, data);
}
