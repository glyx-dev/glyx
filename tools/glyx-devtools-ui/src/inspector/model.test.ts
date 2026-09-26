import { test, expect } from 'bun:test';
import { flatten, index, ancestors, parseLength, toPropValue, editorValue, appComponent, shortName, type TreeNode } from './model';

const n = (nodeId: number, component: string, children: TreeNode[] = [], extra: Partial<TreeNode> = {}): TreeNode =>
  ({ nodeId, id: `id${nodeId}`, component, type: 'View', childCount: children.length, children, ...extra });

// App > (View > Btn/Pressable > Text "7"), Text "0"
const tree = n(1, 'App › View', [
  n(2, 'App › View', [n(3, 'Btn › Pressable', [n(4, 'Btn › Text', [], { type: 'Text', text: '7' })])]),
  n(5, 'App › Text', [], { type: 'Text', text: '0' }),
]);

test('rows follow expansion', () => {
  expect(flatten(tree, new Set(), false, '').map((r) => r.node.nodeId)).toEqual([1]);
  const rows = flatten(tree, new Set([1, 2]), false, '');
  expect(rows.map((r) => [r.node.nodeId, r.depth])).toEqual([[1, 0], [2, 1], [3, 2], [5, 1]]);
  expect(rows[2].hasChildren).toBe(true);
});

test('"my components" keeps only component boundaries', () => {
  const rows = flatten(tree, new Set([1, 3]), true, '');
  // 2 has the same component as 1 → hidden, its child lifted.
  expect(rows.map((r) => [r.node.nodeId, r.depth])).toEqual([[1, 0], [3, 1], [4, 2], [5, 1]]);
});

test('search shows matches with their ancestors, opened', () => {
  const rows = flatten(tree, new Set(), false, '7');
  expect(rows.map((r) => r.node.nodeId)).toEqual([1, 2, 3, 4]);
  expect(flatten(tree, new Set(), false, 'nothing-here')).toEqual([]);
  expect(flatten(tree, new Set(), false, 'btn').map((r) => r.node.nodeId)).toEqual([1, 2, 3, 4]);
});

test('index and ancestors', () => {
  const { byId, parentOf } = index(tree);
  expect(byId.get('id4')?.text).toBe('7');
  expect(ancestors(parentOf, 4)).toEqual([1, 2, 3]);
});

test('lengths and editor values', () => {
  expect(parseLength('Px(24.0)')).toEqual({ text: '24', px: 24 });
  expect(parseLength('Percent(0.5)')).toEqual({ text: '50%', px: 0 });
  expect(parseLength(12)).toBe(null);
  expect(editorValue('length', 'Px(8.0)')).toBe('8');
  expect(toPropValue('length', '50%')).toBe('50%');
  expect(toPropValue('length', '12')).toBe(12);
  expect(toPropValue('number', '')).toBe(null);
  expect(toPropValue('color', ' #ff0000 ')).toBe('#ff0000');
});

test('component names', () => {
  expect(appComponent('Btn › Pressable')).toBe('Btn');
  expect(appComponent('Text')).toBe('Text');
  expect(shortName('Btn@app.jsx:12 › Pressable')).toBe('Btn › Pressable');
});

test('rows without text get a preview of the text inside', async () => {
  const { textPreview } = await import('./model');
  expect(textPreview(tree.children![0])).toBe('7');
  expect(textPreview(n(9, 'X'))).toBe(undefined);
});

test('the selection keeps a row even inside a component', () => {
  // 2 shares its parent's component, so "my components" hides it…
  expect(flatten(tree, new Set([1, 2]), true, '').map((r) => r.node.nodeId)).not.toContain(2);
  // …unless it's the selection (or on the selection's path).
  const rows = flatten(tree, new Set([1, 2]), true, '', new Set([1, 2]));
  expect(rows.map((r) => [r.node.nodeId, r.depth])).toEqual([[1, 0], [2, 1], [3, 2], [5, 1]]);
});
