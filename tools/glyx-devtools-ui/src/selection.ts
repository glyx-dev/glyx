// The element selected in the Inspector, shared with other panels (the
// Console binds it to `$0`).

export interface Selection { nodeId: number; id?: string; component?: string; type?: string }

type Listener = (s: Selection | null) => void;
let current: Selection | null = null;
const listeners = new Set<Listener>();

export function setSelection(s: Selection | null) {
  if (s?.nodeId === current?.nodeId && s?.id === current?.id) return;
  current = s;
  listeners.forEach((fn) => fn(current));
}

export function getSelection() { return current; }

export function onSelection(fn: Listener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
