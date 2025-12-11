-- Strategic Planning & Analytics Tables Migration
-- Run this migration to create tables for budgets, forecasting, procurement, and analytics

-- ==========================================
-- BUDGETS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS budgets (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    fiscal_year INTEGER NOT NULL,
    fiscal_month INTEGER CHECK (fiscal_month >= 1 AND fiscal_month <= 12),
    category VARCHAR(100) NOT NULL,
    subcategory VARCHAR(100),
    budgeted_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    actual_amount DECIMAL(15, 2) DEFAULT 0,
    variance DECIMAL(15, 2) GENERATED ALWAYS AS (actual_amount - budgeted_amount) STORED,
    variance_percentage DECIMAL(5, 2),
    notes TEXT,
    status VARCHAR(20) DEFAULT 'draft' CHECK (status IN ('draft', 'pending', 'approved', 'rejected')),
    approved_by UUID REFERENCES users(id),
    approved_at TIMESTAMP WITH TIME ZONE,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, fiscal_year, fiscal_month, category, subcategory)
);

-- ==========================================
-- BUDGET CATEGORIES TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS budget_categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    parent_id INTEGER REFERENCES budget_categories(id),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed budget categories
INSERT INTO budget_categories (name, description) VALUES
    ('Revenue', 'All revenue streams'),
    ('Food & Beverage', 'Food and beverage sales'),
    ('Room Revenue', 'Room booking revenue'),
    ('Other Revenue', 'Miscellaneous revenue'),
    ('Cost of Goods Sold', 'Direct costs of goods sold'),
    ('Food Costs', 'Cost of food ingredients'),
    ('Beverage Costs', 'Cost of beverages'),
    ('Operating Expenses', 'Day-to-day operational costs'),
    ('Salaries & Wages', 'Staff compensation'),
    ('Utilities', 'Electricity, water, gas'),
    ('Rent & Lease', 'Property rental costs'),
    ('Marketing', 'Advertising and promotions'),
    ('Maintenance', 'Repairs and maintenance'),
    ('Administrative', 'Office and admin expenses'),
    ('Capital Expenditure', 'Long-term investments'),
    ('Equipment', 'Equipment purchases'),
    ('Renovations', 'Property improvements')
ON CONFLICT (name) DO NOTHING;

