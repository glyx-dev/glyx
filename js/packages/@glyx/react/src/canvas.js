import React, { useRef, useCallback } from 'react';

// ── Canvas 2D ─────────────────────────────────────────────────────────────────
//
// <Canvas ref={canvasRef} style={{ width: 300, height: 200 }} />
//
// Exposes a lightweight 2D drawing context via ref:
//   const ctx = canvasRef.current;
//   ctx.fillStyle = '#ff0000';      // or [r,g,b,a]
//   ctx.strokeStyle = '#ffffff';
//   ctx.lineWidth = 2;
//   ctx.fillRect(x, y, w, h);
//   ctx.strokeRect(x, y, w, h);
//   ctx.fillCircle(cx, cy, r);
//   ctx.strokeCircle(cx, cy, r);
//   ctx.strokeLine(x0, y0, x1, y1);
//   ctx.fillText(text, x, y, fontSize);
//   ctx.clear();
//   ctx.flush();     // or commands are flushed automatically on the next frame

function _parseColor(c) {
  if (Array.isArray(c)) return c;
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
      _OP_FILLPATH = 7, _OP_STROKEPATH = 8;

// Pack a color into one little-endian u32 whose bytes are [r, g, b, a].
function _packColor(c) {
  const col = _parseColor(c);
  return ((col[0] & 255) | ((col[1] & 255) << 8) | ((col[2] & 255) << 16) | ((col[3] & 255) << 24)) >>> 0;
}

// Lazily resolve the binary command buffer. MUST be runtime-evaluated (not a
// module-level const): in snapshot/packaged builds the module body runs at
// snapshot-BUILD time, before the runtime installs the real backing-store
// globals. Probing on first canvas use (always at app runtime) sees them.
// Memoized: `false` = unavailable (use JSON); object = the shared buffers.
let _canvasBin; // undefined = not yet probed
function _canvasBinaryEnv() {
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

class GlyxCanvasContext {
  constructor(nativeId) {
    this._id    = nativeId;
    this._bin   = _canvasBinaryEnv(); // shared buffers, or false for JSON
    this._cmds  = [];        // JSON fallback buffer
    this._fc    = 0;         // binary: f32 command cursor
    this._sc    = 0;         // binary: string byte cursor
    this._firstChunk = true; // binary: first flush of a frame replaces, rest append
    this._path   = [];       // current path: flat [x0,y0,x1,y1,…]
    this._pathClosed = false;
    this.fillStyle   = [255, 255, 255, 255];
    this.strokeStyle = [255, 255, 255, 255];
    this.lineWidth   = 1;
  }

  // Ensure `slots` f32 command slots are free; flush a continuation chunk if not.
  _ensure(slots) {
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

  clear() {
    if (!this._bin) { this._cmds.length = 0; this._cmds.push({ type: 'clear' }); return; }
    // Start a fresh frame: discard pending draws and emit a clear.
    this._fc = 0; this._sc = 0; this._firstChunk = true;
    this._bin.f32[0] = _OP_CLEAR; this._fc = 1;
  }

  fillRect(x, y, w, h) {
    if (!this._bin) { this._cmds.push({ type: 'fillRect', x, y, w, h, color: _parseColor(this.fillStyle) }); return; }
    this._ensure(6);
    const f = this._bin.f32, p = this._fc;
    f[p] = _OP_FILLRECT; f[p+1] = x; f[p+2] = y; f[p+3] = w; f[p+4] = h;
    this._bin.u32[p+5] = _packColor(this.fillStyle);
    this._fc = p + 6;
  }
  strokeRect(x, y, w, h) {
    if (!this._bin) { this._cmds.push({ type: 'strokeRect', x, y, w, h, color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth }); return; }
    this._ensure(7);
    const f = this._bin.f32, p = this._fc;
    f[p] = _OP_STROKERECT; f[p+1] = x; f[p+2] = y; f[p+3] = w; f[p+4] = h;
    this._bin.u32[p+5] = _packColor(this.strokeStyle); f[p+6] = this.lineWidth;
    this._fc = p + 7;
  }
  fillCircle(cx, cy, r) {
    if (!this._bin) { this._cmds.push({ type: 'fillCircle', cx, cy, r, color: _parseColor(this.fillStyle) }); return; }
    this._ensure(5);
    const f = this._bin.f32, p = this._fc;
    f[p] = _OP_FILLCIRCLE; f[p+1] = cx; f[p+2] = cy; f[p+3] = r;
    this._bin.u32[p+4] = _packColor(this.fillStyle);
    this._fc = p + 5;
  }
  strokeCircle(cx, cy, r) {
    if (!this._bin) { this._cmds.push({ type: 'strokeCircle', cx, cy, r, color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth }); return; }
    this._ensure(6);
    const f = this._bin.f32, p = this._fc;
    f[p] = _OP_STROKECIRCLE; f[p+1] = cx; f[p+2] = cy; f[p+3] = r;
    this._bin.u32[p+4] = _packColor(this.strokeStyle); f[p+5] = this.lineWidth;
    this._fc = p + 6;
  }
  strokeLine(x0, y0, x1, y1) {
    if (!this._bin) { this._cmds.push({ type: 'strokeLine', x0, y0, x1, y1, color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth }); return; }
    this._ensure(7);
    const f = this._bin.f32, p = this._fc;
    f[p] = _OP_STROKELINE; f[p+1] = x0; f[p+2] = y0; f[p+3] = x1; f[p+4] = y1;
    this._bin.u32[p+5] = _packColor(this.strokeStyle); f[p+6] = this.lineWidth;
    this._fc = p + 7;
  }
  fillText(text, x, y, fontSize = 16) {
    if (!this._bin) { this._cmds.push({ type: 'fillText', text: String(text), x, y, fontSize, color: _parseColor(this.fillStyle) }); return; }
    const b = this._bin, s = String(text);
    // The command and its UTF-8 bytes must live in the same chunk (offset is
    // chunk-relative), so flush up-front if either region lacks room.
    if (this._fc + 7 > b.cap || this._sc + s.length * 4 > b.strCap) this._flushChunk();
    const off = this._sc;
    let len = 0;
    if (b.enc) { len = (b.enc.encodeInto(s, b.str.subarray(this._sc)).written) | 0; }
    this._sc += len;
    const f = b.f32, p = this._fc;
    f[p] = _OP_FILLTEXT; f[p+1] = x; f[p+2] = y; f[p+3] = fontSize;
    b.u32[p+4] = _packColor(this.fillStyle); f[p+5] = off; f[p+6] = len;
    this._fc = p + 7;
  }

  // ── Path API (canvas-like) ────────────────────────────────────────────────
  // Curves are tessellated to line segments in JS; the native side only deals
  // with polylines/polygons. Single subpath per begin→fill/stroke.

  beginPath() { this._path.length = 0; this._pathClosed = false; }
  moveTo(x, y) { this._path.push(x, y); }
  lineTo(x, y) { this._path.push(x, y); }
  closePath() { this._pathClosed = true; }

  /** Arc from `a0`→`a1` radians (set `ccw` for counter-clockwise). */
  arc(cx, cy, r, a0, a1, ccw = false) {
    let start = a0, end = a1;
    if (ccw && end > start) end -= Math.PI * 2;
    if (!ccw && end < start) end += Math.PI * 2;
    const sweep = Math.abs(end - start);
    const segs  = Math.max(6, Math.ceil(sweep / (Math.PI / 16)));
    for (let i = 0; i <= segs; i++) {
      const t = start + (end - start) * (i / segs);
      this._path.push(cx + Math.cos(t) * r, cy + Math.sin(t) * r);
    }
  }

  quadraticCurveTo(cpx, cpy, x, y) {
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

  bezierCurveTo(c1x, c1y, c2x, c2y, x, y) {
    const n = this._path.length;
    const x0 = n >= 2 ? this._path[n - 2] : c1x;
    const y0 = n >= 2 ? this._path[n - 1] : c1y;
    const segs = 20;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs, mt = 1 - t;
      const a = mt * mt * mt, b = 3 * mt * mt * t, c = 3 * mt * t * t, d = t * t * t;
      this._path.push(a * x0 + b * c1x + c * c2x + d * x,
                      a * y0 + b * c1y + c * c2y + d * y);
    }
  }

  /** Fill the current path as a polygon (auto-closed). */
  fill() {
    if (this._path.length < 6) return; // need ≥3 points
    if (this._bin) {
      const count = this._path.length >> 1;
      const slots = 3 + this._path.length; // op + count + color + points
      if (slots > this._bin.cap) return;   // path larger than buffer — skip
      if (this._fc + slots > this._bin.cap) this._flushChunk();
      const f = this._bin.f32, p = this._fc;
      f[p] = _OP_FILLPATH; f[p + 1] = count;
      this._bin.u32[p + 2] = _packColor(this.fillStyle);
      const o = p + 3;
      for (let k = 0; k < this._path.length; k++) f[o + k] = this._path[k];
      this._fc = o + this._path.length;
    } else {
      this._cmds.push({ type: 'fillPath', points: this._path.slice(), color: _parseColor(this.fillStyle) });
    }
  }

  /** Stroke the current path as a polyline (closed if `closePath()` was called). */
  stroke() {
    if (this._path.length < 4) return;
    if (this._bin) {
      const count = this._path.length >> 1;
      const slots = 5 + this._path.length; // op + count + color + lineW + closed + points
      if (slots > this._bin.cap) return;
      if (this._fc + slots > this._bin.cap) this._flushChunk();
      const f = this._bin.f32, p = this._fc;
      f[p] = _OP_STROKEPATH; f[p + 1] = count;
      this._bin.u32[p + 2] = _packColor(this.strokeStyle);
      f[p + 3] = this.lineWidth; f[p + 4] = this._pathClosed ? 1 : 0;
      const o = p + 5;
      for (let k = 0; k < this._path.length; k++) f[o + k] = this._path[k];
      this._fc = o + this._path.length;
    } else {
      this._cmds.push({ type: 'strokePath', points: this._path.slice(),
                        color: _parseColor(this.strokeStyle), lineWidth: this.lineWidth, closed: this._pathClosed });
    }
  }

  /** Send accumulated draw commands to the native layer. */
  flush() {
    if (this._bin) {
      this._flushChunk();
      this._firstChunk = true; // next frame's first chunk replaces again
      return;
    }
    // JSON fallback. Always clear the buffer, even when the binding is missing
    // (snapshot/test), so _cmds can't grow unbounded across frames.
    if (typeof __glyx_canvas_update === 'undefined') { this._cmds.length = 0; return; }
    try {
      __glyx_canvas_update(this._id, JSON.stringify(this._cmds));
    } catch (e) {
      __glyx_log('[canvas] flush error: ' + e);
    }
    this._cmds.length = 0;
  }
}

/**
 * A 2D canvas node backed by Vello primitives.
 *
 * @param {{ style?: object, ref?: React.Ref<GlyxCanvasContext> }} props
 */
export const Canvas = React.forwardRef(function Canvas({ style, ...props }, ref) {
  const ctxRef   = useRef(null);
  const nativeId = useRef(null);

  const onMount = useCallback((id) => {
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

class GlyxCanvas3DContext {
  constructor(nativeId) {
    this._id = nativeId;
  }

  updateScene(scene) {
    if (typeof __glyx_canvas3d_update === 'undefined') return;
    try {
      __glyx_canvas3d_update(this._id, JSON.stringify(scene));
    } catch (e) {
      __glyx_log('[canvas3d] updateScene error: ' + e);
    }
  }

  loadGltf(path) {
    if (typeof __glyx_canvas3d_load_gltf === 'undefined') return;
    try {
      __glyx_canvas3d_load_gltf(this._id, path);
    } catch (e) {
      __glyx_log('[canvas3d] loadGltf error: ' + e);
    }
  }

  unloadGltf(path) {
    if (typeof __glyx_canvas3d_unload_gltf === 'undefined') return;
    __glyx_canvas3d_unload_gltf(path);
  }
}

/**
 * A 3D canvas node rendered via wgpu as a post-Vello overlay.
 *
 * @param {{ style?: object, ref?: React.Ref<GlyxCanvas3DContext> }} props
 */
export const Canvas3D = React.forwardRef(function Canvas3D({ style, ...props }, ref) {
  const onMount = useCallback((id) => {
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
