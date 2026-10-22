# @glyx-dev/drag-drop

Drag-and-drop primitives built on native drag events, plus sortable lists and a
kanban `Board` built from the same primitives.

Full docs: [glyx.dev](https://glyx.dev/docs/packages/drag-drop)

## Install

```sh
bun add @glyx-dev/drag-drop
# or npm install @glyx-dev/drag-drop
```

## Primitives

`Draggable` makes a view draggable. `DropZone` registers a drop target. Targets
are matched by hit-testing the pointer against each zone's live, clipped layout
rect at drop time — there is no HTML5 drag-and-drop and no DOM.

```tsx
import { Draggable, DropZone } from '@glyx-dev/drag-drop'

<Draggable data={card} type="card">
  <Card />
</Draggable>

<DropZone
  accepts="card"
  activeStyle={{ borderColor: '#5c6bc0' }}
  onDrop={(card, { x, y }) => moveTo(column, card)}
>
  <Column />
</DropZone>
```

- `Draggable` starts a drag after the pointer moves 4 px, so click handlers
  inside the item still work. Escape cancels a drag; the item snaps back.
- `accepts` accepts one type or an array; omit it to accept every type.
- `onDragStart`, `onDragMove` and `onDragEnd` receive one event object:
  `{ x, y, type, data }` (`onDragEnd` also gets `dropped: boolean`).
- `Draggable` lifts the item with a transform by default. Set `lift={false}`
  when a parent draws its own drag preview.

## SortableList

`SortableList` adds an insertion line, a dimmed source item and reordering
within one list. Dragging between two sortable lists goes through
`onTransfer`; it fires on the destination, so the handler must remove the item
from the source array as well as insert it into the target.

```tsx
import { SortableList, moveItem } from '@glyx-dev/drag-drop'

function Playlist() {
  const [tracks, setTracks] = useState(initialTracks)

  return (
    <SortableList
      items={tracks}
      listId="playlist"
      getKey={(track) => track.id}
      onReorder={(from, to) => setTracks((items) => moveItem(items, from, to))}
      renderItem={(track, _index, { dragging }) => (
        <View style={{ opacity: dragging ? 0.4 : 1 }}>
          <Text>{track.title}</Text>
        </View>
      )}
    />
  )
}
```

`SortableList` props:

| Prop | Purpose |
|------|---------|
| `items`, `getKey`, `renderItem` | The data and how each item renders. `renderItem(item, index, { dragging })`. |
| `onReorder(from, to, item)` | Reorder inside this list. `to` is the final index in the shortened array. |
| `onTransfer(item, from, to)` | An item dragged in from another sortable list. `from` is `{ listId, index }`; `to` is its insertion index in this list. |
| `onDrop(data, info)` | A plain `Draggable` (not a sortable item) was dropped on the list. |
| `listId` | Stable id used to tell a move inside the list from a transfer. |
| `type`, `accepts` | Drag type. Both default to `sortable-item`. |
| `direction` | `vertical` (default) or `horizontal`. |
| `gap`, `itemStyle`, `style`, `activeStyle` | Layout and highlight styling. |
| `empty`, `minHeight` | Empty-state content and a minimum drop area, so an empty list can still receive items. |
| `disabled`, `showIndicator`, `lift` | Turn dragging off, hide the insertion line, or turn off the lifted copy. |
| `onDragStart`, `onDragMove`, `onDragEnd` | Observe a drag that started in this list. |

## Board

`Board` is a row of `SortableList` columns with one shared drag preview. It
does not own your data: `onMove` reports the card and the source/destination
indices, and the app applies the change.

```tsx
import { Board, type BoardMove } from '@glyx-dev/drag-drop'

function Kanban() {
  const [columns, setColumns] = useState(initialColumns)

  const onMove = ({ item, from, to }: BoardMove<Card>) => {
    setColumns((columns) => {
      const next = columns.map((column) => ({ ...column, items: [...column.items] }))
      const source = next.find((column) => column.id === from.column)
      const target = next.find((column) => column.id === to.column)
      if (!source || !target) return columns

      source.items.splice(from.index, 1)
      target.items.splice(to.index, 0, item)
      return next
    })
  }

  return (
    <Board
      columns={columns}
      getKey={(card) => card.id}
      onMove={onMove}
      renderCard={(card, { dragging }) => <CardView card={card} dragging={dragging} />}
      renderEmpty={() => <Text>Drop a card here</Text>}
      height={520}
    />
  )
}
```

`Board` props:

| Prop | Purpose |
|------|---------|
| `columns` | `{ id, title?, items, color? }[]`. `id` is also the sortable list id. |
| `getKey`, `renderCard` | Card identity and rendering. `renderCard(item, { columnId, index, dragging })`. |
| `onMove(move)` | `{ item, from: { column, index }, to: { column, index } }`; apply it to your state. |
| `columnWidth`, `gap`, `cardGap` | Layout. Defaults are 280, 12 and 8. |
| `style`, `columnStyle`, `cardStyle` | Board, column and card styling. |
| `renderColumnFooter`, `renderEmpty` | Add-card footers and per-column empty content. |
| `renderDragPreview` | Custom floating preview. Defaults to `renderCard` with `dragging: false`. |
| `disabled`, `showIndicator`, `scrollable`, `height` | Turn dragging off, hide the line, enable horizontal scrolling, or bound the board. |

Within one column, `moveItem(items, from, to)` gives you the new array. Across
columns, remove from the source with `splice` and insert into the target at the
reported index, as above.

```ts
moveItem(items, from, to) // T[]; a copy, even when the move is a no-op
```

`dropIndex(from, insertAt, length)` is exported for code that works with
insertion boundaries instead of final indices. Boundaries run from `0` to
`items.length`; `moveItem` takes final indices.

## Custom drag handles

`useDraggable` from `@glyx-dev/react` is the lower-level hook. Each handler
receives `{ x, y, dx, dy }`; the hook returns one mount callback, passed as
`_glyxOnMount`:

```tsx
import { useRef } from 'react'
import { View, useDraggable } from '@glyx-dev/react'

function ResizeHandle({ width, setWidth }) {
  const startW = useRef(300)
  const onDragMount = useDraggable({
    onDragStart: () => { startW.current = width },
    onDragMove: ({ dx }) => setWidth(Math.max(120, startW.current + dx)),
  })

  return <View _glyxOnMount={onDragMount} style={{ width: 4, cursor: 'col-resize' }} />
}
```

## Notes

- Drag targets are hit-tested against the visible part of each zone. A zone
  scrolled out of a clipped container does not accept a drop on its hidden part.
- `Draggable` and `SortableList` are pointer-driven. A keyboard reorder API is
  not part of the package yet; provide move-up/move-down controls alongside a
  sortable list when keyboard users must be able to reorder.
