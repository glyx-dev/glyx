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

Uses the native `onRightPress` event and opens the menu in the app's root popover layer: at the pointer, in window coordinates, never clipped by a scroller or covered by other content, flipped above near the bottom of the window. It closes on a click (left or right) outside it, on Escape, or when an item is chosen. Arrow keys move through the items, Enter chooses.

## Items

```js
{ label: 'Open', icon: '↗', accelerator: 'Ctrl+O', action: () => open() }
{ label: 'Show grid', checked: grid, action: (on) => setGrid(on) }      // a check item: the action gets the new state
{ label: 'Share', children: [{ label: 'Copy link', action: copyLink }] }  // a submenu
{ label: 'Archive', disabled: true }
{ label: 'Delete', destructive: true, action: remove }
{ separator: true }
```

- `icon`: a glyph or emoji (a string), or any element, before the label (drawn menu only).
- `shortcut` / `accelerator`: a label at the right edge (`accelerator` is also what a native menu shows; the menu does not trigger it).
- `checked`: a check mark; `children`: a submenu; `disabled`; `destructive` (red, drawn menu only).

## Native menus

`<ContextMenu native ...>` shows the operating system's own popup menu where there is one (Windows today), with submenus, check marks and accelerator labels in the system's look; elsewhere, or if it cannot be shown, the drawn menu opens instead. Choose per menu: the drawn one is the same everywhere and can have icons; the native one matches the system.

Keyboard (drawn menu): Up / Down move, Right opens a submenu, Left closes it, Enter chooses, Escape closes a submenu and then the menu.

See `examples/context-menu-demo`.

## API

- `ContextMenu({ children, items = [], width = 200 })` — wraps `children` and shows a positioned menu on right-click. Each item is either `{ label, action, disabled?, destructive? }` or `{ separator: true }`.
