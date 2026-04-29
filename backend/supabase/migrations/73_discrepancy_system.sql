-- Discrepancy Flagging System
CREATE TABLE IF NOT EXISTS public.discrepancy_flags (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    branch_id BIGINT REFERENCES public.branches(id),
    record_date DATE NOT NULL,
    flag_type VARCHAR(50) NOT NULL, -- 'PAYMENT_MISMATCH', 'CASH_VARIANCE', 'EXPENSE_SPIKE', 'WASTAGE_EXCESS'
    severity VARCHAR(20) DEFAULT 'MEDIUM', -- 'LOW', 'MEDIUM', 'HIGH', 'CRITICAL'
    description TEXT,
    auto_detected BOOLEAN DEFAULT TRUE,
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'UNDER_REVIEW', 'RESOLVED', 'ESCALATED'
    
    auditor_id UUID REFERENCES public.users(id),
    auditor_comments TEXT,
    
    accountant_id UUID REFERENCES public.users(id),
    accountant_response TEXT,
    
    director_id UUID REFERENCES public.users(id),
    director_final_decision TEXT,
    
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexing for performance
CREATE INDEX IF NOT EXISTS idx_discrepancy_branch_date ON public.discrepancy_flags(branch_id, record_date);
CREATE INDEX IF NOT EXISTS idx_discrepancy_status ON public.discrepancy_flags(status);

-- Enable RLS
ALTER TABLE public.discrepancy_flags ENABLE ROW LEVEL SECURITY;

-- Policies (Simplified for now)
CREATE POLICY "Enable all for authenticated users" ON public.discrepancy_flags
    FOR ALL USING (auth.role() = 'authenticated');

-- Audit Logs Table (If not already exists)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.users(id),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(50),
    resource_id UUID,
    old_data JSONB,
    new_data JSONB,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
