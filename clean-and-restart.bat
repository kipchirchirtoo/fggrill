@echo off
echo ========================================
echo Cleaning Next.js Build Cache
echo ========================================

cd frontend

echo.
echo Step 1: Stopping all Node processes...
taskkill /F /IM node.exe 2>nul
timeout /t 3 /nobreak >nul

echo.
echo Step 2: Removing .next directory...
if exist .next (
    rmdir /s /q .next
    echo .next directory removed
) else (
    echo .next directory not found
)

echo.
echo Step 3: Removing node_modules/.cache...
if exist node_modules\.cache (
    rmdir /s /q node_modules\.cache
    echo node_modules\.cache removed
) else (
    echo node_modules\.cache not found
)

echo.
echo Step 4: Starting fresh dev server...
start "Frontend Dev Server" cmd /k "npm run dev"

echo.
echo ========================================
echo Done! Frontend is starting fresh...
echo ========================================
cd ..
pause
