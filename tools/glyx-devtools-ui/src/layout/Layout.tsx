import React, { useCallback, useEffect, useState } from 'react';
import type { ConnStatus, RelayClient } from '../relay';
import { getSelection, onSelection, setSelection, type Selection } from '../selection';
import { shortName } from '../inspector/model';

interface Props { client: RelayClient; status: ConnStatus; windowId: number | undefined }

interface Computed { x: number; y: number; width: number; height: number; contentWidth: number; contentHeight: number;
  padding: Box; border: Box; margin: Box }
interface Box { left: number; right: number; top: number; bottom: number }
interface Child { nodeId: number; id?: string; component?: string; type: string; text?: string;
  flexGrow: number; flexShrink: number; flexBasis: string; width: string; height: string; alignSelf: string; computed: Computed }
interface Details {
  nodeId: number; id?: string; component?: string;
  style: Record<string, any>;
  computed: Computed;
  measuredText: boolean;
  explain: { width: string[]; height: string[] };
  container?: { nodeId: number; id?: string; component?: string; flexDirection: string; flexWrap: string; justifyContent: string;
    alignItems: string; gap: { row: string; column: string }; innerWidth: number; innerHeight: number; computed: Computed };
  children: Child[];
}

const DIRECTIONS = ['row', 'column', 'row-reverse', 'column-reverse'];
const JUSTIFY = ['flex-start', 'center', 'flex-end', 'space-between', 'space-around', 'space-evenly'];
const ALIGN = ['stretch', 'flex-start', 'center', 'flex-end', 'baseline'];

