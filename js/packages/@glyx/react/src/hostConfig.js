// @glyx-dev/react — react-reconciler HostConfig
//
// This is the bridge between React's reconciler and Glyx's native scene graph.
// Every method here maps React's internal tree operations to native bindings
// exposed by the Rust runtime: __glyx_createNode, __glyx_appendChild,
// __glyx_updateNode, __glyx_removeNode, __glyx_setRoot.
//
// Only `supportsMutation: true` is enabled — no persistence, no hydration.

import { DefaultEventPriority } from 'react-reconciler/constants';
import { setNodeParent, removeNodeFromTree } from './events.js';
import { computeIds } from './devIds.js';
import { isRecording, recordCommit, startRecording, stopRecording } from './devProfile.js';

// Release builds drop `testID` before it reaches native: `glyx build` defines
// __GLYX_STRIP_TEST_IDS__ = true unless the app sets `keepTestIds` (for
// end-to-end tests against the release binary). Dev keeps it.
const STRIP_TEST_IDS = typeof __GLYX_STRIP_TEST_IDS__ !== 'undefined' && __GLYX_STRIP_TEST_IDS__;

// ── Scene-op batching ─────────────────────────────────────────────────────────
//
// `appendChild`/`insertBefore`/`commitUpdate`/`removeChild`/`setRoot` don't
// need a synchronous return value (their native return is unused below), so
// instead of one JS→native call per op, they're queued here and flushed once
// per commit via `resetAfterCommit` through `__glyx_flushSceneOps`. Cuts N
// interpreter-boundary crossings per commit down to 1.
//
// `createInstance`'s `__glyx_createNode` call is NOT batched — React needs
// the new node's id back immediately (synchronously), so it stays a direct
// call. Everything downstream of that id (append/update/etc) is safe to
// defer: within one synchronous commit, a node is always created before
// anything references its id, so queuing preserves the required ordering
// even though creates and queued ops interleave in issue order.
//
// Encoding: ONE FLAT array (op, args, op, args, ...), not an array of
// per-op arrays. A commit that removes ~8,000 nodes (e.g. bench-app's
// full-render → virtualized switch) used to build ~8,000 separate small
// array objects, each needing its own JS→native conversion on the native
// side (`Array::iter::<Array>()`/nested `Array` reads) — real allocation +
// marshalling cost that measurably hit QuickJS harder than V8 (see
// CHANGELOG_PERF.md's teardown-gap comparison). A flat array is one
// contiguous JS object; the native side reads it as one buffer with a
// known per-opcode stride instead of unwrapping N nested arrays.
const OP_APPEND        = 0; // op, parentId, childId
const OP_INSERT_BEFORE = 1; // op, parentId, childId, beforeId
const OP_UPDATE        = 2; // op, id, props
const OP_REMOVE        = 3; // op, id
const OP_SET_ROOT      = 4; // op, id

// ── Devtools: node → component names ─────────────────────────────────────────
//
// Only when a devtools server runs (`glyx dev --devtools` sets
// `__glyx_devtools` before this bundle loads): node id → its React fiber, so
// the Inspector can show `Btn@app.jsx:428 › Pressable` instead of a bare node
// id. The fiber is alive anyway while the node is mounted; entries go on
// unmount.
const devFibers = globalThis.__glyx_devtools ? new Map() : null;

// Glyx's own components (View, Text, Pressable, …), registered by index.js,
// so names can point past them to the app component that used them.
const libraryComponents = new WeakSet();
export function markLibraryComponents(values) {
  for (const v of values) if (typeof v === 'function') libraryComponents.add(v);
}

/**
 * Which component a host node belongs to: the nearest component, plus the
 * nearest one that isn't Glyx's own, outer first: `Btn@app.jsx:428 › Text`.
 * Plain `Btn` when that's the nearest. `@file:line` is where the component
 * was used, in dev JSX builds only.
 */
export function componentName(fiber) {
  let nearest = null;
  for (let f = fiber && fiber.return; f; f = f.return) {
    const t = f.type;
    const fn = typeof t === 'function' ? t
      : t && typeof t === 'object' ? (t.render || t.type || null) : null; // forwardRef / memo
    if (!fn) continue;
    let name = (t && t.displayName) || fn.displayName || fn.name || 'Anonymous';
    const src = f._debugSource;
    if (src && src.fileName) name += '@' + String(src.fileName).split(/[\\/]/).pop() + ':' + src.lineNumber;
    const isLib = libraryComponents.has(fn) || libraryComponents.has(t);
    if (!isLib) return nearest ? name + ' › ' + nearest : name;
    if (!nearest) nearest = name;
  }
  return nearest;
}

