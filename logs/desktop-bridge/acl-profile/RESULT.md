# `multica install-desktop --acl-profile` 真机验证（0.9.0_9，2026-11-15）

## 结论
**通过。** 带 `CUSTOM_SANDBOX` + `READ_WRITE_USER_FILE` ACL 的 AGC 调试 profile 下：HAP 能装上、4 项权限全部授予，
应用沙箱内的进程能读写宿主 `~/.multica` 并执行宿主 CLI；同一探针在默认签名下全部被拒，说明起作用的正是 ACL。测完已恢复默认 HAP。

## 使用的签名配置
`/data/storage/el2/base/cache/electron-ohos/libelectron/ohos_hap/build-profile.json5` → `~/.ohos/config/default_ohos_hap_…=.p7b`：
`type=debug`、`bundle-name=com.huawei.ohos_electron`、绑定 2 个设备 UDID、有效期至 2027 年、`acls.allowed-acls` 含上述两项（调试 profile，上架仍须 AGC 受限权限审核）。

## A. 真实命令：`multica install-desktop --acl-profile <上述配置>`
| 项 | 结果 | 证据 |
|---|---|---|
| 安装 | exit 0；`install bundle successfully`、`start ability successfully`，无 9568289 | `02-install-acl.log` |
| 装前权限 | `GET_NETWORK_INFO`、`INTERNET`（默认 2 项） | `01-before.log` |
| 装后权限 | `CUSTOM_SANDBOX`、`GET_NETWORK_INFO`、`INTERNET`、`READ_WRITE_USER_FILE`，`reqPermissionStates` 全 0（已授予），`appProvisionType=debug` | `03-bm-after.json` |
| 运行 | 应用以 uid 20020253 运行；桌面界面「查看日志/重启/停止」，daemon 64829 running 8 agents，bridge `cli_ok=true`——ACL 版仍可经 bridge 管理 daemon | `03-after.log` |

## B. 应用内读写验证（探针副本）
真实 app 不会直接读 `~/.multica`（它走 bridge），也没有 CDP 可进，所以用 **同一份 ACL 签名配置**签了一个探针副本：
内容 = 瓶内 HAP + `module-acl.json` + 仅替换主进程入口为探针（`probe-index.js`，不输出 token 内容）。探针在 Electron 主进程里直接做 fs/exec，
结果经回环 HTTP 回传（两种签名下 INTERNET 都有，读写被拒时也能拿到）。

| 检查（uid 20020253） | ACL 版 | 默认签名（对照） |
|---|---|---|
| readdir `~/.multica` | OK（17 项） | FAIL `EPERM` |
| 读 profile `config.json`（仅大小） | OK（196 B） | FAIL `EPERM` |
| 读 `daemon.log` 末尾 | OK | FAIL `EPERM` |
| stat `desktop-bridge.json` | OK（mode 660） | OK |
| 写入 → 读回 → 删除 `~/.multica/.acl-probe-write` | OK（roundtrip） | FAIL `EPERM` |
| 在 profile 目录写入并删除文件 | OK | FAIL `EPERM` |
| 执行宿主 `multica-cli version` | OK（0.9.0） | FAIL `EACCES` |
| 探针结果文件写入宿主 `~/.multica` | written | not written: EPERM |

证据：`04-probe-result.json`（ACL）、`05-control-result.json`（对照）、`04-probe-run-http.log`、`05-control-run.log`、`probe-index.js`。
（第一次 ACL 探针用文件回传，同样 7 项全 OK，见 `04-probe-run.log`；对照组第一次用文件回传没有结果，无法区分「被拒」与「没跑起来」，故改用 HTTP 回传重做。）

## 恢复
`multica install-desktop`（默认自动签名）：exit 0，`reqPermissions` 回到 `GET_NETWORK_INFO`、`INTERNET`（`06-bm-restored.json`）；
应用在运行，daemon 64829 running 8 agents，bridge `cli_ok=true`，supervisor 0，`~/.multica` 无残留探针文件 (`06-restore.log`)。
桌面界面：测完时屏幕已息屏，当时没法复核；屏幕唤醒后已补做，见下节「恢复后界面复核」。

## 补充说明
- 沙箱内启动的 daemon 随 app 退出被杀（上一轮 weak-sandbox 已验证），所以 ACL 路线只解决「读写/执行」，不替代 bridge；桌面仍应走 bridge。
- 本次没有验证：沙箱内直接启动 daemon 并跑 agent 任务、第二台设备（profile 绑定的是 2 个 UDID）。

## 恢复后界面复核（屏幕唤醒后，2026-11-15 07:48）
先 `aa start -a EntryAbility -b com.huawei.ohos_electron -m electron` 拉前台，再读无障碍树并截图（`07-ui-recheck.log`、`07-screen.jpeg`）：

| 项 | 结果 |
|---|---|
| 停在工作区而非登录页 | 是。无障碍树（281 节点）里没有「登录/Log in/Sign in/继续」，有左侧导航「收件箱/工作/团队/聊天/自动化」；截图为「团队」下的运行时页 |
| 运行时页 daemon | `localhost`（本机）「daemon 01a1b8da… · CLI 0.9.0 · 在线」，属性「状态：在线」、「负载：全部空闲」，侧栏「运行时 1 台在线」 |
| 守护进程按钮 | 「查看日志 / 重启 / 停止」（无「重试设置」、无「由应用外部管理」） |
| 运行时列表 | 8 个均「在线」：Claude、Codex、DeepSeek Harness、Hermes、Kimi、Opencode、Reasonix、ZCode；CLI 版本栏显示 CLI 0.9.0「最新」 |

至此默认 HAP 恢复完成并复核通过：权限 2 项（`GET_NETWORK_INFO`、`INTERNET`）、应用运行、daemon 与 bridge 正常、界面在工作区且 daemon 在线。
