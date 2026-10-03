import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import {
  registerPressable, unregisterPressable,
  registerScrollView, unregisterScrollView,
  registerWheel, unregisterWheel,
  registerDraggable, unregisterDraggable,
  registerDisabledNode, unregisterDisabledNode,
  addWindowSizeListener, removeWindowSizeListener,
  addGlobalClickListener, removeGlobalClickListener,
  registerImageError, unregisterImageError,
  registerFocusable, unregisterFocusable,
  setFocus,
} from './events.js';
import { glyxWindow, clipboard, input } from './api.js';
import { flattenStyle } from './style.js';

// ── Host components ───────────────────────────────────────────────────────────

export const View = ({ children, style, ...props }) =>
  React.createElement('view', { style, ...props }, children);

/**
 * RepaintBoundary — explicit render-layer hint.
 *
 * Wraps a subtree that changes infrequently (sidebars, navbars, complex static
 * cards, list items).  When none of the boundary's descendants are dirty in a
 * given frame, Glyx replays the cached Vello scene fragment directly —
 * skipping all child traversal and draw-call construction.
 *
 * No visual difference — purely a performance hint.  Safe to add/remove.
 *
 * Example:
 *   <RepaintBoundary>
 *     <Sidebar />
 *   </RepaintBoundary>
 */
export const RepaintBoundary = ({ children, style, ...props }) =>
  React.createElement('repaintBoundary', { style, ...props }, children);

/**
 * How many lines a Text shows before it's cut with "…". Three spellings:
 * the `numberOfLines` prop (React Native), `style.numberOfLines`, and the
 * web's `style={{ whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}` (or
 * `textOverflow: 'ellipsis'` alone), which mean one line. The prop wins.
 * Only one line is truncated with an ellipsis today; more lines are clipped.
 */
export function textLineLimit(numberOfLines, style) {
  if (numberOfLines != null) return numberOfLines;
  if (!style) return undefined;
  if (style.numberOfLines != null) return style.numberOfLines;
  if (style.textOverflow === 'ellipsis') return 1;
  return undefined;
}

export function Text({ children, style: styleProp, showCursor, numberOfLines, ...props }) {
  const style = flattenStyle(styleProp);
  // Flatten mixed children (strings + expressions) to a single string,
  // matching browser behaviour where <Text>= {val}</Text> just works.
  const text = Array.isArray(children)
    ? children.map(c => (c == null ? '' : String(c))).join('')
    : (children == null ? '' : String(children));
  const lines = textLineLimit(numberOfLines, style);
  return React.createElement('text', {
    text, style, showCursor, ...props,
    ...(lines != null ? { numberOfLines: lines } : null),
  });
}

export function Image({ src, width = 120, height = 120, resizeMode = 'stretch', onError, style: styleProp, ...props }) {
  const style = flattenStyle(styleProp);
  // Display-size hint: lets the engine rasterize SVGs at the rendered size
  // (bitmaps ignore it). style.width/height win over the props, matching layout.
  const hintW = typeof style?.width  === 'number' ? style.width  : (typeof width  === 'number' ? width  : 0);
  const hintH = typeof style?.height === 'number' ? style.height : (typeof height === 'number' ? height : 0);
  const imageId = React.useMemo(() => {
    if (!src) return null;
    return __glyx_createImage(src, hintW, hintH);
  }, [src, hintW, hintH]);

  // Keep the latest onError without re-registering each render.
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;
  useEffect(() => {
    if (imageId == null) return;
    registerImageError(imageId, ev => onErrorRef.current?.(ev));
    return () => unregisterImageError(imageId);
  }, [imageId]);

  return React.createElement('image', {
    imageId,
    resizeMode,
    style,
    width,
    height,
    ...props,
  });
}

// ── Pressable ─────────────────────────────────────────────────────────────────
//
// Registration strategy: register SYNCHRONOUSLY inside _glyxOnMount, which
// fires from createInstance during React's commit phase — guaranteed before
// any frame_tick dispatches events.
//
// A handlersRef proxy is stored in the registry so the registered callbacks
// always delegate to the latest closure values without needing re-registration
// on every render.

