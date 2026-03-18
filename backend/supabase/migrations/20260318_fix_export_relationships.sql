-- Migration: Fix Export Relationships
-- Description: Adds missing foreign keys and columns for report exports.

-- 1. Fix stock_requests relationships
DO $$ 
BEGIN
    -- Add foreign key for requested_by if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'stock_requests_requested_by_fkey'
    ) THEN
        ALTER TABLE stock_requests 
        ADD CONSTRAINT stock_requests_requested_by_fkey 
        FOREIGN KEY (requested_by) REFERENCES users(id);
    END IF;

    -- Add foreign key for reviewed_by if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'stock_requests_reviewed_by_fkey'
    ) THEN
        ALTER TABLE stock_requests 
        ADD CONSTRAINT stock_requests_reviewed_by_fkey 
        FOREIGN KEY (reviewed_by) REFERENCES users(id);
    END IF;
END $$;

-- 2. Fix audit_exceptions columns and relationships
DO $$
BEGIN
    -- Add branch_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'audit_exceptions' AND column_name = 'branch_id'
    ) THEN
        ALTER TABLE audit_exceptions ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    END IF;

    -- Add raised_by column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'audit_exceptions' AND column_name = 'raised_by'
    ) THEN
        ALTER TABLE audit_exceptions ADD COLUMN raised_by UUID REFERENCES users(id);
    END IF;
    
    -- Also ensure audit_night_sessions has branch_id
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_schema = 'public' AND table_name = 'audit_night_sessions' AND column_name = 'branch_id'
    ) THEN
        ALTER TABLE audit_night_sessions ADD COLUMN branch_id INTEGER REFERENCES branches(id);
    END IF;
END $$;
