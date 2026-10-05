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
    <>
      <RichTextToolbar />
      <RichTextEditor doc={doc} onChange={setDoc} width={600} height={400} />
    </>
  );
}
```

Document model:
- `Document` = array of paragraphs
- `Paragraph` = array of styled spans
- `Span` = `{ text, bold?, italic?, underline?, color?, fontSize? }`
- `Cursor` = `{ para, offset }` (offset = char index in the flat paragraph text)
- `Selection` = `{ anchor: Cursor, focus: Cursor }`

Rendering uses native `Text` nodes (bold/italic/underline supported natively) with absolutely-positioned `View` overlays for the cursor and selection highlight. Cursor pixel position is computed via native text measurement.

## API

- `RichTextEditor({ ... })` — the editable document component (word-wrap, native scrolling, click/drag selection, list support).
- `RichTextToolbar({ style })` — a formatting toolbar (bold/italic/underline/lists/etc.) that operates on the nearest editor context.
- `useEditorContext()` — hook for accessing the active editor's state/actions from a custom toolbar or child component.
- `emptyDoc()` — returns a fresh empty document (one empty paragraph).
- `docToPlainText(doc)` / `docFromPlainText(text)` — convert between the rich document model and a plain string.
- `paraText(para)` — flattens a paragraph's spans into a single text string.
- Document/selection helper functions used internally and available for advanced integrations: `splitSpansAt`, `mergeSpans`, `cursorEq`, `hasSelection`, `normSel`, `clampCursor`, `moveCursorBy`, `insertText`, `insertBreak`, `deleteChar`, `deleteSelection`, `applyFormat`, `selectionHasFormat`, `selectedText`, `charIndexAtPoint`, `wrapParagraph`, `wordRangeAt`, `computeListNumber`.
