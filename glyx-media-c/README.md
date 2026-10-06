# glyx-media-c

The C library that wraps FFmpeg for Glyx apps (video and audio decode/encode,
camera and microphone capture). The Rust side loads it at runtime
(`crates/glyx-media`); see `docs/ARCHITECTURE.md`.

## FFmpeg and its licence

Glyx ships **LGPL-only** FFmpeg. A GPL build (Homebrew's, or a Linux
distribution's, which include x264 and x265) would put GPL terms on this
library and on every app that ships it, so the release workflow refuses one.

| Platform | Where the FFmpeg libraries come from |
|---|---|
| Windows x64 | BtbN's LGPL shared build (`build-windows.ps1`) |
| Linux x64 | BtbN's LGPL shared build |
| macOS arm64, x64 | built from source by `build-ffmpeg-macos.sh` (FFmpeg 9.0.1, pinned by checksum, no external libraries; x64 is cross-compiled) |

All three use the same major library versions (avcodec 63, avformat 63, avutil
61, swscale 10, swresample 7). The libraries are separate shared files, not
linked into `glyx-media`, so they can be replaced with another build of the
same versions.

`build-ffmpeg-macos.sh` and the Linux job both fail the build if FFmpeg reports
`--enable-gpl` or `--enable-nonfree`, and the macOS build also fails if a
library depends on anything but the bundled FFmpeg or the system.

Without `libx264` (GPL), encoding uses the first working encoder from the list
in `glyx_media.c`: the platform's (VideoToolbox, Media Foundation, NVENC,
Quick Sync, AMF, VAAPI), then `libopenh264` if present, then `mpeg4`.

## What a release contains

For each platform and architecture (`glyx-media-build.yml`), on the GitHub
Release of the Glyx version:

- `glyx-media-<version>-<platform>-<arch>.<dll|dylib|so>`, plus its signed
  `.manifest.json` and `.manifest.sig`.
- `glyx-ffmpeg-libs-<version>-<platform>-<arch>.tar.gz`: the five FFmpeg
  runtime libraries, the FFmpeg licence texts and `SOURCE.txt` (where the
  source is).

glyx-media is versioned with Glyx itself (the `<version>` is the Glyx release
version), so each Glyx release has a matching one.

The manifest is signed with Ed25519 and lists the SHA-256 of the library, of the
archive and of **each FFmpeg library**, so everything that gets loaded is
covered by the signature. The loader checks all of it before `dlopen`.

`glyx-media` looks for the FFmpeg libraries next to itself: `$ORIGIN` on Linux,
`@loader_path` on macOS, and on Windows the Rust loader's
`LOAD_WITH_ALTERED_SEARCH_PATH`.

## How you get it

You don't download anything by hand. When an app declares `video`, `camera` or
`microphone`, `glyx dev` and `glyx package` check `~/.glyx/cache/media/`
(`%USERPROFILE%\.glyx\cache\media\` on Windows) for this Glyx version and
download what's missing from the matching release: the library, its manifest,
and the FFmpeg archive, which is unpacked there. Updating Glyx therefore brings
the matching media library along, the same way it does for the runner.

- A cached file that no longer verifies is downloaded again.
- A library you built yourself (a dev manifest, or no manifest) is never
  replaced.
- `GLYX_MEDIA_NO_DOWNLOAD=1` turns the download off.
- `GLYX_TOOLS_BASE` (the CLI's self-hosting variable) points the download at a
  mirror: files are fetched from `$GLYX_TOOLS_BASE/media/<name>`.

`glyx package` copies the library, its manifest and exactly the FFmpeg
libraries the manifest lists into your app, with FFmpeg's licence notice under
`LICENSES/ffmpeg/`.

## Building locally

- Windows: `.\build-windows.ps1` (downloads the LGPL FFmpeg).
- macOS: `./build-ffmpeg-macos.sh <arm64|x64> <prefix>` for the LGPL FFmpeg,
  then compile `glyx_media.c` against `<prefix>` (see the workflow for the exact
  command). `./build-macos.sh` is a quick local build against Homebrew's FFmpeg;
  that one is **GPL-linked and must not be shipped**.
- Linux: `./build-linux.sh` builds against the distribution's FFmpeg, which is
  GPL-linked; do not ship it either.

A signed release build comes from the workflow, which holds the signing key. The
scripts build the Glyx version by default, which is what the CLI looks for; a
library you build yourself uses a dev manifest and is never replaced by a download.
