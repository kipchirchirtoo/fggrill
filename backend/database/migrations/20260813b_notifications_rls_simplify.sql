-- The role-broadcast branch of notifications_select_own referenced
-- public.users in a subquery to resolve the connecting user's role/branch
-- (EXISTS (SELECT ... FROM users u WHERE u.id = auth.uid() ...)). users
-- also has RLS enabled with zero policies (same default-deny gap
-- notifications itself had) — querying into an RLS-blocked table from
-- inside another policy's subquery is exactly the kind of thing that can
-- turn into a Realtime postgres_changes subscribe-time channelError rather
-- than a clean "just returns no rows". Simplifying to the direct
-- user_id = auth.uid() case only, which is self-contained and is what
-- every current notifyUser()-targeted event (order ready, void
-- acknowledgment) actually needs — role-broadcast notifications
-- (notifyRole, e.g. the kitchen recall alert) still reach users via the
-- existing GET /notifications poll, just not as an instant toast, until
-- users gets its own RLS policy and this is safely reintroduced.
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT
  TO anon, authenticated
  USING (user_id = auth.uid());

NOTIFY pgrst, 'reload schema';
