# @glyx-dev/drag-drop

Drag-and-drop primitives built on native drag events.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/drag-drop
# or npm install @glyx-dev/drag-drop
```

## Usage

```jsx
import { Draggable, DropZone } from '@glyx-dev/drag-drop';

<DropZone onDrop={(data) => move(data)} accepts="card">
  <Column />
</DropZone>;

<Draggable data={item} type="card">
  <Card />
</Draggable>;
```

Drop targets are matched by hit-testing the pointer against each `DropZone`'s live layout rect at drop time (no HTML5 DnD, no DOM).

## API

- `DropZone({ children, onDrop, accepts, style, width, height })` — registers a drop target. `accepts` can be a type string or array of type strings; omit to accept any type. `onDrop(data, { x, y, type })` fires when a matching `Draggable` is released over it.
- `Draggable({ children, data, type, style, width, height, onDragStateChange })` — makes `children` draggable. `data` is passed to the matching drop zone's `onDrop`; `onDragStateChange(isDragging)` fires on drag start/end.
