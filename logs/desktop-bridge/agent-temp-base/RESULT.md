# MULTICA_AGENT_TEMP_BASE 修复真机验收（PR #1017，0.9.0_9，2026-11-15）

## 结论
**通过。** wrapper 带 `MULTICA_AGENT_TEMP_BASE` 后，经桌面拉起的 daemon 在生产账户上能完整跑完 agent 任务并回写：
POLA-18（Kimi Code）`running → completed`，agent 评论「临时目录验收通过。」，状态流转为 in_review；
任务运行期间 `ls` 看到临时目录建在 `/data/storage/el2/base/cache/multica-task-425349104`（Codex 任务在跑时），`/tmp` 下始终为 0 个；任务结束后目录已被 daemon 清理（现在两处都是 0）；日志里 0 次 `lock task temp dir` 报错。

## 过程
1. `gh pr view 1017`：MERGED（2026-11-14T22:56:46Z，merge 1bec0ba62f）(`01-merge-check.log`)。
2. `brew update` + `brew upgrade multica` → 0.9.0_9 (`02-upgrade.log`)。
3. wrapper 含 `MULTICA_AGENT_TEMP_BASE="${MULTICA_AGENT_TEMP_BASE:-/data/storage/el2/base/cache}"`；实跑：未设置时得到默认值，用户已设时用户值优先 (`03-wrapper.log`)。
4. 无在跑任务时停 daemon、按记录 pid 停 bridge，`multica desktop start --bridge-only`：22s 内桌面补启 daemon（pid 64829，桌面形态参数，8 agents）(`04-restart.log`)。
5. 派单并回写 (`05`–`09`)。

## 两次派单
| 任务 | agent | 结果 |
|---|---|---|
| POLA-17 | Codex（首次） | 任务启动、临时目录创建成功，但 Codex 一直 `Reconnecting... waiting for network`，4 分钟后手动取消（run=cancelled） |
| POLA-17 | Codex（联网修复后 `issue rerun-task`） | completed，约 16 秒，result 为「临时目录验收通过。」，评论回写（见下节） |
| POLA-18 | Kimi Code | completed，评论回写，约 2 分 15 秒 |

## Codex 联网问题（与本改动无关，已由用户修复）
- 不经 Multica、直接用 `~/.local/agent-bin/codex exec`（已加载 `agent-proxy.env`）同样 `Connection refused`，同样 `Reconnecting... waiting for network`；
- 同一 shell 里 curl 经代理访问 chatgpt.com / api.openai.com 为 200/401，说明代理本身可用，问题在 codex 自己的连接（可能是 WebSocket 通道或节点），需单独查；
- 这也说明「在线 ≠ 能跑任务」，之前的 A/B/重启验收没有覆盖派单。

## 现场
- 两个验收任务（POLA-17、POLA-18）已于 2026-11-15 08:06 按你的指示删除，见文末「验收任务清理」；
- bridge/daemon 为真实进程，supervisor 0 个。

## 补测：Codex 联网修复后重跑 POLA-17（2026-11-15 07:18）
联网修复后先不经 Multica 直接跑 `codex exec` 得到 `ok`，说明此前失败是网络问题。随后对 POLA-17 执行 `issue rerun-task`，仍用同一个桌面拉起的 daemon（pid 64829，未重启）：

- 新 run `01a1dc5a-b424-…`：`queued → dispatched → running → completed`，24 秒内完成（执行约 16 秒）；
- result.output「临时目录验收通过。」，agent 评论同样回写到 POLA-17；
- `/tmp` 下 `multica-task-*` 为 0 个。

**至此 Codex 与 Kimi Code 两条 agent 路径在桌面拉起的 daemon 上均已跑通回写。** 原始输出见 `10-codex-rerun.log`、`runs-codex-rerun.json`。

## 验收任务清理（2026-11-15 08:06）
删除前先给你看了预览（`11-delete-preview.log`）：两个 issue 的 ID、标题、状态、评论、运行记录，并确认工作区 18 个 issue 里标题含 `TMPBASE` 的只有这两个，且无子 issue；你确认后才执行。

`multica --profile desktop-api.multica.ai issue delete POLA-17 POLA-18 --yes`（删前 `active_task_count=0`）：
- 输出 `Deleted issue POLA-17`、`Deleted issue POLA-18`，退出码 0；
- `issue list` 复核：剩余 16 个（删前 18），`POLA-17`、`POLA-18` 均不在，标题含 `TMPBASE` 的为 0；
- `issue get POLA-17`、`issue get POLA-18` 均返回 `The requested resource was not found`。

删除是永久的（连带评论与运行记录）。上文「两次派单」表里的 run ID、评论内容现在只作为本文档里的记录保留，服务器上已不存在。原始输出见 `12-delete.log`。
