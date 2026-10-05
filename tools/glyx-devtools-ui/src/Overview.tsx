import React, { useEffect, useState } from 'react';
import type { AppEntry, ConnStatus, RelayClient } from './relay';
import { Capabilities } from './caps/Capabilities';

interface Props {
  client: RelayClient;
  status: ConnStatus;
  app: AppEntry | undefined;
  windowId: number | undefined;
}

/** Round-trip time of `Runtime.ping`, sampled every 2 s while connected. */
function useLatency(client: RelayClient, connected: boolean) {
  const [ms, setMs] = useState<number | null>(null);
  useEffect(() => {
    if (!connected) { setMs(null); return; }
    let live = true;
    const sample = async () => {
      const t0 = performance.now();
      const r = await client.call('Runtime.ping');
      if (live && !r.error) setMs(performance.now() - t0);
    };
    sample();
    const t = setInterval(sample, 2000);
    return () => { live = false; clearInterval(t); };
  }, [client, connected]);
  return ms;
}

/** What the app reports about itself (`Runtime.version`). */
function useVersion(client: RelayClient, connected: boolean) {
  const [v, setV] = useState<{ glyx?: string; protocolVersion?: number } | null>(null);
  useEffect(() => {
    if (!connected) { setV(null); return; }
    client.call('Runtime.version').then((r) => setV(r.result ?? null));
  }, [client, connected]);
  return v;
}

export function Overview({ client, status, app, windowId }: Props) {
  const connected = status.state === 'connected';
  const hs = status.handshake;
  const latency = useLatency(client, connected);
  const version = useVersion(client, connected);

  if (!connected || !hs) {
    return (
      <section className="overview">
        <h1>Overview</h1>
        <p className="muted">Nothing attached yet.</p>
      </section>
    );
  }

  // Methods grouped by domain: what this app can do.
  const domains = new Map<string, string[]>();
  for (const m of hs.methods) {
    const [d, name] = m.split('.');
    domains.set(d, [...(domains.get(d) ?? []), name]);
  }

  return (
    <section className="overview">
      <h1>{app?.name ?? 'App'}</h1>
      <div className="cards">
        <Card label="Engine" value={hs.engine} />
        <Card label="Process" value={`pid ${hs.pid}`} />
        <Card label="Glyx" value={version?.glyx ?? '…'} sub={`protocol v${hs.protocolVersion}`} />
        <Card label="Round trip" value={latency == null ? '…' : `${latency.toFixed(1)} ms`} sub="Runtime.ping" />
      </div>

      <Capabilities client={client} connected={connected} />

      <h2>Windows</h2>
      <table className="table">
        <thead><tr><th>Id</th><th>Title</th><th>Size</th><th /></tr></thead>
        <tbody>
          {hs.windows.map((w) => (
            <tr key={w.windowId} className={w.windowId === (windowId ?? hs.windows.find((x) => x.main)?.windowId) ? 'selected' : ''}>
              <td className="mono">{w.windowId}</td>
              <td>{w.title || <span className="muted">untitled</span>}</td>
              <td className="mono">{w.width} × {w.height}</td>
              <td>{w.main && <span className="tag">main</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <h2>What this app supports</h2>
      <div className="domains">
        {[...domains.entries()].map(([d, ms]) => (
          <div key={d} className="domain">
            <div className="domain-name">{d}</div>
            <div className="domain-methods">{ms.map((m) => <span key={m} className="chip">{m}</span>)}</div>
          </div>
        ))}
      </div>
      <p className="muted small">{hs.events.length} event streams: {hs.events.join(', ')}</p>
    </section>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  );
}
