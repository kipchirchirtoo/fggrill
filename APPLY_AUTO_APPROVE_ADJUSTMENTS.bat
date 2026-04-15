@echo off
echo ========================================
echo Auto-Approve Pending Adjustments
echo ========================================
echo.
echo This will:
echo 1. Approve all pending HR adjustments
echo 2. Enable them for payroll calculations
echo 3. Identify affected payroll runs
echo.
echo Press Ctrl+C to cancel, or
pause

cd backend
node apply-auto-approve-adjustments.js

echo.
echo ========================================
echo Migration Complete!
echo ========================================
echo.
pause
