# 第二台 HarmonyOS PC 验证指南

目的：在一台**从未参与过本移植**的鸿蒙 PC 上，从零把 multica 桌面跑通，验证"可分发" claims。两种取料路径（A 拷贝 / B 发布仓），验收清单相同。

## 0. 前置条件（新 PC）

- [ ] Harmonybrew 已装（`brew --version` 正常）
- [ ] 开发者模式已开启（设置 → 系统和更新 → 开发人员选项）
- [ ] 华为账号（用于：DevEco 自动签名材料、multica 登录）
- [ ] 至少一个 agent CLI（如 `brew install social4hyq/core/claude-code` 或 codex），并完成其自身登录
- [ ] 终端可用（sshd 非必需）

## 路径 A：工程拷贝（现在就能做，不涉及发布）

在**本机**打包（排除垃圾与会话数据）：

```bash
cd /storage/Users/currentUser/HarmonyPC/Software
tar czf /data/storage/el2/base/files/ohos-multica-handoff.tar.gz \
  --exclude='ohos-multica/source-minimal/node_modules' \
  --exclude='ohos-multica/logs' \
  --exclude='ohos-multica/validation/state.json' \
  ohos-multica
# HAP 产物随包另拷（仅作参考，对方不能直装——见坑 1）
cp /data/storage/el2/base/files/multica-hap/electron-probe-variant-20261108-1219.hap /data/storage/el2/base/files/
```

`source-minimal/node_modules` 不拷（数百 MB 且含平台特定产物），对方按 BUILD-PIPELINE.md 重装（约 5 分钟，`npm exec pnpm@10.28.2 install --ignore-scripts` + postinstall 签名 + electron 测试桩三步）。

## 路径 B：发布仓（public，实验性预发布）

```bash
git clone https://github.com/social4hyq/ohos-multica ~/HarmonyPC/Software/ohos-multica
```

仓内**不含**、需按 BUILD-PIPELINE.md 自行获取的三样：

1. **Multica 源码**：构建时从上游 clone 固定 commit `e437b11a`（OHOS 补丁自动应用）
2. **Electron OHOS 预编译包**（349MB，再分发条款待核查不随仓）：CodeHub 官方下载，`electron-prebuilt/README.md` 有入口与 sha256 校验值
3. **DSH 桥接包**（UNLICENSED 不随仓）：官方仓 `multica-ai/dsh-multica-runtime` 自行克隆，仅 DeepSeek Harness agent 需要

## 1. daemon 侧（新 PC，约 10 分钟）

```bash
brew install multica
multica --version        # 期望：multica 0.8.1 (commit: unknown, built: unknown)
multica login            # 浏览器流（本机回环可达，自动打开）；或 --token 传 PAT
# supervisor（被杀自愈 + 开终端自驻留）：
bash ~/HarmonyPC/Software/ohos-multica/scripts/multica-supervise.sh --daemon
grep -q multica-supervise ~/.shellrc || cat >> ~/.shellrc <<'EOF'
if [ -f "$HOME/HarmonyPC/Software/ohos-multica/scripts/multica-supervise.sh" ]; then
  bash "$HOME/HarmonyPC/Software/ohos-multica/scripts/multica-supervise.sh" --daemon > /dev/null 2>&1 || true
fi
EOF
# 起 daemon（supervisor 在场时 HAP 启动也会自动拉起，先起更省事）：
setsid nohup bash ~/HarmonyPC/Software/ohos-multica/scripts/start-daemon-ohos.sh desktop-api.multica.ai \
  >> /data/storage/el2/base/files/multica-supervise/daemon.log 2>&1 &
curl -sf -m 2 http://127.0.0.1:19681/health    # 期望 {"status":"running",...,"cli_version":"0.8.1"}
```

`multica login` 会写入 `~/.multica/profiles/desktop-api.multica.ai/config.json`（PAT），daemon 与桌面共用——登录只做一次。

## 2. HAP 侧（新 PC，约 20–30 分钟）

```bash
# 取工程（A: 解拷贝包放 ~/HarmonyPC/Software/ohos-multica；B: git clone）
# 1) 装 deveco-cli（隔离安装，README「ArkShell 最小壳」一节有完整步骤）
# 2) 签名：DevEco 自动签名用【对方自己的】华为账号材料（~/.ohos/config/），
#    按 hap-work/build-profile.reference.json5 的形状配 build-profile.json5
# 3) 依赖（约 5 分钟）：
cd ~/HarmonyPC/Software/ohos-multica/source-minimal
CI=true npm exec --yes -- pnpm@10.28.2 install --ignore-scripts --no-frozen-lockfile
npm exec --yes -- pnpm@10.28.2 run postinstall        # ohos-signpost 签 .node
E=node_modules/.pnpm/electron@*/node_modules/electron   # 测试桩（跑单测才需要）
printf electron > "$E/path.txt"; mkdir -p "$E/dist"; touch "$E/dist/electron"
# 4) 构建安装（HAP 壳若缺失，先按 BUILD-PIPELINE.md「从零重建」解包 electron-prebuilt）：
cd ~/HarmonyPC/Software/ohos-multica
bash scripts/build-desktop.sh && bash scripts/build-hap.sh && \
bash scripts/install-hap.sh /data/storage/el2/base/cache/electron-ohos/libelectron/ohos_hap/electron/build/default/outputs/default/electron-default-signed.hap --start
```

## 3. 验收清单（逐项打勾，结果回填本文件）

| # | 项 | 命令/操作 | 期望 | 结果 |
|---|---|---|---|---|
| 1 | CLI 版本 | `multica --version` | `multica 0.8.1` | |
| 2 | daemon 健康 | `curl :19681/health` | `status:running`、`cli_version:0.8.1`、agents 数=已装 agent | |
| 3 | 应用启动 | 点桌面图标（或 install-hap 的 --start） | 窗口出、非登录页 | |
| 4 | agent 在线 | 布局树或「团队→我的智能体」 | 每个 agent 显示在线 | |
| 5 | 派单回写 | `multica --profile desktop-api.multica.ai issue create --title "PC2 验收 $(date +%s)" --assignee "<agent名>"` 后轮询 `issue runs <id> --output json` | status=completed 且有输出回写 | |
| 6 | daemon 自愈 | `kill <daemon pid>` 后等 ≤30s | health 自动恢复 running（supervisor 日志 `logs/supervise.log`） | |
| 7 | 深链（可选） | 浏览器访问 `http://<本机IP>:<静态服务端口>/deeplink-test.html` 点链接 | 应用收到 want（hilog 抓 `onAcceptWant`） | |

## 坑位预告（新 PC 上必然/可能遇到）

1. **拷贝来的 .hap 不能直接装**：调试 Profile 绑定签名设备 UDID，`bm install` 会报签名/校验错——必须在新 PC 用自己的材料重签（本指南第 2 节流程）。
2. **锁屏挡 `aa start`**：报 `10106102` 属正常，解锁后重跑或点图标。
3. **GitHub 直连慢/断**：装依赖走 npm registry 不受影响；若需拉 GitHub 产物用 ghfast.top 镜像前缀。
4. **`hdc shell` 大文件传输 ≥20MB 卡死**：install-hap.sh 已内置分块，勿单文件直传。
5. **agent CLI 未登录**：验收项 4/5 前置，daemon 健康但 agent offline。
6. **记录与隐私**：验收过程产生的问题单只建在自己账户的"OHOS 验收"类专用项目；不回填任何 token/配置到共享文档。

## 结果回填

- 验证人 / 日期 / 设备型号：
- 路径（A/B）：
- 各项结果：
- 与第一台 PC 的差异（含新坑）：
