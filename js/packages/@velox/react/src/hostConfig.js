// @velox/react — react-reconciler HostConfig
//
// This is the bridge between React's reconciler and Velox's native scene graph.
// Every method here maps React's internal tree operations to native bindings
// exposed by the Rust runtime: __velox_createNode, __velox_appendChild,
// __velox_updateNode, __velox_removeNode, __velox_setRoot.
//
// Only `supportsMutation: true` is enabled — no persistence, no hydration.

import { DefaultEventPriority } from 'react-reconciler/constants';

// ── Instance creation ─────────────────────────────────────────────────────────

function createInstance(type, props) {
  // Strip `children` — React manages the tree; we only pass style/data props.
  const { children, ...nodeProps } = props;
  const id = __velox_createNode(type, nodeProps);
  return { id };
}

// Raw text nodes (e.g. "hello" directly inside a host element) are not
// supported. Use <Text>hello</Text> instead. Return a stub so React never
// crashes if it somehow calls this.
function createTextInstance(text) {
  __velox_log('[Velox] Warning: raw text node "' + text + '" — wrap in <Text>');
  return { id: -1 };
}

// ── Tree construction (initial mount) ─────────────────────────────────────────

// Called for each child during the initial tree build (before commit).
function appendInitialChild(parentInstance, child) {
  if (child.id !== -1) {
    __velox_appendChild(parentInstance.id, child.id);
  }
}

// ── Tree construction (updates / re-renders) ──────────────────────────────────

function appendChild(parentInstance, child) {
  if (child.id !== -1) {
    __velox_appendChild(parentInstance.id, child.id);
  }
}

function appendChildToContainer(_container, child) {
  // The container is the virtual root (created by createContainer).
  // Explicitly set this child as the scene root so Rust knows what to render.
  if (child.id !== -1) {
    __velox_setRoot(child.id);
  }
}

function insertBefore(parentInstance, child, _beforeChild) {
  // Full ordering support is a Week 12+ concern.
  // For now, treat as a regular append.
  if (child.id !== -1) {
    __velox_appendChild(parentInstance.id, child.id);
  }
}

function insertInContainerBefore(_container, child, _beforeChild) {
  if (child.id !== -1) {
    __velox_setRoot(child.id);
  }
}

// ── Tree removal ──────────────────────────────────────────────────────────────

function removeChild(_parentInstance, child) {
  if (child.id !== -1) {
    __velox_removeNode(child.id);
  }
}

function removeChildFromContainer(_container, child) {
  if (child.id !== -1) {
    __velox_removeNode(child.id);
  }
}

function clearContainer(_container) {
  // No-op — scene resets when the new root is set via appendChildToContainer.
}

// Called by React after it has finished with a deleted instance.
function detachDeletedInstance(instance) {
  if (instance.id !== -1) {
    __velox_removeNode(instance.id);
  }
}

// ── Updates ───────────────────────────────────────────────────────────────────

// Return a payload to commit, or null to skip commitUpdate.
function prepareUpdate(_instance, _type, _oldProps, newProps) {
  return newProps;
}

function commitUpdate(instance, updatePayload) {
  const { children, ...nodeProps } = updatePayload;
  __velox_updateNode(instance.id, nodeProps);
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
function resetAfterCommit()  {}

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

  // Event system
  getCurrentEventPriority,
  getInstanceFromNode,
  beforeActiveInstanceBlur,
  afterActiveInstanceBlur,
  prepareScopeUpdate,
  getInstanceFromScope,
};

export default HostConfig;
