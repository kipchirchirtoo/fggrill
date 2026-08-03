-- ──────────────────────────────────────────────────────────────────────────────
-- Migration: 20260803_fix_offers_created_by_fk.sql
-- Reason:    The system uses custom JWT with users in public.users, not
--            auth.users. The original FK on offers.created_by referenced
--            auth.users which caused a FK violation on every INSERT.
--            created_by is an audit-only field so no FK is needed.
-- ──────────────────────────────────────────────────────────────────────────────
ALTER TABLE public.offers
  DROP CONSTRAINT IF EXISTS offers_created_by_fkey;
