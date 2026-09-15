$ErrorActionPreference = "Stop"

$Here = Split-Path -Parent $MyInvocation.MyCommand.Path
$UeRoot = Split-Path -Parent $Here
$Project = Join-Path $UeRoot "project"
$Target = Join-Path $Project "Source\DEVONN_AI"
$Source = Join-Path $Here "Source\DEVONN_AI"

if (!(Test-Path (Join-Path $Project "DEVONN_AI.uproject"))) {
    throw "Materialized Gate 107 project not found at $Project. Run MaterializeGate107Project.ps1 first."
}
if (!(Test-Path $Target)) {
    throw "DEVONN_AI source target not found at $Target"
}

$Files = @(
    "DoorWorldTypes.h",
    "GodEyeLocationSubsystem.h",
    "GodEyeLocationSubsystem.cpp",
    "GeoLibreWorldForgeSubsystem.h",
    "GeoLibreWorldForgeSubsystem.cpp",
    "AdinkraSymbolTypes.h",
    "AdinkraSymbolSubsystem.h",
    "AdinkraSymbolSubsystem.cpp",
    "WorldForgeAutomationTests.cpp"
)

foreach ($File in $Files) {
    $From = Join-Path $Source $File
    if (!(Test-Path $From)) { throw "World Forge overlay file missing: $From" }
    Copy-Item $From (Join-Path $Target $File) -Force
    Write-Host "Applied $File"
}

Write-Host "WORLD_FORGE_OVERLAY=APPLIED"
