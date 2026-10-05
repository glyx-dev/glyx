// @glyx-dev/charts — charts drawn on Glyx Canvas 2D.
//
// Built on the Canvas path API (fill/stroke/arc/bezier, linear gradients,
// clipping, measured text). No DOM, no SVG. A chart redraws only when its
// data, size, theme or hover/keyboard position changes — never per frame —
// so it costs nothing while idle.
//
// Interaction is one overlay per chart: continuous pointer tracking
// (`onPointerMove`) snaps to the nearest point, and the same overlay is a
// keyboard- and screen-reader-accessible figure (arrow keys move between
// points; each move is announced through a live region).
//
// Usage:
//   import { LineChart, AreaChart, BarChart, PieChart, Legend } from '@glyx-dev/charts';
//   <LineChart data={[{x:'Jan',y:10},…]} width={600} height={300} />
//   <AreaChart series={[{ name:'Revenue', data, color:'#4090F0' }, …]} width={600} height={300} />

import React from 'react';
import { Canvas, View, Text, Pressable, useDraggable, useWheel } from '@glyx-dev/react';

const { useRef, useEffect, useState, useCallback, useMemo } = React;

// ── Palette & themes ────────────────────────────────────────────────────────

const DEFAULT_PALETTE = [
  '#4C8DF6', '#22C29B', '#F2A93B', '#EC5D78', '#9D6BF0',
  '#2BB6D6', '#F57C45', '#7BC65A', '#E05CC2', '#8C94A8',
];

const THEMES = {
  dark: {
    grid:        [255, 255, 255, 15],
    baseline:    [255, 255, 255, 40],
    label:       '#A9AFC2',
    text:        '#E8EAF2',
    muted:       '#6B7185',
    crosshair:   [255, 255, 255, 70],
    surface:     '#12131A', // gaps between donut segments, marker rings
    tooltipBg:   '#1B1D27',
    tooltipBorder: '#2E3242',
    focusRing:   '#4C9AFF',
    control:     '#232634',
  },
  light: {
    grid:        [20, 25, 45, 18],
    baseline:    [20, 25, 45, 50],
    label:       '#6A7084',
    text:        '#1A1D27',
    muted:       '#8A90A2',
    crosshair:   [20, 25, 45, 70],
    surface:     '#FFFFFF',
    tooltipBg:   '#FFFFFF',
    tooltipBorder: '#E2E5EC',
    focusRing:   '#2F7BF5',
    control:     '#EEF0F5',
  },
};

/** `theme` prop → resolved colours: 'dark' (default), 'light', or an object of overrides. */
function _theme(t) {
  if (t && typeof t === 'object') return { ...THEMES.dark, ...t };
  return THEMES[t] || THEMES.dark;
}

// ── Colour helpers ──────────────────────────────────────────────────────────

function _rgba(c, alpha) {
  if (Array.isArray(c)) {
    const a = c[3] == null ? 255 : c[3];
    return [c[0], c[1], c[2], alpha == null ? a : Math.round(alpha * 255)];
  }
  let h = String(c).replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  const a = h.length >= 8 ? parseInt(h.slice(6, 8), 16) : 255;
  return [r, g, b, alpha == null ? a : Math.round(alpha * 255)];
}

function _lighten(c, amount) {
  const [r, g, b, a] = _rgba(c);
  return [
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
    a,
  ];
}

// ── Numbers ─────────────────────────────────────────────────────────────────

/** Compact number: 1234 → "1.2k", 2500000 → "2.5M". */
function _fmt(v) {
  if (v == null || !Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  const trim = (s) => s.replace(/\.0$/, '');
  if (a >= 1e9) return trim((v / 1e9).toFixed(1)) + 'B';
  if (a >= 1e6) return trim((v / 1e6).toFixed(1)) + 'M';
  if (a >= 1e3) return trim((v / 1e3).toFixed(1)) + 'k';
  if (Number.isInteger(v)) return String(v);
  return a >= 10 ? v.toFixed(1) : v.toFixed(2).replace(/0$/, '');
}

/** A "nice" tick step (1, 2, 2.5 or 5 × 10ⁿ) giving roughly `target` intervals over `range`. */
function _niceStep(range, target) {
  const raw = range / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const n = raw / mag;
  const s = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return s * mag;
}

/**
 * Axis scale over [min, max] with round tick values. `zero` forces the
 * domain to include 0 (bars and areas must start at the baseline).
 */
function _niceScale(min, max, { target = 4, zero = false } = {}) {
  if (!Number.isFinite(min) || !Number.isFinite(max)) { min = 0; max = 1; }
  if (zero) { min = Math.min(0, min); max = Math.max(0, max); }
  if (min === max) { max = min + (Math.abs(min) || 1); if (!zero) min -= Math.abs(min) * 0.1 || 1; }
  const step = _niceStep(max - min, target);
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step * 1e-6; v += step) ticks.push(Math.round(v / step) * step);
  return { lo, hi, step, ticks };
}

/** Tick label for `v` on a scale with `step` — as many decimals as the step needs. */
function _fmtTick(v, step) {
  if (Math.abs(v) >= 1000) return _fmt(v);
  // Fewest decimals that represent the step exactly (0.25 → 2, 0.5 → 1).
  let decimals = 0;
  while (decimals < 6 && Math.abs(Math.round(step * 10 ** decimals) - step * 10 ** decimals) > 1e-7) decimals++;
  return v.toFixed(decimals);
}

// ── Text measurement (shared by layout + drawing) ───────────────────────────

const _measureCache = new Map();
function _textW(text, size = 11, bold = false) {
  const s = String(text);
  const key = size + (bold ? 'b' : 'n') + s;
  let w = _measureCache.get(key);
  if (w != null) return w;
  if (typeof __glyx_measure_text !== 'undefined') {
    w = __glyx_measure_text(s, size, 0, bold ? 'bold' : '').width;
  } else {
    w = s.length * size * 0.55; // tests / no runtime
  }
  if (_measureCache.size > 2000) _measureCache.clear();
  _measureCache.set(key, w);
  return w;
}

// ── Series normalization ────────────────────────────────────────────────────

/** `data` (single series) or `series` → [{ name, data, color }]. */
function _normSeries({ data, series, color, name, palette = DEFAULT_PALETTE }) {
  if (Array.isArray(series) && series.length) {
    return series.map((s, i) => ({
      name: s.name ?? `Series ${i + 1}`,
      data: s.data || [],
      color: s.color || palette[i % palette.length],
    }));
  }
  return [{ name: name ?? '', data: data || [], color: color || palette[0] }];
}

// ── Canvas host ─────────────────────────────────────────────────────────────

// New data eases in: each update draws the final chart once, and the native
// engine moves the previous drawing toward it (a canvas `transition`), so no
// JavaScript runs per frame. Critically damped: quick, never overshooting the
// data. It also glides the hover crosshair between points; the speed matches
// the tooltip card's glide so the two stay together. A resized chart redraws
// instantly. When a draw gains or loses parts (an axis tick, a label), what
// lines up still eases and the new or removed parts appear or vanish at once;
// a data line that gained a point replaces the old one.
const _DATA_TRANSITION = { spring: { stiffness: 300, damping: 35 } };

// Segments per pie/donut arc. 48 keeps the rim within 0.1px of a true circle
// at any size a chart is likely to be, even for a half-circle slice.
const _ARC_SEGMENTS = 48;

function _ChartCanvas({ width, height, draw, deps, animate = true }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = ref.current;
    if (!ctx) return;
    ctx.clear();
    draw(ctx);
    ctx.flush();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return React.createElement(Canvas, { ref, width, height, ...(animate ? { transition: _DATA_TRANSITION } : null) });
}

// ── Following the container ─────────────────────────────────────────────────

// A chart draws at a pixel size. `width`/`height` as a string ('100%', '50%')
// instead makes the chart measure the box those resolve to and draw at that
// size, re-measuring when the container changes. Numbers (and the 480×260
// defaults) behave exactly as before: no wrapper, no measuring.
const _FIT_POLL_MS = 250;
const _FIT_DEFAULT = { width: 480, height: 260 };

function _isFill(v) { return typeof v === 'string'; }

function _fit(Inner, props) {
  if (!_isFill(props.width) && !_isFill(props.height)) return React.createElement(Inner, props);
  return React.createElement(_Fit, { Inner, props });
}

/**
 * Wraps a chart in a box sized by the string `width`/`height`, reads the box's
 * real size from the native layout, and renders the chart at it. Nothing tells
 * JS when a layout changes, so the size is re-read a few times a second (one
 * cheap lookup per chart); a window drag-resize therefore follows in steps, and
 * the canvas redraws instantly at each new size rather than easing.
 */
