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
import type { GlyxLength, StyleProp } from '@glyx-dev/react';

const { useState, useRef, useCallback, useEffect } = React;

/** Where and what was dropped. */
export interface DropInfo {
  x: number;
  y: number;
  type?: string;
}

interface DropCallbacks {
  onDrop?: (data: unknown, info: DropInfo) => void;
  accepts?: string | string[];
}

interface Rect { x: number; y: number; width: number; height: number }

// nodeId → { onDrop, accepts }
const dropRegistry = new Map<number, { current: DropCallbacks }>();

function layoutOf(nodeId: number): Rect | null {
  if (typeof __glyx_getLayout === 'undefined') return null;
  try { return __glyx_getLayout(nodeId); } catch { return null; }
}

export interface DropZoneProps extends DropCallbacks {
  children?: React.ReactNode;
  style?: StyleProp;
  width?: GlyxLength;
  height?: GlyxLength;
}

export function DropZone({ children, onDrop, accepts, style, width, height }: DropZoneProps): React.ReactElement {
  const idRef  = useRef<number | null>(null);
  // Always-current ref so Draggable reads the latest onDrop/accepts at drop time,
  // even if DropZone hasn't re-rendered since the last prop change.
  const cbRef  = useRef({ onDrop, accepts });
  cbRef.current = { onDrop, accepts };

  const onMount = useCallback((id: number) => {
    idRef.current = id;
    dropRegistry.set(id, cbRef);
  }, []); // stable — cbRef identity is constant
  useEffect(() => () => { if (idRef.current !== null) dropRegistry.delete(idRef.current); }, []);

  return React.createElement(View, { _glyxOnMount: onMount, width, height, style }, children);
}

export interface DraggableProps {
  children?: React.ReactNode;
  /** What a DropZone receives in `onDrop`. */
  data?: unknown;
  /** Matched against a DropZone's `accepts`. */
  type?: string;
  style?: StyleProp;
  width?: GlyxLength;
  height?: GlyxLength;
  /** Called with true when a drag starts and false when it ends. */
  onDragStateChange?: (dragging: boolean) => void;
}

export function Draggable({ children, data, type, style, width, height, onDragStateChange }: DraggableProps): React.ReactElement {
  const [offset, setOffset] = useState<{ dx: number; dy: number } | null>(null); // {dx,dy} while dragging

  const onMount = useDraggable({
    onDragStart: () => { setOffset({ dx: 0, dy: 0 }); onDragStateChange?.(true); },
    onDragMove:  ({ dx, dy }: { dx: number; dy: number }) => setOffset((o) => ({ dx: (o?.dx || 0) + dx, dy: (o?.dy || 0) + dy })),
    onDragEnd:   ({ x, y }: { x: number; y: number }) => {
      setOffset(null);
      onDragStateChange?.(false);
      // Find the topmost drop zone whose rect contains the drop point.
      for (const [nodeId, zone] of dropRegistry) {
        const r = layoutOf(nodeId);
        if (!r) continue;
        if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
          const z = zone.current;
          const ok = !z.accepts || (Array.isArray(z.accepts) ? (z.accepts as Array<string | undefined>).includes(type) : z.accepts === type);
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
