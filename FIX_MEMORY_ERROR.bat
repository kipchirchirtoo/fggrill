@echo off
echo ========================================
echo Fixing Next.js Memory Allocation Error
echo ========================================
echo.

echo [1/3] Stopping current dev server...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul

echo [2/3] Clearing Next.js cache...
cd frontend
if exist .next rmdir /s /q .next
if exist node_modules\.cache rmdir /s /q node_modules\.cache
echo Cache cleared!

echo [3/3] Starting dev server with increased memory...
echo.
echo Starting with 8GB memory limit...
echo.

REM Set Node.js memory limit to 8GB
set NODE_OPTIONS=--max-old-space-size=8192

REM Start Next.js dev server
npm run dev

pause
