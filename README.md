# 玄枢 AI (Xuanshu AI)

玄枢 AI 是一个持续开发中的中文命理 AI Agent，计划结合八字、紫微斗数、老黄历与六爻，提供可追溯、可复算、边界清晰的排盘与交互式解读。

## 产品原则

- 规则引擎负责确定性排盘，AI 负责解释与交互。
- 明确历法、流派、数据来源和不确定性。
- 尊重隐私，不以恐惧或绝对化判断诱导用户。
- 内容仅用于传统文化研究、娱乐与自我反思，不替代专业意见。

## 当前阶段

项目已完成 M0-M5 的首个可用纵向交付：本地 Web 应用、SQLite 数据层、Windows 启动器、
1901-2100 年离线历法、可追溯人物档案、八字/大运与紫微首版盘面、黄历事项筛查、六爻问事工作区，
以及首个带事实和证据边界的咨询流程。M6 已完成确定性路由、按需 facts、证据归属和高风险安全边界，
并建立了 200 条中文固定评测集；M7 已完成本地 JSON 备份、恢复、清空和设置页入口。代码侧无障碍、
安全、依赖和性能基线已完成，最新提交也已在全新 Windows 隔离目录完成安装、快捷方式创建、启动脚本、生产服务和页面验收；
当前剩余真实模型评测、独立参考案例复核，以及另一台真实 Windows 机器的桌面发布验收；公开 S3 交叉验证来源已登记，但不替代人工黄金案例。

## 本地运行

需要 Node.js 24 或更高版本，以及 pnpm 10.20：

```powershell
pnpm install
pnpm dev
```

浏览器打开 <http://127.0.0.1:3000>。提交前运行完整检查：

```powershell
pnpm check
```

设置页的“数据管理”可以下载 JSON 备份、恢复备份或清空本机数据。备份包含出生日期、
时间、地点等敏感资料，应只保存到你信任的位置；恢复前会校验格式，失败不会清空现有数据。

### 可选的模型配置

确定性排盘、黄历和六爻功能不需要模型密钥。若要启用 AI 咨询：

```powershell
New-Item -ItemType Directory -Force "$env:USERPROFILE\.xuanshu-ai"
Copy-Item .\config.example.toml "$env:USERPROFILE\.xuanshu-ai\config.toml"
[Environment]::SetEnvironmentVariable("XUANSHU_AI_API_KEY", "你的密钥", "User")
```

重启应用即可。密钥只放在环境变量中，不要写入 `config.toml`、代码或提交记录。

当前应用只包含可验证的工作区与状态，不会显示尚未实现的虚构命理结果。

### Windows 桌面快捷方式

在仓库根目录运行一次：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

桌面上的“玄枢 AI”快捷方式会在需要时安装依赖并重新构建，然后在后台启动仅监听
`127.0.0.1` 的服务并打开浏览器。运行日志默认保存在 `%LOCALAPPDATA%\XuanshuAI\logs`；
设置 `XUANSHU_AI_DATA_DIR` 后，数据库和日志会统一写入该目录。

关闭本地服务时运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-windows.ps1
```

停止脚本只会处理命令行明确指向玄枢生产 `server.js` 的 3000 端口进程，遇到其他本地服务会拒绝停止。

## 项目文档

- [架构决策](./docs/architecture.md)
- [术数规则与流派边界](./docs/domain-rules.md)
- [资料来源注册表](./docs/source-register.md)
- [质量基线与路线图](./docs/quality-and-roadmap.md)
- [M7 本地数据管理决策](./docs/m7-data-decision.md)
- [安全审查记录](./docs/security-audit-20260821.md)
- [确定性引擎性能基线](./docs/performance-baseline-20260821.md)
- [模型评测执行说明](./docs/model-evaluation.md)
- [M4/M5 参考案例复核契约](./docs/reference-case-review.md)
- [Windows 发布验收清单](./docs/windows-release-checklist.md)
- [M2 验收记录](./docs/m2-acceptance.md)

## 协作方式

本项目采用自然语言驱动的 vibe coding 工作流。详细规则见 [AGENTS.md](./AGENTS.md)。

## 仓库

<https://github.com/zhulongqihan/xuanshu-ai>
