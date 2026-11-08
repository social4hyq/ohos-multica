#!/usr/bin/env bash
set -euo pipefail
output=$("$1")
grep -q 'ROUTE1_PROBE_V1' <<< "$output"
grep -q 'HOST_AGENT_ACCESS=' <<< "$output"
