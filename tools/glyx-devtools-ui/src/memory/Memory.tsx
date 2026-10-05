import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ConnStatus, RelayClient } from '../relay';
import { MemoryChart, type Series } from './MemoryChart';
import {
  diffSnapshots, formatBytes, formatDelta, gpuBytes, pushSample,
  type Marker, type Sample, type Snapshot,
} from './model';

interface Props { client: RelayClient; status: ConnStatus; windowId: number | undefined; theme: string }

const SAMPLE_MS = 1000;

const BYTE_SERIES: Series[] = [
  { key: 'heapUsed', label: 'JS heap used', token: '--gx-amber-500', value: (s) => s.heapUsed },
  { key: 'heapTotal', label: 'JS heap total', token: '--gx-amber-300', value: (s) => s.heapTotal, dashed: true },
  { key: 'private', label: 'App memory (private)', token: '--gx-violet-400', value: (s) => s.privateBytes ?? 0 },
  { key: 'rss', label: 'Working set (incl. shared)', token: '--gx-violet-200', value: (s) => s.rss, dashed: true },
  { key: 'gpu', label: 'GPU memory', token: '--gx-neutral-400', value: gpuBytes },
];
const NODE_SERIES: Series[] = [
  { key: 'nodes', label: 'Elements', token: '--gx-link', value: (s) => s.nodes },
];

