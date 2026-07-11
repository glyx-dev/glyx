// @glyx/design — Design tokens
//
// Usage:
//   import { tokens } from '@glyx/design';
//   const bg = tokens.colors.surface;          // light-mode surface
//
//   import { darkTokens } from '@glyx/design';
//   const bg = darkTokens.colors.surface;      // dark-mode surface
//
// Tokens follow a semantic naming convention: intent, not value.
//   colors.primary   — interactive accent (buttons, links)
//   colors.surface   — card / panel backgrounds
//   colors.bg        — root window background
//   colors.text      — primary body text
//   colors.textMuted — secondary / caption text
//   colors.border    — dividers, input outlines
//   colors.error     — error states
//   colors.success   — success states
//   colors.warning   — warning / caution states

// ── Palettes ──────────────────────────────────────────────────────────────────

/** Catppuccin Latte (light) palette */
const _latte = {
  rosewater: '#dc8a78', flamingo: '#dd7878', pink: '#ea76cb', mauve: '#8839ef',
  red: '#d20f39',       maroon: '#e64553', peach: '#fe640b', yellow: '#df8e1d',
  green: '#40a02b',     teal: '#179299',  sky: '#04a5e5',  sapphire: '#209fb5',
  blue: '#1e66f5',      lavender: '#7287fd',
  text: '#4c4f69',      subtext1: '#5c5f77', subtext0: '#6c6f85',
  overlay2: '#7c7f93',  overlay1: '#8c8fa1', overlay0: '#9ca0b0',
  surface2: '#acb0be',  surface1: '#bcc0cc', surface0: '#ccd0da',
  base: '#eff1f5',      mantle: '#e6e9ef',   crust: '#dce0e8',
};

/** Catppuccin Mocha (dark) palette */
const _mocha = {
  rosewater: '#f5e0dc', flamingo: '#f2cdcd', pink: '#f5c2e7', mauve: '#cba6f7',
  red: '#f38ba8',       maroon: '#eba0ac', peach: '#fab387', yellow: '#f9e2af',
  green: '#a6e3a1',     teal: '#94e2d5',  sky: '#89dceb',  sapphire: '#74c7ec',
  blue: '#89b4fa',      lavender: '#b4befe',
  text: '#cdd6f4',      subtext1: '#bac2de', subtext0: '#a6adc8',
  overlay2: '#9399b2',  overlay1: '#7f849c', overlay0: '#6c7086',
  surface2: '#585b70',  surface1: '#45475a', surface0: '#313244',
  base: '#1e1e2e',      mantle: '#181825',   crust: '#11111b',
};

// ── Semantic tokens ───────────────────────────────────────────────────────────

/**
 * Light-mode design tokens.
 * All color values are hex strings ('#rrggbb' or '#rrggbbaa').
 */
export const tokens = {
  colors: {
    // Core
    bg:          _latte.base,
    surface:     _latte.surface0,
    surfaceRaised: _latte.surface1,
    text:        _latte.text,
    textMuted:   _latte.subtext1,
    textDisabled: _latte.overlay1,
    border:      _latte.surface2,
    borderFocus: _latte.blue,

    // Interactive
    primary:     _latte.blue,
    primaryText: _latte.base,
    primaryHover: _latte.sapphire,

    secondary:   _latte.surface0,
    secondaryText: _latte.text,

    // Semantic
    error:       _latte.red,
    errorSurface: '#fde8ec',
    success:     _latte.green,
    successSurface: '#e6f9e6',
    warning:     _latte.yellow,
    warningSurface: '#fef9e8',

    // Overlay
    scrim:       'rgba(76,79,105,0.4)',
  },

  /** Spacing scale in logical pixels (8-point grid). */
  space: {
    0:  0,
    1:  4,
    2:  8,
    3:  12,
    4:  16,
    5:  20,
    6:  24,
    8:  32,
    10: 40,
    12: 48,
    16: 64,
    20: 80,
    24: 96,
  },

  /** Border radius scale in logical pixels. */
  radius: {
    none: 0,
    sm:   4,
    md:   8,
    lg:   12,
    xl:   16,
    full: 9999,
  },

  /** Font size scale in logical pixels. */
  fontSize: {
    xs:   11,
    sm:   13,
    base: 15,
    md:   17,
    lg:   20,
    xl:   24,
    '2xl': 30,
    '3xl': 36,
    '4xl': 48,
  },

  /** Font weight constants. */
  fontWeight: {
    regular:   '400',
    medium:    '500',
    semibold:  '600',
    bold:      '700',
  },

  /** Line height multipliers. */
  lineHeight: {
    tight:  1.2,
    normal: 1.5,
    loose:  1.8,
  },
};

/**
 * Dark-mode design tokens.
 * Same structure as `tokens` with Mocha palette values.
 */
export const darkTokens = {
  colors: {
    bg:          _mocha.base,
    surface:     _mocha.surface0,
    surfaceRaised: _mocha.surface1,
    text:        _mocha.text,
    textMuted:   _mocha.subtext1,
    textDisabled: _mocha.overlay1,
    border:      _mocha.surface1,
    borderFocus: _mocha.blue,

    primary:     _mocha.blue,
    primaryText: _mocha.base,
    primaryHover: _mocha.sapphire,

    secondary:   _mocha.surface0,
    secondaryText: _mocha.text,

    error:       _mocha.red,
    errorSurface: 'rgba(243,139,168,0.15)',
    success:     _mocha.green,
    successSurface: 'rgba(166,227,161,0.15)',
    warning:     _mocha.yellow,
    warningSurface: 'rgba(249,226,175,0.15)',

    scrim:       'rgba(0,0,0,0.5)',
  },

  space:      tokens.space,
  radius:     tokens.radius,
  fontSize:   tokens.fontSize,
  fontWeight: tokens.fontWeight,
  lineHeight: tokens.lineHeight,
};
