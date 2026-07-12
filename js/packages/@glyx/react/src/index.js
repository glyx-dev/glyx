// @glyx-dev/react — React renderer for the Glyx runtime.
// Polyfills must be installed before react/react-reconciler initialise.
import './polyfills.js';

import React from 'react';
import Reconciler from 'react-reconciler';
import HostConfig from './hostConfig.js';
import { dispatchEvents, addGlobalClickListener, removeGlobalClickListener, addKeyListener } from './events.js';
import {
  _pollWebSockets, _pollIpc, _pollDeeplinks, _pollGamepads,
  _pollGlobalShortcuts, _pollPerfViolations, _pollLeakWarnings,
  _pollAudio, _pollVideo, _pollFsWatch,
} from './api.js';
import { View } from './core.js';
import { PopoverHost } from './popover.js';

// Re-export from sub-modules
export * from './api.js';
export * from './core.js';
export * from './popover.js';
export * from './controls.js';
export * from './canvas.js';
export * from './media.js';

// Event-registry helpers used by companion packages (@glyx-dev/context-menu, …).
export { addGlobalClickListener, removeGlobalClickListener, addKeyListener };

// ── Reconciler ────────────────────────────────────────────────────────────────

const GlyxReconciler = Reconciler(HostConfig);

const rootContainer = GlyxReconciler.createContainer(
  { isGlyxRoot: true },
  0,      // LegacyRoot — synchronous rendering
  null, false, null, '',
  (err) => __glyx_log('[React] Recoverable error: ' + err.message),
  null
);

// ── Frame callback ────────────────────────────────────────────────────────────
//
// Rust calls __glyx_frameCallback() once per RedrawRequested (frame_tick),
// between tick() and drain_scene_commands().

globalThis.__glyx_frameCallback = function glyxFrameCallback() {
  // flushSync forces React to commit all state updates triggered by events
  // synchronously, so scene commands are in the queue before Rust drains them.
  GlyxReconciler.flushSync(() => {
    // Drain deferred setTimeout callbacks (animation loops, React scheduler).
    globalThis._glyxDrainTimers?.();
    _pollWebSockets();
    _pollIpc();
    _pollDeeplinks();
    _pollGamepads();
    _pollGlobalShortcuts();
    _pollPerfViolations();
    _pollLeakWarnings();
    _pollAudio();
    _pollVideo();
    _pollFsWatch();
    dispatchEvents();
  });
};

// ── Public render API ─────────────────────────────────────────────────────────

export function render(element) {
  // The framework has a SINGLE scene root, so we mount one wrapper View (forced
  // to the window size by the layout engine) that holds the app plus an
  // auto-injected PopoverHost. The host's absolutely-positioned content is a
  // child of this root wrapper → positioned in window coords, never clipped by a
  // scroll ancestor. Apps get floating popups for free, no manual mounting.
  // The wrapper fills the framework's js-root (a window-sized flex column) and
  // reproduces the same column/stretch context the app's root used to see, so
  // the app's layout is unchanged. PopoverHost renders null (no layout impact)
  // until a popup opens, then absolutely (out of flow).
  GlyxReconciler.updateContainer(
    React.createElement(View, {
      style: { position: 'relative', flexDirection: 'column', flexGrow: 1, alignSelf: 'stretch' },
    },
      element,
      React.createElement(PopoverHost),
    ),
    rootContainer, null, null,
  );
}
