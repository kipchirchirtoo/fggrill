-- Harden RLS ahead of allowing Flutter to read some tables directly from
-- Supabase (instead of only through the Node backend's service-role key).
--
-- Two gaps existed before this migration, found while auditing what direct
-- reads would actually be allowed to see:
--   1. pos_outlet_items, pos_shift_orders, pos_outlet_shifts, branch_stock
--      had RLS DISABLED entirely -- a direct client read with any valid
--      Supabase key would see every branch's data, unfiltered.
--   2. restaurant_menu_items/restaurant_menu_categories/restaurant_orders/
--      restaurant_order_items had RLS enabled but only checked the user's
--      ROLE, never their branch -- any restaurant-role user could read
--      every other branch's menu and orders.
--
-- This migration only touches SELECT policies (the read-leak side). Write
-- policies are left alone: the Node backend writes with the service-role
-- key, which bypasses RLS entirely regardless of policy content, so they
-- aren't relevant to the direct-read path this is hardening for.
--
-- The restaurant_orders/restaurant_order_items role list was expanded from
-- the original (super_admin, manager, restaurant, receptionist) to the
-- full set of operational roles that need direct order/kitchen visibility
-- (cashier station roles, kitchen, branch_accountant, auditor, etc.) --
-- the original list was too narrow for anything beyond the Node backend's
-- own service-role access, and 'manager' didn't match any real role value
-- in UserRole (the actual value is 'branch_manager') -- fixed here too.
--
-- Adds one shared helper instead of repeating the same subquery in every
-- policy, since none existed and several near-duplicate inline subqueries
-- already existed across the policies touched below.

CREATE OR REPLACE FUNCTION public.current_branch_id()
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT branch_id FROM public.users WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.current_branch_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.current_branch_id() TO authenticated, service_role;

-- ── Tables with RLS disabled entirely ───────────────────────────────────

ALTER TABLE public.pos_outlet_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Branch-scoped read" ON public.pos_outlet_items;
CREATE POLICY "Branch-scoped read" ON public.pos_outlet_items
  FOR SELECT
  USING (branch_id = public.current_branch_id());

ALTER TABLE public.pos_shift_orders ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Branch-scoped read" ON public.pos_shift_orders;
CREATE POLICY "Branch-scoped read" ON public.pos_shift_orders
  FOR SELECT
  USING (branch_id = public.current_branch_id());

ALTER TABLE public.pos_outlet_shifts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Branch-scoped read" ON public.pos_outlet_shifts;
CREATE POLICY "Branch-scoped read" ON public.pos_outlet_shifts
  FOR SELECT
  USING (branch_id = public.current_branch_id());

ALTER TABLE public.branch_stock ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Branch-scoped read" ON public.branch_stock;
CREATE POLICY "Branch-scoped read" ON public.branch_stock
  FOR SELECT
  USING (branch_id = public.current_branch_id());

-- ── Tables with role-only RLS (no branch scoping) ───────────────────────
-- branch_id is nullable on the menu tables: NULL means a global/shared
-- item available at every branch (see 20260522_menu_branch_support.sql),
-- so the policy must allow NULL through, not just an exact branch match.

DROP POLICY IF EXISTS "Anyone can view menu categories" ON public.restaurant_menu_categories;
CREATE POLICY "Anyone can view menu categories" ON public.restaurant_menu_categories
  FOR SELECT
  USING (branch_id IS NULL OR branch_id = public.current_branch_id());

DROP POLICY IF EXISTS "Anyone can view menu items" ON public.restaurant_menu_items;
CREATE POLICY "Anyone can view menu items" ON public.restaurant_menu_items
  FOR SELECT
  USING (branch_id IS NULL OR branch_id = public.current_branch_id());

DROP POLICY IF EXISTS "Staff can view all orders" ON public.restaurant_orders;
CREATE POLICY "Staff can view all orders" ON public.restaurant_orders
  FOR SELECT
  USING (
    branch_id = public.current_branch_id()
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN (
        'super_admin', 'general_manager', 'branch_manager', 'restaurant',
        'receptionist', 'auditor', 'pos_kitchen', 'kitchen', 'cashier',
        'restaurant_cashier', 'main_bar_cashier', 'executive_bar_cashier',
        'non_consumables_cashier', 'branch_accountant'
      )
    )
  );

DROP POLICY IF EXISTS "Staff can view all order items" ON public.restaurant_order_items;
CREATE POLICY "Staff can view all order items" ON public.restaurant_order_items
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.restaurant_orders o
      WHERE o.id = order_id
      AND o.branch_id = public.current_branch_id()
    )
    AND EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid()
      AND role IN (
        'super_admin', 'general_manager', 'branch_manager', 'restaurant',
        'receptionist', 'auditor', 'pos_kitchen', 'kitchen', 'cashier',
        'restaurant_cashier', 'main_bar_cashier', 'executive_bar_cashier',
        'non_consumables_cashier', 'branch_accountant'
      )
    )
  );

NOTIFY pgrst, 'reload schema';