function _Fit({ Inner, props }) {
  const fillW = _isFill(props.width), fillH = _isFill(props.height);
  const idRef = useRef(null);
  const [size, setSize] = useState(null);
  const measure = useCallback(() => {
    if (idRef.current == null || typeof __glyx_getLayout === 'undefined') return;
    const l = __glyx_getLayout(idRef.current);
    if (!l) return;
    const w = Math.floor(l.boxWidth ?? l.width), h = Math.floor(l.boxHeight ?? l.height);
    if (w > 0 && h > 0) setSize((prev) => (prev && prev.w === w && prev.h === h ? prev : { w, h }));
  }, []);
  useEffect(() => {
    measure();
    const first = setTimeout(measure, 50);
    const poll = setInterval(measure, _FIT_POLL_MS);
    return () => { clearTimeout(first); clearInterval(poll); };
  }, [measure]);

  const canMeasure = typeof __glyx_getLayout !== 'undefined';
  // Without a layout engine (static rendering) fall back to the default size.
  const at = size ?? (canMeasure ? null : { w: _FIT_DEFAULT.width, h: _FIT_DEFAULT.height });
  const box = {
    width: fillW ? props.width : (props.width ?? _FIT_DEFAULT.width),
    height: fillH ? props.height : (props.height ?? _FIT_DEFAULT.height),
  };
  return React.createElement(
    View,
    { style: box, _glyxOnMount: (id) => { idRef.current = id; } },
    at ? React.createElement(Inner, {
      ...props,
      width: fillW ? at.w : (props.width ?? _FIT_DEFAULT.width),
      height: fillH ? at.h : (props.height ?? _FIT_DEFAULT.height),
    }) : null,
  );
}

export function LineChart(props) { return _fit(_LineChartInner, props); }
export function AreaChart(props) { return _fit(_AreaChartInner, props); }

// A soft fade-and-rise when a chart first appears. Native keyframes: no JS
// runs per frame, and re-renders with the same spec don't restart it.
const _ENTRANCE = {
  duration: 420, easing: 'ease-out',
  keyframes: { from: { opacity: 0, transform: 'translate(0, 6px)' }, to: { opacity: 1, transform: 'translate(0, 0)' } },
};

// ── Drawing helpers ─────────────────────────────────────────────────────────

/**
 * Line segments per curve between two data points: about one per pixel of the
 * gap, within 4–20. The canvas default of 20 put a vertex every third of a pixel
 * on a 7px gap, which cost ~3x the stroke time and showed no difference. It
 * depends only on the gap, never on the data values, so consecutive draws have
 * the same number of points and the canvas can ease between them.
 */
function _curveSegments(gap) {
  return Math.max(4, Math.min(20, Math.ceil(Math.abs(gap))));
}

/** Running totals per series: `out[k][i]` = sum of series 0..k at x index i (gaps count as 0). */
function _cumulative(series) {
  const out = [];
  series.forEach((s, k) => {
    out.push(s.data.map((d, i) => (k ? out[k - 1][i] : 0) + (Number.isFinite(d.y) ? d.y : 0)));
  });
  return out;
}

/** Monotone cubic (Fritsch–Carlson) through `pts` — smooth, never overshoots the data. */
function _smoothPath(ctx, pts, moveFirst = true) {
  const n = pts.length;
  if (n === 0) return;
  if (moveFirst) ctx.moveTo(pts[0][0], pts[0][1]); else ctx.lineTo(pts[0][0], pts[0][1]);
  if (n === 1) return;
  if (n === 2) { ctx.lineTo(pts[1][0], pts[1][1]); return; }
  const dx = [], dy = [], m = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1][0] - pts[i][0]);
    dy.push(pts[i + 1][1] - pts[i][1]);
    m.push(dx[i] === 0 ? 0 : dy[i] / dx[i]);
  }
  const t = [m[0]];
  for (let i = 1; i < n - 1; i++) {
    if (m[i - 1] * m[i] <= 0) t.push(0);
    else {
      const w1 = 2 * dx[i] + dx[i - 1], w2 = dx[i] + 2 * dx[i - 1];
      t.push((w1 + w2) / (w1 / m[i - 1] + w2 / m[i]));
    }
  }
  t.push(m[n - 2]);
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    ctx.bezierCurveTo(
      pts[i][0] + h, pts[i][1] + t[i] * h,
      pts[i + 1][0] - h, pts[i + 1][1] - t[i + 1] * h,
      pts[i + 1][0], pts[i + 1][1],
      _curveSegments(dx[i]),
    );
  }
}

function _polyline(ctx, pts, moveFirst = true) {
  pts.forEach((p, i) => (i === 0 && moveFirst ? ctx.moveTo(p[0], p[1]) : ctx.lineTo(p[0], p[1])));
}

/** Rect with independently rounded top and bottom corners, as a path. */
function _roundRectPath(ctx, x, y, w, h, rTop, rBottom = 0) {
  const rt = Math.max(0, Math.min(rTop, w / 2, h));
  const rb = Math.max(0, Math.min(rBottom, w / 2, h - rt));
  ctx.beginPath();
  ctx.moveTo(x, y + rt);
  if (rt > 0) ctx.arc(x + rt, y + rt, rt, Math.PI, Math.PI * 1.5); else ctx.lineTo(x, y);
  ctx.lineTo(x + w - rt, y);
  if (rt > 0) ctx.arc(x + w - rt, y + rt, rt, Math.PI * 1.5, Math.PI * 2);
  ctx.lineTo(x + w, y + h - rb);
  if (rb > 0) ctx.arc(x + w - rb, y + h - rb, rb, 0, Math.PI * 0.5); else ctx.lineTo(x + w, y + h);
  ctx.lineTo(x + rb, y + h);
  if (rb > 0) ctx.arc(x + rb, y + h - rb, rb, Math.PI * 0.5, Math.PI);
  ctx.closePath();
}

function _dashedVLine(ctx, x, y0, y1, dash = 4, gap = 4) {
  for (let y = y0; y < y1; y += dash + gap) ctx.strokeLine(x, y, x, Math.min(y + dash, y1));
}

/** Horizontal gridlines + Y tick labels (right-aligned, left of the plot). */
function _drawYAxis(ctx, L, T, { showGrid, showLabels }) {
  const { PAD, W, scale, toY } = L;
  ctx.lineWidth = 1;
  for (const v of scale.ticks) {
    const y = Math.round(toY(v)) + 0.5;
    if (showGrid) {
      ctx.strokeStyle = v === 0 && scale.lo < 0 ? T.baseline : T.grid;
      ctx.strokeLine(PAD.left, y, PAD.left + W, y);
    }
    if (showLabels) {
      ctx.fillStyle = T.label;
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      ctx.fillText(_fmtTick(v, scale.step), PAD.left - 10, y, 11);
    }
  }
  ctx.textAlign = 'left'; ctx.textBaseline = 'top';
}

/**
 * X labels centred under their positions, thinned so they never overlap and
 * nudged inside the chart at both ends (no clipped first/last label).
 */
function _drawXLabels(ctx, labels, xs, L, T) {
  const { PAD, H, width } = L;
  const widths = labels.map((s) => _textW(s, 11));
  const maxW = Math.max(1, ...widths);
  const spacing = xs.length > 1 ? Math.abs(xs[1] - xs[0]) : Infinity;
  const step = Math.max(1, Math.ceil((maxW + 14) / spacing));
  const y = PAD.top + H + 9;
  ctx.fillStyle = T.label;
  ctx.textBaseline = 'top';
  for (let i = 0; i < labels.length; i += step) {
    const w = widths[i];
    const x = Math.min(width - 2 - w, Math.max(2, xs[i] - w / 2));
    ctx.fillText(labels[i], x, y, 11);
  }
}

// ── Tooltip card ────────────────────────────────────────────────────────────

// The card glides between points on a spring (moved with `transform`, which
// the native engine can animate; `left`/`top` are layout and would snap), and
// fades in and out. Native keyframes and transitions: no JS runs per frame.
const _TOOLTIP_GLIDE   = { spring: { stiffness: 420, damping: 34 }, properties: ['transform', 'opacity'] };
const _TOOLTIP_FADE_IN = { duration: 120, easing: 'ease-out', keyframes: { from: { opacity: 0 }, to: { opacity: 1 } } };
// Stays mounted this long after the pointer leaves, so the fade-out can play.
const _TOOLTIP_LINGER_MS = 220;

/**
 * `data` is `{ anchorX, top, title, rows }` while a point is active, else null.
 * With `motion` (default) the card is one persistent node that moves between
 * points and fades; without it, it mounts and unmounts at each point as before.
 * Unmounted whenever idle, so assistive tech never sees a duplicate of the
 * point announcements.
 */
function _Tooltip({ T, chartW, data, motion = true }) {
  const last = useRef(null);
  if (data) last.current = data;
  const [mounted, setMounted] = useState(!!data);
  const active = !!data;
  useEffect(() => {
    if (active) { setMounted(true); return undefined; }
    const h = setTimeout(() => setMounted(false), _TOOLTIP_LINGER_MS);
    return () => clearTimeout(h);
  }, [active]);

  // While fading out there is no data: show the last card.
  const d = data || last.current;
  if (!d || (!data && (!motion || !mounted))) return null;
  const { anchorX, top, title, rows } = d;

  const W = Math.max(
    120,
    _textW(title, 11) + 24,
    ...rows.map((r) => 28 + _textW(r.name, 12) + 16 + _textW(r.value, 12, true) + 12),
  );
  const left = Math.max(0, anchorX + 14 + W > chartW ? anchorX - 14 - W : anchorX + 14);
  const card = {
    backgroundColor: T.tooltipBg, borderRadius: 8,
    borderWidth: 1, borderColor: T.tooltipBorder,
    paddingHorizontal: 10, paddingVertical: 8,
    boxShadow: '0 6 0 #00000030',
  };
  // Rounded: the transform parser reads plain decimals, not exponents (1e-7).
  const r1 = (v) => Math.round(v * 10) / 10;
  return React.createElement(
    View,
    {
      style: motion
        ? { ...card, position: 'absolute', left: 0, top: 0, width: W,
            transform: `translate(${r1(left)}px, ${r1(top)}px)`, opacity: data ? 1 : 0 }
        : { ...card, position: 'absolute', left, top, width: W },
      pointerEvents: 'none',
      ...(motion ? { transition: _TOOLTIP_GLIDE, animation: _TOOLTIP_FADE_IN } : null),
    },
    React.createElement(Text, { fontSize: 11, style: { color: T.label, marginBottom: 4 } }, String(title)),
    ...rows.map((r, i) => React.createElement(
      View,
      { key: i, style: { flexDirection: 'row', alignItems: 'center', height: 18 } },
      React.createElement(View, { style: { width: 8, height: 8, borderRadius: 4, backgroundColor: r.color, marginRight: 8 } }),
      React.createElement(Text, { fontSize: 12, style: { color: T.label, flex: 1 } }, String(r.name)),
      React.createElement(Text, { fontSize: 12, style: { color: T.text, fontWeight: '600' } }, String(r.value)),
    )),
  );
}

