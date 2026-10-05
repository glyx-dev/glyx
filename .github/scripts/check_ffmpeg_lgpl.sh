#!/usr/bin/env bash
# Fails unless the FFmpeg we are about to ship is LGPL-only.
#
# A GPL build (libx264, libx265, ...) would put GPL terms on glyx-media and on
# every app that ships it, so the release builds refuse to go on with one.
#
# Usage: check_ffmpeg_lgpl.sh <path to an ffmpeg binary from the build>
set -euo pipefail

bin="${1:?usage: $0 <ffmpeg binary>}"

version_out="$("$bin" -version)"
head -n 3 <<<"$version_out"

if grep -Eq -- '--enable-(gpl|nonfree)' <<<"$version_out"; then
  echo "::error::this FFmpeg was configured with --enable-gpl or --enable-nonfree; it must not be shipped"
  exit 1
fi

# `ffmpeg -L` prints the licence the binary was built under.
license_out="$("$bin" -L)"
if ! grep -q "Lesser General Public License" <<<"$license_out"; then
  echo "::error::this FFmpeg does not report the LGPL as its licence:"
  head -n 6 <<<"$license_out"
  exit 1
fi

echo "FFmpeg licence check passed: LGPL only (no --enable-gpl / --enable-nonfree)."
