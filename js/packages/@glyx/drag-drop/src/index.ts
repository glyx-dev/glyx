// @glyx-dev/drag-drop — drag-and-drop primitives on native drag events.
//
//   import { Draggable, DropZone, SortableList, Board } from '@glyx-dev/drag-drop';
//   <Draggable data={item}> <Card/> </Draggable>
//   <DropZone onDrop={(data) => move(data)}> <Column/> </DropZone>
//   <SortableList items={items} getKey={...} onReorder={...} renderItem={...} />
//   <Board columns={columns} onMove={...} getKey={...} renderCard={...} />
//
// Drop targets are matched by hit-testing the pointer against each DropZone's
// live (clipped, on-screen) layout when the button goes up. SortableList and
// Board use the same primitives; they add an insertion index, a line where the
// item will land, a dimmed source item and a lifted copy that no longer takes
// layout space.

import React from 'react';
import { View, Text, useDraggable, flattenStyle, addKeyListener, removeKeyListener, ScrollView } from '@glyx-dev/react';
import type { GlyxLength, StyleProp } from '@glyx-dev/react';

const { useState, useRef, useCallback, useEffect, useImperativeHandle } = React;

/** Where and what was dropped. */
export interface DropInfo {
  x: number;
  y: number;
  type?: string;
  /** The data carried by the Draggable, so one callback can serve several kinds. */
  data?: unknown;
}

/** Called when a compatible drag enters, moves over, leaves or is dropped on a zone. */
export type DragHandler = (data: unknown, info: DropInfo) => void;

interface DropCallbacks {
  onDrop?: DragHandler;
  onDragEnter?: DragHandler;
  onDragOver?: DragHandler;
  onDragLeave?: DragHandler;
  accepts?: string | string[];
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
  boxX: number;
  boxY: number;
  boxWidth: number;
  boxHeight: number;
}

interface ZoneEntry {
  /** The latest props, without re-registering (and without stale closures). */
  current: DropCallbacks;
  /** Set by DropZone; toggles its `activeStyle`. */
  setActive: (active: boolean) => void;
}

// nodeId → entry. The entry object is stable for the life of the native node.
const dropRegistry = new Map<number, ZoneEntry>();

function layoutOf(nodeId: number): Rect | null {
  if (typeof __glyx_getLayout === 'undefined') return null;
  try { return __glyx_getLayout(nodeId) as Rect; } catch { return null; }
}

function acceptsType(zone: DropCallbacks, type?: string) {
  return !zone.accepts
    || (Array.isArray(zone.accepts) ? zone.accepts.includes(type as string) : zone.accepts === type);
}

function zoneAt(x: number, y: number, type?: string) {
  // Reverse registration order: children and later siblings paint (and
  // hit-test) above earlier ones, so the last compatible zone wins.
  const entries = [...dropRegistry.entries()];
  for (let i = entries.length - 1; i >= 0; i--) {
    const [nodeId, zone] = entries[i];
    if (!acceptsType(zone.current, type)) continue;
    const r = layoutOf(nodeId);
    if (!r) continue;
    // `x/y/width/height` are clipped to the visible part; a zone half-scrolled
    // out of a column must not accept a drop on the hidden part.
    if (x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height) {
      return { nodeId, zone };
    }
  }
  return null;
}

export interface DropZoneProps extends DropCallbacks {
  children?: React.ReactNode;
  style?: StyleProp;
  /** Merged into `style` while a compatible drag is over the zone (highlight). */
  activeStyle?: StyleProp;
  width?: GlyxLength;
  height?: GlyxLength;
  /** The zone's native node id, for measuring it (SortableList's insertion line). */
  onMount?: (nodeId: number) => void;
}

