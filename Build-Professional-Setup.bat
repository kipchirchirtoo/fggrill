@echo off
setlocal enabledelayedexpansion

echo ===================================================
echo   FG Grill Terminal - Build Professional Setup
echo ===================================================
echo.
echo NOTE: Please run this script as ADMINISTRATOR to 
echo avoid permission errors during installer creation.
echo.

:: Ensure we are in the correct directory even when run as administrator
cd /d "%~dp0"

echo [1/4] Building Backend Engine...
cd backend
call npm run build
if !errorlevel! neq 0 (
    echo [ERROR] Backend build failed.
    pause
    exit /b !errorlevel!
)
cd ..

echo [2/4] Building Frontend Interface...
cd frontend
call npm run build
if !errorlevel! neq 0 (
    echo [ERROR] Frontend build failed.
    pause
    exit /b !errorlevel!
)
cd ..

echo [3/4] Creating Standalone Installer...
call npx electron-builder build --win --publish never
if !errorlevel! neq 0 (
    echo [ERROR] Installer creation failed.
    pause
    exit /b !errorlevel!
)

echo.
echo ===================================================
echo   SUCCESS! New version is ready.
echo ===================================================
echo.
echo Check the 'dist-electron' folder for:
echo 1. FG Grill Terminal Setup 1.0.0.exe (Installer)
echo 2. FG Grill Terminal 1.0.0.exe (Portable)
echo.
pause
