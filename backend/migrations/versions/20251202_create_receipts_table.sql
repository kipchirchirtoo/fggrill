-- Migration: Create receipts and receipt_items tables
-- Date: 2025-12-02
-- Description: Add receipts tracking for POS, invoices, and finance integration

-- Receipts table
CREATE TABLE IF NOT EXISTS receipts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_number VARCHAR(50) UNIQUE NOT NULL,
    receipt_type VARCHAR(20) NOT NULL CHECK (receipt_type IN ('sale', 'refund', 'invoice', 'inventory')),
    
    -- Order/Transaction reference
    order_id UUID REFERENCES restaurant_orders(id),
    invoice_id UUID REFERENCES invoices(id),
    booking_id UUID REFERENCES bookings(id),
    
    -- Customer info
    customer_name VARCHAR(255),
    customer_email VARCHAR(255),
    customer_phone VARCHAR(50),
    table_number VARCHAR(20),
    room_number VARCHAR(20),
    
    -- Financial details
    subtotal DECIMAL(12,2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5,2) DEFAULT 16.00,
    tax_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    discount_reason VARCHAR(255),
    total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
    
    -- Payment info
    payment_method VARCHAR(30) CHECK (payment_method IN ('cash', 'mpesa', 'card', 'bank_transfer', 'credit', 'mixed')),
    payment_reference VARCHAR(100),
    amount_paid DECIMAL(12,2) DEFAULT 0,
    change_amount DECIMAL(12,2) DEFAULT 0,
    payment_status VARCHAR(20) DEFAULT 'paid' CHECK (payment_status IN ('pending', 'partial', 'paid', 'refunded')),
    
    -- Branch and staff
    branch_id UUID REFERENCES branches(id),
    created_by UUID REFERENCES users(id),
    cashier_name VARCHAR(255),
    
    -- Metadata
    notes TEXT,
    is_printed BOOLEAN DEFAULT FALSE,
    is_emailed BOOLEAN DEFAULT FALSE,
    pdf_url TEXT,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipt items table
CREATE TABLE IF NOT EXISTS receipt_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    receipt_id UUID NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
    
    -- Item details
    item_name VARCHAR(255) NOT NULL,
    item_sku VARCHAR(50),
    description TEXT,
    category VARCHAR(100),
    
    -- Quantity and pricing
    quantity DECIMAL(10,2) NOT NULL DEFAULT 1,
    unit VARCHAR(20) DEFAULT 'piece',
    unit_price DECIMAL(12,2) NOT NULL,
    discount_percent DECIMAL(5,2) DEFAULT 0,
    discount_amount DECIMAL(12,2) DEFAULT 0,
    tax_amount DECIMAL(12,2) DEFAULT 0,
    total_amount DECIMAL(12,2) NOT NULL,
    
    -- Reference
    menu_item_id UUID,
    inventory_item_id UUID,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Receipt sequence for generating receipt numbers
CREATE SEQUENCE IF NOT EXISTS receipt_number_seq START 1000;

-- Function to generate receipt number
CREATE OR REPLACE FUNCTION generate_receipt_number(receipt_type VARCHAR)
RETURNS VARCHAR AS $$
DECLARE
    prefix VARCHAR(3);
    seq_num INTEGER;
BEGIN
    CASE receipt_type
        WHEN 'sale' THEN prefix := 'RCP';
        WHEN 'refund' THEN prefix := 'REF';
        WHEN 'invoice' THEN prefix := 'INV';
        WHEN 'inventory' THEN prefix := 'STK';
        ELSE prefix := 'RCP';
    END CASE;
    
    seq_num := nextval('receipt_number_seq');
    RETURN prefix || '-' || TO_CHAR(NOW(), 'YYYYMMDD') || '-' || LPAD(seq_num::TEXT, 6, '0');
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate receipt number
CREATE OR REPLACE FUNCTION set_receipt_number()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.receipt_number IS NULL THEN
        NEW.receipt_number := generate_receipt_number(NEW.receipt_type);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_set_receipt_number ON receipts;
CREATE TRIGGER trigger_set_receipt_number
    BEFORE INSERT ON receipts
    FOR EACH ROW
    EXECUTE FUNCTION set_receipt_number();

-- Update timestamp trigger
CREATE OR REPLACE FUNCTION update_receipt_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_receipt_timestamp ON receipts;
CREATE TRIGGER trigger_update_receipt_timestamp
    BEFORE UPDATE ON receipts
    FOR EACH ROW
    EXECUTE FUNCTION update_receipt_timestamp();

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_receipts_branch ON receipts(branch_id);
CREATE INDEX IF NOT EXISTS idx_receipts_created_at ON receipts(created_at);
CREATE INDEX IF NOT EXISTS idx_receipts_receipt_type ON receipts(receipt_type);
CREATE INDEX IF NOT EXISTS idx_receipts_payment_status ON receipts(payment_status);
CREATE INDEX IF NOT EXISTS idx_receipts_order_id ON receipts(order_id);
CREATE INDEX IF NOT EXISTS idx_receipt_items_receipt ON receipt_items(receipt_id);

-- Daily revenue view
CREATE OR REPLACE VIEW daily_revenue_summary AS
SELECT 
    DATE(created_at) as date,
    branch_id,
    receipt_type,
    payment_method,
    COUNT(*) as transaction_count,
    SUM(subtotal) as total_subtotal,
    SUM(tax_amount) as total_tax,
    SUM(discount_amount) as total_discounts,
    SUM(total_amount) as total_revenue
FROM receipts
WHERE payment_status = 'paid'
GROUP BY DATE(created_at), branch_id, receipt_type, payment_method;

COMMENT ON TABLE receipts IS 'Stores all receipts for sales, refunds, invoices, and inventory transactions';
COMMENT ON TABLE receipt_items IS 'Line items for each receipt';
