# 玄枢 AI 上下文恢复摘要

更新时间：2026-07-17 23:15 +08:00

## 当前可信状态

- 仓库：`https://github.com/zhulongqihan/xuanshu-ai`
- 分支：`main`
- 本地与远端共同指向：`f7d0a3392ed6c16cb43d3be077257af7a8e8973e`
- 最近已完成并推送的里程碑：本地 SQLite 数据层、迁移与测试。
- 当前工作区没有已暂存内容，但存在一批同一时间写入的未提交改动，说明中断发生在 M1 收尾功能写入后、验证与提交前。

## 已完成里程碑

1. `39985aa`：建立项目协作原则。
2. `8524a7c`：确定架构与领域基线。
3. `7e60915`：确定产品与视觉方向。
4. `b6e2ca0`：建立本地 Web 应用壳。
5. `4a99031`：定义领域类型与模型配置契约。
6. `f7d0a33`：增加本地 SQLite 数据层。

## 中断中的工作

- `.github/workflows/ci.yml`：Windows 与 Ubuntu 双平台执行 `pnpm check`。
- `apps/web/src/app/api/health/route.ts`：本地服务健康接口。
- `scripts/install-windows.ps1`：安装桌面快捷方式。
- `scripts/start-windows.ps1`：安装依赖、按需构建、后台启动并打开浏览器。
- `scripts/check-windows-scripts.ps1`：PowerShell 脚本语法检查。
- `README.md`：Windows 桌面快捷方式使用说明。

## 已确认问题

1. 三个 PowerShell 脚本是 UTF-8 无 BOM，但入口和 CI 使用 Windows PowerShell 5.1；中文字符串会按本地代码页读取并导致解析失败。
2. `check-windows-scripts.ps1` 的 `"$scriptFile:$..."` 存在变量名与冒号歧义，脚本自身无法解析。
3. `/api/health` 尚无测试；其响应包含配置来源、API 模式和密钥是否存在等诊断元数据，需要控制在不泄露密钥值的范围内。
4. `docs/quality-and-roadmap.md` 的“当前下一步”落后于实际提交状态，需要在 M1 收尾后更新。
5. 尚未建立 Playwright 验收，不能宣称 M1 已完全关闭。

## 恢复后的精确行动

1. 修复 Windows PowerShell 5.1 兼容性与脚本语法检查。
2. 为健康接口增加测试，并确认启动器只把可用状态视为启动成功。
3. 运行 PowerShell 解析、`pnpm check`、生产启动和 `/api/health` 实测。
4. 更新 README 与路线图，使文档与实际状态一致。
5. 将本批 M1 收尾作为独立提交推送并确认远端同步。
6. 下一独立步骤增加 Playwright 桌面端与移动端验收；完成后关闭 M1，进入 M2 历法基座与人物档案。

## 不应沿用的旧事实

- “模型配置和 SQLite 尚未完成”已经过时；两者均已在 `f7d0a33` 之前完成并推送。
- “仍有断点检查命令运行中”已经失效；恢复时没有附着的终端会话，只能以 Git 与文件时间戳重建状态。
