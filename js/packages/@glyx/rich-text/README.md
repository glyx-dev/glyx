# @glyx-dev/rich-text

Rich text editor for Glyx apps.

Full docs: [glyx.dev](https://glyx.dev)

## Install

```sh
bun add @glyx-dev/rich-text
# or npm install @glyx-dev/rich-text
```

## Usage

```jsx
import { RichTextEditor, RichTextToolbar, emptyDoc } from '@glyx-dev/rich-text';

function Notes() {
  const [doc, setDoc] = React.useState(emptyDoc());
  return (
    <RichTextEditor value={doc} onChange={setDoc} width={600} height={400}>
      <RichTextToolbar />
    </RichTextEditor>
  );
}
```

The toolbar must be inside `RichTextEditor` (a child, so it shares the editor
context); it takes the same measurements as the editor and keeps the caret
focused while you use its controls.

Document model:
- `RichTextDocument = { paragraphs: Paragraph[] }`
- `Paragraph` = styled runs, optionally a list marker and nesting level
- `Span` = `{ text, bold?, italic?, underline?, color?, fontSize?, fontFamily?, fontVariationSettings?, fontFeatureSettings? }`
- `Cursor` = `{ para, offset }` (offset = char index in the flat paragraph text)
- `Selection` = `{ anchor: Cursor, focus: Cursor }`

Rendering uses native `Text` nodes (bold/italic/underline supported natively) with absolutely-positioned `View` overlays for the cursor and selection highlight. Cursor pixel position is computed via native text measurement.

## API

- `RichTextEditor({ ... })` — the editable document component (word-wrap, native scrolling, click/drag selection, list support, per-run fonts and OpenType features). Takes `value`, `onChange`, `width`, `height`, `fontSize`, `color`, `fontFamily`, `fontVariationSettings`, `fontFeatureSettings`, `wrap`, `undoHistory` and `style`.
- `RichTextToolbar({ style, fontFamilies })` — the formatting toolbar: icon buttons for bold, italic, underline, lists and indentation, plus font-family and size menus. `fontFamilies` lists the families the font menu offers.
- `useEditorContext()` — hook for accessing the active editor's state/actions from a custom toolbar or child component (`formatValue`, `setFormat`, `toggleFormat`, `toggleList`, `indent`, and `refocus` after a custom control). Give custom controls `keepFocus` so the editor keeps receiving keys, then call `refocus` after the press.
- `emptyDoc()` — returns a fresh empty document (one empty paragraph).
- `docToPlainText(doc)` / `docFromPlainText(text)` — convert between the rich document model and a plain string.
- `paraText(para)` — flattens a paragraph's spans into a single text string.
- Document/selection helper functions used internally and available for advanced integrations: `splitSpansAt`, `mergeSpans`, `cursorEq`, `hasSelection`, `normSel`, `clampCursor`, `moveCursorBy`, `insertText`, `insertBreak`, `deleteChar`, `deleteSelection`, `applyFormat`, `spanAtCursor`, `selectionFormatValue`, `selectionHasFormat`, `selectedText`, `charIndexAtPoint`, `wrapParagraph`, `wordRangeAt`, `computeListNumber`.
