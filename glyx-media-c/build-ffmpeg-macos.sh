#!/usr/bin/env bash
# build-ffmpeg-macos.sh
#
# Builds an LGPL-only, relocatable FFmpeg for macOS from source, for glyx-media
# to link against and ship next to. Used by .github/workflows/glyx-media-build.yml
# (and runnable by hand).
#
# Why from source: Homebrew's FFmpeg is built with GPL components (x264, x265),
# which would put GPL terms on glyx-media and on every app that ships it, and
# Homebrew no longer supports Intel. This build is LGPL-only, uses no external
# libraries (only what every Mac ships), and its install names are @rpath so the
# dylibs work from wherever they are put next to glyx-media.
#
# Usage:
#   ./build-ffmpeg-macos.sh <arm64 | x64> <install-prefix>
#
# x64 is cross-compiled, so it works on an Apple Silicon machine too. It needs
# `nasm` for the x86 assembly (brew install nasm).
set -euo pipefail

ARCH="${1:?usage: $0 <arm64 | x64> <install-prefix>}"
PREFIX="${2:?usage: $0 <arm64 | x64> <install-prefix>}"

# Same major library versions as the Windows build (avcodec 63, avformat 63,
# avutil 61, swscale 10, swresample 7). Bump the version and the checksum together.
FFMPEG_VERSION="9.0.1"
FFMPEG_SHA256="cf38e0e28c7e5605942c4a77755349b0145804a397af37eb1fb4c77cb237f635"
MIN_MACOS="13.0"

case "$ARCH" in
    arm64) ARCH_ARGS=(--arch=arm64 --cc="clang -arch arm64") ;;
    x64)   ARCH_ARGS=(--arch=x86_64 --enable-cross-compile --target-os=darwin --cc="clang -arch x86_64") ;;
    *)     echo "unknown arch '$ARCH' (use arm64 or x64)"; exit 1 ;;
esac
CLANG_ARCH=$([ "$ARCH" = "x64" ] && echo x86_64 || echo arm64)

if [ "$ARCH" = "x64" ] && ! command -v nasm >/dev/null; then
    echo "nasm is needed for the x86_64 build: brew install nasm"
    exit 1
fi

WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
mkdir -p "$PREFIX"
PREFIX="$(cd "$PREFIX" && pwd)"

# -- 1. Fetch and verify the source -------------------------------------------

echo "Downloading FFmpeg $FFMPEG_VERSION ..."
curl -fsSL "https://ffmpeg.org/releases/ffmpeg-$FFMPEG_VERSION.tar.xz" -o "$WORK/ffmpeg.tar.xz"
echo "$FFMPEG_SHA256  $WORK/ffmpeg.tar.xz" | shasum -a 256 -c -
tar -xJf "$WORK/ffmpeg.tar.xz" -C "$WORK"
cd "$WORK/ffmpeg-$FFMPEG_VERSION"

# -- 2. Configure: LGPL only, no external libraries ---------------------------
#
# --disable-autodetect keeps it from picking up Homebrew libraries on the build
# machine that users won't have. The system frameworks and zlib/bzip2/iconv
# (in every macOS) are switched on explicitly.

./configure \
    --prefix="$PREFIX" \
    --install-name-dir=@rpath \
    --enable-shared --disable-static --enable-pic \
    --disable-gpl --disable-nonfree --disable-autodetect \
    --enable-videotoolbox --enable-audiotoolbox \
    --enable-zlib --enable-bzlib --enable-iconv \
    --disable-programs --disable-doc --disable-avdevice --disable-avfilter \
    "${ARCH_ARGS[@]}" \
    --extra-cflags="-mmacosx-version-min=$MIN_MACOS" \
    --extra-ldflags="-arch $CLANG_ARCH -mmacosx-version-min=$MIN_MACOS"

# Licence guard: refuse to build anything that isn't LGPL-only.
for flag in GPL NONFREE; do
    if ! grep -q "^#define CONFIG_$flag 0" config.h; then
        echo "ERROR: CONFIG_$flag is not 0 in config.h; this build is not LGPL-only"
        exit 1
    fi
done
echo "Licence guard passed: CONFIG_GPL 0, CONFIG_NONFREE 0"

# -- 3. Build and install ------------------------------------------------------

make -j"$(sysctl -n hw.ncpu)"
make install

# -- 4. Licence texts and source offer, shipped with the libraries ------------

LIC="$PREFIX/share/licenses/ffmpeg"
mkdir -p "$LIC"
cp COPYING.LGPLv2.1 COPYING.LGPLv3 COPYING.GPLv2 COPYING.GPLv3 LICENSE.md "$LIC/" 2>/dev/null || true
cat > "$LIC/SOURCE.txt" <<EOF
These FFmpeg libraries are FFmpeg $FFMPEG_VERSION, built unmodified from the
official source release as LGPL (no GPL or non-free components, no external
libraries), for $ARCH macOS:

  https://ffmpeg.org/releases/ffmpeg-$FFMPEG_VERSION.tar.xz
  sha256 $FFMPEG_SHA256

Build script: glyx-media-c/build-ffmpeg-macos.sh in https://github.com/glyx-dev/glyx
They are separate shared libraries: replace them with another build of the
same library versions (avcodec 63, avformat 63, avutil 61, swscale 10,
swresample 7) if you wish.
EOF

# -- 5. The libraries must depend only on each other and on the system --------

bad=0
for f in "$PREFIX"/lib/lib*.dylib; do
    [ -L "$f" ] && continue
    extra="$(otool -L "$f" | tail -n +2 | awk '{print $1}' \
        | grep -Ev '^(@rpath/|@loader_path/|/usr/lib/|/System/Library/)' || true)"
    if [ -n "$extra" ]; then
        echo "ERROR: $(basename "$f") depends on libraries that are not shipped or system:"
        echo "$extra"
        bad=1
    fi
done
[ "$bad" = 0 ] || exit 1

echo "Built FFmpeg $FFMPEG_VERSION ($ARCH, LGPL) into $PREFIX"
