-- Migration: Create stock_take_audit_log table with indexes
-- Feature: Stock-Take Auditor Submission Workflow
-- Requirements: 4.1, 4.2, 4.4
-- Description: Creates audit log table for tracking stock-take status changes, notifications, and user actions

-- Create stock_take_audit_log table
CREATE TABLE IF NOT EXISTS stock_take_audit_log (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    stock_take_id UUID NOT NULL REFERENCES stock_takes(id) ON DELETE CASCADE,
    
    -- Change tracking
    action VARCHAR(50) NOT NULL,
    previous_status VARCHAR(20),
    new_status VARCHAR(20),
    
    -- User tracking
    user_id UUID REFERENCES users(id),
    user_role VARCHAR(50),
    
    -- Event details
    event_type VARCHAR(50) NOT NULL,
    event_data JSONB,
    
    -- Notification tracking
    notification_id BIGINT REFERENCES notifications(id),
    notification_status VARCHAR(20),
    
    -- Metadata
    ip_address VARCHAR(45),
    user_agent TEXT,
    
    -- Timestamp
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance optimization
CREATE INDEX idx_audit_log_stock_take ON stock_take_audit_log(stock_take_id);
CREATE INDEX idx_audit_log_created_at ON stock_take_audit_log(created_at);
CREATE INDEX idx_audit_log_action ON stock_take_audit_log(action);

-- Add comment to table
COMMENT ON TABLE stock_take_audit_log IS 'Audit trail for stock-take status changes, notifications, and user actions';

-- Add comments to key columns
COMMENT ON COLUMN stock_take_audit_log.action IS 'Type of action: status_change, notification_sent, notification_failed';
COMMENT ON COLUMN stock_take_audit_log.event_type IS 'Event category: submission, verification, notification';
COMMENT ON COLUMN stock_take_audit_log.event_data IS 'Additional context stored as JSON';
COMMENT ON COLUMN stock_take_audit_log.notification_status IS 'Status of notification: sent, failed, retried';

-- =====================================================
-- Add submission workflow columns to stock_takes table
-- Feature: Stock-Take Auditor Submission Workflow
-- Requirements: 3.3, 4.1
-- Description: Adds columns for tracking submission, verification, and notification status
-- =====================================================

-- Add submission workflow columns
ALTER TABLE stock_takes ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ;
ALTER TABLE stock_takes ADD COLUMN IF NOT EXISTS submitted_by UUID REFERENCES users(id);
ALTER TABLE stock_takes ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE stock_takes ADD COLUMN IF NOT EXISTS notification_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE stock_takes ADD COLUMN IF NOT EXISTS notification_sent_at TIMESTAMPTZ;

-- Create indexes for performance optimization
CREATE INDEX IF NOT EXISTS idx_stock_takes_status ON stock_takes(status);
CREATE INDEX IF NOT EXISTS idx_stock_takes_branch_status ON stock_takes(branch_id, status);
CREATE INDEX IF NOT EXISTS idx_stock_takes_submitted_at ON stock_takes(submitted_at) WHERE submitted_at IS NOT NULL;

-- Add comments to new columns
COMMENT ON COLUMN stock_takes.submitted_at IS 'Timestamp when stock-take was submitted to auditor';
COMMENT ON COLUMN stock_takes.submitted_by IS 'User who submitted the stock-take';
COMMENT ON COLUMN stock_takes.verified_at IS 'Timestamp when stock-take was automatically verified';
COMMENT ON COLUMN stock_takes.notification_sent IS 'Flag indicating if auditor notification was sent';
COMMENT ON COLUMN stock_takes.notification_sent_at IS 'Timestamp when notification was sent to auditor';
