# 玄枢 AI (Xuanshu AI)

玄枢 AI 是一个持续开发中的中文命理 AI Agent，计划结合八字、紫微斗数、老黄历与六爻，提供可追溯、可复算、边界清晰的排盘与交互式解读。

## 产品原则

- 规则引擎负责确定性排盘，AI 负责解释与交互。
- 明确历法、流派、数据来源和不确定性。
- 尊重隐私，不以恐惧或绝对化判断诱导用户。
- 内容仅用于传统文化研究、娱乐与自我反思，不替代专业意见。

## 当前阶段

项目已完成基础规划和首个本地 Web 应用壳，正在建设模型配置、SQLite 数据层与确定性
历法基座。当前架构、规则边界、资料来源和质量门槛已经形成可追溯文档。

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

## 项目文档

- [架构决策](./docs/architecture.md)
- [术数规则与流派边界](./docs/domain-rules.md)
- [资料来源注册表](./docs/source-register.md)
- [质量基线与路线图](./docs/quality-and-roadmap.md)

## 协作方式

本项目采用自然语言驱动的 vibe coding 工作流。详细规则见 [AGENTS.md](./AGENTS.md)。

## 仓库

<https://github.com/zhulongqihan/xuanshu-ai>
