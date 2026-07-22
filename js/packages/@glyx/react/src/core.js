import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import {
  registerPressable, unregisterPressable,
  registerScrollView, unregisterScrollView,
  registerDraggable, unregisterDraggable,
  registerDisabledNode, unregisterDisabledNode,
  addWindowSizeListener, removeWindowSizeListener,
  addGlobalClickListener, removeGlobalClickListener,
  registerImageError, unregisterImageError,
} from './events.js';
import { glyxWindow, clipboard, input } from './api.js';

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

export function Text({ children, style, showCursor, ...props }) {
  // Flatten mixed children (strings + expressions) to a single string,
  // matching browser behaviour where <Text>= {val}</Text> just works.
  const text = Array.isArray(children)
    ? children.map(c => (c == null ? '' : String(c))).join('')
    : (children == null ? '' : String(children));
  return React.createElement('text', { text, style, showCursor, ...props });
}

export function Image({ src, width = 120, height = 120, resizeMode = 'stretch', onError, style, ...props }) {
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

export function Pressable({ children, onPress, onRightPress, onPressIn, onPressOut, onHoverIn, onHoverOut, disabled, feedback = true, style, _glyxOnMount: externalOnMount, ...props }) {
  const nodeIdRef    = useRef(null);
  const handlersRef  = useRef(null);
  const [pressed, setPressed] = useState(false);
  const [hovered, setHovered] = useState(false);

  // Always keep handlersRef up to date with the latest prop values.
  handlersRef.current = {
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
      if (typeof __glyx_setFocus !== 'undefined' && nodeIdRef.current != null) {
        __glyx_setFocus(nodeIdRef.current);
      }
      onPress?.(e);
    },
    onRightPress: (e) => onRightPress?.(e),
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
      onPress:      (e) => handlersRef.current.onPress(e),
      onRightPress: (e) => handlersRef.current.onRightPress(e),
      onPressIn:  () => handlersRef.current.onPressIn(),
      onPressOut: () => handlersRef.current.onPressOut(),
      onHoverIn:  () => handlersRef.current.onHoverIn(),
      onHoverOut: () => handlersRef.current.onHoverOut(),
    });
    registerDisabledNode(id, !!disabled);
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
  const resolvedStyle = styleIsFn ? style({ pressed, hovered }) : style;
  const baseOpacity = resolvedStyle?.opacity ?? 1;
  const mergedStyle = (!styleIsFn && feedback && pressed && !disabled)
    ? { ...resolvedStyle, opacity: baseOpacity * 0.65 }
    : (!styleIsFn && feedback && hovered && !disabled)
    ? { ...resolvedStyle, opacity: baseOpacity * 0.85 }
    : resolvedStyle;

  return React.createElement(
    'view',
    // pressable:true tells the Rust drag-check that this node is interactive,
    // so glyxDraggable regions skip the window drag when this is under cursor.
    { _glyxOnMount: onMount, style: mergedStyle, pressable: true, ...props },
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
  height,               // layout height — only set if you need a fixed height
  contentHeight,        // explicit content height override (more reliable than auto-detect)
  showScrollbar   = true,
  scrollbarWidth  = 8,
  scrollbarColor  = '#8c8caa99',
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
      maxScrollRef.current = Math.max(0, l.contentHeight - l.height);
    }
  }, []);

  const onScroll = useCallback((deltaY) => {
    refreshMaxScroll();
    setScrollY((prev) => {
      const max = maxScrollRef.current;
      return Math.min(max, Math.max(0, prev + deltaY));
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onAbsoluteScroll = useCallback((y) => {
    refreshMaxScroll();
    setScrollY(Math.min(maxScrollRef.current, Math.max(0, y)));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const onMount = useCallback((id) => {
    nodeIdRef.current = id;
    registerScrollView(id, { onScroll, onAbsoluteScroll });
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
    // Scrollbar visual props
    showScrollbar,
    scrollbarWidth,
    scrollbarColor,
    ...style,
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

  const totalItems    = data ? data.length : 0;
  const totalContentH = totalItems * itemHeight;

  // Keep maxScroll current without re-registering the scroll handler.
  maxScrollRef.current = Math.max(0, totalContentH - height);

  // Visible window (item indices).
  const firstVisible = Math.max(0, Math.floor(scrollY / itemHeight) - overscan);
  const lastVisible  = Math.min(totalItems, Math.ceil((scrollY + height) / itemHeight) + overscan);

  const topSpacerH    = firstVisible * itemHeight;
  const bottomSpacerH = Math.max(0, (totalItems - lastVisible) * itemHeight);

  // Stable handlers — never re-registered between renders.
  const onScroll = useCallback((deltaY) => {
    setScrollY((prev) => Math.min(maxScrollRef.current, Math.max(0, prev + deltaY)));
  }, []);

  const onAbsoluteScroll = useCallback((y) => {
    setScrollY(Math.min(maxScrollRef.current, Math.max(0, y)));
  }, []);

  const onMount = useCallback((id) => {
    nodeIdRef.current = id;
    registerScrollView(id, { onScroll, onAbsoluteScroll });
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
    ...style,
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

  const nodeIdRef   = useRef(null);
  const dragAnchor  = useRef(null);
  const [selStart, setSelStart] = useState(null);
  const [selEnd,   setSelEnd]   = useState(null);

  // Stale-closure refs so event callbacks always see current values.
  const isSelectableRef = useRef(isSelectable);
  const textRef         = useRef({ text, fontSize, selStart, selEnd });
  useEffect(() => {
    isSelectableRef.current = isSelectable;
    textRef.current         = { text, fontSize, selStart, selEnd };
  });

  // Convert window-absolute x → character index.
  function charAtAbsX(absX) {
    if (typeof __glyx_text_char_at_x === 'undefined') return 0;
    const id = nodeIdRef.current;
    if (id === null) return 0;
    const layout = __glyx_getLayout(id);
    const localX = Math.max(0, absX - (layout ? layout.x : 0));
    const { text: t, fontSize: fs } = textRef.current;
    return __glyx_text_char_at_x(t, fs, 1e6, localX) | 0;
  }

  // Mount: register both drag and pressable handlers once.
  const _veloxOnMount = useCallback((id) => {
    nodeIdRef.current = id;

    registerDraggable(id, {
      onDragStart({ x }) {
        if (!isSelectableRef.current) return;
        const idx = charAtAbsX(x);
        dragAnchor.current = idx;
        setSelStart(idx);
        setSelEnd(idx);
      },
      onDragMove({ x }) {
        if (!isSelectableRef.current) return;
        const idx    = charAtAbsX(x);
        const anchor = dragAnchor.current ?? idx;
        setSelStart(Math.min(anchor, idx));
        setSelEnd(Math.max(anchor, idx));
      },
      onDragEnd() { dragAnchor.current = null; },
    });

    registerPressable(id, {
      onPress({ x }) {
        if (!isSelectableRef.current) return;
        const idx = charAtAbsX(x);
        setSelStart(idx);
        setSelEnd(idx);
      },
      onPressIn() {}, onPressOut() {}, onHoverIn() {}, onHoverOut() {},
    });
  }, []); // No deps — reads from refs at call time.

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
    { _veloxOnMount, style, ...rest },
    React.createElement(
      Text,
      {
        fontSize,
        color,
        textAlign,
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
      style: { flexDirection: 'row', gap: 6, alignItems: 'center', marginLeft: 8, ...style },
    }, ...buttons);
  }

  // Windows / Linux: icon-only buttons, no gap (touch), close on far right
  return React.createElement(View, {
    style: { flexDirection: 'row', alignItems: 'center', ...style },
  },
    React.createElement(_WcWin, { label: '─', onPress: minimize }),
    React.createElement(_WcWin, { label: maximized ? '❐' : '☐', onPress: toggleMax }),
    React.createElement(_WcWin, { label: '✕', onPress: close, isClose: true }),
  );
}
