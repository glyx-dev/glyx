// @glyx/design — Form components
//
// All form components follow a consistent anatomy:
//   label (optional) + control + helper text / error (optional)
//
// Exports: TextField, SwitchRow, CheckboxRow, NumberInput, SearchInput

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, TextInput } from '@glyx/react';
import { useTheme } from './theme.js';

// ── TextField ─────────────────────────────────────────────────────────────────
//
// A labelled text input with optional icons, helper text, and error state.
//
// Props:
//   label          — field label shown above input
//   value          — controlled value
//   onChangeText   — (text) => void
//   placeholder    — placeholder string
//   helperText     — secondary text shown below (overridden by error)
//   error          — error message string; turns border red when set
//   disabled       — grays out and prevents editing
//   secureTextEntry — hides text (password)
//   multiline      — enables multi-line input
//   leftIcon       — ReactNode shown before the input
//   rightIcon      — ReactNode shown after the input
//   style          — outer container style
//   inputStyle     — style applied to the inner TextInput

export function TextField({
  label,
  value,
  onChangeText,
  placeholder,
  helperText,
  error,
  disabled = false,
  secureTextEntry = false,
  multiline = false,
  leftIcon,
  rightIcon,
  style,
  inputStyle,
  ...props
}) {
  const { colors, space, radius, fontSize, fontWeight } = useTheme();
  const [focused, setFocused] = useState(false);

  const borderColor = error
    ? colors.error
    : focused
    ? colors.borderFocus
    : colors.border;

  return (
    <View style={{ gap: space[1], ...style }}>
      {label != null && (
        <Text
          fontSize={fontSize.sm}
          style={{ color: colors.textMuted, fontWeight: fontWeight.medium }}
        >
          {label}
        </Text>
      )}

      {(() => {
        const hasIcons = leftIcon != null || rightIcon != null;
        // The FIELD BOX chrome: exactly one bordered surface, standalone like
        // DatePicker — no extra padded wrapper around it.
        const boxChrome = {
          backgroundColor:   disabled ? colors.surfaceRaised : colors.surface,
          borderWidth:       focused ? 2 : 1,
          borderColor,
          borderRadius:      radius.md,
          opacity:           disabled ? 0.6 : 1,
        };
        const input = (
          <TextInput
            value={value}
            onChangeText={disabled ? undefined : onChangeText}
            placeholder={placeholder}
            placeholderTextColor={colors.textMuted}
            secureTextEntry={secureTextEntry}
            multiline={multiline}
            editable={!disabled}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            style={{
              // flex:1 is for sharing the ICON ROW's main axis; on the bare
              // (column) path it would collapse the input's height instead —
              // there the field stretches to the column's full width.
              ...(hasIcons ? { flex: 1 } : { alignSelf: 'stretch' }),
              color:    colors.text,
              fontSize: fontSize.base,
              // With icons, the row container draws the box; bare, the input
              // itself is the box.  Either way there is only ONE chrome.
              ...(hasIcons
                ? { backgroundColor: 'transparent', borderWidth: 0, padding: 0 }
                : boxChrome),
              ...inputStyle,
            }}
            {...props}
          />
        );
        if (!hasIcons) return input;
        return (
          <View
            style={{
              flexDirection:     'row',
              alignItems:        'center',
              paddingHorizontal: space[3],
              paddingVertical:   space[3],
              gap:               space[2],
              ...boxChrome,
            }}
          >
            {leftIcon != null && (
              <View style={{ justifyContent: 'center' }}>{leftIcon}</View>
            )}
            {input}
            {rightIcon != null && (
              <View style={{ justifyContent: 'center' }}>{rightIcon}</View>
            )}
          </View>
        );
      })()}

      {(helperText != null || error != null) && (
        <Text
          fontSize={fontSize.xs}
          style={{ color: error ? colors.error : colors.textMuted }}
        >
          {error ?? helperText}
        </Text>
      )}
    </View>
  );
}

// ── SwitchRow ─────────────────────────────────────────────────────────────────
//
// A full-width row with a label + optional description on the left and a
// themed toggle switch on the right.

export function SwitchRow({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
  style,
}) {
  const { colors, space, fontSize, fontWeight } = useTheme();

  const trackBg = value ? colors.primary : colors.border;
  const W = 44, H = 24, thumbD = H - 8;

  return (
    <Pressable
      onPress={disabled ? undefined : () => onValueChange?.(!value)}
      style={{
        flexDirection:  'row',
        alignItems:     'center',
        justifyContent: 'space-between',
        opacity:        disabled ? 0.5 : 1,
        gap:            space[4],
        ...style,
      }}
    >
      <View style={{ flex: 1, gap: space[1] }}>
        {label != null && (
          <Text
            fontSize={fontSize.base}
            style={{ color: colors.text, fontWeight: fontWeight.medium }}
          >
            {label}
          </Text>
        )}
        {description != null && (
          <Text fontSize={fontSize.sm} style={{ color: colors.textMuted }}>
            {description}
          </Text>
        )}
      </View>

      {/* Track */}
      <View
        style={{
          width:            W,
          height:           H,
          borderRadius:     H / 2,
          backgroundColor:  trackBg,
          justifyContent:   'center',
          paddingHorizontal: 4,
          alignItems:       value ? 'flex-end' : 'flex-start',
        }}
      >
        {/* Thumb */}
        <View
          style={{
            width:           thumbD,
            height:          thumbD,
            borderRadius:    thumbD / 2,
            backgroundColor: '#ffffff',
          }}
        />
      </View>
    </Pressable>
  );
}

