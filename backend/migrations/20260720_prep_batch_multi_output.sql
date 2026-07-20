-- Add extra_outputs JSONB column to kitchen_prep_batches.
-- Supports receiving multiple produced items (e.g. Cut Chips + Peeled Potatoes)
-- from a single raw-material prep batch.
-- Each element: { sku, name, quantity, unit, inventory_item_id }

ALTER TABLE public.kitchen_prep_batches
    ADD COLUMN IF NOT EXISTS extra_outputs JSONB DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.kitchen_prep_batches.extra_outputs IS
    'All produced output items and quantities from this prep batch. '
    'Each element: {sku, name, quantity, unit, inventory_item_id}. '
    'returned_quantity holds the grand total for backwards-compatible queries.';
