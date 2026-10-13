import { test, expect } from 'bun:test';
import { computeIds } from './devIds.js';

// Minimal fiber builder: host nodes get tag 5 and a { id } stateNode.
let nextId = 1;
function host(type, props = {}, children = [], key = null) {
  return link({ tag: 5, type, key, memoizedProps: props, stateNode: { id: nextId++ } }, children);
}
function comp(fn, children = [], key = null) {
  return link({ tag: 0, type: fn, key }, children);
}
function link(fiber, children) {
  fiber.child = children[0] || null;
  children.forEach((c, i) => { c.return = fiber; c.sibling = children[i + 1] || null; });
  return fiber;
}
const root = (children) => link({ tag: 3 }, children);

function View() {}
function Text() {}
function Pressable() {}
function TextInput() {}
const LIB = new Set([View, Text, Pressable, TextInput]);
const isLib = (x) => LIB.has(x);
const idsOf = (tree) => {
  const m = computeIds(tree, isLib);
  return Object.fromEntries([...m.values()].map((v, i) => [i, v]));
};
const byNode = (tree) => computeIds(tree, isLib);

function App() {}
function NoteCard() {}
function Btn() {}

test('ids are app components, then the Glyx component and its per-name slot', () => {
  nextId = 1;
  const saveView = host('view');
  const saveText = host('text');
  const delView = host('view');
  const tree = root([comp(App, [
    comp(View, [host('view', {}, [
      comp(Btn, [comp(Pressable, [saveView, ])]),
      comp(Btn, [comp(Pressable, [delView])]),
      comp(Text, [saveText]),
    ])]),
  ])]);
  const ids = byNode(tree);
  expect(ids.get(saveView.stateNode.id).id).toBe('App#0 › Btn#0 › Pressable#0');
  expect(ids.get(delView.stateNode.id).id).toBe('App#0 › Btn#1 › Pressable#0');
  expect(ids.get(saveText.stateNode.id).id).toBe('App#0 › Text#0');
});

test('keys identify list items by data, not order', () => {
  nextId = 1;
  const a = host('view');
  const b = host('view');
  const tree = root([comp(App, [comp(NoteCard, [comp(Pressable, [a])], 42), comp(NoteCard, [comp(Pressable, [b])], 7)])]);
  const ids = byNode(tree);
  expect(ids.get(a.stateNode.id).id).toBe('App#0 › NoteCard[42] › Pressable#0');
  expect(ids.get(b.stateNode.id).id).toBe('App#0 › NoteCard[7] › Pressable#0');
});

test('extra hosts inside one Glyx component get a host suffix', () => {
  nextId = 1;
  const outer = host('view');
  const inner = host('text');
  outer.child = inner; inner.return = outer;
  const tree = root([comp(App, [comp(TextInput, [outer])])]);
  const ids = byNode(tree);
  expect(ids.get(outer.stateNode.id).id).toBe('App#0 › TextInput#0');
  expect(ids.get(inner.stateNode.id).id).toBe('App#0 › TextInput#0/text#0');
});

test('ids never contain text, so translated or changed text keeps them', () => {
  nextId = 1;
  const en = root([comp(App, [comp(Text, [host('text', { text: 'Save' })])])]);
  nextId = 1;
  const fr = root([comp(App, [comp(Text, [host('text', { text: 'Enregistrer' })])])]);
  expect(idsOf(en)).toEqual(idsOf(fr));
});

test('a testID pins the id; collisions get a ~n suffix', () => {
  nextId = 1;
  const pinned = host('view', { testID: 'save' });
  const dupA = host('view', { testID: 'row' });
  const dupB = host('view', { testID: 'row' });
  const ids = byNode(root([comp(App, [pinned, dupA, dupB])]));
  expect(ids.get(pinned.stateNode.id)).toEqual({ id: 'save', pinned: true });
  expect(ids.get(dupA.stateNode.id).id).toBe('row');
  expect(ids.get(dupB.stateNode.id).id).toBe('row~2');
});

test('plain hosts outside Glyx components use the host type', () => {
  nextId = 1;
  const v0 = host('view');
  const v1 = host('view');
  const ids = byNode(root([comp(App, [v0, v1])]));
  expect(ids.get(v1.stateNode.id).id).toBe('App#0 › view#1');
});

test('a big tree is one linear pass', () => {
  nextId = 1;
  const rows = [];
  for (let i = 0; i < 20000; i++) rows.push(comp(NoteCard, [comp(Pressable, [host('view')])], i));
  const tree = root([comp(App, rows)]);
  const t0 = performance.now();
  const ids = byNode(tree);
  const ms = performance.now() - t0;
  expect(ids.size).toBe(20000);
  expect(ms).toBeLessThan(500);
});

test('the cache is reused until a structural change, then refreshed', async () => {
  globalThis.__glyx_devtools = true;
  const hc = await import('./hostConfig.js?devids-cache');
  const HostConfig = hc.default;
  hc.markLibraryComponents([Pressable]);
  nextId = 1000;
  const first = host('view');
  const app = comp(App, [comp(Pressable, [first])]);
  const hostRoot = root([app]);
  hc.setDevRoot({ current: hostRoot });

  const before = globalThis.__glyx_devNodeIds(null, true);
  expect(Object.keys(before)).toHaveLength(1);

  // Add a node without telling the host config: the cached result stands.
  const second = host('view');
  link(app, [comp(Pressable, [first]), comp(Pressable, [second])]);
  expect(Object.keys(globalThis.__glyx_devNodeIds(null, true))).toHaveLength(1);
  // Uncached always sees the live tree.
  expect(Object.keys(globalThis.__glyx_devNodeIds(null, false))).toHaveLength(2);

  // A structural change through the host config invalidates the cache.
  globalThis.__glyx_devNodeIds(null, true);
  HostConfig.appendChild({ id: first.stateNode.id }, { id: second.stateNode.id });
  const after = globalThis.__glyx_devNodeIds(null, true);
  expect(after[second.stateNode.id].id).toBe('App#0 › Pressable#1');
  delete globalThis.__glyx_devtools;
});
