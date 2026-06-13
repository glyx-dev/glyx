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

// Map from nodeId -> true/false — prevents event dispatch to the node.
// Children of a disabled node are also blocked (ancestor check during dispatch).
const disabledRegistry = new Map();

// Set of nodeIds with pointerEvents: 'none' — these nodes are invisible to
// hit-testing; events pass through them to nodes underneath.
const pointerEventsNoneRegistry = new Set();

// Map from nodeId -> zIndex (integer).  Only nodes with an explicit zIndex
// prop are stored here; absent = 0.  Used by findTopmostSolid to prefer
// higher-z-index nodes over later-registered ones when both cover a point.
const zIndexMap = new Map();

// Ordered array of all solid (click-opaque) node ids, in creation order.
// Later entries were rendered later (on top in z-order).
// Every 'view' native node is solid by default.  Nodes with pointerEvents:'none'
// are still in this list but are excluded at lookup time via pointerEventsNoneRegistry.
const solidRegistry = [];

// Map from childId → parentId, populated by hostConfig on every tree mutation.
// Used by findTopmostSolid to determine ancestor relationships.
const parentMap = new Map();

// Currently dragged node id (or null). Set on dragStart, cleared on dragEnd.
let activeDragId = null;

// Listeners notified on window resize: Array<(size: {width, height}) => void>
const windowSizeListeners = [];

// Listeners notified on every key event: Array<(ev: {key, ctrl, shift, pressed}) => void>
const keyListeners = [];

// Listeners called on every mouse-button press, regardless of which node was hit.
// Used by dropdowns / overlays to close on outside click.
// Array<(ev: {x, y, pressed}) => void>
const globalClickListeners = [];

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
 * @param {{ onScroll: (deltaY: number) => void, onAbsoluteScroll?: (y: number) => void }} handlers
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
 * Register or update the disabled state of a node.
 * When `disabled` is true, the node (and any descendant) will not receive
 * press, input, drag, hover, or scroll events.
 * @param {number} nodeId
 * @param {boolean} disabled
 */
export function registerDisabledNode(nodeId, disabled) {
  if (disabled) {
    disabledRegistry.set(nodeId, true);
  } else {
    disabledRegistry.delete(nodeId);
  }
}

/**
 * Unregister a disabled node (called when the component unmounts).
 * @param {number} nodeId
 */
export function unregisterDisabledNode(nodeId) {
  disabledRegistry.delete(nodeId);
}

/**
 * Mark a node as having `pointerEvents: 'none'`, making it invisible to
 * hit-testing. Events pass through to nodes layered underneath.
 * @param {number} nodeId
 */
export function registerPointerEventsNone(nodeId) {
  pointerEventsNoneRegistry.add(nodeId);
}

/**
 * Register a view node as solid (click-opaque).
 * Called from hostConfig.createInstance for every 'view' native node.
 * @param {number} nodeId
 */
export function registerSolid(nodeId) {
  solidRegistry.push(nodeId);
}

/**
 * Unregister a solid node on unmount.
 * @param {number} nodeId
 */
export function unregisterSolid(nodeId) {
  const i = solidRegistry.indexOf(nodeId);
  if (i !== -1) solidRegistry.splice(i, 1);
}

/**
 * Record that `childId` is a direct child of `parentId` in the native tree.
 * Called by hostConfig whenever a child is attached to a parent.
 * @param {number} childId
 * @param {number} parentId
 */
export function setNodeParent(childId, parentId) {
  parentMap.set(childId, parentId);
}

/**
 * Remove a node from parentMap and solidRegistry on tree detach.
 * Replaces separate unregisterSolid + parentMap.delete calls in hostConfig.
 * @param {number} nodeId
 */
export function removeNodeFromTree(nodeId) {
  parentMap.delete(nodeId);
  unregisterSolid(nodeId);
  zIndexMap.delete(nodeId);
}

/**
 * Record the z-index for a node so hit-testing can prefer visually-higher
 * nodes over ones with a later solidRegistry index.
 * @param {number} nodeId
 * @param {number} zIndex
 */
export function setNodeZIndex(nodeId, zIndex) {
  if (zIndex !== 0) {
    zIndexMap.set(nodeId, zIndex);
  } else {
    zIndexMap.delete(nodeId);
  }
}

/**
 * Unregister a pointerEvents: 'none' marker.
 * @param {number} nodeId
 */
