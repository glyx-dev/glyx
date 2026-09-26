// Minimal GDP client for scripts: `await connect(info)` then
// `await gdp.call('Domain.method', params, windowId?)` → `{ result }` or
// `{ error }`. Events collect in `gdp.events`. Works in Bun and Node 22+.

export function connect(info) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(info.url);
    const pending = new Map();
    const events = [];
    let next = 1;
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.event) { events.push(msg); return; }
      const done = pending.get(msg.id);
      if (done) { pending.delete(msg.id); done(msg); }
    };
    ws.onerror = reject;
    ws.onopen = () => resolve({
      events,
      call(name, params = {}, windowId, timeoutMs = 70000) {
        const [domain, method] = name.split('.');
        const id = next++;
        return new Promise((res) => {
          // Cleared on reply, so a finished script exits instead of waiting
          // out the timer.
          const timer = setTimeout(() => { if (pending.delete(id)) res({ timeout: true }); }, timeoutMs);
          pending.set(id, (msg) => { clearTimeout(timer); res(msg); });
          ws.send(JSON.stringify({ id, domain, method, params, ...(windowId != null ? { windowId } : {}) }));
        });
      },
      close() { ws.close(); },
    });
  });
}
