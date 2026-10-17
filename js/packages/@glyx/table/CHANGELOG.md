# Changelog

## [Unreleased]

### Added
- **Written in TypeScript.** The source is now TypeScript (`src/index.ts`), strictly type-checked, and the package ships its declarations (`types/`), so TypeScript apps get types for the whole public API.
- **Typed props.** `DataTable`, its columns (`DataTableColumn`) and `getRowId`/`onSort`/`onRowPress` have real types, generic over the row type, instead of `any`. `height` is required, as it always was in practice.

### Fixed
- Rows without an `id` no longer all share one selection id: the default `getRowId` falls back to the row's position, so selecting one row selects only it.

## [0.2.0] - 2026-10-05

- No changes in this package; released alongside Glyx 0.2.0.

## [0.1.0] - 2026-08-07

- Initial public release.
