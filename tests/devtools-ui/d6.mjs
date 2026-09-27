// Glyx DevTools UI, phase D6 (Layout explorer): drives the real UI in a
// headless browser against the calculator, whose keypad rows are flex rows.
//
//   glyx dev --devtools           (in examples/calculator)
//   glyx inspect --no-open
//   bun tests/devtools-ui/d6.mjs "<DevTools URL>" examples/calculator/target/glyx/devtools.json [screenshot-dir]
//
// Exits non-zero if any check fails. The layout edits are undone at the end.
import { readFileSync } from 'node:fs';
import { launch } from './browser.mjs';
import { connect } from '../../scripts/devtools/gdp-client.mjs';

const [url, appFile, shots] = process.argv.slice(2);
if (!url || !appFile) { console.error('usage: bun tests/devtools-ui/d6.mjs <devtools url> <app devtools.json> [screenshot dir]'); process.exit(2); }

const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const info = JSON.parse(readFileSync(appFile, 'utf8'));
const gdp = await connect(info);
await gdp.call('Runtime.handshake', { token: info.token });

const browser = await launch({ width: 1400, height: 1000 });
let rowNode = null;
try {
  const page = await browser.open(`${url}&theme=dark`);
  await page.waitForText('Connected', 10000);
  const key = (k) => page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', altKey: true }))`);

  // Select the "7" key in the Inspector, then open Layout.
  await key('2');
  await page.waitForText('My components', 5000);
  await wait(600);
  await page.eval(`[...document.querySelectorAll(".tree-row")].find(r => r.innerText.replace(/\\n/g, " ") === 'Btn Pressable "7"').click()`);
  await wait(300);
  await key('7');
  await page.waitForText('Width', 5000);
  await wait(600);

  const why = await page.eval('[...document.querySelectorAll(".why")].map(w => w.innerText.replace(/\\n+/g, " "))');
  check('width is explained (the key grows to share its row)', /Width \d+(\.\d+)?px Grew \(flexGrow 1\)/.test(why[0] ?? ''), why[0]);
  check('height is explained (set by the app)', /Height [\d.]+px Set: height [\d.]+px/.test(why[1] ?? ''), why[1]);

  const kids = await page.eval('document.querySelectorAll(".diagram-child").length');
  const sel = await page.eval('document.querySelector(".diagram-child.selected")?.getAttribute("title") ?? ""');
  check('the diagram shows the row\'s four keys, this one highlighted', kids === 4 && /"7"/.test(sel), `${kids} children, selected: ${sel}`);
  if (shots) await page.screenshot(`${shots}/devtools-d6-layout.png`);

  // Live: switch the row to a column; the app's layout really changes.
  const keyId = (await gdp.call('Automation.findNodes', { text: '7', type: 'Text' })).result.nodes.find((n) => n.visible);
  const btn = (await gdp.call('Inspector.getNode', { nodeId: keyId.nodeId })).result.parentId;
  const before = (await gdp.call('Inspector.getLayoutDetails', { nodeId: btn })).result;
  rowNode = before.container.nodeId;
  await page.eval(`(() => { const s = document.querySelector('select[aria-label="Direction"]'); s.value = 'column'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await wait(500);
  const after = (await gdp.call('Inspector.getLayoutDetails', { nodeId: btn })).result;
  check('changing the container\'s direction reflows the app', after.container.flexDirection === 'column' && after.computed.width !== before.computed.width,
    `${before.container.flexDirection} ${before.computed.width}px wide → ${after.container.flexDirection} ${after.computed.width}px wide`);
  const reason = await page.eval('document.querySelector(".why")?.innerText.replace(/\\n+/g, " ")');
  check('…and the explanation follows (now stretched across the column)', /Stretched to its container's width/.test(reason ?? ''), reason);

  await page.eval(`(() => { const s = document.querySelector('select[aria-label="Direction"]'); s.value = 'row'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await wait(400);
  const back = (await gdp.call('Inspector.getLayoutDetails', { nodeId: btn })).result;
  check('switching back restores the row', back.container.flexDirection === 'row' && Math.abs(back.computed.width - before.computed.width) < 0.5);

  // Up to the container.
  await page.eval(`[...document.querySelectorAll('.layoutx .toolbar .button')].find(b => b.innerText.includes('Container')).click()`);
  await wait(600);
  const kids2 = await page.eval('document.querySelectorAll(".diagram-child").length');
  check('↑ Container moves up a level', kids2 > 1, `${kids2} children at the next level`);

  const errors = page.console.filter((c) => c.type === 'error' || c.type === 'exception');
  check('no console errors in DevTools itself', errors.length === 0, errors.map((e) => e.text).join(' | '));
} finally {
  await browser.close();
  // Leave the app as it was (the direction edit lasts until React re-renders).
  if (rowNode != null) await gdp.call('Inspector.setNodeProp', { nodeId: rowNode, name: 'flexDirection', value: 'row' });
  gdp.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
