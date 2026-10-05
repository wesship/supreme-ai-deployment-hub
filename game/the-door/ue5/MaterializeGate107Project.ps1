$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$Artifact = Join-Path $Root "artifacts\DEVONN_AI_UE53_Gate107_CompilerHandoff_v6.zip"
$Expected = "d9178117d53dd5a65722a5ff7f18087272acc199c2d00b6eee395fe8e52ce655"
$ProjectDir = Join-Path $Root "project"
$Temp = Join-Path $env:RUNNER_TEMP "the-door-gate107-source"

if (!(Test-Path $Artifact)) { throw "Gate 107 source bundle missing: $Artifact" }
$Actual = (Get-FileHash $Artifact -Algorithm SHA256).Hash.ToLowerInvariant()
if ($Actual -ne $Expected) { throw "Gate 107 source bundle SHA-256 mismatch. Expected $Expected, got $Actual" }

if (Test-Path $Temp) { Remove-Item $Temp -Recurse -Force }
New-Item -ItemType Directory -Force -Path $Temp | Out-Null
Expand-Archive -Path $Artifact -DestinationPath $Temp -Force
$Extracted = Join-Path $Temp "DEVONN_AI_UE53_Milestone"
if (!(Test-Path (Join-Path $Extracted "DEVONN_AI.uproject"))) { throw "Extracted bundle missing DEVONN_AI.uproject" }

if (Test-Path $ProjectDir) { Remove-Item $ProjectDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $ProjectDir | Out-Null
Copy-Item (Join-Path $Extracted "*") $ProjectDir -Recurse -Force

Write-Host "Gate 107 project materialized at $ProjectDir"
Write-Host "Artifact SHA-256 verified: $Actual"
