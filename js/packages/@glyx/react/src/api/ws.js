// @glyx-dev/react — WebSocket client.
import { netStart, netOpen, netFrame, netClosed, netFailed } from '../devNet.js';

// ── WebSocket inbox polling ───────────────────────────────────────────────────
//
// Open sockets: id (number) → { onmessage, onclose, onerror }
export const _wsOpenSockets = new Map();
// Socket id → its Network panel record (devtools only).
const _wsNetIds = new Map();
export function _pollWebSockets() {
  for (const [id, handlers] of _wsOpenSockets) {
    const netId = _wsNetIds.get(id);
    let raw;
    try { raw = __glyx_ws_poll(id); } catch { continue; }
    if (!raw) continue;
    let msgs;
    try { msgs = JSON.parse(raw); } catch { continue; }
    for (const m of msgs) {
      if (m === '__GLYX_WS_CLOSED__') {
        netClosed(netId);
        _wsNetIds.delete(id);
        handlers.onclose?.();
        _wsOpenSockets.delete(id);
        break;
      } else {
        netFrame(netId, 'in', m);
        handlers.onmessage?.({ data: m });
      }
    }
  }
}
export const ws = {
  /**
   * Open a WebSocket connection.
   *
   * @param {string} url  ws:// or wss:// URL
   * @param {{ onmessage?: (ev: {data:string}) => void,
   *            onclose?:  () => void,
   *            onerror?:  (err: string) => void }} [handlers]
   * @returns {Promise<{ send: (msg:string)=>void, close: ()=>void, id: number }>}
   */
  connect(url, handlers = {}) {
    const netId = netStart('websocket', url);
    return __glyx_ws_connect(url).catch(e => { netFailed(netId, e); throw e; }).then(idStr => {
      const id = Number(idStr);
      _wsOpenSockets.set(id, handlers);
      if (netId) { _wsNetIds.set(id, netId); netOpen(netId); }
      return {
        get id() { return id; },
        send(msg)  { netFrame(netId, 'out', msg); __glyx_ws_send(id, String(msg)); },
        close()    {
          if (_wsNetIds.delete(id)) netClosed(netId);
          __glyx_ws_close(id);
          _wsOpenSockets.delete(id);
          handlers.onclose?.();
        },
      };
    });
  },
};