export function DropZone({
  children, onDrop, onDragEnter, onDragOver, onDragLeave, accepts,
  style, activeStyle, width, height, onMount: externalOnMount,
}: DropZoneProps): React.ReactElement {
  const idRef = useRef<number | null>(null);
  const cbRef = useRef<DropCallbacks>({ onDrop, onDragEnter, onDragOver, onDragLeave, accepts });
  cbRef.current = { onDrop, onDragEnter, onDragOver, onDragLeave, accepts };
  // Every mounted DropZone counts as a visible drag target. `active` is set
  // only when a compatible drag enters; cleared on leave/drop, so hover work
  // stays idle when nothing is being dragged.
  const [active, setActive] = useState(false);
  const entryRef = useRef<ZoneEntry>({ current: cbRef.current, setActive: () => {} });
  entryRef.current.current = cbRef.current;
  entryRef.current.setActive = setActive;

  const onMount = useCallback((id: number) => {
    idRef.current = id;
    dropRegistry.set(id, entryRef.current);
    externalOnMount?.(id);
  }, [externalOnMount]);
  useEffect(() => () => { if (idRef.current !== null) dropRegistry.delete(idRef.current); }, []);

  const merged = active && activeStyle
    ? [style, activeStyle]
    : style;

  return React.createElement(
    View,
    { _glyxOnMount: onMount, width, height, style: merged },
    children,
  );
}

// The hover state lives on the stable entry object above, not on the props, so
// a render of DropZone does not replace it. `Draggable` calls this.
function setZoneActive(zone: ZoneEntry, active: boolean) {
  zone.setActive(active);
}

export interface DragPoint {
  x: number;
  y: number;
}

export interface DragEndInfo extends DropInfo {
  /** False when Escape cancelled the drag or the pointer was released without crossing the movement threshold. */
  dropped: boolean;
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
  /** Ignore presses and drags (the item still renders). */
  disabled?: boolean;
  /** Lift the item with a transform while dragging (default true). Turn off when a parent draws its own drag preview. */
  lift?: boolean;
  /** Called once the pointer has moved far enough to count as a drag. */
  onDragStart?: (info: DropInfo) => void;
  onDragMove?: (info: DropInfo) => void;
  /** Called after the drop (or a cancelled drag). */
  onDragEnd?: (info: DragEndInfo) => void;
  /** Called with true when a drag starts and false when it ends. */
  onDragStateChange?: (dragging: boolean) => void;
  /** The native node id, for measuring the dragged item (sortable lists). */
  onMount?: (nodeId: number) => void;
}

// Movement before a press becomes a drag, as in a browser. Without it a click
// on a card would already lift it and a text selection inside it would turn
// into a drag on the first pixel.
const DRAG_THRESHOLD = 4;

