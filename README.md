# 玄枢 AI (Xuanshu AI)

玄枢 AI 是一个持续开发中的中文命理 AI Agent，计划结合八字、紫微斗数、老黄历与六爻，提供可追溯、可复算、边界清晰的排盘与交互式解读。

## 产品原则

- 规则引擎负责确定性排盘，AI 负责解释与交互。
- 明确历法、流派、数据来源和不确定性。
- 尊重隐私，不以恐惧或绝对化判断诱导用户。
- 内容仅用于传统文化研究、娱乐与自我反思，不替代专业意见。

## 当前阶段

项目已完成 M0、M1 与 M2，具备本地 Web 应用壳、模型配置契约、SQLite 数据层、健康检查、
Windows 启动器、1901-2100 年离线公农历转换、可追溯出生时间归一化和人物档案工作流，
并通过 Windows/Ubuntu CI 与桌面端、移动端 Playwright 验收。当前进入 M3，开始建设八字、
老黄历和首个证据化 AI 纵向流程。

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

当前应用只包含可验证的工作区与状态，不会显示尚未实现的虚构命理结果。

### Windows 桌面快捷方式

在仓库根目录运行一次：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1
```

桌面上的“玄枢 AI”快捷方式会在需要时安装依赖并重新构建，然后在后台启动仅监听
`127.0.0.1` 的服务并打开浏览器。运行日志默认保存在 `%LOCALAPPDATA%\XuanshuAI\logs`；
设置 `XUANSHU_AI_DATA_DIR` 后，数据库和日志会统一写入该目录。

## 项目文档

- [架构决策](./docs/architecture.md)
- [术数规则与流派边界](./docs/domain-rules.md)
- [资料来源注册表](./docs/source-register.md)
- [质量基线与路线图](./docs/quality-and-roadmap.md)
- [M2 验收记录](./docs/m2-acceptance.md)

## 协作方式

本项目采用自然语言驱动的 vibe coding 工作流。详细规则见 [AGENTS.md](./AGENTS.md)。

## 仓库

<https://github.com/zhulongqihan/xuanshu-ai>
