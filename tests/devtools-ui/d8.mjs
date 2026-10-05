// Glyx DevTools UI, phase D8 (CPU profiler): records while the app works and
// checks the result. Engine-aware: on V8 the flame chart and function list
// must show the busy JS; on every engine the Components view must show the
// React renders.
//
//   glyx dev --devtools           (examples/calculator is QuickJS, examples/notes-app is V8)
//   glyx inspect --no-open
//   bun tests/devtools-ui/d8.mjs "<DevTools URL>" <app>/target/glyx/devtools.json [screenshot-dir]
//
// Exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { launch } from './browser.mjs';
import { connect } from '../../scripts/devtools/gdp-client.mjs';

const [url, appFile, shots] = process.argv.slice(2);
if (!url || !appFile) { console.error('usage: bun tests/devtools-ui/d8.mjs <devtools url> <app devtools.json> [screenshot dir]'); process.exit(2); }

const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const info = JSON.parse(readFileSync(appFile, 'utf8'));
const gdp = await connect(info);
const hs = (await gdp.call('Runtime.handshake', { token: info.token })).result;
const v8 = hs.engine === 'V8';
console.log(`engine: ${hs.engine}`);

// App work during the recording: a named busy function (for the sampler) and
// real React re-renders (clicking a button that changes what's shown).
const busy = `(function glyxProfileBusyWork() { let x = 0; const end = Date.now() + 120; while (Date.now() < end) x += Math.sqrt(x + 1); return x; })()`;
async function workTheApp() {
  // Calculator: press 7. Notes app: go to its Network screen and back (works from either screen).
  let clicked = '';
  for (let i = 0; i < 3; i++) {
    await gdp.call('Runtime.evaluate', { expression: busy });
    const texts = (await gdp.call('Automation.findNodes', { type: 'Text' })).result.nodes.filter((n) => n.visible);
    const target = texts.find((n) => n.text === '7') ?? texts.find((n) => n.text === 'Network') ?? texts.find((n) => n.text === '← Back');
    if (!target) throw new Error('nothing to click: expected the calculator or the notes app');
    await gdp.call('Automation.click', { nodeId: target.nodeId });
    clicked = target.text;
    await wait(300);
  }
  return clicked;
}

const browser = await launch({ width: 1400, height: 900 });
try {
  const page = await browser.open(`${url}&theme=dark`);
  await page.waitForText('Connected', 10000);
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '9', altKey: true }))`);
  await page.waitForText('Record', 5000);
  const button = (label) => page.eval(`[...document.querySelectorAll('.cpu .toolbar button')].find(b => b.innerText.trim() === ${JSON.stringify(label)})?.click()`);

  await button('Record');
  await wait(400);
  const status = (await gdp.call('Profiler.getStatus')).result;
  check('recording starts (and GDP reports it)', status.recording != null, JSON.stringify(status));
  const clicked = await workTheApp();
  await button('Stop');
  await page.waitForText('Components', 8000);
  await wait(500);

  const tab = (name) => page.eval(`[...document.querySelectorAll('.cpu .tabs button')].find(b => b.innerText.startsWith(${JSON.stringify(name)}))?.click()`);
  if (v8) {
    const canvasDrawn = await page.eval(`(() => { const c = document.querySelector('.flame canvas'); if (!c) return false; const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; })()`);
    check('V8: the flame chart draws', canvasDrawn);
    if (shots) await page.screenshot(`${shots}/devtools-d8-flame.png`);
    await tab('Functions');
    await wait(400);
    const rows = await page.eval('[...document.querySelectorAll(".functions tbody tr")].map(r => r.innerText.replace(/\\s+/g, " "))');
    const busyRow = rows.find((r) => r.startsWith('glyxProfileBusyWork'));
    check('V8: the busy function tops the Functions list with ~360 ms self', busyRow && rows.indexOf(busyRow) < 3 && /\b(2|3|4)\d\d ms\b/.test(busyRow), `${busyRow} (rank ${rows.indexOf(busyRow) + 1})`);
    // Bundle frames point at source files (via the bundle's source map), not the bundle.
    await page.eval(`document.querySelector('.functions label.check input').click()`); // show all
    await wait(200);
    const where = await page.eval('[...document.querySelectorAll(".functions tbody tr td:nth-child(2)")].map(td => td.innerText).filter(Boolean)');
    check('V8: frames are mapped to source files', where.length > 0 && where.filter((w) => w !== 'app.js:1').every((w) => !/^(bundle|app)\.js:/.test(w)) && where.some((w) => /\.(jsx|tsx|mjs|js):\d+$/.test(w)), where.slice(0, 6).join(', '));
  } else {
    const note = await page.eval('document.querySelector(".cpu-body")?.innerText ?? ""');
    check(`${hs.engine}: opens on Components (no JS sampling on this engine)`, /Commit \d+ of \d+/.test(note), note.slice(0, 120));
    await tab('Flame chart');
    await wait(300);
    const why = await page.eval('document.querySelector(".cpu-body")?.innerText ?? ""');
    check(`${hs.engine}: the flame chart explains why it's empty`, /needs the V8 engine/.test(why), why.slice(0, 140));
  }

  await tab('Components');
  await wait(400);
  const commits = await page.eval('document.querySelectorAll(".commit-bar").length');
  const boxes = await page.eval('[...document.querySelectorAll(".cf-box")].map(b => b.innerText.replace(/\\s+/g, " "))');
  const ranked = await page.eval('[...document.querySelectorAll(".components-prof tbody tr")].map(r => r.innerText.replace(/\\s+/g, " "))');
  check('Components: the clicks produced commits', commits >= 3, `${commits} commits after clicking "${clicked}" 3 times`);
  check('Components: the selected commit shows what rendered, with times', boxes.length >= 1 && boxes.every((b) => /\d ms$/.test(b)), boxes.slice(0, 5).join(' | '));
  check('Components: the ranking lists the app\'s components', ranked.length >= 1 && /\d+ ms/.test(ranked[0]), ranked.slice(0, 3).join(' ;; '));
  // Real timings, not zeros (React only times renders in "profile mode").
  check('Components: render times are measured (not all zero)', ranked.some((r) => /(?:^|\s)(?!0\.00 )\d+(\.\d+)? ms/.test(r)), ranked.slice(0, 3).join(' ;; '));
  if (shots) await page.screenshot(`${shots}/devtools-d8-components-${hs.engine}.png`);

  const after = (await gdp.call('Profiler.getStatus')).result;
  check('recording stopped in the app', after.recording == null);
  const errors = page.console.filter((c) => c.type === 'error' || c.type === 'exception');
  check('no console errors in DevTools itself', errors.length === 0, errors.map((e) => e.text).join(' | '));
} finally {
  await browser.close();
  gdp.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
