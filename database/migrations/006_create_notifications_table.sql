-- =====================================================
-- Kyogong - NOTIFICATIONS SYSTEM
-- Migration: Create notifications table and related indexes
-- =====================================================

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id BIGSERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50),
    branch_id INTEGER REFERENCES branches(id) ON DELETE CASCADE,
    department VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
    category VARCHAR(50) NOT NULL,
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    is_read BOOLEAN DEFAULT FALSE,
    action_url VARCHAR(500),
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    read_at TIMESTAMP WITH TIME ZONE,
    expires_at TIMESTAMP WITH TIME ZONE,
    CONSTRAINT user_role_check CHECK (user_id IS NOT NULL OR role IS NOT NULL)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_role ON notifications(role) WHERE role IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_branch_id ON notifications(branch_id) WHERE branch_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created_at ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_expires_at ON notifications(expires_at) WHERE expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);
CREATE INDEX IF NOT EXISTS idx_notifications_priority ON notifications(priority);

-- Create composite index for common query patterns
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON notifications(user_id, is_read, created_at DESC) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_notifications_role_unread ON notifications(role, is_read, created_at DESC) WHERE role IS NOT NULL;

-- Add comment to table
COMMENT ON TABLE notifications IS 'System-wide notification system for Kyogong';
COMMENT ON COLUMN notifications.user_id IS 'Specific user to notify (if targeted notification)';
COMMENT ON COLUMN notifications.role IS 'Role to notify (if role-based notification)';
COMMENT ON COLUMN notifications.branch_id IS 'Branch to notify (if branch-specific notification)';
COMMENT ON COLUMN notifications.category IS 'Notification category: booking, inventory, housekeeping, maintenance, finance, staff, system, guest';
COMMENT ON COLUMN notifications.priority IS 'Priority level: low, medium, high, urgent';
COMMENT ON COLUMN notifications.metadata IS 'Additional JSON data for the notification';
COMMENT ON COLUMN notifications.expires_at IS 'Optional expiration date for time-sensitive notifications';

-- Enable Row Level Security
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

-- Create policies for notifications
-- Policy: Users can view their own notifications, role-based notifications, and branch notifications
CREATE POLICY notifications_select_policy ON notifications
    FOR SELECT
    USING (
        user_id = auth.uid()::integer OR
        role = (SELECT role FROM users WHERE id = auth.uid()::integer) OR
        branch_id = (SELECT branch_id FROM users WHERE id = auth.uid()::integer)
    );

-- Policy: Admins can insert notifications
CREATE POLICY notifications_insert_policy ON notifications
    FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::integer 
            AND role IN ('super_admin', 'general_manager')
        )
    );

-- Policy: Users can update their own notifications (mark as read)
CREATE POLICY notifications_update_policy ON notifications
    FOR UPDATE
    USING (
        user_id = auth.uid()::integer OR
        role = (SELECT role FROM users WHERE id = auth.uid()::integer) OR
        branch_id = (SELECT branch_id FROM users WHERE id = auth.uid()::integer)
    );

-- Policy: Admins can delete notifications
CREATE POLICY notifications_delete_policy ON notifications
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM users 
            WHERE id = auth.uid()::integer 
            AND role IN ('super_admin', 'general_manager')
        )
    );

-- Create function to automatically delete expired notifications
CREATE OR REPLACE FUNCTION delete_expired_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications 
    WHERE expires_at IS NOT NULL AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to delete old read notifications (older than 30 days)
CREATE OR REPLACE FUNCTION delete_old_read_notifications()
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM notifications 
    WHERE is_read = TRUE 
    AND read_at < NOW() - INTERVAL '30 days';
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Create function to get unread count for a user
CREATE OR REPLACE FUNCTION get_user_unread_count(p_user_id INTEGER)
RETURNS INTEGER AS $$
DECLARE
    unread_count INTEGER;
    user_role VARCHAR(50);
    user_branch_id INTEGER;
BEGIN
    -- Get user details
    SELECT role, branch_id INTO user_role, user_branch_id
    FROM users WHERE id = p_user_id;
    
    -- Count unread notifications
    SELECT COUNT(*) INTO unread_count
    FROM notifications
    WHERE (
        user_id = p_user_id OR
        role = user_role OR
        branch_id = user_branch_id
    )
    AND is_read = FALSE
    AND (expires_at IS NULL OR expires_at > NOW());
    
    RETURN unread_count;
END;
$$ LANGUAGE plpgsql;

-- Insert sample notifications for testing (optional - remove in production)
-- INSERT INTO notifications (role, title, message, type, category, priority) 
-- VALUES 
--     ('receptionist', 'System Notification', 'Welcome to the Kyogong notification system!', 'info', 'system', 'low'),
--     ('super_admin', 'System Ready', 'Notification system is now active and ready to use.', 'success', 'system', 'medium');

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON notifications TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE notifications_id_seq TO authenticated;

-- Create view for notification statistics
CREATE OR REPLACE VIEW notification_stats AS
SELECT 
    category,
    type,
    priority,
    COUNT(*) as total_count,
    SUM(CASE WHEN is_read THEN 1 ELSE 0 END) as read_count,
    SUM(CASE WHEN NOT is_read THEN 1 ELSE 0 END) as unread_count,
    AVG(EXTRACT(EPOCH FROM (read_at - created_at))/60)::INTEGER as avg_read_time_minutes
FROM notifications
WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY category, type, priority;

-- Grant view permissions
GRANT SELECT ON notification_stats TO authenticated;

COMMENT ON VIEW notification_stats IS 'Statistics about notifications for the last 30 days';

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Notifications table created successfully!';
    RAISE NOTICE 'Run the Python automation service: python python-services/notification_automation.py';
END $$;
