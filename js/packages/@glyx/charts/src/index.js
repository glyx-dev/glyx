// @glyx-dev/charts — GPU-rendered charts on Glyx Canvas 2D.
//
// Built entirely on the Canvas path API (fill/stroke/arc) + fillText. No DOM,
// no SVG. Charts redraw only when their props change (not per-frame), so they
// cost nothing while idle.
//
// Usage:
//   import { LineChart, BarChart, PieChart, AreaChart, Legend } from '@glyx-dev/charts';
//   <LineChart data={[{x:'Jan',y:10},…]} width={600} height={300} />

import React from 'react';
import { Canvas, View, Text, Pressable, useDraggable } from '@glyx-dev/react';

const { useRef, useEffect, useState, useCallback } = React;

// ── Color helpers ───────────────────────────────────────────────────────────

function _hexToRgba(c, alpha) {
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

// Blend a color toward white — used for the "brighter" fill on a
// hovered/glowing bar or wedge. `amount` 0..1, 0 = unchanged.
function _lighten(c, amount) {
  const [r, g, b, a] = _hexToRgba(c);
  return [
    Math.round(r + (255 - r) * amount),
    Math.round(g + (255 - g) * amount),
    Math.round(b + (255 - b) * amount),
    a,
  ];
}

// The Canvas 2D API here has no shadowBlur/glow primitive — approximate one
// with a few concentric, increasingly-transparent enlarged copies of a shape
// drawn behind the real one. `drawLayer(scale, alpha)` draws one glow ring at
// that scale/opacity; called from largest+faintest to smallest+strongest.
function _drawGlow(drawLayer) {
  drawLayer(1.14, 0.06);
  drawLayer(1.08, 0.12);
  drawLayer(1.03, 0.18);
}

const DEFAULT_PALETTE = [
  '#00A878', '#4090F0', '#E0A030', '#E05060', '#9B59B6',
  '#1ABC9C', '#E67E22', '#3498DB', '#E74C3C', '#2ECC71',
];

const AXIS  = '#5b6072';
const GRID  = '#2a2e3e';
const LABEL = '#8a90a6';

function _fmt(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toFixed(1) + 'B';
  if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(1) + 'k';
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

// Shared canvas host: runs `draw(ctx)` whenever any dep changes.
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

// Draws the two solid axis lines (Y at PAD.left, X at PAD.top+H) — distinct
// from the light `showGrid` reference lines. This is what makes a chart read
// as "plotted against axes" rather than just floating shapes on a canvas.
const TICK_LEN = 5;

// `yTicks`/`xTicks` are pixel positions (not data values) — the same
// positions the label loop already computed, so every tick lines up exactly
// under/beside its label rather than being a separately-computed guess.
function _drawAxes(ctx, { PAD, W, H, yTicks = [], xTicks = [] }) {
  ctx.strokeStyle = AXIS;
  ctx.lineWidth = 1.5;
  ctx.strokeLine(PAD.left, PAD.top, PAD.left, PAD.top + H);       // Y axis
  ctx.strokeLine(PAD.left, PAD.top + H, PAD.left + W, PAD.top + H); // X axis

  ctx.lineWidth = 1;
  for (const y of yTicks) {
    ctx.strokeLine(PAD.left - TICK_LEN, y, PAD.left, y);
  }
  for (const x of xTicks) {
    ctx.strokeLine(x, PAD.top + H, x, PAD.top + H + TICK_LEN);
  }
}

// How many X-axis labels actually fit without overlapping, given the real
// plot width — not a flat "show at most 8" rule. There's no text-measurement
// API exposed to canvas draw code, so this estimates label width from
// character count at the fixed 11px tick-label font size rather than
// measuring exactly; canvas fillText also has no rotate/transform primitive
// (checked — none exists), so skipping labels is the only decluttering
// lever available today, not rotating them.
function _xLabelStep(items, availableWidth, avgCharPx = 6.2, minGapPx = 14) {
  const n = items.length;
  if (n <= 1 || availableWidth <= 0) return 1;
  const maxLabelChars = Math.max(...items.map((s) => String(s).length), 1);
  const labelWidth = maxLabelChars * avgCharPx + minGapPx;
  const maxVisible = Math.max(1, Math.floor(availableWidth / labelWidth));
  return Math.max(1, Math.ceil(n / maxVisible));
}

// ── Tooltips + click ─────────────────────────────────────────────────────────
//
// There's no continuous hover-move event in the framework (only onHoverIn/
// onHoverOut enter/leave transitions), so tooltips can't track "nearest point
// to the cursor" the way a DOM chart library would. Instead: one small
// invisible Pressable hit-region per data point/bar/wedge, absolutely
// positioned over the canvas — hovering one shows its own tooltip, and the
// same region reports onPress for click-to-select. Discrete-per-point, not
// continuous, but a real, working interaction rather than an approximation.

function _TooltipOverlay({ width, height, points, hitRadius = 10, onPointPress, hoverIdx, setHoverIdx }) {
  if (!points || points.length === 0) return null;
  const hovered = hoverIdx != null ? points[hoverIdx] : null;

  const boxW = 110, boxH = 40;
  let tx = 0, ty = 0;
  if (hovered) {
    tx = hovered.cx + 12;
    ty = hovered.cy - boxH - 8;
    if (tx + boxW > width) tx = hovered.cx - boxW - 12;
    if (tx < 0) tx = 0;
    if (ty < 0) ty = hovered.cy + 12;
    if (ty + boxH > height) ty = height - boxH;
  }

  return React.createElement(
    View,
    { style: { position: 'absolute', left: 0, top: 0, width, height } },
    ...points.map((p, i) => {
      // Points can specify their own hit-rect (e.g. a bar's full width/height)
      // instead of the default hitRadius circle-ish box (line/pie points).
      const hasRect = p.hw != null && p.hh != null;
      const left = hasRect ? p.hx : p.cx - hitRadius;
      const top  = hasRect ? p.hy : p.cy - hitRadius;
      const w    = hasRect ? p.hw : hitRadius * 2;
      const h    = hasRect ? p.hh : hitRadius * 2;
      return React.createElement(Pressable, {
        key: i,
        feedback: false,
        onHoverIn: () => setHoverIdx(i),
        onHoverOut: () => setHoverIdx((cur) => (cur === i ? null : cur)),
        onPress: onPointPress ? () => onPointPress(p.raw, i) : undefined,
        style: { position: 'absolute', left, top, width: w, height: h },
      });
    }),
    hovered ? React.createElement(
      View,
      {
        style: {
          position: 'absolute', left: tx, top: ty, width: boxW,
          backgroundColor: '#1e1e2e', borderRadius: 6,
          borderWidth: 1, borderColor: '#2a2a3a',
          paddingVertical: 4, paddingHorizontal: 8,
        },
      },
      React.createElement(Text, { fontSize: 11, style: { color: LABEL } }, String(hovered.label)),
      React.createElement(Text, { fontSize: 13, style: { color: '#e0e0f0', fontWeight: '600' } }, _fmt(hovered.value)),
    ) : null,
  );
}

// Wraps a chart's canvas + optional tooltip/click hit-regions in a
// relatively-positioned container so the overlay can be absolutely
// positioned against it. Hover state is owned by the top-level chart
// component (not here) and passed in, because `draw` — built by the
// caller — needs `hoverIdx` baked into its closure to render hover
// highlights (a highlighted line point, a glowing bar/wedge) on the canvas
// itself, not just in the DOM tooltip overlay.
function _ChartWithTooltip({ width, height, draw, deps, points, showTooltip, onPointPress, hoverIdx, setHoverIdx }) {
  return React.createElement(
    View,
    { style: { width, height, position: 'relative' } },
    React.createElement(_ChartCanvas, { width, height, draw, deps }),
    (showTooltip || onPointPress) && points && points.length > 0
      ? React.createElement(_TooltipOverlay, { width, height, points, onPointPress, hoverIdx, setHoverIdx })
      : null,
  );
}

// ── Legend ────────────────────────────────────────────────────────────────────
//
// Standalone component — one swatch + label per item, wrapping horizontally.
// Not tied to any one chart type: pass the same `{label, color}` shape you'd
// give a chart's data, or build it from a chart's own `data`/`palette`.
// `onToggle(index, item)` is optional — when provided, items render as
// Pressable and the caller owns what "toggled" means (e.g. hiding a series).

export function Legend({ items, onToggle, disabled = [], style }) {
  if (!items || items.length === 0) return null;
  return React.createElement(
    View,
    { style: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 14, ...style } },
    ...items.map((item, i) => {
      const isOff = disabled.includes(i);
      const swatch = React.createElement(View, {
        style: {
          width: 10, height: 10, borderRadius: 5,
          backgroundColor: isOff ? '#4a4f63' : (item.color || DEFAULT_PALETTE[i % DEFAULT_PALETTE.length]),
        },
      });
      const label = React.createElement(
        Text,
        { fontSize: 12, style: { color: isOff ? '#5b6072' : LABEL } },
        String(item.label),
      );
      const row = React.createElement(
        View,
        { style: { flexDirection: 'row', alignItems: 'center', gap: 6 } },
        swatch, label,
      );
      if (!onToggle) return React.createElement(View, { key: i }, row);
      return React.createElement(Pressable, {
        key: i, feedback: false, onPress: () => onToggle(i, item),
        style: { flexDirection: 'row', alignItems: 'center' },
      }, row);
    }),
  );
}

// ── LineChart / AreaChart ─────────────────────────────────────────────────────

// Computes the pixel-space layout (padding, scales, toX/toY) once, shared by
// the draw pass, the axis-label pass, and the tooltip hit-point pass — so
// everything drawn always agrees exactly with what's hit-tested.
// Padding depends only on `showLabels`, not on data — shared by the full
// layout pass and by `_useZoomPan`, which needs the real plot-area width
// (not the raw chart `width`) to map drag pixels to data-index shifts 1:1.
function _linePad(showLabels) {
  return { top: 16, right: 16, bottom: showLabels ? 34 : 12, left: showLabels ? 46 : 12 };
}

function _lineLayout({ data, width, height, showLabels }) {
  const PAD = _linePad(showLabels);
  const W = width - PAD.left - PAD.right;
  const H = height - PAD.top - PAD.bottom;
  const ys = data.map((d) => d.y);
  let minY = Math.min(0, ...ys);
  let maxY = Math.max(...ys);
  if (maxY === minY) maxY = minY + 1;
  const range = maxY - minY;
  const toX = (i) => PAD.left + (data.length === 1 ? W / 2 : (i / (data.length - 1)) * W);
  const toY = (y) => PAD.top + H - ((y - minY) / range) * H;
  return { PAD, W, H, minY, maxY, range, toX, toY };
}

function _lineLikePoints(data, layout) {
  const { toX, toY } = layout;
  return data.map((d, i) => ({ cx: toX(i), cy: toY(d.y), label: String(d.x), value: d.y, raw: d }));
}

function _lineLike({ data, width, height, color, lineWidth, area, showGrid, showDots, showLabels, showAxes, showXTicks, showYTicks, hoverIdx }) {
  return (ctx) => {
    if (!data || data.length === 0) return;
    const { PAD, W, H, maxY, range, toX, toY } = _lineLayout({ data, width, height, showLabels });

    if (showGrid) {
      ctx.strokeStyle = GRID; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = PAD.top + (H / 4) * i;
        ctx.strokeLine(PAD.left, y, PAD.left + W, y);
      }
    }
    // Area fill under the line (proper polygon via the path API).
    if (area) {
      ctx.beginPath();
      ctx.moveTo(toX(0), PAD.top + H);
      data.forEach((d, i) => ctx.lineTo(toX(i), toY(d.y)));
      ctx.lineTo(toX(data.length - 1), PAD.top + H);
      ctx.closePath();
      ctx.fillStyle = _hexToRgba(color, 0.18);
      ctx.fill();
    }

    // Line itself (stroked polyline).
    ctx.beginPath();
    data.forEach((d, i) => (i === 0 ? ctx.moveTo(toX(i), toY(d.y)) : ctx.lineTo(toX(i), toY(d.y))));
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    if (showDots) {
      ctx.fillStyle = color;
      data.forEach((d, i) => ctx.fillCircle(toX(i), toY(d.y), lineWidth + 1.5));
    }

    // Hover marker: always drawn regardless of `showDots`, so there's real
    // visual feedback for "where is the mouse" even on a line rendered
    // without permanent dots (a busy realtime chart, say). Outer ring +
    // inner solid dot, sized well past the line width so it reads clearly.
    if (hoverIdx != null && data[hoverIdx]) {
      const hx = toX(hoverIdx), hy = toY(data[hoverIdx].y);
      ctx.fillStyle = _hexToRgba(color, 0.25);
      ctx.fillCircle(hx, hy, lineWidth + 7);
      ctx.fillStyle = color;
      ctx.fillCircle(hx, hy, lineWidth + 3);
      ctx.strokeStyle = '#0f0f14';
      ctx.lineWidth = 1.5;
      ctx.strokeCircle(hx, hy, lineWidth + 3);
    }

    // Axis tick labels — drawn after the fill/line/dots (not before) so the
    // semi-transparent area fill never paints over them, but before the
    // axis lines so those stay crisp on top of everything. Tick pixel
    // positions are collected here (same loop as the labels) so ticks
    // always line up exactly under/beside their label.
    const yTicks = [], xTicks = [];
    if (showLabels) {
      ctx.fillStyle = LABEL;
      for (let i = 0; i <= 4; i++) {
        const value = maxY - (range / 4) * i;
        const y = PAD.top + (H / 4) * i;
        ctx.fillText(_fmt(value), 6, y - 6, 11);
        yTicks.push(y);
      }
      const step = _xLabelStep(data.map((d) => String(d.x)), W);
      data.forEach((d, i) => {
        if (i % step !== 0) return;
        ctx.fillText(String(d.x), toX(i) - 10, height - 16, 11);
        xTicks.push(toX(i));
      });
    }

    // Axis lines (+ tick marks, if enabled) drawn last so they sit crisply
    // on top of grid/fill/line.
    if (showAxes) _drawAxes(ctx, { PAD, W, H, yTicks: showYTicks ? yTicks : [], xTicks: showXTicks ? xTicks : [] });
  };
}

