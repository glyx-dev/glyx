// Undo and redo history for one text field, behaving like a browser's.
//
// An edit is stored as a small diff (where, what was removed, what was inserted) and the selection before and after it, never as a copy of
// the whole text, and the history is capped by steps and by bytes, so a long editing session in a big field costs a few hundred KB at most.
//
// What makes a step:
//   - a run of typing is one step (until the caret moves, the kind of edit changes, or a pause longer than `RUN_GAP_MS`);
//   - a run of Backspace, and a run of Delete, are each one step;
//   - cut, paste, Enter, deleting a selection and an IME commit are each their own step;
//   - a new edit after an undo drops the redo steps;
//   - a change to the text that did not come through `record` (the app set `value` itself) makes the old steps meaningless, so
//     `sync` drops the whole history.

export interface Selection { anchor: number; focus: number }

/** What kind of edit it was, which decides whether it can join the step before it. */
export type EditKind = 'type' | 'backspace' | 'delete' | 'cut' | 'paste' | 'enter' | 'other';

interface Step {
  pos:      number;      // where in the text the change starts
  removed:  string;      // what was there before
  inserted: string;      // what is there now
  before:   Selection;   // the selection before the edit (restored by undo)
  after:    Selection;   // the selection after it (restored by redo)
  kind:     EditKind;
  time:     number;      // of the last edit joined into this step
}

/** The most steps kept per field (the oldest are dropped first). */
export const MAX_STEPS = 200;
/** The most memory the steps of one field may hold, in bytes (about 2 bytes a character, plus a fixed cost per step). */
export const MAX_BYTES = 256 * 1024;
/** A pause this long ends a run of typing: the next key starts a new step. */
export const RUN_GAP_MS = 1000;

const STEP_OVERHEAD = 64;
const cost = (s: Step) => (s.removed.length + s.inserted.length) * 2 + STEP_OVERHEAD;

/** The smallest single change that turns `prev` into `next`: common start and end trimmed off. */
export function diff(prev: string, next: string) {
  let start = 0;
  const max = Math.min(prev.length, next.length);
  while (start < max && prev.charCodeAt(start) === next.charCodeAt(start)) start++;
  let endPrev = prev.length, endNext = next.length;
  while (endPrev > start && endNext > start && prev.charCodeAt(endPrev - 1) === next.charCodeAt(endNext - 1)) { endPrev--; endNext--; }
  // Do not cut a surrogate pair in half.
  if (start > 0 && start < prev.length) {
    const c = prev.charCodeAt(start - 1);
    if (c >= 0xd800 && c <= 0xdbff) start--;
  }
  return { pos: start, removed: prev.slice(start, endPrev), inserted: next.slice(start, endNext) };
}

export class TextHistory {
  private undoSteps: Step[] = [];
  private redoSteps: Step[] = [];
  private bytes = 0;
  /** The caret moved or the selection changed on purpose: the next edit starts a new step. */
  private broken = true;
  /** The text as this history last saw it; `null` before the first edit. */
  private known: string | null = null;

  constructor(
    private readonly maxSteps = MAX_STEPS,
    private readonly maxBytes = MAX_BYTES,
    private readonly now: () => number = () => Date.now(),
  ) {}

  get canUndo() { return this.undoSteps.length > 0; }
  get canRedo() { return this.redoSteps.length > 0; }
  /** Memory the steps hold, in bytes (for tests and diagnostics). */
  get size() { return this.bytes; }
  get steps() { return this.undoSteps.length; }

  clear() {
    this.undoSteps = [];
    this.redoSteps = [];
    this.bytes = 0;
    this.broken = true;
  }

  /** Call with the field's current text before using the history: drops it if the text was changed from outside. */
  sync(current: string) {
    if (this.known !== null && this.known !== current) this.clear();
    this.known = current;
  }

  /** The caret was moved or the selection changed: whatever is typed next is a new step. */
  breakRun() { this.broken = true; }

