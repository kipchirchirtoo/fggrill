@echo off
echo ========================================
echo COMPLETE FIX - Orders and Served By
echo ========================================
echo.

echo Step 1: Fixing cached user names...
node fix-cached-user-names.js
if errorlevel 1 (
    echo ERROR: Failed to fix user names
    pause
    exit /b 1
)
echo.

echo Step 2: Syncing orders from Supabase...
node sync-orders-from-supabase.js
if errorlevel 1 (
    echo ERROR: Failed to sync orders
    pause
    exit /b 1
)
echo.

echo ========================================
echo ALL FIXES COMPLETE
echo ========================================
echo.
echo Next steps:
echo 1. Restart your Electron app
echo 2. Login again (to refresh user data)
echo 3. Click the clock icon to view orders
echo 4. Orders should now show with proper waiter names
echo.
pause
