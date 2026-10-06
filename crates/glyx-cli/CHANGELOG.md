# Changelog

## [Unreleased]

### Added
- **glyx-media is downloaded for you.** `glyx dev` and `glyx package` now fetch the glyx-media library and its FFmpeg libraries from the GitHub Release of your Glyx version into `~/.glyx/cache/media/` when an app declares `video`, `camera` or `microphone`, so updating Glyx brings the matching media library along, as it does for the runner. A cached file that no longer verifies is fetched again; a library you built yourself is never replaced. `GLYX_MEDIA_NO_DOWNLOAD=1` turns it off, and `GLYX_TOOLS_BASE` points it at a mirror (`$GLYX_TOOLS_BASE/media/`).

### Fixed
- **The FFmpeg libraries next to glyx-media are now verified.** The signed manifest lists each library and its SHA-256, and the loader refuses a library that doesn't match, instead of loading whatever was beside the signed library. `glyx package` copies exactly the libraries the manifest lists.
- **glyx-media's version follows Glyx's** (it was fixed at 1.0.0, which no release produced), so the library a release builds is the one the CLI and runner look for.
- The release workflow refuses to publish an unsigned glyx-media on a tag build.

### Changed
- **glyx-media on macOS and Linux ships an LGPL-only FFmpeg.** The release workflow no longer links against Homebrew's or the distribution's FFmpeg, which include GPL components (x264, x265). macOS builds FFmpeg 9.0.1 from source (LGPL, no external libraries) and Linux uses BtbN's LGPL shared build, the same source as Windows; both are bundled next to `glyx-media` (`glyx-ffmpeg-libs-<version>-<platform>-<arch>.tar.gz` on the release, with the licence texts and a source offer) so users no longer need FFmpeg installed. A check fails the build if the libraries are not LGPL-only. Without `libx264`, encoding uses the platform encoders (VideoToolbox, VAAPI, NVENC and others) or `mpeg4`.
- **glyx-media for Intel Macs is back**, cross-compiled with the same LGPL FFmpeg. (The release workflow briefly dropped it when Homebrew stopped supporting Intel.)

## [0.2.0] - 2026-10-05

### Added
- **`glyx package` writes FFmpeg's licence notice.** When an app ships FFmpeg libraries, `LICENSES/ffmpeg/` gets a `NOTICE.txt` (which libraries, the licence and version they report, and that they are separate replaceable libraries) plus the matching licence texts (LGPL 3 also adds the GPL 3 it refers to). The licence is read from the libraries themselves and the strictest one wins; GPL or unrecognised builds print a warning. Covers Windows, macOS and Linux packages.
- **Glyx DevTools.** `glyx dev --devtools [port]` serves the Glyx DevTools Protocol on both JS engines (default port 9228; the address and a session token go to `target/glyx/devtools.json`), and `--open` opens the UI attached to the app. `glyx inspect [--port <p>] [--no-open]` serves the DevTools UI on `127.0.0.1` (default port 9227) and lists the dev apps running in the project, its subfolders, or anywhere with `GLYX_DEVTOOLS_PORT` set. Panels: Overview, Inspector, Console, Performance, Animations, Memory, Layout, Network, CPU profiler. Dev builds only.
- **`glyx mcp`** serves running dev apps to AI agents over MCP (stdio): list apps, read the UI as an outline, click, type, scroll, wait, screenshot, evaluate JavaScript, read the console. The VS Code extension has **Open DevTools on…** and **Copy MCP Server Config** commands.
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

### Changed
- **The Windows media library is built against LGPL FFmpeg.** The build script downloads an LGPL shared FFmpeg build, so apps that ship it take on no GPL obligations (the libraries stay separate DLLs next to the app). Only the five libraries the wrapper links to (`avcodec`, `avformat`, `avutil`, `swresample`, `swscale`) are used; `avfilter` and `avdevice` are gone. Video encoding picks the best H.264 encoder the machine has (hardware first) and falls back to MPEG-4 instead of requiring the GPL-only `libx264`. On Linux and macOS the media library uses the system FFmpeg, so its licence is whatever that build carries.
- `glyx build` and `glyx dev` keep a debug bundle's source map separate (`pm::SourceMap`) instead of inlining it in release output (see Fixed).

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
