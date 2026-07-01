// @glyx/design — Navigation components
//
// Exports:
//   Tabs        — horizontal tab bar + content panels
//   Accordion   — collapsible sections list
//   Stepper     — step-by-step progress indicator
//   Breadcrumb  — path navigation

import React, { useState, useCallback } from 'react';
import { View, Text, Pressable, ScrollView } from '@glyx/react';
import { useTheme } from './theme.js';

// ── Tabs ──────────────────────────────────────────────────────────────────────
//
// Horizontal tab bar. Can be used in two ways:
//
// A) Fully controlled (content rendered outside):
//
//      const [tab, setTab] = useState('overview')
//      <Tabs
//        items={[{ key: 'overview', label: 'Overview' }, { key: 'files', label: 'Files' }]}
//        value={tab}
//        onChange={setTab}
//      />
//      {tab === 'overview' && <Overview />}
//
// B) Self-contained (content rendered inside):
//
//      <Tabs
//        items={[
//          { key: 'overview', label: 'Overview', content: <Overview /> },
//          { key: 'files',    label: 'Files',    content: <Files /> },
//        ]}
//        defaultValue="overview"
//      />
//
// Props:
//   items        — [{ key, label, content? }]
//   value        — controlled active tab key
//   onChange     — (key) => void
//   defaultValue — initial tab (uncontrolled)
//   variant      — 'underline' | 'pill'  (default 'underline')
//   scrollable   — wrap the tab bar in a horizontal ScrollView (default false)

