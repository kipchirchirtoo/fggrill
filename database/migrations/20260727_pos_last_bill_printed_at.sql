-- =====================================================================
-- POS bills — track the EXACT time a bill was LAST printed
-- =====================================================================
-- pos_shift_orders already has:
--   original_bill_printed_at  -> first customer-bill print
--   bill_reprint_count        -> number of duplicate reprints (no time)
--   captain_printed_at        -> last kitchen/bar ticket print
--
-- There was no single timestamp that reflects the LAST customer-bill print
-- (original OR reprint). This adds one so the app can display "last printed
-- at <exact Kenyan time>" on every bill, including reprints and recalled
-- bills, for accountability. Updated on both the original print and each
-- reprint by the backend (markOriginalBillPrinted / reprintShiftOrderBill).
--
-- Safe to run multiple times.
-- =====================================================================

ALTER TABLE pos_shift_orders
  ADD COLUMN IF NOT EXISTS last_bill_printed_at TIMESTAMPTZ;

-- Backfill existing rows so historical bills show a sensible value.
UPDATE pos_shift_orders
   SET last_bill_printed_at = COALESCE(original_bill_printed_at, captain_printed_at)
 WHERE last_bill_printed_at IS NULL
   AND (original_bill_printed_at IS NOT NULL OR captain_printed_at IS NOT NULL);
