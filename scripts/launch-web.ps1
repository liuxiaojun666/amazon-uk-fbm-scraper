# Windows: install (if needed) and start the Web UI. Called by 启动 Web.bat
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\win-node.ps1"
. "$PSScriptRoot\win-project-root.ps1"

$OriginalRoot = Split-Path -Parent $PSScriptRoot
$Root = Get-SafeProjectRoot -SourceRoot $OriginalRoot
Set-Location $Root

Write-Host ""
Write-Host "========================================"
Write-Host " Amazon UK Scraper - Web UI"
Write-Host "========================================"
Write-Host ""

if (-not (Test-NodeOk)) {
    Write-Host "First run: installing Node.js and dependencies..."
    Write-Host "This may take a few minutes. Please wait..."
    Write-Host ""
    & "$Root\scripts\install.ps1"
    if ($LASTEXITCODE -ne 0) {
        Write-Host ""
        Write-Host "Setup failed. See messages above." -ForegroundColor Red
        exit 1
    }
    Refresh-Path
    if (-not (Test-NodeOk)) {
        Write-Host ""
        Write-Host "Node.js was installed. Please close this window and double-click again."
        exit 0
    }
}

npm run web
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
