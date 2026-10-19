// @glyx-dev/react — event dispatcher
//
// This module bridges Glyx's native input events to React component handlers.
// It is driven by `__glyx_frameCallback`, registered on `globalThis` in
// index.ts and called by the Rust runtime once per frame (frame_tick).
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
// nodeId -> (e: { deltaX, deltaY, ctrl, shift, x, y }) => boolean. Offered each wheel event
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
let activeDragId: any = null;

// Map from imageId -> onError callback, fired when a native image load fails.
const imageErrorRegistry = new Map();

// Map from watch id -> callback for Rust-side system watchers (system.watch).
const systemWatchRegistry = new Map();

// Listeners notified on window resize: Array<(size: {width, height}) => void>
const windowSizeListeners: any[] = [];

// Listeners notified on every key event: Array<(ev: {key, ctrl, shift, alt, super, pressed}) => boolean|void>
// (returning true consumes the key)
const keyListeners: any[] = [];

// Listeners notified when a native menu bar item is chosen: Array<(ev: {id, checked?}) => void>
const menuBarListeners: any[] = [];

// Listeners notified of tray icon and tray menu events (parsed): Array<(ev: object) => void>
const trayListeners: any[] = [];

// Listeners called on every mouse-button press, regardless of which node was hit.
// Used by dropdowns / overlays to close on outside click.
// Array<(ev: {x, y, pressed}) => void>
const globalClickListeners: any[] = [];

// Currently focused input node id (or null).
let focusedNodeId: any = null;

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
let visualFocusedNodeId: any = null;
// Input node currently being drag-selected (left button held after pressing
// on a TextInput); cursorMoved extends its selection until release.
let inputDragNodeId: any = null;

// Double-click detection for text inputs — same node, within both a time
// window and a pixel-distance threshold of the previous press counts as a
// double-click (standard desktop-editor convention; word selection).
let lastClickTime   = 0;
let lastClickX      = 0;
let lastClickY      = 0;
let lastClickTarget: any = null;
const DOUBLE_CLICK_MS = 400;
const DOUBLE_CLICK_PX = 5;

// Currently hovered pressable node id (or null).
// Updated once per frame from the last cursorMoved event's position.
let hoveredPressableId: any = null;

// Modifier key state — updated on every keyInput (pressed AND released).
let ctrlHeld  = false;
let shiftHeld = false;
let altHeld   = false;
let superHeld = false;

// Mouse buttons held, as the web's `PointerEvent.buttons`: 1 left, 2 right, 4 middle.
let buttonsHeld = 0;
// The Pressable that has captured the pointer: from a press on it until the button is released, it gets the
// pointer's moves wherever the pointer goes (a drawing that runs past the canvas's edge keeps going), and a
// final `onPointerUp`. `null` when nothing has it.
let pointerCaptureId: any = null;
// Where the pointer was this frame, oldest first: every position a merged cursor move passed through, then the
// latest. Reset each dispatch.
let moveTrail: number[] = [];

// Who answers `canvasExport` events (a finished `ctx.toDataURL()` / `toPNG()`): canvas.ts sets it.
let canvasExportHandler: ((ev: any) => void) | null = null;
export function setCanvasExportHandler(fn: (ev: any) => void) { canvasExportHandler = fn; }

/** Send the pointer's moves to this Pressable until the button is released (a press on it does this by default). */
export function setPointerCapture(nodeId: any) { pointerCaptureId = nodeId; }
/** Stop capturing (only if `nodeId` is the capturing node, when given). */
export function releasePointerCapture(nodeId?: any) {
  if (nodeId === undefined || pointerCaptureId === nodeId) pointerCaptureId = null;
}

// Last cursor position seen this frame (updated by cursorMoved events).
let cursorX = 0;
let cursorY = 0;
// Topmost solid node at the last cursor position — resolved NATIVELY at
// input-event-construction time (glyx-core's `hit_test_solid`), not by JS
// calling `findTopmostSolid` itself. See `findTopmostSolid`'s doc comment.
let cursorTarget: any = null;

