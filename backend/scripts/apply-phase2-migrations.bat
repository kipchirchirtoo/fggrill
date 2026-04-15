@echo off
REM =====================================================
REM PHASE 2 Migration Application Script (Windows)
REM Date: 2026-04-15
REM Purpose: Safely apply PHASE 2 schema and backfill migrations
REM =====================================================

setlocal enabledelayedexpansion

REM =====================================================
REM Configuration
REM =====================================================

set SCRIPT_DIR=%~dp0
set PROJECT_ROOT=%SCRIPT_DIR%..\..
set MIGRATIONS_DIR=%PROJECT_ROOT%\backend\supabase\migrations
set BACKUP_DIR=%PROJECT_ROOT%\backups

set MIGRATION_1=20260415_add_branch_id_to_staff_profiles.sql
set MIGRATION_2=20260415_backfill_null_branch_ids.sql

REM =====================================================
REM Functions
REM =====================================================

:print_header
echo ========================================
echo %~1
echo ========================================
goto :eof

:print_success
echo [92m[OK] %~1[0m
goto :eof

:print_error
echo [91m[ERROR] %~1[0m
goto :eof

:print_warning
echo [93m[WARNING] %~1[0m
goto :eof

:print_info
echo [94m[INFO] %~1[0m
goto :eof

REM =====================================================
REM Main Script
REM =====================================================

cls

call :print_header "PHASE 2 Migration Application Script"
echo This script will safely apply PHASE 2 migrations:
echo   1. Add branch_id columns to staff tables
echo   2. Backfill NULL branch_id values
echo.

REM Check environment variables
call :print_header "Checking Environment Variables"

if "%DATABASE_URL%"=="" if "%SUPABASE_DB_URL%"=="" (
    call :print_error "Missing required environment variables"
    echo.
    echo Please set one of the following:
    echo   set DATABASE_URL=postgresql://user:password@host:port/database
    echo   OR
    echo   set SUPABASE_DB_URL=postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres
    echo.
    pause
    exit /b 1
)

if not "%DATABASE_URL%"=="" (
    set DB_URL=%DATABASE_URL%
    call :print_success "Using DATABASE_URL"
) else (
    set DB_URL=%SUPABASE_DB_URL%
    call :print_success "Using SUPABASE_DB_URL"
)
echo.

REM Check if psql is installed
call :print_header "Checking PostgreSQL Client"

where psql >nul 2>&1
if %errorlevel% neq 0 (
    call :print_error "psql (PostgreSQL client) is not installed"
    echo.
    echo Please install PostgreSQL client:
    echo   Download from: https://www.postgresql.org/download/windows/
    echo   Or install via Chocolatey: choco install postgresql
    echo.
    pause
    exit /b 1
)

for /f "tokens=*" %%i in ('psql --version') do set PSQL_VERSION=%%i
call :print_success "psql is installed: %PSQL_VERSION%"
echo.

REM Test database connection
call :print_header "Testing Database Connection"

psql "%DB_URL%" -c "SELECT 1;" >nul 2>&1
if %errorlevel% neq 0 (
    call :print_error "Failed to connect to database"
    echo.
    echo Please check your connection string and ensure:
    echo   1. Database is running
    echo   2. Credentials are correct
    echo   3. Network access is allowed
    echo.
    pause
    exit /b 1
)

call :print_success "Database connection successful"
echo.

REM Check if migrations exist
call :print_header "Checking Migration Files"

if not exist "%MIGRATIONS_DIR%\%MIGRATION_1%" (
    call :print_error "Missing migration file: %MIGRATION_1%"
    pause
    exit /b 1
)

if not exist "%MIGRATIONS_DIR%\%MIGRATION_2%" (
    call :print_error "Missing migration file: %MIGRATION_2%"
    pause
    exit /b 1
)

call :print_success "All migration files found"
echo.

REM Check if branches table has data
call :print_header "Checking Branches Table"

for /f %%i in ('psql "%DB_URL%" -t -c "SELECT COUNT(*) FROM branches;" 2^>nul') do set BRANCH_COUNT=%%i
set BRANCH_COUNT=%BRANCH_COUNT: =%

if "%BRANCH_COUNT%"=="0" (
    call :print_error "No branches found in database"
    echo.
    echo The backfill script requires at least one branch to exist.
    echo.
    set /p CREATE_BRANCH="Do you want to create a default branch now? (y/n): "
    if /i "!CREATE_BRANCH!"=="y" (
        psql "%DB_URL%" -c "INSERT INTO branches (name, location, status) VALUES ('Main Branch', 'Main Location', 'active');"
        call :print_success "Default branch created"
    ) else (
        call :print_error "Cannot proceed without at least one branch"
        pause
        exit /b 1
    )
) else (
    call :print_success "Found %BRANCH_COUNT% branch(es)"
)
echo.

REM Confirm before proceeding
call :print_warning "This will modify your database schema and data"
set /p CONFIRM="Do you want to proceed? (y/n): "
echo.

if /i not "%CONFIRM%"=="y" (
    call :print_info "Migration cancelled"
    pause
    exit /b 0
)

REM Create backup
call :print_header "Creating Database Backup"

if not exist "%BACKUP_DIR%" mkdir "%BACKUP_DIR%"

for /f "tokens=2-4 delims=/ " %%a in ('date /t') do (set DATE=%%c%%a%%b)
for /f "tokens=1-2 delims=/: " %%a in ('time /t') do (set TIME=%%a%%b)
set TIMESTAMP=%DATE%_%TIME%
set BACKUP_FILE=%BACKUP_DIR%\backup_before_phase2_%TIMESTAMP%.sql

call :print_info "Backing up database to: %BACKUP_FILE%"

pg_dump "%DB_URL%" > "%BACKUP_FILE%" 2>nul
if %errorlevel% neq 0 (
    call :print_error "Failed to create backup"
    echo.
    set /p CONTINUE="Do you want to continue without backup? (y/n): "
    if /i not "!CONTINUE!"=="y" (
        exit /b 1
    )
) else (
    call :print_success "Backup created successfully"
    for %%A in ("%BACKUP_FILE%") do set BACKUP_SIZE=%%~zA
    call :print_info "Backup size: !BACKUP_SIZE! bytes"
)
echo.

REM Apply Migration 1
call :print_header "Applying Migration: %MIGRATION_1%"

call :print_info "Executing migration..."

psql "%DB_URL%" -f "%MIGRATIONS_DIR%\%MIGRATION_1%" > "%TEMP%\migration1_output.log" 2>&1
if %errorlevel% neq 0 (
    call :print_error "Migration 1 failed"
    echo.
    echo Error details:
    type "%TEMP%\migration1_output.log"
    echo.
    
    if exist "%BACKUP_FILE%" (
        set /p RESTORE="Do you want to restore from backup? (y/n): "
        if /i "!RESTORE!"=="y" (
            call :print_info "Restoring from backup..."
            psql "%DB_URL%" < "%BACKUP_FILE%"
            call :print_success "Database restored"
        )
    )
    
    pause
    exit /b 1
)

call :print_success "Migration 1 applied successfully"

REM Show migration 1 summary
findstr /C:"NOTICE:" "%TEMP%\migration1_output.log" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    call :print_info "Migration Summary:"
    findstr /C:"NOTICE:" "%TEMP%\migration1_output.log"
)
echo.

REM Verify Migration 1
call :print_header "Verifying Migration 1 Results"

set TABLES=staff_profiles staff_schedules staff_leave staff_payroll staff_performance
for %%T in (%TABLES%) do (
    for /f %%i in ('psql "%DB_URL%" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='%%T' AND column_name='branch_id';" 2^>nul') do set HAS_COLUMN=%%i
    set HAS_COLUMN=!HAS_COLUMN: =!
    
    if "!HAS_COLUMN!"=="0" (
        call :print_error "Column branch_id missing in %%T"
    ) else (
        call :print_success "Column branch_id exists in %%T"
    )
)
echo.

REM Apply Migration 2
call :print_header "Applying Migration: %MIGRATION_2%"

call :print_info "Executing migration..."

psql "%DB_URL%" -f "%MIGRATIONS_DIR%\%MIGRATION_2%" > "%TEMP%\migration2_output.log" 2>&1
if %errorlevel% neq 0 (
    call :print_error "Migration 2 failed"
    echo.
    echo Error details:
    type "%TEMP%\migration2_output.log"
    echo.
    
    if exist "%BACKUP_FILE%" (
        set /p RESTORE="Do you want to restore from backup? (y/n): "
        if /i "!RESTORE!"=="y" (
            call :print_info "Restoring from backup..."
            psql "%DB_URL%" < "%BACKUP_FILE%"
            call :print_success "Database restored"
        )
    )
    
    pause
    exit /b 1
)

call :print_success "Migration 2 applied successfully"

REM Show migration 2 summary
findstr /C:"NOTICE:" "%TEMP%\migration2_output.log" >nul 2>&1
if %errorlevel% equ 0 (
    echo.
    call :print_info "Migration Summary:"
    findstr /C:"NOTICE:" "%TEMP%\migration2_output.log"
)
echo.

REM Verify Migration 2
call :print_header "Verifying Migration 2 Results"

set CHECK_TABLES=staff_profiles bookings restaurant_orders bar_orders finance_transactions
for %%T in (%CHECK_TABLES%) do (
    for /f %%i in ('psql "%DB_URL%" -t -c "SELECT COUNT(*) FROM %%T WHERE branch_id IS NULL;" 2^>nul') do set NULL_COUNT=%%i
    set NULL_COUNT=!NULL_COUNT: =!
    
    if "!NULL_COUNT!"=="0" (
        call :print_success "Table %%T: All records have branch_id"
    ) else (
        call :print_warning "Table %%T has !NULL_COUNT! records with NULL branch_id"
    )
)
echo.

REM Show summary
call :print_header "Migration Summary"

echo Migrations Applied:
echo   [OK] %MIGRATION_1%
echo   [OK] %MIGRATION_2%
echo.

if exist "%BACKUP_FILE%" (
    echo Backup Location:
    echo   %BACKUP_FILE%
    echo.
)

echo Next Steps:
echo   1. Review the migration output above
echo   2. Test branch isolation in your application
echo   3. Review inventory item assignments:
echo      psql %%DATABASE_URL%% -c "SELECT sku, name, branch_id FROM simple_items;"
echo   4. Update application code to include branch_id filters
echo   5. Deploy updated desktop app with security fixes
echo.

call :print_success "PHASE 2 migrations completed successfully!"
echo.

pause
