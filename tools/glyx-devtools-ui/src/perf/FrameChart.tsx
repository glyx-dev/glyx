import React, { useEffect, useRef, useState } from 'react';
import { PHASES, cost, fmtMs, otherTime, type Frame } from './model';

interface Props {
  frames: Frame[];
  budgetMs: number;
  selected: number | null;          // frame seq
  onSelect: (seq: number) => void;
  theme: string;                    // redraw on theme change
}

const BAR = 5;       // px per frame (bar + gap)
const GAP = 1;
const PAD_TOP = 14;
const PAD_BOTTOM = 18;

/** Stacked bar per frame (JS / layout / render / present), newest on the
 *  right. Colours come from the design tokens; slow frames are outlined in
 *  the error colour, full redraws get a dot under the bar (so partial vs full
 *  doesn't rely on colour). Canvas, so long recordings stay cheap. */
export function FrameChart({ frames, budgetMs, selected, onSelect, theme }: Props) {
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
  const capacity = Math.max(1, Math.floor(size.w / BAR));
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
  }, [shown, size, maxMs, budgetMs, selected, theme]);

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
        aria-label={`Frame chart: ${shown.length} frames, budget ${budgetMs.toFixed(1)} ms`}
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
