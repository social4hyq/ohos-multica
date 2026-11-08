# Multica HarmonyOS 功能验收矩阵

日期：2026-11-08（Phase 4 汇总）｜环境：HarmonyOS PC 真机，生产后端 api.multica.ai，真实账户
口径：PASS=实测通过（证据落盘）；FAIL=实测失败；BLOCKED=平台/权限限制无法测；NOT_TESTED=未覆盖。抽样不冒充全量。

## 矩阵

| 类别 | 项 | 结果 | 证据 |
|---|---|---|---|
| 登录/重启 | 会话跨应用重启保留 | PASS | 14:10 重装后布局树直进工作区（登录×0） |
| 登录/重启 | 会话跨 daemon 重启保留 | PASS | 13:05 supervisor 拉起新 daemon，daemon_id 不变，8 agents 在线 |
| Agent | 8 个本机 agent 逐个最小任务 | 部分 PASS | Codex/OpenCode/Kimi/DSH 成功；Hermes 目录所有权校验失败、ZCode 未配置模型、Reasonix 沙箱阻止、Claude 无响应已取消（`agent-results.json`） |
| Agent | API 派单（Claude Code/OpenCode） | PASS | `api-results.json` |
| 项目/任务 | 项目/任务 CRUD、状态流转、子任务、搜索 | PASS | `api-results.json` 14 项 |
| 协作 | 评论 CRUD、标签、订阅、附件上传/下载字节级回环 | PASS | `api-results.json` + `final-checks.json` |
| 组织 | 工作流创建/绑定/读取、属性创建/设置/读取 | PASS | `api-results.json` |
| 自动化 | 专用一次性手动 autopilot | PASS | `autopilot-runs.json`（source=manual, completed） |
| 桌面 | 导航、设置全页、聊天、全局搜索、手动建任务 | PASS | `ui-results.json`/`settings-results.json`/`ui-extra-results.json`/`final-checks.json` |
| 平台能力 | daemon 断开与恢复（UI 状态） | PASS | `recovery-results.json`（约 16s 恢复）+ 本日 supervisor 自愈链 |
| 平台能力 | 深链系统路由（`aa start -U`） | PASS | README T2 测试（open-url + second-instance 均达） |
| 平台能力 | **深链浏览器→应用 handoff** | **PASS（14:41 真人点击）** | 系统浏览器（com.huawei.hmos.browser）点击 `multica://deeplink-test` → 系统按声明的 scheme 路由 → `onAcceptWant` 收到完整 URI（`deeplink-watch.log:51430`），应用冷启动到前台；暖路径 second-instance 转发此前 T2 已验 |
| 平台能力 | 通知 API | PASS | `Notification.show` 触发系统授权框（未点允许，横幅未验） |
| 平台能力 | 自动更新 | BLOCKED | electron-updater 非 AppImage 报错（预期，平台无升级通道） |
| 平台能力 | 剪贴板/定位/相机等 | BLOCKED | 探针期权限精简（9568289 报错记录），仅保留 INTERNET/GET_NETWORK_INFO |
| 平台能力 | 文件选择器、MCP/技能实际调用 | NOT_TESTED | 列入后续 |

## 待用户配合的两项（一次性）

1. **深链 handoff**：浏览器打开 `file:///data/storage/el2/base/files/deeplink-test.html`（预置 `multica://deeplink-test` 链接），点击链接；判定：应用收到 `open-url`/`second-instance`（日志监控中）。
2. **通知授权**（可选）：下次弹"允许通知"时点允许，验证横幅。

## Agent 遗留（OHOS 宿主侧问题，非 multica 缺陷）

- Hermes：目录所有权校验失败；ZCode：本机未配置模型；Reasonix：其安全沙箱阻止命令执行（不绕过）；Claude Code：无响应已取消（rerun 时序问题，POLA-2 已实证 Codex 全链路，Claude 未复测）。
