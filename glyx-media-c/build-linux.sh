#!/usr/bin/env bash
# build-linux.sh
#
# Builds glyx-media.so for Linux x64.
#
# Prerequisites (installed automatically if missing):
#   sudo apt-get install libavformat-dev libavcodec-dev libswscale-dev \
#        libswresample-dev libavutil-dev libavfilter-dev pkg-config
#
# Usage:
#   ./build-linux.sh            # version 1.0.0
#   ./build-linux.sh 1.2.0      # override version

set -euo pipefail

VERSION="${1:-1.0.0}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_ARCH="x64"
OUTPUT_NAME="glyx-media-$VERSION-linux-$TARGET_ARCH.so"
OUTPUT_PATH="$SCRIPT_DIR/$OUTPUT_NAME"

# -- 1. Ensure ffmpeg dev headers are available --------------------------------

if ! command -v pkg-config &>/dev/null || ! pkg-config --exists libavformat 2>/dev/null; then
    echo "ffmpeg dev libraries not found. Installing via apt..."
    sudo apt-get update -qq
    sudo apt-get install -y \
        libavformat-dev libavcodec-dev libswscale-dev \
        libswresample-dev libavutil-dev libavfilter-dev \
        pkg-config gcc
fi

FFMPEG_CFLAGS=$(pkg-config --cflags libavformat libavcodec libswscale libswresample libavutil)
FFMPEG_LIBS=$(pkg-config --libs   libavformat libavcodec libswscale libswresample libavutil)

echo "ffmpeg: $(pkg-config --modversion libavformat)"

# -- 2. Compile ----------------------------------------------------------------

echo ""
echo "Compiling $OUTPUT_NAME ..."
gcc -shared -fPIC -O2 \
    $FFMPEG_CFLAGS \
    "$SCRIPT_DIR/glyx_media.c" \
    $FFMPEG_LIBS \
    -lpthread -lm -lz \
    -o "$OUTPUT_PATH"

echo "Built: $OUTPUT_PATH"

# -- 3. Cache to ~/.glyx/cache/media/ -----------------------------------------

CACHE_DIR="$HOME/.glyx/cache/media"
mkdir -p "$CACHE_DIR"
cp "$OUTPUT_PATH" "$CACHE_DIR/$OUTPUT_NAME"
echo "Cached: $CACHE_DIR/$OUTPUT_NAME"

echo ""
echo "Next steps:"
echo "  ./generate-dev-manifest.sh $VERSION linux $TARGET_ARCH"
echo "  export GLYX_MEDIA_SKIP_VERIFY=1"
echo "  glyx dev"
