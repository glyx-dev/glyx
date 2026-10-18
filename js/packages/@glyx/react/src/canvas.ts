import React, { useRef, useCallback } from 'react';
import { setCanvasExportHandler } from './events.js';

// ── Canvas 2D ─────────────────────────────────────────────────────────────────
//
// <Canvas ref={canvasRef} style={{ width: 300, height: 200 }} />
//
// Exposes a 2D drawing context via ref, close to the web's CanvasRenderingContext2D:
//   const ctx = canvasRef.current;
//   ctx.fillStyle = '#ff0000';      // a colour string ('#f00', 'rgba(…)', 'red'), [r,g,b,a] or a gradient
//   ctx.strokeStyle = '#ffffff';
//   ctx.lineWidth = 2;
//   ctx.fillRect(x, y, w, h);  ctx.strokeRect(x, y, w, h);
//   ctx.fillCircle(cx, cy, r); ctx.strokeCircle(cx, cy, r);   ctx.strokeLine(x0, y0, x1, y1);
//   ctx.fillText(text, x, y, fontSize);
//   ctx.beginPath(); ctx.moveTo(…); ctx.lineTo(…); ctx.arc(…); ctx.bezierCurveTo(…); ctx.arcTo(…);
//   ctx.rect(…); ctx.roundRect(…); ctx.ellipse(…); ctx.closePath(); ctx.fill('evenodd'); ctx.stroke();
//   // state: translate / rotate / scale / transform / setTransform, save / restore, globalAlpha,
//   //        globalCompositeOperation, lineCap / lineJoin / miterLimit / setLineDash / lineDashOffset,
//   //        shadowColor / shadowBlur / shadowOffsetX / shadowOffsetY
//   // paint: createLinearGradient / createRadialGradient / createConicGradient (fills and strokes)
//   // images: const img = ctx.loadImage(src); ctx.drawImage(img, …)
//   // clip: ctx.clip('nonzero' | 'evenodd') clips to the current path until restore()
//   // export and pixels: await ctx.toDataURL() / toPNG() / toBlob() / getImageData(x, y, w, h)
//   ctx.clear();
//   ctx.flush();     // send what was drawn
//
// Differences from the web's, on purpose: line ends and joins default to 'round' (what canvases here always
// drew); `fillText` takes a font size and its y is the top of the text unless `textBaseline` says otherwise; export
// is asynchronous (so is getImageData); `pushClip` is a rectangle (the bounding box under a rotation), `clip()` takes a path.

// CSS colour names a canvas is likely to use.
const _NAMED_COLORS: Record<string, number[]> = {
  transparent: [0, 0, 0, 0], black: [0, 0, 0, 255], white: [255, 255, 255, 255], red: [255, 0, 0, 255],
  green: [0, 128, 0, 255], lime: [0, 255, 0, 255], blue: [0, 0, 255, 255], yellow: [255, 255, 0, 255],
  cyan: [0, 255, 255, 255], aqua: [0, 255, 255, 255], magenta: [255, 0, 255, 255], fuchsia: [255, 0, 255, 255],
  gray: [128, 128, 128, 255], grey: [128, 128, 128, 255], silver: [192, 192, 192, 255], orange: [255, 165, 0, 255],
  purple: [128, 0, 128, 255], pink: [255, 192, 203, 255], brown: [165, 42, 42, 255], navy: [0, 0, 128, 255],
  teal: [0, 128, 128, 255], maroon: [128, 0, 0, 255], olive: [128, 128, 0, 255], gold: [255, 215, 0, 255],
};

/** `rgb(r, g, b)` / `rgba(r, g, b, a)` (also with spaces or `/`), r g b 0 to 255 (or percent), a 0 to 1 (or percent). */
function _parseRgbFunction(s: string): number[] | null {
  const m = /^rgba?\(\s*([^)]*)\)$/i.exec(s.trim());
  if (!m) return null;
  const parts = m[1].split(/[\s,\/]+/).filter(Boolean);
  if (parts.length < 3) return null;
  const ch = (v: string) => Math.max(0, Math.min(255, Math.round(v.endsWith('%') ? (parseFloat(v) * 255) / 100 : parseFloat(v))));
  const r = ch(parts[0]), g = ch(parts[1]), b = ch(parts[2]);
  let a = 1;
  if (parts.length > 3) a = parts[3].endsWith('%') ? parseFloat(parts[3]) / 100 : parseFloat(parts[3]);
  if ([r, g, b, a].some((n) => Number.isNaN(n))) return null;
  return [r, g, b, Math.round(Math.max(0, Math.min(1, a)) * 255)];
}

function _parseColor(c: string) {
  if (Array.isArray(c)) return c;
  if (typeof c === 'string' && !c.startsWith('#')) {
    const named = _NAMED_COLORS[c.trim().toLowerCase()];
    if (named) return named.slice();
    const rgb = _parseRgbFunction(c);
    if (rgb) return rgb;
  }
  if (typeof c === 'string' && c.startsWith('#')) {
    const h = c.slice(1);
    if (h.length === 3) {
      const [r, g, b] = h.split('').map(x => parseInt(x + x, 16));
      return [r, g, b, 255];
    }
    if (h.length === 6) {
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
        255,
      ];
    }
    if (h.length === 8) {
      return [
        parseInt(h.slice(0, 2), 16),
        parseInt(h.slice(2, 4), 16),
        parseInt(h.slice(4, 6), 16),
        parseInt(h.slice(6, 8), 16),
      ];
    }
  }
  return [255, 255, 255, 255];
}

// ── Canvas2D binary transport ───────────────────────────────────────────────
//
// When the runtime exposes a shared command buffer (default), draw calls write
// opcodes + args straight into typed arrays that Rust reads with no JSON
// stringify/parse. Falls back to the JSON `__glyx_canvas_update` path when the
// buffer isn't available (e.g. `canvas.protocol: "json"` or snapshot/test).
//
// NOTE: the command buffer is process-global and shared by all canvas contexts.
// Because JS is single-threaded and each flush() sends synchronously, a context
// must finish its draw+flush before another context draws. Interleaving draws of
// two contexts without flushing between is unsupported in binary mode (use the
// json protocol for that unusual pattern).
// Opcodes — must match `canvas_op` in glyx-runtime/src/bindings.rs.
const _OP_CLEAR = 0, _OP_FILLRECT = 1, _OP_STROKERECT = 2, _OP_FILLCIRCLE = 3,
      _OP_STROKECIRCLE = 4, _OP_STROKELINE = 5, _OP_FILLTEXT = 6,
      _OP_FILLPATH = 7, _OP_STROKEPATH = 8, _OP_FILLPATH_GRAD = 9,
      _OP_PUSHCLIP = 10, _OP_POPCLIP = 11, _OP_FILLTEXT_BOLD = 12,
      _OP_SAVE = 13, _OP_RESTORE = 14, _OP_TRANSFORM = 15, _OP_ALPHA = 16, _OP_BLEND = 17,
      _OP_LINESTYLE = 18, _OP_SHADOW = 19, _OP_DRAWIMAGE = 20,
      _OP_FILLPATH_BRUSH = 21, _OP_STROKEPATH_BRUSH = 22, _OP_FILLPATHS = 23, _OP_CLIPPATH = 24;

/**
 * A gradient usable as `ctx.fillStyle` / `ctx.strokeStyle`: linear (`createLinearGradient`), radial between two
 * circles (`createRadialGradient`) or conic / angular (`createConicGradient`). Add colour stops, then assign it.
 */
