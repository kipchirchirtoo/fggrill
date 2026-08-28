#!/bin/bash

# Run Bar Module Migration
# Usage: ./scripts/run-bar-migration.sh

echo "========================================="
echo "Running Bar Module Migration"
echo "Famous Gate Hotel"
echo "========================================="

# Load environment variables
if [ -f .env ]; then
  export $(cat .env | grep -v '#' | awk '/=/ {print $1}')
fi

# Default database URL
DB_URL="${DATABASE_URL:-postgresql://postgres:postgres@localhost:5432/fggrill}"

echo ""
echo "Using database: $DB_URL"
echo ""

# Run main bar module migration
echo "Step 1: Creating bar tables..."
psql "$DB_URL" -f src/database/migrations/20251128_bar_module.sql

if [ $? -eq 0 ]; then
  echo "✓ Bar tables created successfully"
else
  echo "✗ Error creating bar tables"
  exit 1
fi

# Run seed data
echo ""
echo "Step 2: Seeding drink data..."
psql "$DB_URL" -f src/database/migrations/20251128_bar_seed_data.sql

if [ $? -eq 0 ]; then
  echo "✓ Drink data seeded successfully"
else
  echo "✗ Error seeding drink data"
  exit 1
fi

echo ""
echo "========================================="
echo "Bar Module Migration Complete!"
echo "========================================="
echo ""
echo "Tables created:"
echo "  - bar_drink_categories"
echo "  - bar_drinks"
echo "  - bar_orders"
echo "  - bar_order_items"
echo "  - bar_tabs"
echo "  - bar_tab_items"
echo "  - bar_stock"
echo ""
echo "You can now login as bartender:"
echo "  Email: bartender@famousgate.com"
echo "  Password: bar123"
echo ""
