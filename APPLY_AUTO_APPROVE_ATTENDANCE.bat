@echo off
echo ========================================
echo AUTO-APPROVE STAFF ATTENDANCE MIGRATION
echo ========================================
echo.
echo This will:
echo 1. Set is_approved default to TRUE
echo 2. Auto-approve all existing attendance records
echo 3. Create trigger to auto-approve new records
echo.
pause

cd backend
node apply-auto-approve-attendance.js

echo.
echo ========================================
echo Migration Complete!
echo ========================================
pause
