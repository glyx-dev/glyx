// Console data: messages from the app, REPL inputs and results, filtering.

export type Level = 'log' | 'warn' | 'error' | 'debug';

export interface Preview {
  t: string;                 // number, string, object, array, map, set, function, error, …
  v?: string;
  ctor?: string;
  n?: number;
  items?: Preview[];
  entries?: [string | Preview, Preview][];
  more?: boolean;
  collapsed?: boolean;
  src?: string;
}

export type Entry =
  | { kind: 'message'; key: string; seq: number; level: Level; text: string; timestamp: number; windowId?: number }
  | { kind: 'input'; key: string; text: string; timestamp: number }
  | { kind: 'result'; key: string; preview?: Preview; description?: string; timestamp: number }
  | { kind: 'thrown'; key: string; text: string; timestamp: number }
  | { kind: 'separator'; key: string; text: string; timestamp: number };

export const LEVELS: Level[] = ['log', 'warn', 'error', 'debug'];

/** 13:04:05.123 */
export function formatTime(ms: number): string {
  const d = new Date(ms);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

/** Entries shown for a level filter + search. REPL lines are always shown
 *  unless a search hides them. */
export function visible(entries: Entry[], levels: Set<Level>, search: string): Entry[] {
  const q = search.trim().toLowerCase();
  return entries.filter((e) => {
    if (e.kind === 'message' && !levels.has(e.level)) return false;
    if (!q) return true;
    const text = e.kind === 'result' ? (e.description ?? '') : 'text' in e ? e.text : '';
    return text.toLowerCase().includes(q);
  });
}

export function counts(entries: Entry[]): Record<Level, number> {
  const c: Record<Level, number> = { log: 0, warn: 0, error: 0, debug: 0 };
  for (const e of entries) if (e.kind === 'message') c[e.level]++;
  return c;
}

/** First line and the rest (an error's stack), for collapsed display. */
export function splitFirstLine(text: string): [string, string] {
  const i = text.indexOf('\n');
  return i < 0 ? [text, ''] : [text.slice(0, i), text.slice(i + 1)];
}

/** One-line summary of a preview (collapsed objects, inline values). */
export function summary(p?: Preview): string {
  if (!p) return 'undefined';
  switch (p.t) {
    case 'string': return JSON.stringify(p.v);
    case 'array': return `Array(${p.n})`;
    case 'map': return `Map(${p.n})`;
    case 'set': return `Set(${p.n})`;
    case 'object': return p.ctor && p.ctor !== 'Object' ? `${p.ctor} {…}` : p.n ? '{…}' : '{}';
    case 'error': return (p.v ?? '').split('\n')[0];
    default: return p.v ?? p.t;
  }
}

/** REPL history: newest last, no consecutive duplicates, capped. */
export function pushHistory(history: string[], line: string, cap = 100): string[] {
  const t = line.trim();
  if (!t || history[history.length - 1] === t) return history;
  return [...history, t].slice(-cap);
}

/** Keep at most `cap` entries (oldest dropped). */
export function capped(entries: Entry[], cap = 5000): Entry[] {
  return entries.length > cap ? entries.slice(entries.length - cap) : entries;
}
