ALTER TABLE public.kitchen_prep_batches
  ADD COLUMN IF NOT EXISTS process_loss_quantity NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS process_loss_unit VARCHAR(50),
  ADD COLUMN IF NOT EXISTS wastage_quantity NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS wastage_unit VARCHAR(50),
  ADD COLUMN IF NOT EXISTS wastage_reason TEXT,
  ADD COLUMN IF NOT EXISTS unexplained_variance_quantity NUMERIC(14,3),
  ADD COLUMN IF NOT EXISTS unexplained_variance_unit VARCHAR(50);

ALTER TABLE public.kitchen_prep_batches
  DROP CONSTRAINT IF EXISTS kitchen_prep_batches_process_loss_quantity_check;

ALTER TABLE public.kitchen_prep_batches
  ADD CONSTRAINT kitchen_prep_batches_process_loss_quantity_check
  CHECK (process_loss_quantity IS NULL OR process_loss_quantity >= 0);

ALTER TABLE public.kitchen_prep_batches
  DROP CONSTRAINT IF EXISTS kitchen_prep_batches_wastage_quantity_check;

ALTER TABLE public.kitchen_prep_batches
  ADD CONSTRAINT kitchen_prep_batches_wastage_quantity_check
  CHECK (wastage_quantity IS NULL OR wastage_quantity >= 0);

COMMENT ON COLUMN public.kitchen_prep_batches.process_loss_quantity IS
  'Declared normal process loss recorded in the raw/input unit, e.g. peelings or trimming.';

COMMENT ON COLUMN public.kitchen_prep_batches.wastage_quantity IS
  'Declared avoidable prep wastage recorded in the raw/input unit.';

COMMENT ON COLUMN public.kitchen_prep_batches.unexplained_variance_quantity IS
  'System-computed residual difference after usable return, process loss and wastage.';
