-- Fix missing payment_status column on bar_orders table and create the unpaid index.
ALTER TABLE public.bar_orders ADD COLUMN IF NOT EXISTS payment_status VARCHAR(50) DEFAULT 'pending';

-- Update existing bar_orders status mapping to payment_status if status is completed/paid
UPDATE public.bar_orders
SET payment_status = 'paid'
WHERE status = 'completed' AND payment_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_bar_orders_cashier_unpaid_day
  ON public.bar_orders(branch_id, created_at, payment_status)
  WHERE payment_status <> 'paid';
