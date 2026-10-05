import React, { useEffect, useRef, useState } from 'react';
import { PHASES, cost, fmtMs, otherTime, type Frame } from './model';

interface Props {
  frames: Frame[];
  budgetMs: number;
  selected: number | null;          // frame seq
  onSelect: (seq: number) => void;
  theme: string;                    // redraw on theme change
  /** How long no frame has arrived (live only); ≥1 s shows an idle band. */
  idleMs?: number;
}

/** Width of the idle band drawn after the newest frame. */
const IDLE_W = 96;

const BAR = 5;       // px per frame (bar + gap)
/** A frame that followed at least this much quiet gets an idle marker. */
export const IDLE_GAP_MS = 500;
const GAP = 1;
const PAD_TOP = 14;
const PAD_BOTTOM = 18;

/** Stacked bar per frame (JS / layout / render / present), newest on the
 *  right. Colours come from the design tokens; slow frames are outlined in
 *  the error colour, full redraws get a dot under the bar (so partial vs full
 *  doesn't rely on colour). Canvas, so long recordings stay cheap. */
export function FrameChart({ frames, budgetMs, selected, onSelect, theme, idleMs = 0 }: Props) {
  const idle = idleMs >= 1000 ? Math.floor(idleMs / 1000) : 0;
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [size, setSize] = useState({ w: 800, h: 220 });
  const [hover, setHover] = useState<{ i: number; x: number; y: number } | null>(null);

  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Which frames fit: the newest ones.
  // While idle, the newest frames make room for the idle band on the right.
  const capacity = Math.max(1, Math.floor((size.w - (idle ? IDLE_W : 0)) / BAR));
  const start = Math.max(0, frames.length - capacity);
  const shown = frames.slice(start);
  // Vertical scale: at least 2× budget, or the costliest shown frame.
  const maxMs = Math.max(budgetMs * 2, ...shown.map(cost), 1);

  useEffect(() => {
    const c = canvas.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.floor(size.w * dpr);
    c.height = Math.floor(size.h * dpr);
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const tok = (name: string) => css.getPropertyValue(name).trim() || '#888';
    const plotH = size.h - PAD_TOP - PAD_BOTTOM;
    const y = (ms: number) => PAD_TOP + plotH - (ms / maxMs) * plotH;

    g.clearRect(0, 0, size.w, size.h);
    // Grid: budget line + 2× budget.
    g.font = '10px system-ui, sans-serif';
    for (const [ms, strong] of [[budgetMs, true], [budgetMs * 2, false]] as const) {
      if (ms > maxMs) continue;
      g.strokeStyle = strong ? tok('--gx-error') : tok('--gx-border-strong');
      g.globalAlpha = strong ? 0.7 : 0.6;
      g.setLineDash(strong ? [4, 3] : [2, 4]);
      g.beginPath(); g.moveTo(0, y(ms) + 0.5); g.lineTo(size.w, y(ms) + 0.5); g.stroke();
      g.setLineDash([]);
      g.globalAlpha = 1;
      g.fillStyle = tok('--gx-text-tertiary');
      g.fillText(`${ms.toFixed(1)} ms`, 4, y(ms) - 3);
    }

    shown.forEach((f, k) => {
      const x = k * BAR;
      // The app sat idle before this frame (it draws only on change).
      if (k > 0 && f.frameTime >= IDLE_GAP_MS) {
        g.strokeStyle = tok('--gx-text-tertiary');
        g.setLineDash([2, 3]);
        g.beginPath(); g.moveTo(x - 0.5, PAD_TOP); g.lineTo(x - 0.5, PAD_TOP + plotH); g.stroke();
        g.setLineDash([]);
      }
      let top = PAD_TOP + plotH;
      // The bar is the frame's own cost: the four phases, then "other".
      const other = otherTime(f);
      for (const ph of PHASES) {
        const h = (f[ph.key] / maxMs) * plotH;
        g.fillStyle = tok(ph.token);
        g.fillRect(x, top - h, BAR - GAP, h);
        top -= h;
      }
      if (other > 0) {
        const h = (other / maxMs) * plotH;
        g.fillStyle = tok('--gx-border-strong');
        g.fillRect(x, top - h, BAR - GAP, h);
      }
      if (cost(f) > budgetMs) {
        g.strokeStyle = tok('--gx-error');
        g.lineWidth = 1;
        g.strokeRect(x + 0.5, y(cost(f)) + 0.5, BAR - GAP - 1, PAD_TOP + plotH - y(cost(f)) - 1);
      }
      if (!f.partial) {
        g.fillStyle = tok('--gx-text-tertiary');
        g.fillRect(x + (BAR - GAP) / 2 - 1, size.h - PAD_BOTTOM + 5, 2, 2);
      }
      if (f.seq === selected) {
        g.strokeStyle = tok('--gx-action-primary');
        g.lineWidth = 2;
        g.strokeRect(x - 1, PAD_TOP - 2, BAR + 1, plotH + 4);
      }
    });

    // Idle: a hatched band after the newest frame, so a quiet app reads as
    // "idle", not "stuck".
    if (idle) {
      const x0 = shown.length * BAR + 2;
      const w = Math.min(IDLE_W, size.w - x0);
      if (w > 20) {
        g.save();
        g.beginPath(); g.rect(x0, PAD_TOP, w, plotH); g.clip();
        g.fillStyle = tok('--gx-bg-inset');
        g.fillRect(x0, PAD_TOP, w, plotH);
        g.strokeStyle = tok('--gx-border-strong');
        g.lineWidth = 1;
        for (let k = -plotH; k < w; k += 8) { g.beginPath(); g.moveTo(x0 + k, PAD_TOP + plotH); g.lineTo(x0 + k + plotH, PAD_TOP); g.stroke(); }
        g.restore();
        g.fillStyle = tok('--gx-text-secondary');
        g.font = '600 12px system-ui, sans-serif';
        g.textAlign = 'center';
        const cx = x0 + w / 2, cy = PAD_TOP + plotH / 2;
        g.fillText('Idle', cx, cy - 4);
        g.font = '11px system-ui, sans-serif';
        g.fillText(idle < 60 ? `${idle} s` : `${Math.floor(idle / 60)} min ${idle % 60} s`, cx, cy + 12);
        g.textAlign = 'start';
      }
    }
  }, [shown, size, maxMs, budgetMs, selected, theme, idle]);

  const at = (e: React.MouseEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    const i = Math.floor((e.clientX - r.left) / BAR);
    return i >= 0 && i < shown.length ? { i, x: e.clientX - r.left, y: e.clientY - r.top } : null;
  };
  const hovered = hover ? shown[hover.i] : null;

  return (
    <div className="chart" ref={box}>
      <canvas
        ref={canvas}
        style={{ width: size.w, height: size.h }}
        role="img"
        aria-label={`Frame chart: ${shown.length} frames, budget ${budgetMs.toFixed(1)} ms${idle ? `, idle for ${idle} s` : ''}`}
        onMouseMove={(e) => setHover(at(e))}
        onMouseLeave={() => setHover(null)}
        onClick={(e) => { const h = at(e); if (h) onSelect(shown[h.i].seq); }}
      />
      {shown.length === 0 && <div className="chart-empty muted">No frames yet. The app renders only when something changes: interact with it.</div>}
      {hovered && hover && (
        <div className="chart-tip" style={{ left: Math.min(hover.x + 12, size.w - 190), top: Math.max(4, hover.y - 110) }}>
          <div className="tip-title">Frame {hovered.seq} · {fmtMs(cost(hovered))}</div>
          {PHASES.map((ph) => (
            <div key={ph.key} className="tip-row"><span className="dot" style={{ background: `var(${ph.token})` }} />{ph.label}<span>{fmtMs(hovered[ph.key])}</span></div>
          ))}
          <div className="tip-row muted">{hovered.partial ? 'partial redraw' : 'full redraw'} · {hovered.animating} animating</div>
        </div>
      )}
    </div>
  );
}
