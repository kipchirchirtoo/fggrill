-- ============================================================
-- 0030_drop_generate_shift_number_noarg.sql
-- Two overloads of generate_shift_number() exist:
--   generate_shift_number()                     -- old, random
--   generate_shift_number(p_branch_id integer)  -- new, sequential
-- PostgREST (PGRST203) cannot resolve which to call when
-- the controller calls rpc('generate_shift_number') with no
-- args, because the second overload has a DEFAULT.
-- Drop the old no-arg version; the controller now passes
-- p_branch_id explicitly.
-- ============================================================

DROP FUNCTION IF EXISTS public.generate_shift_number();
