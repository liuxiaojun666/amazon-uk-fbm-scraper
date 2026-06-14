@echo off
chcp 65001 >nul
cd /d "%~dp0"

echo ========================================
echo  Amazon UK Scraper — Web UI
echo ========================================
echo.

where node >nul 2>&1
if errorlevel 1 (
    echo First run: installing Node.js and dependencies...
    echo This may take a few minutes. Please wait...
    powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\install.ps1"
    if errorlevel 1 (
        echo.
        echo Setup failed. See messages above.
        pause
        exit /b 1
    )
    rem Refresh PATH so this window can find node/npm after winget install
    for /f "tokens=2*" %%A in ('reg query "HKLM\SYSTEM\CurrentControlSet\Control\Session Manager\Environment" /v Path 2^>nul') do set "PATH=%%B"
    for /f "tokens=2*" %%A in ('reg query "HKCU\Environment" /v Path 2^>nul') do set "PATH=%%B;%PATH%"
    where node >nul 2>&1
    if errorlevel 1 (
        echo.
        echo Node.js was installed. Please close this window and double-click again.
        pause
        exit /b 0
    )
)

call npm run web
echo.
pause