export function Draggable({
  children, data, type, style, width, height, disabled = false, lift = true,
  onDragStart, onDragMove, onDragEnd, onDragStateChange, onMount: externalOnMount,
}: DraggableProps): React.ReactElement {
  const [offset, setOffset] = useState<{ dx: number; dy: number } | null>(null);
  const nodeIdRef = useRef<number | null>(null);
  const startRef = useRef<DragPoint | null>(null);
  const activeRef = useRef(false);
  const cancelledRef = useRef(false);
  const lastPointRef = useRef<DragPoint>({ x: 0, y: 0 });
  const hoveredRef = useRef<{ nodeId: number; zone: ZoneEntry } | null>(null);
  const dataRef = useRef(data);
  dataRef.current = data;
  const typeRef = useRef(type);
  typeRef.current = type;
  const disabledRef = useRef(disabled);
  disabledRef.current = disabled;
  const callbacksRef = useRef({ onDragStart, onDragMove, onDragEnd, onDragStateChange });
  callbacksRef.current = { onDragStart, onDragMove, onDragEnd, onDragStateChange };

  const leaveHovered = () => {
    const hovered = hoveredRef.current;
    if (!hovered) return;
    setZoneActive(hovered.zone, false);
    const p = lastPointRef.current;
    hovered.zone.current.onDragLeave?.(dataRef.current, { x: p.x, y: p.y, type: typeRef.current, data: dataRef.current });
    hoveredRef.current = null;
  };

  const findHover = (x: number, y: number) => {
    lastPointRef.current = { x, y };
    const found = zoneAt(x, y, typeRef.current);
    const hovered = hoveredRef.current;
    if (found?.nodeId === hovered?.nodeId) return found;
    leaveHovered();
    if (found) {
      hoveredRef.current = found;
      setZoneActive(found.zone, true);
      found.zone.current.onDragEnter?.(dataRef.current, { x, y, type: typeRef.current, data: dataRef.current });
    }
    return found;
  };

  const reset = () => {
    activeRef.current = false;
    startRef.current = null;
    cancelledRef.current = false;
    setOffset(null);
    leaveHovered();
  };

  const finish = (x: number, y: number) => {
    const wasActive = activeRef.current;
    const cancelled = cancelledRef.current;
    let dropped = false;
    if (wasActive && !cancelled) {
      const found = zoneAt(x, y, typeRef.current);
      if (found) {
        found.zone.current.onDrop?.(dataRef.current, { x, y, type: typeRef.current, data: dataRef.current });
        dropped = true;
      }
    }
    reset();
    if (wasActive) {
      callbacksRef.current.onDragStateChange?.(false);
      callbacksRef.current.onDragEnd?.({ x, y, type: typeRef.current, data: dataRef.current, dropped });
    }
  };

  const dragMount = useDraggable({
    onDragStart: ({ x, y }: DragPoint) => {
      if (disabledRef.current) return;
      startRef.current = { x, y };
      activeRef.current = false;
      cancelledRef.current = false;
    },
    onDragMove: ({ x, y }: DragPoint) => {
      if (disabledRef.current || cancelledRef.current) return;
      const start = startRef.current;
      if (!start) return;
      const dx = x - start.x;
      const dy = y - start.y;
      if (!activeRef.current) {
        if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;
        activeRef.current = true;
        setOffset({ dx, dy });
        callbacksRef.current.onDragStart?.({ x, y, type: typeRef.current, data: dataRef.current });
        callbacksRef.current.onDragStateChange?.(true);
      } else {
        setOffset({ dx, dy });
      }
      findHover(x, y);
      callbacksRef.current.onDragMove?.({ x, y, type: typeRef.current, data: dataRef.current });
    },
    onDragEnd: ({ x, y }: DragPoint) => finish(x, y),
  });

  const onMount = useCallback((id: number) => {
    nodeIdRef.current = id;
    dragMount(id);
    externalOnMount?.(id);
  }, [dragMount, externalOnMount]);

  // Escape cancels: nothing is dropped and the item snaps back. The native
  // button may stay down; Draggable ignores moves until dragEnd resets it.
  useEffect(() => {
    if (!offset) return;
    const onKey = (ev: any) => {
      if (ev?.key !== 'Escape' && ev?.key !== 'Esc') return false;
      if (!activeRef.current) return false;
      cancelledRef.current = true;
      setOffset(null);
      leaveHovered();
      callbacksRef.current.onDragStateChange?.(false);
      return true;
    };
    addKeyListener(onKey);
    return () => removeKeyListener(onKey);
  }, [offset]);

  const base = flattenStyle(style) ?? {};
  const dragStyle = offset && lift
    ? {
        ...base,
        transform: `translate(${offset.dx}px, ${offset.dy}px)${base.transform ? ` ${base.transform}` : ''}`,
        opacity: 0.92,
        zIndex: 9999,
      }
    : style;

  return React.createElement(
    View,
    { _glyxOnMount: onMount, pressable: true, width, height, style: dragStyle },
    children,
  );
}

// ── Sortable lists ────────────────────────────────────────────────────────────

/** The marker SortableList/Board put on a Draggable's data. */
export interface SortableDragData<T = unknown> {
  __glyxSortable: true;
  listId: string;
  index: number;
  item: T;
}

