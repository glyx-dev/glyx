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
import { Canvas, View, Text, Pressable, useDraggable } from '@glyx-dev/react';

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
    label:       '#8C92A6',
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

function _ChartCanvas({ width, height, draw, deps }) {
  const ref = useRef(null);
  useEffect(() => {
    const ctx = ref.current;
    if (!ctx) return;
    ctx.clear();
    draw(ctx);
    ctx.flush();
  }, deps); // eslint-disable-line react-hooks/exhaustive-deps
  return React.createElement(Canvas, { ref, width, height });
}

// A soft fade-and-rise when a chart first appears. Native keyframes: no JS
// runs per frame, and re-renders with the same spec don't restart it.
const _ENTRANCE = {
  duration: 420, easing: 'ease-out',
  keyframes: { from: { opacity: 0, transform: 'translate(0, 6px)' }, to: { opacity: 1, transform: 'translate(0, 0)' } },
};

// ── Drawing helpers ─────────────────────────────────────────────────────────

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

function _Tooltip({ T, anchorX, top, chartW, title, rows }) {
  const W = Math.max(
    120,
    _textW(title, 11) + 24,
    ...rows.map((r) => 28 + _textW(r.name, 12) + 16 + _textW(r.value, 12, true) + 12),
  );
  const left = anchorX + 14 + W > chartW ? anchorX - 14 - W : anchorX + 14;
  return React.createElement(
    View,
    {
      style: {
        position: 'absolute', left: Math.max(0, left), top, width: W,
        backgroundColor: T.tooltipBg, borderRadius: 8,
        borderWidth: 1, borderColor: T.tooltipBorder,
        paddingHorizontal: 10, paddingVertical: 8,
        boxShadow: '0 6 0 #00000030',
      },
      pointerEvents: 'none',
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
      case 'Enter': case ' ': case 'Space': if (active != null) onActivate?.(active); break;
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

function _useZoomPan(dataLength, { minVisible = 4, trackWidth } = {}) {
  const [start, setStart] = useState(0);
  const [count, setCount] = useState(dataLength);
  const dragAnchor = useRef(0);

  useEffect(() => {
    setCount((c) => Math.min(dataLength, Math.max(minVisible, c)));
    setStart((s) => Math.min(Math.max(0, dataLength - count), Math.max(0, s)));
  }, [dataLength]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomIn  = useCallback(() => setCount((c) => Math.max(minVisible, Math.round(c * 0.7))), [minVisible]);
  const zoomOut = useCallback(() => setCount((c) => Math.min(dataLength, Math.round(c / 0.7))), [dataLength]);
  const reset   = useCallback(() => { setCount(dataLength); setStart(0); }, [dataLength]);

  const stateRef = useRef({ start, count, dataLength, trackWidth });
  stateRef.current = { start, count, dataLength, trackWidth };
  const onMount = useDraggable({
    onDragStart: () => { dragAnchor.current = stateRef.current.start; },
    onDragMove: ({ dx }) => {
      const { count: c, dataLength: n, trackWidth: tw } = stateRef.current;
      const shift = Math.round(-dx * (c / Math.max(1, tw)));
      setStart(Math.min(Math.max(0, n - c), Math.max(0, dragAnchor.current + shift)));
    },
  });

  const maxStart = Math.max(0, dataLength - count);
  return { start: Math.min(start, maxStart), count, zoomIn, zoomOut, reset, onMount };
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
    showDots, showTooltip = true, onPointPress, zoomPan = false, smooth = true,
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

  const legend = (showLegend ?? series.length > 1) && series.length > 0;
  const chartH = legend ? height - 26 : height;

  const layout = useMemo(() => {
    const ys = series.flatMap((s) => s.data.map((d) => d.y)).filter(Number.isFinite);
    const scale = _niceScale(Math.min(...ys), Math.max(...ys), { zero: area });
    return _cartesianLayout({ width, height: chartH, scale, showLabels, xCount: n, topPad: zoomPan ? 30 : 14 });
  }, [series, width, chartH, showLabels, n, area, zoomPan]); // eslint-disable-line react-hooks/exhaustive-deps

  const dots = showDots ?? n <= 14;
  const draw = (ctx) => {
    if (n === 0) return;
    const L = layout;
    const { PAD, W, H, toX, toY } = L;
    _drawYAxis(ctx, L, T, { showGrid, showLabels });

    ctx.pushClip(PAD.left - lineWidth * 2, PAD.top - lineWidth * 3, W + lineWidth * 4, H + lineWidth * 3 + 1);
    const baseY = toY(Math.max(layout.scale.lo, Math.min(0, layout.scale.hi)));
    series.forEach((s) => {
      const pts = s.data.map((d, i) => [toX(i), toY(d.y)]);
      if (area) {
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
        const y = toY(d.y);
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

  const kindName = area ? 'area chart' : 'line chart';
  const summary = _cartesianSummary({ title, kindName, series, formatValue, formatLabel });
  const describe = (i) => {
    const x = formatLabel(series[0].data[i]?.x);
    const parts = series.map((s) => `${series.length > 1 ? s.name + ' ' : ''}${formatValue(s.data[i]?.y)}`);
    return `${x}: ${parts.join(', ')}. ${i + 1} of ${n}.`;
  };

  const tooltip = showTooltip && activeIdx != null && n > 0
    ? React.createElement(_Tooltip, {
        T, anchorX: layout.toX(activeIdx), top: layout.PAD.top, chartW: width,
        title: formatLabel(series[0].data[activeIdx].x),
        rows: series.map((s) => ({ name: s.name || 'Value', color: s.color, value: formatValue(s.data[activeIdx]?.y) })),
      })
    : null;

  const body = React.createElement(
    View,
    { style: { width, height: chartH, position: 'relative' }, _glyxOnMount: zoomPan ? zp.onMount : undefined },
    React.createElement(_ChartCanvas, {
      width, height: chartH, draw,
      deps: [series, width, chartH, lineWidth, showGrid, showLabels, dots, smooth, activeIdx, T],
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
export function LineChart(props) { return _lineChart('line', props); }

/** Area chart: a line chart with a gradient fill down to the baseline. */
export function AreaChart(props) { return _lineChart('area', props); }

// ── Bar ─────────────────────────────────────────────────────────────────────

export function BarChart(props) {
  const {
    data, width = 480, height = 260, color = DEFAULT_PALETTE[0],
    showGrid = true, showLabels = true, showTooltip = true, onPointPress,
    theme, title, name = 'Value', formatValue = _fmt, formatLabel = (x) => String(x),
  } = props;
  const T = _theme(theme);
  const rows = data || [];
  const n = rows.length;
  const [active, setActive] = useState(null);
  const activeIdx = active != null && active < n ? active : null;

  const layout = useMemo(() => {
    const ys = rows.map((d) => d.y).filter(Number.isFinite);
    const scale = _niceScale(Math.min(0, ...ys), Math.max(0, ...ys), { zero: true });
    return _cartesianLayout({ width, height, scale, showLabels, xCount: n, band: true });
  }, [rows, width, height, showLabels, n]); // eslint-disable-line react-hooks/exhaustive-deps

  const barW = Math.max(2, Math.min(44, layout.slot * 0.64));
  const draw = (ctx) => {
    if (n === 0) return;
    const L = layout;
    const { toX, toY } = L;
    _drawYAxis(ctx, L, T, { showGrid, showLabels });
    const zeroY = toY(0);
    rows.forEach((d, i) => {
      const c = d.color || color;
      const x = toX(i) - barW / 2;
      const yv = toY(d.y);
      const top = Math.min(yv, zeroY), h = Math.max(1, Math.abs(zeroY - yv));
      const dim = activeIdx != null && i !== activeIdx;
      const base = activeIdx === i ? _lighten(c, 0.12) : _rgba(c, dim ? 0.45 : 1);
      const g = ctx.createLinearGradient(0, top, 0, top + h);
      g.addColorStop(0, d.y >= 0 ? _lighten(base, 0.18) : base);
      g.addColorStop(1, d.y >= 0 ? base : _lighten(base, 0.18));
      ctx.fillStyle = g;
      const r = Math.min(6, barW / 2);
      if (d.y >= 0) _roundRectPath(ctx, x, top, barW, h, r, 0);
      else _roundRectPath(ctx, x, top, barW, h, 0, r);
      ctx.fill();
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

  const summary = _cartesianSummary({ title, kindName: 'bar chart', series: [{ name, data: rows }], formatValue, formatLabel });
  const describe = (i) => `${formatLabel(rows[i].x)}: ${formatValue(rows[i].y)}. ${i + 1} of ${n}.`;

  const tooltip = showTooltip && activeIdx != null
    ? React.createElement(_Tooltip, {
        T, anchorX: layout.toX(activeIdx) + barW / 2 - 8, top: layout.PAD.top, chartW: width,
        title: formatLabel(rows[activeIdx].x),
        rows: [{ name, color: rows[activeIdx].color || color, value: formatValue(rows[activeIdx].y) }],
      })
    : null;

  return React.createElement(
    View,
    { style: { width, height, position: 'relative' }, animation: _ENTRANCE },
    React.createElement(_ChartCanvas, {
      width, height, draw, deps: [rows, width, height, color, showGrid, showLabels, activeIdx, T],
    }),
    React.createElement(_Interaction, {
      width, height, T, count: n, pick, active: activeIdx, setActive,
      onActivate: (i) => onPointPress?.(rows[i], i),
      summary, describe, roleDescription: 'bar chart',
      hint: 'Use the arrow keys to move between bars.',
    }),
    tooltip,
  );
}

// ── Pie / Donut ─────────────────────────────────────────────────────────────

export function PieChart(props) {
  const {
    data, width = 260, height = 260, palette = DEFAULT_PALETTE,
    innerRadius = 0, // > 0 → donut (fraction of the radius, 0–1)
    showTooltip = true, onPointPress, showLegend = false,
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

  const wedge = (ctx, a0, a1, rOut, rIn, ox = 0, oy = 0) => {
    ctx.beginPath();
    if (rIn > 0) {
      ctx.moveTo(cx + ox + rIn * Math.cos(a0), cy + oy + rIn * Math.sin(a0));
      ctx.lineTo(cx + ox + rOut * Math.cos(a0), cy + oy + rOut * Math.sin(a0));
      ctx.arc(cx + ox, cy + oy, rOut, a0, a1);
      ctx.lineTo(cx + ox + rIn * Math.cos(a1), cy + oy + rIn * Math.sin(a1));
      ctx.arc(cx + ox, cy + oy, rIn, a1, a0, true);
    } else {
      ctx.moveTo(cx + ox, cy + oy);
      ctx.arc(cx + ox, cy + oy, rOut, a0, a1);
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
  if (showTooltip && !donut && activeIdx != null) {
    const [a0, a1] = angles[activeIdx];
    const mid = (a0 + a1) / 2;
    tooltip = React.createElement(_Tooltip, {
      T, anchorX: cx + Math.cos(mid) * r * 0.6, top: Math.max(0, cy + Math.sin(mid) * r * 0.6 - 30), chartW: width,
      title: formatLabel(rows[activeIdx].x),
      rows: [{ name: pct(rows[activeIdx].y), color: colorOf(rows[activeIdx], activeIdx), value: formatValue(rows[activeIdx].y) }],
    });
  }

  const chart = React.createElement(
    View,
    { style: { width, height: chartH, position: 'relative' } },
    React.createElement(_ChartCanvas, {
      width, height: chartH, draw, deps: [rows, width, chartH, innerRadius, palette, activeIdx, T, centerLabel],
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

export { DEFAULT_PALETTE, THEMES };

// Internals exported for unit tests only.
export const _internals = { _niceScale, _niceStep, _fmt, _fmtTick, _normSeries, _theme, _cartesianSummary };
