-- Fix: cashier shift numbers collided across branches.
--
-- generate_shift_number used a PER-BRANCH daily sequence
-- ('shft:<branch>:<date>') while cashier_shift_logs_shift_number_uidx is
-- GLOBAL on shift_number — so two branches opening shifts on the same day
-- both produced SHF-<date>-0001 and the second branch's insert failed with
-- 23505 until its counter leapfrogged the other branch's numbers.
--
-- New behavior: one global per-day sequence, with an existence loop that
-- skips any numbers already taken (e.g. by the old per-branch scheme earlier
-- the same day). Format is unchanged: SHF-YYYYMMDD-NNNN.

CREATE OR REPLACE FUNCTION public.generate_shift_number(p_branch_id integer DEFAULT NULL::integer)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  seq BIGINT;
  candidate TEXT;
BEGIN
  LOOP
    seq := public._next_seq('shft:g:' || TO_CHAR(NOW(), 'YYYYMMDD'));
    candidate := 'SHF-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq::TEXT, 4, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.cashier_shift_logs WHERE shift_number = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$function$;