function sortableData(data: unknown): data is SortableDragData {
  return Boolean(data && typeof data === 'object' && (data as any).__glyxSortable === true);
}

/** Insertion boundary (0…items.length) from a pointer and the item rects, top-to-bottom or left-to-right. */
export function insertionIndex(
  rects: ReadonlyArray<{ boxX: number; boxY: number; boxWidth: number; boxHeight: number }>,
  x: number,
  y: number,
  direction: 'vertical' | 'horizontal' = 'vertical',
): number {
  for (let i = 0; i < rects.length; i++) {
    const r = rects[i];
    const mid = direction === 'horizontal'
      ? r.boxX + r.boxWidth / 2
      : r.boxY + r.boxHeight / 2;
    const pointer = direction === 'horizontal' ? x : y;
    if (pointer < mid) return i;
  }
  return rects.length;
}

/**
 * `insertionIndex` for a long list without measuring every item: the items are in order, so the boundary is found by bisection, asking for
 * `log2(count)` rectangles (each one a native call) instead of all of them. `rectAt` returns null for an item that is not on screen; as soon
 * as one is met the search falls back to the plain scan, which skips such items as `rects()` always did.
 */
export function insertionIndexLazy(
  count: number,
  rectAt: (index: number) => { boxX: number; boxY: number; boxWidth: number; boxHeight: number } | null,
  x: number,
  y: number,
  direction: 'vertical' | 'horizontal' = 'vertical',
): number {
  const pointer = direction === 'horizontal' ? x : y;
  const mid = (r: { boxX: number; boxY: number; boxWidth: number; boxHeight: number }) =>
    direction === 'horizontal' ? r.boxX + r.boxWidth / 2 : r.boxY + r.boxHeight / 2;
  // The first index whose midpoint is below the pointer, among 0..count (count meaning "after the last").
  let lo = 0;
  let hi = count;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    const r = rectAt(m);
    if (!r) {
      const rects: { boxX: number; boxY: number; boxWidth: number; boxHeight: number }[] = [];
      for (let i = 0; i < count; i++) { const ri = rectAt(i); if (ri) rects.push(ri); }
      return insertionIndex(rects, x, y, direction);
    }
    if (pointer < mid(r)) hi = m; else lo = m + 1;
  }
  return lo;
}

/** The final index after removing `from` and inserting at boundary `insertAt` in the same list. */
export function dropIndex(from: number, insertAt: number, length: number): number {
  const before = Math.max(0, Math.min(length, insertAt));
  return from < before ? before - 1 : before;
}

/** A new array with `from` moved to final index `to`; returns a copy when unchanged. */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = items.slice();
  if (from < 0 || from >= next.length) return next;
  const clamped = Math.max(0, Math.min(next.length - 1, to));
  if (clamped === from) return next;
  const [item] = next.splice(from, 1);
  next.splice(clamped, 0, item);
  return next;
}

export interface SortableRenderState {
  dragging: boolean;
}

export interface SortableListProps<T> {
  items: readonly T[];
  getKey: (item: T, index: number) => string | number;
  renderItem: (item: T, index: number, state: SortableRenderState) => React.ReactNode;
  /** Reorder within this list. `to` is the final index in the shortened array. */
  onReorder?: (from: number, to: number, item: T) => void;
  /** An item dragged in from another list. `to` is its index in this list. */
  onTransfer?: (item: unknown, from: { listId?: string; index: number }, to: number) => void;
  /** A plain Draggable dropped on the list (data that is not from a SortableList). */
  onDrop?: DragHandler;
  /** Stable id used to tell a move inside the list from a transfer. */
  listId?: string;
  /** `type` of the Draggables and what the list accepts. Default `sortable-item`. */
  type?: string;
  accepts?: string | string[];
  direction?: 'vertical' | 'horizontal';
  gap?: number;
  style?: StyleProp;
  /** Merged into `style` while a compatible drag is over the list. */
  activeStyle?: StyleProp;
  itemStyle?: StyleProp;
  /** Shown in place of the items when `items` is empty. */
  empty?: React.ReactNode;
  /** Minimum height of the drop area, so an empty column can still receive a card. */
  minHeight?: GlyxLength;
  disabled?: boolean;
  /** Hide the insertion line (the active style still shows the target). */
  showIndicator?: boolean;
  /** Lift the item itself while dragging (default true). Board turns this off and draws one preview above the columns. */
  lift?: boolean;
  /** An item started dragging from this list, with the pointer position. */
  onDragStart?: (item: T, index: number, info: DropInfo) => void;
  /** The pointer moved while an item from this list is dragged. */
  onDragMove?: (item: T, index: number, info: DropInfo) => void;
  /** The drag ended (or Escape cancelled it); `dropped` says whether a zone took it. */
  onDragEnd?: (item: T, index: number, info: DragEndInfo) => void;
}

