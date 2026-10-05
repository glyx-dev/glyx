// @glyx-dev/react — browser-compatible fetch() + Headers.
import { netStart, netResponse, netFailed } from '../devNet.js';

// ── fetch ─────────────────────────────────────────────────────────────────────
//
// Browser-compatible fetch API backed by the Rust reqwest HTTP client.
// Requires `network.allow` capability in glyx.config.json:
//   { "capabilities": { "network": { "allow": ["api.example.com"] } } }
// Use ["*"] to allow all outbound requests.
//
// Response shape mirrors the browser Fetch API (subset):
//   res.status      → number
//   res.ok          → boolean (true when 200-299)
//   res.statusText  → string
//   res.headers     → plain object  { "content-type": "..." }
//   res.text()      → Promise<string>
//   res.json()      → Promise<any>

/**
 * Make an HTTP request.
 *
 * Supports plain string bodies and multipart/form-data uploads:
 * ```js
 * // JSON POST
 * fetch(url, { method: 'POST', headers: {'Content-Type':'application/json'},
 *              body: JSON.stringify(payload) });
 *
 * // Multipart upload (text field + binary file)
 * const bytes = await fs.readFileBytes(filePath);          // base64 string
 * fetch(url, { method: 'POST', multipart: [
 *   { name: 'description', value: 'my upload' },
 *   { name: 'file', filename: 'photo.jpg', base64: bytes, contentType: 'image/jpeg' },
 * ]});
 * ```
 *
 * @param {string} url
 * @param {{ method?: string, headers?: Record<string,string>,
 *           body?: string,
 *           multipart?: Array<{name:string, value?:string, filename?:string,
 *                              base64?:string, contentType?:string}> }} [options]
 * @returns {Promise<{ status: number, ok: boolean, statusText: string,
 *                     headers: Record<string,string>,
 *                     text: () => Promise<string>, json: () => Promise<any> }>}
 */
// Case-insensitive, spec-compatible Headers (the runtime has no platform one).
class GlyxHeaders {
  constructor(init) {
    this._m = new Map();
    if (!init) return;
    if (init instanceof GlyxHeaders) { init.forEach((v, k) => this.set(k, v)); }
    else if (Array.isArray(init))     { for (const [k, v] of init) this.append(k, v); }
    else if (typeof init.forEach === 'function') { init.forEach((v, k) => this.set(k, v)); }
    else { for (const k of Object.keys(init)) this.set(k, init[k]); }
  }
  set(k, v)     { this._m.set(String(k).toLowerCase(), String(v)); }
  append(k, v)  { const lk = String(k).toLowerCase(); this._m.set(lk, this._m.has(lk) ? `${this._m.get(lk)}, ${v}` : String(v)); }
  get(k)        { const v = this._m.get(String(k).toLowerCase()); return v == null ? null : v; }
  has(k)        { return this._m.has(String(k).toLowerCase()); }
  delete(k)     { this._m.delete(String(k).toLowerCase()); }
  forEach(cb, t){ this._m.forEach((v, k) => cb.call(t, v, k, this)); }
  keys()        { return this._m.keys(); }
  values()      { return this._m.values(); }
  entries()     { return this._m.entries(); }
  [Symbol.iterator]() { return this._m.entries(); }
  toObject()    { const o = {}; this._m.forEach((v, k) => { o[k] = v; }); return o; }
}
export { GlyxHeaders as Headers };

// Build a Response-like object from the native fetch result. `clone()` re-derives
// a fresh, independently-consumable body from the same captured data.
function _makeResponse(data, url) {
  const headers  = new GlyxHeaders(data.headers || {});
  const bodyText = data.body ?? '';
  let used = false;
  const consume = () => { if (used) throw new TypeError('Body has already been consumed.'); used = true; };
  const toBytes = () => {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(bodyText);
    const u8 = new Uint8Array(bodyText.length);
    for (let i = 0; i < bodyText.length; i++) u8[i] = bodyText.charCodeAt(i) & 0xff;
    return u8;
  };
  return {
    url: data.url || url, status: data.status, ok: data.ok, statusText: data.statusText,
    headers, redirected: false, type: 'basic',
    get bodyUsed() { return used; },
    text:        () => { consume(); return Promise.resolve(bodyText); },
    json:        () => { consume(); return Promise.resolve(JSON.parse(bodyText)); },
    arrayBuffer: () => { consume(); return Promise.resolve(toBytes().buffer); },
    blob:        () => {
      consume();
      const u8 = toBytes();
      return Promise.resolve({
        size: u8.length, type: headers.get('content-type') || '',
        arrayBuffer: () => Promise.resolve(u8.buffer),
        text:        () => Promise.resolve(bodyText),
      });
    },
    clone: () => _makeResponse(data, url),
  };
}

export async function fetch(url, options = {}) {
  if (typeof __glyx_fetch === 'undefined') {
    throw new Error('fetch: __glyx_fetch binding is not available');
  }
  // Normalize request init to what the native binding expects (string body +
  // plain header object), while accepting the spec shapes libraries use.
  const init = { ...options };
  const hdrs = new GlyxHeaders(init.headers);
  if (init.body != null && typeof init.body !== 'string' && !init.multipart) {
    const b = init.body;
    const isBinary = b instanceof ArrayBuffer || ArrayBuffer.isView(b);
    if (!isBinary && typeof b === 'object') {
      // Convenience: plain object body → JSON.
      init.body = JSON.stringify(b);
      if (!hdrs.has('content-type')) hdrs.set('Content-Type', 'application/json');
    } else if (!isBinary) {
      init.body = String(b);
    }
    // (Binary request bodies aren't supported over the text channel — use the
    //  `multipart` option with base64 parts for file uploads.)
  }
  init.headers = hdrs.toObject();

  const netId = netStart('fetch', url, {
    method: (init.method || 'GET').toUpperCase(), headers: init.headers,
    body: init.multipart ? `[multipart form: ${init.multipart.length} parts]` : init.body,
  });
  let data;
  try {
    data = JSON.parse(await __glyx_fetch(url, JSON.stringify(init)));
  } catch (e) {
    netFailed(netId, e);
    throw e;
  }
  netResponse(netId, data);
  return _makeResponse(data, url);
}
// Expose `fetch` + `Headers` as globals (the embedded V8 runtime has no platform
// equivalents, so this is purely additive — nothing standard is shadowed). Lets
// web-oriented libraries (Supabase, Stripe, …) work unmodified; both remain
// importable from @glyx-dev/react.
//
// NOTE: response bodies cross the bridge as UTF-8 text, so `arrayBuffer()`/`blob()`
// are correct for text/JSON but lossy for true binary downloads (images). Fetch
// binary via a dedicated download/fs API instead.
if (typeof globalThis.fetch === 'undefined')   globalThis.fetch = fetch;
if (typeof globalThis.Headers === 'undefined') globalThis.Headers = GlyxHeaders;
