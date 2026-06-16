# One-shot setup for Windows: install Node.js (if missing) + npm deps + Playwright Chromium
$ErrorActionPreference = "Stop"
. "$PSScriptRoot\win-node.ps1"
. "$PSScriptRoot\win-project-root.ps1"

function Write-Info($msg) { Write-Host "==> $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "!!> $msg" -ForegroundColor Yellow }
function Write-Fail($msg) { Write-Host "ERROR: $msg" -ForegroundColor Red; exit 1 }

function Install-Node {
    if (Test-NodeOk) {
        Write-Info "Node.js already installed: $(node -v)"
        return
    }

    Write-Warn "Node.js $NodeMajorMin+ not found. Installing..."

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Info "Trying winget..."
        & winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements 2>$null
        Refresh-Path
    }

    if (-not (Test-NodeOk)) {
        try {
            Install-NodePortable
        } catch {
            Write-Fail "Could not install Node.js: $($_.Exception.Message). Install LTS from https://nodejs.org/ then run: npm run setup"
        }
    }

    if (-not (Test-NodeOk)) {
        Write-Fail "Node.js install finished but not on PATH. Close this window, double-click again, or run: npm run setup"
    }

    Write-Info "Node.js installed: $(node -v)"
}

$OriginalRoot = Split-Path -Parent $PSScriptRoot
$Root = Get-SafeProjectRoot -SourceRoot $OriginalRoot
Set-Location $Root

Write-Host ""
Write-Info "Amazon UK Scraper - first-time setup (Windows)"
Write-Host ""

Install-Node
Write-Info "Installing project dependencies..."
node scripts/setup-deps.js
if ($LASTEXITCODE -ne 0) {
    Write-Fail "Dependency install failed. Delete node_modules in $Root and double-click again."
}

Write-Warn "Reminder: enable VPN with a UK exit node before scraping (Chrome should open amazon.co.uk)."
Write-Warn "Check: powershell -File scripts/check-vpn.ps1"

Write-Host ""
Write-Info "Setup complete!"
Write-Host ""
Write-Host "  Start Web UI:     npm run web"
Write-Host "  Or CLI scrape:    npm run scrape -- `"phone case`""
Write-Host "  Double-click:     启动 Web.bat"
Write-Host ""
