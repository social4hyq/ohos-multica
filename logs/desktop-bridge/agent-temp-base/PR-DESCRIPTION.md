## 背景

daemon 给每个任务建临时目录时，基址默认取 `/tmp`，除非设置了 `MULTICA_AGENT_TEMP_BASE`（`socketSafeTempBaseDir()` 先看 `/tmp` 是否存在），并对该目录加 `flock`。OHOS 上 `/tmp` 的 `flock` 返回 `Permission denied`（本机实测，同一个调用在 `/data/storage/el2/base/cache` 下正常）。此前只有已退役的 supervisor 脚本 `start-daemon-ohos.sh` 会设置这个变量；桌面经 bridge 拉起的 daemon 没有它，agent 任务会以 `lock task temp dir /tmp/multica-task-…: permission denied` 失败。daemon 在线、心跳正常并不能发现这一点。

## 改动

只改 `multica`（`Formula/m/multica.rb`），`revision 9`，bottle 块不动，由 CI 回写。

wrapper 增加 `MULTICA_AGENT_TEMP_BASE="${MULTICA_AGENT_TEMP_BASE:-/data/storage/el2/base/cache}"`：CLI、bridge、以及 bridge 拉起的 daemon 都继承它，用户自己设置的值优先。

`test do` 新增断言：wrapper 含上述写法；把 wrapper 的最后一个 `exec` 换成 `env` 实跑，未设置时输出默认值，预先设置时输出用户的值。

## 验证

- 先写测试，对现有已装 wrapper 跑同样的断言，两项均失败；改完后用 Homebrew 自己的 `write_env_script` 生成 wrapper 再跑，三项均通过。
- `brew style`、`brew audit --strict`、`brew readall` 本机通过。
- 整个 `test do` 本机无法运行，等 CI。

## 未覆盖

真机派单验收（桌面拉起的 daemon 在生产账户上跑一个最小任务并回写）要等出瓶后做，合并前不应视为已验证。
