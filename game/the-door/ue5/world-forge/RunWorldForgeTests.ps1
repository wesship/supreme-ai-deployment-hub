$ErrorActionPreference = "Stop"

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$UeRoot = Split-Path -Parent $Here
$Project = Join-Path $UeRoot "project\DEVONN_AI.uproject"
$EditorCmd = Join-Path $env:UE_ROOT "Engine\Binaries\Win64\UnrealEditor-Cmd.exe"
$Evidence = Join-Path $UeRoot "project\Evidence\WorldForge"
New-Item -ItemType Directory -Force -Path $Evidence | Out-Null
$Stamp = Get-Date -Format "yyyyMMdd_HHmmss"
$Log = Join-Path $Evidence "WorldForge_$Stamp.log"

if (!(Test-Path $Project)) { throw "Project not found: $Project" }
if (!(Test-Path $EditorCmd)) { throw "UnrealEditor-Cmd.exe not found: $EditorCmd" }

& $EditorCmd $Project -unattended -nop4 -nosplash -NullRHI `
    '-ExecCmds=Automation RunTests TheDoor.WorldForge; Quit' `
    '-TestExit=Automation Test Queue Empty' 2>&1 | Tee-Object -FilePath $Log

if ($LASTEXITCODE -ne 0) {
    throw "World Forge automation tests failed with exit code $LASTEXITCODE"
}

Write-Host "WORLD_FORGE_AUTOMATION=PASS"
Write-Host "Evidence: $Log"
