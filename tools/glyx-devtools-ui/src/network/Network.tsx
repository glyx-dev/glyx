import React, { useEffect, useMemo, useRef, useState } from 'react';
import type { ConnStatus, RelayClient } from '../relay';
import {
  KINDS, KIND_LABEL, formatMs, formatSize, isError, matches, merge, prettyBody, splitUrl, statusLabel, waterfall,
  type Detail, type Kind, type Summary,
} from './model';

interface Props { client: RelayClient; status: ConnStatus; windowId: number | undefined }

type Tab = 'headers' | 'request' | 'response' | 'messages';

export function Network({ client, status }: Props) {
  const connected = status.state === 'connected';
  const [rows, setRows] = useState<Summary[]>([]);
  const [kinds, setKinds] = useState<Set<Kind>>(new Set(KINDS));
  const [search, setSearch] = useState('');
  const [errorsOnly, setErrorsOnly] = useState(false);
  const [preserve, setPreserve] = useState(() => { try { return localStorage.getItem('gx-devtools-net-preserve') === '1'; } catch { return false; } });
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [detail, setDetail] = useState<Detail | null>(null);
  const [tab, setTab] = useState<Tab>('headers');
  const [now, setNow] = useState(Date.now());
  const lastSeq = useRef(0);
  const appKey = useRef<string | undefined>(undefined);
  const pending = useRef<Summary[]>([]);
  // Updates at or below this were cleared; Infinity while a clear is on its way.
  const floor = useRef(0);

  useEffect(() => { try { localStorage.setItem('gx-devtools-net-preserve', preserve ? '1' : '0'); } catch {} }, [preserve]);

  // Backlog + live updates, batched to one render per animation frame.
  useEffect(() => {
    if (!connected) return;
    const thisApp = `${status.key}:${status.handshake?.pid}`;
    if (appKey.current && appKey.current !== thisApp) {
      lastSeq.current = 0;
      floor.current = 0;
      if (!preserve) { setRows([]); setSelectedKey(null); }
    }
    appKey.current = thisApp;
    if (floor.current === Infinity) floor.current = 0; // a clear lost with the connection

    let raf = 0;
    const flush = () => { raf = 0; const u = pending.current; pending.current = []; setRows((r) => merge(r, u)); };
    const queue = (u: Summary[]) => {
      const fresh = u.filter((r) => r.seq > floor.current);
      if (!fresh.length) return;
      pending.current.push(...fresh);
      if (!raf) raf = requestAnimationFrame(flush);
    };
    const off = client.onEvent<Summary>('Network.requestUpdated', (r) => {
      lastSeq.current = Math.max(lastSeq.current, r.seq);
      queue([r]);
    });
    client.call('Network.enable');
    client.call<{ requests: Summary[]; lastSeq: number }>('Network.getRequests', { since: lastSeq.current }).then((r) => {
      if (!r.result) return;
      lastSeq.current = Math.max(lastSeq.current, r.result.lastSeq);
      queue(r.result.requests);
    });
    return () => { off(); if (raf) cancelAnimationFrame(raf); client.call('Network.disable'); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, connected, status.key, status.handshake?.pid]);

  // Running requests' bars grow while anything is in flight.
  const live = rows.some((r) => r.state === 'pending');
  useEffect(() => {
    if (!live) return;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [live]);

  const selected = rows.find((r) => r.key === selectedKey) ?? null;
  // Refetch the detail whenever the selected request changes.
  useEffect(() => {
    if (!selected || !connected) { setDetail(null); return; }
    let stale = false;
    client.call<Detail>('Network.getRequest', { key: selected.key }).then((r) => { if (!stale) setDetail(r.result ?? null); });
    return () => { stale = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.key, selected?.seq, connected]);
  useEffect(() => {
    if (!selected) return;
    const socket = selected.kind === 'websocket' || selected.kind === 'ipc';
    if (socket && (tab === 'request' || tab === 'response')) setTab('messages');
    if (!socket && tab === 'messages') setTab('response');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected?.kind]);

  const shown = useMemo(() => rows.filter((r) => matches(r, kinds, search, errorsOnly)), [rows, kinds, search, errorsOnly]);
  const counts = useMemo(() => {
    const c: Record<Kind, number> = { fetch: 0, websocket: 0, ipc: 0, command: 0 };
    for (const r of rows) c[r.kind]++;
    return c;
  }, [rows]);
  const span = useMemo(() => {
    if (!shown.length) return { from: 0, to: 1 };
    const from = Math.min(...shown.map((r) => r.start));
    const to = Math.max(...shown.map((r) => r.end ?? now), from + 1);
    return { from, to };
  }, [shown, now]);
  const totals = useMemo(() => ({
    bytes: shown.reduce((n, r) => n + r.responseSize + r.messageBytes, 0),
    errors: shown.filter(isError).length,
  }), [shown]);

  const toggleKind = (k: Kind) => setKinds((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const clear = () => {
    pending.current = [];
    floor.current = Infinity;
    setRows([]); setSelectedKey(null);
    client.call<{ lastSeq: number }>('Network.clear').then((r) => { floor.current = r.result?.lastSeq ?? 0; });
  };

  return (
    <div className="network">
      <div className="toolbar">
        <div className="levels" role="group" aria-label="Request types">
          {KINDS.map((k) => (
            <button key={k} className={`level-chip${kinds.has(k) ? ' on' : ''}`} aria-pressed={kinds.has(k)} onClick={() => toggleKind(k)}>
              {KIND_LABEL[k]}<span className="level-count">{counts[k]}</span>
            </button>
          ))}
        </div>
        <input className="search" type="search" placeholder="Filter by URL, method or status" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Filter requests" />
        <label className="check"><input type="checkbox" checked={errorsOnly} onChange={(e) => setErrorsOnly(e.target.checked)} />Errors only</label>
        <label className="check"><input type="checkbox" checked={preserve} onChange={(e) => setPreserve(e.target.checked)} />Preserve log</label>
        <button className="button small" onClick={clear} disabled={!connected}>Clear</button>
      </div>

      <div className={`net-split${selected ? ' has-detail' : ''}`}>
        <div className="net-list">
          <table className="table net-table">
            <thead>
              <tr><th>Name</th><th>Method</th><th>Status</th><th>Type</th><th className="num">Size</th><th className="num">Time</th><th className="wf-head">Waterfall</th></tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const { name, host: urlHost } = splitUrl(r.url);
                // IPC rows: say whose they are once there's more than one window.
                const host = r.kind === 'ipc' && r.windowId != null ? `in window ${r.windowId}` : urlHost;
                const wf = waterfall(r, span.from, span.to, now);
                return (
                  <tr key={r.key} className={`${r.key === selectedKey ? 'selected' : ''}${isError(r) ? ' net-error' : ''}`} onClick={() => setSelectedKey(r.key)} aria-selected={r.key === selectedKey}>
                    <td className="net-name" title={r.url}><span className="mono">{name}</span>{host && <span className="muted small"> {host}</span>}</td>
                    <td className="mono">{r.method ?? (r.kind === 'websocket' ? 'WS' : r.kind === 'ipc' ? 'IPC' : '')}</td>
                    <td className={`net-status st-${r.state}`}>{statusLabel(r)}</td>
                    <td className="muted">{r.kind === 'fetch' ? (r.contentType?.split(';')[0] ?? 'fetch') : KIND_LABEL[r.kind]}</td>
                    <td className="num">{r.messages ? `${r.messages} msg · ${formatSize(r.messageBytes)}` : formatSize(r.state === 'done' ? r.responseSize : null)}</td>
                    <td className="num">{r.kind === 'ipc' ? '—' : formatMs(r.duration ?? (r.state === 'pending' || r.state === 'open' ? now - r.start : null))}</td>
                    <td className="wf-cell"><span className={`wf-bar kind-${r.kind} st-${r.state}`} style={{ left: `${wf.left * 100}%`, width: `${wf.width * 100}%` }} /></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {shown.length === 0 && (
            <p className="muted pad">{rows.length ? 'No requests match the filter.' : 'No network activity yet. fetch, WebSocket, IPC and backend command calls in the app show up here.'}</p>
          )}
        </div>
        {selected && (
          <div className="side net-detail">
            <div className="tabs" role="tablist">
              <button className="icon-button close" onClick={() => setSelectedKey(null)} aria-label="Close details">×</button>
              {(selected.kind === 'websocket' || selected.kind === 'ipc'
                ? (['headers', 'messages'] as Tab[])
                : (['headers', 'request', 'response'] as Tab[])).map((t) => (
                <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
                  {t === 'headers' ? 'Overview' : t[0].toUpperCase() + t.slice(1)}
                  {t === 'messages' && <span className="count neutral">{selected.messages}</span>}
                </button>
              ))}
            </div>
            <div className="details pad">
              {!detail ? <p className="muted">Loading…</p> : <DetailView d={detail} tab={tab} />}
            </div>
          </div>
        )}
      </div>

      <div className="statusbar small muted">
        {shown.length} of {rows.length} requests · {formatSize(totals.bytes)} received{totals.errors ? ` · ${totals.errors} failed` : ''}
      </div>
    </div>
  );
}

function Headers({ h }: { h: Record<string, string> | null }) {
  const entries = Object.entries(h ?? {});
  if (!entries.length) return <p className="muted small">None</p>;
  return <dl className="kv mono net-kv">{entries.map(([k, v]) => <React.Fragment key={k}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>;
}

function Body({ body, contentType, size, dropped }: { body: string | null; contentType?: string | null; size: number; dropped: boolean }) {
  if (dropped && body == null) return <p className="muted">Body no longer kept (older requests lose their bodies to save memory).</p>;
  if (body == null || body === '') return <p className="muted">No body.</p>;
  const { text, json } = prettyBody(body, contentType);
  return (
    <>
      {body.length < size && <p className="muted small">Showing the first {formatSize(body.length)} of {formatSize(size)}.</p>}
      <pre className={`net-body mono${json ? ' json' : ''}`}>{text}</pre>
    </>
  );
}

function DetailView({ d, tab }: { d: Detail; tab: Tab }) {
  if (tab === 'request') return <Body body={d.requestBody} size={d.requestSize} dropped={d.bodiesDropped} contentType={d.requestHeaders?.['content-type'] ?? d.requestHeaders?.['Content-Type']} />;
  if (tab === 'response') {
    if (d.state === 'failed') return <p className="issue issue-error">{d.error}</p>;
    if (d.state === 'pending') return <p className="muted">Waiting for the response…</p>;
    return <Body body={d.responseBody} size={d.responseSize} dropped={d.bodiesDropped} contentType={d.contentType} />;
  }
  if (tab === 'messages') {
    if (!d.frames.length) return <p className="muted">No messages yet.</p>;
    return (
      <div className="frames">
        {d.messages > d.frames.length && <p className="muted small">Showing the last {d.frames.length} of {d.messages} messages.</p>}
        {d.frames.map((f, i) => (
          <div key={i} className={`frame-row dir-${f.dir}`}>
            <span className="frame-dir" aria-label={f.dir === 'out' ? 'sent' : 'received'}>{f.dir === 'out' ? '↑' : '↓'}</span>
            <span className="frame-data mono">{f.data || (d.bodiesDropped ? '(dropped)' : '')}</span>
            <span className="frame-meta muted small">{formatSize(f.size)} · {new Date(f.ts).toLocaleTimeString()}</span>
          </div>
        ))}
      </div>
    );
  }
  return (
    <>
      <dl className="kv net-kv">
        <dt>URL</dt><dd className="mono">{d.url}</dd>
        {d.method && <><dt>Method</dt><dd className="mono">{d.method}</dd></>}
        <dt>Status</dt><dd>{statusLabel(d)}{d.statusText && d.status != null ? ` ${d.statusText}` : ''}</dd>
        {d.error && <><dt>Error</dt><dd className="err">{d.error}</dd></>}
        <dt>Started</dt><dd>{new Date(d.start).toLocaleTimeString()}</dd>
        {d.kind !== 'ipc' && <><dt>{d.kind === 'websocket' ? 'Connected for' : 'Took'}</dt><dd>{formatMs(d.duration)}</dd></>}
        {d.windowId != null && <><dt>Window</dt><dd>{d.windowId}</dd></>}
      </dl>
      {d.kind === 'fetch' && (
        <>
          <h3 className="net-h">Response headers</h3>
          <Headers h={d.responseHeaders} />
          <h3 className="net-h">Request headers</h3>
          <Headers h={d.requestHeaders} />
        </>
      )}
    </>
  );
}
