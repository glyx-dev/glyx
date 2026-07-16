import * as React from 'react';

// ── Style prop ────────────────────────────────────────────────────────────────

export interface GlyxStyle {
  backgroundColor?:  string;
  color?:            string;
  borderRadius?:     number;
  borderWidth?:      number;
  borderColor?:      string;
  flex?:             number;
  flexDirection?:    'row' | 'column';
  justifyContent?:   'flex-start' | 'center' | 'flex-end' | 'space-between' | 'space-around';
  alignItems?:       'flex-start' | 'center' | 'flex-end' | 'stretch';
  padding?:          number;
  gap?:              number;
  clip?:             boolean;
  scrollOffsetY?:    number;
  textAlign?:        'left' | 'center';
}

// ── Host components ───────────────────────────────────────────────────────────

export interface ViewProps {
  style?:    GlyxStyle;
  width?:    number;
  height?:   number;
  children?: React.ReactNode;
  [key: string]: unknown;
}

export interface TextProps {
  style?:      GlyxStyle;
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
  style?:      GlyxStyle;
}

export interface PressableProps {
  onPress?:    () => void;
  onPressIn?:  () => void;
  onPressOut?: () => void;
  onHoverIn?:  () => void;
  onHoverOut?: () => void;
  style?:      GlyxStyle;
  width?:      number;
  height?:     number;
  children?:   React.ReactNode;
}

export interface ScrollViewProps {
  style?:          GlyxStyle;
  width?:          number;
  height?:         number;
  contentHeight?:  number;
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
  style?:           GlyxStyle;
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
  style?: GlyxStyle;
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
  style?: GlyxStyle;
}>;

export declare const DateTimePicker: React.FC<{
  value?: Date | string | null;
  onValueChange?: (d: Date) => void;
  use24Hour?: boolean;
  minuteStep?: number;
  disabled?: boolean;
  style?: GlyxStyle;
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
  style?:  GlyxStyle;
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

/** System tray icon API (requires `tray: true` capability). */
export const tray: {
  /**
   * Create a system tray icon from raw RGBA pixel data.
   * @returns A handle (0 on failure).
   * @example
   * const icon = ... // RGBA bytes from an <img> canvas
   * const id = tray.create(iconBytes, 32, 32, 'My App', [
   *   { id: 'play', label: 'Play/Pause' },
   *   { id: '', separator: true },
   *   { id: 'quit', label: 'Quit' },
   * ]);
   */
  create(rgba: ArrayBuffer, width: number, height: number, tooltip: string, menu?: TrayMenuItem[]): number;

  /** Destroy a tray icon. */
  destroy(trayId: number): boolean;

  /** Update the tray menu. */
  updateMenu(trayId: number, menu: TrayMenuItem[]): boolean;

  /** Update the tooltip text. */
  setTooltip(trayId: number, tooltip: string): void;

  /** Poll for pending tray events (menu clicks, double-clicks). Call each frame. Returns JSON array. */
  pollEvents(): string;
};
