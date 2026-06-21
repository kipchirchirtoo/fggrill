#!/usr/bin/env bash
# Run the 3 pending 2026-06-19 migrations against Supabase, in order.
# Usage:
#   export SUPABASE_DB_URL="postgresql://...your-own-connection-string..."
#   ./scripts/run_pending_migrations_20260619.sh
# Run from the backend/ directory (paths below are relative to it).

set -euo pipefail

if [ -z "${SUPABASE_DB_URL:-}" ]; then
  echo "ERROR: SUPABASE_DB_URL is not set. Export it in your shell first:" >&2
  echo '  export SUPABASE_DB_URL="postgresql://user:pass@host:port/dbname"' >&2
  exit 1
fi

MIGRATIONS=(
  "supabase/migrations/20260619_fix_pos_shift_orders_branch_id.sql"
  "supabase/migrations/20260619_branch_2_bomet_bar_initial_stock.sql"
  "supabase/clean-db/migrations/0042_fix_nonconsumables_outlet_type.sql"
)

for file in "${MIGRATIONS[@]}"; do
  if [ ! -f "$file" ]; then
    echo "ERROR: $file not found (are you running this from the backend/ directory?)" >&2
    exit 1
  fi
done

for file in "${MIGRATIONS[@]}"; do
  echo "============================================================"
  echo "Running: $file"
  echo "============================================================"
  psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$file"
  status=$?
  if [ $status -ne 0 ]; then
    echo "FAILED: $file (exit code $status). Stopping before next migration." >&2
    exit $status
  fi
  echo "OK: $file completed."
  echo
done

echo "All 3 migrations completed successfully."