export function unregisterPointerEventsNone(nodeId) {
  pointerEventsNoneRegistry.delete(nodeId);
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
 * Subscribe to every mouse-button press event (regardless of which node was hit).
 * Useful for dropdowns/overlays that need to close on outside click.
 * @param {(ev: {x: number, y: number}) => void} fn
 */
export function addGlobalClickListener(fn) {
  globalClickListeners.push(fn);
}

/**
 * Unsubscribe from global click events.
 * @param {(ev: {x: number, y: number}) => void} fn
 */
export function removeGlobalClickListener(fn) {
  const idx = globalClickListeners.indexOf(fn);
  if (idx >= 0) globalClickListeners.splice(idx, 1);
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
  if (pointerEventsNoneRegistry.has(nodeId)) return false;
  const layout = __velox_getLayout(nodeId);
  if (!layout) return false;
  return (
    px >= layout.x && px < layout.x + layout.width &&
    py >= layout.y && py < layout.y + layout.height
  );
}

/** True when the node is in the disabled registry. */
function isDisabled(nodeId) {
  return disabledRegistry.has(nodeId);
}

/** Returns true when `ancestorId` is a direct or indirect parent of `descendantId`. */
function isAncestorOf(ancestorId, descendantId) {
  let id = parentMap.get(descendantId);
  while (id !== undefined) {
    if (id === ancestorId) return true;
    id = parentMap.get(id);
  }
  return false;
}

/**
 * Return the topmost solid (click-opaque) node covering (x, y), or null.
 *
 * React creates host instances in post-order (children before parents), so
 * solidRegistry is ordered: children have LOWER indices, parents HIGHER.
 *
 * Algorithm:
 *   1. Collect every solid node whose layout rect covers (x, y).
 *   2. Filter to "deepest" — remove any node that is an ancestor of another
 *      covering node (an ancestor is painted beneath its descendants).
 *   3. Among the remaining siblings/cousins, return the one with the highest
 *      solidRegistry index (later-registered sibling = painted on top).
 */
function findTopmostSolid(x, y) {
  const covering = [];
  for (const id of solidRegistry) {
    if (hitTest(id, x, y)) covering.push(id);
  }
  if (covering.length === 0) return null;
  if (covering.length === 1) return covering[0];
  // Keep only deepest nodes (remove ancestors of other covering nodes).
  const deepest = covering.filter(
    id => !covering.some(other => other !== id && isAncestorOf(id, other))
  );
  if (deepest.length === 1) return deepest[0];
  // Among siblings, pick the visually topmost node.
  // z-index takes priority over registration order: a node with a higher
  // z-index beats one registered later (which is the common case when an
  // absolutely-positioned overlay is declared before the content it covers
  // in JSX but must receive clicks over it).
  let bestId = deepest[0];
  let bestIdx = solidRegistry.lastIndexOf(deepest[0]);
  let bestZ   = zIndexMap.get(deepest[0]) ?? 0;
  for (let i = 1; i < deepest.length; i++) {
    const z   = zIndexMap.get(deepest[i]) ?? 0;
    const idx = solidRegistry.lastIndexOf(deepest[i]);
    if (z > bestZ || (z === bestZ && idx > bestIdx)) {
      bestId  = deepest[i];
      bestIdx = idx;
      bestZ   = z;
    }
  }
  return bestId;
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

        // Notify global click listeners first (e.g. to close open dropdowns).
        if (globalClickListeners.length > 0) {
          const gev = { x: ev.x, y: ev.y };
          for (const fn of globalClickListeners) try { fn(gev); } catch {}
        }

        // Find the topmost solid (click-opaque) node at this position.
        // A plain View absorbs the click even without a handler, preventing
        // fallthrough to pressables/inputs rendered beneath it in z-order.
        const topmostId = findTopmostSolid(ev.x, ev.y);

        if (topmostId !== null) {
          // Route to Pressable handler if the topmost node is pressable.
          const ph = pressableRegistry.get(topmostId);
          if (ph && !isDisabled(topmostId)) {
            const layout = __velox_getLayout(topmostId);
            ph.onPress?.({
              x: ev.x, y: ev.y,
              locationX: layout ? ev.x - layout.x : 0,
              locationY: layout ? ev.y - layout.y : 0,
            });
          }

          // Route to TextInput handler if the topmost node is an input.
          const ih = inputRegistry.get(topmostId);
          if (ih && !isDisabled(topmostId)) {
            setFocus(topmostId);
            const layout = __velox_getLayout(topmostId);
            if (layout) ih.onClickAt?.(ev.x - layout.x, ev.y - layout.y);
          }
        }

        // Blur focused input if the click landed elsewhere.
        if (focusedNodeId !== null && focusedNodeId !== topmostId) {
          inputRegistry.get(focusedNodeId)?.onBlur?.();
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
        // Route the scroll delta to the topmost ScrollView the cursor is over
        // (iterate reverse-registration-order so later-rendered = topmost).
        for (const [nodeId, handlers] of [...scrollRegistry].reverse()) {
          if (hitTest(nodeId, cursorX, cursorY)) {
            if (isDisabled(nodeId)) break;
            handlers.onScroll?.(ev.deltaY);
            break;
          }
        }
        break;
      }

      case 'scrollbarDrag': {
        // Absolute scroll position set by scrollbar thumb drag — routed by
        // node ID directly (no hit-test needed; the thumb is inside the clip).
        const handlers = scrollRegistry.get(ev.nodeId);
        handlers?.onAbsoluteScroll?.(ev.scrollY);
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
            if (isDisabled(nodeId)) break;
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
  // Uses findTopmostSolid so that views beneath a covering solid node never
  // receive hover effects, and plain Views (not in pressableRegistry) are
  // treated as hover-opaque (no effect fires on them).
  if (cursorMovedThisFrame) {
    const topSolid = findTopmostSolid(cursorX, cursorY);
    const newHoveredId = (topSolid !== null && !isDisabled(topSolid) && pressableRegistry.has(topSolid))
      ? topSolid : null;

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
