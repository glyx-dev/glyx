import React, { useEffect, useRef, useState } from 'react';
import { formatBytes, type Marker, type Sample } from './model';

export interface Series {
  key: string;
  label: string;
  token: string;          // CSS custom property for the colour
  value: (s: Sample) => number;
  dashed?: boolean;
}

interface Props {
  samples: Sample[];
  series: Series[];
  markers: Marker[];
  format: (n: number) => string;
  height: number;
  theme: string;
  label: string;
}

/** Lines over time (oldest left), shared y scale, with GC / leak / snapshot
 *  markers as vertical lines. Canvas: 10 minutes of samples stay cheap. */
export function MemoryChart({ samples, series, markers, format, height, theme, label }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [w, setW] = useState(800);
  const [hover, setHover] = useState<number | null>(null);

  useEffect(() => {
    const el = box.current!;
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const PAD_L = 64, PAD_R = 12, PAD_T = 10, PAD_B = 18;
  const t0 = samples[0]?.timestamp ?? 0;
  const t1 = samples[samples.length - 1]?.timestamp ?? 1;
  const span = Math.max(1, t1 - t0);
  const max = Math.max(1, ...samples.flatMap((s) => series.map((se) => se.value(s)))) * 1.1;
  const x = (t: number) => PAD_L + ((t - t0) / span) * (w - PAD_L - PAD_R);
  const y = (v: number) => PAD_T + (1 - v / max) * (height - PAD_T - PAD_B);

  useEffect(() => {
    const c = canvas.current!;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.floor(w * dpr); c.height = Math.floor(height * dpr);
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    const css = getComputedStyle(document.documentElement);
    const tok = (n: string) => css.getPropertyValue(n).trim() || '#888';
    g.clearRect(0, 0, w, height);
    g.font = '10px system-ui, sans-serif';

    // Grid: 4 lines with values.
    for (let i = 0; i <= 3; i++) {
      const v = (max / 1.1) * (i / 3);
      g.strokeStyle = tok('--gx-border-default');
      g.beginPath(); g.moveTo(PAD_L, Math.round(y(v)) + 0.5); g.lineTo(w - PAD_R, Math.round(y(v)) + 0.5); g.stroke();
      g.fillStyle = tok('--gx-text-tertiary');
      g.fillText(format(v), 4, y(v) + 3);
    }
    // Markers.
    for (const m of markers) {
      if (m.timestamp < t0 || m.timestamp > t1) continue;
      g.strokeStyle = tok(m.kind === 'gc' ? '--gx-success' : m.kind === 'leak' ? '--gx-warning' : '--gx-link');
      g.setLineDash(m.kind === 'snapshot' ? [3, 3] : []);
      g.beginPath(); g.moveTo(Math.round(x(m.timestamp)) + 0.5, PAD_T); g.lineTo(Math.round(x(m.timestamp)) + 0.5, height - PAD_B); g.stroke();
      g.setLineDash([]);
    }
    // Lines.
    if (samples.length > 1) {
      for (const se of series) {
        g.strokeStyle = tok(se.token);
        g.lineWidth = 1.6;
        g.setLineDash(se.dashed ? [4, 3] : []);
        g.beginPath();
        samples.forEach((s, i) => { const px = x(s.timestamp), py = y(se.value(s)); if (i) g.lineTo(px, py); else g.moveTo(px, py); });
        g.stroke();
      }
      g.setLineDash([]);
    }
    if (hover != null && samples[hover]) {
      const px = x(samples[hover].timestamp);
      g.strokeStyle = tok('--gx-border-strong');
      g.beginPath(); g.moveTo(Math.round(px) + 0.5, PAD_T); g.lineTo(Math.round(px) + 0.5, height - PAD_B); g.stroke();
    }
    // Time axis: seconds ago.
    g.fillStyle = tok('--gx-text-tertiary');
    const secs = Math.round(span / 1000);
    g.fillText(`${secs}s ago`, PAD_L, height - 4);
    g.fillText('now', w - PAD_R - 18, height - 4);
  }, [samples, series, markers, w, height, max, hover, theme]);

  const onMove = (e: React.MouseEvent) => {
    if (!samples.length) return;
    const r = canvas.current!.getBoundingClientRect();
    const t = t0 + ((e.clientX - r.left - PAD_L) / (w - PAD_L - PAD_R)) * span;
    let best = 0;
    samples.forEach((s, i) => { if (Math.abs(s.timestamp - t) < Math.abs(samples[best].timestamp - t)) best = i; });
    setHover(best);
  };
  const hs = hover != null ? samples[hover] : null;

  return (
    <div className="mchart" ref={box}>
      <canvas ref={canvas} style={{ width: w, height }} role="img" aria-label={label}
        onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
      {samples.length < 2 && <div className="chart-empty muted">Collecting samples…</div>}
      {hs && (
        <div className="chart-tip" style={{ left: Math.min(x(hs.timestamp) + 10, w - 200), top: 8 }}>
          <div className="tip-title">{new Date(hs.timestamp).toLocaleTimeString()}</div>
          {series.map((se) => (
            <div key={se.key} className="tip-row"><span className="dot" style={{ background: `var(${se.token})` }} />{se.label}<span>{format(se.value(hs))}</span></div>
          ))}
        </div>
      )}
    </div>
  );
}

export const bytes = formatBytes;
