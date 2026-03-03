// @velox/react — React renderer for the Velox runtime.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import Reconciler from 'react-reconciler';
import HostConfig from './hostConfig.js';
import {
  registerPressable, unregisterPressable,
  registerInput, unregisterInput,
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

export function Pressable({ children, onPress, onPressIn, onPressOut, style, ...props }) {
  const nodeIdRef    = useRef(null);
  const handlersRef  = useRef(null);
  const [pressed, setPressed] = useState(false);

  // Always keep handlersRef up to date with the latest prop values.
  handlersRef.current = {
    onPress:    () => onPress?.(),
    onPressIn:  () => { setPressed(true);  onPressIn?.(); },
    onPressOut: () => { setPressed(false); onPressOut?.(); },
  };

  // Called synchronously by createInstance the moment the native node exists.
  const onMount = useCallback((id) => {
    nodeIdRef.current = id;
    // Register stable proxy functions that delegate to handlersRef.
    registerPressable(id, {
      onPress:    () => handlersRef.current.onPress(),
      onPressIn:  () => handlersRef.current.onPressIn(),
      onPressOut: () => handlersRef.current.onPressOut(),
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

  const mergedStyle = pressed
    ? { ...style, backgroundColor: style?.backgroundColor ?? '#555' }
    : style;

  return React.createElement(
    'view',
    { _veloxOnMount: onMount, style: mergedStyle, ...props },
    children
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
