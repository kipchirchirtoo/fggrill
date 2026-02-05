-- =====================================================
-- ATTENDANCE & OVERTIME SYSTEM (KENYAN LABOUR LAW)
-- =====================================================

-- 1. Kenyan Public Holidays
CREATE TABLE IF NOT EXISTS kenyan_public_holidays (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    holiday_date DATE NOT NULL,
    is_recurring BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed Fixed Kenyan Holidays
INSERT INTO kenyan_public_holidays (name, holiday_date, is_recurring) VALUES
('New Year''s Day', '2026-01-01', true),
('Labour Day', '2026-05-01', true),
('Madaraka Day', '2026-06-01', true),
('Mashujaa Day', '2026-10-20', true),
('Jamhuri Day', '2026-12-12', true),
('Christmas Day', '2026-12-25', true),
('Utamaduni Day', '2026-12-26', true)
ON CONFLICT DO NOTHING;

-- 2. Audit Logs for Attendance
CREATE TABLE IF NOT EXISTS attendance_audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    record_id UUID NOT NULL,
    editor_id UUID REFERENCES users(id),
    old_values JSONB,
    new_values JSONB,
    reason TEXT NOT NULL,
    performed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Update staff_profiles with compensation & tracking rules
ALTER TABLE staff_profiles 
ADD COLUMN IF NOT EXISTS rest_day INTEGER DEFAULT 0, -- 0=Sunday, 6=Saturday
ADD COLUMN IF NOT EXISTS hourly_base_rate DECIMAL(10, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS rfid_tag TEXT UNIQUE;

-- 4. Enhance staff_attendance for detailed tracking
DO $$ 
BEGIN
    -- Method & Device Tracking
    ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS in_method TEXT DEFAULT 'pin' CHECK (in_method IN ('biometric', 'rfid', 'pin', 'manual'));
    ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS out_method TEXT DEFAULT 'pin' CHECK (out_method IN ('biometric', 'rfid', 'pin', 'manual'));
    ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS device_id TEXT;
    
    -- Hour Categorization
    ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS hours_normal DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS hours_ot_weekday DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS hours_ot_rest DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS hours_ot_holiday DECIMAL(10, 2) DEFAULT 0;
    ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS hours_night DECIMAL(10, 2) DEFAULT 0;
    
    -- Status & Controls
    ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS is_approved BOOLEAN DEFAULT true;
    ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id);
    ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT false;
    ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS rejection_reason TEXT;
    
    -- Additional metadata
    ALTER TABLE staff_attendance ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
END $$;

-- 5. Indexes for reporting
CREATE INDEX IF NOT EXISTS idx_attendance_date ON staff_attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_staff_perf ON staff_attendance(staff_id, attendance_date);
CREATE INDEX IF NOT EXISTS idx_holidays_date ON kenyan_public_holidays(holiday_date);