// ── Devtools: automatic element IDs (see devIds.js) ─────────────────────────
//
// Computed on request from React's current fiber tree, one O(n) pass. The
// result is cached until the tree's structure changes (any append / insert /
// remove, or a changed testID); devtools asks for the cached copy only when
// the window has more nodes than its threshold, so small apps skip the
// bookkeeping entirely and large ones don't recompute between commits.
let devRoot = null;       // FiberRoot, from index.js
let idEpoch = 0;          // bumped by every change that can alter an ID
let idCache = null;
let idCacheEpoch = -1;
export function setDevRoot(root) { devRoot = root; }
const idsChanged = () => { if (devFibers) idEpoch++; };

/** React keeps two fibers per element; the one stored at creation may be the
 *  stale one. The current one is reachable from the root's current tree. */
function currentFiber(fiber) {
  let top = fiber;
  while (top.return) top = top.return;
  return devRoot && top === devRoot.current ? fiber : (fiber.alternate ?? fiber);
}

/** A function component's hook values (useState, useRef, useMemo …), in order. */
function hookValues(fiber) {
  const out = [];
  if (typeof fiber.type !== 'function' || fiber.type.prototype?.isReactComponent) {
    return fiber.stateNode?.state != null ? [fiber.stateNode.state] : out; // class component
  }
  for (let h = fiber.memoizedState; h && out.length < 40; h = h.next) out.push(h.memoizedState);
  return out;
}

function allDevIds(useCache) {
  if (useCache && idCache && idCacheEpoch === idEpoch) return idCache;
  const t0 = Date.now();
  const ids = computeIds(devRoot && devRoot.current, (x) => libraryComponents.has(x));
  globalThis.__glyx_devIdsLastMs = Date.now() - t0;
  if (useCache) { idCache = ids; idCacheEpoch = idEpoch; } else { idCache = null; }
  return ids;
}

if (devFibers) {
  // CPU profiler, Components view: per-commit render times (see devProfile.js).
  globalThis.__glyx_devProfileStart = () => { startRecording(); return true; };
  globalThis.__glyx_devProfileStop = () => JSON.stringify(stopRecording());
  /** `{ nodeId: { id, pinned? } }` for `ids`, or for every node when `ids` is null. */
  globalThis.__glyx_devNodeIds = (ids, useCache) => {
    const all = allDevIds(!!useCache);
    const out = {};
    if (ids == null) { for (const [k, v] of all) out[k] = v; }
    else { for (const id of ids) { const v = all.get(id); if (v) out[id] = v; } }
    return out;
  };
  /**
   * `$0` in the DevTools Console: the element's live React side. `props` are
   * the element's current props (handlers included: `$0.props.onPress()`),
   * `owner` the nearest app component with its props and hook state.
   */
  globalThis.__glyx_devNode = (nodeId) => {
    const stored = devFibers.get(nodeId);
    if (!stored) return undefined;
    const fiber = currentFiber(stored);
    let owner = null;
    for (let f = fiber.return; f && !owner; f = f.return) {
      const t = f.type;
      const fn = typeof t === 'function' ? t : t && typeof t === 'object' ? (t.render || null) : null;
      if (fn && !libraryComponents.has(fn) && !libraryComponents.has(t)) {
        owner = { name: t.displayName || fn.displayName || fn.name || 'Anonymous', props: f.memoizedProps, hooks: hookValues(f) };
      }
    }
    return { nodeId, component: componentName(fiber), type: fiber.type, key: fiber.key, props: fiber.memoizedProps, owner };
  };

  /**
   * DevTools Memory snapshot: elements per app component (the nearest
   * component that isn't Glyx's own), most first. `{ component, elements,
   * instances }`, one O(n) walk of the current tree.
   */
  globalThis.__glyx_devComponentCounts = () => {
    const counts = new Map();
    const root = devRoot && devRoot.current;
    if (!root) return [];
    const stack = [[root.child, 'App']];
    // Push siblings too: each frame is [fiber, owning component name].
    while (stack.length) {
      const [f, owner] = stack.pop();
      if (!f) continue;
      stack.push([f.sibling, owner]);
      const t = f.type;
      const fn = typeof t === 'function' ? t : t && typeof t === 'object' ? (t.render || null) : null;
      let next = owner;
      if (fn && !libraryComponents.has(fn) && !libraryComponents.has(t)) {
        next = (t && t.displayName) || fn.displayName || fn.name || 'Anonymous';
        const c = counts.get(next) ?? { component: next, elements: 0, instances: 0 };
        c.instances++;
        counts.set(next, c);
      }
      if (f.tag === 5) {
        const c = counts.get(owner) ?? { component: owner, elements: 0, instances: 0 };
        c.elements++;
        counts.set(owner, c);
      }
      stack.push([f.child, next]);
    }
    return [...counts.values()].filter((c) => c.elements > 0 || c.instances > 0).sort((a, b) => b.elements - a.elements);
  };

  /** The node carrying element ID `id`, or null (a lookup, not a full dump). */
  globalThis.__glyx_devFindId = (id, useCache) => {
    for (const [nodeId, v] of allDevIds(!!useCache)) if (v.id === id) return nodeId;
    return null;
  };
}

