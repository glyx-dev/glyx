import { test, expect } from 'bun:test';
import { recordCommit, startRecording, stopRecording, isRecording, MAX_COMMITS } from './devProfile.js';

// Minimal fibers: tag 0 = function component, 5 = host element, 3 = root.
function fiber(tag, type, { actualDuration = 0, flags = 0, alternate } = {}) {
  return { tag, type, actualDuration, flags, alternate, child: null, sibling: null };
}
function link(parent, children) {
  parent.child = children[0] ?? null;
  children.forEach((c, i) => { c.sibling = children[i + 1] ?? null; });
  return parent;
}
function App() {}
function List() {}
function Row() {}
function Static() {}

test('records only what rendered, with self and total time', () => {
  const staticOld = fiber(0, Static, { flags: 1, actualDuration: 9 }); // rendered last time
  const staticHost = fiber(5, 'view');
  link(staticOld, [staticHost]);
  // `Static` bailed out: its WIP clone shares children with the old fiber.
  const staticWip = fiber(0, Static, { alternate: staticOld });
  staticWip.child = staticOld.child;

  const row1 = fiber(0, Row, { flags: 1, actualDuration: 2 });
  const row2 = fiber(0, Row, { flags: 1, actualDuration: 3 });
  const list = link(fiber(0, List, { flags: 1, actualDuration: 6 }), [link(fiber(5, 'view', { actualDuration: 5 }), [row1, row2])]);
  const app = link(fiber(0, App, { flags: 1, actualDuration: 7 }), [list, staticWip]);
  const root = link(fiber(3, null, { actualDuration: 7 }), [app]);

  startRecording(0);
  recordCommit(root, (t) => t === Row, 10);
  const r = stopRecording();
  expect(isRecording()).toBe(false);
  const c = r.commits[0];
  expect(c.at).toBe(10);
  expect(c.duration).toBe(7);
  expect(c.components.map((x) => [x.name, x.depth, x.self, x.total])).toEqual([
    ['App', 0, 1, 7], ['List', 1, 1, 6], ['Row', 2, 2, 2], ['Row', 2, 3, 3],
  ]);
  expect(c.components[2]).toMatchObject({ parent: 1, library: true, mount: true });
  // Static didn't render and its old subtree wasn't walked.
  expect(c.components.some((x) => x.name === 'Static')).toBe(false);
});

test('nothing is kept unless recording, and old commits roll off', () => {
  const root = link(fiber(3, null), [fiber(0, App, { flags: 1, actualDuration: 1 })]);
  recordCommit(root);
  expect(stopRecording()).toBe(null);
  startRecording(0);
  for (let i = 0; i < MAX_COMMITS + 5; i++) recordCommit(root, undefined, i);
  const r = stopRecording();
  expect(r.commits).toHaveLength(MAX_COMMITS);
  expect(r.dropped).toBe(5);
  expect(r.commits[0].at).toBe(5);
});
