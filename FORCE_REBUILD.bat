@echo off
echo ========================================
echo FORCE REBUILD - Clear Cache and Rebuild
echo ========================================
echo.

echo Step 1: Deleting frontend build cache...
cd frontend
if exist .next rmdir /s /q .next
if exist out rmdir /s /q out
if exist node_modules\.cache rmdir /s /q node_modules\.cache
echo ✓ Cache cleared
echo.

echo Step 2: Rebuilding frontend...
call npm run build
echo ✓ Frontend rebuilt
echo.

echo Step 3: Instructions for Electron...
echo.
echo IMPORTANT: You must restart the Electron app completely:
echo 1. Close the Electron app (X button)
echo 2. Start it again
echo.
echo The new build will be loaded on restart.
echo.
echo ========================================
echo REBUILD COMPLETE
echo ========================================
pause
