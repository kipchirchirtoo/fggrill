-- ==========================================
-- SUPERADMIN LOGS CENTER - ENHANCEMENTS
-- ==========================================

-- 1. Historical Auth Logs (Captures EVERY login attempt)
CREATE TABLE IF NOT EXISTS auth_logs (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    status TEXT NOT NULL, -- 'success', 'failed', 'locked', 'invalid_pin'
    ip_address TEXT,
    user_agent TEXT,
    device_info JSONB, -- { "os": "Windows", "browser": "Chrome", "device": "Desktop" }
    geo_location JSONB, -- { "city": "Nairobi", "country": "Kenya", "lat": -1.28, "lon": 36.82 }
    auth_method TEXT DEFAULT 'password', -- 'password', 'pos_pin', 'oauth'
    message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Security Events (For anomaly detection alerts)
CREATE TABLE IF NOT EXISTS security_events (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    event_type TEXT NOT NULL, -- 'impossible_travel', 'multiple_failures', 'role_escalation'
    severity TEXT NOT NULL DEFAULT 'INFO', -- 'INFO', 'WARN', 'CRITICAL'
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    description TEXT NOT NULL,
    metadata JSONB DEFAULT '{}', -- Details about the anomaly
    status TEXT DEFAULT 'open', -- 'open', 'investigated', 'resolved'
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Enhance existing audit_trail if missing some fields (safely)
DO $$ 
BEGIN 
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_trail' AND column_name='geo_location') THEN
        ALTER TABLE audit_trail ADD COLUMN geo_location JSONB DEFAULT '{}';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='audit_trail' AND column_name='device_info') THEN
        ALTER TABLE audit_trail ADD COLUMN device_info JSONB DEFAULT '{}';
    END IF;
END $$;

-- 4. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_auth_logs_created_at ON auth_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_logs_email ON auth_logs(email);
CREATE INDEX IF NOT EXISTS idx_auth_logs_status ON auth_logs(status);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);

-- 5. Enable RLS
ALTER TABLE auth_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- 6. Superadmin ONLY policies
CREATE POLICY "Superadmins can view all auth logs" ON auth_logs
    FOR SELECT USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager')));

CREATE POLICY "Superadmins can manage security events" ON security_events
    FOR ALL USING (EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND role IN ('super_admin', 'manager')));
