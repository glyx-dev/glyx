import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ConnStatus, RelayClient } from '../relay';
import { Tree } from './Tree';
import { Details } from './Details';
import { ancestors, flatten, index, type TreeNode } from './model';
import { setSelection } from '../selection';

interface Props {
  client: RelayClient;
  status: ConnStatus;
  windowId: number | undefined;
}

interface Issue { nodeId: number; id?: string; rule: string; severity: string; message: string; component?: string }

/** Remembered across reloads: which element was selected (by element ID). */
const SAVED_SELECTION = 'gx-devtools-selection';

export function Inspector({ client, status, windowId }: Props) {
  const connected = status.state === 'connected';
  const [root, setRoot] = useState<TreeNode | null>(null);
  const [version, setVersion] = useState(0);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [selectedId, setSelectedId] = useState<string | null>(() => { try { return localStorage.getItem(SAVED_SELECTION); } catch { return null; } });
  const [selectedNode, setSelectedNode] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [mine, setMine] = useState(() => { try { return localStorage.getItem('gx-devtools-mine') !== '0'; } catch { return true; } });
  const [inspecting, setInspecting] = useState(false);
  const [tab, setTab] = useState<'details' | 'a11y'>('details');
  const [audit, setAudit] = useState<{ issues: Issue[]; errors: number; warnings: number } | null>(null);
  const expandedOnce = useRef(false);

  const idx = useMemo(() => index(root), [root]);

  // ── Load + follow the tree ─────────────────────────────────────────────
  const load = useCallback(async () => {
    const r = await client.call<{ root: TreeNode }>('Inspector.getTree', {}, windowId);
    if (r.result) { setRoot(r.result.root); setVersion((v) => v + 1); }
  }, [client, windowId]);

  useEffect(() => {
    if (!connected) { setRoot(null); return; }
    let timer: ReturnType<typeof setTimeout> | undefined;
    const off = client.onEvent('Inspector.treeChanged', () => {
      clearTimeout(timer);
      timer = setTimeout(load, 150); // coalesce bursts (typing, animations)
    });
    const offPick = client.onEvent<TreeNode & { path?: number[] }>('Inspector.nodePicked', (n) => {
      if (n.id) setSelectedId(n.id);
      setSelectedNode(n.nodeId);
      if (n.path) setExpanded((e) => new Set([...e, ...n.path!.slice(0, -1)]));
      load();
    });
    const offMode = client.onEvent<{ enabled: boolean }>('Inspector.inspectModeChanged', (m) => setInspecting(m.enabled));
    client.call('Inspector.enableTreeEvents');
    load();
    return () => {
      clearTimeout(timer);
      off(); offPick(); offMode();
      client.call('Inspector.disableTreeEvents');
      client.call('Inspector.highlightNode', { nodeId: null }, windowId);
      if (inspecting) client.call('Inspector.setInspectMode', { enabled: false });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client, connected, load]);

  // First load: open the top few levels so there's something to see.
  useEffect(() => {
    if (!root || expandedOnce.current) return;
    expandedOnce.current = true;
    const open = new Set<number>();
    const walk = (n: TreeNode, d: number) => { if (d < 3) { open.add(n.nodeId); (n.children ?? []).forEach((c) => walk(c, d + 1)); } };
    walk(root, 0);
    setExpanded(open);
  }, [root]);

  // Keep the selection by element ID across refreshes, reloads and restarts.
  useEffect(() => {
    if (!root) return;
    const byId = selectedId ? idx.byId.get(selectedId) : undefined;
    const node = byId ?? (selectedNode != null ? idx.byNode.get(selectedNode) : undefined);
    if (node) {
      if (node.nodeId !== selectedNode) setSelectedNode(node.nodeId);
      const path = ancestors(idx.parentOf, node.nodeId);
      if (path.some((p) => !expanded.has(p))) setExpanded((e) => new Set([...e, ...path]));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [root, selectedId]);

  useEffect(() => { try { if (selectedId) localStorage.setItem(SAVED_SELECTION, selectedId); } catch {} }, [selectedId]);
  useEffect(() => { try { localStorage.setItem('gx-devtools-mine', mine ? '1' : '0'); } catch {} }, [mine]);

  // Audit when the a11y tab is open (and after tree changes).
  useEffect(() => {
    if (!connected || tab !== 'a11y') return;
    client.call('Inspector.auditAccessibility', {}, windowId).then((r) => setAudit(r.result ?? null));
  }, [client, connected, tab, version, windowId]);
  const nodeIssues = useMemo(() => (audit?.issues ?? []).filter((i) => i.nodeId === selectedNode), [audit, selectedNode]);
  // The details pane shows this element's issues even on the Details tab.
  useEffect(() => {
    if (!connected || tab === 'a11y' || selectedNode == null) return;
    client.call('Inspector.auditAccessibility', {}, windowId).then((r) => setAudit(r.result ?? null));
  }, [client, connected, selectedNode, version, windowId, tab]);

  // The selection and its path always have rows (see flatten's `pinned`).
  const keep = useMemo(() => selectedNode == null ? undefined
    : new Set([...ancestors(idx.parentOf, selectedNode), selectedNode]), [idx, selectedNode]);
  const rows = useMemo(() => flatten(root, expanded, mine, search, keep), [root, expanded, mine, search, keep]);

  const select = (nodeId: number) => {
    setSelectedNode(nodeId);
    const n = idx.byNode.get(nodeId);
    setSelectedId(n?.id ?? null);
  };
  const toggle = (nodeId: number) => setExpanded((e) => {
    const next = new Set(e);
    if (next.has(nodeId)) next.delete(nodeId); else next.add(nodeId);
    return next;
  });
  const hover = (nodeId: number | null) => {
    client.call('Inspector.highlightNode', { nodeId: nodeId ?? selectedNode }, windowId);
  };
  const toggleInspect = async () => {
    const r = await client.call<{ enabled: boolean }>('Inspector.setInspectMode', { enabled: !inspecting });
    setInspecting(!!r.result?.enabled);
  };

  const selected = selectedNode != null ? idx.byNode.get(selectedNode) : undefined;
  // Other panels (the Console's $0) follow the selection.
  useEffect(() => {
    setSelection(selected ? { nodeId: selected.nodeId, id: selected.id, component: selected.component, type: selected.type } : null);
  }, [selected?.nodeId, selected?.id]);

  if (!connected) {
    return <section className="empty"><h1>Inspector</h1><p>Attach to an app to inspect it.</p></section>;
  }

  return (
    <div className="inspector">
      <div className="toolbar">
        <button
          className={`icon-button${inspecting ? ' on' : ''}`}
          onClick={toggleInspect}
          aria-pressed={inspecting}
          title="Select an element in the app (Esc in the app cancels)"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M4 4l7 17 2.5-7.5L21 11z" /></svg>
        </button>
        <input
          className="search"
          type="search"
          placeholder="Find by element ID, component, text or testID"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Find elements"
        />
        <label className="check">
          <input type="checkbox" checked={mine} onChange={(e) => setMine(e.target.checked)} />
          My components
        </label>
        <button className="icon-button" onClick={load} title="Refresh" aria-label="Refresh tree">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7" /></svg>
        </button>
      </div>
      {inspecting && <div className="hint">Select mode: hover an element in the app and click it. Esc in the app cancels.</div>}

      <div className="split">
        <Tree rows={rows} selected={selectedNode} onSelect={select} onToggle={toggle} onHover={hover} search={search} />
        <div className="side">
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'details'} className={tab === 'details' ? 'active' : ''} onClick={() => setTab('details')}>Details</button>
            <button role="tab" aria-selected={tab === 'a11y'} className={tab === 'a11y' ? 'active' : ''} onClick={() => setTab('a11y')}>
              Accessibility{audit && audit.errors + audit.warnings > 0 ? <span className="count">{audit.errors + audit.warnings}</span> : null}
            </button>
          </div>
          {tab === 'details'
            ? (selected
                ? <Details client={client} windowId={windowId} node={selected} version={version} issues={nodeIssues} />
                : <p className="muted pad">Select an element in the tree, or use the arrow to pick one in the app.</p>)
            : <AuditList audit={audit} onPick={(i) => { select(i.nodeId); setTab('details'); client.call('Inspector.highlightNode', { nodeId: i.nodeId }, windowId); }} />}
        </div>
      </div>
    </div>
  );
}

function AuditList({ audit, onPick }: { audit: { issues: Issue[]; errors: number; warnings: number } | null; onPick: (i: Issue) => void }) {
  if (!audit) return <p className="muted pad">Checking…</p>;
  if (!audit.issues.length) return <p className="pad">No accessibility issues found. <span className="muted">Checked: unnamed pressables and images, text contrast, focusable elements without a role.</span></p>;
  return (
    <div className="audit">
      <p className="muted pad small">{audit.errors} error{audit.errors === 1 ? '' : 's'}, {audit.warnings} warning{audit.warnings === 1 ? '' : 's'}</p>
      {audit.issues.map((i, k) => (
        <button key={k} className={`issue-row issue-${i.severity}`} onClick={() => onPick(i)}>
          <span className="issue-sev">{i.severity}</span>
          <span className="issue-msg">{i.message}</span>
          <span className="issue-where mono">{i.component ?? i.id}</span>
        </button>
      ))}
    </div>
  );
}