if (devFibers) {
  globalThis.__glyx_devNodeNames = (ids) => {
    const out = {};
    for (const id of ids) {
      const name = componentName(devFibers.get(id));
      if (name) out[id] = name;
    }
    return out;
  };
}

let pendingOps = [];

function queueOp(op, ...args) {
  pendingOps.push(op, ...args);
}

function flushSceneOps() {
  if (pendingOps.length === 0) return;
  const ops = pendingOps;
  pendingOps = [];
  __glyx_flushSceneOps(ops);
}

// ── Transitions (@glyx-dev/motion) ────────────────────────────────────────────

// `transition={{ duration, properties, easing }}` → flat props, since Rust
// reads plain values, not nested objects (see NodeProps::transition_ms).
// `properties` defaults to opacity only; `'all'` animates every supported one.
function applyTransition(nodeProps, transition) {
  if (!transition || typeof transition.duration !== 'number') return;
  nodeProps.transitionMs = transition.duration;
  const { properties, easing } = transition;
  if (Array.isArray(properties)) nodeProps.transitionProperty = properties.join(',');
  else if (typeof properties === 'string') nodeProps.transitionProperty = properties;
  if (typeof easing === 'string') nodeProps.transitionEasing = easing;
}

// Animatable keyframe properties (the same set `transition` animates).
const KEYFRAME_PROPS = ['opacity', 'transform', 'backgroundColor', 'borderColor', 'borderRadius', 'boxShadow'];

// Keyframe key → offset in 0..1: `from`/`to`, `'50%'`, or a percentage number.
function keyframeOffset(key) {
  if (key === 'from') return 0;
  if (key === 'to') return 1;
  const n = parseFloat(key);
  return Number.isFinite(n) ? Math.min(Math.max(n / 100, 0), 1) : null;
}

// `animation={{ keyframes, duration, easing, iterations, direction, fill }}`
// → flat props (Rust reads plain values; the stops travel as one JSON
// string, parsed natively — see NodeProps::animation_keyframes).
// `keyframes` is either an object keyed by offset (`{ 0: {...}, '50%': {...},
// to: {...} }`) or an array of frames spaced evenly, each optionally with
// its own `offset` (0..1).
function applyAnimation(nodeProps, animation) {
  if (!animation || typeof animation.duration !== 'number' || !animation.keyframes) return;
  const pick = (frame) => {
    const out = {};
    for (const k of KEYFRAME_PROPS) if (frame && frame[k] !== undefined) out[k] = frame[k];
    return out;
  };
  const { keyframes } = animation;
  let stops;
  if (Array.isArray(keyframes)) {
    const last = Math.max(keyframes.length - 1, 1);
    stops = keyframes.map((f, i) => [typeof f?.offset === 'number' ? f.offset : i / last, pick(f)]);
  } else {
    stops = Object.keys(keyframes)
      .map((k) => [keyframeOffset(k), pick(keyframes[k])])
      .filter(([o]) => o !== null)
      // Integer-like keys enumerate first in JS objects (`100` before `from`).
      .sort((a, b) => a[0] - b[0]);
  }
  if (stops.length === 0) return;
  nodeProps.animationKeyframes = JSON.stringify(stops);
  nodeProps.animationMs = animation.duration;
  if (typeof animation.easing === 'string') nodeProps.animationEasing = animation.easing;
  if (typeof animation.iterations === 'number') {
    nodeProps.animationIterations = Number.isFinite(animation.iterations) ? animation.iterations : -1;
  }
  if (typeof animation.direction === 'string') nodeProps.animationDirection = animation.direction;
  if (typeof animation.fill === 'string') nodeProps.animationFill = animation.fill;
}

