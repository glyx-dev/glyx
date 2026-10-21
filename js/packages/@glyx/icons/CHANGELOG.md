# Changelog

## [Unreleased]

### Added
- **Text formatting icons.** `bold`, `italic`, `underline`, `list`, `list-ordered`, `indent-increase`, `indent-decrease` and `type`, used by `@glyx-dev/rich-text`'s toolbar.
- **Written in TypeScript.** The source is now TypeScript (`src/index.ts`), strictly type-checked, and the package ships its declarations (`types/`), so TypeScript apps get types for the whole public API.

## [0.2.0] - 2026-10-05

### Added
- `Icon` takes an `ariaLabel`. Without one an icon is now marked `role="presentation"`, so screen readers skip it instead of reporting an unnamed image. Give an icon that stands alone a label.

## [0.1.0] - 2026-08-07

- Initial public release.
