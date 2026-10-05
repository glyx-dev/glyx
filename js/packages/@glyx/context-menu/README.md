# @glyx-dev/context-menu

Right-click context menus (native onRightPress).

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/context-menu
# or npm install @glyx-dev/context-menu
```

## Usage

```jsx
import { ContextMenu } from '@glyx-dev/context-menu';

<ContextMenu
  items={[
    { label: 'Open', action: () => open(id) },
    { separator: true },
    { label: 'Delete', action: () => del(id), destructive: true },
  ]}
>
  <NoteCard note={note} />
</ContextMenu>;
```

Uses the native `onRightPress` event and a z-index overlay for positioning. The menu dismisses on any outside click (left or right).

## API

- `ContextMenu({ children, items = [], width = 200 })` — wraps `children` and shows a positioned menu on right-click. Each item is either `{ label, action, disabled?, destructive? }` or `{ separator: true }`.
