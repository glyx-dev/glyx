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

// ── Instance creation ─────────────────────────────────────────────────────────

function createInstance(type, props) {
  // Strip `children` — React manages the tree.
  // Flatten `style` into the top-level prop object so Rust sees
  // backgroundColor, borderRadius, etc. directly (not nested under style).
  // Strip `_glyxOnMount` — a callback that components use to learn their
  // native node ID synchronously, without relying on ref forwarding.
  const { children, style, ref: _ref, _glyxOnMount, glyxDraggable, transition, ...rest } = props;
  const nodeProps = { ...rest, ...style };
  if (glyxDraggable) nodeProps.draggable = true;
  // @glyx-dev/motion v1: `transition={{ duration: 200 }}` → flat `transitionMs`
  // (Rust reads a plain number, not a nested object — see NodeProps::transition_ms).
  if (transition && typeof transition.duration === 'number') nodeProps.transitionMs = transition.duration;
  const id = __glyx_createNode(type, nodeProps);
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
  if (child.id !== -1) {
    queueOp(OP_APPEND, parentInstance.id, child.id);
    setNodeParent(child.id, parentInstance.id);
  }
}

function appendChildToContainer(_container, child) {
  // The container is the virtual root (created by createContainer).
  // Explicitly set this child as the scene root so Rust knows what to render.
  if (child.id !== -1) {
    queueOp(OP_SET_ROOT, child.id);
  }
}

function insertBefore(parentInstance, child, beforeChild) {
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
  if (child.id !== -1) {
    queueOp(OP_SET_ROOT, child.id);
  }
}

// ── Tree removal ──────────────────────────────────────────────────────────────

function removeChild(_parentInstance, child) {
  if (child.id !== -1) {
    queueOp(OP_REMOVE, child.id);
  }
}

function removeChildFromContainer(_container, child) {
  if (child.id !== -1) {
    queueOp(OP_REMOVE, child.id);
  }
}

function clearContainer(_container) {
  // No-op — scene resets when the new root is set via appendChildToContainer.
}

// Called by React after it has finished with a deleted instance.
function detachDeletedInstance(instance) {
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

function commitUpdate(instance, updatePayload) {
  const { children, style, ref: _ref, _glyxOnMount, glyxDraggable, transition, ...rest } = updatePayload;
  const nodeProps = { ...rest, ...style };
  if (glyxDraggable) nodeProps.draggable = true;
  if (transition && typeof transition.duration === 'number') nodeProps.transitionMs = transition.duration;
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
function resetAfterCommit()  { flushSceneOps(); }

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
export { prepareUpdate };
