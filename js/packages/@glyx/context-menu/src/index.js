// @glyx-dev/context-menu — right-click context menus.
//
// Uses the native `onRightPress` event (right mouse button) and z-index overlay
// positioning. Dismisses on any outside click.
//
//   import { ContextMenu } from '@glyx-dev/context-menu';
//   <ContextMenu items={[
//     { label: 'Open', action: () => open(id) },
//     { separator: true },
//     { label: 'Delete', action: () => del(id), destructive: true },
//   ]}>
//     <NoteCard note={note} />
//   </ContextMenu>

import React from 'react';
import { View, Text, Pressable, useWindowSize,
         addGlobalClickListener, removeGlobalClickListener } from '@glyx-dev/react';

const { useState, useEffect } = React;

export function ContextMenu({ children, items = [], width = 200 }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos]   = useState({ x: 0, y: 0 });
  const { width: winW, height: winH } = useWindowSize();

  // Dismiss on any outside click (left OR right elsewhere).
  useEffect(() => {
    if (!open) return;
    const onClick = () => setOpen(false);
    addGlobalClickListener(onClick);
    return () => removeGlobalClickListener(onClick);
  }, [open]);

  // itemH is derived from this component's own fixed row styling
  // (paddingVertical: 6 + one line of fontSize:13 text) — there's no
  // custom item-render prop, so every row really is this height; not an
  // estimate that can drift out from under us.
  const itemH = 30;
  const menuH = items.reduce((h, it) => h + (it.separator ? 9 : itemH), 8);
  // Clamp on both axes — min() alone only guards the right/bottom edge;
  // max(0, ...) floors the left/top edge too (defensive: covers callers
  // that pass an out-of-window pos programmatically, not just real clicks).
  const x = Math.max(0, Math.min(pos.x, winW - width - 4));
  const y = Math.max(0, Math.min(pos.y, winH - menuH - 4));

  return React.createElement(
    View, null,
    React.createElement(Pressable, {
      onRightPress: (e) => { setPos({ x: e.x, y: e.y }); setOpen(true); },
    }, children),
    open && React.createElement(
      View,
      {
        style: {
          position: 'absolute', left: x, top: y, width,
          backgroundColor: '#1C1C26', borderRadius: 8,
          borderWidth: 1, borderColor: '#2A2A3A', padding: 4, zIndex: 9000,
        },
      },
      ...items.map((it, i) => it.separator
        ? React.createElement(View, { key: i, style: { height: 1, backgroundColor: '#2A2A3A', marginVertical: 4 } })
        : React.createElement(Pressable, {
            key: i,
            disabled: it.disabled,
            onPress: () => { setOpen(false); it.action?.(); },
            style: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6 },
          },
          React.createElement(Text, {
            fontSize: 13,
            style: { color: it.disabled ? '#444455' : it.destructive ? '#E05060' : '#E0E0F0' },
          }, it.label)),
      ),
    ),
  );
}
