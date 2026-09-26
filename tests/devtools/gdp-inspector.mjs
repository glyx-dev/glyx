// GDP Inspector (DevTools D1) check against examples/calculator: select mode
// (hover outline, pick, Escape, disconnect safety), tree-change events and
// the accessibility audit.
//
// Start the app with `glyx dev --devtools`, then from examples/calculator:
//
//   bun ../../tests/devtools/gdp-inspector.mjs target/glyx/devtools.json
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
await gdp.call('Runtime.handshake', { token: info.token });

const display = async () => (await gdp.call('Automation.findNodes', { type: 'Text' })).result.nodes
  .filter((n) => n.visible && n.rect[1] > 40 && n.rect[1] < 110 && n.text)[0]?.text;
const keyRect = async (label) => (await gdp.call('Automation.findNodes', { text: label, type: 'Text' })).result.nodes.find((n) => n.visible)?.rect;
const center = ([x, y, w, h]) => ({ x: x + w / 2, y: y + h / 2 });

await gdp.call('Automation.click', { id: (await gdp.call('Automation.findNodes', { text: 'C', type: 'Text' })).result.nodes[0].id });
await wait(200);
const before = await display();

// ── Select mode: hover outlines, a click picks instead of pressing ─────────
await gdp.call('Inspector.setInspectMode', { enabled: true });
const seven = center(await keyRect('7'));
await gdp.call('Automation.dispatchInput', { type: 'pointerMove', ...seven });
await wait(150);
await gdp.call('Automation.dispatchInput', { type: 'pointerDown' });
await gdp.call('Automation.dispatchInput', { type: 'pointerUp' });
await wait(300);
const picked = events(gdp, 'Inspector.nodePicked')[0];
check('a click in select mode picks the element', picked?.nodeId != null, `${picked?.id} (${picked?.component})`);
check('the pick carries its element ID, component and path', picked?.id && picked?.component && picked?.path?.length > 1);
check('the click did not reach the app', (await display()) === before, `display "${await display()}"`);
const ended = events(gdp, 'Inspector.inspectModeChanged').at(-1);
check('picking ends select mode', ended?.enabled === false && ended.reason === 'picked', JSON.stringify(ended));

// After select mode, clicks reach the app again.
await gdp.call('Automation.click', { x: seven.x, y: seven.y });
await wait(250);
check('clicks reach the app again afterwards', (await display()) === '7', `display "${await display()}"`);

// ── Escape cancels ─────────────────────────────────────────────────────────
gdp.events.length = 0;
await gdp.call('Inspector.setInspectMode', { enabled: true });
await gdp.call('Automation.press', { key: 'Escape' });
await wait(250);
const cancelled = events(gdp, 'Inspector.inspectModeChanged').at(-1);
check('Escape cancels select mode', cancelled?.enabled === false && cancelled.reason === 'cancelled', JSON.stringify(cancelled));

// ── A client that disconnects in select mode gives the app its clicks back ─
const other = await connect(info);
await other.call('Runtime.handshake', { token: info.token });
await other.call('Inspector.setInspectMode', { enabled: true });
other.close();
await wait(400);
await gdp.call('Automation.click', { x: seven.x, y: seven.y });
await wait(250);
check('disconnecting in select mode switches it off', (await display()) === '77', `display "${await display()}"`);

// ── Tree changes ───────────────────────────────────────────────────────────
await gdp.call('Inspector.enableTreeEvents');
await wait(200);
gdp.events.length = 0;
await gdp.call('Automation.click', { x: seven.x, y: seven.y });
await wait(300);
const changes = events(gdp, 'Inspector.treeChanged');
check('the tree announces changes', changes.length > 0, `${changes.length} event(s), version ${changes.at(-1)?.version}`);
gdp.events.length = 0;
await wait(400);
check('and stays quiet when nothing changes', events(gdp, 'Inspector.treeChanged').length === 0);
await gdp.call('Inspector.disableTreeEvents');

// ── Accessibility audit ────────────────────────────────────────────────────
const audit = (await gdp.call('Inspector.auditAccessibility', {})).result;
const rules = [...new Set(audit?.issues?.map((i) => i.rule))];
check('the audit runs and reports issues with element IDs', Array.isArray(audit?.issues) && audit.issues.every((i) => i.id && i.message),
  `${audit?.errors} errors, ${audit?.warnings} warnings: ${rules.join(', ')}`);

await gdp.call('Inspector.highlightNode', { nodeId: null });
gdp.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