// ── Instance creation ─────────────────────────────────────────────────────────

function createInstance(type, props, _rootContainer, _hostContext, fiber) {
  // Strip `children` — React manages the tree.
  // Flatten `style` into the top-level prop object so Rust sees
  // backgroundColor, borderRadius, etc. directly (not nested under style).
  // Strip `_glyxOnMount` — a callback that components use to learn their
  // native node ID synchronously, without relying on ref forwarding.
  const { children, style, ref: _ref, _glyxOnMount, glyxDraggable, transition, animation, ...rest } = props;
  const nodeProps = { ...rest, ...style };
  if (STRIP_TEST_IDS) delete nodeProps.testID;
  if (glyxDraggable) nodeProps.draggable = true;
  applyTransition(nodeProps, transition);
  applyAnimation(nodeProps, animation);
  const id = __glyx_createNode(type, nodeProps);
  if (devFibers) devFibers.set(id, fiber);
  // Fire the mount callback immediately so the component can register its ID
  // before any useEffect / useLayoutEffect runs.
  if (typeof _glyxOnMount === 'function') {
    _glyxOnMount(id);
  }
  return { id };
}

// Raw text nodes (e.g. "hello" directly inside a host element) are not
// supported. Use <Text>hello</Text> instead. Return a stub so React never
// crashes if it somehow calls this.
function createTextInstance(text) {
  __glyx_log('[Glyx] Warning: raw text node "' + text + '" — wrap in <Text>');
  return { id: -1 };
}

// ── Tree construction (initial mount) ─────────────────────────────────────────

// Called for each child during the initial tree build (before commit).
function appendInitialChild(parentInstance, child) {
  if (child.id !== -1) {
    queueOp(OP_APPEND, parentInstance.id, child.id);
    setNodeParent(child.id, parentInstance.id);
  }
}

// ── Tree construction (updates / re-renders) ──────────────────────────────────

function appendChild(parentInstance, child) {
  idsChanged();
  if (child.id !== -1) {
    queueOp(OP_APPEND, parentInstance.id, child.id);
    setNodeParent(child.id, parentInstance.id);
  }
}

function appendChildToContainer(_container, child) {
  idsChanged();
  // The container is the virtual root (created by createContainer).
  // Explicitly set this child as the scene root so Rust knows what to render.
  if (child.id !== -1) {
    queueOp(OP_SET_ROOT, child.id);
  }
}

function insertBefore(parentInstance, child, beforeChild) {
  idsChanged();
  if (child.id !== -1) {
    if (beforeChild && beforeChild.id !== -1) {
      queueOp(OP_INSERT_BEFORE, parentInstance.id, child.id, beforeChild.id);
    } else {
      queueOp(OP_APPEND, parentInstance.id, child.id);
    }
    setNodeParent(child.id, parentInstance.id);
  }
}

function insertInContainerBefore(_container, child, _beforeChild) {
  idsChanged();
  if (child.id !== -1) {
    queueOp(OP_SET_ROOT, child.id);
  }
}

// ── Tree removal ──────────────────────────────────────────────────────────────

function removeChild(_parentInstance, child) {
  idsChanged();
  if (child.id !== -1) {
    queueOp(OP_REMOVE, child.id);
  }
}

function removeChildFromContainer(_container, child) {
  idsChanged();
  if (child.id !== -1) {
    queueOp(OP_REMOVE, child.id);
  }
}

function clearContainer(_container) {
  // No-op — scene resets when the new root is set via appendChildToContainer.
}

// Called by React after it has finished with a deleted instance.
function detachDeletedInstance(instance) {
  if (devFibers) devFibers.delete(instance.id);
  if (instance.id !== -1) {
    queueOp(OP_REMOVE, instance.id);
    removeNodeFromTree(instance.id);
  }
}

// ── Updates ───────────────────────────────────────────────────────────────────

// Return a payload to commit, or null to skip commitUpdate.
// Shallow-compare old and new props so that parent re-renders don't cascade
// a native updateNode call to every child whose visual props didn't change.
function prepareUpdate(_instance, _type, oldProps, newProps) {
  const skip = ['children', 'ref', '_glyxOnMount', 'glyxDraggable'];
  const oldKeys = Object.keys(oldProps).filter((k) => !skip.includes(k));
  const newKeys = Object.keys(newProps).filter((k) => !skip.includes(k));
  if (oldKeys.length !== newKeys.length) return newProps;
  for (const k of newKeys) {
    if (oldProps[k] !== newProps[k]) return newProps;
  }
  return null; // no visual change — skip commitUpdate
}

