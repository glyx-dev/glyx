// @velox/design — TypeScript declarations
// Auto-generated — do not edit manually.

import type { ReactNode, CSSProperties } from 'react';

// ── Shared ────────────────────────────────────────────────────────────────────

type Style = Record<string, unknown>;

// ── Tokens ────────────────────────────────────────────────────────────────────

export interface DesignTokens {
  colors: Record<string, string>;
  space:  Record<string, number>;
  radius: Record<string, number>;
  fontSize:   Record<string, number>;
  fontWeight: Record<string, number>;
  lineHeight: Record<string, number>;
}

export declare const tokens:     DesignTokens;
export declare const darkTokens: DesignTokens;

// ── Theme ─────────────────────────────────────────────────────────────────────

export interface ThemeContextValue {
  tokens:      DesignTokens;
  colorScheme: 'light' | 'dark';
  toggle():    void;
}

export declare function ThemeProvider(props: {
  colorScheme?: 'light' | 'dark' | 'system';
  overrides?:   Partial<DesignTokens>;
  children:     ReactNode;
}): JSX.Element;

export declare function useTheme(): ThemeContextValue;

export declare function createTheme(
  base?:      'light' | 'dark',
  overrides?: Partial<DesignTokens>,
): DesignTokens;

// ── Components ────────────────────────────────────────────────────────────────

type ButtonVariant  = 'primary' | 'secondary' | 'ghost' | 'danger';
type BadgeVariant   = 'default' | 'success' | 'warning' | 'error' | 'info';
type AlertVariant   = 'info' | 'success' | 'warning' | 'error';

export declare function Button(props: {
  label:      string;
  onPress?:   () => void;
  variant?:   ButtonVariant;
  disabled?:  boolean;
  style?:     Style;
}): JSX.Element;

export declare function IconButton(props: {
  icon:       string;
  onPress?:   () => void;
  size?:      number;
  variant?:   ButtonVariant;
  disabled?:  boolean;
  label?:     string;
  style?:     Style;
}): JSX.Element;

export declare function Card(props: {
  children:  ReactNode;
  padding?:  number;
  style?:    Style;
}): JSX.Element;

export declare function Divider(props: {
  direction?: 'horizontal' | 'vertical';
  style?:     Style;
}): JSX.Element;

export declare function Label(props: {
  children:  ReactNode;
  size?:     'sm' | 'base' | 'lg';
  muted?:    boolean;
  bold?:     boolean;
  style?:    Style;
}): JSX.Element;

export declare function Heading(props: {
  children:  ReactNode;
  level?:    1 | 2 | 3 | 4;
  style?:    Style;
}): JSX.Element;

export declare function Badge(props: {
  label:    string;
  variant?: BadgeVariant;
  style?:   Style;
}): JSX.Element;

// ── Form ──────────────────────────────────────────────────────────────────────

export declare function TextField(props: {
  label?:        string;
  value?:        string;
  onChangeText?: (text: string) => void;
  placeholder?:  string;
  helperText?:   string;
  error?:        string;
  disabled?:     boolean;
  secureEntry?:  boolean;
  icon?:         string;
  style?:        Style;
}): JSX.Element;

export declare function SwitchRow(props: {
  label:          string;
  value?:         boolean;
  onValueChange?: (v: boolean) => void;
  description?:   string;
  disabled?:      boolean;
  style?:         Style;
}): JSX.Element;

export declare function CheckboxRow(props: {
  label:       string;
  checked?:    boolean;
  onChange?:   (v: boolean) => void;
  description?: string;
  disabled?:   boolean;
  style?:      Style;
}): JSX.Element;

export declare function NumberInput(props: {
  value?:        number;
  onChangeValue?: (v: number) => void;
  min?:          number;
  max?:          number;
  step?:         number;
  label?:        string;
  disabled?:     boolean;
  style?:        Style;
}): JSX.Element;

export declare function SearchInput(props: {
  value?:        string;
  onChangeText?: (text: string) => void;
  placeholder?:  string;
  onClear?:      () => void;
  style?:        Style;
}): JSX.Element;

