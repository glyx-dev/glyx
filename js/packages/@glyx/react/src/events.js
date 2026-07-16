// @glyx-dev/react — event dispatcher
//
// This module bridges Glyx's native input events to React component handlers.
// It is driven by `__glyx_frameCallback`, registered on `globalThis` in
// index.js and called by the Rust runtime once per frame (frame_tick).
//
// ## Architecture
//
//   Rust side:               JS side:
//   push_event(ev)  →  __glyx_pollEvents()  →  dispatchEvents()
//                                                  → hit-test via __glyx_getLayout
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

// Map from nodeId -> { onIncrement?, onDecrement?, onSetValue? }
// Numeric controls (e.g. Slider) register here so a screen reader's
// Increment/Decrement/SetValue actions (Narrator arrow keys on a focused
// slider, etc.) can actually change the value — Rust has no concept of the
// control's own min/max/step, so it just forwards the action here.
const a11yValueRegistry = new Map();

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

// Map from imageId -> onError callback, fired when a native image load fails.
const imageErrorRegistry = new Map();

// Map from watch id -> callback for Rust-side system watchers (system.watch).
const systemWatchRegistry = new Map();

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
// Input node currently being drag-selected (left button held after pressing
// on a TextInput); cursorMoved extends its selection until release.
let inputDragNodeId = null;

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
 * Register a callback fired when the image with `imageId` fails to load.
 * @param {number} imageId - id returned by __glyx_createImage
 * @param {(ev: { path: string }) => void} onError
 */
export function registerImageError(imageId, onError) {
  imageErrorRegistry.set(imageId, onError);
}

/** Register/unregister a system.watch subscriber (see api.js). */
export function registerSystemWatch(id, cb) {
  systemWatchRegistry.set(id, cb);
}
export function unregisterSystemWatch(id) {
  systemWatchRegistry.delete(id);
}

