CREATE TABLE IF NOT EXISTS public.kitchen_prep_batches (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  branch_id INTEGER NOT NULL REFERENCES public.branches(id) ON DELETE CASCADE,
  shift_id UUID NOT NULL REFERENCES public.kitchen_shifts(id) ON DELETE CASCADE,
  recipe_id UUID NOT NULL REFERENCES public.kitchen_production_recipes(id) ON DELETE RESTRICT,
  raw_item_sku VARCHAR(100) NOT NULL,
  raw_item_name VARCHAR(255) NOT NULL,
  raw_quantity_sent NUMERIC(14,3) NOT NULL CHECK (raw_quantity_sent > 0),
  raw_unit VARCHAR(50) NOT NULL,
  produced_item_name VARCHAR(255) NOT NULL,
  produced_item_sku VARCHAR(100),
  produced_inventory_item_id UUID REFERENCES public.inventory_items(id) ON DELETE SET NULL,
  produced_unit VARCHAR(50) NOT NULL,
  returned_quantity NUMERIC(14,3),
  returned_unit VARCHAR(50),
  status VARCHAR(20) NOT NULL DEFAULT 'sent'
    CHECK (status IN ('sent', 'returned', 'cancelled')),
  assigned_staff_ids TEXT[] NOT NULL DEFAULT '{}',
  sent_notes TEXT,
  return_notes TEXT,
  sent_by UUID,
  returned_by UUID,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  returned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_kitchen_prep_batches_shift
  ON public.kitchen_prep_batches(shift_id);

CREATE INDEX IF NOT EXISTS idx_kitchen_prep_batches_branch
  ON public.kitchen_prep_batches(branch_id);

CREATE INDEX IF NOT EXISTS idx_kitchen_prep_batches_status
  ON public.kitchen_prep_batches(status);

COMMENT ON TABLE public.kitchen_prep_batches IS
  'Simple storekeeper prep workflow: raw stock sent for prep, processed usable quantity received back, then issued to kitchen separately.';
