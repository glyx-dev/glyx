#!/usr/bin/env bash
# generate-dev-manifest.sh
#
# Creates a dev manifest + 64-zero-byte stub signature for a locally-built
# shared library so glyx-media's verify.rs accepts it when
# GLYX_MEDIA_SKIP_VERIFY=1.
#
# Usage:
#   ./generate-dev-manifest.sh [version] [platform] [arch]
#
# Examples:
#   ./generate-dev-manifest.sh                       # auto-detect everything
#   ./generate-dev-manifest.sh 1.0.0 macos arm64
#   ./generate-dev-manifest.sh 1.0.0 linux x64

set -euo pipefail

VERSION="${1:-1.0.0}"
PLATFORM="${2:-}"
ARCH="${3:-}"

# Auto-detect platform
if [ -z "$PLATFORM" ]; then
    case "$(uname -s)" in
        Darwin) PLATFORM="macos" ;;
        Linux)  PLATFORM="linux" ;;
        *) echo "ERROR: Unknown platform $(uname -s)"; exit 1 ;;
    esac
fi

# Auto-detect arch
if [ -z "$ARCH" ]; then
    case "$(uname -m)" in
        arm64|aarch64) ARCH="arm64" ;;
        *) ARCH="x64" ;;
    esac
fi

# File extension
case "$PLATFORM" in
    macos) EXT="dylib" ;;
    linux) EXT="so" ;;
    *) echo "ERROR: Unknown platform '$PLATFORM' (expected: macos, linux)"; exit 1 ;;
esac

STEM="glyx-media-$VERSION-$PLATFORM-$ARCH"
CACHE_DIR="$HOME/.glyx/cache/media"
LIB_PATH="$CACHE_DIR/$STEM.$EXT"

if [ ! -f "$LIB_PATH" ]; then
    echo "ERROR: Library not found at: $LIB_PATH"
    echo "Run build-$PLATFORM.sh first."
    exit 1
fi

mkdir -p "$CACHE_DIR"

# SHA-256 (shasum on macOS, sha256sum on Linux)
if command -v sha256sum &>/dev/null; then
    HASH=$(sha256sum "$LIB_PATH" | awk '{print $1}')
else
    HASH=$(shasum -a 256 "$LIB_PATH" | awk '{print $1}')
fi

MANIFEST_PATH="$CACHE_DIR/$STEM.manifest.json"
SIG_PATH="$CACHE_DIR/$STEM.manifest.sig"

# Write manifest (no trailing newline — must match what verify.rs parses)
printf '{"version":"%s","url":"https://cdn.glyx.dev/media/%s/%s.%s","sha256":"%s"}' \
    "$VERSION" "$VERSION" "$STEM" "$EXT" "$HASH" > "$MANIFEST_PATH"

# Write 64 zero bytes as stub signature
dd if=/dev/zero bs=64 count=1 > "$SIG_PATH" 2>/dev/null

echo "Manifest: $MANIFEST_PATH"
echo "Sig (dev stub): $SIG_PATH"
echo "SHA-256: $HASH"
echo ""
echo "Set this env var to skip Ed25519 verification in dev:"
echo "  export GLYX_MEDIA_SKIP_VERIFY=1"
echo "Then run: glyx dev"
