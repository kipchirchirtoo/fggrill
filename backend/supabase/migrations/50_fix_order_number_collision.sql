-- Fix generate_order_number to be collision-resistant
-- The original function used COUNT(*)+1 which is not atomic and causes
-- duplicate order_number errors (Postgres error 23505) under concurrent load.
-- This version appends a random 4-char hex suffix to guarantee uniqueness.

CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  order_date TEXT;
  order_seq  INT;
  order_number TEXT;
  random_suffix TEXT;
BEGIN
  order_date := TO_CHAR(NOW(), 'YYMMDD');

  SELECT COUNT(*) + 1
    INTO order_seq
    FROM restaurant_orders
   WHERE order_number LIKE 'ORD' || order_date || '%';

  -- Append a random 4-char hex suffix to prevent collisions on concurrent inserts
  random_suffix := UPPER(SUBSTRING(MD5(RANDOM()::TEXT), 1, 4));

  order_number := 'ORD' || order_date || LPAD(order_seq::TEXT, 4, '0') || random_suffix;

  RETURN order_number;
END;
$$ LANGUAGE plpgsql;