// Small +/- zoom control + drag-to-pan, shared by LineChart/AreaChart when
// `zoomPan` is set. There's no wheel/pinch event exposed to plain Views in
// the framework (only ScrollView gets wheel), so zoom is two buttons
// adjusting the visible window size, and pan is `useDraggable` adjusting the
// window's start index — both real, working interactions rather than a
// synthesized approximation of wheel/pinch.
function _useZoomPan(dataLength, { minVisible = 4, trackWidth } = {}) {
  const [start, setStart] = useState(0);
  const [count, setCount] = useState(dataLength);
  const dragAnchor = useRef(0);

  useEffect(() => {
    // New data arriving (e.g. live feed) — keep the window size, clamp start.
    setCount((c) => Math.min(dataLength, Math.max(minVisible, c)));
    setStart((s) => Math.min(Math.max(0, dataLength - count), Math.max(0, s)));
  }, [dataLength]); // eslint-disable-line react-hooks/exhaustive-deps

  const zoomIn  = useCallback(() => setCount((c) => Math.max(minVisible, Math.round(c * 0.7))), [minVisible]);
  const zoomOut = useCallback(() => setCount((c) => Math.min(dataLength, Math.round(c / 0.7))), [dataLength]);
  const reset   = useCallback(() => { setCount(dataLength); setStart(0); }, [dataLength]);

  // useDraggable itself must be called unconditionally at the top level
  // (Rules of Hooks) — the drag handlers close over `start`/`count`/
  // `trackWidth` via refs instead of needing to be recreated as those
  // values change.
  const stateRef = useRef({ start, count, dataLength, trackWidth });
  stateRef.current = { start, count, dataLength, trackWidth };
  const onMount = useDraggable({
    onDragStart: () => { dragAnchor.current = stateRef.current.start; },
    onDragMove: ({ dx }) => {
      const { count: c, dataLength: n, trackWidth: tw } = stateRef.current;
      // Drag distance in pixels → index shift, scaled by how many points are
      // currently visible per pixel of the *actual* plot area (not the raw
      // chart width, which includes label padding that data never occupies)
      // — so a full-width drag always pans exactly across the visible
      // window, at any chart size or zoom level.
      const perPixel = c / Math.max(1, tw);
      const shift = Math.round(-dx * perPixel);
      const maxStart = Math.max(0, n - c);
      setStart(Math.min(maxStart, Math.max(0, dragAnchor.current + shift)));
    },
  });

  const maxStart = Math.max(0, dataLength - count);
  return { start: Math.min(start, maxStart), count, zoomIn, zoomOut, reset, onMount };
}

