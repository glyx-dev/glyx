// Glyx DevTools UI, phase D5 (Memory): drives the real UI in a headless
// browser against notes-app (V8), switching screens in the app over GDP so
// snapshots have something to compare. Nothing is saved.
//
//   glyx dev --devtools           (in examples/notes-app)
//   glyx inspect --no-open
//   bun tests/devtools-ui/d5.mjs "<DevTools URL>" examples/notes-app/target/glyx/devtools.json [screenshot-dir]
//
// Exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { launch } from './browser.mjs';
import { connect } from '../../scripts/devtools/gdp-client.mjs';

const [url, appFile, shots] = process.argv.slice(2);
if (!url || !appFile) { console.error('usage: bun tests/devtools-ui/d5.mjs <devtools url> <app devtools.json> [screenshot dir]'); process.exit(2); }

const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const info = JSON.parse(readFileSync(appFile, 'utf8'));
const gdp = await connect(info);
await gdp.call('Runtime.handshake', { token: info.token });
const clickText = async (text) => {
  const n = (await gdp.call('Automation.findNodes', { text, type: 'Text' })).result.nodes.find((x) => x.visible);
  if (n) await gdp.call('Automation.click', { nodeId: n.nodeId });
  return !!n;
};

const browser = await launch({ width: 1400, height: 1000 });
try {
  const page = await browser.open(`${url}&theme=dark`);
  await page.waitForText('Connected', 10000);
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '6', altKey: true }))`);
  await page.waitForText('Take snapshot', 5000);
  await wait(3500);

  const cards = await page.eval('[...document.querySelectorAll(".mem-cards .card")].map(c => c.innerText.replace(/\\n+/g, " "))');
  check('the cards show heap, process, GPU memory and elements', cards.length === 4 && /JS heap [\d.]+ (KB|MB)/.test(cards[0]) && /Elements \d/.test(cards[3]), cards.join(' | '));
  check('the charts fill with samples', !(await page.eval('!!document.querySelector(".mchart .chart-empty")')));

  // Collect garbage.
  await page.eval(`[...document.querySelectorAll('.memory .toolbar .button')].find(b => b.innerText === 'Collect garbage').click()`);
  await page.waitForText('JS heap', 3000);
  await wait(600);
  const gc = await page.eval(`document.querySelector('.memory .toolbar .small.muted')?.innerText ?? ''`);
  check('Collect garbage reports the heap before and after', /JS heap [\d.]+ \w+ → [\d.]+ \w+ .* in [\d.]+ ms/.test(gc), gc);

  // Snapshot on the list screen, open the editor in the app, snapshot again.
  const snapBtn = `[...document.querySelectorAll('.memory .toolbar .button')].find(b => b.innerText === 'Take snapshot').click()`;
  await page.eval(snapBtn);
  await wait(700);
  const first = await page.eval('[...document.querySelectorAll(".snap-table tbody tr")].map(r => r.innerText.replace(/\\s+/g, " "))');
  check('a snapshot lists elements per component', first.length > 2 && first.some((r) => /NoteList/.test(r)), first.slice(0, 3).join(' | '));

  check('opened the editor in the app', await clickText('+ New'));
  await wait(900);
  await page.eval(snapBtn);
  await wait(800);
  const rows = await page.eval('[...document.querySelectorAll(".snap-table tbody tr")].map(r => r.innerText.replace(/\\s+/g, " "))');
  const grew = rows.filter((r) => /\+\d/.test(r));
  const shrank = rows.filter((r) => /−\d/.test(r));
  check('comparing snapshots shows the editor\'s components growing', grew.some((r) => /NoteEdit/.test(r)), grew.slice(0, 2).join(' | '));
  check('…and the list\'s shrinking', shrank.some((r) => /NoteList|NoteCard/.test(r)), shrank.slice(0, 2).join(' | '));
  if (shots) await page.screenshot(`${shots}/devtools-d5-memory.png`);

  await clickText('← Back');
  await wait(300);

  const errors = page.console.filter((c) => c.type === 'error' || c.type === 'exception');
  check('no console errors in DevTools itself', errors.length === 0, errors.map((e) => e.text).join(' | '));
} finally {
  await browser.close();
  gdp.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
