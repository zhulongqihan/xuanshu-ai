# 玄枢 AI 安全审查记录

审查日期：2026-08-21
审查范围：Next.js 16.3.2 / React 19 / TypeScript，本地 Web、Server Actions、备份接口、模型适配层、Windows 启动器。
结论：代码侧未发现已确认的高危 XSS、动态执行、密钥泄露或 SQL 注入；已补齐基础响应头。应用的安全前提是默认只监听本机回环地址，尚未设计公网多用户认证。

## 已修复或通过验证

### SEC-01：基础浏览器安全响应头

- 严重性：Medium，已修复。
- 位置：[apps/web/next.config.ts](../apps/web/next.config.ts):7-17。
- 证据：统一返回 `Content-Security-Policy: frame-ancestors 'none'; base-uri 'self'; form-action 'self'`、`X-Frame-Options: DENY`、`X-Content-Type-Options: nosniff`、`Referrer-Policy: no-referrer` 和限制摄像头/麦克风/地理位置的 `Permissions-Policy`。
- 验证：`apps/web/test/security-headers.test.ts`；生产服务访问 `/settings` 返回上述全部响应头，并且不返回 `X-Powered-By`。
- 说明：CSP 当前是点击劫持、基址和表单来源的安全基线，不包含完整的 `script-src` nonce 策略；若未来公开部署或引入第三方脚本，需要单独设计严格 CSP。

### SEC-02：密钥只在服务端解析

- 严重性：High，已通过验证。
- 位置：[packages/agent/src/config.ts](../packages/agent/src/config.ts):69-75；[packages/agent/src/consult.ts](../packages/agent/src/consult.ts):149-170。
- 证据：API 密钥只从配置指定的环境变量读取，请求体和响应均强制 `store: false`；前端没有 `NEXT_PUBLIC_*` 密钥读取，也没有把环境变量渲染到页面。
- 验证：Agent 配置测试、模型适配测试、源码扫描均通过。

### SEC-03：备份输入和敏感数据下载边界

- 严重性：Medium，已通过验证。
- 位置：[apps/web/src/app/settings/actions.ts](../apps/web/src/app/settings/actions.ts):17-43；[apps/web/src/server/data/core.ts](../apps/web/src/server/data/core.ts):6-107；[apps/web/src/app/api/backup/route.ts](../apps/web/src/app/api/backup/route.ts):5-21。
- 证据：上传文件限制为 10 MB；备份版本、表名、字段集合和值类型均运行时校验；恢复在清空与插入事务中完成；下载响应使用 `no-store` 和附件头；未来版本拒绝恢复且不触碰现有数据。
- 验证：数据备份测试覆盖完整恢复、非法字段、未来 schema 版本；接口返回 200、JSON、附件文件名和 schemaVersion 1。

### SEC-04：前端危险 API 扫描

- 严重性：High，未发现问题。
- 证据：源码扫描未发现 `dangerouslySetInnerHTML`、`innerHTML`、`outerHTML`、`insertAdjacentHTML`、`document.write`、`eval`、`new Function`、`postMessage`、`localStorage` 或 `sessionStorage` 使用。
- 说明：React 默认文本渲染和 Server Actions 仍需保持，不应为展示用户内容引入 HTML 字符串拼接。

### SEC-05：数据库注入与路径边界

- 严重性：High，未发现问题。
- 证据：[apps/web/src/server/data/core.ts](../apps/web/src/server/data/core.ts):22-29 的表名和列名来自固定常量，不来自用户输入；备份字段通过白名单校验后才进入参数化 `INSERT` 值位。

## 已接受的本地模式边界

### SEC-06：无认证的本地接口

- 严重性：High（仅当服务被暴露到局域网/公网时），当前本地模式接受。
- 位置：[apps/web/package.json](../apps/web/package.json):8；[scripts/start-windows.ps1](../scripts/start-windows.ps1):10-11。
- 证据：生产启动固定使用 `HOSTNAME=127.0.0.1`、`PORT=3000`；健康检查和备份接口只面向本机工作台。Server Actions 依赖 Next.js 自带的同源/Origin 保护，不关闭或放宽允许来源。
- 风险：用户若手工改为 `0.0.0.0` 或放到反向代理后，任何能访问该地址的用户都可能读取备份或触发清空。
- 处置：发布说明必须保持回环监听；若未来做公网或多用户版，必须先加入认证、授权、CSRF/Origin allowlist、速率限制和反向代理，再开放接口。

## 发布前仍需外部证据

- 官方 registry 的 `pnpm audit --prod --registry=https://registry.npmjs.org/` 已通过，结果为 `No known vulnerabilities found`；仓库默认镜像不提供 audit endpoint，不能用默认源替代该结果。
- 真实模型配置下验证超时、429/5xx、结构化输出失败和中转站留存策略。
- 干净 Windows 环境验证首次依赖安装、升级和桌面快捷方式启动。

## 审查门槛

- 不提交密钥、用户出生资料或本地数据库文件。
- 不把回环本地模式宣传为可直接公网部署。
- 每次修改 Server Action、备份格式、模型请求或启动监听地址后重新执行本审查关键项。
