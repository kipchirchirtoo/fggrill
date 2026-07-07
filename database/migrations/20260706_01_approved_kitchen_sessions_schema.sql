ALTER TABLE stock_issues 
  ADD COLUMN IF NOT EXISTS production_section_id UUID;


CREATE TABLE IF NOT EXISTS branch_shift_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id INTEGER NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  effective_from_business_date DATE NOT NULL,
  shift_mode TEXT NOT NULL CHECK (shift_mode IN ('SINGLE_SHIFT', 'TWO_SHIFT')),
  changed_by UUID REFERENCES users(id) ON DELETE SET NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reason_note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_branch_shift_effective UNIQUE (branch_id, effective_from_business_date)
);

CREATE INDEX IF NOT EXISTS idx_branch_shift_config_date 
  ON branch_shift_config (branch_id, effective_from_business_date DESC);

-- RLS Configuration
ALTER TABLE branch_shift_config ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS branch_scope_policy ON branch_shift_config;
CREATE POLICY branch_scope_policy ON branch_shift_config
  TO authenticated
  USING (branch_id = (auth.jwt() ->> 'branch_id')::int);

DROP POLICY IF EXISTS service_role_all ON branch_shift_config;
CREATE POLICY service_role_all ON branch_shift_config
  FOR ALL
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');

-- Category B: Conditionally Approved Migrations
ALTER TABLE kitchen_shift_production 
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

DROP INDEX IF EXISTS uq_kitchen_shift_prod_idempotency;
CREATE UNIQUE INDEX uq_kitchen_shift_prod_idempotency 
  ON kitchen_shift_production (branch_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;

ALTER TABLE kitchen_shift_stock_take 
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

DROP INDEX IF EXISTS uq_kitchen_shift_stock_take_idempotency;
CREATE UNIQUE INDEX uq_kitchen_shift_stock_take_idempotency 
  ON kitchen_shift_stock_take (branch_id, idempotency_key) 
  WHERE idempotency_key IS NOT NULL;
