# Windows 发布验收清单

更新日期：2026-08-22

当前状态：隔离目录安装与运行基线验收已完成，并在后续提交上补做了生产服务浏览器链路验收；来源注册、参考案例计数和真实模型评测启动器独立维护，另一台真实 Windows 机器的桌面快捷方式和升级验收仍待执行。阶段总状态以[质量基线与路线图](./quality-and-roadmap.md)为准。

## 当前机器的隔离验收

已从提交 `46b85b9` 导出到仓库外的全新目录
`C:\Users\yang\AppData\Local\Temp\xuanshu-ai-clean-latest-20260822`，未复用仓库
`node_modules` 或本地数据库。结果：

- `pnpm install --frozen-lockfile` 成功；
- `pnpm check` 成功：lint、类型检查、Agent 23 项（真实模型 1 项默认跳过）、Domain 80 项、Web 38 项、生产构建；
- `pnpm --filter @xuanshu/web start` 成功；
- `scripts/install-windows.ps1` 在隔离目标目录成功创建快捷方式，目标、参数和工作目录均指向该提交的启动脚本与仓库；
- `scripts/start-windows.ps1 -NoBrowser` 使用专用 `XUANSHU_AI_DATA_DIR` 成功启动，日志目录和数据库目录已创建；
- `scripts/stop-windows.ps1` 会校验端口进程命令行，只停止玄枢生产服务；隔离验收中已验证停止后端口释放；
- `/api/health` 返回 `status=ok`；
- `/`、`/almanac`、`/charts`、`/consult`、`/liuyao`、`/profiles`、`/settings`、`/sources`、`/ziwei` 均返回 200；
- 监听地址确认为 `127.0.0.1:3000`；
- `X-Powered-By` 不存在，CSP 和 `X-Frame-Options: DENY` 正常；
- 服务停止后 3000 端口释放。

这证明当前 Windows 用户环境下的干净目录安装与启动链路可用，但不等同于另一台全新机器验收。

## 后续提交的生产服务浏览器验收

在首页状态修复提交 `f3a3ce5` 上，使用仓库外独立本地数据目录完成了生产服务的人工浏览器链路验收：

- 创建档案后，八字、紫微、黄历和六爻页面均能展示对应事实、盘面/卦面和证据；
- 六爻自动起卦保存了 18 次原始掷币记录，并可在页面复盘；
- 未配置模型密钥时，咨询页显示可操作的配置提示，不误报模型可用；
- 备份下载、清空、上传恢复后，档案和关联记录均可恢复；
- 首页显示四类规则引擎已接入及规则版本，离线历法显示为已就绪；
- 验收使用的是临时测试数据目录，未写入仓库，也未使用真实出生资料或模型密钥。

这部分是当前提交的人工浏览器证据，但仍不替代另一台真实 Windows 机器的安装、升级和桌面快捷方式验收。

## 另一台干净 Windows 机器的关闭步骤

1. 安装 Node.js 24+ 与 pnpm 10.20；
2. 获取仓库 `main`，确认提交与发布提交一致；
3. 执行 `pnpm install --frozen-lockfile`；
4. 执行 `pnpm check`；
5. 运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\install-windows.ps1`；
6. 从桌面快捷方式打开应用，确认只监听 `127.0.0.1`、健康检查成功、浏览器能打开工作台；
7. 创建测试档案，验证四术工作区、备份下载、恢复和清空；
8. 运行 `powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\stop-windows.ps1`，确认启动脚本留下的进程和 3000 端口均已清理；
9. 删除测试数据和测试备份，不把任何个人资料或密钥带入提交。

未完成以上另一台机器步骤前，发布状态只能写成“候选发布”，不能写成“已完成 Windows 发布验收”。
