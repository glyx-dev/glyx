import React, { useEffect, useState } from 'react';
import type { RelayClient } from '../relay';
import { EDITABLE, PROP_GROUPS, editorValue, parseLength, shortName, toPropValue, type TreeNode } from './model';

interface Props {
  client: RelayClient;
  windowId: number | undefined;
  node: TreeNode;
  /** Bumped when the tree changes, so details refresh. */
  version: number;
  issues: { rule: string; severity: string; message: string }[];
}

interface NodeDetail {
  type: string;
  props: Record<string, unknown>;
  rect: number[] | null;
  focused: boolean;
}
interface Layout { rect: number[] | null; unclippedRect: number[] | null; layoutRect: number[] | null; contentHeight: number | null }

async function copy(text: string) {
  try { await navigator.clipboard.writeText(text); return true; } catch {}
  // Clipboard API can be unavailable in an iframe (VS Code): fall back.
  const t = document.createElement('textarea');
  t.value = text; document.body.appendChild(t); t.select();
  const ok = document.execCommand('copy');
  t.remove();
  return ok;
}

export function Details({ client, windowId, node, version, issues }: Props) {
  const [detail, setDetail] = useState<NodeDetail | null>(null);
  const [layout, setLayout] = useState<Layout | null>(null);
  const [edited, setEdited] = useState<Record<string, unknown>>({}); // prop → original value
  const [shot, setShot] = useState<{ src?: string; error?: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => { setEdited({}); setShot(null); }, [node.nodeId]);
  useEffect(() => {
    let live = true;
    Promise.all([
      client.call('Inspector.getNode', { nodeId: node.nodeId }, windowId),
      client.call('Inspector.getLayout', { nodeId: node.nodeId }, windowId),
    ]).then(([d, l]) => {
      if (!live) return;
      setDetail(d.result ?? null);
      setLayout(l.result ?? null);
    });
    return () => { live = false; };
  }, [client, windowId, node.nodeId, version]);

  const props = detail?.props ?? {};

  const commit = async (name: string, raw: string) => {
    const kind = EDITABLE[name];
    const value = toPropValue(kind, raw);
    if (!(name in edited)) setEdited((e) => ({ ...e, [name]: props[name] ?? null }));
    const r = await client.call('Inspector.setNodeProp', { nodeId: node.nodeId, name, value }, windowId);
    if (r.error) alert(r.error.message);
    const d = await client.call('Inspector.getNode', { nodeId: node.nodeId }, windowId);
    setDetail(d.result ?? null);
  };

  const reset = async (name: string) => {
    const original = edited[name];
    const kind = EDITABLE[name];
    const value = original == null ? null : toPropValue(kind, editorValue(kind, original));
    await client.call('Inspector.setNodeProp', { nodeId: node.nodeId, name, value }, windowId);
    setEdited((e) => { const { [name]: _, ...rest } = e; return rest; });
    const d = await client.call('Inspector.getNode', { nodeId: node.nodeId }, windowId);
    setDetail(d.result ?? null);
  };

  const screenshot = async () => {
    setShot({});
    const r = await client.call('Automation.screenshot', { nodeId: node.nodeId }, windowId);
    setShot(r.result ? { src: `data:image/png;base64,${r.result.data}` } : { error: r.error?.message });
  };

  const flash = async (label: string, text: string) => {
    if (await copy(text)) { setCopied(label); setTimeout(() => setCopied(null), 1200); }
  };

  const shown = new Set(PROP_GROUPS.flatMap(([, keys]) => keys));
  const others = Object.keys(props).filter((k) => !shown.has(k));

  return (
    <div className="details">
      <div className="d-head">
        <div className="d-title">
          <span className="t-app">{shortName(node.component) ?? node.type}</span>
          <span className="d-type">{node.type}</span>
          {detail?.focused && <span className="tag">focused</span>}
        </div>
        {node.component?.includes('@') && <div className="d-source mono">{node.component}</div>}
        <div className="d-id">
          <code title="Element ID">{node.id ?? `node ${node.nodeId}`}</code>
          {node.pinned && <span className="t-pin">testID</span>}
        </div>
        <div className="d-actions">
          <button className="button small" onClick={() => node.id && flash('id', node.id)} disabled={!node.id}>
            {copied === 'id' ? 'Copied' : 'Copy ID'}
          </button>
          <button className="button small" onClick={() => node.id && flash('sel', `{ id: ${JSON.stringify(node.id)} }`)} disabled={!node.id}
            title="GDP selector for tests and agents">
            {copied === 'sel' ? 'Copied' : 'Copy selector'}
          </button>
          <button className="button small" onClick={screenshot}>Screenshot</button>
        </div>
        {shot && (
          <div className="d-shot">
            {shot.src ? <img src={shot.src} alt="Screenshot of the element" /> : shot.error ? <span className="muted">{shot.error}</span> : <span className="muted">Capturing…</span>}
          </div>
        )}
      </div>

      {issues.length > 0 && (
        <section className="d-section">
          <h3>Accessibility</h3>
          {issues.map((i, k) => <div key={k} className={`issue issue-${i.severity}`}>{i.message}</div>)}
        </section>
      )}

      <section className="d-section">
        <h3>Box</h3>
        <BoxModel props={props} rect={layout?.rect ?? null} />
        <dl className="kv mono">
          <dt>rect</dt><dd>{fmtRect(layout?.rect)}</dd>
          {layout?.unclippedRect && fmtRect(layout.unclippedRect) !== fmtRect(layout.rect) && (<><dt>unclipped</dt><dd>{fmtRect(layout.unclippedRect)}</dd></>)}
          <dt>layout</dt><dd>{fmtRect(layout?.layoutRect)}</dd>
          {layout?.contentHeight != null && (<><dt>content height</dt><dd>{layout.contentHeight}</dd></>)}
        </dl>
      </section>

      {PROP_GROUPS.map(([group, keys]) => {
        const present = keys.filter((k) => k in props || EDITABLE[k]);
        const any = present.some((k) => k in props);
        if (!any && group !== 'Style' && group !== 'Layout') return null;
        return (
          <section className="d-section" key={group}>
            <h3>{group}</h3>
            <div className="props">
              {present.filter((k) => k in props || (EDITABLE[k] && (group === 'Style' || group === 'Layout'))).map((k) => (
                <PropRow key={k} name={k} value={props[k]} editable={!!EDITABLE[k]} edited={k in edited}
                  onCommit={(v) => commit(k, v)} onReset={() => reset(k)} />
              ))}
            </div>
          </section>
        );
      })}

      {others.length > 0 && (
        <section className="d-section">
          <h3>Other</h3>
          <div className="props">
            {others.map((k) => <PropRow key={k} name={k} value={props[k]} editable={false} edited={false} onCommit={() => {}} onReset={() => {}} />)}
          </div>
        </section>
      )}
    </div>
  );
}

