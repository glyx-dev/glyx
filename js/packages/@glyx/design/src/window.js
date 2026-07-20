// @glyx-dev/design — Window controls for custom title bars
//
// A theme-aware replacement for @glyx-dev/react's built-in `WindowControls`,
// which hard-codes black glyphs and has no background/hover styling. This
// version reads the active theme (so it adapts to light/dark automatically)
// and is fully customizable via props.
//
// Usage:
//   import { WindowControls } from '@glyx-dev/design';
//   <View glyxDraggable style={styles.titleBar}>
//     <Text style={styles.title}>My App</Text>
//     <WindowControls />
//   </View>
//
// Props:
//   glyphColor       — resting glyph color (default: colors.textMuted)
//   hoverGlyphColor  — glyph color while hovered (default: colors.text)
//   hoverBg          — background shown on hover for min/max (default: colors.surfaceHover)
//   closeHoverBg     — background shown on hover for close (default: colors.error)
//   minimizeIcon     — glyph for minimize (default: '−')
//   maximizeIcon     — glyph for maximize (default: '☐' / '⊞' on macOS)
//   restoreIcon      — glyph for restore (default: '❐' / '⊡' on macOS)
//   closeIcon        — glyph for close (default: '✕')
//   style            — extra style for the button row container

import React from 'react';
import { View, Text, Pressable, glyxWindow } from '@glyx-dev/react';
import { useTheme } from './theme.js';

function _ControlButton({ glyph, onPress, hoverBg, glyphColor, hoverGlyphColor }) {
  const [hovered, setHovered] = React.useState(false);
  return (
    <Pressable
      onPress={onPress}
      feedback={false}
      onHoverIn={() => setHovered(true)}
      onHoverOut={() => setHovered(false)}
      style={{
        width: 46,
        height: 40,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: hovered ? hoverBg : 'transparent',
      }}
    >
      <Text
        fontSize={13}
        style={{ color: hovered && hoverGlyphColor ? hoverGlyphColor : glyphColor }}
      >
        {glyph}
      </Text>
    </Pressable>
  );
}

/**
 * Minimize / maximize / close button row for custom (decorations: false)
 * title bars. Platform-aware order is automatic (macOS traffic-lights on the
 * left, Windows/Linux on the right).
 */
export function WindowControls({
  glyphColor,
  hoverGlyphColor,
  hoverBg,
  closeHoverBg,
  minimizeIcon = '−',
  maximizeIcon,
  restoreIcon,
  closeIcon = '✕',
  style,
} = {}) {
  const { colors } = useTheme();
  const isMac = glyxWindow.platform() === 'macos';
  const [maximized, setMaximized] = React.useState(() => glyxWindow.isMaximized());

  const minimize = () => glyxWindow.setMinimized();
  const toggleMax = () => {
    const next = !glyxWindow.isMaximized();
    glyxWindow.setMaximized(next);
    setMaximized(next);
  };
  const close = () => glyxWindow.close();

  const fg      = glyphColor      || colors.textMuted;
  const hovGlyph = hoverGlyphColor || colors.text;
  const hovBg   = hoverBg         || colors.surfaceHover;
  const closeBg = closeHoverBg    || colors.error;

  const minGlyph = minimizeIcon;
  const closeGlyph = closeIcon;
  const maxGlyph = maximizeIcon ?? (isMac ? '⊞' : '☐');
  const resGlyph = restoreIcon   ?? (isMac ? '⊡' : '❐');

  const btn = (key, glyph, onPress, isClose) => (
    <_ControlButton
      key={key}
      glyph={glyph}
      onPress={onPress}
      hoverBg={isClose ? closeBg : hovBg}
      glyphColor={fg}
      hoverGlyphColor={isClose ? '#ffffff' : hovGlyph}
    />
  );

  const controls = isMac
    ? [
        btn('close', closeGlyph, close, true),
        btn('min',   minGlyph,   minimize),
        btn('max',   maximized ? resGlyph : maxGlyph, toggleMax),
      ]
    : [
        btn('min',   minGlyph,   minimize),
        btn('max',   maximized ? resGlyph : maxGlyph, toggleMax),
        btn('close', closeGlyph, close, true),
      ];

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        ...(isMac ? { marginLeft: 8 } : {}),
        ...style,
      }}
    >
      {controls}
    </View>
  );
}
