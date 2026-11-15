# multica caveats 绝对路径写法验证（PR #1019，0.9.0_10，2026-11-15）

## 结论
**通过。** PR 1019 已合并，`brew upgrade multica` 到 0.9.0_10 后，`brew info multica` 的 caveats 里：
shell 启动文件那一行是绝对路径写法，并带 PATH 顺序说明；裸的 `multica desktop start --bridge-only` 已不再出现。

## 过程
1. `gh pr view 1019`：**MERGED**（2026-11-14T23:52:35Z，merge 5d0a79f442）(`01-merge-check.log`)。
2. `brew update` → tap 上 multica `revision 10`，`brew outdated` 列出 multica；`brew upgrade multica`：0.9.0_9 → **0.9.0_10**，升级过程输出的 caveats 即新文字 (`02-upgrade.log`)。
3. `brew info multica` 原文落盘 (`03-brew-info.txt`)，Caveats 相关段如下：

```
To start only the bridge from a shell startup file, add
`"$HOME/.harmonybrew/bin/multica" desktop start --bridge-only`. Use the
absolute path: a startup file can run before Homebrew's bin is on PATH,
where a bare `multica` is not found and the line fails silently.
`multica desktop stop` stops the bridge and leaves the daemon running.
```

## 断言 (`04-assertions.log`)
| 项 | 结果 |
|---|---|
| 版本行含 0.9.0_10 | 是 |
| 含 `"$HOME/.harmonybrew/bin/multica" desktop start --bridge-only` | 是 |
| 含 PATH 顺序说明（"before Homebrew's bin is on PATH … bare `multica` is not found … fails silently"，按折行后的整句匹配） | 是 |
| 不含裸写法 `` `multica desktop start --bridge-only` `` | 是 |
| 仍含 `multica desktop stop` 的说明 | 是 |

## 附带：caveats 建议的那一行在升级后实跑 (`05-line-run.log`)
`[ -x "$HOME/.harmonybrew/bin/multica" ] && "$HOME/.harmonybrew/bin/multica" desktop start --bridge-only >/dev/null 2>&1 || true`
在升级后的环境里退出码 0；bridge `/health` 的 `cli_ok=true`，daemon 仍在线、8 个 agent，没有被打扰。

## 说明
- 本次 revision 10 只改 caveats 文字，不改已安装产物，升级本身没有重启 daemon 与 bridge（bridge 用的是稳定的 opt 路径，升级后仍可用）。
- 本机 `~/.shellrc` 早已用同样的绝对路径写法，不需要改动。