// ── Interaction overlay (pointer + keyboard + screen reader) ────────────────

/**
 * One Pressable over the whole chart. `pick(locationX, locationY)` maps a
 * pointer position to an index (or null); arrow keys step through `count`
 * items. `describe(i)` is the spoken text for item i, `summary` for the chart.
 */
function _Interaction({
  width, height, T, count, pick, active, setActive, onActivate,
  summary, describe, roleDescription, hint,
}) {
  const [kb, setKb] = useState(false); // keyboard/AT driving (announce points)
  const move = (i) => { setKb(true); setActive(Math.max(0, Math.min(count - 1, i))); };
  const onKeyDown = (e) => {
    if (count === 0) return;
    const cur = active == null ? -1 : active;
    switch (e.key) {
      case 'ArrowRight': case 'ArrowDown': move(cur + 1); break;
      case 'ArrowLeft':  case 'ArrowUp':   move(cur < 0 ? count - 1 : cur - 1); break;
      case 'Home': move(0); break;
      case 'End':  move(count - 1); break;
      // Handled here (the active point), so Pressable's own Enter/Space
      // press doesn't fire onActivate a second time.
      case 'Enter': case 'NumpadEnter': case ' ': case 'Space':
        e.preventDefault?.();
        if (active != null) onActivate?.(active);
        break;
      case 'Escape': setKb(false); setActive(null); break;
      default: break;
    }
  };
  const label = kb && active != null ? describe(active) : summary;
  return React.createElement(Pressable, {
    feedback: false,
    role: 'figure',
    focusable: true,
    ariaLabel: label,
    accessibilityRoleDescription: roleDescription,
    accessibilityHint: hint,
    accessibilityLiveRegion: 'polite',
    onPointerMove: (e) => { setKb(false); const i = pick(e.locationX, e.locationY); if (i !== active) setActive(i); },
    onHoverOut: () => { if (!kb) setActive(null); },
    onPress: () => { if (active != null) onActivate?.(active); },
    onKeyDown,
    style: ({ focused }) => ({
      position: 'absolute', left: 0, top: 0, width, height, borderRadius: 8,
      ...(focused ? { borderWidth: 2, borderColor: T.focusRing } : null),
    }),
  });
}

// ── Legend ──────────────────────────────────────────────────────────────────

/**
 * One swatch + label per item, wrapping. `items`: [{ label, color, value? }].
 * `onToggle(index, item)` makes items pressable (e.g. to hide a series);
 * `disabled` lists the indexes shown as off.
 */
export function Legend({ items, onToggle, disabled = [], theme, style }) {
  if (!items || items.length === 0) return null;
  const T = _theme(theme);
  return React.createElement(
    View,
    { style: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 16, ...style } },
    ...items.map((item, i) => {
      const off = disabled.includes(i);
      const row = React.createElement(
        View,
        { style: { flexDirection: 'row', alignItems: 'center', gap: 7 } },
        React.createElement(View, {
          style: {
            width: 10, height: 10, borderRadius: 3,
            backgroundColor: off ? T.muted : (item.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]),
          },
        }),
        React.createElement(Text, { fontSize: 12, style: { color: off ? T.muted : T.label } }, String(item.label)),
        item.value != null
          ? React.createElement(Text, { fontSize: 12, style: { color: off ? T.muted : T.text, fontWeight: '600' } }, String(item.value))
          : null,
      );
      if (!onToggle) return React.createElement(View, { key: i }, row);
      return React.createElement(Pressable, {
        key: i, feedback: false, onPress: () => onToggle(i, item),
        role: 'switch', checked: !off, ariaLabel: `${item.label}${off ? ', hidden' : ''}`,
      }, row);
    }),
  );
}

// ── Zoom / pan (Line & Area) ────────────────────────────────────────────────

/**
 * New `[start, count]` window after zooming by `ratio` (< 1 zooms in) about the
 * point `frac` (0–1) across the visible span: the data point under the pointer
 * stays under the pointer. Always changes by at least one point, never past
 * `[minVisible, n]`.
 */
function _zoomWindow(start, count, n, minVisible, ratio, frac) {
  let next = Math.round(count * ratio);
  if (next === count) next = count + (ratio < 1 ? -1 : 1);
  next = Math.max(Math.min(minVisible, n), Math.min(n, next));
  const anchor = start + frac * Math.max(0, count - 1);
  const s = Math.round(anchor - frac * Math.max(0, next - 1));
  return { start: Math.min(Math.max(0, n - next), Math.max(0, s)), count: next };
}

// One wheel notch (40px, see the shell) zooms by this much; a trackpad pinch
// arrives as many small ctrl+wheel events and scales the same way.
const _WHEEL_ZOOM_PER_NOTCH = 0.85;

