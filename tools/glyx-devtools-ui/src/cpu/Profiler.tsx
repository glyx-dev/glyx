import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ConnStatus, RelayClient } from '../relay';
import {
  commitBoxes, componentTotals, flameSpans, formatMs, functionTotals, SPECIAL,
  type ComponentRecording, type CpuProfile, type Span,
} from './model';
import { mapProfile, type SourceMap } from './sourcemap';

interface Props { client: RelayClient; status: ConnStatus; windowId: number | undefined; theme: string }

interface Result {
  engine: string;
  durationMs: number;
  cpuProfile: CpuProfile | null;
  jsSamplingError: string | null;
  components: ComponentRecording | null;
  /** The app bundle's source map and script name, to map frames to source files. */
  sourceMap?: SourceMap | null;
  bundleUrl?: string;
}

type Tab = 'flame' | 'functions' | 'components';

const INTERVALS = [
  { us: 100, label: 'Fine (0.1 ms)' },
  { us: 250, label: 'Normal (0.25 ms)' },
  { us: 1000, label: 'Light (1 ms)' },
];

export function Profiler({ client, status, windowId, theme }: Props) {
  const connected = status.state === 'connected';
  const [recording, setRecording] = useState<number | null>(null); // start time
  const [now, setNow] = useState(Date.now());
  const [interval, setIntervalUs] = useState(250);
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('flame');
  const engine = status.handshake?.engine;

  // Pick up a recording this or another DevTools window already started.
  useEffect(() => {
    if (!connected) { setRecording(null); return; }
    client.call<any>('Profiler.getStatus').then((r) => {
      const rec = r.result?.recording;
      setRecording(rec ? Date.now() - rec.elapsedMs : null);
    });
  }, [client, connected]);
  useEffect(() => {
    if (recording == null) return;
    const t = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(t);
  }, [recording]);

  const start = async () => {
    setError(null);
    const r = await client.call<any>('Profiler.start', { intervalUs: interval }, windowId);
    if (r.error) { setError(r.error.message); return; }
    setRecording(Date.now());
  };
  const stop = async () => {
    const r = await client.call<Result>('Profiler.stop', {}, windowId);
    setRecording(null);
    if (r.error) { setError(r.error.message); return; }
    const res = r.result!;
    if (res.cpuProfile && res.bundleUrl) res.cpuProfile = mapProfile(res.cpuProfile, res.sourceMap, res.bundleUrl);
    setResult(res);
    setTab(r.result!.cpuProfile ? 'flame' : 'components');
  };

  return (
    <div className="cpu">
      <div className="toolbar">
        {recording == null
          ? <button className="button small primary" onClick={start} disabled={!connected}><span className="rec-dot" />Record</button>
          : <button className="button small" onClick={stop}><span className="stop-square" />Stop</button>}
        {recording != null && <span className="small mono">{formatMs(now - recording)}</span>}
        <label className="small muted">Sampling
          <select className="select small" value={interval} onChange={(e) => setIntervalUs(+e.target.value)} disabled={recording != null} aria-label="Sampling interval">
            {INTERVALS.map((i) => <option key={i.us} value={i.us}>{i.label}</option>)}
          </select>
        </label>
        <div className="topbar-spacer" />
        {engine && <span className="small muted">{engine === 'V8' ? 'JS sampling + component renders' : `${engine}: component renders (JS sampling needs V8)`}</span>}
      </div>
      {error && <div className="hint err">{error}</div>}

      {recording != null && <p className="pad muted">Recording… use the app, then press Stop.</p>}
      {recording == null && !result && (
        <div className="empty">
          <div className="empty-badge">CPU</div>
          <p>Record while you use the app to see where the time goes.</p>
          <p className="muted small">
            <strong>Flame chart</strong> and <strong>Functions</strong> show sampled JavaScript (V8).{' '}
            <strong>Components</strong> shows which React components rendered on each commit and how long each took (every engine).
          </p>
        </div>
      )}

      {recording == null && result && (
        <>
          <div className="tabs" role="tablist">
            {(['flame', 'functions', 'components'] as Tab[]).map((t) => (
              <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                {t === 'flame' ? 'Flame chart' : t === 'functions' ? 'Functions' : 'Components'}
              </button>
            ))}
            <div className="topbar-spacer" />
            <span className="small muted pad-x">{formatMs(result.durationMs)} recorded · {result.engine}</span>
          </div>
          <div className="cpu-body">
            {tab === 'flame' && (result.cpuProfile ? <Flame profile={result.cpuProfile} theme={theme} /> : <NoSampling reason={result.jsSamplingError} />)}
            {tab === 'functions' && (result.cpuProfile ? <Functions profile={result.cpuProfile} /> : <NoSampling reason={result.jsSamplingError} />)}
            {tab === 'components' && <Components rec={result.components} />}
          </div>
        </>
      )}
    </div>
  );
}

