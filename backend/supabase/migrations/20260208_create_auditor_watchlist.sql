-- Create auditor_watchlist table
CREATE TABLE IF NOT EXISTS auditor_watchlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type TEXT NOT NULL, -- 'invoice', 'order', 'payment', etc.
    entity_id TEXT NOT NULL,   -- Store as text to handle both UUIDs and numeric IDs from different tables
    reason TEXT,
    flagged_by UUID REFERENCES users(id),
    status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'resolved', 'dismissed')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_auditor_watchlist_entity ON auditor_watchlist(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_auditor_watchlist_status ON auditor_watchlist(status);
CREATE INDEX IF NOT EXISTS idx_auditor_watchlist_flagged_by ON auditor_watchlist(flagged_by);

-- Updated at trigger
CREATE OR REPLACE FUNCTION update_auditor_watchlist_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auditor_watchlist_updated_at
    BEFORE UPDATE ON auditor_watchlist
    FOR EACH ROW
    EXECUTE FUNCTION update_auditor_watchlist_updated_at();

COMMENT ON TABLE auditor_watchlist IS 'Stores items flagged by auditors for further investigation';
