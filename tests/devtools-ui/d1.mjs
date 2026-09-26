// Glyx DevTools UI, phase D1 (Inspector): drives the real UI in a headless
// browser while a separate GDP connection plays the app user.
//
//   glyx dev --devtools           (in examples/calculator, CPU renderer for the screenshot check:
//                                   GLYX_CPU_RENDER=1)
//   glyx inspect --no-open
//   bun tests/devtools-ui/d1.mjs "<DevTools URL>" examples/calculator/target/glyx/devtools.json [screenshot-dir]
//
// Exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { launch } from './browser.mjs';
import { connect } from '../../scripts/devtools/gdp-client.mjs';

const [url, appFile, shots] = process.argv.slice(2);
if (!url || !appFile) { console.error('usage: bun tests/devtools-ui/d1.mjs <devtools url> <app devtools.json> [screenshot dir]'); process.exit(2); }

const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// The "user" side: a direct GDP connection to the app.
const info = JSON.parse(readFileSync(appFile, 'utf8'));
const gdp = await connect(info);
await gdp.call('Runtime.handshake', { token: info.token });

const browser = await launch({ width: 1400, height: 860 });
try {
  const page = await browser.open(`${url}&theme=dark`);
  await page.waitForText('Connected', 10000);
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', altKey: true }))`);
  await page.waitForText('My components', 5000);
  await wait(700);

  const rowTexts = () => page.eval('[...document.querySelectorAll(".tree-row")].map(r => r.innerText.replace(/\\n/g, " "))');
  const rows = await rowTexts();
  check('the tree lists the app\'s components', rows.some((r) => r.startsWith('Btn Pressable')), `${rows.length} rows`);
  check('rows preview the text inside them', rows.some((r) => r === 'Btn Pressable "7"'), rows.find((r) => r.includes('"7"')));
  check('empty Text elements say so', rows.some((r) => r.endsWith('(empty text)')), rows.find((r) => r.includes('empty')));

  // Select the "7" key from the tree.
  await page.eval(`[...document.querySelectorAll(".tree-row")].find(r => r.innerText.replace(/\\n/g, " ") === 'Btn Pressable "7"').click()`);
  await page.waitForText('Copy selector', 3000).catch(() => {});
  await wait(400);
  const title = await page.eval('document.querySelector(".d-title")?.innerText.replace(/\\n/g, " ")');
  const elementId = await page.eval('document.querySelector(".d-id code")?.innerText');
  check('selecting a row shows its details', /Btn › Pressable/.test(title ?? ''), title);
  check('…with its element ID', /Btn#\d+ › Pressable#0$/.test(elementId ?? ''), elementId);
  check('…and a box model with its size', /\d+ × \d+/.test(await page.eval('document.querySelector(".box-content")?.innerText ?? ""')));

  // Live edit: change the key's background in the app, then reset.
  const nodeId = (await gdp.call('Automation.findNodes', { id: elementId })).result.nodes[0].nodeId;
  const before = (await gdp.call('Inspector.getNode', { nodeId })).result.props.backgroundColor;
  await page.eval(`(() => {
    // Like a person: focus, type, leave the field (React commits on focusout).
    const input = document.getElementById('p-backgroundColor');
    input.focus();
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(input, '#ff0000'); input.dispatchEvent(new Event('input', { bubbles: true }));
    input.blur();
  })()`);
  await wait(500);
  const after = (await gdp.call('Inspector.getNode', { nodeId })).result.props.backgroundColor;
  check('editing a prop changes it in the running app', after === '#ff0000ff', `${before} → ${after}`);
  check('…and marks it edited', await page.eval('!!document.querySelector(".prop.edited")'));
  if (shots) await page.screenshot(`${shots}/devtools-d1-details.png`);
  await page.eval(`[...document.querySelectorAll(".prop.edited .link")].forEach(b => b.click())`);
  await wait(500);
  const restored = (await gdp.call('Inspector.getNode', { nodeId })).result.props.backgroundColor;
  check('reset puts the app\'s value back', restored === before, restored);

  // Screenshot of the element (CPU renderer).
  await page.eval(`[...document.querySelectorAll(".d-actions .button")].find(b => b.innerText === 'Screenshot').click()`);
  await wait(800);
  const shot = await page.eval('document.querySelector(".d-shot img")?.naturalWidth ?? document.querySelector(".d-shot")?.innerText');
  check('the Screenshot button shows the element', typeof shot === 'number' ? shot > 10 : /CPU renderer/.test(shot ?? ''), String(shot));

  // Select mode: turn it on in the UI, "click" the 5 key in the app.
  await page.click('.toolbar .icon-button');
  await wait(300);
  check('the select-mode button turns select mode on', await page.eval('document.querySelector(".toolbar .icon-button").getAttribute("aria-pressed") === "true"'));
  const five = (await gdp.call('Automation.findNodes', { text: '5', type: 'Text' })).result.nodes.find((n) => n.visible);
  const [x, y, w, h] = five.rect;
  await gdp.call('Automation.dispatchInput', { type: 'pointerMove', x: x + w / 2, y: y + h / 2 });
  await wait(150);
  await gdp.call('Automation.dispatchInput', { type: 'pointerDown' });
  await gdp.call('Automation.dispatchInput', { type: 'pointerUp' });
  await wait(800);
  const pickedPreview = await page.eval('document.querySelector(".tree-row.selected")?.innerText.replace(/\\n/g, " ")');
  check('clicking an element in the app selects it in the tree', /"5"/.test(pickedPreview ?? ''), pickedPreview);
  check('…and select mode ends', await page.eval('document.querySelector(".toolbar .icon-button").getAttribute("aria-pressed") === "false"'));

  // Picking an element that "My components" would hide (the display panel:
  // a plain View inside App) still gives it a selected row.
  await page.click('.toolbar .icon-button');
  await wait(300);
  await gdp.call('Automation.dispatchInput', { type: 'pointerMove', x: 40, y: 80 });
  await wait(150);
  await gdp.call('Automation.dispatchInput', { type: 'pointerDown' });
  await gdp.call('Automation.dispatchInput', { type: 'pointerUp' });
  await wait(800);
  const hiddenPick = await page.eval('document.querySelector(".tree-row.selected")?.innerText.replace(/\\n/g, " ")');
  const detailTitle = await page.eval('document.querySelector(".d-title")?.innerText.replace(/\\n/g, " ")');
  check('an element inside a component still gets a row when picked', !!hiddenPick && !!detailTitle, `${hiddenPick} / ${detailTitle}`);

  // Keyboard: Down moves the selection.
  await page.eval('document.querySelector(".tree").focus()');
  const selBefore = await page.eval('document.querySelector(".tree-row.selected")?.innerText');
  await page.eval(`document.querySelector(".tree").dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }))`);
  await wait(200);
  const selAfter = await page.eval('document.querySelector(".tree-row.selected")?.innerText');
  check('arrow keys move the selection', selAfter && selAfter !== selBefore);

  // Search.
  await page.eval(`(() => {
    const s = document.querySelector('.search');
    const set = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
    set.call(s, 'Calculator'); s.dispatchEvent(new Event('input', { bubbles: true }));
  })()`);
  await wait(300);
  const found = await rowTexts();
  check('search narrows the tree to matches', found.some((r) => r.includes('"Calculator"')) && found.length < 6, `${found.length} rows`);

  // Accessibility tab.
  await page.eval(`[...document.querySelectorAll(".tabs button")].find(b => b.innerText.startsWith('Accessibility')).click()`);
  await wait(700);
  const issues = await page.eval('document.querySelectorAll(".issue-row").length');
  const clean = await page.eval('document.querySelector(".side")?.innerText.includes("No accessibility issues found")');
  check('the Accessibility tab shows the audit (issues, or a clean result)', issues > 0 || clean, clean ? 'no issues' : `${issues} issue(s)`);
  if (shots) await page.screenshot(`${shots}/devtools-d1-a11y.png`);

  const errors = page.console.filter((c) => c.type === 'error' || c.type === 'exception');
  check('no console errors', errors.length === 0, errors.map((e) => e.text).join(' | '));
} finally {
  await browser.close();
  gdp.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
