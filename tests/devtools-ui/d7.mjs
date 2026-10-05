// Glyx DevTools UI, phase D7 (Network): drives the real UI in a headless
// browser against the notes app, which makes real fetch and WebSocket calls
// (so this needs internet: jsonplaceholder.typicode.com, echo.websocket.org).
//
//   glyx dev --devtools           (in examples/notes-app)
//   glyx inspect --no-open
//   bun tests/devtools-ui/d7.mjs "<DevTools URL>" examples/notes-app/target/glyx/devtools.json [screenshot-dir]
//
// Exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { launch } from './browser.mjs';
import { connect } from '../../scripts/devtools/gdp-client.mjs';

const [url, appFile, shots] = process.argv.slice(2);
if (!url || !appFile) { console.error('usage: bun tests/devtools-ui/d7.mjs <devtools url> <app devtools.json> [screenshot dir]'); process.exit(2); }

const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const info = JSON.parse(readFileSync(appFile, 'utf8'));
const gdp = await connect(info);
await gdp.call('Runtime.handshake', { token: info.token });
const run = (code) => gdp.call('Runtime.evaluate', { expression: code });
const clickText = async (text, nth = 0) => {
  const n = (await gdp.call('Automation.findNodes', { text, type: 'Text' })).result.nodes.filter((x) => x.visible)[nth];
  if (!n) throw new Error(`no visible "${text}" in the app`);
  await gdp.call('Automation.click', { nodeId: n.nodeId });
};
const API = 'https://jsonplaceholder.typicode.com';

// Before DevTools opens: must come from the backlog.
await gdp.call('Network.clear');
await run(`fetch('${API}/todos/1').then(r => r.text()); 1`);
await wait(2500);

