# Changelog

## [Unreleased]

### Added
- Cached `glyx-runner` binaries (`~/.glyx/runners/<engine>/<profile>/`) are now
  stamped with the `glyx-cli` version that produced them. `glyx dev`/`glyx build`
  print a one-line notice when a cached runner's stamp doesn't match the CLI
  version currently running (including runners cached before this stamping
  existed, which have no stamp at all). This is notify-only — it never
  auto-rebuilds or invalidates the cache, so an ordinary `glyx dev`/`glyx build`
  never surprises anyone with an unrequested rebuild. Refreshing is always a
  manual `glyx runtime build --force`.
- Previously, the runner cache had no version awareness at all: upgrading
  `glyx-cli` while a runner was already cached meant every subsequent command
  silently kept using the old cached runner indefinitely, with no signal that a
  newer one existed.

## [0.1.0] - 2026-08-07

- Initial public release.
