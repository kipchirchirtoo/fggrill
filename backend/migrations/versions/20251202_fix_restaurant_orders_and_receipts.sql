-- Migration: Fix restaurant_orders table and create receipts tables
-- Date: 2025-12-02

-- Add status column to restaurant_orders if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'restaurant_orders' AND column_name = 'status') THEN
        ALTER TABLE restaurant_orders ADD COLUMN status VARCHAR(30) DEFAULT 'pending';
    END IF;
END $$;

-- Add payment_method column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'restaurant_orders' AND column_name = 'payment_method') THEN
        ALTER TABLE restaurant_orders ADD COLUMN payment_method VARCHAR(30);
    END IF;
END $$;

-- Add payment_status column if it doesn't exist
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name = 'restaurant_orders' AND column_name = 'payment_status') THEN
        ALTER TABLE restaurant_orders ADD COLUMN payment_status VARCHAR(20) DEFAULT 'pending';
    END IF;
END $$;

-- Create receipts table if not exists
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(50) UNIQUE,
    receipt_type VARCHAR(20) NOT NULL DEFAULT 'sale',
    
    order_id UUID,
    invoice_id UUID,
    booking_id UUID,
    
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    table_number VARCHAR(20),
    room_number VARCHAR(20),
    
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 16.00,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    discount_reason VARCHAR(255),
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    payment_method VARCHAR(30),
    payment_reference VARCHAR(100),
    amount_paid DECIMAL(12,2) DEFAULT 0,
    change_amount DECIMAL(12,2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'paid',
    
    branch_id UUID,
    created_by UUID,
    cashier_name VARCHAR(255),
    
    notes TEXT,
    is_printed BOOLEAN DEFAULT FALSE,
    is_emailed BOOLEAN DEFAULT FALSE,
    pdf_url TEXT,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create receipt items table if not exists
CREATE TABLE IF NOT EXISTS receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    
    item_name VARCHAR(255) NOT NULL,
    item_sku VARCHAR(50),
    description TEXT,
    category VARCHAR(100),
    
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'piece',
    unit_price DECIMAL(12,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    
    menu_item_id UUID,
    inventory_item_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create sequence for receipt numbers if not exists
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_sequences WHERE schemaname = 'public' AND sequencename = 'receipt_number_seq') THEN
        CREATE SEQUENCE receipt_number_seq START 1000;
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_receipts_branch ON receipts(branch_id);
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_type ON receipts(receipt_type);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON receipt_items(receipt_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_status ON restaurant_orders(status);