// ── CheckboxRow ───────────────────────────────────────────────────────────────
//
// A checkbox with an inline label. Clicking anywhere on the row toggles it.

export function CheckboxRow({
  label,
  checked,
  onChange,
  disabled = false,
  style,
}) {
  const { colors, space, radius, fontSize } = useTheme();

  return (
    <Pressable
      onPress={disabled ? undefined : () => onChange?.(!checked)}
      style={{
        flexDirection: 'row',
        alignItems:    'center',
        gap:           space[3],
        opacity:       disabled ? 0.5 : 1,
        ...style,
      }}
    >
      <View
        style={{
          width:           20,
          height:          20,
          borderRadius:    radius.sm,
          borderWidth:     2,
          borderColor:     checked ? colors.primary : colors.border,
          backgroundColor: checked ? colors.primary : 'transparent',
          alignItems:      'center',
          justifyContent:  'center',
        }}
      >
        {checked && (
          <Text
            fontSize={12}
            style={{ color: colors.primaryText, fontWeight: '700' }}
          >
            ✓
          </Text>
        )}
      </View>

      {label != null && (
        <Text fontSize={fontSize.base} style={{ color: colors.text, flex: 1 }}>
          {label}
        </Text>
      )}
    </Pressable>
  );
}

// ── NumberInput ───────────────────────────────────────────────────────────────
//
// A numeric field with decrement (−) and increment (+) buttons.
//
// Props:
//   value    — controlled number
//   onChange — (number) => void
//   min / max / step — range constraints
//   label    — label shown above

export function NumberInput({
  label,
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled = false,
  style,
}) {
  const { colors, space, radius, fontSize, fontWeight } = useTheme();

  const decrement = useCallback(() => {
    const next = value - step;
    if (min === undefined || next >= min) onChange?.(next);
  }, [value, step, min, onChange]);

  const increment = useCallback(() => {
    const next = value + step;
    if (max === undefined || next <= max) onChange?.(next);
  }, [value, step, max, onChange]);

  const canDec = min === undefined || value - step >= min;
  const canInc = max === undefined || value + step <= max;

  const btnStyle = (enabled) => ({
    width:           36,
    height:          36,
    borderRadius:    radius.sm,
    backgroundColor: colors.surfaceRaised,
    alignItems:      'center',
    justifyContent:  'center',
    opacity:         enabled ? 1 : 0.3,
  });

  return (
    <View style={{ gap: space[1], ...style }}>
      {label != null && (
        <Text
          fontSize={fontSize.sm}
          style={{ color: colors.textMuted, fontWeight: fontWeight.medium }}
        >
          {label}
        </Text>
      )}

      <View
        style={{
          flexDirection:    'row',
          alignItems:       'center',
          backgroundColor:  colors.bg,
          borderWidth:      1,
          borderColor:      colors.border,
          borderRadius:     radius.md,
          paddingHorizontal: space[2],
          paddingVertical:  space[1],
          gap:              space[2],
          opacity:          disabled ? 0.6 : 1,
        }}
      >
        <Pressable onPress={disabled || !canDec ? undefined : decrement} style={btnStyle(!disabled && canDec)}>
          <Text fontSize={fontSize.md} style={{ color: colors.text }}>−</Text>
        </Pressable>

        <Text
          fontSize={fontSize.base}
          style={{ color: colors.text, flex: 1, textAlign: 'center' }}
        >
          {value}
        </Text>

        <Pressable onPress={disabled || !canInc ? undefined : increment} style={btnStyle(!disabled && canInc)}>
          <Text fontSize={fontSize.md} style={{ color: colors.text }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

// ── SearchInput ───────────────────────────────────────────────────────────────
//
// A pill-shaped search field with a magnifier prefix icon and a clear (✕)
// button that appears once the user types.
//
// Props:
//   value        — controlled string
//   onChangeText — (text) => void
//   placeholder  — defaults to 'Search…'
//   onClear      — called (in addition to clearing the value) when ✕ is pressed

export function SearchInput({
  value,
  onChangeText,
  placeholder = 'Search…',
  onClear,
  style,
}) {
  const { colors, space, radius, fontSize } = useTheme();

  const handleClear = useCallback(() => {
    onChangeText?.('');
    onClear?.();
  }, [onChangeText, onClear]);

  return (
    <View
      style={{
        flexDirection:     'row',
        alignItems:        'center',
        backgroundColor:   colors.bg,
        borderWidth:       1,
        borderColor:       colors.border,
        borderRadius:      radius.full,
        paddingHorizontal: space[3],
        paddingVertical:   space[2],
        gap:               space[2],
        ...style,
      }}
    >
      <Text fontSize={fontSize.base} style={{ color: colors.textMuted }}>
        🔍
      </Text>

      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        style={{ flex: 1, color: colors.text, fontSize: fontSize.base }}
      />

      {value ? (
        <Pressable onPress={handleClear}>
          <Text fontSize={fontSize.sm} style={{ color: colors.textMuted }}>✕</Text>
        </Pressable>
      ) : null}
    </View>
  );
}