function NoSampling({ reason }: { reason: string | null }) {
  return (
    <div className="pad">
      <p>No JavaScript samples for this recording.</p>
      <p className="muted small">{reason ?? 'The engine did not provide a CPU profile.'} The <strong>Components</strong> tab still shows render times.</p>
    </div>
  );
}

// ── Flame chart ──────────────────────────────────────────────────────────────

const ROW = 18;

function cssVar(name: string) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); }

function Flame({ profile, theme }: { profile: CpuProfile; theme: string }) {
  const { spans, duration } = useMemo(() => flameSpans(profile), [profile]);
  const depth = useMemo(() => spans.reduce((d, s) => Math.max(d, s.depth + 1), 0), [spans]);
  const canvas = useRef<HTMLCanvasElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [view, setView] = useState({ from: 0, to: duration || 1 });
  const [hover, setHover] = useState<{ s: Span; x: number; y: number } | null>(null);
  const [picked, setPicked] = useState<Span | null>(null);
  const [width, setWidth] = useState(800);
  const drag = useRef<{ x: number; from: number; to: number } | null>(null);

  useEffect(() => setView({ from: 0, to: duration || 1 }), [duration]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const toX = (t: number) => ((t - view.from) / (view.to - view.from)) * width;
  const toT = (x: number) => view.from + (x / width) * (view.to - view.from);

  useEffect(() => {
    const c = canvas.current;
    if (!c) return;
    const dpr = window.devicePixelRatio || 1;
    const h = Math.max(1, depth) * ROW + 20;
    c.width = width * dpr; c.height = h * dpr;
    c.style.width = `${width}px`; c.style.height = `${h}px`;
    const g = c.getContext('2d')!;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, width, h);
    // Time axis.
    g.fillStyle = cssVar('--gx-text-tertiary');
    g.font = '10px system-ui, sans-serif';
    const step = niceStep((view.to - view.from) / 8);
    for (let t = Math.ceil(view.from / step) * step; t <= view.to; t += step) {
      const x = toX(t);
      g.fillRect(x, 14, 1, 4);
      g.fillText(formatMs(t), x + 2, 10);
    }
    const colors = [cssVar('--gx-amber-500'), cssVar('--gx-amber-300'), cssVar('--gx-violet-400'), cssVar('--gx-violet-200')];
    const special = cssVar('--gx-neutral-400');
    const text = '#111';
    for (const s of spans) {
      const x0 = toX(s.start), x1 = toX(s.end);
      if (x1 < 0 || x0 > width || x1 - x0 < 0.5) continue;
      const x = Math.max(0, x0), w = Math.min(width, x1) - x;
      const y = 20 + s.depth * ROW;
      g.fillStyle = SPECIAL.has(s.name) ? special : colors[hash(s.name) % colors.length];
      g.globalAlpha = picked && picked.name !== s.name ? 0.45 : 1;
      g.fillRect(x, y, Math.max(1, w - 1), ROW - 1);
      if (w > 30) {
        g.fillStyle = text;
        g.fillText(clipText(g, label(s), w - 6), x + 3, y + 12);
      }
    }
    g.globalAlpha = 1;
  }, [spans, depth, view, width, theme, picked]);

  const spanAt = (x: number, y: number) => {
    const d = Math.floor((y - 20) / ROW);
    const t = toT(x);
    return spans.find((s) => s.depth === d && s.start <= t && t < s.end) ?? null;
  };
  const onMove = (e: React.MouseEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    const x = e.clientX - r.left, y = e.clientY - r.top;
    if (drag.current) {
      const dt = ((drag.current.x - x) / width) * (drag.current.to - drag.current.from);
      const span = drag.current.to - drag.current.from;
      const from = Math.min(Math.max(0, drag.current.from + dt), duration - span);
      setView({ from, to: from + span });
      return;
    }
    const s = spanAt(x, y);
    setHover(s ? { s, x, y } : null);
  };
  const onWheel = (e: React.WheelEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    const t = toT(e.clientX - r.left);
    const k = e.deltaY > 0 ? 1.25 : 0.8;
    const from = Math.max(0, t - (t - view.from) * k);
    const to = Math.min(duration, t + (view.to - t) * k);
    if (to - from > 0.05) setView({ from, to });
  };
  const totals = useMemo(() => functionTotals(profile), [profile]);
  const pickedTotal = picked && totals.find((f) => f.name === picked.name && f.location === picked.location);

  return (
    <div className="flame" ref={box}>
      <div className="flame-tools small muted">
        Scroll to zoom, drag to pan.
        {(view.from > 0 || view.to < duration) && <button className="button small" onClick={() => setView({ from: 0, to: duration })}>Reset zoom</button>}
      </div>
      <div className="flame-canvas-wrap">
        <canvas
          ref={canvas}
          onMouseMove={onMove}
          onMouseLeave={() => { setHover(null); drag.current = null; }}
          onMouseDown={(e) => { const r = canvas.current!.getBoundingClientRect(); drag.current = { x: e.clientX - r.left, ...view }; }}
          onMouseUp={(e) => {
            const r = canvas.current!.getBoundingClientRect();
            const moved = drag.current && Math.abs(drag.current.x - (e.clientX - r.left)) > 3;
            drag.current = null;
            if (!moved) setPicked(spanAt(e.clientX - r.left, e.clientY - r.top));
          }}
          onWheel={onWheel}
          aria-label="JavaScript flame chart"
        />
        {hover && (
          <div className="flame-tip" style={{ left: Math.min(hover.x + 12, width - 240), top: hover.y + 14 }}>
            <strong>{label(hover.s)}</strong> {formatMs(hover.s.end - hover.s.start)}
            {hover.s.location && <div className="muted mono">{hover.s.location}</div>}
          </div>
        )}
      </div>
      {picked && (
        <div className="pad small">
          <strong>{picked.name}</strong> <span className="muted mono">{picked.location}</span>
          {pickedTotal && <span> · self {formatMs(pickedTotal.self)} · total {formatMs(pickedTotal.total)} over the recording</span>}
        </div>
      )}
      {spans.length === 0 && <p className="pad muted">No JavaScript ran while recording (only idle time).</p>}
    </div>
  );
}

