import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ConnStatus, RelayClient } from '../relay';
import { FrameChart } from './FrameChart';
import { PHASES, cost, fmtMs, fromRecording, otherTime, summarize, toRecording, type Frame } from './model';
import { shortName } from '../inspector/model';

interface Props { client: RelayClient; status: ConnStatus; windowId: number | undefined; theme: string }

const LIVE_KEEP = 600;        // frames kept while watching live
const RECORD_KEEP = 20000;    // ~5 minutes at 60 fps

type Mode = 'live' | 'recording' | 'stopped';

interface Detail {
  found: boolean;
  damage?: [number, number, number, number] | null;
  dirtyCount?: number;
  removedSince?: number;
  dirty?: { nodeId: number; id?: string; component?: string; type: string; text?: string }[];
}

export function Performance({ client, status, windowId, theme }: Props) {
  const connected = status.state === 'connected';
  const [mode, setMode] = useState<Mode>('live');
  const [frames, setFrames] = useState<Frame[]>([]);
  const [budget, setBudget] = useState(16.667);
  const [selected, setSelected] = useState<number | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [flashing, setFlashing] = useState(false);
  const [imported, setImported] = useState<string | null>(null);
  const modeRef = useRef(mode);
  modeRef.current = mode;
  const fileInput = useRef<HTMLInputElement>(null);

  // Stream frames (with detail, for "why did this render") while live or recording.
  useEffect(() => {
    if (!connected || mode === 'stopped') return;
    const off = client.onEvent<Frame>('Performance.frame', (f) => {
      setFrames((all) => {
        const next = [...all, f];
        const keep = modeRef.current === 'recording' ? RECORD_KEEP : LIVE_KEEP;
        return next.length > keep ? next.slice(next.length - keep) : next;
      });
    });
    client.call('Performance.enableFrames', { detail: true });
    client.call<{ budgetMs: number }>('Performance.getBudget', {}, windowId).then((r) => r.result && setBudget(r.result.budgetMs));
    return () => { off(); client.call('Performance.disableFrames'); };
  }, [client, connected, mode, windowId]);

  // Paint flashing follows the toggle; off when leaving the panel.
  useEffect(() => {
    if (!connected) return;
    client.call('Inspector.setOverlay', { paintFlashing: flashing });
  }, [client, connected, flashing]);
  useEffect(() => () => { client.call('Inspector.setOverlay', { paintFlashing: false }); }, [client]);

  // Why did the selected frame render?
  useEffect(() => {
    setDetail(null);
    if (selected == null || imported || !connected) return;
    client.call<Detail>('Performance.getFrameDetail', { seq: selected }, windowId).then((r) => setDetail(r.result ?? { found: false }));
  }, [client, selected, imported, connected, windowId]);

  const sum = useMemo(() => summarize(frames, budget), [frames, budget]);
  const frame = frames.find((f) => f.seq === selected);

  const changeBudget = async (ms: number) => {
    setBudget(ms);
    if (connected) await client.call('Performance.setBudget', { ms }, windowId);
  };
  const record = () => { setImported(null); setFrames([]); setSelected(null); setMode('recording'); };
  const stop = () => setMode('stopped');
  const live = () => { setImported(null); setFrames([]); setSelected(null); setMode('live'); };
  const exportIt = () => {
    const rec = toRecording(frames, budget, status.key?.split(/[\\/]/).slice(-4, -3)[0], status.handshake?.engine);
    const blob = new Blob([JSON.stringify(rec)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `glyx-performance-${new Date().toISOString().replace(/[:.]/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  };
  const importIt = async (file: File) => {
    try {
      const rec = fromRecording(await file.text());
      setMode('stopped');
      setFrames(rec.frames);
      setBudget(rec.budgetMs);
      setSelected(null);
      setImported(file.name);
    } catch (e) { alert((e as Error).message); }
  };

  if (!connected && !frames.length) {
    return <section className="empty"><h1>Performance</h1><p>Attach to an app to see its frames.</p></section>;
  }

  return (
    <div className="perf">
      <div className="toolbar">
        {mode === 'recording'
          ? <button className="button small rec on" onClick={stop}><span className="rec-dot" aria-hidden="true" />Stop</button>
          : <button className="button small rec" onClick={record} disabled={!connected}><span className="rec-dot" aria-hidden="true" />Record</button>}
        {mode !== 'live' && <button className="button small" onClick={live} disabled={!connected}>Live</button>}
        <span className="perf-mode muted small">
          {imported ? `Imported: ${imported}` : mode === 'recording' ? `Recording · ${frames.length} frames` : mode === 'live' ? 'Live (last 600 frames)' : `Stopped · ${frames.length} frames`}
        </span>
        <div className="topbar-spacer" />
        <label className="picker"><span className="picker-label">Budget</span>
          <select value={String(budget)} onChange={(e) => changeBudget(Number(e.target.value))} aria-label="Frame budget">
            <option value="8.333">120 fps (8.3 ms)</option>
            <option value="16.667">60 fps (16.7 ms)</option>
            <option value="33.333">30 fps (33.3 ms)</option>
            {![8.333, 16.667, 33.333].includes(budget) && <option value={String(budget)}>{budget.toFixed(1)} ms</option>}
          </select>
        </label>
        <label className="check" title="Flash what each frame redraws, in the app">
          <input type="checkbox" checked={flashing} onChange={(e) => setFlashing(e.target.checked)} disabled={!connected} />Paint flashing
        </label>
        <button className="button small" onClick={exportIt} disabled={!frames.length}>Export</button>
        <button className="button small" onClick={() => fileInput.current?.click()}>Import</button>
        <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => { const f = e.target.files?.[0]; if (f) importIt(f); e.target.value = ''; }} />
      </div>

      <div className="perf-body">
        <div className="cards perf-cards">
          <Card label="FPS" value={sum.frames ? sum.fps.toFixed(0) : '—'} sub={`${sum.frames} frames`} />
          <Card label="Frame time" value={sum.frames ? fmtMs(sum.p50) : '—'} sub={`p90 ${fmtMs(sum.p90)} · p99 ${fmtMs(sum.p99)}`} />
          <Card label="Over budget" value={sum.frames ? `${sum.overBudgetPct.toFixed(0)}%` : '—'} sub={`${sum.overBudget} slow frame${sum.overBudget === 1 ? '' : 's'}`} tone={sum.overBudget ? 'bad' : undefined} />
          <Card label="Partial redraws" value={sum.frames ? `${sum.partialPct.toFixed(0)}%` : '—'} sub="of frames" />
          <div className="card phases">
            <div className="card-label">Average per frame</div>
            {PHASES.map((ph) => (
              <div key={ph.key} className="phase-row"><span className="dot" style={{ background: `var(${ph.token})` }} />{ph.label}<span className="mono">{fmtMs(sum.avg[ph.key])}</span></div>
            ))}
          </div>
        </div>

        <FrameChart frames={frames} budgetMs={budget} selected={selected} onSelect={setSelected} theme={theme} />
        <div className="legend small muted">
          {PHASES.map((ph) => <span key={ph.key}><span className="dot" style={{ background: `var(${ph.token})` }} />{ph.label}</span>)}
          <span><span className="dot other" />Other</span>
          <span><span className="swatch-outline" />Over budget</span>
          <span><span className="dot tiny" />Full redraw</span>
        </div>

        {frame && (
          <div className="frame-detail">
            <h2>Frame {frame.seq}</h2>
            <div className="fd-grid">
              <dl className="kv mono">
                <dt>frame cost</dt><dd>{fmtMs(cost(frame))}{cost(frame) > budget ? '  (over budget)' : ''}</dd>
                {PHASES.map((ph) => (<React.Fragment key={ph.key}><dt>{ph.label.toLowerCase()}</dt><dd>{fmtMs(frame[ph.key])}</dd></React.Fragment>))}
                <dt>other</dt><dd>{fmtMs(otherTime(frame))}</dd>
                <dt>since previous</dt><dd>{fmtMs(frame.frameTime)}{frame.frameTime > 100 ? ' (app was idle)' : ''}</dd>
                <dt>redrawn</dt><dd>{frame.partial ? `${frame.damagePx.toLocaleString()} px (partial)` : 'whole window'}</dd>
                <dt>animating</dt><dd>{frame.animating}</dd>
                <dt>elements</dt><dd>{frame.nodeCount}</dd>
              </dl>
              <div>
                <h3 className="fd-h">Why did this frame render?</h3>
                {imported
                  ? <p className="muted small">Not stored in recordings.</p>
                  : !detail
                    ? <p className="muted small">…</p>
                    : !detail.found
                      ? <p className="muted small">No detail for this frame (it's older than the last 300, or nothing in the app changed: animation, caret or overlay frames).</p>
                      : (
                        <>
                          <p className="small">{detail.dirtyCount} element{detail.dirtyCount === 1 ? '' : 's'} changed{detail.removedSince ? ` (${detail.removedSince} since removed)` : ''}.</p>
                          <div className="dirty-list">
                            {detail.dirty?.map((d) => (
                              <div key={d.nodeId} className="dirty-row"
                                onMouseEnter={() => client.call('Inspector.highlightNode', { nodeId: d.nodeId }, windowId)}
                                onMouseLeave={() => client.call('Inspector.highlightNode', { nodeId: null }, windowId)}
                                title={d.id}>
                                <span className="t-app">{shortName(d.component) ?? d.type}</span>
                                {d.text != null && <span className="t-text">"{d.text.slice(0, 30)}"</span>}
                                <span className="mono muted small">{d.id}</span>
                              </div>
                            ))}
                          </div>
                        </>
                      )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'bad' }) {
  return (
    <div className={`card${tone === 'bad' ? ' card-bad' : ''}`}>
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  );
}
