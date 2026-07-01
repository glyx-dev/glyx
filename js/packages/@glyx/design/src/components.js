// @glyx/design — Pre-themed base components
//
// These are thin wrappers around @glyx/react primitives that read from the
// current ThemeProvider context.  Use them as a starting point; they're not
// opinionated UI components — just styled primitives that respect your theme.
//
// Usage:
//   import { Button, Card, Divider, Label, Badge } from '@glyx/design';

import React from 'react';
import { View, Text, Pressable } from '@glyx/react';
import { useTheme } from './theme.js';

// ── Button ────────────────────────────────────────────────────────────────────

/**
 * Themed pressable button.
 *
 * @param {{ label: string, onPress: function, variant?: 'primary'|'secondary'|'ghost', disabled?: boolean, style?: object }} props
 */
export function Button({ label, onPress, variant = 'primary', disabled = false, style }) {
  const { colors, space, radius, fontSize } = useTheme();

  const bg = disabled
    ? colors.textDisabled
    : variant === 'primary'   ? colors.primary
    : variant === 'secondary' ? colors.secondary
    : 'transparent';

  const fg = disabled
    ? colors.surface
    : variant === 'primary'   ? colors.primaryText
    : variant === 'ghost'     ? colors.primary
    : colors.secondaryText;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{
        backgroundColor: bg,
        paddingHorizontal: space[4],
        paddingVertical:   space[2],
        borderRadius:      radius.md,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        ...(variant === 'ghost' ? { borderWidth: 1, borderColor: colors.primary } : {}),
        ...style,
      }}
    >
      <Text fontSize={fontSize.base} style={{ color: fg, fontWeight: '600' }}>
        {label}
      </Text>
    </Pressable>
  );
}

// ── Card ──────────────────────────────────────────────────────────────────────

/**
 * Elevated surface container.
 *
 * @param {{ children: React.ReactNode, style?: object, padding?: number }} props
 */
export function Card({ children, style, padding }) {
  const { colors, space, radius } = useTheme();
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius:    radius.lg,
        padding:         padding ?? space[4],
        borderWidth:     1,
        borderColor:     colors.border,
        ...style,
      }}
    >
      {children}
    </View>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

/**
 * Horizontal or vertical separator line.
 *
 * @param {{ direction?: 'horizontal'|'vertical', style?: object }} props
 */
export function Divider({ direction = 'horizontal', style }) {
  const { colors } = useTheme();
  const isH = direction === 'horizontal';
  return (
    <View
      style={{
        backgroundColor: colors.border,
        height:    isH ? 1 : undefined,
        width:     isH ? undefined : 1,
        flex:      isH ? undefined : 1,
        alignSelf: isH ? 'stretch' : undefined,
        ...style,
      }}
    />
  );
}

// ── Label ─────────────────────────────────────────────────────────────────────

/**
 * Themed body text with semantic size and weight variants.
 *
 * @param {{ children: React.ReactNode, size?: 'xs'|'sm'|'base'|'md'|'lg'|'xl', muted?: boolean, style?: object }} props
 */
export function Label({ children, size = 'base', muted = false, bold = false, style }) {
  const { colors, fontSize, fontWeight } = useTheme();
  return (
    <Text
      fontSize={fontSize[size] ?? fontSize.base}
      style={{
        color:      muted ? colors.textMuted : colors.text,
        fontWeight: bold  ? fontWeight.semibold : fontWeight.regular,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

// ── Heading ───────────────────────────────────────────────────────────────────

/**
 * Themed heading text.
 *
 * @param {{ children: React.ReactNode, level?: 1|2|3|4, style?: object }} props
 */
export function Heading({ children, level = 1, style }) {
  const { colors, fontSize, fontWeight } = useTheme();
  const sizes = { 1: '3xl', 2: '2xl', 3: 'xl', 4: 'lg' };
  return (
    <Text
      fontSize={fontSize[sizes[level]] ?? fontSize['2xl']}
      style={{
        color:      colors.text,
        fontWeight: fontWeight.bold,
        ...style,
      }}
    >
      {children}
    </Text>
  );
}

// ── IconButton ────────────────────────────────────────────────────────────────
//
// Square pressable button with a single icon (emoji or text glyph).
//
// Props:
//   icon     — string icon/emoji to render
//   onPress  — press handler
//   size     — button diameter in px (default 36)
//   variant  — 'secondary' | 'primary' | 'ghost' | 'danger' (default 'secondary')
//   disabled — grays out and blocks interaction
//   label    — accessibility label (not rendered)

export function IconButton({ icon, onPress, size = 36, variant = 'secondary', disabled = false, label, style }) {
  const { colors, radius } = useTheme();

  const bg = disabled          ? colors.textDisabled
           : variant === 'primary'   ? colors.primary
           : variant === 'danger'    ? colors.error
           : variant === 'ghost'     ? 'transparent'
           : colors.surfaceRaised;

  const fg = variant === 'primary' ? colors.primaryText
           : variant === 'danger'  ? '#ffffff'
           : colors.text;

  return (
    <Pressable
      onPress={disabled ? undefined : onPress}
      style={{
        width:           size,
        height:          size,
        borderRadius:    radius.md,
        backgroundColor: bg,
        alignItems:      'center',
        justifyContent:  'center',
        opacity:         disabled ? 0.5 : 1,
        ...(variant === 'ghost' ? { borderWidth: 1, borderColor: colors.border } : {}),
        ...style,
      }}
    >
      <Text fontSize={Math.round(size * 0.5)} style={{ color: fg }}>
        {icon}
      </Text>
    </Pressable>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

/**
 * Small status badge / pill.
 *
 * @param {{ label: string, variant?: 'default'|'success'|'warning'|'error', style?: object }} props
 */
export function Badge({ label, variant = 'default', style }) {
  const { colors, space, radius, fontSize } = useTheme();

  const bg = variant === 'success' ? colors.successSurface
           : variant === 'warning' ? colors.warningSurface
           : variant === 'error'   ? colors.errorSurface
           : colors.surfaceRaised;

  const fg = variant === 'success' ? colors.success
           : variant === 'warning' ? colors.warning
           : variant === 'error'   ? colors.error
           : colors.textMuted;

  return (
    <View
      style={{
        backgroundColor:  bg,
        paddingHorizontal: space[2],
        paddingVertical:   space[1],
        borderRadius:      radius.full,
        ...style,
      }}
    >
      <Text fontSize={fontSize.xs} style={{ color: fg, fontWeight: '600' }}>
        {label}
      </Text>
    </View>
  );
}