function _ZoomControls({ onZoomIn, onZoomOut, onReset }) {
  const btn = (label, onPress) => React.createElement(Pressable, {
    key: label, feedback: false, onPress,
    style: {
      width: 24, height: 24, borderRadius: 4, backgroundColor: '#2a2a3a',
      alignItems: 'center', justifyContent: 'center',
    },
  }, React.createElement(Text, { fontSize: 13, style: { color: LABEL } }, label));
  return React.createElement(
    View,
    { style: { position: 'absolute', right: 4, top: 4, flexDirection: 'row', gap: 4 } },
    btn('+', onZoomIn), btn('−', onZoomOut), btn('⟲', onReset),
  );
}

export function LineChart({
  data, width = 480, height = 260, color = DEFAULT_PALETTE[0],
  lineWidth = 2, showGrid = true, showDots = true, showLabels = true,
  showAxes = true, showXTicks = true, showYTicks = true, showTooltip = true, onPointPress, zoomPan = false,
}) {
  const full = data || [];
  const pad = _linePad(showLabels);
  const zp = _useZoomPan(full.length, { trackWidth: width - pad.left - pad.right });
  const visible = zoomPan ? full.slice(zp.start, zp.start + zp.count) : full;
  const [hoverIdx, setHoverIdx] = useState(null);

  const draw = _lineLike({ data: visible, width, height, color, lineWidth, area: false, showGrid, showDots, showLabels, showAxes, showXTicks, showYTicks, hoverIdx });
  const points = visible.length ? _lineLikePoints(visible, _lineLayout({ data: visible, width, height, showLabels })) : null;

  const canvas = React.createElement(_ChartWithTooltip, {
    width, height, draw, points, showTooltip, onPointPress, hoverIdx, setHoverIdx,
    deps: [visible, width, height, color, lineWidth, showGrid, showDots, showLabels, showAxes, showXTicks, showYTicks, hoverIdx],
  });
  if (!zoomPan) return canvas;
  return React.createElement(
    View,
    { style: { width, height, position: 'relative' }, _glyxOnMount: zp.onMount },
    canvas,
    React.createElement(_ZoomControls, {
      onZoomIn: zp.zoomIn, onZoomOut: zp.zoomOut,
      onReset: zp.reset,
    }),
  );
}

