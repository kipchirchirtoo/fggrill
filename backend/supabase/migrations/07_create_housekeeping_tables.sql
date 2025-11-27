-- Create housekeeping task types enum
CREATE TYPE housekeeping_task_type AS ENUM (
  'daily_clean',
  'checkout_clean',
  'deep_clean',
  'maintenance_clean',
  'linen_change',
  'restock',
  'inspection'
);

-- Create task priority enum
CREATE TYPE task_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

-- Create task status enum
CREATE TYPE task_status AS ENUM (
  'pending',
  'in_progress',
  'completed',
  'cancelled'
);

-- Create supply status enum
CREATE TYPE supply_status AS ENUM (
  'sufficient',
  'low',
  'critical',
  'out_of_stock'
);

-- Create housekeeping tasks table
CREATE TABLE housekeeping_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID REFERENCES rooms(id) NOT NULL,
  task_type housekeeping_task_type NOT NULL,
  priority task_priority DEFAULT 'normal' NOT NULL,
  status task_status DEFAULT 'pending' NOT NULL,
  assigned_to UUID REFERENCES staff_profiles(id),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES staff_profiles(id),
  verification_required BOOLEAN DEFAULT false NOT NULL,
  verified_at TIMESTAMP WITH TIME ZONE,
  verified_by UUID REFERENCES staff_profiles(id)
);

-- Create task issues table
CREATE TABLE housekeeping_task_issues (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID REFERENCES housekeeping_tasks(id) NOT NULL,
  issue_type TEXT NOT NULL,
  description TEXT NOT NULL,
  status task_status DEFAULT 'pending' NOT NULL,
  reported_by UUID REFERENCES staff_profiles(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID REFERENCES staff_profiles(id)
);

-- Create supply categories table
CREATE TABLE housekeeping_supply_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create supplies table
CREATE TABLE housekeeping_supplies (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES housekeeping_supply_categories(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  unit TEXT NOT NULL,
  minimum_stock INTEGER NOT NULL,
  current_stock INTEGER NOT NULL,
  status supply_status DEFAULT 'sufficient' NOT NULL,
  last_ordered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_stock CHECK (current_stock >= 0 AND minimum_stock >= 0)
);

-- Create supply transactions table
CREATE TABLE housekeeping_supply_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supply_id UUID REFERENCES housekeeping_supplies(id) NOT NULL,
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

-- Create supply requests table
CREATE TABLE housekeeping_supply_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  supply_id UUID REFERENCES housekeeping_supplies(id) NOT NULL,
  requested_by UUID REFERENCES staff_profiles(id) NOT NULL,
  quantity INTEGER NOT NULL,
  status task_status DEFAULT 'pending' NOT NULL,
  urgency task_priority DEFAULT 'normal' NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES staff_profiles(id),
  fulfilled_at TIMESTAMP WITH TIME ZONE,
  fulfilled_by UUID REFERENCES staff_profiles(id),

  CONSTRAINT valid_quantity CHECK (quantity > 0)
);

-- Enable RLS
ALTER TABLE housekeeping_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_task_issues ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_supply_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_supplies ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_supply_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE housekeeping_supply_requests ENABLE ROW LEVEL SECURITY;

-- Tasks policies
CREATE POLICY "Staff can view assigned tasks"
  ON housekeeping_tasks
  FOR SELECT
  USING (
    auth.uid() IN (
      SELECT user_id FROM staff_profiles WHERE id = assigned_to
    )
  );

CREATE POLICY "Management and supervisors can view all tasks"
  ON housekeeping_tasks
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping')
    )
  );

CREATE POLICY "Management can manage tasks"
  ON housekeeping_tasks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping')
    )
  );

-- Task issues policies
CREATE POLICY "Staff can view reported issues"
  ON housekeeping_task_issues
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM housekeeping_tasks 
      WHERE id = task_id 
      AND assigned_to IN (
        SELECT id FROM staff_profiles WHERE user_id = auth.uid()
      )
    )
  );

CREATE POLICY "Staff can report issues"
  ON housekeeping_task_issues
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = reported_by 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Management can view all issues"
  ON housekeeping_task_issues
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping')
    )
  );

