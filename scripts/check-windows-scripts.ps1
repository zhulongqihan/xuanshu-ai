[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"
$scriptFiles = @(
    (Join-Path $PSScriptRoot "start-windows.ps1"),
    (Join-Path $PSScriptRoot "install-windows.ps1"),
    (Join-Path $PSScriptRoot "stop-windows.ps1")
)
$hasErrors = $false

foreach ($scriptFile in $scriptFiles) {
    $tokens = $null
    $errors = $null
    [System.Management.Automation.Language.Parser]::ParseFile(
        $scriptFile,
        [ref]$tokens,
        [ref]$errors
    ) | Out-Null

    if ($errors.Count -gt 0) {
        $hasErrors = $true
        foreach ($parseError in $errors) {
            Write-Error "${scriptFile}:$($parseError.Extent.StartLineNumber) $($parseError.Message)"
        }
    }
}

if ($hasErrors) {
    exit 1
}

Write-Output "Windows scripts parsed successfully."
