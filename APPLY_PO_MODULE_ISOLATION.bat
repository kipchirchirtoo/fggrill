@echo off
REM =====================================================
REM Apply Purchase Order Module Isolation Migration
REM =====================================================

echo.
echo ========================================
echo  PURCHASE ORDER MODULE ISOLATION
echo  Migration: 68_add_po_module_isolation
echo ========================================
echo.
echo This migration will:
echo  1. Add source_module column to all PO tables
echo  2. Add branch_id to store_purchase_orders
echo  3. Create indexes for efficient filtering
echo  4. Backfill existing data
echo  5. Add constraints for data integrity
echo.

set /p CONFIRM="Do you want to proceed? (yes/no): "
if /i not "%CONFIRM%"=="yes" (
    echo Migration cancelled.
    exit /b 0
)

echo.
echo Applying migration...
echo.

REM Set your Supabase connection details
set PGHOST=aws-0-ap-southeast-1.pooler.supabase.com
set PGPORT=6543
set PGDATABASE=postgres
set PGUSER=postgres.yfqxqxqxqxqxqxqxqxqx
set /p PGPASSWORD="Enter Supabase password: "

REM Apply the migration
psql -h %PGHOST% -p %PGPORT% -U %PGUSER% -d %PGDATABASE% -f backend/supabase/migrations/68_add_po_module_isolation.sql

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ========================================
    echo  MIGRATION COMPLETED SUCCESSFULLY
    echo ========================================
    echo.
    echo Next steps:
    echo  1. Restart your backend server
    echo  2. Test PO creation in each module
    echo  3. Verify branch-level users can only see their POs
    echo  4. Check auditor can see all POs with module distinction
    echo.
) else (
    echo.
    echo ========================================
    echo  MIGRATION FAILED
    echo ========================================
    echo.
    echo Please check the error messages above.
    echo You may need to:
    echo  1. Verify database connection details
    echo  2. Check for conflicting data
    echo  3. Review migration SQL for syntax errors
    echo.
)

pause
