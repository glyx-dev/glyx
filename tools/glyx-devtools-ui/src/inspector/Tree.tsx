import React, { useEffect, useRef, useState } from 'react';
import { type Row, appComponent, shortName, textPreview } from './model';

const ROW_H = 26;
const clip = (t: string) => (t.length > 40 ? t.slice(0, 40) + '…' : t);
const OVERSCAN = 12;

interface Props {
  rows: Row[];
  selected: number | null;
  onSelect: (nodeId: number) => void;
  onToggle: (nodeId: number) => void;
  onHover: (nodeId: number | null) => void;
  search: string;
}

/** Virtualized element tree: only rows in view are rendered, so large apps
 *  (thousands of elements) scroll smoothly. Arrow keys move / fold. */
export function Tree({ rows, selected, onSelect, onToggle, onHover, search }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState(0);
  const [height, setHeight] = useState(400);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setHeight(el.clientHeight));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Keep the selection in view (after a pick in the app, or keyboard moves).
  const selIndex = rows.findIndex((r) => r.node.nodeId === selected);
  useEffect(() => {
    const el = box.current;
    if (!el || selIndex < 0) return;
    const top = selIndex * ROW_H;
    if (top < el.scrollTop) el.scrollTop = top;
    else if (top + ROW_H > el.scrollTop + el.clientHeight) el.scrollTop = top + ROW_H - el.clientHeight;
  }, [selIndex]);

  const first = Math.max(0, Math.floor(scroll / ROW_H) - OVERSCAN);
  const last = Math.min(rows.length, Math.ceil((scroll + height) / ROW_H) + OVERSCAN);

  const onKey = (e: React.KeyboardEvent) => {
    if (!rows.length) return;
    const i = Math.max(0, selIndex);
    const row = rows[i];
    const go = (j: number) => { const r = rows[Math.max(0, Math.min(rows.length - 1, j))]; if (r) onSelect(r.node.nodeId); };
    switch (e.key) {
      case 'ArrowDown': go(selIndex < 0 ? 0 : i + 1); break;
      case 'ArrowUp': go(i - 1); break;
      case 'Home': go(0); break;
      case 'End': go(rows.length - 1); break;
      case 'ArrowRight':
        if (row.hasChildren && !row.expanded) onToggle(row.node.nodeId); else go(i + 1);
        break;
      case 'ArrowLeft':
        if (row.hasChildren && row.expanded) onToggle(row.node.nodeId);
        else if (row.parent != null) onSelect(row.parent);
        break;
      default: return;
    }
    e.preventDefault();
  };

  return (
    <div
      ref={box}
      className="tree"
      role="tree"
      aria-label="Elements"
      tabIndex={0}
      onKeyDown={onKey}
      onScroll={(e) => setScroll((e.target as HTMLDivElement).scrollTop)}
      onMouseLeave={() => onHover(null)}
    >
      <div style={{ height: rows.length * ROW_H, position: 'relative' }}>
        {rows.slice(first, last).map((r, k) => {
          const n = r.node;
          const i = first + k;
          const app = shortName(appComponent(n.component));
          const lib = n.component?.includes(' › ') ? shortName(n.component.split(' › ')[1]) : null;
          const hit = search && [n.id, n.component, n.text, n.testID, n.label].some((v) => v?.toLowerCase().includes(search.toLowerCase()));
          return (
            <div
              key={n.nodeId}
              role="treeitem"
              aria-level={r.depth + 1}
              aria-expanded={r.hasChildren ? r.expanded : undefined}
              aria-selected={n.nodeId === selected}
              className={`tree-row${n.nodeId === selected ? ' selected' : ''}${hit ? ' hit' : ''}`}
              style={{ top: i * ROW_H, paddingLeft: 8 + r.depth * 14 }}
              onClick={() => onSelect(n.nodeId)}
              onMouseEnter={() => onHover(n.nodeId)}
              title={n.id ?? ''}
            >
              <span
                className={`caret${r.hasChildren ? '' : ' leaf'}${r.expanded ? ' open' : ''}`}
                onClick={(e) => { e.stopPropagation(); if (r.hasChildren) onToggle(n.nodeId); }}
                aria-hidden="true"
              />
              {app && <span className="t-app">{app}</span>}
              {lib && <span className="t-lib">{lib}</span>}
              {!app && <span className="t-lib">{n.type}</span>}
              {n.type === 'Text' && n.text != null
                ? (n.text.trim() === ''
                    ? <span className="t-empty" title="This Text element exists but has no text right now">(empty text)</span>
                    : <span className="t-text">"{clip(n.text)}"</span>)
                : !r.expanded && (() => { const t = textPreview(n); return t ? <span className="t-preview">"{clip(t)}"</span> : null; })()}
              {n.pinned && <span className="t-pin" title="Pinned by testID">testID</span>}
              {n.role && <span className="t-role">{n.role}</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}