function commitUpdate(instance, updatePayload, _type, oldProps, newProps) {
  if (oldProps && newProps && oldProps.testID !== newProps.testID) idsChanged();
  const { children, style, ref: _ref, _glyxOnMount, glyxDraggable, transition, animation, ...rest } = updatePayload;
  const nodeProps = { ...rest, ...style };
  if (STRIP_TEST_IDS) delete nodeProps.testID;
  if (glyxDraggable) nodeProps.draggable = true;
  applyTransition(nodeProps, transition);
  applyAnimation(nodeProps, animation);
  queueOp(OP_UPDATE, instance.id, nodeProps);
}

function commitTextUpdate() {
  // Not used — we don't support raw text nodes.
}

function commitMount() {
  // Only called if finalizeInitialChildren returns true (it doesn't).
}

// ── Finalisation ──────────────────────────────────────────────────────────────

function finalizeInitialChildren() {
  // Return false — no post-mount work needed.
  return false;
}

function preparePortalMount() {}

// ── Host context (passed down the tree, can carry rendering hints) ────────────

function getRootHostContext()  { return {}; }
function getChildHostContext() { return {}; }
function getPublicInstance(instance) { return instance; }

// ── Commit lifecycle ──────────────────────────────────────────────────────────

function prepareForCommit()  { return null; }
function resetAfterCommit()  {
  flushSceneOps();
  // Still the old tree here; the finished one is its alternate.
  if (devFibers && isRecording()) recordCommit(devRoot && devRoot.current && devRoot.current.alternate, (t) => libraryComponents.has(t));
}

// ── Text content ──────────────────────────────────────────────────────────────

// Return true if the node itself handles text (so React skips createTextInstance).
// We return false: our Text component wraps children as a `text` prop.
function shouldSetTextContent() { return false; }

// ── Scheduling (delegated to our V8 polyfills) ────────────────────────────────

function scheduleTimeout(fn, delay) { return setTimeout(fn, delay); }
function cancelTimeout(id)          { clearTimeout(id); }

// ── Event priority ────────────────────────────────────────────────────────────

function getCurrentEventPriority() { return DefaultEventPriority; }

// ── Stubs required by react-reconciler 0.29 ───────────────────────────────────

function getInstanceFromNode()  { return null; }
function beforeActiveInstanceBlur() {}
function afterActiveInstanceBlur()  {}
function prepareScopeUpdate()       {}
function getInstanceFromScope()     { return null; }

// ── Export ────────────────────────────────────────────────────────────────────

const HostConfig = {
  // Creation
  createInstance,
  createTextInstance,

  // Initial tree
  appendInitialChild,

  // Mutation
  appendChild,
  appendChildToContainer,
  insertBefore,
  insertInContainerBefore,
  removeChild,
  removeChildFromContainer,
  clearContainer,
  detachDeletedInstance,

  // Updates
  prepareUpdate,
  commitUpdate,
  commitTextUpdate,
  commitMount,

  // Finalisation
  finalizeInitialChildren,
  preparePortalMount,

  // Context
  getRootHostContext,
  getChildHostContext,
  getPublicInstance,

  // Commit lifecycle
  prepareForCommit,
  resetAfterCommit,

  // Text
  shouldSetTextContent,

  // Scheduling
  scheduleTimeout,
  cancelTimeout,
  noTimeout: -1,

  // Feature flags
  supportsMutation:    true,
  supportsPersistence: false,
  supportsHydration:   false,
  isPrimaryRenderer:   true,

  // Microtask scheduling — tells React to flush sync callbacks via microtasks
  // rather than via the Scheduler (MessageChannel path). This ensures that
  // flushSync's finally block can correctly flush pending sync work when
  // setState is called from outside React's event system.
  supportsMicrotasks: true,
  scheduleMicrotask:  (fn) => Promise.resolve().then(fn),

  // Event system
  getCurrentEventPriority,
  getInstanceFromNode,
  beforeActiveInstanceBlur,
  afterActiveInstanceBlur,
  prepareScopeUpdate,
  getInstanceFromScope,
};

export default HostConfig;
export { prepareUpdate, applyTransition, applyAnimation };
