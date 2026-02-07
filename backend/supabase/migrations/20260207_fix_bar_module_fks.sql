-- Migration: Fix missing FKs in Bar Module
-- This ensures Supabase joins work correctly for analytics and oversight.

DO $$ 
BEGIN
    -- 1. Fix bar_orders
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_bar_orders_branch') THEN
        ALTER TABLE bar_orders ADD CONSTRAINT fk_bar_orders_branch FOREIGN KEY (branch_id) REFERENCES branches(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_bar_orders_waiter') THEN
        ALTER TABLE bar_orders ADD CONSTRAINT fk_bar_orders_waiter FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;

    -- 2. Fix bar_drinks
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_bar_drinks_branch') THEN
        ALTER TABLE bar_drinks ADD CONSTRAINT fk_bar_drinks_branch FOREIGN KEY (branch_id) REFERENCES branches(id);
    END IF;

    -- 3. Fix bar_tabs
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_bar_tabs_branch') THEN
        ALTER TABLE bar_tabs ADD CONSTRAINT fk_bar_tabs_branch FOREIGN KEY (branch_id) REFERENCES branches(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_bar_tabs_created_by') THEN
        ALTER TABLE bar_tabs ADD CONSTRAINT fk_bar_tabs_created_by FOREIGN KEY (created_by) REFERENCES users(id);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_bar_tabs_closed_by') THEN
        ALTER TABLE bar_tabs ADD CONSTRAINT fk_bar_tabs_closed_by FOREIGN KEY (closed_by) REFERENCES users(id);
    END IF;

    -- 4. Fix bar_stock
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_bar_stock_branch') THEN
        ALTER TABLE bar_stock ADD CONSTRAINT fk_bar_stock_branch FOREIGN KEY (branch_id) REFERENCES branches(id);
    END IF;
END $$;
