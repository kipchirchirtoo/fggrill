-- Migration: Create report_jobs table for asynchronous report generation
-- Date: 2026-05-22

CREATE TABLE IF NOT EXISTS public.report_jobs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    branch_id INTEGER REFERENCES public.branches(id),
    report_type VARCHAR(100) NOT NULL,
    filters JSONB DEFAULT '{}'::jsonb,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
    result_url TEXT,
    error TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE public.report_jobs ENABLE ROW LEVEL SECURITY;

-- Apply Branch Isolation Policy
DROP POLICY IF EXISTS "Enforce branch isolation on report jobs" ON public.report_jobs;

CREATE POLICY "Enforce branch isolation on report jobs" ON public.report_jobs
    FOR ALL
    USING (
        (SELECT role FROM public.users WHERE id = auth.uid()) IN ('super_admin', 'general_manager', 'hr_manager', 'central_storekeeper', 'auditor')
        OR
        branch_id = public.get_user_branch_id()
    );
