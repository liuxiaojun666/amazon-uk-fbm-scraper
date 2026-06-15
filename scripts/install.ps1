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

function Install-NodeViaDownload {
    Write-Warn "Downloading Node.js LTS installer from nodejs.org..."
    $ProgressPreference = "SilentlyContinue"

    try {
        $index = Invoke-RestMethod -Uri "https://nodejs.org/dist/index.json" -UseBasicParsing
        $lts = $index | Where-Object { $_.lts -ne $false } | Select-Object -First 1
        if (-not $lts) { throw "Could not find an LTS release" }

        $ver = $lts.version
        $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
        $msiName = "node-$ver-$arch.msi"
        $url = "https://nodejs.org/dist/$ver/$msiName"
        $dest = Join-Path $env:TEMP $msiName

        Write-Info "Downloading $url"
        Invoke-WebRequest -Uri $url -OutFile $dest -UseBasicParsing

        Write-Info "Installing Node.js (admin rights may be required)..."
        $proc = Start-Process msiexec.exe -Wait -PassThru -ArgumentList @(
            "/i", $dest, "/qn", "/norestart"
        )
        Remove-Item $dest -ErrorAction SilentlyContinue

        if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne 3010) {
            throw "Installer exited with code $($proc.ExitCode)"
        }

        Refresh-Path
    } catch {
        Write-Fail "Could not auto-install Node.js: $($_.Exception.Message). Install LTS from https://nodejs.org/ then run: npm run setup"
    }
}

function Install-Node {
    if (Test-NodeOk) {
        Write-Info "Node.js already installed: $(node -v)"
        return
    }

    Write-Warn "Node.js $NodeMajorMin+ not found. Installing..."

    if (Get-Command winget -ErrorAction SilentlyContinue) {
        Write-Info "Trying winget..."
        & winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
        Refresh-Path
    }

    if (-not (Test-NodeOk)) {
        Install-NodeViaDownload
    }

    if (-not (Test-NodeOk)) {
        Write-Fail "Node.js install finished but not on PATH. Close this window, double-click again, or run: npm run setup"
    }

    Write-Info "Node.js installed: $(node -v)"
}

$Root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
Set-Location $Root

Write-Host ""
Write-Info "Amazon UK Scraper - first-time setup (Windows)"
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
