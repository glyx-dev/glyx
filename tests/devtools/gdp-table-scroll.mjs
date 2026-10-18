// Frame cost of scrolling a big table, over the Glyx DevTools Protocol.
//
// Start examples/big-table with `glyx dev --devtools` (a fresh launch per variant: the label-cache
// size is read at startup, see GLYX_LABEL_CACHE), then from examples/big-table:
//
//   bun ../../tests/devtools/gdp-table-scroll.mjs target/glyx/devtools.json [label]
//
// It scrolls the table slowly (2 rows per step) and then fast (20 rows per step), and prints the mean,
// 95th percentile and worst frame for each phase, plus the app's memory. Compare two launches
// interleaved (A, B, A, B): timings on a CPU-rendered machine swing a lot run to run.
import { readFileSync } from 'node:fs';
import { connect } from '../../scripts/devtools/gdp-client.mjs';

const info = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const label = process.argv[3] ?? '';
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const gdp = await connect(info);
await gdp.call('Runtime.handshake', { token: info.token });
await gdp.call('Performance.enableFrames');
await wait(2500); // let the first frames (building ~1000 cells) settle

const frames = () => gdp.events.filter((e) => e.event === 'Performance.frame').map((e) => e.params);
const pct = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0; };
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);

async function phase(name, steps, deltaY, gapMs) {
  const from = frames().length;
  for (let i = 0; i < steps; i++) {
    // positive deltaY scrolls down (later rows come into view)
    await gdp.call('Automation.scroll', { deltaY, x: 600, y: 400, smooth: false });
    await wait(gapMs);
  }
  await wait(400);
  const fs = frames().slice(from);
  // workTime is the frame's own cost (start to presented); frameTime would be the gap since the previous
  // frame, which here is just the pause between scroll steps.
  const ft = fs.map((f) => f.workTime);
  const part = (k) => mean(fs.map((f) => f[k] ?? 0));
  console.log(
    `${label} ${name.padEnd(5)} frames=${String(fs.length).padStart(3)}  work mean ${mean(ft).toFixed(1)} ms  median ${pct(ft, 0.5).toFixed(1)}  p95 ${pct(ft, 0.95).toFixed(1)}  max ${Math.max(0, ...ft).toFixed(1)}` +
    `   (js ${part('jsTime').toFixed(1)}, layout ${part('layoutTime').toFixed(1)}, render ${part('renderTime').toFixed(1)}, present ${part('presentTime').toFixed(1)})`,
  );
}

// Is the first row (user0@x.com) on screen? It must be before scrolling and gone after; if it is still there the
// table did not scroll and the numbers mean nothing.
const rowVisible = async (text) => !!(await gdp.call('Automation.findNodes', { text, type: 'Text' })).result?.nodes?.some((n) => n.visible);
console.log(`${label} before scrolling, row 0 visible: ${await rowVisible('user0@x.com')}`);
await phase('slow', 40, 56, 120);
await phase('fast', 20, 560, 200);
console.log(`${label} after scrolling, row 0 visible: ${await rowVisible('user0@x.com')}`);

const snap = (await gdp.call('Performance.snapshot', {})).result;
console.log(`${label} memory: ${JSON.stringify(snap?.memory ?? {})}`);
gdp.close?.();
process.exit(0);
