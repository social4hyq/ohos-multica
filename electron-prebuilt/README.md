# Electron OHOS 预编译包

构建 HAP 需要 openharmony-sig/electron 的 PC(2in1) 预编译包。**再分发条款待核查，本仓不附带二进制**，请从官方渠道下载：

1. 浏览器登录华为账号，从 CodeHub 的 openharmony-sig/electron 发布页下载（移植指南镜像：gitcode `imansmallapple/electron` 的 `README_en.md` 有入口与构建说明）
2. 文件名：`v34.9.0-20261030.1-release.zip`（Electron 34.9.0 / Chromium 132 / Node 20.18.1，`process.platform === "openharmony"`）
3. 放入本目录并校验完整性：

   ```bash
   sha256sum v34.9.0-20261030.1-release.zip
   # 应等于 599e97b3d8b1e5071a2387496104b443e58079a5f5c165b0114e65ffc601df3a
   ```

4. 解包到工作路径：`unzip -q v34.9.0-20261030.1-release.zip -d /data/storage/el2/base/cache/electron-ohos/libelectron/`（对齐 BUILD-PIPELINE.md「从零重建」的目录结构）
