// @velox/react — React renderer for the Velox runtime.
//
// Usage:
//   import { View, Text, render } from '@velox/react';
//   render(<View width={360} height={180}><Text fontSize={20}>Hello</Text></View>);

import React from 'react';
import Reconciler from 'react-reconciler';
import HostConfig from './hostConfig.js';

// ── Reconciler ────────────────────────────────────────────────────────────────

const VeloxReconciler = Reconciler(HostConfig);

// LegacyRoot (0) = synchronous rendering.
// No concurrent features — React flushes the entire tree in one pass.
// This is the right mode for Week 11: no scheduler, no deferred work.
const rootContainer = VeloxReconciler.createContainer(
  { isVeloxRoot: true }, // containerInfo — passed to container HostConfig methods
  0,      // LegacyRoot
  null,   // hydrationCallbacks
  false,  // isStrictMode
  null,   // concurrentUpdatesByDefaultOverride
  '',     // identifierPrefix
  (err) => __velox_log('[React] Recoverable error: ' + err.message),
  null    // transitionCallbacks
);

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Mount a React element tree into the Velox scene graph.
 * Call once at startup. State updates re-render automatically.
 *
 * @param {React.ReactElement} element
 */
export function render(element) {
  VeloxReconciler.updateContainer(element, rootContainer, null, null);
}

// ── Host components ───────────────────────────────────────────────────────────
//
// View and Text are thin React components that map to native 'view' and 'text'
// scene graph nodes. The reconciler calls createInstance with the lowercase
// type string (e.g. 'view'), which is passed directly to __velox_createNode.

/**
 * A rectangular flex container. Maps to the 'view' scene graph node type.
 *
 * Props: width, height (and future: backgroundColor, borderRadius, padding, …)
 */
export const View = ({ children, ...props }) =>
  React.createElement('view', props, children);

/**
 * A text label. `children` becomes the `text` prop on the native node.
 * Maps to the 'text' scene graph node type.
 *
 * Props: fontSize, width, height (and future: color, fontWeight, …)
 */
export const Text = ({ children, ...props }) =>
  React.createElement('text', { text: children, ...props });
