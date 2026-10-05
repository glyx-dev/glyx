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
// nodeId -> (e: { deltaY, ctrl, shift, x, y }) => boolean. Offered each wheel event
// before any ScrollView; returning true consumes it.
const wheelRegistry = new Map();

// Map from nodeId -> { onDragStart?, onDragMove?, onDragEnd? }
// Draggable nodes (e.g. Slider thumb) register here.
const dragRegistry = new Map();

// Map from nodeId -> { onIncrement?, onDecrement?, onSetValue?, onExpand?,
// onCollapse? } Numeric controls (e.g. Slider) register here so a screen
// reader's Increment/Decrement/SetValue actions (Narrator arrow keys on a
// focused slider, etc.) can actually change the value — Rust has no concept
// of the control's own min/max/step, so it just forwards the action here.
// Disclosure controls (accordions, tree items) register onExpand/onCollapse
// the same way for Action::Expand/Collapse.
const a11yValueRegistry = new Map();

// Map from nodeId -> true/false — prevents event dispatch to the node.
// Children of a disabled node are also blocked (ancestor check during dispatch).
const disabledRegistry = new Map();

// Set of nodeIds with pointerEvents: 'none' — these nodes are invisible to
// hit-testing; events pass through them to nodes underneath.
const pointerEventsNoneRegistry = new Set();

// Map from childId → parentId, populated by hostConfig on every tree mutation.
// Used by isAncestorOf/findScrollTarget and the pressable-ancestor bubbling
// walk (click/hover) to determine ancestor relationships.
const parentMap = new Map();

// Currently dragged node id (or null). Set on dragStart, cleared on dragEnd.
let activeDragId = null;

// Map from imageId -> onError callback, fired when a native image load fails.
const imageErrorRegistry = new Map();

// Map from watch id -> callback for Rust-side system watchers (system.watch).
const systemWatchRegistry = new Map();

// Listeners notified on window resize: Array<(size: {width, height}) => void>
const windowSizeListeners = [];

// Listeners notified on every key event: Array<(ev: {key, ctrl, shift, alt, super, pressed}) => boolean|void>
// (returning true consumes the key)
const keyListeners = [];

// Listeners notified when a native menu bar item is chosen: Array<(ev: {id, checked?}) => void>
const menuBarListeners = [];

// Listeners notified of tray icon and tray menu events (parsed): Array<(ev: object) => void>
const trayListeners = [];

// Listeners called on every mouse-button press, regardless of which node was hit.
// Used by dropdowns / overlays to close on outside click.
// Array<(ev: {x, y, pressed}) => void>
const globalClickListeners = [];

// Currently focused input node id (or null).
let focusedNodeId = null;

// ── Keyboard-focus-visible registry ──────────────────────────────────────────
// Deliberately separate from `inputRegistry` above. `inputRegistry`/
// `focusedNodeId` model TEXT-EDIT focus: driven by both mouse clicks (see the
// 'mouseButton' case's `inputTarget` walk-up) and Tab, because clicking into
// a text field legitimately should focus it. A `Pressable`/button registering
// there would ALSO pick up that click-driven `setFocus` call, showing a
// focus ring on every click — not what a focus-visible ring is for. This
// registry only ever gets driven from the 'accessibilityFocus' case below
// (Tab/Shift+Tab or AT-driven focus), never from a mouse click.
const focusVisualRegistry = new Map(); // nodeId -> { onFocus, onBlur }
let visualFocusedNodeId = null;
// Input node currently being drag-selected (left button held after pressing
// on a TextInput); cursorMoved extends its selection until release.
let inputDragNodeId = null;

// Double-click detection for text inputs — same node, within both a time
// window and a pixel-distance threshold of the previous press counts as a
// double-click (standard desktop-editor convention; word selection).
let lastClickTime   = 0;
let lastClickX      = 0;
let lastClickY      = 0;
let lastClickTarget = null;
const DOUBLE_CLICK_MS = 400;
const DOUBLE_CLICK_PX = 5;

// Currently hovered pressable node id (or null).
// Updated once per frame from the last cursorMoved event's position.
let hoveredPressableId = null;

