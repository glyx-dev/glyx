// @glyx/charts — GPU-rendered charts on Glyx Canvas 2D.
//
// Built entirely on the Canvas path API (fill/stroke/arc) + fillText. No DOM,
// no SVG. Charts redraw only when their props change (not per-frame), so they
// cost nothing while idle.
//
// Usage:
//   import { LineChart, BarChart, PieChart, AreaChart } from '@glyx/charts';
//   <LineChart data={[{x:'Jan',y:10},…]} width={600} height={300} />

import React from 'react';
import { Canvas } from '@glyx/react';

const { useRef, useEffect } = React;

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

// ── LineChart / AreaChart ─────────────────────────────────────────────────────

function _lineLike({ data, width, height, color, lineWidth, area, showGrid, showDots, showLabels }) {
  return (ctx) => {
    if (!data || data.length === 0) return;
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
}) {
  const draw = _lineLike({ data, width, height, color, lineWidth, area: false, showGrid, showDots, showLabels });
  return React.createElement(_ChartCanvas, { width, height, draw, deps: [data, width, height, color, lineWidth, showGrid, showDots, showLabels] });
}

export function AreaChart({
  data, width = 480, height = 260, color = DEFAULT_PALETTE[0],
  lineWidth = 2, showGrid = true, showLabels = true,
}) {
  const draw = _lineLike({ data, width, height, color, lineWidth, area: true, showGrid, showDots: false, showLabels });
  return React.createElement(_ChartCanvas, { width, height, draw, deps: [data, width, height, color, lineWidth, showGrid, showLabels] });
}

// ── BarChart ──────────────────────────────────────────────────────────────────

export function BarChart({
  data, width = 480, height = 260, color = DEFAULT_PALETTE[1],
  showGrid = true, showLabels = true,
}) {
  const draw = (ctx) => {
    if (!data || data.length === 0) return;
    const PAD = { top: 16, right: 16, bottom: showLabels ? 34 : 12, left: showLabels ? 46 : 12 };
    const W = width - PAD.left - PAD.right;
    const H = height - PAD.top - PAD.bottom;
    const maxY = Math.max(1, ...data.map((d) => d.y));
    const slot = W / data.length;
    const bw = slot * 0.62;

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
  return React.createElement(_ChartCanvas, { width, height, draw, deps: [data, width, height, color, showGrid, showLabels] });
}

// ── PieChart / Donut ──────────────────────────────────────────────────────────

export function PieChart({
  data, width = 260, height = 260, palette = DEFAULT_PALETTE,
  innerRadius = 0, // > 0 → donut (fraction of radius, 0–1)
}) {
  const draw = (ctx) => {
    if (!data || data.length === 0) return;
    const total = data.reduce((s, d) => s + Math.max(0, d.y), 0) || 1;
    const cx = width / 2, cy = height / 2;
    const r = Math.min(width, height) / 2 - 8;
    let a0 = -Math.PI / 2;
    data.forEach((d, i) => {
      const a1 = a0 + (Math.max(0, d.y) / total) * Math.PI * 2;
      // Wedge: center → arc → close (real filled path via arc()).
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, a0, a1);
      ctx.closePath();
      ctx.fillStyle = d.color || palette[i % palette.length];
      ctx.fill();
      a0 = a1;
    });
    // Donut hole.
    if (innerRadius > 0) {
      ctx.fillStyle = [20, 20, 26, 255];
      ctx.fillCircle(cx, cy, r * Math.min(0.95, innerRadius));
    }
  };
  return React.createElement(_ChartCanvas, { width, height, draw, deps: [data, width, height, innerRadius, palette] });
}

export { DEFAULT_PALETTE };