export function Layout({ client, status, windowId }: Props) {
  const connected = status.state === 'connected';
  const [sel, setSel] = useState<Selection | null>(getSelection());
  const [d, setD] = useState<Details | null>(null);
  const [container, setContainer] = useState<Details | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inspecting, setInspecting] = useState(false);

  useEffect(() => onSelection(setSel), []);

  const load = useCallback(async () => {
    if (!sel || !connected) { setD(null); setContainer(null); return; }
    const r = await client.call<Details>('Inspector.getLayoutDetails', { nodeId: sel.nodeId }, windowId);
    if (r.error) { setError(r.error.message); setD(null); setContainer(null); return; }
    setError(null);
    setD(r.result!);
    // The container's own details: its children for the diagram.
    const cid = r.result!.container?.nodeId;
    if (cid != null) {
      const c = await client.call<Details>('Inspector.getLayoutDetails', { nodeId: cid }, windowId);
      setContainer(c.result ?? null);
    } else setContainer(null);
  }, [client, connected, sel?.nodeId, windowId]);

  useEffect(() => { load(); }, [load]);

  // Follow the app: refresh when its tree changes (debounced).
  useEffect(() => {
    if (!connected) return;
    let t: ReturnType<typeof setTimeout> | undefined;
    const off = client.onEvent('Inspector.treeChanged', () => { clearTimeout(t); t = setTimeout(load, 120); });
    const offPick = client.onEvent<any>('Inspector.nodePicked', (n) => setSelection({ nodeId: n.nodeId, id: n.id, component: n.component, type: n.type }));
    const offMode = client.onEvent<{ enabled: boolean }>('Inspector.inspectModeChanged', (m) => setInspecting(m.enabled));
    client.call('Inspector.enableTreeEvents');
    return () => { clearTimeout(t); off(); offPick(); offMode(); client.call('Inspector.disableTreeEvents'); };
  }, [client, connected, load]);

  const edit = async (nodeId: number, name: string, value: unknown) => {
    const r = await client.call('Inspector.setNodeProp', { nodeId, name, value }, windowId);
    if (r.error) { setError(r.error.message); return; }
    setTimeout(load, 60); // after the app's next layout
  };
  const select = (c: { nodeId: number; id?: string; component?: string; type?: string }) =>
    setSelection({ nodeId: c.nodeId, id: c.id, component: c.component, type: c.type });
  const toggleInspect = async () => {
    const r = await client.call<{ enabled: boolean }>('Inspector.setInspectMode', { enabled: !inspecting });
    setInspecting(!!r.result?.enabled);
  };

  if (!connected) return <section className="empty"><h1>Layout</h1><p>Attach to an app to explore its layout.</p></section>;

  return (
    <div className="layoutx">
      <div className="toolbar">
        <button className={`icon-button${inspecting ? ' on' : ''}`} onClick={toggleInspect} aria-pressed={inspecting} title="Pick an element in the app">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 4l7 17 2.5-7.5L21 11z" /></svg>
        </button>
        {d
          ? <span><span className="t-app">{shortName(d.component) ?? sel?.type}</span> <code className="small">{d.id ?? `node ${d.nodeId}`}</code></span>
          : <span className="muted small">Select an element in the Inspector, or pick one in the app with the arrow.</span>}
        {d?.container && (
          <button className="button small" onClick={() => select(d.container!)} title="Explore the containing box">↑ Container</button>
        )}
      </div>
      {error && <div className="hint">{error}</div>}

      {d && (
        <div className="perf-body">
          <div className="why-grid">
            <Why title="Width" size={d.computed.width} reasons={d.explain.width} />
            <Why title="Height" size={d.computed.height} reasons={d.explain.height} />
          </div>
          <p className="muted small">Explained from the layout style and the result (the layout engine doesn't record its reasons).</p>

          {d.container && container && (
            <section className="frame-detail">
              <div className="snap-head">
                <h2>In its container</h2>
                <span className="muted small">{shortName(d.container.component) ?? 'container'} · {d.container.innerWidth} × {d.container.innerHeight} inside padding</span>
              </div>
              <div className="flex-controls">
                <Picker label="Direction" value={d.container.flexDirection} options={DIRECTIONS} onChange={(v) => edit(d.container!.nodeId, 'flexDirection', v)} />
                <Picker label="Justify" value={d.container.justifyContent === 'normal' ? 'flex-start' : d.container.justifyContent} options={JUSTIFY} onChange={(v) => edit(d.container!.nodeId, 'justifyContent', v)} />
                <Picker label="Align" value={d.container.alignItems === 'normal' ? 'stretch' : d.container.alignItems} options={ALIGN} onChange={(v) => edit(d.container!.nodeId, 'alignItems', v)} />
                <NumberEdit label="Gap" value={parseFloat(d.container.gap.column) || 0} onCommit={(v) => edit(d.container!.nodeId, 'gap', v)} />
              </div>
              <FlexDiagram container={container} selected={d.nodeId} onSelect={select} />
            </section>
          )}

          <section className="frame-detail">
            <h2>This element</h2>
            <div className="flex-controls">
              <NumberEdit label="flexGrow" value={d.style.flexGrow} onCommit={(v) => edit(d.nodeId, 'flex', v)} />
              <TextEdit label="width" value={d.style.width} onCommit={(v) => edit(d.nodeId, 'width', v === 'auto' || v === '' ? null : v.endsWith('%') ? v : Number(v.replace('px', '')))} />
              <TextEdit label="height" value={d.style.height} onCommit={(v) => edit(d.nodeId, 'height', v === 'auto' || v === '' ? null : v.endsWith('%') ? v : Number(v.replace('px', '')))} />
            </div>
            <dl className="kv mono style-kv">
              {['display', 'flexDirection', 'justifyContent', 'alignItems', 'alignSelf', 'flexWrap', 'flexGrow', 'flexShrink', 'flexBasis',
                'width', 'height', 'minWidth', 'minHeight', 'maxWidth', 'maxHeight'].map((k) => (
                <React.Fragment key={k}><dt>{k}</dt><dd>{String(d.style[k])}</dd></React.Fragment>
              ))}
              <dt>gap</dt><dd>{d.style.gap.row} / {d.style.gap.column}</dd>
              <dt>padding</dt><dd>{boxStr(d.style.padding)}</dd>
              <dt>margin</dt><dd>{boxStr(d.style.margin)}</dd>
              <dt>computed</dt><dd>{d.computed.width} × {d.computed.height} at {d.computed.x}, {d.computed.y}</dd>
              <dt>content</dt><dd>{d.computed.contentWidth} × {d.computed.contentHeight}{d.measuredText ? ' (measured text)' : ''}</dd>
            </dl>
          </section>
        </div>
      )}
      {!d && !error && <section className="empty"><h1>Layout</h1><p>Pick an element to see why it's the size it is, and to change its container's layout live.</p></section>}
    </div>
  );
}

