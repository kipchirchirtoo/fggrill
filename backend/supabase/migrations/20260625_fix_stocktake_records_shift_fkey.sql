-- Migration to fix the foreign key for shift_id on stocktake tables to point to cashier_shift_logs
ALTER TABLE IF EXISTS bar_stocktake_records
  DROP CONSTRAINT IF EXISTS bar_stocktake_records_shift_id_fkey,
  ADD CONSTRAINT bar_stocktake_records_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES cashier_shift_logs(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS store_stocktake_records
  DROP CONSTRAINT IF EXISTS store_stocktake_records_shift_id_fkey,
  ADD CONSTRAINT store_stocktake_records_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES cashier_shift_logs(id) ON DELETE SET NULL;
