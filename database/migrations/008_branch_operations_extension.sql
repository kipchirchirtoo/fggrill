-- Branch Operations Database Extension Migration
-- This migration adds tables required for branch operations including:
-- - Staff attendance tracking
-- - Financial reporting
-- - Communications (messages, notifications, announcements)
-- - Stock takes and inventory management extensions

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Staff Management Extensions
CREATE TABLE IF NOT EXISTS staff_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'leave', 'half_day')),
  check_in TIME,
  check_out TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (staff_id, date)
);

CREATE TABLE IF NOT EXISTS staff_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  shift_type_id UUID NOT NULL REFERENCES shift_types(id) ON DELETE RESTRICT,
  is_confirmed BOOLEAN DEFAULT false,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create shift_types table if it doesn't exist
CREATE TABLE IF NOT EXISTS shift_types (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name VARCHAR(50) NOT NULL,
  color VARCHAR(20) NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default shift types
INSERT INTO shift_types (id, name, color, start_time, end_time, description)
VALUES
  (uuid_generate_v4(), 'Morning', 'bg-blue-500', '06:00:00', '14:00:00', 'Morning shift'),
  (uuid_generate_v4(), 'Afternoon', 'bg-green-500', '14:00:00', '22:00:00', 'Afternoon shift'),
  (uuid_generate_v4(), 'Night', 'bg-purple-500', '22:00:00', '06:00:00', 'Night shift'),
  (uuid_generate_v4(), 'Full Day', 'bg-orange-500', '08:00:00', '20:00:00', 'Extended full day shift')
ON CONFLICT DO NOTHING;

-- Financial Reporting Extensions
CREATE TABLE IF NOT EXISTS financial_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  period VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  file_path VARCHAR(255),
  file_format VARCHAR(10) NOT NULL,
  file_size VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenue_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, name)
);

CREATE TABLE IF NOT EXISTS revenue_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  source_id UUID NOT NULL REFERENCES revenue_sources(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  expense_date DATE NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID REFERENCES users(id),
  receipt_path VARCHAR(255),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Communications Extensions
CREATE TABLE IF NOT EXISTS branch_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES users(id),
  recipient_id UUID REFERENCES users(id),
  is_global BOOLEAN DEFAULT false,
  subject VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  priority VARCHAR(10) CHECK (priority IN ('low', 'medium', 'high')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branch_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('info', 'warning', 'error', 'success')),
  source VARCHAR(100) NOT NULL,
  is_global BOOLEAN DEFAULT false,
  is_read BOOLEAN DEFAULT false,
  action_url VARCHAR(255),
  action_label VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS branch_announcements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL REFERENCES users(id),
  is_pinned BOOLEAN DEFAULT false,
  is_global BOOLEAN DEFAULT false,
  importance VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (importance IN ('low', 'medium', 'high')),
  expires_at TIMESTAMPTZ,
  target_departments VARCHAR(255)[], -- Array of department names
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Inventory Management Extensions
CREATE TABLE IF NOT EXISTS stock_takes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  reference_code VARCHAR(50) UNIQUE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'in_progress', 'completed', 'cancelled')),
  start_date TIMESTAMPTZ NOT NULL,
  end_date TIMESTAMPTZ,
  notes TEXT,
  initiated_by UUID REFERENCES users(id),
  completed_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS stock_take_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stock_take_id UUID NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  expected_quantity INTEGER NOT NULL DEFAULT 0,
  actual_quantity INTEGER,
  variance INTEGER,
  notes TEXT,
  counted_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (stock_take_id, item_id)
);

