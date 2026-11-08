#!/usr/bin/env bash
# Chunk-transfer a built HAP to the local device and install it.
# (The local hdc loopback stalls on transfers >= ~20MB, hence the chunks.)
#
# Usage: install-hap.sh <path-to-signed.hap> [--start]
#   --start also launches the app (requires an unlocked screen; warns instead
#   of failing when the screen is locked).

set -euo pipefail

HAP="${1:?usage: install-hap.sh <signed.hap> [--start]}"
START="${2:-}"
name=multica-install

parts=$(mktemp -d /data/storage/el2/base/cache/multica-iparts-XXXXXX)
trap 'rm -r "$parts"' EXIT

split -b 10000000 "$HAP" "$parts/part-"
for p in "$parts"/part-*; do
  hdc file send "$p" "/data/local/tmp/$name-$(basename "$p")"
done
hdc shell "cat /data/local/tmp/$name-part-* > /data/local/tmp/$name.hap"
hdc shell aa force-stop com.huawei.ohos_electron
hdc shell bm install -p "/data/local/tmp/$name.hap"

if [[ "$START" == "--start" ]]; then
  hdc shell aa start -a EntryAbility -b com.huawei.ohos_electron -m electron || \
    echo "WARN: aa start failed (screen locked?) — start the app manually" >&2
fi