let sortableSeq = 0;

export function SortableList<T>({
  items, getKey, renderItem, onReorder, onTransfer, onDrop,
  listId: listIdProp, type = 'sortable-item', accepts,
  direction = 'vertical', gap = 8, style, activeStyle, itemStyle,
  empty = null, minHeight, disabled = false, showIndicator = true, lift = true,
  onDragStart, onDragMove, onDragEnd,
}: SortableListProps<T>): React.ReactElement {
  const listId = useRef(listIdProp ?? `sortable-${++sortableSeq}`).current;
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [indicator, setIndicator] = useState<{ top?: number; left?: number; width?: number; height?: number } | null>(null);
  const listNodeId = useRef<number | null>(null);
  const itemNodes = useRef<Map<string, number>>(new Map());
  const itemsRef = useRef(items);
  itemsRef.current = items;
  const getKeyRef = useRef(getKey);
  getKeyRef.current = getKey;
  const directionRef = useRef(direction);
  directionRef.current = direction;
  const gapRef = useRef(gap);
  gapRef.current = gap;
  const showIndicatorRef = useRef(showIndicator);
  showIndicatorRef.current = showIndicator;

  const keyFor = useCallback((item: T, index: number) => String(getKeyRef.current(item, index)), []);

  // Clear registrations for items no longer rendered. (Draggable has no
  // unmount hook; dropping by key here is enough because ids are never reused.)
  useEffect(() => {
    const live = new Set(items.map((item, i) => keyFor(item, i)));
    for (const key of [...itemNodes.current.keys()]) if (!live.has(key)) itemNodes.current.delete(key);
  }, [items, keyFor]);

  const rects = useCallback(() => {
    const out: Rect[] = [];
    for (let i = 0; i < itemsRef.current.length; i++) {
      const id = itemNodes.current.get(keyFor(itemsRef.current[i], i));
      if (id == null) continue;
      const r = layoutOf(id);
      if (r) out.push(r);
    }
    return out;
  }, [keyFor]);

  // Where the indicator was last put (the boundary and the list's length). A pointer that moves within the same gap changes nothing on
  // screen, so it must not cost a render of the whole list (every `renderItem`), nor the measuring of every item, on each of its moves.
  const lastAt = useRef<{ at: number; n: number } | null>(null);

  const updateIndicator = useCallback((x: number, y: number) => {
    if (!showIndicatorRef.current) { setIndicator(null); return; }
    const listIdNode = listNodeId.current;
    const list = listIdNode != null ? layoutOf(listIdNode) : null;
    const n = itemsRef.current.length;
    const rectAt = (i: number) => {
      const id = itemNodes.current.get(keyFor(itemsRef.current[i], i));
      return id == null ? null : layoutOf(id);
    };
    if (!list || n === 0) { lastAt.current = null; setIndicator(null); return; }
    const at = insertionIndexLazy(n, rectAt, x, y, directionRef.current);
    if (lastAt.current && lastAt.current.at === at && lastAt.current.n === n) return;
    lastAt.current = { at, n };
    // Only the neighbours of the boundary are needed to place the line.
    const before = at > 0 ? rectAt(at - 1) : null;
    const after = at < n ? rectAt(at) : null;
    const horizontal = directionRef.current === 'horizontal';
    const edge = after ?? before;
    if (!edge) { setIndicator(null); return; }
    if (horizontal) {
      const left = (after ? edge.boxX - gapRef.current / 2 : edge.boxX + edge.boxWidth + gapRef.current / 2) - list.boxX;
      setIndicator({ left, top: 0, width: 2, height: list.boxHeight });
    } else {
      const top = (after ? edge.boxY - gapRef.current / 2 : edge.boxY + edge.boxHeight + gapRef.current / 2) - list.boxY;
      setIndicator({ top, left: 0, width: list.boxWidth, height: 2 });
    }
  }, [rects]);

  const handleDrop = useCallback((data: unknown, info: DropInfo) => {
    setIndicator(null);
    lastAt.current = null;
    if (!sortableData(data)) { onDrop?.(data, info); return; }
    const rs = rects();
    const at = insertionIndex(rs, info.x, info.y, directionRef.current);
    if (data.listId === listId) {
      const to = dropIndex(data.index, at, itemsRef.current.length);
      if (to !== data.index) onReorder?.(data.index, to, data.item as T);
    } else {
      onTransfer?.(data.item, { listId: data.listId, index: data.index }, at);
    }
  }, [listId, onDrop, onReorder, onTransfer, rects]);

  const onItemDrag = useCallback((key: string, active: boolean) => {
    setDraggingKey(active ? key : null);
    if (!active) { setIndicator(null); lastAt.current = null; }
  }, []);

  const children = items.length === 0 && empty
    ? empty
    : items.map((item, index) => {
        const key = keyFor(item, index);
        const data: SortableDragData<T> = { __glyxSortable: true, listId, index, item };
        return React.createElement(
          Draggable,
          {
            key,
            type,
            data,
            disabled,
            lift,
            style: [{ marginBottom: direction === 'vertical' ? gap : 0, marginRight: direction === 'horizontal' ? gap : 0 }, itemStyle],
            onMount: (id: number) => itemNodes.current.set(key, id),
            onDragStart: (info: DropInfo) => onDragStart?.(item, index, info),
            onDragMove: (info: DropInfo) => onDragMove?.(item, index, info),
            onDragEnd: (info: DragEndInfo) => onDragEnd?.(item, index, info),
            onDragStateChange: (active: boolean) => onItemDrag(key, active),
          },
          renderItem(item, index, { dragging: draggingKey === key }),
        );
      });

  const baseStyle = {
    position: 'relative' as const,
    flexDirection: direction === 'horizontal' ? ('row' as const) : ('column' as const),
    minHeight,
    ...flattenStyle(style),
  };

  return React.createElement(
    DropZone,
    {
      accepts: accepts ?? type,
      style: baseStyle,
      activeStyle,
      onMount: (id: number) => { listNodeId.current = id; },
      onDragEnter: (_data: unknown, info: DropInfo) => { if (sortableData(_data)) updateIndicator(info.x, info.y); },
      onDragOver:  (_data: unknown, info: DropInfo) => { if (sortableData(_data)) updateIndicator(info.x, info.y); },
      onDragLeave: () => { lastAt.current = null; setIndicator(null); },
      onDrop: handleDrop,
    },
    children,
    indicator && showIndicator
      ? React.createElement(View, {
          pointerEvents: 'none',
          style: {
            position: 'absolute',
            ...indicator,
            backgroundColor: '#5c6bc0',
            borderRadius: 1,
            zIndex: 1000,
          },
        })
      : null,
  );
}

