// @glyx-dev/table — data table with sortable + resizable columns, selection, and
// virtualized rows (built on @glyx-dev/react VirtualizedList + measureText).
//
//   import { DataTable } from '@glyx-dev/table';
//   <DataTable columns={cols} rows={rows} width={W} height={H}
//              selectable onRowPress={r => open(r)} />
//
// Column: { key, label, width?, minWidth?, sortable?, align?, render?(value,row) }

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, Pressable, VirtualizedList, measureText, useDraggable } from '@glyx-dev/react';

const HEADER_FS = 12;
const CELL_FS   = 13;

// Auto-size a column to the widest of its header + sampled cell values.
function autoWidth(col, rows, sample = 40) {
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

function ResizableHeaderCell({ col, width, sorted, dir, onSort, onResize }) {
  const onHandle = useDraggable({ onDragMove: ({ dx }) => onResize(dx) });
  return React.createElement(View, { style: { flexDirection: 'row', alignItems: 'stretch' } },
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

export function DataTable({
  columns, rows, rowHeight = 44, height, width,
  onRowPress, onSort, selectable = false, getRowId,
}) {
  const idOf = getRowId || ((r, i) => (r?.id ?? i));

  const [widths, setWidths] = useState(() => columns.map((c) => autoWidth(c, rows)));
  // Recompute widths when the column list length changes or column keys change.
  const colKey = columns.map((c) => c.key).join(',');
  useEffect(() => {
    setWidths(columns.map((c) => autoWidth(c, rows)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [colKey]);
  const [sortKey, setSortKey] = useState(null);
  const [sortDir, setSortDir] = useState('asc');
  const [selected, setSelected] = useState(() => new Set());

  const HEADER_H = 40;
  const selW = selectable ? 40 : 0;

  const sortedRows = useMemo(() => {
    if (!sortKey) return rows;
    const copy = rows.slice();
    copy.sort((a, b) => {
      const av = a[sortKey], bv = b[sortKey];
      if (av === bv) return 0;
      const r = av > bv ? 1 : -1;
      return sortDir === 'asc' ? r : -r;
    });
    return copy;
  }, [rows, sortKey, sortDir]);

  const doSort = useCallback((key) => {
    const dir = sortKey === key && sortDir === 'asc' ? 'desc' : 'asc';
    setSortKey(key); setSortDir(dir);
    onSort?.(key, dir);
  }, [sortKey, sortDir, onSort]);

  const resize = useCallback((i, dx) => {
    setWidths((w) => { const n = w.slice(); n[i] = Math.max(columns[i].minWidth || 48, n[i] + dx); return n; });
  }, [columns]);

  const header = React.createElement(View, {
    style: { flexDirection: 'row', backgroundColor: '#14141A', borderBottomWidth: 1, borderColor: '#2A2A3A' },
    width, height: HEADER_H,
  },
    selectable && React.createElement(View, { width: selW, height: HEADER_H }),
    ...columns.map((col, i) => React.createElement(ResizableHeaderCell, {
      key: String(col.key),
      col, width: widths[i],
      sorted: sortKey === col.key, dir: sortDir,
      onSort: () => doSort(col.key),
      onResize: (dx) => resize(i, dx),
    })),
  );

  const renderRow = useCallback((row) => {
    const rid = idOf(row);
    return React.createElement(Pressable, {
      onPress: () => onRowPress?.(row),
      width, height: rowHeight,
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
        style: { paddingHorizontal: 12, justifyContent: 'center', alignItems: col.align === 'right' ? 'flex-end' : 'flex-start' },
      },
        col.render ? col.render(row[col.key], row)
                   : React.createElement(Text, { fontSize: CELL_FS, style: { color: '#A0A0B2' } }, String(row[col.key] ?? '')),
      )),
    );
  }, [columns, widths, selected, selectable, rowHeight, width, onRowPress]); // eslint-disable-line

  return React.createElement(View, {
    width, style: { borderRadius: 8, borderWidth: 1, borderColor: '#2A2A3A', overflow: 'hidden' },
  },
    header,
    React.createElement(VirtualizedList, {
      data: sortedRows, itemHeight: rowHeight, width, height: height - HEADER_H,
      keyExtractor: (r, i) => String(idOf(r, i)),
      renderItem: ({ item }) => renderRow(item),
    }),
  );
}