// Modifier key state — updated on every keyInput (pressed AND released).
let ctrlHeld  = false;
let shiftHeld = false;
let altHeld   = false;
let superHeld = false;

// Last cursor position seen this frame (updated by cursorMoved events).
let cursorX = 0;
let cursorY = 0;
// Topmost solid node at the last cursor position — resolved NATIVELY at
// input-event-construction time (glyx-core's `hit_test_solid`), not by JS
// calling `findTopmostSolid` itself. See `findTopmostSolid`'s doc comment.
let cursorTarget = null;

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
 * Register a node for keyboard-focus-visible styling only (Tab/Shift+Tab or
 * AT-driven focus) — see `focusVisualRegistry`'s comment above for why this
 * is separate from `registerInput`. Used by `Pressable`.
 * @param {number} nodeId
 * @param {{ onFocus?: () => void, onBlur?: () => void }} handlers
 */
export function registerFocusable(nodeId, handlers) {
  focusVisualRegistry.set(nodeId, handlers);
}

/**
 * Unregister a keyboard-focus-visible node (called on unmount).
 * @param {number} nodeId
 */
export function unregisterFocusable(nodeId) {
  if (visualFocusedNodeId === nodeId) visualFocusedNodeId = null;
  focusVisualRegistry.delete(nodeId);
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
 * Offer wheel/trackpad scrolling over `nodeId` to `handler` before the ScrollView
 * underneath. `handler({ deltaY, ctrl, shift, x, y })` gets the delta, the held
 * modifiers and the pointer position relative to the node; return `true` to
 * consume the event (the ScrollView then doesn't scroll), anything else to let
 * it through. The deepest registered node under the pointer is asked first.
 * @param {number} nodeId
 * @param {(e: { deltaY: number, ctrl: boolean, shift: boolean, x: number, y: number }) => boolean | void} handler
 */
export function registerWheel(nodeId, handler) {
  wheelRegistry.set(nodeId, handler);
}

/** Remove a handler added with `registerWheel`. */
export function unregisterWheel(nodeId) {
  wheelRegistry.delete(nodeId);
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
 * Register a node's screen-reader value/state actions
 * (Increment/Decrement/SetValue for numeric controls, Expand/Collapse for
 * disclosure controls).
 * @param {number} nodeId
 * @param {{ onIncrement?: () => void, onDecrement?: () => void, onSetValue?: (v:number) => void, onExpand?: () => void, onCollapse?: () => void }} handlers
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
 * Record that `childId` is a direct child of `parentId` in the native tree.
 * Called by hostConfig whenever a child is attached to a parent.
 * @param {number} childId
 * @param {number} parentId
 */
export function setNodeParent(childId, parentId) {
  parentMap.set(childId, parentId);
}

/**
 * Remove a node from parentMap on tree detach.
 * @param {number} nodeId
 */
export function removeNodeFromTree(nodeId) {
  parentMap.delete(nodeId);
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

const EDIT_CHORDS = { copy: 'KeyC', cut: 'KeyX', paste: 'KeyV', selectAll: 'KeyA' };

/**
 * Run an editing command (`copy`, `cut`, `paste`, `selectAll`) on the focused text field, by replaying
 * its Ctrl chord through the same dispatcher real keys use, so the field handles it exactly as typed.
 * Returns false for an unknown command or without a runtime.
 * @param {'copy'|'cut'|'paste'|'selectAll'} role
 */
export function runEditCommand(role) {
  const key = EDIT_CHORDS[role];
  if (!key || typeof globalThis.__glyx_pollEvents === 'undefined') return false;
  const chord = [
    { type: 'keyInput', key: 'ControlLeft', pressed: true },
    { type: 'keyInput', key, pressed: true },
    { type: 'keyInput', key, pressed: false },
    { type: 'keyInput', key: 'ControlLeft', pressed: false },
  ];
  const prev = globalThis.__glyx_pollEvents;
  globalThis.__glyx_pollEvents = () => chord;
  try { dispatchEvents(); } finally { globalThis.__glyx_pollEvents = prev; }
  return true;
}

/**
 * Subscribe to tray events (pushed by the runtime). Returns nothing; use removeTrayListener.
 * @param {(ev: object) => void} fn  e.g. `{ MenuItemClick: { tray_id, item_id } }`
 */
export function addTrayListener(fn) {
  trayListeners.push(fn);
}

/** Unsubscribe from tray events. */
export function removeTrayListener(fn) {
  const idx = trayListeners.indexOf(fn);
  if (idx >= 0) trayListeners.splice(idx, 1);
}

/** How many tray listeners there are, so the first and last can switch the runtime push on and off. */
export function trayListenerCount() {
  return trayListeners.length;
}

/**
 * Subscribe to native menu bar choices (pushed by the runtime when an item is clicked).
 * @param {(ev: {id: string, checked?: boolean}) => void} fn
 */
export function addMenuBarListener(fn) {
  menuBarListeners.push(fn);
}

/**
 * Unsubscribe from native menu bar choices.
 * @param {(ev: {id: string, checked?: boolean}) => void} fn
 */
export function removeMenuBarListener(fn) {
  const idx = menuBarListeners.indexOf(fn);
  if (idx >= 0) menuBarListeners.splice(idx, 1);
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

/** The id of the text input that has focus right now, or null. */
export function getFocusedInput() {
  return focusedNodeId;
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
    // Sync the native focus registry ONCE, here, with the final new value —
    // deliberately AFTER onBlur/onFocus have run, and deliberately the only
    // place that does this (TextInput's onFocus/onBlur used to call
    // `__glyx_setFocus` directly too). Calling it from both places raced:
    // Tab moving focus to a plain Pressable already set native focus to
    // the new target correctly, but the outgoing TextInput's onBlur firing
    // straight after (from this same function) would then unconditionally
    // null it back out, since it had no way to know a new target existed.
    if (typeof __glyx_setFocus !== 'undefined') {
      __glyx_setFocus(nodeId);
    }
  }
}

// ── Hit-test helpers ──────────────────────────────────────────────────────────

// The node's REAL top-left for element-relative coordinates (`locationX`,
// text-input click/drag offsets). `__glyx_getLayout`'s `x/y` are clipped to
// the node's clip ancestor — right for "is the pointer over it" hit tests
// (hitTest below), wrong as an origin: for a node half-scrolled out of a
// ScrollView the clipped `y` is the clip edge, so every offset measured from
// it was short by the scrolled-away amount and clicks landed on the wrong
// line. `boxX/boxY` are the unclipped box (identical when not clipped);
// the `?? x/y` fallback keeps older runtimes / test stubs working.
function boxOriginX(layout) { return layout.boxX ?? layout.x; }
function boxOriginY(layout) { return layout.boxY ?? layout.y; }

function hitTest(nodeId, px, py) {
  if (pointerEventsNoneRegistry.has(nodeId)) return false;
  const layout = __glyx_getLayout(nodeId);
  if (!layout) return false;
  return (
    px >= layout.x && px < layout.x + layout.width &&
    py >= layout.y && py < layout.y + layout.height
  );
}

// Commits React updates made while handling one text-input key before the
// next key is handled. A text field computes each edit from its `value` prop
// and caret state as of the last render; when several keys arrive in one
// frame (fast typing, a barcode scanner, automation), without this every key
// edits the same stale value and only the last one survives. Set by
// index.js to the reconciler's `flushSync`; a plain call elsewhere (tests).
let flushKey = (fn) => fn();
export function setKeyFlush(fn) { flushKey = fn; }

/** Keys that press a focused button (winit physical key names). */
export function isActivationKey(key) {
  return key === 'Enter' || key === 'NumpadEnter' || key === 'Space';
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

// The topmost-solid-node hit-test that used to live here (`findTopmostSolid`)
// is now computed natively at input-event-construction time — see
// `glyx-core`'s `hit_test_solid` (`scene.rs`) and the `cursorTarget`/
// `ev.target` usage below. JS used to call `__glyx_getLayout` once per
// candidate node on every click and every cursor move; that's now zero
// additional native calls, since the result rides along on the input event.

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

        // Any mouse click clears the keyboard-focus-visible ring, matching
        // browsers' `:focus-visible` behavior: the ring is a keyboard/AT
        // affordance, not a "this is the active element" indicator, so
        // clicking ANYWHERE — including on the already-focused element
        // itself, or on a different element about to get its own
        // click-driven native focus — dismisses it until the next Tab
        // press. Deliberately unconditional and independent of hit-testing
        // below: matches the ring's own registry (`focusVisualRegistry`),
        // which mouse handling elsewhere never touches by design (see its
        // definition further up this file).
        if (visualFocusedNodeId !== null) {
          focusVisualRegistry.get(visualFocusedNodeId)?.onBlur?.();
          visualFocusedNodeId = null;
        }

        // Notify global click listeners first (e.g. to close open dropdowns /
        // context menus). `button` lets listeners distinguish right-clicks.
        if (globalClickListeners.length > 0) {
          const gev = { x: ev.x, y: ev.y, button: ev.button };
          for (const fn of globalClickListeners) try { fn(gev); } catch {}
        }

        // Topmost solid (click-opaque) node at this position, resolved
        // NATIVELY at input-event-construction time (glyx-core's
        // `hit_test_solid`), not by calling `findTopmostSolid` here.
        // A plain View absorbs the click even without a handler, preventing
        // fallthrough to pressables/inputs rendered beneath it in z-order.
        const topmostId = ev.target;
        let inputTarget;
        let keepFocusPress = false;   // the press landed on a `keepFocus` Pressable (a menu bar item)

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
            if (ph && ph.keepFocus) keepFocusPress = true;
            if (ph && !isDisabled(pressableTarget)) {
              const layout = __glyx_getLayout(pressableTarget);
              const pev = {
                x: ev.x, y: ev.y,
                locationX: layout ? ev.x - boxOriginX(layout) : 0,
                locationY: layout ? ev.y - boxOriginY(layout) : 0,
              };
              // Right-click → onRightPress (if present); otherwise left → onPress.
              if (isRight) ph.onRightPress?.(pev);
              else         ph.onPress?.(pev);
            }
          }

          // Route to TextInput handler if the topmost node (or a solid
          // ancestor) is a registered input. Plain leaf TextInputs register
          // at the topmost node directly (no walk needed), but composite
          // editors like RichTextEditor register on an outer container node
          // while multiple child Views (paragraph rows, spans) sit above it
          // in the solid stack — same walk-up pattern as pressableRegistry.
          inputTarget = topmostId;
          while (inputTarget !== undefined && !inputRegistry.has(inputTarget)) {
            inputTarget = parentMap.get(inputTarget);
          }
          const ih = inputTarget !== undefined ? inputRegistry.get(inputTarget) : undefined;
          if (ih && !isDisabled(inputTarget)) {
            setFocus(inputTarget);
            const layout = __glyx_getLayout(inputTarget);
            if (layout) {
              const now = Date.now();
              const isDoubleClick = !isRight
                && inputTarget === lastClickTarget
                && (now - lastClickTime) <= DOUBLE_CLICK_MS
                && Math.abs(ev.x - lastClickX) <= DOUBLE_CLICK_PX
                && Math.abs(ev.y - lastClickY) <= DOUBLE_CLICK_PX;
              if (isDoubleClick && ih.onDoubleClickAt) {
                ih.onDoubleClickAt(ev.x - boxOriginX(layout), ev.y - boxOriginY(layout));
                // Don't chain into a triple-click as another double-click.
                lastClickTime = 0;
              } else {
                ih.onClickAt?.(ev.x - boxOriginX(layout), ev.y - boxOriginY(layout));
                lastClickTime   = now;
                lastClickX      = ev.x;
                lastClickY      = ev.y;
                lastClickTarget = inputTarget;
              }
            }
            // Begin drag-selection: subsequent cursorMoved events extend the
            // selection from this anchor until the button is released.
            if (!isRight) inputDragNodeId = inputTarget;
          }
        }

        // Blur focused input if the click landed elsewhere. Uses the same
        // native-sync responsibility as `setFocus()` (onBlur itself no
        // longer touches `__glyx_setFocus` — see its comment) since this
        // path bypasses `setFocus()` entirely (there's no new input target
        // to focus, just a plain click on non-input ground).
        if (focusedNodeId !== null && focusedNodeId !== inputTarget && !keepFocusPress) {
          inputRegistry.get(focusedNodeId)?.onBlur?.();
          focusedNodeId = null;
          if (typeof __glyx_setFocus !== 'undefined') {
            __glyx_setFocus(null);
          }
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
        if (ev.key === 'AltLeft' || ev.key === 'AltRight') {
          altHeld = ev.pressed;
          break;
        }
        if (ev.key === 'SuperLeft' || ev.key === 'SuperRight') {
          superHeld = ev.pressed;
          break;
        }

        // Notify global key listeners (used for app-focused shortcuts).
        if (keyListeners.length > 0) {
          const kev = { key: ev.key, ctrl: ctrlHeld, shift: shiftHeld, alt: altHeld, super: superHeld, pressed: ev.pressed };
          // A listener that returns true has consumed the key: nothing else (a focused field, scrolling) sees it.
          let consumed = false;
          for (const fn of keyListeners) try { if (fn(kev) === true) consumed = true; } catch {}
          if (consumed) break;
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
        if (!handlers) {
          // Not a text input: a focused control that handles keys itself
          // (a chart's arrow-key navigation, say) via Pressable `onKeyDown`.
          const kev = {
            key: ev.key, ctrl: ctrlHeld, shift: shiftHeld,
            defaultPrevented: false,
            preventDefault() { this.defaultPrevented = true; },
          };
          focusVisualRegistry.get(focusedNodeId)?.onKeyDown?.(kev);
          // Enter / Space press a focused button, as on the web and native
          // toolkits. `onKeyDown` can call `e.preventDefault()` to keep them.
          if (!kev.defaultPrevented && isActivationKey(ev.key)) {
            const id = focusedNodeId;
            const ph = pressableRegistry.get(id);
            if (ph && !isDisabled(id)) {
              const layout = typeof __glyx_getLayout === 'function' ? __glyx_getLayout(id) : null;
              const cx = layout ? boxOriginX(layout) + layout.width / 2 : 0;
              const cy = layout ? boxOriginY(layout) + layout.height / 2 : 0;
              ph.onPress?.({
                x: cx, y: cy,
                locationX: layout ? layout.width / 2 : 0,
                locationY: layout ? layout.height / 2 : 0,
                keyboard: true,
              });
            }
          }
          break;
        }

        flushKey(() => handlers.onKeyPress?.({ key: ev.key, text: ev.text, ctrl: ctrlHeld, shift: shiftHeld }));
        break;
      }

      case 'accessibilityFocus': {
        // Screen reader / Tab-driven focus. Two independent consumers:
        //  - text-edit focus (cursor placement, IME routing) via the
        //    existing `inputRegistry`/`setFocus` — TextInput still wants
        //    this exactly like a click would trigger it.
        //  - a focus-visible ring for everything else (buttons, checkboxes,
        //    ...) via `focusVisualRegistry`, which mouse clicks never touch.
        setFocus(ev.nodeId);
        if (visualFocusedNodeId !== ev.nodeId) {
          if (visualFocusedNodeId !== null) {
            focusVisualRegistry.get(visualFocusedNodeId)?.onBlur?.();
          }
          visualFocusedNodeId = ev.nodeId;
          focusVisualRegistry.get(ev.nodeId)?.onFocus?.();
        }
        break;
      }

      case 'accessibilityTextSelection': {
        // Screen reader set the selection in a text field (moving by
        // character/word/line, or selecting with its own commands). Offsets
        // are already mapped from AccessKit run positions to characters of
        // the field's value natively; the field applies them like a drag.
        inputRegistry.get(ev.nodeId)?.onSetSelection?.(ev.anchor, ev.focus);
        break;
      }

      case 'accessibilityValueChange': {
        const h = a11yValueRegistry.get(ev.nodeId);
        if (!h) break;
        if (ev.action === 'increment') h.onIncrement?.();
        else if (ev.action === 'decrement') h.onDecrement?.();
        else if (ev.action === 'setValue' && ev.numericValue !== undefined) h.onSetValue?.(ev.numericValue);
        else if (ev.action === 'expand') h.onExpand?.();
        else if (ev.action === 'collapse') h.onCollapse?.();
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
          flushKey(() => handlers.onImeCommit?.(ev.text ?? ''));
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
        cursorTarget = ev.target;
        cursorMovedThisFrame = true;
        // Text drag-selection: while the left button is held on an input,
        // every cursor move extends the selection toward the pointer.
        if (inputDragNodeId !== null) {
          const ih = inputRegistry.get(inputDragNodeId);
          if (ih && ih.onDragAt) {
            const layout = __glyx_getLayout(inputDragNodeId);
            if (layout) ih.onDragAt(ev.x - boxOriginX(layout), ev.y - boxOriginY(layout));
          }
        }
        break;
      }

      case 'scroll': {
        // Wheel handlers (e.g. Ctrl+wheel zoom on a chart) get the first offer.
        let wheelNode = null;
        for (const nodeId of wheelRegistry.keys()) {
          if (!hitTest(nodeId, cursorX, cursorY) || isDisabled(nodeId)) continue;
          if (wheelNode === null || isAncestorOf(wheelNode, nodeId)) wheelNode = nodeId;
        }
        if (wheelNode !== null) {
          const l = __glyx_getLayout(wheelNode);
          const consumed = wheelRegistry.get(wheelNode)({
            deltaY: ev.deltaY, ctrl: ctrlHeld, shift: shiftHeld,
            x: l ? cursorX - boxOriginX(l) : 0, y: l ? cursorY - boxOriginY(l) : 0,
          });
          if (consumed === true) break;
        }
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

      case 'scrollIntoView': {
        // Absolute scroll position computed NATIVELY (see glyx-core's
        // `layout::scroll_reveal_target`) to bring a just-focused node into
        // view. Routed through the exact same `onAbsoluteScroll` path as
        // `scrollbarDrag` above — deliberately no separate math or clamping
        // here. An earlier JS-side attempt at this feature tried to
        // recompute the equivalent of this value itself from a React-state
        // ref and raced real scroll updates; the fix was moving the
        // computation to Rust (which already has the authoritative current
        // offset) and treating the result as just another absolute-scroll
        // request, same as a scrollbar drag.
        const handlers = scrollRegistry.get(ev.nodeId);
        handlers?.onAbsoluteScroll?.(ev.scrollY);
        break;
      }

      case 'resize': {
        const size = { width: ev.width, height: ev.height };
        for (const fn of windowSizeListeners) fn(size);
        break;
      }

      case 'tray': {
        let tev = null;
        try { tev = JSON.parse(ev.json); } catch { /* ignore a malformed event */ }
        if (tev) for (const fn of trayListeners.slice()) try { fn(tev); } catch {}
        break;
      }

      case 'menuBar': {
        const mev = ev.checked === undefined ? { id: ev.id } : { id: ev.id, checked: ev.checked };
        for (const fn of menuBarListeners.slice()) try { fn(mev); } catch {}
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
  // Uses the natively-resolved topmost solid node (`cursorTarget`, set by
  // the 'cursorMoved' case above) so that views beneath a covering solid
  // node never receive hover effects, and plain Views (not in
  // pressableRegistry) are treated as hover-opaque (no effect fires on them).
  if (cursorMovedThisFrame) {
    const topSolid = cursorTarget;
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

    // Continuous pointer tracking for the hovered pressable (charts'
    // crosshair, sliders' hover preview…). Once per frame: cursor moves are
    // already coalesced natively, so this never runs more than once a frame.
    if (newHoveredId !== null) {
      const h = pressableRegistry.get(newHoveredId);
      if (h?.onPointerMove && typeof __glyx_getLayout !== 'undefined') {
        const l = __glyx_getLayout(newHoveredId);
        if (l) {
          h.onPointerMove({
            x: cursorX, y: cursorY,
            locationX: cursorX - boxOriginX(l), locationY: cursorY - boxOriginY(l),
          });
        }
      }
    }
  }
}
