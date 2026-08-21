# Windows 发布验收清单

更新日期：2026-08-22

当前状态：最新提交的隔离目录安装与运行验收已完成；另一台真实 Windows 机器的桌面快捷方式和升级验收仍待执行。

## 当前机器的隔离验收

已从最新提交 `46b85b9` 导出到仓库外的全新目录
`C:\Users\yang\AppData\Local\Temp\xuanshu-ai-clean-latest-20260822`，未复用仓库
`node_modules` 或本地数据库。结果：

- `pnpm install --frozen-lockfile` 成功；
- `pnpm check` 成功：lint、类型检查、Agent 23 项（真实模型 1 项默认跳过）、Domain 80 项、Web 38 项、生产构建；
- `pnpm --filter @xuanshu/web start` 成功；
- `/api/health` 返回 `status=ok`；
- `/`、`/almanac`、`/charts`、`/consult`、`/liuyao`、`/profiles`、`/settings`、`/sources`、`/ziwei` 均返回 200；
- `X-Powered-By` 不存在，CSP 和 `X-Frame-Options: DENY` 正常；
- 服务停止后 3000 端口释放。

这证明当前 Windows 用户环境下的干净目录安装与启动链路可用，但不等同于另一台全新机器验收。

## 另一台干净 Windows 机器的关闭步骤

1. 安装 Node.js 24+ 与 pnpm 10.20；
2. 获取仓库 `main`，确认提交与发布提交一致；
3. 执行 `pnpm install --frozen-lockfile`；
4. 执行 `pnpm check`；
5. 运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1`；
6. 从桌面快捷方式打开应用，确认只监听 `127.0.0.1`、健康检查成功、浏览器能打开工作台；
7. 创建测试档案，验证四术工作区、备份下载、恢复和清空；
8. 关闭应用并确认启动脚本留下的进程和 3000 端口均已清理；
9. 删除测试数据和测试备份，不把任何个人资料或密钥带入提交。

未完成以上另一台机器步骤前，发布状态只能写成“候选发布”，不能写成“已完成 Windows 发布验收”。
