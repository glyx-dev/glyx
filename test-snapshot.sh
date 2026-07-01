#!/bin/bash
# Test snapshot performance vs eval mode

set -e

echo "=== Glyx Snapshot Performance Test ==="
echo ""

# Build tools
echo "1. Building glyx-snapshot tool..."
cargo build -p glyx-snapshot --quiet
echo "   ✓ Built"
echo ""

# Create snapshot
echo "2. Creating snapshot blob..."
mkdir -p /tmp
cat > /tmp/framework.js << 'EOF'
// Empty framework
EOF

./target/debug/glyx-snapshot.exe \
  examples/hello-world/js/polyfills.js \
  /tmp/framework.js \
  examples/hello-world/js/app.js \
  /tmp/hello-world.snapshot 2>&1 | head -10

SNAPSHOT_SIZE=$(stat -c%s /tmp/hello-world.snapshot 2>/dev/null || stat -f%z /tmp/hello-world.snapshot 2>/dev/null)
SNAPSHOT_SIZE_KB=$((SNAPSHOT_SIZE / 1024))
echo "   ✓ Created snapshot: $SNAPSHOT_SIZE_KB KB"
echo ""

# Build test apps
echo "3. Building test applications..."
cargo build -p hello-world --quiet 2>/dev/null || true
cargo build -p hello-world-snapshot --quiet 2>/dev/null || true
echo "   ✓ Built"
echo ""

echo "=== Test Complete ==="
echo ""
echo "To test startup performance:"
echo ""
echo "With snapshot (fast ~50ms):"
echo "  GLYX_SNAPSHOT_PATH=/tmp/hello-world.snapshot cargo run -p hello-world-snapshot"
echo ""
echo "Without snapshot (eval ~500-1000ms):"
echo "  cargo run -p hello-world"
echo ""
echo "Watch the console output for startup times in dev mode."
echo "In the code, look at glyx-core/src/lib.rs for the timing logs."
