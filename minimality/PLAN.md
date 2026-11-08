# 最小差异验证

基线固定为已验证版本 e437b11a718d6afce9cd800ba5b8554f3691a133，不趁机升级 Multica。
保留原工作树和已安装应用；隔离 worktree 中验证，所有日志落项目 logs/minimality/。

1. 原生依赖：先检验当前锁定版本/上游新版本支持情况，再考虑社区包；优先上游指定 pnpm 10 JS 实现，避免 pnpm 12 配置迁移。
2. 逐项回退 registry、重试、发布时间豁免与重复 overrides；实际 install/build/test 决定保留。
3. 源码：在新增回归测试先失败的前提下，把健康检查兼容分支限制于 OHOS；验证无 CLI 轮询与 HOME 重定向的必要性。
4. 用正式源码处理 fix-path 导入，去掉 node_modules 空实现；比较无需 shim 的构建产物与已运行版本。
5. 整理最小补丁并 git apply --check；真机验收构建候选前备份已装版本。没有验证的平台不声称通过。
