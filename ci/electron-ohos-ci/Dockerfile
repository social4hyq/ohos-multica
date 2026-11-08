# electron-ohos-ci: ci-runner + the minimal HarmonyOS command-line toolchain
# for building Electron-on-OHOS HAP shells (multica-desktop today; any
# Electron app port can reuse it). Private image (ghcr) — the toolchain is
# repacked from a licensed system CLT install and is NOT publicly
# redistributable; do not push to a public registry.
#
# clt.tar.gz is produced by ohos-multica/scripts/pack-clt.sh from the system
# CLT at /data/service/hnp/hmos-clt.org/hmos-clt_1.0.0 (HarmonyOS 26.0.0.105)
# and already contains:
#   - hvigor/ + ohpm/ (build drivers)
#   - sdk/default/{openharmony,hms} minus the native NDK (Electron shells
#     compile no C++; only the clang runtime libs ohos_packing_tool links
#     against are kept under native/llvm/.../aarch64-linux-ohos)
#   - the libhilog stderr adapter (lib/libhilog.so) and the hvigor
#     openharmony-host detection patch (see ohos-multica/logs/clt-*)
# Run from a context containing exactly Dockerfile + clt.tar.gz:
#   docker build --build-arg BASE_IMAGE=<ci-runner> -t ghcr.io/social4hyq/electron-ohos-ci:<ver> .

ARG BASE_IMAGE
FROM ${BASE_IMAGE}

ADD clt.tar.gz /opt/electron-ohos-clt/

ENV COMMAND_LINE_TOOL_PATH=/opt/electron-ohos-clt \
    DEVECO_SDK_HOME=/opt/electron-ohos-clt/sdk \
    HOS_SDK_HOME=/opt/electron-ohos-clt/sdk \
    LD_LIBRARY_PATH=/opt/electron-ohos-clt/lib:/opt/electron-ohos-clt/sdk/default/openharmony/native/llvm/lib/clang/15.0.4/lib/aarch64-linux-ohos

# Formulas run hvigor through the brew `node` dependency; verify the baked
# content only (no node ships in this image).
RUN test -f /opt/electron-ohos-clt/hvigor/bin/hvigorw.js \
    && test -f /opt/electron-ohos-clt/ohpm/bin/pm-cli.js \
    && test -f /opt/electron-ohos-clt/sdk/default/sdk-pkg.json \
    && test -f /opt/electron-ohos-clt/lib/libhilog.so \
    && grep -q 'process.platform==="openharmony"' \
        /opt/electron-ohos-clt/hvigor/hvigor/node_modules/@ohos/hvigor-common/src/util/system-util.js
