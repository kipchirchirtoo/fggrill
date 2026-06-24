-- Pastry production was logged against a `shift_id` FK targeting
-- cashier_shifts(id) — a dead, abandoned-migration table with 0 rows
-- (confirmed separately this session). The Branch Storekeeper UI never
-- actually sent a cashier_shifts UUID into this column anyway (it sent the
-- literal string 'day'/'night', which a UUID column can't even store), so
-- "Issue to Kitchen" never linked a pastry batch to anything real. Re-point
-- the FK at kitchen_shifts(id), the actual populated shift system, so an
-- issued batch can be tied to the open Kitchen Shift that received it.

DO $$
DECLARE
  fk_name TEXT;
BEGIN
  SELECT con.conname INTO fk_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'pastry_production_log'
    AND con.contype = 'f'
    AND con.conkey = (
      SELECT array_agg(attnum) FROM pg_attribute
      WHERE attrelid = rel.oid AND attname = 'shift_id'
    );

  IF fk_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE pastry_production_log DROP CONSTRAINT %I', fk_name);
  END IF;
END $$;

ALTER TABLE pastry_production_log
  ADD CONSTRAINT pastry_production_log_shift_id_fkey
  FOREIGN KEY (shift_id) REFERENCES kitchen_shifts(id);