export function AreaChart({
  data, width = 480, height = 260, color = DEFAULT_PALETTE[0],
  lineWidth = 2, showGrid = true, showLabels = true, showDots = true,
  showAxes = true, showXTicks = true, showYTicks = true, showTooltip = true, onPointPress, zoomPan = false,
}) {
  const full = data || [];
  const pad = _linePad(showLabels);
  const zp = _useZoomPan(full.length, { trackWidth: width - pad.left - pad.right });
  const visible = zoomPan ? full.slice(zp.start, zp.start + zp.count) : full;
  const [hoverIdx, setHoverIdx] = useState(null);

  const draw = _lineLike({ data: visible, width, height, color, lineWidth, area: true, showGrid, showDots, showLabels, showAxes, showXTicks, showYTicks, hoverIdx });
  const points = visible.length ? _lineLikePoints(visible, _lineLayout({ data: visible, width, height, showLabels })) : null;

  const canvas = React.createElement(_ChartWithTooltip, {
    width, height, draw, points, showTooltip, onPointPress, hoverIdx, setHoverIdx,
    deps: [visible, width, height, color, lineWidth, showGrid, showDots, showLabels, showAxes, showXTicks, showYTicks, hoverIdx],
  });
  if (!zoomPan) return canvas;
  return React.createElement(
    View,
    { style: { width, height, position: 'relative' }, _glyxOnMount: zp.onMount },
    canvas,
    React.createElement(_ZoomControls, { onZoomIn: zp.zoomIn, onZoomOut: zp.zoomOut, onReset: zp.reset }),
  );
}

