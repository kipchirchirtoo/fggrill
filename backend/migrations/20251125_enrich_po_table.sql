-- Enrich purchase_orders table with financial details
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS subtotal DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5,2) DEFAULT 16,
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_percentage DECIMAL(5,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS shipping_cost DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS other_charges DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS payment_terms TEXT, -- already have enum in suppliers, but PO might override or store text
ADD COLUMN IF NOT EXISTS delivery_terms TEXT,
ADD COLUMN IF NOT EXISTS special_instructions TEXT;

-- Enrich purchase_order_items table
ALTER TABLE purchase_order_items
ADD COLUMN IF NOT EXISTS tax_amount DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS specification TEXT,
ADD COLUMN IF NOT EXISTS quantity_pending INTEGER GENERATED ALWAYS AS (quantity - received_quantity) STORED;
-- Postgres 12+ supports generated columns. If older, use a view or trigger.
-- Assuming Postgres 12+. If fails, I'll remove GENERATED.

-- Add sent_to_supplier fields to purchase_orders
ALTER TABLE purchase_orders
ADD COLUMN IF NOT EXISTS sent_to_supplier BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS sent_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS sent_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS supplier_email TEXT;

-- Add conversion fields to requisitions
ALTER TABLE requisitions
ADD COLUMN IF NOT EXISTS converted_to_po BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS purchase_order_id UUID REFERENCES purchase_orders(id),
ADD COLUMN IF NOT EXISTS converted_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS converted_by UUID REFERENCES users(id);
