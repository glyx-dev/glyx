// Glyx DevTools UI, phase D0 (shell + connection): drives the real UI in a
// headless browser against a running `glyx inspect` and app.
//
//   glyx dev --devtools           (in an example, e.g. examples/calculator)
//   glyx inspect --no-open        (prints the DevTools URL)
//   bun tests/devtools-ui/d0.mjs "<that URL>" [screenshot-dir]
//
// Exits non-zero if any check fails.
import { launch } from './browser.mjs';

const [url, shots] = process.argv.slice(2);
if (!url) { console.error('usage: bun tests/devtools-ui/d0.mjs <devtools url> [screenshot dir]'); process.exit(2); }

const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};

const browser = await launch();
try {
  const page = await browser.open(`${url}&theme=dark`);

  await page.waitForText('Connected', 10000).catch(() => {});
  const conn = await page.eval('document.querySelector(".conn")?.innerText ?? ""');
  check('attaches to the running app by itself', conn.startsWith('Connected'), conn);

  const cards = await page.eval('[...document.querySelectorAll(".card")].map(c => c.innerText.replace(/\\n+/g, " "))');
  check('Overview shows engine, process, version and round trip', cards.length === 4 && /QuickJS|V8/.test(cards[0]), cards.join(' | '));
  await page.waitForText(' ms', 5000).catch(() => {});
  const rtt = await page.eval('document.querySelectorAll(".card-value")[3]?.innerText ?? ""');
  check('round trip is measured', /ms$/.test(rtt), rtt);

  const domains = await page.eval('[...document.querySelectorAll(".domain-name")].map(d => d.innerText)');
  check('lists what the app supports, by domain', ['Runtime', 'Inspector', 'Automation', 'Performance', 'Animation'].every((d) => domains.includes(d)), domains.join(', '));

  if (shots) await page.screenshot(`${shots}/devtools-d0-dark.png`);

  // Theme toggle.
  await page.click('.topbar .icon-button');
  const theme = await page.eval('document.documentElement.dataset.theme');
  check('the theme toggle switches to light', theme === 'light', theme);
  const bg = await page.eval('getComputedStyle(document.body).backgroundColor');
  check('light theme uses the light page token', bg === 'rgb(255, 255, 255)', bg);
  if (shots) await page.screenshot(`${shots}/devtools-d0-light.png`);

  // Keyboard: Alt+2 opens the Inspector panel.
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '2', altKey: true }))`);
  await page.waitForText('Planned for phase D1', 3000).catch(() => {});
  const main = await page.eval('document.querySelector("main")?.getAttribute("aria-label")');
  check('Alt+2 switches to the Inspector panel', main === 'Inspector', main);

  // Every rail item is a real button (keyboard reachable) with a label.
  const rail = await page.eval('[...document.querySelectorAll(".rail-item")].map(b => b.tagName + ":" + b.innerText.split("\\n")[0])');
  check('the rail is 9 keyboard-reachable buttons', rail.length === 9 && rail.every((r) => r.startsWith('BUTTON:')), rail.join(', '));

  const errors = page.console.filter((c) => c.type === 'error' || c.type === 'exception');
  check('no console errors', errors.length === 0, errors.map((e) => e.text).join(' | '));
} finally {
  await browser.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
