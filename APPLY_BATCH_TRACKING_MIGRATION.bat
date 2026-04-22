@echo off
echo ========================================
echo Add Batch Tracking to Dispatch Items
echo ========================================
echo.
echo This will add the following columns to dispatch_items:
echo   - batch_number
echo   - expiry_date
echo   - bin_location
echo   - damaged_quantity
echo   - missing_quantity
echo   - discrepancy_reason
echo.
pause

cd backend
node apply-batch-tracking-migration.js

echo.
echo ========================================
echo Migration Complete!
echo ========================================
echo.
echo Next step: Reload Supabase schema cache
echo   1. Go to Supabase Dashboard
echo   2. Navigate to Settings -^> API
echo   3. Click "Reload Schema" button
echo.
pause
