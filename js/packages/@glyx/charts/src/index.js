// @glyx-dev/charts — GPU-rendered charts on Glyx Canvas 2D.
//
// Built entirely on the Canvas path API (fill/stroke/arc) + fillText. No DOM,
// no SVG. Charts redraw only when their props change (not per-frame), so they
// cost nothing while idle.
//
// Usage:
//   import { LineChart, BarChart, PieChart, AreaChart } from '@glyx-dev/charts';
//   <LineChart data={[{x:'Jan',y:10},…]} width={600} height={300} />

import React from 'react';
import { Canvas, View, Text, Pressable } from '@glyx-dev/react';

const { useRef, useEffect, useState } = React;

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

// ── Tooltips ──────────────────────────────────────────────────────────────────
//
// There's no continuous hover-move event in the framework (only onHoverIn/
// onHoverOut enter/leave transitions), so tooltips can't track "nearest point
// to the cursor" the way a DOM chart library would. Instead: one small
// invisible Pressable hit-region per data point/bar/wedge, absolutely
// positioned over the canvas — hovering one shows its own tooltip. This is
// discrete-per-point, not continuous, but it's a real, working hover
// interaction rather than a synthesized approximation.

function _TooltipOverlay({ width, height, points, hitRadius = 10 }) {
  const [hoverIdx, setHoverIdx] = useState(null);
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

// Wraps a chart's canvas + optional tooltip hit-regions in a relatively-
// positioned container so the tooltip overlay can be absolutely positioned
// against it.
function _ChartWithTooltip({ width, height, draw, deps, points, showTooltip }) {
  return React.createElement(
    View,
    { style: { width, height, position: 'relative' } },
    React.createElement(_ChartCanvas, { width, height, draw, deps }),
    showTooltip && points && points.length > 0
      ? React.createElement(_TooltipOverlay, { width, height, points })
      : null,
  );
}

// ── LineChart / AreaChart ─────────────────────────────────────────────────────

// Computes the pixel-space layout (padding, scales, toX/toY) once, shared by
// both the draw pass and the tooltip hit-point pass — so hit regions always
// agree exactly with what's actually drawn.
function _lineLayout({ data, width, height, showLabels }) {
  const PAD = { top: 16, right: 16, bottom: showLabels ? 34 : 12, left: showLabels ? 46 : 12 };
  const W = width - PAD.left - PAD.right;
  const H = height - PAD.top - PAD.bottom;
  const ys = data.map((d) => d.y);
  let minY = Math.min(0, ...ys);
  let maxY = Math.max(...ys);
  if (maxY === minY) maxY = minY + 1;
  const range = maxY - minY;
  const toX = (i) => PAD.left + (data.length === 1 ? W / 2 : (i / (data.length - 1)) * W);
  const toY = (y) => PAD.top + H - ((y - minY) / range) * H;
  return { PAD, W, H, toX, toY };
}

function _lineLikePoints(data, layout) {
  const { toX, toY } = layout;
  return data.map((d, i) => ({ cx: toX(i), cy: toY(d.y), label: String(d.x), value: d.y }));
}

function _lineLike({ data, width, height, color, lineWidth, area, showGrid, showDots, showLabels }) {
  return (ctx) => {
    if (!data || data.length === 0) return;
    const { PAD, W, H, toX, toY } = _lineLayout({ data, width, height, showLabels });

    if (showGrid) {
      ctx.strokeStyle = GRID; ctx.lineWidth = 1;
      for (let i = 0; i <= 4; i++) {
        const y = PAD.top + (H / 4) * i;
        ctx.strokeLine(PAD.left, y, PAD.left + W, y);
      }
    }
    if (showLabels) {
      ctx.fillStyle = LABEL;
      for (let i = 0; i <= 4; i++) {
        const value = maxY - (range / 4) * i;
        ctx.fillText(_fmt(value), 6, PAD.top + (H / 4) * i - 6, 11);
      }
      const step = Math.ceil(data.length / 8);
      data.forEach((d, i) => {
        if (i % step !== 0) return;
        ctx.fillText(String(d.x), toX(i) - 10, height - 16, 11);
      });
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
  };
}

export function LineChart({
  data, width = 480, height = 260, color = DEFAULT_PALETTE[0],
  lineWidth = 2, showGrid = true, showDots = true, showLabels = true,
  showTooltip = true,
}) {
  const draw = _lineLike({ data, width, height, color, lineWidth, area: false, showGrid, showDots, showLabels });
  const points = data && data.length ? _lineLikePoints(data, _lineLayout({ data, width, height, showLabels })) : null;
  return React.createElement(_ChartWithTooltip, {
    width, height, draw, points, showTooltip,
    deps: [data, width, height, color, lineWidth, showGrid, showDots, showLabels],
  });
}

export function AreaChart({
  data, width = 480, height = 260, color = DEFAULT_PALETTE[0],
  lineWidth = 2, showGrid = true, showLabels = true,
  showTooltip = true,
}) {
  const draw = _lineLike({ data, width, height, color, lineWidth, area: true, showGrid, showDots: false, showLabels });
  const points = data && data.length ? _lineLikePoints(data, _lineLayout({ data, width, height, showLabels })) : null;
  return React.createElement(_ChartWithTooltip, {
    width, height, draw, points, showTooltip,
    deps: [data, width, height, color, lineWidth, showGrid, showLabels],
  });
}

// ── BarChart ──────────────────────────────────────────────────────────────────

export function BarChart({
  data, width = 480, height = 260, color = DEFAULT_PALETTE[1],
  showGrid = true, showLabels = true, showTooltip = true,
}) {
  // Shared by draw + hit-region pass so tooltips line up exactly with bars.
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
    if (showLabels) {
      ctx.fillStyle = LABEL;
      for (let i = 0; i <= 4; i++) {
        ctx.fillText(_fmt(maxY - (maxY / 4) * i), 6, PAD.top + (H / 4) * i - 6, 11);
      }
    }
    data.forEach((d, i) => {
      const h = (d.y / maxY) * H;
      const x = PAD.left + slot * i + (slot - bw) / 2;
      const y = PAD.top + H - h;
      ctx.fillStyle = d.color || color;
      ctx.fillRect(x, y, bw, h);
      if (showLabels) {
        ctx.fillStyle = LABEL;
        ctx.fillText(String(d.x), x, height - 16, 11);
      }
    });
  };

  const points = layout ? data.map((d, i) => {
    const { PAD, H, maxY, slot, bw } = layout;
    const h = (d.y / maxY) * H;
    const x = PAD.left + slot * i + (slot - bw) / 2;
    const y = PAD.top + H - h;
    return { cx: x + bw / 2, cy: y, hx: x, hy: y, hw: bw, hh: h, label: String(d.x), value: d.y };
  }) : null;

  return React.createElement(_ChartWithTooltip, {
    width, height, draw, points, showTooltip,
    deps: [data, width, height, color, showGrid, showLabels],
  });
}

// ── PieChart / Donut ──────────────────────────────────────────────────────────

export function PieChart({
  data, width = 260, height = 260, palette = DEFAULT_PALETTE,
  innerRadius = 0, // > 0 → donut (fraction of radius, 0–1)
  showTooltip = true,
}) {
  const cx = width / 2, cy = height / 2;
  const r = Math.min(width, height) / 2 - 8;
  const rInner = innerRadius > 0 ? r * Math.min(0.95, innerRadius) : 0;
  const total = data && data.length ? (data.reduce((s, d) => s + Math.max(0, d.y), 0) || 1) : 1;

  const draw = (ctx) => {
    if (!data || data.length === 0) return;
    let a0 = -Math.PI / 2;
    data.forEach((d, i) => {
      const a1 = a0 + (Math.max(0, d.y) / total) * Math.PI * 2;
      ctx.beginPath();
      if (rInner > 0) {
        // Ring wedge: outer arc a0→a1, in to the inner radius, inner arc
        // a1→a0 (reversed), close — leaves the center genuinely transparent
        // instead of painting a hardcoded color over it.
        ctx.moveTo(cx + rInner * Math.cos(a0), cy + rInner * Math.sin(a0));
        ctx.lineTo(cx + r * Math.cos(a0), cy + r * Math.sin(a0));
        ctx.arc(cx, cy, r, a0, a1);
        ctx.lineTo(cx + rInner * Math.cos(a1), cy + rInner * Math.sin(a1));
        ctx.arc(cx, cy, rInner, a1, a0, true);
      } else {
        // Full pie wedge: center → arc → close.
        ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, r, a0, a1);
      }
      ctx.closePath();
      ctx.fillStyle = d.color || palette[i % palette.length];
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
      return { cx: px, cy: py, hx: px - size / 2, hy: py - size / 2, hw: size, hh: size, label: String(d.x), value: d.y };
    });
  }

  return React.createElement(_ChartWithTooltip, {
    width, height, draw, points, showTooltip,
    deps: [data, width, height, innerRadius, palette],
  });
}

export { DEFAULT_PALETTE };
