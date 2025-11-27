-- Create staff profile table
CREATE TABLE staff_profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id) NOT NULL,
  role TEXT NOT NULL,
  department TEXT NOT NULL,
  shift TEXT NOT NULL,
  salary DECIMAL(10, 2) NOT NULL,
  start_date DATE NOT NULL,
  id_number TEXT NOT NULL,
  emergency_contact TEXT,
  address TEXT,
  status TEXT DEFAULT 'active' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_id_number CHECK (char_length(id_number) >= 3 AND char_length(id_number) <= 50),
  CONSTRAINT valid_shift CHECK (shift IN ('morning', 'evening', 'night')),
  CONSTRAINT valid_status CHECK (status IN ('active', 'on_leave', 'terminated')),
  CONSTRAINT valid_department CHECK (department IN (
    'housekeeping',
    'restaurant',
    'reception',
    'maintenance',
    'finance',
    'management'
  ))
);

-- Create staff schedules table
CREATE TABLE staff_schedules (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES staff_profiles(id) NOT NULL,
  shift TEXT NOT NULL,
  date DATE NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_shift CHECK (shift IN ('morning', 'evening', 'night')),
  UNIQUE(staff_id, date)
);

-- Create staff leave table
CREATE TABLE staff_leave (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES staff_profiles(id) NOT NULL,
  leave_type TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  reason TEXT,
  notes TEXT,
  approved_by UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_dates CHECK (end_date >= start_date),
  CONSTRAINT valid_leave_type CHECK (leave_type IN (
    'annual',
    'sick',
    'maternity',
    'paternity',
    'unpaid',
    'other'
  )),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'approved', 'rejected', 'cancelled'))
);

-- Create staff payroll table
CREATE TABLE staff_payroll (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES staff_profiles(id) NOT NULL,
  month INTEGER NOT NULL,
  year INTEGER NOT NULL,
  base_salary DECIMAL(10, 2) NOT NULL,
  overtime_hours INTEGER DEFAULT 0,
  overtime_rate DECIMAL(10, 2) DEFAULT 0,
  bonuses DECIMAL(10, 2) DEFAULT 0,
  deductions DECIMAL(10, 2) DEFAULT 0,
  net_salary DECIMAL(10, 2) NOT NULL,
  status TEXT DEFAULT 'pending' NOT NULL,
  notes TEXT,
  processed_by UUID REFERENCES users(id),
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_month CHECK (month BETWEEN 1 AND 12),
  CONSTRAINT valid_year CHECK (year >= 2020),
  CONSTRAINT valid_amounts CHECK (
    base_salary >= 0 AND
    overtime_hours >= 0 AND
    overtime_rate >= 0 AND
    bonuses >= 0 AND
    deductions >= 0 AND
    net_salary >= 0
  ),
  CONSTRAINT valid_status CHECK (status IN ('pending', 'processed', 'paid')),
  UNIQUE(staff_id, month, year)
);

-- Create staff performance table
CREATE TABLE staff_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_id UUID REFERENCES staff_profiles(id) NOT NULL,
  reviewer_id UUID REFERENCES users(id) NOT NULL,
  review_period_month INTEGER NOT NULL,
  review_period_year INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  attendance INTEGER NOT NULL,
  punctuality INTEGER NOT NULL,
  teamwork INTEGER NOT NULL,
  customer_service INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE,

  CONSTRAINT valid_month CHECK (review_period_month BETWEEN 1 AND 12),
  CONSTRAINT valid_year CHECK (review_period_year >= 2020),
  CONSTRAINT valid_ratings CHECK (
    rating BETWEEN 1 AND 5 AND
    attendance BETWEEN 1 AND 5 AND
    punctuality BETWEEN 1 AND 5 AND
    teamwork BETWEEN 1 AND 5 AND
    customer_service BETWEEN 1 AND 5
  ),
  UNIQUE(staff_id, review_period_month, review_period_year)
);

-- Enable RLS
ALTER TABLE staff_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_leave ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_payroll ENABLE ROW LEVEL SECURITY;
ALTER TABLE staff_performance ENABLE ROW LEVEL SECURITY;

-- Staff profiles policies
CREATE POLICY "Staff can view their own profile"
  ON staff_profiles
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Management can view all staff profiles"
  ON staff_profiles
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager')
    )
  );

CREATE POLICY "Management can manage staff profiles"
  ON staff_profiles
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager')
    )
  );

-- Staff schedules policies
CREATE POLICY "Staff can view their own schedule"
  ON staff_schedules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = staff_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Management can view all schedules"
  ON staff_schedules
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager')
    )
  );

CREATE POLICY "Management can manage schedules"
  ON staff_schedules
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager')
    )
  );

-- Staff leave policies
CREATE POLICY "Staff can view their own leave"
  ON staff_leave
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = staff_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Staff can request leave"
  ON staff_leave
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = staff_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Management can view all leave"
  ON staff_leave
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager')
    )
  );

CREATE POLICY "Management can manage leave"
  ON staff_leave
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager')
    )
  );

-- Staff payroll policies
CREATE POLICY "Staff can view their own payroll"
  ON staff_payroll
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = staff_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Management can view all payroll"
  ON staff_payroll
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'accountant')
    )
  );

CREATE POLICY "Management can manage payroll"
  ON staff_payroll
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager', 'accountant')
    )
  );

-- Staff performance policies
CREATE POLICY "Staff can view their own performance"
  ON staff_performance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM staff_profiles 
      WHERE id = staff_id 
      AND user_id = auth.uid()
    )
  );

CREATE POLICY "Management can view all performance"
  ON staff_performance
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager')
    )
  );

CREATE POLICY "Management can manage performance"
  ON staff_performance
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users 
      WHERE id = auth.uid() 
      AND role IN ('super_admin', 'manager')
    )
  );

-- Create function to update staff profile timestamps
CREATE OR REPLACE FUNCTION update_staff_profile_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for timestamp updates
CREATE TRIGGER update_staff_profile_timestamp
  BEFORE UPDATE ON staff_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_profile_timestamp();

CREATE TRIGGER update_staff_schedule_timestamp
  BEFORE UPDATE ON staff_schedules
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_profile_timestamp();

CREATE TRIGGER update_staff_leave_timestamp
  BEFORE UPDATE ON staff_leave
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_profile_timestamp();

CREATE TRIGGER update_staff_payroll_timestamp
  BEFORE UPDATE ON staff_payroll
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_profile_timestamp();

CREATE TRIGGER update_staff_performance_timestamp
  BEFORE UPDATE ON staff_performance
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_profile_timestamp();

-- Create function to automatically create staff profile
CREATE OR REPLACE FUNCTION create_staff_profile()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.role IN ('super_admin', 'manager', 'receptionist', 'housekeeping', 'restaurant', 'maintenance', 'accountant') THEN
    INSERT INTO staff_profiles (
      user_id,
      role,
      department,
      shift,
      salary,
      start_date,
      id_number
    ) VALUES (
      NEW.id,
      NEW.role,
      CASE 
        WHEN NEW.role = 'super_admin' OR NEW.role = 'manager' THEN 'management'
        WHEN NEW.role = 'accountant' THEN 'finance'
        ELSE NEW.role
      END,
      'morning',
      0,
      CURRENT_DATE,
      'pending'
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for new staff users
CREATE TRIGGER on_staff_user_created
  AFTER INSERT ON users
  FOR EACH ROW
  WHEN (NEW.role IN ('super_admin', 'manager', 'receptionist', 'housekeeping', 'restaurant', 'maintenance', 'accountant'))
  EXECUTE FUNCTION create_staff_profile();
