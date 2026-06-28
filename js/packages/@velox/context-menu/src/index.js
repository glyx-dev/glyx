// @velox/context-menu — right-click context menus.
//
// Uses the native `onRightPress` event (right mouse button) and z-index overlay
// positioning. Dismisses on any outside click.
//
//   import { ContextMenu } from '@velox/context-menu';
//   <ContextMenu items={[
//     { label: 'Open', action: () => open(id) },
//     { separator: true },
//     { label: 'Delete', action: () => del(id), destructive: true },
//   ]}>
//     <NoteCard note={note} />
//   </ContextMenu>

import React from 'react';
import { View, Text, Pressable, useWindowSize,
         addGlobalClickListener, removeGlobalClickListener } from '@velox/react';

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

  // Estimate menu height to flip it back on-screen near edges.
  const itemH = 30;
  const menuH = items.reduce((h, it) => h + (it.separator ? 9 : itemH), 8);
  const x = Math.min(pos.x, Math.max(0, winW - width - 4));
  const y = Math.min(pos.y, Math.max(0, winH - menuH - 4));

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
