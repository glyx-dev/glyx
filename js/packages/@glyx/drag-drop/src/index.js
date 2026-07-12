// @glyx-dev/drag-drop — drag-and-drop primitives on native drag events.
//
//   import { Draggable, DropZone } from '@glyx-dev/drag-drop';
//   <Draggable data={item}> <Card/> </Draggable>
//   <DropZone onDrop={(data) => move(data)}> <Column/> </DropZone>
//
// Drop targets are matched by hit-testing the pointer against each DropZone's
// live layout rect at drop time.

import React from 'react';
import { View, useDraggable } from '@glyx-dev/react';

const { useState, useRef, useCallback, useEffect } = React;

// nodeId → { onDrop, accepts }
const dropRegistry = new Map();

function layoutOf(nodeId) {
  if (typeof __glyx_getLayout === 'undefined') return null;
  try { return __glyx_getLayout(nodeId); } catch { return null; }
}

export function DropZone({ children, onDrop, accepts, style, width, height }) {
  const idRef  = useRef(null);
  // Always-current ref so Draggable reads the latest onDrop/accepts at drop time,
  // even if DropZone hasn't re-rendered since the last prop change.
  const cbRef  = useRef({ onDrop, accepts });
  cbRef.current = { onDrop, accepts };

  const onMount = useCallback((id) => {
    idRef.current = id;
    dropRegistry.set(id, cbRef);
  }, []); // stable — cbRef identity is constant
  useEffect(() => () => { if (idRef.current !== null) dropRegistry.delete(idRef.current); }, []);

  return React.createElement(View, { _glyxOnMount: onMount, width, height, style }, children);
}

export function Draggable({ children, data, type, style, width, height, onDragStateChange }) {
  const [offset, setOffset] = useState(null); // {dx,dy} while dragging

  const onMount = useDraggable({
    onDragStart: () => { setOffset({ dx: 0, dy: 0 }); onDragStateChange?.(true); },
    onDragMove:  ({ dx, dy }) => setOffset((o) => ({ dx: (o?.dx || 0) + dx, dy: (o?.dy || 0) + dy })),
    onDragEnd:   ({ x, y }) => {
      setOffset(null);
      onDragStateChange?.(false);
      // Find the topmost drop zone whose rect contains the drop point.
      for (const [nodeId, zone] of dropRegistry) {
        const r = layoutOf(nodeId);
        if (!r) continue;
        if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
          const z = zone.current;
          const ok = !z.accepts || (Array.isArray(z.accepts) ? z.accepts.includes(type) : z.accepts === type);
          if (ok) { z.onDrop?.(data, { x, y, type }); break; }
        }
      }
    },
  });

  const dragStyle = offset
    ? { ...style, marginLeft: offset.dx, marginTop: offset.dy, opacity: 0.8, zIndex: 9999 }
    : style;

  return React.createElement(View, { _glyxOnMount: onMount, pressable: true, width, height, style: dragStyle }, children);
}
