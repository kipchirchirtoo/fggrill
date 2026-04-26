@echo off
echo 🔥 FORCE RESTARTING BACKEND...
echo.

echo 1. Killing processes on port 5000...
for /f "tokens=5" %%a in ('netstat -aon ^| find ":5000" ^| find "LISTENING"') do taskkill /F /PID %%a 2>nul
echo    ✓ Processes killed

echo 2. Removing dist folder...
if exist dist rmdir /s /q dist
echo    ✓ dist folder removed

echo 3. Clearing cache...
if exist node_modules\.cache rmdir /s /q node_modules\.cache
echo    ✓ Cache cleared

echo.
echo 4. Starting fresh server...
npm run dev
