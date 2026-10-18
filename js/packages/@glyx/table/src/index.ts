// @glyx-dev/table — data table with sortable + resizable columns, selection, and
// virtualized rows (built on @glyx-dev/react VirtualizedList + measureText).
//
//   import { DataTable } from '@glyx-dev/table';
//   <DataTable columns={cols} rows={rows} width={W} height={H}
//              selectable onRowPress={r => open(r)} />
//
// Column: { key, label, width?, minWidth?, sortable?, align?, render?(value,row) }

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, ScrollView, VirtualizedList, measureText, useDraggable } from '@glyx-dev/react';

export type SortDirection = 'asc' | 'desc';

/** One column of a {@link DataTable}. */
export interface DataTableColumn<Row = any> {
  /** The property of each row this column shows, and the sort key. Also the React key, so keep it unique. */
  key:        string;
  /** Header text (shown in capitals). */
  label:      string;
  /** Fixed width in px. Without it the column is sized to its header and the first rows (between `minWidth` and 320). */
  width?:     number;
  /** The narrowest the column may be, including when the user drags its edge (default 64 for auto-sizing, 48 for dragging). */
  minWidth?:  number;
  /** Clicking the header sorts by this column. */
  sortable?:  boolean;
  /** Horizontal alignment of the cell content (default `'left'`). */
  align?:     'left' | 'right';
  /** Draws the cell yourself, instead of the value as text. */
  render?:    (value: any, row: Row) => React.ReactNode;
}

export interface DataTableProps<Row = any> {
  columns:      DataTableColumn<Row>[];
  rows:         Row[];
  /** Height of each row in px (default 44). */
  rowHeight?:   number;
  /** Total height of the table, header included. The body scrolls and is virtualized inside it. */
  height:       number;
  width?:       number;
  /** Called with the row when it is pressed. */
  onRowPress?:  (row: Row) => void;
  /** Called when the user sorts by a column. The table sorts the rows itself; this is for you to remember or sync it. */
  onSort?:      (key: string, direction: SortDirection) => void;
  /** Show a checkbox column. */
  selectable?:  boolean;
  /** Identifies a row for selection (default: the row's `id` property, or its position when it has none). */
  getRowId?:    (row: Row, index: number) => string | number;
}

const HEADER_FS = 12;
const CELL_FS   = 13;

// Auto-size a column to the widest of its header + sampled cell values.
function autoWidth(col: DataTableColumn, rows: readonly any[], sample = 40): number {
  if (col.width) return col.width;
  let w = measureText(String(col.label).toUpperCase(), HEADER_FS).width + 24;
  const n = Math.min(rows.length, sample);
  for (let i = 0; i < n; i++) {
    const v = col.render ? null : rows[i]?.[col.key];
    if (v == null) continue;
    w = Math.max(w, measureText(String(v), CELL_FS).width + 24);
  }
  return Math.max(col.minWidth || 64, Math.min(w, 320));
}

interface HeaderCellProps {
  col:      DataTableColumn;
  width:    number;
  sorted:   boolean;
  dir:      SortDirection;
  onSort:   () => void;
  onResize: (dx: number) => void;
}

function ResizableHeaderCell({ col, width, sorted, dir, onSort, onResize }: HeaderCellProps) {
  const onHandle = useDraggable({ onDragMove: ({ dx }: { dx: number }) => onResize(dx) });
  // flexShrink 0: when the columns are wider than the table, cells keep their width (and stay lined up
  // with the body) instead of being squeezed to fit.
  return React.createElement(View, { style: { flexDirection: 'row', alignItems: 'stretch', flexShrink: 0 } },
    React.createElement(Pressable, {
      onPress: () => col.sortable && onSort(),
      width: width - 6, height: 40,
      style: { paddingHorizontal: 12, justifyContent: 'center', flexDirection: 'row', alignItems: 'center', gap: 4 },
    },
      React.createElement(Text, { fontSize: HEADER_FS, style: { color: '#888899', fontWeight: '600' } },
        String(col.label).toUpperCase()),
      col.sortable && sorted && React.createElement(Text, { fontSize: 10, style: { color: '#00A878' } },
        dir === 'asc' ? '↑' : '↓'),
    ),
    // 6px draggable resize handle on the column's right edge.
    React.createElement(View, {
      _glyxOnMount: onHandle, pressable: true, width: 6, height: 40,
      style: { cursor: 'col-resize', backgroundColor: 'transparent' },
    }),
  );
}

/**
 * A table with sortable and resizable columns, optional row selection, and virtualized rows.
 *
 * When the columns are wider than `width` the table scrolls sideways (wheel deltaX, Shift+wheel, or the
 * scrollbar at the bottom), the header moving with the columns; the rows still scroll up and down under it.
 *
 * ```tsx
 * <DataTable
 *   columns={[{ key: 'name', label: 'Name', sortable: true }, { key: 'size', label: 'Size', align: 'right' }]}
 *   rows={files}
 *   height={400}
 *   onRowPress={(file) => open(file)}
 * />
 * ```
 */
