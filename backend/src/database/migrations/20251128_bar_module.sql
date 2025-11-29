-- BAR MODULE MIGRATION - Famous Gate Hotel
-- Created: 2025-11-28

-- Drink Categories
CREATE TABLE IF NOT EXISTS bar_drink_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

INSERT INTO bar_drink_categories (name, sort_order) VALUES
  ('beers', 1), ('whisky', 2), ('vodka', 3), ('gin', 4), ('rum', 5),
  ('brandy', 6), ('wines', 7), ('cocktails', 8), ('shooters', 9), ('soft-drinks', 10)
ON CONFLICT (name) DO NOTHING;

-- Drinks Menu
CREATE TABLE IF NOT EXISTS bar_drinks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES bar_drink_categories(id),
  name VARCHAR(200) NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  cost_price DECIMAL(10, 2),
  unit VARCHAR(50) DEFAULT 'shot',
  is_available BOOLEAN DEFAULT true,
  branch_id INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_bar_drinks_category ON bar_drinks(category_id);

-- Bar Orders
CREATE TABLE IF NOT EXISTS bar_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number VARCHAR(50) NOT NULL UNIQUE,
  branch_id INTEGER,
  order_type VARCHAR(20) DEFAULT 'bar',
  status VARCHAR(20) DEFAULT 'pending',
  seat_number VARCHAR(20),
  tab_id UUID,
  room_number VARCHAR(20),
  guest_name VARCHAR(200),
  subtotal DECIMAL(10, 2) DEFAULT 0,
  total DECIMAL(10, 2) DEFAULT 0,
  payment_method VARCHAR(50),
  payment_status VARCHAR(20) DEFAULT 'pending',
  cash_received DECIMAL(10, 2),
  change_given DECIMAL(10, 2),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

CREATE INDEX IF NOT EXISTS idx_bar_orders_status ON bar_orders(status);
CREATE INDEX IF NOT EXISTS idx_bar_orders_date ON bar_orders(created_at);

-- Bar Order Items
CREATE TABLE IF NOT EXISTS bar_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES bar_orders(id) ON DELETE CASCADE,
  drink_id UUID,
  drink_name VARCHAR(200) NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bar Tabs
CREATE TABLE IF NOT EXISTS bar_tabs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tab_number VARCHAR(50) NOT NULL,
  branch_id INTEGER,
  customer_name VARCHAR(200) NOT NULL,
  phone VARCHAR(50),
  status VARCHAR(20) DEFAULT 'open',
  total_amount DECIMAL(10, 2) DEFAULT 0,
  payment_method VARCHAR(50),
  created_by UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  closed_at TIMESTAMP WITH TIME ZONE,
  closed_by UUID
);

CREATE INDEX IF NOT EXISTS idx_bar_tabs_status ON bar_tabs(status);

-- Bar Tab Items
CREATE TABLE IF NOT EXISTS bar_tab_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  tab_id UUID REFERENCES bar_tabs(id) ON DELETE CASCADE,
  drink_id UUID,
  drink_name VARCHAR(200) NOT NULL,
  quantity INTEGER DEFAULT 1,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bar Stock/Inventory
CREATE TABLE IF NOT EXISTS bar_stock (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  drink_id UUID REFERENCES bar_drinks(id),
  branch_id INTEGER,
  quantity INTEGER DEFAULT 0,
  min_stock INTEGER DEFAULT 5,
  unit VARCHAR(50) DEFAULT 'bottles',
  cost_per_unit DECIMAL(10, 2),
  last_restocked TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_bar_stock_branch ON bar_stock(branch_id);

-- Restaurant enhancements - add service charge and bill tracking
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bill_number VARCHAR(50);
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS service_charge DECIMAL(10, 2) DEFAULT 0;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS cash_received DECIMAL(10, 2);
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS change_given DECIMAL(10, 2);
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS bill_generated_at TIMESTAMP WITH TIME ZONE;
ALTER TABLE restaurant_orders ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP WITH TIME ZONE;

-- Generate order number function
CREATE OR REPLACE FUNCTION generate_bar_order_number() RETURNS TRIGGER AS $$
BEGIN
  NEW.order_number := 'BAR-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(nextval('bar_order_seq')::TEXT, 4, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS bar_order_seq START 1;

DROP TRIGGER IF EXISTS set_bar_order_number ON bar_orders;
CREATE TRIGGER set_bar_order_number BEFORE INSERT ON bar_orders
FOR EACH ROW WHEN (NEW.order_number IS NULL)
EXECUTE FUNCTION generate_bar_order_number();

-- Tab number function
CREATE OR REPLACE FUNCTION generate_bar_tab_number() RETURNS TRIGGER AS $$
BEGIN
  NEW.tab_number := 'TAB-' || TO_CHAR(NOW(), 'YYMMDD') || '-' || LPAD(nextval('bar_tab_seq')::TEXT, 3, '0');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE SEQUENCE IF NOT EXISTS bar_tab_seq START 1;

DROP TRIGGER IF EXISTS set_bar_tab_number ON bar_tabs;
CREATE TRIGGER set_bar_tab_number BEFORE INSERT ON bar_tabs
FOR EACH ROW WHEN (NEW.tab_number IS NULL OR NEW.tab_number = '')
EXECUTE FUNCTION generate_bar_tab_number();

-- Enable RLS
ALTER TABLE bar_drink_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_drinks ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_tabs ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_tab_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE bar_stock ENABLE ROW LEVEL SECURITY;

-- Policies for authenticated users (drop first if exists)
DROP POLICY IF EXISTS "bar_categories_read" ON bar_drink_categories;
DROP POLICY IF EXISTS "bar_drinks_read" ON bar_drinks;
DROP POLICY IF EXISTS "bar_orders_all" ON bar_orders;
DROP POLICY IF EXISTS "bar_order_items_all" ON bar_order_items;
DROP POLICY IF EXISTS "bar_tabs_all" ON bar_tabs;
DROP POLICY IF EXISTS "bar_tab_items_all" ON bar_tab_items;
DROP POLICY IF EXISTS "bar_stock_all" ON bar_stock;

CREATE POLICY "bar_categories_read" ON bar_drink_categories FOR SELECT USING (true);
CREATE POLICY "bar_drinks_read" ON bar_drinks FOR SELECT USING (true);
CREATE POLICY "bar_orders_all" ON bar_orders FOR ALL USING (true);
CREATE POLICY "bar_order_items_all" ON bar_order_items FOR ALL USING (true);
CREATE POLICY "bar_tabs_all" ON bar_tabs FOR ALL USING (true);
CREATE POLICY "bar_tab_items_all" ON bar_tab_items FOR ALL USING (true);
CREATE POLICY "bar_stock_all" ON bar_stock FOR ALL USING (true);

SELECT 'Bar module migration completed successfully' AS status;
