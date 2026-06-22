-- Atomic helper called by linkPaymentToActiveShift each time a payment is
-- linked to a cashier shift. Using a PL/pgSQL function keeps the increment
-- atomic (single UPDATE statement) so two simultaneous payments from the
-- same cashier never double-count or drop each other's amount, even if
-- the application code reads then writes at the JavaScript level.
CREATE OR REPLACE FUNCTION public.increment_cashier_shift_totals(
    p_shift_id   UUID,
    p_amount     NUMERIC,
    p_method     TEXT          -- 'CASH' | 'MPESA' | 'CARD' | anything else
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    UPDATE public.cashier_shift_logs
    SET
        total_sales       = total_sales       + p_amount,
        transaction_count = transaction_count + 1,
        total_cash_sales  = total_cash_sales  + CASE WHEN upper(p_method) = 'CASH'  THEN p_amount ELSE 0 END,
        total_mpesa_sales = total_mpesa_sales + CASE WHEN upper(p_method) = 'MPESA' THEN p_amount ELSE 0 END,
        total_card_sales  = total_card_sales  + CASE WHEN upper(p_method) = 'CARD'  THEN p_amount ELSE 0 END,
        updated_at        = NOW()
    WHERE id = p_shift_id;
END;
$$;

-- Reload PostgREST schema cache so the new function is immediately callable
-- via supabase.rpc('increment_cashier_shift_totals', ...)
NOTIFY pgrst, 'reload schema';