function _useZoomPan(dataLength, { minVisible = 4, trackWidth } = {}) {
  const [start, setStart] = useState(0);
  const [count, setCount] = useState(dataLength);
  const dragAnchor = useRef(0);
  // Where the plot sits inside the chart (set by the chart once it has a layout).
  const plot = useRef({ left: 0, width: Math.max(1, trackWidth || 1) });

  useEffect(() => {
    setCount((c) => Math.min(dataLength, Math.max(minVisible, c)));
    setStart((s) => Math.min(Math.max(0, dataLength - count), Math.max(0, s)));
  }, [dataLength]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomIn  = useCallback(() => setCount((c) => Math.max(minVisible, Math.round(c * 0.7))), [minVisible]);
  const zoomOut = useCallback(() => setCount((c) => Math.min(dataLength, Math.round(c / 0.7))), [dataLength]);
  const reset   = useCallback(() => { setCount(dataLength); setStart(0); }, [dataLength]);

  const stateRef = useRef({ start, count, dataLength, trackWidth });
  stateRef.current = { start, count, dataLength, trackWidth };
  const dragMount = useDraggable({
    onDragStart: () => { dragAnchor.current = stateRef.current.start; },
    onDragMove: ({ dx }) => {
      const { count: c, dataLength: n, trackWidth: tw } = stateRef.current;
      const shift = Math.round(-dx * (c / Math.max(1, tw)));
      setStart(Math.min(Math.max(0, n - c), Math.max(0, dragAnchor.current + shift)));
    },
  });

  // Ctrl + wheel (or a trackpad pinch) zooms about the pointer. A plain wheel
  // is left alone so a chart inside a ScrollView doesn't trap the page's scrolling.
  const wheelMount = useWheel(({ deltaY, ctrl, x }) => {
    if (!ctrl || !deltaY) return false;
    const { start: s0, count: c0, dataLength: n } = stateRef.current;
    const exp = Math.max(-3, Math.min(3, -deltaY / 40));
    const frac = Math.min(1, Math.max(0, (x - plot.current.left) / Math.max(1, plot.current.width)));
    const w = _zoomWindow(s0, c0, n, minVisible, Math.pow(_WHEEL_ZOOM_PER_NOTCH, exp), frac);
    // Read again by the next event of this frame, before React re-renders.
    stateRef.current = { ...stateRef.current, ...w };
    setCount(w.count); setStart(w.start);
    return true;
  });
  const onMount = useCallback((id) => { dragMount(id); wheelMount(id); }, [dragMount, wheelMount]);

  const maxStart = Math.max(0, dataLength - count);
  return { start: Math.min(start, maxStart), count, zoomIn, zoomOut, reset, onMount, plot };
}

function _ZoomControls({ T, onZoomIn, onZoomOut, onReset }) {
  const btn = (label, a11y, onPress) => React.createElement(Pressable, {
    key: label, feedback: true, onPress, ariaLabel: a11y, role: 'button',
    style: {
      width: 24, height: 24, borderRadius: 6, backgroundColor: T.control,
      alignItems: 'center', justifyContent: 'center',
    },
  }, React.createElement(Text, { fontSize: 13, style: { color: T.label } }, label));
  return React.createElement(
    View,
    { style: { position: 'absolute', right: 6, top: 2, flexDirection: 'row', gap: 4 } },
    btn('+', 'Zoom in', onZoomIn), btn('−', 'Zoom out', onZoomOut), btn('⟲', 'Reset zoom', onReset),
  );
}

// ── Line & Area ─────────────────────────────────────────────────────────────

function _cartesianLayout({ width, height, scale, showLabels, xCount, topPad = 14, band = false }) {
  const yLabelW = showLabels ? Math.max(...scale.ticks.map((v) => _textW(_fmtTick(v, scale.step), 11))) : 0;
  const PAD = {
    top: topPad,
    right: 12,
    bottom: showLabels ? 30 : 8,
    left: showLabels ? Math.ceil(yLabelW) + 18 : 8,
  };
  const W = Math.max(1, width - PAD.left - PAD.right);
  const H = Math.max(1, height - PAD.top - PAD.bottom);
  const toY = (v) => PAD.top + H - ((v - scale.lo) / (scale.hi - scale.lo || 1)) * H;
  const slot = xCount > 0 ? W / xCount : W;
  const toX = band
    ? (i) => PAD.left + slot * i + slot / 2
    : (i) => PAD.left + (xCount <= 1 ? W / 2 : (i / (xCount - 1)) * W);
  return { PAD, W, H, width, height, scale, toX, toY, slot };
}

function _lineChart(kind, props) {
  const {
    width = 480, height = 260, lineWidth = 2.5, showGrid = true, showLabels = true,
    showDots, showTooltip = true, tooltipMotion = true, animate = true, onPointPress, zoomPan = false, smooth = true, stacked = false,
    theme, palette, title, showLegend, formatValue = _fmt, formatLabel = (x) => String(x),
  } = props;
  const T = _theme(theme);
  const area = kind === 'area';
  const allSeries = _normSeries({ ...props, palette });
  const full = allSeries[0].data;
  const zp = _useZoomPan(full.length, { trackWidth: width - 60 });
  const lo = zoomPan ? zp.start : 0;
  const hi = zoomPan ? zp.start + zp.count : full.length;
  const series = allSeries.map((s) => ({ ...s, data: s.data.slice(lo, hi) }));
  const n = series[0].data.length;
  const [active, setActive] = useState(null);
  const activeIdx = active != null && active < n ? active : null;
  // Stacked areas pile up: series k spans from the sum of the series before it
  // (`lower[k][i]`) to its own running total (`upper[k][i]`).
  const stack = stacked && area && series.length > 1;
  const upper = stack ? _cumulative(series) : null;
  const lower = stack ? upper.map((_, k) => (k === 0 ? series[0].data.map(() => 0) : upper[k - 1])) : null;

  const legend = (showLegend ?? series.length > 1) && series.length > 0;
  const chartH = legend ? height - 26 : height;

  const layout = useMemo(() => {
    const ys = (stack ? upper.flat() : series.flatMap((s) => s.data.map((d) => d.y))).filter(Number.isFinite);
    const scale = _niceScale(Math.min(...ys), Math.max(...ys), { zero: area });
    return _cartesianLayout({ width, height: chartH, scale, showLabels, xCount: n, topPad: zoomPan ? 30 : 14 });
  }, [series, width, chartH, showLabels, n, area, zoomPan, stack]); // eslint-disable-line react-hooks/exhaustive-deps

  zp.plot.current = { left: layout.PAD.left, width: layout.W };
  const dots = showDots ?? n <= 14;
  const draw = (ctx) => {
    if (n === 0) return;
    const L = layout;
    const { PAD, W, H, toX, toY } = L;
    _drawYAxis(ctx, L, T, { showGrid, showLabels });

    ctx.pushClip(PAD.left - lineWidth * 2, PAD.top - lineWidth * 3, W + lineWidth * 4, H + lineWidth * 3 + 1);
    const baseY = toY(Math.max(layout.scale.lo, Math.min(0, layout.scale.hi)));
    series.forEach((s, k) => {
      const pts = s.data.map((d, i) => [toX(i), toY(stack ? upper[k][i] : d.y)]);
      if (stack) {
        const low = s.data.map((_, i) => [toX(i), toY(lower[k][i])]).reverse();
        ctx.fillStyle = _rgba(s.color, 0.55);
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        if (smooth) _smoothPath(ctx, pts, false); else _polyline(ctx, pts, false);
        ctx.lineTo(low[0][0], low[0][1]);
        if (smooth) _smoothPath(ctx, low, false); else _polyline(ctx, low, false);
        ctx.closePath();
        ctx.fill();
      } else if (area) {
        const minY = Math.min(...pts.map((p) => p[1]));
        const g = ctx.createLinearGradient(0, minY, 0, baseY);
        g.addColorStop(0, _rgba(s.color, series.length > 1 ? 0.22 : 0.32));
        g.addColorStop(1, _rgba(s.color, 0.01));
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], baseY);
        if (smooth) _smoothPath(ctx, pts, false); else _polyline(ctx, pts, false);
        ctx.lineTo(pts[pts.length - 1][0], baseY);
        ctx.closePath();
        ctx.fill();
      }
      ctx.beginPath();
      if (smooth) _smoothPath(ctx, pts); else _polyline(ctx, pts);
      ctx.strokeStyle = s.color;
      ctx.lineWidth = lineWidth;
      ctx.stroke();
      if (dots) {
        pts.forEach(([x, y]) => {
          ctx.fillStyle = T.surface; ctx.fillCircle(x, y, lineWidth + 2);
          ctx.fillStyle = s.color;   ctx.fillCircle(x, y, lineWidth + 0.5);
        });
      }
    });
    ctx.popClip();

    if (showGrid) {
      ctx.strokeStyle = T.baseline; ctx.lineWidth = 1;
      const y = Math.round(PAD.top + H) + 0.5;
      ctx.strokeLine(PAD.left, y, PAD.left + W, y);
    }

    if (activeIdx != null) {
      const x = toX(activeIdx);
      ctx.strokeStyle = T.crosshair; ctx.lineWidth = 1;
      _dashedVLine(ctx, Math.round(x) + 0.5, PAD.top, PAD.top + H);
      series.forEach((s) => {
        const d = s.data[activeIdx];
        if (!d) return;
        const y = toY(stack ? upper[series.indexOf(s)][activeIdx] : d.y);
        ctx.fillStyle = _rgba(s.color, 0.22); ctx.fillCircle(x, y, lineWidth + 7);
        ctx.fillStyle = T.surface;            ctx.fillCircle(x, y, lineWidth + 3.5);
        ctx.fillStyle = s.color;              ctx.fillCircle(x, y, lineWidth + 1.5);
      });
    }

    if (showLabels) {
      _drawXLabels(ctx, series[0].data.map((d) => formatLabel(d.x)), series[0].data.map((_, i) => toX(i)), L, T);
    }
  };

  const pick = (lx) => {
    if (n === 0) return null;
    const { PAD, W } = layout;
    if (lx < PAD.left - 12 || lx > PAD.left + W + 12) return null;
    const t = n <= 1 ? 0 : (lx - PAD.left) / W * (n - 1);
    return Math.max(0, Math.min(n - 1, Math.round(t)));
  };

  const kindName = stack ? 'stacked area chart' : area ? 'area chart' : 'line chart';
  const summary = _cartesianSummary({ title, kindName, series, formatValue, formatLabel });
  const describe = (i) => {
    const x = formatLabel(series[0].data[i]?.x);
    const parts = series.map((s) => `${series.length > 1 ? s.name + ' ' : ''}${formatValue(s.data[i]?.y)}`);
    if (stack) parts.push(`total ${formatValue(upper[upper.length - 1][i])}`);
    return `${x}: ${parts.join(', ')}. ${i + 1} of ${n}.`;
  };

  const tooltip = showTooltip
    ? React.createElement(_Tooltip, {
        T, chartW: width, motion: tooltipMotion,
        data: activeIdx != null && n > 0 ? {
          anchorX: layout.toX(activeIdx), top: layout.PAD.top,
          title: formatLabel(series[0].data[activeIdx].x),
          rows: [
            ...series.map((s) => ({ name: s.name || 'Value', color: s.color, value: formatValue(s.data[activeIdx]?.y) })),
            ...(stack ? [{ name: 'Total', color: T.label, value: formatValue(upper[upper.length - 1][activeIdx]) }] : []),
          ],
        } : null,
      })
    : null;

  const body = React.createElement(
    View,
    { style: { width, height: chartH, position: 'relative' }, _glyxOnMount: zoomPan ? zp.onMount : undefined },
    React.createElement(_ChartCanvas, {
      width, height: chartH, draw, animate,
      deps: [series, width, chartH, lineWidth, showGrid, showLabels, dots, smooth, activeIdx, stack, T],
    }),
    React.createElement(_Interaction, {
      width, height: chartH, T, count: n, pick, active: activeIdx, setActive,
      onActivate: (i) => onPointPress?.(series[0].data[i], i),
      summary, describe, roleDescription: kindName,
      hint: 'Use the arrow keys to move between data points.',
    }),
    tooltip,
    zoomPan ? React.createElement(_ZoomControls, { T, onZoomIn: zp.zoomIn, onZoomOut: zp.zoomOut, onReset: zp.reset }) : null,
  );
  return React.createElement(
    View,
    { style: { width, height }, animation: _ENTRANCE },
    body,
    legend ? React.createElement(Legend, {
      theme, items: series.map((s) => ({ label: s.name, color: s.color })),
      style: { marginTop: 8, marginLeft: layout.PAD.left },
    }) : null,
  );
}

