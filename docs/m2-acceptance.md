# M2 验收记录

验收日期：2026-07-22
验收结论：通过

## 交付范围

- 版本化 `RawBirthInput`、`CanonicalBirthInput` 与 `NormalizedBirth` 契约，明确公农历、
  时间精度、IANA 时区、经纬度、真太阳时模式、候选时刻和结构化警告。
- 1901-01-01 至 2100-12-31 的香港天文台离线公农历转换表，覆盖 73,049 个连续公历日，
  支持双向转换且运行时不联网。
- 基于 Temporal 的民用时间解析，DST 缺口返回 `nonexistent`，DST 重叠保留两个 fold；
  未知出生时间不生成唯一 UTC 时刻。
- 基于高精度 VSOP87 路径的节气候选、经度修正与均时差，民用时间始终保留为主结果。
- 本地人物档案创建、列表和彻底删除流程；不可变出生记录保存 raw、canonical、normalized、
  SHA-256、版本、依赖、来源、警告和运行时指纹。

## 确定性与来源验证

- HKO 夹具固定 200 个年度文本来源的 SHA-256、派生 CSV 哈希和 2069 年唯一 PDF 补丁证据。
- 全量测试逐日验证 73,049 个日期的公历转农历与农历转公历，并覆盖闰月、首尾边界和
  不存在日期。
- `.gitattributes` 强制权威 CSV 使用 LF；Windows 与 Ubuntu checkout 读取相同字节和哈希。
- RFC 8785 输入序列化固定黄金 SHA-256：
  `5d914b2501adeb22a5b7a875ffc02627f1cdd9be14716bcf00b18744d9636bb4`。
- 锁文件与归一化追踪共同固定 Temporal、astronomia 和 canonicalize 的版本及 integrity。

## 自动化验证

- `pnpm check`：通过。
  - lint、全部工作区类型检查：通过。
  - domain 34 项、web 21 项、agent 5 项，共 60 项测试通过。
  - Next.js 生产构建：通过。
- `pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-windows-scripts.ps1`：通过。
- GitHub Actions：提交 `2033058` 的 Windows 与 Ubuntu 作业均通过。
  - <https://github.com/zhulongqihan/xuanshu-ai/actions/runs/29845412634>

## 真实浏览器验收

使用隔离数据目录和生产构建在 `1280 x 800`、`390 x 844` 两种视口完成：

- 从空状态打开表单，创建公历、精确时间、已确认时区并启用真太阳时比较的人物档案。
- 保存后列表显示日期、时间、地点、IANA 时区和真太阳时并列状态；服务重启后记录仍存在。
- 删除操作必须二次确认，确认后关联档案消失并回到空状态。
- 两种视口均满足 `scrollWidth === clientWidth`；无横向溢出、文字重叠或裁切。
- 生产页面控制台为 0 错误、0 警告，健康接口返回数据库已初始化。

验收截图保存在 Git 忽略的 `output/playwright/`，隔离数据库位于 Git 忽略的 `work/`，均不含
真实个人资料。

## 已知边界

- HKO 正式数据止于 2100-12-31，范围外转换明确返回 `unsupported_range`。
- 2100 年终端农历月长度使用已记录的交叉验证值；该假设在历法决策文档中单独披露。
- 人物档案本阶段支持创建、读取和彻底删除；出生资料 revision 编辑界面留待需要修改档案时实现。
- M2 只负责可靠输入和归一化，不生成八字、紫微、黄历或六爻结论。
