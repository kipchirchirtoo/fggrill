-- Paybill + account number as an alternative to a till number, per POS outlet and as a branch default.
-- A paybill number must always come with an account number (and the other way round).
BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE public.branches
  ADD COLUMN IF NOT EXISTS default_paybill_number  text,
  ADD COLUMN IF NOT EXISTS default_paybill_account text;
ALTER TABLE public.pos_outlets
  ADD COLUMN IF NOT EXISTS paybill_number  text,
  ADD COLUMN IF NOT EXISTS paybill_account text;

ALTER TABLE public.branches DROP CONSTRAINT IF EXISTS branches_paybill_pair_chk;
ALTER TABLE public.branches ADD CONSTRAINT branches_paybill_pair_chk
  CHECK ((default_paybill_number IS NULL) = (default_paybill_account IS NULL));
ALTER TABLE public.pos_outlets DROP CONSTRAINT IF EXISTS pos_outlets_paybill_pair_chk;
ALTER TABLE public.pos_outlets ADD CONSTRAINT pos_outlets_paybill_pair_chk
  CHECK ((paybill_number IS NULL) = (paybill_account IS NULL));

COMMIT;

-- Rollback:
--   ALTER TABLE public.branches DROP CONSTRAINT branches_paybill_pair_chk, DROP COLUMN default_paybill_number, DROP COLUMN default_paybill_account;
--   ALTER TABLE public.pos_outlets DROP CONSTRAINT pos_outlets_paybill_pair_chk, DROP COLUMN paybill_number, DROP COLUMN paybill_account;
