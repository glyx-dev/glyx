import React, { useEffect, useMemo, useState } from 'react';
import { RelayClient, readLaunchParams, type AppEntry, type ConnStatus } from './relay';
import { PANELS, type PanelId } from './panels';
import { Overview } from './Overview';
import { Inspector } from './inspector/Inspector';
import { Console } from './console/Console';
import { Performance } from './perf/Performance';
import { Animations } from './anim/Animations';
import { Memory } from './memory/Memory';
import { Layout } from './layout/Layout';
import { Network } from './network/Network';
import { Profiler } from './cpu/Profiler';

type Theme = 'dark' | 'light';

function useRelay() {
  const params = useMemo(() => readLaunchParams(), []);
  const client = useMemo(() => new RelayClient(params.url, params.secret, params.app), [params]);
  const [apps, setApps] = useState<AppEntry[]>([]);
  const [status, setStatus] = useState<ConnStatus>(client.status);
  useEffect(() => {
    const a = client.onApps(setApps);
    const s = client.onStatus(setStatus);
    return () => { a(); s(); client.close(); };
  }, [client]);
  return { client, apps, status, params };
}

function initialTheme(fromLaunch: string | null): Theme {
  if (fromLaunch === 'light' || fromLaunch === 'dark') return fromLaunch;
  try {
    const saved = localStorage.getItem('gx-devtools-theme');
    if (saved === 'light' || saved === 'dark') return saved;
  } catch {}
  return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light' : 'dark';
}

const STATE_TEXT: Record<ConnStatus['state'], string> = {
  'connecting': 'Connecting…',
  'relay-lost': 'DevTools server lost',
  'no-app': 'No app attached',
  'attaching': 'Attaching…',
  'connected': 'Connected',
  'reconnecting': 'App restarting…',
  'error': 'Error',
};

