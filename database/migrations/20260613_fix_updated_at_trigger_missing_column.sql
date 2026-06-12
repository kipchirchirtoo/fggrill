-- ============================================================================
-- FIX: "record \"new\" has no field \"updated_at\"" on Central Store master
-- inventory (and other) writes.
--
-- ROOT CAUSE
--   The shared BEFORE UPDATE trigger function update_updated_at_column() does
--   `NEW.updated_at := NOW()`. The 20260415_phase3a migration attached this
--   trigger to several pre-existing tables via `CREATE TABLE IF NOT EXISTS`
--   (a no-op on tables that already existed), so the trigger was created but the
--   `updated_at` column was never actually added. Every UPDATE on those tables
--   then fails — including the Master Inventory soft-delete / edit / status
--   updates, which run `UPDATE simple_items SET is_active = ...`.
--
--   Confirmed broken tables (trigger present, column missing):
--     simple_items, simple_app_config, stock_take_items,
--     cashier_transactions, expenses, audit_approvals
-- ============================================================================

-- 1) Make the shared trigger function defensive: only stamp updated_at when the
--    row actually has that column. This permanently protects EVERY table that
--    uses this trigger, present and future.
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  IF to_jsonb(NEW) ? 'updated_at' THEN
    NEW.updated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Add the missing updated_at column to the affected tables so the timestamp
--    is genuinely tracked (idempotent; existing rows take the NOW() default).
ALTER TABLE IF EXISTS simple_items         ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS simple_app_config    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS stock_take_items     ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS cashier_transactions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS expenses             ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE IF EXISTS audit_approvals      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 3) Seed updated_at from the legacy last_updated column on simple_items where
--    available so history is preserved rather than reset to migration time.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'simple_items' AND column_name = 'last_updated'
  ) THEN
    UPDATE simple_items
       SET updated_at = COALESCE(updated_at, last_updated, NOW());
  END IF;
END $$;
