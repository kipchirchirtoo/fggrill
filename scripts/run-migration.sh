#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

ENV_FILE="$PROJECT_DIR/backend/.env"
MIGRATION_FILE="$PROJECT_DIR/database/migrations/20260525_add_item_name_to_order_items.sql"

if [ ! -f "$ENV_FILE" ]; then
  echo "Error: .env file not found at $ENV_FILE"
  exit 1
fi

DATABASE_URL=$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | sed 's/^DATABASE_URL=//')

if [ -z "$DATABASE_URL" ]; then
  echo "Error: DATABASE_URL not found in $ENV_FILE"
  exit 1
fi

echo "Running migration: $(basename "$MIGRATION_FILE")"
echo ""

psql "$DATABASE_URL" -f "$MIGRATION_FILE"

echo ""
echo "Migration completed successfully."
