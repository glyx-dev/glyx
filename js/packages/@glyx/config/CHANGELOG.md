# Changelog

## [Unreleased]

### Added
- `window.canvasCacheMb`: the memory budget (0 to 256 MB, default 16) of the pixel cache for canvases that are repainted unchanged; 0 turns it off. The `GLYX_CANVAS_CACHE_MB` environment variable overrides it.
- `window.labelCacheEntries`: pin the shaped-text cache to a number of entries (16 to 1,000,000, about 2 KB each). Without it the cache sizes itself: it starts at 256, grows while a view shows more distinct strings than it holds (up to an 8 MB budget) and shrinks back when quiet. The `GLYX_LABEL_CACHE` environment variable overrides it.

## [0.2.0] - 2026-10-05

### Added
- `window.maxFps`: an optional frame-rate ceiling (15–500) for animation, video and drags. The default is the monitor's refresh rate. `60` halves animation work on a 120 Hz display.

### Fixed
- The package's own tests no longer exit the test runner. `defineConfig` exits the process by design (the CLI reads its JSON output), and the tests called it for real. As a result, `bun test js/packages`, which CI runs, stopped after this package with exit code 0, and the packages after it never ran. The tests now intercept the exit and assert on the printed JSON. Runtime behavior is unchanged.

## [0.1.0] - 2026-08-07

- Initial public release.
