import React, { useEffect, useRef, useState } from 'react';
import type { ConnStatus, RelayClient } from '../relay';
import { shortName } from '../inspector/model';
import { RATES, easingLabel, easingPoints, mergeRuns, type Lane, type Run } from './model';

interface Props { client: RelayClient; status: ConnStatus; windowId: number | undefined }

const POLL_MS = 100;

export function Animations({ client, status, windowId }: Props) {
  const connected = status.state === 'connected';
  const [lanes, setLanes] = useState<Lane[]>([]);
  const [rate, setRate] = useState(1);
  const resumeRate = useRef(1);

  // Poll what's running while the panel is open (progress moves every frame;
  // polling at 10 Hz is plenty for a timeline and costs the app little).
  useEffect(() => {
    if (!connected) { setLanes([]); return; }
    let live = true;
    const tick = async () => {
      const r = await client.call<{ running: Run[]; rate: number }>('Animation.list', {}, windowId);
      if (!live || !r.result) return;
      setLanes((l) => mergeRuns(l, r.result!.running, Date.now()));
      setRate(r.result.rate);
    };
    tick();
    const t = setInterval(tick, POLL_MS);
    return () => { live = false; clearInterval(t); };
  }, [client, connected, windowId]);

  // Leaving the panel: never leave the app slowed down or paused.
  useEffect(() => () => { client.call('Animation.setPlaybackRate', { rate: 1 }); }, [client]);

  const setPlayback = async (r: number) => {
    if (r > 0) resumeRate.current = r;
    const res = await client.call<{ rate: number }>('Animation.setPlaybackRate', { rate: r });
    if (res.result) setRate(res.result.rate);
  };
  const paused = rate === 0;
  const step = (ms: number) => client.call('Animation.seek', { byMs: ms });
  const highlight = (nodeId: number | null) => client.call('Inspector.highlightNode', { nodeId }, windowId);

  if (!connected) {
    return <section className="empty"><h1>Animations</h1><p>Attach to an app to see its animations.</p></section>;
  }

  const running = lanes.filter((l) => l.endedAt == null);
  return (
    <div className="anim">
      <div className="toolbar">
        <button className={`icon-button${paused ? ' on' : ''}`} onClick={() => setPlayback(paused ? resumeRate.current : 0)}
          aria-label={paused ? 'Play' : 'Pause'} title={paused ? 'Play' : 'Pause all animations'}>
          {paused
            ? <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 4l13 8-13 8z" /></svg>
            : <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 4h4v16H6zM14 4h4v16h-4z" /></svg>}
        </button>
        <div className="levels" role="group" aria-label="Speed">
          {RATES.map((r) => (
            <button key={r} className={`level-chip${rate === r ? ' on' : ''}`} aria-pressed={rate === r} onClick={() => setPlayback(r)}>{r}×</button>
          ))}
        </div>
        <button className="button small" onClick={() => step(-100)} disabled={!paused} title="Back 100 ms (while paused)">−100 ms</button>
        <button className="button small" onClick={() => step(100)} disabled={!paused} title="Forward 100 ms (while paused)">+100 ms</button>
        <span className="muted small">
          {paused ? 'Paused' : rate === 1 ? 'Normal speed' : `Slow motion (${rate}×)`} · {running.length} running
        </span>
      </div>

      <div className="anim-body">
        {lanes.length === 0 && (
          <p className="muted pad">Nothing is animating. Transitions and keyframe animations show up here while they run.</p>
        )}
        {lanes.map((l) => <LaneRow key={l.key} lane={l} onHover={highlight} />)}
        {rate !== 1 && <p className="muted small pad">The app stays at this speed until you change it or leave this panel.</p>}
      </div>
    </div>
  );
}

function LaneRow({ lane: l, onHover }: { lane: Lane; onHover: (nodeId: number | null) => void }) {
  const infinite = l.iterations === 'infinite';
  const what = l.kind === 'transition'
    ? (l.properties?.length ? l.properties.join(', ') : 'transition')
    : `${l.keyframes ?? ''} keyframes${l.alternate ? ', alternate' : ''}`;
  return (
    <div className={`lane${l.endedAt != null ? ' ended' : ''}`} onMouseEnter={() => onHover(l.nodeId)} onMouseLeave={() => onHover(null)}>
      <div className="lane-head">
        <span className="t-app">{shortName(l.component) ?? `node ${l.nodeId}`}</span>
        <span className={`kind kind-${l.kind}`}>{l.kind}</span>
        <span className="muted small">{what}</span>
        <span className="mono muted small lane-id" title={l.id}>{l.id}</span>
      </div>
      <div className="lane-row">
        <div className={`track${infinite ? ' infinite' : ''}`} role="progressbar" aria-valuemin={0} aria-valuemax={100}
          aria-valuenow={Math.round(l.progress * 100)} aria-label={`${l.kind} progress`}>
          <div className="track-fill" style={{ width: `${l.progress * 100}%` }} />
          <div className="track-head" style={{ left: `${l.progress * 100}%` }} />
        </div>
        <span className="mono small lane-time">
          {l.endedAt != null ? 'finished' : `${Math.round(l.elapsedMs % (infinite ? l.durationMs : Infinity))} / ${l.durationMs} ms`}
          {infinite && l.endedAt == null ? ` · #${(l.iteration ?? 0) + 1}` : ''}
          {typeof l.iterations === 'number' && l.iterations > 1 ? ` · ×${l.iterations}` : ''}
        </span>
        <Curve easing={l.easing} progress={l.progress} />
      </div>
    </div>
  );
}

/** The easing curve, with the current point on it. */
function Curve({ easing, progress }: { easing: string; progress: number }) {
  const pts = easingPoints(easing);
  const ys = pts.map(([, y]) => y);
  const lo = Math.min(0, ...ys), hi = Math.max(1, ...ys);
  const W = 64, H = 28, pad = 3;
  const sx = (x: number) => pad + x * (W - pad * 2);
  const sy = (y: number) => H - pad - ((y - lo) / (hi - lo)) * (H - pad * 2);
  const d = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${sx(x).toFixed(1)},${sy(y).toFixed(1)}`).join('');
  // Nearest sample to the current progress along x.
  const cur = pts.reduce((best, p) => (Math.abs(p[0] - progress) < Math.abs(best[0] - progress) ? p : best), pts[0]);
  return (
    <svg className="curve" width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Easing ${easingLabel(easing)}`}>
      <title>{easingLabel(easing)}</title>
      <path d={d} fill="none" stroke="currentColor" strokeWidth="1.5" />
      <circle cx={sx(cur[0])} cy={sy(cur[1])} r="2.5" className="curve-dot" />
    </svg>
  );
}
