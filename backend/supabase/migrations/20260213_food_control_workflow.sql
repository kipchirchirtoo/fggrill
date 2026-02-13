-- Add status workflow to kitchen food control recordings
-- Created: 2026-02-13

-- 1. Update Kitchen Wastage
ALTER TABLE kitchen_wastage 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending_review',
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auditor_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_notes TEXT;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kitchen_wastage_status_check') THEN
        ALTER TABLE kitchen_wastage ADD CONSTRAINT kitchen_wastage_status_check 
        CHECK (status IN ('pending_review', 'reviewed', 'approved', 'rejected'));
    END IF;
END $$;

-- 2. Update Kitchen Usage
ALTER TABLE kitchen_usage 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'pending_review',
ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS auditor_id UUID REFERENCES users(id),
ADD COLUMN IF NOT EXISTS audited_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS review_notes TEXT;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'kitchen_usage_status_check') THEN
        ALTER TABLE kitchen_usage ADD CONSTRAINT kitchen_usage_status_check 
        CHECK (status IN ('pending_review', 'reviewed', 'approved', 'rejected'));
    END IF;
END $$;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_k_wastage_status ON kitchen_wastage(status);
CREATE INDEX IF NOT EXISTS idx_k_usage_status ON kitchen_usage(status);
