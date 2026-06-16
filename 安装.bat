@echo off
chcp 65001 >nul 2>nul
cd /d "%~dp0"

echo.
echo ========================================
echo  Amazon UK Scraper - Install dependencies
echo ========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo Node.js 18+ required. Run 启动 Web.bat for full setup, or install from https://nodejs.org/
    goto :fail
)

node scripts/setup-deps.js
if errorlevel 1 goto :fail

echo.
echo Setup complete. Double-click 启动 Web.bat to start.
echo.
pause
exit /b 0

:fail
echo.
echo Install failed. See messages above.
echo.
pause
exit /b 1
