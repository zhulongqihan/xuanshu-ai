[CmdletBinding()]
param(
    [string]$ReportPath = ""
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$pnpm = Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue
if (-not $pnpm) {
    throw "未找到 pnpm.cmd。请先安装 Node.js 24 和 pnpm 10.20。"
}
if ([string]::IsNullOrWhiteSpace($env:XUANSHU_AI_API_KEY)) {
    throw "未检测到 XUANSHU_AI_API_KEY。请只在本机环境变量中配置密钥，不要把密钥写入仓库或发送到聊天。"
}

if ([string]::IsNullOrWhiteSpace($ReportPath)) {
    $ReportPath = Join-Path $repoRoot "tmp\model-evaluation-report.json"
} elseif (-not [System.IO.Path]::IsPathRooted($ReportPath)) {
    $ReportPath = Join-Path $repoRoot $ReportPath
}

$reportDirectory = Split-Path -Parent $ReportPath
New-Item -ItemType Directory -Force -Path $reportDirectory | Out-Null
$previousRun = $env:XUANSHU_RUN_MODEL_EVAL
$previousReport = $env:XUANSHU_MODEL_EVAL_REPORT_PATH

Push-Location $repoRoot
try {
    $env:XUANSHU_RUN_MODEL_EVAL = "1"
    $env:XUANSHU_MODEL_EVAL_REPORT_PATH = $ReportPath
    & $pnpm.Source --filter @xuanshu/agent exec vitest run test/model-evaluation.test.ts --reporter=verbose
    if ($LASTEXITCODE -ne 0) {
        throw "真实模型评测未通过，退出码：$LASTEXITCODE。请查看上方脱敏错误类型和报告。"
    }
    Write-Output "真实模型评测通过，脱敏报告：$ReportPath"
} finally {
    Pop-Location
    if ($null -eq $previousRun) {
        Remove-Item Env:XUANSHU_RUN_MODEL_EVAL -ErrorAction SilentlyContinue
    } else {
        $env:XUANSHU_RUN_MODEL_EVAL = $previousRun
    }
    if ($null -eq $previousReport) {
        Remove-Item Env:XUANSHU_MODEL_EVAL_REPORT_PATH -ErrorAction SilentlyContinue
    } else {
        $env:XUANSHU_MODEL_EVAL_REPORT_PATH = $previousReport
    }
}
