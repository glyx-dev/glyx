// Minimal headless-browser driver for the DevTools UI tests, over the
// Chrome DevTools Protocol (Edge or Chrome, whichever is installed). No npm
// dependencies: Bun's WebSocket + fetch.
//
//   const b = await launch();
//   const page = await b.open(url);
//   await page.waitForText('Connected');
//   await page.screenshot('out.png');
//   page.console  → [{ type, text }]
//   await b.close();
import { spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CANDIDATES = [
  process.env.GLYX_TEST_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/microsoft-edge',
].filter(Boolean);

export function findBrowser() {
  const found = CANDIDATES.find((p) => existsSync(p));
  if (!found) throw new Error('No Chrome / Edge / Chromium found; set GLYX_TEST_BROWSER');
  return found;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width = 1280, height = 800 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'glyx-devtools-ui-'));
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawn(findBrowser(), [
    '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, `--window-size=${width},${height}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let version;
  for (let i = 0; i < 100 && !version; i++) {
    try { version = await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); } catch { await sleep(100); }
  }
  if (!version) { proc.kill(); throw new Error('browser did not start'); }

  const cdp = new WebSocket(version.webSocketDebuggerUrl);
  await new Promise((r, e) => { cdp.onopen = r; cdp.onerror = e; });
  let nextId = 1;
  const pending = new Map();
  const handlers = new Map();
  cdp.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); return; }
    if (msg.method) handlers.get(msg.sessionId + msg.method)?.forEach((h) => h(msg.params));
  };
  const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
    const id = nextId++;
    pending.set(id, (msg) => (msg.error ? reject(new Error(`${method}: ${msg.error.message}`)) : resolve(msg.result)));
    cdp.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
  });
  const on = (sessionId, method, h) => {
    const k = sessionId + method;
    if (!handlers.has(k)) handlers.set(k, []);
    handlers.get(k).push(h);
  };

  return {
    async open(url) {
      const { targetId } = await send('Target.createTarget', { url: 'about:blank' });
      const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true });
      const s = (method, params) => send(method, params, sessionId);
      const console = [];
      on(sessionId, 'Runtime.consoleAPICalled', (p) => console.push({ type: p.type, text: p.args.map((a) => a.value ?? a.description).join(' ') }));
      on(sessionId, 'Runtime.exceptionThrown', (p) => console.push({ type: 'exception', text: p.exceptionDetails.exception?.description ?? p.exceptionDetails.text }));
      await s('Runtime.enable');
      await s('Page.enable');
      await s('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
      await s('Page.navigate', { url });

      const page = {
        console,
        /** Evaluate an expression in the page; returns its value. */
        async eval(expression) {
          const r = await s('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
          if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluation failed');
          return r.result.value;
        },
        /** Wait until the page's visible text contains `text`. */
        async waitForText(text, timeoutMs = 10000) {
          const until = Date.now() + timeoutMs;
          while (Date.now() < until) {
            const body = await page.eval('document.body ? document.body.innerText : ""').catch(() => '');
            if (body.includes(text)) return true;
            await sleep(100);
          }
          throw new Error(`text ${JSON.stringify(text)} did not appear within ${timeoutMs} ms`);
        },
        async click(selector) {
          await page.eval(`document.querySelector(${JSON.stringify(selector)}).click()`);
        },
        async screenshot(file) {
          const { data } = await s('Page.captureScreenshot', { format: 'png' });
          writeFileSync(file, Buffer.from(data, 'base64'));
        },
      };
      return page;
    },
    async close() {
      try { cdp.close(); } catch {}
      proc.kill();
      await sleep(300);
      try { rmSync(profile, { recursive: true, force: true }); } catch {}
    },
  };
}
