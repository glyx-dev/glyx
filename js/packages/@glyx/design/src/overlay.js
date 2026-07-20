// @glyx-dev/design — Overlay components
//
// Exports:
//   Modal    — backdrop + centered panel with optional title and close button
//   Tooltip  — hover-triggered bubble label (requires onPointerEnter/Leave support)
//   Sheet    — bottom sheet panel that slides up over content

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable } from '@glyx-dev/react';
import { useTheme } from './theme.js';
import { Heading } from './components.js';

// ── Modal ─────────────────────────────────────────────────────────────────────
//
// A centered overlay panel with optional backdrop-dismiss.
//
// ⚠ PLACEMENT: Render Modal near your app's root component so that its
//   position:absolute covers the full window. If placed inside a small View
//   it will only cover that View.
//
// Props:
//   visible        — whether the modal is shown
//   onClose        — called when the backdrop or ✕ is pressed
//   title          — optional header string
//   children       — modal body content
//   width          — panel width in px (default 480, capped to window)
//   hideCloseButton — hides the ✕ icon (default false)
//   dismissOnBackdrop — click backdrop to close (default true)

export function Modal({
  visible,
  onClose,
  title,
  children,
  width           = 480,
  hideCloseButton = false,
  dismissOnBackdrop = true,
  style,
}) {
  const { colors, space, radius, fontSize } = useTheme();

  if (!visible) return null;

  const hasHeader = title != null || (!hideCloseButton && onClose != null);

  return (
    // Scrim / backdrop
    <View
      style={{
        position:        'absolute',
        top:             0,
        left:            0,
        right:           0,
        bottom:          0,
        backgroundColor: colors.scrim,
        alignItems:      'center',
        justifyContent:  'center',
        zIndex:          100,
      }}
    >
      {/* Backdrop tap target */}
      {dismissOnBackdrop && (
        <Pressable
          onPress={() => onClose?.()}
          style={{
            position: 'absolute',
            top:      0,
            left:     0,
            right:    0,
            bottom:   0,
          }}
        />
      )}

      {/* Panel */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderRadius:    radius.xl,
          padding:         space[6],
          width,
          gap:             space[4],
          boxShadow:       '0 8 40 #00000060',
          zIndex:          101,
          ...style,
        }}
      >
        {hasHeader && (
          <View
            style={{
              flexDirection:  'row',
              alignItems:     'center',
              justifyContent: 'space-between',
            }}
          >
            {title != null ? (
              <Heading level={3}>{title}</Heading>
            ) : (
              <View />
            )}

            {!hideCloseButton && onClose != null && (
              <Pressable onPress={() => onClose?.()}>
                <Text
                  fontSize={fontSize.xl}
                  style={{ color: colors.textMuted }}
                >
                  ✕
                </Text>
              </Pressable>
            )}
          </View>
        )}

        {children}
      </View>
    </View>
  );
}

// ── ModalFooter ───────────────────────────────────────────────────────────────
//
// Convenience row for modal action buttons (right-aligned by default).
//
//   <ModalFooter>
//     <Button label="Cancel" variant="ghost" onPress={onClose} />
//     <Button label="Save"   variant="primary" onPress={handleSave} />
//   </ModalFooter>

export function ModalFooter({ children, style }) {
  const { space } = useTheme();
  return (
    <View
      style={{
        flexDirection:  'row',
        justifyContent: 'flex-end',
        gap:            space[3],
        ...style,
      }}
    >
      {children}
    </View>
  );
}

// ── Tooltip ───────────────────────────────────────────────────────────────────
//
// A label bubble that appears when the user hovers over the wrapped content.
//
// ⚠ Requires Glyx pointer enter/leave events on View (hover detection).
//   Falls back gracefully (no tooltip shown) if events are not fired.
//
// Props:
//   content      — tooltip label string
//   placement    — 'top' | 'bottom' | 'left' | 'right'  (default 'top')
//   childHeight  — approximate height of children in px (used for 'top' offset,
//                  default 36). Adjust if the tooltip overlaps your content.
//   children     — the element to wrap

export function Tooltip({
  content,
  placement   = 'top',
  childHeight = 36,
  childWidth  = 36,
  children,
}) {
  const { colors, space, radius, fontSize } = useTheme();
  const [visible, setVisible] = useState(false);

  const show = useCallback(() => setVisible(true),  []);
  const hide = useCallback(() => setVisible(false), []);

  // Bubble position offset from the wrapper's top-left corner
  const bubbleStyle = (() => {
    const pad = space[2];
    if (placement === 'bottom') return { top:  childHeight + 4, left: 0 };
    if (placement === 'left')   return { top:  (childHeight - 28) / 2, right: childWidth + 4 };
    if (placement === 'right')  return { top:  (childHeight - 28) / 2, left:  childWidth + 4 };
    // top (default)
    return { bottom: childHeight + 4, left: 0 };
  })();

  return (
    <View
      style={{ position: 'relative' }}
      onPointerEnter={show}
      onPointerLeave={hide}
    >
      {children}

      {visible && content != null && (
        <View
          style={{
            position:        'absolute',
            ...bubbleStyle,
            backgroundColor: colors.text,
            borderRadius:    radius.md,
            paddingHorizontal: space[2],
            paddingVertical:   space[1],
            zIndex:           200,
          }}
        >
          <Text fontSize={fontSize.xs} style={{ color: colors.bg }}>
            {content}
          </Text>
        </View>
      )}
    </View>
  );
}

// ── Sheet ─────────────────────────────────────────────────────────────────────
//
// A bottom panel that overlays content from the bottom edge.
//
// ⚠ PLACEMENT: Same as Modal — render near the app root for correct coverage.
//
// Props:
//   visible      — whether the sheet is shown
//   onClose      — called when backdrop is tapped
//   title        — optional header string
//   height       — sheet height in px (default 360)
//   children     — sheet body content

export function Sheet({
  visible,
  onClose,
  title,
  height  = 360,
  children,
  style,
}) {
  const { colors, space, radius, fontSize } = useTheme();

  if (!visible) return null;

  return (
    <View
      style={{
        position:        'absolute',
        top:             0,
        left:            0,
        right:           0,
        bottom:          0,
        backgroundColor: colors.scrim,
        justifyContent:  'flex-end',
        zIndex:          100,
      }}
    >
      {/* Backdrop */}
      {(
        <Pressable
          onPress={() => onClose?.()}
          style={{
            position: 'absolute',
            top:      0,
            left:     0,
            right:    0,
            bottom:   0,
          }}
        />
      )}

      {/* Panel */}
      <View
        style={{
          backgroundColor: colors.surface,
          borderTopLeftRadius:  radius.xl,
          borderTopRightRadius: radius.xl,
          height,
          padding:         space[5],
          gap:             space[4],
          zIndex:          101,
          boxShadow:       '0 -4 24 #00000040',
          ...style,
        }}
      >
        {/* Handle bar */}
        <View
          style={{
            alignSelf:       'center',
            width:           40,
            height:          4,
            borderRadius:    2,
            backgroundColor: colors.border,
            marginBottom:    space[2],
          }}
        />

        {title != null && (
          <View
            style={{
              flexDirection:  'row',
              alignItems:     'center',
              justifyContent: 'space-between',
            }}
          >
            <Heading level={3}>{title}</Heading>
            {onClose != null && (
              <Pressable onPress={onClose}>
                <Text fontSize={fontSize.xl} style={{ color: colors.textMuted }}>✕</Text>
              </Pressable>
            )}
          </View>
        )}

        {children}
      </View>
    </View>
  );
}
