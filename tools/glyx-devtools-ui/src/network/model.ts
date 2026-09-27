// Network panel data: request summaries from `Network.getRequests` /
// `Network.requestUpdated`, filtering and formatting.

export type Kind = 'fetch' | 'websocket' | 'ipc' | 'command';
export const KINDS: Kind[] = ['fetch', 'websocket', 'ipc', 'command'];
export const KIND_LABEL: Record<Kind, string> = { fetch: 'Fetch', websocket: 'WebSocket', ipc: 'IPC', command: 'Commands' };

export interface Summary {
  key: string;
  windowId: number | null;
  seq: number;
  kind: Kind;
  method: string | null;
  url: string;
  state: 'pending' | 'done' | 'open' | 'closed' | 'failed';
  start: number;
  end: number | null;
  duration: number | null;
  status: number | null;
  statusText: string | null;
  error: string | null;
  requestSize: number;
  responseSize: number;
  messages: number;
  messageBytes: number;
  contentType: string | null;
}

export interface Frame { dir: 'in' | 'out'; data: string; size: number; ts: number }

export interface Detail extends Summary {
  requestHeaders: Record<string, string> | null;
  requestBody: string | null;
  responseHeaders: Record<string, string> | null;
  responseBody: string | null;
  bodiesDropped: boolean;
  frames: Frame[];
}

/** Most requests kept in the panel. */
export const MAX_ROWS = 1000;

/** Merge updated summaries into the list (newer `seq` wins), in start order. */
export function merge(list: Summary[], updates: Summary[]): Summary[] {
  if (!updates.length) return list;
  const byKey = new Map(list.map((r) => [r.key, r]));
  for (const u of updates) {
    const old = byKey.get(u.key);
    if (old && old.start === u.start && old.seq >= u.seq) continue;
    byKey.set(u.key, u);
  }
  const merged = [...byKey.values()].sort((a, b) => a.start - b.start || a.seq - b.seq);
  return merged.length > MAX_ROWS ? merged.slice(merged.length - MAX_ROWS) : merged;
}

export function matches(r: Summary, kinds: Set<Kind>, search: string, errorsOnly: boolean): boolean {
  if (!kinds.has(r.kind)) return false;
  if (errorsOnly && !isError(r)) return false;
  if (!search) return true;
  const q = search.toLowerCase();
  return r.url.toLowerCase().includes(q) || (r.method ?? '').toLowerCase().includes(q) || String(r.status ?? '').includes(q);
}

export function isError(r: Summary): boolean {
  return r.state === 'failed' || (r.status != null && r.status >= 400);
}

/** What the Status column says. */
export function statusLabel(r: Summary): string {
  if (r.state === 'failed') return 'Failed';
  if (r.state === 'pending') return 'Pending';
  if (r.kind === 'ipc') return 'Active';
  if (r.kind === 'websocket') return r.state === 'open' ? 'Open' : 'Closed';
  if (r.status != null) return String(r.status);
  return r.statusText ?? 'Done';
}

/** The last part of a URL path (plus query) and the host, for the Name column. */
export function splitUrl(url: string): { name: string; host: string } {
  try {
    const u = new URL(url);
    const parts = u.pathname.split('/').filter(Boolean);
    return { name: (parts[parts.length - 1] ?? '/') + u.search, host: u.host };
  } catch {
    return { name: url, host: '' };
  }
}

export function formatSize(n: number | null | undefined): string {
  if (n == null) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function formatMs(ms: number | null | undefined): string {
  if (ms == null) return '—';
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

/** Pretty-print JSON bodies; anything else as is. */
export function prettyBody(body: string | null, contentType?: string | null): { text: string; json: boolean } {
  if (body == null) return { text: '', json: false };
  const t = body.trim();
  if ((contentType ?? '').includes('json') || t.startsWith('{') || t.startsWith('[')) {
    try { return { text: JSON.stringify(JSON.parse(t), null, 2), json: true }; } catch { /* not JSON after all */ }
  }
  return { text: body, json: false };
}

/** Bar position for the waterfall, as fractions of the shown time span. */
export function waterfall(r: Summary, from: number, to: number, now: number): { left: number; width: number } {
  const span = Math.max(1, to - from);
  const end = r.end ?? now;
  const left = Math.min(1, Math.max(0, (r.start - from) / span));
  const width = Math.max(0.004, Math.min(1 - left, (end - r.start) / span));
  return { left, width };
}