function _cartesianSummary({ title, kindName, series, formatValue, formatLabel }) {
  const d = series[0].data;
  if (!d.length) return `${title ? title + ', ' : ''}${kindName}, no data.`;
  const parts = [`${title ? title + ', ' : ''}${kindName}`];
  parts.push(`${d.length} points from ${formatLabel(d[0].x)} to ${formatLabel(d[d.length - 1].x)}`);
  for (const s of series) {
    const ys = s.data.map((p) => p.y);
    const iMin = ys.indexOf(Math.min(...ys));
    const iMax = ys.indexOf(Math.max(...ys));
    const who = series.length > 1 ? `${s.name}: ` : '';
    parts.push(
      `${who}lowest ${formatValue(ys[iMin])} at ${formatLabel(s.data[iMin].x)}, ` +
      `highest ${formatValue(ys[iMax])} at ${formatLabel(s.data[iMax].x)}, ` +
      `latest ${formatValue(ys[ys.length - 1])}`,
    );
  }
  return parts.join('. ') + '.';
}

/**
 * Line chart. Single series via `data` (+ `color`, `name`), or several via
 * `series={[{ name, data, color }]}` sharing the same x values.
 */
function _LineChartInner(props) { return _lineChart('line', props); }

/** Area chart: a line chart with a gradient fill down to the baseline. */
function _AreaChartInner(props) { return _lineChart('area', props); }

// ── Bar ─────────────────────────────────────────────────────────────────────

/**
 * Y scale covering every bar: the tallest stack when `stacked`, else the
 * tallest single bar, always including zero.
 */
function _barScale(series, stacked) {
  const n = series[0] ? series[0].data.length : 0;
  let lo = 0, hi = 0;
  for (let i = 0; i < n; i++) {
    let pos = 0, neg = 0;
    for (const s of series) {
      const y = s.data[i] ? s.data[i].y : NaN;
      if (!Number.isFinite(y)) continue;
      if (stacked) { if (y >= 0) pos += y; else neg += y; } else { pos = Math.max(pos, y); neg = Math.min(neg, y); }
    }
    hi = Math.max(hi, pos); lo = Math.min(lo, neg);
  }
  return _niceScale(lo, hi, { zero: true });
}

/**
 * The bars of category `i` as value ranges: `{ k, v0, v1, top, bottom }` where
 * `v0`→`v1` is the bar's extent on the Y axis (grouped: from zero; stacked: from
 * where the stack below it ends) and `top`/`bottom` say whether it is the outer
 * end of its stack, which is the only place a stacked bar gets rounded corners.
 */
function _barSegments(series, i, stacked) {
  const out = [];
  let pos = 0, neg = 0;
  series.forEach((s, k) => {
    const y = s.data[i] ? s.data[i].y : NaN;
    if (!Number.isFinite(y)) return;
    if (!stacked) { out.push({ k, v0: 0, v1: y, top: y >= 0, bottom: y < 0 }); return; }
    if (y >= 0) { out.push({ k, v0: pos, v1: pos + y, top: false, bottom: false }); pos += y; }
    else { out.push({ k, v0: neg, v1: neg + y, top: false, bottom: false }); neg += y; }
  });
  if (stacked) {
    // Only the last non-empty segment in each direction is an outer end.
    const lastPos = out.filter((o) => o.v1 > o.v0).pop();
    const lastNeg = out.filter((o) => o.v1 < o.v0).pop();
    for (const o of out) { o.top = o === lastPos; o.bottom = o === lastNeg; }
  }
  return out;
}

/** Bar width and the x offset of each series' bar within a category slot. */
function _barSlots(slot, count, stacked) {
  const k = stacked ? 1 : Math.max(1, count);
  const gap = k > 1 ? 3 : 0;
  const frac = k > 1 ? 0.74 : 0.64;
  const w = Math.max(2, Math.min(44, (slot * frac - gap * (k - 1)) / k));
  const total = w * k + gap * (k - 1);
  return { w, total, offset: (j) => -total / 2 + (stacked ? 0 : j * (w + gap)) };
}

function _sumAt(series, i) {
  return series.reduce((t, s) => t + (Number.isFinite(s.data[i]?.y) ? s.data[i].y : 0), 0);
}

function _BarChartInner(props) {
  const {
    width = 480, height = 260, showGrid = true, showLabels = true, showTooltip = true, tooltipMotion = true, animate = true,
    onPointPress, theme, palette, title, name = 'Value', stacked = false, showLegend,
    formatValue = _fmt, formatLabel = (x) => String(x),
  } = props;
  const T = _theme(theme);
  const series = _normSeries({ ...props, palette, name, color: props.color || DEFAULT_PALETTE[0] });
  const multi = series.length > 1;
  const stack = stacked && multi;
  const rows = series[0].data;
  const n = rows.length;
  const [active, setActive] = useState(null);
  const activeIdx = active != null && active < n ? active : null;

  const legend = (showLegend ?? multi) && multi;
  const chartH = legend ? height - 26 : height;

  const layout = useMemo(() => {
    const scale = _barScale(series, stack);
    return _cartesianLayout({ width, height: chartH, scale, showLabels, xCount: n, band: true });
  }, [series, width, chartH, showLabels, n, stack]); // eslint-disable-line react-hooks/exhaustive-deps

  const slots = _barSlots(layout.slot, series.length, stack);
  const draw = (ctx) => {
    if (n === 0) return;
    const L = layout;
    const { toX, toY } = L;
    _drawYAxis(ctx, L, T, { showGrid, showLabels });
    const zeroY = toY(0);
    rows.forEach((_, i) => {
      const dim = activeIdx != null && i !== activeIdx;
      for (const seg of _barSegments(series, i, stack)) {
        const c = (!multi && rows[i].color) || series[seg.k].color;
        const x = toX(i) + slots.offset(seg.k);
        const yA = toY(seg.v0), yB = toY(seg.v1);
        const top = Math.min(yA, yB);
        let h = Math.abs(yA - yB);
        if (stack && h < 0.5) continue;
        h = Math.max(1, h);
        const base = activeIdx === i ? _lighten(c, 0.12) : _rgba(c, dim ? 0.45 : 1);
        const up = seg.v1 >= seg.v0;
        if (stack) {
          ctx.fillStyle = base;
        } else {
          const g = ctx.createLinearGradient(0, top, 0, top + h);
          g.addColorStop(0, up ? _lighten(base, 0.18) : base);
          g.addColorStop(1, up ? base : _lighten(base, 0.18));
          ctx.fillStyle = g;
        }
        const r = Math.min(6, slots.w / 2);
        _roundRectPath(ctx, x, top, slots.w, h, seg.top ? r : 0, seg.bottom ? r : 0);
        ctx.fill();
      }
    });
    if (showGrid) {
      ctx.strokeStyle = T.baseline; ctx.lineWidth = 1;
      const y = Math.round(zeroY) + 0.5;
      ctx.strokeLine(L.PAD.left, y, L.PAD.left + L.W, y);
    }
    if (showLabels) _drawXLabels(ctx, rows.map((d) => formatLabel(d.x)), rows.map((_, i) => toX(i)), L, T);
  };

  const pick = (lx) => {
    if (n === 0) return null;
    const { PAD, W, slot } = layout;
    if (lx < PAD.left || lx > PAD.left + W) return null;
    return Math.max(0, Math.min(n - 1, Math.floor((lx - PAD.left) / slot)));
  };

  const kindName = stack ? 'stacked bar chart' : 'bar chart';
  const summary = _cartesianSummary({ title, kindName, series, formatValue, formatLabel });
  const describe = (i) => {
    const parts = series.map((s) => `${multi ? s.name + ' ' : ''}${formatValue(s.data[i]?.y)}`);
    if (stack) parts.push(`total ${formatValue(_sumAt(series, i))}`);
    return `${formatLabel(rows[i].x)}: ${parts.join(', ')}. ${i + 1} of ${n}.`;
  };

  const tipRows = (i) => {
    const r = series.map((s) => ({
      name: s.name || name, color: (!multi && rows[i].color) || s.color, value: formatValue(s.data[i]?.y),
    }));
    if (stack) r.push({ name: 'Total', color: T.label, value: formatValue(_sumAt(series, i)) });
    return r;
  };
  const tooltip = showTooltip
    ? React.createElement(_Tooltip, {
        T, chartW: width, motion: tooltipMotion,
        data: activeIdx != null ? {
          anchorX: layout.toX(activeIdx) + slots.total / 2 - 8, top: layout.PAD.top,
          title: formatLabel(rows[activeIdx].x),
          rows: tipRows(activeIdx),
        } : null,
      })
    : null;

  return React.createElement(
    View,
    { style: { width, height }, animation: _ENTRANCE },
    React.createElement(
      View,
      { style: { width, height: chartH, position: 'relative' } },
      React.createElement(_ChartCanvas, {
        width, height: chartH, draw, animate, deps: [series, width, chartH, showGrid, showLabels, activeIdx, stack, T],
      }),
      React.createElement(_Interaction, {
        width, height: chartH, T, count: n, pick, active: activeIdx, setActive,
        onActivate: (i) => onPointPress?.(rows[i], i),
        summary, describe, roleDescription: kindName,
        hint: 'Use the arrow keys to move between bars.',
      }),
      tooltip,
    ),
    legend ? React.createElement(Legend, {
      theme, items: series.map((s) => ({ label: s.name, color: s.color })),
      style: { marginTop: 8, marginLeft: layout.PAD.left },
    }) : null,
  );
}

/**
 * Bar chart. One series via `data` (`[{ x, y, color? }]`), or several via
 * `series={[{ name, data, color }]}` sharing the same x values: side by side
 * (grouped) by default, piled up with `stacked`. `width`/`height` can be
 * `'100%'` to follow the container.
 */
