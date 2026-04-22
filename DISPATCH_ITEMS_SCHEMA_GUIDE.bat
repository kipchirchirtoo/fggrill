@echo off
echo ========================================
echo DISPATCH_ITEMS HYBRID SCHEMA GUIDE
echo ========================================
echo.
echo The dispatch_items table now supports BOTH systems:
echo.
echo ----------------------------------------
echo MOBILE APP (Barcode System)
echo ----------------------------------------
echo Uses these columns:
echo   - item_id (integer) - references inventory_items(id)
echo   - item_name (varchar)
echo   - quantity (integer)
echo   - unit (varchar)
echo   - notes (text)
echo.
echo ----------------------------------------
echo WEB API (Store Management)
echo ----------------------------------------
echo Uses these columns:
echo   - item_sku (varchar) - references simple_items(sku)
echo   - dispatched_quantity (integer)
echo   - received_quantity (integer)
echo   - status (varchar) - PENDING, RECEIVED, PARTIAL, DISPUTED
echo.
echo ----------------------------------------
echo SHARED COLUMNS (Both Systems)
echo ----------------------------------------
echo   - batch_number (varchar)
echo   - expiry_date (date)
echo   - bin_location (varchar)
echo   - damaged_quantity (integer)
echo   - missing_quantity (integer)
echo   - discrepancy_reason (text)
echo.
echo ========================================
echo IMPORTANT: RELOAD SUPABASE SCHEMA CACHE
echo ========================================
echo.
echo 1. Go to: https://supabase.com/dashboard
echo 2. Navigate to: Settings -^> API
echo 3. Click: "Reload Schema" button
echo 4. Wait 5-10 seconds
echo.
echo Without this step, the API will still show errors!
echo.
pause
