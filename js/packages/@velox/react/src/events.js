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

// Map from nodeId -> { onPress, onPressIn, onPressOut, onHoverIn, onHoverOut }
const pressableRegistry = new Map();

// Map from nodeId -> { onFocus, onKeyPress, onChangeText }
const inputRegistry = new Map();

// Map from nodeId -> { onScroll }
// ScrollViews register here so scroll events can be routed to whichever
// scroll view the cursor is currently over.
const scrollRegistry = new Map();

// Map from nodeId -> { onDragStart?, onDragMove?, onDragEnd? }
// Draggable nodes (e.g. Slider thumb) register here.
const dragRegistry = new Map();

// Currently dragged node id (or null). Set on dragStart, cleared on dragEnd.
let activeDragId = null;

// Listeners notified on window resize: Array<(size: {width, height}) => void>
const windowSizeListeners = [];

// Listeners notified on every key event: Array<(ev: {key, ctrl, shift, pressed}) => void>
const keyListeners = [];

// Currently focused input node id (or null).
let focusedNodeId = null;

// Currently hovered pressable node id (or null).
// Updated once per frame from the last cursorMoved event's position.
let hoveredPressableId = null;

// Modifier key state — updated on every keyInput (pressed AND released).
let ctrlHeld  = false;
let shiftHeld = false;

// Last cursor position seen this frame (updated by cursorMoved events).
let cursorX = 0;
let cursorY = 0;

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
 * Register a ScrollView node so scroll events are routed to it.
 * @param {number} nodeId
 * @param {{ onScroll: (deltaY: number) => void }} handlers
 */
export function registerScrollView(nodeId, handlers) {
  scrollRegistry.set(nodeId, handlers);
}

/**
 * Unregister a ScrollView node (called when the component unmounts).
 * @param {number} nodeId
 */
export function unregisterScrollView(nodeId) {
  scrollRegistry.delete(nodeId);
}

/**
 * Register a draggable node (e.g. a Slider thumb).
 * @param {number} nodeId
 * @param {{ onDragStart?: (e:{x,y})=>void, onDragMove?: (e:{x,y,dx,dy})=>void, onDragEnd?: (e:{x,y})=>void }} handlers
 */
export function registerDraggable(nodeId, handlers) {
  dragRegistry.set(nodeId, handlers);
}

/**
 * Unregister a draggable node (called when the component unmounts).
 * @param {number} nodeId
 */
export function unregisterDraggable(nodeId) {
  if (activeDragId === nodeId) activeDragId = null;
  dragRegistry.delete(nodeId);
}

/**
 * Subscribe to window resize events.
 * @param {(size: {width: number, height: number}) => void} fn
 */
export function addWindowSizeListener(fn) {
  windowSizeListeners.push(fn);
}

/**
 * Unsubscribe from window resize events.
 * @param {(size: {width: number, height: number}) => void} fn
 */
export function removeWindowSizeListener(fn) {
  const idx = windowSizeListeners.indexOf(fn);
  if (idx >= 0) windowSizeListeners.splice(idx, 1);
}

/**
 * Subscribe to raw key events (press and release).
 * @param {(ev: {key: string, ctrl: boolean, shift: boolean, pressed: boolean}) => void} fn
 */
export function addKeyListener(fn) {
  keyListeners.push(fn);
}

/**
 * Unsubscribe from raw key events.
 * @param {(ev: {key: string, ctrl: boolean, shift: boolean, pressed: boolean}) => void} fn
 */
export function removeKeyListener(fn) {
  const idx = keyListeners.indexOf(fn);
  if (idx >= 0) keyListeners.splice(idx, 1);
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

  let cursorMovedThisFrame = false;

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

        // Check inputs (clicking into a TextInput focuses it and positions cursor).
        for (const [nodeId, handlers] of inputRegistry) {
          if (hitTest(nodeId, ev.x, ev.y)) {
            setFocus(nodeId);
            // Fire click-to-cursor: pass click position relative to the node.
            if (handlers.onClickAt) {
              const layout = __velox_getLayout(nodeId);
              if (layout) handlers.onClickAt(ev.x - layout.x, ev.y - layout.y);
            }
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
        // Always track modifier state (on both press and release).
        if (ev.key === 'ControlLeft' || ev.key === 'ControlRight') {
          ctrlHeld = ev.pressed;
          break;
        }
        if (ev.key === 'ShiftLeft' || ev.key === 'ShiftRight') {
          shiftHeld = ev.pressed;
          break;
        }

        // Notify global key listeners (used for app-focused shortcuts).
        if (keyListeners.length > 0) {
          const kev = { key: ev.key, ctrl: ctrlHeld, shift: shiftHeld, pressed: ev.pressed };
          for (const fn of keyListeners) try { fn(kev); } catch {}
        }

        if (!ev.pressed || focusedNodeId === null) break;

        const handlers = inputRegistry.get(focusedNodeId);
        if (!handlers) break;

        handlers.onKeyPress?.({ key: ev.key, text: ev.text, ctrl: ctrlHeld, shift: shiftHeld });
        break;
      }

      case 'cursorMoved': {
        // Track final position — hover is resolved once after the loop
        // so multiple cursor events per frame produce only one hit-test.
        cursorX = ev.x;
        cursorY = ev.y;
        cursorMovedThisFrame = true;
        break;
      }

      case 'scroll': {
        // Route the scroll delta to whichever ScrollView the cursor is over
        // (front-to-back, stop at first hit).
        for (const [nodeId, handlers] of scrollRegistry) {
          if (hitTest(nodeId, cursorX, cursorY)) {
            handlers.onScroll?.(ev.deltaY);
            break;
          }
        }
        break;
      }

      case 'resize': {
        const size = { width: ev.width, height: ev.height };
        for (const fn of windowSizeListeners) fn(size);
        break;
      }

      case 'dragStart': {
        for (const [nodeId, handlers] of dragRegistry) {
          if (hitTest(nodeId, ev.x, ev.y)) {
            activeDragId = nodeId;
            handlers.onDragStart?.({ x: ev.x, y: ev.y });
            break;
          }
        }
        break;
      }

      case 'dragMove': {
        if (activeDragId !== null) {
          const handlers = dragRegistry.get(activeDragId);
          handlers?.onDragMove?.({ x: ev.x, y: ev.y, dx: ev.dx, dy: ev.dy });
        }
        break;
      }

      case 'dragEnd': {
        if (activeDragId !== null) {
          const handlers = dragRegistry.get(activeDragId);
          handlers?.onDragEnd?.({ x: ev.x, y: ev.y });
          activeDragId = null;
        }
        break;
      }

      default:
        break;
    }
  }

  // ── Hover state update ────────────────────────────────────────────────────
  // Run once per frame using the final cursor position.
  // Only fires onHoverIn/Out callbacks on actual enter/leave transitions.
  if (cursorMovedThisFrame) {
    let newHoveredId = null;
    for (const [nodeId] of pressableRegistry) {
      if (hitTest(nodeId, cursorX, cursorY)) {
        newHoveredId = nodeId;
        break;
      }
    }

    if (newHoveredId !== hoveredPressableId) {
      if (hoveredPressableId !== null) {
        pressableRegistry.get(hoveredPressableId)?.onHoverOut?.();
      }
      if (newHoveredId !== null) {
        pressableRegistry.get(newHoveredId)?.onHoverIn?.();
      }
      hoveredPressableId = newHoveredId;
    }
  }
}
