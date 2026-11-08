# 分发路线：`multica-desktop` formula 设计与阻塞登记

目标形态：`brew install multica-desktop` = CI 构建**未签名 HAP** 进 bottle + 安装时用**用户本机**的开发者材料现场签名（调试证书绑定设备 UDID，签好的 HAP 无法跨设备共享——这是今天真机实证过的硬约束，见 README 路线一与 route1/）。

## 前置链核查结论（2026-11-08）

| 环节 | 状态 | 依据 |
|---|---|---|
| 签名器 | ✅ 零成本 | `ohos-sdk`（官方 core 特例 formula）自带 `hap-sign-tool`/`binary-sign-tool`，本机 PATH 实证；不需要自建 hapsigner formula（C++ 版是 GN/ohos-sdk 构建、Java 版要拉 maven/openjdk，均为过度工程） |
| payload 构建配方 | ✅ 已实证 | pnpm@10.28.2 + `--ignore-scripts` + ohos-signpost + electron 测试桩，完整命令见 BUILD-PIPELINE.md 债务节；Linux 容器可复现（本配方同时在 VM Linux 验证过） |
| payload 平台无关性 | ✅ 已实证 | electron-vite 产物在 VM Linux 与本机均构建成功 |
| Electron OHOS 壳 zip | ⛔ **唯一硬阻塞** | 见下节 |
| 壳工程 hvigor+SDK 编译 | 待实证 | `ohos-sdk` 已在官方 core；壳工程 hvigorw 的容器首建是实施期第一风险点 |
| autobump 补丁脆弱性 | 结构性 | 上游近乎日更，854 行补丁会高频冲突；autobump 需配补丁重打机制，或先推动补丁上游化 |

## Electron 壳 zip 核查（Step 3a 实录）

- 349MB 包内**无任何 LICENSE/NOTICE/COPYING 文本**（`unzip -l` 实测）——不是"条款不允许"，是"未附授权文本"
- `openharmony-sig/electron` 不在 GitHub（API 404），官方发布在 CodeHub/gitee；Electron 系上游 MIT / Chromium BSD，二进制再分发的法律风险低，但保守做法是**不替官方做主**：不自行镜像
- 校验值已公示在 `electron-prebuilt/README.md`（sha256 `599e97b3…`），任何渠道下载都可验完整性
- 解锁方式（任一）：官方发无鉴权 CDN 链接；或用户自行决定镜像到自有 releases 并自担条款责任；或对方 PC 一律登录 CodeHub 自取（当前 SECOND-PC 指南的形态）

## formula 设计（阻塞解除后按此实施）

```ruby
class MulticaDesktop < Formula
  desc "Multica desktop GUI for HarmonyOS (unsigned HAP, signed at install)"
  homepage "https://multica.ai"
  url "https://github.com/multica-ai/multica/archive/refs/tags/v0.8.1.tar.gz"  # autobump 跟上游 tag
  sha256 "..."
  license :cannot_represent

  livecheck { url :stable, strategy :github_latest }

  depends_on "node" => :build
  depends_on "ohos-sdk" => :build        # 壳 ArkTS 编译 + 签名器
  depends_on "multica-ohos" => :build    # 本仓发布的补丁/branding/脚本资产

  # resource "electron-ohos" do           ⛔ 待镜像解锁
  #   url "..."
  #   sha256 "..."
  # end

  def install
    # 1) 应用 tap 侧 Patches/multica-desktop/0001（同步自本仓 patches/）
    # 2) pnpm 配方构建桌面 payload（命令固化自 BUILD-PIPELINE.md）
    # 3) 解 resource 壳 + branding + module.clean.json5，hvigorw assembleHap → 未签名 hap
    # 4) prefix.install 未签名 hap（单文件产物，bottle 即文件投递）
  end

  def post_install
    # ~/.ohos/config 材料在 → hap-sign-tool sign-app 现场签名
    # 不在 → 保留未签名产物，caveats 给出确切签名命令（材料一次配置终身可用）
  end
end
```

## 实施顺序（阻塞解除后）

1. 解决 electron-ohos resource（唯一硬阻塞，见上）
2. tap 建立 `Patches/multica-desktop/0001`（与 `patches/0001-desktop-ohos.patch` 同源同步）
3. CI 首建（hvigor 容器首跑风险集中在这里）
4. post_install 签名链路真机验证
5. autobump 准入：配补丁自动重打，或先上游化补丁（消除最大脆弱性，推荐后者）

## 补丁上游化（2026-11-08：用户决定不提交上游 PR）

**决定：不向 multica-ai 提交上游 PR**——与 bun 的桥接策略一致（fork 当桥、OHOS delta 常驻自有渠道，桥为常驻形态）。fork `social4hyq/multica` 的 `desktop-openharmony-compat` 分支保留为 rebase 备用基底（单提交、3 文件、+42/−19，基于当时上游 main，单测 72 文件/839 用例全绿），PR 描述稿存于 el2 cache `multica-upstream-pr-body.md` 备将来改主意时用。

连带影响：autobump 的补丁脆弱性不能用上游化消除，缓解路线改为——multica-desktop formula（阻塞解除后）配**补丁自动重打机制**（bump 时机器 rebase `patches/0001`，冲突则开人工 PR 告警），或对上游降频 pin（数周手动跟一次）。

## 推动官方渠道：CodeHub 请求草稿（粘贴即用）

> **标题**：建议为 PC(2in1) 预编译包提供免登录下载渠道（CDN / Release 附件），并在包内附许可文本
>
> **正文**：
> openharmony-sig/electron 的 PC 预编译包（如 v34.9.0-20261030.1-release.zip）当前需华为账号登录 CodeHub 下载，第三方应用（例：Multica 桌面向 HarmonyOS PC 的移植）无法把它作为 CI 构建依赖自动获取，只能让每个用户在构建机上人工登录下载。
>
> 两点请求：
> 1. 为 release 预编译包提供免鉴权的 CDN 直链或发布页永久附件；
> 2. 在 zip 内附带 LICENSE/NOTICE——当前包内无任何许可文本，下游无法评估再分发的合规性，社区镜像与工具链集成（如 Homebrew 类包管理器）都被卡住。
>
> 影响面：所有想把 Electron 应用分发到 HarmonyOS PC 的第三方开发者。