/**
 * A pointer event for a Pressable at (x, y), in window coordinates, with the position inside its box. Like the web's:
 * `buttons` (1 left, 2 right, 4 middle; 0 when none is held), `button` (the one that changed, -1 for a move),
 * `pressure` (0.5 while a button is held, 0 otherwise: a mouse), `pointerType` and `pointerId`. Pen and touch
 * pressure are not reported yet.
 */
function pointerEvent(layout: any, x: number, y: number, button: number) {
  return {
    x, y,
    locationX: x - boxOriginX(layout), locationY: y - boxOriginY(layout),
    button, buttons: buttonsHeld,
    pressure: buttonsHeld ? 0.5 : 0,
    pointerType: 'mouse', pointerId: 1,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Register a Pressable node so the event dispatcher can fire its callbacks.
 * @param {number} nodeId
 * @param {{ onPress?: () => void, onPressIn?: () => void, onPressOut?: () => void }} handlers
 */
export function registerPressable(nodeId: any, handlers: { onPress: ((e: any) => any) | (({ x, y }: { x: any; y: any; }) => void) | (({ x }: { x: any; }) => void); onRightPress?: (e: any) => any; onPressIn: (() => any) | (() => void) | (() => void); onPressOut: (() => any) | (() => void) | (() => void); onHoverIn: (() => any) | (() => void) | (() => void); onHoverOut: (() => any) | (() => void) | (() => void); onPointerMove?: (e: any) => any; onPointerDown?: (e: any) => any; onPointerUp?: (e: any) => any; capturesPointer?: boolean; keepFocus?: any; }) {
  pressableRegistry.set(nodeId, handlers);
}

/**
 * Register a callback fired when the image with `imageId` fails to load.
 * @param {number} imageId - id returned by __glyx_createImage
 * @param {(ev: { path: string }) => void} onError
 */
export function registerImageError(imageId: any, onError: (ev: any) => any) {
  imageErrorRegistry.set(imageId, onError);
}

/** Register/unregister a system.watch subscriber (see api.ts). */
export function registerSystemWatch(id: any, cb: any) {
  systemWatchRegistry.set(id, cb);
}
export function unregisterSystemWatch(id: any) {
  systemWatchRegistry.delete(id);
}

export function unregisterImageError(imageId: any) {
  imageErrorRegistry.delete(imageId);
}

/**
 * Unregister a Pressable node (called when the component unmounts).
 * @param {number} nodeId
 */
export function unregisterPressable(nodeId: any) {
  pressableRegistry.delete(nodeId);
}

/**
 * Register a TextInput node.
 * @param {number} nodeId
 * @param {{ onFocus?: () => void, onBlur?: () => void, onChangeText?: (text: string) => void }} handlers
 */
/** What a text-input-like widget registers so the event layer can drive it. All optional. */
export interface InputHandlers {
  onFocus?:         () => void;
  onBlur?:          () => void;
  onKeyPress?:      (ev: any) => void;
  onClickAt?:       (relX: number, relY: number) => void;
  onDoubleClickAt?: (relX: number, relY: number) => void;
  onDragAt?:        (relX: number, relY: number) => void;
  onSetSelection?:  (anchor: number, focus: number) => void;
}

export function registerInput(nodeId: any, handlers: InputHandlers) {
  inputRegistry.set(nodeId, handlers);
}

/**
 * Register a node for keyboard-focus-visible styling only (Tab/Shift+Tab or
 * AT-driven focus) — see `focusVisualRegistry`'s comment above for why this
 * is separate from `registerInput`. Used by `Pressable`.
 * @param {number} nodeId
 * @param {{ onFocus?: () => void, onBlur?: () => void }} handlers
 */
export function registerFocusable(nodeId: any, handlers: { onFocus: () => any; onBlur: () => any; onKeyDown: (e: any) => any; }) {
  focusVisualRegistry.set(nodeId, handlers);
}

/**
 * Unregister a keyboard-focus-visible node (called on unmount).
 * @param {number} nodeId
 */
export function unregisterFocusable(nodeId: any) {
  if (visualFocusedNodeId === nodeId) visualFocusedNodeId = null;
  focusVisualRegistry.delete(nodeId);
}

/**
 * Unregister a TextInput node.
 * @param {number} nodeId
 */
export function unregisterInput(nodeId: any) {
  if (focusedNodeId === nodeId) focusedNodeId = null;
  inputRegistry.delete(nodeId);
}

/** What a scrolling node registers with `registerScrollView`. */
export interface ScrollHandlers {
  /**
   * Wheel / touchpad scrolling over the node, in the web's convention: positive `deltaY` scrolls down,
   * positive `deltaX` scrolls right. A node that scrolls on one axis ignores the other delta.
   */
  onScroll: (deltaY: number, deltaX?: number) => void;
  onAbsoluteScroll: (y: number) => void;
  /** The horizontal scrollbar was dragged, or a focused node needs revealing sideways: scroll to this x. */
  onAbsoluteScrollX?: (x: number) => void;
  getScrollY?: () => number;
  /** Scrolls sideways: it is offered horizontal wheel input (and Shift+wheel). Default false. */
  horizontal?: boolean;
  /** Scrolls up and down: it is offered vertical wheel input. Default true; set false for a horizontal-only node. */
  vertical?: boolean;
}

/**
 * Register a scrolling node so scroll events are routed to it. Vertical and horizontal input are routed
 * separately: each goes to the deepest node under the pointer that scrolls that way, so a vertical list
 * inside a horizontal pane scrolls the list up and down and the pane left and right.
 * @param {number} nodeId
 * @param {ScrollHandlers} handlers
 */
export function registerScrollView(nodeId: any, handlers: ScrollHandlers) {
  scrollRegistry.set(nodeId, handlers);
}

/**
 * Unregister a ScrollView node (called when the component unmounts).
 * @param {number} nodeId
 */
export function unregisterScrollView(nodeId: any) {
  scrollRegistry.delete(nodeId);
}

/**
 * Offer wheel/trackpad scrolling over `nodeId` to `handler` before the ScrollView
 * underneath. `handler({ deltaX, deltaY, ctrl, shift, x, y })` gets the deltas (positive scrolls
 * right / down), the held modifiers and the pointer position relative to the node; return `true` to
 * consume the event (the ScrollView then doesn't scroll), anything else to let
 * it through. The deepest registered node under the pointer is asked first.
 * @param {number} nodeId
 * @param {(e: { deltaX: number, deltaY: number, ctrl: boolean, shift: boolean, x: number, y: number }) => boolean | void} handler
 */
export function registerWheel(nodeId: any, handler: (e: any) => any) {
  wheelRegistry.set(nodeId, handler);
}

/** Remove a handler added with `registerWheel`. */
export function unregisterWheel(nodeId: any) {
  wheelRegistry.delete(nodeId);
}

/**
 * Register a draggable node (e.g. a Slider thumb).
 * @param {number} nodeId
 * @param {{ onDragStart?: (e:{x,y})=>void, onDragMove?: (e:{x,y,dx,dy})=>void, onDragEnd?: (e:{x,y})=>void }} handlers
 */
export function registerDraggable(nodeId: any, handlers: { onDragStart: ((e: any) => any) | (({ x, y }: { x: any; y: any; }) => void) | (({ x }: { x: any; }) => void); onDragMove: ((e: any) => any) | (({ x, y }: { x: any; y: any; }) => void) | (({ x }: { x: any; }) => void); onDragEnd?: ((e: any) => any) | (() => void); }) {
  dragRegistry.set(nodeId, handlers);
}

/**
 * Unregister a draggable node (called when the component unmounts).
 * @param {number} nodeId
 */
export function unregisterDraggable(nodeId: any) {
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
export function registerA11yValue(nodeId: any, handlers: { onIncrement(): void; onDecrement(): void; onSetValue(v: number): void; }) {
  a11yValueRegistry.set(nodeId, handlers);
}

/** Unregister a node's screen-reader value actions (on unmount). */
export function unregisterA11yValue(nodeId: any) {
  a11yValueRegistry.delete(nodeId);
}

/**
 * Register or update the disabled state of a node.
 * When `disabled` is true, the node (and any descendant) will not receive
 * press, input, drag, hover, or scroll events.
 * @param {number} nodeId
 * @param {boolean} disabled
 */
export function registerDisabledNode(nodeId: any, disabled: boolean) {
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
export function unregisterDisabledNode(nodeId: any) {
  disabledRegistry.delete(nodeId);
}

/**
 * Mark a node as having `pointerEvents: 'none'`, making it invisible to
 * hit-testing. Events pass through to nodes layered underneath.
 * @param {number} nodeId
 */
export function registerPointerEventsNone(nodeId: unknown) {
  pointerEventsNoneRegistry.add(nodeId);
}

/**
 * Record that `childId` is a direct child of `parentId` in the native tree.
 * Called by hostConfig whenever a child is attached to a parent.
 * @param {number} childId
 * @param {number} parentId
 */
export function setNodeParent(childId: any, parentId: any) {
  parentMap.set(childId, parentId);
}

/**
 * Remove a node from parentMap on tree detach.
 * @param {number} nodeId
 */
export function removeNodeFromTree(nodeId: any) {
  parentMap.delete(nodeId);
}

/**
 * Unregister a pointerEvents: 'none' marker.
 * @param {number} nodeId
 */
export function unregisterPointerEventsNone(nodeId: unknown) {
  pointerEventsNoneRegistry.delete(nodeId);
}

/**
 * Subscribe to window resize events.
 * @param {(size: {width: number, height: number}) => void} fn
 */
export function addWindowSizeListener(fn: (s: React.SetStateAction<{ width: any; height: any; }>) => void) {
  windowSizeListeners.push(fn);
}

/**
 * Unsubscribe from window resize events.
 * @param {(size: {width: number, height: number}) => void} fn
 */
export function removeWindowSizeListener(fn: (s: React.SetStateAction<{ width: any; height: any; }>) => void) {
  const idx = windowSizeListeners.indexOf(fn);
  if (idx >= 0) windowSizeListeners.splice(idx, 1);
}

/**
 * Subscribe to raw key events (press and release).
 * @param {(ev: {key: string, ctrl: boolean, shift: boolean, pressed: boolean}) => void} fn
 */
export function addKeyListener(fn: { (ev: any): void; ({ key, ctrl, shift, pressed }: { key: any; ctrl: any; shift: any; pressed: any; }): void; (ev: any): any; }) {
  keyListeners.push(fn);
}

/**
 * Unsubscribe from raw key events.
 * @param {(ev: {key: string, ctrl: boolean, shift: boolean, pressed: boolean}) => void} fn
 */
export function removeKeyListener(fn: (ev: any) => any) {
  const idx = keyListeners.indexOf(fn);
  if (idx >= 0) keyListeners.splice(idx, 1);
}

const EDIT_CHORDS = { undo: 'KeyZ', redo: 'KeyY', copy: 'KeyC', cut: 'KeyX', paste: 'KeyV', selectAll: 'KeyA' };

/**
 * Run an editing command (`undo`, `redo`, `copy`, `cut`, `paste`, `selectAll`) on the focused text field, by replaying
 * its Ctrl chord through the same dispatcher real keys use, so the field handles it exactly as typed.
 * Returns false for an unknown command or without a runtime.
 * @param {'undo'|'redo'|'copy'|'cut'|'paste'|'selectAll'} role
 */
export function runEditCommand(role: string | number) {
  const key = (EDIT_CHORDS as any)[role];
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
export function addTrayListener(fn: any) {
  trayListeners.push(fn);
}

/** Unsubscribe from tray events. */
export function removeTrayListener(fn: any) {
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
export function addMenuBarListener(fn: (ev: any) => void) {
  menuBarListeners.push(fn);
}

/**
 * Unsubscribe from native menu bar choices.
 * @param {(ev: {id: string, checked?: boolean}) => void} fn
 */
export function removeMenuBarListener(fn: any) {
  const idx = menuBarListeners.indexOf(fn);
  if (idx >= 0) menuBarListeners.splice(idx, 1);
}

/**
 * Subscribe to every mouse-button press event (regardless of which node was hit).
 * Useful for dropdowns/overlays that need to close on outside click.
 * @param {(ev: {x: number, y: number}) => void} fn
 */
export function addGlobalClickListener(fn: (ev: { x: number; y: number }) => void) {
  globalClickListeners.push(fn);
}

/**
 * Unsubscribe from global click events.
 * @param {(ev: {x: number, y: number}) => void} fn
 */
export function removeGlobalClickListener(fn: (ev: { x: number; y: number }) => void) {
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
export function setFocus(nodeId: any) {
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
function boxOriginX(layout: { boxX: any; x: any; }) { return layout.boxX ?? layout.x; }
function boxOriginY(layout: { boxY: any; y: any; }) { return layout.boxY ?? layout.y; }

function hitTest(nodeId: unknown, px: number, py: number) {
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
// index.ts to the reconciler's `flushSync`; a plain call elsewhere (tests).
let flushKey = (fn: { (): any; (): any; (): any; }) => fn();
export function setKeyFlush(fn: { (fn: any): unknown; (fn: any): any; }) { flushKey = fn; }

/** Keys that press a focused button (winit physical key names). */
export function isActivationKey(key: string) {
  return key === 'Enter' || key === 'NumpadEnter' || key === 'Space';
}

/** True when the node is in the disabled registry. */
function isDisabled(nodeId: any) {
  return disabledRegistry.has(nodeId);
}

/**
 * Find the scroll view that should receive keyboard scroll keys.
 * Walks up from `fromNodeId` (if set) to find the nearest scroll ancestor,
 * then falls back to the topmost scroll view the cursor is over.
 * @param {number|null} fromNodeId
 * @returns {number|null}
 */
function findScrollTarget(fromNodeId: any) {
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
function isAncestorOf(ancestorId: any, descendantId: any) {
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
  moveTrail = [];

  for (const ev of events) {
    switch (ev.type) {

      case 'mouseButton': {
        if (!ev.pressed) {
          inputDragNodeId = null;   // end text drag-selection on release
          buttonsHeld &= ~(1 << ev.button);
          if (pointerCaptureId !== null) {
            const id = pointerCaptureId;
            pointerCaptureId = null;
            const ph = pressableRegistry.get(id);
            const l = ph?.onPointerUp && typeof __glyx_getLayout !== 'undefined' ? __glyx_getLayout(id) : null;
            if (l) ph.onPointerUp(pointerEvent(l, ev.x, ev.y, ev.button));
          }
          break;
        }
        buttonsHeld |= 1 << ev.button;

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
              // Pointer events (a press of any button), and capture: the pointer's moves keep coming to this
              // Pressable until the button goes up, even outside it.
              if (layout && ph.onPointerDown) ph.onPointerDown(pointerEvent(layout, ev.x, ev.y, ev.button));
              if (ph.capturesPointer) pointerCaptureId = pressableTarget;
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
        // Every position this move passed through (the runtime merges a frame's moves and keeps them), then the
        // latest, so a drawing app can follow the whole stroke.
        if (ev.trail) for (let k = 0; k < ev.trail.length; k++) moveTrail.push(ev.trail[k]);
        moveTrail.push(ev.x, ev.y);
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
        let wheelNode: any = null;
        for (const nodeId of wheelRegistry.keys()) {
          if (!hitTest(nodeId, cursorX, cursorY) || isDisabled(nodeId)) continue;
          if (wheelNode === null || isAncestorOf(wheelNode, nodeId)) wheelNode = nodeId;
        }
        if (wheelNode !== null) {
          const l = __glyx_getLayout(wheelNode);
          const consumed = wheelRegistry.get(wheelNode)({
            deltaX: ev.deltaX ?? 0, deltaY: ev.deltaY, ctrl: ctrlHeld, shift: shiftHeld,
            x: l ? cursorX - boxOriginX(l) : 0, y: l ? cursorY - boxOriginY(l) : 0,
          });
          if (consumed === true) break;
        }
        // Route the scroll to the DEEPEST scrolling node the cursor is over, per axis: vertical input goes to
        // the deepest node that scrolls vertically, horizontal input to the deepest that scrolls
        // horizontally (a vertical list inside a horizontal pane scrolls each its own way).
        // Registration order is unreliable for nesting (children mount before
        // parents, and side-by-side panes can re-register in any order): a
        // table's inner list inside a page ScrollView must win over the page.
        const deepest = (axis: 'x' | 'y') => {
          let target: any = null;
          let targetHandlers: any = null;
          for (const [nodeId, handlers] of scrollRegistry) {
            if (axis === 'x' ? handlers.horizontal !== true : handlers.vertical === false) continue;
            if (!hitTest(nodeId, cursorX, cursorY) || isDisabled(nodeId)) continue;
            if (target === null || isAncestorOf(target, nodeId)) {
              target = nodeId;
              targetHandlers = handlers;
            }
          }
          return targetHandlers;
        };
        let dx = ev.deltaX ?? 0;
        let dy = ev.deltaY ?? 0;
        const sideways = deepest('x');
        // Shift+wheel scrolls sideways, as on the web, but only where something scrolls sideways: elsewhere
        // Shift+wheel keeps scrolling up and down.
        if (shiftHeld && dx === 0 && dy !== 0 && sideways) { dx = dy; dy = 0; }
        const upDown = dy !== 0 ? deepest('y') : null;
        if (upDown && upDown === sideways && dx !== 0) {
          upDown.onScroll(dy, dx);
        } else {
          upDown?.onScroll(dy, 0);
          if (dx !== 0) sideways?.onScroll(0, dx);
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

      case 'canvasExport': {
        canvasExportHandler?.(ev);
        break;
      }

      case 'scrollbarDragX':
      case 'scrollIntoViewX': {
        // The horizontal twins of the two events around this case: an absolute x from the native side
        // (the horizontal scrollbar's thumb, or the reveal of a focused node), applied without more math here.
        scrollRegistry.get(ev.nodeId)?.onAbsoluteScrollX?.(ev.scrollX);
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
        let tev: any = null;
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
          let val: any = null;
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

    // Continuous pointer tracking: the Pressable that captured the pointer (a press on it, button still held),
    // else the hovered one (charts' crosshair, sliders' hover preview…). Once per frame: cursor moves are
    // merged natively, and the positions they passed through arrive as `points`.
    const trackedId = pointerCaptureId !== null && pressableRegistry.has(pointerCaptureId) ? pointerCaptureId : newHoveredId;
    if (trackedId !== null) {
      const h = pressableRegistry.get(trackedId);
      if (h?.onPointerMove && typeof __glyx_getLayout !== 'undefined') {
        const l = __glyx_getLayout(trackedId);
        if (l) {
          const e: any = pointerEvent(l, cursorX, cursorY, -1);
          // More than one position this frame: all of them, oldest first (the last is x, y).
          if (moveTrail.length > 2) {
            e.points = [];
            for (let k = 0; k + 1 < moveTrail.length; k += 2) {
              e.points.push({ x: moveTrail[k], y: moveTrail[k + 1], locationX: moveTrail[k] - boxOriginX(l), locationY: moveTrail[k + 1] - boxOriginY(l) });
            }
          }
          h.onPointerMove(e);
        }
      }
    }
  }
}
