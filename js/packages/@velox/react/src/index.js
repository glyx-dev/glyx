// @velox/react — React renderer for the Velox runtime.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Reconciler from 'react-reconciler';
import HostConfig from './hostConfig.js';
import {
  registerPressable, unregisterPressable,
  registerInput, unregisterInput,
  registerScrollView, unregisterScrollView,
  dispatchEvents,
} from './events.js';

// ── Reconciler ────────────────────────────────────────────────────────────────

const VeloxReconciler = Reconciler(HostConfig);

const rootContainer = VeloxReconciler.createContainer(
  { isVeloxRoot: true },
  0,      // LegacyRoot — synchronous rendering
  null, false, null, '',
  (err) => __velox_log('[React] Recoverable error: ' + err.message),
  null
);

// ── Frame callback ────────────────────────────────────────────────────────────
//
// Rust calls __velox_frameCallback() once per RedrawRequested (frame_tick),
// between tick() and drain_scene_commands().

globalThis.__velox_frameCallback = function veloxFrameCallback() {
  // flushSync forces React to commit all state updates triggered by events
  // synchronously, so scene commands are in the queue before Rust drains them.
  VeloxReconciler.flushSync(() => {
    dispatchEvents();
  });
};

// ── Public render API ─────────────────────────────────────────────────────────

export function render(element) {
  VeloxReconciler.updateContainer(element, rootContainer, null, null);
}

// ── Host components ───────────────────────────────────────────────────────────

export const View = ({ children, style, ...props }) =>
  React.createElement('view', { style, ...props }, children);

export const Text = ({ children, style, showCursor, ...props }) =>
  React.createElement('text', { text: children, style, showCursor, ...props });

// ── Pressable ─────────────────────────────────────────────────────────────────
//
// Registration strategy: register SYNCHRONOUSLY inside _veloxOnMount, which
// fires from createInstance during React's commit phase — guaranteed before
// any frame_tick dispatches events.
//
// A handlersRef proxy is stored in the registry so the registered callbacks
// always delegate to the latest closure values without needing re-registration
// on every render.

export function Pressable({ children, onPress, onPressIn, onPressOut, onHoverIn, onHoverOut, style, ...props }) {
  const nodeIdRef    = useRef(null);
  const handlersRef  = useRef(null);
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Always keep handlersRef up to date with the latest prop values.
  handlersRef.current = {
    onPress:    () => onPress?.(),
    onPressIn:  () => { setPressed(true);  onPressIn?.(); },
    onPressOut: () => { setPressed(false); onPressOut?.(); },
    onHoverIn:  () => { setHovered(true);  onHoverIn?.(); },
    onHoverOut: () => { setHovered(false); onHoverOut?.(); },
  };

  // Called synchronously by createInstance the moment the native node exists.
  const onMount = useCallback((id) => {
    nodeIdRef.current = id;
    // Register stable proxy functions that delegate to handlersRef.
    registerPressable(id, {
      onPress:    () => handlersRef.current.onPress(),
      onPressIn:  () => handlersRef.current.onPressIn(),
      onPressOut: () => handlersRef.current.onPressOut(),
      onHoverIn:  () => handlersRef.current.onHoverIn(),
      onHoverOut: () => handlersRef.current.onHoverOut(),
    });
  }, []); // empty deps — fires exactly once per mount

  // Unregister on unmount. useEffect for cleanup only — no timing dependency.
  useEffect(() => {
    return () => {
      if (nodeIdRef.current !== null) {
        unregisterPressable(nodeIdRef.current);
      }
    };
  }, []);

  // Visual feedback:
  //   pressed → brighter border (confirms the click)
  //   hovered → subtle border (indicates interactivity)
  //   default → no border override
  const mergedStyle = pressed
    ? { ...style, borderWidth: 2, borderColor: '#ffffffaa' }
    : hovered
    ? { ...style, borderWidth: 1, borderColor: '#ffffff55' }
    : style;

  return React.createElement(
    'view',
    { _veloxOnMount: onMount, style: mergedStyle, ...props },
    children
  );
}

// ── ScrollView ────────────────────────────────────────────────────────────────
//
// A vertically-scrollable container backed by a Vello clip layer.
//
// The native view receives two extra props that the Rust renderer handles:
//   clip: true          — push a Vello clip layer around children
//   scrollOffsetY: n    — shift children upward by n pixels
//
// Scroll deltas arrive via the `scroll` input event, routed by events.js to
// whichever ScrollView the cursor is currently over.  The component converts
// deltas into a React state integer and re-renders, which triggers a
// visual-only UpdateNode (no Taffy rebuild — incremental layout).

