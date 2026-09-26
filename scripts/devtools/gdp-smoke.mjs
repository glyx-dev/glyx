// GDP smoke test: checks the security rules, Runtime and Console on a
// running app. Start the app with `glyx dev --devtools`, then from the
// app folder:
//
//   bun ../../scripts/devtools/gdp-smoke.mjs target/glyx/devtools.json
//
// Exits non-zero if any check fails.
import { readFileSync } from 'node:fs';

const info = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const results = [];
const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`); };

function open() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(info.url);
    const pending = new Map(); const events = [];
    let next = 1;
    ws.onmessage = (m) => {
      const msg = JSON.parse(m.data);
      if (msg.event) events.push(msg);
      else pending.get(msg.id)?.(msg), pending.delete(msg.id);
    };
    ws.onopen = () => resolve({
      ws, events,
      call(domain, method, params, windowId) {
        const id = next++;
        return new Promise((res) => {
          pending.set(id, res);
          ws.send(JSON.stringify({ id, domain, method, params, ...(windowId ? { windowId } : {}) }));
          setTimeout(() => { if (pending.delete(id)) res({ timeout: true }); }, 5000);
        });
      },
      closed: new Promise((r) => { ws.onclose = r; }),
    });
    ws.onerror = reject;
  });
}

// 1. No token → unauthorized, connection closed.
{
  const c = await open();
  const r = await c.call('Runtime', 'handshake', {});
  check('handshake without token is refused', r.error?.code === -32001, JSON.stringify(r.error));
  const closed = await Promise.race([c.closed.then(() => true), new Promise((r) => setTimeout(() => r(false), 3000))]);
  check('connection closed after bad token', closed);
}

// 2. Before handshake → unauthorized.
{
  const c = await open();
  const r = await c.call('Runtime', 'evaluate', { expression: '1' });
  check('evaluate before handshake is refused', r.error?.code === -32001);
  c.ws.close();
}

// 3. Full session.
const c = await open();
const hs = await c.call('Runtime', 'handshake', { token: info.token });
check('handshake with token', hs.result?.protocolVersion === 1, `engine=${hs.result?.engine} windows=${JSON.stringify(hs.result?.windows)}`);
check('engine matches discovery file', hs.result?.engine === info.engine);
check('window list non-empty', (hs.result?.windows?.length ?? 0) > 0);

const ping = await c.call('Runtime', 'ping');
check('ping', ping.result?.pong === true);

const ev = await c.call('Runtime', 'evaluate', { expression: '1 + 1' });
check('evaluate 1 + 1', ev.result?.value === 2 && ev.result?.type === 'number', JSON.stringify(ev.result));

const obj = await c.call('Runtime', 'evaluate', { expression: 'var gdpX = {a: [1, "b"]}; gdpX' });
check('evaluate statements returning an object', JSON.stringify(obj.result?.value) === '{"a":[1,"b"]}', JSON.stringify(obj.result));

const fn = await c.call('Runtime', 'evaluate', { expression: '(function namedFn(){})' });
check('evaluate a function gives a description only', fn.result?.type === 'function' && !('value' in fn.result), JSON.stringify(fn.result));

const bad = await c.call('Runtime', 'evaluate', { expression: 'throw new Error("gdp boom")' });
check('evaluate that throws reports EVAL_FAILED', bad.error?.code === -32003 && /gdp boom/.test(bad.error.message), JSON.stringify(bad.error));

const nw = await c.call('Runtime', 'evaluate', { expression: '1' }, 999);
check('unknown window is reported', nw.error?.code === -32002);

const nm = await c.call('Runtime', 'nope');
check('unknown method is reported', nm.error?.code === -32601);

const en = await c.call('Console', 'enable');
check('Console.enable', !!en.result);
await c.call('Runtime', 'evaluate', { expression: 'console.log("hello from gdp"); console.warn("careful"); 0' });
await new Promise((r) => setTimeout(r, 1500));
const log = c.events.find((e) => e.event === 'Console.messageAdded' && e.params.text === 'hello from gdp');
const warn = c.events.find((e) => e.event === 'Console.messageAdded' && e.params.text === 'careful');
check('console.log arrives as Console.messageAdded', !!log && log.params.level === 'log' && typeof log.windowId === 'number', JSON.stringify(log));
check('console.warn arrives with level warn', warn?.params.level === 'warn');

c.ws.close();
const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