class GlyxCanvasGradient {
  declare kind: number;       // 1 linear, 2 radial, 3 conic
  declare p: number[];        // linear [x0,y0,x1,y1]; radial [x0,y0,r0,x1,y1,r1]; conic [cx,cy,startAngle]
  declare stops: any[];
  // The linear gradient's endpoints, under the names the first version of this class used.
  declare x0: any;
  declare y0: any;
  declare x1: any;
  declare y1: any;
  constructor(kind: number, p: number[]) {
    this.kind = kind; this.p = p;
    this.x0 = p[0]; this.y0 = p[1];
    this.x1 = kind === 1 ? p[2] : undefined; this.y1 = kind === 1 ? p[3] : undefined;
    this.stops = []; // [offset 0..1, color]
  }
  addColorStop(offset: number, color: any) {
    this.stops.push([Math.min(1, Math.max(0, offset)), color]);
    this.stops.sort((a: number[], b: number[]) => a[0] - b[0]);
  }
}

/** What `toBlob` resolves with: the bytes and their type (a stand-in for the web's `Blob`). */
export class GlyxBlob {
  declare type: string;
  declare size: number;
  declare _bytes: Uint8Array;
  constructor(bytes: Uint8Array, type: string) { this._bytes = bytes; this.size = bytes.length; this.type = type; }
  bytes(): Promise<Uint8Array> { return Promise.resolve(this._bytes); }
  arrayBuffer(): Promise<ArrayBuffer> {
    const b = this._bytes;
    return Promise.resolve(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) as ArrayBuffer);
  }
}

/** A decoded image to draw with `ctx.drawImage` (from `ctx.loadImage`). */
export class GlyxCanvasImage {
  declare id: number;
  constructor(id: number) { this.id = id; }
}

// `globalCompositeOperation` names, in the order of the native blend modes.
const _BLEND_NAMES = ['source-over', 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'difference', 'exclusion', 'destination-out'];
const _CAPS  = { butt: 0, round: 1, square: 2 } as any;
const _JOINS = { miter: 0, round: 1, bevel: 2 } as any;

