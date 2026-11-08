# HAP 构建流水线

> 当前发布构建走自有 tap 的单一 `multica` formula：同一上游源码构建 CLI/daemon 与桌面 HAP，OHOS 资产为固定资源，CI 使用私有工具链镜像。用户安装与迁移见 [DISTRIBUTION.md](DISTRIBUTION.md)，配方以 tap 的 [multica.rb](https://github.com/social4hyq/homebrew-core/blob/main/Formula/m/multica.rb) 为准。下文保留本机适配实验与诊断流程，不是当前发布包的另一套构建入口；不要绕过 formula 在本机重新构建发布产物。

目标：从本目录产出**干净** multica 桌面 HAP（无 route1 探针、无 `[obs-*]` 观测日志），签名并安装到本机。

版本锚点（勿随手漂移，升级需重验收）：

| 组件 | 版本 | 来源 |
|---|---|---|
| Multica 源码 | 基线 `e437b11a718d6afce9cd800ba5b8554f3691a133`（工作树带未提交补丁） | `source-minimal/`（git 检出） |
| OHOS 源码补丁 | `patches/0001-desktop-ohos.patch`（854 行，自基线 `e437b11a` `git apply --check` 通过；OHOS 分支约束的健康探测/auth 探针/PAT 铸造 + fix-path 打包 + HOME 重定向） | 本目录 |
| 历史补丁 | `patches/archived/0001-desktop-ohos-health-probe.patch`（早期 node:http 版）、`minimality/candidate.patch`（中期验证版，已并入正式补丁） | 本目录 |
| Electron OHOS | v34.9.0（Chromium 132，Node 20） | `electron-prebuilt/v34.9.0-20261030.1-release.zip`（openharmony-sig/electron，CodeHub 预编译） |
| 构建/签名 | deveco-cli（隔离装在 EL2 cache） | 见「从零重建」 |
| daemon/CLI | `~/.local/bin/multica`（Go 1.27.3 静态构建） | 公式化前为手工产物 |

## 日常重建（EL2 工作工程还在）

```bash
bash scripts/build-desktop.sh     # 打补丁(幂等) + electron-vite 产物刷新进 HAP 工程
bash scripts/build-hap.sh         # 干净态校验 + deveco-cli 构建签名 → electron-default-signed.hap
bash scripts/install-hap.sh /data/storage/el2/base/cache/electron-ohos/libelectron/ohos_hap/electron/build/default/outputs/default/electron-default-signed.hap --start
```

日志：`logs/build-hap.log`（hvigor 全量）、desktop 构建走终端 stdout（约 1–2 min，勿转后台否则会被杀）。

## 从零重建（EL2 cache 被系统清理后）

1. **Electron OHOS 壳**：按 `electron-prebuilt/README.md` 从 CodeHub 官方下载 `v34.9.0-20261030.1-release.zip`（校验 sha256）并解包到 `/data/storage/el2/base/cache/electron-ohos/libelectron/ohos_hap`（按解压后实际布局对齐到该路径）。
2. **Multica 源码**：`git clone https://github.com/multica-ai/multica.git source-minimal && git -C source-minimal checkout e437b11a718d6afce9cd800ba5b8554f3691a133`（OHOS 补丁由 build-desktop.sh 自动应用/校验）。
3. **deveco-cli**：按 README「ArkShell 最小壳」一节的隔离安装方式重装；入口固定在 `/data/storage/el2/base/cache/deveco-cli-view/inst/node_modules/@deveco/deveco-cli-openharmony-arm64/dist/cli.js`。签名材料走 `~/.ohos/config/`（自动签名，口令不进本目录）。
4. **应用负载依赖**：`source-minimal/` 的 `pnpm install` 接线已固化在仓库的 package.json/.npmrc，完整命令与顺序见下方债务节第 2 条；原生依赖矩阵参考 `minimality/native-registry.json`。
5. **branding**：`python3 scripts/apply-branding.py <HAP工程目录> <source-minimal路径>`（资源在 `hap-branding/`，含 LICENSE/NOTICE）。
6. **干净 module 配置**：`cp hap-work/module.clean.json5 <工程>/electron/src/main/module.json5`（含 `multica` scheme、无 `executableBinaryPaths`）。
7. **签名配置**：`hap-work/build-profile.reference.json5` 是参考形状（cert/profile/storeFile 路径指向 `~/.ohos/config`，按本机实际材料改）。
8. 回到「日常重建」三步。

## 已知债务（按偿还优先级）

1. **~~补丁合并归档~~ 已解决（2026-11-08 Phase 3）**：正式补丁 `patches/0001-desktop-ohos.patch`，自基线 `git apply --check` 通过；HOME 重定向、健康探测均有 `process.platform === "openharmony"` 分支；mintPat（登录铸 PAT）与 auth 探针的主进程 fetch 同类问题已补齐（分发场景新用户登录的关键路径）。剩余上游化事项：electron.vite.config 的 fix-path exclude 未加平台分支（全平台可工作，上游化时再议）、cli-bootstrap 的两处 fetch 未 guard（OHOS 上为死路径——CLI 无法随包执行）。
2. **~~node_modules 从零可复现~~ 已解决（2026-11-08）**：接线已固化进 `source-minimal/`——**`package.json` 的 `pnpm.overrides`**（`@tailwindcss/oxide`/`lightningcss` → `@ohos-npm-ports`，及上游稳定性 pin；注意 pnpm 10.28.2 只读 package.json 里的 overrides，`pnpm-workspace.yaml` 那份是给 pnpm 11+ 的副本，修改要同步两处）、`.npmrc` 的 `@ohos-npm-ports` scope 走官方 registry、`ohos-signpost` devDependency + `postinstall`（原生 `.node` 必须签名否则 dlopen Permission denied）。**安装命令（实测唯一可行组合）**：`CI=true npm exec --yes -- pnpm@10.28.2 install --ignore-scripts --no-frozen-lockfile`——要点：上游 pin 10.28.2 必须用同名 JS 版跑（pnpm 12 原生在 openharmony-arm64 无 @pnpm/exe 且 build-script 门禁不可非交互绕过）；`--ignore-scripts` 跳过 electron-builder install-app-deps（OHOS 必败）；改了 specifiers 时必须 `--no-frozen-lockfile`；装完跑 `npm exec --yes -- pnpm@10.28.2 run postinstall` 补签名。**lockfile 陷阱**：specifier 没变时 pnpm 认为 lockfile up-to-date 会跳过解析，overrides 不生效——改 overrides 后必须删 `pnpm-lock.yaml` 强制重解析。**electron 测试桩**：`--ignore-scripts` 跳过了 electron 的下载（且 electron@44 install.js 明确拒绝 openharmony 平台，永远装不上），单测需要 `require('electron')` 不抛错——装完手工打桩：`printf electron > node_modules/.pnpm/electron@<ver>/node_modules/electron/path.txt && mkdir -p .../electron/dist && touch .../electron/dist/electron`（path.txt 不能有换行，index.js 不 trim 且会校验 `dist/<内容>` 存在；测程不 spawn 二进制，桩即可）。
3. **bundle-cli 被绕过**：desktop 的 `pnpm build` 会先打包 CLI 进应用，HAP 沙箱执行不了它，故直接调 electron-vite。上游若改构建链需重估。
4. **deveco-cli 在 EL2 cache**：可能被系统清理（即触发本手册「从零重建」）；长期应固化安装脚本。

## 产物备份

参考/回滚用 HAP 存 `/data/storage/el2/base/files/multica-hap/`（当前：探针版 2026-11-08 12:19）。
