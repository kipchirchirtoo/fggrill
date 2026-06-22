-- Reverses cashier_shift_logs aggregate totals when a POS void is approved
-- on an order that had already been (partially) paid.
--
-- Looks up every cashier_transactions row whose reference_id matches the
-- voided order, finds the cashier_shift_transactions row that links it to a
-- cashier shift, and atomically subtracts from that shift's running totals.
-- Using a PL/pgSQL function (a) keeps the multi-row loop atomic so a process
-- crash mid-void cannot leave totals half-reversed, and (b) handles partial
-- payments (multiple cashier_transactions rows for one order) correctly by
-- iterating over all of them.
CREATE OR REPLACE FUNCTION public.reverse_cashier_shift_for_order(
    p_order_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_row RECORD;
BEGIN
    FOR v_row IN
        SELECT cst.shift_id,
               ct.amount,
               ct.payment_method
        FROM cashier_transactions ct
        JOIN cashier_shift_transactions cst ON cst.transaction_id = ct.id
        WHERE ct.reference_id  = p_order_id::text
          AND ct.reference_type = 'pos_shift_orders'
          AND ct.transaction_type = 'payment'
    LOOP
        UPDATE public.cashier_shift_logs
        SET
            total_sales       = total_sales       - v_row.amount,
            transaction_count = GREATEST(0, transaction_count - 1),
            total_cash_sales  = total_cash_sales  - CASE WHEN upper(v_row.payment_method) = 'CASH'  THEN v_row.amount ELSE 0 END,
            total_mpesa_sales = total_mpesa_sales - CASE WHEN upper(v_row.payment_method) = 'MPESA' THEN v_row.amount ELSE 0 END,
            total_card_sales  = total_card_sales  - CASE WHEN upper(v_row.payment_method) = 'CARD'  THEN v_row.amount ELSE 0 END,
            updated_at        = NOW()
        WHERE id = v_row.shift_id;
    END LOOP;
END;
$$;

NOTIFY pgrst, 'reload schema';
