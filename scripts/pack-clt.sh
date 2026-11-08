#!/bin/bash
# Pack the minimal HarmonyOS command-line toolchain (hvigor + ohpm + SDK
# subset) from this machine's system CLT into a tarball for CI use.
#
# Source: /data/service/hnp/hmos-clt.org/hmos-clt_1.0.0 (HarmonyOS 26.0.0.105)
# Kept:   hvigor/, ohpm/, sdk/default/{openharmony,hms} minus native/ (the
#         shell has no C++ sources; only the clang runtime libs required by
#         ohos_packing_tool are kept), the libhilog stderr adapter, and the
#         hvigor openharmony-host detection patch.
# Run:    bash scripts/pack-clt.sh   (hmdfs grants no exec bit)
set -euo pipefail

CLT=/data/service/hnp/hmos-clt.org/hmos-clt_1.0.0
WORK=/data/storage/el2/base/cache/multica-clt-pack
OUT=/data/storage/el2/base/cache/harmonyos-clt-26.0.0.105.tar.gz

rm -rf "$WORK"
mkdir -p "$WORK/clt/sdk/default" "$WORK/clt/lib"

cp -r "$CLT/hvigor" "$WORK/clt/"
cp -r "$CLT/ohpm" "$WORK/clt/"
cp -r "$CLT/sdk/default/openharmony" "$WORK/clt/sdk/default/"
cp -r "$CLT/sdk/default/hms" "$WORK/clt/sdk/default/"
cp "$CLT/sdk/default/sdk-pkg.json" "$WORK/clt/sdk/default/"

# Native NDK (llvm/sysroot, ~6 GB) is not needed: the shell compiles no C++.
rm -rf "$WORK/clt/sdk/default/openharmony/native" "$WORK/clt/sdk/default/hms/native"
# ...except the clang runtime libraries ohos_packing_tool links against.
LIBDIR="$WORK/clt/sdk/default/openharmony/native/llvm/lib/clang/15.0.4/lib"
mkdir -p "$LIBDIR"
cp -r "$CLT/sdk/default/openharmony/native/llvm/lib/clang/15.0.4/lib/aarch64-linux-ohos" "$LIBDIR/"
cp "$CLT/sdk/default/openharmony/native/oh-uni-package.json" \
   "$WORK/clt/sdk/default/openharmony/native/"
mkdir -p "$WORK/clt/sdk/default/hms/native"
cp "$CLT/sdk/default/hms/native/uni-package.json" \
   "$WORK/clt/sdk/default/hms/native/"

# libhilog stderr adapter (built and proven in the ci-runner image; see
# logs/clt-multica-full/RESULT.md). Fetch the known-good binary from the
# probe container when available, else compile from the bundled source.
if docker exec multica-clt-probe test -f /opt/multica-clt-probe/lib/libhilog.so 2>/dev/null; then
  docker exec multica-clt-probe cat /opt/multica-clt-probe/lib/libhilog.so > "$WORK/clt/lib/libhilog.so"
else
  clang -O2 -shared -fPIC "$(dirname "$0")/../ci/electron-ohos-ci/hilog-stderr.c" -o "$WORK/clt/lib/libhilog.so"
fi

# hvigor host detection: recognize process.platform === "openharmony"
# (container os.type() reports Linux) so the Linux-only image transcoder
# extension is not requested from the HarmonyOS SDK.
node - "$WORK/clt/hvigor" <<'EOF'
const fs = require("node:fs"), cp = require("node:child_process");
const root = process.argv[2];
const old = 'return"HarmonyOS"===os_1.default.type()';
const neu = 'return process.platform==="openharmony"||"HarmonyOS"===os_1.default.type()';
const files = cp.execFileSync("find", [root, "-name", "system-util.js"], {encoding: "utf8"})
  .trim().split("\n").filter(Boolean);
let patched = 0;
for (const p of files) {
  const b = fs.readFileSync(p, "utf8");
  if (!b.includes(old)) continue;
  fs.writeFileSync(p, b.replace(old, neu));
  patched++;
}
console.log(`host-detection patch applied to ${patched} file(s) under ${root}`);
if (!patched) process.exit(1);
EOF

rm -f "$OUT"
tar -C "$WORK/clt" -czf "$OUT" .
sha256sum "$OUT"
ls -lh "$OUT"
du -sh "$WORK/clt"
