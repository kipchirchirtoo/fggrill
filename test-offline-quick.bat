@echo off
REM Quick Test Script for Offline Login Fix
REM This script builds the frontend and runs Electron for testing

echo ========================================
echo Offline Login Fix - Quick Test
echo ========================================
echo.

echo [1/4] Verifying fix implementation...
node verify-offline-fix.js
if errorlevel 1 (
    echo.
    echo ERROR: Verification failed!
    echo Please review the errors above.
    pause
    exit /b 1
)

echo.
echo [2/4] Building frontend...
cd frontend
call npm run build
if errorlevel 1 (
    echo.
    echo ERROR: Frontend build failed!
    cd ..
    pause
    exit /b 1
)
cd ..

echo.
echo [3/4] Starting Electron app...
echo.
echo ========================================
echo TEST INSTRUCTIONS:
echo ========================================
echo 1. Wait for the app window to open
echo 2. Enter a valid PIN (e.g., R0123)
echo 3. Watch the console logs below
echo 4. Verify redirect to dashboard
echo.
echo Expected logs:
echo   [Terminal] handleLogin called
echo   [Terminal] Offline login attempt...
echo   [Cache] PIN verified successfully
echo   [Terminal] Executing redirect...
echo   [IPC] Navigation successful
echo.
echo Press Ctrl+C to stop the app
echo ========================================
echo.

npm run electron:dev