// Hover, press and focus changes ease in on a spring instead of snapping: stiff
// and critically damped, so it feels immediate (no bounce) and an interrupted
// hover turns around smoothly. Rust interpolates it — no JS per frame. Opt out
// per Pressable with `transition={false}`, or pass your own `transition`.
const PRESSABLE_TRANSITION = { spring: { stiffness: 600, damping: 48 }, properties: 'all' };

export function Pressable({ children, onPress, onRightPress, onPressIn, onPressOut, onHoverIn, onHoverOut, onPointerMove, onKeyDown, disabled, feedback = true, transition = PRESSABLE_TRANSITION, style, _glyxOnMount: externalOnMount, ...props }) {
  const nodeIdRef    = useRef(null);
  const handlersRef  = useRef(null);
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);
  // Keyboard-focus visibility only — Tab/Shift+Tab (or AT-driven focus) land
  // here via the same 'accessibilityFocus' event TextInput already consumes
  // (see events.js), but until now Pressable never registered for it, so
  // keyboard focus was invisible: the native focus registry moved, nothing
  // on screen showed it. `registerInput` below is what wires that up.
  const [focused, setFocused] = useState(false);

  // Always keep handlersRef up to date with the latest prop values.
  handlersRef.current = {
    onFocus: () => setFocused(true),
    onBlur:  () => setFocused(false),
    onPress: (e) => {
      // Move the Rust-side focus registry here — events.js's mouseButton
      // dispatch calls `onPress` DIRECTLY for a plain click (onPressIn/Out
      // are never invoked for a simple click, only onPress — confirmed by
      // reading the dispatch code after this fix's first attempt, in
      // onPressIn, silently did nothing). Without this, clicking a
      // Checkbox/Switch/Radio/Select/Slider never updates `focused_node`,
      // so the accessibility tree's `focus` field falls back to the root —
      // which is why Narrator's highlight rect covered the whole window
      // instead of the actual control.
      if (nodeIdRef.current != null) {
        // A control that takes keys becomes the key target on click too, not
        // only on Tab (setFocus also syncs the native focus registry).
        if (onKeyDown) setFocus(nodeIdRef.current);
        else if (typeof __glyx_setFocus !== 'undefined') __glyx_setFocus(nodeIdRef.current);
      }
      onPress?.(e);
    },
    onRightPress: (e) => onRightPress?.(e),
    onPressIn:  () => { setPressed(true);  onPressIn?.(); },
    onPressOut: () => { setPressed(false); onPressOut?.(); },
    onHoverIn:  () => { setHovered(true);  onHoverIn?.(); },
    onHoverOut: () => { setHovered(false); onHoverOut?.(); },
    onPointerMove: (e) => onPointerMove?.(e),
    onKeyDown: (e) => onKeyDown?.(e),
  };

  // Called synchronously by createInstance the moment the native node exists.
  const onMount = useCallback((id) => {
    nodeIdRef.current = id;
    // Register stable proxy functions that delegate to handlersRef.
    registerPressable(id, {
      onPress:      (e) => handlersRef.current.onPress(e),
      onRightPress: (e) => handlersRef.current.onRightPress(e),
      onPressIn:  () => handlersRef.current.onPressIn(),
      onPressOut: () => handlersRef.current.onPressOut(),
      onHoverIn:  () => handlersRef.current.onHoverIn(),
      onHoverOut: () => handlersRef.current.onHoverOut(),
      onPointerMove: (e) => handlersRef.current.onPointerMove(e),
    });
    registerDisabledNode(id, !!disabled);
    // Keyboard-focus-visible only — NOT `registerInput` (that registry is
    // also driven by mouse clicks, which would show a focus ring on every
    // click; see events.js's `focusVisualRegistry` comment).
    registerFocusable(id, {
      onFocus: () => handlersRef.current.onFocus(),
      onBlur:  () => handlersRef.current.onBlur(),
      onKeyDown: (e) => handlersRef.current.onKeyDown(e),
    });
    // Let a caller (e.g. RichTextEditor) also learn the native node id,
    // without clobbering Pressable's own registration below (see the
    // _glyxOnMount destructure above — this used to be spread in via
    // ...props, which silently overwrote this callback since it was
    // declared later in the object literal).
    externalOnMount?.(id);
  }, [disabled, externalOnMount]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep disabled state in sync when the prop changes; also clear any
  // stuck interaction state so the button doesn't appear hovered/pressed
  // after becoming disabled.
  useEffect(() => {
    if (nodeIdRef.current !== null) {
      registerDisabledNode(nodeIdRef.current, !!disabled);
    }
    if (disabled) {
      setPressed(false);
      setHovered(false);
    }
  }, [disabled]);

  // Unregister on unmount. useEffect for cleanup only — no timing dependency.
  useEffect(() => {
    return () => {
      if (nodeIdRef.current !== null) {
        unregisterPressable(nodeIdRef.current);
        unregisterDisabledNode(nodeIdRef.current);
        unregisterFocusable(nodeIdRef.current);
      }
    };
  }, []);

  // Visual feedback (opacity-based — stays within element bounds):
  //   pressed → darkened (confirms the click)
  //   hovered → slightly dimmed (indicates interactivity)
  //   disabled / default / feedback:false → no change
  // `feedback: false` is for structural pressables (backdrops, click
  // absorbers, custom-styled controls) — opacity on a container multiplies
  // through the whole subtree, so a dimming backdrop dims its content too.
  // style may be a function receiving the interaction state (RN-style):
  //   style={({ pressed, hovered }) => ({ ... })}
  // Function styles handle their own feedback, so opacity feedback is skipped.
  const styleIsFn = typeof style === 'function';
  const resolvedStyle = flattenStyle(styleIsFn ? style({ pressed, hovered, focused }) : style);
  const baseOpacity = resolvedStyle?.opacity ?? 1;
  const feedbackStyle = (!styleIsFn && feedback && pressed && !disabled)
    ? { ...resolvedStyle, opacity: baseOpacity * 0.65 }
    : (!styleIsFn && feedback && hovered && !disabled)
    ? { ...resolvedStyle, opacity: baseOpacity * 0.85 }
    : resolvedStyle;
  // Default keyboard-focus ring. Only applied when the caller hasn't already
  // taken over styling via a function `style` (those get `focused` above and
  // are expected to render their own indicator) — a plain object `style`
  // otherwise had no way at all to show Tab-driven focus. Deliberately
  // overrides any border the element's own style already sets (not just
  // filling in when unset) — most real buttons already have a border, and
  // a ring that only shows up on borderless elements isn't a visible focus
  // indicator at all.
  const mergedStyle = (!styleIsFn && focused && !disabled)
    ? { ...feedbackStyle, borderWidth: 2, borderColor: '#4C9AFF' }
    : feedbackStyle;

  return React.createElement(
    'view',
    // pressable:true tells the Rust drag-check that this node is interactive,
    // so glyxDraggable regions skip the window drag when this is under cursor.
    { _glyxOnMount: onMount, style: mergedStyle, pressable: true, transition, ...props },
    children
  );
}