CREATE POLICY "Management can manage issues"
  ON housekeeping_task_issues
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping')
    )
  );

-- Supply categories policies
CREATE POLICY "Anyone can view supply categories"
  ON housekeeping_supply_categories
  FOR SELECT
  USING (true);

CREATE POLICY "Management can manage supply categories"
  ON housekeeping_supply_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping')
    )
  );

-- Supplies policies
CREATE POLICY "Anyone can view supplies"
  ON housekeeping_supplies
  FOR SELECT
  USING (true);

CREATE POLICY "Management can manage supplies"
  ON housekeeping_supplies
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping')
    )
  );

-- Supply transactions policies
CREATE POLICY "Staff can view supply transactions"
  ON housekeeping_supply_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping')
    )
  );

CREATE POLICY "Management can manage supply transactions"
  ON housekeeping_supply_transactions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping')
    )
  );

-- Supply requests policies
CREATE POLICY "Staff can view their own requests"
  ON housekeeping_supply_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = requested_by 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can create requests"
  ON housekeeping_supply_requests
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = requested_by 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Management can view all requests"
  ON housekeeping_supply_requests
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping')
    )
  );

CREATE POLICY "Management can manage requests"
  ON housekeeping_supply_requests
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'housekeeping')
    )
  );

-- Create function to update supply status based on stock levels
CREATE OR REPLACE FUNCTION update_supply_status()
RETURNS TRIGGER AS $$
BEGIN
  NEW.status := CASE
    WHEN NEW.current_stock = 0 THEN 'out_of_stock'
    WHEN NEW.current_stock <= NEW.minimum_stock THEN 'critical'
    WHEN NEW.current_stock <= NEW.minimum_stock * 2 THEN 'low'
    ELSE 'sufficient'
  END;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for supply status updates
CREATE TRIGGER update_supply_status
  BEFORE INSERT OR UPDATE OF current_stock, minimum_stock ON housekeeping_supplies
  FOR EACH ROW
  EXECUTE FUNCTION update_supply_status();

-- Create function to update supply stock on transactions
CREATE OR REPLACE FUNCTION process_supply_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Get current stock
  NEW.previous_stock := (
    SELECT current_stock 
    FROM housekeeping_supplies 
    WHERE id = NEW.supply_id
  );

  -- Calculate new stock
  NEW.new_stock := CASE
    WHEN NEW.transaction_type = 'in' THEN NEW.previous_stock + NEW.quantity
    WHEN NEW.transaction_type = 'out' THEN NEW.previous_stock - NEW.quantity
  END;

  -- Update supply stock
  UPDATE housekeeping_supplies
  SET 
    current_stock = NEW.new_stock,
    updated_at = NOW()
  WHERE id = NEW.supply_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for supply transactions
CREATE TRIGGER process_supply_transaction
  BEFORE INSERT ON housekeeping_supply_transactions
  FOR EACH ROW
  EXECUTE FUNCTION process_supply_transaction();

-- Insert default supply categories
INSERT INTO housekeeping_supply_categories (name, description) VALUES
('Cleaning Supplies', 'General cleaning products and materials'),
('Linens', 'Bed sheets, towels, and other fabric items'),
('Toiletries', 'Guest bathroom supplies and amenities'),
('Equipment', 'Cleaning equipment and tools');

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_housekeeping_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_housekeeping_task_timestamp
  BEFORE UPDATE ON housekeeping_tasks
  FOR EACH ROW
  EXECUTE FUNCTION update_housekeeping_timestamp();

CREATE TRIGGER update_task_issue_timestamp
  BEFORE UPDATE ON housekeeping_task_issues
  FOR EACH ROW
  EXECUTE FUNCTION update_housekeeping_timestamp();

CREATE TRIGGER update_supply_category_timestamp
  BEFORE UPDATE ON housekeeping_supply_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_housekeeping_timestamp();

CREATE TRIGGER update_supply_timestamp
  BEFORE UPDATE ON housekeeping_supplies
  FOR EACH ROW
  EXECUTE FUNCTION update_housekeeping_timestamp();

CREATE TRIGGER update_supply_request_timestamp
  BEFORE UPDATE ON housekeeping_supply_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_housekeeping_timestamp();