// ── Board ─────────────────────────────────────────────────────────────────────

export interface BoardColumn<T> {
  /** Stable id; also the SortableList id used for moves between columns. */
  id: string;
  title?: React.ReactNode;
  items: readonly T[];
  /** Accent for the column's top border. */
  color?: string;
}

export interface BoardMove<T> {
  item: T;
  from: { column: string; index: number };
  to: { column: string; index: number };
}

export interface BoardRenderState {
  columnId: string;
  index: number;
  dragging: boolean;
}

export interface BoardProps<T> {
  columns: readonly BoardColumn<T>[];
  getKey: (item: T, index: number) => string | number;
  renderCard: (item: T, state: BoardRenderState) => React.ReactNode;
  /** Move one card, within a column or across columns. Apply it to your own state. */
  onMove?: (move: BoardMove<T>) => void;
  /** Fixed column width (default 280). */
  columnWidth?: number;
  /** Space between columns, and between cards in a column (default 12 / 8). */
  gap?: number;
  cardGap?: number;
  style?: StyleProp;
  columnStyle?: StyleProp;
  cardStyle?: StyleProp;
  /** Added under each column's cards; e.g. an "Add card" button. */
  renderColumnFooter?: (column: BoardColumn<T>) => React.ReactNode;
  /** Shown in place of the cards of an empty column. */
  renderEmpty?: (column: BoardColumn<T>) => React.ReactNode;
  /** Draws the card that follows the pointer above the columns. Defaults to `renderCard` with `dragging: false`. */
  renderDragPreview?: (item: T, state: BoardRenderState) => React.ReactNode;
  disabled?: boolean;
  /** Hide the insertion line while dragging. */
  showIndicator?: boolean;
  /** Horizontal scrolling for many columns (default true); needs a bounded width. */
  scrollable?: boolean;
  height?: GlyxLength;
}

