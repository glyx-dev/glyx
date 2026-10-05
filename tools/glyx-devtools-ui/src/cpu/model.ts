// CPU profiler data: V8 `cpuProfile` → flame-chart spans and function
// totals; React commits → component rankings.

export interface CallFrame { functionName: string; url: string; lineNumber: number; columnNumber: number; scriptId?: string }
export interface ProfileNode { id: number; callFrame: CallFrame; children?: number[]; hitCount?: number }
export interface CpuProfile { nodes: ProfileNode[]; startTime: number; endTime: number; samples: number[]; timeDeltas: number[] }

export interface ComponentRender { name: string; depth: number; parent: number; self: number; total: number; library: boolean; mount: boolean }
export interface Commit { at: number; duration: number; components: ComponentRender[] }
export interface ComponentRecording { commits: Commit[]; started: number; dropped: number }

/** V8's pseudo-functions, shown as categories rather than code. */
export const SPECIAL = new Set(['(root)', '(program)', '(idle)', '(garbage collector)']);

export function frameName(f: CallFrame): string {
  return f.functionName || '(anonymous)';
}

/** "file.js:12" for a call frame (1-based line), or '' for native / eval'd code. */
export function frameLocation(f: CallFrame): string {
  if (!f.url) return '';
  const file = f.url.split(/[\\/]/).pop() || f.url;
  return `${file}:${f.lineNumber + 1}`;
}

export interface Span { depth: number; start: number; end: number; node: number; name: string; location: string }

/** Sample times in ms from the profile start, one per sample. */
export function sampleTimes(p: CpuProfile): number[] {
  const out: number[] = [];
  let t = 0;
  for (let i = 0; i < p.samples.length; i++) { t += (p.timeDeltas[i] ?? 0) / 1000; out.push(t); }
  return out;
}

function parents(p: CpuProfile): Map<number, number> {
  const parent = new Map<number, number>();
  for (const n of p.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  return parent;
}

/** Root-first stack of node ids for a sample (without "(root)"). */
function stackOf(id: number, parent: Map<number, number>, byId: Map<number, ProfileNode>): number[] {
  const s: number[] = [];
  for (let n: number | undefined = id; n != null; n = parent.get(n)) {
    if (frameName(byId.get(n)!.callFrame) !== '(root)') s.push(n);
  }
  return s.reverse();
}

/**
 * Time-ordered flame chart: consecutive samples that share a frame at the
 * same depth merge into one span. Idle time is left out.
 */
export function flameSpans(p: CpuProfile): { spans: Span[]; duration: number } {
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const parent = parents(p);
  const times = sampleTimes(p);
  const duration = Math.max((p.endTime - p.startTime) / 1000, times[times.length - 1] ?? 0);
  const spans: Span[] = [];
  let open: Span[] = [];
  const close = (from: number, at: number) => {
    for (let d = open.length - 1; d >= from; d--) { open[d].end = at; spans.push(open[d]); }
    open = open.slice(0, from);
  };
  for (let i = 0; i < p.samples.length; i++) {
    const start = times[i];
    const end = times[i + 1] ?? duration;
    let stack = stackOf(p.samples[i], parent, byId);
    if (stack.length === 1 && frameName(byId.get(stack[0])!.callFrame) === '(idle)') stack = [];
    let d = 0;
    while (d < open.length && d < stack.length && open[d].node === stack[d]) d++;
    close(d, start);
    for (; d < stack.length; d++) {
      const f = byId.get(stack[d])!.callFrame;
      open.push({ depth: d, start, end, node: stack[d], name: frameName(f), location: frameLocation(f) });
    }
    for (const s of open) s.end = end;
  }
  close(0, duration);
  spans.sort((a, b) => a.depth - b.depth || a.start - b.start);
  return { spans, duration };
}

export interface FunctionTotal { key: string; name: string; location: string; self: number; total: number; special: boolean }

/**
 * Per function (name + location): self time (it was on top of the stack)
 * and total time (anywhere on the stack, counted once per sample).
 */
export function functionTotals(p: CpuProfile): FunctionTotal[] {
  const byId = new Map(p.nodes.map((n) => [n.id, n]));
  const parent = parents(p);
  const times = sampleTimes(p);
  const duration = (p.endTime - p.startTime) / 1000;
  const totals = new Map<string, FunctionTotal>();
  const keyOf = (f: CallFrame) => `${frameName(f)}@${f.url}:${f.lineNumber}:${f.columnNumber}`;
  for (let i = 0; i < p.samples.length; i++) {
    const dt = (times[i + 1] ?? duration) - times[i];
    if (dt <= 0) continue;
    const stack = stackOf(p.samples[i], parent, byId);
    const seen = new Set<string>();
    stack.forEach((id, d) => {
      const f = byId.get(id)!.callFrame;
      const key = keyOf(f);
      let t = totals.get(key);
      if (!t) { t = { key, name: frameName(f), location: frameLocation(f), self: 0, total: 0, special: SPECIAL.has(frameName(f)) }; totals.set(key, t); }
      if (!seen.has(key)) { t.total += dt; seen.add(key); }
      if (d === stack.length - 1) t.self += dt;
    });
  }
  return [...totals.values()].sort((a, b) => b.self - a.self);
}

export interface ComponentTotal { name: string; renders: number; self: number; total: number; max: number; library: boolean }

/** Components ranked by their own render time across all commits. */
export function componentTotals(commits: Commit[]): ComponentTotal[] {
  const m = new Map<string, ComponentTotal>();
  for (const c of commits) for (const r of c.components) {
    let t = m.get(r.name);
    if (!t) { t = { name: r.name, renders: 0, self: 0, total: 0, max: 0, library: r.library }; m.set(r.name, t); }
    t.renders++; t.self += r.self; t.total += r.total; t.max = Math.max(t.max, r.self);
  }
  return [...m.values()].sort((a, b) => b.self - a.self);
}

/** Box layout for one commit's component flame chart: each child laid under its parent, sized by total time. */
export function commitBoxes(c: Commit): { x: number; w: number; depth: number; i: number }[] {
  const kids = new Map<number, number[]>();
  c.components.forEach((r, i) => { const k = kids.get(r.parent) ?? []; k.push(i); kids.set(r.parent, k); });
  const out: { x: number; w: number; depth: number; i: number }[] = [];
  const roots = kids.get(-1) ?? [];
  const rootTotal = roots.reduce((n, i) => n + c.components[i].total, 0) || 1;
  const place = (ids: number[], x: number, scale: number) => {
    let cursor = x;
    for (const i of ids) {
      const w = c.components[i].total * scale;
      out.push({ x: cursor, w, depth: c.components[i].depth, i });
      place(kids.get(i) ?? [], cursor, scale);
      cursor += w;
    }
  };
  place(roots, 0, 1 / rootTotal);
  return out;
}

export function formatMs(ms: number): string {
  if (ms < 1) return `${ms.toFixed(2)} ms`;
  if (ms < 100) return `${ms.toFixed(1)} ms`;
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}
