-- =====================================================
-- CORPORATE CREDIT — MULTI BILL TYPE SUPPORT
-- Migration: 20260828_corporate_credit_bill_types.sql
-- Description:
--   corporate_credit_bills could only reference a POS master bill
--   (pos_bill_id -> master_bills). Generalize it so room folios and
--   conference bills can also be charged to a corporate account:
--     reference_type: 'pos' | 'room_folio' | 'conference'
--     reference_id  : id of the source bill (pos master bill, reservation, or
--                     conference booking).
--   pos_bill_id is kept for POS back-compat and its existing FK; it stays NULL
--   for room/conference charges (the FK only allows master_bills ids).
-- =====================================================

ALTER TABLE public.corporate_credit_bills
  ADD COLUMN IF NOT EXISTS reference_type VARCHAR(30) NOT NULL DEFAULT 'pos'
    CHECK (reference_type IN ('pos', 'room_folio', 'conference')),
  ADD COLUMN IF NOT EXISTS reference_id UUID;

-- Existing rows are all POS charges — point reference_id at the pos_bill_id.
UPDATE public.corporate_credit_bills
   SET reference_type = 'pos',
       reference_id = pos_bill_id
 WHERE reference_id IS NULL
   AND pos_bill_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_corporate_credit_bills_reference
  ON public.corporate_credit_bills(reference_type, reference_id);

COMMENT ON COLUMN public.corporate_credit_bills.reference_type IS
  'Source bill type: pos | room_folio | conference.';
COMMENT ON COLUMN public.corporate_credit_bills.reference_id IS
  'Id of the source bill: pos master bill (also in pos_bill_id), reservation (room folio), or conference booking.';
