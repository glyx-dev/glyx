// Glyx DevTools UI, phase D4 (Animations): drives the real UI in a headless
// browser against motion-demo, checking the app's motion clock over GDP.
//
//   glyx dev --devtools           (in examples/motion-demo)
//   glyx inspect --no-open
//   bun tests/devtools-ui/d4.mjs "<DevTools URL>" examples/motion-demo/target/glyx/devtools.json [screenshot-dir]
//
// Exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { launch } from './browser.mjs';
import { connect } from '../../scripts/devtools/gdp-client.mjs';

const [url, appFile, shots] = process.argv.slice(2);
if (!url || !appFile) { console.error('usage: bun tests/devtools-ui/d4.mjs <devtools url> <app devtools.json> [screenshot dir]'); process.exit(2); }

const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const info = JSON.parse(readFileSync(appFile, 'utf8'));
const gdp = await connect(info);
await gdp.call('Runtime.handshake', { token: info.token });
const rate = async () => (await gdp.call('Animation.getPlayback', {})).result.rate;
/** Elapsed time of the first infinite keyframe animation, on the app's motion clock. */
const loopElapsed = async () => (await gdp.call('Animation.list', {})).result.running.find((r) => r.iterations === 'infinite')?.elapsedMs;

const browser = await launch({ width: 1400, height: 860 });
try {
  const page = await browser.open(`${url}&theme=dark`);
  await page.waitForText('Connected', 10000);
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '5', altKey: true }))`);
  await page.waitForText('Normal speed', 5000);
  await wait(500);

  const lanes = await page.eval('[...document.querySelectorAll(".lane")].map(l => l.querySelector(".lane-head").innerText.replace(/\\n/g, " "))');
  check('running animations get lanes with their component', lanes.length >= 2 && lanes.some((l) => l.startsWith('Keyframes')), lanes.slice(0, 3).join(' | '));
  check('endless animations show a live iteration', await page.eval('[...document.querySelectorAll(".lane-time")].some(t => /#\\d+/.test(t.innerText))'));

  // Pause: the app's animation time stops.
  await page.eval(`document.querySelector('.anim .toolbar .icon-button').click()`);
  await wait(300);
  const e1 = await loopElapsed(); await wait(400); const e2 = await loopElapsed();
  check('Pause freezes animation time in the app', (await rate()) === 0 && Math.abs(e2 - e1) < 1, `${e1} → ${e2} ms over 400 ms`);

  // Step +100 ms while paused.
  await page.eval(`[...document.querySelectorAll('.anim .toolbar .button')].find(b => b.innerText === '+100 ms').click()`);
  await wait(300);
  const e3 = await loopElapsed();
  check('+100 ms moves animation time forward by 100 ms', Math.abs(e3 - e2 - 100) < 2, `${e2} → ${e3}`);

  // Slow motion: 0.25x.
  await page.eval(`[...document.querySelectorAll('.anim .level-chip')].find(b => b.innerText === '0.25×').click()`);
  await wait(200);
  const s1 = await loopElapsed(); const t1 = Date.now();
  await wait(800);
  const s2 = await loopElapsed(); const t2 = Date.now();
  const ratio = (s2 - s1) / (t2 - t1);
  check('0.25× runs animation time at a quarter speed', (await rate()) === 0.25 && ratio > 0.15 && ratio < 0.35, `ratio ${ratio.toFixed(2)}`);
  if (shots) await page.screenshot(`${shots}/devtools-d4-anim.png`);

  // Back to 1x, then press the demo's Play: transitions show up, then end.
  await page.eval(`[...document.querySelectorAll('.anim .level-chip')].find(b => b.innerText === '1×').click()`);
  await wait(200);
  const toggle = (await gdp.call('Automation.findNodes', { text: 'Pause auto-play', type: 'Text' })).result.nodes[0];
  if (toggle) await gdp.call('Automation.click', { nodeId: toggle.nodeId });
  await wait(2200);
  const play = (await gdp.call('Automation.findNodes', { text: 'Play', type: 'Text' })).result.nodes[0]
    ?? (await gdp.call('Automation.findNodes', { text: 'Reverse', type: 'Text' })).result.nodes[0];
  await gdp.call('Automation.click', { nodeId: play.nodeId });
  await wait(300);
  const tr = await page.eval('[...document.querySelectorAll(".lane")].filter(l => l.querySelector(".kind-transition")).map(l => l.innerText.replace(/\\n/g, " "))');
  check('transitions get lanes with what they animate', tr.length > 0 && tr.some((t) => /transform|opacity|backgroundColor/.test(t)), tr[0]);
  check('lanes show the easing curve', await page.eval('document.querySelectorAll(".lane .curve path").length > 0'));
  await wait(1600);
  check('finished transitions stay briefly, faded', await page.eval('document.querySelectorAll(".lane.ended").length > 0'));
  const auto = (await gdp.call('Automation.findNodes', { text: 'Auto-play', type: 'Text' })).result.nodes[0];
  if (auto) await gdp.call('Automation.click', { nodeId: auto.nodeId });

  // Leaving the panel restores normal speed.
  await page.eval(`[...document.querySelectorAll('.anim .level-chip')].find(b => b.innerText === '0.1×').click()`);
  await wait(200);
  await page.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', altKey: true }))`);
  await wait(400);
  check('leaving the panel puts the app back to 1×', (await rate()) === 1);

  const errors = page.console.filter((c) => c.type === 'error' || c.type === 'exception');
  check('no console errors in DevTools itself', errors.length === 0, errors.map((e) => e.text).join(' | '));
} finally {
  await browser.close();
}

// A client that slows the app and disconnects doesn't leave it slow.
const other = await connect(info);
await other.call('Runtime.handshake', { token: info.token });
await other.call('Animation.setPlaybackRate', { rate: 0.5 });
const slowed = await rate();
other.close();
await wait(500);
check('a client that disconnects leaves the app at 1×', slowed === 0.5 && (await rate()) === 1);
gdp.close();

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