// ── BarChart ──────────────────────────────────────────────────────────────────

export function BarChart({
  data, width = 480, height = 260, color = DEFAULT_PALETTE[1],
  showGrid = true, showLabels = true, showAxes = true,
  showXTicks = true, showYTicks = true, showTooltip = true, onPointPress,
}) {
  const [hoverIdx, setHoverIdx] = useState(null);

  // Shared by draw + hit-region pass so tooltips/clicks line up exactly with bars.
  const layout = (data && data.length) ? (() => {
    const PAD = { top: 16, right: 16, bottom: showLabels ? 34 : 12, left: showLabels ? 46 : 12 };
    const W = width - PAD.left - PAD.right;
    const H = height - PAD.top - PAD.bottom;
    const maxY = Math.max(1, ...data.map((d) => d.y));
    const slot = W / data.length;
    const bw = slot * 0.62;
    return { PAD, W, H, maxY, slot, bw };
  })() : null;

  const draw = (ctx) => {
    if (!data || data.length === 0) return;
    const { PAD, W, H, maxY, slot, bw } = layout;

    if (showGrid) {
      ctx.strokeStyle = GRID; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = PAD.top + (H / 4) * i;
        ctx.strokeLine(PAD.left, y, PAD.left + W, y);
      }
    }
    const yTicks = [], xTicks = [];
    if (showLabels) {
      ctx.fillStyle = LABEL;
      for (let i = 0; i <= 4; i++) {
        const y = PAD.top + (H / 4) * i;
        ctx.fillText(_fmt(maxY - (maxY / 4) * i), 6, y - 6, 11);
        yTicks.push(y);
      }
    }
    // Same width-aware skip as line/area charts — BarChart previously drew
    // every single bar's label unconditionally, which overlaps into an
    // unreadable smear once there are more than a handful of bars.
    const xLabelStep = showLabels ? _xLabelStep(data.map((d) => String(d.x)), W) : 1;

    data.forEach((d, i) => {
      const h = (d.y / maxY) * H;
      const x = PAD.left + slot * i + (slot - bw) / 2;
      const y = PAD.top + H - h;
      const barColor = d.color || color;

      if (i === hoverIdx) {
        // Glow halo: a few enlarged, low-alpha copies of the bar footprint
        // behind the real one (no shadowBlur primitive to reach for).
        _drawGlow((scale, alpha) => {
          const gw = bw * scale, gh = h * scale;
          ctx.fillStyle = _hexToRgba(barColor, alpha);
          ctx.fillRect(x + bw / 2 - gw / 2, y + h - gh, gw, gh);
        });
        ctx.fillStyle = _lighten(barColor, 0.25);
      } else {
        ctx.fillStyle = barColor;
      }
      ctx.fillRect(x, y, bw, h);

      if (showLabels && i % xLabelStep === 0) {
        ctx.fillStyle = LABEL;
        ctx.fillText(String(d.x), x, height - 16, 11);
        xTicks.push(x + bw / 2);
      }
    });

    if (showAxes) _drawAxes(ctx, { PAD, W, H, yTicks: showYTicks ? yTicks : [], xTicks: showXTicks ? xTicks : [] });
  };

  const points = layout ? data.map((d, i) => {
    const { PAD, H, maxY, slot, bw } = layout;
    const h = (d.y / maxY) * H;
    const x = PAD.left + slot * i + (slot - bw) / 2;
    const y = PAD.top + H - h;
    return { cx: x + bw / 2, cy: y, hx: x, hy: y, hw: bw, hh: h, label: String(d.x), value: d.y, raw: d };
  }) : null;

  return React.createElement(_ChartWithTooltip, {
    width, height, draw, points, showTooltip, onPointPress, hoverIdx, setHoverIdx,
    deps: [data, width, height, color, showGrid, showLabels, showAxes, showXTicks, showYTicks, hoverIdx],
  });
}

