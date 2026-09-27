// Animations panel data: running motion from `Animation.list`, recently
// finished runs, and easing curves for the lane previews.

export interface Run {
  nodeId: number;
  id?: string;
  component?: string;
  kind: 'transition' | 'animation';
  durationMs: number;
  iterations: number | 'infinite';
  iteration?: number;
  elapsedMs: number;
  progress: number;          // 0–1 within the current iteration
  easing: string;            // "Linear" | "EaseOutCubic" | "Bezier(x1, y1, x2, y2)"
  properties?: string[];
  keyframes?: number;
  alternate?: boolean;
}

export interface Lane extends Run {
  key: string;
  /** Set once the run disappeared from the list (finished or replaced). */
  endedAt?: number;
}

/** How long a finished run stays on the timeline (faded). */
export const LINGER_MS = 4000;

export const laneKey = (r: Pick<Run, 'nodeId' | 'kind'>) => `${r.kind}:${r.nodeId}`;

/** Merge a fresh `Animation.list` into the lanes: update running ones, mark
 *  vanished ones as ended, drop ended ones after LINGER_MS. */
export function mergeRuns(lanes: Lane[], running: Run[], now: number): Lane[] {
  const live = new Map(running.map((r) => [laneKey(r), r]));
  const out: Lane[] = [];
  const seen = new Set<string>();
  for (const l of lanes) {
    const r = live.get(l.key);
    if (r) { out.push({ ...r, key: l.key }); seen.add(l.key); }
    else if (l.endedAt == null) out.push({ ...l, endedAt: now, progress: 1 });
    else if (now - l.endedAt < LINGER_MS) out.push(l);
  }
  for (const [k, r] of live) if (!seen.has(k)) out.push({ ...r, key: k });
  return out;
}

/** Sample an easing as points (x, y) in 0–1 for a small curve preview. */
export function easingPoints(easing: string, n = 24): [number, number][] {
  const bez = easing.match(/^Bezier\(([-\d.]+), ([-\d.]+), ([-\d.]+), ([-\d.]+)\)$/);
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const s = i / n;
    if (bez) {
      const [x1, y1, x2, y2] = bez.slice(1).map(Number);
      const c = (a: number, b: number) => 3 * (1 - s) ** 2 * s * a + 3 * (1 - s) * s * s * b + s ** 3;
      pts.push([c(x1, x2), c(y1, y2)]);
    } else if (easing === 'Linear') {
      pts.push([s, s]);
    } else {
      pts.push([s, 1 - (1 - s) ** 3]); // EaseOutCubic (the default)
    }
  }
  return pts;
}

/** Readable easing name: "cubic-bezier(0.34, 1.56, 0.64, 1)" / "linear" / "ease-out". */
export function easingLabel(easing: string): string {
  const bez = easing.match(/^Bezier\((.*)\)$/);
  if (bez) return `cubic-bezier(${bez[1].split(', ').map((v) => +Number(v).toFixed(3)).join(', ')})`;
  return easing === 'Linear' ? 'linear' : easing === 'EaseOutCubic' ? 'ease-out' : easing;
}

export const RATES = [1, 0.5, 0.25, 0.1];
