// GDP Inspector + Automation check against examples/calculator: clicks
// 7 + 5 = through the real input path, waits for 12, inspects the tree and
// takes screenshots. Start the app with `glyx dev --devtools` (add
// GLYX_CPU_RENDER=1 for screenshots), then from examples/calculator:
//
//   bun ../../tests/devtools/gdp-calculator.mjs target/glyx/devtools.json [out-dir]
//
// Exits non-zero if any check fails. With out-dir, screenshots are saved there.
import { readFileSync, writeFileSync } from 'node:fs';
import { connect } from '../../scripts/devtools/gdp-client.mjs';

const info = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const outDir = process.argv[3];
const results = [];
const check = (name, ok, detail = '') => {
  results.push(ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};

const gdp = await connect(info);
const hs = await gdp.call('Runtime.handshake', { token: info.token });
check('handshake lists the automation methods', ['Inspector.getTree', 'Automation.click', 'Automation.waitFor'].every((m) => hs.result?.methods.includes(m)));

const tree = await gdp.call('Inspector.getTree', { depth: 2 });
check('getTree returns a root and a node count', tree.result?.root?.nodeId != null && tree.result.nodeCount > 10, `nodeCount=${tree.result?.nodeCount}`);

// Clear first, so earlier runs don't matter.
const clear = await gdp.call('Automation.findNodes', { text: 'C', type: 'Text' });
if (clear.result?.nodes?.[0]) await gdp.call('Automation.click', { nodeId: clear.result.nodes[0].nodeId });

async function tap(label) {
  const found = await gdp.call('Automation.findNodes', { text: label, type: 'Text' });
  const node = found.result?.nodes?.find((n) => n.visible);
  if (!node) return false;
  const r = await gdp.call('Automation.click', { nodeId: node.nodeId });
  return !!r.result;
}
let tapped = true;
for (const k of ['7', '+', '5', '=']) tapped = (await tap(k)) && tapped;
check('found and clicked 7 + 5 =', tapped);

const done = await gdp.call('Automation.waitFor', { text: '12', condition: 'visible', timeoutMs: 3000 });
check('waitFor sees the result 12', done.result?.nodeIds?.length > 0, JSON.stringify(done.error ?? done.result));

const resultId = done.result?.nodeIds?.[0];
const node = resultId != null ? await gdp.call('Inspector.getNode', { nodeId: resultId }) : {};
check('getNode returns props, rect and a root-first path', node.result?.props?.text === '12' && node.result.rect?.length === 4 && node.result.path?.at(-1) === resultId);

if (node.result?.rect) {
  const [x, y, w, h] = node.result.rect;
  // Hit-testing returns the topmost solid node (often a Pressable over the
  // text), so check it covers the point and its path starts at the root.
  const px = x + w / 2, py = y + h / 2;
  const pick = await gdp.call('Inspector.selectElement', { x: px, y: py });
  const [rx, ry, rw, rh] = pick.result?.node?.rect ?? [];
  check('selectElement picks a node covering the point', rx <= px && px <= rx + rw && ry <= py && py <= ry + rh
    && pick.result.path[0] === tree.result.root.nodeId, JSON.stringify(pick.result?.path));
}

const timeout = await gdp.call('Automation.waitFor', { text: 'never-shown', timeoutMs: 300 });
check('waitFor times out with TIMEOUT', timeout.error?.code === -32005);

const gone = await gdp.call('Automation.waitFor', { text: 'never-shown', condition: 'gone', timeoutMs: 300 });
check('waitFor gone is met at once for an absent node', Array.isArray(gone.result?.nodeIds));

const missing = await gdp.call('Inspector.getNode', { nodeId: 987654 });
check('getNode on a missing node is NO_SUCH_NODE', missing.error?.code === -32004);

const shot = await gdp.call('Automation.screenshot', {});
if (shot.error?.code === -32006) {
  check('screenshot (skipped: GPU renderer, set GLYX_CPU_RENDER=1)', true, shot.error.message);
} else {
  const win = hs.result.windows[0];
  const png = Buffer.from(shot.result?.data ?? '', 'base64');
  check('screenshot is a PNG of the whole window', png.subarray(1, 4).toString() === 'PNG' && shot.result.width === win.width && shot.result.height === win.height, `${shot.result?.width}x${shot.result?.height}`);
  const crop = resultId != null ? await gdp.call('Automation.screenshot', { nodeId: resultId }) : {};
  check('screenshot of one node is cropped to it', crop.result?.width > 0 && crop.result.width < win.width, `${crop.result?.width}x${crop.result?.height}`);
  if (outDir) {
    writeFileSync(`${outDir}/gdp-window.png`, png);
    if (crop.result) writeFileSync(`${outDir}/gdp-node.png`, Buffer.from(crop.result.data, 'base64'));
  }
}

gdp.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
