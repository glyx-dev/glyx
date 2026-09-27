// Component render profiling for Glyx DevTools (the CPU profiler panel's
// "Components" view). Works on every engine: the data comes from React's own
// profiling timers (on in the development reconciler), not from the engine.
//
// On each commit, the finished tree is walked where React actually worked
// this time, and every component that rendered is recorded with its own
// ("self") and subtree ("total") render time, in tree order, so the panel can
// draw a flame chart per commit.

/** Commits kept per recording (the newest). */
export const MAX_COMMITS = 500;

const PERFORMED_WORK = 1; // React's `PerformedWork` fiber flag
// Fiber tags that run user code when they render.
const FUNCTION = 0, CLASS = 1, FORWARD_REF = 11, MEMO = 14, SIMPLE_MEMO = 15;
const COMPONENT_TAGS = new Set([FUNCTION, CLASS, FORWARD_REF, MEMO, SIMPLE_MEMO]);

let recording = null; // { commits, started }

export function isRecording() { return recording != null; }

export function startRecording(now = Date.now()) {
  recording = { commits: [], started: now, dropped: 0 };
}

export function stopRecording() {
  const r = recording;
  recording = null;
  return r;
}

function nameOf(fiber) {
  let t = fiber.type;
  if (t && (fiber.tag === MEMO || fiber.tag === FORWARD_REF) && typeof t === 'object') t = t.type ?? t.render ?? t;
  if (!t) return 'Anonymous';
  return t.displayName || t.name || 'Anonymous';
}

/**
 * Record one commit. `finished` is the finished HostRoot fiber (the tree
 * about to become current), `libraryCheck(type)` marks Glyx's own components.
 */
export function recordCommit(finished, libraryCheck = () => false, now = Date.now()) {
  if (!recording || !finished) return;
  const components = [];
  // [fiber, depth, parent index, fresh]: `fresh` means this fiber was worked
  // on this commit (not a subtree React skipped and still shares).
  const stack = [[finished.child, 0, -1]];
  while (stack.length) {
    const [fiber, depth, parent] = stack.pop();
    if (!fiber) continue;
    if (fiber.sibling) stack.push([fiber.sibling, depth, parent]);
    let here = parent, nextDepth = depth;
    const rendered = COMPONENT_TAGS.has(fiber.tag) && (fiber.flags & PERFORMED_WORK) !== 0;
    if (rendered) {
      let childTotal = 0;
      for (let c = fiber.child; c; c = c.sibling) childTotal += c.actualDuration || 0;
      const total = fiber.actualDuration || 0;
      components.push({
        name: nameOf(fiber), depth, parent,
        total: round(total), self: round(Math.max(0, total - childTotal)),
        library: !!libraryCheck(fiber.type), mount: fiber.alternate == null,
      });
      here = components.length - 1;
      nextDepth = depth + 1;
    }
    // Children React didn't clone are shared with the old tree: skipped.
    const alt = fiber.alternate;
    if (fiber.child && !(alt && alt.child === fiber.child)) stack.push([fiber.child, nextDepth, here]);
  }
  const duration = round(finished.actualDuration || components.reduce((n, c) => (c.parent === -1 ? n + c.total : n), 0));
  recording.commits.push({ at: now - recording.started, duration, components });
  if (recording.commits.length > MAX_COMMITS) { recording.commits.shift(); recording.dropped++; }
}

const round = (ms) => Math.round(ms * 1000) / 1000;