export function Tabs({
  items        = [],
  value,
  onChange,
  defaultValue,
  variant      = 'underline',
  scrollable   = false,
  style,
  contentStyle,
}) {
  const [internal, setInternal] = useState(
    defaultValue ?? items[0]?.key ?? null
  );
  const { colors, space, radius, fontSize, fontWeight } = useTheme();

  const active = value ?? internal;

  const handleChange = useCallback((key) => {
    if (value === undefined) setInternal(key);
    onChange?.(key);
  }, [value, onChange]);

  const isPill = variant === 'pill';

  const TabBar = (
    <View
      style={
        isPill
          ? {
              flexDirection:   'row',
              backgroundColor: colors.surfaceRaised,
              borderRadius:    radius.lg,
              padding:         space[1],
              gap:             space[1],
            }
          : {
              flexDirection:  'row',
              borderBottomWidth: 1,
              borderBottomColor: colors.border,
            }
      }
    >
      {items.map(item => {
        const isActive = item.key === active;

        if (isPill) {
          return (
            <Pressable
              key={item.key}
              onPress={() => handleChange(item.key)}
              style={{
                flex:            1,
                paddingVertical: space[2],
                borderRadius:    radius.md,
                backgroundColor: isActive ? colors.surface : 'transparent',
                alignItems:      'center',
                boxShadow:       isActive ? '0 1 4 #00000020' : undefined,
              }}
            >
              <Text
                fontSize={fontSize.sm}
                style={{
                  color:      isActive ? colors.text : colors.textMuted,
                  fontWeight: isActive ? fontWeight.semibold : fontWeight.regular,
                }}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        }

        // underline variant
        return (
          <Pressable
            key={item.key}
            onPress={() => handleChange(item.key)}
            style={{
              paddingHorizontal: space[4],
              paddingVertical:   space[3],
              borderBottomWidth: isActive ? 2 : 0,
              borderBottomColor: isActive ? colors.primary : 'transparent',
              marginBottom:      isActive ? 0 : 1,  // compensate for bottom border width
            }}
          >
            <Text
              fontSize={fontSize.sm}
              style={{
                color:      isActive ? colors.primary : colors.textMuted,
                fontWeight: isActive ? fontWeight.semibold : fontWeight.regular,
              }}
            >
              {item.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );

  const activeItem = items.find(i => i.key === active);
  const hasContent = items.some(i => i.content != null);

  return (
    <View style={{ gap: 0, ...style }}>
      {scrollable ? (
        <ScrollView horizontal showsScrollIndicator={false}>
          {TabBar}
        </ScrollView>
      ) : TabBar}

      {hasContent && activeItem?.content != null && (
        <View style={{ paddingTop: space[4], ...contentStyle }}>
          {activeItem.content}
        </View>
      )}
    </View>
  );
}

// ── Accordion ─────────────────────────────────────────────────────────────────
//
// Collapsible sections list. Supports single-open and multi-open modes.
//
// Props:
//   items      — [{ key, title, content, defaultOpen? }]
//   multiple   — allow multiple sections open at once (default false)
//   variant    — 'default' | 'flush'  (default 'default' — shows card borders)

export function Accordion({ items = [], multiple = false, variant = 'default', style }) {
  const { colors, space, radius, fontSize, fontWeight } = useTheme();

  const [open, setOpen] = useState(() => {
    const initial = new Set();
    items.forEach(item => { if (item.defaultOpen) initial.add(item.key); });
    return initial;
  });

  const toggle = useCallback((key) => {
    setOpen(prev => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        if (!multiple) next.clear();
        next.add(key);
      }
      return next;
    });
  }, [multiple]);

  const isFlush = variant === 'flush';

  return (
    <View style={{ gap: isFlush ? 0 : space[2], ...style }}>
      {items.map((item, idx) => {
        const isOpen = open.has(item.key);
        const isLast = idx === items.length - 1;

        return (
          <View
            key={item.key}
            style={
              isFlush
                ? {
                    borderBottomWidth: isLast ? 0 : 1,
                    borderBottomColor: colors.border,
                  }
                : {
                    backgroundColor:  colors.surface,
                    borderRadius:     radius.md,
                    borderWidth:      1,
                    borderColor:      colors.border,
                    overflow:         'hidden',
                  }
            }
          >
            {/* Header */}
            <Pressable
              onPress={() => toggle(item.key)}
              style={{
                flexDirection:  'row',
                alignItems:     'center',
                justifyContent: 'space-between',
                padding:        space[4],
              }}
            >
              <Text
                fontSize={fontSize.base}
                style={{ color: colors.text, fontWeight: fontWeight.medium, flex: 1 }}
              >
                {item.title}
              </Text>
              <Text
                fontSize={fontSize.base}
                style={{
                  color:     colors.textMuted,
                  transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                }}
              >
                ▾
              </Text>
            </Pressable>

            {/* Body */}
            {isOpen && (
              <View
                style={{
                  paddingLeft:   space[4],
                  paddingRight:  space[4],
                  paddingBottom: space[4],
                }}
              >
                {typeof item.content === 'string' ? (
                  <Text fontSize={fontSize.base} style={{ color: colors.textMuted }}>
                    {item.content}
                  </Text>
                ) : (
                  item.content
                )}
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Stepper ───────────────────────────────────────────────────────────────────
//
// Horizontal step-progress indicator for multi-step flows.
//
// Props:
//   steps    — array of step label strings
//   current  — 0-based index of the active step
//   style

export function Stepper({ steps = [], current = 0, style }) {
  const { colors, space, radius, fontSize, fontWeight } = useTheme();

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems:    'center',
        ...style,
      }}
    >
      {steps.map((label, i) => {
        const done    = i <  current;
        const active  = i === current;
        const future  = i >  current;
        const isLast  = i === steps.length - 1;

        const circleColor = done    ? colors.primary
                          : active  ? colors.primary
                          :           colors.surfaceRaised;

        const circleText  = done ? '✓' : String(i + 1);

        const circleFg = done || active ? colors.primaryText : colors.textMuted;

        return (
          <View
            key={i}
            style={{ flex: isLast ? 0 : 1, flexDirection: 'row', alignItems: 'center' }}
          >
            {/* Circle + label */}
            <View style={{ alignItems: 'center', gap: space[1] }}>
              <View
                style={{
                  width:           28,
                  height:          28,
                  borderRadius:    14,
                  backgroundColor: circleColor,
                  borderWidth:     active ? 2 : 0,
                  borderColor:     active ? colors.primary : 'transparent',
                  alignItems:      'center',
                  justifyContent:  'center',
                  opacity:         future ? 0.4 : 1,
                }}
              >
                <Text
                  fontSize={fontSize.xs}
                  style={{ color: circleFg, fontWeight: fontWeight.bold }}
                >
                  {circleText}
                </Text>
              </View>
              <Text
                fontSize={fontSize.xs}
                style={{
                  color:      active ? colors.primary : colors.textMuted,
                  fontWeight: active ? fontWeight.semibold : fontWeight.regular,
                  textAlign:  'center',
                }}
              >
                {label}
              </Text>
            </View>

            {/* Connector line */}
            {!isLast && (
              <View
                style={{
                  flex:            1,
                  height:          2,
                  backgroundColor: i < current ? colors.primary : colors.border,
                  marginBottom:    space[4],  // align with circle center
                }}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────
//
// Path-style navigation indicator.
//
// Props:
//   items    — [{ label, onPress? }] — last item is current page (not pressable)
//   separator — separator character (default '/')

export function Breadcrumb({ items = [], separator = '/', style }) {
  const { colors, space, fontSize } = useTheme();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: space[1], ...style }}>
      {items.map((item, i) => {
        const isLast = i === items.length - 1;

        return (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: space[1] }}>
            {item.onPress && !isLast ? (
              <Pressable onPress={item.onPress}>
                <Text
                  fontSize={fontSize.sm}
                  style={{ color: colors.primary }}
                >
                  {item.label}
                </Text>
              </Pressable>
            ) : (
              <Text
                fontSize={fontSize.sm}
                style={{ color: isLast ? colors.text : colors.textMuted }}
              >
                {item.label}
              </Text>
            )}

            {!isLast && (
              <Text fontSize={fontSize.sm} style={{ color: colors.border }}>
                {separator}
              </Text>
            )}
          </View>
        );
      })}
    </View>
  );
}
