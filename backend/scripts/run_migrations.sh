#!/bin/bash

# Load environment variables
set -a
source "$(dirname "$0")/../.env"
set +a

# Extract database connection details from DATABASE_URL
DB_URL="$DATABASE_URL"

echo "Running migrations for Famous Gate Hotel Inventory System..."

# Function to run a migration file
run_migration() {
    local file=$1
    echo "Running migration: $file"
    psql "$DB_URL" -f "$file"
    
    if [ $? -eq 0 ]; then
        echo "✅ Successfully executed $file"
    else
        echo "❌ Failed to execute $file"
        exit 1
    fi
}

# Run migrations in order
echo "1. Creating tables..."
run_migration "migrations/20251124_create_inventory_tables.sql"

echo "2. Creating functions..."
run_migration "migrations/20251124_create_inventory_functions.sql"

echo "3. Creating views..."
run_migration "migrations/20251124_create_inventory_views.sql"

echo "✨ All migrations completed successfully!"