CREATE TABLE IF NOT EXISTS incoming_shipments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  reference_number VARCHAR(50) UNIQUE NOT NULL,
  source VARCHAR(100) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_transit', 'delivered', 'cancelled')),
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  notes TEXT,
  received_by UUID REFERENCES users(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incoming_shipment_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  shipment_id UUID NOT NULL REFERENCES incoming_shipments(id) ON DELETE CASCADE,
  item_id UUID NOT NULL REFERENCES inventory_items(id) ON DELETE CASCADE,
  expected_quantity INTEGER NOT NULL,
  received_quantity INTEGER,
  unit_price DECIMAL(10,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (shipment_id, item_id)
);

-- Operations Extensions
CREATE TABLE IF NOT EXISTS service_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  request_type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'completed', 'cancelled')),
  priority VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
  location VARCHAR(100),
  requested_by UUID REFERENCES users(id),
  assigned_to UUID REFERENCES users(id),
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_staff_attendance_staff_id ON staff_attendance(staff_id);
CREATE INDEX idx_staff_attendance_branch_id ON staff_attendance(branch_id);
CREATE INDEX idx_staff_attendance_date ON staff_attendance(date);

CREATE INDEX idx_staff_shifts_staff_id ON staff_shifts(staff_id);
CREATE INDEX idx_staff_shifts_branch_id ON staff_shifts(branch_id);
CREATE INDEX idx_staff_shifts_date ON staff_shifts(shift_date);

CREATE INDEX idx_financial_reports_branch_id ON financial_reports(branch_id);
CREATE INDEX idx_financial_reports_date_range ON financial_reports(start_date, end_date);

CREATE INDEX idx_revenue_entries_branch_id ON revenue_entries(branch_id);
CREATE INDEX idx_revenue_entries_source_id ON revenue_entries(source_id);
CREATE INDEX idx_revenue_entries_date ON revenue_entries(entry_date);

CREATE INDEX idx_expenses_branch_id ON expenses(branch_id);
CREATE INDEX idx_expenses_date ON expenses(expense_date);
CREATE INDEX idx_expenses_status ON expenses(status);

CREATE INDEX idx_branch_messages_branch_id ON branch_messages(branch_id);
CREATE INDEX idx_branch_messages_sender_id ON branch_messages(sender_id);
CREATE INDEX idx_branch_messages_recipient_id ON branch_messages(recipient_id);

CREATE INDEX idx_branch_notifications_branch_id ON branch_notifications(branch_id);
CREATE INDEX idx_branch_notifications_type ON branch_notifications(notification_type);

CREATE INDEX idx_branch_announcements_branch_id ON branch_announcements(branch_id);
CREATE INDEX idx_branch_announcements_expires_at ON branch_announcements(expires_at);

CREATE INDEX idx_stock_takes_branch_id ON stock_takes(branch_id);
CREATE INDEX idx_stock_takes_status ON stock_takes(status);

CREATE INDEX idx_incoming_shipments_branch_id ON incoming_shipments(branch_id);
CREATE INDEX idx_incoming_shipments_status ON incoming_shipments(status);

CREATE INDEX idx_service_requests_branch_id ON service_requests(branch_id);
CREATE INDEX idx_service_requests_status ON service_requests(status);
CREATE INDEX idx_service_requests_type ON service_requests(request_type);

-- Create views for reporting
CREATE OR REPLACE VIEW branch_attendance_summary AS
SELECT 
  branch_id,
  date,
  COUNT(*) AS total_staff,
  COUNT(CASE WHEN status = 'present' THEN 1 END) AS present_count,
  COUNT(CASE WHEN status = 'absent' THEN 1 END) AS absent_count,
  COUNT(CASE WHEN status = 'late' THEN 1 END) AS late_count,
  COUNT(CASE WHEN status = 'leave' THEN 1 END) AS leave_count,
  COUNT(CASE WHEN status = 'half_day' THEN 1 END) AS half_day_count,
  ROUND(COUNT(CASE WHEN status IN ('present', 'late', 'half_day') THEN 1 END)::numeric / COUNT(*)::numeric * 100, 2) AS attendance_rate
FROM staff_attendance
GROUP BY branch_id, date;

CREATE OR REPLACE VIEW branch_revenue_summary AS
SELECT 
  r.branch_id,
  rs.name AS source_name,
  r.entry_date,
  SUM(r.amount) AS total_amount
FROM revenue_entries r
JOIN revenue_sources rs ON r.source_id = rs.id
GROUP BY r.branch_id, rs.name, r.entry_date;

