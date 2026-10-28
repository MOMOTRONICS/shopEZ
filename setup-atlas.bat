@echo off
setlocal
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-atlas.ps1"
if errorlevel 1 (
  echo.
  echo Atlas setup did not complete. Review the message above.
  pause
  exit /b 1
)
echo.
echo Now double-click start-shopez.bat to start ShopEZ.
pause
endlocal
