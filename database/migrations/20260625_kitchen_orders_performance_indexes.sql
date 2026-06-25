-- Performance indexes for kitchen display orders to reduce timeouts and
-- ease pressure on the Supabase connection pool / schema cache.
-- Additive only; safe to apply on a running system.

-- Active kitchen orders: shifts filtered by status + opened_at
CREATE INDEX IF NOT EXISTS idx_pos_outlet_shifts_branch_status_opened
  ON public.pos_outlet_shifts(branch_id, status, opened_at DESC);

-- Active/historical POS orders filtered by shift + kitchen status
CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_shift_kitchen_status_created
  ON public.pos_shift_orders(shift_id, kitchen_status, created_at DESC);

-- POS orders filtered by shift + status/payment_status for history
CREATE INDEX IF NOT EXISTS idx_pos_shift_orders_shift_status_payment_created
  ON public.pos_shift_orders(shift_id, status, payment_status, created_at DESC);

-- Outlet type lookup for the kitchen-display shift filtering
CREATE INDEX IF NOT EXISTS idx_pos_outlets_branch_type
  ON public.pos_outlets(branch_id, outlet_type);

-- Restaurant orders history lookup by branch + status + created_at
CREATE INDEX IF NOT EXISTS idx_restaurant_orders_branch_status_created
  ON public.restaurant_orders(branch_id, status, created_at DESC);
