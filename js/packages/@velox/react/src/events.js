// @velox/react — event dispatcher
//
// This module bridges Velox's native input events to React component handlers.
// It is driven by `__velox_frameCallback`, registered on `globalThis` in
// index.js and called by the Rust runtime once per frame (frame_tick).
//
// ## Architecture
//
//   Rust side:               JS side:
//   push_event(ev)  →  __velox_pollEvents()  →  dispatchEvents()
//                                                  → hit-test via __velox_getLayout
//                                                  → call registered handlers
//                                                  → React state updates
//                                                  → reconciler re-renders
//
// ## Hit-testing
//
// A point (px, py) is inside a node when:
//   x <= px < x+width  AND  y <= py < y+height

// ── Registry ──────────────────────────────────────────────────────────────────

// Map from nodeId -> { onPress, onRelease, onPressIn, onPressOut }
const pressableRegistry = new Map();

// Map from nodeId -> { onFocus, onKeyPress, onChangeText }
const inputRegistry = new Map();

// Currently focused input node id (or null).
let focusedNodeId = null;

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register a Pressable node so the event dispatcher can fire its callbacks.
 * @param {number} nodeId
 * @param {{ onPress?: () => void, onPressIn?: () => void, onPressOut?: () => void }} handlers
 */
export function registerPressable(nodeId, handlers) {
  pressableRegistry.set(nodeId, handlers);
}

/**
 * Unregister a Pressable node (called when the component unmounts).
 * @param {number} nodeId
 */
export function unregisterPressable(nodeId) {
  pressableRegistry.delete(nodeId);
}

/**
 * Register a TextInput node.
 * @param {number} nodeId
 * @param {{ onFocus?: () => void, onBlur?: () => void, onChangeText?: (text: string) => void }} handlers
 */
export function registerInput(nodeId, handlers) {
  inputRegistry.set(nodeId, handlers);
}

/**
 * Unregister a TextInput node.
 * @param {number} nodeId
 */
export function unregisterInput(nodeId) {
  if (focusedNodeId === nodeId) focusedNodeId = null;
  inputRegistry.delete(nodeId);
}

/**
 * Explicitly focus a TextInput node from JS (e.g. programmatic focus).
 * @param {number} nodeId
 */
export function setFocus(nodeId) {
  if (focusedNodeId !== nodeId) {
    if (focusedNodeId !== null) {
      const prev = inputRegistry.get(focusedNodeId);
      prev?.onBlur?.();
    }
    focusedNodeId = nodeId;
    const handlers = inputRegistry.get(nodeId);
    handlers?.onFocus?.();
  }
}

// ── Hit-test helpers ──────────────────────────────────────────────────────────

function hitTest(nodeId, px, py) {
  const layout = __velox_getLayout(nodeId);
  if (!layout) return false;
  return (
    px >= layout.x && px < layout.x + layout.width &&
    py >= layout.y && py < layout.y + layout.height
  );
}

// ── Main dispatch ─────────────────────────────────────────────────────────────

/**
 * Process all queued native events.
 * Called once per frame from `__velox_frameCallback`.
 */
export function dispatchEvents() {
  const events = __velox_pollEvents();
  if (!events || events.length === 0) return;

  for (const ev of events) {
    switch (ev.type) {

      case 'mouseButton': {
        if (!ev.pressed) break; // react only to press-down for now

        // Check pressables (front-to-back, stop at first hit).
        let handled = false;
        for (const [nodeId, handlers] of pressableRegistry) {
          if (hitTest(nodeId, ev.x, ev.y)) {
            handlers.onPress?.();
            handled = true;
            break;
          }
        }

        // Check inputs (clicking into a TextInput focuses it).
        for (const [nodeId] of inputRegistry) {
          if (hitTest(nodeId, ev.x, ev.y)) {
            setFocus(nodeId);
            handled = true;
            break;
          }
        }

        // Click outside any input → blur.
        if (!handled && focusedNodeId !== null) {
          const prev = inputRegistry.get(focusedNodeId);
          prev?.onBlur?.();
          focusedNodeId = null;
        }
        break;
      }

      case 'keyInput': {
        if (!ev.pressed || focusedNodeId === null) break;

        const handlers = inputRegistry.get(focusedNodeId);
        if (!handlers) break;

        handlers.onKeyPress?.({ key: ev.key, text: ev.text });
        break;
      }

      // cursorMoved and scroll are available for future hover/scroll support.
      default:
        break;
    }
  }
}
