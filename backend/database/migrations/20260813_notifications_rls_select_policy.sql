-- notifications has RLS enabled (from an earlier RLS-hardening pass) but
-- carries zero policies — a hard default-deny. That's invisible to the
-- Node backend (it reads via the service-role key, which bypasses RLS
-- entirely) but is fatal to Supabase Realtime: postgres_changes
-- subscriptions are evaluated against the connecting client's RLS
-- visibility, so with no SELECT policy literally no row ever reaches a
-- direct-Supabase client — this is why NotificationToastOverlay's live
-- subscription (famous_gates_app/lib/core/realtime/realtime_service.dart's
-- watchNotifications) never received anything, for any notification,
-- including ones that predate this feature (e.g. the existing "Captain
-- order ready" notifications).
--
-- auth.uid() resolves correctly here because this app mints a
-- Supabase-JWT-secret-signed bridge token specifically so RLS can see the
-- real user id (see SupabaseDirectService's doc comment in
-- lib/core/supabase/supabase_direct_service.dart) even though login itself
-- is bcrypt + a custom JWT, not Supabase Auth.
DROP POLICY IF EXISTS notifications_select_own ON public.notifications;
CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT
  TO anon, authenticated
  USING (
    user_id = auth.uid()
    OR (
      role IS NOT NULL
      AND EXISTS (
        SELECT 1 FROM public.users u
        WHERE u.id = auth.uid()
          AND u.role = notifications.role
          AND (notifications.branch_id IS NULL OR u.branch_id = notifications.branch_id)
      )
    )
  );

NOTIFY pgrst, 'reload schema';
