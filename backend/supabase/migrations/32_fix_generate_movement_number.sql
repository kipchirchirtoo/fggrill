-- =====================================================
-- FIX AMBIGUOUS COLUMN REFERENCE
-- Corrects generate_movement_number function
-- =====================================================

CREATE OR REPLACE FUNCTION generate_movement_number()
RETURNS TEXT AS $$
DECLARE
  mov_date TEXT;
  v_next_seq INT;
  mov_number TEXT;
BEGIN
  mov_date := TO_CHAR(NOW(), 'YYMMDD');
  
  WITH seq AS (
    SELECT COUNT(*) + 1 as val
    FROM store_stock_movements
    WHERE movement_number LIKE 'MOV' || mov_date || '%'
  )
  SELECT val INTO v_next_seq FROM seq;
  
  mov_number := 'MOV' || mov_date || LPAD(COALESCE(v_next_seq, 1)::TEXT, 5, '0');
  
  RETURN mov_number;
END;
$$ LANGUAGE plpgsql;