export function BarChart(props) { return _fit(_BarChartInner, props); }

// ── Pie / Donut ─────────────────────────────────────────────────────────────

export function PieChart(props) { return _fit(_PieChartInner, props); }

function _PieChartInner(props) {
  const {
    data, width = 260, height = 260, palette = DEFAULT_PALETTE,
    innerRadius = 0, // > 0 → donut (fraction of the radius, 0–1)
    showTooltip = true, tooltipMotion = true, animate = true, onPointPress, showLegend = false,
    theme, title, centerLabel = 'Total', formatValue = _fmt, formatLabel = (x) => String(x),
  } = props;
  const T = _theme(theme);
  const rows = data || [];
  const n = rows.length;
  const [active, setActive] = useState(null);
  const activeIdx = active != null && active < n ? active : null;

  const legendH = showLegend && n ? 30 : 0;
  const chartH = height - legendH;
  const cx = width / 2, cy = chartH / 2;
  const r = Math.max(4, Math.min(width, chartH) / 2 - 10);
  const donut = innerRadius > 0;
  const rInner = donut ? r * Math.min(0.9, innerRadius) : 0;
  const total = rows.reduce((s, d) => s + Math.max(0, d.y), 0) || 1;
  const colorOf = (d, i) => d.color || palette[i % palette.length];
  const pct = (v) => `${Math.round((Math.max(0, v) / total) * 100)}%`;

  const angles = useMemo(() => {
    let a = -Math.PI / 2;
    return rows.map((d) => { const a0 = a; a += (Math.max(0, d.y) / total) * Math.PI * 2; return [a0, a]; });
  }, [rows, total]);

  // A fixed number of segments per arc, however wide: a slice that grows or
  // shrinks keeps the same points, so the pie can ease between two draws.
  const wedge = (ctx, a0, a1, rOut, rIn, ox = 0, oy = 0) => {
    ctx.beginPath();
    if (rIn > 0) {
      ctx.moveTo(cx + ox + rIn * Math.cos(a0), cy + oy + rIn * Math.sin(a0));
      ctx.lineTo(cx + ox + rOut * Math.cos(a0), cy + oy + rOut * Math.sin(a0));
      ctx.arc(cx + ox, cy + oy, rOut, a0, a1, false, _ARC_SEGMENTS);
      ctx.lineTo(cx + ox + rIn * Math.cos(a1), cy + oy + rIn * Math.sin(a1));
      ctx.arc(cx + ox, cy + oy, rIn, a1, a0, true, _ARC_SEGMENTS);
    } else {
      ctx.moveTo(cx + ox, cy + oy);
      ctx.arc(cx + ox, cy + oy, rOut, a0, a1, false, _ARC_SEGMENTS);
    }
    ctx.closePath();
  };

  const draw = (ctx) => {
    if (n === 0) return;
    // Gap between segments: trim each end by a fixed arc length (constant
    // visual width at the outer edge), only when the segment can afford it.
    const gapPx = n > 1 ? 2 : 0;
    rows.forEach((d, i) => {
      const [a0, a1] = angles[i];
      if (a1 - a0 <= 0) return;
      const trim = Math.min((a1 - a0) * 0.25, gapPx / r);
      const hot = activeIdx === i;
      const mid = (a0 + a1) / 2, pop = hot ? 5 : 0;
      const c = colorOf(d, i);
      ctx.fillStyle = hot ? _lighten(c, 0.1) : _rgba(c, activeIdx != null ? 0.55 : 1);
      wedge(ctx, a0 + trim, a1 - trim, r + (hot ? 2 : 0), rInner, Math.cos(mid) * pop, Math.sin(mid) * pop);
      ctx.fill();
    });
    if (donut) {
      // Centre: the hovered segment, or the total.
      const d = activeIdx != null ? rows[activeIdx] : null;
      const big = d ? formatValue(d.y) : formatValue(rows.reduce((s, x) => s + x.y, 0));
      const small = d ? `${formatLabel(d.x)} · ${pct(d.y)}` : centerLabel;
      const bigSize = Math.max(12, Math.min(26, rInner * 0.42));
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fontWeight = 'bold';
      ctx.fillStyle = T.text;
      ctx.fillText(big, cx, cy + 3, bigSize);
      ctx.fontWeight = 'normal';
      ctx.textBaseline = 'top';
      ctx.fillStyle = T.label;
      ctx.fillText(small, cx, cy + 5, 11);
      ctx.textAlign = 'left';
    }
  };

  const pick = (lx, ly) => {
    const dx = lx - cx, dy = ly - cy;
    const dist = Math.hypot(dx, dy);
    if (dist > r + 8 || dist < rInner - 4) return null;
    let a = Math.atan2(dy, dx);
    if (a < -Math.PI / 2) a += Math.PI * 2;
    const i = angles.findIndex(([a0, a1]) => a >= a0 && a < a1);
    return i < 0 ? null : i;
  };

  const summary = (() => {
    const head = `${title ? title + ', ' : ''}${donut ? 'donut' : 'pie'} chart, ${n} segments`;
    const parts = rows.map((d) => `${formatLabel(d.x)} ${formatValue(d.y)} (${pct(d.y)})`);
    return `${head}. ${parts.join(', ')}.`;
  })();
  const describe = (i) => `${formatLabel(rows[i].x)}: ${formatValue(rows[i].y)}, ${pct(rows[i].y)}. ${i + 1} of ${n}.`;

  // A donut shows the hovered segment in its centre; a full pie needs a card.
  let tooltip = null;
  if (showTooltip && !donut) {
    let data = null;
    if (activeIdx != null) {
      const [a0, a1] = angles[activeIdx];
      const mid = (a0 + a1) / 2;
      data = {
        anchorX: cx + Math.cos(mid) * r * 0.6, top: Math.max(0, cy + Math.sin(mid) * r * 0.6 - 30),
        title: formatLabel(rows[activeIdx].x),
        rows: [{ name: pct(rows[activeIdx].y), color: colorOf(rows[activeIdx], activeIdx), value: formatValue(rows[activeIdx].y) }],
      };
    }
    tooltip = React.createElement(_Tooltip, { T, chartW: width, motion: tooltipMotion, data });
  }

  const chart = React.createElement(
    View,
    { style: { width, height: chartH, position: 'relative' } },
    React.createElement(_ChartCanvas, {
      width, height: chartH, draw, animate, deps: [rows, width, chartH, innerRadius, palette, activeIdx, T, centerLabel],
    }),
    React.createElement(_Interaction, {
      width, height: chartH, T, count: n, pick, active: activeIdx, setActive,
      onActivate: (i) => onPointPress?.(rows[i], i),
      summary, describe, roleDescription: donut ? 'donut chart' : 'pie chart',
      hint: 'Use the arrow keys to move between segments.',
    }),
    tooltip,
  );
  return React.createElement(
    View,
    { style: { width, height }, animation: _ENTRANCE },
    chart,
    showLegend && n ? React.createElement(Legend, {
      theme,
      items: rows.map((d, i) => ({ label: formatLabel(d.x), color: colorOf(d, i), value: pct(d.y) })),
      style: { marginTop: 8, justifyContent: 'center' },
    }) : null,
  );
}

// ── Realtime ────────────────────────────────────────────────────────────────

/**
 * A fixed-length window over a stream of points. Pushing is cheap and can
 * happen as often as data arrives; the window is handed on at most once per
 * `intervalMs`, however many points came in, so a feed of hundreds of messages
 * a second costs the UI a bounded number of renders. Pure: the scheduler is
 * injectable so it can be tested without real timers.
 */
class _ChartStream {
  constructor({ capacity, intervalMs, onFlush, schedule = setTimeout, cancel = clearTimeout }) {
    this.cap = Math.max(1, Math.floor(capacity));
    this.intervalMs = intervalMs;
    this.onFlush = onFlush;
    this.schedule = schedule;
    this.cancel = cancel;
    this.buf = new Array(this.cap);
    this.head = 0; // index of the oldest point
    this.n = 0;
    this.timer = null;
    this.disposed = false;
  }

  /** Append one point or an array of them; the oldest fall off once full. */
  push(points) {
    if (this.disposed) return;
    if (Array.isArray(points)) for (const p of points) this._add(p);
    else this._add(points);
    if (this.timer === null) {
      this.timer = this.schedule(() => { this.timer = null; if (!this.disposed) this.onFlush(this.toArray()); }, this.intervalMs);
    }
  }

  _add(p) {
    if (this.n < this.cap) { this.buf[(this.head + this.n) % this.cap] = p; this.n++; }
    else { this.buf[this.head] = p; this.head = (this.head + 1) % this.cap; }
  }

  /** The window, oldest first. */
  toArray() {
    const out = new Array(this.n);
    for (let i = 0; i < this.n; i++) out[i] = this.buf[(this.head + i) % this.cap];
    return out;
  }

  clear() {
    this.head = 0; this.n = 0;
    if (this.timer !== null) { this.cancel(this.timer); this.timer = null; }
    if (!this.disposed) this.onFlush([]);
  }

  dispose() {
    this.disposed = true;
    if (this.timer !== null) { this.cancel(this.timer); this.timer = null; }
  }
}

