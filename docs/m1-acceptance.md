# M1 验收记录

验收日期：2026-07-17

## 自动化验证

- `pnpm check`：通过。
  - lint：通过。
  - typecheck：通过。
  - 工作区测试：3 个包共 20 个测试通过。
  - Next.js 生产构建：通过。
- `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\check-windows-scripts.ps1`：通过。
- `git diff --check`：通过。

## Windows 实测

在 `work/windows-acceptance-data` 隔离数据目录和 `work/windows-acceptance-shortcut` 隔离快捷方式目录中，用 Windows PowerShell 5.1 执行：

- 脚本语法检查：通过。
- 桌面快捷方式创建：通过，生成 `玄枢 AI.lnk`。
- 生产服务启动：通过。
- `GET http://127.0.0.1:3000/api/health` 返回 `status: ok`，数据库 `initialized: true`。
- TCP 监听地址：`127.0.0.1`。
- 验收结束后已停止测试服务。

## 范围与剩余项

- 健康接口是本地就绪诊断，不会向模型端点发送请求；`model.configured` 只表示配置引用的环境变量是否存在。
- 本次未覆盖桌面端与移动端浏览器交互，因此 M1 仍需 Playwright 验收后才能正式关闭。
- 测试产生的临时目录位于 Git 忽略的 `work/` 下，不属于交付数据。
