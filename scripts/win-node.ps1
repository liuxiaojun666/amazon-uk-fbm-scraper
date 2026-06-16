# Shared Node.js detection and portable install path (Windows, no admin required)
$script:NodeMajorMin = 18
# Pin Node 20 LTS — Node 24/npm on Windows can hit "Exit handler never called"
$script:NodePortableVersion = "v20.18.3"

function Get-PortableNodeDir {
    Join-Path $env:LOCALAPPDATA "amazon-uk-scraper\node"
}

function Add-PortableNodeToPath {
    param([string]$Dir)

    if ($env:Path.Split(';') -notcontains $Dir) {
        $env:Path = "$Dir;$env:Path"
    }

    $userPath = [System.Environment]::GetEnvironmentVariable("Path", "User")
    if (-not $userPath) { $userPath = "" }
    $parts = $userPath -split ';' | Where-Object { $_ -and ($_ -ne $Dir) }
    $newPath = ($Dir + ';' + ($parts -join ';')).Trim(';')
    [System.Environment]::SetEnvironmentVariable("Path", $newPath, "User")
}

function Ensure-PortableNodeOnPath {
    $dir = Get-PortableNodeDir
    $nodeExe = Join-Path $dir "node.exe"
    if (Test-Path $nodeExe) {
        Add-PortableNodeToPath $dir
        return $true
    }
    return $false
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
    Ensure-PortableNodeOnPath | Out-Null
}

function Get-NodeMajor {
    try {
        $v = (node -v 2>$null) -replace '^v(\d+).*', '$1'
        if ($v -match '^\d+$') { return [int]$v }
    } catch {}
    return 0
}

function Test-PortableNodeCurrent {
    $destDir = Get-PortableNodeDir
    $versionFile = Join-Path $destDir ".version"
    if (-not (Test-Path $versionFile)) { return $false }
    return ((Get-Content $versionFile -Raw).Trim() -eq $script:NodePortableVersion)
}

function Test-NodeOk {
    Refresh-Path
    if (-not (Get-Command node -ErrorAction SilentlyContinue)) { return $false }
    if ((Get-NodeMajor) -lt $script:NodeMajorMin) { return $false }
    $portableNode = Join-Path (Get-PortableNodeDir) "node.exe"
    if ((Test-Path $portableNode) -and -not (Test-PortableNodeCurrent)) { return $false }
    return $true
}

function Get-LtsNodeRelease {
    return [pscustomobject]@{ version = $script:NodePortableVersion }
}

function Install-NodePortable {
    Write-Host "==> Installing Node.js locally (no admin required)..." -ForegroundColor Green
    $ProgressPreference = "SilentlyContinue"

    $lts = Get-LtsNodeRelease
    $ver = $lts.version
    $arch = if ([Environment]::Is64BitOperatingSystem) { "x64" } else { "x86" }
    $zipName = "node-$ver-win-$arch.zip"
    $url = "https://npmmirror.com/mirrors/node/$ver/$zipName"
    $zipPath = Join-Path $env:TEMP $zipName
    $destDir = Get-PortableNodeDir
    $versionFile = Join-Path $destDir ".version"

    if ((Test-Path $versionFile) -and ((Get-Content $versionFile -Raw).Trim() -eq $ver) -and (Test-Path (Join-Path $destDir "node.exe"))) {
        Write-Host "==> Portable Node.js $ver already installed" -ForegroundColor Green
        Add-PortableNodeToPath $destDir
        return
    }

    Write-Host "==> Downloading $url" -ForegroundColor Green
    Invoke-WebRequest -Uri $url -OutFile $zipPath -UseBasicParsing

    $extractRoot = Join-Path $env:TEMP ("node-extract-" + [guid]::NewGuid().ToString("n"))
    New-Item -ItemType Directory -Path $extractRoot -Force | Out-Null
    Expand-Archive -Path $zipPath -DestinationPath $extractRoot -Force

    $innerDir = Join-Path $extractRoot "node-$ver-win-$arch"
    if (-not (Test-Path $innerDir)) {
        throw "Unexpected zip layout in $zipName"
    }

    if (Test-Path $destDir) { Remove-Item $destDir -Recurse -Force }
    New-Item -ItemType Directory -Path (Split-Path $destDir -Parent) -Force | Out-Null
    Move-Item $innerDir $destDir

    Set-Content -Path $versionFile -Value $ver -NoNewline
    Remove-Item $zipPath -ErrorAction SilentlyContinue
    Remove-Item $extractRoot -Recurse -Force -ErrorAction SilentlyContinue

    Add-PortableNodeToPath $destDir
}

function Invoke-Npm {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)

    $npmCmd = $null
    $npmCmdInfo = Get-Command npm.cmd -ErrorAction SilentlyContinue
    if ($npmCmdInfo) { $npmCmd = $npmCmdInfo.Source }
    if (-not $npmCmd) {
        $npmCmd = Join-Path (Split-Path (Get-Command node -ErrorAction Stop).Source -Parent) "npm.cmd"
    }
    if (-not (Test-Path $npmCmd)) {
        throw "npm.cmd not found next to node.exe"
    }
    & $npmCmd @Args
}
