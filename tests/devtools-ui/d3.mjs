// Glyx DevTools UI, phase D3 (Performance): drives the real UI in a headless
// browser against motion-demo (always animating, so there are frames).
//
//   GLYX_CPU_RENDER=1 glyx dev --devtools   (in examples/motion-demo; CPU renderer for the pixel check)
//   glyx inspect --no-open
//   bun tests/devtools-ui/d3.mjs "<DevTools URL>" examples/motion-demo/target/glyx/devtools.json [screenshot-dir]
//
// Exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { launch } from './browser.mjs';
import { connect } from '../../scripts/devtools/gdp-client.mjs';

const [url, appFile, shots] = process.argv.slice(2);
if (!url || !appFile) { console.error('usage: bun tests/devtools-ui/d3.mjs <devtools url> <app devtools.json> [screenshot dir]'); process.exit(2); }

const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Share of amber pixels in a GDP screenshot (8-bit RGBA PNG). */
function amberShare(b64) {
  const buf = Buffer.from(b64, 'base64');
  let off = 8, w = 0, h = 0; const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off), type = buf.toString('ascii', off + 4, off + 8), data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { w = data.readUInt32BE(0); h = data.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat)); const stride = w * 4; const px = Buffer.alloc(stride * h);
  for (let y = 0; y < h; y++) {
    const f = raw[y * (stride + 1)], line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4] : 0, b = y > 0 ? px[(y - 1) * stride + x] : 0, c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
      const p = a + b - c, pr = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      px[y * stride + x] = (line[x] + [0, a, b, (a + b) >> 1, pr][f]) & 255;
    }
  }
  let n = 0;
  for (let i = 0; i < px.length; i += 4) if (px[i] > 150 && px[i + 1] > 90 && px[i + 1] < 200 && px[i + 2] < 90) n++;
  return n / (w * h);
}

const info = JSON.parse(readFileSync(appFile, 'utf8'));
const gdp = await connect(info);
await gdp.call('Runtime.handshake', { token: info.token });

const browser = await launch({ width: 1400, height: 900 });
try {
  const page = await browser.open(`${url}&theme=dark`);
  await page.waitForText('Connected', 10000);
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '4', altKey: true }))`);
  await page.waitForText('Paint flashing', 5000);
  await wait(2500);

  const cards = await page.eval('[...document.querySelectorAll(".perf-cards .card")].map(c => c.innerText.replace(/\\n+/g, " "))');
  const fps = Number((cards[0] ?? '').match(/FPS (\d+)/)?.[1]);
  check('frames stream in and the summary shows fps', fps > 10, cards[0]);
  check('frame time percentiles are shown', /p90 [\d.]+ ms · p99 [\d.]+ ms/.test(cards[1] ?? ''), cards[1]);
  check('the chart has frames', !(await page.eval('!!document.querySelector(".chart-empty")')));

  // Click the newest bar: frame detail + why it rendered.
  await page.eval(`(() => {
    const c = document.querySelector('.chart canvas'); const r = c.getBoundingClientRect();
    // Frames held (from the FPS card), so we click the newest drawn bar.
    const frames = Number(document.querySelector('.perf-cards .card .card-sub').innerText.match(/(\\d+) frames/)?.[1] ?? 0);
    c.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + Math.min(frames, Math.floor(r.width / 5)) * 5 - 3, clientY: r.top + r.height / 2 }));
  })()`);
  await page.waitForText('Why did this frame render?', 3000).catch(() => {});
  await wait(600);
  const fd = await page.eval('document.querySelector(".frame-detail")?.innerText.replace(/\\n+/g, " ") ?? ""');
  check('clicking a bar shows the frame\'s breakdown', /Frame \d+/i.test(fd) && /render/.test(fd), fd.slice(0, 120));
  const changed = fd.match(/(\d+) elements? changed/);
  check('…and which elements changed (why it rendered)', changed && Number(changed[1]) > 0 && await page.eval('document.querySelectorAll(".dirty-row").length > 0'),
    changed?.[0]);
  if (shots) await page.screenshot(`${shots}/devtools-d3-perf.png`);

  // Budget picker sets the app's budget.
  await page.eval(`(() => { const s = document.querySelector('select[aria-label="Frame budget"]'); s.value = '8.333'; s.dispatchEvent(new Event('change', { bubbles: true })); })()`);
  await wait(300);
  const b = (await gdp.call('Performance.getBudget', {})).result.budgetMs;
  check('the budget picker changes the app\'s frame budget', Math.abs(b - 8.333) < 0.01, `${b} ms`);
  await gdp.call('Performance.setBudget', { ms: 16.667 });

  // Record / stop.
  await page.eval(`[...document.querySelectorAll('.toolbar .button')].find(b => b.innerText.includes('Record')).click()`);
  await wait(1200);
  const rec = await page.eval('document.querySelector(".perf-mode").innerText');
  await page.eval(`[...document.querySelectorAll('.toolbar .button')].find(b => b.innerText.includes('Stop')).click()`);
  await wait(500);
  const n1 = await page.eval('document.querySelector(".perf-mode").innerText');
  await wait(500);
  const n2 = await page.eval('document.querySelector(".perf-mode").innerText');
  check('Record captures frames and Stop freezes them', /Recording · \d+ frames/.test(rec) && /Stopped · \d+ frames/.test(n1) && n1 === n2, `${rec} → ${n1}`);
  await page.eval(`[...document.querySelectorAll('.toolbar .button')].find(b => b.innerText === 'Live').click()`);

  // Paint flashing shows in the app.
  const before = amberShare((await gdp.call('Automation.screenshot', {})).result.data);
  await page.eval(`document.querySelector('input[type=checkbox]').click()`);
  await wait(250);
  const during = amberShare((await gdp.call('Automation.screenshot', {})).result.data);
  await page.eval(`document.querySelector('input[type=checkbox]').click()`);
  await wait(700);
  const after = amberShare((await gdp.call('Automation.screenshot', {})).result.data);
  check('paint flashing outlines redrawn areas in the app', during > before + 0.002, `${(before * 100).toFixed(2)}% → ${(during * 100).toFixed(2)}% amber`);
  check('…and leaves nothing behind when turned off', after < before + 0.002, `${(after * 100).toFixed(2)}% amber after`);

  const errors = page.console.filter((c) => c.type === 'error' || c.type === 'exception');
  check('no console errors in DevTools itself', errors.length === 0, errors.map((e) => e.text).join(' | '));
} finally {
  await browser.close();
  gdp.close();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
