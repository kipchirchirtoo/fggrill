-- Create void_requests table for accountant approval workflow
CREATE TABLE IF NOT EXISTS void_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES restaurant_orders(id) ON DELETE CASCADE,
  requested_by UUID NOT NULL REFERENCES users(id),
  reason TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  branch_id INTEGER NOT NULL REFERENCES branches(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_void_requests_status ON void_requests(status);
CREATE INDEX IF NOT EXISTS idx_void_requests_branch ON void_requests(branch_id);
CREATE INDEX IF NOT EXISTS idx_void_requests_order ON void_requests(order_id);
CREATE INDEX IF NOT EXISTS idx_void_requests_requested_by ON void_requests(requested_by);

-- Add trigger for updated_at
CREATE OR REPLACE FUNCTION update_void_requests_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_void_requests_updated_at
  BEFORE UPDATE ON void_requests
  FOR EACH ROW
  EXECUTE FUNCTION update_void_requests_updated_at();

-- Add is_merged and merged_into columns to restaurant_bills if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurant_bills' 
    AND column_name = 'is_merged'
  ) THEN
    ALTER TABLE restaurant_bills ADD COLUMN is_merged BOOLEAN DEFAULT false;
  END IF;
  
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'restaurant_bills' 
    AND column_name = 'merged_into'
  ) THEN
    ALTER TABLE restaurant_bills ADD COLUMN merged_into UUID REFERENCES restaurant_bills(id);
  END IF;
END $$;
