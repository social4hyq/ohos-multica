# Multica 分发与本机签名

## 当前状态

| 产物 | 渠道 | 状态 |
|---|---|---|
| CLI / daemon / 桌面 HAP | `brew install multica` | 0.8.1_3 已出瓶、本机装瓶与设备验收通过：在线×8、登录控件×0 |

`multica` 同时提供宿主 CLI/daemon 与**未签名桌面 HAP**。签名使用用户本机的开发者材料与包含该设备的调试 profile，不把证书、私钥或账号状态放进 bottle。

配方以 tap 的 [multica.rb](https://github.com/social4hyq/homebrew-core/blob/main/Formula/m/multica.rb) 为准；OHOS 壳配置差异与安装器由 tap 的 `Patches/multica/` 管理；formula 不再下载 `ohos-multica` 源码归档。后者仅保留文档、测试与工具链维护用途。

## 安装与更新

```bash
brew tap social4hyq/core
brew install multica

# 待签名的桌面安装包
ls "$(brew --prefix multica)/libexec/multica-desktop-unsigned.hap"
```

1. 首次使用，先配置 Multica 生产环境登录、daemon 与本机 agent。配置和现有 supervisor 的运行方式见 [README](README.md)、[构建流水线](BUILD-PIPELINE.md)。
2. 使用本机开发者材料给上述 HAP 签名。已有 DevEco Studio / DevEco CLI 自动签名材料可以复用，不需要为每次构建重新生成。
3. 执行 `bash "$(brew --prefix multica)/share/multica/install-hap.sh" <signed.hap> --start`。脚本会分块传输、强停旧应用、覆盖安装并启动；请先确认 daemon 有 supervisor 保活、设备屏幕已解锁。
4. 更新时执行 `brew upgrade multica`，然后重复本机签名和安装。当前不依赖 Electron 自动更新器更新 HAP。

`route1/sign-with-app.cjs` 是本机验收使用的辅助脚本：在内存中解码 DevEco 材料口令，调用 `hap-sign-tool sign-app`，输出时遮蔽口令。其 SDK 和工作工程路径是本机路径，**不是跨机器零配置签名器**；换机按 [第二台 PC 验收指南](validation/SECOND-PC-ACCEPTANCE.md) 重新配置，不复制本机私钥来冒充换机验收。

## CI 构建链

1. 从上游 tag 获取 Multica 源码，应用 tap 的 OHOS 补丁；从同一源码构建 Go CLI/daemon。
2. 安装构建依赖并运行 electron-vite，产出 main / preload / renderer；不向 HAP 内嵌不可在沙箱执行的 daemon。
3. 只安装主进程实际 external 的 `@electron-toolkit/utils`、`electron-updater` 及其生产依赖，版本沿用本次源码构建已解析的版本。renderer 依赖已经打进 Vite 产物，不再复制整个开发用 pnpm node_modules。
4. 使用 Electron OHOS 预编译原生库和壳源码，在 OpenHarmony CI 容器内重新编译 ArkTS、打包未签名 HAP。
5. 执行 formula 测试、生成 bottle、验证从 bottle 安装，再回写并合入 tap。

原始 #913 bottle 曾错误打入开发依赖（约 877 MiB、47,566 项）。修复的验收不仅检查 HAP 存在，还检查字节码、Electron 库、主进程负载、ZIP CRC，以及不包含 TypeScript / eslint-config 开发树。

## 私有工具链镜像

构建使用私有 `ghcr.io/social4hyq/electron-ohos-ci`。它是通用 OpenHarmony ci-runner 的独立派生镜像；不覆盖通用镜像，也不将 HarmonyOS CLT 放到公开 Release。

- 镜像配方：[ci/electron-ohos-ci/Dockerfile](ci/electron-ohos-ci/Dockerfile)。
- 本机工具链打包：[scripts/pack-clt.sh](scripts/pack-clt.sh)。只保留本壳构建所需组件；不支持用这个 NDK-less 子集编译任意 C++ 工程。
- tap 的 `OHOS_CI_IMAGE_OVERRIDES` 为 `multica` 指定镜像 digest；私有拉取通过 `GHCR_PULL_TOKEN` 授权，凭据不写进镜像。
- 兼容差异是 hvigor 的 native-host 判断、无系统日志服务时的 stderr 日志适配，以及打包器所需的 SDK clang 运行库。
- 容器的过高 `RLIMIT_NOFILE` 会触发 OHOS libc FD 表分配异常；构建过程限制上限，不使用 CPU 信息伪造来规避崩溃。

CLT 来自本机工具链安装，未确认公开再分发条件，故保留为私有构建输入。普通用户消费的是已构建的 HAP，不需要拉取该镜像或在本机重编壳。

## 从旧三包迁移

```bash
brew update
brew upgrade multica   # 未安装过则 brew install multica
brew test multica
```

先确认 `$(brew --prefix multica)/libexec/multica-desktop-unsigned.hap` 和 `share/multica/install-hap.sh` 已存在，再卸载本机原来装过的 `multica-desktop`、`multica-ohos`。不要卸载 `multica`，不要删除 `~/.multica`。旧两包不再发布；壳差异与安装器由统一 formula 的本地补丁提供。

卸载旧 formula 不会删除已经安装到设备的 HAP；更新设备应用仍须对新包本机签名并覆盖安装。现有 profile、agent 登录和 supervisor 配置保持不变；整合包不会自动改写它们。原 supervisor 入口仍按 README 配置，不因合成一个安装包就获得系统级后台服务能力。

## 单包整合时的本机验证记录（历史）

- `multica 0.8.1_1` 安装回执 `poured_from_bottle=true`；`brew test multica` 同时验证 CLI 和 HAP，通过。
- 未签名 HAP 249,734,370 字节；SHA256 `6869f49aba25dc5ec829237eacaf502516f98f34620f3b16dd7783722edecf66`。HAP 文件名保留 `multica-desktop-unsigned.hap`，不表示仍有独立桌面 formula。
- 编译后的权限仅 `INTERNET`、`GET_NETWORK_INFO`；本机材料签名后，使用**瓶内安装脚本**部署，设备返回 `install bundle successfully.` 和 `start ability successfully.`。
- 新 CLI 重启 daemon 后，健康接口为 running，列出八个 agent；新 HAP 的“团队 → 我的智能体”布局树核验八行均在线、登录控件为零。
- 在线按叶节点计数消除父子重复；不将简介中的“沿用本机登录”当成登录控件。证据在本机 `logs/consolidation/`：`bottle-receipt.json`、`brew-test.log`、`install.log`、`start-final.log`、`layout-unified-final.json`、`acceptance.json`、`health-final.json`。
- 旧桌面 formula 已从本机卸载，当前仅安装 `multica`，现有设备应用与配置未删除。
- 回归：`bash tests/install-hap.sh`、`python3 ci/electron-ohos-ci/test_patch_host.py`、`python3 tests/unified-formula.py <tap>/Formula/m/multica.rb`。

## 验收范围与维护

本次交付以**本机装瓶 → 本机材料签名 → 设备安装 → 布局树在线×8、登录×0**为标准；第二台 PC 的全新安装是独立验收，不能由本机结果替代。各 agent 的执行能力及未覆盖功能见 [功能验收矩阵](validation/ACCEPTANCE.md)。

不向 multica-ai 提交上游 PR。OHOS 补丁常驻自有渠道；升级源码版本时必须重验补丁、桌面构建、HAP 运行时依赖和设备连接。autobump 的补丁重打与冲突告警仍是维护项，不把“当前版本已出瓶”写成未来版本必然可构建。

## 最小化适配

- 主源码保持官方 Multica tag，不使用 fork 源码。
- Electron 壳解包后通过声明式补丁应用名称、深链、原生库提取、未签名配置与权限差异；不再覆盖整份 module 模板，也不调用本仓 branding Python 脚本。
- 图标直接复制上游 Multica 资源；设备安装器作为 tap 补丁新增文件安装。
- 当前 Electron 预编译包仍使用已校验的公开镜像，CLT 仍使用已验证的私有镜像；尚未取得可直接替代的官方公开输入，不能据此声称完全消除了非官方资源依赖。
- 第一轮 `0.8.1_2` 已通过 CI 构建/装瓶测试、本机装瓶、签名安装和新版布局验收（在线×8、登录控件×0）。HAP 249,734,370 字节，SHA256 `5bd267e57245394b55061830eccee901007d5765a049117afaa794062a5c58eb`；关键负载与前一瓶内容哈希一致。证据在本机 `logs/minimality-implementation/`。锁文件、依赖版本和工具链环境未在本轮顺带修改。

### 冻结锁文件验证

`0.8.1_3` 已使用 `--frozen-lockfile` 完成 CI 构建/出瓶与装瓶测试；CI 报告锁文件无需更新、跳过依赖解析。本机 `brew test multica`、签名、瓶内脚本安装启动以及新版布局在线×8 / 登录控件×0 均通过。未签名 HAP 249,734,370 字节，SHA256 `56c1c29c621dfbb2e562be2209deb56c736651d29af50c4271ad1a7c2ccf2582`。

证据在本机 `logs/minimality-implementation/frozen-*`；`pr923-ci.log` 保存完整 CI 日志。冻结的是 pnpm 工作区安装，独立 npm 运行时依赖安装尚未改成消费固定锁文件，因此不声称整个包已经完全可复现。其他重复配置与环境项尚未裁剪。