const _IDENTITY = [1, 0, 0, 1, 0, 0];
// `a` then `b` in the canvas's order (b is applied first to a point): a × b as 2x3 matrices.
function _mul(a: number[], b: number[]) {
  return [
    a[0] * b[0] + a[2] * b[1],       a[1] * b[0] + a[3] * b[1],
    a[0] * b[2] + a[2] * b[3],       a[1] * b[2] + a[3] * b[3],
    a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5],
  ];
}
function _sameNums(a: number[], b: number[]) {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

// measureText results, keyed by "size|weight|text". Chart labels repeat
// every redraw, so this turns most measurements into a Map lookup.
const _measureCache = new Map();
const _MEASURE_CACHE_MAX = 2000;

// Pack a color into one little-endian u32 whose bytes are [r, g, b, a].
function _packColor(c: any) {
  const col = _parseColor(c);
  return ((col[0] & 255) | ((col[1] & 255) << 8) | ((col[2] & 255) << 16) | ((col[3] & 255) << 24)) >>> 0;
}

// Lazily resolve the binary command buffer. MUST be runtime-evaluated (not a
// module-level const): in snapshot/packaged builds the module body runs at
// snapshot-BUILD time, before the runtime installs the real backing-store
// globals. Probing on first canvas use (always at app runtime) sees them.
// Memoized: `false` = unavailable (use JSON); object = the shared buffers.
let _canvasBin: any; // undefined = not yet probed; false = JSON fallback; else the shared buffers
function _canvasBinaryEnv(): any {
  if (_canvasBin !== undefined) return _canvasBin;
  const ok =
    typeof __glyx_canvas_protocol !== 'undefined' && __glyx_canvas_protocol === 'binary' &&
    typeof __glyx_canvas_cmdbuf_f32 !== 'undefined' &&
    typeof __glyx_canvas_cmdbuf_u32 !== 'undefined' &&
    typeof __glyx_canvas_strbuf     !== 'undefined' &&
    typeof __glyx_canvas_flush      !== 'undefined';
  _canvasBin = ok ? {
    f32:    __glyx_canvas_cmdbuf_f32,
    u32:    __glyx_canvas_cmdbuf_u32,
    str:    __glyx_canvas_strbuf,
    cap:    __glyx_canvas_cmdbuf_f32.length,
    strCap: __glyx_canvas_strbuf.length,
    enc:    (typeof TextEncoder !== 'undefined') ? new TextEncoder() : null,
  } : false;
  return _canvasBin;
}

export class GlyxCanvasContext {
  declare fontWeight: string;
  declare textBaseline: string;
  declare textAlign: string;
  declare lineWidth: number;
  declare strokeStyle: any;   // a colour string, an [r,g,b,a] array, or a gradient
  declare fillStyle: any;
  /** Opacity of everything drawn next, 0 to 1. */
  declare globalAlpha: number;
  /** How what is drawn next combines with what is there: 'source-over' (default), 'multiply', 'screen', 'overlay', 'darken', 'lighten', 'difference', 'exclusion' or 'destination-out' (erase). */
  declare globalCompositeOperation: string;
  /** Line ends: 'round' (default here), 'butt' or 'square'. */
  declare lineCap: string;
  /** Corners of a stroked path: 'round' (default here), 'miter' or 'bevel'. */
  declare lineJoin: string;
  declare miterLimit: number;
  declare lineDashOffset: number;
  declare shadowColor: any;
  declare shadowBlur: number;
  declare shadowOffsetX: number;
  declare shadowOffsetY: number;
  declare _dash: number[];
  declare _m: number[];        // current transform [a, b, c, d, e, f]
  declare _stack: any[];       // save() entries
  declare _e: any;             // the drawing state the native side has been told about this frame
  declare _pathClosed: boolean;
  declare _path: any[];        // the current sub-path: flat [x0,y0,x1,y1,…]
  declare _base: any[];        // the first sub-path's array, reused between paths
  declare _subs: any[][];      // every sub-path of the current path
  declare _closed: boolean[];  // whether each sub-path was closed
  declare _firstChunk: boolean;
  declare _sc: number;
  declare _fc: number;
  declare _cmds: any[];
  declare _bin: any;          // the shared command buffers, or false for the JSON fallback
  declare _id: any;
  constructor(nativeId: any) {
    this._id    = nativeId;
    this._bin   = _canvasBinaryEnv(); // shared buffers, or false for JSON
    this._cmds  = [];        // JSON fallback buffer
    this._fc    = 0;         // binary: f32 command cursor
    this._sc    = 0;         // binary: string byte cursor
    this._firstChunk = true; // binary: first flush of a frame replaces, rest append
    this._base  = [];
    this._path  = this._base;
    this._subs  = [this._base];
    this._closed = [false];
    this._pathClosed = false;
    this.fillStyle   = [255, 255, 255, 255];
    this.strokeStyle = [255, 255, 255, 255];
    this.lineWidth   = 1;
    this.globalAlpha = 1;
    this.globalCompositeOperation = 'source-over';
    // Round ends and joins are what canvases here have always drawn; the web's default is butt / miter.
    this.lineCap = 'round';
    this.lineJoin = 'round';
    this.miterLimit = 10;
    this.lineDashOffset = 0;
    this._dash = [];
    this.shadowColor = 'transparent';
    this.shadowBlur = 0;
    this.shadowOffsetX = 0;
    this.shadowOffsetY = 0;
    this._m = _IDENTITY.slice();
    this._stack = [];
    this._e = this._defaultEmitted();
    // Text placement relative to fillText's (x, y), as in the web canvas:
    // textAlign 'left' | 'center' | 'right', textBaseline 'top' | 'middle' |
    // 'bottom'. fontWeight 'normal' | 'bold'.
    this.textAlign    = 'left';
    this.textBaseline = 'top';
    this.fontWeight   = 'normal';
  }

  /** A linear gradient from (x0,y0) to (x1,y1); add stops, then assign to `fillStyle` or `strokeStyle`. */
  createLinearGradient(x0: any, y0: any, x1: any, y1: any) { return new GlyxCanvasGradient(1, [x0, y0, x1, y1]); }
  /** A radial gradient between two circles (the first is usually a point: r0 = 0). */
  createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number) {
    return new GlyxCanvasGradient(2, [x0, y0, r0, x1, y1, r1]);
  }
  /** A conic (angular) gradient around (x, y), starting `startAngle` radians from the positive x axis. */
  createConicGradient(startAngle: number, x: number, y: number) { return new GlyxCanvasGradient(3, [x, y, startAngle]); }

  /**
   * Size of `text` at `fontSize` (current `fontWeight`), as `{ width, height }`
   * in pixels — measured by the same text engine that draws it.
   */
  measureText(text: any, fontSize = 16) {
    const s = String(text);
    const bold = this.fontWeight === 'bold';
    const key = fontSize + (bold ? '|b|' : '|n|') + s;
    let m = _measureCache.get(key);
    if (m) return m;
    if (typeof __glyx_measure_text !== 'undefined') {
      const r = __glyx_measure_text(s, fontSize, 0, bold ? 'bold' : '');
      m = { width: r.width, height: r.height };
    } else {
      m = { width: s.length * fontSize * 0.55, height: fontSize * 1.25 }; // tests / no runtime
    }
    if (_measureCache.size >= _MEASURE_CACHE_MAX) _measureCache.clear();
    _measureCache.set(key, m);
    return m;
  }

  // ── Drawing state: transform, alpha, blend, line style, shadow ──────────────────────────────────────
  //
  // The properties above are plain fields, as on the web. They reach the native side as state commands, written
  // lazily just before the next draw and only when they differ from what it was last told this frame.

  translate(x: number, y: number) { this._m = _mul(this._m, [1, 0, 0, 1, x, y]); }
  scale(x: number, y: number = x) { this._m = _mul(this._m, [x, 0, 0, y, 0, 0]); }
  rotate(angle: number) {
    const c = Math.cos(angle), s = Math.sin(angle);
    this._m = _mul(this._m, [c, s, -s, c, 0, 0]);
  }
  /** Multiply the current transform by this matrix. */
  transform(a: number, b: number, c: number, d: number, e: number, f: number) { this._m = _mul(this._m, [a, b, c, d, e, f]); }
  /** Replace the current transform. */
  setTransform(a: number, b: number, c: number, d: number, e: number, f: number) { this._m = [a, b, c, d, e, f]; }
  resetTransform() { this._m = _IDENTITY.slice(); }
  getTransform() { const m = this._m; return { a: m[0], b: m[1], c: m[2], d: m[3], e: m[4], f: m[5] }; }

  /** Dash pattern for strokes: alternating on / off lengths (an odd count repeats). `[]` is solid. */
  setLineDash(segments: number[]) { this._dash = segments.map((n) => +n).slice(0, 16); }
  getLineDash() { return this._dash.slice(); }

  /** Remember the drawing state (styles, transform, alpha, ...) until the matching `restore()`. */
  save() {
    this._stack.push({
      fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, lineWidth: this.lineWidth,
      lineCap: this.lineCap, lineJoin: this.lineJoin, miterLimit: this.miterLimit,
      lineDashOffset: this.lineDashOffset, dash: this._dash.slice(),
      globalAlpha: this.globalAlpha, op: this.globalCompositeOperation,
      shadowColor: this.shadowColor, shadowBlur: this.shadowBlur,
      shadowOffsetX: this.shadowOffsetX, shadowOffsetY: this.shadowOffsetY,
      textAlign: this.textAlign, textBaseline: this.textBaseline, fontWeight: this.fontWeight,
      m: this._m.slice(), e: this._copyEmitted(),
    });
    this._op1(_OP_SAVE, { type: 'save' });
  }
  restore() {
    const s = this._stack.pop();
    if (!s) return;
    this.fillStyle = s.fillStyle; this.strokeStyle = s.strokeStyle; this.lineWidth = s.lineWidth;
    this.lineCap = s.lineCap; this.lineJoin = s.lineJoin; this.miterLimit = s.miterLimit;
    this.lineDashOffset = s.lineDashOffset; this._dash = s.dash;
    this.globalAlpha = s.globalAlpha; this.globalCompositeOperation = s.op;
    this.shadowColor = s.shadowColor; this.shadowBlur = s.shadowBlur;
    this.shadowOffsetX = s.shadowOffsetX; this.shadowOffsetY = s.shadowOffsetY;
    this.textAlign = s.textAlign; this.textBaseline = s.textBaseline; this.fontWeight = s.fontWeight;
    this._m = s.m;
    this._e = s.e;
    this._op1(_OP_RESTORE, { type: 'restore' });
  }

  _defaultEmitted() {
    return { m: _IDENTITY.slice(), alpha: 1, blend: 0, line: [1, 1, 10, 0], shadow: [0, 0, 0, 0] };
  }
  _copyEmitted() {
    const e = this._e;
    return { m: e.m.slice(), alpha: e.alpha, blend: e.blend, line: e.line.slice(), shadow: e.shadow.slice() };
  }

  /** A command with no arguments. */
  _op1(op: number, json: any) {
    if (!this._bin) { this._cmds.push(json); return; }
    this._ensure(1);
    this._bin.f32[this._fc++] = op;
  }

  /** Tell the native side about any drawing state that changed since its last draw this frame. */
  _syncState() {
    const e = this._e;
    const b = this._bin;
    if (!_sameNums(this._m, e.m)) {
      const m = this._m;
      if (!b) this._cmds.push({ type: 'transform', m: m.slice() });
      else { this._ensure(7); const f = b.f32, p = this._fc; f[p] = _OP_TRANSFORM; for (let i = 0; i < 6; i++) f[p + 1 + i] = m[i]; this._fc = p + 7; }
      e.m = m.slice();
    }
    const alpha = Math.min(1, Math.max(0, +this.globalAlpha)) || 0;
    if (alpha !== e.alpha) {
      if (!b) this._cmds.push({ type: 'globalAlpha', alpha });
      else { this._ensure(2); b.f32[this._fc] = _OP_ALPHA; b.f32[this._fc + 1] = alpha; this._fc += 2; }
      e.alpha = alpha;
    }
    let blend = _BLEND_NAMES.indexOf(this.globalCompositeOperation);
    if (blend < 0) blend = 0;
    if (blend !== e.blend) {
      if (!b) this._cmds.push({ type: 'blend', mode: blend });
      else { this._ensure(2); b.f32[this._fc] = _OP_BLEND; b.f32[this._fc + 1] = blend; this._fc += 2; }
      e.blend = blend;
    }
    const cap = _CAPS[this.lineCap] ?? 1, join = _JOINS[this.lineJoin] ?? 1;
    const dashes = this._dash.length && this._dash.every((n) => n >= 0 && isFinite(n)) && this._dash.some((n) => n > 0) ? this._dash : [];
    const line = [cap, join, Math.max(1, +this.miterLimit || 10), +this.lineDashOffset || 0, ...dashes];
    if (!_sameNums(line, e.line)) {
      if (!b) this._cmds.push({ type: 'lineStyle', cap, join, miterLimit: line[2], dashOffset: line[3], dashes: dashes.slice() });
      else {
        this._ensure(6 + dashes.length);
        const f = b.f32, p = this._fc;
        f[p] = _OP_LINESTYLE; f[p + 1] = cap; f[p + 2] = join; f[p + 3] = line[2]; f[p + 4] = line[3]; f[p + 5] = dashes.length;
        for (let i = 0; i < dashes.length; i++) f[p + 6 + i] = dashes[i];
        this._fc = p + 6 + dashes.length;
      }
      e.line = line;
    }
    // A shadow needs a visible colour and some blur or offset.
    const sc = _parseColor(this.shadowColor === 'transparent' ? [0, 0, 0, 0] : this.shadowColor);
    const on = sc[3] > 0 && (this.shadowBlur > 0 || this.shadowOffsetX !== 0 || this.shadowOffsetY !== 0);
    const shadow = on ? [_packColor(sc), Math.max(0, +this.shadowBlur || 0), +this.shadowOffsetX || 0, +this.shadowOffsetY || 0] : [0, 0, 0, 0];
    if (!_sameNums(shadow, e.shadow)) {
      if (!b) this._cmds.push({ type: 'shadow', color: on ? sc.slice() : [0, 0, 0, 0], blur: shadow[1], dx: shadow[2], dy: shadow[3] });
      else { this._ensure(5); const f = b.f32, p = this._fc; f[p] = _OP_SHADOW; b.u32[p + 1] = shadow[0]; f[p + 2] = shadow[1]; f[p + 3] = shadow[2]; f[p + 4] = shadow[3]; this._fc = p + 5; }
      e.shadow = shadow;
    }
  }

  /** Clip everything drawn until the matching `popClip()` to this rect. */
  pushClip(x: any, y: any, w: any, h: any) {
    this._syncState();
    if (!this._bin) { this._cmds.push({ type: 'pushClip', x, y, w, h }); return; }
    this._ensure(5);
    const f = this._bin.f32, p = this._fc;
    f[p] = _OP_PUSHCLIP; f[p+1] = x; f[p+2] = y; f[p+3] = w; f[p+4] = h;
    this._fc = p + 5;
  }
  popClip() {
    if (!this._bin) { this._cmds.push({ type: 'popClip' }); return; }
    this._ensure(1);
    this._bin.f32[this._fc] = _OP_POPCLIP;
    this._fc += 1;
  }

  // Ensure `slots` f32 command slots are free; flush a continuation chunk if not.
  _ensure(slots: number) {
    if (this._fc + slots > this._bin.cap) this._flushChunk();
  }

  // Send the current buffer contents to Rust and reset cursors. The first chunk
  // of a frame replaces the canvas command list; overflow continuations append.
  _flushChunk() {
    const b = this._bin;
    try {
      __glyx_canvas_flush(this._id, b.f32, this._fc, b.str, this._sc, !this._firstChunk);
    } catch (e) {
      __glyx_log('[canvas] flush error: ' + e);
    }
    this._firstChunk = false;
    this._fc = 0;
    this._sc = 0;
  }

  /** A new frame begins: the native side starts from the default drawing state. */
  _newFrame() {
    this._e = this._defaultEmitted();
    this._stack.length = 0;
  }

  clear() {
    this._newFrame();
    if (!this._bin) { this._cmds.length = 0; this._cmds.push({ type: 'clear' }); return; }
    // Start a fresh frame: discard pending draws and emit a clear.
    this._fc = 0; this._sc = 0; this._firstChunk = true;
    this._bin.f32[0] = _OP_CLEAR; this._fc = 1;
  }

  // ── Brushes ──────────────────────────────────────────────────────────────────────────────────────────

  /** A fill or stroke style as a brush: `{ kind, color (packed), p, stops }`. */
  _brush(style: any) {
    if (style instanceof GlyxCanvasGradient) {
      const stops = style.stops.length ? style.stops : [[0, [0, 0, 0, 0]], [1, [0, 0, 0, 0]]];
      return { kind: style.kind, color: 0, p: style.p, stops };
    }
    return { kind: 0, color: _packColor(style), p: [], stops: [] };
  }
  _brushSlots(br: any) { return 9 + br.stops.length * 2; }
  _putBrush(br: any, p: number) {
    const f = this._bin.f32, u = this._bin.u32;
    f[p] = br.kind; u[p + 1] = br.color;
    for (let i = 0; i < 6; i++) f[p + 2 + i] = br.p[i] || 0;
    f[p + 8] = br.stops.length;
    let q = p + 9;
    for (const [o, c] of br.stops) { f[q++] = o; u[q++] = _packColor(c); }
    return q;
  }
  _brushJson(br: any) {
    const p = br.p.slice(); while (p.length < 6) p.push(0);
    return {
      kind: br.kind, color: br.kind === 0 ? _unpackColor(br.color) : [0, 0, 0, 0], p,
      stops: br.stops.map(([o, c]: any) => [o, _parseColor(c)]),
    };
  }

  // ── Shapes ───────────────────────────────────────────────────────────────────────────────────────────

  fillRect(x: any, y: any, w: any, h: any) {
    this._syncState();
    if (this.fillStyle instanceof GlyxCanvasGradient) { this._fillPolys([[x, y, x + w, y, x + w, y + h, x, y + h]], false); return; }
    if (!this._bin) { this._cmds.push({ type: 'fillRect', x, y, w, h, color: _parseColor(this.fillStyle) }); return; }
    this._ensure(6);
    const f = this._bin.f32, p = this._fc;
    f[p] = _OP_FILLRECT; f[p+1] = x; f[p+2] = y; f[p+3] = w; f[p+4] = h;
    this._bin.u32[p+5] = _packColor(this.fillStyle);
    this._fc = p + 6;
  }
  strokeRect(x: any, y: any, w: any, h: any) {
    this._syncState();
    if (this.strokeStyle instanceof GlyxCanvasGradient) { this._strokeSub([x, y, x + w, y, x + w, y + h, x, y + h], true); return; }
    if (!this._bin) { this._cmds.push({ type: 'strokeRect', x, y, w, h, color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth }); return; }
    this._ensure(7);
    const f = this._bin.f32, p = this._fc;
    f[p] = _OP_STROKERECT; f[p+1] = x; f[p+2] = y; f[p+3] = w; f[p+4] = h;
    this._bin.u32[p+5] = _packColor(this.strokeStyle); f[p+6] = this.lineWidth;
    this._fc = p + 7;
  }
  fillCircle(cx: any, cy: any, r: any) {
    this._syncState();
    if (this.fillStyle instanceof GlyxCanvasGradient) { this._fillPolys([_circlePoints(cx, cy, r)], false); return; }
    if (!this._bin) { this._cmds.push({ type: 'fillCircle', cx, cy, r, color: _parseColor(this.fillStyle) }); return; }
    this._ensure(5);
    const f = this._bin.f32, p = this._fc;
    f[p] = _OP_FILLCIRCLE; f[p+1] = cx; f[p+2] = cy; f[p+3] = r;
    this._bin.u32[p+4] = _packColor(this.fillStyle);
    this._fc = p + 5;
  }
  strokeCircle(cx: any, cy: any, r: any) {
    this._syncState();
    if (this.strokeStyle instanceof GlyxCanvasGradient) { this._strokeSub(_circlePoints(cx, cy, r), true); return; }
    if (!this._bin) { this._cmds.push({ type: 'strokeCircle', cx, cy, r, color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth }); return; }
    this._ensure(6);
    const f = this._bin.f32, p = this._fc;
    f[p] = _OP_STROKECIRCLE; f[p+1] = cx; f[p+2] = cy; f[p+3] = r;
    this._bin.u32[p+4] = _packColor(this.strokeStyle); f[p+5] = this.lineWidth;
    this._fc = p + 6;
  }
  strokeLine(x0: any, y0: any, x1: any, y1: any) {
    this._syncState();
    if (this.strokeStyle instanceof GlyxCanvasGradient) { this._strokeSub([x0, y0, x1, y1], false); return; }
    if (!this._bin) { this._cmds.push({ type: 'strokeLine', x0, y0, x1, y1, color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth }); return; }
    this._ensure(7);
    const f = this._bin.f32, p = this._fc;
    f[p] = _OP_STROKELINE; f[p+1] = x0; f[p+2] = y0; f[p+3] = x1; f[p+4] = y1;
    this._bin.u32[p+5] = _packColor(this.strokeStyle); f[p+6] = this.lineWidth;
    this._fc = p + 7;
  }
  fillText(text: any, x: number, y: number, fontSize = 16) {
    // Resolve textAlign/textBaseline to the top-left the native side draws at.
    if (this.textAlign !== 'left' || this.textBaseline !== 'top') {
      const m = this.measureText(text, fontSize);
      if (this.textAlign === 'center') x -= m.width / 2;
      else if (this.textAlign === 'right' || this.textAlign === 'end') x -= m.width;
      if (this.textBaseline === 'middle') y -= m.height / 2;
      else if (this.textBaseline === 'bottom') y -= m.height;
    }
    this._syncState();
    const bold = this.fontWeight === 'bold';
    if (!this._bin) { this._cmds.push({ type: 'fillText', text: String(text), x, y, fontSize, color: _parseColor(this.fillStyle), bold }); return; }
    const b = this._bin, s = String(text);
    // The command and its UTF-8 bytes must live in the same chunk (offset is
    // chunk-relative), so flush up-front if either region lacks room.
    if (this._fc + 7 > b.cap || this._sc + s.length * 4 > b.strCap) this._flushChunk();
    const off = this._sc;
    let len = 0;
    if (b.enc) { len = (b.enc.encodeInto(s, b.str.subarray(this._sc)).written) | 0; }
    this._sc += len;
    const f = b.f32, p = this._fc;
    f[p] = bold ? _OP_FILLTEXT_BOLD : _OP_FILLTEXT; f[p+1] = x; f[p+2] = y; f[p+3] = fontSize;
    b.u32[p+4] = _packColor(this.fillStyle); f[p+5] = off; f[p+6] = len;
    this._fc = p + 7;
  }

  // ── Images ───────────────────────────────────────────────────────────────────────────────────────────

  /** Start loading an image (a file path or URL the app can read); the result can be drawn with `drawImage`. */
  loadImage(src: string, width = 0, height = 0): GlyxCanvasImage | null {
    if (typeof __glyx_createImage === 'undefined') return null;
    return new GlyxCanvasImage(__glyx_createImage(src, width, height));
  }

  /**
   * Draw an image: `drawImage(img, dx, dy)` at its own size, `drawImage(img, dx, dy, dw, dh)` scaled, or
   * `drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh)` to draw part of it (source rect in image pixels). `img` is
   * a `loadImage` result, or an image id.
   */
  drawImage(img: any, a: number, b: number, c?: number, d?: number, e?: number, f?: number, g?: number, h?: number) {
    const id = typeof img === 'number' ? img : img && typeof img.id === 'number' ? img.id : -1;
    if (id < 0) return;
    let src = [0, 0, 0, 0], dst;
    if (e !== undefined && g !== undefined) { src = [a, b, c as number, d as number]; dst = [e, f as number, g, h as number]; }
    else if (c !== undefined && d !== undefined) dst = [a, b, c, d];
    else dst = [a, b, -1, -1];             // its own size
    this._syncState();
    if (!this._bin) { this._cmds.push({ type: 'drawImage', image: id, src, dst }); return; }
    this._ensure(10);
    const fl = this._bin.f32, p = this._fc;
    fl[p] = _OP_DRAWIMAGE; fl[p + 1] = id;
    for (let i = 0; i < 4; i++) { fl[p + 2 + i] = src[i]; fl[p + 6 + i] = dst[i]; }
    this._fc = p + 10;
  }

  // ── Path API (canvas-like) ────────────────────────────────────────────────
  // Curves are tessellated to line segments in JS; the native side only deals
  // with polylines/polygons. A path may have several sub-paths (`moveTo` after
  // some points starts one, `rect` adds one); `fill` fills them together (so a
  // shape can have holes) and `stroke` strokes each.

  beginPath() {
    this._base.length = 0;
    this._path = this._base;
    this._subs.length = 0; this._subs.push(this._base);
    this._closed.length = 0; this._closed.push(false);
    this._pathClosed = false;
  }
  /** Start a new sub-path (the current one is kept if it has any points). */
  _newSub() {
    if (!this._path.length) return;
    this._path = [];
    this._subs.push(this._path);
    this._closed.push(false);
  }
  moveTo(x: any, y: any) { this._newSub(); this._path.push(x, y); }
  lineTo(x: any, y: any) { this._path.push(x, y); }
  closePath() { this._closed[this._closed.length - 1] = true; this._pathClosed = true; }

  /** A closed rectangular sub-path. */
  rect(x: number, y: number, w: number, h: number) {
    this._newSub();
    this._path.push(x, y, x + w, y, x + w, y + h, x, y + h);
    this._closed[this._closed.length - 1] = true;
    this._pathClosed = true;
  }

  /** A closed rounded rectangle; `radius` is one number, or the first of an array (all corners the same). */
  roundRect(x: number, y: number, w: number, h: number, radius: any = 0) {
    let r = Array.isArray(radius) ? +radius[0] || 0 : +radius || 0;
    r = Math.max(0, Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2));
    if (r === 0) { this.rect(x, y, w, h); return; }
    this._newSub();
    const steps = Math.max(4, Math.ceil(r * 0.8));
    const corner = (cx: number, cy: number, a0: number) => {
      for (let i = 0; i <= steps; i++) { const t = a0 + (Math.PI / 2) * (i / steps); this._path.push(cx + Math.cos(t) * r, cy + Math.sin(t) * r); }
    };
    corner(x + w - r, y + r, -Math.PI / 2);
    corner(x + w - r, y + h - r, 0);
    corner(x + r, y + h - r, Math.PI / 2);
    corner(x + r, y + r, Math.PI);
    this._closed[this._closed.length - 1] = true;
    this._pathClosed = true;
  }

  /**
   * Arc from `a0`→`a1` radians (set `ccw` for counter-clockwise). It is split
   * into line segments: by default as many as its sweep needs (more for a
   * wider arc). Pass `segments` to fix the count instead, so a shape whose
   * angle changes keeps the same number of points — which is what lets a
   * canvas with a `transition` ease between two draws of it.
   */
  arc(cx: number, cy: number, r: number, a0: any, a1: any, ccw = false, segments: number) {
    let start = a0, end = a1;
    if (ccw && end > start) end -= Math.PI * 2;
    if (!ccw && end < start) end += Math.PI * 2;
    const sweep = Math.abs(end - start);
    const segs  = segments > 0 ? Math.ceil(segments) : Math.max(6, Math.ceil(sweep / (Math.PI / 16)));
    for (let i = 0; i <= segs; i++) {
      const t = start + (end - start) * (i / segs);
      this._path.push(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
    }
  }

  /** An elliptical arc around (cx, cy), the ellipse turned by `rotation` radians. */
  ellipse(cx: number, cy: number, rx: number, ry: number, rotation: number, a0: number, a1: number, ccw = false) {
    let start = a0, end = a1;
    if (ccw && end > start) end -= Math.PI * 2;
    if (!ccw && end < start) end += Math.PI * 2;
    const segs = Math.max(8, Math.ceil(Math.abs(end - start) / (Math.PI / 24)));
    const cr = Math.cos(rotation), sr = Math.sin(rotation);
    for (let i = 0; i <= segs; i++) {
      const t = start + (end - start) * (i / segs);
      const ex = Math.cos(t) * rx, ey = Math.sin(t) * ry;
      this._path.push(cx + ex * cr - ey * sr, cy + ex * sr + ey * cr);
    }
  }

  /** An arc of radius `r` tangent to the lines from the current point to (x1, y1) and from there to (x2, y2). */
  arcTo(x1: number, y1: number, x2: number, y2: number, r: number) {
    const n = this._path.length;
    if (n < 2) { this._path.push(x1, y1); return; }
    const x0 = this._path[n - 2], y0 = this._path[n - 1];
    const ax = x0 - x1, ay = y0 - y1, bx = x2 - x1, by = y2 - y1;
    const la = Math.hypot(ax, ay), lb = Math.hypot(bx, by);
    const cross = ax * by - ay * bx;
    if (!(r > 0) || la === 0 || lb === 0 || Math.abs(cross) < 1e-9) { this._path.push(x1, y1); return; }
    const cos = (ax * bx + ay * by) / (la * lb);
    const half = Math.acos(Math.max(-1, Math.min(1, cos))) / 2;
    const dist = r / Math.tan(half);
    const t1x = x1 + (ax / la) * dist, t1y = y1 + (ay / la) * dist;
    const t2x = x1 + (bx / lb) * dist, t2y = y1 + (by / lb) * dist;
    // The centre lies on the angle bisector, r / sin(half) from the corner.
    const ux = ax / la + bx / lb, uy = ay / la + by / lb;
    const ul = Math.hypot(ux, uy);
    const cdist = r / Math.sin(half);
    const cx = x1 + (ux / ul) * cdist, cy = y1 + (uy / ul) * cdist;
    const a0 = Math.atan2(t1y - cy, t1x - cx);
    let a1 = Math.atan2(t2y - cy, t2x - cx);
    let sweep = a1 - a0;
    while (sweep > Math.PI) sweep -= Math.PI * 2;
    while (sweep < -Math.PI) sweep += Math.PI * 2;
    this._path.push(t1x, t1y);
    const segs = Math.max(4, Math.ceil(Math.abs(sweep) / (Math.PI / 16)));
    for (let i = 1; i <= segs; i++) {
      const t = a0 + sweep * (i / segs);
      this._path.push(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
    }
  }

  quadraticCurveTo(cpx: number, cpy: number, x: number, y: number) {
    const n = this._path.length;
    const x0 = n >= 2 ? this._path[n - 2] : cpx;
    const y0 = n >= 2 ? this._path[n - 1] : cpy;
    const segs = 16;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs, mt = 1 - t;
      this._path.push(mt * mt * x0 + 2 * mt * t * cpx + t * t * x,
                      mt * mt * y0 + 2 * mt * t * cpy + t * t * y);
    }
  }

  /**
   * Cubic curve to (x, y). It is split into line segments: 20 by default. Pass
   * `segments` to choose the count: a curve that spans only a few pixels needs
   * far fewer, and every vertex costs when the path is stroked. Keep the count
   * independent of the data (derive it from the geometry) when the canvas has a
   * `transition`, so consecutive draws keep the same number of points.
   */
  bezierCurveTo(c1x: number, c1y: number, c2x: number, c2y: number, x: number, y: number, segments: number) {
    const n = this._path.length;
    const x0 = n >= 2 ? this._path[n - 2] : c1x;
    const y0 = n >= 2 ? this._path[n - 1] : c1y;
    const segs = segments > 0 ? Math.ceil(segments) : 20;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs, mt = 1 - t;
      const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
      this._path.push(a * x0 + b * c1x + c * c2x + d * x,
                      a * y0 + b * c1y + c * c2y + d * y);
    }
  }

  /** Fill the current path (its sub-paths together, so shapes can have holes). `'evenodd'` fills by the even-odd rule. */
  fill(rule: string = 'nonzero') {
    this._syncState();
    this._fillPolys(this._subs, rule === 'evenodd');
  }

  /** Fill polygons (flat point lists) with the current fill style. */
  _fillPolys(polys: number[][], evenOdd: boolean) {
    const polygons = polys.filter((p) => p.length >= 6);
    if (!polygons.length) return;
    const style = this.fillStyle;
    const one = polygons.length === 1 && !evenOdd;
    if (one && !(style instanceof GlyxCanvasGradient)) { this._fillSolid(polygons[0], style); return; }
    if (one && style.kind === 1) { this._fillGradient(style, polygons[0]); return; }
    const br = this._brush(style);
    if (this._bin) {
      const b = this._bin;
      if (one) {
        const pts = polygons[0];
        const slots = 2 + this._brushSlots(br) + pts.length;
        if (slots > b.cap) return;
        this._ensure(slots);
        const p = this._fc;
        b.f32[p] = _OP_FILLPATH_BRUSH; b.f32[p + 1] = pts.length >> 1;
        let q = this._putBrush(br, p + 2);
        for (let k = 0; k < pts.length; k++) b.f32[q++] = pts[k];
        this._fc = q;
      } else {
        let slots = 3 + this._brushSlots(br);
        for (const pg of polygons) slots += 1 + pg.length;
        if (slots > b.cap) return;
        this._ensure(slots);
        const p = this._fc;
        b.f32[p] = _OP_FILLPATHS; b.f32[p + 1] = evenOdd ? 1 : 0; b.f32[p + 2] = polygons.length;
        let q = this._putBrush(br, p + 3);
        for (const pg of polygons) { b.f32[q++] = pg.length >> 1; for (let k = 0; k < pg.length; k++) b.f32[q++] = pg[k]; }
        this._fc = q;
      }
    } else if (one) {
      this._cmds.push({ type: 'fillPathBrush', points: polygons[0].slice(), brush: this._brushJson(br) });
    } else {
      this._cmds.push({ type: 'fillPaths', contours: polygons.map((pg) => pg.slice()), brush: this._brushJson(br), evenOdd });
    }
  }

  /**
   * Clip everything drawn next to the current path (its sub-paths together; `'evenodd'` leaves holes), until the
   * matching `restore()` (or `popClip()`). Call `save()` first to be able to undo it.
   */
  clip(rule: string = 'nonzero') {
    this._syncState();
    const polys = this._subs.filter((p) => p.length >= 6);
    const evenOdd = rule === 'evenodd';
    if (!this._bin) { this._cmds.push({ type: 'clipPath', contours: polys.map((p) => p.slice()), evenOdd }); return; }
    const b = this._bin;
    let slots = 3;
    for (const pg of polys) slots += 1 + pg.length;
    if (slots > b.cap) return;
    this._ensure(slots);
    const p = this._fc;
    b.f32[p] = _OP_CLIPPATH; b.f32[p + 1] = evenOdd ? 1 : 0; b.f32[p + 2] = polys.length;
    let q = p + 3;
    for (const pg of polys) { b.f32[q++] = pg.length >> 1; for (let k = 0; k < pg.length; k++) b.f32[q++] = pg[k]; }
    this._fc = q;
  }

  /** One polygon in one colour. */
  _fillSolid(pts: number[], style: any) {
    if (this._bin) {
      const count = pts.length >> 1;
      const slots = 3 + pts.length; // op + count + color + points
      if (slots > this._bin.cap) return;   // path larger than buffer — skip
      if (this._fc + slots > this._bin.cap) this._flushChunk();
      const f = this._bin.f32, p = this._fc;
      f[p] = _OP_FILLPATH; f[p + 1] = count;
      this._bin.u32[p + 2] = _packColor(style);
      const o = p + 3;
      for (let k = 0; k < pts.length; k++) f[o + k] = pts[k];
      this._fc = o + pts.length;
    } else {
      this._cmds.push({ type: 'fillPath', points: pts.slice(), color: _parseColor(style) });
    }
  }

  /** One polygon with a linear gradient (the original gradient command). */
  _fillGradient(g: { stops: string | any[]; x0: any; y0: any; x1: any; y1: any; }, pts: number[]) {
    const stops = g.stops.length ? g.stops : [[0, [0, 0, 0, 0]], [1, [0, 0, 0, 0]]];
    if (this._bin) {
      const count = pts.length >> 1;
      const slots = 7 + stops.length * 2 + pts.length;
      if (slots > this._bin.cap) return;
      if (this._fc + slots > this._bin.cap) this._flushChunk();
      const f = this._bin.f32, u = this._bin.u32;
      let p = this._fc;
      f[p++] = _OP_FILLPATH_GRAD; f[p++] = count;
      f[p++] = g.x0; f[p++] = g.y0; f[p++] = g.x1; f[p++] = g.y1;
      f[p++] = stops.length;
      for (const [o, c] of stops) { f[p++] = o; u[p++] = _packColor(c); }
      for (let k = 0; k < pts.length; k++) f[p++] = pts[k];
      this._fc = p;
    } else {
      this._cmds.push({
        type: 'fillPathGradient', points: pts.slice(),
        x0: g.x0, y0: g.y0, x1: g.x1, y1: g.y1,
        stops: (stops as any).map(([o, c]: any) => [o, _parseColor(c)]),
      });
    }
  }

  /** Stroke each sub-path of the current path (closed ones joined last to first). */
  stroke() {
    this._syncState();
    for (let i = 0; i < this._subs.length; i++) {
      if (this._subs[i].length >= 4) this._strokeSub(this._subs[i], this._closed[i]);
    }
  }

  /** Stroke one polyline with the current stroke style, width and line style. */
  _strokeSub(pts: number[], closed: boolean) {
    this._syncState();
    const style = this.strokeStyle;
    if (!(style instanceof GlyxCanvasGradient)) {
      if (this._bin) {
        const count = pts.length >> 1;
        const slots = 5 + pts.length; // op + count + color + lineW + closed + points
        if (slots > this._bin.cap) return;
        if (this._fc + slots > this._bin.cap) this._flushChunk();
        const f = this._bin.f32, p = this._fc;
        f[p] = _OP_STROKEPATH; f[p + 1] = count;
        this._bin.u32[p + 2] = _packColor(style);
        f[p + 3] = this.lineWidth; f[p + 4] = closed ? 1 : 0;
        const o = p + 5;
        for (let k = 0; k < pts.length; k++) f[o + k] = pts[k];
        this._fc = o + pts.length;
      } else {
        this._cmds.push({ type: 'strokePath', points: pts.slice(),
                          color: _parseColor(style), lineWidth: this.lineWidth, closed });
      }
      return;
    }
    const br = this._brush(style);
    if (this._bin) {
      const b = this._bin;
      const slots = 4 + this._brushSlots(br) + pts.length;
      if (slots > b.cap) return;
      this._ensure(slots);
      const p = this._fc;
      b.f32[p] = _OP_STROKEPATH_BRUSH; b.f32[p + 1] = pts.length >> 1; b.f32[p + 2] = this.lineWidth; b.f32[p + 3] = closed ? 1 : 0;
      let q = this._putBrush(br, p + 4);
      for (let k = 0; k < pts.length; k++) b.f32[q++] = pts[k];
      this._fc = q;
    } else {
      this._cmds.push({ type: 'strokePathBrush', points: pts.slice(), lineWidth: this.lineWidth, closed, brush: this._brushJson(br) });
    }
  }

  // ── Image export ─────────────────────────────────────────────────────────────────────────────────────

  /**
   * Ask the native side to render this canvas: resolves with base64 text, of a PNG, or with `raw` of the RGBA pixels
   * of `region` (`[x, y, w, h]` in output pixels; the whole canvas when omitted).
   */
  _exportBase64(options: { scale?: number; width?: number; height?: number; region?: number[]; raw?: boolean } = {}): Promise<string> {
    if (typeof __glyx_canvas_export === 'undefined') return Promise.reject(new Error('canvas export needs a newer runner'));
    // What was drawn so far must reach the native side first (the request follows it in the same queue). Nothing
    // pending means nothing to send: an empty flush would replace the canvas's drawing with an empty one.
    if (this._bin ? this._fc > 0 : this._cmds.length > 0) this.flush();
    const id = __glyx_canvas_export(this._id, options.width || 0, options.height || 0, options.scale || 1, options.region || [], !!options.raw);
    return new Promise((resolve, reject) => { _pendingExports.set(id, { resolve, reject }); });
  }

  /**
   * What the canvas currently shows, as a PNG: resolves with a `data:image/png;base64,...` URL. Unlike the web's,
   * it is asynchronous. `scale` makes it that many times the canvas's size (2 for a sharper copy); or give an exact
   * `width` and `height`. The image is rendered by the CPU rasterizer whatever the window uses, up to 32 megapixels.
   */
  async toDataURL(type: string = 'image/png', options: { scale?: number; width?: number; height?: number } = {}): Promise<string> {
    if (type && type !== 'image/png') throw new Error('only image/png is supported');
    return 'data:image/png;base64,' + (await this._exportBase64(options));
  }

  /** The same PNG as raw bytes, to write to a file (`fs.writeFile`) or upload. */
  async toPNG(options: { scale?: number; width?: number; height?: number } = {}): Promise<Uint8Array> {
    return _b64ToBytes(await this._exportBase64(options));
  }

  /**
   * The PNG as a blob-like object (`type`, `size`, `bytes()`, `arrayBuffer()`): there is no `Blob` in the runtime.
   * Like the web's `toBlob(callback, type)` it also takes a callback, which it calls with the blob.
   */
  async toBlob(callbackOrOptions?: any, type: string = 'image/png', _quality?: number): Promise<GlyxBlob> {
    const callback = typeof callbackOrOptions === 'function' ? callbackOrOptions : null;
    const options = callback || !callbackOrOptions ? {} : callbackOrOptions;
    if (type && type !== 'image/png') throw new Error('only image/png is supported');
    const blob = new GlyxBlob(await this.toPNG(options), 'image/png');
    if (callback) callback(blob);
    return blob;
  }

  /**
   * The pixels of a rectangle of the canvas, as the web's `getImageData`: `{ width, height, data }` with `data` a
   * `Uint8ClampedArray` of straight RGBA. Unlike the web's it is asynchronous, and it renders the canvas to read it
   * (on the CPU, region only), so use it for the occasional read, not every frame. At most 4 megapixels.
   */
  async getImageData(sx: number, sy: number, sw: number, sh: number, options: { scale?: number } = {}): Promise<{ width: number; height: number; data: Uint8ClampedArray }> {
    // A negative width or height reads the rectangle the other way, as the web does.
    if (sw < 0) { sx += sw; sw = -sw; }
    if (sh < 0) { sy += sh; sh = -sh; }
    const w = Math.round(sw), h = Math.round(sh);
    if (!(w > 0 && h > 0)) throw new RangeError('getImageData needs a width and height above zero');
    const bytes = _b64ToBytes(await this._exportBase64({ scale: options.scale, region: [Math.round(sx), Math.round(sy), w, h], raw: true }));
    return { width: w, height: h, data: new Uint8ClampedArray(bytes.buffer, bytes.byteOffset, bytes.length) };
  }

  /** Send accumulated draw commands to the native layer. */
  flush() {
    if (this._bin) {
      this._flushChunk();
      this._firstChunk = true; // next frame's first chunk replaces again
      this._newFrame();
      return;
    }
    // JSON fallback. Always clear the buffer, even when the binding is missing
    // (snapshot/test), so _cmds can't grow unbounded across frames.
    this._newFrame();
    if (typeof __glyx_canvas_update === 'undefined') { this._cmds.length = 0; return; }
    try {
      __glyx_canvas_update(this._id, JSON.stringify(this._cmds));
    } catch (e) {
      __glyx_log('[canvas] flush error: ' + e);
    }
    this._cmds.length = 0;
  }
}

