-- ============================================================
-- KITCHEN POS CONSUMPTION & REAL-TIME WASTAGE ALERTS
-- Created: 2026-06-26
-- Purpose: Deduct raw stocks from active kitchen shifts on POS sales,
--          trigger real-time wastage alerts, and track chef liability.
-- ============================================================

-- 1. Create table to log raw ingredient consumption from POS sales
CREATE TABLE IF NOT EXISTS public.kitchen_shift_pos_consumption (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.kitchen_shifts(id) ON DELETE CASCADE,
  pos_shift_id UUID REFERENCES public.pos_outlet_shifts(id) ON DELETE SET NULL,
  pos_order_id UUID REFERENCES public.pos_shift_orders(id) ON DELETE SET NULL,
  pos_outlet_item_id UUID REFERENCES public.pos_outlet_items(id) ON DELETE SET NULL,
  portions_sold DECIMAL(10,3) NOT NULL DEFAULT 0,
  raw_item_sku VARCHAR(100) NOT NULL,
  raw_item_name VARCHAR(255) NOT NULL,
  raw_quantity_consumed DECIMAL(10,3) NOT NULL DEFAULT 0,
  raw_unit VARCHAR(50),
  cost_price DECIMAL(12,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_pos_consumption_shift ON public.kitchen_shift_pos_consumption(shift_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_pos_consumption_order ON public.kitchen_shift_pos_consumption(pos_order_id);

-- 2. Create kitchen wastage alerts table
CREATE TABLE IF NOT EXISTS public.kitchen_wastage_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shift_id UUID NOT NULL REFERENCES public.kitchen_shifts(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('recipe_variance', 'spoilage_spike', 'unexplained_shortage', 'production_shortfall')),
  severity VARCHAR(20) NOT NULL CHECK (severity IN ('warning', 'critical')),
  item_sku VARCHAR(50),
  item_name VARCHAR(255),
  expected_value DECIMAL(10,3),
  actual_value DECIMAL(10,3),
  variance_value DECIMAL(10,3),
  variance_cost DECIMAL(12,2),
  message TEXT,
  acknowledged_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  acknowledged_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_wastage_alerts_branch ON public.kitchen_wastage_alerts(branch_id);
CREATE INDEX IF NOT EXISTS idx_kitchen_wastage_alerts_shift ON public.kitchen_wastage_alerts(shift_id);

-- 3. Extend waste logs and wastage records to attribute responsibility to chef
DO $$
BEGIN
  IF EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'waste_logs') THEN
    ALTER TABLE public.waste_logs ADD COLUMN IF NOT EXISTS responsible_chef_id UUID REFERENCES public.users(id) ON DELETE SET NULL;
  END IF;
END $$;

ALTER TABLE public.wastage_records ADD COLUMN IF NOT EXISTS responsible_chef_id UUID REFERENCES public.users(id) ON DELETE SET NULL;

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.kitchen_shift_pos_consumption ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kitchen_wastage_alerts ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
DROP POLICY IF EXISTS pos_consumption_select ON public.kitchen_shift_pos_consumption;
CREATE POLICY pos_consumption_select ON public.kitchen_shift_pos_consumption
  FOR SELECT USING (
    shift_id IN (
      SELECT id FROM public.kitchen_shifts 
      WHERE branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    )
    OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor', 'general_manager')
  );

DROP POLICY IF EXISTS pos_consumption_insert ON public.kitchen_shift_pos_consumption;
CREATE POLICY pos_consumption_insert ON public.kitchen_shift_pos_consumption
  FOR INSERT WITH CHECK (
    shift_id IN (
      SELECT id FROM public.kitchen_shifts 
      WHERE branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    )
  );

DROP POLICY IF EXISTS wastage_alerts_select ON public.kitchen_wastage_alerts;
CREATE POLICY wastage_alerts_select ON public.kitchen_wastage_alerts
  FOR SELECT USING (
    branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor', 'general_manager')
  );

DROP POLICY IF EXISTS wastage_alerts_update ON public.kitchen_wastage_alerts;
CREATE POLICY wastage_alerts_update ON public.kitchen_wastage_alerts
  FOR UPDATE USING (
    branch_id = current_setting('app.current_branch_id', TRUE)::INTEGER
    OR current_setting('app.user_role', TRUE) IN ('super_admin', 'director', 'auditor', 'general_manager')
  );
