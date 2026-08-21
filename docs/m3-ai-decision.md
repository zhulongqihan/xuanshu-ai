# M3.6 首个 AI 咨询流程决策

状态：已实现首个纵向闭环，仍需在真实模型配置下补充发布前评测
更新日期：2026-08-21

## 目标

让用户从人物档案进入咨询，向模型提出问题，并得到只解释当前八字快照的回答。回答必须能回到本地快照中的规则证据；模型不可用时，确定性命盘仍可正常使用。

## 数据边界

- 本次请求不发送原始出生日期、出生时间、地点、经纬度、时区或档案名称。
- 仅发送八字候选的脱敏事实、状态和允许引用的 `evidenceRuleIds`。
- 模型不得重新排盘、补算或引用当前快照之外的规则。
- 本地只保存用户问题、模型回答和经证据映射后的 claims；API 密钥只从配置指定的环境变量读取。

## 接口策略

- 支持 `responses` 和 `chat_completions` 两种 OpenAI-compatible 模式。
- Responses API 使用 `text.format.type=json_schema`；Chat Completions 使用 `response_format.type=json_schema`。
- 请求强制 `store=false`，本地会话是唯一的应用侧历史来源；中转站可能有独立留存策略，界面需继续提醒用户。
- 超时、408/409/429/5xx 按配置有限重试；结构化输出失败、未知证据引用和其他 4xx 不重试。
- 不引入 SDK，使用受测试覆盖的 `fetch` 适配层，便于兼容本地或自托管 OpenAI-compatible 服务。

官方接口参考：

- Responses 创建接口：<https://developers.openai.com/api/reference/cli/resources/responses/methods/create>
- OpenAI 数据控制说明：<https://platform.openai.com/docs/models/default-usage-policies-by-endpoint>

## 回答契约

模型只能返回 `answer`、`claims`、`cautions`。每条 claim 必须包含确定性等级、适用范围和至少一个规则 ID；服务端将规则 ID 映射回本地完整证据，映射失败则丢弃整次回答，不把未经校验的文本存入会话。

## 后续增强

- 真实 API 配置下建立中文问题评测集，覆盖事实一致性、候选冲突、不确定时间和高风险问题。
- 为没有 API 密钥、限流、网络断开、模型拒绝和中转站不支持 JSON Schema 增加更细的界面提示。
- M4 之后扩展 facts contract，让紫微、六爻和黄历按各自证据域加入综合 Agent；不把四术字段混成一个无来源的提示词。
