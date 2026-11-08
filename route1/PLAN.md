# HAP 启动 daemon：路线一

先做门禁探针，不修改 Multica 业务代码，不停止宿主 daemon，不降低系统安全策略。

1. 以最小动态 ELF 对照验证 executableBinaryPaths 配置、应用证书签名与安装。
2. 同一探针在 HAP 内验证执行、uid、宿主目录和 agent 文件的可访问性（只测 access，不读取 token）。
3. 门禁通过再加入 Go daemon；使用独立假服务/profile 验证运行、退出、应用重启和回收。
4. 验证实际 agent 调用后才接回上游 bootstrap/lifecycle。

只修改隔离/备份过的 HAP 工程配置；签名材料不进入项目或日志，不记录口令。失败不通过 self-sign/chmod 当作权限修复结论。

## 阶段观察

- 动态 C 探针已完成宿主基线测试；只检查 access，不读取 agent 凭据。
- ELF 使用现有应用证书签名成功（SDK 口令解码在内存中完成，不落盘明文）。
- 同一 app-signed ELF，声明无扩展名 route1-probe 时安装失败 9568393；改为 route1-probe.bin 后安装成功。不能将此误报为 daemon 已能启动。
- .bin 版本启动尝试被设备锁屏挡住（10106102），等待用户解锁后验证执行与宿主访问。
- 代码签名块结构已依据 OpenHarmony hapsigner 源码读取确认；失败的无扩展名 HAP 同样有 code-sign block，因此不能泛称“没有代码签名”。
- 解锁后复核（11-08 12:33）：.bin 版 HAP 安装状态保持，`aa start` 成功；主进程探针前两个候选路径 ENOENT，第三个 `/data/storage/el1/bundle/libs/arm64/route1-probe.bin` 执行成功（`logs/route1/14-inhap-probe-result.log`）。
- 探针输出 `UID=20020251`（应用 uid；hdc shell 为 20020101）→ HAP 沙箱内执行确证。
- `HOST_AGENT_ACCESS`/`HOST_CONFIG_ACCESS`/`HOST_MULTICA_ACCESS` 全 0 → HAP 沙箱读不到宿主 agent CLI、配置与家目录；daemon 在 HAP 内即使能执行也无法工作（要 spawn 的 CLI 与仓库全在宿主侧）。
- **路线一结论**：9568393 技术门槛已解（`.bin` 扩展名 + 应用证书签 ELF + hvigor 构建），但功能门槛不可解；路线关闭，「外部 daemon + HAP 前端」为终态架构。门禁探针使命完成。