function boxStr(b: Record<string, string>) {
  const v = [b.top, b.right, b.bottom, b.left];
  return v.every((x) => x === v[0]) ? v[0] : v.join(' ');
}

function Why({ title, size, reasons }: { title: string; size: number; reasons: string[] }) {
  return (
    <div className="card why">
      <div className="card-label">{title}</div>
      <div className="card-value">{size}px</div>
      {reasons.map((r, i) => <div key={i} className={`why-line${i ? ' extra' : ''}`}>{r}</div>)}
    </div>
  );
}

function Picker({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <label className="picker"><span className="picker-label">{label}</span>
      <select value={options.includes(value) ? value : ''} onChange={(e) => onChange(e.target.value)} aria-label={label}>
        {!options.includes(value) && <option value="">{value}</option>}
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </label>
  );
}

function NumberEdit({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  useEffect(() => setV(String(value)), [value]);
  return (
    <label className="picker"><span className="picker-label">{label}</span>
      <input className="num-input mono" value={v} onChange={(e) => setV(e.target.value)} aria-label={label}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        onBlur={() => { const n = Number(v); if (Number.isFinite(n) && n !== value) onCommit(n); }} />
    </label>
  );
}

function TextEdit({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [v, setV] = useState(value);
  useEffect(() => setV(value), [value]);
  return (
    <label className="picker"><span className="picker-label">{label}</span>
      <input className="num-input mono" value={v} onChange={(e) => setV(e.target.value)} aria-label={label}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        onBlur={() => { if (v.trim() !== value) onCommit(v.trim()); }} />
    </label>
  );
}

/** The container drawn to scale, children at their computed boxes. */
function FlexDiagram({ container, selected, onSelect }: { container: Details; selected: number; onSelect: (c: Child) => void }) {
  const W = 640;
  const cw = Math.max(1, container.computed.width);
  const ch = Math.max(1, container.computed.height);
  const scale = Math.min(W / cw, 260 / ch, 3);
  const pad = container.computed.padding;
  return (
    <div className="diagram" style={{ width: cw * scale, height: ch * scale }} aria-label="Container layout">
      <div className="diagram-pad" style={{ left: pad.left * scale, top: pad.top * scale, right: pad.right * scale, bottom: pad.bottom * scale }} />
      {container.children.map((c) => {
        const b = c.computed;
        const tag = c.flexGrow > 0 ? `grow ${c.flexGrow}` : c.width !== 'auto' ? c.width : '';
        return (
          <button key={c.nodeId} className={`diagram-child${c.nodeId === selected ? ' selected' : ''}`}
            style={{ left: b.x * scale, top: b.y * scale, width: Math.max(2, b.width * scale), height: Math.max(2, b.height * scale) }}
            onClick={() => onSelect(c)} title={`${shortName(c.component) ?? c.type} · ${b.width} × ${b.height}${c.text ? ` · "${c.text}"` : ''}`}>
            {b.width * scale > 46 && b.height * scale > 18 && (
              <span className="diagram-label">
                {shortName(c.component)?.split(' › ').pop() ?? c.type}{c.text ? ` "${c.text.slice(0, 12)}"` : ''}
                {tag && <span className="diagram-tag">{tag}</span>}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