// Exports in flight: request id -> the promise's resolve / reject.
const _pendingExports = new Map<number, { resolve: (b64: string) => void; reject: (e: Error) => void }>();
setCanvasExportHandler((ev: any) => {
  const p = _pendingExports.get(ev.reqId);
  if (!p) return;
  _pendingExports.delete(ev.reqId);
  if (ev.error) p.reject(new Error(ev.error));
  else p.resolve(ev.data);
});

const _B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
/** Base64 text to bytes (no `atob` needed). */
function _b64ToBytes(b64: string): Uint8Array {
  const clean = b64.replace(/[^A-Za-z0-9+/]/g, '');
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const a = _B64.indexOf(clean[i]), b = _B64.indexOf(clean[i + 1]);
    const c = i + 2 < clean.length ? _B64.indexOf(clean[i + 2]) : -1, d = i + 3 < clean.length ? _B64.indexOf(clean[i + 3]) : -1;
    out[o++] = (a << 2) | (b >> 4);
    if (c >= 0) out[o++] = ((b & 15) << 4) | (c >> 2);
    if (d >= 0) out[o++] = ((c & 3) << 6) | d;
  }
  return out.subarray(0, o);
}

/** A circle as a polygon, for the gradient and shadow paths that need geometry. */
function _circlePoints(cx: number, cy: number, r: number) {
  const n = Math.max(12, Math.min(160, Math.ceil(Math.sqrt(Math.abs(r)) * 8)));
  const out: number[] = [];
  for (let i = 0; i < n; i++) { const t = (Math.PI * 2 * i) / n; out.push(cx + Math.cos(t) * r, cy + Math.sin(t) * r); }
  return out;
}

