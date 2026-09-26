import React, { useState } from 'react';
import { summary, type Preview } from './model';

/** A REPL result: primitives inline, objects / arrays / maps / sets as an
 *  expandable tree (from the app-side preview, depth-limited there). */
export function ObjectView({ p, name, open = false }: { p?: Preview; name?: string; open?: boolean }) {
  const [expanded, setExpanded] = useState(open);
  if (!p) return <span className="v-undefined">undefined</span>;
  const label = name != null ? <span className="v-key">{name}: </span> : null;
  const children = childrenOf(p);

  if (!children) {
    return <span className="v-line">{label}<Value p={p} /></span>;
  }
  return (
    <span className="v-node">
      <button className="v-toggle" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}>
        <span className={`caret${expanded ? ' open' : ''}`} aria-hidden="true" />
        {label}<span className="v-summary">{summary(p)}</span>
      </button>
      {expanded && (
        <span className="v-children">
          {children.map(([k, v], i) => <span key={i} className="v-child"><ObjectView p={v} name={k} /></span>)}
          {p.more && <span className="v-more">…more</span>}
          {p.collapsed && <span className="v-more">(deeper values not captured)</span>}
        </span>
      )}
    </span>
  );
}

function childrenOf(p: Preview): [string, Preview][] | null {
  if (p.collapsed) return [];
  if (p.t === 'array' || p.t === 'set') return (p.items ?? []).map((v, i) => [String(i), v]);
  if (p.t === 'object') return (p.entries ?? []).map(([k, v]) => [String(k), v]);
  if (p.t === 'map') return (p.entries ?? []).map(([k, v]) => [summary(k as Preview), v]);
  if (p.t === 'error' && (p.v ?? '').includes('\n')) return null;
  return null;
}

function Value({ p }: { p: Preview }) {
  switch (p.t) {
    case 'string': return <span className="v-string">{JSON.stringify(p.v)}</span>;
    case 'number': case 'bigint': return <span className="v-number">{p.v}</span>;
    case 'boolean': return <span className="v-keyword">{p.v}</span>;
    case 'null': case 'undefined': return <span className="v-undefined">{p.v}</span>;
    case 'function': return <span className="v-function" title={p.src}>{p.v}</span>;
    case 'error': return <span className="v-error">{p.v}</span>;
    default: return <span>{p.v ?? summary(p)}</span>;
  }
}
