-- Enable Supabase Realtime for the tables powering the new live KDS, Bar, and Cashier feeds.
-- This command safely adds these specific tables to the 'supabase_realtime' publication
-- only if they aren't already included.

DO $$
BEGIN
    -- restaurant_orders
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'restaurant_orders') THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_orders';
    END IF;

    -- restaurant_order_items
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'restaurant_order_items') THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE restaurant_order_items';
    END IF;

    -- pos_shift_orders
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pos_shift_orders') THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE pos_shift_orders';
    END IF;

    -- pos_item_void_requests
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND tablename = 'pos_item_void_requests') THEN
        EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE pos_item_void_requests';
    END IF;
END $$;
