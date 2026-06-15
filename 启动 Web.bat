@echo off
chcp 65001 >nul 2>nul
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\launch-web.ps1"
set EXITCODE=%ERRORLEVEL%
echo.
if %EXITCODE% neq 0 (
    echo Setup or launch failed. See messages above.
)
pause
exit /b %EXITCODE%
