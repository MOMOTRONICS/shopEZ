@echo off
setlocal
cd /d "%~dp0"

if not exist "node_modules" (
  echo Installing root tools...
  call npm.cmd install
  if errorlevel 1 goto failed
)

if not exist "client\node_modules" (
  echo Installing frontend dependencies...
  call npm.cmd install --prefix client
  if errorlevel 1 goto failed
)

if not exist "server\node_modules" (
  echo Installing backend dependencies...
  call npm.cmd install --prefix server
  if errorlevel 1 goto failed
)

if not exist "server\.env" (
  echo.
  echo ERROR: server\.env has not been configured.
  echo For MongoDB Atlas, run setup-atlas.bat first.
  echo For local MongoDB, copy server\.env.example to server\.env and set MONGO_URI and JWT_SECRET.
  echo.
  pause
  exit /b 1
)

echo Starting ShopEZ frontend and API...
call npm.cmd run dev
goto end

:failed
echo.
echo Dependency installation failed. Check the error above and try again.
pause
exit /b 1

:end
endlocal