/**
 * Feed a live chart. Returns `{ data, push, clear }`: pass `data` to a chart
 * and call `push({ x, y })` (or an array) whenever a value arrives.
 *
 *   const { data, push } = useChartStream({ capacity: 120 });
 *   useEffect(() => feed.subscribe((v) => push({ x: clock(v.t), y: v.value })), []);
 *   return <LineChart data={data} width={600} height={240} />;
 *
 * `data` is a window of the latest `capacity` points. Once it is full, each new
 * point drops the oldest, so the chart keeps the same number of points and its
 * native transition can ease from one update to the next. Points are matched by
 * position, so the line morphs between the two windows rather than translating;
 * on a fast stream it glides over each gap between updates, so it never trails
 * the data. Updates reach React at most `maxHz` times a second however fast
 * `push` is called. `initial` seeds the window.
 */
export function useChartStream({ capacity = 120, maxHz = 30, initial } = {}) {
  const [data, setData] = useState(() => (initial ? initial.slice(-capacity) : []));
  const latest = useRef(data);
  latest.current = data;
  const streamRef = useRef(null);

  const intervalMs = Math.max(1, Math.round(1000 / Math.max(1, maxHz)));
  // A new stream when the window size or rate changes, carrying the points over.
  const stream = useMemo(() => {
    streamRef.current?.dispose();
    const s = new _ChartStream({ capacity, intervalMs, onFlush: (pts) => { latest.current = pts; setData(pts); } });
    for (const p of latest.current.slice(-capacity)) s._add(p);
    return s;
  }, [capacity, intervalMs]);
  streamRef.current = stream;
  useEffect(() => () => stream.dispose(), [stream]);

  // Stable identities: callers put `push` in effect dependency lists.
  const push  = useCallback((points) => streamRef.current.push(points), []);
  const clear = useCallback(() => streamRef.current.clear(), []);
  return { data, push, clear };
}

export { DEFAULT_PALETTE, THEMES };

// Internals exported for unit tests only.
// ── Sparkline ───────────────────────────────────────────────────────────────

/** `[1, 2, 3]` or `[{ y }]` → finite numbers. */
function _sparkValues(data) {
  return (data || []).map((d) => (typeof d === 'number' ? d : d && d.y)).filter(Number.isFinite);
}

/** Point positions for a sparkline: x spread evenly, y fitted to the box with `pad` around it. */
function _sparkPoints(ys, width, height, pad = 3) {
  const n = ys.length;
  const lo = Math.min(...ys), hi = Math.max(...ys);
  const span = hi - lo;
  const w = width - 2 * pad, h = height - 2 * pad;
  return ys.map((v, i) => [
    pad + (n <= 1 ? w / 2 : (i / (n - 1)) * w),
    span === 0 ? height / 2 : height - pad - ((v - lo) / span) * h,
  ]);
}

function _SparklineInner(props) {
  const {
    data, width = 120, height = 32, color, lineWidth = 1.5, fill = true, smooth = true, showLast = true,
    animate = true, theme, title, formatValue = _fmt,
  } = props;
  const T = _theme(theme);
  const c = color || DEFAULT_PALETTE[0];
  const ys = _sparkValues(data);
  const n = ys.length;
  const draw = (ctx) => {
    if (n === 0) return;
    const pts = _sparkPoints(ys, width, height);
    if (fill && n > 1) {
      const g = ctx.createLinearGradient(0, 0, 0, height);
      g.addColorStop(0, _rgba(c, 0.28));
      g.addColorStop(1, _rgba(c, 0.01));
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(pts[0][0], height);
      if (smooth) _smoothPath(ctx, pts, false); else _polyline(ctx, pts, false);
      ctx.lineTo(pts[n - 1][0], height);
      ctx.closePath();
      ctx.fill();
    }
    if (n > 1) {
      ctx.beginPath();
      if (smooth) _smoothPath(ctx, pts); else _polyline(ctx, pts);
      ctx.strokeStyle = c; ctx.lineWidth = lineWidth;
      ctx.stroke();
    }
    if (showLast) {
      const [x, y] = pts[n - 1];
      ctx.fillStyle = T.surface; ctx.fillCircle(x, y, lineWidth + 2);
      ctx.fillStyle = c;         ctx.fillCircle(x, y, lineWidth + 0.5);
    }
  };
  const label = n === 0
    ? `${title ? title + ', ' : ''}sparkline, no data.`
    : `${title ? title + ', ' : ''}sparkline, ${n} values, from ${formatValue(ys[0])} to ${formatValue(ys[n - 1])}, ` +
      `low ${formatValue(Math.min(...ys))}, high ${formatValue(Math.max(...ys))}.`;
  return React.createElement(
    View,
    { style: { width, height, position: 'relative' }, role: 'img', ariaLabel: label },
    React.createElement(_ChartCanvas, { width, height, draw, animate, deps: [ys.join(','), width, height, c, lineWidth, fill, smooth, showLast, T] }),
  );
}

/**
 * Sparkline: a small line with no axes, labels or hover, to sit next to a
 * number or inside a table row. `data` is numbers or `{ y }` objects.
 */
export function Sparkline(props) { return _fit(_SparklineInner, props); }

// ── Scatter / bubble ────────────────────────────────────────────────────────

/** Every point of every series as one list, in a fixed order: `{ s, i, x, y, size, color }`. */
function _scatterPoints(series) {
  const out = [];
  series.forEach((s, k) => s.data.forEach((d, i) => {
    if (Number.isFinite(d.x) && Number.isFinite(d.y)) out.push({ s: k, i, x: d.x, y: d.y, size: d.size, color: d.color || s.color });
  }));
  return out;
}

/** Radius of a point: `radius` for plain dots, or √-scaled between 3 and 16 by `size` for bubbles. */
function _bubbleRadius(size, maxSize, radius) {
  if (!Number.isFinite(size) || !(maxSize > 0)) return radius;
  return 3 + Math.sqrt(Math.max(0, size) / maxSize) * 13;
}

/** The point nearest (px, py) within `reach` pixels, or null. Ties go to the earlier point. */
function _nearestPoint(pos, px, py, reach) {
  let best = null, bestD = reach * reach;
  for (let j = 0; j < pos.length; j++) {
    const dx = pos[j][0] - px, dy = pos[j][1] - py, d = dx * dx + dy * dy;
    if (d <= bestD) { best = j; bestD = d; }
  }
  return best;
}

function _ScatterChartInner(props) {
  const {
    width = 480, height = 260, radius = 4, showGrid = true, showLabels = true, showTooltip = true, tooltipMotion = true,
    animate = true, onPointPress, theme, palette, title, showLegend,
    formatValue = _fmt, formatX = _fmt,
  } = props;
  const T = _theme(theme);
  const series = _normSeries({ ...props, palette });
  const pts = _scatterPoints(series);
  const n = pts.length;
  const [active, setActive] = useState(null);
  const activeIdx = active != null && active < n ? active : null;

  const legend = (showLegend ?? series.length > 1) && series.length > 0;
  const chartH = legend ? height - 26 : height;
  const maxSize = Math.max(0, ...pts.map((p) => (Number.isFinite(p.size) ? p.size : 0)));

  const layout = useMemo(() => {
    const ys = pts.map((p) => p.y), xs = pts.map((p) => p.x);
    const yScale = _niceScale(Math.min(...ys), Math.max(...ys));
    const xScale = _niceScale(Math.min(...xs), Math.max(...xs));
    const L = _cartesianLayout({ width, height: chartH, scale: yScale, showLabels, xCount: 1 });
    const spanX = xScale.hi - xScale.lo || 1;
    const toXv = (v) => L.PAD.left + ((v - xScale.lo) / spanX) * L.W;
    return { ...L, xScale, toXv };
  }, [pts, width, chartH, showLabels]); // eslint-disable-line react-hooks/exhaustive-deps

  const pos = pts.map((p) => [layout.toXv(p.x), layout.toY(p.y)]);
  const draw = (ctx) => {
    if (n === 0) return;
    const L = layout;
    const { PAD, W, H, xScale } = L;
    _drawYAxis(ctx, L, T, { showGrid, showLabels });
    // X axis: ticks, optional vertical grid, labels.
    ctx.lineWidth = 1;
    for (const v of xScale.ticks) {
      const x = Math.round(L.toXv(v)) + 0.5;
      if (showGrid) { ctx.strokeStyle = T.grid; ctx.strokeLine(x, PAD.top, x, PAD.top + H); }
      if (showLabels) {
        const label = formatX(v);
        ctx.fillStyle = T.label; ctx.textBaseline = 'top';
        ctx.fillText(label, Math.min(L.width - 2 - _textW(label, 11), Math.max(2, x - _textW(label, 11) / 2)), PAD.top + H + 9, 11);
      }
    }
    if (showGrid) {
      ctx.strokeStyle = T.baseline;
      const y = Math.round(PAD.top + H) + 0.5;
      ctx.strokeLine(PAD.left, y, PAD.left + W, y);
    }
    ctx.pushClip(PAD.left - 8, PAD.top - 8, W + 16, H + 16);
    pts.forEach((p, j) => {
      const r = _bubbleRadius(p.size, maxSize, radius);
      const hot = j === activeIdx;
      const dim = activeIdx != null && !hot;
      ctx.fillStyle = _rgba(p.color, hot ? 0.95 : dim ? 0.3 : maxSize > 0 ? 0.55 : 0.8);
      ctx.fillCircle(pos[j][0], pos[j][1], hot ? r + 1.5 : r);
      if (maxSize > 0 || hot) { ctx.strokeStyle = p.color; ctx.lineWidth = 1.5; ctx.strokeCircle(pos[j][0], pos[j][1], hot ? r + 1.5 : r); }
    });
    ctx.popClip();
    ctx.textBaseline = 'top';
  };

  const pick = (lx, ly) => _nearestPoint(pos, lx, ly, Math.max(16, radius * 3));
  const kindName = maxSize > 0 ? 'bubble chart' : 'scatter chart';
  const xs = pts.map((p) => p.x), ysAll = pts.map((p) => p.y);
  const summary = n === 0
    ? `${title ? title + ', ' : ''}${kindName}, no data.`
    : `${title ? title + ', ' : ''}${kindName}, ${n} points, x from ${formatX(Math.min(...xs))} to ${formatX(Math.max(...xs))}, ` +
      `y from ${formatValue(Math.min(...ysAll))} to ${formatValue(Math.max(...ysAll))}.`;
  const describe = (j) => {
    const p = pts[j];
    const who = series.length > 1 ? `${series[p.s].name}: ` : '';
    return `${who}x ${formatX(p.x)}, y ${formatValue(p.y)}${Number.isFinite(p.size) ? `, size ${formatValue(p.size)}` : ''}. ${j + 1} of ${n}.`;
  };

  const hot = activeIdx != null ? pts[activeIdx] : null;
  const tooltip = showTooltip
    ? React.createElement(_Tooltip, {
        T, chartW: width, motion: tooltipMotion,
        data: hot ? {
          anchorX: pos[activeIdx][0], top: Math.max(layout.PAD.top, pos[activeIdx][1] - 34),
          title: series.length > 1 ? series[hot.s].name || 'Series' : 'Point',
          rows: [
            { name: 'x', color: hot.color, value: formatX(hot.x) },
            { name: 'y', color: hot.color, value: formatValue(hot.y) },
            ...(Number.isFinite(hot.size) ? [{ name: 'size', color: hot.color, value: formatValue(hot.size) }] : []),
          ],
        } : null,
      })
    : null;

  return React.createElement(
    View,
    { style: { width, height }, animation: _ENTRANCE },
    React.createElement(
      View,
      { style: { width, height: chartH, position: 'relative' } },
      React.createElement(_ChartCanvas, {
        width, height: chartH, draw, animate, deps: [pts, width, chartH, radius, showGrid, showLabels, activeIdx, T],
      }),
      React.createElement(_Interaction, {
        width, height: chartH, T, count: n, pick, active: activeIdx, setActive,
        onActivate: (j) => onPointPress?.(series[pts[j].s].data[pts[j].i], j),
        summary, describe, roleDescription: kindName,
        hint: 'Use the arrow keys to move between points.',
      }),
      tooltip,
    ),
    legend ? React.createElement(Legend, {
      theme, items: series.map((s) => ({ label: s.name, color: s.color })),
      style: { marginTop: 8, marginLeft: layout.PAD.left },
    }) : null,
  );
}