export function unregisterImageError(imageId) {
  imageErrorRegistry.delete(imageId);
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
 * Register a node's screen-reader value actions (Increment/Decrement/SetValue).
 * @param {number} nodeId
 * @param {{ onIncrement?: () => void, onDecrement?: () => void, onSetValue?: (v:number) => void }} handlers
 */
export function registerA11yValue(nodeId, handlers) {
  a11yValueRegistry.set(nodeId, handlers);
}

/** Unregister a node's screen-reader value actions (on unmount). */
export function unregisterA11yValue(nodeId) {
  a11yValueRegistry.delete(nodeId);
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
  const layout = __glyx_getLayout(nodeId);
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

/**
 * Find the scroll view that should receive keyboard scroll keys.
 * Walks up from `fromNodeId` (if set) to find the nearest scroll ancestor,
 * then falls back to the topmost scroll view the cursor is over.
 * @param {number|null} fromNodeId
 * @returns {number|null}
 */
function findScrollTarget(fromNodeId) {
  if (fromNodeId !== null) {
    let id = parentMap.get(fromNodeId);
    while (id !== undefined) {
      if (scrollRegistry.has(id)) return id;
      id = parentMap.get(id);
    }
  }
  for (const [nodeId] of [...scrollRegistry].reverse()) {
    if (hitTest(nodeId, cursorX, cursorY)) return nodeId;
  }
  return null;
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
  // The effective z-index is inherited from the ancestor chain: a leaf inside
  // a zIndex:999 overlay layer must beat content re-rendered after the
  // overlay mounted (e.g. toast items over a screen that re-rendered later).
  const effectiveZ = (id) => {
    let z = zIndexMap.get(id) ?? 0;
    let p = parentMap.get(id);
    while (p !== undefined) {
      const pz = zIndexMap.get(p);
      if (pz !== undefined && pz > z) z = pz;
      p = parentMap.get(p);
    }
    return z;
  };
  let bestId = deepest[0];
  let bestIdx = solidRegistry.lastIndexOf(deepest[0]);
  let bestZ   = effectiveZ(deepest[0]);
  for (let i = 1; i < deepest.length; i++) {
    const z   = effectiveZ(deepest[i]);
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
 * Called once per frame from `__glyx_frameCallback`.
 */
export function dispatchEvents() {
  const events = __glyx_pollEvents();
  if (!events || events.length === 0) return;

  let cursorMovedThisFrame = false;

  for (const ev of events) {
    switch (ev.type) {

      case 'mouseButton': {
        if (!ev.pressed) {
          inputDragNodeId = null;   // end text drag-selection on release
          break;
        }

        const isRight = ev.button === 1; // 0 = left, 1 = right, 2 = middle

        // Notify global click listeners first (e.g. to close open dropdowns /
        // context menus). `button` lets listeners distinguish right-clicks.
        if (globalClickListeners.length > 0) {
          const gev = { x: ev.x, y: ev.y, button: ev.button };
          for (const fn of globalClickListeners) try { fn(gev); } catch {}
        }

        // Find the topmost solid (click-opaque) node at this position.
        // A plain View absorbs the click even without a handler, preventing
        // fallthrough to pressables/inputs rendered beneath it in z-order.
        const topmostId = findTopmostSolid(ev.x, ev.y);

        if (topmostId !== null) {
          // Walk up the parent chain to find the nearest pressable ancestor
          // (self-inclusive).  findTopmostSolid returns the deepest leaf node,
          // but clicking anywhere inside a Pressable's subtree should fire its
          // onPress — exactly like DOM event bubbling.
          let pressableTarget = topmostId;
          while (pressableTarget !== undefined && !pressableRegistry.has(pressableTarget)) {
            pressableTarget = parentMap.get(pressableTarget);
          }
          if (pressableTarget !== undefined) {
            const ph = pressableRegistry.get(pressableTarget);
            if (ph && !isDisabled(pressableTarget)) {
              const layout = __glyx_getLayout(pressableTarget);
              const pev = {
                x: ev.x, y: ev.y,
                locationX: layout ? ev.x - layout.x : 0,
                locationY: layout ? ev.y - layout.y : 0,
              };
              // Right-click → onRightPress (if present); otherwise left → onPress.
              if (isRight) ph.onRightPress?.(pev);
              else         ph.onPress?.(pev);
            }
          }

          // Route to TextInput handler if the topmost node is an input.
          // Inputs are leaf nodes with no children, so no walk-up needed.
          const ih = inputRegistry.get(topmostId);
          if (ih && !isDisabled(topmostId)) {
            setFocus(topmostId);
            const layout = __glyx_getLayout(topmostId);
            if (layout) ih.onClickAt?.(ev.x - layout.x, ev.y - layout.y);
            // Begin drag-selection: subsequent cursorMoved events extend the
            // selection from this anchor until the button is released.
            if (!isRight) inputDragNodeId = topmostId;
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

        if (!ev.pressed) break;

        // Scroll-navigation keys: route to the topmost scroll view the cursor
        // is over — but ONLY when no text input is focused.  A focused input
        // owns ALL navigation keys (TextInput moves the caret on PageUp/Down
        // and jumps the document on Ctrl+Home/End; caret-follow scrolls the view).
        {
          const k = ev.key;
          const noFocus    = focusedNodeId === null;
          const isPageKey  = (k === 'PageUp' || k === 'PageDown') && noFocus;
          const isJumpKey  = ctrlHeld && (k === 'Home' || k === 'End') && noFocus;
          const isArrowKey = (k === 'ArrowUp' || k === 'ArrowDown') && noFocus;
          if (isPageKey || isJumpKey || isArrowKey) {
            const target = findScrollTarget(focusedNodeId);
            if (target !== null) {
              const sh     = scrollRegistry.get(target);
              const layout = __glyx_getLayout(target);
              const viewH  = layout ? layout.height : 200;
              const LINE   = 24;
              if      (k === 'ArrowUp')   sh.onScroll?.(-(LINE));
              else if (k === 'ArrowDown') sh.onScroll?.(LINE);
              else if (k === 'PageUp')    sh.onScroll?.(-(viewH - LINE));
              else if (k === 'PageDown')  sh.onScroll?.(viewH - LINE);
              else if (k === 'Home')      sh.onAbsoluteScroll?.(0);
              else if (k === 'End')       sh.onAbsoluteScroll?.(999999);
            }
            break;
          }
        }

        if (focusedNodeId === null) break;

        const handlers = inputRegistry.get(focusedNodeId);
        if (!handlers) break;

        handlers.onKeyPress?.({ key: ev.key, text: ev.text, ctrl: ctrlHeld, shift: shiftHeld });
        break;
      }

      case 'accessibilityFocus': {
        // Screen reader (or other AT) moved focus — sync JS's own focus
        // tracker the same way a mouse click would, so onFocus/styling fire.
        setFocus(ev.nodeId);
        break;
      }

      case 'accessibilityValueChange': {
        const h = a11yValueRegistry.get(ev.nodeId);
        if (!h) break;
        if (ev.action === 'increment') h.onIncrement?.();
        else if (ev.action === 'decrement') h.onDecrement?.();
        else if (ev.action === 'setValue' && ev.numericValue !== undefined) h.onSetValue?.(ev.numericValue);
        break;
      }

      case 'ime': {
        // Only reaches JS at all when Rust's own focus registry has a node
        // focused (see glyx-core's ShellEvent::Ime handling) — but re-check
        // the JS-side registry too, since the two are independent trackers.
        if (focusedNodeId === null) break;
        const handlers = inputRegistry.get(focusedNodeId);
        if (!handlers) break;
        if (ev.kind === 'preedit') {
          handlers.onImePreedit?.({
            text: ev.text ?? '',
            cursorStart: ev.cursorStart ?? 0,
            cursorEnd: ev.cursorEnd ?? 0,
          });
        } else if (ev.kind === 'commit') {
          handlers.onImeCommit?.(ev.text ?? '');
        } else if (ev.kind === 'disabled') {
          handlers.onImePreedit?.({ text: '', cursorStart: 0, cursorEnd: 0 });
        }
        break;
      }

      case 'cursorMoved': {
        // Track final position — hover is resolved once after the loop
        // so multiple cursor events per frame produce only one hit-test.
        cursorX = ev.x;
        cursorY = ev.y;
        cursorMovedThisFrame = true;
        // Text drag-selection: while the left button is held on an input,
        // every cursor move extends the selection toward the pointer.
        if (inputDragNodeId !== null) {
          const ih = inputRegistry.get(inputDragNodeId);
          if (ih && ih.onDragAt) {
            const layout = __glyx_getLayout(inputDragNodeId);
            if (layout) ih.onDragAt(ev.x - layout.x, ev.y - layout.y);
          }
        }
        break;
      }

      case 'scroll': {
        // Route the scroll delta to the DEEPEST ScrollView the cursor is over.
        // Registration order is unreliable for nesting (children mount before
        // parents, and side-by-side panes can re-register in any order): a
        // table's inner list inside a page ScrollView must win over the page.
        let target = null;
        let targetHandlers = null;
        for (const [nodeId, handlers] of scrollRegistry) {
          if (!hitTest(nodeId, cursorX, cursorY) || isDisabled(nodeId)) continue;
          if (target === null || isAncestorOf(target, nodeId)) {
            target = nodeId;
            targetHandlers = handlers;
          }
        }
        targetHandlers?.onScroll?.(ev.deltaY);
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

      case 'systemWatch': {
        // Rust-side watcher detected a change (delta-gated) — dispatch to the
        // subscriber.  Payload is JSON (or a bare JSON scalar for darkMode).
        const cb = systemWatchRegistry.get(ev.id);
        if (cb) {
          let val = null;
          try { val = JSON.parse(ev.payload); } catch { val = ev.payload; }
          try { cb(val); } catch (e) { if (typeof __glyx_log !== 'undefined') __glyx_log('[system.watch] callback error: ' + e); }
        }
        break;
      }

      case 'imageError': {
        const onError = imageErrorRegistry.get(ev.imageId);
        if (onError) try { onError({ path: ev.path }); } catch {}
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
    // Walk up to find the nearest pressable ancestor (same bubbling logic as click).
    let hoverId = topSolid;
    while (hoverId !== undefined && !pressableRegistry.has(hoverId)) {
      hoverId = parentMap.get(hoverId);
    }
    const newHoveredId = (hoverId !== undefined && !isDisabled(hoverId)) ? hoverId : null;

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
