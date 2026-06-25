-- Define RLS SELECT policies for POS void requests tables to allow PowerSync/Supabase direct clients to query them.
--
-- Without these policies, direct read queries from the mobile/desktop app return zero rows,
-- blocking the Cashier and Branch Accountant from seeing pending/actioned voids.

ALTER TABLE public.pos_item_void_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Branch-scoped read" ON public.pos_item_void_requests;
CREATE POLICY "Branch-scoped read" ON public.pos_item_void_requests
  FOR SELECT
  USING (branch_id = public.current_branch_id());

ALTER TABLE public.pos_void_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Branch-scoped read" ON public.pos_void_requests;
CREATE POLICY "Branch-scoped read" ON public.pos_void_requests
  FOR SELECT
  USING (branch_id = public.current_branch_id());

NOTIFY pgrst, 'reload schema';
