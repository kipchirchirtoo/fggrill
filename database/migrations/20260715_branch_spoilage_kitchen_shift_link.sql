ALTER TABLE public.branch_spoilage_log
  ADD COLUMN IF NOT EXISTS kitchen_shift_id UUID REFERENCES public.kitchen_shifts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_branch_spoilage_kitchen_shift
  ON public.branch_spoilage_log(kitchen_shift_id);
