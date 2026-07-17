# M1 验收记录

验收日期：2026-07-17 至 2026-07-18
验收结论：通过

## 自动化验证

- `pnpm check`：通过。
  - lint：通过。
  - typecheck：通过。
  - 工作区测试：3 个包共 20 个测试通过。
  - Next.js 生产构建：通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-windows-scripts.ps1`：通过。
- `git diff --check`：通过。
- GitHub Actions：提交 `bf96878` 的 Windows 与 Ubuntu 作业均通过。
  - <https://github.com/zhulongqihan/xuanshu-ai/actions/runs/29597606802>

## Windows 实测

在 `work/windows-acceptance-data` 隔离数据目录和 `work/windows-acceptance-shortcut` 隔离快捷方式目录中，用 Windows PowerShell 5.1 执行：

- 脚本语法检查：通过。
- 桌面快捷方式创建：通过，生成 `玄枢 AI.lnk`。
- 生产服务启动：通过。
- `GET http://127.0.0.1:3000/api/health` 返回 `status: ok`，数据库 `initialized: true`。
- TCP 监听地址：`127.0.0.1`。
- 验收结束后已停止测试服务。

## Playwright 浏览器验收

- 生产构建在 `1280 x 800` 桌面视口和 `390 x 844` 移动视口中完成真实浏览器检查。
- `/`、`/profiles`、`/charts`、`/almanac`、`/liuyao`、`/consult`、`/sources`、`/settings` 共 8 个页面均返回 HTTP 200，并具有正确页面标题。
- 两种视口下所有页面均满足 `scrollWidth === clientWidth`，未出现横向溢出。
- 桌面端显示侧栏并隐藏移动底栏；移动端隐藏侧栏并显示移动底栏。
- 从移动首页进入设置页的实际导航通过；浏览器控制台为 0 错误、0 警告。
- 首页桌面、首页移动、设置页移动截图均已人工检查，未发现文字重叠、裁切或不可读状态。

## 范围与剩余项

- 健康接口是本地就绪诊断，不会向模型端点发送请求；`model.configured` 只表示配置引用的环境变量是否存在。
- 测试产生的临时目录位于 Git 忽略的 `work/` 下，不属于交付数据。
- Playwright 截图位于 Git 忽略的 `output/playwright/`，仅作为本机验收证据，不包含在版本库中。
