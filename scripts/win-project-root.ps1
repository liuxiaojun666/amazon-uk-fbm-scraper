# If project path contains non-ASCII (e.g. Chinese), copy to a safe ASCII path for npm.
function Get-SafeProjectRoot {
    param([string]$SourceRoot)

    $SourceRoot = (Resolve-Path $SourceRoot).Path

    if ($SourceRoot -match '^[\x00-\x7F]*$') {
        return $SourceRoot
    }

    $safeRoot = Join-Path $env:LOCALAPPDATA "amazon-uk-scraper\app"

    Write-Host ""
    Write-Host "!!> Project path has Chinese or special characters." -ForegroundColor Yellow
    Write-Host "!!> npm cannot install dependencies in this folder on Windows." -ForegroundColor Yellow
    Write-Host "==> Copying project to: $safeRoot" -ForegroundColor Green
    Write-Host ""

    New-Item -ItemType Directory -Path $safeRoot -Force | Out-Null

    & robocopy $SourceRoot $safeRoot /E /XD node_modules .git /NFL /NDL /NJH /NJS /nc /ns /np | Out-Null
    if ($LASTEXITCODE -gt 7) {
        throw "Failed to copy project (robocopy exit $LASTEXITCODE)"
    }

    return $safeRoot
}
