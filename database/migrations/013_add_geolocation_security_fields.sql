-- Migration: Add Geolocation and Security Fields to auth_logs
-- Description: Enhances security monitoring with IP geolocation, threat detection, and device fingerprinting

-- Add geolocation columns to auth_logs
ALTER TABLE auth_logs 
ADD COLUMN IF NOT EXISTS geo_country VARCHAR(100),
ADD COLUMN IF NOT EXISTS geo_country_code VARCHAR(10),
ADD COLUMN IF NOT EXISTS geo_region VARCHAR(100),
ADD COLUMN IF NOT EXISTS geo_city VARCHAR(100),
ADD COLUMN IF NOT EXISTS geo_latitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS geo_longitude DECIMAL(10, 7),
ADD COLUMN IF NOT EXISTS geo_timezone VARCHAR(50),
ADD COLUMN IF NOT EXISTS geo_isp VARCHAR(255),
ADD COLUMN IF NOT EXISTS is_proxy BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_vpn BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS is_datacenter BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS threat_score INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_suspicious BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS threat_reason TEXT;

-- Create index for faster geolocation queries
CREATE INDEX IF NOT EXISTS idx_auth_logs_geo_country ON auth_logs(geo_country);
CREATE INDEX IF NOT EXISTS idx_auth_logs_ip_address ON auth_logs(ip_address);
CREATE INDEX IF NOT EXISTS idx_auth_logs_is_suspicious ON auth_logs(is_suspicious);
CREATE INDEX IF NOT EXISTS idx_auth_logs_threat_score ON auth_logs(threat_score);

-- Create IP blocklist table
CREATE TABLE IF NOT EXISTS ip_blocklist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL UNIQUE,
    reason TEXT,
    blocked_by UUID REFERENCES users(id),
    blocked_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_blocklist_ip ON ip_blocklist(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_blocklist_active ON ip_blocklist(is_active);

-- Create IP whitelist table
CREATE TABLE IF NOT EXISTS ip_whitelist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    ip_address VARCHAR(45) NOT NULL UNIQUE,
    description TEXT,
    added_by UUID REFERENCES users(id),
    added_at TIMESTAMP DEFAULT NOW(),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ip_whitelist_ip ON ip_whitelist(ip_address);
CREATE INDEX IF NOT EXISTS idx_ip_whitelist_active ON ip_whitelist(is_active);

-- Create active sessions table
CREATE TABLE IF NOT EXISTS active_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    session_token VARCHAR(255) UNIQUE NOT NULL,
    ip_address VARCHAR(45),
    user_agent TEXT,
    device_info JSONB,
    geo_country VARCHAR(100),
    geo_city VARCHAR(100),
    last_activity TIMESTAMP DEFAULT NOW(),
    created_at TIMESTAMP DEFAULT NOW(),
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE
);

CREATE INDEX IF NOT EXISTS idx_active_sessions_user ON active_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_active_sessions_token ON active_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_active_sessions_active ON active_sessions(is_active);
CREATE INDEX IF NOT EXISTS idx_active_sessions_expires ON active_sessions(expires_at);

-- Create security alerts table
CREATE TABLE IF NOT EXISTS security_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    alert_type VARCHAR(50) NOT NULL, -- 'brute_force', 'suspicious_ip', 'geo_anomaly', 'multiple_failures', etc.
    severity VARCHAR(20) NOT NULL, -- 'low', 'medium', 'high', 'critical'
    user_id UUID REFERENCES users(id),
    ip_address VARCHAR(45),
    description TEXT,
    metadata JSONB,
    status VARCHAR(20) DEFAULT 'open', -- 'open', 'investigating', 'resolved', 'false_positive'
    resolved_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(alert_type);
CREATE INDEX IF NOT EXISTS idx_security_alerts_severity ON security_alerts(severity);
CREATE INDEX IF NOT EXISTS idx_security_alerts_status ON security_alerts(status);
CREATE INDEX IF NOT EXISTS idx_security_alerts_user ON security_alerts(user_id);
CREATE INDEX IF NOT EXISTS idx_security_alerts_created ON security_alerts(created_at);

-- Create function to detect brute force attempts
CREATE OR REPLACE FUNCTION detect_brute_force_attempts()
RETURNS TRIGGER AS $$
DECLARE
    failed_count INTEGER;
    alert_exists BOOLEAN;
