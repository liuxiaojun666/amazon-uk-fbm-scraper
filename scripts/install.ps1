# One-shot setup for Windows: install Node.js (if missing) + npm deps + Playwright Chromium
$ErrorActionPreference = "Stop"
$NodeMajorMin = 18

function Write-Info($msg) { Write-Host "==> $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "!!> $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

function Get-NodeMajor {
    try {
        $v = (node -v 2>$null) -replace '^v(\d+).*', '$1'
        if ($v -match '^\d+$') { return [int]$v }
    } catch {}
    return 0
}

function Test-NodeOk {
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
    return (Get-NodeMajor) -ge $NodeMajorMin
}

function Install-Node {
    if (Test-NodeOk) {
        Write-Info "Node.js already installed: $(node -v)"
        return
    }

    Write-Warn "Node.js $NodeMajorMin+ not found. Installing via winget..."

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
        $env:Path = [System.Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
                    [System.Environment]::GetEnvironmentVariable("Path", "User")
    } else {
        Write-Fail "winget not found. Install Node.js LTS from https://nodejs.org/ then run: npm run setup"
    }

    if (-not (Test-NodeOk)) {
        Write-Fail "Node.js install finished but not on PATH. Close this window, open a new PowerShell, then run: npm run setup"
    }

    Write-Info "Node.js installed: $(node -v)"
}

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host ""
Write-Info "Amazon UK Scraper — first-time setup (Windows)"
Write-Host ""

Install-Node
Write-Info "Installing project dependencies..."
node scripts/setup-deps.js

Write-Warn "Reminder: enable VPN with UK exit node and proxy on 127.0.0.1:7897 before scraping."
Write-Warn "Check: powershell -File scripts/check-vpn.ps1"

Write-Host ""
Write-Info "Setup complete!"
Write-Host ""
Write-Host "  Start Web UI:     npm run web"
Write-Host "  Or CLI scrape:    npm run scrape -- `"phone case`""
Write-Host "  Double-click:     启动 Web.bat"
Write-Host ""
