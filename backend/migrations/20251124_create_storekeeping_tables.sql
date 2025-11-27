-- Drop tables with potentially incorrect schema or old types
DROP TABLE IF EXISTS notification_recipients CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS requisition_items CASCADE;
DROP TABLE IF EXISTS requisitions CASCADE;
DROP TABLE IF EXISTS purchase_order_items CASCADE;
DROP TABLE IF EXISTS purchase_orders CASCADE;
-- Don't drop suppliers as it is used by inventory_items

DROP TYPE IF EXISTS payment_terms CASCADE;
DROP TYPE IF EXISTS order_status CASCADE;
DROP TYPE IF EXISTS requisition_status CASCADE;
DROP TYPE IF EXISTS requisition_priority CASCADE;

-- Create enum types
DO $$ BEGIN
    CREATE TYPE payment_terms AS ENUM (
      'immediate', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE order_status AS ENUM (
      'draft', 'pending', 'approved', 'rejected', 'ordered', 'received', 'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE requisition_status AS ENUM (
      'draft', 'pending_approval', 'approved', 'rejected', 'fulfilled', 'cancelled'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE requisition_priority AS ENUM (
      'low', 'medium', 'high', 'urgent'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Update suppliers table with new columns
ALTER TABLE suppliers 
ADD COLUMN IF NOT EXISTS supplier_code VARCHAR(50),
ADD COLUMN IF NOT EXISTS payment_terms payment_terms DEFAULT 'net_30',
ADD COLUMN IF NOT EXISTS credit_limit DECIMAL(12,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS tax_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active',
ADD COLUMN IF NOT EXISTS notes TEXT,
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- Create purchase_orders table
CREATE TABLE IF NOT EXISTS purchase_orders (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id INTEGER REFERENCES suppliers(id) NOT NULL,
  branch branch NOT NULL,
  status order_status NOT NULL DEFAULT 'draft',
  total_amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  received_at TIMESTAMPTZ
);

-- Create purchase_order_items table
CREATE TABLE IF NOT EXISTS purchase_order_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  po_id UUID REFERENCES purchase_orders(id) ON DELETE CASCADE NOT NULL,
  item_id INTEGER REFERENCES inventory_items(id) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(12,2) NOT NULL,
  received_quantity INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create requisitions table
CREATE TABLE IF NOT EXISTS requisitions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_number VARCHAR(50) UNIQUE NOT NULL,
  department VARCHAR(50) NOT NULL,
  branch branch NOT NULL,
  status requisition_status NOT NULL DEFAULT 'draft',
  priority requisition_priority NOT NULL DEFAULT 'medium',
  notes TEXT,
  created_by UUID REFERENCES users(id),
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  approved_at TIMESTAMPTZ,
  fulfilled_at TIMESTAMPTZ
);

-- Create requisition_items table
CREATE TABLE IF NOT EXISTS requisition_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requisition_id UUID REFERENCES requisitions(id) ON DELETE CASCADE NOT NULL,
  item_id INTEGER REFERENCES inventory_items(id) NOT NULL,
  quantity INTEGER NOT NULL,
  fulfilled_quantity INTEGER DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(20) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  department VARCHAR(50),
  priority VARCHAR(20) NOT NULL DEFAULT 'medium',
  action_url TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create notification_recipients table
CREATE TABLE IF NOT EXISTS notification_recipients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  notification_id UUID REFERENCES notifications(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES users(id) NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Create triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add triggers to all tables
DO $$ 
BEGIN
  CREATE TRIGGER update_suppliers_updated_at
    BEFORE UPDATE ON suppliers
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  CREATE TRIGGER update_purchase_orders_updated_at
    BEFORE UPDATE ON purchase_orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  CREATE TRIGGER update_purchase_order_items_updated_at
    BEFORE UPDATE ON purchase_order_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  CREATE TRIGGER update_requisitions_updated_at
    BEFORE UPDATE ON requisitions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ 
BEGIN
  CREATE TRIGGER update_requisition_items_updated_at
    BEFORE UPDATE ON requisition_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(status);
CREATE INDEX IF NOT EXISTS idx_po_status ON purchase_orders(status);
CREATE INDEX IF NOT EXISTS idx_po_supplier ON purchase_orders(supplier_id);
CREATE INDEX IF NOT EXISTS idx_po_branch ON purchase_orders(branch);
CREATE INDEX IF NOT EXISTS idx_requisitions_status ON requisitions(status);
CREATE INDEX IF NOT EXISTS idx_requisitions_department ON requisitions(department);
CREATE INDEX IF NOT EXISTS idx_requisitions_branch ON requisitions(branch);
CREATE INDEX IF NOT EXISTS idx_notifications_type ON notifications(type);
CREATE INDEX IF NOT EXISTS idx_notifications_department ON notifications(department);
CREATE INDEX IF NOT EXISTS idx_notification_recipients_user ON notification_recipients(user_id);