export function ScrollView({
  children,
  style,
  width        = 300,
  height       = 200,
  contentHeight,        // explicit content height override (more reliable than auto-detect)
  ...props
}) {
  const nodeIdRef    = useRef(null);
  const maxScrollRef = useRef(0);
  const [scrollY, setScrollY] = useState(0);

  // ── Compute max scroll ──────────────────────────────────────────────────────
  // Prefer the explicit `contentHeight` prop when provided (most reliable).
  // Otherwise estimate by summing child `height` props from the React element
  // tree — works for uniform-height lists where heights are explicit props.
  const childArray = React.Children.toArray(children);
  const gap        = (style && style.gap)     || 0;
  const padding    = (style && style.padding) || 0;
  const autoContentH = childArray.reduce((sum, c) => sum + (c.props?.height || 0), 0)
                     + Math.max(0, childArray.length - 1) * gap
                     + 2 * padding;
  const resolvedContentH = contentHeight ?? autoContentH;

  // Always keep maxScrollRef current so the stable `onScroll` callback reads
  // the latest cap without needing to be re-registered on each render.
  maxScrollRef.current = Math.max(0, resolvedContentH - height);

  // ── Stable scroll handler ───────────────────────────────────────────────────
  // Empty dep array → created once, re-registered never.
  // Reads maxScrollRef.current (not a captured value) so the cap is always fresh.
  const onScroll = useCallback((deltaY) => {
    setScrollY((prev) => {
      const max = maxScrollRef.current;
      return Math.min(max, Math.max(0, prev + deltaY));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onMount = useCallback((id) => {
    nodeIdRef.current = id;
    registerScrollView(id, { onScroll });
  }, [onScroll]);

  useEffect(() => {
    return () => {
      if (nodeIdRef.current !== null) {
        unregisterScrollView(nodeIdRef.current);
      }
    };
  }, []);

  const viewStyle = {
    // Items stack from top: prevents Taffy centering overflowing content
    // above the viewport origin, which would make early items invisible.
    justifyContent: 'flex-start',
    alignItems:     'flex-start',
    // Rust: push Vello clip layer + shift children by scrollOffsetY.
    clip:           true,
    scrollOffsetY:  scrollY,
    ...style,
  };

  return React.createElement(
    'view',
    { _veloxOnMount: onMount, style: viewStyle, width, height, ...props },
    children,
  );
}

// ── TextInput ─────────────────────────────────────────────────────────────────

export function TextInput({
  value = '',
  onChangeText,
  placeholder = '',
  fontSize = 16,
  width  = 240,
  height = 44,
  style,
  ...props
}) {
  const nodeIdRef   = useRef(null);
  const handlersRef = useRef(null);
  const [focused, setFocused] = useState(false);

  // Keep handlersRef current (captures latest value / onChangeText).
  handlersRef.current = {
    onFocus: () => setFocused(true),
    onBlur:  () => setFocused(false),
    onKeyPress: ({ key, text }) => {
      if (key === 'Backspace') {
        onChangeText?.(value.slice(0, -1));
      } else if (text) {
        onChangeText?.(value + text);
      }
    },
  };

  const onMount = useCallback((id) => {
    nodeIdRef.current = id;
    registerInput(id, {
      onFocus:    () => handlersRef.current.onFocus(),
      onBlur:     () => handlersRef.current.onBlur(),
      onKeyPress: (ev) => handlersRef.current.onKeyPress(ev),
    });
  }, []);

  useEffect(() => {
    return () => {
      if (nodeIdRef.current !== null) {
        unregisterInput(nodeIdRef.current);
      }
    };
  }, []);

  // When focused, always show the actual value so the cursor lands after
  // typed characters (position 0 when value is empty). Show placeholder
  // only when unfocused and nothing has been typed yet.
  const displayText = (focused || value) ? value : placeholder;
  const textColor   = value ? '#ffffff' : '#888888';

  const inputStyle = {
    backgroundColor: focused ? '#4a4a7e' : '#2a2a3e',
    borderRadius: 6,
    borderWidth: focused ? 2 : 1,
    borderColor: focused ? '#8080ff' : '#44446a',
    ...style,
  };

  return React.createElement(
    'view',
    { _veloxOnMount: onMount, style: inputStyle, width, height, ...props },
    React.createElement('text', {
      text:       displayText,
      fontSize,
      width:      width - 16,
      height:     height - 16,
      style:      { color: textColor },
      showCursor: focused,
      textAlign:  'left',
    })
  );
}