// ── Feedback ─────────────────────────────────────────────────────────────────

export declare function Alert(props: {
  variant?:  AlertVariant;
  title?:    string;
  message?:  string;
  onClose?:  () => void;
  style?:    Style;
}): JSX.Element;

export declare function ProgressBar(props: {
  value?:        number;   // 0–1; omit for indeterminate
  color?:        string;
  trackColor?:   string;
  height?:       number;
  borderRadius?: number;
  style?:        Style;
}): JSX.Element;

export declare function Spinner(props: {
  size?:   number;
  color?:  string;
  style?:  Style;
}): JSX.Element;

export declare function Skeleton(props: {
  width?:        number | string;
  height?:       number;
  borderRadius?: number;
  lines?:        number;
  gap?:          number;
  style?:        Style;
}): JSX.Element;

export interface ToastOptions {
  message:   string;
  variant?:  AlertVariant;
  duration?: number;
}

export interface ToastAPI {
  show(opts: ToastOptions): void;
}

export declare function ToastProvider(props: { children: ReactNode }): JSX.Element;
export declare function useToast(): ToastAPI;

// ── Overlay ───────────────────────────────────────────────────────────────────

export declare function Modal(props: {
  visible:    boolean;
  onClose?:   () => void;
  title?:     string;
  children:   ReactNode;
  width?:     number;
  style?:     Style;
}): JSX.Element;

export declare function ModalFooter(props: {
  children: ReactNode;
  style?:   Style;
}): JSX.Element;

export declare function Tooltip(props: {
  text:      string;
  children:  ReactNode;
  placement?: 'top' | 'bottom' | 'left' | 'right';
  style?:    Style;
}): JSX.Element;

export declare function Sheet(props: {
  visible:   boolean;
  onClose?:  () => void;
  title?:    string;
  children:  ReactNode;
  height?:   number | string;
  style?:    Style;
}): JSX.Element;

// ── Display ───────────────────────────────────────────────────────────────────

export declare function Avatar(props: {
  src?:   string;
  name?:  string;
  size?:  number;
  color?: string;
  style?: Style;
}): JSX.Element;

export declare function AvatarGroup(props: {
  items?:   Array<{ src?: string; name?: string }>;
  size?:    number;
  max?:     number;
  overlap?: number;
  style?:   Style;
}): JSX.Element;

export declare function Chip(props: {
  label:     string;
  onRemove?: () => void;
  onPress?:  () => void;
  selected?: boolean;
  color?:    string;
  style?:    Style;
}): JSX.Element;

export declare function Empty(props: {
  icon?:        string;
  title?:       string;
  description?: string;
  action?:      () => void;
  actionLabel?: string;
  style?:       Style;
}): JSX.Element;

export declare function Stat(props: {
  value:     string | number;
  label:     string;
  change?:   string | number;
  positive?: boolean;
  icon?:     string;
  style?:    Style;
}): JSX.Element;

export declare function KVRow(props: {
  label:   string;
  value:   string | number;
  onPress?: () => void;
  muted?:  boolean;
  border?: boolean;
  style?:  Style;
}): JSX.Element;

// ── Navigation ────────────────────────────────────────────────────────────────

export declare function Tabs(props: {
  tabs:          string[];
  activeIndex?:  number;
  onChange?:     (index: number) => void;
  children?:     ReactNode;
  style?:        Style;
}): JSX.Element;

export declare function Accordion(props: {
  items?:    Array<{ title: string; content: ReactNode }>;
  multiple?: boolean;
  variant?:  'default' | 'card';
  style?:    Style;
}): JSX.Element;

export declare function Stepper(props: {
  steps?:   string[];
  current?: number;
  style?:   Style;
}): JSX.Element;

export declare function Breadcrumb(props: {
  items?:     Array<{ label: string; onPress?: () => void }>;
  separator?: string;
  style?:     Style;
}): JSX.Element;
