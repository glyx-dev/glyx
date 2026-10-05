# Changelog

## [Unreleased]

## [0.2.0] - 2026-10-05

### Added
- A pane can be a render function, `({ width, height }) => node`, that receives the pane's own size. Use it for content that needs pixel dimensions and should follow the divider.

### Fixed
- The resize cursor now appears as soon as the pointer reaches the divider, not only once a drag starts. The divider's hover handlers were never called, because only `Pressable` receives hover. It also stays a resize cursor while dragging, even when the pointer moves ahead of the divider.

### Changed
- A cleaner divider: a thin line inside the grab area that thickens and brightens on hover, with a small grip, and takes the active colour while dragging. The changes animate natively.

## [0.1.0] - 2026-08-07

- Initial public release.