function _unpackColor(u: number) { return [u & 255, (u >>> 8) & 255, (u >>> 16) & 255, (u >>> 24) & 255]; }

/**
 * A 2D canvas node backed by Vello primitives.
 *
 * @param {{ style?: object, ref?: React.Ref<GlyxCanvasContext> }} props
 */
export const Canvas = React.forwardRef(function Canvas({ style, ...props }: any, ref: any) {
  const ctxRef   = useRef<any>(null);
  const nativeId = useRef<any>(null);

  const onMount = useCallback((id: any) => {
    nativeId.current = id;
    const ctx = new GlyxCanvasContext(id);
    ctxRef.current = ctx;
    if (ref) {
      if (typeof ref === 'function') ref(ctx);
      else ref.current = ctx;
    }
  }, [ref]);

  return React.createElement('canvas', {
    _glyxOnMount: onMount,
    style,
    ...props,
  });
});

// ── Canvas 3D ─────────────────────────────────────────────────────────────────
//
// <Canvas3D ref={c3dRef} style={{ width: 400, height: 300 }} />
//
// Exposes:
//   c3dRef.current.updateScene(scene);   // push Scene3D JSON description
//   c3dRef.current.loadGltf(path);       // preload a GLTF file
//
// Scene shape (all optional fields):
//   {
//     background: [r, g, b, a],          // background fill color 0.0–1.0
//     camera: {
//       position: [x, y, z],
//       target:   [x, y, z],
//       up:       [x, y, z],
//       fovDeg:   60,
//       near:     0.1,
//       far:      1000,
//     },
//     lights: [
//       { type: 'ambient',     color: [r,g,b,a], intensity: 0.3 },
//       { type: 'directional', color: [r,g,b,a], intensity: 1.0, direction: [x,y,z] },
//     ],
//     meshes: [
//       {
//         geometry: { type: 'box',    width: 1, height: 1, depth: 1 },
//         // or:    { type: 'sphere', radius: 1, rings: 20, sectors: 20 },
//         // or:    { type: 'plane',  width: 10, depth: 10 },
//         // or:    { type: 'gltf',   path: '/path/to/model.glb' },
//         transform: [16 floats, row-major 4x4 matrix],  // identity by default
//         color:     [r, g, b, a],
//       },
//     ],
//   }

