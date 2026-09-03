@echo off
REM Runs the server in this window so it stays tied to the console.
REM Clicking Quit in the browser stops the server, which then lets this
REM window fall through to the pause below. Closing this window also
REM stops the server (Ctrl+C or the X button).
where node >nul 2>nul
if errorlevel 1 (
    echo Node.js not found on PATH.
    echo Install it from https://nodejs.org/ then try again.
    pause
    exit /b 1
)
node "%~dp0ClaudeMonitor.js" %*
if errorlevel 1 (
    echo.
    echo Server stopped with an error.
    pause
)
exit /b 0
