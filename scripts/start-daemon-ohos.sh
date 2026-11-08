#!/usr/bin/env bash
set -euo pipefail
export TMPDIR=/data/storage/el2/base/cache
export MULTICA_AGENT_TEMP_BASE="$TMPDIR"
args=()
if [[ -n "${1:-}" ]]; then args=(--profile "$1"); fi
MULTICA_BIN="$HOME/.harmonybrew/bin/multica"
if [[ ! -x "$MULTICA_BIN" ]]; then
  MULTICA_BIN="$HOME/.local/bin/multica"
fi
exec "$MULTICA_BIN" "${args[@]}" daemon start --foreground --no-auto-update
