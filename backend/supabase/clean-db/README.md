# FamousGate Clean Database Rebuild

This folder is the clean-database rebuild package. It is intentionally separate
from the existing migration roots because the current database has many patch
migrations, duplicate tables, and module-specific ledgers.

## What This Package Is For

- Building a brand-new Supabase/PostgreSQL database.
- Loading the old dirty database into a temporary `legacy_import` schema.
- Transforming old rows into canonical tables.
- Keeping current REST API contracts stable while backend repositories are moved
  to the canonical schema.

## What This Package Must Not Do

- Do not run these migrations against the current production database.
- Do not drop existing production tables.
- Do not expose service role keys or database passwords in docs or commits.
- Do not migrate the 421 empty old tables unless an active endpoint genuinely
  needs a canonical replacement.

## Environment Variables

Use these side-by-side variables during rebuild:

```bash
DATABASE_URL_OLD=postgresql://...
DATABASE_URL_NEW=postgresql://...
SUPABASE_OLD_URL=https://old-project.supabase.co
SUPABASE_NEW_URL=https://new-project.supabase.co
SUPABASE_OLD_SERVICE_ROLE_KEY=...
SUPABASE_NEW_SERVICE_ROLE_KEY=...
```

The current `DATABASE_URL` and `SUPABASE_*` variables should continue pointing
to the running app until cutover.

## Execution Order

1. Create a new Supabase project.
2. Apply `migrations/0001_clean_core_schema.sql` to the new project.
3. Import old tables into `legacy_import`.
4. Run ETL scripts in dry-run mode and review reconciliation output.
5. Run ETL with `--execute` only after reconciliation passes.
6. Switch backend environment variables to the new project.
7. Keep the old database read-only until module-level smoke tests pass.

## Safety Rule

All operational stock changes must pass through `inventory_movements`.
All financial/document decisions must create `audit_events` or `workflow_tasks`.