BEGIN
    -- Only check for failed login attempts
    IF NEW.status = 'failed' THEN
        -- Count failed attempts from this IP in the last 15 minutes
        SELECT COUNT(*) INTO failed_count
        FROM auth_logs
        WHERE ip_address = NEW.ip_address
        AND status = 'failed'
        AND created_at > NOW() - INTERVAL '15 minutes';

        -- If more than 5 failed attempts, create security alert
        IF failed_count >= 5 THEN
            -- Check if alert already exists for this IP
            SELECT EXISTS(
                SELECT 1 FROM security_alerts
                WHERE ip_address = NEW.ip_address
                AND alert_type = 'brute_force'
                AND status = 'open'
                AND created_at > NOW() - INTERVAL '1 hour'
            ) INTO alert_exists;

            -- Create alert if it doesn't exist
            IF NOT alert_exists THEN
                INSERT INTO security_alerts (
                    alert_type,
                    severity,
                    user_id,
                    ip_address,
                    description,
                    metadata
                ) VALUES (
                    'brute_force',
                    'high',
                    NEW.user_id,
                    NEW.ip_address,
                    format('Brute force attack detected: %s failed login attempts from IP %s', failed_count, NEW.ip_address),
                    jsonb_build_object(
                        'failed_attempts', failed_count,
                        'time_window', '15 minutes',
                        'email', NEW.email
                    )
                );
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for brute force detection
DROP TRIGGER IF EXISTS trigger_detect_brute_force ON auth_logs;
CREATE TRIGGER trigger_detect_brute_force
    AFTER INSERT ON auth_logs
    FOR EACH ROW
    EXECUTE FUNCTION detect_brute_force_attempts();

-- Create function to detect geographic anomalies
CREATE OR REPLACE FUNCTION detect_geo_anomaly()
RETURNS TRIGGER AS $$
DECLARE
    last_login_country VARCHAR(100);
    last_login_time TIMESTAMP;
    time_diff_minutes INTEGER;
    alert_exists BOOLEAN;
BEGIN
    -- Only check for successful logins with geolocation data
    IF NEW.status = 'success' AND NEW.geo_country IS NOT NULL THEN
        -- Get the last successful login for this user
        SELECT geo_country, created_at INTO last_login_country, last_login_time
        FROM auth_logs
        WHERE user_id = NEW.user_id
        AND status = 'success'
        AND geo_country IS NOT NULL
        AND id != NEW.id
        ORDER BY created_at DESC
        LIMIT 1;

        -- If previous login exists and from different country
        IF last_login_country IS NOT NULL AND last_login_country != NEW.geo_country THEN
            -- Calculate time difference in minutes
            time_diff_minutes := EXTRACT(EPOCH FROM (NEW.created_at - last_login_time)) / 60;

            -- If login from different country within 60 minutes (impossible travel)
            IF time_diff_minutes < 60 THEN
                -- Check if alert already exists
                SELECT EXISTS(
                    SELECT 1 FROM security_alerts
                    WHERE user_id = NEW.user_id
                    AND alert_type = 'geo_anomaly'
                    AND status = 'open'
                    AND created_at > NOW() - INTERVAL '1 hour'
                ) INTO alert_exists;

                IF NOT alert_exists THEN
                    INSERT INTO security_alerts (
                        alert_type,
                        severity,
                        user_id,
                        ip_address,
                        description,
                        metadata
                    ) VALUES (
                        'geo_anomaly',
                        'critical',
                        NEW.user_id,
                        NEW.ip_address,
                        format('Impossible travel detected: Login from %s after %s minutes from %s', 
                               NEW.geo_country, time_diff_minutes, last_login_country),
                        jsonb_build_object(
                            'current_country', NEW.geo_country,
                            'previous_country', last_login_country,
                            'time_diff_minutes', time_diff_minutes,
                            'current_ip', NEW.ip_address
                        )
                    );
                END IF;
            END IF;
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for geographic anomaly detection
DROP TRIGGER IF EXISTS trigger_detect_geo_anomaly ON auth_logs;
CREATE TRIGGER trigger_detect_geo_anomaly
    AFTER INSERT ON auth_logs
    FOR EACH ROW
    EXECUTE FUNCTION detect_geo_anomaly();

-- Create function to clean up old sessions
CREATE OR REPLACE FUNCTION cleanup_expired_sessions()
RETURNS void AS $$
BEGIN
    UPDATE active_sessions
    SET is_active = FALSE
    WHERE expires_at < NOW()
    AND is_active = TRUE;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON TABLE ip_blocklist IS 'List of blocked IP addresses for security purposes';
COMMENT ON TABLE ip_whitelist IS 'List of whitelisted IP addresses that bypass certain security checks';
COMMENT ON TABLE active_sessions IS 'Tracks active user sessions for security monitoring';
COMMENT ON TABLE security_alerts IS 'Security alerts and anomalies detected by the system';
COMMENT ON FUNCTION detect_brute_force_attempts() IS 'Automatically detects and alerts on brute force login attempts';
COMMENT ON FUNCTION detect_geo_anomaly() IS 'Detects impossible travel patterns (logins from different countries in short time)';
COMMENT ON FUNCTION cleanup_expired_sessions() IS 'Marks expired sessions as inactive';