/** Unnamed functions are best known by where they are. */
function label(s: Span) {
  return s.name === '(anonymous)' && s.location ? `${s.location} (anonymous)` : s.name;
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1e-6))));
  for (const m of [1, 2, 5, 10]) if (m * p >= raw) return m * p;
  return 10 * p;
}
function hash(s: string) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }
function clipText(g: CanvasRenderingContext2D, s: string, w: number) {
  if (g.measureText(s).width <= w) return s;
  let lo = 0, hi = s.length;
  while (lo < hi) { const mid = (lo + hi + 1) >> 1; if (g.measureText(s.slice(0, mid) + '…').width <= w) lo = mid; else hi = mid - 1; }
  return lo ? s.slice(0, lo) + '…' : '';
}

// ── Functions (bottom-up) ────────────────────────────────────────────────────

function Functions({ profile }: { profile: CpuProfile }) {
  const [search, setSearch] = useState('');
  const [hideSpecial, setHideSpecial] = useState(true);
  const all = useMemo(() => functionTotals(profile), [profile]);
  const busy = all.filter((f) => f.name !== '(idle)').reduce((n, f) => n + f.self, 0) || 1;
  const rows = all.filter((f) => (!hideSpecial || !f.special) && (!search || f.name.toLowerCase().includes(search.toLowerCase())));
  return (
    <div className="functions">
      <div className="toolbar">
        <input className="search" type="search" placeholder="Filter functions" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Filter functions" />
        <label className="check"><input type="checkbox" checked={hideSpecial} onChange={(e) => setHideSpecial(e.target.checked)} />Hide idle, program and GC</label>
      </div>
      <table className="table cpu-table">
        <thead><tr><th>Function</th><th>Where</th><th className="num">Self</th><th className="num">Total</th></tr></thead>
        <tbody>
          {rows.slice(0, 300).map((f) => (
            <tr key={f.key}>
              <td className="mono">{f.name}</td>
              <td className="muted mono" title={f.location}>{f.location}</td>
              <td className="num"><Bar v={f.self / busy} />{formatMs(f.self)}</td>
              <td className="num">{formatMs(f.total)} <span className="muted">{Math.round((f.total / busy) * 100)}%</span></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Bar({ v }: { v: number }) {
  return <span className="self-bar" style={{ width: `${Math.max(1, Math.min(1, v) * 60)}px` }} />;
}

// ── Components (React renders, every engine) ─────────────────────────────────

function Components({ rec }: { rec: ComponentRecording | null }) {
  const commits = rec?.commits ?? [];
  const [sel, setSel] = useState(0);
  const [mine, setMine] = useState(true);
  useEffect(() => {
    // Start on the slowest commit.
    let worst = 0;
    commits.forEach((c, i) => { if (c.duration > (commits[worst]?.duration ?? 0)) worst = i; });
    setSel(worst);
  }, [rec]);
  const ranked = useMemo(() => componentTotals(commits).filter((c) => !mine || !c.library), [commits, mine]);
  if (!rec) return <p className="pad muted">Component timing isn't available (the app isn't using Glyx's React renderer with devtools on).</p>;
  if (!commits.length) return <p className="pad muted">Nothing re-rendered while recording.</p>;
  const max = Math.max(...commits.map((c) => c.duration), 0.001);
  const commit = commits[sel] ?? commits[0];
  const boxes = commitBoxes(commit);
  return (
    <div className="components-prof">
      <div className="commit-strip" role="listbox" aria-label="Commits">
        {commits.map((c, i) => (
          <button key={i} role="option" aria-selected={i === sel} className={`commit-bar${i === sel ? ' selected' : ''}`}
            style={{ height: `${Math.max(3, (c.duration / max) * 48)}px` }} onClick={() => setSel(i)}
            title={`Commit ${i + 1}: ${formatMs(c.duration)} at ${formatMs(c.at)}`} />
        ))}
      </div>
      <p className="small muted pad-x">
        Commit {sel + 1} of {commits.length}{rec.dropped ? ` (+${rec.dropped} older not kept)` : ''} · {formatMs(commit.duration)} rendering · at {formatMs(commit.at)}
      </p>
      <div className="commit-flame" style={{ height: `${(Math.max(0, ...commit.components.map((c) => c.depth)) + 1) * ROW + 4}px` }}>
        {boxes.map((b) => {
          const c = commit.components[b.i];
          return (
            <div key={b.i} className={`cf-box${c.library ? ' lib' : ''}${c.mount ? ' mount' : ''}`}
              style={{ left: `${b.x * 100}%`, width: `calc(${b.w * 100}% - 1px)`, top: `${b.depth * ROW}px` }}
              title={`${c.name}: ${formatMs(c.self)} self, ${formatMs(c.total)} with children${c.mount ? ' (first render)' : ''}`}>
              {c.name} <span className="muted">{formatMs(c.self)}</span>
            </div>
          );
        })}
      </div>
      <div className="toolbar">
        <strong className="small">Slowest components over the recording</strong>
        <label className="check"><input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />My components</label>
      </div>
      <table className="table cpu-table">
        <thead><tr><th>Component</th><th className="num">Renders</th><th className="num">Self (all)</th><th className="num">Slowest</th><th className="num">With children</th></tr></thead>
        <tbody>
          {ranked.slice(0, 200).map((c) => (
            <tr key={c.name}>
              <td className="mono">{c.name}</td>
              <td className="num">{c.renders}</td>
              <td className="num">{formatMs(c.self)}</td>
              <td className="num">{formatMs(c.max)}</td>
              <td className="num">{formatMs(c.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
