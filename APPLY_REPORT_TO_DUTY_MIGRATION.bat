@echo off
echo ========================================
echo Applying Report to Duty Migration
echo ========================================
echo.

echo This will add the following columns to staff_leave table:
echo   - actual_return_date
echo   - reported_to_duty
echo   - reported_at
echo   - reported_by
echo   - report_notes
echo.

echo Press any key to continue or Ctrl+C to cancel...
pause >nul

cd backend
node apply-report-to-duty-migration.js

echo.
echo ========================================
echo Migration Complete!
echo ========================================
echo.
echo Next steps:
echo 1. Restart backend: pm2 restart backend
echo 2. Restart frontend: pm2 restart frontend
echo 3. Test the feature in Leave Management
echo.
echo Press any key to exit...
pause >nul
