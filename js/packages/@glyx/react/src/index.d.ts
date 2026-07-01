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
  value?:        string;
  onChangeText?: (text: string) => void;
  placeholder?:  string;
  fontSize?:     number;
  multiline?:    boolean;
  width?:        number;
  height?:       number;
  style?:        GlyxStyle;
}

export declare const View:       React.FC<ViewProps>;
export declare const Text:       React.FC<TextProps>;
export declare const Image:      React.FC<ImageProps>;
export declare const Pressable:  React.FC<PressableProps>;
export declare const ScrollView: React.FC<ScrollViewProps>;
export declare const TextInput:  React.FC<TextInputProps>;

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
};
