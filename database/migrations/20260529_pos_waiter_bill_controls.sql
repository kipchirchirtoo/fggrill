-- Waiter POS bill controls: recall, merge, split, and void approval.

ALTER TABLE IF EXISTS pos_shift_orders
  ADD COLUMN IF NOT EXISTS split_parent_order_id UUID REFERENCES pos_shift_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS split_type TEXT,
  ADD COLUMN IF NOT EXISTS is_split BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS is_merged BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS merged_into UUID REFERENCES pos_shift_orders(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_request_status TEXT,
  ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS voided_by UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS void_reason TEXT;

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_split_parent
  ON pos_shift_orders(split_parent_order_id);

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_merged_into
  ON pos_shift_orders(merged_into);

CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_void_request_status
  ON pos_shift_orders(void_request_status);

CREATE TABLE IF NOT EXISTS pos_void_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  shift_id UUID NOT NULL REFERENCES pos_outlet_shifts(id) ON DELETE CASCADE,
  outlet_id UUID NOT NULL REFERENCES pos_outlets(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES pos_shift_orders(id) ON DELETE CASCADE,
  order_number TEXT,
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ,
  rejection_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_pos_void_requests_status
  ON pos_void_requests(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_void_requests_branch
  ON pos_void_requests(branch_id, status);

CREATE INDEX IF NOT EXISTS idx_pos_void_requests_order
  ON pos_void_requests(order_id);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_trigger
    WHERE tgname = 'set_pos_void_requests_updated_at'
  ) THEN
    CREATE TRIGGER set_pos_void_requests_updated_at
    BEFORE UPDATE ON pos_void_requests
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
  END IF;
EXCEPTION WHEN undefined_function THEN
  NULL;
END $$;

NOTIFY pgrst, 'reload schema';
