-- Create menu category table
CREATE TABLE restaurant_menu_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  image_url TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create menu items table
CREATE TABLE restaurant_menu_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES restaurant_menu_categories(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10, 2) NOT NULL,
  image_url TEXT,
  preparation_time INTEGER NOT NULL, -- in minutes
  is_available BOOLEAN DEFAULT true NOT NULL,
  is_vegetarian BOOLEAN DEFAULT false NOT NULL,
  is_spicy BOOLEAN DEFAULT false NOT NULL,
  allergens TEXT[],
  ingredients TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_price CHECK (price >= 0),
  CONSTRAINT valid_prep_time CHECK (preparation_time > 0)
);

-- Create order status enum
CREATE TYPE order_status AS ENUM (
  'pending',
  'confirmed',
  'preparing',
  'ready',
  'delivered',
  'cancelled'
);

-- Create order type enum
CREATE TYPE order_type AS ENUM (
  'dine_in',
  'room_service',
  'takeaway'
);

-- Create payment status enum
CREATE TYPE order_payment_status AS ENUM (
  'pending',
  'paid',
  'refunded'
);

-- Create orders table
CREATE TABLE restaurant_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  order_type order_type NOT NULL,
  status order_status DEFAULT 'pending' NOT NULL,
  table_number TEXT,
  room_number TEXT,
  guest_id UUID REFERENCES users(id),
  special_instructions TEXT,
  total_amount DECIMAL(10, 2) NOT NULL,
  payment_status order_payment_status DEFAULT 'pending' NOT NULL,
  payment_method TEXT,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  confirmed_at TIMESTAMP WITH TIME ZONE,
  confirmed_by UUID REFERENCES staff_profiles(id),
  prepared_at TIMESTAMP WITH TIME ZONE,
  prepared_by UUID REFERENCES staff_profiles(id),
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivered_by UUID REFERENCES staff_profiles(id),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by UUID REFERENCES staff_profiles(id),
  cancellation_reason TEXT,

  CONSTRAINT valid_order_amount CHECK (total_amount >= 0),
  CONSTRAINT valid_table_or_room CHECK (
    (order_type = 'dine_in' AND table_number IS NOT NULL AND room_number IS NULL) OR
    (order_type = 'room_service' AND room_number IS NOT NULL AND table_number IS NULL) OR
    (order_type = 'takeaway' AND table_number IS NULL AND room_number IS NULL)
  )
);

-- Create order items table
CREATE TABLE restaurant_order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID REFERENCES restaurant_orders(id) NOT NULL,
  menu_item_id UUID REFERENCES restaurant_menu_items(id) NOT NULL,
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(10, 2) NOT NULL,
  special_instructions TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  CONSTRAINT valid_quantity CHECK (quantity > 0),
  CONSTRAINT valid_prices CHECK (
    unit_price >= 0 AND
    total_price >= 0 AND
    total_price = quantity * unit_price
  )
);

-- Create inventory items table
CREATE TABLE restaurant_inventory_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  unit TEXT NOT NULL,
  minimum_stock INTEGER NOT NULL,
  current_stock INTEGER NOT NULL,
  last_ordered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_stock CHECK (current_stock >= 0 AND minimum_stock >= 0)
);

-- Create inventory transactions table
CREATE TABLE restaurant_inventory_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  item_id UUID REFERENCES restaurant_inventory_items(id) NOT NULL,
  transaction_type TEXT NOT NULL,
  quantity INTEGER NOT NULL,
  previous_stock INTEGER NOT NULL,
  new_stock INTEGER NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,

  CONSTRAINT valid_quantity CHECK (quantity != 0),
  CONSTRAINT valid_stock CHECK (
    previous_stock >= 0 AND
    new_stock >= 0 AND
    (transaction_type = 'in' AND new_stock = previous_stock + quantity) OR
    (transaction_type = 'out' AND new_stock = previous_stock - quantity)
  )
);

-- Enable RLS
ALTER TABLE restaurant_menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_inventory_transactions ENABLE ROW LEVEL SECURITY;

-- Menu categories policies
CREATE POLICY "Anyone can view menu categories"
  ON restaurant_menu_categories
  FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage menu categories"
  ON restaurant_menu_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'restaurant')
    )
  );

-- Menu items policies
CREATE POLICY "Anyone can view menu items"
  ON restaurant_menu_items
  FOR SELECT
  USING (true);

CREATE POLICY "Staff can manage menu items"
  ON restaurant_menu_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'restaurant')
    )
  );

-- Orders policies
CREATE POLICY "Staff can view all orders"
  ON restaurant_orders
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'restaurant', 'receptionist')
    )
  );

