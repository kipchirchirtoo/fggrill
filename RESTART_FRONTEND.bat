@echo off
echo ========================================
echo Restarting Frontend with Memory Fix
echo ========================================
echo.

echo [1/2] Stopping all Node.js processes...
taskkill /F /IM node.exe >nul 2>&1
timeout /t 2 /nobreak >nul
echo Done!

echo [2/2] Starting frontend with 8GB memory...
cd frontend
set NODE_OPTIONS=--max-old-space-size=8192
start cmd /k "npm run dev"

echo.
echo ========================================
echo Frontend Started Successfully!
echo ========================================
echo.
echo Access at: http://localhost:3001
echo.
echo Press any key to close this window...
pause >nul
