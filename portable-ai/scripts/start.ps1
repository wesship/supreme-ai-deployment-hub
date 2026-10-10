$ErrorActionPreference = 'Stop'
$PortableRoot = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $PortableRoot
$env:PYTHONUNBUFFERED = '1'
python gateway/server.py
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