export function Board<T>({
  columns, getKey, renderCard, onMove,
  columnWidth = 280, gap = 12, cardGap = 8,
  style, columnStyle, cardStyle,
  renderColumnFooter, renderEmpty, renderDragPreview, disabled = false, showIndicator = true,
  scrollable = true, height,
}: BoardProps<T>): React.ReactElement {
  const boardNodeId = useRef<number | null>(null);
  const overlayRef = useRef<DragOverlayHandle | null>(null);
  const [drag, setDrag] = useState<{ item: T; columnId: string; index: number; x: number; y: number } | null>(null);

  const move = (item: T, fromColumn: string, fromIndex: number, toColumn: string, toIndex: number) => {
    if (fromColumn === toColumn && fromIndex === toIndex) return;
    onMove?.({ item, from: { column: fromColumn, index: fromIndex }, to: { column: toColumn, index: toIndex } });
  };

  const cols = columns.map((column) => {
    const list = React.createElement(
      SortableList<T>,
      {
        key: column.id,
        listId: column.id,
        items: column.items,
        getKey,
        disabled,
        lift: false,
        gap: cardGap,
        showIndicator,
        minHeight: 120,
        style: { flexGrow: 1 },
        itemStyle: cardStyle,
        empty: renderEmpty?.(column) ?? null,
        renderItem: (item: T, index: number, state: SortableRenderState) =>
          renderCard(item, { columnId: column.id, index, dragging: state.dragging }),
        onDragStart: (item: T, index: number, info: DropInfo) => {
          setDrag({ item, columnId: column.id, index, x: info.x, y: info.y });
          overlayRef.current?.move(info.x, info.y);
        },
        onDragMove: (_item: T, _index: number, info: DropInfo) => {
          overlayRef.current?.move(info.x, info.y);
        },
        onDragEnd: () => setDrag(null),
        onReorder: (from: number, to: number, item: T) => move(item, column.id, from, column.id, to),
        onTransfer: (item: unknown, from: { listId?: string; index: number }, to: number) => {
          if (from.listId) move(item as T, from.listId, from.index, column.id, to);
        },
      },
    );

    return React.createElement(
      View,
      {
        key: column.id,
        style: [
          {
            width: columnWidth,
            flexShrink: 0,
            height: '100%',
            backgroundColor: '#171722',
            borderRadius: 10,
            borderWidth: 1,
            borderColor: '#2a2a3a',
            borderTopWidth: 3,
            borderTopColor: column.color ?? '#5c6bc0',
            padding: 10,
            gap: 8,
          },
          columnStyle,
        ],
      },
      React.createElement(
        View,
        { style: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 } },
        typeof column.title === 'string'
          ? React.createElement(Text, { style: { fontSize: 14, fontWeight: 'bold', color: '#e6e6f0' } }, column.title)
          : column.title,
        React.createElement(Text, { style: { fontSize: 12, color: '#8c8caa' } }, String(column.items.length)),
      ),
      // A vertical ScrollView gives a long column its own scrollbar; drag
      // hit-testing uses the visible (clipped) rect, so a card below the fold
      // cannot be dropped on while it is out of view.
      React.createElement(
        ScrollView,
        { style: { flexGrow: 1, flexShrink: 1 }, showScrollbar: true },
        list,
      ),
      renderColumnFooter?.(column) ?? null,
    );
  });

  const row = React.createElement(
    View,
    {
      style: [
        {
          flexDirection: 'row',
          alignItems: 'stretch',
          gap,
          height: height ?? '100%',
          ...(scrollable ? { minWidth: columns.length * (columnWidth + gap) } : null),
        },
        style,
      ],
    },
    cols,
  );

  const content = scrollable
    ? React.createElement(ScrollView, { horizontal: true, style: { flex: 1 }, height }, row)
    : row;

  return React.createElement(
    View,
    {
      _glyxOnMount: (id: number) => { boardNodeId.current = id; },
      style: { flex: 1, position: 'relative', height },
    },
    content,
    drag
      ? React.createElement(BoardDragOverlay, {
          ref: overlayRef,
          item: drag.item,
          columnId: drag.columnId,
          index: drag.index,
          width: Math.max(80, columnWidth - 20),
          originRef: boardNodeId,
          initial: { x: drag.x, y: drag.y },
          render: (item: unknown, state: BoardRenderState) =>
            (renderDragPreview ?? renderCard)(item as T, state),
        })
      : null,
  );
}