CREATE POLICY "Guests can view their own orders"
  ON restaurant_orders
  FOR SELECT
  USING (auth.uid() = guest_id);

CREATE POLICY "Staff can create orders"
  ON restaurant_orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'restaurant', 'receptionist')
    )
  );

CREATE POLICY "Staff can update orders"
  ON restaurant_orders
  FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'restaurant')
    )
  );

-- Order items policies
CREATE POLICY "Staff can view all order items"
  ON restaurant_order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'restaurant', 'receptionist')
    )
  );

CREATE POLICY "Guests can view their own order items"
  ON restaurant_order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM restaurant_orders 
      WHERE id = order_id 
      AND guest_id = auth.uid()
    )
  );

CREATE POLICY "Staff can manage order items"
  ON restaurant_order_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'restaurant')
    )
  );

-- Inventory items policies
CREATE POLICY "Staff can view inventory items"
  ON restaurant_inventory_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'restaurant')
    )
  );

CREATE POLICY "Staff can manage inventory items"
  ON restaurant_inventory_items
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'restaurant')
    )
  );

-- Inventory transactions policies
CREATE POLICY "Staff can view inventory transactions"
  ON restaurant_inventory_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'restaurant')
    )
  );

CREATE POLICY "Staff can manage inventory transactions"
  ON restaurant_inventory_transactions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'restaurant')
    )
  );

-- Create function to generate order number
CREATE OR REPLACE FUNCTION generate_order_number()
RETURNS TEXT AS $$
DECLARE
  order_date TEXT;
  order_seq INT;
  order_number TEXT;
BEGIN
  -- Get current date in YYMMDD format
  order_date := TO_CHAR(NOW(), 'YYMMDD');
  
  -- Get next sequence for the day
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM restaurant_orders
    WHERE order_number LIKE 'ORD' || order_date || '%'
  )
  SELECT next_seq INTO order_seq FROM seq;
  
  -- Generate order number
  order_number := 'ORD' || order_date || LPAD(order_seq::TEXT, 4, '0');
  
  RETURN order_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to update inventory stock on transactions
CREATE OR REPLACE FUNCTION process_inventory_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Get current stock
  NEW.previous_stock := (
    SELECT current_stock 
    FROM restaurant_inventory_items 
    WHERE id = NEW.item_id
  );

  -- Calculate new stock
  NEW.new_stock := CASE
    WHEN NEW.transaction_type = 'in' THEN NEW.previous_stock + NEW.quantity
    WHEN NEW.transaction_type = 'out' THEN NEW.previous_stock - NEW.quantity
  END;

  -- Update inventory item stock
  UPDATE restaurant_inventory_items
  SET 
    current_stock = NEW.new_stock,
    updated_at = NOW()
  WHERE id = NEW.item_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for inventory transactions
CREATE TRIGGER process_inventory_transaction
  BEFORE INSERT ON restaurant_inventory_transactions
  FOR EACH ROW
  EXECUTE FUNCTION process_inventory_transaction();

-- Create function to calculate order total
CREATE OR REPLACE FUNCTION calculate_order_total()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate total from order items
  WITH order_total AS (
    SELECT SUM(total_price) as total
    FROM restaurant_order_items
    WHERE order_id = NEW.id
  )
  UPDATE restaurant_orders
  SET 
    total_amount = COALESCE((SELECT total FROM order_total), 0),
    updated_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for order total calculation
CREATE TRIGGER calculate_order_total
  AFTER INSERT OR UPDATE OR DELETE ON restaurant_order_items
  FOR EACH ROW
  EXECUTE FUNCTION calculate_order_total();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_restaurant_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_menu_category_timestamp
  BEFORE UPDATE ON restaurant_menu_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_timestamp();

CREATE TRIGGER update_menu_item_timestamp
  BEFORE UPDATE ON restaurant_menu_items
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_timestamp();

CREATE TRIGGER update_order_timestamp
  BEFORE UPDATE ON restaurant_orders
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_timestamp();

CREATE TRIGGER update_inventory_item_timestamp
  BEFORE UPDATE ON restaurant_inventory_items
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_timestamp();

-- Insert default menu categories
INSERT INTO restaurant_menu_categories (name, description, sort_order) VALUES
('Breakfast', 'Start your day right with our breakfast selections', 1),
('Appetizers', 'Light bites to start your meal', 2),
('Main Course', 'Hearty main dishes', 3),
('Desserts', 'Sweet treats to end your meal', 4),
('Beverages', 'Refreshing drinks', 5);
