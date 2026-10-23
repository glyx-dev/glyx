// @glyx-dev/react — browser-compatible fetch() + Headers.
import { netStart, netResponse, netFailed } from '../devNet.js';
import { _readStreamOf, utf8Decode } from './streams.js';
import type { FileReadStream } from './streams.js';

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
 * Pass `stream: true` to get the body as a stream instead of one string (see `StreamResponse`): large and binary downloads.
 *
 * @param {{ method?: string, headers?: Record<string,string>, stream?: boolean,
 *           body?: string,
 *           multipart?: Array<{name:string, value?:string, filename?:string,
 *                              base64?:string, contentType?:string}> }} [options]
 * @returns {Promise<{ status: number, ok: boolean, statusText: string,
 *                     headers: Record<string,string>,
 *                     text: () => Promise<string>, json: () => Promise<any> }>}
 */
// Case-insensitive, spec-compatible Headers (the runtime has no platform one).
class GlyxHeaders {
  declare _m: Map<any, any>;
  constructor(init?: any) {
    this._m = new Map();
    if (!init) return;
    if (init instanceof GlyxHeaders) { init.forEach((v: any, k: any) => this.set(k, v)); }
    else if (Array.isArray(init))     { for (const [k, v] of init) this.append(k, v); }
    else if (typeof init.forEach === 'function') { init.forEach((v: any, k: any) => this.set(k, v)); }
    else { for (const k of Object.keys(init)) this.set(k, init[k]); }
  }
  set(k: string, v: string)     { this._m.set(String(k).toLowerCase(), String(v)); }
  append(k: any, v: any)  { const lk = String(k).toLowerCase(); this._m.set(lk, this._m.has(lk) ? `${this._m.get(lk)}, ${v}` : String(v)); }
  get(k: string)        { const v = this._m.get(String(k).toLowerCase()); return v == null ? null : v; }
  has(k: string)        { return this._m.has(String(k).toLowerCase()); }
  delete(k: any)     { this._m.delete(String(k).toLowerCase()); }
  forEach(cb: (v: any, k: any, headers: any) => void, t?: any){ this._m.forEach((v: any, k: any) => cb.call(t, v, k, this)); }
  keys()        { return this._m.keys(); }
  values()      { return this._m.values(); }
  entries()     { return this._m.entries(); }
  [Symbol.iterator]() { return this._m.entries(); }
  toObject()    { const o: any = {}; this._m.forEach((v: any, k: string | number) => { o[k] = v; }); return o; }
}
export { GlyxHeaders as Headers };

// Build a Response-like object from the native fetch result. `clone()` re-derives
// a fresh, independently-consumable body from the same captured data.
function _makeResponse(data: { headers: any; body: string; url: any; status: any; ok: any; statusText: any; }, url: any) {
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

/**
 * The response of `fetch(url, { stream: true })`: the status and headers are there as soon as the server answers, and the body arrives as a
 * stream of `Uint8Array` chunks, so a large download does not sit in memory and a binary one is not mangled. Read it once: with `for await`
 * over `body`, or with `text()`, `json()` or `arrayBuffer()` (which collect all of it). `fs.pipe(res.body, await fs.openWrite(path))` saves it
 * to disk without the bytes passing through your code. `cancel()` drops the connection.
 */
export interface StreamResponse {
  readonly status: number;
  readonly ok: boolean;
  readonly statusText: string;
  readonly headers: GlyxHeaders;
  /** The address after redirects. */
  readonly url: string;
  readonly body: FileReadStream;
  /** True once the body has been taken (read from, or collected by a method below). */
  readonly bodyUsed: boolean;
  text(): Promise<string>;
  json(): Promise<any>;
  arrayBuffer(): Promise<ArrayBuffer>;
  /** Stop and close the connection. Safe to call more than once, and after the end. */
  cancel(): Promise<void>;
}

async function collect(body: FileReadStream): Promise<Uint8Array> {
  const chunks: Uint8Array[] = [];
  let total = 0;
  // `read()` directly: iterating `body` would count as using it, and the caller has already said so.
  for (let chunk = await body.read(); chunk !== null; chunk = await body.read()) {
    chunks.push(chunk);
    total += chunk.length;
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

async function fetchStream(url: string, init: any, netId: number): Promise<StreamResponse> {
  if (init.multipart) throw new TypeError('fetch: stream: true supports method, headers and a string body, not multipart; use fetch without stream for an upload');
  const f = (globalThis as any).__glyx_backend_call2;
  if (typeof f !== 'function') throw new Error('fetch: stream: true needs a newer runner (__glyx_backend_call2 is missing)');
  let raw: any;
  try {
    raw = await f('glyx_stream.fetch', { url, method: init.method, headers: init.headers, body: typeof init.body === 'string' ? init.body : undefined });
  } catch (e) {
    netFailed(netId, e);
    throw e;
  }
  const meta = typeof raw === 'string' ? JSON.parse(raw) : raw;
  netResponse(netId, { ...meta, body: '[streamed body]' });
  const body = _readStreamOf(meta.id);
  const headers = new GlyxHeaders(meta.headers || {});
  let used = false;
  const take = () => {
    if (used) throw new TypeError('Body has already been consumed.');
    used = true;
  };
  // Reading the body directly counts as using it.
  const iterate = (body as any)[Symbol.asyncIterator].bind(body);
  (body as any)[Symbol.asyncIterator] = () => {
    take();
    return iterate();
  };
  return {
    status: meta.status, ok: meta.ok, statusText: meta.statusText, headers, url: meta.url || url, body,
    get bodyUsed() { return used; },
    text: async () => { take(); return utf8Decode(await collect(body)); },
    json: async () => { take(); return JSON.parse(utf8Decode(await collect(body))); },
    arrayBuffer: async () => { take(); const bytes = await collect(body); return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer; },
    cancel: () => body.cancel(),
  };
}

export function fetch(url: string, options: { stream: true; [key: string]: any }): Promise<StreamResponse>;
export function fetch(url: string, options?: any): Promise<ReturnType<typeof _makeResponse>>;
export async function fetch(url: string, options: any = {}): Promise<any> {
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
  if (init.stream) return fetchStream(url, init, netId);
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
// NOTE: without `stream: true` response bodies cross the bridge as UTF-8 text, so `arrayBuffer()`/`blob()`
// are correct for text/JSON but lossy for true binary downloads (images). Use `fetch(url, { stream: true })`
// for those: the body then arrives as bytes.
if (typeof (globalThis as any).fetch === 'undefined')   (globalThis as any).fetch = fetch;
if (typeof (globalThis as any).Headers === 'undefined') (globalThis as any).Headers = GlyxHeaders;
