-- Branch Oversight Tables Migration
-- Run this migration to create tables for branch performance, staff, and compliance tracking

-- ==========================================
-- BRANCH PERFORMANCE METRICS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS branch_performance_metrics (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    revenue DECIMAL(15, 2) DEFAULT 0,
    orders_count INTEGER DEFAULT 0,
    avg_order_value DECIMAL(10, 2) DEFAULT 0,
    customer_satisfaction DECIMAL(3, 2) DEFAULT 0,
    staff_efficiency DECIMAL(5, 2) DEFAULT 0,
    inventory_turnover DECIMAL(5, 2) DEFAULT 0,
    target_achievement DECIMAL(5, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, period_start, period_end)
);

-- ==========================================
-- STAFF PERFORMANCE TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS staff_performance (
    id SERIAL PRIMARY KEY,
    staff_id UUID REFERENCES staff_profiles(id) ON DELETE CASCADE,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    period_start DATE NOT NULL,
    period_end DATE NOT NULL,
    performance_score DECIMAL(5, 2) DEFAULT 0,
    attendance_rate DECIMAL(5, 2) DEFAULT 0,
    shifts_completed INTEGER DEFAULT 0,
    shifts_missed INTEGER DEFAULT 0,
    overtime_hours DECIMAL(6, 2) DEFAULT 0,
    customer_rating DECIMAL(3, 2) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- COMPLIANCE REQUIREMENTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS compliance_requirements (
    id SERIAL PRIMARY KEY,
    category VARCHAR(100) NOT NULL,
    requirement VARCHAR(255) NOT NULL,
    description TEXT,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
    frequency VARCHAR(50) DEFAULT 'annual',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- BRANCH COMPLIANCE STATUS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS branch_compliance (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
    requirement_id INTEGER NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
    status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('compliant', 'non_compliant', 'pending', 'expired')),
    due_date DATE,
    last_checked DATE,
    checked_by VARCHAR(255),
    notes TEXT,
    documents JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, requirement_id)
);

-- ==========================================
-- SEED COMPLIANCE REQUIREMENTS (Minimal)
-- ==========================================
-- Note: Add compliance requirements manually through the admin interface
-- The following are just essential baseline requirements
INSERT INTO compliance_requirements (category, requirement, description, priority, frequency) VALUES
    ('Licensing', 'Business License', 'Valid business operating license from county government', 'high', 'annual'),
    ('Health & Safety', 'Health Certificate', 'Public health certificate from Ministry of Health', 'high', 'annual'),
    ('Fire Safety', 'Fire Safety Certificate', 'Certificate from fire department', 'high', 'annual'),
    ('Food Safety', 'Food Handler Certificates', 'Valid food handler certificates for all kitchen staff', 'high', 'annual')
ON CONFLICT DO NOTHING;

-- ==========================================
-- CREATE INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_branch_performance_branch ON branch_performance_metrics(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_performance_period ON branch_performance_metrics(period_start, period_end);
CREATE INDEX IF NOT EXISTS idx_staff_performance_staff ON staff_performance(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_performance_branch ON staff_performance(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_compliance_branch ON branch_compliance(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_compliance_status ON branch_compliance(status);
CREATE INDEX IF NOT EXISTS idx_branch_compliance_due_date ON branch_compliance(due_date);
