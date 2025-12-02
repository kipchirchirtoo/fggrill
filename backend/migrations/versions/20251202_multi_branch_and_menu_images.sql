-- Migration: Add multi-branch support and menu images
-- Date: 2025-12-02

-- Add branch_id to restaurant_menu_items if not exists (branches.id is INTEGER)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'restaurant_menu_items' AND column_name = 'branch_id') THEN
        ALTER TABLE restaurant_menu_items ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    END IF;
END $$;

-- image_url already exists in restaurant_menu_items, skip

-- Add branch_id to restaurant_menu_categories if not exists
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'restaurant_menu_categories' AND column_name = 'branch_id') THEN
        ALTER TABLE restaurant_menu_categories ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    END IF;
END $$;

-- Add branch_id to restaurant_orders if not exists (as INTEGER to match branches.id)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'restaurant_orders' AND column_name = 'branch_id') THEN
        ALTER TABLE restaurant_orders ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    END IF;
END $$;

-- Add branch_id to receipts if not exists (as INTEGER to match branches.id)
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'receipts' AND column_name = 'branch_id') THEN
        ALTER TABLE receipts ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    END IF;
END $$;

-- Add branch_id to invoices if table exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'invoices') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'invoices' AND column_name = 'branch_id') THEN
            ALTER TABLE invoices ADD COLUMN branch_id INTEGER REFERENCES branches(id);
        END IF;
    END IF;
END $$;

-- Add branch_id to expenses if not exists
DO $$ 
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'expenses') THEN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                       WHERE table_name = 'expenses' AND column_name = 'branch_id') THEN
            ALTER TABLE expenses ADD COLUMN branch_id INTEGER REFERENCES branches(id);
        END IF;
    END IF;
END $$;

-- Create indexes for branch filtering
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_items_branch ON restaurant_menu_items(branch_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_menu_categories_branch ON restaurant_menu_categories(branch_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_branch ON restaurant_orders(branch_id);
CREATE INDEX IF NOT EXISTS idx_receipts_branch ON receipts(branch_id);

-- Create storage bucket for menu images (this is informational - actual bucket created via Supabase dashboard)
-- Bucket name: menu-images
-- Public access: true
-- Allowed MIME types: image/jpeg, image/png, image/webp, image/gif

COMMENT ON COLUMN restaurant_menu_items.image_url IS 'URL to menu item image stored in Supabase storage bucket menu-images';
COMMENT ON COLUMN restaurant_menu_items.branch_id IS 'Branch this menu item belongs to. NULL means available at all branches';
