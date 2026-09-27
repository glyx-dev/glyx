import React, { useEffect, useState } from 'react';
import type { RelayClient } from '../relay';
import { CAPABILITIES, CATEGORIES, capName, fixFor, granted, groupFindings, scope, type Report } from './model';

const NAME = new Map(CAPABILITIES);

/** Overview section: granted capabilities, code that may break, runtime refusals. */
export function Capabilities({ client, connected }: { client: RelayClient; connected: boolean }) {
  const [report, setReport] = useState<Report | null>(null);
  const [showAll, setShowAll] = useState(false);

  // Refusals happen while the app runs: refresh every few seconds.
  useEffect(() => {
    if (!connected) { setReport(null); return; }
    let live = true;
    const load = () => client.call<Report>('Runtime.getCapabilities').then((r) => { if (live && r.result) setReport(r.result); });
    load();
    const t = setInterval(load, 3000);
    return () => { live = false; clearInterval(t); };
  }, [client, connected]);

  if (!report) return null;
  const grantedCount = CAPABILITIES.filter(([k]) => granted(report.configured, k)).length;
  const groups = groupFindings(report.mayBreak);
  // Capabilities with an issue get a mark on their tile.
  const flagged = new Set([...groups.map((g) => g.capability), ...report.denied.map((d) => d.capability.split('.')[0])]);

  return (
    <section className="caps">
      <div className="caps-head">
        <h2>Capabilities</h2>
        <span className="muted small">from <code>glyx.config.json</code>. Anything not granted is refused at runtime.</span>
      </div>

      <div className="caps-stats">
        <Stat tone="ok" value={grantedCount} label="granted" />
        <Stat tone={groups.length ? 'warn' : 'none'} value={groups.length} label="may break" />
        <Stat tone={report.denied.length ? 'err' : 'none'} value={report.denied.length} label="refused while running" />
      </div>

      {(report.denied.length > 0 || groups.length > 0) && (
        <div className="cap-issues">
          {report.denied.map((d) => (
            <IssueCard key={`d|${d.capability}|${d.target}`} tone="err"
              title={`${capName(d.capability)} refused`}
              body={<><span className="mono">{d.target}</span> <span className="muted">· {d.count} time{d.count === 1 ? '' : 's'}</span></>}
              fix={fixFor(d.capability, d.target)} />
          ))}
          {groups.map((g) => (
            <IssueCard key={`m|${g.capability}`} tone="warn"
              title={`${capName(g.capability)} not granted, but used`}
              body={<>
                {g.items.slice(0, 3).map((f, i) => (
                  <div key={i}><span className="mono">{f.file}:{f.line}</span> <span className="muted">{f.reason === 'hostNotAllowed' ? `${f.host} isn't allowed` : `uses ${f.api}`}</span></div>
                ))}
                {g.items.length > 3 && <div className="muted">and {g.items.length - 3} more</div>}
              </>}
              fix={fixFor(g.capability, g.items.find((f) => f.host)?.host)} />
          ))}
        </div>
      )}

      <div className="cap-cats">
        {CATEGORIES.map((c) => {
          const keys = c.keys.filter((k) => showAll || granted(report.configured, k) || flagged.has(k));
          if (!keys.length) return null;
          return (
            <div key={c.title} className="cap-cat">
              <div className="cap-cat-title">{c.title}</div>
              <div className="cap-tiles">
                {keys.map((k) => {
                  const on = granted(report.configured, k);
                  const sc = scope(report.configured, k);
                  return (
                    <div key={k} className={`cap-tile${on ? ' on' : ''}${flagged.has(k) ? ' flag' : ''}`} title={sc || undefined}>
                      <span className="cap-mark" aria-hidden="true">{on ? '✓' : flagged.has(k) ? '!' : '·'}</span>
                      <span className="cap-name">{NAME.get(k) ?? k}</span>
                      {sc && <span className="cap-scope mono">{sc}</span>}
                      <span className="sr-only">{on ? 'granted' : 'not granted'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div className="caps-foot small muted">
        <button className="link small" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show granted only' : 'Show all capabilities'}</button>
        <span>
          {report.scanned.available
            ? ` · Checked ${report.scanned.appFiles} app source file${report.scanned.appFiles === 1 ? '' : 's'} (not dependencies). Dynamic URLs and indirect calls can't be checked ahead of time; "refused" is what actually happened.`
            : ' · No source map in this build: only runtime refusals are shown.'}
        </span>
      </div>
    </section>
  );
}

function Stat({ tone, value, label }: { tone: 'ok' | 'warn' | 'err' | 'none'; value: number; label: string }) {
  return (
    <div className={`cap-stat tone-${tone}`}>
      <div className="cap-stat-value">{value}</div>
      <div className="cap-stat-label">{label}</div>
    </div>
  );
}

function IssueCard({ tone, title, body, fix }: { tone: 'warn' | 'err'; title: string; body: React.ReactNode; fix: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try { await navigator.clipboard.writeText(fix); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch { /* clipboard blocked */ }
  };
  return (
    <div className={`cap-issue tone-${tone}`}>
      <div className="cap-issue-title">{title}</div>
      <div className="cap-issue-body small">{body}</div>
      <div className="cap-issue-fix">
        <span className="muted small">Add to <code>capabilities</code>:</span>
        <code className="fix">{fix}</code>
        <button className="button small" onClick={copy}>{copied ? 'Copied' : 'Copy'}</button>
      </div>
    </div>
  );
}
