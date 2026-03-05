CREATE OR REPLACE FUNCTION generate_po_number()
RETURNS TEXT AS $$
DECLARE
  v_year TEXT;
  v_month TEXT;
  v_counter INT;
  v_po_number TEXT;
BEGIN
  v_year := EXTRACT(YEAR FROM CURRENT_DATE)::TEXT;
  v_month := LPAD(EXTRACT(MONTH FROM CURRENT_DATE)::TEXT, 2, '0');
  
  SELECT COALESCE(MAX(SUBSTRING(spo.po_number FROM '\d+$')::INT), 0) + 1
  INTO v_counter
  FROM store_purchase_orders spo
  WHERE spo.po_number LIKE 'PO-' || v_year || v_month || '-%';
  
  v_po_number := 'PO-' || v_year || v_month || '-' || LPAD(v_counter::TEXT, 4, '0');
  RETURN v_po_number;
END;
$$ LANGUAGE plpgsql;
