// @glyx/design — Display components
//
// Exports:
//   Avatar       — circular image or initials fallback
//   AvatarGroup  — overlapping stack of avatars
//   Chip         — removable / selectable pill tag
//   Empty        — empty-state placeholder (icon + title + description + action)
//   Stat         — metric card (number + label + optional trend)
//   KVRow        — key / value table row

import React from 'react';
import { View, Text, Pressable, Image } from '@glyx/react';
import { useTheme } from './theme.js';

// ── Avatar ─────────────────────────────────────────────────────────────────────
//
// Circular avatar — shows an image if `src` is provided, otherwise renders
// the first 1-2 initials of `name`.
//
// Props:
//   src    — image URL / path
//   name   — display name used to derive initials (required when no src)
//   size   — diameter in px (default 40)
//   color  — background color for initials fallback (defaults to theme primary)
//   style  — additional style

export function Avatar({ src, name, size = 40, color, style }) {
  const { colors, fontSize, fontWeight } = useTheme();

  const initials = (() => {
    if (!name) return '?';
    const parts = name.trim().split(/\s+/);
    return parts.length >= 2
      ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  })();

  const bg    = color ?? colors.primary;
  const inner = size - 4;  // slight inset so border is visible when used inside AvatarGroup

  const containerStyle = {
    width:           size,
    height:          size,
    borderRadius:    size / 2,
    backgroundColor: src ? 'transparent' : bg,
    alignItems:      'center',
    justifyContent:  'center',
    overflow:        'hidden',
    ...style,
  };

  if (src) {
    return (
      <View style={containerStyle}>
        <Image
          src={src}
          width={size}
          height={size}
          style={{ borderRadius: size / 2 }}
        />
      </View>
    );
  }

  return (
    <View style={containerStyle}>
      <Text
        fontSize={Math.round(size * 0.35)}
        style={{ color: colors.primaryText, fontWeight: fontWeight.semibold }}
      >
        {initials}
      </Text>
    </View>
  );
}

// ── AvatarGroup ───────────────────────────────────────────────────────────────
//
// Renders up to `max` avatars overlapping each other. If there are more,
// a "+N" overflow count is shown as the last item.
//
// Props:
//   items   — array of Avatar prop objects ({ src?, name?, color? })
//   size    — avatar size in px (default 36)
//   max     — max avatars before "+N" overflow (default 4)
//   overlap — how many px each avatar overlaps the previous (default size * 0.3)

