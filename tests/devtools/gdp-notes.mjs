// GDP Inspector check against examples/notes-app (V8): drives the app by
// automatic element IDs (the app has no testIDs), then checks component
// names, layout, highlight, live prop edits, the damage stream and the
// accessibility tree, reading screenshot pixels.
// Doesn't save anything, so the app's notes database is left alone.
//
// Start the app with `GLYX_CPU_RENDER=1 glyx dev --devtools`, then from
// examples/notes-app:
//
//   bun ../../tests/devtools/gdp-notes.mjs target/glyx/devtools.json
//
// Exits non-zero if any check fails.
import { readFileSync } from 'node:fs';
import { inflateSync } from 'node:zlib';
import { connect } from '../../scripts/devtools/gdp-client.mjs';

const info = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + detail : ''}`);
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Decode an 8-bit RGBA PNG (what GDP screenshots are) to { width, height, px }. */
function decodePng(b64) {
  const buf = Buffer.from(b64, 'base64');
  let off = 8, width = 0, height = 0;
  const idat = [];
  while (off < buf.length) {
    const len = buf.readUInt32BE(off);
    const type = buf.toString('ascii', off + 4, off + 8);
    const data = buf.subarray(off + 8, off + 8 + len);
    if (type === 'IHDR') { width = data.readUInt32BE(0); height = data.readUInt32BE(4); }
    if (type === 'IDAT') idat.push(data);
    off += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = width * 4;
  const px = Buffer.alloc(stride * height);
  for (let y = 0; y < height; y++) {
    const f = raw[y * (stride + 1)];
    const line = raw.subarray(y * (stride + 1) + 1, (y + 1) * (stride + 1));
    for (let x = 0; x < stride; x++) {
      const a = x >= 4 ? px[y * stride + x - 4] : 0;
      const b = y > 0 ? px[(y - 1) * stride + x] : 0;
      const c = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
      const p = a + b - c;
      const pr = Math.abs(p - a) <= Math.abs(p - b) && Math.abs(p - a) <= Math.abs(p - c) ? a
        : Math.abs(p - b) <= Math.abs(p - c) ? b : c;
      const pred = [0, a, b, (a + b) >> 1, pr][f];
      px[y * stride + x] = (line[x] + pred) & 255;
    }
  }
  return { width, height, px };
}
/** Share of pixels matching `test(r, g, b)`. */
function share(img, test) {
  let n = 0;
  for (let i = 0; i < img.px.length; i += 4) if (test(img.px[i], img.px[i + 1], img.px[i + 2])) n++;
  return n / (img.width * img.height);
}

const gdp = await connect(info);
const hs = await gdp.call('Runtime.handshake', { token: info.token });
check('handshake', hs.result?.engine, `engine=${hs.result?.engine}`);

// Find a control once by what the user sees, then use its element ID.
// `text` finds the label's Text node; the control is its parent.
async function controlFor(text) {
  const t = (await gdp.call('Automation.findNodes', { text, type: 'Text' })).result?.nodes?.find((n) => n.visible);
  if (!t) return null;
  const parent = (await gdp.call('Inspector.getNode', { nodeId: t.nodeId })).result?.parentId;
  return (await gdp.call('Automation.findNodes', { nodeId: parent })).result?.nodes?.[0] ?? null;
}

const newBtn = await controlFor('+ New');
check('"+ New" has an automatic element ID (not pinned)', newBtn?.id && !newBtn.pinned, newBtn?.id);
const opened = await gdp.call('Automation.click', { id: newBtn?.id });
check('click by element ID', opened.result, JSON.stringify(opened.error ?? ''));
await gdp.call('Automation.waitFor', { text: 'Note title…', condition: 'visible', timeoutMs: 3000 });
const titleField = await controlFor('Note title…'); // placeholder text inside the field
const titleAutoId = titleField?.id;
const titleId = titleField?.nodeId;
check('the title field has an element ID', titleAutoId && !titleField.pinned, titleAutoId);
await gdp.call('Automation.click', { id: titleAutoId });
await wait(150);
await gdp.call('Automation.type', { text: 'GDP note' });
const typed = await gdp.call('Automation.waitFor', { text: 'GDP note', timeoutMs: 2000 });
check('typing reaches the focused title field', typed.result?.nodeIds?.length > 0);
const again = (await gdp.call('Automation.findNodes', { id: titleAutoId })).result?.nodes?.[0];
check('the ID is unchanged after re-renders', again?.nodeId === titleId);

// Component names.
const saveBtn = await controlFor('Save Note');
const saveName = saveBtn?.component;
check('nodes carry their React component names', /^Btn(@app\.jsx:\d+)? › Pressable$/.test(saveName ?? ''), String(saveName));
const tree = await gdp.call('Inspector.getTree', {});
const named = JSON.stringify(tree.result).match(/"component":"[^"]+"/g) ?? [];
check('getTree names nodes too', named.length > 5, `${named.length} named`);

// Layout.
const lay = await gdp.call('Inspector.getLayout', { id: titleAutoId });
const [lx, ly, lw, lh] = lay.result?.rect ?? [];
check('getLayout gives the field\'s rects', lw > 100 && lh > 20 && lay.result.layoutRect?.length === 4, JSON.stringify(lay.result?.rect));

// Highlight: blue-tinted fill over the node in a screenshot.
const before = decodePng((await gdp.call('Automation.screenshot', { nodeId: titleId })).result.data);
await gdp.call('Inspector.highlightNode', { id: titleAutoId });
await wait(250);
const lit = decodePng((await gdp.call('Automation.screenshot', { nodeId: titleId })).result.data);
const blue = (img) => share(img, (r, g, b) => b > r + 40 && b > g + 10);
check('highlightNode tints the node blue', blue(lit) > blue(before) + 0.2, `${blue(before).toFixed(2)} → ${blue(lit).toFixed(2)}`);
await gdp.call('Inspector.highlightNode', { nodeId: null });
await wait(250);
const cleared = decodePng((await gdp.call('Automation.screenshot', { nodeId: titleId })).result.data);
check('highlightNode(null) removes it', Math.abs(blue(cleared) - blue(before)) < 0.05);

// Live prop edit, seen in props and in pixels.
const set = await gdp.call('Inspector.setNodeProp', { nodeId: titleId, name: 'backgroundColor', value: '#ff0000' });
await wait(250);
const node = await gdp.call('Inspector.getNode', { nodeId: titleId });
const red = decodePng((await gdp.call('Automation.screenshot', { nodeId: titleId })).result.data);
const redShare = share(red, (r, g, b) => r > 200 && g < 60 && b < 60);
check('setNodeProp changes the prop', set.result && node.result?.props?.backgroundColor === '#ff0000ff');
check('…and the pixels', redShare > 0.5, `${(redShare * 100).toFixed(0)}% red`);
const bad = await gdp.call('Inspector.setNodeProp', { nodeId: titleId, name: 'onPress', value: 1 });
const unknown = await gdp.call('Automation.click', { id: 'App#0 › Nope#9' });
check('setNodeProp rejects props it can\'t set', bad.error?.code === -32602);
check('an unknown element ID is NO_SUCH_NODE', unknown.error?.code === -32004);

// Damage: one keystroke redraws a small part of the window on the CPU renderer.
await gdp.call('Inspector.enableDamage');
await wait(300);
gdp.events.length = 0;
await gdp.call('Automation.type', { text: '!' });
await wait(400);
const frames = gdp.events.filter((e) => e.event === 'Inspector.frameDamage').map((e) => e.params);
const win = hs.result.windows[0];
// The stream's promise: every redrawn frame reported, partial ones with the
// area inside the window. (How much a keystroke redraws is the app's own
// render behaviour: notes-app re-renders its whole editor on each key.)
const partial = frames.filter((f) => f.partial && f.rect[2] > 0 && f.rect[3] > 0
  && f.rect[0] + f.rect[2] <= win.width + 8 && f.rect[1] + f.rect[3] <= win.height + 8);
check('frameDamage streams partial frames for a keystroke', partial.length > 0 && frames.every((f) => typeof f.dirtyCount === 'number'),
  `${frames.length} frames: ${frames.map((f) => f.partial ? `${f.rect[2]}×${f.rect[3]}` : 'full').join(', ')}`);
await gdp.call('Inspector.disableDamage');

// Accessibility tree: notes-app isn't built with a11y, so this must say so.
const ax = await gdp.call('Inspector.getAccessibilityTree', {});
check('getAccessibilityTree answers (tree, or UNSUPPORTED without a11y)',
  ax.result?.root || ax.error?.code === -32006, ax.error?.message ?? `root role ${ax.result?.root?.role}`);

// Leave without saving, then reopen: the editor remounts with new node ids,
// but the element IDs are the same.
const backBtn = await controlFor('← Back');
await gdp.call('Automation.click', { id: backBtn?.id });
const back = await gdp.call('Automation.waitFor', { id: newBtn?.id, condition: 'visible', timeoutMs: 3000 });
check('back to the list, found by element ID (nothing saved)', back.result);
await gdp.call('Automation.click', { id: newBtn?.id });
const reopened = await gdp.call('Automation.waitFor', { id: titleAutoId, condition: 'visible', timeoutMs: 3000 });
const newNode = reopened.result?.nodeIds?.[0];
check('after a remount the same element ID finds the new node', newNode != null && newNode !== titleId,
  `node ${titleId} → ${newNode}`);
await gdp.call('Automation.click', { id: backBtn?.id });
await gdp.call('Automation.waitFor', { id: newBtn?.id, condition: 'visible', timeoutMs: 3000 });

gdp.close();
const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
