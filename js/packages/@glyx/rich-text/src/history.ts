// Undo and redo for the rich-text editor.
//
// A rich-text document is an immutable tree: every edit makes a new document that shares all the paragraphs it did not touch with the
// one before. So a step is just a reference to the document, caret and selection as they were before the edit: the memory per step is
// the paragraphs that edit changed, not a copy of the text, and the list is capped (`MAX_STEPS`) and freed with the editor.
//
// What makes a step (the same rules as a text field's history, in @glyx-dev/react):
//   - a run of typing is one step (until the caret moves, the kind of edit changes, or a pause longer than `RUN_GAP_MS`);
//   - a run of Backspace, and a run of Delete, are each one step;
//   - everything else (cut, paste, Enter, deleting a selection, a format, a list change) is its own step;
//   - a new edit after an undo drops the redo steps.

export type EditKind = 'type' | 'backspace' | 'delete' | 'other';

export interface Snapshot<D, C, S> { doc: D; cursor: C; sel: S }

/** The most steps kept (the oldest are dropped first). */
export const MAX_STEPS = 200;
/** A pause this long ends a run of typing. */
export const RUN_GAP_MS = 1000;

export class DocHistory<D, C, S> {
  private undoSteps: Snapshot<D, C, S>[] = [];
  private redoSteps: Snapshot<D, C, S>[] = [];
  private lastKind: EditKind | null = null;
  private lastTime = 0;
  private broken = true;

  constructor(private readonly max = MAX_STEPS, private readonly now: () => number = () => Date.now()) {}

  get canUndo() { return this.undoSteps.length > 0; }
  get canRedo() { return this.redoSteps.length > 0; }
  get steps() { return this.undoSteps.length; }

  clear() { this.undoSteps = []; this.redoSteps = []; this.lastKind = null; this.broken = true; }

  /** The caret moved or the selection changed: the next edit starts a new step. */
  breakRun() { this.broken = true; }

  /** About to apply an edit of `kind` to the state `before`: keep `before` unless the edit continues the run it is part of. */
  push(before: Snapshot<D, C, S>, kind: EditKind) {
    if (this.redoSteps.length) this.redoSteps = [];
    const t = this.now();
    const joins = !this.broken && kind !== 'other' && kind === this.lastKind && t - this.lastTime < RUN_GAP_MS && this.undoSteps.length > 0;
    this.lastKind = kind;
    this.lastTime = t;
    this.broken = false;
    if (joins) return;
    this.undoSteps.push(before);
    if (this.undoSteps.length > this.max) this.undoSteps.shift();
  }

  /** Step back: `current` goes onto the redo list, and the state to show is returned (null when there is nothing to undo). */
  undo(current: Snapshot<D, C, S>): Snapshot<D, C, S> | null {
    const s = this.undoSteps.pop();
    if (!s) return null;
    this.redoSteps.push(current);
    this.broken = true;
    return s;
  }

  redo(current: Snapshot<D, C, S>): Snapshot<D, C, S> | null {
    const s = this.redoSteps.pop();
    if (!s) return null;
    this.undoSteps.push(current);
    this.broken = true;
    return s;
  }
}
