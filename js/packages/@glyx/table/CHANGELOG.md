# Changelog

## [Unreleased]

### Added
- **Written in TypeScript.** The source is now TypeScript (`src/index.ts`), strictly type-checked, and the package ships its declarations (`types/`), so TypeScript apps get types for the whole public API.
- **Typed props.** `DataTable`, its columns (`DataTableColumn`) and `getRowId`/`onSort`/`onRowPress` have real types, generic over the row type, instead of `any`. `height` is required, as it always was in practice.

### Added
- **Column virtualization.** A table scrolling sideways renders only the columns in view plus 200 px each side, with a spacer for the rest, in the header and every row: about 17 to 20 of the 30 columns of the `big-table` example instead of all 30, and many fewer for wider tables. Together with the `VirtualizedList` row reuse in `@glyx-dev/react`, scrolling a 5000-row table costs about 29 ms a frame on both V8 and QuickJS in that example (it was about 100 ms on V8 and several hundred on QuickJS). Also exports `visibleColumns`, the window computation. The horizontal scrollbar gets its own strip under the rows instead of covering the last one.
- **Horizontal scrolling.** When the columns add up to more than `width`, the table scrolls sideways (wheel deltaX, Shift+wheel, a scrollbar at the bottom) with the header moving with the columns, while the rows still scroll up and down. Before, the extra columns were cut off or squeezed.

### Fixed
- Header and body cells keep their width when the columns are wider than the table, so they stay lined up, instead of shrinking.
- Rows without an `id` no longer all share one selection id: the default `getRowId` falls back to the row's position, so selecting one row selects only it.

## [0.2.0] - 2026-10-05

- No changes in this package; released alongside Glyx 0.2.0.

## [0.1.0] - 2026-08-07

- Initial public release.
