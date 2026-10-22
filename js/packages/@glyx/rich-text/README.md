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
- `Paragraph` = styled runs, optionally a list marker, nesting level and alignment
- `Span` = `{ text, bold?, italic?, underline?, code?, link?, highlight?, color?, fontSize?, fontFamily?, fontVariationSettings?, fontFeatureSettings? }`
- `Cursor` = `{ para, offset }` (offset = char index in the flat paragraph text)
- `Selection` = `{ anchor: Cursor, focus: Cursor }`

Rendering uses native `Text` nodes (bold/italic/underline/code/highlight/link
supported natively) with absolutely-positioned `View` overlays for the cursor
and selection highlight. Cursor pixel position is computed via native text
measurement.

## API

- `RichTextEditor({ ... })` — the editable document component (word-wrap, native scrolling, click/drag selection, lists, alignment, per-run fonts, OpenType features, links and rich clipboard). Takes `value`, `onChange`, `width`, `height`, `fontSize`, `color`, `fontFamily`, `fontVariationSettings`, `fontFeatureSettings`, `wrap`, `undoHistory`, `openLinks`, `onLinkPress` and `style`. Clicking a link opens a small editor anchored to that run: change the URL, remove it, or — when `openLinks` and `onLinkPress` are set — choose **Open** to hand the URL to your app. Clicking the link itself never launches it directly.
- `RichTextToolbar({ style, fontFamilies })` — the formatting toolbar: bold, italic, underline, inline code, highlight, link, lists, indentation, font family/size and paragraph alignment. `fontFamilies` lists the families the font menu offers.
- `RichTextFeaturePicker({ features, label, clearLabel, width, style })` — a reusable row of OpenType-feature presets (tabular figures, small caps, ligatures off by default) that applies a `fontFeatureSettings` value to the selection or the text typed next. `DEFAULT_FEATURE_PRESETS` is exported for apps that want to extend or reorder the defaults.
- `useEditorContext()` — hook for accessing the active editor's state/actions from a custom toolbar or child component (`formatValue`, `setFormat`, `toggleFormat`, `selectionHasFormat`, `toggleList`, `indent`, `isListActive`, `align`, `setAlign`, and `refocus` after a custom control). Give custom controls `keepFocus` so the editor keeps receiving keys, then call `refocus` after the press.
- `emptyDoc()` — returns a fresh empty document (one empty paragraph).
- `docToPlainText(doc)` / `docFromPlainText(text)` — convert between the rich document model and a plain string.
- `docToMarkdown(doc)` / `docToHTML(doc)` — serialize a document. Markdown covers paragraphs, lists, bold, italic, underline, code, links and highlights; HTML also carries paragraph alignment. Import from Markdown/HTML is not part of this version.
- `paragraphAlign(doc, cursor)` — the alignment of the paragraph at a cursor.
- `setParagraphAlign(doc, sel, align)` — align every paragraph the selection touches.
- `sliceDocument(doc, sel)` / `insertDocument(doc, cursor, fragment)` — copy a formatted selection and paste it back, preserving paragraph properties.
- `paraText(para)` — flattens a paragraph's spans into a single text string.
- Document/selection helper functions used internally and available for advanced integrations: `splitSpansAt`, `mergeSpans`, `cursorEq`, `hasSelection`, `normSel`, `clampCursor`, `moveCursorBy`, `insertText`, `insertBreak`, `deleteChar`, `deleteSelection`, `applyFormat`, `spanAtOffset`, `spanAtCursor`, `linkRangeAtOffset`, `selectionFormatValue`, `selectionHasFormat`, `selectedText`, `charIndexAtPoint`, `wrapParagraph`, `wordRangeAt`, `computeListNumber`.

## Clipboard

Ctrl+C / Ctrl+X copy the selected text and remember its formatting; Ctrl+V
pastes the formatted fragment when the system clipboard still contains that
same text. If another app changed the clipboard, paste falls back to plain
text. The system clipboard API is text-only, so the formatting itself is
in-app state, not something another app can read.

## Keyboard

`Ctrl+B` / `Ctrl+I` / `Ctrl+U` toggle bold, italic and underline; `Ctrl+E`
toggles inline code. `Ctrl+Z`, `Ctrl+Y` and `Ctrl+Shift+Z` undo/redo, and
`Ctrl+A` selects the whole document. Escape is not used by the editor.
