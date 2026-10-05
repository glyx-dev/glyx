// `glyx mcp` end to end: speaks MCP over stdio to a real `glyx mcp`, the way
// an agent would, against running dev apps.
//
//   (examples/calculator)  GLYX_CPU_RENDER=1 glyx dev --devtools
//   (examples/notes-app)   glyx dev --devtools            (optional: GPU renderer)
//   bun tests/devtools/mcp-e2e.mjs [path/to/glyx]         (run from the repo root)
//
// Exits non-zero if any check fails.
import { spawn } from 'node:child_process';

const glyx = process.argv[2] ?? 'glyx';
const results = [];
const check = (name, ok, detail = '') => {
  results.push(!!ok);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? '  ' + String(detail).slice(0, 220).replace(/\n/g, ' ⏎ ') : ''}`);
};

const proc = spawn(glyx, ['mcp'], { stdio: ['pipe', 'pipe', 'pipe'] });
let buf = '';
const waiting = new Map();
let stdoutNoise = '';
proc.stdout.on('data', (d) => {
  buf += d;
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i); buf = buf.slice(i + 1);
    let msg;
    try { msg = JSON.parse(line); } catch { stdoutNoise += line; continue; }
    waiting.get(msg.id)?.(msg);
  }
});
let nextId = 0;
const rpc = (method, params) => new Promise((resolve, reject) => {
  const id = ++nextId;
  const t = setTimeout(() => reject(new Error(`${method} timed out`)), 30000);
  waiting.set(id, (m) => { clearTimeout(t); resolve(m); });
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
});
const tool = async (name, args = {}) => {
  const r = await rpc('tools/call', { name, arguments: args });
  const text = (r.result?.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('\n');
  return { ...r.result, text };
};

try {
  const init = await rpc('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'e2e', version: '1' } });
  check('initialize: tools capability and instructions', init.result?.capabilities?.tools && /glyx dev --devtools/.test(init.result.instructions), init.result?.protocolVersion);
  proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const list = await rpc('tools/list', {});
  const names = list.result.tools.map((t) => t.name);
  check('tools/list', ['list_apps', 'get_tree', 'click', 'type', 'wait_for', 'screenshot', 'evaluate'].every((n) => names.includes(n)), names.join(', '));

  const apps = await tool('list_apps');
  check('list_apps finds the calculator', /calculator/.test(apps.text), apps.text);
  const several = /notes-app/.test(apps.text);
  if (several) {
    const pick = await tool('select_app', { app: 'calculator' });
    check('select_app', /Using calculator/.test(pick.text), pick.text);
  }

  const tree = await tool('get_tree', { depth: 30 });
  check('get_tree: an outline with element IDs', /elements\n/.test(tree.text) && /· id App#0/.test(tree.text) && /Text "7"/.test(tree.text), tree.text.split('\n').slice(0, 3).join(' | '));

  await tool('click', { text: 'C' }); // clear
  for (const k of ['7', '+', '8', '=']) {
    const r = await tool('click', { text: k });
    if (r.isError) check(`click ${k}`, false, r.text);
  }
  const done = await tool('wait_for', { text: '15', condition: 'visible', timeoutMs: 3000 });
  check('click by text, then wait_for the result (7 + 8 = 15)', !done.isError, done.text);

  const found = await tool('find', { text: '15' });
  check('find', /Text "15" · id /.test(found.text), found.text);

  const ev = await tool('evaluate', { expression: '6 * 7' });
  check('evaluate', ev.text.trim() === '42', ev.text);
  await tool('evaluate', { expression: 'console.warn("mcp-e2e marker"); 1' });
  const con = await tool('console', { level: 'warn', limit: 5 });
  check('console', /\[warn\] mcp-e2e marker/.test(con.text), con.text);

  const shot = await tool('screenshot', {});
  const img = shot.content?.find((c) => c.type === 'image');
  check('screenshot returns a PNG image', img && img.mimeType === 'image/png' && img.data?.startsWith('iVBOR'), shot.text);

  const bad = await tool('click', { text: 'no such button' });
  check('errors come back as tool errors, not crashes', bad.isError && /no element with text/.test(bad.text), bad.text);

  if (several) {
    await tool('select_app', { app: 'notes-app' });
    // Its renderer depends on its config: a screenshot, or (GPU) the fix.
    const gpuShot = await tool('screenshot', {});
    const ok = gpuShot.isError
      ? /GLYX_CPU_RENDER=1 glyx dev --devtools/.test(gpuShot.text) && /rendererNotSupported/.test(gpuShot.text)
      : gpuShot.content?.some((c) => c.type === 'image');
    check('second app: a screenshot, or on a GPU renderer the exact fix', ok, gpuShot.text);
  } else {
    console.log('(skipped the GPU-renderer check: start examples/notes-app with `glyx dev --devtools` too)');
  }

  check('nothing but protocol messages on stdout', stdoutNoise === '', stdoutNoise);
} catch (e) {
  check('no protocol failure', false, e.message);
} finally {
  proc.kill();
}

const failed = results.filter((ok) => !ok).length;
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
