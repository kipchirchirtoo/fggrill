-- Create work order priority enum
CREATE TYPE work_order_priority AS ENUM (
  'low',
  'normal',
  'high',
  'urgent'
);

-- Create work order status enum
CREATE TYPE work_order_status AS ENUM (
  'pending',
  'scheduled',
  'in_progress',
  'completed',
  'cancelled'
);

-- Create equipment status enum
CREATE TYPE equipment_status AS ENUM (
  'operational',
  'needs_maintenance',
  'under_maintenance',
  'out_of_service'
);

-- Create maintenance type enum
CREATE TYPE maintenance_type AS ENUM (
  'preventive',
  'corrective',
  'emergency',
  'inspection'
);

-- Create work orders table
CREATE TABLE maintenance_work_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_number TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  location_type TEXT NOT NULL,
  location_id UUID,
  issue_description TEXT NOT NULL,
  priority work_order_priority DEFAULT 'normal' NOT NULL,
  status work_order_status DEFAULT 'pending' NOT NULL,
  maintenance_type maintenance_type NOT NULL,
  scheduled_date TIMESTAMP WITH TIME ZONE,
  estimated_duration INTEGER, -- in minutes
  assigned_to UUID REFERENCES staff_profiles(id),
  reported_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES staff_profiles(id),
  cancelled_at TIMESTAMP WITH TIME ZONE,
  cancelled_by UUID REFERENCES staff_profiles(id),
  cancellation_reason TEXT,
  notes TEXT
);

-- Create work order tasks table
CREATE TABLE maintenance_work_order_tasks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  work_order_id UUID REFERENCES maintenance_work_orders(id) NOT NULL,
  description TEXT NOT NULL,
  is_completed BOOLEAN DEFAULT false NOT NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  completed_by UUID REFERENCES staff_profiles(id),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create equipment categories table
CREATE TABLE maintenance_equipment_categories (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE
);

-- Create equipment table
CREATE TABLE maintenance_equipment (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  category_id UUID REFERENCES maintenance_equipment_categories(id) NOT NULL,
  name TEXT NOT NULL,
  model TEXT,
  serial_number TEXT,
  location TEXT NOT NULL,
  purchase_date DATE,
  warranty_expiry DATE,
  status equipment_status DEFAULT 'operational' NOT NULL,
  last_maintenance_date TIMESTAMP WITH TIME ZONE,
  next_maintenance_date TIMESTAMP WITH TIME ZONE,
  maintenance_interval INTEGER, -- in days
  health_score INTEGER, -- 0-100
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_health_score CHECK (health_score >= 0 AND health_score <= 100)
);

-- Create parts inventory table
CREATE TABLE maintenance_parts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  part_number TEXT,
  unit TEXT NOT NULL,
  minimum_stock INTEGER NOT NULL,
  current_stock INTEGER NOT NULL,
  location TEXT,
  supplier TEXT,
  last_ordered_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_stock CHECK (current_stock >= 0 AND minimum_stock >= 0)
);

-- Create parts transactions table
CREATE TABLE maintenance_part_transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  part_id UUID REFERENCES maintenance_parts(id) NOT NULL,
  work_order_id UUID REFERENCES maintenance_work_orders(id),
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

-- Create maintenance schedules table
CREATE TABLE maintenance_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  equipment_id UUID REFERENCES maintenance_equipment(id) NOT NULL,
  maintenance_type maintenance_type NOT NULL,
  description TEXT NOT NULL,
  frequency INTEGER NOT NULL, -- in days
  last_performed TIMESTAMP WITH TIME ZONE,
  next_due TIMESTAMP WITH TIME ZONE NOT NULL,
  assigned_to UUID REFERENCES staff_profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_frequency CHECK (frequency > 0)
);

-- Enable RLS
ALTER TABLE maintenance_work_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_work_order_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_equipment_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_equipment ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_parts ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_part_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_schedules ENABLE ROW LEVEL SECURITY;

-- Work orders policies
CREATE POLICY "Anyone can view work orders"
  ON maintenance_work_orders
  FOR SELECT
  USING (true);

CREATE POLICY "Staff can create work orders"
  ON maintenance_work_orders
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'maintenance', 'housekeeping', 'restaurant')
    )
  );

CREATE POLICY "Maintenance staff can manage work orders"
  ON maintenance_work_orders
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'maintenance')
    )
  );

-- Work order tasks policies
CREATE POLICY "Anyone can view work order tasks"
  ON maintenance_work_order_tasks
  FOR SELECT
  USING (true);

CREATE POLICY "Maintenance staff can manage work order tasks"
  ON maintenance_work_order_tasks
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'maintenance')
    )
  );

-- Equipment categories policies
CREATE POLICY "Anyone can view equipment categories"
  ON maintenance_equipment_categories
  FOR SELECT
  USING (true);

CREATE POLICY "Maintenance staff can manage equipment categories"
  ON maintenance_equipment_categories
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'maintenance')
    )
  );

-- Equipment policies
CREATE POLICY "Anyone can view equipment"
  ON maintenance_equipment
  FOR SELECT
  USING (true);