export function DataTable<Row = any>({
  columns, rows, rowHeight = 44, height, width,
  onRowPress, onSort, selectable = false, getRowId,
}: DataTableProps<Row>) {
  const idOf: (row: Row, index: number) => string | number =
    getRowId || ((r: any, i: number) => (r?.id ?? i));

  const [widths, setWidths] = useState<number[]>(() => columns.map((c) => autoWidth(c, rows)));
  // Recompute widths when the column list length changes or column keys change.
  const colKey = columns.map((c) => c.key).join(',');
  useEffect(() => {
    setWidths(columns.map((c) => autoWidth(c, rows)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colKey]);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDirection>('asc');
  const [selected, setSelected] = useState<Set<string | number>>(() => new Set());

  const HEADER_H = 40;
  const selW = selectable ? 40 : 0;

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const copy = rows.slice();
    copy.sort((a: any, b: any) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av === bv) return 0;
      const r = av > bv ? 1 : -1;
      return sortDir === 'asc' ? r : -r;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const doSort = useCallback((key: string) => {
    const dir: SortDirection = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    setSortKey(key); setSortDir(dir);
    onSort?.(key, dir);
  }, [sortKey, sortDir, onSort]);

  const resize = useCallback((i: number, dx: number) => {
    setWidths((w: number[]) => { const n = w.slice(); n[i] = Math.max(columns[i].minWidth || 48, n[i] + dx); return n; });
  }, [columns]);

  // Columns wider than the table: lay them out at their full width inside a horizontal scroller.
  const totalW = selW + widths.reduce((a: number, b: number) => a + b, 0);
  const scrollsX = width != null && totalW > width;
  const contentW = scrollsX ? totalW : width;

  const header = React.createElement(View, {
    style: { flexDirection: 'row', backgroundColor: '#14141A', borderBottomWidth: 1, borderColor: '#2A2A3A' },
    width: contentW, height: HEADER_H,
  },
    selectable && React.createElement(View, { width: selW, height: HEADER_H }),
    ...columns.map((col, i) => React.createElement(ResizableHeaderCell, {
      key: String(col.key),
      col, width: widths[i],
      sorted: sortKey === col.key, dir: sortDir,
      onSort: () => doSort(col.key),
      onResize: (dx: number) => resize(i, dx),
    })),
  );

  const renderRow = useCallback((row: Row, index: number) => {
    const rid = idOf(row, index);
    return React.createElement(Pressable, {
      onPress: () => onRowPress?.(row),
      width: contentW, height: rowHeight,
      style: {
        flexDirection: 'row',
        backgroundColor: selected.has(rid) ? 'rgba(0,168,120,0.10)' : 'transparent',
        borderBottomWidth: 1, borderColor: '#1C1C26',
      },
    },
      selectable && React.createElement(Pressable, {
        onPress: () => setSelected((s) => { const n = new Set(s); n.has(rid) ? n.delete(rid) : n.add(rid); return n; }),
        width: selW, height: rowHeight,
        style: { justifyContent: 'center', alignItems: 'center' },
      }, React.createElement(View, {
        style: {
          width: 16, height: 16, borderRadius: 4, borderWidth: 2,
          borderColor: selected.has(rid) ? '#00A878' : '#555',
          backgroundColor: selected.has(rid) ? '#00A878' : 'transparent',
        },
      })),
      ...columns.map((col, i) => React.createElement(View, {
        key: String(col.key), width: widths[i], height: rowHeight,
        style: { paddingHorizontal: 12, justifyContent: 'center', alignItems: col.align === 'right' ? 'flex-end' : 'flex-start', flexShrink: 0 },
      },
        col.render ? col.render((row as any)[col.key], row)
                   : React.createElement(Text, { fontSize: CELL_FS, style: { color: '#A0A0B2' } }, String((row as any)[col.key] ?? '')),
      )),
    );
  }, [columns, widths, selected, selectable, rowHeight, contentW, onRowPress]); // eslint-disable-line

  const body = [
    header,
    React.createElement(VirtualizedList, {
      data: sortedRows, itemHeight: rowHeight, width: contentW, height: height - HEADER_H,
      keyExtractor: (r: Row, i: number) => String(idOf(r, i)),
      renderItem: ({ item, index }: { item: Row; index: number }) => renderRow(item, index),
    }),
  ];

  return React.createElement(View, {
    width, style: { borderRadius: 8, borderWidth: 1, borderColor: '#2A2A3A', overflow: 'hidden' },
  },
    ...(scrollsX
      ? [React.createElement(ScrollView, { horizontal: true, width, height },
          React.createElement(View, { width: contentW }, ...body))]
      : body),
  );
}
