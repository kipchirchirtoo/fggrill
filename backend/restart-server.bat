@echo off
echo ========================================
echo  FamousGate Backend - Clean Restart
echo ========================================
echo.

echo [1/3] Stopping any running Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 2 /nobreak >nul

echo [2/3] Rebuilding TypeScript...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Build failed!
    pause
    exit /b 1
)

echo [3/3] Starting server...
echo.
echo ========================================
echo  Server starting...
echo ========================================
echo.
npm start
