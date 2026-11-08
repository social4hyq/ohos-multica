#!/usr/bin/env bash
set -euo pipefail
parts=$(mktemp -d /data/storage/el2/base/cache/multica-route1-send-XXXXXX)
trap 'rm -r "$parts"' EXIT
split -b 10000000 "$1" "$parts/part-"
for part in "$parts"/part-*; do hdc file send "$part" "/data/local/tmp/route1-$(basename "$part")"; done
hdc shell 'cat /data/local/tmp/route1-part-* > /data/local/tmp/route1.hap'
result=$(hdc shell bm install -p /data/local/tmp/route1.hap 2>&1)
printf '%s\n' "$result"
grep -q 'install bundle successfully' <<< "$result"
hdc shell aa force-stop com.huawei.ohos_electron
hdc shell aa start -a EntryAbility -b com.huawei.ohos_electron -m electron
