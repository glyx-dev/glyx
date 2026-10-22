# Changelog

## [Unreleased]

### Fixed
- **Dragging over a long `SortableList` measured every item and rendered the whole list on every pointer move.** The insertion index is now found by bisection (`insertionIndexLazy`, exported: about `log2(n)` native layout calls instead of `n`), and the indicator is only updated when the boundary changes, so a pointer that stays within one gap costs nothing.

### Added
- **`SortableList` and `Board`.** Sortable lists reorder by pointer position, report the final index (`onReorder`), accept items from another list (`onTransfer`) and show an insertion line, a dimmed source item and a lifted copy that no longer moves the list around. `Board` draws columns of cards with `onMove({ item, from, to })` for moves inside a column and between columns, plus `renderCard`, `renderColumnFooter`, `renderEmpty`, a fixed column width and horizontal scrolling. Its drag preview is one layer above every column and outside their scroll views, so a card crossing a column boundary is not clipped or painted under the next column; `renderDragPreview` overrides it and `lift={false}` keeps the source in place as the placeholder. Pure helpers `insertionIndex`, `dropIndex` and `moveItem` are exported.
- **Hover callbacks on DropZone.** `onDragEnter`, `onDragOver` and `onDragLeave` (with the dragged data and pointer), and `activeStyle` for a highlight while a compatible drag is over the zone. Draggable gets `onDragStart`, `onDragMove`, `onDragEnd` (with `dropped`) and `onMount`.
- **A movement threshold and Escape.** A press only becomes a drag after 4 px, so a click or text selection is not a drag; Escape cancels and drops nothing. The dragged item lifts with a transform instead of a margin, so siblings no longer reflow.
- **Written in TypeScript.** The source is now TypeScript (`src/index.ts`), strictly type-checked, and the package ships its declarations (`types/`), so TypeScript apps get types for the whole public API.

## [0.2.0] - 2026-10-05

- No changes in this package; released alongside Glyx 0.2.0.

## [0.1.0] - 2026-08-07

- Initial public release.
