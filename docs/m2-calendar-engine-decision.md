# M2 历法基座依赖与边界决策

状态：已采纳
更新日期：2026-07-19

## 决策摘要

M2 将“民用时间归一化”“公农历转换”“节气候选”和“真太阳时校正”拆成可替换适配器。
第三方库只产生中间候选值；面向用户的 `NormalizedBirth` 必须由玄枢自己的版本化契约包装，
并记录依赖版本、运行时 ICU/tzdb 版本、输入哈希、规则来源和警告。任何库的默认黄历、八字
或吉凶解释都不会直接成为产品规则。

## 依赖选择

| 能力 | 锁定候选 | 版本/许可证 | 使用边界 |
| --- | --- | --- | --- |
| 民用日期、时间、IANA 时区与 DST | `@js-temporal/polyfill` | 0.5.1 / ISC | 使用 `Temporal.ZonedDateTime` 显式处理 gap/overlap；不使用宿主 `Date` 拼接本地时间 |
| 公历/农历转换与节气候选 | `lunar-typescript` | 1.8.6 / MIT | 只调用日期转换、干支和节气 API；通过 HKO 黄金样例复核；不直接信任其宜忌和解释 |
| 太阳位置、均时差 | `astronomia` | 4.2.0 / MIT | 只封装所需 Meeus 算法；记录算法版本和输入时间尺度；独立样例校验 |
| IANA 时区数据 | Node.js ICU/tzdb | 随 Node 24 发行 | 记录 `process.versions.node`、`process.versions.icu` 和可用的 `process.versions.tz`；升级 Node 必须重跑时区黄金集 |

### 已知适配器约束

- `lunar-typescript` 的 `Solar` 是无时区的年月日时分秒对象，`fromDate()` 会读取宿主本地字段，
  部分历法计算采用东八区口径。适配器只能接收显式日期字段，禁止把任意地区的 JavaScript
  `Date` 直接传入。任意 IANA 时区的 civil time 必须先由 Temporal 层解析。
- `@js-temporal/polyfill` 不内置冻结的 tzdb，而是依赖宿主 `Intl`/ICU；即使业务依赖版本不变，
  Node/ICU/tzdb 变化仍可能改变历史 offset，因此运行时指纹是复算契约的一部分。
- `astronomia` 使用 JD/JDE、UT/TD、弧度等天文原语；`AstronomyPort` 必须在类型和 trace 中
  标明时间尺度与单位。快速节气算法不能用于整个 1901–2100 正式区间，正式计算需使用其
  高精度 VSOP87 路径并以独立资料校验。
- npm 发布的 `lunar-typescript@1.8.6` `gitHead` 为 `a376ec2...`，GitHub `v1.8.6` 标签为
  `0f3e95d...`。锁文件必须固定 npm integrity，并以实际 npm 构件为被测对象，不能用标签源码
  替代发布物。当前 npm integrity 为
  `sha512-5Eo4T/cnuXfrgO4k5LCpOGHIUOuz5hCF/IfNv0T29WY2shR36Hiz+ecN9WjnUuxUKhql9gbOkPaQoqLFKtPRNA==`。

### 明确不采用

- `@lunisolar/core`：截至本决策日期 npm 不存在该包。
- `lunisolar` 2.6.0：GPL-3.0，且其插件生态有 GPL 组件；不作为本项目首版核心依赖。
- `tz-lookup` 6.1.25：npm 元数据指向的 `darkskyapp/tz-lookup` GitHub 仓库已不可用，且
  经纬度边界到时区的自动推断本身需要人工确认；首版只接受并显示用户确认的 IANA 时区。
- 在线 HKO API 作为运行时依赖：断网时历法功能必须继续工作，API 只用于研究、抽样复核和
  受控 fixture 生成，不在用户计算路径中发请求。

## 时间与历法政策

1. 原始输入保存用户填写的日期、时间、历法类型、闰月标记、地点、经纬度、IANA 时区、
   时间精度和真太阳时模式；不把显示名称或模型配置混进出生输入哈希。
2. 公历和农历使用互斥的 discriminated union。农历月份大小、闰月存在性由历法适配器验证，
   不能用公历 `Date.UTC` 验证农历日期。
3. 支持范围按“转换后的公历民用日期在 1901-01-01 至 2100-12-31”定义；范围外返回明确
   `unsupported_range`，不伪装为同等精度结果。
4. 民用时间始终是主结果。`civil_only` 只输出民用候选；`compare` 且有经度时另算真太阳时，
   真太阳时绝不静默覆盖民用时间。
5. DST 缺口（nonexistent local time）拒绝静默前移；DST 重叠（ambiguous local time）输出
   两个带 offset/fold 的候选。出生时间未知时不生成唯一 UTC instant，也不生成唯一命盘。
6. 时间不确定范围允许前后不对称分钟数，并分别检查节气、23:00、00:00、时辰和真太阳时
   边界；候选盘只在后续八字/紫微规则层生成，历法层只报告候选时刻。

## 官方与验证来源

- 香港天文台转换页：<https://www.hko.gov.hk/en/gts/time/conversion.htm>
  明确提供 1901–2100 年公历与农历对照表。
- 香港天文台开放数据目录：<https://data.gov.hk/en-data/dataset/hk-hko-rss-gregorian-lunar-calendar-conversion-table>
- HKO 按日期 JSON API：<https://data.weather.gov.hk/weatherAPI/opendata/lunardate.php?date=[YYYY-MM-DD]>
  例如 `2024-02-10` 返回甲辰年正月初一。只用于生成/复核 fixture，不作为运行时依赖。
- IANA 时区数据库说明：<https://data.iana.org/time-zones/tz-link.html>
  时区规则受政府变更影响，历史记录并非所有地区同等完整；因此必须记录 tzdb/ICU 版本。
- Temporal polyfill：<https://github.com/js-temporal/temporal-polyfill>
- lunar-typescript：<https://github.com/6tail/lunar-typescript>
- astronomia：<https://github.com/commenthol/astronomia>

## M2 验收门槛

- 1901–2100 的公农历转换 fixture 可复算，关键边界与 HKO 对照；在线服务不可用时测试仍通过。
- DST gap/overlap、历史时区、夏令时和跨日转换都有结构化状态，不依赖宿主操作系统默认时区。
- 真太阳时保留民用主结果，并输出经度修正、均时差、算法版本和不确定性。
- 同一 canonical 输入跨 Windows/Ubuntu、进程重启和对象键顺序变化产生相同 SHA-256。
- 所有 normalized 字段可由 raw input、规则版本、依赖版本和来源重新计算；失败不得留下半档案。
