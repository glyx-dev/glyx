// Performance panel data: frames from `Performance.frame`, statistics, and
// recordings (export / import).

export interface Frame {
  seq: number;
  /** Gap since the previous frame started (includes idle time before it). */
  frameTime: number;
  /** This frame's own cost: start to presented, pacing excluded. Older
   *  recordings may lack it (then frameTime stands in). */
  workTime?: number;
  jsTime: number;
  layoutTime: number;
  renderTime: number;
  presentTime: number;
  damagePx: number;
  partial: boolean;
  animating: number;
  nodeCount: number;
  heapUsed: number;
}

export const PHASES = [
  { key: 'jsTime', label: 'JS', token: '--gx-amber-500' },
  { key: 'layoutTime', label: 'Layout', token: '--gx-violet-500' },
  { key: 'renderTime', label: 'Render', token: '--gx-neutral-400' },
  { key: 'presentTime', label: 'Present', token: '--gx-neutral-600' },
] as const;

export type PhaseKey = (typeof PHASES)[number]['key'];

/** A frame's own cost (what budgets are about). */
export const cost = (f: Frame) => f.workTime ?? f.frameTime;

/** Gaps longer than this are idle time, not a frame rate. */
const IDLE_GAP_MS = 100;

/** Nearest-rank percentile of `values` (0–100). */
export function percentile(values: number[], p: number): number {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const rank = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[rank];
}

export interface Summary {
  frames: number;
  fps: number;
  p50: number;
  p90: number;
  p99: number;
  overBudget: number;
  overBudgetPct: number;
  partialPct: number;
  avg: Record<PhaseKey, number>;
}

/** Stats over `frames`. Percentiles and "over budget" use each frame's own
 *  cost; fps uses the gaps between frames, leaving out idle stretches (gaps
 *  over 100 ms), so a pause doesn't drag it down. */
export function summarize(frames: Frame[], budgetMs: number): Summary {
  const n = frames.length;
  const times = frames.map(cost);
  const gaps = frames.map((f) => f.frameTime).filter((g) => g > 0 && g <= IDLE_GAP_MS);
  const gapTotal = gaps.reduce((a, b) => a + b, 0);
  const avg = (k: PhaseKey) => (n ? frames.reduce((a, f) => a + f[k], 0) / n : 0);
  const over = frames.filter((f) => cost(f) > budgetMs).length;
  return {
    frames: n,
    fps: gapTotal > 0 ? (gaps.length * 1000) / gapTotal : 0,
    p50: percentile(times, 50),
    p90: percentile(times, 90),
    p99: percentile(times, 99),
    overBudget: over,
    overBudgetPct: n ? (over / n) * 100 : 0,
    partialPct: n ? (frames.filter((f) => f.partial).length / n) * 100 : 0,
    avg: { jsTime: avg('jsTime'), layoutTime: avg('layoutTime'), renderTime: avg('renderTime'), presentTime: avg('presentTime') },
  };
}

/** The part of a frame's cost outside the four measured phases (event
 *  handling, scene commands, bookkeeping). */
export function otherTime(f: Frame): number {
  return Math.max(0, cost(f) - f.jsTime - f.layoutTime - f.renderTime - f.presentTime);
}

export interface Recording {
  format: 'glyx-devtools-performance';
  version: 1;
  app?: string;
  engine?: string;
  budgetMs: number;
  recordedAt: string;
  frames: Frame[];
}

export function toRecording(frames: Frame[], budgetMs: number, app?: string, engine?: string): Recording {
  return { format: 'glyx-devtools-performance', version: 1, app, engine, budgetMs, recordedAt: new Date().toISOString(), frames };
}

/** Parse an exported recording; throws with a readable message otherwise. */
export function fromRecording(text: string): Recording {
  let v: any;
  try { v = JSON.parse(text); } catch { throw new Error('Not a JSON file'); }
  if (v?.format !== 'glyx-devtools-performance') throw new Error('Not a Glyx DevTools performance recording');
  if (!Array.isArray(v.frames)) throw new Error('The recording has no frames');
  return v as Recording;
}

export const fmtMs = (ms: number) => (ms >= 10 ? ms.toFixed(1) : ms.toFixed(2)) + ' ms';
