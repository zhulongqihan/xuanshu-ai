[CmdletBinding()]
param(
    [string]$DestinationDirectory = [Environment]::GetFolderPath("Desktop")
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$launcher = Join-Path $PSScriptRoot "start-windows.ps1"
$powershell = (Get-Process -Id $PID).Path

if (-not (Test-Path -LiteralPath $launcher)) {
    throw "未找到启动脚本：$launcher"
}

if (-not (Test-Path -LiteralPath $powershell)) {
    throw "未找到当前 PowerShell 可执行文件：$powershell"
}

New-Item -ItemType Directory -Path $DestinationDirectory -Force | Out-Null
$shortcutPath = Join-Path $DestinationDirectory "玄枢 AI.lnk"
$shell = New-Object -ComObject WScript.Shell
$shortcut = $shell.CreateShortcut($shortcutPath)
$shortcut.TargetPath = $powershell
$shortcut.Arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$launcher`""
$shortcut.WorkingDirectory = $repoRoot
$shortcut.IconLocation = "$powershell,0"
$shortcut.Description = "启动本地玄枢 AI 工作台"
$shortcut.Save()

Write-Output $shortcutPath
