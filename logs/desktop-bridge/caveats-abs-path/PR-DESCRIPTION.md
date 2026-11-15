## 背景

caveats 建议把 `multica desktop start --bridge-only` 写进 shell 启动文件，让 bridge 开终端即在。但启动文件可能在 Homebrew 的 `bin` 进 PATH 之前就执行（本机 `.zshrc` 先 source `~/.shellrc`、之后才设 PATH），裸的 `multica` 在那里找不到，整行**静默失败**，bridge 不会被拉起。本机真机上已踩到并改成绝对路径验证过。

## 改动

只改 `multica`（`Formula/m/multica.rb`）：

- caveats 里的建议改成 `"$HOME/.harmonybrew/bin/multica" desktop start --bridge-only`，并说明原因；
- `revision 10`，bottle 块不动，由 CI 回写。caveats 文字本身不进已安装产物，加 revision 是按需求要求让用户升级后能看到新文字。

`test do` 新增三条断言：caveats 含绝对路径写法、含 PATH 顺序说明、不再含裸的 `` `multica desktop start --bridge-only` ``。

## 验证

- 先写测试：对现有 caveats 三项断言均失败；改后均通过。把 PATH 说明替换掉再跑，对应断言变红（变异检查）。
- `brew style`、`brew audit --strict`、`brew readall` 本机通过。
- 整个 `test do` 本机无法运行，等 CI。
