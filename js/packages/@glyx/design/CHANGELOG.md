# Changelog

## [Unreleased]

### Added
- **Written in TypeScript** (`src/*.tsx`), with its declarations shipped in `types/`.

### Fixed
- **The declarations now come from the TypeScript source** instead of being kept by hand, which had drifted from the code: `useTheme()` is typed as the design tokens (`colors`, `space`, `radius`, ...) it really returns (it was typed `{ tokens, colorScheme, toggle }`), and `Label` accepts every size (`xs` to `xl`) and `bold`.

## [0.2.0] - 2026-10-05

### Fixed
- `IconButton` never used its `label` prop. It is now the button's `ariaLabel`, so screen readers announce icon-only buttons by name instead of "unnamed button".

## [0.1.0] - 2026-08-07

- Initial public release.