export function App() {
  const { client, apps, status, params } = useRelay();
  const [panel, setPanel] = useState<PanelId>('overview');
  const [theme, setTheme] = useState<Theme>(() => initialTheme(params.theme));
  const [windowId, setWindowId] = useState<number | undefined>(undefined);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try { localStorage.setItem('gx-devtools-theme', theme); } catch {}
  }, [theme]);

  // Keep the chosen window valid as windows come and go.
  const windows = status.handshake?.windows ?? [];
  useEffect(() => {
    if (windowId != null && !windows.some((w) => w.windowId === windowId)) setWindowId(undefined);
  }, [windows, windowId]);

  // Alt+1…9 switches panels.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey) return;
      const n = Number(e.key);
      if (n >= 1 && n <= PANELS.length) { setPanel(PANELS[n - 1].id); e.preventDefault(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const current = PANELS.find((p) => p.id === panel)!;
  // The Console keeps its messages and REPL history while you look at other
  // panels: mounted once opened, hidden when not in front.
  const [consoleOpened, setConsoleOpened] = useState(false);
  useEffect(() => { if (panel === 'console') setConsoleOpened(true); }, [panel]);
  const attached = apps.find((a) => a.key === status.key);

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <img src={`assets/glyx-symbol-${theme}.svg`} alt="" width="22" height="19" />
          <span className="brand-name">Glyx DevTools</span>
        </div>

        <label className="picker">
          <span className="picker-label">App</span>
          <select
            value={status.key ?? ''}
            onChange={(e) => (e.target.value ? client.attach(e.target.value) : client.detach())}
            aria-label="App to inspect"
          >
            <option value="">{apps.length ? 'Choose an app…' : 'No running apps'}</option>
            {apps.map((a) => (
              <option key={a.key} value={a.key}>{a.name} · {a.engine} · pid {a.pid}</option>
            ))}
          </select>
        </label>

        {windows.length > 1 && (
          <label className="picker">
            <span className="picker-label">Window</span>
            <select value={windowId ?? ''} onChange={(e) => setWindowId(e.target.value === '' ? undefined : Number(e.target.value))} aria-label="Window">
              <option value="">Main window</option>
              {windows.map((w) => <option key={w.windowId} value={w.windowId}>{w.title || `Window ${w.windowId}`}</option>)}
            </select>
          </label>
        )}

        <div className="topbar-spacer" />

        <div className={`conn conn-${status.state}`} role="status" aria-live="polite" title={status.message ?? ''}>
          <span className="conn-dot" aria-hidden="true" />
          {STATE_TEXT[status.state]}{attached && status.state === 'connected' ? ` · ${attached.name}` : ''}
        </div>

        <button
          className="icon-button"
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          title="Toggle theme"
        >
          {theme === 'dark'
            ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
            : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" /></svg>}
        </button>
      </header>

      <nav className="rail" aria-label="Panels">
        {PANELS.map((p, i) => (
          <button
            key={p.id}
            className={`rail-item${p.id === panel ? ' active' : ''}`}
            onClick={() => setPanel(p.id)}
            aria-current={p.id === panel ? 'page' : undefined}
            title={`${p.label} (Alt+${i + 1})`}
          >
            {p.icon}
            <span className="rail-label">{p.label}</span>
            {p.phase && <span className="rail-phase">{p.phase}</span>}
          </button>
        ))}
      </nav>

      <main className={`main${['inspector', 'console', 'performance', 'animations', 'memory', 'layout', 'network', 'cpu'].includes(current.id) ? ' flush' : ''}`} aria-label={current.label}>
        {status.state !== 'connected' && <ConnectionNotice status={status} apps={apps} onRefresh={() => client.refreshApps()} />}
        {consoleOpened && (
          <div className="panel-host" hidden={current.id !== 'console'}>
            <Console client={client} status={status} windowId={windowId} />
          </div>
        )}
        {current.id === 'overview'
          ? <Overview client={client} status={status} app={attached} windowId={windowId} />
          : current.id === 'inspector'
            ? <Inspector client={client} status={status} windowId={windowId} />
            : current.id === 'console'
              ? null
              : current.id === 'performance'
                ? <Performance client={client} status={status} windowId={windowId} theme={theme} />
                : current.id === 'animations'
                  ? <Animations client={client} status={status} windowId={windowId} />
                  : current.id === 'memory'
                    ? <Memory client={client} status={status} windowId={windowId} theme={theme} />
                    : current.id === 'layout'
                      ? <Layout client={client} status={status} windowId={windowId} />
                      : current.id === 'network'
                        ? <Network client={client} status={status} windowId={windowId} />
                        : current.id === 'cpu'
                          ? <Profiler client={client} status={status} windowId={windowId} theme={theme} />
                          : <ComingSoon label={current.label} phase={current.phase!} blurb={current.blurb} />}
      </main>
    </div>
  );
}

function ConnectionNotice({ status, apps, onRefresh }: { status: ConnStatus; apps: AppEntry[]; onRefresh: () => void }) {
  let title = STATE_TEXT[status.state];
  let body: React.ReactNode = status.message;
  if (status.state === 'no-app' || status.state === 'connecting') {
    title = apps.length ? 'Choose an app to inspect' : 'Waiting for an app';
    body = apps.length
      ? 'Pick one from the App menu above.'
      : <>Start one with <code>glyx dev --devtools</code> in its folder (or below this one). It appears here by itself.</>;
  } else if (status.state === 'reconnecting') {
    body = 'The app stopped or is restarting. DevTools reattaches when it is back.';
  }
  return (
    <div className={`notice notice-${status.state}`} role="status">
      <div>
        <div className="notice-title">{title}</div>
        {body && <div className="notice-body">{body}</div>}
      </div>
      {(status.state === 'no-app' || status.state === 'error') && (
        <button className="button" onClick={onRefresh}>Refresh</button>
      )}
    </div>
  );
}

function ComingSoon({ label, phase, blurb }: { label: string; phase: string; blurb: string }) {
  return (
    <section className="empty">
      <div className="empty-badge">{phase}</div>
      <h1>{label}</h1>
      <p>{blurb}</p>
      <p className="muted">Planned for phase {phase} of Glyx DevTools.</p>
    </section>
  );
}
