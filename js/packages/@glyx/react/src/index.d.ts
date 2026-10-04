import * as React from 'react';

// ── Style prop ────────────────────────────────────────────────────────────────

/** A style, `false`/`null`/`undefined` (skipped), or a nested array of those. Later entries win. */
export type StyleProp = GlyxStyle | false | null | undefined | readonly StyleProp[];

/** Merge a style or array of styles into one object. */
export function flattenStyle(style: StyleProp): GlyxStyle | undefined;

export const StyleSheet: {
  /** Returns `styles` unchanged; define styles once, outside render, with their keys type-checked. */
  create<T extends { [name: string]: GlyxStyle }>(styles: T): T;
  flatten: typeof flattenStyle;
  compose(a: StyleProp, b: StyleProp): StyleProp;
  readonly absoluteFill: GlyxStyle;
};

/** A length: pixels as a number, or a percentage of the parent such as `'50%'`. */
export type GlyxLength = number | `${number}%`;

/**
 * Every style key the runtime reads. Lengths take pixels or a percentage;
 * anything not listed here is ignored.
 */
export interface GlyxStyle {
  // Size
  width?:            GlyxLength;
  height?:           GlyxLength;
  minWidth?:         GlyxLength;
  minHeight?:        GlyxLength;
  maxWidth?:         GlyxLength;
  maxHeight?:        GlyxLength;
  boxSizing?:        'border-box' | 'content-box';

  // Spacing
  margin?:           GlyxLength;
  marginHorizontal?: GlyxLength;
  marginVertical?:   GlyxLength;
  marginTop?:        GlyxLength;
  marginRight?:      GlyxLength;
  marginBottom?:     GlyxLength;
  marginLeft?:       GlyxLength;
  padding?:          GlyxLength;
  paddingHorizontal?: GlyxLength;
  paddingVertical?:  GlyxLength;
  paddingTop?:       GlyxLength;
  paddingRight?:     GlyxLength;
  paddingBottom?:    GlyxLength;
  paddingLeft?:      GlyxLength;
  gap?:              GlyxLength;

  // Flex layout
  display?:          'flex' | 'grid' | 'none';
  flex?:             number;
  flexGrow?:         number;
  flexShrink?:       number;
  flexBasis?:        GlyxLength;
  flexDirection?:    'row' | 'column' | 'row-reverse' | 'column-reverse';
  flexWrap?:         'nowrap' | 'wrap' | 'wrap-reverse';
  justifyContent?:   'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around' | 'space-evenly';
  alignItems?:       'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  alignSelf?:        'auto' | 'flex-start' | 'center' | 'flex-end' | 'stretch' | 'baseline';
  alignContent?:     'flex-start' | 'center' | 'flex-end' | 'stretch' | 'space-between' | 'space-around' | 'space-evenly';
  justifySelf?:      'flex-start' | 'center' | 'flex-end' | 'stretch';
  justifyItems?:     'flex-start' | 'center' | 'flex-end' | 'stretch';

  // Grid layout (with display: 'grid')
  gridTemplateColumns?: string;
  gridTemplateRows?:    string;
  gridColumn?:       string;
  gridRow?:          string;

  // Position
  position?:         'relative' | 'absolute';
  top?:              GlyxLength;
  right?:            GlyxLength;
  bottom?:           GlyxLength;
  left?:             GlyxLength;
  zIndex?:           number;

  // Overflow and scrolling
  overflow?:         'visible' | 'hidden' | 'scroll';
  clip?:             boolean;
  scrollOffsetY?:    number;
  scrollbarWidth?:   number;
  scrollbarColor?:   string;

  // Appearance
  backgroundColor?:  string;
  backgroundGradient?: string;
  opacity?:          number;
  borderRadius?:     number;
  borderWidth?:      number;
  borderColor?:      string;
  boxShadow?:        string;   // 'x y blur colour', e.g. '0 2 4 #00000044'
  transform?:        string;

