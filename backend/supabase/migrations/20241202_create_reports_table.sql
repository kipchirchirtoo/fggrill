-- Create reports table for storing generated and scheduled reports
-- Migration: 20241202_create_reports_table.sql

-- Reports table
CREATE TABLE IF NOT EXISTS public.reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL, -- 'occupancy', 'revenue', 'expense', 'stock_levels', etc.
    category VARCHAR(100) NOT NULL, -- 'operations', 'financial', 'inventory'
    description TEXT,
    parameters JSONB DEFAULT '{}', -- Store report parameters like date range, filters
    data JSONB, -- Store generated report data
    file_url TEXT, -- URL to generated PDF/Excel file
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'generating', 'completed', 'failed'
    created_by UUID REFERENCES public.users(id),
    branch_id INTEGER REFERENCES public.branches(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    generated_at TIMESTAMPTZ
);

-- Scheduled reports table
CREATE TABLE IF NOT EXISTS public.scheduled_reports (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    report_type VARCHAR(100) NOT NULL,
    frequency VARCHAR(50) NOT NULL, -- 'daily', 'weekly', 'monthly'
    schedule_time TIME NOT NULL,
    schedule_day INTEGER, -- Day of week (0-6) for weekly, day of month (1-31) for monthly
    parameters JSONB DEFAULT '{}',
    recipients TEXT[], -- Email addresses
    is_active BOOLEAN DEFAULT true,
    last_run_at TIMESTAMPTZ,
    next_run_at TIMESTAMPTZ,
    created_by UUID REFERENCES public.users(id),
    branch_id INTEGER REFERENCES public.branches(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Report templates table
CREATE TABLE IF NOT EXISTS public.report_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    type VARCHAR(100) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    query_template TEXT, -- SQL query template
    parameters_schema JSONB, -- JSON schema for parameters
    output_format VARCHAR(50) DEFAULT 'pdf', -- 'pdf', 'excel', 'csv'
    is_system BOOLEAN DEFAULT false, -- System templates cannot be deleted
    created_by UUID REFERENCES public.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_reports_type ON public.reports(type);
CREATE INDEX IF NOT EXISTS idx_reports_category ON public.reports(category);
CREATE INDEX IF NOT EXISTS idx_reports_status ON public.reports(status);
CREATE INDEX IF NOT EXISTS idx_reports_created_by ON public.reports(created_by);
CREATE INDEX IF NOT EXISTS idx_reports_branch_id ON public.reports(branch_id);
CREATE INDEX IF NOT EXISTS idx_reports_created_at ON public.reports(created_at);

CREATE INDEX IF NOT EXISTS idx_scheduled_reports_is_active ON public.scheduled_reports(is_active);
CREATE INDEX IF NOT EXISTS idx_scheduled_reports_next_run ON public.scheduled_reports(next_run_at);

-- Enable RLS
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

-- RLS Policies for reports
CREATE POLICY "Users can view reports they created or for their branch"
    ON public.reports FOR SELECT
    USING (
        created_by = auth.uid() OR
        branch_id IN (SELECT branch_id FROM public.users WHERE id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager'))
    );

CREATE POLICY "Users can create reports"
    ON public.reports FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage all reports"
    ON public.reports FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager'))
    );

-- RLS Policies for scheduled_reports
CREATE POLICY "Users can view scheduled reports for their branch"
    ON public.scheduled_reports FOR SELECT
    USING (
        created_by = auth.uid() OR
        branch_id IN (SELECT branch_id FROM public.users WHERE id = auth.uid()) OR
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager'))
    );

CREATE POLICY "Admins can manage scheduled reports"
    ON public.scheduled_reports FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager'))
    );

-- RLS Policies for report_templates
CREATE POLICY "All authenticated users can view report templates"
    ON public.report_templates FOR SELECT
    USING (auth.uid() IS NOT NULL);

CREATE POLICY "Admins can manage report templates"
    ON public.report_templates FOR ALL
    USING (
        EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('super_admin', 'general_manager'))
    );

-- Insert default report templates
INSERT INTO public.report_templates (name, type, category, description, is_system) VALUES
    ('Occupancy Report', 'occupancy', 'operations', 'Room occupancy rates and trends', true),
    ('Housekeeping Report', 'housekeeping', 'operations', 'Cleaning status and staff performance', true),
    ('Maintenance Report', 'maintenance', 'operations', 'Work orders and equipment status', true),
    ('Arrivals & Departures', 'arrivals_departures', 'operations', 'Daily guest movements', true),
    ('Revenue Report', 'revenue', 'financial', 'Income by source and period', true),
    ('Expense Report', 'expense', 'financial', 'Expenditure breakdown', true),
    ('Profit & Loss', 'profit_loss', 'financial', 'Financial performance summary', true),
    ('Accounts Receivable', 'accounts_receivable', 'financial', 'Outstanding payments', true),
    ('Stock Levels', 'stock_levels', 'inventory', 'Current inventory status', true),
    ('Consumption Report', 'consumption', 'inventory', 'Usage patterns and trends', true),
    ('Low Stock Alert', 'low_stock', 'inventory', 'Items below reorder point', true),
    ('Purchase Orders', 'purchase_orders', 'inventory', 'Order history and status', true)
ON CONFLICT DO NOTHING;

-- Update trigger for updated_at
CREATE OR REPLACE FUNCTION update_reports_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS reports_updated_at ON public.reports;
CREATE TRIGGER reports_updated_at
    BEFORE UPDATE ON public.reports
    FOR EACH ROW
    EXECUTE FUNCTION update_reports_updated_at();

DROP TRIGGER IF EXISTS scheduled_reports_updated_at ON public.scheduled_reports;
CREATE TRIGGER scheduled_reports_updated_at
    BEFORE UPDATE ON public.scheduled_reports
    FOR EACH ROW
    EXECUTE FUNCTION update_reports_updated_at();

DROP TRIGGER IF EXISTS report_templates_updated_at ON public.report_templates;
CREATE TRIGGER report_templates_updated_at
    BEFORE UPDATE ON public.report_templates
    FOR EACH ROW
    EXECUTE FUNCTION update_reports_updated_at();
