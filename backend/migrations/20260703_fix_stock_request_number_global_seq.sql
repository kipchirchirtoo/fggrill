-- Fix: stock request numbers collided across branches (same defect as the
-- cashier shift numbers fixed in 20260702_fix_shift_number_global_seq.sql).
--
-- get_next_stock_request_number used a PER-BRANCH monthly sequence
-- ('sr:<branch>:<YYYYMM>') while branch_requisitions_request_number_key is
-- GLOBAL — so each branch's first request of the month regenerated
-- SR-<month>-00001 and collided with whichever branch got there first.
--
-- New behavior: one global monthly sequence with an existence loop that
-- skips numbers already taken by the old per-branch scheme. Format is
-- unchanged: SR-YYYYMM-NNNNN.

CREATE OR REPLACE FUNCTION public.get_next_stock_request_number(p_branch_id integer DEFAULT NULL::integer)
 RETURNS text
 LANGUAGE plpgsql
AS $function$
DECLARE
  seq BIGINT;
  candidate TEXT;
BEGIN
  LOOP
    seq := public._next_seq('sr:g:' || TO_CHAR(NOW(), 'YYYYMM'));
    candidate := 'SR-' || TO_CHAR(NOW(), 'YYYYMM') || '-' || LPAD(seq::TEXT, 5, '0');
    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.branch_requisitions WHERE request_number = candidate
    );
  END LOOP;
  RETURN candidate;
END;
$function$;
