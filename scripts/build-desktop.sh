#!/usr/bin/env bash
# Build the Multica desktop payload (electron-vite, prod API endpoints, OHOS
# health-probe patch) and refresh it into the HAP working project.
#
# Idempotent: skips the source patch when its marker is already present.
# Requires: source-minimal checkout with installed node_modules (see
# BUILD-PIPELINE.md). Bypasses `pnpm run bundle-cli` on purpose — the bundled
# CLI cannot execute inside the HAP sandbox; the app talks to the external
# daemon instead (see README "路线一").

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SRC="$PROJECT_DIR/source-minimal"
DESKTOP="$SRC/apps/desktop"
WORK=/data/storage/el2/base/cache/electron-ohos/libelectron/ohos_hap
PAYLOAD="$WORK/web_engine/src/main/resources/resfile/resources/app"

if [[ ! -d "$PAYLOAD" ]]; then
  echo "HAP working project not found: $PAYLOAD" >&2
  echo "Rebuild it per BUILD-PIPELINE.md (从零重建) first." >&2
  exit 1
fi

if grep -q 'exclude: \["fix-path"\]' "$DESKTOP/electron.vite.config.ts"; then
  echo "OHOS patch set already present"
else
  git -C "$SRC" apply "$PROJECT_DIR/patches/0001-desktop-ohos.patch"
  grep -q 'exclude: \["fix-path"\]' "$DESKTOP/electron.vite.config.ts" || {
    echo "patch verification failed (marker missing)" >&2
    exit 1
  }
  echo "candidate.patch applied"
fi

cd "$DESKTOP"
export VITE_API_URL=https://api.multica.ai
export VITE_WS_URL=wss://api.multica.ai/ws
export VITE_APP_URL=https://multica.ai
node --input-type=module -e 'import {build} from "electron-vite"; await build({server:{host:"127.0.0.1"}})'

rm -rf "$PAYLOAD/out"
cp -r "$DESKTOP/out" "$PAYLOAD/out"
echo "payload refreshed: $PAYLOAD/out"
