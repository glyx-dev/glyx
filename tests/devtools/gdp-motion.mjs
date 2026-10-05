// GDP Performance + Animation check against examples/motion-demo: frame
// stream, perf snapshot, budget violations, and animation start / end
// events for real transitions, plus waitForSettled's timeout (the demo runs
// infinite keyframe animations, so it never settles).
//
// Start the app with `glyx dev --devtools`, then from examples/motion-demo:
//
//   bun ../../tests/devtools/gdp-motion.mjs target/glyx/devtools.json
//
// Exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { connect } from '../../scripts/devtools/gdp-client.mjs';

const info = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const events = (gdp, name) => gdp.events.filter((e) => e.event === name).map((e) => e.params);

const gdp = await connect(info);
const hs = await gdp.call('Runtime.handshake', { token: info.token });
check('handshake lists Performance and Animation', ['Performance.snapshot', 'Animation.waitForSettled'].every((m) => hs.result?.methods.includes(m)));

const clickText = async (text) => {
  const t = (await gdp.call('Automation.findNodes', { text, type: 'Text' })).result?.nodes?.find((n) => n.visible);
  if (t) await gdp.call('Automation.click', { nodeId: t.nodeId });
  return !!t;
};

// Quiet the auto-play so one Play press is all that moves.
await clickText('Pause auto-play');
await wait(1600);

// Infinite keyframe animations are always running here.
const list = await gdp.call('Animation.list', {});
const infinite = (list.result?.running ?? []).filter((r) => r.kind === 'animation' && r.iterations === 'infinite');
check('Animation.list shows the running infinite animations', infinite.length >= 2, `${list.result?.running?.length} running`);

await gdp.call('Animation.enable');
await gdp.call('Performance.enableFrames');
await wait(300);
gdp.events.length = 0;

// The toggle reads "Play" or "Reverse" depending on where auto-play stopped.
check('pressed Play / Reverse', (await clickText('Play')) || (await clickText('Reverse')));
await wait(1700); // the transitions run 600 ms and 1200 ms

const started = events(gdp, 'Animation.started').filter((e) => e.kind === 'transition');
const ended = events(gdp, 'Animation.ended').filter((e) => e.kind === 'transition');
const durations = [...new Set(started.map((e) => e.durationMs))].sort((a, b) => a - b);
check('Play starts transitions (600 and 1200 ms)', durations.includes(600) && durations.includes(1200), JSON.stringify(durations));
const endedNodes = new Set(ended.map((e) => e.nodeId));
check('every started transition ends', started.length > 0 && started.every((e) => endedNodes.has(e.nodeId)),
  `${started.length} started, ${ended.length} ended`);

const frames = events(gdp, 'Performance.frame');
const seqOk = frames.every((f, i) => i === 0 || f.seq === frames[i - 1].seq + 1);
check('Performance.frame streams consecutive frames while animating', frames.length > 10 && seqOk, `${frames.length} frames`);
const timingOk = frames.every((f) => f.presentTime >= 0 && f.renderTime >= 0 && f.presentTime <= f.frameTime + 0.5);
check('each frame splits render and present (pacing excluded)', timingOk,
  `e.g. frame ${frames[5]?.frameTime} ms = render ${frames[5]?.renderTime} + present ${frames[5]?.presentTime}`);
check('frames report what is animating', frames.some((f) => f.animating >= 2));

const snap = (await gdp.call('Performance.snapshot', {})).result;
check('Performance.snapshot has fps, averages and memory',
  snap?.fps > 0 && snap.average.renderTime > 0 && snap.memory.heapUsed > 0,
  `fps ${snap?.fps}, render ${snap?.average.renderTime} ms, present ${snap?.average.presentTime} ms, p99 ${snap?.p99FrameTime} ms`);

// Budget violations, read without draining the app's own queue.
const budget = (await gdp.call('Performance.getBudget', {})).result?.budgetMs;
const before = (await gdp.call('Performance.getViolations', {})).result?.lastSeq ?? 0;
await gdp.call('Performance.setBudget', { ms: 0.01 });
await wait(400);
const v = (await gdp.call('Performance.getViolations', { since: before })).result;
await gdp.call('Performance.setBudget', { ms: budget });
check('a tiny budget produces violations, readable since a cursor',
  v?.entries?.length > 0 && v.entries.every((e) => e.seq > before && e.data.renderTime != null), `${v?.entries?.length} new`);
check('the budget is restored', (await gdp.call('Performance.getBudget', {})).result?.budgetMs === budget);
const bad = await gdp.call('Performance.setBudget', { ms: -1 });
check('setBudget rejects a bad value', bad.error?.code === -32602);

const settled = await gdp.call('Animation.waitForSettled', { timeoutMs: 400 });
check('waitForSettled times out while infinite animations run', settled.error?.code === -32005, settled.error?.message);

await clickText('Auto-play'); // leave the demo as it started
gdp.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