// ── The board's drag preview ─────────────────────────────────────────────────

interface DragOverlayHandle {
  move(x: number, y: number): void;
}

interface DragOverlayProps {
  item: unknown;
  columnId: string;
  index: number;
  width: number;
  originRef: React.MutableRefObject<number | null>;
  initial: { x: number; y: number };
  render: (item: unknown, state: BoardRenderState) => React.ReactNode;
}

// One card above every column, outside their ScrollViews. The source card stays
// in place (dimmed) as the placeholder; this layer follows the pointer. It has
// its own position state, so a pointer move re-renders one small node rather
// than the whole board.
const BoardDragOverlay = React.forwardRef<DragOverlayHandle, DragOverlayProps>(
  function BoardDragOverlay({ item, columnId, index, width, originRef, initial, render }, ref) {
    const [pos, setPos] = useState<{ x: number; y: number } | null>(null);

    const move = useCallback((x: number, y: number) => {
      const origin = originRef.current != null ? layoutOf(originRef.current) : null;
      const ox = origin?.boxX ?? 0;
      const oy = origin?.boxY ?? 0;
      setPos({ x: x - ox - width / 2, y: y - oy - 26 });
    }, [originRef, width]);

    useImperativeHandle(ref, () => ({ move }), [move]);
    useEffect(() => { move(initial.x, initial.y); }, [move, initial.x, initial.y]);

    return React.createElement(
      View,
      {
        pointerEvents: 'none',
        style: {
          position: 'absolute',
          left: pos?.x ?? -10000,
          top: pos?.y ?? -10000,
          width,
          zIndex: 10000,
          opacity: 0.97,
          boxShadow: '0 14px 34px rgba(0,0,0,0.45)',
        },
      },
      render(item, { columnId, index, dragging: false }),
    );
  },
);