const browser = await launch({ width: 1400, height: 900 });
try {
  const page = await browser.open(`${url}&theme=dark`);
  await page.waitForText('Connected', 10000);
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '8', altKey: true }))`);
  await page.waitForText('Waterfall', 5000);
  await wait(800);
  const rows = () => page.eval('[...document.querySelectorAll(".net-table tbody tr")].map(r => [...r.cells].slice(0, 6).map(c => c.innerText.trim()).join(" | "))');
  const selectRow = (text) => page.eval(`[...document.querySelectorAll(".net-table tbody tr")].find(r => r.innerText.includes(${JSON.stringify(text)}))?.click()`);
  const tab = (name) => page.eval(`[...document.querySelectorAll(".net-detail .tabs button")].find(b => b.innerText.startsWith(${JSON.stringify(name)}))?.click()`);
  const detail = () => page.eval('document.querySelector(".net-detail .details")?.innerText ?? ""');

  let r = await rows();
  check('requests made before DevTools opened are listed', r.some((x) => /^1 .*\| GET \| 200 \| application\/json/.test(x)), r.join(' ;; '));

  // Live: a POST, a 404 and a blocked request.
  await run(`fetch('${API}/posts', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: 'from d7' }) }).then(r => r.text()); 1`);
  await run(`fetch('${API}/nope-404').then(r => r.text()); 1`);
  await run(`fetch('http://127.0.0.1:1/private').catch(() => {}); 1`);
  await wait(3000);
  r = await rows();
  check('new requests appear live', r.some((x) => x.includes('POST | 201')) && r.some((x) => /nope-404 .*\| GET \| 404 \|/.test(x)), r.join(' ;; '));
  check('a blocked request shows as failed', r.some((x) => x.includes('private') && x.includes('Failed')));

  await selectRow('POST');
  await wait(500);
  await tab('Request');
  await wait(300);
  const reqBody = await detail();
  await tab('Response');
  await wait(300);
  const resBody = await detail();
  check('the request body is shown (JSON pretty-printed)', /"title": "from d7"/.test(reqBody), reqBody.slice(0, 80));
  check('…and the response body', /"id": 101/.test(resBody), resBody.slice(0, 80));
  await tab('Overview');
  await wait(300);
  const overview = await detail();
  check('the overview has status, timing and headers', /201 Created/.test(overview) && /Took\s*\d+ ms/.test(overview) && /content-type/i.test(overview), overview.slice(0, 160).replace(/\n/g, ' '));
  if (shots) await page.screenshot(`${shots}/devtools-d7-network.png`);

  await selectRow('private');
  await wait(400);
  await tab('Response');
  await wait(300);
  const err = await detail();
  check('a failed request explains why', /private\/loopback|SSRF/.test(err), err.slice(0, 120));

  // Errors only: the 404 and the blocked one.
  await page.eval(`[...document.querySelectorAll('.network .toolbar label.check')].find(l => l.innerText.includes('Errors only')).querySelector('input').click()`);
  await wait(300);
  r = await rows();
  check('"Errors only" keeps just the 404 and the failure', r.length === 2, r.join(' ;; '));
  await page.eval(`[...document.querySelectorAll('.network .toolbar label.check')].find(l => l.innerText.includes('Errors only')).querySelector('input').click()`);

  // WebSocket, through the app's own UI.
  await clickText('Network');
  await wait(800);
  await clickText('Connect');
  await wait(3000);
  await clickText('Send');
  await wait(2500);
  r = await rows();
  const wsRow = r.find((x) => x.includes('echo.websocket.org'));
  check('a WebSocket shows as open with its message count', wsRow && /WS \| Open/.test(wsRow) && /\d+ msg/.test(wsRow), wsRow);
  await selectRow('echo.websocket.org');
  await wait(600);
  await tab('Messages');
  await wait(300);
  const frames = await page.eval('[...document.querySelectorAll(".frame-row")].map(f => f.innerText.replace(/\\n/g, " "))');
  check('its messages show both directions', frames.some((f) => f.startsWith('↑') && f.includes('Hello from Glyx')) && frames.some((f) => f.startsWith('↓')), frames.join(' ;; ').slice(0, 200));
  check('the echo arrives without the app needing another redraw', frames.some((f) => f.startsWith('↓') && f.includes('Hello from Glyx')));
  if (shots) await page.screenshot(`${shots}/devtools-d7-websocket.png`);

  // IPC: open the child window and message it; it answers.
  await clickText('Open Child Window');
  await wait(4000);
  await clickText('Send', 1);
  await wait(2500);
  r = await rows();
  const ipcRows = r.filter((x) => x.includes('IPC'));
  // Every window's traffic shows: what the main window sent, and what the
  // child received. (The child doesn't answer: its ping handler lives on the
  // notes app's Network screen, and the child opens on the home screen.)
  check('IPC shows each side: sent by the main window, received by the child', ipcRows.some((x) => /^to window 1 in window 0 .*2 msg/.test(x)) && ipcRows.some((x) => x.startsWith('received in window 1')), ipcRows.join(' ;; '));
  await selectRow('to window ');
  await wait(500);
  const sent = await page.eval('[...document.querySelectorAll(".frame-row")].map(f => f.innerText.replace(/\\n/g, " "))');
  check('…with the message itself', sent.some((f) => f.startsWith('↑') && f.includes('Hello from main window')), sent.join(' ;; ').slice(0, 200));

  // Type filter.
  await page.eval(`[...document.querySelectorAll('.network .level-chip')].find(b => b.innerText.startsWith('Fetch')).click()`);
  await wait(300);
  r = await rows();
  check('type chips filter (Fetch off leaves the socket and IPC)', r.some((x) => x.includes('| WS |')) && r.every((x) => !/\| (GET|POST) \|/.test(x)), r.join(' ;; '));
  await page.eval(`[...document.querySelectorAll('.network .level-chip')].find(b => b.innerText.startsWith('Fetch')).click()`);

  await clickText('Disconnect').catch(() => {});
  await page.eval(`[...document.querySelectorAll('.network .toolbar button')].find(b => b.innerText === 'Clear').click()`);
  await wait(400);
  const after = (await gdp.call('Network.getRequests', {})).result.requests.length;
  const left = await rows();
  check('Clear empties the panel and the app-side list', left.length === 0 && after === 0, `${after} left in the app; panel: ${left.join(' ;; ')}`);

  // Channels outlive a Clear: the next IPC message brings its row back.
  await clickText('Send', 1);
  await wait(2500);
  r = await rows();
  check('after Clear, a still-open IPC channel reappears on its next message', r.some((x) => x.startsWith('to window 1 in window 0')), r.join(' ;; '));

  const errors = page.console.filter((c) => c.type === 'error' || c.type === 'exception');
  check('no console errors in DevTools itself', errors.length === 0, errors.map((e) => e.text).join(' | '));
} finally {
  await browser.close();
  gdp.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
