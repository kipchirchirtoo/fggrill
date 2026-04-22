@echo off
echo ========================================
echo REPORT TO DUTY - QUICK FIX
echo ========================================
echo.
echo This script will:
echo 1. Check the current schema
echo 2. Apply the migration if needed
echo 3. Verify the fix
echo.
echo ========================================
pause

cd backend

echo.
echo Step 1: Checking current schema...
echo ========================================
node check-staff-leave-schema.js

echo.
echo.
echo Step 2: Applying migration...
echo ========================================
node apply-report-to-duty-migration.js

echo.
echo.
echo Step 3: Verifying the fix...
echo ========================================
node check-staff-leave-schema.js

cd ..

echo.
echo ========================================
echo FIX COMPLETE!
echo ========================================
echo.
echo The Report to Duty feature should now work.
echo Test it by:
echo 1. Going to Leave Management
echo 2. Finding an approved leave request
echo 3. Clicking "Report to Duty"
echo.
pause