// ── useDraggable ────────────────────────────────────────────────────────────────
//
// Low-level drag hook. Returns an `_glyxOnMount` callback to spread onto a View;
// the View's full area then receives native drag events:
//   onDragStart({x,y}) · onDragMove({x,y,dx,dy}) · onDragEnd({x,y})
// Used to build split panes, drag-and-drop, resize handles, etc.
//
//   const onMount = useDraggable({ onDragMove: ({dx}) => setW(w => w + dx) });
//   <View _glyxOnMount={onMount} ... />
export function useDraggable(handlers) {
  const idRef = useRef(null);
  const hRef  = useRef(handlers);
  hRef.current = handlers;
  const onMount = useCallback((id) => {
    idRef.current = id;
    registerDraggable(id, {
      onDragStart: (e) => hRef.current.onDragStart?.(e),
      onDragMove:  (e) => hRef.current.onDragMove?.(e),
      onDragEnd:   (e) => hRef.current.onDragEnd?.(e),
    });
  }, []);
  useEffect(() => () => { if (idRef.current !== null) unregisterDraggable(idRef.current); }, []);
  return onMount;
}

// Low-level wheel hook. Returns an `_glyxOnMount` callback to spread onto a View;
// wheel/trackpad scrolling over it is offered to `handler` first:
//   handler({ deltaY, ctrl, shift, x, y }) → true to consume the event (a
//   ScrollView underneath then doesn't scroll), anything else to let it through.
// Used for Ctrl+wheel zoom; combine with other mounts by calling both.
export function useWheel(handler) {
  const idRef = useRef(null);
  const hRef  = useRef(handler);
  hRef.current = handler;
  const onMount = useCallback((id) => {
    idRef.current = id;
    registerWheel(id, (e) => hRef.current?.(e));
  }, []);
  useEffect(() => () => { if (idRef.current !== null) unregisterWheel(idRef.current); }, []);
  return onMount;
}

