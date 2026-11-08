# Multica 鸿蒙适配验证

> **实验性预发布**：本仓是 [multica-ai/multica](https://github.com/multica-ai/multica) 的第三方 OpenHarmony 移植，与 multica-ai、华为无关。GUI HAP 需用本机开发者证书自行签名安装（调试证书绑定设备 UDID）；daemon/CLI 经 Harmonybrew 自有 tap 的 `multica` formula 安装。构建/重建见 [BUILD-PIPELINE.md](BUILD-PIPELINE.md)，功能验收见 [validation/ACCEPTANCE.md](validation/ACCEPTANCE.md)，第二台设备验证见 [validation/SECOND-PC-ACCEPTANCE.md](validation/SECOND-PC-ACCEPTANCE.md)。

## 当前分发状态

统一由 `brew install multica` 安装 CLI、daemon、未签名桌面 HAP 和设备安装脚本，不再需要三个 formula。统一包 `0.8.1_1` 已完成 CI 出瓶、本机装瓶、签名、设备安装启动及布局树验收：我的智能体在线×8，登录控件×0。安装、旧包迁移、私有 CI 工具链和本机签名流程统一见 [DISTRIBUTION.md](DISTRIBUTION.md)。下面保留适配实验的历史过程，不代表每一段的“尚未验证”仍是当前状态。

## ArkWeb 最小壳

源码：`ArkShell/`。这是独立桥接验证工程，尚未接入 Multica UI、账户或 daemon。

在本机 HarmonyOS PC 上用 `@deveco/deveco-cli` 构建、签名、安装并运行；9 项页面自检全部通过。页面测试先编写，再实现 ArkTS 壳；无 shim/代理的 Node VM 负对照为 0/9。

- `javaScriptOnDocumentStart` 的 shim 先于页面第一个内联脚本执行，顺序为 `shim → page-first-script`。
- 注入发生于 `document.readyState === 'loading'` 阶段。
- 注入代码中已经可以调用 `javaScriptProxy` 同步方法，解析 JSON 字符串并创建 `window.desktopAPI` 静态成员。
- `methodList` 中的方法同步返回字符串、数字、布尔值，且不是 Promise。
- 连续原生调用的递增序号为 1、2。
- 对象通过 `JSON.stringify`/`JSON.parse` 传递；本实验没有验证直接返回 ArkTS 对象。

关键文件：

- `ArkShell/entry/src/main/ets/pages/Index.ets`：Web 组件、原生代理和文档起始 shim。
- `ArkShell/entry/src/main/resources/rawfile/probe.html`：页面首脚本中的 9 项自检。
- `logs/arkweb-final-device.log`：含 `ARKSHELL_PROBE_RESULT` 的最终真机日志。
- `logs/arkweb-passed-layout.log`：包含“验证通过：9/9”的 UI 节点。
- `logs/arkweb-wildcard.png`：实际显示 9/9 通过的真机截图。
- `logs/arkweb-final-crash.log`：崩溃记录查询结果。

注意：初次使用 `scriptRules: ['resource://']` 时注入未触发，仅代理相关的 5 项通过；改为 `['*']` 后 9 项通过。日志中的实际 URL 仍是 `resource://rawfile/probe.html`，因此不能简单归因于 URL scheme 不匹配，具体匹配实现尚未查明。最终脚本在入口再次校验该本地 URL。此代理只包含测试方法，正式应用仍需按页面来源限制代理访问。

当前带签名的工作工程仍在 `/data/storage/el2/base/cache/deveco-cli-view/shell/ArkShell`；该目录可能被系统清理。这里的持久源码副本不含签名配置、证书、密钥和构建缓存；重新部署时需自行配置签名。

`deviceTypes` 包含 `phone` 和 `2in1`。工作工程在 EL2 cache 下时，模板的 `caseSensitiveCheck: true` 会尝试列出不可读的 `/data/storage/el2`；工作工程已将该项关闭。`devecocli` 的华为服务请求在本机会话中已通过去掉代理环境变量恢复，国内请求直连。

构建与部署：在工程目录执行 `devecocli build`、`devecocli run --device <实际设备标识>`。当前 CLI 是隔离安装，未添加全局命令；入口为 `/data/storage/el2/base/cache/deveco-cli-view/inst/node_modules/@deveco/deveco-cli-openharmony-arm64/dist/cli.js`，可用 `node <入口> ...` 调用。

## 后续路线判断

用户指出已有鸿蒙版 Electron，经网络资料核实属实（第三方文档，尚未真机运行）：

- 仓库：`openharmony-sig/electron`（移植指南镜像见 gitcode `imansmallapple/electron` 的 `README_en.md`），基于 OpenHarmony Chromium `pc_chromium_132`；预编译包默认 Electron 34，而 Multica 使用 Electron ^44，版本差距需评估。
- 形态：HAP 壳 + `libelectron.so` 等产物放入 `libs`/`resfile`，应用代码放 `resources/app`，需 DevEco Studio 打包签名；`process.platform === "openharmony"`。
- 限制：原生 `.node` 需适配；带二进制的 npm 包（如 esbuild）不可用；窗口显隐依赖托盘；`child_process` 未见文档说明，尚待 `electron-probe/` 真机验证。
- 预编译包需华为账号在浏览器登录 CodeHub 下载，已获取并真机运行，结果见下节。

## Electron 34 真机探针结果

预编译包 `v34.9.0-20261030.1-release.zip` 在本机 HarmonyOS PC 上构建、签名、安装并运行（Electron v34.9.0、Chromium 132、Node 20.18.1，`process.platform === "openharmony"`），探针结果见 `logs/electron-ohos-probe.log`（原始 `ELECTRON_OHOS_PROBE` 行）：

- 通过：文件写入与读取；`child_process.execFileSync('/system/bin/sh', ...)` 返回 `electron-child-ok`；`contextIsolation + sandbox` 下 preload 先于页面首脚本生效；`ipcRenderer.sendSync` 同步取值；`ipcRenderer.invoke` 异步往返；渲染进程无 `require`。
- 无 `ELECTRON_OHOS_PRELOAD_ERROR` / `ELECTRON_OHOS_RENDER_EXIT`，崩溃日志查询为空（`logs/electron-crash.log`）。
- 安装踩坑：原工程声明的受限权限（首个报错为 `READ_PASTEBOARD`，安装码 9568289）在本机自动签名下无法授予，探针中把 `web_engine/src/main/module.json5` 的 `requestPermissions` 精简为 `INTERNET` 和 `GET_NETWORK_INFO`；剪贴板、定位、相机等权限能力因此在本次验证中不可用。首次 `run` 安装还曾卡住十多分钟无输出，原因未查明。
- 设备日志有 `PermissionManagerAdapter ... function undefined` 的重复错误，推测与精简权限后的适配层有关，未验证。
- 本次探针只验证了窗口、IPC、文件、子进程。未验证：Electron ^44 代码兼容 34、托盘依赖、长期运行的 Go daemon、`electron-updater`、`multica://` 深链、原生 `.node`。
- 工作工程在 `/data/storage/el2/base/cache/electron-ohos/libelectron/ohos_hap`（含签名，可能被清理），未复制到这里。

## Go daemon 在 Electron HAP 内的拉起验证（失败）

目标：把 `CGO_ENABLED=0` 构建的 `multica`（Go 链接器已带 `.codesign`，`selfsign --check` 通过）放进 HAP，用 `child_process.spawn` 长期拉起 `daemon start --foreground`。

- 本机对照（非 HAP）：daemon 配假服务和假令牌可常驻，见 `logs/daemon-local-control.log`。
- HAP 内：**没有任何一条路径能执行该二进制**，日志 `logs/electron-daemon-probe.log`：
  - `resfile/resources/bin/multica`（模式 755）：`EPERM`
  - `libs/arm64/libmultica_daemon.so`（打包后模式 644，大小从 18474224 变为 18287936，说明被构建流程重写）：`EACCES`
  - 复制到 `userData/bin`、`temp`、`cache` 并 `chmod 755`：均 `EPERM`
  - 同一进程里 `/system/bin/sh` 可正常执行（见 `logs/electron-ohos-probe.log`）。
- 因此“能运行、能退出、不被杀掉”三项**都没有机会验证**：进程根本没有启动。无崩溃日志。
- 线索（未验证）：Electron 自身的 `execPath` 是 `/data/app/electron.org/electron_1.0/bin/electron/electron`，像是 HNP 原生包安装目录；官方文档也把带二进制的包指向 HNP。下一步应验证把 daemon 以 HNP 包随 HAP 分发。
- 说明：`electron-probe/main.cjs` 的 daemon 探针默认运行 300 秒，`fake-server.cjs` 为假服务。

## 让系统执行 daemon：executableBinaryPaths / HNP 尝试（失败，卡在代码签名校验）

官方文档《应用程序包集成bin文件（PC/2in1）》（API 24+，`devecocli docs read` 可读）给出的路径：把 ELF 放进 `libs/arm64-v8a/`，在 `module.json5` 配 `executableBinaryPaths` 与 `extractNativeLibs: true`，安装后解压到 `/data/app/el1/bundle/public/<bundleName>`。HNP 需要 `hnpcli`，本机 CLI 工具链里没有（`hnpcli` 只出现在 SDK 的 NOTICE 清单），因此未走 HNP。

结果：只要 `executableBinaryPaths` 里声明了任何二进制，`hdc install` 3 秒内报 `code:9568393 verify code signature failed`；去掉声明、保留 `extractNativeLibs` 则安装成功（对照组）。已试的 ELF：

| 二进制 | 结果 |
|---|---|
| Go 链接器自带 `.codesign` 的 multica | 失败 |
| `selfsign`（brew ohos-selfsign）`--strip` 后再签 | 失败 |
| `binary-sign-tool -selfSign 1` | 失败 |
| 无 `.codesign`，交给 hvigor 打包签名 | 失败 |
| brew 已签名的动态 ELF（`jq`，`selfsign --check` 通过） | 失败 |

所以不是 Go 静态二进制特有的问题，也不是某个签名器的问题；推测需要用 HAP 同一证书给 bin 签名。本机 `binary-sign-tool` 只开放 `-selfSign`（`-mode localSign` 被判为不在 trust list），无法验证这一点。因此 child_process 拉起 daemon 的三项目标（运行/退出/不被杀）仍未验证。（后续：9568393 根因、「.bin 扩展名」解法与 HAP 沙箱隔离终验，见文末「HAP 内执行二进制路线一」节。）

补充：`devecocli run` 遇到该安装错误时不退出、不报错，一直停在 “Installing artifacts”，直接用 `hdc install -r <hap>` 才能看到真实错误码。
日志：`logs/hnp-*.log`。工作工程中的 `module.json5` 仍带 `executableBinaryPaths`（备份 `electron-ohos/module.exec.json5`），要恢复可安装状态需删掉该字段并移走 `libs/arm64-v8a/multica`。

## daemon 独立运行 + Electron 通过 HTTP 连接（通过）

做法：不在 HAP 里拉起 daemon，由 HAP 之外的 shell 用 `setsid nohup` 单独运行 `multica daemon start --foreground --no-auto-update`（假服务 `electron-probe/fake-server.cjs` 加假令牌，不含真实账户），Electron 主进程每 5 秒用 `http.get` 访问 `127.0.0.1:19514/health`（`electron-probe/main.cjs` 的 `runHealthProbe`）。

- 能连上：第一轮 18/18 次成功，延迟首次约 380ms、之后 2~7ms，pid 始终为 14480；应用沙箱（只有 INTERNET 权限）可以访问本机回环端口。
- 不被系统杀掉：该 daemon 累计运行约 24 分钟，期间 Electron 应用启动、退出多次，应用退出后 daemon 仍存活；日志里没有该 daemon 被杀的记录。注意这里的 daemon 不属于 HAP 进程树，所以这只证明“外部独立进程不受应用生命周期影响”，不证明 HAP 内拉起的子进程不会被杀。
- 能断开与恢复：第二轮在探针运行中途杀掉 daemon，连续 6 次 `ECONNREFUSED`，重启 daemon（新 pid 41589）后下一次采样即恢复，12 成功 / 6 失败，两个 pid 都被记录。
- 日志：`logs/health-run1-probe.log`、`health-run2-probe.log`、`health-run2-actions.log`、`external-daemon*.log`。
- 局限：假服务下 daemon 的 `workspaces` 为空，没有执行任何 agent 任务，也没有连真实 Multica 服务；还没有验证用户如何在鸿蒙上安装并保活这个外部 daemon（本机用 brew 装的 multica 能跑，但需要自己编译或发布 openharmony 版 CLI）。

## 大 HAP 部署踩坑

本机经 hdc（127.0.0.1:34561）传输 ≥约 30MB 的文件会卡住，与已有记忆“本机回环大请求体卡死”一致（12MB 瞬间完成、30MB 40 秒无进展）。`devecocli run` 因此停在 “Installing artifacts” 且没有错误。绕法：把 HAP 用 `split -b 10000000` 切块，逐块 `hdc file send`，在设备上 `cat` 拼回，再 `hdc shell bm install -p`、`aa start -a EntryAbility -b com.huawei.ohos_electron -m electron`。上一节里“卡住”的几次安装，有一部分其实是这个问题，不能全部归因于签名。

## Multica desktop 构建产物在 Electron 34 上的运行（有不兼容）

做法：`electron-vite build` 产物（main/preload/renderer，Electron ^44 目标）放进 HAP 的 `resfile/resources/app`，分块传输、`bm install`、`aa start` 运行；外部 daemon（pid 39999）与假服务同时在线，`/health` 正常。日志：`logs/multica-run2-esm-crash.log`、`multica-run3-app.log`、`multica-run3-device-all.log`、`multica-hap-build2.log`。

| # | 现象 | 原因 | 影响 |
|---|---|---|---|
| 1 | 主进程启动即崩：`ERR_REQUIRE_ESM`，`require("fix-path")` | `fix-path@5` 纯 ESM；Electron 44（Node 24）能 `require(esm)`，Electron 34（Node 20.18）不能 | 应用完全起不来。临时垫片：把该包换成 CJS 空实现后重打 HAP（`index.cjs`），不是正式方案 |
| 2 | `ReferenceError: WebAssembly is not defined`（`node:internal/deps/undici`，`lazyllhttp`） | Node 内置 undici 加载 llhttp wasm，该移植的主进程 Node 上下文没有 `WebAssembly` | 主进程**全局 `fetch` 不可用**（报 `TypeError: fetch failed`），已有日志证实 CLI 自动安装 `fetchChecksums` 因此失败 |
| 3 | 日志无 `[daemon]` 健康检查结果 | `daemon-manager` 的 `/health` 探测用同一个全局 `fetch`（`out/main/index.js:991`，见 `logs/multica-daemon-manager-health-fetch.txt`） | 按同一原因应失败，但本次**没有直接看到该调用的日志**，属推断；探针里的 `http.get` 能连 19514（见上节），所以改用 `http`/`electron.net` 是可行的修法，尚未改代码验证 |
| 4 | `APPIMAGE env is not defined`（electron-updater） | 非 AppImage | 自动更新在此平台不可用，预期行为 |

未覆盖：`setAsDefaultProtocolClient`、`requestSingleInstanceLock`、`setBadgeCount`、`Notification`、`screen`、渲染层是否出界面（没有截图/窗口树检查）。HAP 内 CLI 拉起仍是 `EPERM`（见前文）。

## 用 node:http 替换 daemon-manager 的 fetch 后，主进程连上健康端口（通过）

改动都打在已构建的 `out/main/index.js`（补丁后全文：`logs/multica-main-index.patched.js`，未回写 multica 源码）：
1. `fetchHealthAtPort` 的全局 `fetch` → `node:http`（`agent:false`，3s 超时），并打 `[ohos-health]` 日志。
2. 测试绕过：`bootstrapCli` 在 `cli_not_found`（HAP 里执行不了 CLI，`probeCliBinary` 必然失败）时仍 `startPolling()`，并把状态置为 `stopped`；否则 `fetchHealth` 直接返回、永远不探测。
3. `process.platform === "openharmony"` 时把 `HOME` 设为 `/data/storage/el2/base/files`。

结果（`logs/multica-run8-app.log`、`multica-run8-device-all.log`）：应用连续约 30 秒、9 次采样 `port=19544 OK pid=65089 state=running`，延迟首次 18ms、之后 2~4ms。

新发现的不兼容/事实：
- **`os.homedir()` 返回 `/storage/Users/currentUser`**，应用沙箱不可写，`resolveActiveProfile` 的 `mkdir ~/.multica` 抛 `EPERM`，整轮健康探测被吞掉（`logs/multica-run7-app.log`）。需要把 HOME 指到应用可写目录。
- **端口不是 19514**：桌面版为 profile `desktop-localhost-8080` 算出 `19514+1+sum(bytes)%1000 = 19544`，只有默认 profile 才用 19514。所以测试要用 `multica --profile desktop-localhost-8080 daemon start` 的外部 daemon（配置放 `profiles/desktop-localhost-8080/config.json`，假服务 8080）；此前的 19514 daemon 不会被桌面版识别（profile 为空，且应用也不会去探它）。
- 轮询门：CLI 找不到时桌面版不会轮询，所以“外部 daemon 方案”还需要让桌面版在无 CLI 时也探测（上面的绕过只是测试补丁）。
- 仍未覆盖：断开/恢复、渲染层界面、其他 Electron API；`fix-path` 垫片仍在。

## 断开与恢复（通过）

在 Electron 34 HAP（含上节补丁）里：外部 daemon（profile `desktop-localhost-8080`，端口 19544）运行中途被杀，再重启。日志：`logs/multica-recover-actions.log`（动作时间线）、`multica-recover-app.log`（应用 `[ohos-health]` 输出）、`multica-recover-device-all.log`。

| 时间 | 动作 | 桌面版 |
|---|---|---|
| 07:56:28 | 启动 daemon（pid 26803）、启动应用 | 07:56:44 起 `state=running` |
| 07:57:08 | `kill` daemon | 07:57:09 探测 `ECONNREFUSED`，下一轮（07:57:14）`state=stopped` |
| 07:57:51 | 持续无 daemon | 连续 `ECONNREFUSED`、`stopped` |
| 07:57:57 | 重启 daemon（新 pid 28115） | 07:58:00 `state=running`，之后稳定 |

说明：状态从探测失败到变 `stopped` 约 5 秒内（一个轮询周期）；重启后 3 秒内恢复。注意本测试里桌面版没有 CLI，其“自动恢复拉起 daemon”的逻辑（`attemptDaemonRecovery`）依赖 CLI，不可用，恢复是靠外部重启 daemon 完成的。

## 补丁源码版复测：连 19544 与断开/恢复（通过）

流程：`patches/0001-desktop-ohos-health-probe.patch` 应用到 `multica-build`（`git apply`）→ `electron-vite build`（`logs/multica-electron-vite-build2.log`，exit=0，产物含 `http.get` 与 openharmony 分支）→ 覆盖 HAP `resources/app/out`（保留此前的 `node_modules`，其中 `fix-path` 仍是 CJS 垫片）→ HAP（`multica-hap-build9.log`）→ 分块部署。

干净源码构建本身不打印状态，所以**只在 HAP 内产物上**加了一行 `[obs-status]` 日志（`sendStatus` 里，不在补丁里，也不在 multica-build）。日志：`logs/multica-src-actions.log`、`multica-src-app.log`、`multica-src-device-all.log`。

| 时间 | 动作 | 桌面版（`[obs-status]`） |
|---|---|---|
| 08:08:34 | 启动 profile `desktop-localhost-8080` 的 daemon（pid 41633）和应用 | 08:08:46 `stopped` → 随即 `running pid=41633`，每 5s 一次 |
| 08:09:14 | `kill` daemon | 08:09:16 起 `state=stopped`，持续到 08:09:56 |
| 08:10:05 | 重启 daemon（pid 43073） | 08:10:01~06 起 `running pid=43073`，稳定到测试结束 |

结论与此前用产物补丁的结果一致。注意：`CLI auto-install failed ... WebAssembly is not defined`（其他 `fetch` 用处）仍在，不影响健康探测；自动恢复拉起仍不可用。

## 渲染层界面与 Electron API 逐项实测

方式：在 HAP 内 `out/main/index.js` 末尾追加探针（`logs/multica-api-probe.snippet.js`，不属于 multica 源码/补丁），真机运行。日志：`logs/multica-api-probe-result.log`、`multica-ui-device-all.log`、`multica-api-second-instance.log`；截图 `multica-ui-screenshot.jpeg`（整屏，含当时的终端内容）；布局树 `multica-ui-layout.json`。

**界面：已出。** 截图里 Multica 窗口（900×600）显示登录页（“继续”、“使用 Google 登录”）；渲染进程 DOM 读回：标题 `Multica`，文本“登录 Multica / 输入邮箱以获取登录验证码 / 邮箱 / 继续 / 使用 Google 登录”，`window.desktopAPI` 存在（preload 生效）。窗口加载自 `file:///…/app/out/renderer`。

| API | 结果 |
|---|---|
| `setAsDefaultProtocolClient("multica")` | 不抛错，返回 `true`；但 `isDefaultProtocolClient` **注册前就是 `true`**，无法证明系统真的登记了 scheme（疑似桩实现） |
| `getApplicationNameForProtocol` | `"Multica Canary"` |
| `requestSingleInstanceLock` | 返回 `true`；`hasSingleInstanceLock` 为 `true` |
| 二次 `aa start`（单实例） | 触发 `second-instance` 事件（`argv: ["electron"]`），不开第二个窗口进程 |
| `setBadgeCount(3)` / `getBadgeCount` / `setBadgeCount(0)` | 均成功，读回 3；桌面角标是否显示未检查 |
| `Notification.isSupported` / `show()` | `true`，触发 `show` 事件；同时系统弹出“允许‘Electron’向你发送通知？”授权框（布局树 `com.ohos.notificationdialog`），弹窗文案显示的是 **Electron** 而非 Multica；未点允许，横幅是否出现未验证 |
| 深链 `aa start -U multica://…` | 报 `10108101`；该命令形式可能不对，`open-url` 事件**未验证** |

**关于 `http://localhost:3000/login?platform=desktop` 打不开：** 这是预期现象，不是渲染故障。应用在 HAP 里 `app.isPackaged` 为假，Multica 把它当作开发模式（`utils.is.dev`），使用 `LOCAL_DEV_RUNTIME_CONFIG`：`apiUrl=http://localhost:8080`、`appUrl=http://localhost:3000`（同时应用名为 “Multica Canary”）。桌面版的网页登录要去 `appUrl`，本机 3000 端口无服务，所以打不开。解决方向：给 HAP 提供生产运行时配置（`https://multica.ai` / `https://api.multica.ai`），或在本机起 Multica web 前端与后端；尚未改动验证。

## 运行时配置指向生产地址，网页登录可打开（通过）

做法：不改源码，构建时设环境变量 `VITE_API_URL=https://api.multica.ai VITE_WS_URL=wss://api.multica.ai/ws VITE_APP_URL=https://multica.ai`（开发模式即读这几个变量；产物里 `__vite_import_meta_env__` 已含它们）→ `electron-vite build`（`logs/multica-prod-vite-build.log`，exit=0，1m11s；第一次因被转入后台而中途被杀，用 `setsid nohup` 重跑）→ HAP（`multica-prod-hap-build.log`）→ 分块部署。

结果（`logs/multica-prod-app.log`、`multica-prod-device-all.log`）：
- `[daemon] target API URL set to https://api.multica.ai`，profile 变为 `desktop-api.multica.ai`（端口随之不再是 19544）。
- 登录窗口渲染正常（`multica-prod-screenshot-1.jpeg`）。
- 点击“使用 Google 登录”：主进程 `shell.openExternal("https://multica.ai/login?platform=desktop")` → `FileManagerAdapter#openUrlInDefaultBrowser` → 系统浏览器打开。浏览器里该次登录已被本机已有的 Google 会话自动走完，停在 `multica.ai/auth/callback?state=platform:desktop…`，页面“正在打开 Multica / 打开 Multica 桌面应用”。
- 未验证：点“打开 Multica 桌面应用”后 `multica://` 深链能否回到 HAP 应用（`open-url` / `second-instance` 带 URL）。这是登录闭环的最后一步，此前深链 `aa start -U` 还报过 10108101。
- 注意：回调页地址栏含一次性 OAuth `code`，所以第二张截图已从 logs 删除，未保留。
- 本版 HAP 里仍有 `[obs-*]` 观测日志（只在产物里，不在源码/补丁里）。

## 深链 `multica://` 回调测试（未收到，原因已定位）

做法：HAP 内产物追加监听（只记 scheme+路径，查询参数脱敏）：`app.on("open-url")`、`app.on("second-instance")`、启动 `process.argv`；应用运行时在系统浏览器回调页（`multica.ai/auth/callback?state=platform:desktop…`）点“打开 Multica 桌面应用”。日志：`logs/multica-deeplink-result.log`、`multica-deeplink-device-all.log`（已脱敏）、`multica-deeplink-actions.log`。

结果：**应用没有收到任何 `open-url` / `second-instance` / `onNewWant`**。唯一的 `[obs-deeplink]` 是启动 argv（无 `multica://`）。
- 第一次点击时 Multica 窗口刚好盖到了浏览器上面，点击落空（无效，不算结果）。第二次先把浏览器置前再点；点后浏览器失焦（`DSched UNFOCUSED, missionId 72`），但电子侧日志无任何唤起。
- 局限：我无法从日志确认点击确实落在按钮上，也没有看到浏览器对 `multica://` 的处理结果；所以严格说是“未观察到唤起”，不是“已证明点击触发了但被拒绝”。
- 根因（来自 `module.json5`，未修改验证）：EntryAbility 的 `skills.uris` 为空（另一条只有 `scheme: "link"`），**没有声明 `multica` scheme**，系统无从把 `multica://` 路由到本应用。此前 `aa start -U multica://…` 报 `10108101` 与此一致。
- Electron 的 `setAsDefaultProtocolClient("multica")` 返回 `true` 只是桩，不会改动系统注册（见上节）。
- 下一步：在 `electron/src/main/module.json5` 给 EntryAbility 增加 `{ "scheme": "multica" }`（`actions: ["ohos.want.action.viewData"]`，`entities` 含 `entity.system.browsable`），重打 HAP，再测 `aa start -U multica://…` 与浏览器点击，并确认 `open-url` 是否由 `onNewWant` 的 uri 转发（Electron OHOS 适配是否实现该转发尚未知）。

## 声明 `multica` scheme 后复测深链（`aa start -U` 通过；浏览器点击未触发）

改动：`electron/src/main/module.json5` 的 EntryAbility 新增一条 `skills`（`entities: [entity.system.browsable]`，`actions: [ohos.want.action.viewData]`，`uris: [{scheme: "multica"}]`），原有桌面入口那条保持不动；备份 `electron-ohos/module.before-scheme.json5`。重打 HAP（`multica-scheme-hap-build.log`）、分块部署；`bm dump -n com.huawei.ohos_electron` 已能看到 `"scheme": "multica"`（`multica-scheme-install.log`）。

日志：`logs/multica-scheme-actions.log`（时间线）、`multica-scheme-result.log`、`multica-scheme-device-all.log`（查询参数已脱敏；测试用的是假 token）。

| 测试 | 结果 |
|---|---|
| T1 `aa start -U multica://… -A ohos.want.action.viewData -b com.huawei.ohos_electron` | `10108101`，失败（带 `-A`/`-b` 的写法不行，原因未查） |
| T2 `aa start -U multica://auth/callback?token=…`（不带 `-b`/`-A`，应用已在运行） | 成功。`onNewWant` 的 want 里 `uri` 即该地址；Electron 随后收到 **`second-instance`（argv 含 multica:// 地址）和 `open-url`（同一地址）** 两个事件 |
| T3 浏览器回调页点“打开 Multica 桌面应用”（点击落在按钮上，按钮出现悬停态） | **应用侧没有任何新事件**，浏览器侧日志也没有 scheme/外部协议跳转的痕迹；原因未确定（可能浏览器不放行未知 scheme、或合成点击不算用户手势、或页面脚本没触发；均未验证） |

结论：系统路由与 Electron 侧转发已通（T2）；登录闭环的最后一环（浏览器 → 应用）在本机仍未走通，需要查浏览器对自定义 scheme 的处理，或让用户手动在浏览器里点一次（人工点击而非 uitest 合成点击）对照。

## 接手续测：应用标识与真实 daemon

- HAP 应用名及 base/en_US/zh_CN 的 EntryAbility 名称改为 `multica`；应用与启动图标使用官方源码 `multica-ai/multica` 提交 `e437b11a718d6afce9cd800ba5b8554f3691a133` 的 `apps/desktop/build/icon.png`，未重新绘制。保留包名 `com.huawei.ohos_electron`，避免丢失现有网页登录状态。
- 可复用资源保存在 `hap-branding/`，应用脚本与校验脚本在 `scripts/apply-branding.py`、`scripts/check-branding.py`，两者参数均为 `<HAP 工程目录> <Multica 源码目录>`。校验先在旧资源上失败，再在修改后通过。`logs/multica-branding-check.log` 为结果。
- HAP 已构建、分块部署成功并启动；日志 `logs/multica-branding-hap-build.log`、`logs/multica-branding-install.log`。尚未肉眼检查桌面图标：设备当时处于锁屏，未尝试解锁。
- CLI 实际登录在默认 profile，daemon 在 19514；桌面版只认独立 profile `desktop-api.multica.ai` 的 19681。未停止或修改默认 daemon；在本机内部复用同服务的已保存凭据，为桌面 profile 单独启动外部 daemon（不输出 token）。
- 19681 `/health` 返回该 profile，agents 含 claude/codex/opencode 等；`logs/multica-handoff-health-summary.json` 只保存 pid/profile/agent 名称。Electron 日志连续报告 `state=running pid=37079`，见 `logs/multica-handoff-desktop-status.log`。
- 外部 daemon 用 `setsid nohup ~/.local/bin/multica --profile desktop-api.multica.ai daemon start --foreground --no-auto-update` 启动；运行日志在 `~/.multica/logs/desktop-external-daemon.log`（真实账户运行日志，不复制进项目）。未设置开机自启。默认与 desktop 为两个独立 runtime。
- 待用户解锁后检查：设置 → 本设备 → 守护进程中 agent 列表，以及桌面图标/名称实际显示。健康接口返回 agents 不等于设置页已经验证。

## 本机 agent 接入验收

用户要求接入本机已安装的全部 agent。已在当前工作区创建 8 个私有 agent，每个并发数为 1，不覆盖 CLI 原有登录、默认模型、思考级别及速度配置：Claude Code、Codex、OpenCode、Kimi Code、Hermes、Reasonix、ZCode、DeepSeek Harness。接口复核无重复、8 个 runtime 均 online、健康接口无 skipped_agents，精简配置清单见 `logs/agents-configured.json`。桌面端“团队 → 我的智能体”已肉眼确认八行均显示“在线”；截图留在 EL2 cache，未将整屏私人终端内容归档。

DSH 原先因缺少 Multica profile 被跳过；从官方 `https://github.com/multica-ai/dsh-multica-runtime` 克隆至 `dsh-runtime/`，安装依赖、typecheck、22 项测试及 build 已通过（`logs/dsh-runtime-check.log`）。rolldown 的官方 openharmony binding 已存在，但未签名；本地工程加 `ohos-signpost` devDependency 和 postinstall，签名后测试通过，未引入社区替代包。以 `dsh plugin --profile multica add <本项目绝对路径>/dsh-runtime` 安装，`dsh --profile multica --probe` 返回 protocol_version=1，`--list-models` 发现本机模型。日志见 `logs/dsh-multica-{plugin-install,probe,models}.log`。daemon 自动重新发现后注册 DSH runtime，无须停止现有任务。

`dsh-runtime/` 是独立上游克隆，安装后的 multica profile 链接到该目录，不可当临时文件删除；不要移动目录，除非重新安装 plugin。仅新建独立 multica profile，没有重置用户的 tui/web profile。此次完成的是配置、协议探针及在线状态验证，未发起付费模型推理；CLI 额度/认证过期仍由对应账号管理。

## Codex 实际派单验证

用户要求实际调用 Codex，创建任务 `POLA-2`（Codex 接入测试）并指派给 Codex。首轮在启动模型前失败：`lock task temp dir /tmp/multica-task-…: permission denied`。源码的 `socketSafeTempBaseDir()` 优先 `/tmp`，仅设置 TMPDIR 不足；通过官方配置项 `MULTICA_AGENT_TEMP_BASE=/data/storage/el2/base/cache` 修复，不改源码。确认两个 daemon 活跃任务数均为 0 后分别停止、用新环境恢复，未删已有运行记录。

新增 `scripts/start-daemon-ohos.sh [profile]`，显式设置 TMPDIR 和 MULTICA_AGENT_TEMP_BASE，再启动 foreground daemon；`bash -n` 通过。以后本机启动 daemon 应走该脚本（如用 setsid/nohup 在外部运行），否则重启后可能再次踩到 `/tmp`。没有增加开机自启。

对原失败 run 执行 `issue rerun-task --fresh`。新 run `01a1b8f5-653a-7cf6-a799-ad39268f7ebd` 实际调用 Codex 完成，result.output 为“Codex 已通过 Multica 成功调用。”，任务状态 `done`，评论已写回。没有改工程源码；Codex 为 CLI 评论短暂生成了任务工作目录内的 reply.md 并删除。验证的是派单、启动、模型响应、回写及完成状态全链路，而非仅 online。

## HAP 内执行二进制路线一：门禁探针终验（技术可行、功能不可行，路线关闭）

背景：上文「让系统执行 daemon」卡 `9568393`，当时推测需用 HAP 同一证书签 bin。路线一（`route1/`）用最小 C 探针做门禁，不修改 Multica 业务代码、不停止宿主 daemon。探针只 `access()` 不读凭据。

做法：

- 探针 `route1/probe.c` 打印 `ROUTE1_PROBE_V1`、UID、对宿主三个路径（`~/.harmonybrew/bin/codex`、`~/.codex/config.toml`、`~/.multica/config.json`）的 `access()`；宿主基线 `logs/route1/06-host-probe-baseline.log`（三项全 1，shell uid 20020101）。
- 签名：`route1/sign-with-app.cjs` 复用已装 DevEco CLI 的签名材料解码器（口令只存内存、不落日志），用**应用证书**给 ELF 加 `.codesign`（`logs/route1/04-app-cert-sign-with-sdk.log`）。
- 声明对比：同一 ELF，声明为无扩展名 `route1-probe` → 安装 `9568393`（`05`、`09`）；改为 `libs/arm64-v8a/route1-probe.bin` → hvigor 正常 `SignHap` 后**安装成功**（`11`、`12`）。根因：hvigor 对 `libs/` 下无扩展名/`.so` 文件走原生库流水线（strip/对齐），破坏预签 `.codesign`；`.bin` 扩展名使其原样透传。
- 运行：解锁后 `aa start`，应用主进程内的探针依次尝试三个候选路径，前两个 ENOENT，第三个执行成功。

结果（`logs/route1/14-inhap-probe-result.log`，12:33:37）：

- 解压实际路径 `/data/storage/el1/bundle/libs/arm64/route1-probe.bin`（与官方文档「`/data/app/el1/bundle/public`」表述不一致）。
- `UID=20020251` = 应用 uid（≠ shell 20020101）→ HAP 沙箱内执行确证。
- 三项宿主 access 全 **0**。

结论：

- 技术门槛（9568393）已解：`.bin` 扩展名 + 应用证书签 ELF + hvigor 构建。
- 功能门槛不可解：HAP 沙箱读不到宿主家目录，daemon 需要 spawn 的 agent CLI、读写的配置与仓库全在宿主侧。
- **路线一关闭**；「外部 daemon + HAP 前端」为终态架构（GUI HAP 走 cask、daemon/CLI 走 formula 的划分由此获得平台级依据）。
- 当前设备上安装并运行的即 .bin 门禁版 HAP（`module.json5` 仍声明 probe 路径）；重建无 probe 版本时删除 `executableBinaryPaths` 字段即可。

另：daemon/CLI 侧构建链已摸底——官方 core 的 `go`（1.27.3，自带 OHOS 补丁）直接 `CGO_ENABLED=0 go build` 产出的纯静态 ELF 即带 `.codesign`（`selfsign --check` 通过，chmod +x 即可执行，已用 hello-world 实测），daemon formula 化无需额外签名步骤。

## 外部 daemon supervisor：应用活着就保 daemon 活着（自动拉起，验收通过）

背景：route1 关闭后 daemon 只能活在宿主（`scripts/start-daemon-ohos.sh`，正确设置 `TMPDIR`/`MULTICA_AGENT_TEMP_BASE`）。手动启动的缺口是「daemon 被杀/没起时，桌面只能显示未运行」。`scripts/multica-supervise.sh` 补上自愈层：HAP 活着而 daemon 健康端口不通时自动拉起。

用法：

- `bash scripts/multica-supervise.sh`：单周期判定（打印 `app-not-running` / `daemon-ok` / `daemon-started` 等）
- `bash scripts/multica-supervise.sh --daemon`：幂等自驻留（pidfile 防重入），`~/.shellrc` 已接入，开终端即确保运行
- `bash scripts/multica-supervise.sh stop`：停止驻留循环

机制要点：

- 应用探活：宿主 `ps -eo args` 精确匹配 `com.huawei.ohos_electron`（不依赖 hdc）
- 健康端口：读 `~/.multica/profiles/<profile>/daemon.port`（JSON，取 `port` 字段），缺省回退算法 `19515 + sum(utf8 字节) % 1000`（与 `apps/desktop/src/main/daemon-profile.ts` 的 `healthPortForProfile` 一致）
- 拉起动作：`setsid nohup bash start-daemon-ohos.sh <profile>`；30 秒启动速率限制防崩溃风暴；daemon stdout 落 `/data/storage/el2/base/files/multica-supervise/daemon.log`，supervisor 状态迁移落 `logs/supervise.log`
- 两个本机坑（已踩过）：`daemon.port` 是 JSON 不是纯数字；hmdfs 新建脚本拿不到 exec 位，自驻留必须显式 `bash` 起脚本

验收（2026-11-08 13:05，真实账户，`logs/supervise.log` + hilog 为证）：

1. 杀 daemon 前查 `active_task_count=0`（确认无在跑任务）后 kill 28681 端口的 desktop daemon（pid 28672）
2. supervisor 一个周期内（≤3s）判定「应用活着 + daemon 不通」，自动拉起新 daemon
3. 新 daemon 约 10 秒绑定健康端口，`daemon_id` 不变（会话连续），40 秒时 `status=running`
4. 桌面（HAP 内，pid 38397）自动重连：hilog 每 5 秒 `[obs-status] state=running pid=<新pid>`，全程无需人工干预

已知边界：开机后 supervisor 从未拉起过的窗口期内，首次点图标仍显示「未运行」（点击前宿主没有我们的任何进程，平台限制）；`~/.shellrc` 幂等拉起使该窗口在一开终端后即关闭。

## Phase 2：可复现构建流水线 + 干净 HAP 上设备（2026-11-08 验收通过）

产物与脚本：`scripts/build-desktop.sh`（幂等补丁 + electron-vite 生产构建 + 刷新 HAP 负载）、`scripts/build-hap.sh`（恢复干净 module 配置 + deveco-cli 签名构建）、`scripts/install-hap.sh`（分块传输安装）、`BUILD-PIPELINE.md`（日常三步 + 从零重建七步 + 债务清单）。增量备份在 `hap-work/`（干净 module.json5、签名配置参考），历史产物在 `/data/storage/el2/base/files/multica-hap/`。

本机依赖接线（教训实录）：原生 `.node` 必须 ohos-signpost 签名；pnpm 10.28.2 只认 package.json 的 `pnpm.overrides` 且 lockfile up-to-date 时跳过解析（改 overrides 必须删 lockfile 强重解析）；pnpm 12 原生在此平台不可用。完整命令见 BUILD-PIPELINE.md 债务节。

端到端证据（14:10–14:12）：干净 HAP（270MB，探针声明清空、无观测日志、candidate 补丁、fix-path 源码级打包）经 `install-hap.sh --start` 上设备；`bm dump` 确认 `executableBinaryPaths: []`；desktop daemon（supervisor 保活）持续 running；UI 布局树「在线」×8 = 八个 agent 全部在线，「登录」×0（非登录页卡死）。

## Phase 3：补丁最小化收尾（2026-11-08 验收通过）

正式补丁收敛为单份 `patches/0001-desktop-ohos.patch`（854 行，自基线 `e437b11a` `git apply --check` 通过）：

- `daemon-manager.ts`：健康探测、auth 探针、mintPat（登录铸 PAT，新用户登录关键路径）三处主进程 fetch 加 `process.platform === "openharmony"` 分支走 `electron.net`——OHOS Electron 34 主进程无 WebAssembly，全局 fetch 必挂（`WebAssembly is not defined` 报错已实证）；非 OHOS 保持上游 `fetch` 行为
- `index.ts`：HOME 重定向（OHOS 分支，指向应用可写目录）
- `electron.vite.config.ts`：fix-path 打包进主进程（源码级解决 Electron 34 不能 `require(esm)`，消除 node_modules 垫片债）
- 历史补丁归档：`patches/archived/`（早期 node:http 版）、`minimality/candidate.patch`（中期验证版，内容已并入）

验证：桌面全量单测 72 文件 / 839 用例通过（electron 包打桩后，见 BUILD-PIPELINE.md）；重建安装后布局树「在线」×8、「登录」×0，daemon 连接正常。cli-bootstrap 两处 fetch 未 guard（OHOS 上为死路径：CLI 无法随包执行）。

## Phase 5：daemon/CLI 入自有 tap（2026-11-08 验收通过）

- formula：`social4hyq/core` 的 `multica` 0.8.1（[PR #910](https://github.com/social4hyq/homebrew-core/pull/910)，CI 绿后自动合并 + 自动发 bottle）；`license :cannot_represent`（Multica License 非 OSI，落自有 tap）；Go 源码构建 + `-X main.version` 注入
- 本机验收：`brew install multica` 装瓶 → `brew test` 过 → supervisor 经 `start-daemon-ohos.sh`（优先 `~/.harmonybrew/bin/multica`）切到 brew 二进制 → health `cli_version=0.8.1`、8 agents → **真实负载闭环**：brew CLI 建单（POLA-16）→ brew daemon 派发 → 本机 Kimi Code 执行并回写（约 40s）——全链路跑在 bottle 产物上
- 副产品：daemon 不再报 `dev` 版本标识（"快速创建被挡"问题随版本注入消除）
- 遗留：cask-ohos（GUI HAP 分发通道）与第二台 PC 全新安装验收属分发阶段下一步（后者是"可分发"的唯一硬标准）

## Phase 6：桌面 bottle 本机交付验收

`multica-desktop 0.8.1_2` 已完成 CI 构建出瓶、本机装瓶（`poured_from_bottle=true`）、本机材料签名、`scripts/install-hap.sh --start` 设备安装与启动。用户完成正常登录后，“团队 → 我的智能体”的布局树确认 Codex、Kimi Code、Claude Code、DeepSeek Harness、Hermes、OpenCode、Reasonix、ZCode 八行均在线，登录控件为零；daemon 健康接口同时列出八个 agent。

本轮修正仅涉及生产依赖打包、壳的请求权限与安装脚本错误检测；HAP 不携带开发依赖、开发者签名材料或 daemon 可执行文件。证据在本机 `logs/runtime-packaging/`：`layout-r2-team.json`、`acceptance-r2.json`、`health-r2-final.json` 及构建、装瓶、签名、安装日志。完整流程与限制见 [DISTRIBUTION.md](DISTRIBUTION.md)。这不是第二台 PC 的全新安装验收，也不代表重新覆盖了所有业务功能。

## Phase 7：三 formula 整合为单包

`multica` 从同一上游源码构建 CLI/daemon 与桌面负载；OHOS 品牌与构建资产改为固定 commit/SHA256 的 resource，不再需要独立资产 formula。桌面包的构建和测试迁入 `multica`，原 `multica-desktop` 与 `multica-ohos` 下线。

统一包的 CLI/daemon、HAP、安装脚本已经本机装瓶验证，daemon 重启后八个 agent 正常；新 HAP 签名安装后的布局树再次验收在线×8、登录控件×0。签名仍使用本机材料，安装包不包含私钥。证据在本机 `logs/consolidation/`。纯 CLI 用户现在也会下载桌面 HAP；任一构建环节失败都会阻止统一包发版。