  // Text
  color?:            string;
  fontSize?:         number;
  fontWeight?:       'normal' | 'bold' | `${number}`;
  fontStyle?:        'normal' | 'italic';
  lineHeight?:       number;
  textAlign?:        'left' | 'center' | 'right';
  textDecorationLine?: 'none' | 'underline';

  // Input
  pointerEvents?:    'auto' | 'none';
}

// ── Host components ───────────────────────────────────────────────────────────

export interface ViewProps {
  style?:    StyleProp;
  width?:    number;
  height?:   number;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export interface TextProps {
  style?:      StyleProp;
  fontSize?:   number;
  width?:      number;
  height?:     number;
  showCursor?: boolean;
  textAlign?:  'left' | 'center';
  children?:   React.ReactNode;
}

export interface ImageProps {
  src:         string;
  width?:      number;
  height?:     number;
  resizeMode?: 'cover' | 'contain' | 'stretch';
  style?:      StyleProp;
}

/** Properties a `transition` can animate (`'all'` for every one). Default: opacity only. */
export type TransitionProperty = 'opacity' | 'transform' | 'backgroundColor' | 'borderColor' | 'borderRadius' | 'boxShadow';

/** Animate a style change instead of snapping: a timed, eased tween, or a spring. */
export type TransitionConfig =
  | { duration: number; easing?: string; properties?: 'all' | TransitionProperty[] }
  | { spring: true | { stiffness?: number; damping?: number }; properties?: 'all' | TransitionProperty[] };

export interface PressableProps {
  onPress?:    () => void;
  onPressIn?:  () => void;
  onPressOut?: () => void;
  onHoverIn?:  () => void;
  onHoverOut?: () => void;
  /** Hover/press/focus changes ease on a spring by default; `false` snaps like before. */
  transition?: false | TransitionConfig;
  style?:      StyleProp;
  width?:      number;
  height?:     number;
  children?:   React.ReactNode;
}

export interface ScrollViewProps {
  style?:          StyleProp;
  width?:          number;
  height?:         number;
  contentHeight?:  number;
  /** Ease wheel and keyboard scrolling on a spring (default `true`). Scrollbar drags and touchpads are never eased. */
  smoothScroll?:   boolean;
  children?:       React.ReactNode;
}

export interface TextInputProps {
  value?:           string;
  onChangeText?:    (text: string) => void;
  /** Called when Enter is pressed in a single-line field. */
  onSubmitEditing?: (text: string) => void;
  placeholder?:     string;
  fontSize?:        number;
  multiline?:       boolean;
  width?:           number;
  /** Explicit height. Multiline default: auto-sized between minLines/maxLines. */
  height?:          number;
  /** Hard character limit — insertions beyond it are truncated. */
  maxLength?:       number;
  /** Multiline auto-height floor in lines (default 3). */
  minLines?:        number;
  /** Multiline auto-height ceiling in lines (default 10); grows with content between the two. */
  maxLines?:        number;
  /** Mask every character (password entry). */
  secureTextEntry?: boolean;
  /** Input filter: 'numeric' = integers, 'decimal' = numbers with one dot. */
  keyboardType?:    'default' | 'numeric' | 'decimal';
  style?:           StyleProp;
}

export declare const View:       React.FC<ViewProps>;
export declare const Text:       React.FC<TextProps>;
export declare const Image:      React.FC<ImageProps>;
export declare const Pressable:  React.FC<PressableProps>;
export declare const ScrollView: React.FC<ScrollViewProps>;
export declare const TextInput:  React.FC<TextInputProps>;
/** Single-line TextInput with secureTextEntry forced on. */
export declare const PasswordInput: React.FC<Omit<TextInputProps, 'secureTextEntry' | 'multiline'>>;
/** Single-line TextInput accepting only numbers (keyboardType defaults to 'decimal'). */
export declare const NumericInput:  React.FC<Omit<TextInputProps, 'multiline'>>;

// ── Pickers (calendar/time float in the root popover layer) ──────────────────

export declare const DatePicker: React.FC<{
  value?: Date | string | null;
  onValueChange?: (d: Date) => void;
  disabled?: boolean;
  style?: StyleProp;
}>;

export declare const TimePicker: React.FC<{
  /** 24-hour 'HH:MM' string regardless of display format. */
  value?: string | null;
  onValueChange?: (hhmm: string) => void;
  /** Display format: false = '2:05 PM' (default), true = '14:05'. */
  use24Hour?: boolean;
  /** Minute column granularity (default 5). */
  minuteStep?: number;
  disabled?: boolean;
  style?: StyleProp;
}>;

export declare const DateTimePicker: React.FC<{
  value?: Date | string | null;
  onValueChange?: (d: Date) => void;
  use24Hour?: boolean;
  minuteStep?: number;
  disabled?: boolean;
  style?: StyleProp;
}>;

// ── WebView (native OS-embedded webview; requires the `webview` capability) ──

export interface WebViewRef {
  /** Native scene-graph node id once mounted, else null. */
  readonly nodeId: number | null;
  /** Send a message INTO the page — delivered as a `message` DOM event (`e.data`). */
  postMessage: (message: string) => void;
}

export interface WebViewProps {
  /** URL to load. Ignored if `html` is set. */
  src?:    string;
  /** Raw HTML to load in place of navigating to a URL. */
  html?:   string;
  /** Default true — disables devtools on the embedded webview. */
  sandbox?: boolean;
  /** Navigation allowlist (exact origins). Defaults to `src`'s own origin if unset. */
  allowedOrigins?: string[];
  /** Enables `glyx-asset://<path>` serving files under this directory (not raw `file://`). */
  assetsRoot?: string;
  /** Called when the page posts a message via `window.ipc.postMessage(str)`. */
  onMessage?: (message: string) => void;
  style?:  StyleProp;
  [key: string]: unknown;
}

/** Native OS-embedded webview (WebView2 / WKWebView / WebKitGTK), position-tracked like any other node. */
export declare const WebView: React.ForwardRefExoticComponent<
  WebViewProps & React.RefAttributes<WebViewRef>
>;

/** JS → page half of the postMessage bridge; prefer `WebViewRef.postMessage` when you have a ref. */
export declare const webview: {
  postMessage: (nodeId: number, message: string | object) => void;
};

export declare function render(element: React.ReactElement): void;

// ── Responsive hooks ──────────────────────────────────────────────────────────

/** Current window inner size in physical pixels. Updates on resize. */
export declare function useWindowSize(): { width: number; height: number };

/** Current monitor size in physical pixels (read-once). */
export declare function useScreenSize(): { width: number; height: number };

/** True when window width >= minWidth. Equivalent to CSS min-width media query. */
export declare function useMediaQuery(minWidth: number): boolean;

/** A wheel or trackpad event offered to a `useWheel` handler. `deltaY` is positive when scrolling down; `x` and `y` are relative to the view. */
export interface WheelEvent { deltaY: number; ctrl: boolean; shift: boolean; x: number; y: number }

/**
 * Offer wheel/trackpad scrolling over a view to `handler` before any `ScrollView` underneath.
 * Return `true` to consume the event; anything else lets the scroll through.
 * Returns an `_glyxOnMount` callback for the `View`.
 */
export declare function useWheel(handler: (e: WheelEvent) => boolean | void): (nodeId: number) => void;

// ── Secure env access ─────────────────────────────────────────────────────────

/**
 * Read a single environment variable declared under `capabilities.env.allow`
 * in `glyx.config.json`. Returns `null` if the name is not on the allowlist
 * or the variable is absent from the process environment.
 *
 * `process.env` is not available — only explicitly declared names are readable.
 *
 * @example
 * const key = getEnv('API_KEY'); // declared as "API_KEY" in env.allow
 */
export declare function getEnv(name: string): string | null;

// ── Window imperative API ─────────────────────────────────────────────────────

export type SystemWatchKind = 'battery' | 'memory' | 'darkMode' | 'batterySaver';

export declare const system: {
  getInfo(): Promise<{ cpuName: string; cpuCores: number; memoryTotalMb: number; memoryUsedMb: number; osName: string; osVersion: string } | null>;
  getDarkMode(): 'dark' | 'light' | 'unknown';
  isBatterySaverActive(): boolean;
  /**
   * Subscribe to a system metric. A Rust-side poller reads it on a timer and
   * fires `cb` ONLY when the value changes — no JS timers, V8 idles between
   * changes. Returns a watch id for `unwatch`.
   */
  watch(kind: 'battery',      cb: (v: { level: number; charging: boolean; timeRemainingSecs: number | null } | null) => void, opts?: { intervalMs?: number }): number;
  watch(kind: 'memory',       cb: (v: { usedMb: number; totalMb: number }) => void, opts?: { intervalMs?: number }): number;
  watch(kind: 'darkMode',     cb: (v: 'dark' | 'light' | 'unknown') => void, opts?: { intervalMs?: number }): number;
  watch(kind: 'batterySaver', cb: (v: boolean) => void, opts?: { intervalMs?: number }): number;
  unwatch(id: number): void;
};

export declare const glyxWindow: {
  /** Toggle game-style fullscreen (covers taskbar). */
  setFullscreen(full: boolean): void;
  /** Maximize (taskbar remains visible) or restore. */
  setMaximized(maximized: boolean): void;
  /** Minimize window to taskbar. */
  setMinimized(): void;
  /** Whether the window is currently fullscreen. */
  isFullscreen(): boolean;
  /** Whether the window is currently maximized. */
  isMaximized(): boolean;
  /** Current window inner size in physical pixels. */
  getWindowSize(): { width: number; height: number };
  /** Current monitor size in physical pixels. */
  getScreenSize(): { width: number; height: number };
  /** Set the mouse cursor icon (CSS-like names). Unknown names → default arrow. */
  setCursor(name: 'default' | 'pointer' | 'text' | 'move' | 'grab' | 'grabbing'
                | 'col-resize' | 'row-resize' | 'ew-resize' | 'ns-resize'
                | 'crosshair' | 'not-allowed' | 'wait'): void;
  /**
   * Open a secondary (child) window.  Resolves with a handle whose `send()`
   * posts IPC messages to it.
   *
   * Duplicate prevention: with `window.preventDuplicateWindows` enabled in
   * glyx.config.ts, creating a window whose `title` matches one already open
   * focuses the existing window and resolves with ITS handle instead of
   * opening a twin.  `allowDuplicate: true` bypasses that; an explicit `key`
   * dedupes on the key regardless of the config flag.  Windows with distinct
   * titles/keys are never deduped.
   */
  create(opts?: {
    title?: string;
    width?: number;
    height?: number;
    /** Explicit dedupe key — at most one window per key. */
    key?: string;
    /** Opt out of config-level title dedupe for this call. */
    allowDuplicate?: boolean;
  }): Promise<{ readonly id: number; send(msg: unknown): void }>;
  /** Quit the application — closes all windows. */
  quit(): void;
  /** Quit then relaunch the same executable. */
  restart(): void;
  /** Close this window. */
  close(): void;
};

// ── System tray ─────────────────────────────────────────────────────────────

export interface TrayMenuItem {
  id: string;
  label: string;
  enabled?: boolean;
  checked?: boolean;
  separator?: boolean;
  accelerator?: string;
  children?: TrayMenuItem[];
}

export type TrayEvent =
  | { Click: { tray_id: number } }
  | { DoubleClick: { tray_id: number } }
  | { MenuItemClick: { tray_id: number; item_id: string } };

export interface TrayHandle {
  readonly id: number;
}

/** A tray icon or tray menu event. */
export type TrayEvent =
  | { Click: { tray_id: number } }
  | { DoubleClick: { tray_id: number } }
  | { MenuItemClick: { tray_id: number; item_id: string } };

/** System tray icon API (requires `tray: true` capability). */
export const tray: {
  /**
   * Create a system tray icon from raw RGBA pixel data, or pass `null` to use the app's own
   * icon (the `icon` in glyx.config, else the Glyx default). `width` and `height` are then ignored.
   * @returns A handle (0 on failure).
   * @example
   * const icon = ... // RGBA bytes from an <img> canvas
   * const id = tray.create(iconBytes, 32, 32, 'My App', [
   *   { id: 'play', label: 'Play/Pause' },
   *   { id: '', separator: true },
   *   { id: 'quit', label: 'Quit' },
   * ]);
   */
  create(rgba: ArrayBuffer | null, width: number, height: number, tooltip: string, menu?: TrayMenuItem[]): number;

  /** Destroy a tray icon. */
  destroy(trayId: number): boolean;

  /** Update the tray menu. */
  updateMenu(trayId: number, menu: TrayMenuItem[]): boolean;

  /** Update the tooltip text. */
  setTooltip(trayId: number, tooltip: string): void;

  /**
   * Called for every tray event, pushed as it happens (no polling). While anything is subscribed,
   * events come here and `pollEvents` stays empty. Returns an unsubscribe function.
   */
  onEvent(handler: (ev: TrayEvent) => void): () => void;

  /** Poll for pending tray events (menu clicks, double-clicks) as a JSON array. Prefer `onEvent`. */
  pollEvents(): string;
};

// ── Menu bar ──────────────────────────────────────────────────────────────────

/** One entry of an application menu. Separators have only `separator: true`. */
export interface MenuItem {
  /** Required on every item that does something. Unique across the whole bar. */
  id?:          string;
  /** Text shown. `&` before a letter marks its mnemonic (`'&File'`). */
  label?:       string;
  /** Default true. */
  enabled?:     boolean;
  /**
   * A ready-made editing item acting on the focused text field: `{ role: 'copy' }` is "Copy" with
   * Ctrl+C shown. It needs no `id` or `label` (the id is `'role:copy'`). Undo and redo are not
   * offered because text fields have no undo yet.
   */
  role?:        'copy' | 'cut' | 'paste' | 'selectAll';
  /** Present (true or false) makes the item checkable. */
  checked?:     boolean;
  /** A key combination such as `'Ctrl+N'` or `'CmdOrCtrl+Shift+S'`. Shown in the menu and triggered by Glyx, with Ctrl, Shift, Alt and Super. */
  accelerator?: string;
  separator?:   boolean;
  /** Makes this a submenu. At the top level every entry must have it. */
  children?:    MenuItem[];
}

export interface MenuBarProps {
  /** The menu description, the same shape `menubar.set` takes. */
  items: MenuItem[];
  /** Called with `{ id, checked? }` when an item is chosen by mouse, keyboard or accelerator. */
  onSelect?: (ev: { id: string; checked?: boolean; role?: string }) => void;
  /** Use the native menu bar where one exists (Windows) and draw this one everywhere else. Default false. */
  native?: boolean;
  /** Override the colours: bar, panel, border, text, muted, disabled, hover, accent. */
  colors?: Partial<Record<'bar' | 'panel' | 'border' | 'text' | 'muted' | 'disabled' | 'hover' | 'accent', string>>;
  style?: StyleProp;
}

/**
 * A menu bar drawn by Glyx itself, for Linux and for frameless windows. Open a menu with the
 * mouse or Alt+letter (the letter after `&` in a label), move with the arrow keys, choose with
 * Enter, close with Escape. Accelerators work with or without a menu open.
 */
export const MenuBar: React.FC<MenuBarProps>;

/** Native window menu bar (requires `menubar: true`). Windows only for now. */
export const menubar: {
  /** True when this platform can show a native menu bar. */
  readonly supported: boolean;
  /** Replace the window's menu bar. Throws when the menu is invalid, the capability is missing, or the platform cannot show one. */
  set(menu: MenuItem[]): void;
  /** Remove the menu bar. */
  clear(): void;
  /** Returns false when there is no such item. */
  setEnabled(id: string, enabled: boolean): boolean;
  /** Returns false when there is no such checkable item. */
  setChecked(id: string, checked: boolean): boolean;
  /** Called when an item is chosen by mouse, keyboard or accelerator. Returns an unsubscribe function. */
  onSelect(handler: (ev: { id: string; checked?: boolean; role?: string }) => void): () => void;
};