CREATE POLICY "Maintenance staff can manage equipment"
  ON maintenance_equipment
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'maintenance')
    )
  );

-- Parts policies
CREATE POLICY "Staff can view parts"
  ON maintenance_parts
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'maintenance')
    )
  );

CREATE POLICY "Maintenance staff can manage parts"
  ON maintenance_parts
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'maintenance')
    )
  );

-- Parts transactions policies
CREATE POLICY "Staff can view part transactions"
  ON maintenance_part_transactions
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'maintenance')
    )
  );

CREATE POLICY "Maintenance staff can manage part transactions"
  ON maintenance_part_transactions
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'maintenance')
    )
  );

-- Maintenance schedules policies
CREATE POLICY "Anyone can view maintenance schedules"
  ON maintenance_schedules
  FOR SELECT
  USING (true);

CREATE POLICY "Maintenance staff can manage schedules"
  ON maintenance_schedules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'maintenance')
    )
  );

-- Create function to generate work order number
CREATE OR REPLACE FUNCTION generate_work_order_number()
RETURNS TEXT AS $$
DECLARE
  wo_date TEXT;
  wo_seq INT;
  wo_number TEXT;
BEGIN
  -- Get current date in YYMMDD format
  wo_date := TO_CHAR(NOW(), 'YYMMDD');
  
  -- Get next sequence for the day
  WITH seq AS (
    SELECT COUNT(*) + 1 as next_seq
    FROM maintenance_work_orders
    WHERE order_number LIKE 'WO' || wo_date || '%'
  )
  SELECT next_seq INTO wo_seq FROM seq;
  
  -- Generate work order number
  wo_number := 'WO' || wo_date || LPAD(wo_seq::TEXT, 4, '0');
  
  RETURN wo_number;
END;
$$ LANGUAGE plpgsql;

-- Create function to update equipment health score
CREATE OR REPLACE FUNCTION update_equipment_health_score()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate health score based on maintenance history and status
  WITH maintenance_stats AS (
    SELECT 
      COUNT(*) as total_maintenance,
      COUNT(*) FILTER (WHERE status = 'completed') as completed_maintenance,
      MAX(completed_at) as last_maintenance
    FROM maintenance_work_orders
    WHERE location_type = 'equipment'
    AND location_id = NEW.id
    AND created_at >= NOW() - INTERVAL '1 year'
  )
  UPDATE maintenance_equipment
  SET 
    health_score = CASE
      WHEN status = 'out_of_service' THEN 0
      WHEN status = 'under_maintenance' THEN 50
      WHEN status = 'needs_maintenance' THEN 70
      WHEN next_maintenance_date < NOW() THEN 80
      ELSE 100
    END,
    updated_at = NOW()
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for equipment health score updates
CREATE TRIGGER update_equipment_health_score
  AFTER INSERT OR UPDATE ON maintenance_work_orders
  FOR EACH ROW
  WHEN (NEW.location_type = 'equipment')
  EXECUTE FUNCTION update_equipment_health_score();

-- Create function to update parts stock
CREATE OR REPLACE FUNCTION process_part_transaction()
RETURNS TRIGGER AS $$
BEGIN
  -- Get current stock
  NEW.previous_stock := (
    SELECT current_stock 
    FROM maintenance_parts 
    WHERE id = NEW.part_id
  );

  -- Calculate new stock
  NEW.new_stock := CASE
    WHEN NEW.transaction_type = 'in' THEN NEW.previous_stock + NEW.quantity
    WHEN NEW.transaction_type = 'out' THEN NEW.previous_stock - NEW.quantity
  END;

  -- Update part stock
  UPDATE maintenance_parts
  SET 
    current_stock = NEW.new_stock,
    updated_at = NOW()
  WHERE id = NEW.part_id;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for parts transactions
CREATE TRIGGER process_part_transaction
  BEFORE INSERT ON maintenance_part_transactions
  FOR EACH ROW
  EXECUTE FUNCTION process_part_transaction();

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION update_maintenance_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_equipment_category_timestamp
  BEFORE UPDATE ON maintenance_equipment_categories
  FOR EACH ROW
  EXECUTE FUNCTION update_maintenance_timestamp();

CREATE TRIGGER update_equipment_timestamp
  BEFORE UPDATE ON maintenance_equipment
  FOR EACH ROW
  EXECUTE FUNCTION update_maintenance_timestamp();

CREATE TRIGGER update_part_timestamp
  BEFORE UPDATE ON maintenance_parts
  FOR EACH ROW
  EXECUTE FUNCTION update_maintenance_timestamp();

CREATE TRIGGER update_schedule_timestamp
  BEFORE UPDATE ON maintenance_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_maintenance_timestamp();

-- Insert default equipment categories
INSERT INTO maintenance_equipment_categories (name, description) VALUES
('HVAC', 'Air conditioning and ventilation systems'),
('Plumbing', 'Water supply and drainage systems'),
('Electrical', 'Electrical systems and lighting'),
('Kitchen', 'Kitchen equipment and appliances'),
('Safety', 'Fire safety and security systems');
