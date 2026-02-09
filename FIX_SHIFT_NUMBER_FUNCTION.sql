-- =====================================================
-- HOTFIX: Update generate_shift_number() function
-- Fixes ambiguous column reference error
-- Run this directly on production database via Supabase SQL Editor
-- =====================================================

CREATE OR REPLACE FUNCTION generate_shift_number()
RETURNS TEXT AS $$
DECLARE
  shift_date TEXT;
  shift_seq INT;
  new_shift_number TEXT;
BEGIN
  shift_date := TO_CHAR(NOW(), 'YYMMDD');
  
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM cashier_shift_logs
    WHERE cashier_shift_logs.shift_number LIKE 'SFT' || shift_date || '%'
  )
  SELECT next_seq INTO shift_seq FROM seq;
  
  new_shift_number := 'SFT' || shift_date || LPAD(shift_seq::TEXT, 4, '0');
  
  RETURN new_shift_number;
END;
$$ LANGUAGE plpgsql;

-- Test the function
SELECT generate_shift_number();
