-- High-Performance Database Indexes for Cashier Lookup Codes & Realtime Supabase Publication
-- Created: 2026-08-05

-- 1. POS Shift Orders lookup indexes (order_number, short_code, table_number)
CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_order_number ON pos_shift_orders (order_number);
CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_short_code ON pos_shift_orders (short_code);
CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_lookup_lower ON pos_shift_orders (LOWER(order_number), LOWER(COALESCE(short_code, '')));
CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_unpaid_lookup ON pos_shift_orders (payment_status, branch_id, order_number, short_code);

-- 2. Master Customer Bills lookup indexes
CREATE INDEX IF NOT EXISTS idx_pos_customer_bills_short_code ON pos_customer_bills (short_code);
CREATE INDEX IF NOT EXISTS idx_pos_customer_bills_master_code ON pos_customer_bills (master_bill_code);
CREATE INDEX IF NOT EXISTS idx_pos_customer_bills_bill_number ON pos_customer_bills (bill_number);

-- 3. Restaurant Bills & Bookings lookup indexes
CREATE INDEX IF NOT EXISTS idx_restaurant_bills_short_code ON restaurant_bills (short_code);
CREATE INDEX IF NOT EXISTS idx_restaurant_bills_bill_number ON restaurant_bills (bill_number);
CREATE INDEX IF NOT EXISTS idx_bookings_booking_reference ON bookings (booking_reference);
CREATE INDEX IF NOT EXISTS idx_bookings_short_code ON bookings (short_code);

-- 4. Enable Supabase Realtime publication on all billing & order tables for instant cashier updates
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pos_shift_orders') THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE pos_shift_orders';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pos_customer_bills') THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE pos_customer_bills';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'restaurant_bills') THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_bills';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'bookings') THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE bookings';
    END IF;

    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'cashier_shift_transactions') THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE cashier_shift_transactions';
    END IF;
END $$;
