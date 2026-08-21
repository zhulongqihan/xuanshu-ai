# M3 老黄历 MVP 决策

状态：已采用

更新日期：2026-08-21

## 当前交付范围

首版离线黄历提供指定公历日期和 IANA 时区下的：

- HKO 公农历日期与月长；
- 日干支、天干/地支元素；
- 上一节气、当前节、下一节和下一节气的 UTC 与本地展示；
- 建除十二神和日支相冲；
- 出行、搬迁、签约、祭祀四个具体事项入口。

## 约束

事项入口当前状态为 `not_evaluated`。在《钦定协纪辨方书》的事项规则完成逐条校验、黄金案例和
来源定位前，产品不生成宜忌、单一吉利指数或绝对化结论。这样避免把普通日期事实伪装成完整择日判断。

日期事实使用 `hko-calendar`、`gbt-33661`、`meeus-aa` 和 `xiejibianfang` 的分层证据；
开源库不替代正式规则来源。正式范围为 1901-2100，范围外拒绝计算。

## 规则 ID

- `almanac.lunar-date-hko-v1`
- `almanac.sexagenary-day-v1`
- `almanac.solar-term-context-v1`
- `almanac.jianchu-v1`
- `almanac.clash-v1`
- `almanac.activity-scope-v1`

后续事项规则必须按事项独立版本化，不能把所有事项重新塞入一个通用“吉凶分”。