function fmtRect(r?: number[] | null) {
  return r ? r.map((v) => +v.toFixed(1)).join(', ') : '—';
}

function PropRow({ name, value, editable, edited, onCommit, onReset }: {
  name: string; value: unknown; editable: boolean; edited: boolean;
  onCommit: (raw: string) => void; onReset: () => void;
}) {
  const kind = EDITABLE[name];
  const shown = kind ? editorValue(kind, value) : value == null ? '' : typeof value === 'string' ? (parseLength(value)?.text ?? value) : JSON.stringify(value);
  const [draft, setDraft] = useState(shown);
  useEffect(() => setDraft(shown), [shown]);
  const swatch = kind === 'color' && typeof value === 'string' ? value : null;
  return (
    <div className={`prop${edited ? ' edited' : ''}`}>
      <label className="prop-name" htmlFor={`p-${name}`}>{name}</label>
      <div className="prop-value">
        {swatch && <span className="swatch" style={{ background: swatch }} aria-hidden="true" />}
        {editable ? (
          <input
            id={`p-${name}`}
            className="prop-input mono"
            value={draft}
            placeholder="unset"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') { (e.target as HTMLInputElement).blur(); }
              if (e.key === 'Escape') { setDraft(shown); (e.target as HTMLInputElement).blur(); }
            }}
            onBlur={() => { if (draft !== shown) onCommit(draft); }}
          />
        ) : (
          <span className="mono prop-static">{shown === '' ? <span className="muted">unset</span> : shown}</span>
        )}
        {edited && <button className="link" onClick={onReset} title="Put back the app's value">reset</button>}
      </div>
    </div>
  );
}

/** Margin / border / padding / content, drawn like browser devtools. */
function BoxModel({ props, rect }: { props: Record<string, unknown>; rect: number[] | null }) {
  const m = parseLength(props.margin)?.text ?? '–';
  const p = parseLength(props.padding)?.text ?? '–';
  const b = props.borderWidth != null ? String(props.borderWidth) : '–';
  const size = rect ? `${+rect[2].toFixed(1)} × ${+rect[3].toFixed(1)}` : '—';
  return (
    <div className="box" aria-label="Box model">
      <div className="box-margin"><span className="box-label">margin</span><span className="box-v">{m}</span>
        <div className="box-border"><span className="box-label">border</span><span className="box-v">{b}</span>
          <div className="box-padding"><span className="box-label">padding</span><span className="box-v">{p}</span>
            <div className="box-content mono">{size}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
