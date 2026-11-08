#!/usr/bin/env bash
# Build the signed electron HAP from the working project in its clean product
# state (route1 probe declaration and probe binary removed). Signing uses the
# deveco-cli auto-sign materials configured in build-profile.json5; signing
# secrets never enter this project.
#
# Prerequisite: scripts/build-desktop.sh has refreshed the app payload.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
WORK=/data/storage/el2/base/cache/electron-ohos/libelectron/ohos_hap
DEVECO_CLI=/data/storage/el2/base/cache/deveco-cli-view/inst/node_modules/@deveco/deveco-cli-openharmony-arm64/dist/cli.js

if [[ ! -d "$WORK" ]]; then
  echo "HAP working project not found: $WORK" >&2
  echo "Rebuild it per BUILD-PIPELINE.md (从零重建) first." >&2
  exit 1
fi

cp "$PROJECT_DIR/hap-work/module.clean.json5" "$WORK/electron/src/main/module.json5"
rm -f "$WORK/electron/libs/arm64-v8a/route1-probe.bin"

cd "$WORK"
node "$DEVECO_CLI" build > "$PROJECT_DIR/logs/build-hap.log" 2>&1 || {
  echo "build failed, see $PROJECT_DIR/logs/build-hap.log" >&2
  exit 1
}

ls -la "$WORK/electron/build/default/outputs/default/electron-default-signed.hap"
