-- Branch Operations Tables Creation
-- This migration adds tables required for branch operations

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Staff Management Extensions
CREATE TABLE IF NOT EXISTS staff_attendance (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  date DATE NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('present', 'absent', 'late', 'leave', 'half_day')),
  check_in TIME,
  check_out TIME,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (staff_id, date)
);

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

CREATE TABLE IF NOT EXISTS staff_shifts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  staff_id UUID NOT NULL,
  branch_id UUID NOT NULL,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  shift_type_id UUID NOT NULL,
  is_confirmed BOOLEAN DEFAULT false,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Financial Reporting Extensions
CREATE TABLE IF NOT EXISTS financial_reports (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  report_type VARCHAR(50) NOT NULL,
  period VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  file_path VARCHAR(255),
  file_format VARCHAR(10) NOT NULL,
  file_size VARCHAR(20) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS revenue_sources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (branch_id, name)
);

CREATE TABLE IF NOT EXISTS revenue_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL,
  source_id UUID NOT NULL,
  entry_date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL,
  category VARCHAR(100) NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  expense_date DATE NOT NULL,
  description TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  approved_by UUID,
  receipt_path VARCHAR(255),
  created_by UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Communications Extensions
CREATE TABLE IF NOT EXISTS branch_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  branch_id UUID NOT NULL,
  sender_id UUID NOT NULL,
  recipient_id UUID,
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
  branch_id UUID NOT NULL,
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
  branch_id UUID NOT NULL,
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  author_id UUID NOT NULL,
  is_pinned BOOLEAN DEFAULT false,
  is_global BOOLEAN DEFAULT false,
  importance VARCHAR(10) NOT NULL DEFAULT 'medium' CHECK (importance IN ('low', 'medium', 'high')),
  expires_at TIMESTAMPTZ,
  target_departments VARCHAR(255)[],
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

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
WHERE EXISTS (SELECT 1 FROM branches LIMIT 1)
ON CONFLICT DO NOTHING;
