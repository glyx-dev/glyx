# Changelog

## [Unreleased]

### Added
- **Undo and redo.** Ctrl+Z undoes and Ctrl+Y (or Ctrl+Shift+Z) redoes, as in a browser: a run of typing is one step (a pause of a second, moving the caret or another kind of edit ends it), a run of Backspace or Delete is one, and cut, paste, Enter, deleting a selection, a format and a list change each their own; the caret and selection come back. A step is a reference to the document before the edit (documents share every paragraph an edit did not touch), at most 200 steps, freed with the editor, dropped when the app sets `value` to a document the editor did not make. New `undoHistory` prop (default true). Cmd+Z on macOS is not read yet (as with copy and paste).
- **Written in TypeScript.** The source is now TypeScript (`src/index.ts`), strictly type-checked, and the package ships its declarations (`types/`), so TypeScript apps get types for the whole public API.
- **A typed document model and props.** `RichTextDocument`, `Paragraph`, `Span`, `Cursor`, `Selection`, `RichTextEditorProps`, `RichTextToolbarProps` and `EditorContextValue` are exported, and the editing functions (`insertText`, `deleteSelection`, `applyFormat`, ...) use them. `useEditorContext()` returns `EditorContextValue | null`.

## [0.2.0] - 2026-10-05

### Fixed
- Formatting part of the text no longer hides the space before it. A span ending in a space ("Hello " before a bold "world") was laid out without that space, and it only came back after reopening the file. Clicks after such a span also land on the right character now.
- Bolding or un-bolding part of a word no longer leaves a small gap (or overlap) after it. The restyled text is now re-measured (fix in `@glyx-dev/react`'s native layout).
- Clicks and drags in an editor that is partly scrolled out of an enclosing `ScrollView` now land on the right line. Offsets are measured from the editor's real origin instead of the clip edge.
- The editor's vertical scroll limit, caret-follow scrolling and horizontal scrollbar track use the editor's full size, not only the part left visible by an outer scroller.
- Per-span click resolution now uses the same native character-boundary rule as `TextInput` and `SelectableText`, so the same click can't resolve differently depending on which component owns the text.

## [0.1.0] - 2026-08-07

- Initial public release.
