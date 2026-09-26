#!/usr/bin/env bash
# End-to-end devtools (GDP) check on a real app, for CI: launch the
# calculator example (QuickJS, CPU renderer) with devtools on, run the smoke
# test and the calculator automation test against it, then stop it.
#
# Prerequisites (see .github/workflows/ci.yml, job `devtools-e2e`):
#   - bun install at the repo root
#   - the app bundle:  (cd examples/calculator && bun build js/app.jsx --outfile js/dist/app.js
#                        --target browser --format iife --define "process.env.NODE_ENV='production'")
#   - cargo build -p calculator
#   - a display (CI: run under `xvfb-run -a`)
set -euo pipefail

root="$(cd "$(dirname "$0")/../.." && pwd)"
app="$root/examples/calculator"
bin="$root/target/debug/calculator"
[ -x "$bin" ] || bin="$bin.exe"
info="$app/target/glyx/devtools.json"
log="$app/target/glyx/devtools-e2e.log"

mkdir -p "$app/target/glyx"
rm -f "$info"
cd "$app"
GLYX_CPU_RENDER=1 GLYX_DEVTOOLS_PORT=0 GLYX_DEVTOOLS_FILE="$info" "$bin" > "$log" 2>&1 &
pid=$!
trap 'kill $pid 2>/dev/null || true' EXIT

# Wait for the app to publish its devtools address (up to 60 s).
for _ in $(seq 1 120); do
  [ -s "$info" ] && break
  if ! kill -0 $pid 2>/dev/null; then echo "app exited early:"; cat "$log"; exit 1; fi
  sleep 0.5
done
[ -s "$info" ] || { echo "no devtools file after 60 s:"; cat "$log"; exit 1; }
sleep 3 # first frames

status=0
bun "$root/scripts/devtools/gdp-smoke.mjs" "$info" || status=1
bun "$root/tests/devtools/gdp-calculator.mjs" "$info" || status=1

if grep -q "uncaught error" "$log"; then
  echo "JS errors in the app log:"; grep -A5 "uncaught error" "$log"; status=1
fi
[ $status -eq 0 ] || { echo "--- app log ---"; tail -50 "$log"; }
exit $status