export function AvatarGroup({ items = [], size = 36, max = 4, overlap, style }) {
  const { colors, fontSize, fontWeight } = useTheme();
  const ov     = overlap ?? Math.round(size * 0.3);
  const shown  = items.slice(0, max);
  const extra  = items.length - max;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems:    'center',
        ...style,
      }}
    >
      {shown.map((item, i) => (
        <View
          key={i}
          style={{
            marginLeft:  i === 0 ? 0 : -ov,
            borderWidth: 2,
            borderColor: colors.bg,
            borderRadius: size / 2,
          }}
        >
          <Avatar {...item} size={size} />
        </View>
      ))}

      {extra > 0 && (
        <View
          style={{
            marginLeft:      -ov,
            width:           size,
            height:          size,
            borderRadius:    size / 2,
            backgroundColor: colors.surfaceRaised,
            alignItems:      'center',
            justifyContent:  'center',
            borderWidth:     2,
            borderColor:     colors.bg,
          }}
        >
          <Text
            fontSize={Math.round(size * 0.28)}
            style={{ color: colors.textMuted, fontWeight: fontWeight.semibold }}
          >
            +{extra}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Chip ──────────────────────────────────────────────────────────────────────
//
// A compact pill-shaped label. Can be:
//   • Static        — just a label
//   • Selectable    — press to toggle selected state (show/hide checkmark)
//   • Dismissible   — renders an ✕ button that calls onRemove
//
// Props:
//   label      — chip text
//   selected   — when true, shows a ✓ prefix and uses the primary color
//   onPress    — makes the chip pressable (for toggle / filter use)
//   onRemove   — renders a ✕ button when provided
//   variant    — 'default' | 'success' | 'warning' | 'error'
//   size       — 'sm' | 'md' (default 'md')

export function Chip({
  label,
  selected  = false,
  onPress,
  onRemove,
  variant   = 'default',
  size      = 'md',
  style,
}) {
  const { colors, space, radius, fontSize, fontWeight } = useTheme();

  const bg = selected || variant === 'success' ? colors.successSurface
           : variant === 'warning' ? colors.warningSurface
           : variant === 'error'   ? colors.errorSurface
           : colors.surfaceRaised;

  const fg = selected             ? colors.success
           : variant === 'success' ? colors.success
           : variant === 'warning' ? colors.warning
           : variant === 'error'   ? colors.error
           : colors.text;

  const border = selected             ? colors.success
               : variant === 'success' ? colors.success
               : variant === 'warning' ? colors.warning
               : variant === 'error'   ? colors.error
               : colors.border;

  const py = size === 'sm' ? space[1] : space[2];
  const px = size === 'sm' ? space[2] : space[3];
  const fs = size === 'sm' ? fontSize.xs : fontSize.sm;

  const inner = (
    <View
      style={{
        flexDirection:     'row',
        alignItems:        'center',
        backgroundColor:   bg,
        borderRadius:      radius.full,
        borderWidth:       1,
        borderColor:       border,
        paddingHorizontal: px,
        paddingVertical:   py,
        gap:               space[1],
        ...style,
      }}
    >
      {selected && (
        <Text fontSize={fs} style={{ color: fg, fontWeight: fontWeight.bold }}>✓</Text>
      )}
      <Text fontSize={fs} style={{ color: fg, fontWeight: fontWeight.medium }}>
        {label}
      </Text>
      {onRemove != null && (
        <Pressable onPress={onRemove} style={{ marginLeft: space[1] }}>
          <Text fontSize={fs} style={{ color: fg, opacity: 0.7 }}>✕</Text>
        </Pressable>
      )}
    </View>
  );

  if (onPress) {
    return <Pressable onPress={onPress}>{inner}</Pressable>;
  }
  return inner;
}

// ── Empty ─────────────────────────────────────────────────────────────────────
//
// Empty-state placeholder — centered layout with a large icon, title,
// description text, and an optional primary action button.
//
// Props:
//   icon        — emoji or string shown large at the top
//   title       — heading text
//   description — secondary body text
//   action      — callback for the action button
//   actionLabel — button label (default 'Get started')

export function Empty({ icon, title, description, action, actionLabel = 'Get started', style }) {
  const { colors, space, radius, fontSize, fontWeight } = useTheme();

  return (
    <View
      style={{
        flex:           1,
        alignItems:     'center',
        justifyContent: 'center',
        gap:            space[4],
        padding:        space[8],
        ...style,
      }}
    >
      {icon != null && (
        <Text fontSize={48} style={{ textAlign: 'center' }}>
          {icon}
        </Text>
      )}

      {title != null && (
        <Text
          fontSize={fontSize.lg}
          style={{
            color:      colors.text,
            fontWeight: fontWeight.bold,
            textAlign:  'center',
          }}
        >
          {title}
        </Text>
      )}

      {description != null && (
        <Text
          fontSize={fontSize.base}
          style={{
            color:     colors.textMuted,
            textAlign: 'center',
          }}
        >
          {description}
        </Text>
      )}

      {action != null && (
        <Pressable
          onPress={action}
          style={{
            backgroundColor:   colors.primary,
            borderRadius:      radius.md,
            paddingHorizontal: space[5],
            paddingVertical:   space[3],
            marginTop:         space[2],
          }}
        >
          <Text
            fontSize={fontSize.base}
            style={{ color: colors.primaryText, fontWeight: fontWeight.semibold }}
          >
            {actionLabel}
          </Text>
        </Pressable>
      )}
    </View>
  );
}

// ── Stat ──────────────────────────────────────────────────────────────────────
//
// A metric display card — large value + label + optional change indicator.
//
// Props:
//   value    — the metric (string or number)
//   label    — metric name / description
//   change   — e.g. '+12%' or '-3' — shown with trend color
//   positive — true = green trend, false = red trend (default: starts with '+')
//   icon     — emoji / string shown to the left of the value

export function Stat({ value, label, change, positive, icon, style }) {
  const { colors, space, radius, fontSize, fontWeight } = useTheme();

  const isPositive = positive ?? (typeof change === 'string' && change.startsWith('+'));
  const trendColor = isPositive ? colors.success : colors.error;

  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius:    radius.lg,
        borderWidth:     1,
        borderColor:     colors.border,
        padding:         space[4],
        gap:             space[2],
        ...style,
      }}
    >
      {/* Label row */}
      <Text fontSize={fontSize.sm} style={{ color: colors.textMuted }}>
        {label}
      </Text>

      {/* Value row */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        {icon != null && (
          <Text fontSize={fontSize.xl}>{icon}</Text>
        )}
        <Text
          fontSize={fontSize['2xl']}
          style={{ color: colors.text, fontWeight: fontWeight.bold }}
        >
          {value}
        </Text>
      </View>

      {/* Trend */}
      {change != null && (
        <Text fontSize={fontSize.sm} style={{ color: trendColor, fontWeight: fontWeight.medium }}>
          {change}
        </Text>
      )}
    </View>
  );
}

// ── KVRow ─────────────────────────────────────────────────────────────────────
//
// A single key / value row — useful for settings info panels, profile pages,
// detail views, etc.
//
// Props:
//   label     — left-side key text
//   value     — right-side value text (or any ReactNode)
//   onPress   — makes the row tappable (adds a › chevron)
//   muted     — dims the value text (default false)
//   border    — show bottom border (default true)

export function KVRow({ label, value, onPress, muted = false, border = true, style }) {
  const { colors, space, fontSize } = useTheme();

  const Row = onPress ? Pressable : View;

  return (
    <Row
      onPress={onPress}
      style={{
        flexDirection:     'row',
        alignItems:        'center',
        justifyContent:    'space-between',
        paddingVertical:   space[3],
        borderBottomWidth: border ? 1 : 0,
        borderBottomColor: colors.border,
        gap:               space[4],
        ...style,
      }}
    >
      <Text fontSize={fontSize.base} style={{ color: colors.text }}>
        {label}
      </Text>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space[2] }}>
        {typeof value === 'string' || typeof value === 'number' ? (
          <Text
            fontSize={fontSize.base}
            style={{ color: muted ? colors.textMuted : colors.text }}
          >
            {value}
          </Text>
        ) : (
          value
        )}
        {onPress != null && (
          <Text fontSize={fontSize.sm} style={{ color: colors.textMuted }}>›</Text>
        )}
      </View>
    </Row>
  );
}