  /** Record that `prev` became `next` (selection `before`, then `after`). */
  record(prev: string, next: string, before: Selection, after: Selection, kind: EditKind) {
    this.known = next;
    if (prev === next) return;
    const d = diff(prev, next);
    // Where a change sits is ambiguous when letters repeat (deleting one of the two l in "hello" is the same text either way), so use
    // the caret, which knows: typing ends at the caret, Backspace removes what was before it, Delete what was after it.
    const cand = kind === 'type' ? after.focus - d.inserted.length
      : kind === 'backspace' ? before.focus - d.removed.length
      : kind === 'delete' ? before.focus : d.pos;
    if (cand !== d.pos && cand >= 0 && prev.slice(0, cand) + d.inserted + prev.slice(cand + d.removed.length) === next) {
      d.pos = cand;
      d.removed = prev.slice(cand, cand + d.removed.length);
    }
    // A new edit ends whatever could have been redone.
    if (this.redoSteps.length) { for (const s of this.redoSteps) this.bytes -= cost(s); this.redoSteps = []; }

    const t = this.now();
    const top = this.undoSteps[this.undoSteps.length - 1];
    if (top && !this.broken && top.kind === kind && t - top.time < RUN_GAP_MS && this.join(top, d, after, kind)) {
      top.time = t;
      return;
    }
    const step: Step = { pos: d.pos, removed: d.removed, inserted: d.inserted, before, after, kind, time: t };
    this.undoSteps.push(step);
    this.bytes += cost(step);
    this.broken = false;
    this.trim();
  }

  /** Undo the last step against `current`. Returns the text and the selection to show, or null when there is nothing to undo. */
  undo(current: string): { text: string; selection: Selection } | null {
    this.sync(current);
    const s = this.undoSteps.pop();
    if (!s) return null;
    this.bytes -= cost(s);
    if (current.slice(s.pos, s.pos + s.inserted.length) !== s.inserted) { this.clear(); return null; }
    const text = current.slice(0, s.pos) + s.removed + current.slice(s.pos + s.inserted.length);
    this.redoSteps.push(s);
    this.bytes += cost(s);
    this.broken = true;
    this.known = text;
    return { text, selection: s.before };
  }

  /** Redo the step an undo took back. */
  redo(current: string): { text: string; selection: Selection } | null {
    this.sync(current);
    const s = this.redoSteps.pop();
    if (!s) return null;
    this.bytes -= cost(s);
    if (current.slice(s.pos, s.pos + s.removed.length) !== s.removed) { this.clear(); return null; }
    const text = current.slice(0, s.pos) + s.inserted + current.slice(s.pos + s.removed.length);
    this.undoSteps.push(s);
    this.bytes += cost(s);
    this.broken = true;
    this.known = text;
    return { text, selection: s.after };
  }

  /** Fold an edit into the step before it when it continues the same run. */
  private join(top: Step, d: { pos: number; removed: string; inserted: string }, after: Selection, kind: EditKind): boolean {
    const before = cost(top);
    let ok = false;
    if (kind === 'type' && d.removed === '' && d.pos === top.pos + top.inserted.length) {
      top.inserted += d.inserted;
      ok = true;
    } else if (kind === 'backspace' && d.inserted === '' && top.inserted === '' && d.pos + d.removed.length === top.pos) {
      top.pos = d.pos;
      top.removed = d.removed + top.removed;
      ok = true;
    } else if (kind === 'delete' && d.inserted === '' && top.inserted === '' && d.pos === top.pos) {
      top.removed += d.removed;
      ok = true;
    }
    if (!ok) return false;
    top.after = after;
    this.bytes += cost(top) - before;
    this.trim();
    return true;
  }

  /** Drop the oldest steps while there are too many or they hold too much (the newest one always stays). */
  private trim() {
    let drop = 0;
    while (this.undoSteps.length - drop > 1 && (this.undoSteps.length - drop > this.maxSteps || this.bytes > this.maxBytes)) {
      this.bytes -= cost(this.undoSteps[drop]);
      drop++;
    }
    if (drop) this.undoSteps.splice(0, drop);
  }
}
