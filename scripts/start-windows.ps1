[CmdletBinding()]
param(
    [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$appRoot = Join-Path $repoRoot "apps\web"
$serverFile = Join-Path $appRoot ".next\standalone\apps\web\server.js"
$healthUrl = "http://127.0.0.1:3000/api/health"
$appUrl = "http://127.0.0.1:3000"
$dataRoot = if ($env:XUANSHU_AI_DATA_DIR) {
    $env:XUANSHU_AI_DATA_DIR
} elseif ($env:LOCALAPPDATA) {
    Join-Path $env:LOCALAPPDATA "XuanshuAI"
} else {
    Join-Path $env:USERPROFILE ".xuanshu-ai"
}
$logRoot = Join-Path $dataRoot "logs"

function Test-XuanshuServer {
    try {
        $health = Invoke-RestMethod -UseBasicParsing -Uri $healthUrl -TimeoutSec 2
        return ($health.service -eq "xuanshu-ai") -and ($health.status -eq "ok")
    } catch {
        return $false
    }
}

function Test-BuildStale {
    if (-not (Test-Path -LiteralPath $serverFile)) {
        return $true
    }

    $buildTime = (Get-Item -LiteralPath $serverFile).LastWriteTimeUtc
    $sourceRoots = @(
        (Join-Path $appRoot "src"),
        (Join-Path $appRoot "scripts"),
        (Join-Path $repoRoot "packages")
    )
    $latestSource = Get-ChildItem -LiteralPath $sourceRoots -Recurse -File |
        Sort-Object LastWriteTimeUtc -Descending |
        Select-Object -First 1
    $manifestInputs = @(
        (Join-Path $repoRoot "package.json"),
        (Join-Path $repoRoot "pnpm-lock.yaml"),
        (Join-Path $appRoot "package.json"),
        (Join-Path $appRoot "next.config.ts")
    ) | Where-Object { Test-Path -LiteralPath $_ } | ForEach-Object {
        Get-Item -LiteralPath $_
    } | Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1

    return ($latestSource.LastWriteTimeUtc -gt $buildTime) -or
        ($manifestInputs.LastWriteTimeUtc -gt $buildTime)
}

if (Test-XuanshuServer) {
    if (-not $NoBrowser) {
        Start-Process -FilePath $appUrl
    }
    return
}

$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue
if ($listener) {
    throw "端口 3000 已被其他程序占用，玄枢 AI 无法启动。"
}

$pnpm = Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue
if (-not $pnpm) {
    throw "未找到 pnpm。请先安装 Node.js 24 和 pnpm 10.20。"
}

Push-Location $repoRoot
try {
    if (Test-BuildStale) {
        & $pnpm.Source install --frozen-lockfile
        if ($LASTEXITCODE -ne 0) {
            throw "依赖安装失败。"
        }
        & $pnpm.Source build
        if ($LASTEXITCODE -ne 0) {
            throw "生产构建失败。"
        }
    }

    New-Item -ItemType Directory -Path $logRoot -Force | Out-Null
    $stdoutLog = Join-Path $logRoot "server.stdout.log"
    $stderrLog = Join-Path $logRoot "server.stderr.log"
    $serverProcess = Start-Process `
        -FilePath $pnpm.Source `
        -ArgumentList @("start") `
        -WorkingDirectory $repoRoot `
        -WindowStyle Hidden `
        -RedirectStandardOutput $stdoutLog `
        -RedirectStandardError $stderrLog `
        -PassThru

    for ($attempt = 0; $attempt -lt 60; $attempt++) {
        if (Test-XuanshuServer) {
            if (-not $NoBrowser) {
                Start-Process -FilePath $appUrl
            }
            return
        }
        if ($serverProcess.HasExited) {
            $details = if (Test-Path -LiteralPath $stderrLog) {
                Get-Content -Raw -LiteralPath $stderrLog
            } else {
                "无错误日志"
            }
            throw "玄枢 AI 服务启动失败：$details"
        }
        Start-Sleep -Milliseconds 500
    }

    throw "玄枢 AI 服务在 30 秒内未通过健康检查。"
} finally {
    Pop-Location
}