-- Add default entries for revenue sources
INSERT INTO revenue_sources (branch_id, name, description)
SELECT 
  b.id, 
  s.source_name, 
  s.description
FROM branches b
CROSS JOIN (
  VALUES 
    ('Room Bookings', 'Revenue from room reservations'),
    ('Restaurant', 'Revenue from restaurant operations'),
    ('Bar', 'Revenue from bar operations'),
    ('Events', 'Revenue from events and functions'),
    ('Other Services', 'Revenue from other hotel services')
) AS s(source_name, description)
ON CONFLICT DO NOTHING;

-- Create trigger functions for updated_at timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = NOW(); 
   RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables
CREATE TRIGGER update_staff_attendance_timestamp BEFORE UPDATE ON staff_attendance
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_staff_shifts_timestamp BEFORE UPDATE ON staff_shifts
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_financial_reports_timestamp BEFORE UPDATE ON financial_reports
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_revenue_sources_timestamp BEFORE UPDATE ON revenue_sources
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_revenue_entries_timestamp BEFORE UPDATE ON revenue_entries
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_expenses_timestamp BEFORE UPDATE ON expenses
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branch_messages_timestamp BEFORE UPDATE ON branch_messages
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branch_notifications_timestamp BEFORE UPDATE ON branch_notifications
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_branch_announcements_timestamp BEFORE UPDATE ON branch_announcements
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_takes_timestamp BEFORE UPDATE ON stock_takes
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stock_take_items_timestamp BEFORE UPDATE ON stock_take_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incoming_shipments_timestamp BEFORE UPDATE ON incoming_shipments
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_incoming_shipment_items_timestamp BEFORE UPDATE ON incoming_shipment_items
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_service_requests_timestamp BEFORE UPDATE ON service_requests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Create RLS policies
ALTER TABLE staff_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_shifts ENABLE ROW LEVEL SECURITY;
ALTER TABLE financial_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE revenue_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE branch_announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_takes ENABLE ROW LEVEL SECURITY;
ALTER TABLE stock_take_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE incoming_shipments ENABLE ROW LEVEL SECURITY;
ALTER TABLE incoming_shipment_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_requests ENABLE ROW LEVEL SECURITY;

-- Create branch access policies
CREATE POLICY branch_access_staff_attendance ON staff_attendance 
  USING (branch_id IN (SELECT id FROM branches WHERE id = branch_id));

CREATE POLICY branch_access_staff_shifts ON staff_shifts
  USING (branch_id IN (SELECT id FROM branches WHERE id = branch_id));

CREATE POLICY branch_access_financial_reports ON financial_reports
  USING (branch_id IN (SELECT id FROM branches WHERE id = branch_id));

CREATE POLICY branch_access_revenue_sources ON revenue_sources
  USING (branch_id IN (SELECT id FROM branches WHERE id = branch_id));

CREATE POLICY branch_access_revenue_entries ON revenue_entries
  USING (branch_id IN (SELECT id FROM branches WHERE id = branch_id));

CREATE POLICY branch_access_expenses ON expenses
  USING (branch_id IN (SELECT id FROM branches WHERE id = branch_id));

CREATE POLICY branch_access_messages ON branch_messages
  USING (branch_id IN (SELECT id FROM branches WHERE id = branch_id));

CREATE POLICY branch_access_notifications ON branch_notifications
  USING (branch_id IN (SELECT id FROM branches WHERE id = branch_id) OR is_global = true);

CREATE POLICY branch_access_announcements ON branch_announcements
  USING (branch_id IN (SELECT id FROM branches WHERE id = branch_id) OR is_global = true);

CREATE POLICY branch_access_stock_takes ON stock_takes
  USING (branch_id IN (SELECT id FROM branches WHERE id = branch_id));

CREATE POLICY branch_access_incoming_shipments ON incoming_shipments
  USING (branch_id IN (SELECT id FROM branches WHERE id = branch_id));

CREATE POLICY branch_access_service_requests ON service_requests
  USING (branch_id IN (SELECT id FROM branches WHERE id = branch_id));

-- Grant necessary permissions to API role
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO api_user;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO api_user;
