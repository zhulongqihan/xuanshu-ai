[CmdletBinding(SupportsShouldProcess)]
param()

$ErrorActionPreference = "Stop"
$listener = Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
    Where-Object { $_.LocalAddress -eq "127.0.0.1" } |
    Select-Object -First 1

if (-not $listener) {
    Write-Output "未发现监听 127.0.0.1:3000 的玄枢 AI 服务。"
    return
}

$process = Get-CimInstance Win32_Process -Filter "ProcessId = $($listener.OwningProcess)"
$commandLine = [string]$process.CommandLine
if ($commandLine -notmatch "(?i)standalone[\\/]+apps[\\/]+web[\\/]server\.js") {
    throw "拒绝停止端口 3000 的未知进程（PID $($listener.OwningProcess)）。请先人工确认，避免误停其他本地服务。"
}

if ($PSCmdlet.ShouldProcess("PID $($listener.OwningProcess) 及其子进程", "停止玄枢 AI")) {
    & taskkill.exe /PID $listener.OwningProcess /T /F | Out-Null
    Start-Sleep -Seconds 1
    if (Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue) {
        throw "玄枢 AI 进程已请求停止，但端口 3000 仍在监听。"
    }
    Write-Output "玄枢 AI 已停止，端口 3000 已释放。"
}