/**
 * Scatter plot. Points are `{ x, y, size?, color? }` (numeric x and y), as
 * `data` or several `series`. Give points a `size` to make it a bubble chart.
 */
export function ScatterChart(props) { return _fit(_ScatterChartInner, props); }

// ── Candlestick ─────────────────────────────────────────────────────────────

const _CANDLE_UP = '#22C29B', _CANDLE_DOWN = '#EC5D78';

/** A candle's direction and its y values from `{ open, high, low, close }`; null when any is missing. */
function _candle(d) {
  if (!d || ![d.open, d.high, d.low, d.close].every(Number.isFinite)) return null;
  return { up: d.close >= d.open, open: d.open, high: Math.max(d.high, d.open, d.close), low: Math.min(d.low, d.open, d.close), close: d.close };
}

function _CandlestickChartInner(props) {
  const {
    data, width = 480, height = 260, showGrid = true, showLabels = true, showTooltip = true, tooltipMotion = true,
    animate = true, onPointPress, theme, title, upColor = _CANDLE_UP, downColor = _CANDLE_DOWN,
    formatValue = _fmt, formatLabel = (x) => String(x),
  } = props;
  const T = _theme(theme);
  const rows = data || [];
  const n = rows.length;
  const candles = rows.map(_candle);
  const [active, setActive] = useState(null);
  const activeIdx = active != null && active < n ? active : null;

  const layout = useMemo(() => {
    const lows = candles.filter(Boolean).map((c) => c.low), highs = candles.filter(Boolean).map((c) => c.high);
    const scale = _niceScale(Math.min(...lows), Math.max(...highs));
    return _cartesianLayout({ width, height, scale, showLabels, xCount: n, band: true });
  }, [rows, width, height, showLabels, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const bodyW = Math.max(2, Math.min(18, layout.slot * 0.6));
  const draw = (ctx) => {
    if (n === 0) return;
    const L = layout;
    const { toX, toY } = L;
    _drawYAxis(ctx, L, T, { showGrid, showLabels });
    candles.forEach((c, i) => {
      if (!c) return;
      const col = c.up ? upColor : downColor;
      const dim = activeIdx != null && i !== activeIdx;
      const base = activeIdx === i ? _lighten(col, 0.12) : _rgba(col, dim ? 0.4 : 1);
      const x = toX(i);
      const wx = Math.round(x) + 0.5;
      ctx.strokeStyle = base; ctx.lineWidth = 1.5;
      ctx.strokeLine(wx, toY(c.high), wx, toY(c.low));
      const yTop = toY(Math.max(c.open, c.close)), yBot = toY(Math.min(c.open, c.close));
      ctx.fillStyle = base;
      _roundRectPath(ctx, x - bodyW / 2, yTop, bodyW, Math.max(1.5, yBot - yTop), Math.min(2, bodyW / 2), Math.min(2, bodyW / 2));
      ctx.fill();
    });
    if (showGrid) {
      ctx.strokeStyle = T.baseline; ctx.lineWidth = 1;
      const y = Math.round(L.PAD.top + L.H) + 0.5;
      ctx.strokeLine(L.PAD.left, y, L.PAD.left + L.W, y);
    }
    if (showLabels) _drawXLabels(ctx, rows.map((d) => formatLabel(d.x)), rows.map((_, i) => toX(i)), L, T);
  };

  const pick = (lx) => {
    if (n === 0) return null;
    const { PAD, W, slot } = layout;
    if (lx < PAD.left || lx > PAD.left + W) return null;
    return Math.max(0, Math.min(n - 1, Math.floor((lx - PAD.left) / slot)));
  };

  const summary = n === 0
    ? `${title ? title + ', ' : ''}candlestick chart, no data.`
    : `${title ? title + ', ' : ''}candlestick chart, ${n} candles from ${formatLabel(rows[0].x)} to ${formatLabel(rows[n - 1].x)}, ` +
      `low ${formatValue(Math.min(...candles.filter(Boolean).map((c) => c.low)))}, high ${formatValue(Math.max(...candles.filter(Boolean).map((c) => c.high)))}.`;
  const describe = (i) => {
    const c = candles[i];
    return c
      ? `${formatLabel(rows[i].x)}: open ${formatValue(c.open)}, high ${formatValue(c.high)}, low ${formatValue(c.low)}, close ${formatValue(c.close)}, ${c.up ? 'up' : 'down'}. ${i + 1} of ${n}.`
      : `${formatLabel(rows[i].x)}: no data. ${i + 1} of ${n}.`;
  };

  const tc = activeIdx != null ? candles[activeIdx] : null;
  const tooltip = showTooltip
    ? React.createElement(_Tooltip, {
        T, chartW: width, motion: tooltipMotion,
        data: tc ? {
          anchorX: layout.toX(activeIdx) + bodyW / 2 - 8, top: layout.PAD.top,
          title: formatLabel(rows[activeIdx].x),
          rows: [
            { name: 'Open', color: tc.up ? upColor : downColor, value: formatValue(tc.open) },
            { name: 'High', color: tc.up ? upColor : downColor, value: formatValue(tc.high) },
            { name: 'Low', color: tc.up ? upColor : downColor, value: formatValue(tc.low) },
            { name: 'Close', color: tc.up ? upColor : downColor, value: formatValue(tc.close) },
          ],
        } : null,
      })
    : null;

  return React.createElement(
    View,
    { style: { width, height, position: 'relative' }, animation: _ENTRANCE },
    React.createElement(_ChartCanvas, {
      width, height, draw, animate, deps: [rows, width, height, showGrid, showLabels, activeIdx, upColor, downColor, T],
    }),
    React.createElement(_Interaction, {
      width, height, T, count: n, pick, active: activeIdx, setActive,
      onActivate: (i) => onPointPress?.(rows[i], i),
      summary, describe, roleDescription: 'candlestick chart',
      hint: 'Use the arrow keys to move between candles.',
    }),
    tooltip,
  );
}

/**
 * Candlestick (OHLC) chart: one candle per `{ x, open, high, low, close }`,
 * `upColor` when it closed at or above its open, `downColor` below.
 */
export function CandlestickChart(props) { return _fit(_CandlestickChartInner, props); }

export const _internals = { _sparkPoints, _scatterPoints, _bubbleRadius, _nearestPoint, _candle, _barScale, _barSegments, _barSlots, _niceScale, _niceStep, _fmt, _fmtTick, _normSeries, _theme, _cartesianSummary, _ChartStream, _smoothPath, _curveSegments, _zoomWindow, _cumulative };