export function Memory({ client, status, windowId, theme }: Props) {
  const connected = status.state === 'connected';
  const [samples, setSamples] = useState<Sample[]>([]);
  const [markers, setMarkers] = useState<Marker[]>([]);
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [compareTo, setCompareTo] = useState<number | null>(null); // index of the baseline snapshot
  const [gcNote, setGcNote] = useState<string | null>(null);
  const [leaks, setLeaks] = useState<{ seq: number; data: any; at: number }[]>([]);
  const leakSeq = useRef(0);

  // Live samples + leak warnings while the panel is open.
  useEffect(() => {
    if (!connected) return;
    setSamples([]);
    let live = true;
    const tick = async () => {
      const r = await client.call<Sample>('Memory.sample', {}, windowId);
      if (live && r.result) setSamples((s) => pushSample(s, r.result!));
      const l = await client.call<{ entries: { seq: number; data: any }[]; lastSeq: number }>('Performance.getLeakWarnings', { since: leakSeq.current }, windowId);
      if (live && l.result?.entries.length) {
        const now = Date.now();
        leakSeq.current = l.result.lastSeq;
        setLeaks((x) => [...x, ...l.result!.entries.map((e) => ({ ...e, at: now }))]);
        setMarkers((m) => [...m, ...l.result!.entries.map(() => ({ timestamp: now, kind: 'leak' as const, text: 'Leak warning' }))]);
      }
    };
    tick();
    const t = setInterval(tick, SAMPLE_MS);
    return () => { live = false; clearInterval(t); };
  }, [client, connected, windowId]);

  const first = samples[0];
  const last = samples[samples.length - 1];

  const collect = async () => {
    const r = await client.call<Sample & { heapBefore: number; gcMs: number }>('Memory.collectGarbage', {}, windowId);
    if (!r.result) return;
    const { heapBefore, heapUsed, gcMs, timestamp } = r.result;
    setGcNote(`JS heap ${formatBytes(heapBefore)} → ${formatBytes(heapUsed)} (${formatDelta(heapUsed - heapBefore)}) in ${gcMs.toFixed(1)} ms`);
    setMarkers((m) => [...m, { timestamp, kind: 'gc', text: 'Garbage collected' }]);
    setSamples((s) => pushSample(s, r.result!));
  };

  const snapshot = async () => {
    const r = await client.call<Snapshot>('Memory.snapshot', {}, windowId);
    if (!r.result) return;
    setSnapshots((s) => {
      const next = [...s, { ...r.result!, label: `Snapshot ${s.length + 1}` }];
      setCompareTo(next.length >= 2 ? next.length - 2 : null);
      return next;
    });
    setMarkers((m) => [...m, { timestamp: r.result!.timestamp, kind: 'snapshot', text: 'Snapshot' }]);
  };

  const latest = snapshots[snapshots.length - 1];
  const baseline = compareTo != null ? snapshots[compareTo] : undefined;
  const rows = useMemo(() => (latest ? diffSnapshots(baseline, latest) : []), [latest, baseline]);

  if (!connected && !samples.length) {
    return <section className="empty"><h1>Memory</h1><p>Attach to an app to see its memory.</p></section>;
  }

  const card = (label: string, now: number | undefined, then: number | undefined, fmt = formatBytes, sub?: string, tip?: string) => (
    <div className="card" title={tip}>
      <div className="card-label">{label}</div>
      <div className="card-value">{now == null ? '—' : fmt(now)}</div>
      <div className="card-sub">{sub ?? (now != null && then != null ? `${formatDelta(now - then, fmt === formatBytes)} since opened` : '')}</div>
    </div>
  );

  // Private memory is Windows-only; don't draw a flat zero line elsewhere.
  const byteSeries = last?.privateBytes != null ? BYTE_SERIES : BYTE_SERIES.filter((x) => x.key !== 'private');
  return (
    <div className="memory">
      <div className="toolbar">
        <button className="button small" onClick={collect} disabled={!connected}>Collect garbage</button>
        <button className="button small" onClick={snapshot} disabled={!connected}>Take snapshot</button>
        {gcNote && <span className="small muted">{gcNote}</span>}
        <div className="topbar-spacer" />
        <span className="small muted">Sampled every second · last 10 minutes</span>
      </div>

      <div className="perf-body">
        <div className="cards mem-cards">
          {card('JS heap', last?.heapUsed, first?.heapUsed, formatBytes, last ? `of ${formatBytes(last.heapTotal)} · ${formatDelta(last.heapUsed - first.heapUsed)} since opened` : '')}
          {last?.privateBytes != null
            ? card('App memory', last.privateBytes, first?.privateBytes ?? undefined, formatBytes,
                `${formatBytes(last.rss)} working set incl. shared`,
                "Private working set: memory only this app uses. This is what Task Manager's Memory column shows. The working set also counts shared pages (V8, system DLLs, fonts) that other processes use too.")
            : card('Process memory', last?.rss, first?.rss, formatBytes, undefined, 'Working set: all RAM mapped by the process, including shared pages.')}
          {card('GPU memory', last ? gpuBytes(last) : undefined, first ? gpuBytes(first) : undefined)}
          {card('Elements', last?.nodes, first?.nodes, (n) => n.toLocaleString())}
        </div>

        <MemoryChart samples={samples} series={byteSeries} markers={markers} format={formatBytes} height={220} theme={theme} label="Memory over time" />
        <div className="legend small muted">
          {byteSeries.map((s) => <span key={s.key}><span className={`dot${s.dashed ? ' dashed' : ''}`} style={{ background: `var(${s.token})` }} />{s.label}</span>)}
          <span><span className="vmark gc" />Garbage collected</span>
          <span><span className="vmark leak" />Leak warning</span>
          <span><span className="vmark snap" />Snapshot</span>
        </div>
        <MemoryChart samples={samples} series={NODE_SERIES} markers={markers} format={(n) => Math.round(n).toLocaleString()} height={110} theme={theme} label="Elements over time" />

        {leaks.length > 0 && (
          <section className="frame-detail">
            <h2>Leak warnings</h2>
            {leaks.map((l) => (
              <div key={l.seq} className="issue issue-warning">
                <strong>{new Date(l.at).toLocaleTimeString()}</strong> {l.data?.msg ?? JSON.stringify(l.data)}
              </div>
            ))}
          </section>
        )}

        <section className="frame-detail">
          <div className="snap-head">
            <h2>Snapshots</h2>
            {snapshots.length >= 2 && (
              <label className="picker"><span className="picker-label">Compare with</span>
                <select value={compareTo ?? ''} onChange={(e) => setCompareTo(e.target.value === '' ? null : Number(e.target.value))} aria-label="Baseline snapshot">
                  <option value="">nothing</option>
                  {snapshots.slice(0, -1).map((s, i) => <option key={i} value={i}>{s.label} · {new Date(s.timestamp).toLocaleTimeString()}</option>)}
                </select>
              </label>
            )}
          </div>
          {!latest
            ? <p className="muted small">Take a snapshot to see which components hold the most elements. Take another after using the app: components that keep growing are where leaks are.</p>
            : (
              <>
                <p className="small">
                  <strong>{latest.label}</strong> · {latest.elements.toLocaleString()} elements on screen
                  {latest.detached > 0 && (
                    <> · <span className={baseline && latest.detached > baseline.detached ? 'warn-text' : ''}
                      title="Created but not attached to the tree: kept by the app (inactive screens, caches) or leaked. Only a concern if it keeps growing from snapshot to snapshot.">
                      {latest.detached.toLocaleString()} not on screen
                      {baseline && latest.detached !== baseline.detached ? ` (${formatDelta(latest.detached - baseline.detached, false)})` : ''}
                    </span></>
                  )}
                  {' · '}{Object.entries(latest.byType).map(([t, n]) => `${n} ${t}`).join(', ')}
                </p>
                {latest.byComponent == null
                  ? <p className="muted small">Per-component counts need the app's React layer (restart it with devtools on).</p>
                  : (
                    <table className="table snap-table">
                      <thead><tr><th>Component</th><th className="num">Instances</th><th className="num">Elements</th>{baseline && <th className="num">Change</th>}</tr></thead>
                      <tbody>
                        {rows.slice(0, 60).map((r) => (
                          <tr key={r.component} className={baseline && r.deltaElements > 0 ? 'grew' : ''}>
                            <td className="t-app">{r.component}</td>
                            <td className="num mono">{r.instances.toLocaleString()}</td>
                            <td className="num mono">{r.elements.toLocaleString()}</td>
                            {baseline && <td className={`num mono ${r.deltaElements > 0 ? 'up' : r.deltaElements < 0 ? 'down' : ''}`}>{formatDelta(r.deltaElements, false)}</td>}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
              </>
            )}
        </section>
      </div>
    </div>
  );
}
