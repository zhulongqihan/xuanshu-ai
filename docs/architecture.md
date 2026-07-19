# 玄枢 AI 架构决策

状态：已采纳
更新日期：2026-07-19

## 1. 产品边界

玄枢 AI 是用户本人优先的中文命理研究与决策助手。应用默认在 Windows
本机运行，以开源自托管方式发布，不建设账号、付费、运营后台或默认公网访问。

产品必须始终遵守以下边界：

- 确定性排盘由可测试的规则引擎产生，语言模型不得补造或修改盘面。
- 八字、紫微斗数、老黄历和六爻分别计算、分别标注规则，再进行受控综合。
- 每条关键判断必须能追溯到输入、盘面字段、规则版本和资料来源。
- 内容仅用于传统文化研究、娱乐与自我反思，不替代医疗、法律、投资等专业意见。
- 出生日期、时间、地点和咨询内容按敏感个人数据处理，默认仅保存在本机。

## 2. 技术栈

- TypeScript 与当前稳定 LTS Node.js。
- pnpm workspace 管理单仓库。
- Next.js App Router 与 React 构建本地网页应用。
- SQLite 保存本地状态，Drizzle ORM 管理类型和迁移。
- Zod 定义配置、领域对象、工具输入输出和模型结构化结果。
- Vitest、fast-check 与 Playwright 分别承担单元、属性和端到端测试。

计划中的顶层模块只有三个：

- `apps/web`：界面、本地 HTTP 服务、启动与设置体验。
- `packages/domain`：历法与四术确定性规则，不依赖模型或 UI。
- `packages/agent`：模型适配、工具编排、证据检索、输出校验和安全策略。

领域包不得依赖 Agent 包，Agent 包只能通过公开领域接口读取结构化结果。

## 3. 本地运行模型

- 服务默认只监听 `127.0.0.1`，不得自动开放局域网或公网。
- 用户数据放在 `%LOCALAPPDATA%\XuanshuAI`，不写入 Git 仓库。
- 模型配置放在 `%USERPROFILE%\.xuanshu-ai\config.toml`。
- 密钥只从配置指定的环境变量或 Windows 凭据管理器读取。
- Windows 启动器负责检测服务、启动应用并打开浏览器；安装脚本创建桌面快捷方式。
- 开源用户同时可以通过 pnpm 和可选 Docker 配置运行应用。

模型配置的首版契约如下：

```toml
config_version = 1

[provider]
type = "openai-compatible"
base_url = "https://api.openai.com/v1"
api_mode = "responses"
model = "gpt-5.6"
reasoning_effort = "medium"
api_key_env = "XUANSHU_AI_API_KEY"
store = false
timeout_ms = 120000
max_retries = 2
```

`api_mode` 允许 `responses` 和 `chat_completions`。官方 OpenAI 默认采用 Responses
API；中转站不支持时必须由用户显式切换，应用不得静默降级。

## 4. 核心领域契约

首版公共类型包括：

- `RawBirthInput`（公共别名 `BirthInput`）：原样结构化保存公历/农历日期、精确/近似/未知
  时间、地点、经纬度、IANA 时区来源与确认状态、排盘性别和真太阳时模式。
- `CanonicalBirthInput`：NFC 与显式默认值规范化后的可哈希输入；只有用户确认 IANA 时区后
  才能产生，不包含档案显示名称。
- `NormalizedBirth`：公农历双表示、UTC/DST 候选、节气上下文、真太阳时对照、结构化
  边界距离与警告，以及 normalizer、依赖、Node/ICU/tzdb 和来源追踪。
- `RuleSetRef`：体系、规则集 ID、语义版本、状态和来源集合。
- `EvidenceRef`：来源 ID、版本或版次、卷页/章节、规则 ID 和必要短摘录。
- `ChartSnapshot<T>`：输入哈希、引擎版本、规则版本、结构化盘面、计算轨迹、警告。
- `Claim`：结论文本、所属体系、确定性等级、证据、适用范围和不确定性。
- `LiuyaoCast`：问题、起卦方式、由初爻到上爻的六爻原始值、时间地点和随机审计值。
- `Consultation`：用户问题、所用快照、工具调用、结构化判断和最终回答。

确定性等级使用枚举而不是伪精确百分比：

- `deterministic`：可从输入和固定算法复算。
- `rule_based`：来自已版本化的术数规则。
- `interpretive`：语言模型对已有证据的归纳。
- `ambiguous`：输入、历法边界或流派差异会改变结论。

## 5. Agent 数据流

固定处理流程为：

1. 校验用户输入并保存原始值。
2. 归一化时区、历法、节气和真太阳时，生成边界警告。
3. 调用本地规则引擎生成不可变命盘快照。
4. 根据问题选择最少必要工具和规则证据。
5. 将脱敏后的盘面字段、问题和证据发送给模型。
6. 要求模型输出结构化 `Claim` 集合和面向用户的回答草稿。
7. 校验每条盘面事实与证据引用；不通过时重试一次，再失败则返回受限结果。
8. 展示结论、依据、冲突、不确定性和免责声明，并保存本地追踪记录。

首版工具固定为 `normalize_birth`、`calculate_bazi`、`calculate_ziwei`、
`get_almanac`、`cast_liuyao`、`retrieve_rules` 和 `synthesize_findings`。

## 6. 跨体系综合

- 八字和紫微用于长期结构、阶段趋势与性格观察。
- 老黄历用于日期、时辰和具体事项选择。
- 六爻用于有明确问题、起卦时刻和原始卦象的问事场景。
- 综合层先保存各体系独立判断，再生成共识、冲突和适用时间尺度。
- 禁止把四个体系的结果相加为单一吉凶分数，也禁止为了统一结论而隐藏冲突。
