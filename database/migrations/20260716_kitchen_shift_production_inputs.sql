CREATE TABLE IF NOT EXISTS public.kitchen_shift_production_inputs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  production_id UUID NOT NULL REFERENCES public.kitchen_shift_production(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.kitchen_shifts(id) ON DELETE CASCADE,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  raw_item_sku VARCHAR(100) NOT NULL,
  raw_item_name VARCHAR(255) NOT NULL,
  quantity_used NUMERIC(14,3) NOT NULL CHECK (quantity_used > 0),
  unit VARCHAR(50) NOT NULL,
  normalized_quantity_used NUMERIC(14,3),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_shift_production_inputs_production
  ON public.kitchen_shift_production_inputs(production_id);

CREATE INDEX IF NOT EXISTS idx_kitchen_shift_production_inputs_shift
  ON public.kitchen_shift_production_inputs(shift_id);

CREATE INDEX IF NOT EXISTS idx_kitchen_shift_production_inputs_branch
  ON public.kitchen_shift_production_inputs(branch_id);
