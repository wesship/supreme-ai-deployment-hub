$ErrorActionPreference = "Stop"

param(
    [string]$UERoot = "C:\Program Files\Epic Games\UE_5.3"
)

Write-Host "Gate 107 runner readiness check"
Write-Host "UE_ROOT=$UERoot"

$Required = @(
    (Join-Path $UERoot 'Engine\Build\BatchFiles\Build.bat'),
    (Join-Path $UERoot 'Engine\Binaries\Win64\UnrealEditor-Cmd.exe')
)

$Missing = @()
foreach ($Path in $Required) {
    if (!(Test-Path $Path)) { $Missing += $Path }
}

$Git = Get-Command git -ErrorAction SilentlyContinue
$Pwsh = Get-Command powershell -ErrorAction SilentlyContinue

if (!$Git) { $Missing += 'git.exe not found in PATH' }
if (!$Pwsh) { $Missing += 'powershell.exe not found in PATH' }

if ($Missing.Count -gt 0) {
    Write-Host "RUNNER_READY=NO"
    $Missing | ForEach-Object { Write-Host "MISSING: $_" }
    exit 1
}

Write-Host "RUNNER_READY=YES"
Write-Host "Required GitHub runner labels: self-hosted, Windows, X64, ue5-3"
Write-Host "Do not store the GitHub runner registration token in this repository."
Write-Host "Configure the runner from GitHub Settings > Actions > Runners, then add the ue5-3 custom label."
exit 0
