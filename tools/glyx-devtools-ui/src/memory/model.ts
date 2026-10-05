// Memory panel data: live samples, snapshots and their comparison.

export interface Sample {
  timestamp: number;
  heapUsed: number;
  heapTotal: number;
  rss: number;
  /** Memory only this app uses (Task Manager's number). Windows only. */
  privateBytes?: number | null;
  gpuBuffers: number;
  gpuTextures: number;
  gpuReserved?: number;
  nodes: number;
}

export interface ComponentCount { component: string; elements: number; instances: number }

export interface Snapshot extends Sample {
  elements: number;
  detached: number;
  byType: Record<string, number>;
  byComponent: ComponentCount[] | null;
  label?: string;
}

export interface Marker { timestamp: number; kind: 'gc' | 'leak' | 'snapshot'; text: string }

export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v >= 100 || i === 0 ? v.toFixed(0) : v.toFixed(1)} ${units[i]}`;
}

export function formatDelta(n: number, bytes = true): string {
  if (n === 0) return '±0';
  const s = bytes ? formatBytes(Math.abs(n)) : String(Math.abs(n));
  return (n > 0 ? '+' : '−') + s;
}

export interface DiffRow {
  component: string;
  elements: number;
  instances: number;
  deltaElements: number;
  deltaInstances: number;
}

/** Per-component counts of `next`, with the change since `prev`, biggest
 *  growth first (then biggest). Components that vanished show negative. */
export function diffSnapshots(prev: Snapshot | undefined, next: Snapshot): DiffRow[] {
  const before = new Map((prev?.byComponent ?? []).map((c) => [c.component, c]));
  const rows: DiffRow[] = (next.byComponent ?? []).map((c) => {
    const b = before.get(c.component);
    before.delete(c.component);
    return {
      component: c.component, elements: c.elements, instances: c.instances,
      deltaElements: prev ? c.elements - (b?.elements ?? 0) : 0,
      deltaInstances: prev ? c.instances - (b?.instances ?? 0) : 0,
    };
  });
  for (const b of before.values()) {
    rows.push({ component: b.component, elements: 0, instances: 0, deltaElements: -b.elements, deltaInstances: -b.instances });
  }
  return rows.sort((a, b) => b.deltaElements - a.deltaElements || b.elements - a.elements);
}

/** Keep the last `cap` samples. */
export function pushSample(samples: Sample[], s: Sample, cap = 600): Sample[] {
  const next = [...samples, s];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** GPU memory in use (buffers + textures). */
export const gpuBytes = (s: Pick<Sample, 'gpuBuffers' | 'gpuTextures'>) => s.gpuBuffers + s.gpuTextures;
