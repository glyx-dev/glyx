// Inspector data: the element tree from GDP, flattened into visible rows
// (with expansion, search and the "my components" view), plus small helpers
// shared by the tree and the details pane.

export interface TreeNode {
  nodeId: number;
  id?: string;            // element ID (auto or pinned testID)
  pinned?: boolean;
  component?: string;     // "Btn › Pressable"
  type: string;           // View / Text / Image …
  rect?: [number, number, number, number] | null;
  childCount: number;
  testID?: string;
  text?: string;
  role?: string;
  label?: string;
  children?: TreeNode[];
}

export interface Row {
  node: TreeNode;
  depth: number;
  hasChildren: boolean;
  expanded: boolean;
  /** Parent row's node id (for Left-arrow = go to parent). */
  parent: number | null;
}

/** "Btn › Pressable" → the app part ("Btn") or the whole name. */
export function appComponent(c?: string): string | undefined {
  if (!c) return undefined;
  const i = c.indexOf(' › ');
  return i < 0 ? c : c.slice(0, i);
}

/** Strip "@file:line" for display; keep it for the tooltip. */
export function shortName(c?: string): string | undefined {
  return c?.replace(/@[^ ›]+/g, '');
}

/**
 * With `myComponents`, only component boundaries are shown: a node whose
 * component differs from its parent's. Others are skipped and their
 * children lifted up, so the tree reads like the app's JSX.
 */
function visibleChildren(node: TreeNode, myComponents: boolean, pinned?: Set<number>): TreeNode[] {
  const kids = node.children ?? [];
  if (!myComponents) return kids;
  const out: TreeNode[] = [];
  const walk = (list: TreeNode[], parentComponent?: string) => {
    for (const k of list) {
      // `pinned`: the selected element and its path always get a row, even
      // inside a component (picked in the app, or found by ID).
      if ((k.component && k.component !== parentComponent) || pinned?.has(k.nodeId)) out.push(k);
      else walk(k.children ?? [], parentComponent);
    }
  };
  walk(kids, node.component);
  return out;
}

export function matches(node: TreeNode, q: string): boolean {
  if (!q) return false;
  const s = q.toLowerCase();
  return [node.id, node.component, node.text, node.testID, node.label, node.type, String(node.nodeId)]
    .some((v) => v != null && v.toLowerCase().includes(s));
}

/** Flatten to rows. With a search, rows are the matches plus their ancestors. */
export function flatten(root: TreeNode | null, expanded: Set<number>, myComponents: boolean, search: string, pinned?: Set<number>): Row[] {
  const rows: Row[] = [];
  if (!root) return rows;
  const q = search.trim();

  // With a search, keep only nodes on a path to a match (and show them open).
  let keep: Set<number> | null = null;
  if (q) {
    keep = new Set();
    const mark = (n: TreeNode, trail: number[]): boolean => {
      let hit = matches(n, q);
      for (const c of visibleChildren(n, myComponents, pinned)) hit = mark(c, [...trail, n.nodeId]) || hit;
      if (hit) keep!.add(n.nodeId);
      return hit;
    };
    mark(root, []);
  }

  const walk = (n: TreeNode, depth: number, parent: number | null) => {
    if (keep && !keep.has(n.nodeId)) return;
    const kids = visibleChildren(n, myComponents, pinned);
    const open = keep ? true : expanded.has(n.nodeId);
    rows.push({ node: n, depth, hasChildren: kids.length > 0, expanded: open, parent });
    if (open) for (const k of kids) walk(k, depth + 1, n.nodeId);
  };
  walk(root, 0, null);
  return rows;
}

/** Every node, by node id and by element ID. */
export function index(root: TreeNode | null) {
  const byNode = new Map<number, TreeNode>();
  const byId = new Map<string, TreeNode>();
  const parentOf = new Map<number, number>();
  const walk = (n: TreeNode, parent?: number) => {
    byNode.set(n.nodeId, n);
    if (n.id) byId.set(n.id, n);
    if (parent != null) parentOf.set(n.nodeId, parent);
    for (const c of n.children ?? []) walk(c, n.nodeId);
  };
  if (root) walk(root);
  return { byNode, byId, parentOf };
}

/** Ancestors of `nodeId`, root first (for expanding the path to it). */
export function ancestors(parentOf: Map<number, number>, nodeId: number): number[] {
  const out: number[] = [];
  for (let p = parentOf.get(nodeId); p != null; p = parentOf.get(p)) out.unshift(p);
  return out;
}

/** "Px(8.0)" / "Percent(0.5)" (GDP prop format) → a display value + px number. */
export function parseLength(v: unknown): { text: string; px: number } | null {
  if (typeof v !== 'string') return null;
  const px = v.match(/^Px\(([-\d.]+)\)$/);
  if (px) { const n = Number(px[1]); return { text: `${+n.toFixed(2)}`, px: n }; }
  const pc = v.match(/^Percent\(([-\d.]+)\)$/);
  if (pc) return { text: `${+(Number(pc[1]) * 100).toFixed(2)}%`, px: 0 };
  return { text: v, px: 0 };
}

/** Props that `Inspector.setNodeProp` can change, and how to edit them. */
export const EDITABLE: Record<string, 'text' | 'color' | 'number' | 'length'> = {
  text: 'text', testID: 'text', fontWeight: 'text',
  backgroundColor: 'color', color: 'color', borderColor: 'color',
  borderWidth: 'number', borderRadius: 'number', opacity: 'number', fontSize: 'number', flex: 'number', zIndex: 'number',
  width: 'length', height: 'length', padding: 'length', margin: 'length', gap: 'length',
  flexDirection: 'text', justifyContent: 'text', alignItems: 'text',
};

export const PROP_GROUPS: [string, string[]][] = [
  ['Content', ['text', 'placeholder', 'testID']],
  ['Layout', ['width', 'height', 'flex', 'flexDirection', 'justifyContent', 'alignItems', 'padding', 'margin', 'gap', 'overflow', 'zIndex', 'scrollOffsetY']],
  ['Style', ['backgroundColor', 'color', 'borderColor', 'borderWidth', 'borderRadius', 'opacity']],
  ['Text', ['fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'textAlign', 'numberOfLines']],
  ['Accessibility', ['role', 'ariaLabel', 'accessibilityHint', 'checked', 'expanded', 'value', 'focusable', 'pressable', 'draggable']],
];

/** A value from the props JSON → what an editor input starts with. */
export function editorValue(kind: string, v: unknown): string {
  if (v == null) return '';
  if (kind === 'length') return parseLength(v)?.text ?? String(v);
  return String(v);
}

/** Editor input → the value `setNodeProp` wants (null unsets). */
export function toPropValue(kind: string, raw: string): unknown {
  const t = raw.trim();
  if (t === '') return null;
  if (kind === 'number') return Number(t);
  if (kind === 'length') return t.endsWith('%') ? t : Number(t);
  return t;
}

/** The first text inside `node` (a few levels down): a hint for rows that
 *  don't show their own text, so twenty "Btn › Pressable" rows read "7",
 *  "8", "9"… */
export function textPreview(node: TreeNode, depth = 0): string | undefined {
  if (node.text != null && node.text.trim() !== '') return node.text;
  if (depth >= 4) return undefined;
  for (const c of node.children ?? []) {
    const t = textPreview(c, depth + 1);
    if (t) return t;
  }
  return undefined;
}
