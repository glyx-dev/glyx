// Glyx DevTools UI, phase D2 (Console + REPL): drives the real UI in a
// headless browser while a separate GDP connection logs from the app.
//
//   glyx dev --devtools           (in examples/calculator)
//   glyx inspect --no-open
//   bun tests/devtools-ui/d2.mjs "<DevTools URL>" examples/calculator/target/glyx/devtools.json [screenshot-dir]
//
// Exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { launch } from './browser.mjs';
import { connect } from '../../scripts/devtools/gdp-client.mjs';

const [url, appFile, shots] = process.argv.slice(2);
if (!url || !appFile) { console.error('usage: bun tests/devtools-ui/d2.mjs <devtools url> <app devtools.json> [screenshot dir]'); process.exit(2); }

const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const info = JSON.parse(readFileSync(appFile, 'utf8'));
const gdp = await connect(info);
await gdp.call('Runtime.handshake', { token: info.token });
const appLog = (code) => gdp.call('Runtime.evaluate', { expression: code });

// Logged before DevTools opens: must show up from the backlog.
const marker = `before-open-${Date.now()}`;
await appLog(`console.log(${JSON.stringify(marker)})`);
await wait(300);

const browser = await launch({ width: 1400, height: 860 });
try {
  const page = await browser.open(`${url}&theme=dark`);
  await page.waitForText('Connected', 10000);
  const key = (k) => page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '${k}', altKey: true }))`);
  const logText = () => page.eval('document.querySelector(".log")?.innerText ?? ""');
  const type = (code) => page.eval(`(() => {
    const t = document.querySelector('.repl-input');
    t.focus();
    const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
    set.call(t, ${JSON.stringify(code)}); t.dispatchEvent(new Event('input', { bubbles: true }));
    t.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  })()`);

  await key('3');
  await page.waitForText('Preserve log', 5000);
  await wait(600);
  check('messages logged before the Console opened are shown', (await logText()).includes(marker));

  await appLog(`console.warn('live-warning')`);
  await wait(500);
  const warnRow = await page.eval(`[...document.querySelectorAll('.entry.lv-warn')].some(e => e.innerText.includes('live-warning'))`);
  check('live messages arrive with their level', warnRow);

  // REPL
  await type('1 + 2');
  await wait(500);
  const results1 = await page.eval(`[...document.querySelectorAll('.entry.result')].map(e => e.innerText.replace(/\\s+/g, ' '))`);
  check('the REPL evaluates in the app', results1.some((r) => r.endsWith('3')), results1.at(-1));

  await type('({ a: 1, list: [1, 2, 3], nested: { deep: true } })');
  await wait(500);
  const obj = await page.eval(`document.querySelectorAll('.entry.result')[document.querySelectorAll('.entry.result').length - 1].innerText.replace(/\\s+/g, ' ')`);
  check('objects show as expandable trees', /a: 1/.test(obj) && /list: Array\(3\)/.test(obj), obj);

  await type(`throw new Error('repl-boom')`);
  await wait(500);
  check('a thrown error shows as an error', await page.eval(`[...document.querySelectorAll('.entry.error')].some(e => e.innerText.includes('repl-boom'))`));

  // History: ArrowUp recalls the last input.
  await page.eval(`document.querySelector('.repl-input').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }))`);
  await wait(150);
  check('↑ recalls the previous input', (await page.eval(`document.querySelector('.repl-input').value`)).includes('repl-boom'));
  await page.eval(`(() => { const t = document.querySelector('.repl-input'); const set = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set; set.call(t, ''); t.dispatchEvent(new Event('input', { bubbles: true })); })()`);

  // $0: select the "7" key in the Inspector, then use it here.
  await key('2');
  await page.waitForText('My components', 5000);
  await wait(600);
  await page.eval(`[...document.querySelectorAll(".tree-row")].find(r => r.innerText.replace(/\\n/g, " ") === 'Btn Pressable "7"').click()`);
  await wait(400);
  await key('3');
  await wait(300);
  check('the Console shows what $0 is', /\$0\s+Btn › Pressable/.test(await page.eval(`document.querySelector('.dollar0')?.innerText ?? ''`)));
  await type('[$0.owner.name, $0.owner.props.label]');
  await wait(500);
  const dollar = await page.eval(`document.querySelectorAll('.entry.result')[document.querySelectorAll('.entry.result').length - 1].innerText.replace(/\\s+/g, ' ')`);
  check('$0 is the selected element (owner Btn, label "7")', dollar.includes('"Btn"') && dollar.includes('"7"'), dollar);

  if (shots) await page.screenshot(`${shots}/devtools-d2-console.png`);

  // Level filter: turning "warn" off hides the warning.
  await page.eval(`[...document.querySelectorAll('.level-chip')].find(b => b.innerText.startsWith('warn')).click()`);
  await wait(200);
  check('level filters hide messages', !(await logText()).includes('live-warning'));
  await page.eval(`[...document.querySelectorAll('.level-chip')].find(b => b.innerText.startsWith('warn')).click()`);

  // Clear.
  await page.eval(`[...document.querySelectorAll('.toolbar .button')].find(b => b.innerText === 'Clear').click()`);
  await wait(200);
  check('Clear empties the Console', (await page.eval('document.querySelectorAll(".entry").length')) === 0);

  const errors = page.console.filter((c) => c.type === 'error' || c.type === 'exception');
  check('no console errors in DevTools itself', errors.length === 0, errors.map((e) => e.text).join(' | '));
} finally {
  await browser.close();
  gdp.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
