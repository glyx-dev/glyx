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

### Fixed
- `glyx package` shipped the app's own `js/` source folder (including `.jsx`
  source files and dev bundles) instead of only the bundle the app actually
  loads. Packages now contain just that one bundle, at the same relative
  path. Release builds also no longer embed an inline source map in the
  bundle — a source map carries the full original source text, so this was
  shipping readable source even when `js/` itself wasn't copied. The map is
  now written to `target/glyx/sourcemaps/` instead, kept on the developer's
  machine (never packaged) to decode a user's crash stack trace back to
  real file/line.
- `glyx package` didn't copy the glyx-media DLL's signed manifest/signature
  sidecar files, so a release build's media DLL (video, camera, microphone)
  silently refused to load for users. It also copied every DLL in the media
  cache rather than just the five FFmpeg libraries the wrapper actually
  links to (stale versions, `avfilter`/`avdevice` it doesn't use). Both
  fixed; packaging also now warns when the cached media DLL is an unsigned
  local dev build, since a packaged app would refuse that too.
- `glyx package` never copied the trimmed `icudtl.dat` `glyx build` writes
  next to the binary, so packaged apps silently lost `Intl.*` and
  `toLocaleString()`. Now copied, with a warning if it's missing.
- For an app inside a Cargo workspace (e.g. the bundled examples), `glyx
  build` wrote ICU data and capability modules to where it expected the
  binary to be rather than where cargo actually placed it (the workspace's
  shared `target/`), so they silently went to the wrong — and unused —
  folder.
- Capability-module staging could try to copy a just-built module onto
  itself (when the build output and the staging destination are the same
  path), which Windows reports as a file-in-use error rather than a no-op.
- The Windows zip (`Compress-Archive`) wrote backslash path separators
  (`js\app.js`), which the zip format doesn't allow — unzipping on
  macOS/Linux (and some Windows tools) turned those into oddly-named flat
  files instead of folders. `glyx package` now writes the zip itself with
  forward-slash paths. The Linux tarball also now contains the app's whole
  folder (binary + its files + licences), not just the bare binary.

## [0.1.0] - 2026-08-07

- Initial public release.
