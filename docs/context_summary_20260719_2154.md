# 玄枢 AI 上下文恢复摘要

更新时间：2026-07-19 21:54 +08:00

## 当前权威状态

- 状态事实源依次为：Git 历史、当前工作树、阶段文档；旧聊天摘要仅用于定位线索。
- 仓库：`https://github.com/zhulongqihan/xuanshu-ai`
- 分支：`main`
- 本地与远程均停在 `91f6f6d feat: add astronomical birth normalization`。
- M0、M1 已完成；M2 的历法输入契约、日期与民用时归一化、天文出生时间归一化已提交并推送。
- 本摘要取代 `docs/context_summary_20260718_0057.md` 中关于提交位置和 M2 下一步的旧状态。

## 当前未提交里程碑

工作树正在实现 M2 的人物档案持久化，内容包括：

- 新增不可变的 `profile_birth_records`，保存 raw、canonical、normalized、输入哈希、版本、依赖、来源和警告。
- `chart_snapshots` 增加可选 `birth_record_id`，旧数据迁移时保持为 `NULL`。
- 删除人物档案时级联删除出生记录、命盘、咨询、消息和关联六爻记录。
- 新增从 M1 已有数据库升级的 Drizzle 迁移及元数据。
- 新增人物档案 repository，支持创建、列表、读取、删除，并在读取时复核 schema、normalizer 版本和 SHA-256。
- 新增迁移保留、事务原子性、删除、SQLite 约束和篡改检测测试。
- 同步更新架构文档及 web 对 domain 工作区包的直接依赖。

## 已知验证状态

- 中断前曾记录 `pnpm check` 全量通过：domain 32 项、web 15 项、agent 5 项，Next.js 构建通过。
- 恢复后已确认 `git diff --check` 通过。
- 提交前仍须在当前工作树重新运行 `pnpm check`，不能只依赖中断前记录。

## 开放工作与精确下一步

1. 审查人物档案持久化完整差异，确认迁移和 repository 没有数据完整性缺口。
2. 重新运行全量 `pnpm check`。
3. 将该可验证里程碑提交到 `main`，推送并确认 `origin/main` 指向新提交。
4. 阅读当前 Next.js 本地文档与既有页面结构，设计人物档案桌面/移动端的最小纵向交互。
5. 实现档案列表、创建 Server Action、字段校验、加载/空/错误状态、删除确认与响应式体验。
6. 运行单元、构建及 Playwright 桌面/移动验收；完成后独立提交并推送。

## 未决事项与影响

- 当前没有阻断持久化提交的已知问题。
- 人物档案 UI 尚未实现，`/profiles` 仍是空状态页；在 UI 里程碑完成前，repository 只能由服务端代码和测试使用。
- 出生资料 revision 更新能力尚未暴露；当前里程碑只承诺创建、读取和彻底删除。