// ── ScrollView ────────────────────────────────────────────────────────────────
//
// A vertically-scrollable container backed by a Vello clip layer.
//
// The native view receives two extra props that the Rust renderer handles:
//   clip: true          — push a Vello clip layer around children
//   scrollOffsetY: n    — shift children upward by n pixels
//   smoothScroll: true  — Rust eases the drawn offset toward each new
//                         scrollOffsetY (a spring, no JS per frame) instead of
//                         jumping; scrollbar drags and touchpads still apply
//                         instantly. Opt out with `smoothScroll={false}`.
//
// Scroll deltas arrive via the `scroll` input event, routed by events.js to
// whichever ScrollView the cursor is currently over.  The component converts
// deltas into a React state integer and re-renders, which triggers a
// visual-only UpdateNode (no Taffy rebuild — incremental layout).

export function ScrollView({
  children,
  style: styleProp,
  height,               // layout height — only set if you need a fixed height
  contentHeight,        // explicit content height override (more reliable than auto-detect)
  showScrollbar   = true,
  scrollbarWidth  = 8,
  scrollbarColor  = '#8c8caa99',
  smoothScroll    = true,
  ...props
}) {
  const style = flattenStyle(styleProp);
  const nodeIdRef    = useRef(null);
  const maxScrollRef = useRef(0);
  const [scrollY, setScrollY] = useState(0);
  // Tracks the current scroll offset for `getScrollY()` below, updated
  // SYNCHRONOUSLY at the point a new value is decided (inside onScroll/
  // onAbsoluteScroll) rather than mirrored from `scrollY` at render time —
  // see those callbacks' comments for why the render-time-mirror version of
  // this caused a real bug (Tab-driven scroll-into-view compounding into a
  // runaway when a second scroll request landed before React's previous
  // state update had rendered).
  const scrollYRef = useRef(0);

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

  // Height for scroll cap: explicit prop > style.height > 0 (uncapped).
  const viewH = height ?? (style && style.height) ?? 0;
  maxScrollRef.current = Math.max(0, resolvedContentH - viewH);

  // ── Stable scroll handler ───────────────────────────────────────────────────
  // Empty dep array → created once, re-registered never.
  // Reads maxScrollRef.current (not a captured value) so the cap is always fresh.
  // Refresh maxScroll from REAL layout right before clamping.  The native
  // layout cache reports `contentHeight` for clip nodes (measured from actual
  // child rects), which supersedes the prop-sum estimate — auto-sized children
  // (no height props) would otherwise compute maxScroll = 0 and kill scrolling.
  const refreshMaxScroll = useCallback(() => {
    const id = nodeIdRef.current;
    if (id == null || typeof __glyx_getLayout === 'undefined') return;
    const l = __glyx_getLayout(id);
    if (l && typeof l.contentHeight === 'number' && l.contentHeight > 0) {
      // Unclipped viewport height: contentHeight is measured natively from
      // unclipped rects, so a clipped `height` (this ScrollView half-scrolled
      // out of an outer one) would let the max scroll overshoot.
      maxScrollRef.current = Math.max(0, l.contentHeight - (l.boxHeight ?? l.height));
    }
  }, []);

  const onScroll = useCallback((deltaY) => {
    refreshMaxScroll();
    // `scrollYRef.current` (not `scrollY`/the functional-updater `prev`) is
    // the base here deliberately: a function passed to `setScrollY` doesn't
    // run synchronously — React executes it later, at render time. Reading
    // and writing the ref right here, synchronously, at the moment the
    // scroll is decided, is what actually fixes the staleness (an earlier
    // attempt updated the ref FROM INSIDE the functional updater, which has
    // the exact same lazy-execution problem and didn't fix anything).
    const next = Math.min(maxScrollRef.current, Math.max(0, scrollYRef.current + deltaY));
    scrollYRef.current = next;
    setScrollY(next);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onAbsoluteScroll = useCallback((y) => {
    refreshMaxScroll();
    const next = Math.min(maxScrollRef.current, Math.max(0, y));
    scrollYRef.current = next;
    setScrollY(next);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onMount = useCallback((id) => {
    nodeIdRef.current = id;
    registerScrollView(id, { onScroll, onAbsoluteScroll, getScrollY: () => scrollYRef.current });
  }, [onScroll, onAbsoluteScroll]);

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
    alignItems:     'stretch',
    // Rust: push Vello clip layer + shift children by scrollOffsetY.
    clip:           true,
    scrollOffsetY:  scrollY,
    smoothScroll,
    // Scrollbar visual props
    showScrollbar,
    scrollbarWidth,
    scrollbarColor,
    ...flattenStyle(style),
  };

  const finalStyle = height != null ? { ...viewStyle, height } : viewStyle;

  return React.createElement(
    'view',
    { _glyxOnMount: onMount, style: finalStyle, ...props },
    children,
  );
}

// ── VirtualizedList ───────────────────────────────────────────────────────────
//
// A windowed list that renders only the items currently visible in the
// viewport, plus an `overscan` buffer on each side.  Large datasets (thousands
// of items) incur no layout or draw cost for off-screen rows.
//
// Unlike ScrollView (which renders all children), VirtualizedList replaces
// invisible items with lightweight spacer Views, so Taffy only lays out the
// visible slice.
//
// Requirements:
//   • `itemHeight` must be a fixed number (uniform-height rows).
//     Variable-height support (measured items) is planned for a future release.
//   • `height`     — visible container height in px (required)
//   • `width`      — container width in px (required)
//
// Usage:
//   <VirtualizedList
//     data={items}
//     renderItem={({ item, index }) => <Row item={item} />}
//     keyExtractor={(item) => String(item.id)}
//     itemHeight={56}
//     height={600}
//     width={400}
//   />

export function VirtualizedList({
  data,
  renderItem,
  keyExtractor,
  itemHeight,
  height,
  width,
  overscan       = 5,
  showScrollbar  = true,
  scrollbarWidth = 8,
  scrollbarColor = '#8c8caa99',
  style,
  ...props
}) {
  const nodeIdRef    = useRef(null);
  const maxScrollRef = useRef(0);
  const [scrollY, setScrollY] = useState(0);
  // See ScrollView's identical comment — updated synchronously in
  // onScroll/onAbsoluteScroll below, not mirrored from `scrollY` at render
  // time (that version compounded into a scroll runaway).
  const scrollYRef = useRef(0);

  const totalItems    = data ? data.length : 0;
  const totalContentH = totalItems * itemHeight;

  // Keep maxScroll current without re-registering the scroll handler.
  maxScrollRef.current = Math.max(0, totalContentH - height);

  // Visible window (item indices).
  const firstVisible = Math.max(0, Math.floor(scrollY / itemHeight) - overscan);
  const lastVisible  = Math.min(totalItems, Math.ceil((scrollY + height) / itemHeight) + overscan);

  const topSpacerH    = firstVisible * itemHeight;
  const bottomSpacerH = Math.max(0, (totalItems - lastVisible) * itemHeight);

  // Stable handlers — never re-registered between renders. Base the delta
  // on `scrollYRef.current`, not the functional-updater `prev` — see
  // ScrollView's identical fix/comment: a function passed to `setScrollY`
  // runs later (at render time), so updating the ref from inside it doesn't
  // actually make `getScrollY()` synchronous.
  const onScroll = useCallback((deltaY) => {
    const next = Math.min(maxScrollRef.current, Math.max(0, scrollYRef.current + deltaY));
    scrollYRef.current = next;
    setScrollY(next);
  }, []);

  const onAbsoluteScroll = useCallback((y) => {
    const next = Math.min(maxScrollRef.current, Math.max(0, y));
    scrollYRef.current = next;
    setScrollY(next);
  }, []);

  const onMount = useCallback((id) => {
    nodeIdRef.current = id;
    registerScrollView(id, { onScroll, onAbsoluteScroll, getScrollY: () => scrollYRef.current });
  }, [onScroll, onAbsoluteScroll]);

  useEffect(() => {
    return () => {
      if (nodeIdRef.current !== null) unregisterScrollView(nodeIdRef.current);
    };
  }, []);

  // Build the visible slice.
  const visibleChildren = [];

  if (topSpacerH > 0) {
    visibleChildren.push(
      React.createElement(View, { key: '__vl_top', height: topSpacerH, width })
    );
  }

  for (let i = firstVisible; i < lastVisible; i++) {
    const item = data[i];
    const key  = keyExtractor ? keyExtractor(item, i) : String(i);
    visibleChildren.push(
      React.createElement(
        View,
        { key, height: itemHeight, width },
        renderItem({ item, index: i })
      )
    );
  }

  if (bottomSpacerH > 0) {
    visibleChildren.push(
      React.createElement(View, { key: '__vl_bot', height: bottomSpacerH, width })
    );
  }

  const viewStyle = {
    justifyContent: 'flex-start',
    alignItems:     'flex-start',
    clip:           true,
    scrollOffsetY:  scrollY,
    showScrollbar,
    scrollbarWidth,
    scrollbarColor,
    scrollContentH: totalContentH,
    ...flattenStyle(style),
  };

  return React.createElement(
    'view',
    { _glyxOnMount: onMount, style: viewStyle, width, height, ...props },
    ...visibleChildren,
  );
}

// ── Responsive layout hooks ───────────────────────────────────────────────────

/**
 * Returns the current window size in physical pixels, updating on resize.
 * @returns {{ width: number, height: number }}
 */
export function useWindowSize() {
  const [size, setSize] = useState(() => {
    const s = typeof __glyx_getWindowSize !== 'undefined' ? __glyx_getWindowSize() : null;
    return s ? { width: s.width, height: s.height } : { width: 0, height: 0 };
  });

  useEffect(() => {
    const handler = (s) => setSize(s);
    addWindowSizeListener(handler);
    return () => removeWindowSizeListener(handler);
  }, []);

  return size;
}

/**
 * Returns the current monitor size in physical pixels (read-once, does not update).
 * @returns {{ width: number, height: number }}
 */
export function useScreenSize() {
  const [size] = useState(() => {
    const s = typeof __glyx_getScreenSize !== 'undefined' ? __glyx_getScreenSize() : null;
    return s ? { width: s.width, height: s.height } : { width: 0, height: 0 };
  });
  return size;
}

/**
 * Returns true when the window width is at least `minWidth` pixels.
 * Equivalent to CSS `@media (min-width: Xpx)`.
 * @param {number} minWidth
 * @returns {boolean}
 */
export function useMediaQuery(minWidth) {
  const { width } = useWindowSize();
  return width >= minWidth;
}

// ── Window imperative API ─────────────────────────────────────────────────────
//
// glyxWindow is defined and exported from api.js.
// It is imported here for use by WindowControls and SelectableText.

// ── Secure env access ─────────────────────────────────────────────────────────
//
// Reads a single environment variable by name.
// Returns null if the name is not in the `env.allow` capability list, or if
// the variable does not exist in the process environment.
// `process.env` is not available — only explicitly allowed names are readable.

/**
 * Read a single environment variable declared in `glyx.config.json`.
 * @param {string} name — The variable name (e.g. `"API_KEY"`).
 * @returns {string | null}
 */
export function getEnv(name) {
  return typeof __glyx_getEnv !== 'undefined' ? __glyx_getEnv(name) : null;
}

/**
 * Measure shaped text. Returns `{ width, height }` in logical pixels.
 * `maxWidth` wraps the text; omit (or pass Infinity) for single-line width.
 * Used for table column auto-sizing, rich-text layout, truncation, etc.
 */
export function measureText(text, fontSize = 14, maxWidth = Infinity) {
  if (typeof __glyx_measure_text === 'undefined') {
    return { width: String(text).length * fontSize * 0.55, height: fontSize * 1.3 };
  }
  return __glyx_measure_text(String(text), fontSize, Number.isFinite(maxWidth) ? maxWidth : 1e6);
}

// ── SelectableText ────────────────────────────────────────────────────────────
//
// User-selectable text with pointer-driven selection and Ctrl/Cmd+C copy.
//
// Usage:
//   <SelectableText fontSize={16} color="#fff">Hello world</SelectableText>
//
// Disable for a subtree:
//   <SelectionArea enabled={false}><ReadOnlyPanel /></SelectionArea>
//
// Disable one element inside an enabled area:
//   <SelectableText selectable={false}>not copyable</SelectableText>

const _SelectionCtx = createContext(true);

export function SelectionArea({ enabled = true, children }) {
  return React.createElement(_SelectionCtx.Provider, { value: enabled }, children);
}

export function SelectableText({
  children,
  style,
  selectable: selectableProp,
  fontSize = 16,
  color,
  textAlign,
  numberOfLines,
  ...rest
}) {
  const areaEnabled    = useContext(_SelectionCtx);
  const isSelectable   = selectableProp !== undefined ? selectableProp : areaEnabled;

  const text = typeof children === 'string' ? children
             : Array.isArray(children) ? children.join('') : String(children ?? '');

  const viewNodeIdRef  = useRef(null);
  const textNodeIdRef  = useRef(null);
  const dragAnchor  = useRef(null);
  const [selStart, setSelStart] = useState(null);
  const [selEnd,   setSelEnd]   = useState(null);

  // The inner Text node's shaping/placement props — spread into the Text
  // element below AND passed to the native hit-test, so a click resolves
  // with exactly what was rendered (see glyx-runtime's `text_props`).
  const textHitProps = { fontSize, textAlign };

  // Stale-closure refs so event callbacks always see current values.
  const isSelectableRef = useRef(isSelectable);
  const textRef         = useRef({ text, textHitProps, selStart, selEnd });
  useEffect(() => {
    isSelectableRef.current = isSelectable;
    textRef.current         = { text, textHitProps, selStart, selEnd };
  });

  // Convert window-absolute (x, y) → character index.
  //
  // Measured from the inner TEXT node (where the glyphs render, not the
  // wrapper View), using its UNCLIPPED box (`boxX/boxY`) so a SelectableText
  // half-scrolled out of a ScrollView still maps clicks to the right line.
  // One native call then shapes + places the text exactly like the renderer
  // (wrap width, alignment, vertical centering), so drag-selection spans
  // soft-wrapped lines and clicks on centered/right text hit the glyph drawn.
  function charAtAbsXY(absX, absY) {
    const id = textNodeIdRef.current;
    if (id === null || typeof __glyx_getLayout === 'undefined') return 0;
    const layout = __glyx_getLayout(id);
    if (!layout) return 0;
    const { text: t, textHitProps: props } = textRef.current;
    const localX = absX - (layout.boxX ?? layout.x);
    const localY = absY - (layout.boxY ?? layout.y);
    if (typeof __glyx_text_pos_at !== 'undefined') {
      return __glyx_text_pos_at(t, localX, localY, {
        ...props,
        boxWidth:  layout.boxWidth  ?? layout.width,
        boxHeight: layout.boxHeight ?? layout.height,
      }) | 0;
    }
    // Fallback (older runtime): single-line x-only approximation.
    return (typeof __glyx_text_char_at_x !== 'undefined')
      ? __glyx_text_char_at_x(t, props.fontSize, 1e6, Math.max(0, localX)) | 0
      : 0;
  }

  // Mount: register both drag and pressable handlers once.
  const _glyxOnMount = useCallback((id) => {
    viewNodeIdRef.current = id;

    registerDraggable(id, {
      onDragStart({ x, y }) {
        if (!isSelectableRef.current) return;
        const idx = charAtAbsXY(x, y);
        dragAnchor.current = idx;
        setSelStart(idx);
        setSelEnd(idx);
      },
      onDragMove({ x, y }) {
        if (!isSelectableRef.current) return;
        const idx    = charAtAbsXY(x, y);
        const anchor = dragAnchor.current ?? idx;
        setSelStart(Math.min(anchor, idx));
        setSelEnd(Math.max(anchor, idx));
      },
      onDragEnd() { dragAnchor.current = null; },
    });

    registerPressable(id, {
      onPress({ x, y }) {
        if (!isSelectableRef.current) return;
        const idx = charAtAbsXY(x, y);
        setSelStart(idx);
        setSelEnd(idx);
      },
      onPressIn() {}, onPressOut() {}, onHoverIn() {}, onHoverOut() {},
    });
  }, []); // No deps — reads from refs at call time.

  // Capture the inner TEXT node id too — hit-testing must measure the node
  // that actually renders the glyphs (its resolved width is what render.rs
  // uses for the alignment shift), not the wrapper View.
  const _textOnMount = useCallback((id) => {
    textNodeIdRef.current = id;
  }, []);

  // Ctrl/Cmd+C: copy selected text to clipboard.
  useEffect(() => {
    if (!isSelectable) return;
    const combo = typeof navigator !== 'undefined' && /mac/i.test(navigator.platform ?? '')
      ? 'meta+c' : 'ctrl+c';
    const stop = input.shortcut(combo, () => {
      const { text: t, selStart: ss, selEnd: se } = textRef.current;
      if (ss !== null && se !== null && se > ss) {
        const selected = Array.from(t).slice(ss, se).join('');
        clipboard.writeText(selected);
      }
    });
    return stop;
  }, [isSelectable]);

  const hasSelection = selStart !== null && selEnd !== null && selEnd > selStart;

  return React.createElement(
    View,
    { _glyxOnMount, style, ...rest },
    React.createElement(
      Text,
      {
        _glyxOnMount: _textOnMount,
        ...textHitProps,
        color,
        numberOfLines,
        selectionStart: hasSelection ? selStart : undefined,
        selectionEnd:   hasSelection ? selEnd   : undefined,
      },
      children
    )
  );
}

// ── WindowControls ────────────────────────────────────────────────────────────
//
// A ready-made minimize / maximize-or-restore / close button row for custom
// title bars (`window.decorations: false` in glyx.config.json).
//
// Usage:
//   import { WindowControls } from '@glyx-dev/react';
//   <View glyxDraggable style={styles.titleBar}>
//     <Text style={styles.title}>My App</Text>
//     <WindowControls />
//   </View>
//
// Platform-aware button order:
//   macOS   → traffic-light order on the LEFT side  (close · minimize · maximize)
//   Windows / Linux → standard order on the RIGHT side (minimize · maximize · close)

// macOS traffic-light: colored circle + tiny glyph
const _wc_mac = (label, onPress, bg) =>
  React.createElement(Pressable, {
    onPress,
    style: {
      width: 14, height: 14, borderRadius: 7,
      backgroundColor: bg,
      justifyContent: 'center', alignItems: 'center',
    },
  }, React.createElement(Text, { style: { fontSize: 8, color: '#00000088' } }, label));

// Windows/Linux: no background, icon-only, highlight on hover
function _WcWin({ label, onPress, isClose }) {
  const [hov, setHov] = React.useState(false);
  return React.createElement(Pressable, {
    onPress,
    feedback: false,
    onHoverIn:  () => setHov(true),
    onHoverOut: () => setHov(false),
    style: {
      width: 46, height: 40,
      justifyContent: 'center', alignItems: 'center',
      backgroundColor: hov ? (isClose ? '#c42b1c' : 'rgba(0,0,0,0.08)') : 'transparent',
    },
  }, React.createElement(Text, {
    style: { fontSize: 11, color: (hov && isClose) ? '#ffffff' : '#000000' },
  }, label));
}

export function WindowControls({ style } = {}) {
  const [maximized, setMaximized] = React.useState(() => glyxWindow.isMaximized());

  const minimize = () => glyxWindow.setMinimized();
  const toggleMax = () => {
    if (glyxWindow.isMaximized()) {
      glyxWindow.setMaximized(false);
      setMaximized(false);
    } else {
      glyxWindow.setMaximized(true);
      setMaximized(true);
    }
  };
  const close = () => glyxWindow.close();

  const isMac = glyxWindow.platform() === 'macos';

  if (isMac) {
    const buttons = [
      _wc_mac('✕', close,      '#ff5f57'),
      _wc_mac('−', minimize,   '#febc2e'),
      _wc_mac(maximized ? '⊡' : '⊞', toggleMax, '#28c840'),
    ];
    return React.createElement(View, {
      style: { flexDirection: 'row', gap: 6, alignItems: 'center', marginLeft: 8, ...flattenStyle(style) },
    }, ...buttons);
  }

  // Windows / Linux: icon-only buttons, no gap (touch), close on far right
  return React.createElement(View, {
    style: { flexDirection: 'row', alignItems: 'center', ...flattenStyle(style) },
  },
    React.createElement(_WcWin, { label: '─', onPress: minimize }),
    React.createElement(_WcWin, { label: maximized ? '❐' : '☐', onPress: toggleMax }),
    React.createElement(_WcWin, { label: '✕', onPress: close, isClose: true }),
  );
}
