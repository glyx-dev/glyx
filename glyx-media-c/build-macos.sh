#!/usr/bin/env bash
# build-macos.sh
#
# Builds glyx-media.dylib for macOS (x64 or arm64, detected automatically).
#
# Prerequisites:
#   brew install ffmpeg pkg-config
#
# Usage:
#   ./build-macos.sh            # the Glyx version
#   ./build-macos.sh 1.2.0      # override version

set -euo pipefail

# Default to the Glyx version: glyx looks for glyx-media-<that version>-... in its cache.
VERSION="${1:-$(sed -n 's/^version *= *"\(.*\)"/\1/p' "$(dirname "${BASH_SOURCE[0]}")/../crates/glyx-media/Cargo.toml" | head -n 1 | tr -d '\r')}"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Detect architecture
RAW_ARCH="$(uname -m)"
if [ "$RAW_ARCH" = "arm64" ]; then
    TARGET_ARCH="arm64"
    CLANG_ARCH="arm64"
else
    TARGET_ARCH="x64"
    CLANG_ARCH="x86_64"
fi

OUTPUT_NAME="glyx-media-$VERSION-macos-$TARGET_ARCH.dylib"
OUTPUT_PATH="$SCRIPT_DIR/$OUTPUT_NAME"

# -- 1. Ensure ffmpeg is available via pkg-config ------------------------------

if ! command -v pkg-config &>/dev/null || ! pkg-config --exists libavformat 2>/dev/null; then
    echo "ffmpeg not found via pkg-config. Installing via Homebrew..."
    if ! command -v brew &>/dev/null; then
        echo "ERROR: Homebrew is required. Install from https://brew.sh"
        exit 1
    fi
    brew install ffmpeg pkg-config
fi

FFMPEG_CFLAGS=$(pkg-config --cflags libavformat libavcodec libswscale libswresample libavutil)
FFMPEG_LIBS=$(pkg-config --libs   libavformat libavcodec libswscale libswresample libavutil)

echo "ffmpeg: $(pkg-config --modversion libavformat)"

# -- 2. Compile ----------------------------------------------------------------

echo ""
echo "Compiling $OUTPUT_NAME ..."
clang -arch "$CLANG_ARCH" \
    -shared -fPIC -O2 \
    $FFMPEG_CFLAGS \
    "$SCRIPT_DIR/glyx_media.c" \
    $FFMPEG_LIBS \
    -o "$OUTPUT_PATH"

echo "Built: $OUTPUT_PATH"

# -- 3. Cache to ~/.glyx/cache/media/ -----------------------------------------

CACHE_DIR="$HOME/.glyx/cache/media"
mkdir -p "$CACHE_DIR"
cp "$OUTPUT_PATH" "$CACHE_DIR/$OUTPUT_NAME"
echo "Cached: $CACHE_DIR/$OUTPUT_NAME"

echo ""
echo "Next steps:"
echo "  ./generate-dev-manifest.sh $VERSION macos $TARGET_ARCH"
echo "  export GLYX_MEDIA_SKIP_VERIFY=1"
echo "  glyx dev"