// reqId → resolve function for a pending raycast(), settled by
// _pollCanvas3DRaycasts() once glyx-core answers it on a later frame (see
// bindings::RaycastRequest's doc — raycasting needs the live Renderer3D,
// which only exists on the render side, so it's request/poll like video
// and webview events, not a directly-resolved native promise).
const _pendingRaycasts = new Map();

export function _pollCanvas3DRaycasts() {
  if (typeof __glyx_canvas3d_raycast_poll === 'undefined') return;
  let raw;
  try { raw = __glyx_canvas3d_raycast_poll(); } catch { return; }
  if (!raw || raw === '[]') return;
  let results;
  try { results = JSON.parse(raw); } catch { return; }
  for (const r of results) {
    const resolve = _pendingRaycasts.get(r.reqId);
    if (!resolve) continue;
    _pendingRaycasts.delete(r.reqId);
    resolve(r.hit === null ? null : { meshIndex: r.meshIndex, point: r.point, distance: r.distance });
  }
}

class GlyxCanvas3DContext {
  declare _id: any;
  constructor(nativeId: any) {
    this._id = nativeId;
  }

  updateScene(scene: any) {
    if (typeof __glyx_canvas3d_update === 'undefined') return;
    try {
      __glyx_canvas3d_update(this._id, JSON.stringify(scene));
    } catch (e) {
      __glyx_log('[canvas3d] updateScene error: ' + e);
    }
  }

