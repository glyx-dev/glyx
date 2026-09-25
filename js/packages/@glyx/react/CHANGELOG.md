# Changelog

## [Unreleased]

### Changed
- `ipc.on('message', ...)` listeners now receive messages without an internal JSON round trip on the native side — no behavior change, but inter-window IPC polling is cheaper per frame.
- The internal host config (`hostConfig.js`) now batches append/insertBefore/update/remove/setRoot operations from one React commit into a single native call instead of one call per operation, encoded as one flat array instead of nested per-op arrays. No API or behavior change — purely a native-bridge efficiency change (see the project performance changelog for the numbers).
- Click and hover hit-testing (`findTopmostSolid` in `events.js`) is no longer computed in JS at all — it's resolved natively when an input event is captured and attached to the event before JS ever sees it, instead of JS calling a native layout query once per candidate element on every click and every cursor move. As a result, the JS-side bookkeeping that only existed to support that lookup (the solid-node registry and the per-node z-index map, along with `registerSolid`/`unregisterSolid`/`setNodeZIndex`) has been removed entirely — one fewer Map write on every node's creation, update, and removal. (An earlier point release in this same cycle had fixed an O(n²) bug in that registry's removal path; this change removes the registry altogether, superseding that fix.) No public API changed — these were internal to `hostConfig.js`/`events.js`, never re-exported.
- `TextInput`'s multiline auto-height calculation is now memoized (`useMemo`) instead of running unconditionally in the render body on every render, including ones triggered by unrelated parent/context changes. It now only re-measures when text, font size, field width, or the min/max line props actually change. No behavior change.

### Fixed
- **Clicks in text now land on the character drawn under the pointer.** `TextInput` and `SelectableText` hit-test through a single native call that shapes and places the text exactly as the renderer does, using the Text node's own props. Previously each component re-derived placement itself and got different parts wrong:
  - Center/right-aligned text resolved clicks as if it were left-aligned.
  - `lineHeight` was ignored when resolving the clicked line in multiline fields.
  - Vertically centered text (`SelectableText` in a taller box) was hit-tested as if top-aligned.
  - The wrap width differed from the renderer's by 1px, so a word that fit at render time could wrap at hit-test time.
  - Clicking to the right of a line ending in a newline put the caret at the start of the *next* line.
- `SelectableText`: drag-selection now works across wrapped lines. Its drag/press handlers also register at all now; they were attached through a leftover pre-rename prop name (`_veloxOnMount`) that the host config never read.
- Element-relative coordinates (`Pressable`'s `locationX/Y`, text-input click/drag offsets) are measured from the element's real origin. For an element partly scrolled out of a `ScrollView`, they used to be measured from the clip edge, so they were off by the scrolled-away amount.
- `ScrollView` and multiline `TextInput` scroll limits use the element's full viewport height. A partly clipped scroller could previously scroll past its content.
- Multiline `TextInput` PageUp/PageDown keeps the caret's column instead of jumping to the start of the line.

### Added
- Screen readers can now read and select text inside `TextInput`, in builds with the `a11y` feature. The field exposes its text in a way a screen reader can navigate by character, word and line. It reports its selection, and a selection the screen reader makes applies to the field just like a mouse drag. Multiline fields are announced as multiline. While the field is empty, its placeholder is announced as a placeholder, not as typed content.
- `TextInput` accepts `textAlign` (`'left'` | `'center'` | `'right'`), applied to rendering and hit-testing alike.

## [0.1.0] - 2026-08-07

- Initial public release.
