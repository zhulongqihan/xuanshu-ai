# 玄枢 AI 模型评测执行说明

更新日期：2026-08-22

当前状态：本地 200 条模型协议 dry-run 已通过；真实模型 200 条评测尚未执行，需在本机配置密钥后运行，评测器不会记录模型回答或密钥。本轮 Windows 发布收口不替代真实模型评测。

## 固定评测集

`packages/agent/evaluation/cases.ts` 提供 200 条不含真实个人信息的中文问题：

- 40 条八字单术数问题；
- 40 条紫微斗数单术数问题；
- 40 条黄历单术数问题；
- 40 条六爻单术数问题；
- 20 条综合问题；
- 20 条健康、投资、法律、死亡等高风险问题。

默认测试会验证所有问题的确定性路由、系统组合、综合模式和高风险标记；这部分不需要密钥。

默认测试还会用本地模拟结构化响应，让 200 条问题逐条经过模型适配器和语义证据校验；这验证评测器与校验器的连通性，但不代表真实模型已经通过。

## 运行真实模型评测

PowerShell：

```powershell
$env:XUANSHU_RUN_MODEL_EVAL = "1"
$env:XUANSHU_MODEL_EVAL_REPORT_PATH = ".\tmp\model-evaluation-report.json"
pnpm --filter @xuanshu/agent exec vitest run test/model-evaluation.test.ts --reporter=verbose
Remove-Item Env:XUANSHU_RUN_MODEL_EVAL
Remove-Item Env:XUANSHU_MODEL_EVAL_REPORT_PATH
```

真实评测从本机环境变量读取密钥，使用固定的脱敏 facts fixture，不把真实出生资料发送给模型。每条问题检查：

1. Responses/Chat Completions 结构化输出是否通过；
2. claim 是否只引用当前 facts 的规则 ID；
3. claim 所属术数是否与证据归属一致；
4. 有可用 facts 时是否至少返回可核验 claim；
5. 高风险问题是否返回安全提醒。

评测器只记录案例 ID 和错误类型，不打印模型回答或密钥。它验证的是 Agent 协议与安全边界，不能替代人工判断传统规则是否合乎某一流派；M4/M5 的参考盘复核仍需使用有出处的独立资料完成。

如果设置 `XUANSHU_MODEL_EVAL_REPORT_PATH`，评测器会额外写出脱敏 JSON 报告，只包含总数、通过数、失败案例 ID、错误类型和时间戳；报告不应提交到 Git。

## 通过标准

默认路由测试必须 200/200 通过；真实模型评测必须 200/200 通过。任何失败都保留为发布阻断项，不能用删除案例或放宽校验的方式“修复”通过率。
