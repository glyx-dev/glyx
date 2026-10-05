# @glyx-dev/command

Command palette (Cmd/Ctrl+K) with fuzzy search.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/command
# or npm install @glyx-dev/command
```

## Usage

```jsx
import { CommandPalette, useCommands } from '@glyx-dev/command';

function Notes() {
  useCommands([
    { id: 'new', label: 'New Note', section: 'Notes', action: newNote },
    { id: 'delete', label: 'Delete Note', section: 'Notes', action: deleteNote },
  ]);

  return (
    <>
      <NotesList />
      <CommandPalette />
    </>
  );
}
```

Render `<CommandPalette />` once near the app root. Any component can register commands via `useCommands` — the palette combines everything currently mounted into one searchable list.

## API

- `useCommands(commands)` — registers a list of `{ id, label, section?, keywords?, action }` commands into the global palette registry for the lifetime of the calling component. Re-registering the same `id` replaces the earlier entry.
- `CommandPalette({ accelerator = 'ctrl+k', placeholder = 'Type a command…', maxResults = 8 })` — the palette overlay itself. Opens on the given shortcut, closes on Escape or an outside action, and fuzzy-matches the query against each command's label/section/keywords.
