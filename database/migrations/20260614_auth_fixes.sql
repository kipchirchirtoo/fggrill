-- ============================================================
-- AUTHENTICATION SCHEMA ALIGNMENT - 2026-06-14
-- Fixes missing auth_logs table and users.branch_id column 
-- ============================================================

-- 1. Ensure users table has branch_id
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS branch_id INTEGER REFERENCES public.branches(id);

-- 2. Create auth_logs table matching backend expected schema
CREATE TABLE IF NOT EXISTS public.auth_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('success', 'failed', 'locked', 'invalid_pin')),
    message TEXT,
    auth_method TEXT DEFAULT 'password' CHECK (auth_method IN ('password', 'pos_pin', 'oauth')),
    
    ip_address TEXT,
    user_agent TEXT,
    device_type TEXT,
    browser TEXT,
    os TEXT,
    
    geo_country TEXT,
    geo_city TEXT,
    geo_region TEXT,
    geo_latitude NUMERIC(10,8),
    geo_longitude NUMERIC(11,8),
    is_proxy BOOLEAN DEFAULT false,
    is_vpn BOOLEAN DEFAULT false,
    is_tor BOOLEAN DEFAULT false,
    is_datacenter BOOLEAN DEFAULT false,
    
    threat_score INTEGER,
    is_suspicious BOOLEAN DEFAULT false,
    threat_reason TEXT,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_auth_logs_user_id ON public.auth_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_auth_logs_email ON public.auth_logs(email);
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON public.auth_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_status ON public.auth_logs(status);
CREATE INDEX IF NOT EXISTS idx_auth_logs_geo_country ON public.auth_logs(geo_country);
CREATE INDEX IF NOT EXISTS idx_auth_logs_ip_address ON public.auth_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_auth_logs_is_suspicious ON public.auth_logs(is_suspicious);
CREATE INDEX IF NOT EXISTS idx_auth_logs_threat_score ON public.auth_logs(threat_score);