// ── PieChart / Donut ──────────────────────────────────────────────────────────

export function PieChart({
  data, width = 260, height = 260, palette = DEFAULT_PALETTE,
  innerRadius = 0, // > 0 → donut (fraction of radius, 0–1)
  showTooltip = true, onPointPress, showLegend = false,
}) {
  const [hoverIdx, setHoverIdx] = useState(null);
  const cx = width / 2, cy = height / 2;
  const r = Math.min(width, height) / 2 - 8;
  const rInner = innerRadius > 0 ? r * Math.min(0.95, innerRadius) : 0;
  const total = data && data.length ? (data.reduce((s, d) => s + Math.max(0, d.y), 0) || 1) : 1;

  // Builds one wedge's path at a given outer radius — reused for the normal
  // fill, the hover "pop out" (slightly larger rOuter), and the glow halo
  // (several progressively larger, faint copies).
  const wedgePath = (ctx, a0, a1, rOuter) => {
    ctx.beginPath();
    if (rInner > 0) {
      // Ring wedge: outer arc a0→a1, in to the inner radius, inner arc
      // a1→a0 (reversed), close — leaves the center genuinely transparent
      // instead of painting a hardcoded color over it.
      ctx.moveTo(cx + rInner * Math.cos(a0), cy + rInner * Math.sin(a0));
      ctx.lineTo(cx + rOuter * Math.cos(a0), cy + rOuter * Math.sin(a0));
      ctx.arc(cx, cy, rOuter, a0, a1);
      ctx.lineTo(cx + rInner * Math.cos(a1), cy + rInner * Math.sin(a1));
      ctx.arc(cx, cy, rInner, a1, a0, true);
    } else {
      // Full pie wedge: center → arc → close.
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, rOuter, a0, a1);
    }
    ctx.closePath();
  };

  const draw = (ctx) => {
    if (!data || data.length === 0) return;
    let a0 = -Math.PI / 2;
    data.forEach((d, i) => {
      const a1 = a0 + (Math.max(0, d.y) / total) * Math.PI * 2;
      const wedgeColor = d.color || palette[i % palette.length];

      if (i === hoverIdx) {
        // Glow halo, then the wedge itself popped out slightly and brightened.
        _drawGlow((scale, alpha) => {
          ctx.fillStyle = _hexToRgba(wedgeColor, alpha);
          wedgePath(ctx, a0, a1, r * scale);
          ctx.fill();
        });
        ctx.fillStyle = _lighten(wedgeColor, 0.15);
        wedgePath(ctx, a0, a1, r * 1.04);
      } else {
        ctx.fillStyle = wedgeColor;
        wedgePath(ctx, a0, a1, r);
      }
      ctx.fill();
      a0 = a1;
    });
  };

  // Hit markers at each wedge's visual center (mid-angle, 60% out from inner
  // to outer radius) — sized to roughly match the wedge's on-screen footprint
  // so bigger slices get an easier-to-hover region and thin slivers don't
  // get an oversized one. Not a true wedge-shaped hitbox (rectangles can't
  // follow an arc), but it tracks the visible colored area closely enough
  // to feel right.
  let points = null;
  if (data && data.length > 0) {
    let a0 = -Math.PI / 2;
    points = data.map((d) => {
      const a1 = a0 + (Math.max(0, d.y) / total) * Math.PI * 2;
      const midA = (a0 + a1) / 2;
      const midR = rInner + (r - rInner) * 0.6;
      const span = Math.max(0, a1 - a0);
      const size = Math.min(56, Math.max(16, span * midR));
      const px = cx + midR * Math.cos(midA);
      const py = cy + midR * Math.sin(midA);
      a0 = a1;
      return { cx: px, cy: py, hx: px - size / 2, hy: py - size / 2, hw: size, hh: size, label: String(d.x), value: d.y, raw: d };
    });
  }

  const chart = React.createElement(_ChartWithTooltip, {
    width, height, draw, points, showTooltip, onPointPress, hoverIdx, setHoverIdx,
    deps: [data, width, height, innerRadius, palette, hoverIdx],
  });
  if (!showLegend || !data || !data.length) return chart;

  const legendItems = data.map((d, i) => ({ label: d.x, color: d.color || palette[i % palette.length] }));
  return React.createElement(
    View, { style: { width } },
    chart,
    React.createElement(Legend, { items: legendItems, style: { marginTop: 10, justifyContent: 'center' } }),
  );
}

export { DEFAULT_PALETTE };
