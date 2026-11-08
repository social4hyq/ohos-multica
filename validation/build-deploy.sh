#!/usr/bin/env bash
set -euo pipefail
root=/storage/Users/currentUser/HarmonyPC/Software/ohos-multica
cd /data/storage/el2/base/cache/electron-ohos/libelectron/ohos_hap
node /data/storage/el2/base/cache/deveco-cli-view/inst/node_modules/@deveco/deveco-cli-openharmony-arm64/dist/cli.js build > "$root/logs/validation-${1:-debug}-hap-build.log" 2>&1
parts=$(mktemp -d /data/storage/el2/base/cache/multica-vparts-XXXXXX)
split -b 10000000 electron/build/default/outputs/default/electron-default-signed.hap "$parts/part-"
for p in "$parts"/part-*; do hdc file send "$p" /data/local/tmp/multica-validation-$(basename "$p"); done
hdc shell 'cat /data/local/tmp/multica-validation-part-* > /data/local/tmp/multica-validation.hap'
hdc shell aa force-stop com.huawei.ohos_electron
hdc shell bm install -p /data/local/tmp/multica-validation.hap
hdc shell aa start -a EntryAbility -b com.huawei.ohos_electron -m electron
rm -r "$parts"
