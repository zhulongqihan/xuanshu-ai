# 资料来源注册表

状态：持续维护
更新日期：2026-07-21

## 来源等级

| 等级 | 类型 | 用途 |
| --- | --- | --- |
| S0 | 官方天文、历法、时区和国家标准 | 校验可观测时间与历法事实 |
| S1 | 公版古籍原文与可靠影印本 | 建立传统规则原文和历史语境 |
| S2 | 有版次信息的现代研究、校注和专业资料 | 解释歧义、校勘和流派差异 |
| S3 | 开源实现、排盘工具和人工案例 | 工程参考和交叉验证，不单独充当权威 |

## 已验证的公开来源

| ID | 等级 | 来源 | 计划用途 |
| --- | --- | --- | --- |
| `hko-calendar` | S0 | [香港天文台公农历对照表](https://www.hko.gov.hk/en/gts/time/conversion.htm)；年度文本 `T{year}e.txt`；年度 PDF `{year}e.pdf` | 1901-2100 公农历正式离线月界表与逐日回归基准 |
| `hko-calendar-api` | S0 | [香港天文台开放数据目录](https://data.gov.hk/en-data/dataset/hk-hko-rss-gregorian-lunar-calendar-conversion-table)；[按日期 JSON API](https://data.weather.gov.hk/weatherAPI/opendata/lunardate.php?date=[YYYY-MM-DD]) | 生成和抽样复核公农历 fixture；不作为运行时依赖 |
| `iana-tzdb` | S0 | [IANA Time Zone Database](https://www.iana.org/time-zones) | 历史民用时区、UTC 偏移和夏令时 |
| `rfc-8785` | S0 | [RFC 8785 JSON Canonicalization Scheme](https://www.rfc-editor.org/rfc/rfc8785) | 出生输入稳定序列化与 SHA-256 复算 |
| `gbt-33661` | S0 | GB/T 33661-2017《农历的编算和颁行》 | 农历术语、编算与发布边界；第 6.3.2 条干支纪日法及 `1949-10-01 = 甲子日` 锚点 |
| `meeus-aa` | S0 | Jean Meeus, *Astronomical Algorithms* | 儒略日、太阳视黄经和时间方程交叉验证 |
| `yuanhai-ziping` | S1 | 《渊海子平》 | 子平法基础规则 |
| `sanming-tonghui` | S1 | [《三命通会》卷二](https://zh.wikisource.org/wiki/三命通會/卷二) | “论遁月时”的五虎遁、五鼠遁；“论人元司事”的古籍人元表；“论大运”的顺逆与三日折一年 |
| `ditiansui` | S1 | 《滴天髓》 | 五行气势与解释规则来源 |
| `ziping-zhenquan` | S1 | 《子平真诠》 | 月令、格局规则来源 |
| `ziwei-quanshu` | S1 | 《紫微斗数全书》 | 紫微安星与传统解释来源 |
| `xiejibianfang` | S1 | 《钦定协纪辨方书》 | 黄历神煞、建除和择日规则来源 |
| `zengshan-buyi` | S1 | 《增删卜易》 | 六爻用神、旺衰和断例来源 |
| `bushi-zhengzong` | S1 | 《卜筮正宗》 | 六爻纳甲和断法来源 |
| `huozhulin` | S1 | 《火珠林》 | 纳甲筮法历史基础 |

古籍初始电子文本可从维基文库检索。正式引用时必须记录具体版本、卷次和章节，
不能只记录搜索页面或作品名。

## 开源依赖决策

| 包 | 当前核验版本 | 许可证 | 使用约束 |
| --- | --- | --- | --- |
| `lunar-typescript` | 1.8.6 | MIT | 干支、节气候选和终端月长交叉验证；因 2057 年存在 30 天公农历偏差，不作为正式转换适配器 |
| `iztro` | 2.5.8 | MIT | 紫微候选排盘；固定配置并记录四化、亮度和插件版本 |
| `astronomia` | 4.2.0 | MIT | Meeus 天文算法实现；用于真太阳时和天文交叉验证 |
| `tz-lookup` | 6.1.25 | CC0-1.0 | 不采用：npm 指向的上游仓库不可用；首版要求用户确认 IANA 时区 |
| `@js-temporal/polyfill` | 0.5.1 | ISC | 明确处理日期、时间、时区和歧义时刻 |
| `canonicalize` | 3.0.0 | Apache-2.0 | 按 RFC 8785 生成稳定 JSON，作为出生输入 SHA-256 的唯一序列化格式 |
| `openai` | 6.46.0 | Apache-2.0 | Responses API 与 OpenAI 兼容端点调用 |

依赖版本只表示 2026-07-19 的研究基线。实现时使用锁文件固定实际版本，升级必须经过
许可证核验、变更审查和全部黄金测试。

## OpenAI 官方资料

- [Using GPT-5.6](https://developers.openai.com/api/docs/guides/latest-model.md)
- [Using tools](https://developers.openai.com/api/docs/guides/tools)
- [Conversation state](https://developers.openai.com/api/docs/guides/conversation-state)
- [Structured outputs](https://developers.openai.com/api/docs/guides/structured-outputs)
- [Trace grading](https://developers.openai.com/api/docs/guides/trace-grading)

## 版权与引用政策

- 公版古籍允许建立全文索引，但仍保留版本和来源信息。
- 现代受版权保护资料只保存书目、必要短摘录和自行归纳的规则，不收录未授权全文。
- 网络文章、论坛和现成排盘只作线索或测试对照，不直接转化为机器规则。
- 任何无法定位来源的规则默认状态为 `draft`，不得用于面向用户的关键判断。
