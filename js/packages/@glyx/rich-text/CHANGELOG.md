# Changelog

## [Unreleased]

### Added
- **Icon toolbar, focused menus and menu elevation.** `RichTextToolbar` now uses Lucide icons from `@glyx-dev/icons` for bold, italic, underline, lists and indentation, and a type icon and chevrons for the font-family and size menus. Every control keeps the editor's keyboard focus, so choosing a font, size or format leaves the caret ready to type. Open menus paint above custom children the app renders inside the editor, with a header, rounded panel, hover states and a selected check.
- **Fonts, sizes and features in the toolbar, and per-run formatting with values.** The toolbar has a font-family menu (in `RichTextToolbar`, from `fontFamilies`; defaults to system-ui, Segoe UI, Arial, Georgia, Times New Roman, Cascadia Mono, Consolas, Courier New, serif and monospace) and a size menu. Both apply to the selection, or to the text typed next when the caret is empty. `Span` and `RichTextEditor` take `fontFeatureSettings` (OpenType features such as tabular figures and small caps). `applyFormat` takes any span field and a value (`fontFamily`, `fontVariationSettings`, `fontFeatureSettings`, `fontSize`, `color`), `selectionFormatValue` reads the value every selected run shares, and the editor's `setFormat`/`formatValue` expose the same to custom toolbars. A format chosen at the caret stays for the typing run and is cleared when the caret moves; undo and redo clear it, and runs in different fonts or features are never merged.
- **Fonts per span.** A span can set its own `fontFamily` and `fontVariationSettings` (variable-font axes), and the editor takes both as props for all its text; the caret, selection and clicks are measured in the font each span is drawn in. Runs in different fonts are not merged.
- **`fontFamily` prop.** The editor's text is drawn in that family, and the caret, selection and clicks are measured in it.
- **Undo and redo.** Ctrl+Z undoes and Ctrl+Y (or Ctrl+Shift+Z) redoes, as in a browser: a run of typing is one step (a pause of a second, moving the caret or another kind of edit ends it), a run of Backspace or Delete is one, and cut, paste, Enter, deleting a selection, a format and a list change each their own; the caret and selection come back. A step is a reference to the document before the edit (documents share every paragraph an edit did not touch), at most 200 steps, freed with the editor, dropped when the app sets `value` to a document the editor did not make. New `undoHistory` prop (default true). Cmd+Z on macOS is not read yet (as with copy and paste).
- **Written in TypeScript.** The source is now TypeScript (`src/index.ts`), strictly type-checked, and the package ships its declarations (`types/`), so TypeScript apps get types for the whole public API.
- **A typed document model and props.** `RichTextDocument`, `Paragraph`, `Span`, `Cursor`, `Selection`, `RichTextEditorProps`, `RichTextToolbarProps` and `EditorContextValue` are exported, and the editing functions (`insertText`, `deleteSelection`, `applyFormat`, ...) use them. `useEditorContext()` returns `EditorContextValue | null`.

### Fixed
- A paragraph's row is as tall as its largest run, so a 24 px or heading run no longer paints over the paragraph below it. Clicking a line, moving with the arrow keys and caret-follow scrolling now use each paragraph's own line height.
- The shipped declarations in `types/` now include the per-run font fields, the value formats, the toolbar's `fontFamilies` and the editor's font props.

## [0.2.0] - 2026-10-05

### Fixed
- Formatting part of the text no longer hides the space before it. A span ending in a space ("Hello " before a bold "world") was laid out without that space, and it only came back after reopening the file. Clicks after such a span also land on the right character now.
- Bolding or un-bolding part of a word no longer leaves a small gap (or overlap) after it. The restyled text is now re-measured (fix in `@glyx-dev/react`'s native layout).
- Clicks and drags in an editor that is partly scrolled out of an enclosing `ScrollView` now land on the right line. Offsets are measured from the editor's real origin instead of the clip edge.
- The editor's vertical scroll limit, caret-follow scrolling and horizontal scrollbar track use the editor's full size, not only the part left visible by an outer scroller.
- Per-span click resolution now uses the same native character-boundary rule as `TextInput` and `SelectableText`, so the same click can't resolve differently depending on which component owns the text.

## [0.1.0] - 2026-08-07

- Initial public release.
