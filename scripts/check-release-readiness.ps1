[CmdletBinding()]
param(
    [string]$ReferenceCasesPath = "",
    [switch]$SecondWindowsVerified,
    [switch]$DeferExternalGates
)

$ErrorActionPreference = "Continue"
$repoRoot = Split-Path -Parent $PSScriptRoot
$pnpm = Get-Command "pnpm.cmd" -ErrorAction SilentlyContinue
$results = [ordered]@{
    quality = "未执行"
    model = "未执行"
    referenceCases = "未执行"
    secondWindows = "待在另一台真实 Windows 或干净虚拟机完成安装、升级、启动、验收和清理"
}
$hasBlockingResult = $false

function Set-Result {
    param(
        [string]$Name,
        [string]$Value,
        [bool]$Blocking = $false
    )
    $script:results[$Name] = $Value
    if ($Blocking) {
        $script:hasBlockingResult = $true
    }
}

function Invoke-Pnpm {
    param([string[]]$Arguments)
    Push-Location $repoRoot
    try {
        & $pnpm.Source @Arguments
        return ($LASTEXITCODE -eq 0)
    } finally {
        Pop-Location
    }
}

if ($DeferExternalGates) {
    Set-Result -Name model -Value "已按本轮范围决策暂缓（未通过）"
    Set-Result -Name referenceCases -Value "已按本轮范围决策暂缓（未通过）"
    Set-Result -Name secondWindows -Value "已按本轮范围决策暂缓（未通过）"
} elseif ($SecondWindowsVerified) {
    Set-Result -Name secondWindows -Value "已由操作者确认：另一台 Windows 验收清单已完成"
} else {
    Set-Result -Name secondWindows -Value "阻断：尚未完成另一台 Windows 或干净虚拟机验收" -Blocking $true
}

if (-not $pnpm) {
    Set-Result -Name quality -Value "阻断：未找到 pnpm.cmd" -Blocking $true
    Set-Result -Name model -Value "阻断：无法运行评测" -Blocking $true
} else {
    $listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if ($listener) {
        Set-Result -Name quality -Value "阻断：端口 3000 正在使用，请先停止本地服务" -Blocking $true
    } elseif (Invoke-Pnpm -Arguments @("check")) {
        Set-Result -Name quality -Value "通过：lint、类型、测试和生产构建"
    } else {
        Set-Result -Name quality -Value "失败：pnpm check" -Blocking $true
    }

    if (-not $DeferExternalGates) {
        if ([string]::IsNullOrWhiteSpace($env:XUANSHU_AI_API_KEY)) {
            Set-Result -Name model -Value "待配置：本机未设置 XUANSHU_AI_API_KEY" -Blocking $true
        } else {
            $modelScript = Join-Path $repoRoot "scripts\run-model-evaluation.ps1"
            try {
                & $modelScript
                if ($LASTEXITCODE -eq 0) {
                    Set-Result -Name model -Value "通过：真实模型 200 条评测"
                } else {
                    Set-Result -Name model -Value "失败：真实模型评测退出码 $LASTEXITCODE" -Blocking $true
                }
            } catch {
                Set-Result -Name model -Value "失败：真实模型评测异常" -Blocking $true
            }
        }

        if ([string]::IsNullOrWhiteSpace($ReferenceCasesPath)) {
            $ReferenceCasesPath = $env:XUANSHU_REFERENCE_CASES_PATH
        }
        if ([string]::IsNullOrWhiteSpace($ReferenceCasesPath)) {
            Set-Result -Name referenceCases -Value "待提供：脱敏参考案例 JSON（紫微/六爻各至少 100 条）" -Blocking $true
        } elseif (-not (Test-Path -LiteralPath $ReferenceCasesPath -PathType Leaf)) {
            Set-Result -Name referenceCases -Value "失败：参考案例文件不存在" -Blocking $true
        } else {
            $previousReferencePath = $env:XUANSHU_REFERENCE_CASES_PATH
            try {
                $env:XUANSHU_REFERENCE_CASES_PATH = (Resolve-Path -LiteralPath $ReferenceCasesPath).Path
                $gatePassed = Invoke-Pnpm -Arguments @("--filter", "@xuanshu/domain", "exec", "vitest", "run", "test/reference-case-gate.test.ts", "--reporter=verbose")
                if ($gatePassed) {
                    Set-Result -Name referenceCases -Value "通过：紫微/六爻参考案例闸门"
                } else {
                    Set-Result -Name referenceCases -Value "失败：参考案例闸门未通过" -Blocking $true
                }
            } finally {
                if ($null -eq $previousReferencePath) {
                    Remove-Item Env:XUANSHU_REFERENCE_CASES_PATH -ErrorAction SilentlyContinue
                } else {
                    $env:XUANSHU_REFERENCE_CASES_PATH = $previousReferencePath
                }
            }
        }
    }
}

Write-Output "玄枢 AI 发布就绪检查"
Write-Output "=================="
foreach ($entry in $results.GetEnumerator()) {
    Write-Output ("{0}: {1}" -f $entry.Key, $entry.Value)
}
if ($hasBlockingResult) {
    Write-Output "结论：仍有发布阻断项，不能宣称最终完成。"
    exit 1
}

if ($DeferExternalGates) {
    Write-Output "结论：工程质量检查通过；三项外部证据按本轮范围决策暂缓，未通过。当前仅可称为首版候选发布。"
    exit 0
}

Write-Output "结论：所有自动化发布闸门通过，且已收到第二台 Windows 的人工确认。"
exit 0