-- ==========================================
-- FORECASTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS forecasts (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    forecast_type VARCHAR(50) NOT NULL CHECK (forecast_type IN ('revenue', 'expense', 'occupancy', 'sales', 'custom')),
    metric_name VARCHAR(100) NOT NULL,
    forecast_date DATE NOT NULL,
    forecast_value DECIMAL(15, 2) NOT NULL,
    actual_value DECIMAL(15, 2),
    confidence_level DECIMAL(5, 2) DEFAULT 80,
    model_used VARCHAR(50) DEFAULT 'linear',
    notes TEXT,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- FORECAST MODELS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS forecast_models (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    description TEXT,
    model_type VARCHAR(50) NOT NULL,
    parameters JSONB DEFAULT '{}',
    accuracy_score DECIMAL(5, 2),
    last_trained_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- PROCUREMENT REQUESTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS procurement_requests (
    id SERIAL PRIMARY KEY,
    request_number VARCHAR(50) UNIQUE NOT NULL,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    category VARCHAR(100) NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    items JSONB NOT NULL DEFAULT '[]',
    total_amount DECIMAL(15, 2) NOT NULL DEFAULT 0,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    status VARCHAR(30) DEFAULT 'pending' CHECK (status IN ('draft', 'pending', 'under_review', 'approved', 'rejected', 'ordered', 'received', 'cancelled')),
    requested_by UUID REFERENCES users(id),
    reviewed_by UUID REFERENCES users(id),
    approved_by UUID REFERENCES users(id),
    requested_date DATE DEFAULT CURRENT_DATE,
    required_date DATE,
    approved_at TIMESTAMP WITH TIME ZONE,
    notes TEXT,
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- PROCUREMENT VENDORS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS procurement_vendors (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    category VARCHAR(100),
    rating DECIMAL(3, 2) DEFAULT 0,
    is_preferred BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    payment_terms VARCHAR(100),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- ANALYTICS REPORTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS analytics_reports (
    id SERIAL PRIMARY KEY,
    report_name VARCHAR(255) NOT NULL,
    report_type VARCHAR(50) NOT NULL CHECK (report_type IN ('financial', 'operational', 'sales', 'inventory', 'staff', 'custom')),
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    date_from DATE NOT NULL,
    date_to DATE NOT NULL,
    parameters JSONB DEFAULT '{}',
    data JSONB DEFAULT '{}',
    generated_by UUID REFERENCES users(id),
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    file_path VARCHAR(500),
    file_format VARCHAR(20) DEFAULT 'json',
    is_scheduled BOOLEAN DEFAULT false,
    schedule_cron VARCHAR(100),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ==========================================
-- ANALYTICS METRICS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS analytics_metrics (
    id SERIAL PRIMARY KEY,
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15, 2) NOT NULL,
    metric_unit VARCHAR(50),
    category VARCHAR(100),
    comparison_value DECIMAL(15, 2),
    comparison_period VARCHAR(50),
    trend VARCHAR(20) CHECK (trend IN ('up', 'down', 'stable')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(branch_id, metric_date, metric_name)
);

-- ==========================================
-- EXECUTIVE DASHBOARD SNAPSHOTS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS executive_snapshots (
    id SERIAL PRIMARY KEY,
    snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_revenue DECIMAL(15, 2) DEFAULT 0,
    total_expenses DECIMAL(15, 2) DEFAULT 0,
    net_profit DECIMAL(15, 2) DEFAULT 0,
    profit_margin DECIMAL(5, 2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    total_customers INTEGER DEFAULT 0,
    avg_order_value DECIMAL(10, 2) DEFAULT 0,
    occupancy_rate DECIMAL(5, 2) DEFAULT 0,
    staff_count INTEGER DEFAULT 0,
    branch_data JSONB DEFAULT '[]',
    kpi_data JSONB DEFAULT '{}',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(snapshot_date)
);

-- ==========================================
-- KPI DEFINITIONS TABLE
-- ==========================================
CREATE TABLE IF NOT EXISTS kpi_definitions (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    calculation_formula TEXT,
    target_value DECIMAL(15, 2),
    unit VARCHAR(50),
    frequency VARCHAR(20) DEFAULT 'daily',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Seed KPI definitions
INSERT INTO kpi_definitions (name, description, category, target_value, unit, frequency) VALUES
    ('Daily Revenue', 'Total revenue generated per day', 'Financial', 500000, 'KES', 'daily'),
    ('Monthly Revenue', 'Total revenue generated per month', 'Financial', 15000000, 'KES', 'monthly'),
    ('Gross Profit Margin', 'Gross profit as percentage of revenue', 'Financial', 65, '%', 'monthly'),
    ('Net Profit Margin', 'Net profit as percentage of revenue', 'Financial', 20, '%', 'monthly'),
    ('Average Order Value', 'Average value per order', 'Sales', 1500, 'KES', 'daily'),
    ('Orders Per Day', 'Number of orders per day', 'Sales', 200, 'count', 'daily'),
    ('Customer Satisfaction', 'Average customer rating', 'Customer', 4.5, 'rating', 'weekly'),
    ('Staff Efficiency', 'Revenue per staff member', 'Operations', 50000, 'KES', 'monthly'),
    ('Inventory Turnover', 'Times inventory is sold per month', 'Inventory', 4, 'times', 'monthly'),
    ('Food Cost Percentage', 'Food cost as percentage of food revenue', 'Cost', 30, '%', 'monthly')
ON CONFLICT (name) DO NOTHING;

-- ==========================================
-- CREATE INDEXES
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_budgets_branch ON budgets(branch_id);
CREATE INDEX IF NOT EXISTS idx_budgets_year_month ON budgets(fiscal_year, fiscal_month);
CREATE INDEX IF NOT EXISTS idx_budgets_category ON budgets(category);
CREATE INDEX IF NOT EXISTS idx_forecasts_branch ON forecasts(branch_id);
CREATE INDEX IF NOT EXISTS idx_forecasts_date ON forecasts(forecast_date);
CREATE INDEX IF NOT EXISTS idx_forecasts_type ON forecasts(forecast_type);
CREATE INDEX IF NOT EXISTS idx_procurement_branch ON procurement_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_procurement_status ON procurement_requests(status);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_branch ON analytics_reports(branch_id);
CREATE INDEX IF NOT EXISTS idx_analytics_reports_type ON analytics_reports(report_type);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_branch ON analytics_metrics(branch_id);
CREATE INDEX IF NOT EXISTS idx_analytics_metrics_date ON analytics_metrics(metric_date);
CREATE INDEX IF NOT EXISTS idx_executive_snapshots_date ON executive_snapshots(snapshot_date);
