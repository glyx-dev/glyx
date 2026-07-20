// @glyx-dev/design — ThemeProvider + useTheme hook
//
// Usage:
//   import { ThemeProvider, useTheme } from '@glyx-dev/design';
//
//   // Wrap your app root:
//   render(
//     <ThemeProvider>
//       <App />
//     </ThemeProvider>
//   );
//
//   // In any component:
//   function MyButton({ label, onPress }) {
//     const { colors, space, radius } = useTheme();
//     return (
//       <Pressable
//         onPress={onPress}
//         style={{
//           backgroundColor: colors.primary,
//           padding: space[3],
//           borderRadius: radius.md,
//         }}
//       >
//         <Text style={{ color: colors.primaryText }}>{label}</Text>
//       </Pressable>
//     );
//   }

import React, { createContext, useContext, useState, useEffect } from 'react';
import { system, SelectColorsProvider } from '@glyx-dev/react';
import { tokens, darkTokens } from './tokens.js';

// ── Context ───────────────────────────────────────────────────────────────────

const ThemeContext = createContext(tokens);

// ── ThemeProvider ─────────────────────────────────────────────────────────────

/**
 * Provides design tokens to the component subtree.
 *
 * @param {object}  props
 * @param {'light'|'dark'|'system'} [props.colorScheme='system']
 *   Explicit color scheme.  `'system'` (default) follows the OS preference via
 *   `__glyx_system_getDarkMode`.
 * @param {object}  [props.overrides]
 *   Partial token overrides merged on top of the selected scheme tokens.
 *   E.g. `{ colors: { primary: '#ff0000' } }`.
 * @param {React.ReactNode} props.children
 */
export function ThemeProvider({ colorScheme = 'system', overrides, children }) {
  const [isDark, setIsDark] = useState(() => {
    if (colorScheme === 'dark') return true;
    if (colorScheme === 'light') return false;
    // 'system': read current OS preference.
    try {
      return typeof __glyx_system_getDarkMode !== 'undefined'
        ? __glyx_system_getDarkMode() === 'dark'
        : false;
    } catch { return false; }
  });

  // Track OS preference changes when colorScheme='system'.
  useEffect(() => {
    if (colorScheme !== 'system') {
      setIsDark(colorScheme === 'dark');
      return;
    }
    // Rust-side watcher: fires ONLY when the OS preference changes — no JS
    // timer, V8 stays idle between changes.
    if (typeof __glyx_system_watch !== 'undefined') {
      const id = system.watch('darkMode', (mode) => {
        setIsDark((prev) => (prev === (mode === 'dark') ? prev : mode === 'dark'));
      });
      return () => system.unwatch(id);
    }
    // Fallback (snapshot stubs / old runtimes): 2s JS poll.
    const id = setInterval(() => {
      try {
        if (typeof __glyx_system_getDarkMode !== 'undefined') {
          const next = __glyx_system_getDarkMode() === 'dark';
          setIsDark((prev) => (prev === next ? prev : next));
        }
      } catch {}
    }, 2000);
    return () => clearInterval(id);
  }, [colorScheme]);

  const base = isDark ? darkTokens : tokens;

  // Deep-merge overrides if provided.
  const theme = overrides
    ? _deepMerge(base, overrides)
    : base;

  const { colors } = theme;
  // Memoize so SelectColorsContext only re-emits when the theme actually changes.
  const selectColors = React.useMemo(() => ({
    triggerBg:           colors.surface,
    triggerBgDisabled:   colors.bg,
    triggerBorder:       colors.border,
    triggerBorderFocus:  colors.borderFocus,
    triggerText:         colors.text,
    triggerPlaceholder:  colors.textMuted,
    chevron:             colors.textMuted,   // arrows blend — not primary accent
    dropdownBg:          colors.surface,
    dropdownBorder:      colors.border,
    optionText:          colors.text,
    optionSelectedText:  colors.primary,
    optionHoverBg:       colors.surfaceHover,
    optionSelectedBg:    colors.secondary,
    optionCheck:         colors.primary,
    calCellSelectedBg:   colors.primary,
    calCellSelectedText: colors.primaryText,
    calDayName:          colors.textDisabled,
  }), [colors]);

  return (
    <ThemeContext.Provider value={theme}>
      <SelectColorsProvider colors={selectColors}>
        {children}
      </SelectColorsProvider>
    </ThemeContext.Provider>
  );
}

// ── useTheme ──────────────────────────────────────────────────────────────────

/**
 * Returns the current theme tokens.
 * Must be called inside a `<ThemeProvider>`.
 *
 * @returns {typeof import('./tokens.js').tokens}
 */
export function useTheme() {
  return useContext(ThemeContext);
}

// ── createTheme ───────────────────────────────────────────────────────────────

/**
 * Merge custom token overrides with a base scheme.
 *
 * @param {'light'|'dark'} [base='light']
 * @param {object} overrides  Partial token overrides.
 * @returns {typeof tokens}
 */
export function createTheme(base = 'light', overrides = {}) {
  const baseTokens = base === 'dark' ? darkTokens : tokens;
  return _deepMerge(baseTokens, overrides);
}

// ── Internal helpers ──────────────────────────────────────────────────────────

function _deepMerge(base, overrides) {
  const result = Object.assign({}, base);
  for (const key of Object.keys(overrides)) {
    if (
      overrides[key] !== null &&
      typeof overrides[key] === 'object' &&
      !Array.isArray(overrides[key]) &&
      base[key] !== null &&
      typeof base[key] === 'object'
    ) {
      result[key] = _deepMerge(base[key], overrides[key]);
    } else {
      result[key] = overrides[key];
    }
  }
  return result;
}
