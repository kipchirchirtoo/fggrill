-- =====================================================
-- SECURITY MANAGEMENT TABLES
-- =====================================================
-- Purpose: Support comprehensive security dashboard functionality
-- Date: 2026-04-27
-- =====================================================

-- =====================================================
-- 1. SECURITY CONFIGURATION TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS security_config (
    id INTEGER PRIMARY KEY DEFAULT 1,
    
    -- Authentication
    jwt_expiry_minutes INTEGER DEFAULT 15,
    refresh_token_rotation BOOLEAN DEFAULT TRUE,
    session_timeout_minutes INTEGER DEFAULT 480,
    max_failed_attempts INTEGER DEFAULT 5,
    lockout_duration_minutes INTEGER DEFAULT 15,
    
    -- Rate Limiting
    auth_rate_limit INTEGER DEFAULT 20,
    financial_rate_limit INTEGER DEFAULT 30,
    general_rate_limit INTEGER DEFAULT 100,
    
    -- Security Features
    require_2fa_for_admin BOOLEAN DEFAULT TRUE,
    require_2fa_for_financial BOOLEAN DEFAULT FALSE,
    ip_whitelist_enabled BOOLEAN DEFAULT FALSE,
    geo_blocking_enabled BOOLEAN DEFAULT FALSE,
    vpn_detection_enabled BOOLEAN DEFAULT TRUE,
    
    -- Audit & Monitoring
    log_all_api_calls BOOLEAN DEFAULT TRUE,
    alert_on_suspicious_activity BOOLEAN DEFAULT TRUE,
    alert_on_failed_logins INTEGER DEFAULT 3,
    alert_on_role_changes BOOLEAN DEFAULT TRUE,
    
    -- Database Security
    rls_enabled BOOLEAN DEFAULT TRUE,
    backup_frequency_hours INTEGER DEFAULT 24,
    encryption_at_rest BOOLEAN DEFAULT TRUE,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure only one row
    CONSTRAINT single_row CHECK (id = 1)
);

-- Insert default configuration
INSERT INTO security_config (id) VALUES (1)
ON CONFLICT (id) DO NOTHING;

-- =====================================================
-- 2. BLOCKED IPS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS blocked_ips (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL UNIQUE,
    reason TEXT,
    blocked_by UUID REFERENCES users(id) ON DELETE SET NULL,
    blocked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_permanent BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_blocked_ips_ip ON blocked_ips(ip_address);
CREATE INDEX IF NOT EXISTS idx_blocked_ips_blocked_at ON blocked_ips(blocked_at);

-- =====================================================
-- 3. RLS POLICY FUNCTION
-- =====================================================

-- Function to get RLS policies status
CREATE OR REPLACE FUNCTION get_rls_policies()
RETURNS TABLE (
    table_name TEXT,
    policy_name TEXT,
    policy_type TEXT,
    enabled BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        schemaname || '.' || tablename AS table_name,
        policyname AS policy_name,
        cmd AS policy_type,
        TRUE AS enabled
    FROM pg_policies
    WHERE schemaname = 'public'
    ORDER BY tablename, policyname;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- 4. RLS POLICIES FOR SECURITY TABLES
-- =====================================================

-- Security config - super admin only
ALTER TABLE security_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can view security config"
    ON security_config FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

CREATE POLICY "Super admin can update security config"
    ON security_config FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- Blocked IPs - super admin only
ALTER TABLE blocked_ips ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin can view blocked IPs"
    ON blocked_ips FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

CREATE POLICY "Super admin can manage blocked IPs"
    ON blocked_ips FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid() 
            AND role = 'super_admin'
        )
    );

-- =====================================================
-- 5. GRANT PERMISSIONS
-- =====================================================

GRANT ALL ON security_config TO authenticated;
GRANT ALL ON blocked_ips TO authenticated;
GRANT EXECUTE ON FUNCTION get_rls_policies() TO authenticated;

-- =====================================================
-- COMPLETION
-- =====================================================

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
