#!/bin/bash

# =====================================================
# PHASE 2 Migration Application Script
# Date: 2026-04-15
# Purpose: Safely apply PHASE 2 schema and backfill migrations
# =====================================================

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# =====================================================
# Configuration
# =====================================================

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
MIGRATIONS_DIR="$PROJECT_ROOT/backend/supabase/migrations"
BACKUP_DIR="$PROJECT_ROOT/backups"

# Migration files
MIGRATION_1="20260415_add_branch_id_to_staff_profiles.sql"
MIGRATION_2="20260415_backfill_null_branch_ids.sql"

# =====================================================
# Functions
# =====================================================

print_header() {
    echo -e "${BLUE}========================================${NC}"
    echo -e "${BLUE}$1${NC}"
    echo -e "${BLUE}========================================${NC}"
}

print_success() {
    echo -e "${GREEN}✓ $1${NC}"
}

print_error() {
    echo -e "${RED}✗ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ $1${NC}"
}

# Check if required environment variables are set
check_env_vars() {
    print_header "Checking Environment Variables"
    
    local missing_vars=()
    
    if [ -z "$DATABASE_URL" ] && [ -z "$SUPABASE_DB_URL" ]; then
        missing_vars+=("DATABASE_URL or SUPABASE_DB_URL")
    fi
    
    if [ ${#missing_vars[@]} -gt 0 ]; then
        print_error "Missing required environment variables:"
        for var in "${missing_vars[@]}"; do
            echo "  - $var"
        done
        echo ""
        echo "Please set the required environment variables:"
        echo "  export DATABASE_URL='postgresql://user:password@host:port/database'"
        echo "  OR"
        echo "  export SUPABASE_DB_URL='postgresql://postgres:[password]@db.[project-ref].supabase.co:5432/postgres'"
        exit 1
    fi
    
    # Use DATABASE_URL if set, otherwise use SUPABASE_DB_URL
    if [ -n "$DATABASE_URL" ]; then
        DB_URL="$DATABASE_URL"
        print_success "Using DATABASE_URL"
    else
        DB_URL="$SUPABASE_DB_URL"
        print_success "Using SUPABASE_DB_URL"
    fi
    
    echo ""
}

# Check if psql is installed
check_psql() {
    print_header "Checking PostgreSQL Client"
    
    if ! command -v psql &> /dev/null; then
        print_error "psql (PostgreSQL client) is not installed"
        echo ""
        echo "Please install PostgreSQL client:"
        echo "  Ubuntu/Debian: sudo apt-get install postgresql-client"
        echo "  macOS: brew install postgresql"
        echo "  Windows: Download from https://www.postgresql.org/download/windows/"
        exit 1
    fi
    
    print_success "psql is installed: $(psql --version)"
    echo ""
}

# Test database connection
test_connection() {
    print_header "Testing Database Connection"
    
    if psql "$DB_URL" -c "SELECT 1;" &> /dev/null; then
        print_success "Database connection successful"
    else
        print_error "Failed to connect to database"
        echo ""
        echo "Please check your connection string and ensure:"
        echo "  1. Database is running"
        echo "  2. Credentials are correct"
        echo "  3. Network access is allowed"
        exit 1
    fi
    
    echo ""
}

# Check if migrations exist
check_migrations() {
    print_header "Checking Migration Files"
    
    local missing_files=()
    
    if [ ! -f "$MIGRATIONS_DIR/$MIGRATION_1" ]; then
        missing_files+=("$MIGRATION_1")
    fi
    
    if [ ! -f "$MIGRATIONS_DIR/$MIGRATION_2" ]; then
        missing_files+=("$MIGRATION_2")
    fi
    
    if [ ${#missing_files[@]} -gt 0 ]; then
        print_error "Missing migration files:"
        for file in "${missing_files[@]}"; do
            echo "  - $file"
        done
        exit 1
    fi
    
    print_success "All migration files found"
    echo ""
}

# Check if branches table exists and has data
check_branches() {
    print_header "Checking Branches Table"
    
    local branch_count=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM branches;" 2>/dev/null || echo "0")
    branch_count=$(echo "$branch_count" | tr -d ' ')
    
    if [ "$branch_count" = "0" ]; then
        print_error "No branches found in database"
        echo ""
        echo "The backfill script requires at least one branch to exist."
        echo "Please create a branch first:"
        echo ""
        echo "  INSERT INTO branches (name, location, status) VALUES"
        echo "    ('Main Branch', 'Main Location', 'active');"
        echo ""
        read -p "Do you want to create a default branch now? (y/n) " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            psql "$DB_URL" -c "INSERT INTO branches (name, location, status) VALUES ('Main Branch', 'Main Location', 'active');"
            print_success "Default branch created"
        else
            print_error "Cannot proceed without at least one branch"
            exit 1
        fi
    else
        print_success "Found $branch_count branch(es)"
    fi
    
    echo ""
}

# Create backup
create_backup() {
    print_header "Creating Database Backup"
    
    # Create backup directory if it doesn't exist
    mkdir -p "$BACKUP_DIR"
    
    local timestamp=$(date +%Y%m%d_%H%M%S)
    local backup_file="$BACKUP_DIR/backup_before_phase2_$timestamp.sql"
    
    print_info "Backing up database to: $backup_file"
    
    if pg_dump "$DB_URL" > "$backup_file" 2>/dev/null; then
        print_success "Backup created successfully"
        print_info "Backup size: $(du -h "$backup_file" | cut -f1)"
        
        # Store backup file path for potential rollback
        BACKUP_FILE="$backup_file"
    else
        print_error "Failed to create backup"
        echo ""
        read -p "Do you want to continue without backup? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
    
    echo ""
}

# Check if migration was already applied
check_migration_applied() {
    local migration_name=$1
    
    # Check if staff_profiles has branch_id column (indicates migration 1 was applied)
    if [ "$migration_name" = "$MIGRATION_1" ]; then
        local has_column=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='staff_profiles' AND column_name='branch_id';" 2>/dev/null || echo "0")
        has_column=$(echo "$has_column" | tr -d ' ')
        
        if [ "$has_column" != "0" ]; then
            return 0  # Already applied
        fi
    fi
    
    return 1  # Not applied
}

# Apply migration
apply_migration() {
    local migration_file=$1
    local migration_name=$(basename "$migration_file")
    
    print_header "Applying Migration: $migration_name"
    
    # Check if already applied
    if check_migration_applied "$migration_name"; then
        print_warning "Migration appears to be already applied"
        echo ""
        read -p "Do you want to re-apply this migration? (y/n) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            print_info "Skipping migration"
            echo ""
            return 0
        fi
    fi
    
    print_info "Executing migration..."
    
    # Apply migration with transaction
    if psql "$DB_URL" -f "$migration_file" 2>&1 | tee /tmp/migration_output.log; then
        print_success "Migration applied successfully"
        
        # Show summary from migration output
        if grep -q "NOTICE:" /tmp/migration_output.log; then
            echo ""
            print_info "Migration Summary:"
            grep "NOTICE:" /tmp/migration_output.log | sed 's/NOTICE:  /  /'
        fi
    else
        print_error "Migration failed"
        echo ""
        echo "Error details:"
        cat /tmp/migration_output.log
        echo ""
        print_error "Migration rolled back automatically"
        
        if [ -n "$BACKUP_FILE" ]; then
            echo ""
            read -p "Do you want to restore from backup? (y/n) " -n 1 -r
            echo
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                restore_backup
            fi
        fi
        
        exit 1
    fi
    
    echo ""
}

# Verify migration results
verify_migration_1() {
    print_header "Verifying Migration 1 Results"
    
    # Check if columns exist
    local tables=("staff_profiles" "staff_schedules" "staff_leave" "staff_payroll" "staff_performance")
    local all_good=true
    
    for table in "${tables[@]}"; do
        local has_column=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM information_schema.columns WHERE table_name='$table' AND column_name='branch_id';" 2>/dev/null || echo "0")
        has_column=$(echo "$has_column" | tr -d ' ')
        
        if [ "$has_column" = "0" ]; then
            print_error "Column branch_id missing in $table"
            all_good=false
        else
            print_success "Column branch_id exists in $table"
        fi
    done
    
    # Check if indexes exist
    local indexes=("idx_staff_profiles_branch_id" "idx_staff_schedules_branch_id" "idx_staff_leave_branch_id" "idx_staff_payroll_branch_id" "idx_staff_performance_branch_id")
    
    for index in "${indexes[@]}"; do
        local has_index=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM pg_indexes WHERE indexname='$index';" 2>/dev/null || echo "0")
        has_index=$(echo "$has_index" | tr -d ' ')
        
        if [ "$has_index" = "0" ]; then
            print_warning "Index $index not found"
        else
            print_success "Index $index exists"
        fi
    done
    
    if [ "$all_good" = true ]; then
        print_success "Migration 1 verification passed"
    else
        print_error "Migration 1 verification failed"
        return 1
    fi
    
    echo ""
}

# Verify migration results
verify_migration_2() {
    print_header "Verifying Migration 2 Results"
    
    # Check for NULL branch_ids in key tables
    local tables=("staff_profiles" "bookings" "restaurant_orders" "bar_orders" "finance_transactions")
    local total_nulls=0
    
    for table in "${tables[@]}"; do
        local null_count=$(psql "$DB_URL" -t -c "SELECT COUNT(*) FROM $table WHERE branch_id IS NULL;" 2>/dev/null || echo "0")
        null_count=$(echo "$null_count" | tr -d ' ')
        
        if [ "$null_count" != "0" ]; then
            print_warning "Table $table has $null_count records with NULL branch_id"
            total_nulls=$((total_nulls + null_count))
        else
            print_success "Table $table: All records have branch_id"
        fi
    done
    
    if [ "$total_nulls" = "0" ]; then
        print_success "Migration 2 verification passed - No NULL branch_ids found"
    else
        print_warning "Found $total_nulls total records with NULL branch_id"
        print_info "This may be expected for some tables"
    fi
    
    echo ""
}

# Restore from backup
restore_backup() {
    if [ -z "$BACKUP_FILE" ]; then
        print_error "No backup file available"
        return 1
    fi
    
    print_header "Restoring from Backup"
    print_warning "This will restore the database to its state before migrations"
    
    read -p "Are you sure you want to restore? (y/n) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Restore cancelled"
        return 0
    fi
    
    print_info "Restoring from: $BACKUP_FILE"
    
    if psql "$DB_URL" < "$BACKUP_FILE" 2>&1 | tee /tmp/restore_output.log; then
        print_success "Database restored successfully"
    else
        print_error "Restore failed"
        cat /tmp/restore_output.log
        exit 1
    fi
}

# Show summary
show_summary() {
    print_header "Migration Summary"
    
    echo "Migrations Applied:"
    echo "  ✓ $MIGRATION_1"
    echo "  ✓ $MIGRATION_2"
    echo ""
    
    if [ -n "$BACKUP_FILE" ]; then
        echo "Backup Location:"
        echo "  $BACKUP_FILE"
        echo ""
    fi
    
    echo "Next Steps:"
    echo "  1. Review the migration output above"
    echo "  2. Test branch isolation in your application"
    echo "  3. Review inventory item assignments:"
    echo "     psql \$DATABASE_URL -c \"SELECT sku, name, branch_id FROM simple_items;\""
    echo "  4. Update application code to include branch_id filters"
    echo "  5. Deploy updated desktop app with security fixes"
    echo ""
    
    print_success "PHASE 2 migrations completed successfully!"
}

# =====================================================
# Main Execution
# =====================================================

main() {
    clear
    
    print_header "PHASE 2 Migration Application Script"
    echo "This script will safely apply PHASE 2 migrations:"
    echo "  1. Add branch_id columns to staff tables"
    echo "  2. Backfill NULL branch_id values"
    echo ""
    
    # Pre-flight checks
    check_env_vars
    check_psql
    test_connection
    check_migrations
    check_branches
    
    # Confirm before proceeding
    print_warning "This will modify your database schema and data"
    read -p "Do you want to proceed? (y/n) " -n 1 -r
    echo
    echo ""
    
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        print_info "Migration cancelled"
        exit 0
    fi
    
    # Create backup
    create_backup
    
    # Apply migrations
    apply_migration "$MIGRATIONS_DIR/$MIGRATION_1"
    verify_migration_1
    
    apply_migration "$MIGRATIONS_DIR/$MIGRATION_2"
    verify_migration_2
    
    # Show summary
    show_summary
}

# Run main function
main "$@"
