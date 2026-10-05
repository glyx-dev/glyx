# Changelog

## [Unreleased]

## [0.2.0] - 2026-10-05

### Added
- `window.maxFps`: an optional frame-rate ceiling (15–500) for animation, video and drags. The default is the monitor's refresh rate. `60` halves animation work on a 120 Hz display.

### Fixed
- The package's own tests no longer exit the test runner. `defineConfig` exits the process by design (the CLI reads its JSON output), and the tests called it for real. As a result, `bun test js/packages`, which CI runs, stopped after this package with exit code 0, and the packages after it never ran. The tests now intercept the exit and assert on the printed JSON. Runtime behavior is unchanged.

## [0.1.0] - 2026-08-07

- Initial public release.
