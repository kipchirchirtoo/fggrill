-- Recalculate shift totals from existing transactions
-- Run this SQL in your Supabase SQL Editor to fix existing shifts

UPDATE cashier_shifts cs
SET 
  total_revenue = COALESCE(tx_totals.total_revenue, 0),
  total_cash_in = COALESCE(tx_totals.total_cash, 0),
  total_mpesa_in = COALESCE(tx_totals.total_mpesa, 0),
  total_card_in = COALESCE(tx_totals.total_card, 0),
  total_transactions = COALESCE(tx_totals.tx_count, 0),
  updated_at = NOW()
FROM (
  SELECT 
    shift_id,
    SUM(total_amount) as total_revenue,
    SUM(cash_amount) as total_cash,
    SUM(mpesa_amount) as total_mpesa,
    SUM(card_amount) as total_card,
    COUNT(*) as tx_count
  FROM shift_transactions
  WHERE is_voided = false
  GROUP BY shift_id
) tx_totals
WHERE cs.id = tx_totals.shift_id
  AND cs.status = 'open';

-- Verify the update
SELECT 
  cs.id,
  cs.shift_number,
  cs.status,
  cs.total_revenue,
  cs.total_cash_in,
  cs.total_mpesa_in,
  cs.total_card_in,
  cs.total_transactions,
  COUNT(st.id) as actual_tx_count,
  SUM(st.total_amount) as actual_revenue
FROM cashier_shifts cs
LEFT JOIN shift_transactions st ON st.shift_id = cs.id AND st.is_voided = false
WHERE cs.status = 'open'
GROUP BY cs.id, cs.shift_number, cs.status, cs.total_revenue, cs.total_cash_in, cs.total_mpesa_in, cs.total_card_in, cs.total_transactions
ORDER BY cs.start_time DESC;
