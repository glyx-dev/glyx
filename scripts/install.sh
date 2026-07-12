#!/usr/bin/env sh
# Glyx CLI installer (macOS / Linux)
#
#   curl -fsSL https://glyx.dev/install.sh | sh
#   (or: curl -fsSL https://github.com/glyx-dev/glyx/releases/latest/download/install.sh | sh)
#
# Installs the `glyx` binary to ~/.glyx/bin and prints a PATH hint.
set -eu

REPO="glyx-dev/glyx"
INSTALL_DIR="${GLYX_INSTALL_DIR:-$HOME/.glyx/bin}"

case "$(uname -s)" in
  Darwin) os="apple-darwin" ;;
  Linux)  os="unknown-linux-gnu" ;;
  *) echo "error: unsupported OS: $(uname -s)" >&2; exit 1 ;;
esac

case "$(uname -m)" in
  arm64|aarch64) arch="aarch64" ;;
  x86_64|amd64)  arch="x86_64" ;;
  *) echo "error: unsupported architecture: $(uname -m)" >&2; exit 1 ;;
esac

# Released targets today: aarch64-apple-darwin, x86_64-unknown-linux-gnu.
target="${arch}-${os}"

if [ -n "${GLYX_VERSION:-}" ]; then
  url="https://github.com/${REPO}/releases/download/${GLYX_VERSION}/glyx-${target}"
else
  url="https://github.com/${REPO}/releases/latest/download/glyx-${target}"
fi

echo "Downloading glyx (${target})..."
mkdir -p "$INSTALL_DIR"
curl -fSL --progress-bar "$url" -o "$INSTALL_DIR/glyx"
chmod +x "$INSTALL_DIR/glyx"

echo ""
echo "✓ glyx installed to $INSTALL_DIR/glyx"

case ":$PATH:" in
  *":$INSTALL_DIR:"*) ;;
  *)
    echo ""
    echo "Add it to your PATH (then restart your shell):"
    echo ""
    echo "  echo 'export PATH=\"$INSTALL_DIR:\$PATH\"' >> ~/.$(basename "${SHELL:-bash}")rc"
    ;;
esac

echo ""
echo "Get started:  glyx create my-app"