  loadGltf(path: any) {
    if (typeof __glyx_canvas3d_load_gltf === 'undefined') return;
    try {
      __glyx_canvas3d_load_gltf(this._id, path);
    } catch (e) {
      __glyx_log('[canvas3d] loadGltf error: ' + e);
    }
  }

  unloadGltf(path: any) {
    if (typeof __glyx_canvas3d_unload_gltf === 'undefined') return;
    __glyx_canvas3d_unload_gltf(path);
  }

  /**
   * Cast a ray from the camera through a screen-space point within this
   * canvas (e.g. from a click/press handler's local x/y) and resolve with
   * the closest hit mesh, or `null` if nothing was hit.
   * @param {number} x       screen-space x, relative to this canvas's own top-left
   * @param {number} y       screen-space y, relative to this canvas's own top-left
   * @param {number} width   this canvas's current width (caller-supplied — not tracked natively per-call)
   * @param {number} height  this canvas's current height
   * @returns {Promise<{meshIndex:number, point:[number,number,number], distance:number}|null>}
   */
  raycast(x: number, y: number, width: number, height: number) {
    if (typeof __glyx_canvas3d_raycast === 'undefined' || !width || !height) return Promise.resolve(null);
    const ndcX = (x / width) * 2 - 1;
    const ndcY = 1 - (y / height) * 2;
    try {
      const reqId = __glyx_canvas3d_raycast(this._id, ndcX, ndcY);
      return new Promise((resolve) => { _pendingRaycasts.set(reqId, resolve); });
    } catch (e) {
      __glyx_log('[canvas3d] raycast error: ' + e);
      return Promise.resolve(null);
    }
  }
}

/**
 * A 3D canvas node rendered via wgpu as a post-Vello overlay.
 *
 * @param {{ style?: object, ref?: React.Ref<GlyxCanvas3DContext> }} props
 */
export const Canvas3D = React.forwardRef(function Canvas3D({ style, ...props }: any, ref: any) {
  const onMount = useCallback((id: any) => {
    const ctx = new GlyxCanvas3DContext(id);
    if (ref) {
      if (typeof ref === 'function') ref(ctx);
      else ref.current = ctx;
    }
  }, [ref]);

  return React.createElement('canvas3d', {
    _glyxOnMount: onMount,
    style,
    ...props,
  });
});
