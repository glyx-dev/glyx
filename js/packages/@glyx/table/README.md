# @glyx-dev/table

Data table: sortable + resizable columns, selection, virtualized rows.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/table
# or npm install @glyx-dev/table
```

## Usage

```jsx
import { DataTable } from '@glyx-dev/table';

<DataTable
  columns={cols}
  rows={rows}
  width={W}
  height={H}
  selectable
  onRowPress={(r) => open(r)}
/>;
```

Each column is `{ key, label, width?, minWidth?, sortable?, align?, render?(value, row) }`. Columns without an explicit `width` are auto-sized to the widest of their header and a sample of cell values (clamped between `minWidth` and 320px). Rows are rendered with `@glyx-dev/react`'s `VirtualizedList`, so large datasets stay cheap to scroll.

## API

- `DataTable({ columns, rows, rowHeight = 44, height, width, onRowPress, onSort, selectable = false, getRowId })` — the table component. Column headers are draggable-resizable and, when `sortable`, clickable to toggle ascending/descending sort (calls `onSort(key, dir)`). With `selectable`, each row gets a checkbox and `getRowId` (default `(r, i) => r?.id ?? i`) determines the row identity used for the selection `Set`.
