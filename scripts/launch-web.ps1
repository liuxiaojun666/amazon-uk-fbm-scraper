# Windows: install (if needed) and start the Web UI. Called by 启动 Web.bat
$ErrorActionPreference = "Stop"

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

function Get-NodeMajor {
    try {
        $v = (node -v 2>$null) -replace '^v(\d+).*', '$1'
        if ($v -match '^\d+$') { return [int]$v }
    } catch {}
    return 0
}

function Test-NodeOk {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
    return (Get-NodeMajor) -ge 18
}

function Refresh-Path {
    $machine = [System.Environment]::GetEnvironmentVariable("Path", "Machine")
    $user = [System.Environment]::GetEnvironmentVariable("Path", "User")
    if ($machine -and $user) {
        $env:Path = "$machine;$user"
    } elseif ($machine) {
        $env:Path = $machine
    } elseif ($user) {
        $env:Path = $user
    }
}

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
